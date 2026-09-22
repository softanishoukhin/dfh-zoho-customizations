# ZP-TBD-73 -- Pre-Need contract, deposit, and invoice discount (T-14 / T-16): deployment guideline

**Folder number is a placeholder** (`ZP-TBD-73`) -- rename once a real Zoho Projects task ID exists.
**Status: written 2026-09-21, nothing deployed, nothing tested.** Every code file here was built from either the live
source pulled from CRM on 2026-09-21 (the two invoice builders) or from Deal/Products field metadata (everything new).

Everything below is applied by hand in Zoho CRM. Nothing in this repo edits CRM.

---

## 0. What changes, in one table

| # | Piece | Type | File in this folder | Deploy as |
|---|---|---|---|---|
| 1 | Sign template (Zoho Sign editor) | manual | -- (`metadata.md` field map) | build in Sign UI |
| 2 | `sendPreNeedFuneralContract` | new Deals button function | `function.deluge` | new function + button |
| 3 | `calculateInstallmentAmount` | change to existing button function | `calculateInstallmentAmount_UPDATED.deluge` | replace live body |
| 4 | `createPreNeedDepositRetainerInvoice` | new automation function | `createPreNeedDepositRetainerInvoice.deluge` | new function + workflow rule |
| 5 | `updateDealAmountForPreNeed` | new standalone function | `updateDealAmountForPreNeed.deluge` | new function; re-route callers |
| 6 | `createInvoiceIfPaymentTypeIsPaymentInFull` | **T-16 change** to live function | `createInvoiceIfPaymentTypeIsPaymentInFull_DISCOUNT.deluge` | replace live body |
| 7 | `createInstallmentInvoice` | **T-16 change** to live function | `createInstallmentInvoice_DISCOUNT.deluge` | replace live body |
| 8 | Send Links via WhatsApp widget | widget change | `D:\Office\Andrea_Projects\DFH\widgets\sendLinksViaWhatsApp\sendLinksViaWhatsApp\dist\sendLinksViaWhatsApp.zip` | re-upload widget zip |

Two Deals fields must exist first (already created 2026-09-21): `Pre_Need_Deposit_Amount` (currency) and
`Pre_Need_Balance_Due_Date` (date).

---

## 1. The T-16 discount fix (pieces 6 and 7)

**Problem (from Andrea):** `Product_Selection` rows carry a `Discount`, but both invoice builders copy only Parent Product,
Product Name, Quantity and List Price -- so the agreed discount never reaches the invoice.

**Confirmed 2026-09-21:** the subform's `Discount` is a row-level **amount** (not per unit, not a percent), and
installment / deposit invoices show the discount **split in proportion** (section 1b).

### 1a. `createInvoiceIfPaymentTypeIsPaymentInFull` -- direct copy

The pay-in-full invoice bills the Deal's rows at full price, so `Discount` can be copied straight across. Three places
build line items; **all three** get one added line (the file is the live source with exactly these three lines added):

```deluge
// 1) new-invoice branch, after productMap.put("List_Price",product.get("Unit_Price"));
productMap.put("Discount",ifnull(product.get("Discount"),0));

// 2) existing-invoice, matched row, after itemMap.put("List_Price", ... .get(index).get("Unit_Price"));
itemMap.put("Discount",ifnull(recordInfo.get("Product_Selection").get(index).get("Discount"),0));

// 3) existing-invoice, newly added row, after itemMap.put("List_Price",line_item.get("Unit_Price"));
itemMap.put("Discount",ifnull(line_item.get("Discount"),0));
```

Sending `0` (not omitting it) matters on the update path: it clears a discount that was removed from the Deal.

### 1b. `createInstallmentInvoice` -- pro-rata, NOT a direct copy

**Why it can't be a direct copy:** an installment invoice's line amounts come from `Installment_N_Amount`, which comes
from the Deal `Amount`. With `updateDealAmountForPreNeed` (piece 5) that `Amount` is already **net** of the discounts.
Copying `Discount` onto those lines would discount twice, and the invoice total would no longer equal the installment
amount Andrea sees on the Deal and in the contract.

**What we do instead:** show each row's discount in proportion to this invoice's share of the Deal's net total.

```
dealNetTotal     = sum( qty x Unit_Price - Discount )            over all Product_Selection rows
discountFraction = Installment_N_Amount / dealNetTotal
lineDiscount     = row.Discount x discountFraction               (rounded to 2 dp)
List_Price       = (allocated part + lineDiscount) / quantity    -> gross share, per unit
Discount         = lineDiscount
tax base         = qty x List_Price - lineDiscount               -> tax is charged AFTER discount
```

The line's **net stays exactly the allocated part**, so each invoice total still equals its installment amount, and
the invoices add up to the Deal's net Amount. Same three places as 1a (new invoice / matched row / newly added row).
The setup block (`dealNetTotal`, `discountFraction`) is added once, right after the `parts` list is built.

The deposit invoice (piece 4) uses the identical rule with `depositAmt` in place of `Installment_N_Amount`, so
deposit + installments together carry the whole discount.

**Known limits (unchanged behaviour, not introduced by this fix):**
- The function splits each installment **evenly across product rows** regardless of price, so a row's allocated part
  can differ a lot from its real net. Discount is still shown pro rata, so totals stay right.
- Rounding can leave a cent or two between invoice total and installment amount (`round(part / qty)` x `qty`).
- It applies only the **first** tax on a product (`taxList.get(0)`). `updateDealAmountForPreNeed` sums **all** selected
  taxes. Confirmed 2026-09-21 that no product has two taxes ticked, so the two agree; if a product ever gets a second
  tax, Deal `Total_Tax` and invoice tax will differ.

### Apply

1. CRM > Setup > Developer Space > Functions.
2. **Save the current body first** -- copies are in `rollback/` (dated 2026-09-21). If the live function has changed
   since then, paste the live one over the rollback file first.
3. Open `createInvoiceIfPaymentTypeIsPaymentInFull` -> paste `createInvoiceIfPaymentTypeIsPaymentInFull_DISCOUNT.deluge`
   over the whole body -> Save.
4. Open `createInstallmentInvoice` (API name `createinstallments`) -> paste `createInstallmentInvoice_DISCOUNT.deluge`
   -> Save.
5. Run the discount tests in `test-cases.md` (section T-16) before telling Andrea it is done.

**Out of scope (confirmed 2026-09-21):** invoices already created are not being corrected. They keep their old lines.

---

## 2. Order of work for a new Pre-Need Deal (what staff do, and why the order matters)

1. Choose products (Product Selection), with any agreed discount per row.
2. **Deal Amount recalculates** (piece 5, `updateDealAmountForPreNeed`): `Amount = sum(qty x Unit_Price - Discount)`,
   plus `Total_Discount` and `Total_Tax`.
3. If installments: enter **Pre-Need Deposit Amount first**.
4. Click **Calculate Installment Amount** (piece 3): splits `Amount - Deposit` into the installments.
5. Enter **Pre-Need Balance Due Date last** -- this fires the deposit retainer invoice (piece 4), which reads the
   deposit at that moment. Editing the deposit afterwards does **not** change the invoice.
6. Create the installment invoices with the existing buttons (piece 7).
7. Send the contract (piece 2) via the WhatsApp widget's **Add contract link** button (piece 8).

---

## 3. Other pieces -- apply notes

**Piece 2 -- `sendPreNeedFuneralContract`.** Create the function (category Button, argument `crmid`), paste
`function.deluge`, add a Deals custom button. Blocked on the Sign template (piece 1) being built. Open items: what
`Text - 4` is, where Package contents comes from, and whether `Accounts.Deceased_TRN` is the buyer's TRN -- see
`metadata.md`. The WhatsApp widget calls `sendpreneedfuneralcontractembedded` -- confirmed 2026-09-21 as the
correct function name, no widget change needed.

**Piece 3 -- `calculateInstallmentAmount`.** Replace the live body with `calculateInstallmentAmount_UPDATED.deluge`.
Change: splits `Amount - Pre_Need_Deposit_Amount`. Blank deposit = old behaviour. Still writes exactly three installments.

**Piece 4 -- `createPreNeedDepositRetainerInvoice`.** Create as an automation function, then a Deals workflow rule:
*when `Pre_Need_Balance_Due_Date` is updated to any value -> function*. The function checks the deposit itself.
Never creates a second deposit invoice (skips if an invoice with Subject `Deposit Invoice%` exists on the Deal).

**Piece 5 -- `updateDealAmountForPreNeed`.** Create as a standalone function. The old `updateDealAmount` is **not**
changed. Its callers (backup copies of `Create Retainer Invoice in Books` and `Create Sales Order from Deals`) still call
the old function for pre-need Deals and must be routed to the new one (branch on the Deal's Pipeline -- confirm the
exact value; the ZP-TBD-67 test Deal shows "Pre Need"). Pull each live caller and grep every function for direct calls
before editing; the backups may be stale.

**Piece 8 -- widget.** Upload `dist/sendLinksViaWhatsApp.zip`. Contract link is added only when staff click
**Add contract link**, never on open (each click creates a real Sign request). Check that an embedded signing URL still
opens when the customer taps it some minutes later -- these URLs are short-lived (believed about 2 minutes, unconfirmed)
and carry a `frameorigin` parameter; if it does not work outside the portal, the contract has to be sent as a normal
Sign request instead.

---

## 4. Rollback

| Piece | Rollback |
|---|---|
| 6, 7 | Paste back `rollback/createInvoiceIfPaymentTypeIsPaymentInFull_LIVE_2026-09-21.deluge` / `rollback/createInstallmentInvoice_LIVE_2026-09-21.deluge`. Invoices created meanwhile keep their discount lines. |
| 3 | Paste back the original `calculateInstallmentAmount` (the version pasted by the user, without the deposit lines). |
| 2, 4, 5 | New functions -- delete the button / workflow rule / function. Nothing existing was modified. |
| 8 | Re-upload the previous widget zip (last packaged 2026-09-18). |

## 5. Decisions and open questions

**Confirmed 2026-09-21:** Discount is a row-level amount; installment/deposit invoices split the discount in
proportion; no product has two taxes ticked; widget function name is correct; existing invoices are not being corrected.

**Still open:**
1. What is `Text - 4` on the contract; where does Package contents come from; is `Accounts.Deceased_TRN` the buyer's TRN?
2. Should the contract be embedded / on-site signing (as drafted) or emailed to the buyer?
3. Does an embedded signing link still open when the customer taps it minutes later (WhatsApp delivery)?
