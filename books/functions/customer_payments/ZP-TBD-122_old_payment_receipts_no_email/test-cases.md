# ZP-TBD-122 - Receipts for older payments, nothing emailed - tests

## Test data (set up first)

| What | Where | Enter / check |
|---|---|---|
| An old TEST Pre-Need payment | Books > Payments Received | A payment on a test retainer (RET-...), dated before 1 Oct, with Download Payment Receipt empty. Payer email = your own test inbox. |
| A new test payment | Books > Payments Received | Any test payment from after 1 Oct (already has a receipt). |
| Inboxes to watch | The test payer's inbox + the Deal's emails in CRM | Nothing may arrive during these tests. |

## Tests

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Old test payment | Click the receipt button (do NOT click Edit). | 'Reciept Generated Successfully.' Download Payment Receipt now has a link. |  |
| 2 | The link | Open it. | The receipt PDF shows the right number, amount, date, payment mode and payer. |  |
| 3 | Test payer inbox + CRM Deal > Emails | Wait 5 minutes and check. | NO receipt email and NO contract email arrived. |  |
| 4 | Books > the payment > History | Look at the latest entries. | Only the receipt link change; amount and date unchanged. |  |
| 5 | CRM > the Deal > Pre-Need screen > Invoices list | Click Receipt WhatsApp on that invoice. | The receipt link is found and the WhatsApp panel opens (it said 'no receipt yet' before). |  |
| 6 | New test payment | Click the receipt button. | Works as before: link regenerated, nothing emailed. |  |
