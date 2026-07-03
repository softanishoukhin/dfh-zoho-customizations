# Deployment Checklist

Backfilled retroactively — deployed directly to production, no sandbox, no PR (predates this repo).

## Pre-Deployment
- [x] Confirm Zoho Projects task ID — pending, ZP-TBD-4 placeholder
- [x] Backup existing production function — `rollback.deluge`
- [ ] Sandbox testing — not done
- [x] No secrets in code

## Production Deployment
- [x] Paste-instruction diff applied to the isPolice branch of the live function
- [x] Confirmed function arguments unchanged (pickupId, Int)
- [x] Smoke test — ZZTEST Police case confirmed Police_Account resolved correctly
- [ ] Zoho Projects task updated — pending real task ID
- [ ] Consider applying the same fix to the NOK Intake DS-block Deal creation path (the
      old single-Deal Police flow) for full consistency — not done, out of scope for
      today's multi-deceased-specific fix

## Rollback Plan
- Remove the `matchedPoliceAccounts` search block from `rollback.deluge`'s "before" state
  (i.e. delete the try/catch that sets `Police_Account`, leaving only the
  `Police_Office_Name` text write)
- Notify team/client
