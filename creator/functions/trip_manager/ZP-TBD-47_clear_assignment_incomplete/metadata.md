# ZP-TBD-47 — Clearing a trip assignment doesn't fully clear it

**Reported by Andrea (2026-08-31, `tasks08312026.txt`):** clearing Hearse and Driver on a
postponed funeral works, but Attendant and Departure Date & Time stay set to their old values
after save. Old values can then look like a deliberate request ("L. Crossbourne was specifically
requested") on the next reschedule, and the trip keeps appearing on its old date.

## Root cause

`saveAssignment` deliberately skips any blank incoming field (documented in its own comment —
protects a stale widget session from wiping a value it never loaded). Clearing a field is meant
to go through a separate, immediate call, `clearTripField`, fired the instant a dropdown goes
back to blank (`wireImmediateUnassign` in `app/widget.html`, tracked via a `data-prev` attribute
on each field).

That wiring existed for Hearse (`Vehicle`), Removal Vehicle (`Amber_Vehicle`), and Driver
(`Driver`) — but was never added for Attendant (`Attendant_NEW`), and never built at all for
Departure Time (a plain `datetime-local` input, not a dropdown, so it had no equivalent wiring to
begin with). `clearTripField`'s own server-side whitelist also only allowed those same three
fields. So clearing Attendant/Departure on screen and hitting "Save Assignment" hit
`saveAssignment`'s intentional blank-skip and left the old CRM values untouched.

This also directly explains "the trip remains on the list for tomorrow": `Scheduled_Date` is set
from `Departure_Time` by `saveAssignment` whenever a departure exists, and nothing ever cleared
it back.

## Fix

**1. `clearTripField` (Trip_Manager.ds — guideline, applied by the user 2026-08-31):**
```deluge
allowed = {"Vehicle","Amber_Vehicle","Driver","Attendant_NEW","Departure_Time"};
if(!allowed.contains(fieldName))
{
	result.put("message","Field not allowed: " + fieldName);
	return result;
}
updMap = Map();
updMap.put(fieldName,"");
if(fieldName == "Departure_Time")
{
	// Scheduled_Date is set from Departure_Time by saveAssignment whenever a departure is
	// provided -- clear it the same way, or the trip keeps showing up on its old date even
	// after the departure time is gone.
	updMap.put("Scheduled_Date","");
}
response = zoho.crm.updateRecord("Trips",tripId.toLong(),updMap,{"trigger":{"workflow"}});
```

**2. `app/widget.html` (edited directly):**
- Wired `wireImmediateUnassign(atF.querySelector("#sel-attendant"), "Attendant_NEW", "Attendant")`
  at Attendant field creation (was completely missing).
- Added the same wiring for the Departure Time input (`wireImmediateUnassign` works on any
  element exposing `.value`/`change`/`data-prev` — not select-specific — so the existing function
  was reused as-is for the `datetime-local` input, with `data-prev` seeded from its initial
  value).
- `populateDropdowns()`: added the missing `asel.setAttribute("data-prev", ...)` for Attendant
  (was set for Driver/Removal Vehicle already, never for Attendant).
- Updated the header comment above `wireImmediateUnassign` to reflect it now covers all four
  fields, not just Vehicle/Driver.

**Deliberately not changed:** `Trip_Status` is not automatically reverted away from "Scheduled"
when an assignment is cleared — flagged to the user as a related open question (does a
now-incomplete assignment need Trip_Status pulled back to "Requested"?), not decided here.

**Status:** `.ds` guideline applied live by the user. `widget.html` changes made directly,
pending republish and a live re-test of the exact reported scenario (clear Hearse, Driver,
Attendant, and Departure on a postponed funeral; save; confirm all four are actually blank on
reload and the trip no longer appears on the old date).
