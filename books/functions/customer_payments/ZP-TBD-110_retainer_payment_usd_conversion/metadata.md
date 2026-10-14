# ZP-TBD-110 -- allprocessonpaymentcreateandupdate: USD -> JMD conversion for retainer invoice payments

**Folder number is a placeholder**: rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-14, NOT applied, NOT tested.** Apply per `guideline.md`.

| | |
|---|---|
| Function | Books `allprocessonpaymentcreateandupdate` (Customer Payment, id `5830143000026196041`) |
| Workflow | `paymentWorkflowTriggerOnAnyCreateOrUpdate` (every payment create/edit) |
| Reported by | Andrea, 2026-10-14: US$2,000 on RET-MB-2026-000005 didn't convert; corrected by hand |
| Related | ZP-TBD-84 (retainer payments in this function; added the guard that skips conversion), ZP-TBD-92 (retainer receipts), Payment Inflation incident 2026-07-07 (double conversion -> `cf_amount_converted` stamp) |

## Live facts (2026-10-14)

- PAY-MB-2026-002720 (`5830143000035417832`), created 2026-09-01 15:24 by Joan Ottey, Books, mode "Online Credit
  Card USD", Deposit To CIBC-DFH USD, currency JMD. Sep 1 run log: `amount: 2000`, `cf_exchange_rate: 157`,
  `cf_amount_converted: false`; run failed at line 169 (`invoices.get(0)`, pre-ZP-TBD-84). Edited to 314,000 on
  2026-10-12 15:48; `cf_amount_converted` still false.
- PAY-MB-2026-003127 (US$285.68 entered as JMD 44,853, no exchange rate) completed the retainer: 16,147 + 314,000
  + 44,853 = 375,000.
- RET-MB-2026-000005 (Feb 2026, made by hand in Books): no `cf_crm_invoice_id`, no `cf_related_crm_deal_id`.
- `iw_updatepaymentamount` (incoming webhook; backup `DFH\backup\2026\09042026\updatepaymentamount.txt`): needs
  `invoices[0]`, then applies the payment to that invoice.
- `Send Payment Receipt - On Edit` is **inactive**; `GenerateReceiptOnEdit` (loadreceiptlink) is active and uses the
  payment's own `currency_code` + `amount`.

- CRM-created payments always carry `cf_actual_paid_amount` (e.g. PAY-K-2026-001811, Fygaro, "2200.00");
  `createPaymentsOnBooksForRetainerInvoice` does not set `cf_payment_created_from`. CRM part of this ticket:
  `crm/functions/invoices/ZP-TBD-110_retainer_payment_resync_no_reconversion/`.

## Files

- `guideline.md`: both parts (A Books, B CRM): what changes, where to paste, checks, rollback
- `retainer_conversion_block.deluge`: the block to paste
- `allprocessonpaymentcreateandupdate_UPDATED.deluge`: full body after the change, keys masked
- `rollback/allprocessonpaymentcreateandupdate_CURRENT.deluge`: live body 2026-10-14, keys masked
- Test cases: `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-110_Retainer_Payment_USD_Conversion_Test_Journeys.xlsx`
