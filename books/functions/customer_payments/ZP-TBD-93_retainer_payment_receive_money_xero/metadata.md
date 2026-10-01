# ZP-TBD-93 -- Retainer payments to Xero: one Receive Money per payment

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-01, NOT applied, NOT tested.** Apply per `guideline.md`.

| | |
|---|---|
| New function | Books `createretainerpaymentinxero` (Customer Payment) |
| New rule | `Retainer Payment To Xero` (Customer Payments, create/edit, `Xero Bank Transaction ID` is empty) |
| New field | Customer Payments `Xero Bank Transaction ID` (`cf_xero_bank_transaction_id`) |
| Deactivated | rule `Sync Retainer Invoice To Xero` (`5830143000019193018`) + Schedule `createRetainerInvoiceToXero` |
| Follows up | ZP-TBD-74 "Known gap" (lump at retainer creation, instalments never reach Xero) |
| Reported by | user, 2026-10-01 |

## Live facts (2026-10-01)

- `syncretainerinvoicetoxero` (`5830143000019094452`): one Receive Money for the retainer's full line total into
  BNS DFH-Checking (`AB461C09-...`), lines coded to "pre need" with per-line tax codes. Skips when the retainer
  has `cf_xero_bank_transaction_id`. Its rule's criteria is `cf_xero_invoice_id` not empty, which new retainers
  never have, so in practice the catch-up **Schedule** posts the lump.
- RET-K-2026-000148: lump `35be8e8f-9ada-48a2-be20-404e148a74e3`; payments PAY-K-2026-001771/2/3 deposited to
  CIBC DFH-JDM; not in Xero.
- Invoice payments reach Xero via `createinvoiceonxero` -> `iw_create_payments_on_xero` (webhook code not
  visible). `createpaymentsonxero` is fully commented out.
- `iw_getxeromasterdata` (ZP-TBD-56-4) returns lowercase-name-keyed `accounts` (bank accounts included),
  `taxes`, and `trackingCategories` (`{categoryId, options}`), cached for 60 min.
- `iw_createoverpaymentinxerofrom` exits early unless the payment has an unprocessed refund (ZP-TBD-56-2), so
  it doesn't post retainer payments.
- `allprocessonpaymentcreateandupdate` PUTs the Deposit To account of Books-entered payments after a 30 s
  sleep, which is why the new function waits 45 s.
- Hillview retainers (ZP-TBD-83) have no CRM invoice and are paid into Books "Hillview Pre-Need Clearing";
  Dale chose BNS DFH-Checking for them in Xero.
- Retainer RET-K-2026-000148 sample: `is_inclusive_tax: false`, 3 lines (Tax Exempt / GCT on Sales 15% /
  Zero Rated), line `item_total` excludes tax and `line_item_taxes[].tax_amount` holds it; total 824,760.

## Files

- `guideline.md` -- decisions, apply steps, behaviour table, notes, rollback
- `createretainerpaymentinxero_NEW.deluge` -- new function, 2 keys masked
- Test cases: `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-93_Retainer_Payment_Receive_Money_Test_Cases.xlsx`
