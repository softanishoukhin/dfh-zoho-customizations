# ZP-TBD-67 — Installment invoices overbill when a product line has Quantity > 1

**Source:** user report — Deal `6503357000082023164` ("Test Test PN09152026", Pipeline Pre Need,
Amount 170,000) has 3 installment invoices, each showing ~113,333.34 instead of the correct
~56,666.67 (Amount ÷ 3). Confirmed live via `ZohoCRM_getRecord` on the Deal and on Installment
Invoice 1 (id `6503357000081984343`, Books number `RET-K-2026-000054`) before writing anything
down, per the standing live-source-first rule.

## Root cause — confirmed

Function `standalone.createInstallmentInvoice(Int crmid, String installmentAmountFieldAPI, String
installmentDueDateFieldAPI)` (CRM API name `createinstallments`). It correctly computes, per
installment, the **total dollar amount** to allocate to each product row on the Deal:

```deluge
total_amount = recordInfo.get(installmentAmountFieldAPI);   // e.g. 56666.67 for Installment 1
divisor = recordInfo.get("Product_Selection").size();       // number of product ROWS on the Deal
// ... builds "parts" = one total-dollar-amount per product row, summing back to total_amount
```

For the test Deal, `Product_Selection` has exactly one row (Preneed(2025) Hillview Urn Vault,
**Quantity 2**), so `divisor = 1` and `parts = [56666.67]` — correct so far, this is the intended
total for that one product row on this installment.

**The bug:** that per-row *total* (`parts.get(i)`) is then written straight into `List_Price`,
which CRM/Books treats as a **per-unit** price, and the line's own total is computed as
`Quantity × List_Price`. With Quantity 2, that doubles the line — and since there's only one
product row, it doubles the whole invoice:

```deluge
productMap.put("List_Price",parts.get(partsCounter));   // wrong: this is a TOTAL, not a per-unit price
lineAmount = productMap.get("Quantity") * productMap.get("List_Price");   // 2 x 56666.67 = 113333.34
```

Confirmed live on the actual created invoice: `List_Price: 56666.67`, `Quantity: 2`,
`Total`/`Sub_Total`/`Grand_Total`: `113333.34` — matches exactly.

This same pattern (`List_Price` set to `parts.get(index)` with no division by quantity) appears
in **three separate places** in the function, all three need the same fix:

1. The "brand-new invoice" branch (first line-item-building loop).
2. The "existing invoice, matching item already on it" loop.
3. The "existing invoice, newly-added product row" re-loop.

**Any Deal with a product row where Quantity ≠ 1 is affected** — this isn't specific to the test
Deal above. Any real pre-need (or other installment-invoiced Deal) with a multi-unit product line
would be overbilled by the same factor as that line's quantity.

## The fix

In all three places, divide the allocated total by the product row's quantity before putting it
in `List_Price`, so `Quantity × List_Price` reconstructs the intended total instead of doubling
(or tripling, etc.) it. Guard against a zero/blank quantity to avoid a divide-by-zero.

**Location 1 — new invoice branch:**
```deluge
// before
productMap.put("List_Price",parts.get(partsCounter));
```
```deluge
// after
lineQuantity = product.get("Quantity");
if(isNull(lineQuantity) || lineQuantity == 0)
{
	lineQuantity = 1;
}
productMap.put("List_Price",(parts.get(partsCounter) / lineQuantity).round(2));
```

**Location 2 — existing invoice, matched item loop:**
```deluge
// before
itemMap.put("List_Price",parts.get(index));
```
```deluge
// after
lineQuantity = recordInfo.get("Product_Selection").get(index).get("Quantity");
if(isNull(lineQuantity) || lineQuantity == 0)
{
	lineQuantity = 1;
}
itemMap.put("List_Price",(parts.get(index) / lineQuantity).round(2));
```

**Location 3 — existing invoice, newly-added product re-loop:**
```deluge
// before
itemMap.put("List_Price",parts.get(reLoopIndex));
```
```deluge
// after
lineQuantity = line_item.get("Quantity");
if(isNull(lineQuantity) || lineQuantity == 0)
{
	lineQuantity = 1;
}
itemMap.put("List_Price",(parts.get(reLoopIndex) / lineQuantity).round(2));
```

No other part of the function needs to change — the `total_amount`/`divisor`/`parts` calculation
that splits the installment amount across product rows is correct as-is; only the
per-unit-vs-total mixup at the point `List_Price` gets set needs fixing.

## Deployment (no CRM function write API available to this session)

This is a CRM `standalone` function — read-only via the tools available here
(`ZohoCRM_getFunctionCode` only, no update/deploy counterpart), matching the pattern already
established for Books custom functions and Creator `.ds` files elsewhere in this repo. Paste the
three corrected blocks into the live function (`createinstallments`) in place of the three
originals.

## Not yet decided — needs Andrea/Dale's call, not something to act on unilaterally

The three installment invoices already created on the test Deal (`6503357000081984343`,
`6503357000081989354`, `6503357000081972313`, Books numbers `RET-K-2026-000054` and the two
alongside it) are currently overbilled 2x and already synced to Books/Xero. Since this looks like
a test Deal ("Test Test PN09152026"), it may just need deleting/voiding rather than correcting —
but that's a data decision, not something to change without confirming first. Worth also asking
whether any **real** (non-test) Deals have gone through this same installment path with a
multi-unit product row, since those would carry the same overbilling live in Books/Xero right now.

## Status

Root cause confirmed live 2026-09-15, fix identified, not yet applied (no write access from this
session). Awaiting deployment and a decision on the already-created test invoices.
