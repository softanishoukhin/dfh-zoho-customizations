# ZP-TBD-116 -- Overdue task to the Deal owner

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-15 on live config. NOT applied, NOT tested.** Apply per `guideline.md`.

**Source:** `projectDocuments/PRENEED_DEV_LIST_2026-10-14.md`, ticket 9 ("Tell the funeral director when a payment
goes past due"): repoint the task to the Deal owner and confirm it reaches them.

## Live facts (2026-10-15)
- Rule "Notify to Owner on Overdue" (6503357000083554202, Dale, active, last ran 2026-10-14 09:01): Invoices,
  date trigger Due_Date + 1 business day at 09:00, condition Status not in (Paid, Void), one action: Task
  6503357000083554198 "${Invoices.Books Invoice Number} is Overdue" (High, Not Started, due +1 business day).
- The task action has no owner mapping -> it goes to the record (Invoice) owner. Its `notify` flag is **true**, so
  the assignee IS emailed -- just the wrong person.
- The same kind of task (6503357000083609245, due +0 days) is also an action on "Installment Reminder - 3 Days
  Overdue" (6503357000083609196) and "Installment Reminder - Every 10 Days Overdue" (6503357000083609215) -> same
  Invoice-owner problem, and a new task on every run.
- Workflow Task actions cannot be assigned to a related record's owner -> function.
- Tasks module has `Send_Notification_Email` (boolean); set true on create so the Deal owner gets the email.

## Files
| File | Purpose |
|---|---|
| `createOverdueTaskForDealOwner_NEW.deluge` | Automation function, arg `crmid` (Invoice Id) |
| `guideline.md` | Apply steps for the 3 rules |
| `test-cases.md` | Same as the xlsx |
