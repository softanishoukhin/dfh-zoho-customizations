# ZP-TBD-120 -- Daily Pre-Need payment status job

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: DEPLOYED + tested 2026-10-15** (user confirmed).

**Source:** `projectDocuments/PRENEED_DEV_LIST_2026-10-14.md`, ticket 4: a Scheduled Function once a day that applies
the `wfUpdatePreNeedPaymentStatus` calculation; Andrea asked that it CALL the same function, not copy it.

## Live facts (2026-10-15)
- `wfUpdatePreNeedPaymentStatus(Int invoiceid)` (Dale, Automation, modified 2026-10-14): invoice -> Deal (v8 GET),
  Pipeline must be "Pre Need"; states Paid in full / Past due (Pre_Need_Balance_Due_Date < today, not paid in full) /
  Payments in progress / No payment; writes Payment_Status only when it changes, `{"trigger":{}}`.
  REST API mode was **None** -> step 1 switches on OAuth.
- Automation functions are called from other code through `/crm/v7/functions/<api>/actions/execute?auth_type=oauth`
  with the `zohooauth` connection (same as setupPreNeedPaymentPlan -> createPreNeedDepositRetainerInvoice).
- Deals selected by `Type = 'Pre Need'` (reliable in COQL; the status function itself re-checks Pipeline).
- Also calls ZP-TBD-119 `writePreNeedScheduleToRetainer` so the retainer's OVERDUE marks refresh daily.

## Files
| File | Purpose |
|---|---|
| `dailyPreNeedPaymentStatus_NEW.deluge` | CRM Schedule function, daily 06:00 |
| `guideline.md` | Steps |
| `test-cases.md` | Same as the xlsx |
