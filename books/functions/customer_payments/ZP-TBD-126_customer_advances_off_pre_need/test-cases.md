# ZP-TBD-126 - Funeral payments off PRE NEED - tests

## Test data (set up first)

| What | Where | Enter / check |
|---|---|---|
| Customer Advances account | Books > Chart of Accounts | Created in Step 1 (code 824). Its id is in both functions. |
| A test funeral Deal | CRM > Deals | Name starting 'DFH Test', with an unpaid invoice already in Books. |
| A test Pre-Need Deal | CRM > Deals | Name starting 'DFH Test', plan invoices created, Deposit unpaid. |
| Where to look | Books > the payment > 'Customer advance account' / More > View Journal | Check after every step. Also Xero: the payment appears once only. |

## Tests

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | CRM > test funeral invoice > Invoice Payers | Record a payment 1,000 MORE than the invoice balance. | Books payment: advance account = Customer Advances. The 1,000 left over sits in Customer Advances, not PRE NEED. |  |
| 2 | CRM > test Pre-Need Deposit invoice > Invoice Payers | Record the Deposit payment. | Books payment is on the retainer and its advance account stays PRE NEED. |  |
| 3 | Books > Payments Received > New (cashier) | Test funeral customer, no invoice, advance account PRE NEED, no description. Save. | Within a minute the advance account changes to Customer Advances. |  |
| 4 | Books > Payments Received > New (cashier) | Same, but description 'pre-need payment'. Save. | Advance account stays PRE NEED. |  |
| 5 | Books > Payments Received > New (cashier) | Same, but advance account CONTRA ACCOUNT. Save. | Stays CONTRA ACCOUNT (not touched). |  |
| 6 | Xero | Look up each test payment. | Each appears once; no extra overpayment was created. |  |
| 7 | Clean up | Delete or refund the test payments as you normally would. | Test data removed. |  |
