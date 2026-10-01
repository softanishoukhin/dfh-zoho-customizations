# ZP-TBD-92 -- Payment receipt (WorkDrive link) for retainer invoice payments

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-01, NOT applied, NOT tested.** Apply per `guideline.md`.

| | |
|---|---|
| Functions | Books `sendpaymentreceipt` (id `5830143000002583028`), `loadreceiptlink` (id `5830143000017777475`), Customer Payment receipt custom button function (source pasted by user 2026-10-01; buttons aren't listed by the custom-function API) |
| Workflows | `Send Payment Receipt - On Create` (active), `GenerateReceiptOnEdit` (active, any edit), `Send Payment Receipt - On Edit` (inactive) |
| Reported by | user, 2026-10-01 -- PAY-K-2026-001771 has no receipt / WorkDrive link |

## Live facts (2026-10-01)

- PAY-K-2026-001771 / 001772 / 001773 are all on retainer RET-K-2026-000148 (`5830143000037647001`),
  `cf_payment_created_from = Books`, `"invoices": []`, and none has `cf_download_payment_receipt`.
- Both functions call `customer_payment.get("invoices").get(0)` before the Writer merge, so they fail on any
  retainer payment. Same root cause as ZP-TBD-84 (`allprocessonpaymentcreateandupdate`, already live with its fix).
- RET-K-2026-000148 has `cf_crm_invoice_id = 6503357000084729060`. That CRM Invoice has
  `Deal_Name__s` and `Is_Ecommerce = false`.
- In `loadreceiptlink` the invoice lookup's result is overwritten by `customer_name` straight after, so removing it
  changes nothing for invoice payments.

## Files

- `guideline.md` -- find/replace steps, how to regenerate the 3 missing receipts, tests, rollback
- `rollback/sendpaymentreceipt_CURRENT.deluge` -- live body, key masked
- `rollback/loadreceiptlink_CURRENT.deluge` -- live body (no keys)
- `rollback/generate_receipt_button_CURRENT.deluge` -- live button body, key masked
