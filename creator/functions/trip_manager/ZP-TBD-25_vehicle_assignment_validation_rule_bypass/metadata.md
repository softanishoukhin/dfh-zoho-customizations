Task ID: ZP-TBD-25 (placeholder)
Zoho App: Creator (Trip_Manager.ds)
Function Name: map saveAssignment(...) -- EXISTING, this is a fix, not new.
Reported by: user, 2026-08-18

## Report
"In our CRM if we update the Hearse Vehicles value in Trip module record, then a validation
rule function called Prevent Edit Vehicle... updates the Vehicle Bookings record
accordingly, but once we change the value through Trip Manager it's not calling this
process."

## Root cause -- confirmed live
`Prevent Edit Vehicle` (function id `6503357000063657334`, api_name `preventeditvehicle`)
is a genuine Zoho CRM **Validation Rule** (`validation_type: "function"`, validation rule
id `6503357000063657344`) on `Trips.Vehicle` (field label "Hearse Vehicles"). It:
- Blocks the edit outright if the Deal's package includes a locked-in "Availability_Based"
  vehicle product and the entered Vehicle doesn't match it.
- Otherwise checks for a same-day double-booking of that vehicle via a `Vehicle_Bookings`
  COQL query, and either creates/updates the matching `Vehicle_Bookings` record, or blocks
  the save with "This vehicle is already booked on this day."

**Validation Rules are only enforced by Zoho's real REST API / UI save pipeline.**
`Trip_Manager.ds`'s `saveAssignment` writes the vehicle assignment via Deluge's built-in
`zoho.crm.updateRecord("Trips",...,{"trigger":{"workflow"}})` task -- that `trigger`
option only opts specific **workflow** rules in; it has no bearing on validation rules at
all, and validation rules don't run through that Deluge task regardless. So editing the
vehicle directly in CRM (real save pipeline, validation enforced) fires the rule; Trip
Manager's own update never does.

This is the same category of gap already fixed twice elsewhere in this exact codebase --
Driver_App.ds's `startJob` and `acceptTrip` carry their own header comments noting the
identical issue ("CRM update via a WORKFLOW-FIRING REST PUT ... none of them ran while
this used the plain ... zoho.crm.updateRecord call").

## Fix (guideline, `saveAssignment_FIX.deluge`, this folder)
Replaced the single `zoho.crm.updateRecord(...)` call with a raw REST PUT via `invokeurl`
to `/crm/v7/Trips/{id}` (same pattern already proven in Driver_App.ds) -- this routes
through the real API pipeline, so Validation Rules on Trips (including `Prevent Edit
Vehicle`) are enforced correctly from Trip Manager too. Everything else in
`saveAssignment` (missing-item checks, Trip_Status logic) is unchanged.

**Behavior change to be aware of:** since the validation rule can genuinely REJECT a save
(package-locked vehicle mismatch, or same-day double-booking), `saveAssignment` now parses
the REST response and surfaces that exact message back to the TM UI instead of a generic
failure. `widget.html` already displays `res.message` on any failed save (no frontend
change needed) -- so TM staff will now see real rejection reasons like "This vehicle is
already booked on this day." where before the save always silently succeeded regardless.

## Deploy
1. Open `map saveAssignment(...)` in the Trip Manager Creator app's function editor.
2. Replace its full contents with `saveAssignment_FIX.deluge` (the whole function, not a
   diff).
3. **Test 1 (Vehicle_Bookings sync now fires):** in Trip Manager, assign a vehicle to a
   funeral trip that doesn't have a package-locked "Availability_Based" vehicle conflict.
   Confirm the assignment saves normally, AND check CRM directly that a `Vehicle_Bookings`
   record was created/updated for it (same as it would be from a direct CRM edit).
4. **Test 2 (double-booking correctly blocked):** assign the same vehicle to two different
   funeral trips scheduled on the same day via Trip Manager. Confirm the second assignment
   is rejected with "This vehicle is already booked on this day." shown in the TM UI,
   instead of silently succeeding.
5. **Test 3 (package-locked vehicle correctly blocked):** on a Deal whose package includes
   a locked "Availability_Based" vehicle product, try assigning a *different* vehicle via
   Trip Manager. Confirm it's rejected with "This vehicle cannot be edited because it was
   generated from the Deal product selection process."
6. **Test 4 (no regression):** confirm the existing workflow-triggered behaviors on this
   same update -- "Change Status to Scheduled when Driver and Vehicle Assigned and Notify
   to Driver", "Populate Vehicle Select on Vehicle select", "Remove Vehicle Bookings" --
   still fire correctly (all reference `Vehicle` field_update, same as before; `trigger`
   still includes `"workflow"` in the new REST call).
