# ZP-TBD-116 -- Overdue task goes to the Deal owner (ticket 9 of PRENEED_DEV_LIST_2026-10-14)

Live rules read 2026-10-15. Do the steps in order.

## 1 -- new function
CRM > Setup > Developer Hub > Functions > + New Function
- Name `createOverdueTaskForDealOwner` (API name `createoverduetaskfordealowner`), category **Automation**
- Argument: `crmid` (Int)
- Body: `createOverdueTaskForDealOwner_NEW.deluge`. Save.

## 2 -- rule "Notify to Owner on Overdue" (Invoices)
CRM > Setup > Automation > Workflow Rules > Invoices > **Notify to Owner on Overdue** > Edit
- Leave the trigger (Due Date + 1 business day, 09:00) and the condition (Status is not Paid / Void) as they are.
- Instant Actions: **remove** the Task "${Invoices.Books Invoice Number} is Overdue".
- **+ Action > Function** > `createOverdueTaskForDealOwner`, argument `crmid` = **Invoices > Invoice Id**. Save.

## 3 -- rules "Installment Reminder - 3 Days Overdue" and "Installment Reminder - Every 10 Days Overdue"
Each of these also creates the same task for the Invoice owner. In EACH rule:
- **Remove** the Task "${Invoices.Books Invoice Number} is Overdue".
- **Keep** the email function (`sendInstallmentReminder3DaysOverdue` / `sendInstallmentReminderRepeatOverdue`).
- **+ Action > Function** > `createOverdueTaskForDealOwner`, `crmid` = **Invoices > Invoice Id**. Save.

The two old task actions are then unused (Setup > Automation > Actions > Tasks); they can be deleted or left.

## What changes
| Before | After |
|---|---|
| Task to the **Invoice** owner | Task to the **Deal** owner (Invoice owner only if the invoice has no Deal) |
| A new task on day +1, day +3 and every 10 days, even if the last one is still open | One open task per invoice; a new one only after the previous is marked Completed |
| Assignee email: on (task setting "notify") | Assignee email: on (`Send_Notification_Email` = true) |

Subject, Priority (High) and Status (Not Started) are unchanged. Due date = the day the task is created.
The task also says which Deal and which invoice it is about.

## Rollback
Remove the Function action and add the old Task action back in the three rules.

## Test
`widgets\testCases\ZP-TBD-116_Overdue_Task_Deal_Owner_Tests.xlsx`
