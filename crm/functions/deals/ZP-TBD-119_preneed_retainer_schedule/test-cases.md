# ZP-TBD-119 - Payment plan and next due date on the Books retainer - tests

## Test data (set up first)

| What | Where | Enter / check |
|---|---|---|
| Deal A - NEW Pre-Need Deal | CRM > Contacts > a test Contact > Create Pre-Need Deal | Name starting 'DFH Test'. Add products, Payment Type = Installments. |
| Deal B - NEW Pre-Need Deal | Same way | Payment Type = Lump Sum. |
| Where to look | Books > Sales > Retainer Invoices > the Deal's retainer | Check the Notes box at the bottom and the Reference# (also a column in the list). |

## Tests

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Deal A's retainer in Books | Wait a little over 1 hour after setting Payment Type, then open it. | Notes list Deposit, Installment 1, Installment 2 with amount, due date and NOT PAID, and a NEXT PAYMENT line for the Deposit. Reference# = 'Next due ... - Deposit'. |  |
| 2 | Deal A's retainer | Click PDF/Print. | The Notes block with the plan shows on the printed retainer. |  |
| 3 | Deal A > Deposit invoice | Pay the Deposit in full. Wait about 1 minute, reopen the retainer. | Deposit line says PAID. NEXT PAYMENT = Installment 1 with its amount and date. Reference# = 'Next due ... - Installment 1'. |  |
| 4 | Deal A > Installment 1 invoice | Pay half of Installment 1. | Installment 1 line says PART PAID with the amount still to pay. NEXT PAYMENT = the rest of Installment 1. |  |
| 5 | Deal A > Installments | Pay the rest of Installment 1 and all of Installment 2. | All lines PAID. Notes say ALL PAYMENTS RECEIVED. Reference# = 'Paid in full'. |  |
| 6 | Deal B's retainer | Wait 1 hour after setting Lump Sum, open it. | One line 'Full payment' with amount and NOT PAID. NEXT PAYMENT = the full amount. |  |
| 7 | Books > Retainer Invoices list | Search 'Next due'. | Open Pre-Need retainers are listed with their next due date in the Reference# column. |  |
