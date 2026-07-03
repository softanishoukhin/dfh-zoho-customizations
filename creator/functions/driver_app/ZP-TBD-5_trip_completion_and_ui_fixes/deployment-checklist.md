# Deployment Checklist

Backfilled retroactively — deployed directly to production, no sandbox, no PR (predates this repo).

## Pre-Deployment
- [x] Confirm Zoho Projects task ID — pending, ZP-TBD-5 placeholder
- [x] Backup existing production function — `rollback.deluge`
- [ ] Sandbox testing — not done
- [x] No secrets in code

## Production Deployment
- [x] Paste-instruction diff applied to the live completeJob function (Task 8 branch)
- [x] Widget app.js changes packaged and deployed (zip upload to the Driver App widget)
- [x] Confirmed function arguments unchanged (tripId, completionTime)
- [x] Smoke test — both Police and Hospital ZZTEST trips confirmed correct Deal stage
      advancement after completion
- [ ] Zoho Projects task updated — pending real task ID

## Rollback Plan
- Restore the Hospital-only condition and remove the Stage-advancement block from
  `rollback.deluge`
- Revert `driverApp/app/app.js` to the previous deployed zip if the UI changes need to be undone
- Notify team/client
