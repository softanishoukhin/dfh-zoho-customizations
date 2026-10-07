# ZP-TBD-104 - Pre-Need invoices ask for their own amount - test journeys

## Test data (set up first)

| What | Where | Enter / check |
|---|---|---|
| Pre-Need Deal | CRM > Contacts > a test Contact > Create Pre-Need Deal | Name starting 'DFH Test'. Any beneficiary. |
| Products | Deal > Product Selection | 2 or more products. Save, wait until Contract Value updates. |
| Payment Type | Deal > Payment Type | Installments. Save. Deposit, Installment 1 and Installment 2 invoices appear. |
| Payer email | The Deal's Contact > Email | An inbox you can open (your own test address). |
| What to compare | Invoice > its total, and the email / payment link | The amount asked for must be THAT invoice's own total, never the whole Contract Value. |

## Journey 1 - Email

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Deposit invoice > Potential Payers > open the payer | Click 'Send Invoice for Payment'. | The email asks for the Deposit invoice's own total (not the Contract Value). |  |
| 2 | The email in the test inbox | Click the payment link. | The payment page shows the Deposit invoice's own total. |  |
| 3 | Installment 1 invoice > Potential Payers > open the payer | Click 'Send Invoice for Payment'. | The email asks for Installment 1's own total. |  |

## Journey 2 - After a part payment

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Deposit invoice > Invoice Payers | Add a payer row for part of the deposit. Save. | Payment recorded. |  |
| 2 | Deposit invoice > Potential Payers > open the payer | Click 'Send Invoice for Payment' again. | The email asks only for what is still owed on the Deposit (its total minus the part paid). |  |

## Journey 3 - WhatsApp

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Pre-Need screen | Click WhatsApp on Installment 2. | The payment link in the message is for Installment 2's own total. |  |
| 2 | Deal > Send Links via WhatsApp | Open the button. | The payment link is for that invoice's own total (not the Contract Value). |  |

## Journey 4 - Reminder email

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Installment 1 invoice | Set Due Date to 7 days from today. Save. Wait for the reminder. | The reminder asks for Installment 1's own total. |  |
| 2 | Installment 1 invoice > Invoice Payers | Pay it in full, then set Due Date to 1 day from today. | No reminder is sent (nothing is owed on it). |  |

## Journey 5 - Must work as before

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | A normal funeral invoice (not Pre-Need) > Potential Payers | Click 'Send Invoice for Payment'. | Same amount as before (the invoice's balance). |  |
| 2 | A Pre-Need Lump Sum invoice > Potential Payers | Click 'Send Invoice for Payment'. | Same as before (the Lump Sum invoice's balance). |  |
