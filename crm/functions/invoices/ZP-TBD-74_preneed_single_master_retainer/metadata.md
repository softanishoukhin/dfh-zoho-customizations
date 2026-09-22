# ZP-TBD-74 — One master Books retainer per Pre-Need Deal

**Source:** Andrea reported "One Pre-Need creates four Books retainers" — expectation is 1 Pre-Need
= 1 master Books retainer invoice, with the deposit and every installment paying it down instead
of each creating a separate retainer document. Investigated and built 2026-09-22, live-source-first
(both functions below pulled fresh from CRM immediately before writing).

## Root cause (confirmed against live workflow config, not assumed)

The CRM workflow **"Create Invoice in Books"** (Invoices module, trigger `create`, id
`6503357000009264079`) branches on `Retainer_Invoice`:
- `false` → function `Create Invoice in Books` (regular invoices, untouched by this ticket).
- `true` → function `createRetainerInvoiceInBooks` (id action `6503357000020254338`).

A Pre-Need Deal creates **four separate CRM Invoice records**, each with `Retainer_Invoice = true`:
one Deposit Invoice (`createPreNeedDepositRetainerInvoice`, ZP-TBD-73) and up to three Installment
invoices (`createinstallments`, one per "Create Installment Invoice" button click). Each of these
four is a distinct CRM record starting with an empty `Books_Invoice_ID`, so each independently
triggers `createRetainerInvoiceInBooks`, and that function's existing logic is a straight 1
CRM-invoice → 1 Books-retainer mirror: no `Books_Invoice_ID` yet means
`zoho.books.createRecord("retainerinvoices", ...)`. Hence four Books retainers per Pre-Need.

Live-pulled original body of `createretainerinvoiceinbooks` is in `rollback/` (pulled 2026-09-22,
byte-identical to what this fix is built on top of — matches the `All functions/Backup DFH` copy
almost exactly, with a few small live-only additions: `cf_edit_status`/`cf_edit_timestamp`/
`cf_related_crm_deal_id` custom fields, and reactivating an inactive Books item).

## Design (confirmed with user 2026-09-22)

**One retainer, sized to the full contract amount from day one** (not built up incrementally):
- The **first** Deposit/Installment invoice to fire for a Deal becomes the master — sized to the
  Deal's **full `Product_Selection`** (all rows, full `Unit_Price x Quantity - Discount`, no
  proration), not just that one invoice's own partial slice. This is a deliberate change from the
  live function's normal behavior of mirroring whatever `Invoiced_Items` sit on the CRM invoice
  that triggered it.
- Every **subsequent** Deposit/Installment invoice on the same Deal is detected via
  `zoho.crm.getRelatedRecords("Invoices","Deals",dealId)` (not COQL — see guideline.md for why:
  COQL reads the search index, which can lag behind a just-written record and let a duplicate
  master slip through) and is just **linked** to the same `Books_Invoice_ID` /
  `Books_Invoice_Number` — no new Books document, no line-item changes to the master.
- Chose "full amount upfront" over "grows incrementally" because: (a) it matches how a Books
  retainer invoice is meant to work — issued for a target, paid down over time — and how both
  Andrea and the existing `createPaymentsOnBooksForRetainerInvoice` (ZP-TBD-66) already think about
  it (balance-capped payments against one document); (b) incremental append means fetching the
  master's live `line_items` and PUTting the merged array back on every installment, which is a
  real duplicate-line risk if a call ever retries — and this org has already hit exactly that bug
  class once, in the retainer-to-Xero schedule (ZP-TBD-65 Stage 1).

**Why `createPaymentsOnBooksForRetainerInvoice` (ZP-TBD-66) needs no changes:** it already reads
`Books_Invoice_ID` off the *specific* CRM Invoice record being paid and posts a `customerpayments`
record capped at that retainer's live `balance`. Once all four sibling CRM Invoice records share the
same `Books_Invoice_ID`, deposit and installment payments naturally cap against, and pay down, the
one master — with zero changes to that function.

## Known gap — left out on purpose, confirmed with user 2026-09-22

`syncretainerinvoicetoxero` (ZP-TBD-65 Stage 1, confirmed live 2026-09-14) fires **once**, the first
time a retainer invoice is created/updated, and posts **one lump Xero Receive Money transaction
sized to the retainer's full line-item total** — then sets `cf_xero_bank_transaction_id` and skips
forever after. That function assumed 1 retainer = 1 one-time Xero post, matching the *old*
architecture (1 slice invoice = 1 retainer).

Under this fix, that assumption breaks either way:
- The master is created full-amount-upfront (this fix), so the very first Xero sync will report the
  **whole contract** as received into the bank the moment the deposit invoice creates the master —
  even though only the deposit has actually been collected.
- Installment payments collected later will **never generate their own Xero Receive Money
  transaction** — the one-shot flag already blocks any further sync on that retainer.

**User's explicit decision (2026-09-22): leave `syncretainerinvoicetoxero` exactly as it is for now.**
The correct follow-up (not built here) would move that Xero post from "retainer invoice
created/updated" to "a payment was just applied," sized to the payment amount, likely from inside
`createPaymentsOnBooksForRetainerInvoice` which already has the exact amount/date per payment. Flag
this to Andrea/Dale before Dale starts reconciling Pre-Need retainer payments against Xero — the
bank-side numbers for anything past the deposit will not be there until that follow-up is built.

## Files in this folder

| File | Purpose |
|---|---|
| `createRetainerInvoiceInBooks_MASTER_RETAINER.deluge` | Full replacement body for `createretainerinvoiceinbooks`. |
| `rollback/createRetainerInvoiceInBooks_LIVE_2026-09-22.deluge` | Live body pulled immediately before this change — paste back to revert. |
| `guideline.md` | Deployment and test steps. |

## Status

**Built 2026-09-22, not yet deployed, not yet tested.** No CRM/Books function-write API is available
to this session — apply by hand per `guideline.md`.
