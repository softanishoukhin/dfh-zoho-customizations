# Deployment Checklist

Backfilled retroactively — this task was deployed directly to production before this repo
existed, so the checklist below documents what *should* happen next time this task is
touched, not a record of exactly what happened this time (no sandbox was used, no PR existed).

## Pre-Deployment
- [x] Confirm Zoho Projects task ID — **pending, using ZP-TBD-1 placeholder**
- [ ] Pull latest repo branch
- [ ] Confirm PR is approved
- [x] Backup existing production function — captured in `rollback.deluge` (Round 1 versions,
      pulled live before Round 2 changes)
- [ ] Confirm sandbox/test environment testing is completed — **not done, tested in
      production with tagged test records instead**
- [x] Confirm no token/password/secret is stored in code — **masked in this repo; the live
      functions still have both keys hardcoded, see connection-notes**

## Sandbox/Test Deployment
- Not performed for this round. Recommend using CRM Sandbox for the next Amber-related change,
  per the guide's Sandbox/Test Environment Rule.

## Production Deployment
- [x] Backup existing production function (captured before editing)
- [x] Copy approved code from Git — n/a this round (code went live before repo existed)
- [x] Update production function
- [x] Confirm function arguments — unchanged (`crmid`, `Int`, both functions)
- [x] Confirm workflow/button/schedule mapping — "Send Amber Completion When No Deal Present"
      rule edited: condition removed, action changed to `createJobInAmber`
- [x] Run smoke test — 5 intake types tested live (see test-cases.md)
- [x] Confirm no error in logs — no unhandled exceptions observed in the 5 test runs
- [ ] Update Zoho Projects task — pending real task ID

## Rollback Plan
- Restore `rollback.deluge` (the Round 1 versions of both functions) if Round 2 causes issues
- Re-add the `Amber Connect Job ID is not empty` and `Deal is empty` conditions to "Send Amber
  Completion When No Deal Present" and switch its action back to the completion wrapper
  function if the rule edit needs to be undone
- Notify team/client
