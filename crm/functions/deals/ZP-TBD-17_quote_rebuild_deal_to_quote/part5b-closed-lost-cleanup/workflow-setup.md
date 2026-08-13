# Closed-Lost cleanup -- Workflow Rule setup

## Confirmed before writing this

- **No existing Closed-Lost workflow rule on Deals** -- checked live
  2026-08-13 (searched workflow rules on Deals containing "Lost" -- zero
  results). This is a clean add, nothing to conflict with or replace.
- **Books org id 872327358** confirmed live = "Delapenha Funeral Home Ltd",
  status active, mode "live" -- matches Andrea's spec exactly.
- **Books connection `zohooauth`** confirmed to have `ZohoBooks.fullaccess.ALL`
  plus explicit `ZohoBooks.invoices.Delete` scope, and is already the
  connection used for every other Books/Writer/WorkDrive call in this
  feature. Both config values are already filled into
  `deleteFamilyBillingOnClosedLost.deluge` -- nothing left to fill in before
  pasting it in.
- **Spot-checked Products** (200 records, live 2026-08-13): every Hospital/
  Trip/Amber Vehicle category product sampled has `Delete_on_Closed_Lost =
  false`, as expected. This corroborates (does not replace) Andrea's Part 7
  "already done, verified live" -- full audit of all 22+7 categories wasn't
  redone here, just spot-checked.

## Steps

1. **Setup > Automation > Workflow Rules > New Rule.**
2. Module: **Deals**.
3. Rule trigger: **On a record action** -> **Edit** (per spec: "trigger on
   Edit"). A Closed Lost Deal always gets there via an Edit (someone changing
   Stage), so this is the correct trigger type -- not Create.
4. Criteria: **Stage = Closed Lost**. Confirm in the criteria builder which
   specific Stage picklist value(s) apply per pipeline -- this org's Stage
   field carries `Closed Lost` and a separate `Closed Lost to Competition`
   value (confirmed live 2026-08-13, both exist org-wide on the Stage
   field). Andrea's spec says "Closed Lost" specifically; if
   "Closed Lost to Competition" should ALSO trigger cleanup, that's a
   decision for Andrea, not something to assume -- ask before adding it to
   the criteria.
5. **Confirm which pipelines this fires for** while building the criteria --
   Andrea's spec explicitly calls out: fire for the applicable pipelines
   including **Pre Need**, and explicitly **NOT Wholesale** ("no closed
   stage"). This session's tooling couldn't pull per-pipeline stage-set
   configuration directly (no pipeline-detail endpoint was available) -- the
   Workflow Rule criteria builder in the Zoho UI will show you, live, which
   Stage values are actually selectable/relevant per pipeline as you build
   the rule. Verify Wholesale deals genuinely can't reach a Closed Lost
   stage before finalizing.
6. Instant Action: **Functions > Write your own**.
7. Paste `deleteFamilyBillingOnClosedLost.deluge` (config values already
   filled in -- paste as-is, no edits needed).
8. Argument mapping: `dealId` <- **Deals > Record Id**.
9. Save, activate.

## Before trusting this on a real Deal

Test on 2-3 non-production or already-fully-refunded/closed test Deals
first if at all possible -- this function permanently deletes Zoho Books
records. See `../test-cases.md` for the exact deletion-safety scenarios to
run (especially: police/hospital/storage protection, mixed-category
records, records with no Books ID, records already deleted).
