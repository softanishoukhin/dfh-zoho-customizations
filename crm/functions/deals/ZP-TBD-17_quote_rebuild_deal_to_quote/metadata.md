Task ID: ZP-TBD-17 (placeholder)
Zoho App: CRM (+ Zoho Books, Zoho Writer)
Module: Deals (client scripts, SO-creation functions), Quotes (new button +
function, template), Sales_Orders / Invoices (new cleanup function)
Created By: Claude Code, 2026-08-13 (design + guideline)
Sandbox Tested: No
Production Deployed: No -- guideline only. Every artifact in this folder was
pulled from LIVE Zoho first (via MCP), read in full (not assumed from the
prior repo copy or from Andrea's spec description alone), then trimmed/built
against that live baseline. Nothing here is applied until pasted in by
someone with CRM admin access, per this repo's established practice.

## Why this task exists

This is a full rebuild that REVERSES most of ZP-TBD-9 (the original
Quote/SO-suppression feature, deployed 2026-08-07, race-condition-fixed
2026-08-10/11/12). Andrea's product decision, quoted from her comment:

> "I have made final decisions on how to handle this. It is very important
> for you to read everything attached to understand what was wrong with
> what you built. I can't have these costly mistakes continuing to happen."

Her attached spec (`DFH_Quote_Rebuild_Complete_Spec_2026-08-12.docx`) is a
formal post-mortem: the delivered feature (~20 hours) didn't meet the actual
requirement (a lightweight "generate a quote from the deal's products"
convenience), was intrusive (a popup on every deal), carried a real billing
race (SO/Invoice could fire before the quote hold engaged), was inconsistent
across the 4 Deal layouts (12 client-script pages), and entangled quote
logic with the billing-trigger stamp so it couldn't be safely disabled
wholesale.

## The corrected model (Andrea's Part 2)

Stop holding billing. Let the Sales Order and Invoice auto-create from the
Deal exactly as they do today, unconditionally -- no suppression, no popup,
no race. The Quote becomes a separate, optional customer document with a
manual "Pull Products from Deal" button, populated on demand, unrelated to
billing. The only real downside of "just let it create" -- a phantom
invoice on a deal that ends up lost -- is handled by a new Closed-Lost
cleanup function that deletes ONLY the family Sales Order/Invoice (never
police/hospital/storage charges).

## Full removal (Part 4) -- see part4-removal/

- **16 client scripts** across the 12 Deals pages (Standard PC/HP,
  Cremation_with_Service, Funeral_w_Burial, Ship_In_Layout x
  detail/create/edit) -- every one pulled live in full via its CDN hosting
  URL (not the MCP getClientScriptCode tool, which returned a literal
  `"{{prefix}}"` placeholder instead of real content for every script tried
  -- worked around by fetching each script's own `hosting.url` directly).
  Trimmed versions in `part4-removal/client-scripts/`, one per script,
  numbered to match the live script inventory below.
- **The suppression guard in all 4 Sales-Order-creation functions**
  (`createSalesOrderForDifferentPipelines`, `createSalesOrderFromDeals`,
  `createSalesOrderForHospitalCase`, `CreateSalesOrderforPoliceCase`) --
  byte-identical 8-line block in all four, confirmed live. See
  `part4-removal/so-function-guard-removal.md`.
- **4 functions removed entirely**: `hasQuotePromptBeenShown`,
  `markQuotePromptShown`, `syncQuoteLineItemsOnly`, `convertQuoteToSalesOrder`.
- **2 Deal buttons removed**: "Create/Update Quote", "Convert Quote to Sales
  Order". See `part4-removal/functions-and-buttons-to-delete.md`.

### Live client-script inventory (confirmed 2026-08-13, all still active except the 4 already-inactive onRowAdd scripts from the earlier race-condition fix)

| # | Layout | Page | Event | Live script id |
|---|--------|------|-------|-----------------|
| 01 | Standard (PC,HP) | detail | beforeRowUpdate | 6503357000049041308 |
| 02 | Standard (PC,HP) | detail | beforeRowDelete | 6503357000049041302 |
| 03 | Cremation_with_Service | create | onSave | 6503357000049041284 |
| 04 | Cremation_with_Service | edit | onSave | 6503357000049041290 |
| 05 | Cremation_with_Service | detail | beforeRowUpdate | 6503357000049041278 |
| 06 | Cremation_with_Service | detail | beforeRowDelete | 6503357000049041270 |
| 07 | Funeral_w_Burial | detail | beforeRowUpdate | 6503357000049124136 |
| 08 | Funeral_w_Burial | detail | beforeRowDelete | 6503357000049124130 |
| 09 | Funeral_w_Burial | create | onSave | 6503357000049041396 |
| 10 | Funeral_w_Burial | edit | onSave | 6503357000049041402 |
| 11 | Standard (PC,HP) | edit | onSave | 6503357000049041322 |
| 12 | Standard (PC,HP) | create | onSave | 6503357000049041314 |
| 13 | Ship_In_Layout | detail | beforeRowUpdate | 6503357000049041354 |
| 14 | Ship_In_Layout | detail | beforeRowDelete | 6503357000049041348 |
| 15 | Ship_In_Layout | create | onSave | 6503357000049041362 |
| 16 | Ship_In_Layout | edit | onSave | 6503357000049041380 |

### Finding: the billing-trigger stamp sits in a different place in every script family

Read all 16 in full (not diffed against an assumed template) specifically
because Andrea's spec warns this code "behaves differently by case-type
layout." Confirmed true, and specifically about the one thing that matters
most here -- where the `getcurrentdatetime`/`Trigger_Based_On_Subform`
billing stamp lives relative to the quote logic being removed:

- `beforeRowUpdate` / `beforeRowDelete` (8 scripts, all layouts): stamp is
  the final, unconditional line of the file.
- `onSave` on **create** pages (3 of 4 layouts -- Cremation/Funeral/
  Standard): stamp is also the final, unconditional line, after the whole
  quote `if` block.
- `onSave` on **edit** pages (3 of 4 layouts -- Cremation/Funeral/Standard):
  stamp is nested INSIDE the earlier, unrelated casket-color-validation
  block, which runs BEFORE the quote logic in the file. Removing the quote
  block (everything after) never touches it.
- **Ship-In layout is the outlier in both directions.** Its Edit-page onSave
  (#16) has no casket-color block at all -- structured like a create page,
  stamp trailing at the end. Its **Create-page onSave (#15) has no billing
  stamp anywhere in the file, at all** -- confirmed by reading it twice.

### Ship-In Create-page billing-stamp gap -- decision made 2026-08-13

Flagged to the user before touching this script, since Andrea's spec assumes
a stamp exists to "keep" and here there isn't one. **Decision: trim only,
leave the gap as-is** (documented explicitly inside
`part4-removal/client-scripts/15_ShipIn_create_onSave_TRIMMED.js` itself, so
it can't be missed during paste-in). This is a pre-existing production gap,
not introduced by this change and not fixed by it -- a Ship-In Deal created
via the full Create form with products already filled in does not get
`Trigger_Based_On_Subform` stamped from that page, before or after this
change. If DFH wants this closed, it's a one-line addition once explicitly
approved (the exact line is given in that file's own comment).

## What's built (Part 5) -- see part5a/ part5b/ part5c/

- **5a -- "Pull Products from Deal" button**: new
  `button.pullProductsFromDeal(String quoteId)` (built live directly from
  inside the button's action setup, which is why it's `button.` category
  rather than `standalone.` -- confirmed 2026-08-13), trimmed from the old
  12-argument `createOrUpdateQuoteFromDeal` down to "read deal -> write
  quote" exactly as specified -- no suppression flag, no PDF generation, no
  email, no silent error swallowing. See `part5a-pull-button/`.
- **5b -- Closed-Lost cleanup**: Andrea's function, copied verbatim, with
  the two flagged config values filled in and confirmed live
  (`booksOrgId = "872327358"` = Delapenha Funeral Home Ltd, confirmed active;
  `booksConn = "zohooauth"`, confirmed to have Books full-access + explicit
  invoice-delete scope, already used everywhere else in this feature). No
  existing Closed-Lost workflow rule found on Deals -- clean add. See
  `part5b-closed-lost-cleanup/`.
- **5c -- Quote template grouping**: field + data plumbing DONE and applied
  live 2026-08-13 (`Quoted_Items.Parent_Product` field created, mirroring
  Sales_Orders/Invoices' existing field exactly; `pullProductsFromDeal`
  writes it per row; `generateQuotePdf` passes it to the merge; confirmed
  via Get_All_Fields against the live template). **Actual grouping NOT
  done** -- confirmed directly by the user that Parent Product was added as
  a plain column to the existing flat table, not sections. Zoho Writer has
  a native "Group By" merge-field feature built for exactly this (confirmed
  via Zoho's own documentation) -- see
  `part5c-quote-template/template-update-guide.md` for the how-to and
  sources. Separately, "same child-product filtering as the deal subtable"
  is still an open, secondary question.

## Live sync note (2026-08-13, after Phase 5 deployment)

The user deployed through Phase 5 and reported two differences between what
they applied live and what this repo had, both now synced into the repo
files above:

1. **`deleteFamilyBillingOnClosedLost`'s delete call** changed from
   `zoho.crm.deleteRecord(cfg.get("module"),recId.toLong());` to
   `zoho.crm.invokeConnector("crm.delete",{"module":cfg.get("module"),"id":recId});`.
   Reported via the user pasting the current live block directly, not
   pulled fresh via MCP -- the workflow rule wrapping this function wasn't
   found when searching all ~101 Deals workflow rules by name (checked both
   pages, no rule name containing "Lost"/"Closed"/"Billing"/"Delete"/"Family"
   matched), so no function ID was available to pull it back and confirm
   the WHOLE function matches, only the delta the user showed. If anything
   about this function looks off after more testing, the safest next step
   is pulling it by ID directly (visible in the URL when editing it in
   Zoho) rather than assuming the rest of this file still matches live
   exactly.
2. **`pullProductsFromDeal`'s function category** is `button.` not
   `standalone.` -- expected, given it was built from inside the button's
   own "write your own function" flow rather than as a separately-authored
   standalone function. Repo file and setup doc both updated to match.

## What's reused, unchanged (Part 6)

- The 4 SO-creation functions' actual business logic (everything below the
  removed guard) -- untouched.
- `standalone.generateQuotePdf` -- untouched by Parts 4/5a/5b. Would need a
  small edit if/when Part 5c is approved and built.
- `Quotes.Deal_Name` -- confirmed live as a native lookup to Deals already
  in use; no new field needed for the Pull button.
- The `zohooauth` CRM->Books connection -- confirmed to already allow
  deleting invoices (explicit scope) and, via fullaccess, sales orders.

## Also verified live, not otherwise covered above

- Deals.Stage picklist confirmed to include both `Closed Lost` and
  `Closed Lost to Competition` as distinct values org-wide -- the workflow
  rule criteria should target `Closed Lost` per the spec; whether
  `Closed Lost to Competition` should also trigger cleanup is a separate
  question for Andrea, not assumed either way (see
  `part5b-closed-lost-cleanup/workflow-setup.md`).
- Spot-checked 200 Products live: every Hospital/Trip/Amber Vehicle category
  product sampled has `Delete_on_Closed_Lost = false`, consistent with
  Andrea's Part 7 "already done, verified live." Not a full audit of all
  22+7 categories -- corroboration, not a re-verification of her work.

## Related files in this folder

`part4-removal/` (16 trimmed client scripts + 2 removal-instruction docs),
`part5a-pull-button/` (function + setup doc), `part5b-closed-lost-cleanup/`
(function + setup doc), `part5c-quote-template/` (investigation doc, needs
decision), `deployment-checklist.md`, `test-cases.md`, `rollback.md`.

See `../ZP-TBD-9_quote_creation_and_so_suppression/` for the original
feature this supersedes -- left in place in the repo for history, marked
superseded in its own metadata.md, not deleted.
