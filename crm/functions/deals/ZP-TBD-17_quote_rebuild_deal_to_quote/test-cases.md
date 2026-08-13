# Test cases -- ZP-TBD-17 Quote Rebuild

Full matrix also delivered as
`D:\Office\Andrea_Projects\DFH\widgets\testCases\Quote_Rebuild_TestCases_2026-08-13.xlsx`.
This file is the same content in repo-readable form.

## Section A -- Core SO/Invoice regression (re-test per Andrea's explicit ask)

The whole point of this rebuild is that billing goes back to running
exactly as it did before ZP-TBD-9 ever existed. Every one of these must
pass with NO quote-related side effect (no popup, no suppression, no delay)
-- confirming the underlying pipeline itself is genuinely undisturbed.

| # | Pipeline | Scenario | Expected |
|---|----------|----------|----------|
| A1 | Standard (Pre Need etc.) | Add products to a new Deal (detail page) | SO + Invoice auto-create ~1 min later, no popup |
| A2 | Standard | Add products via full Create form | Same, from onSave |
| A3 | Standard | Edit an existing Deal's products via full Edit form | Same, from onSave |
| A4 | Cremation with Service | Same 3 sub-cases (detail/create/edit) | Same |
| A5 | Funeral with Burial | Same 3 sub-cases | Same |
| A6 | Ship Ins | Same 3 sub-cases -- **note Create-page (A6c) will NOT stamp the billing trigger from that page**, per the documented pre-existing gap. Confirm this is the ONLY exception; detail and edit pages for Ship-In still stamp correctly. |
| A7 | Police Cases | Trip completed -> Sales Order + Invoice created via `CreateSalesOrderforPoliceCase` | Unchanged from pre-ZP-TBD-9 behavior |
| A8 | Hospital Cases | Trip completed -> Sales Order + Invoice created via `createSalesOrderForHospitalCase` | Unchanged |
| A9 | Delete a product row | Detail page, any layout | Trigger stamps, no quote-sync error (there's nothing to sync anymore) |
| A10 | Regression sanity | Compare a fresh Deal's SO/Invoice line items, taxes, and totals against a Deal built the same way before ZP-TBD-9 ever shipped (or against documented expected values) | Identical -- confirms Parts 4's removal didn't perturb any pricing/tax/product logic in the 4 SO functions, only removed the guard prefix |

## Section B -- Pull Products from Deal button (Part 5a)

| # | Scenario | Expected |
|---|----------|----------|
| B1 | Click on a Quote whose Deal has products | Quote's line items populate matching the Deal's Product Selection exactly (product, qty, price, discount) |
| B2 | Edit the Deal's products, click again | Quote's line items REPLACE with the new set -- no duplicates, no stale rows left over |
| B3 | Click on a Quote with no Deal_Name set | Clear message: "This Quote has no linked Deal to pull products from..." -- no crash |
| B4 | Click on a Quote whose Deal has an empty Product Selection | Clear message: "No products on the Deal's product table..." -- Quote's existing line items (if any) untouched |
| B5 | Click on a Quote whose Deal has a row with no product selected (partial row) | That row is silently skipped, valid rows still pull, message notes how many were skipped |
| B6 | Build a Quote manually (no Deal link at all), never click the button | Works exactly like any native Quote -- confirms the manual-quote path in Part 3 needs nothing from this feature |

## Section C -- Closed-Lost cleanup (Part 5b) -- deletion safety

**Run on non-production or already-fully-settled test Deals first.** This
function permanently deletes Zoho Books records -- these are the cases that
matter most.

| # | Scenario | Expected |
|---|----------|----------|
| C1 | Deal goes Closed Lost, family SO/Invoice has ONLY family-category line items, all flagged `Delete_on_Closed_Lost = true` | SO + Invoice deleted from both Books and CRM |
| C2 | Same, but one line item's product carries a protected `Product_Category` (Storage, Hospital, Pickup, PME Fee, PME Transport Fee, Decompose, Decompose Storage, Autopsy Trip, Amber Vehicle, Trip, Storage - Family) | **Entire record KEPT**, even though every other line is deletable -- confirms Guard (B) overrides Guard (A) |
| C3 | Same, but one line's Parent_Product is NOT flagged `Delete_on_Closed_Lost` (or the field is empty/missing) | **Entire record KEPT** |
| C4 | Deal has a police/hospital charge SO/Invoice AND a separate family SO/Invoice, goes Closed Lost | Family record deleted, police/hospital record explicitly KEPT -- this is the specific case Andrea called out by name: "does not delete any hospital or police storage invoices/SO ... or family ones for storage fees" |
| C5 | Deal has a family Invoice for storage fees specifically (Product_Category = "Storage - Family") | **KEPT** -- explicitly listed as protected, confirms storage fees are protected regardless of which side (family or institutional) they're billed to |
| C6 | SO/Invoice record has NO line items at all | KEPT -- explicit `lines.size() == 0` guard |
| C7 | Deal has no SO or Invoice at all, goes Closed Lost | Function does nothing, no error (idempotent, confirms `searchRecords` catch-and-continue works when nothing's found) |
| C8 | SO/Invoice's Books ID field is blank (never synced to Books for some reason) | `booksId == ""` skips the Books DELETE call, `booksOk` stays true, CRM record still deletes -- confirms this doesn't get stuck on a record that was never in Books |
| C9 | Books DELETE call fails (simulate: already-deleted Books record, or a genuinely non-draft/locked invoice) | CRM record is KEPT (not deleted) so it can be retried -- confirms the Books-first, keep-CRM-on-failure ordering actually holds |
| C10 | Re-run the workflow/function a second time on a Deal already cleaned up | No-op, no error -- confirms idempotency |
| C11 | Workflow rule criteria: confirm it fires for Pre Need pipeline reaching Closed Lost | Function runs |
| C12 | Workflow rule criteria: confirm it does NOT fire for Wholesale (per spec, "no closed stage") | Function never runs for Wholesale deals -- verify Wholesale genuinely has no path to a Closed Lost-equivalent stage in this org |
| C13 | A Deal reaches "Closed Lost to Competition" (the other Closed-Lost-family stage value confirmed to exist org-wide) | **Flag to Andrea before assuming either way** -- confirm whether this should also trigger cleanup or deliberately not |

## Section D -- Client-script regression (confirm the popup and race are really gone)

| # | Scenario | Expected |
|---|----------|----------|
| D1 | Add the first product to a brand-new Deal, any layout | No popup appears, ever |
| D2 | Add a 2nd, 3rd product | No popup, no quote-sync call of any kind (nothing left to sync) |
| D3 | Delete a product down to zero | No error (the old forceEmpty/quote-clearing logic is gone, and there's no quote to clear from this path anymore) |
| D4 | Full-page Save (Create or Edit) with products already filled in | No popup, billing trigger stamps correctly (except the documented Ship-In Create exception) |
| D5 | Browser console, any of the above | No JS errors referencing `hasQuotePromptBeenShown`, `isQuoteAwaitingAcceptance`, `createOrUpdateQuoteFromDeal`, or `markQuotePromptShown` -- confirms no stale reference to a deleted function survived in any of the 16 trimmed scripts |
