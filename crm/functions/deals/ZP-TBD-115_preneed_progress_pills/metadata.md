# ZP-TBD-115 -- Pre-Need progress pills: Payment Plan Set Up, Invoice(s) Sent, Contract Status

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-15 on live source. NOT applied, NOT tested.** Apply per `guideline.md`.

**Source:** `projectDocuments/PRENEED_DEV_LIST_2026-10-14.md`, tickets 1, 2, 3 (+ PN-05 answer: Plan Set Up when
the plan invoices are created; Invoice(s) Sent when the FIRST invoice is sent).

## Live facts (2026-10-15)

- Deal fields: `Payment_Plan_Set_Up` (Yes/No), `Invoice_s_Sent` (Yes/No), `Contract_Status` (-None-/Sent/Signed).
  On Deal "Dale testing" 6503357000086546051 they read Yes / Yes / Signed -- set by hand by Andrea.
- `setupPreNeedPaymentPlan` saves the Deal without firing workflows (deliberate) -> a Deals rule can't drive ticket 1.
- Plan invoices are created by REST POST (createInstallmentInvoice / createPreNeedDepositRetainerInvoice), which
  does fire Invoices "On Create" rules (e.g. "Create Invoice in Books" runs on them).
- `Invoice_For = "Other"` is used by every ordinary funeral invoice as well as the Pre-Need Lump Sum -> the
  ticket-1 function checks Deal Type = "Pre Need" (Type, not Pipeline: getRecordById reads Type reliably).
- `markInvoiceSent` and the email button write Status without firing workflows -> Andrea's suggested Invoices rule
  on "Status = Sent" would never run; the pill is set inside `markInvoiceSent` instead (email + WhatsApp both go
  through it). The email button only called it for Deposit/Installment -> widened to any Pre-Need Deal invoice
  so a Lump Sum email counts too.
- Contract sends: button + autosend -> `sendPreNeedFuneralContractEmail`; WhatsApp -> `...Embedded`. The old
  `automation.sendPreNeedContract` (2025, Writer mergeAndSign) set Contract_Status = "Sent"; ZP-TBD-82 moved the
  send and that line was lost. "Signed" is written elsewhere (Sign completion) and is never overwritten.
- Embedded send = the contract link is created for WhatsApp; Sent is set then (Zoho can't see the WhatsApp go out).

## Files
| File | Purpose |
|---|---|
| `markPaymentPlanSetUp_NEW.deluge` | Ticket 1 function (Invoices rule On Create) |
| `markInvoiceSent_UPDATED.deluge` | Ticket 2 -- full body; `rollback/markInvoiceSent_LIVE_2026-10-15.deluge` |
| `guideline.md` | All steps incl. the find/replace for the email button and both contract functions |
