# ZP-TBD-96 - test journeys

- Every journey starts with a NEW Pre-Need Deal: add products, set Payment Type = Installments.
- Email = the 'Send Invoice for Payment' button on the invoice's payer (Potential Payer). WhatsApp = the WhatsApp button on the Pre-Need screen.
- Check the invoice's Status in CRM after each step.

## Journey 1 - Email

| Step | Do this | You should see | Pass / Fail |
|---|---|---|---|
| 1 | Create the Deal and the plan. Email the Deposit invoice. | The family gets the email. Deposit invoice Status = Sent. |  |
| 2 | Pay the deposit in full. Then email Installment 1. | Installment 1 Status = Sent (before this fix it stayed Created). |  |
| 3 | Email Installment 1 again. | Still Sent. Nothing else changes. |  |
| 4 | Pay Installment 1 in full. Email it again. | Status stays Paid (Sent never replaces Paid). |  |

## Journey 2 - WhatsApp (after the screen calls markInvoiceSent)

| Step | Do this | You should see | Pass / Fail |
|---|---|---|---|
| 1 | Create the Deal and the plan. On the Pre-Need screen, click WhatsApp on Installment 2. | WhatsApp opens with the message. Installment 2 Status = Sent. |  |
| 2 | Click WhatsApp on an invoice that is already paid. | Status stays Paid. |  |

## Journey 3 - Things that must not change

| Step | Do this | You should see | Pass / Fail |
|---|---|---|---|
| 1 | A normal funeral (not Pre-Need) invoice: send it by email. | Behaves exactly as before. |  |
| 2 | Pre-Need Deal: use the Deal's 'Send Links via WhatsApp' button. | No invoice Status changes (this button sends Deal links, not one invoice). |  |
