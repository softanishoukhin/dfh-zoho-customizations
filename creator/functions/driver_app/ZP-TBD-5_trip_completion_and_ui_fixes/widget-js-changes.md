# Companion client-side changes (not Deluge)

File: `driverApp/app/app.js`. Full diffs are in git history of the driverApp repo itself
(a separate git repo from this one, since it's the widget's own JS/HTML codebase, not Deluge).
This file summarizes what changed and why, for cross-reference.

## Context
The Police Case Pickup screen reuses the same shared multi-body check-in UI already built for
Hospital Storage (`renderHospitalCheckin` and its supporting `hosp*` functions). Real
end-to-end testing surfaced several places where this sharing leaked Hospital-only wording
and behavior onto Police trips.

## Changes made
1. **Screen header** — was hardcoded "Hospital Storage"; now shows "Police Case Pickup" or
   "Hospital Storage" based on `t.Trip_Type`.
2. **Trip Info box** — Police now shows a "Police Station" row (read-only, like Hospital's
   "Hospital" row) instead of the "Ward" field, which is Hospital-only.
3. **`Place_of_Removal` auto-set** — was force-stamping `"Hospital"` on *any* trip using this
   screen, including Police (factually wrong — Place_of_Removal has no "Police"/crime-scene
   option in its picklist). Now only auto-stamped for genuine Hospital Storage trips.
4. **On-scene guidance text** — said "At the hospital — capture each deceased's identity..."
   unconditionally; now says "on scene" for Police trips.
5. **Police Officer Name/Phone — added then reverted.** Initially added as trip-wide editable
   fields (propagated to every body on the trip), but reverted after review: Hospital's
   closest equivalent (Doctor Name/Phone) has no edit/display surface in the Driver App either
   — it's intake-only, silently passed through. Keeping Police symmetric with that meant
   removing the UI, not adding more of it. The underlying data fields
   (`Police_Officer_Name`, `Police_Phone_Number`, `Police_Station` on the body object) remain
   in the schema for read-only passthrough, consistent with how Doctor_Name/Doctor_Phone are
   handled, but nothing edits or displays them per-body anymore.
6. **A UI bug unrelated to Police/Hospital parity**: `$btn.html(...)` was replacing the entire
   `<label>` containing the hidden `<input type="file">` for burial-order-style
   "Add Burial Order" buttons elsewhere in the app — same underlying bug pattern was checked
   for and fixed in the burial-order upload flow earlier in the day (separate task, not
   included in this folder — see the driverApp repo's own history for that change, since it's
   unrelated to Police/Hospital).

## Not fixed — flagged, needs a decision
A legacy workflow rule ("On Create - Create Trips for Regular Trip", Deals module) creates a
stray duplicate Trip 5 minutes after any Police (and likely Hospital) child Deal is created —
see `crm/functions/trips/ZP-TBD-1_amber_integration_fix/metadata.md` for the full writeup.
Not a Driver App issue, but discovered during this same test pass.
