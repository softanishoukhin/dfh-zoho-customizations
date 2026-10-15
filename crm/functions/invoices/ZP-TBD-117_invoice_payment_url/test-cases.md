# ZP-TBD-117 - Payment link saved on the invoice - tests

## Test data (set up first)

| What | Where | Enter / check |
|---|---|---|
| A NEW Pre-Need test Deal (JMD) | CRM > Contacts > a test Contact > Create Pre-Need Deal | Name starting 'DFH Test'. Add products, Payment Type = Installments. Wait until the invoices reach Books. |
| A USD test Deal | Any test Deal with 'Currency Used for this Deal' = USD and an unpaid invoice | Only for step 5. Skip if you have none. |
| Where to look | The invoice record > Payment URL field | Check after every step. Open the link to see the amount Fygaro shows. |

## Tests

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Deposit invoice | Open it before sending anything. | Payment URL is empty. |  |
| 2 | Deal > Pre-Need screen > Invoices list | Click WhatsApp on the Deposit invoice (the panel opening is enough). | Deposit invoice: Payment URL is filled. It matches the link shown in the WhatsApp panel. |  |
| 3 | The Payment URL | Click it. | Fygaro JMD page opens with the Deposit amount due. |  |
| 4 | Installment 1 invoice > Potential Payers > open the payer | Click 'Send Invoice for Payment'. | Installment 1 invoice: Payment URL is filled with its own amount (not the Deposit amount). |  |
| 5 | USD Deal > an unpaid invoice | Click 'Generate Payment Link' on the invoice and pick a payer. | Payment URL is the USD Fygaro link with the USD amount. |  |
| 6 | Deposit invoice | Record a part payment, wait for it to sync, then click WhatsApp again. | Payment URL now shows the smaller remaining amount. |  |
| 7 | A normal funeral invoice > Potential Payers | Click 'Send Invoice for Payment'. | Email goes out as before. Payment URL is filled with the balance due. |  |
