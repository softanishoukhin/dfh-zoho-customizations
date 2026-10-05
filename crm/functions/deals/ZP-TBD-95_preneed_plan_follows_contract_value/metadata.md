# ZP-TBD-95 -- Pre-Need payment plan follows the Contract Value (PN-03)

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-02 on live source. First version applied for T3 (Books refused safely). Top-up version
(+ patches P1-P3) built 2026-10-02, NOT applied, NOT tested.** Apply per `guideline.md`.

**Source:** `projectDocuments/PRENEED_DEV_TICKETS_2026-10-01.md`, PN-03.

## Rule (agreed by Andrea)

> Money already paid is locked. Everything not yet paid re-spreads to match the new contract value.

- Nothing paid yet -> plan rebuilds 50 / 25 / 25; existing invoices are updated in place.
- Something paid -> invoices with a payment are left alone; the rest is split evenly over the unpaid
  invoices, which keep their due dates.
- Paid more than the new value -> nothing changes; left for a person.
- Manual only: the existing **Calculate Installment Amount** button (`button.calculateInstallmentAmount` ->
  `standalone.setupPreNeedPaymentPlan`). No new trigger on product edits.

## Decisions (user, 2026-10-02)

1. **"Paid" = the FULL amount of every invoice that has any payment**, not only the money received. Andrea's
   literal "new value minus everything paid" double-counts a part-paid invoice (contract 1,000, deposit 500 with
   200 paid -> 800 re-spread + 300 still owing on the deposit = 1,100 outstanding). Same result as her wording
   whenever invoices are fully paid. Tell Andrea.
2. **Change D included now**: the Books master retainer is re-sized too (not in the ticket).

## Live facts (2026-10-02)

- The DPr003 gap in the ticket (99,402.00) is **not** a product change: it is exactly 7.5% of 1,325,360.04 --
  the GCT-on-top bug (ZP-TBD-87, now live in both builders). 50,000 x 1.075 = 53,750; 425,120.01 x 1.075 =
  457,004.01. Those invoices date from 24 Sep, before ZP-TBD-81 (50/25/25) and ZP-TBD-87.
- "Nobody is told" is already covered: `checkPreNeedPlanMatchesContract` (ZP-TBD-88) is live -> Note on the
  Deal + contract send blocked when Contract_Value != the Books plan total.
- `createInstallmentInvoice` updates an existing invoice in place (confirmed). `createPreNeedDepositRetainerInvoice`
  returned early if a `Deposit Invoice%` existed (confirmed).
- **Books master retainer never re-sizes.** `createRetainerInvoiceInBooks` returns early for any plan invoice
  that already has a `Books_Invoice_ID` ("the master's line items are fixed at creation time"). Without change D:
  Books keeps the old value, payments are capped at the old balance, and ZP-TBD-88 blocks the contract forever
  (it compares Contract_Value with the **Books** total).
- **Invoice Status can't say which invoice is paid.** `syncretainerinvoicestatusbetweencrmandxero` (Books)
  mirrors the master's status onto the one CRM invoice in `cf_crm_invoice_id` (normally the Deposit). The
  per-invoice signal is the invoice's own `Invoice_Payers` rows (`Books_Payment_ID`, `Amount_Paid`) and
  `Total_Actual_Paid_Amount`, written by `createPaymentsOnBooksForRetainerInvoice`. Payment_Made > 0 is also
  treated as paid (conservative).
- A payment entered directly in Books is not tied to a CRM invoice -> if the master's `payment_made` exceeds
  the CRM `Total_Actual_Paid_Amount` sum by > 1.00, the function stops with a Note.
- Books retainer-edit side effects checked: `syncretainerinvoicetoxero` skips once `cf_xero_bank_transaction_id`
  is set; `addpreneeddifferenceandcreditnoteonretainerapply` exits when the retainer isn't applied to an invoice;
  the status mirror only fires on a status change.
- Only 4 Pre-Need plan invoices exist in the org (all DPr003, none paid) -> no live paid example to test against.

## Changes

| # | Function | Change |
|---|---|---|
| A | `standalone.setupPreNeedPaymentPlan` | Reads existing plan invoices; locks paid ones; re-spreads the rest evenly (due dates kept); stops for refund / all-paid / unattributed-Books-payment cases. |
| B | `standalone.createInstallmentInvoice` (`createinstallments`) | Returns early if the existing invoice has a payment. |
| C | `automation.createPreNeedDepositRetainerInvoice` | Existing unpaid deposit is updated in place (lines only; Subject/Status/dates kept); paid deposit left alone. |
| D | `standalone.setupPreNeedPaymentPlan` | Re-sizes the Books master retainer to the Deal's products **before** any CRM write; if Books refuses -> Note + nothing changed. Skipped when the master already matches (+-1.00). |

No new fields, functions, modules or workflow rules.

## Top-up retainer (user decision 2026-10-02, after T3)

Books won't change a paid retainer (9533), so when the contract goes UP after a payment the increase goes on one
extra Books retainer, reference `Pre-Need top-up of RET-...`, lines = what each product went up by (each keeps its
own GCT, so top-up total = CV - master). Linked through the LAST unpaid plan invoice's `Books_Invoice_ID`, so
`checkPreNeedPlanMatchesContract` (ZP-TBD-88) and `getPreNeedContractType` (ZP-TBD-82) -- both add up the distinct
Books ids of the plan invoices -- see master + top-up. Checked live: those two need no change.

Max ONE top-up per Deal: re-sized while unpaid, voided if the value drops back to the master's. Not automated
(stop + Note for Accounts): a product down / removed after a payment (needs a credit note), or a further change
once the top-up itself has payments.

Other functions that assumed one retainer per Deal, patched (`topup_patches.md`):

| Patch | Function | Why |
|---|---|---|
| P1a/b | `createPaymentsOnBooksForRetainerInvoice` (CRM) | Carry a payment over to the other retainer (two Books payments + two Invoice_Payers rows, JMD only). Re-sync existing payments to the retainer they are on, at full amount (the old PUT capped `amount_applied` at the current balance -> could un-apply a payment once a retainer is used up). |
| P2 | `allprocessonpaymentcreateandupdate` (Books) | `Amount_Paid_To_Date` added up over all plan retainers (was the one retainer the payment hit). |
| P3a/b (DROPPED) | `addpreneeddifferenceandcreditnoteonretainerapply` (Books) | Not needed: ZP-TBD-80 (live) never applies the retainers at need; `getPreNeedInfo` already sums all the Pre-Need's retainers (checked live 2026-10-02). Original reason: | At-need difference from the contract prices of ALL plan retainers; hand-off fields written once every paid retainer is applied, combined. `createinvoiceonxero` reads them ONCE (one Xero credit note, then `cf_xero_retainer_credit_note_id` blocks a second) -> not changed. |

Top-up -> Xero: one edit right after create so the retainer-edit workflow (`syncretainerinvoicetoxero`) posts its
Receive Money like the master's (Journey 2 step 3 confirms).

## Known gaps (not fixed here)

- **Two receipts**: a carried-over payment is two Books payments -> the family may get two receipts
  (`sendpaymentreceipt` fires per payment). Journey 2 step 5 records it.
- **Fygaro / online payment links** pay the retainer in the link directly (not through
  `createPaymentsOnBooksForRetainerInvoice`) -> no carry-over. Links on the plan invoices show the retainer's
  amount anyway (PN-02 / PN-04 caveat).
- **At-need (ZP-TBD-78/79/80, live):** retainers are NOT applied; `getPreNeedInfo` sums master + top-up for Amount Paid To Date, the Balance line and the Xero liability release -- confirmed on Deal 6503357000084784373 (77,540 = RET-K-2026-000166 + top-up RET-K-2026-000167).
- **Invoice_Payers subform PUT** in `createPaymentsOnBooksForRetainerInvoice` sends only the rows posted in that
  run (existing behaviour, not changed) -- Journey 2 step 6 checks older rows stay.

- **Xero**: the master's Receive Money in Xero (`syncretainerinvoicetoxero`, ZP-TBD-65) is posted once at the
  original value and never updated. After a re-size Xero still shows the old amount -> adjust by hand / separate
  ticket. Not touched here on purpose (Xero daily limit, shared by all Xero functions).
- **CONFIRMED (T3, 2026-10-02, Deal "DFH Test 02102026" 6503357000084829312, RET-K-2026-000159): Books refuses**
  to change a retainer's amount once a payment is recorded -- `code 9533 "Cannot modify retainer invoice amount,
  once the payment is recorded."` The safe-fail worked: Note written, no CRM invoice or Deal field changed.
  Change D therefore only works while nothing is paid. User chose a **top-up retainer** for the paid case
  (2026-10-02) -- design + impact list pending, see below.
- **Bug found in T3, fixed:** after a payment syncs back, CRM `Grand_Total` = balance due (Sub_Total -
  Payment_Made; the paid 43,000 deposit read -0.005). Locked amount now = `Sub_Total + Adjustment`.
- **Leftover Installment 3** (pre-ZP-TBD-81 deals, e.g. DPr003): left unchanged in the nothing-paid rebuild;
  the button message says so. PN-06.
- Lump Sum deals are unchanged by this ticket.

## Files

| File | Purpose |
|---|---|
| `setupPreNeedPaymentPlan_UPDATED.deluge` | Full replacement body (A + D) |
| `createInstallmentInvoice_UPDATED.deluge` | Full replacement body (B) |
| `createPreNeedDepositRetainerInvoice_UPDATED.deluge` | Full replacement body (C) |
| `rollback/*_LIVE_2026-10-02.deluge` | Live bodies 2026-10-02 (identical to the ZP-TBD-81 / ZP-TBD-87 repo copies, whitespace aside) |
| `topup_patches.md` | Find/replace patches P1 (CRM payments), P2 + P3 (Books) for the top-up retainer |
| `guideline.md` | Apply order / test / rollback steps |
| `test-cases.md` | Test journeys J1-J5 (xlsx: `widgets\testCases\ZP-TBD-95_Test_Journeys.xlsx`). Older table versions (`..._Test_Cases.xlsx`, `_v2.xlsx`) are superseded |
