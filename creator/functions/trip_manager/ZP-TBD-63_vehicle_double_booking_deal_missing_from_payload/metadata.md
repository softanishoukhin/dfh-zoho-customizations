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
