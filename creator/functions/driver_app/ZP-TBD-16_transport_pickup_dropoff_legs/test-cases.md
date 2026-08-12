# Test Cases -- Driver App side

Status: Not yet executed -- backend guideline delivered 2026-08-12, not yet applied live.

## TC-1 -- Items split correctly by leg
Trip with one item assigned to Pickup leg, another to Dropoff leg (via TM). Open the trip in
DA. Expect: Pickup item shows in the pickup section, Dropoff item shows in the dropoff section.

## TC-2 -- Checking an item persists immediately
Check an item's box. Expect: setTransportItemStatus fires, Transport_Status becomes
"Completed", Completed_Date_and_Time stamps to now.

## TC-3 -- Persistence survives navigating away and back (the core fix)
Check an item, navigate to a completely different trip, then come back to the original trip.
Expect: the item is STILL shown checked -- this is the specific behavior that was previously
unreliable (only one aggregate flag existed, not per-item).

## TC-4 -- Persistence survives app reload
Check an item, close and reopen the app (not just navigate within it), open the same trip.
Expect: still checked (confirms it's reading from the CRM record, not any client-side cache).

## TC-5 -- Unchecking reverts correctly
Uncheck a previously-checked item. Expect: Transport_Status reverts to "Scheduled",
Completed_Date_and_Time clears.

## TC-6 -- Works on a non-autopsy trip type
Confirm transport items now show and check off correctly on an ordinary trip type, not just
Multi Deceased Autopsy Trip.

## TC-7 -- Regression: Multi Deceased Autopsy Trip flow still works
Re-run the old autopsy pre-start flow end to end -- the old aggregate "Transport items loaded"
checkbox is being REPLACED by per-item ones (see widget-js-changes.md); confirm the "Start
Trip" gate-check logic was updated to require all individual items checked, not the old single
flag, and that it actually works as the new gate.

## TC-8 -- Attempting to complete an unassigned item fails cleanly
Call setTransportItemStatus against a transportId whose Related_Trip is empty (shouldn't happen
through normal UI, but confirms the backend guard). Expect: status="error", clear message, no
write.

## TC-9 -- No cross-trip leakage
Two different trips each with their own transport items. Checking an item on Trip A must never
affect anything shown on Trip B's list.
