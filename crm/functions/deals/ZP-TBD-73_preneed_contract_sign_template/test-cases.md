# ZP-TBD-73 test cases

Use one real pre-need test Deal with a linked Contact (with Mailing Street) and Account (with Deceased TRN),
Amount, Casket Price, Installment 1 Amount and Installment 1 Due Date all populated.

| # | Case | Expected |
|---|---|---|
| 1 | Click button on the test Deal | `status=success`, `sign_url` returned, contract opens embedded |
| 2 | Contract date boxes (Text - 1/2/3) | Today's day, 3-letter month, year |
| 3 | Buyer name (Text - 5) | Contact name |
| 4 | Buyer address (Text - 6) | Contact Mailing Street |
| 5 | TRN (Text - 7) | Account Deceased TRN (verify it is the buyer's) |
| 6 | Casket price (Text - 8) | Casket Price, 2 decimals |
| 7 | Installment amount (Text - 11) | Installment 1 Amount |
| 8 | Installment day / commencement (Text - 12 / 13) | Day, then "Month YYYY" of Installment 1 Due Date |
| 9 | Or in Full (Text - 16) | Deal Amount |
| 10 | Deposit, Balance date, Package contents | Boxes empty (no source yet) -- or filled once mapped |
| 11 | Signature field | Sits on the buyer's signature line, signing completes |
| 12 | Long values | Six-figure amounts and a long address fit their boxes without clipping |
| 13 | Deal with no Contact | `status=error`, "No NOK Contact linked to this Deal" |
| 14 | Deal with no Account | `status=error`, "No Account linked to this Deal" |
| 15 | Deal with blank Casket Price / Amount / Installment 1 | Succeeds, those boxes empty, no Deluge error |
| 16 | After sending | `zohosign__ZohoSign_Documents` record exists on the Deal, status "Out for Signature" |

## T-16 -- discount carried into invoices

Worked example (use a real test Deal, Payment Type as stated). Product Selection:
Row A: qty 1 x 100,000, **Discount 10,000**. Row B: qty 2 x 40,000, Discount 0.
Gross 180,000, discount 10,000 -> Deal **Amount 170,000**, **Total_Discount 10,000** (after `updateDealAmountForPreNeed`).

| # | Case | Expected |
|---|---|---|
| D1 | **Pay in Full** Deal, run `createInvoiceIfPaymentTypeIsPaymentInFull` | Invoice line A: List Price 100,000, **Discount 10,000**; line B: 40,000 x 2, Discount 0. Invoice sub total / net = 170,000 = Deal Amount |
| D2 | Pay in Full, Deal row has **no** discount | Lines unchanged from today (Discount 0) |
| D3 | Pay in Full, invoice already exists, then a discount is added to row A and the function reruns | Existing line A updates to the new Discount |
| D4 | Pay in Full, invoice already exists, discount **removed** from row A, rerun | Line A Discount goes back to 0 |
| D5 | Pay in Full, product row added after the invoice exists, rerun | New line carries its own Discount |
| D6 | **Installments**, Deposit 20,000, 3 installments -> each Installment_N_Amount = 50,000. Create Installment 1 invoice | Row A: List Price **27,941.18**, Discount **2,941.18**, net 25,000. Row B: List Price 12,500, qty 2, Discount 0, net 25,000. **Invoice total = 50,000** (= installment amount) |
| D7 | Same Deal, deposit retainer invoice (fires on Balance Due Date) | Row A: List Price **11,176.47**, Discount **1,176.47**, net 10,000. Row B: List Price 5,000, qty 2, net 10,000. **Invoice total = 20,000** |
| D8 | Deposit + all three installment invoices | Totals add up to **170,000** (Deal Amount). Discounts add up to 10,000 (may be off by a cent or two from rounding) |
| D9 | Installments Deal with **no** discount anywhere | Invoices identical to today's (Discount 0 everywhere) |
| D10 | Installment invoice already exists, rerun the builder (update branch) | Lines rewritten with discount; total still equals the installment amount |
| D11 | Product with a tax (e.g. GCT 15%) and a discount, installment invoice | Line tax = (qty x List Price - Discount) x 15%, not on the gross |
| D12 | Compare Deal `Total_Tax` with the sum of invoice `Tax` | Equal, unless a product has more than one tax ticked (builder uses only the first) |
| D13 | Deal where a row's Unit Price is 0 or every row has zero net | No divide-by-zero; discount fraction stays 0; invoices still create |
