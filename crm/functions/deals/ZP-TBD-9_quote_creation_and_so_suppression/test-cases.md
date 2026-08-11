# Test Cases

Full test matrix (21 cases across 8 areas) delivered as
`D:\Office\Andrea_Projects\DFH\widgets\testCases\Quote_Sending_SO_Suppression_TestCases_2026-08-07.xlsx`.
All cases passed as of 2026-08-07. Summary below; see the xlsx for full detail.

## Test Case 1 — Create/Update Quote from an existing product table
Expected: Quote created, Quoted_Items matches Deal's Product_Selection.
Status: Passed (after fixing the Product_Details/lowercase write-key issue, see metadata.md #2).

## Test Case 2 — Re-running the button updates the same Quote, no duplicate
Status: Passed.

## Test Case 3 — Quote PDF scalar fields correct
Subject, Contact Name, Deal Name, Date, Sub Total, Grand Total.
Status: Passed.

## Test Case 4 — Quote PDF line-items table populates
Highest-priority case — first time this org has merged a subform through
zoho.writer.mergeAndStore.
Status: Failed twice, then Passed — see metadata.md bug #3 (dotted merge keys +
getRecordById dropping subform data, both needed fixing together).

## Test Case 5 — Currency values display with 2 decimal places
Status: Failed once (showed 4+ decimals), then Passed after .round(2) fix (metadata.md #4).

## Test Case 6 — Public WorkDrive link accessible with no Zoho login
Status: Passed — confirmed in an incognito browser window.

## Test Case 7 — Native email sends to the Deal's Contact_Name
Status: Passed.

## Test Case 8 — No products on the Deal
Expected: no Quote created, clear message.
Status: Passed on retest (see metadata.md — this surfaced the return-type/message issues,
not a logic bug in the empty-check itself).

## Test Case 9 — Button popup shows a readable message on success
Status: Failed once (raw JSON returned), then Passed after metadata.md bug #5 fix.

## Test Case 10 — SO/Invoice suppression while a Quote is pending
Editing Product_Selection after Create/Update Quote must NOT create a Sales Order.
Status: Passed, confirmed across all 4 Pipeline branches (createSalesOrderForDifferentPipelines,
createSalesOrderFromDeals, createSalesOrderForHospitalCase, CreateSalesOrderforPoliceCase).

## Test Case 11 — Convert Quote to Sales Order releases the hold and creates the SO
Status: Passed — confirmed the resulting Sales Order is identical to what the same Deal would
get without ever using the quote flow (same pipeline, same fee logic).

## Test Case 12 — Quote_Stage flips to Closed Won on conversion, drops off Open Quotes widget
Status: Passed.

## Test Case 13 — Regression: Deals that never use the quote flow are unaffected
Status: Passed — confirms the suppression guard (defaults to "not suppressed" when no
System_Data row exists) has zero impact outside this feature.

## Overall Status: All cases passed, 2026-08-07.

---

# Race-Condition Fix Test Cases (2026-08-10)

Full 40-case matrix delivered as
`D:\Office\Andrea_Projects\DFH\widgets\testCases\Quote_RaceCondition_Fix_TestCases_2026-08-10.xlsx`
(also `.csv`). Covers the beforeRowUpdate redesign described in metadata.md's "Race-condition
fix", both corrections under it, the Create/Edit-page onSave extension, the beforeRowDelete
extension, the Quantity/Discount edit-propagation fix, the new-row-append fix, and the
architecture simplification (server-side sync in the 4 SO-creation automation functions).

**All 40 cases passed, confirmed 2026-08-11.** Summary of areas covered:

- TC-01 to TC-04 — confirm dialog fires correctly (on row save, not "Add Row" click) on all
  4 Deals layouts (Standard PC/HP, Cremation_with_Service, Funeral_w_Burial, Ship_In_Layout).
- TC-05 to TC-07 — "Yes, Create Quote" path: no 400 error, System_Data flags set correctly,
  Quote record/product/quantity/price/discount all correct.
- TC-08 — the actual point of this fix: SO/Invoice does NOT fire after Yes, across all 4
  Pipeline branches. Critical priority.
- TC-09 to TC-10 — "No, Create Invoice and Sales Order" path: no Quote created, normal
  SO/Invoice pipeline fires unsuppressed after the buffer.
- TC-11 — the bug the user caught before deployment: editing the same first row again must
  NOT re-show the dialog (this is what index==0 got wrong; Quote_Prompt_Shown fixes it).
  Critical priority.
- TC-12 to TC-13 — Quote stays in sync as more products are added (Yes-Deals only; No-Deals
  never get a Quote at all).
- TC-14 — Standard PC/HP's PrimaryAndSecondaryMandatory guard still runs before the new logic.
- TC-15 — onRowAdd correctly reverted to just the trigger-time stamp, no dialog on "Add Row"
  alone.
- TC-16 to TC-17 — regression: Convert Quote to Sales Order still works; Deals that never touch
  Product_Selection are completely unaffected.
- TC-18 — old "Create/Update Quote" button deactivated post-cutover.
- TC-19 — verifies the specific fix for the 400 Bad Request (flat scalar args, not a JSON blob).
- TC-20 — dialog wording/button labels match the final agreed text.
- TC-21 — Critical prerequisite: confirms $Page.record_id actually resolves during
  module_create's onSave before trusting any of TC-22 to TC-24. If this fails, the Create-page
  design needs rework (see metadata.md's "Extension" note) before proceeding.
- TC-22 to TC-24 — same dialog/Yes/No/suppression coverage as TC-01/05/08/09/10, but via the
  Create page's page-level onSave instead of the detail page's per-row beforeRowUpdate.
- TC-25 to TC-26 — Edit page coverage, including the specific case of an old Deal that already
  had products before this feature existed (Quote_Prompt_Shown never set) — confirms it still
  only gets asked once, on whatever save first touches it.
- TC-27 — the known multi-row-on-first-save limitation (only subform_data[0] captured
  initially; rows 2+ appear on the Quote after the next Product_Selection touch).
- TC-28 to TC-29 — cross-entry-point flag sharing: a Deal prompted via Create is not
  re-prompted later via Detail, and vice versa via Edit — confirms Quote_Prompt_Shown is one
  shared flag across all three entry points, not per-page state.
- TC-30 — regression: Create/Edit saves with an empty Product_Selection never call any of the
  new functions at all.
- TC-31 — Critical prerequisite for the beforeRowDelete extension: confirms
  ZDK.Page.getField('Product_Selection').getValue() actually works on the module_detail page
  (proven on create/edit via onSave, not yet confirmed here). Do this before TC-32/33.
- TC-32 — Critical: deleting the last remaining product on a Yes-Deal clears the Quote's
  Product_Details via the forceEmpty path, instead of leaving it stale forever.
- TC-33 — Critical, was a limitation, now fixed: deleting one of several products now reflects
  immediately on the Quote (deletedRowIndex tells the function exactly which entry to exclude),
  no longer waits on a later unrelated touch to self-correct.
- TC-34 — regression: deleting a product on a Deal that never opted into the Quote flow touches
  nothing.
- TC-35 to TC-36 — Critical/High: the actual bug reported and fixed — editing Quantity or
  Discount on an existing row now correctly propagates to the Quote via the editedRowIndex
  patch, instead of silently keeping the stale pre-edit value.
- TC-37 — swapping which product is selected on an existing row also propagates correctly.
- TC-38 — editing one row's values doesn't corrupt the other rows already on the Quote.
- TC-39 — regression: editing a row on a Deal not in the Quote flow touches nothing.
- TC-40 — Critical: the reported bug — adding a 2nd/3rd product to a Deal already in the Quote
  flow now correctly reaches the Quote alongside the earlier product(s), instead of being
  silently dropped (out-of-bounds editedRowIndex now appends instead of no-op'ing).
