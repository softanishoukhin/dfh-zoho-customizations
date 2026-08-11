# Deployment Checklist

Backfilled retroactively — deployed directly to production, no sandbox, no PR (this repo's
"always commit guideline work" rule was reinforced after the fact; the work itself predates
this specific backfill).

## Pre-Deployment
- [x] Confirm Zoho Projects task ID — pending, ZP-TBD-9 placeholder
- [x] Backup existing production function bodies (the 4 modified SO functions) — `rollback.deluge`
- [ ] Sandbox testing — not done, DFH's established practice is direct-to-production with live test data
- [x] No secrets in code (zohooauth/zohoworkdrive are named Connections, no inline tokens)

## Production Deployment
- [x] 5 new functions created and deployed (isQuoteAwaitingAcceptance, setQuoteAwaitingAcceptance,
      generateQuotePdf, createOrUpdateQuoteFromDeal, convertQuoteToSalesOrder)
- [x] 3-line guard added to the start of all 4 existing SO-creation functions
- [x] New field Quotes.Quote_Public_URL created
- [x] Quote Writer Mail Merge Template built and wired in (document_id 0votx2af8768ad5a3464fabc49a89d3f4abb1)
- [x] 2 new Deal buttons created and linked to their functions
- [x] New "Open Quotes" custom view created on Quotes, added to FD Home Page dashboard
- [x] Full test pass completed 2026-08-07 — all 21 test cases passed (see test-cases.md)
- [x] Release Notes + Completion Report delivered to Andrea
- [ ] Zoho Projects task updated — pending real task ID

## Rollback Plan
- Remove the 3-line `if(standalone.isQuoteAwaitingAcceptance(crmid) == "true") { return; }`
  guard from the start of each of the 4 SO-creation functions — see `rollback.deluge` for the
  pre-guard state of each.
- Deactivate or delete the 2 new Deal buttons.
- Delete (or leave inert — they don't affect anything if unused) the 5 new functions.
- Remove the "Open Quotes" component from the FD Home Page dashboard.
- Existing Quote records, System_Data rows, and the Quote_Public_URL field can be left in
  place — none of them affect any other part of the system if the feature is fully rolled
  back; they're just inert data.
- Notify team/client.
