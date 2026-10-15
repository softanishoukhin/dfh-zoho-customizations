# ZP-TBD-118 - Each Pre-Need invoice shows its own status - tests

## Test data (set up first)

| What | Where | Enter / check |
|---|---|---|
| Deal A - NEW Pre-Need Deal | CRM > Contacts > a test Contact > Create Pre-Need Deal | Name starting 'DFH Test'. Add products, Payment Type = Installments. Wait until the 3 invoices reach Books. |
| Deal B - NEW Pre-Need Deal | Same as Deal A | Used for the payment entered directly in Books. |
| Where to look | Deal > Pre-Need screen > Invoices list (and each invoice's Status field) | After each payment wait about 1 minute, then refresh. |

## Tests

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Deal A > Deposit invoice | Record the FULL Deposit payment the usual way (payer row on the invoice). | Deposit = Paid. Installment 1 and 2 unchanged. |  |
| 2 | Deal A > Installment 1 invoice | Record HALF of the Installment 1 amount. | Installment 1 = Partially Paid. Deposit stays Paid. |  |
| 3 | Deal A > Installment 1 invoice | Record the rest of Installment 1. | Installment 1 = Paid. Installment 2 unchanged. |  |
| 4 | Deal B > Books > its retainer | Record the full Deposit amount as a payment directly in Books. | Deal B's Deposit invoice in CRM = Paid (not Partially Paid). |  |
| 5 | Andrea's 'Dale testing' Deal | Run updatePreNeedPlanInvoiceStatuses by hand with that Deal's id (guideline step 4). | Its Deposit changes from Partially Paid to Paid. Installment invoices unchanged. |  |
| 6 | A Lump Sum Pre-Need Deal | Pay the Lump Sum invoice in full. | Invoice = Paid (works as before). |  |
| 7 | A normal funeral invoice | Record a part payment. | Status shows Partially Paid as before. |  |
