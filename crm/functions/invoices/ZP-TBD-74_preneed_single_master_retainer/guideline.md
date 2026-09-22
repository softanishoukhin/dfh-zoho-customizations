# ZP-TBD-74 — Deployment guideline

**Status: written 2026-09-22, nothing deployed, nothing tested.**

## What changes

Only one function: `createretainerinvoiceinbooks` (display name "Create Retainer Invoice in Books"),
CRM Setup > Developer Space > Functions. No new fields, no new workflow rules, no button changes.
`createPreNeedDepositRetainerInvoice` and `createinstallments` (the installment-invoice button
function) are **not modified** — they keep creating their own CRM Invoice records exactly as today.

## Apply

1. CRM > Setup > Developer Space > Functions > find `createretainerinvoiceinbooks`.
2. **Save the current body first** if you haven't already — `rollback/createRetainerInvoiceInBooks_LIVE_2026-09-22.deluge`
   in this folder is the live body pulled immediately before this change. If the live function has
   been edited since 2026-09-22, pull it fresh and diff before overwriting.
3. Paste `createRetainerInvoiceInBooks_MASTER_RETAINER.deluge` over the whole body.
4. Save, then Publish (this is an automation-category function called from a workflow rule, not a
   button — no separate button/workflow step needed since the workflow already calls it).

## Not verified — confirm on the first real test

1. **Sibling lookup uses `getRelatedRecords`, not COQL — on purpose.** An earlier draft used a COQL
   query to find a sibling Deposit/Installment invoice with a `Books_Invoice_ID` already set. COQL
   (and the criteria/search API generally) reads from Zoho's **search index**, which can lag a few
   seconds behind a just-written record — if this function fires right after a sibling's
   `Books_Invoice_ID` was set (e.g. clicking "Create Installment Invoice" quickly after the deposit
   synced), the index might not have caught up, COQL comes back empty, and a second master gets
   created anyway — the exact bug this fix exists to remove. Switched to
   `zoho.crm.getRelatedRecords("Invoices","Deals",dealId)`, which reads the Deal's related Invoices
   directly rather than through the search index, so there's no lag window. This also removes the
   earlier open question about COQL's boolean-field/`is not null` syntax, since that query no longer
   exists. Not independently verified against a Zoho support statement that related-list reads skip
   the index — confirm on the first live test that a sibling created moments after the master is
   found reliably (not just eventually).
2. **Order independence.** The fix does not assume the Deposit Invoice fires first — whichever
   Deposit/Installment invoice reaches `createretainerinvoiceinbooks` first for a given Deal becomes
   the master. Confirmed by reading the code, not yet tested against out-of-order clicking (e.g.
   Installment 1 created before the deposit balance date is set).
3. **Tax name matching on the Deal-sourced lines.** For the master's line items, the tax name comes
   straight from `Products.Tax`'s picklist value split on `" - "` (e.g. `"GCT on Sales - 15.0 %"` ->
   `"GCT on Sales"`), matched case-insensitively against Books' tax list by name — same pattern the
   live function already uses for the non-master path, just fed from the Deal's product rows instead
   of the CRM invoice's own `Invoiced_Items`. Should behave the same; confirm on the first test with
   a taxable product.

## Test plan

Use a real (or disposable test) Pre-Need Deal with 2+ product rows, a deposit, and at least 2
installments, per the existing Pre-Need order of entry (products -> deposit amount -> Calculate
Installment Amount -> Pre-Need Balance Due Date -> Create Installment Invoice buttons).

| # | Step | Expect |
|---|---|---|
| T1 | Enter deposit, set Pre-Need Balance Due Date | Deposit Invoice CRM record created; `createretainerinvoiceinbooks` fires; a Books retainer invoice is created sized to the Deal's **full** product total (not just the deposit), `Books_Invoice_ID` set on the Deposit Invoice CRM record. |
| T2 | Click "Create Installment Invoice" for Installment 1 | New Installment 1 CRM Invoice record created; `createretainerinvoiceinbooks` fires, finds the existing master via COQL, and **links** (no new Books retainer created) — Installment 1's `Books_Invoice_ID` matches the Deposit Invoice's. |
| T3 | Repeat for Installment 2 and 3 | Same as T2 — all four CRM Invoice records end up with the identical `Books_Invoice_ID`. Confirm in Books: still exactly **one** retainer invoice for this Deal. |
| T4 | Record a payment against the Deposit Invoice (Invoice_Payers) | `createPaymentsOnBooksForRetainerInvoice` posts a `customerpayments` record against the master, capped at its live balance. Master's balance drops by the deposit amount. |
| T5 | Record a payment against Installment 1 | Same function posts against the same master; balance drops further. Confirms deposit + installment payments both pay down the one retainer. |
| T6 | Edit an installment invoice after it's already linked (re-click Create Installment Invoice with a changed amount) | Per the new guard, `createretainerinvoiceinbooks` should `return` early (log: "already has a Books retainer linked") and must **not** touch the master's line items. |
| T7 | Out-of-order case (if feasible to test) | Create Installment 1 before the Deposit Invoice exists (no master yet) -> Installment 1 becomes the master, sized to the full Deal, same as T1. Deposit Invoice created afterward links to it. |

Save results to `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-74_master_retainer_test_cases.csv`.

## Rollback

Paste back `rollback/createRetainerInvoiceInBooks_LIVE_2026-09-22.deluge` over the live function body.
Nothing else was touched (no new fields, no workflow changes), so this fully reverts to the
four-retainers-per-Deal behavior.

## Known gap (see metadata.md)

`syncretainerinvoicetoxero` is left untouched per the user's explicit decision 2026-09-22. Once this
ships, Pre-Need retainer payments beyond the deposit will not produce their own Xero Receive Money
transaction — flag this to Andrea/Dale before they rely on Xero for Pre-Need bank reconciliation
past the deposit stage.
