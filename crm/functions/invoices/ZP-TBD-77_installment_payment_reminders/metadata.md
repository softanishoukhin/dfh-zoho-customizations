# ZP-TBD-77 -- Installment payment reminders

Source: Andrea's requirement pasted 2026-09-24 (no task doc file). Built for **Pre-Need installment
invoices** (`Invoice_For` = Installment 1/2/3). **Status: applied to live CRM 2026-09-24 (per user); live testing in progress, not yet confirmed working.** The repo copy of `sendInstallmentReminder.deluge` keeps the 3 template IDs as `0` -- the real IDs are set only in the live function.

## Requirement

Per installment: reminder/invoice 7 days before due; another 1 day before; if still unpaid, an overdue
reminder 3 days after due; then every 10 days while unpaid.

## Decisions (confirmed with user 2026-09-24)

| Decision | Choice |
|---|---|
| Scope | Pre-Need installments only |
| Channel | Email only (no WhatsApp) |
| Payment link (added 2026-09-24) | Fygaro pay buttons need `custom_reference` = Potential Payer id, so templates are **Potential_Payers-module** clones of "Invoice Notification" (`6503357000019017359`) and the mail is sent from the payer record; function looks up invoice Contact -> Potential Payer (Contact + Invoice) |
| 7-day step | Send the **existing** invoice (created when Due_Date is written, ZP-TBD-75) -- does not create it |
| Function structure (added 2026-09-24) | 1 standalone + 4 thin workflow wrappers (same pattern as `sendinvoiceemailtonok` -> `standalone.sendEmail`); rules pass only `crmid` |
| Repeat every 10 days (added 2026-09-24) | Zoho date-based rules cannot recur (Recur = Once / Every Month / Every Year only, seen in UI). New DateTime field `Invoices.Next_Overdue_Reminder_At`; function sets it +10 days after each overdue reminder; rule D fires on that field; chain ends when Paid |
| Mechanism | Date-based workflow rules on the **Invoices** module keyed on `Due_Date`, criteria Status is not Paid (user's design) |

## What this touches

| Item | Change |
|---|---|
| `standalone.sendInstallmentReminder(crmid, stage)` | New standalone function holding all the logic (guards, contact -> Potential Payer, amount refresh, send, re-arm `Next_Overdue_Reminder_At`). Template IDs configured in its top block. |
| 4 wrappers `automation.sendInstallmentReminder7DaysBefore / 1DayBefore / 3DaysOverdue / RepeatOverdue` | New workflow functions (Invoices), one per rule, each just `standalone.sendInstallmentReminder(crmid, "<stage>")`. Needed because a workflow can't reuse one function with different parameters (stated by user 2026-09-24). |
| Invoices field | +1: `Next_Overdue_Reminder_At` (Date/Time) |
| Email templates | +3 Potential_Payers-module clones (7-day, 1-day, overdue). |
| Workflow rules (Invoices) | +4 date-based rules. Existing `Notify to Owner on Overdue` (owner task, Due_Date +1 b-day, created 2026-09-23 by Dale) left untouched. |
| `standalone.sendEmail` | Reused as-is, called with module `Potential_Payers` (no Invoice PDF attached -- that only happens for module `Invoices`). |
| `standalone.refreshInvoiceAmountsForPotentialPayer` (ZP-TBD-72, live) | Called before each send so `Amount_in_JMD/USD` on the Invoice are today's Books balance. |
| `standalone.COQLQuery` | Reused for the Contact + Invoice -> Potential Payer lookup. |

Additional exclusions beyond Paid: `Void`, `Cancelled` (both exist in the Invoices Status picklist:
Paid, Partially Paid, Sent, Overdue, Void, Draft, Ready, Approved, Cancelled, Created, Delivered).
`Partially Paid` still gets reminders.

## Sources checked

`ZohoCRM_getWorkflowConfigurations` (Invoices -- date_or_datetime supports functions + email actions),
`ZohoCRM_getWorkflowRules` (Invoices date-based rules), `getWorkflowRuleById` for `Notify to Owner on Overdue`
and `Trigger Invoice Email to NOK`, `getFunctionCode` for `sendinvoiceemailtonok` and `sendemail`,
`getFields` (Invoices Status / Invoice_For picklists).

## Open

- Whether `zoho.crm.updateRecord` alone re-schedules the date-based rule on `Next_Overdue_Reminder_At` (test 21).
- Existing overdue invoices at go-live need a manual/backfill seed of `Next_Overdue_Reminder_At`.
- Whether a Schedule/catch-up job for installment reminders already exists (Schedules are invisible to the
  MCP tools) -- ask before applying.
