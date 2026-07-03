# Deployment Checklist

Backfilled retroactively — deployed directly to production, no sandbox, no PR (predates this repo).

## Pre-Deployment
- [x] Confirm Zoho Projects task ID — pending, ZP-TBD-3 placeholder
- [x] Backup existing production function — `rollback.deluge` holds the pre-fix trip-lookup section
- [ ] Sandbox testing — not done
- [x] No secrets in code (masked in this repo; live function still has the Sleep_API public key inline)

## Production Deployment
- [x] Paste-instruction diff applied directly to both live functions
- [x] Confirmed function arguments unchanged (crmid, Int)
- [x] Confirmed workflow mapping unchanged (Action based on Different Stage Update)
- [x] Smoke test — both Police and Hospital ZZTEST cases produced correct Sales Orders/Invoices
- [ ] Zoho Projects task updated — pending real task ID

## Rollback Plan
- Restore the original `tripList` lookup section from `rollback.deluge` in both functions
- Notify team/client
