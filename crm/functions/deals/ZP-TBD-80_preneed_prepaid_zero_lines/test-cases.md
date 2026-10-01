# ZP-TBD-80 -- test cases

Full set (with pre-conditions and step-by-step instructions):
`D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-80_PreNeed_Prepaid_Zero_Test_Cases.xlsx` (CSV copy alongside).
Setup for all: a Pre-Need Deal with 2+ products (one Zero Rated, e.g. a casket), linked to a First Call Deal via
Link Pre-Need (Pre_Need_Status = Matched). **TC-01..03 gate everything else.**

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| TC-01 | Fields/API names | Open a Deal, edit Product Selection | `Pre-Need Line` and `Pre-Need Amount` visible; API names match the code |
| TC-02 | Fully paid, nothing added | Plan fully paid; click Get Pre Need Info; wait 5 min | Products on the Deal, Pre-Need Line = Prepaid, line total $0, Pre-Need Amount = contract line value. **No Sales Order, no Invoice.** Popup says fully paid |
| TC-03 | Liability journal | (after TC-02, revenue code configured) | Xero Manual Journal: Dr 26100 / Cr revenue = amount paid; System_Data row `Pre_Need_Liability_Released`; popup/Note show the journal id |
| TC-04 | Family adds a product | After TC-02 add a new $30,000 product in Product Selection | SO + Invoice created: prepaid lines $0 (tax 0), new line $30,000 + its tax; invoice total = $30,000 + tax |
| TC-05 | Zero Rated companion | TC-04 SO includes a Zero Rated prepaid item | Its "Non Taxable - X" companion row is Pre-Need Line = Prepaid and $0 on the SO/Invoice |
| TC-06 | Catalogue price change | Change a prepaid product's catalogue price, then touch Product Selection | Prepaid line still $0 on the rebuilt SO |
| TC-07 | Partly paid | Plan 347,500, paid 200,000; click Get Pre Need Info | One "Pre-Need Balance" row, Pre-Need Amount 147,500; ~2 min later SO/Invoice with that line at 147,500, no tax; prepaid lines $0 |
| TC-08 | Reminders stop | After TC-07, run a reminder wrapper for an unpaid installment invoice of that Pre-Need (or wait for its date) | Returns "pre-need converted to at-need", no email |
| TC-09 | Re-click | Click Get Pre Need Info again on TC-07's Deal | No duplicate products, no second Balance row, no second journal ("already done"), no new Notes |
| TC-10 | Revenue code not set | Clear `revenueAccountCode`, run on a new pair | Everything else works; popup warns "Liability release NOT done ... not configured"; no System_Data release row. Set the code, click again -> journal posted |
| TC-11 | Books retainer | After first run | Books retainer has the "USED FOR AT-NEED DEAL ... do NOT apply" comment; no Xero re-sync was triggered by it |
| TC-12 | Balance product not configured | `balanceProductId` = "" on a partly paid plan | No Balance row; warning tells staff to add the balance by hand; no SO |
| TC-13 | Overpaid | Paid > contract value | No Balance row; warning about refund/credit |
| TC-14 | USD Pre-Need | Retainer in USD | Journal amount = paid x retainer exchange rate (JMD) |
| TC-15 | Normal funeral unaffected | A Deal with no Pre-Need lines: add products | SO/Invoice exactly as before (billableRows path) |
| TC-16 | Xero token | After TC-03 | CRM org variable `xeroRefreshToken` updated; the next Books Xero sync still works |
