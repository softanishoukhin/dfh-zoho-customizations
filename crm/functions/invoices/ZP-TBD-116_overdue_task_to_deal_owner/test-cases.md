# ZP-TBD-116 - Overdue task goes to the Deal owner - tests

## Test data (set up first)

| What | Where | Enter / check |
|---|---|---|
| A Pre-Need test Deal | CRM > Deals | Name starting 'DFH Test', with its plan invoices created and NOT paid. |
| Deal owner | That Deal > Deal Owner | Change it to a colleague / test user whose inbox you can check - NOT the invoice owner. |
| Invoice to use | That Deal > Invoices > the Deposit invoice | Copy its record id from the browser address bar (the long number at the end). |
| How to run the function | Setup > Developer Hub > Functions > createOverdueTaskForDealOwner > Edit > Save & Execute | Enter crmid = the invoice record id. This is the same thing the overdue rule does at 09:00. |

## Tests

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Function editor | Run the function with the Deposit invoice id. | Log ends with 'overdue task for invoice ... to user ...'. |  |
| 2 | Deposit invoice > Open Activities | Open the new task. | Subject '<invoice number> is Overdue', Owner = the DEAL owner, Priority High, due today, description names the Deal. |  |
| 3 | Deal owner's inbox | Check the email. | A 'task assigned' email for this task has arrived. |  |
| 4 | Function editor | Run it again with the same invoice id. | Log says 'already has an open overdue task'. No second task on the invoice. |  |
| 5 | The task | Mark it Completed. Then run the function again. | A new overdue task is created (to the Deal owner). |  |
| 6 | A PAID invoice | Run the function with a paid invoice's id. | Log says 'is Paid - no task'. No task created. |  |
| 7 | Real rule (next morning) | Set an unpaid test invoice's Due Date to today. Wait until the next business day after 09:00. | An overdue task for that invoice appears, owned by the Deal owner. No task for the Invoice owner. |  |
