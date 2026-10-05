# ZP-TBD-95 -- Apply guideline

Three CRM function bodies replaced in full + three find/replace patches (`topup_patches.md`). No fields, rules
or buttons to create.

**Order matters:** everything that has to cope with a top-up retainer goes in BEFORE the function that creates
one (`setupPreNeedPaymentPlan`, last step). Each earlier step is safe on its own -- with no top-up on a Deal the
patched code behaves exactly as today.

## Before you start

Open each function and check it still matches what was pulled on 2026-10-02 (`rollback/*_LIVE_2026-10-02.deluge`
for the three full bodies; the FIND text in `topup_patches.md` for the patches). If someone changed it since,
stop -- re-merge onto the newer body first.

## Step 1 -- `createInstallmentInvoice` (CRM, API name `createinstallments`) -- change B

Replace the whole body with `createInstallmentInvoice_UPDATED.deluge`.
New: an existing installment invoice with a payment (Invoice_Payers row with a Books Payment ID or an amount, or
Total_Actual_Paid_Amount / Payment_Made > 0) is left untouched.

## Step 2 -- `createPreNeedDepositRetainerInvoice` (CRM) -- change C

Replace the whole body with `createPreNeedDepositRetainerInvoice_UPDATED.deluge`.
New: an existing UNPAID deposit invoice gets its lines rewritten to the current deposit amount (Subject, Status,
dates kept); a paid one is left alone.

## Step 3 -- Books `allprocessonpaymentcreateandupdate` -- patch P2

Books > Settings > Automation > Custom Functions. Apply P2 from `topup_patches.md`.
New: Deal `Amount_Paid_To_Date` = all plan retainers of the Deal added up.

## Step 4 -- (dropped) patch P3

**Do NOT apply P3.** It was written for the old ZP-TBD-65 at-need flow (apply the retainer to the at-need
invoice). ZP-TBD-80 is live: the retainers are never applied -- `getPreNeedInfo` bills prepaid products at 0,
adds one Pre-Need Balance line, and releases the paid amount by Xero journal. Checked live 2026-10-02:
`getPreNeedInfo` already adds up every Books retainer on the Pre-Need's plan invoices (master + top-up), so
nothing in the at-need flow needs changing. If P3 was already applied it is harmless (it only acts when a
retainer is applied) -- roll it back to keep the function as it was.

## Step 5 -- CRM `createPaymentsOnBooksForRetainerInvoice` -- patch P1a + P1b

Apply P1a and P1b from `topup_patches.md`.
New: a payment bigger than what is left on its invoice's retainer carries the rest over to the Deal's other plan
retainer (two Books payments, two Invoice_Payers rows); existing payments are re-synced to the retainer they are
really on, at their full amount.

## Step 6 -- `setupPreNeedPaymentPlan` (CRM) -- changes A + D + top-up

Replace the whole body with `setupPreNeedPaymentPlan_UPDATED.deluge`.

What it does when the plan invoices already exist (Installments only; Lump Sum untouched):
1. Reads each plan invoice (REST, so Invoice_Payers comes back) -> paid / unpaid. Paid amount = Sub_Total +
   Adjustment (NOT Grand_Total -- that is the balance due once a payment syncs back).
2. Paid -> remaining = Contract Value - full amount of the paid invoices, split evenly over the unpaid ones (due
   dates kept). Stops if remaining < 0, nothing is unpaid, or remaining < 1.
3. Books (before any CRM write):
   - Books payments not accounted for by the CRM invoices -> stop + Note.
   - Nothing paid in Books -> master re-sized to the Deal's products (an unpaid top-up is voided).
   - A payment exists -> master unchanged (Books code 9533); the increase per product goes on one retainer with
     reference "Pre-Need top-up of RET-...": created (and linked through the LAST unpaid plan invoice's
     Books_Invoice_ID), or re-sized/voided while it has no payment. A product that went down or was removed ->
     stop + Note "needs Accounts" (credit note). Both master and top-up paid -> stop + Note.
   - Books refuses anything -> Note + stop, nothing changed in CRM.
4. CRM: paid -> Deal amounts set, only unpaid invoices rebuilt. Nothing paid -> 50/25/25 as before, existing
   invoices updated in place.

The **Calculate Installment Amount** button already calls this function -- nothing to change on it.

## Step 7 -- Test

`test-cases.md` (xlsx: `widgets\testCases\ZP-TBD-95_Test_Journeys.xlsx`) -- 5 journeys, one Deal each, steps
in order. Journeys 1 and 3 need Steps 1, 2 and 6; Journey 2 from step 4 on, and Journeys 4-5, need everything.

## Rollback

Reverse order: Step 6 first (stops new top-ups), then the patches (put each FIND text back), then Steps 2 and 1
(`rollback/*_LIVE_2026-10-02.deluge`). Top-up retainers already created stay in Books: if one must go, void it
in Books AND set the linked CRM invoice's Books Invoice ID / Number back to the master's.
