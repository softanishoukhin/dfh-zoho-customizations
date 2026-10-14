# ZP-TBD-110 (CRM part) -- createPaymentsOnBooksForRetainerInvoice: re-sync never converts a payment twice

**Folder number is a placeholder**: rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-14, NOT applied, NOT tested.** One ticket with the Books part:
`books/functions/customer_payments/ZP-TBD-110_retainer_payment_usd_conversion/`. **The full guideline (both parts)
is `guideline.md` in that Books folder.**

| | |
|---|---|
| Function | CRM `createPaymentsOnBooksForRetainerInvoice` (automation, arg `crmid` = CRM Invoice id) |
| Runs | CRM workflow on a retainer-backed CRM Invoice (Pre-Need Deposit / Installment) when its Invoice_Payers change |
| Related | ZP-TBD-91 (rounding cap), ZP-TBD-95 (top-up carry + re-sync to the retainer the payment is on), ZP-TBD-84 |

## Live facts (2026-10-14)

- NEW payment (no `Books_Payment_ID`): converts the CRM amount (Actual_Paid_Amount, else Amount_Paid) from the
  payment mode's currency into the retainer's currency with Books' current rate (Settings > Currencies), sets
  `cf_actual_paid_amount` = the CRM amount. It does **not** set `cf_payment_created_from` (the invoice version
  `createPaymentsOnBooks` sets CRM / Fygaro).
- EXISTING payment (`Books_Payment_ID` set): recomputes the amount the same way and PUTs it. If the row's
  Amount_Paid has been replaced by the Books (JMD) amount -- `allprocessonpaymentcreateandupdate` does that for
  payments it sees as `Books` -- the JMD amount is multiplied by the USD rate again.
- `createPaymentsOnBooks` (invoices) has no update branch (commented out), so invoices aren't affected.
- No CRM-created retainer payment was left to read (the test ones were deleted), so the `cf_payment_created_from`
  default on them is not confirmed. The fix doesn't depend on it.

## Files

- `resync_keep_books_amount_block.deluge`: the block to paste
- `createPaymentsOnBooksForRetainerInvoice_UPDATED.deluge`: full body after the change
- `rollback/createPaymentsOnBooksForRetainerInvoice_CURRENT.deluge`: live body 2026-10-14 (no keys in it)
