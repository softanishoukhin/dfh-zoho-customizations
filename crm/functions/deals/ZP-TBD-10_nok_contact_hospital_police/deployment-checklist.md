# Deployment Checklist

Backfilled retroactively — deployed directly to production, no sandbox, no PR.

## Pre-Deployment
- [x] Confirm Zoho Projects task ID — pending, ZP-TBD-10 placeholder
- [x] Backup existing production function — `rollback.deluge`
- [ ] Sandbox testing — not done
- [x] No secrets in code

## Production Deployment
- [x] FIX #1 applied and confirmed live (2026-08-06)
- [x] FIX #2 applied (2026-08-07)
- [ ] FIX #2 independently retested end-to-end — status not confirmed in this backfill
- [ ] Duplicate Contact cleanup on test Deal 6503357000077020001 — pending, manual step
- [ ] Zoho Projects task updated — pending real task ID

## Rollback Plan
- See `rollback.deluge` for the pre-FIX-#1 state (no NOK Contact creation logic at all) and
  notes on reverting just FIX #2 (remove the NOK_Contact write-back block) while keeping FIX #1.
- Notify team/client.
