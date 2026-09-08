Task ID: ZP-TBD-63
Zoho App: Creator (Trip_Manager.ds) + CRM Validation Rule function (read-only reference)
Reported by: user, 2026-09-08/09 -- screenshot showing "DFH White Escalade 2015 CQ 9776"
assigned to two different funerals both at 10:00a on Saturday, Sept 19, 2026.

## Report
"Same car booked for two funerals on September 19 ... the system should prevent this
situation." Also, separately: "when we change Hearse field in CRM Trips module a
validation rule function called Prevent Edit Vehicle... but when from Trip Manager save
assignment is this process maintained, because I see that no Vehicle Booking module record
created on select a vehicle."

## Root cause -- confirmed via the live `preventeditvehicle` validation rule source
Pulled directly (CRM automation functions are readable via ZohoCRM_getFunctionCode, unlike
Creator's `.ds` files). The function does:
```
entityMap = crmAPIRequest.toMap().get("record");
try { dealId = entityMap.get("Deal").get("id"); } catch (e) { dealId = null; }
...
if(!isNull(dealId))
{
    ... ALL of it lives in here: the package-lock check, the same-day double-booking
    COQL query against Vehicle_Bookings, and the Vehicle_Bookings create/update ...
}
else
{
    response.put('status','success');   // does nothing else at all
}
```
Zoho populates a validation rule's `entityMap` ("record") from the fields actually present
in the incoming update **payload** -- not the full stored record. `saveAssignment`'s REST
PUT (the ZP-TBD-25 fix, confirmed already live) only ever sends the fields being changed
(`Vehicle`, `Driver`, `Departure_Time`, `Trip_Status`, etc.) -- it has never included `Deal`,
since Deal isn't one of the fields being edited. So `entityMap.get("Deal")` comes back
empty, the try/catch sets `dealId = null`, and the validation rule's ENTIRE body --
including the double-booking check and the Vehicle_Bookings creation -- is silently
skipped, every single time a vehicle is assigned via Trip Manager. This is exactly why no
`Vehicle_Bookings` record was ever being created from Trip Manager, and exactly why nothing
stopped the same vehicle from being assigned to two different Saturday funerals.

A direct CRM UI edit of the Hearse field doesn't hit this, because the standard record-edit
form submits the whole record (Deal included, since it's already populated and visible on
the form), so `entityMap.get("Deal")` succeeds there and the rule runs its full logic.

## Fix (guideline, `saveAssignment_FIX.deluge`, this folder)
`saveAssignment` now fetches the Trip's current `Deal` (broadening the existing
`currentTrip` fetch, which previously only ran when `isSchedulable`, to also run whenever
`hearseId != ""`) and adds `updMap.put("Deal", dealIdForVR.toLong());` to the PUT payload
whenever a vehicle is being assigned. Everything else in the function -- the REST PUT
mechanism from ZP-TBD-25, the missing-item checks, the Trip_Status scheduling logic -- is
unchanged.

**This does not touch the validation rule function itself** (read-only reference, no write
access) -- the fix is entirely on the payload-shape side, giving the existing rule the one
field it was always expecting but never receiving from this specific save path.

## Deploy
1. Open `map saveAssignment(...)` in the Trip Manager Creator app's function editor.
2. Replace its full contents with `saveAssignment_FIX.deluge` (the whole function, not a
   diff).
3. **Test 1 (Vehicle_Bookings now gets created):** in Trip Manager, assign an
   `Availability_Based` vehicle (e.g. a named Amber vehicle, not the generic "Hearse" line
   item) to a funeral trip with no existing conflict. Confirm the assignment saves
   normally, AND check CRM directly that a `Vehicle_Bookings` record now exists for it.
4. **Test 2 (double-booking now correctly blocked):** assign that same vehicle to a
   second funeral trip scheduled the same day. Confirm the second assignment is now
   rejected in the Trip Manager UI with "This vehicle is already booked on this day."
   instead of silently succeeding.
5. **Test 3 (package-locked vehicle still correctly blocked):** on a Deal whose package
   includes a locked `Availability_Based` vehicle product, try assigning a *different*
   vehicle via Trip Manager. Confirm it's still rejected the same way it already was
   under ZP-TBD-25.
6. **No regression:** confirm a normal single, non-conflicting vehicle assignment still
   saves and schedules the trip exactly as before.

## Follow-up needed (not part of this fix): the two already-double-booked Sept 19 funerals
This fix prevents the situation going forward -- it does not retroactively resolve the
"DFH White Escalade 2015 CQ 9776" conflict already on the two existing Sept 19 funerals.
Andrea (or Trip Manager staff) will still need to manually decide which funeral keeps that
vehicle and reassign the other to a different one.

## UPDATE 2026-09-09 -- v1 (above) reported still not working; superseded by v2

After deploying v1, the user reported it still wasn't blocking double-bookings, and asked
for three specific behaviors instead: (1) validate on save the same way the CRM function
would, with a clear rejection message if the vehicle is already booked that day; (2) make
departure time mandatory whenever any vehicle is selected; (3) the vehicle dropdown should
only ever list genuinely available vehicles.

Rather than keep debugging why `preventeditvehicle` firing via the REST PUT wasn't
producing the expected result, `saveAssignment` was rewritten (`saveAssignment_FIX_v2.deluge`,
this folder) to be fully self-contained -- it no longer depends on that CRM validation rule
at all for this logic:
- Departure time is now mandatory whenever any vehicle (hearse, removal, or rental) is
  selected -- previously only a soft "not yet scheduled" warning.
- Before saving, if the Hearse is a specific `Availability_Based` fleet vehicle, it directly
  queries `Vehicle_Bookings` for a same-day conflict (same query shape as the already-
  correct `getAvailableHearses` function) and rejects with "This vehicle is already booked
  on this day." if found, before ever attempting the save.
- On success, it creates/updates the `Vehicle_Bookings` record itself and stamps
  `Vehicle_Booking_ID` back onto the Trip -- giving `getAvailableHearses` (and therefore the
  dropdown's existing "hide booked vehicles" logic, which was already correct but had no
  real data to filter against) real booking data to work with.

**Important:** v2 intentionally does NOT send `Deal` in the PUT payload (unlike v1) --
doing so would make the CRM validation rule ALSO fire now that it can see Deal, risking a
SECOND, duplicate `Vehicle_Bookings` record for the same assignment. v2 is the sole owner
of this logic going forward; deploy v2 in place of v1, not on top of it.

**Known gap, out of scope for this fix:** if a trip's vehicle is changed from one
Availability_Based vehicle to a different one, the old `Vehicle_Bookings` record for the
previous vehicle is not actively released/deleted (same gap the original CRM validation
rule already had). Flag separately if stale bookings become a real problem.

### Deploy (v2)
1. Open `map saveAssignment(...)` in the Trip Manager Creator app's function editor.
2. Replace its full contents with `saveAssignment_FIX_v2.deluge` (the whole function, not
   a diff) -- this REPLACES v1, do not layer them.
3. **Test 1 (mandatory departure):** try saving with a vehicle selected but no departure
   time. Confirm it's rejected with "Please set a departure time before saving a vehicle
   assignment." and nothing is saved.
4. **Test 2 (booking created):** assign a specific `Availability_Based` vehicle with a
   departure time, no conflict. Confirm it saves, and a `Vehicle_Bookings` record now
   exists for it (Vehicle, Deal, Start/End matching the departure time, Status
   "Confirmed").
5. **Test 3 (double-booking blocked):** assign that same vehicle to a second funeral the
   same day. Confirm it's rejected with "This vehicle is already booked on this day." and
   the second trip's Vehicle field is not changed.
6. **Test 4 (dropdown filtering):** reopen the first funeral's vehicle dropdown (or a third,
   unrelated funeral on the same day) -- confirm the now-booked vehicle no longer appears
   in the "available" list.
7. **Test 5 (re-saving the same trip, no false conflict):** re-open the trip from Test 2 and
   save again (e.g. just changing the driver, vehicle/date unchanged). Confirm it does NOT
   reject itself as a conflict (the existing-booking-id exclusion should handle this).
8. **Test 6 (generic non-Availability_Based "Hearse" unaffected):** assign the generic
   "Hearse" line item (not a specific named vehicle) to a trip. Confirm no booking check
   applies and no `Vehicle_Bookings` record is created -- matches the Ethme Davids /
   Shemiah Gayle distinction already confirmed and explained to Andrea separately.
