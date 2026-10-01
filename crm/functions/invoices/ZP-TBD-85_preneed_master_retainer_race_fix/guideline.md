# ZP-TBD-85 — Deployment guideline

**Status: written 2026-09-30, not applied, not tested.**

## What changes

One function only: `createretainerinvoiceinbooks` ("Create Retainer Invoice in Books"), CRM > Setup > Developer
Space > Functions. No new fields, no workflow changes, no button changes. `setupPreNeedPaymentPlan`,
`createPreNeedDepositRetainerInvoice` and `createinstallments` are not touched.

## Apply

1. Open `createretainerinvoiceinbooks`.
2. Compare the live body with `rollback/createRetainerInvoiceInBooks_LIVE_2026-09-30.deluge`. If it has been edited
   since 2026-09-30, stop and tell us, and we'll merge onto the new version.
3. Paste `createRetainerInvoiceInBooks_UPDATED.deluge` over the whole body. Save.

## Clean up the test Deal (before the retest)

On Preneed ZZTEST Buyer 0929-1944:

1. **Xero first:** check whether `syncretainerinvoicetoxero` posted a Receive Money transaction for
   RET-K-2026-000137, 000138 or 000139 (`cf_xero_bank_transaction_id` on each retainer). If so, void those in Xero.
2. Delete payment PAY-K-2026-001754, then retainers RET-K-2026-000137 / 000138 / 000139 in Books.
3. Delete (or Void) the 3 CRM invoices (Deposit, Instalment 1, Instalment 2).

## Check real Deals

Any real Pre-Need Deal that was set to Instalments on or after 2026-09-29 (ZP-TBD-81 go-live) will have 3 Books
retainers. In Books > Retainer Invoices, look for more than one retainer with the same `cf_related_crm_deal_id`
created since 2026-09-29. Tell us about any you find before they're paid. Merging them is a per-Deal clean-up
(keep one, move payments, delete the drafts).

## Retest

See `test-cases.md`. The key check: set Payment Type = Instalments on a fresh Pre-Need Deal → Books has exactly
**one** retainer for the full contract value, and all 3 CRM invoices show the same Books Invoice Number.

Timing: the waiting invoices need the master to be finished first, so allow about 1 minute after setting Payment
Type before checking all three invoices.

## If an invoice shows the Note "Books retainer not linked"

The invoice it names (the oldest Deposit/Instalment on the Deal) didn't create the master within 2 minutes. Check
that invoice's function log (usually a Books error). Once it has a Books retainer, run `createretainerinvoiceinbooks`
by hand for the unlinked invoice (function editor > Execute, `crmid` = the invoice id). It will link, not create.

## Rollback

Paste `rollback/createRetainerInvoiceInBooks_LIVE_2026-09-30.deluge` back over the body. Nothing else was changed.
(Rollback brings back the 3-retainer race for Instalments.)
