# ZP-TBD-126 -- At-need payments off 823 PRE NEED

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-22, NOT applied.** Steps 1-4 ready (account, one-payment test, CRM patch, Books safety net).
Part B (212 old payments) ON HOLD -- impacted-payments CSV not provided by Andrea.

**Source:** `projectDocuments/DEV_DOC_PRENEED_CUSTOMER_ADVANCES_FIX_2026-10-21.md` (client / CC-written, approach
approved by Andrea); our review `projectDocuments/REVIEW_PRENEED_ADVANCES_AND_DEPOSIT_SYNC_2026-10-22.md`.

## Live facts (2026-10-22, read-only)
| Payment | Created from | Advance account |
|---|---|---|
| PAY-K-2026-001853 (Dale testing, retainer) | Books | PRE NEED |
| PAY-K-2026-000706 (Dean Hasting, at-need) | **CRM** (createPaymentsOnBooks) | **PRE NEED** |
| PAY-MB-2026-003148 / -003169 (Sonia Plummer, at-need) | cashier in Books | Accounts Receivable |
| PAY-MB-2026-003191 (Bradley Davidson, refunded) | cashier in Books | CONTRA ACCOUNT |
- Account ids: PRE NEED `5830143000000594557`, Accounts Receivable `5830143000000000364`, CONTRA ACCOUNT
  `5830143000000594545`.
- `createPaymentsOnBooks` (live): sets `account_id` only; caps `amount_applied` at the invoice balance, so an
  overpayment stays unused on the payment.
- `generatewalkininvoicefromfygaro` (live): payment amount = invoice total, fully applied -> never unused.
- Books `updatepaymentaccountonpaymentmodeedit` (rule "Update Account On Payment Mode Update"): re-sets `account_id`
  only.
- Every Books payment edit runs `allprocessonpaymentcreateandupdate` (Xero overpayment webhook, contract check,
  paid-to-date) -> all edits here use `X-ZOHO-Execute-CustomFunction: false`.

## Files
| File | Where it lives |
|---|---|
| `setPaymentAdvanceAccount_NEW.deluge` | CRM standalone, run by hand (Step 2 test, Part B, undo) |
| `moveAtNeedAdvanceOffPreNeed_NEW.deluge` | Books custom function, Customer Payments, rule On Create |
| `guideline.md` | Steps 1-5 + Part B (on hold) |
| `test-cases.md` | Same as the xlsx |
