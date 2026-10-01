# ZP-TBD-80 -- Pre-Need products at $0 on the At-Need Deal (no second invoice)

Follows ZP-TBD-79 (Get Pre Need Info). Built 2026-09-28 on live source pulled the same day. **Not deployed,
not tested.**

## Requirement (Andrea, via developer 2026-09-28)
A Pre-Need plan (e.g. $347,500) that was already paid must not be invoiced again when the At-Need Deal is
created. The purchased products must appear on the At-Need Deal; the historical Pre-Need invoices stay where they
are. Anything the family adds later (e.g. a $30,000 product) goes through the normal SO/Invoice process for that
amount only. Andrea explicitly allowed the prepaid products to be $0.00 on the new Deal.

## Decisions
| Question | Answer (developer, 2026-09-28) |
|---|---|
| Approach | Prepaid products at $0 (Andrea's allowed option) |
| Plan only partly paid | Yes -- bill the remainder as ONE "Pre-Need Balance" line on the At-Need invoice; stop the Pre-Need installment reminders |
| Nothing new added | No Sales Order / Invoice at all |
| Swaps / upgrades of a prepaid item | Not expected -- no credit logic built |
| Xero liability (26100) | Release automatically |

## Live findings that shaped the build (2026-09-28)
- `createSalesOrdersForShipIns` sets `List_Price` = catalogue `Products.Unit_Price` and `Discount` = the Deal row's
  Discount **as a currency amount**; tax is computed on (amount - discount). `createInvoiceForShipIns` copies SO
  lines as they are. So Discount = catalogue x qty gives a $0 line with $0 tax -- but a later catalogue price
  change would break a fixed discount, hence the SO patch recomputes it for `Pre_Need_Line = Prepaid`.
- `manageZeroRatedProduct` (runs first in every SO build) adds a "Non Taxable - X" companion row at 100,000
  with no discount for every Zero Rated product -> patched to carry the Prepaid flag onto the companion.
- `Product_Selection.Unit_Price` is a read-only lookup field (from `Child_Product`), so ZP-TBD-79's write of
  `Unit_Price` never had any effect; the Balance line needs its own currency field `Pre_Need_Amount`.
- The Xero refresh token lives in the CRM org variable `xeroRefreshToken` (id 6503357000009423001), so a CRM
  function can call Xero with the same pattern as the Books functions.
- Live standalone reminder function API name is `sendinstallmentreminder_1`; `sendinstallmentreminder` is the old
  `automation.sendInstallmentReminderDepricated`.

## What this touches
| Item | Change |
|---|---|
| Product_Selection subform | +2 fields: `Pre_Need_Line` (picklist Prepaid/Balance), `Pre_Need_Amount` (currency) |
| Products | + "Pre-Need Balance" (non-taxable, not Zero Rated) |
| `button.getPreNeedInfo` | Step 3 rewritten (prepaid $0 lines + Balance line), paid amount read from the Books retainer(s), SO stamp only for a Balance line, Pre-Need marked converted (System_Data), liability release call, Books retainer comment, Note/summary text |
| `standalone.releasePreNeedLiability` | NEW -- Xero Manual Journal Dr 26100 / Cr revenue, idempotent via System_Data |
| `automation.createSalesOrdersForShipIns` | Prepaid -> Discount = List x Qty; Balance -> List_Price = Pre_Need_Amount; no SO when only prepaid lines |
| `standalone.manageZeroRatedProduct` | Companion of a prepaid line is prepaid |
| `standalone.sendInstallmentReminder` | Stops when the invoice's Pre-Need Deal is marked converted |
| System_Data rows | `Pre_Need_Converted` and `Pre_Need_Liability_Released`, Module_ID = Pre-Need Deal id |

## Open -- for Dale
1. **Revenue account** -- set to Xero **40000 "Sales"** (developer, 2026-09-28, from the live chart of accounts:
   no funeral- or Pre-Need-specific income account exists; 40000 is the normal business income account, same as
   the "Pre-Need Difference" product). Books item "Pre-Need Balance" -> Sales Account "Sales". Dale may still
   redirect it (one line in `releasePreNeedLiability`).
   **GCT:** 40000's default tax is GCT on Sales 15%, but the journal is posted `NoTax`. Whether GCT is due when the
   Pre-Need money becomes income is Dale's call.
2. **Timing**: the release is posted when Get Pre Need Info is clicked, not on the funeral date. OK?
3. **Amount**: the journal releases what was PAID (Books retainer `payment_made`, converted to JMD at the
   retainer's exchange rate). Confirm 26100 holds paid amounts only (i.e. the Receive Money sync posts on payment,
   not on retainer creation) -- otherwise the unpaid part stays in 26100.
4. **Partly paid plans**: reminders stop, but the unpaid installment CRM invoices and the Books master retainer
   still show the unpaid amount as outstanding. They should be voided/written off so the balance is not owed
   twice in the books (the family is billed once, on the At-Need invoice).
5. The paid retainer stays in Books as unused retainer credit on the customer. A Books comment on the retainer
   warns staff not to apply it; Dale may want to clear it another way.
6. No Revenue Center tracking is set on the journal lines.

## Not covered
- Quote button (`createQuoteFromDeal`) uses row Unit_Price + Discount: prepaid lines quote at $0 (correct), the
  Balance line quotes at the product's $0 price (Quote is rarely used on converted Pre-Needs).
- `createSalesOrderForShipInsV2` (test-name branch `009922`) not patched.
- Deals converted with the ZP-TBD-79 version (contract-price rows, no `Pre_Need_Line`) keep billing the old way;
  fix any real ones by hand.

## Sources checked (live, 2026-09-28)
`ZohoCRM_getFunctionCode`: getpreneedinfo, createsalesordersforshipins, createinvoiceforshipins,
managezeroratedproduct, sendinstallmentreminder_1, sendinstallmentreminder, sendinstallmentreminder7daysbefore;
`ZohoCRM_getFunctions` (API-name lookup); `ZohoCRM_getFields` (Product_Selection).
Repo: ZP-TBD-65 `syncretainerinvoicetoxero_REBUILD.deluge` (Xero token pattern), ZP-TBD-9 System_Data pattern.
