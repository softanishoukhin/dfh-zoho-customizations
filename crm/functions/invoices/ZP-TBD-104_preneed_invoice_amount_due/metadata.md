# ZP-TBD-104 -- Pre-Need invoice payment links / emails ask for the whole plan

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-07 on live source. NOT applied, NOT tested.** Apply per `guideline.md`.

**Source:** caveat raised on PN-02 (2026-10-02, `PRENEED_DEV_TICKETS_2026-10-01.md`), left open after PN-04. Andrea,
2026-10-07: "make sure nothing left on this".

## Problem (confirmed live 2026-10-07)

Every Pre-Need plan invoice (Deposit / Installment) shares ONE Books retainer for the whole plan (ZP-TBD-74). Both
functions that work out "amount due" read that retainer's `balance` -- i.e. everything still owed on the plan:

- DPr003 Deposit invoice 6503357000083387349 (own total 662,680.03) was emailed 2026-10-02 with
  `Amount_in_JMD = 1,325,360.00` (the full plan).

`Amount_in_JMD / USD / GBP` drive the Fygaro payment links and the email templates. Affected:

| Who uses it | Function |
|---|---|
| "Send Invoice for Payment" email | `buttonsendemailforpaymentbypotentialpayers` (computes it itself) |
| WhatsApp links (Deal widget, Pre-Need screen) | `refreshinvoiceamountsforpotentialpayer` |
| Installment reminder emails (ZP-TBD-77) | `sendInstallmentReminder` -> `refreshinvoiceamountsforpotentialpayer` |

## Fix

For a Pre-Need plan invoice only: amount due = the invoice's own total (`Sub_Total + Adjustment`, the same figure
ZP-TBD-95 uses -- NOT `Grand_Total`, which is the balance once a payment syncs back) minus `Total_Actual_Paid_Amount`
(what `createPaymentsOnBooksForRetainerInvoice` posted against this invoice), floored at 0. Every other invoice
type keeps the Books balance as before.

Side effects (all intended):
- Reminders: a fully paid installment now shows 0 -> the reminder chain stops ("balance is 0" branch).
- The email button also writes this amount to the Books document's `cf_amount_due_in_*` (the shared retainer) --
  it now holds the amount of the invoice last sent rather than the whole plan.
- Payments still post against the retainer(s) exactly as before (ZP-TBD-95 carry-over unchanged).

## Files

| File | Purpose |
|---|---|
| `guideline.md` | Two find/replace edits per function + rollback |
| `test-cases.md` | Test journeys (xlsx: `widgets\testCases\ZP-TBD-104_PreNeed_Invoice_Amount_Due_Test_Journeys.xlsx`) |
