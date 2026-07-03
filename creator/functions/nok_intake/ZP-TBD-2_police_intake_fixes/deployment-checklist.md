# Deployment Checklist

Backfilled retroactively — deployed directly to production, no sandbox, no PR (predates this repo).

## Pre-Deployment
- [x] Confirm Zoho Projects task ID — pending, using ZP-TBD-2 placeholder
- [x] Backup existing production script — captured in `rollback.deluge`
- [ ] Sandbox/test environment testing — not done
- [x] No secrets in code

## Production Deployment
- [x] Paste-instruction diffs applied directly into the live NOK_Information_Form.ds
      "Managing Mandatory Fields" on-validate block and the Police-new-submission actions block
- [x] Widget app.js `validate()` function updated and redeployed
- [x] Smoke test — 5-intake-type Amber test pass exercised the Police path end-to-end
- [ ] Zoho Projects task updated — pending real task ID

## Rollback Plan
- Restore both DS block excerpts and the widget JS check from `rollback.deluge` /
  `widget-js-changes.md`'s "BEFORE" versions
- Notify team/client
