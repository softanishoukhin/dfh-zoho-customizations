# ZP-TBD-84 -- allprocessonpaymentcreateandupdate: retainer invoice payments

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-09-29, NOT applied, NOT tested.** Apply per `guideline.md`.

| | |
|---|---|
| Function | Books `allprocessonpaymentcreateandupdate` (Customer Payment, id `5830143000026196041`) |
| Workflow | `paymentWorkflowTriggerOnAnyCreateOrUpdate` (every payment create/edit) |
| Reported by | user, 2026-09-29 -- `get("invoices").get(0)` fails on a retainer payment |

## Live facts (2026-09-29)

- A retainer payment's GET response: `"invoices": []`, target in `"retainerinvoice_id"` plus a `"retainerinvoice"`
  summary (`retainerinvoice_total`, `retainerinvoice_balance`). Sample PAY-K-2026-001751 / RET-K-2026-000133,
  `cf_payment_created_from = Books`.
- Retainer invoices carry `cf_crm_invoice_id` and `cf_related_crm_deal_id` (checked on RET-K-2026-000113); they have
  no `cf_updated_from_crm` field (that one is invoice-only).
- `syncretainerinvoicestatusbetweencrmandxero` (retainer_invoice workflow) syncs only the Status to the CRM Invoice
  -- no payment rows.
- The function's end (Xero overpayment webhook, ZP-TBD-82 contract block) was never reached for Books-entered
  retainer payments -> ZP-TBD-82's automatic contract send depends on this fix for cash/cheque entered in Books.
- `iw_updatepaymentamount` / `iw_getpaymentcurrencycode` are Books incoming webhooks; their code isn't reachable
  with our tools.

## Files

- `guideline.md` -- find/replace steps (keeps live keys in place), checks, rollback
- `allprocessonpaymentcreateandupdate_UPDATED.deluge` -- full body after the fix, keys masked
- `rollback/allprocessonpaymentcreateandupdate_CURRENT.deluge` -- live body, keys masked
- Test cases: `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-84_Allprocess_Retainer_Payment_Test_Cases.xlsx`
