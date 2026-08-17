Task ID: ZP-TBD-22 (placeholder)
Zoho App: CRM
Module: Deals -> Trips
Function Name: automation.propagateFuneralTimeToTrips (EXISTING -- this is a fix, not new)
Trigger Source: EXISTING Workflow Rule "Propagate Funeral Date to Funeral Trip" (id
6503357000065970014, Deals, edit, repeat, criteria Pipeline in [Cremation with Service,
Funeral with Burial]) -- no workflow change needed.
Created By: Claude Code, 2026-08-17, per user's live-tested report + explicit correction
Sandbox Tested: No
Production Deployed: No -- guideline only, not yet applied

## Reported by user (2026-08-17)
Live test deal: https://crm.zoho.com/crm/org871210233/tab/Potentials/6503357000078679362
"DFH Test DFwb2026081703" -- Deals.Funeral_Time set to Aug 20, 2026 4:00 PM. The
auto-created Funeral trip's Scheduled_Date correctly came out to 2:00 PM (2 hours before --
confirmed by the user as an intentional default feature, not a bug). But Trip Manager's
dispatch card showed a "Time Changed" pill on this trip immediately, despite nothing ever
having actually been rescheduled.

## Root cause -- confirmed via live workflow rule + function pull
`automation.propagateFuneralTimeToTrips` fires on every edit of a Funeral/Cremation Deal.
Its comparison logic was:
```
updMap.put("Scheduled_Date", funeralTime);   // funeralTime = raw Deals.Funeral_Time, no offset
if(currentScheduledDate != "" && currentScheduledDate != funeralTime) {
    updMap.put("Old_Scheduled_Date", currentScheduledDate);
    updMap.put("Funeral_Time_Change_Alert", true);
}
```
It compares the Trip's already-offset `Scheduled_Date` (2:00 PM) directly against the Deal's
raw `Funeral_Time` (4:00 PM) -- these are NEVER meant to be equal, by design (always a
2-hour gap). So this comparison is true on every single firing, regardless of whether
anything was actually rescheduled -- a guaranteed false positive, not an edge case.

**Second, more serious bug found in the same function:** the `Scheduled_Date` write above
runs unconditionally with the RAW `funeralTime` (no offset). Every time this function
fires for a given Deal, it silently overwrites the trip's Scheduled_Date with the
un-offset Funeral_Time -- i.e. it would erase the intentional 2-hour-before gap on the
very next edit of the Deal after the trip is created. (Live evidence on the test deal
suggests this specific firing hadn't happened yet for that record at the time it was
checked, but the code guarantees it eventually would.)

## Fix -- per user's explicit correction (2026-08-17)
User's own words: "if Old Funeral Date and Time has value and difference between Funeral
Date and Time then it should be called Time Changed." `Deals.Old_Funeral_Date_and_Time`
already exists as a field but was found empty/unused on every live deal checked --
**needs confirmation from Dale/Andrea what (if anything) currently populates it** when a
funeral is actually rescheduled.

`propagateFuneralTimeToTrips_FIX.deluge` (this folder) implements:
1. **Real-change signal** = `Deals.Old_Funeral_Date_and_Time` is non-empty AND differs from
   `Deals.Funeral_Time` -- exactly the rule the user specified.
2. **Fallback** (only used when `Old_Funeral_Date_and_Time` is empty, i.e. nothing is
   maintaining it yet): reconstructs "what Funeral_Time was last synced as" from the
   trip's own current `Scheduled_Date` + 2 hours, and compares that against the current
   `Funeral_Time`. This keeps the false-positive fixed even before the Deal-field
   maintenance question is answered.
3. `Scheduled_Date` is now always written as `Funeral_Time` **minus 2 hours** (never the
   raw value), so this function can no longer erase the intentional offset on a later
   edit.

## Open question for Andrea/Dale
What is supposed to populate `Deals.Old_Funeral_Date_and_Time` when a funeral is actually
rescheduled? If nothing currently does, the fallback above covers it, but it would be
cleaner to have something explicitly snapshot the prior `Funeral_Time` into that field at
the moment of a real reschedule (e.g. a small field-history/before-value capture), rather
than relying on reconstructing it from the trip's Scheduled_Date.

## Deploy
1. Open `automation.propagateFuneralTimeToTrips` in the CRM function editor.
2. Replace its full contents with `propagateFuneralTimeToTrips_FIX.deluge` (the whole
   file -- it's the complete function, not a diff).
3. No workflow change needed.
4. **Test 1 (false positive fixed):** create/edit a Funeral-pipeline Deal, set
   `Funeral_Time`, save, then edit any other field on the Deal (triggering this workflow
   again) without touching `Funeral_Time`. Confirm the Funeral trip's dispatch card does
   NOT show "Time Changed," and `Scheduled_Date` stays at Funeral_Time minus 2 hours.
5. **Test 2 (real reschedule still flags correctly):** change `Funeral_Time` to a
   genuinely different time (and, once the open question above is answered, whatever
   populates `Old_Funeral_Date_and_Time` with the prior value). Confirm the trip's
   `Scheduled_Date` updates to the new time minus 2 hours, `Old_Scheduled_Date` captures
   the prior value, and the "Time Changed" pill correctly appears this time.
6. **Test 3 (offset never erased):** repeat test 1 several times in a row (multiple
   unrelated edits to the same Deal). Confirm `Scheduled_Date` stays at Funeral_Time minus
   2 hours every time, never drifts to the raw Funeral_Time.
