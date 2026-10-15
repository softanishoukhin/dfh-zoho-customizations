# ZP-TBD-119 -- Payment plan + next due date on the Books retainer

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-15 on live data. NOT applied, NOT tested.** Apply per `guideline.md`.

**Source:** `projectDocuments/PRENEED_DEV_LIST_2026-10-14.md`, tickets 6 (retainer does not show the payment
plan) and 7 (retainer has no due date).

## Live facts (2026-10-15, RET-K-2026-000174 "Dale testing")
- Books retainer API has **no `due_date` key at all** (not even null) -> a due date on the retainer is not possible.
- `notes`, `terms`, `reference_number` all empty. Template = "Standard Template" (prints Notes when filled).
- Rounding: Books total 750,100.00 (`roundoff_value` -0.06, `rounding_increment` 0.125) -- ticket 8.
- `reference_number` is used to recognise top-up retainers (`startsWith("Pre-Need top-up")` in
  setupPreNeedPaymentPlan) and by the Hillview retainer (invoice number) -> only written when empty or ours.
- Notes-only partial PUT on a retainer: same pattern as the email button (custom_fields-only PUT with
  `X-ZOHO-Execute-CustomFunction: false`), which works in production on paid retainers.

## Files
| File | Purpose |
|---|---|
| `writePreNeedScheduleToRetainer_NEW.deluge` | CRM standalone (Deal id), REST API key |
| `refreshPreNeedRetainerSchedule_NEW.deluge` | CRM automation (Invoice id), scheduled action 1 h after plan invoice create |
| `guideline.md` | Steps incl. Books hook lines, backfill, PDF check |
| `test-cases.md` | Same as the xlsx |
