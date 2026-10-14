Task ID: ZP-TBD-101
Function: automation.createEventForFuneralDate (id 6503357000001702085, last changed by Dale 2026-07-28)
Found: 2026-10-06 while testing ZP-TBD-100 (Funeral Preparation app) on Deal 6503357000085067001
("DFH ZZTEST Burial Viewing")
Status: built 2026-10-06 from the live code, NOT applied.

## Problem
After ANY edit to a Deal that has a Funeral Date and Time, the Stage jumps back to
"Funeral Scheduled" (seen: Family Visit -> Funeral Scheduled on every save).

Chain:
1. Workflow "Create or Update Chapel Booking" (6503357000068694012) -- trigger create_or_edit,
   repeat on every edit, criteria Funeral Date and Time is not empty -> function
   `createorupdateChapelBooking`.
2. That function calls `createeventforfuneraldate` (REST execute) on every run when the Deal has
   an Account.
3. `createEventForFuneralDate` sets Stage = "Funeral Scheduled" unless the stage is Completed /
   Cremation Completed / Funeral Completed -- with no check that the funeral time changed.

Effect: every later stage (Embalming Complete, Family Visit, Pre-Visit Scheduled, Ready for Driver,
...) is overwritten by the next save of the Deal, by anyone or any automation. It also drops a
case off the Funeral Preparation Viewing List (which lists Stage = Family Visit) as soon as anyone
edits the Deal. Not caused by the ZP-TBD-99/100 work -- it happens on any Deal.

## Fix (stage logic only)
- The funeral trip lookup moved above the stage update and keeps the trip's current Scheduled Date.
- Stage -> "Funeral Scheduled" only when:
  - there is no funeral trip yet (the funeral is being scheduled for the first time), or
  - the funeral trip's time (funeral minus 2 hours) no longer matches -> the Funeral Date and Time
    really changed.
- Completed stages are still never touched. Everything else (calendar event, trip create/update,
  vehicle, pickup/destination) is unchanged and still runs on every save, as today.

Note: if someone moves the funeral trip's time by hand (Trip Manager), the next Deal save puts the
trip back to funeral minus 2 hours and sets Funeral Scheduled -- same as today.

## Deploy
Setup > Developer Hub > Functions > "Create Event for Funeral Date" (createeventforfuneraldate) >
replace the body with `createEventForFuneralDate_UPDATED.deluge` > Save. No workflow change.

## Test
1. Deal at Stage Family Visit with a funeral time and a funeral trip: edit any other field (e.g.
   Church/Chapel) and save -> Stage stays Family Visit; the funeral trip is unchanged.
2. Same Deal: change Funeral Date and Time -> Stage = Funeral Scheduled; the funeral trip moves to
   the new time minus 2 hours.
3. New Deal with an Account, first time a Funeral Date and Time is entered -> funeral trip created,
   Stage = Funeral Scheduled (as today).
4. Deal at Funeral Completed: change the funeral time -> Stage stays Funeral Completed.
