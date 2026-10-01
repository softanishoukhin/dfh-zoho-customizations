# ZP-TBD-87 -- Pre-Need deposit / installment invoices charged GCT on top of a tax-inclusive amount

**Status: built 2026-09-30, NOT applied, NOT tested.** Built on the live source pulled 2026-09-30 (snapshots in
`rollback/`).

## The problem (found in test, Deal 6503357000084470306 "DFH Test Pretest")

| | Deal | CRM invoice | Difference |
|---|---|---|---|
| Deposit (50%) | 662,680.02 | 712,381.02 | +49,701.00 |
| Installment 1 (25%) | 331,340.01 | 356,190.51 | +24,850.50 |
| Installment 2 (25%) | 331,340.01 | 356,190.51 | +24,850.50 |
| **Total** | **1,325,360.04** (Contract_Value) | **1,424,762.04** | **+99,402.00** |

**Why:** `Contract_Value` already **includes** GCT (1,178,573.95 net + 146,786.09 GCT = 1,325,360.04 -- the same total as
the Books master retainer), so the deposit and installments -- shares of it -- are tax-inclusive too. But both invoice
builders split the amount **equally** over the Deal's product rows (here 4 x 165,670.005) and then GCT 15% is added
on the taxable rows (2 of the 4): 2 x 165,670.005 x 15% = 49,701.00 extra on the deposit.
- `createPreNeedDepositRetainerInvoice` sends no tax, so CRM applies the product's default tax.
- `createInstallmentInvoice` sends `Line_Tax` explicitly, computed on the equal split.

The Lump Sum invoice is **not** affected: it bills the products at their real prices and the tax comes out right.

## The fix

Both builders now:
1. work out each product row's **tax-inclusive** total: `(Qty x Unit_Price - Discount) x (1 + GCT%)`;
2. give each row its share of the plan amount in proportion to that total (last row takes the rounding cents);
3. take the tax back out of the share: net = share / (1 + GCT%), `List_Price` = (net + discount share) / Qty,
   `Line_Tax` = GCT% of the line after discount.

So `List_Price x Qty - Discount + Tax` = the row's share, and the **invoice total = the plan amount** (to the cent,
give or take Zoho's own rounding). Each invoice also carries its fair share of the GCT (deposit = 50% of the
contract's GCT, each installment 25%), instead of an amount that depended on how many rows happened to be taxable.
Tax rate per row = the product's first Tax value (unchanged, same as the installment builder already did).

In `createInstallmentInvoice` the lines are now worked out once and used by both the "create" and the "update an
existing Installment N invoice" branch (the three copies of the old line math are gone). The update branch keeps the
same behaviour: line N rewritten with its id, surplus lines deleted, new rows added.

## Apply

| # | Function | Change | File |
|---|---|---|---|
| 1 | `automation.createPreNeedDepositRetainerInvoice` | replace whole body | `createPreNeedDepositRetainerInvoice_UPDATED.deluge` |
| 2 | `standalone.createInstallmentInvoice` (`createinstallments`) | replace whole body | `createInstallmentInvoice_UPDATED.deluge` |

Setup > Developer Space > Functions > open each > paste the file over the whole body > Save. No new fields, no
workflow changes. `createInstallmentInvoice` is also used by the older installment buttons -- they get the same fix.

## The test Deal (6503357000084470306)

The fix only changes invoices built **after** it's applied:
- **Deposit invoice** -- already paid (712,381.02), and the deposit builder never rebuilds an existing deposit
  invoice. Leave it as is on this test Deal; the Books master retainer total (1,325,360) is already correct.
- **Installment 1 / 2** -- Calculate Installment Amount would rebuild them through the fixed builder (331,340.01
  each), but these CRM invoices are linked to the shared master retainer (ZP-TBD-74/85), so an item update may be
  pushed on to Books. Don't re-run it on this Deal; leave it as a record of the old behaviour.
- Test the fix on a **new** Pre-Need Deal (test sheet).

## Rollback

Paste `rollback/createPreNeedDepositRetainerInvoice_CURRENT.deluge` and `rollback/createInstallmentInvoice_CURRENT.deluge`
back over the two functions.
