# ZP-TBD-81 -- Pre-Need payment setup: Lump Sum vs Installments

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-09-29, not applied, not tested.** Apply per `guideline.md`.

## Request (Andrea, 2026-09-29)

New Payment Type (Lump Sum / Installments). Contract period max 6 months: Must End By = Contract Signing Date +
6 months. Lump Sum -> full amount, one invoice, due within 7 days. Installments -> first invoice 50%, the rest in
installments every 2 months, due at the end of the applicable month; amounts prefilled and invoices generated
automatically. Reuse the logic behind the existing Calculate Installment Amount button, triggered from Payment Type.

## Decisions (developer, 2026-09-29)

| Question | Decision |
|---|---|
| New Payment Type field? | **No** -- `Deals.Payment_Type` already exists (`Pay in Full` / `Installments`) and the dispatcher + button already branch on `Installments`. `Pay in Full` is renamed to `Lump Sum`. |
| Split of the remaining 50% | **2 x 25%**, end of (signing month + 2) and end of (signing month + 4). A 3rd payment at the end of month + 6 would always fall after Must End By. Matches the earlier 50/25/25 Nastassia contract. |
| Contract Signing Date | New Date field, defaults to today when blank; editing it rebuilds the plan. The contract is pre-filled with the schedule when it's **sent**, so the date has to exist before signing (Zoho Sign completion would be too late). |
| 50% invoice due | Within 7 days (same as Lump Sum). |
| Old ZP-TBD-75 inputs | `Installment_Commencement_Date` / `Installment_Day_of_Month` no longer read -- hide, don't delete yet. |

## Live facts found (2026-09-29)

- Live `button.calculateInstallmentAmount` differs from the ZP-TBD-75 repo copy: it no longer passes
  `{"trigger":{"workflow"}}`; it calls the three `createinvoice...installment` endpoints directly at the end.
- `createInvoiceIfPaymentTypeIsPaymentInFull` (live) has no `Payment_Type` check. Its only trigger is condition 6 of
  Deals rule "Action on Changing Different Deal Stage Action 3" (Stage = Contract Signed AND Pipeline = Pre Need AND
  Payment Type = Pay in Full) -- found via the June export's `associated_place`, confirmed live. That condition is the
  only use of the literal "Pay in Full" in CRM (full check: see guideline "What uses Pay in Full").
- `standalone.updateSalesOrderAndInvoiceBasicInfo` (every Deal edit, and Potential Payer changes) resets a Pre Need
  `Other` invoice's Due Date to today + 1 year -> guideline Step 4c.
- `createPreNeedDepositRetainerInvoice` is triggered by the dispatcher on a `Pre_Need_Balance_Due_Date` edit
  (Pre Need pipeline only); idempotent on `Subject like 'Deposit Invoice%'`.
- `createInstallmentInvoice` (standalone, `createinstallments`) already skips blank slots (ZP-TBD-75) and
  updates instead of duplicating per `Invoice_For`.
- `sendPreNeedFuneralContract` pre-fills Deposit / Installment 1 / Balance date from the Deal -> no change needed.
- Literal `"Pay in Full"` not found in any live or local code in the payment chain (see guideline Step 2).
- Deals custom fields: 321.

## Open / to confirm

1. (Resolved 2026-09-29) old Pay-in-Full trigger found -- rule condition 6, deleted in Step 0.
2. After the picklist rename, re-read `Payment_Type` metadata to confirm the API value is `Lump Sum`.
3. Andrea: confirm 2 x 25% is what she meant by "every 2 months" (the alternative 3-payment reading can't fit
   inside 6 months with month-end due dates).
