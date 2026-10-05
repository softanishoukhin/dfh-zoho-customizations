# ZP-TBD-95 - test journeys

- Button = 'Calculate Installment Amount' on the Deal. After changing products, wait until Contract Value updates, then press it.
- Pay = add a payer row on the invoice in CRM, the normal way.
- Every journey starts with a NEW Pre-Need Deal: add products, set Payment Type = Installments.
- Journey 3 needs the payment patches applied as well.

## Journey 1 - Nothing paid

| Step | Do this | You should see | Pass / Fail |
|---|---|---|---|
| 1 | Create the Deal and the plan. | Deposit, Installment 1 and Installment 2 are created. One retainer in Books. |  |
| 2 | Add a product. Press the button. | The same 3 invoices are updated to the new Contract Value. No new invoices. The Books retainer matches the new Contract Value. |  |
| 3 | Remove a product. Press the button. | Same as above, with the lower Contract Value. |  |

## Journey 2 - Deposit paid, price goes up

| Step | Do this | You should see | Pass / Fail |
|---|---|---|---|
| 1 | Create the Deal and the plan. Pay the deposit in full. | Deposit shows as paid. |  |
| 2 | Add a product. Press the button. | Deposit does not change. Installment 1 and 2 are updated (equal amounts). In Books a second retainer appears: 'Pre-Need top-up of ...' for the increase. Installment 2 is linked to the top-up. |  |
| 3 | Add another product. Press the button. | The same top-up gets bigger. No second top-up. |  |
| 4 | Remove the products you added. Press the button. | The top-up is voided. Installment 2 is linked back to the first retainer. |  |

## Journey 3 - Pay off a Deal that has a top-up

| Step | Do this | You should see | Pass / Fail |
|---|---|---|---|
| 1 | Create the Deal and the plan. Pay the deposit. Add a product. Press the button. | A top-up retainer appears (as in Journey 2). |  |
| 2 | Pay Installment 1 in full. | One payment in Books. 'Amount Paid To Date' on the Deal goes up by that payment. |  |
| 3 | Pay Installment 2 in full. | Books shows two payments for it (part on the top-up, part on the first retainer). Installment 2 shows two payer rows. 'Amount Paid To Date' = Contract Value. Full contract is sent once. Note how many receipts were sent. |  |
| 4 | Add a product. Press the button. | Message: nothing was changed, both retainers have payments. A Note is added on the Deal. |  |

## Journey 4 - The button must change nothing

| Step | Do this | You should see | Pass / Fail |
|---|---|---|---|
| 1 | Create the Deal and the plan. Pay part of the deposit. Remove a product. Press the button. | Message: nothing was changed, Accounts needs to handle it (credit note). A Note is added on the Deal. |  |
| 2 | Remove one product and add a more expensive one. Press the button. | Same message. Nothing changed. |  |
| 3 | New Deal and plan. Record a payment directly in Books (not from CRM). Press the button. | Message: Books shows a payment the CRM invoices don't account for. A Note is added. Nothing changed. |  |

## Journey 5 - The person dies: At-Need (optional)

| Step | Do this | You should see | Pass / Fail |
|---|---|---|---|
| 1 | NOKIntake > First Call. Deceased Name = exactly the name on the Journey 3 Deal (add the DOB if it has one). Submit. | The Pre-Need popup shows that person. Click Confirm. A new First Call Deal is created on the SAME Account as the Pre-Need, with Pre-Need Status = Matched. |  |
| 2 | On the new First Call Deal, click 'Get Pre Need Info'. | The Deal turns into the funeral type. The Pre-Need products appear at 0 (prepaid). 'Amount Paid To Date' = what was paid on BOTH retainers (first + top-up). |  |
| 3 | Read the Note 'Pre-Need info pulled' on the Deal. | 'Amount paid to date' counts both retainers. The liability release line shows that same amount. |  |
| 4 | If the Pre-Need was not fully paid: wait 2-3 minutes and open the Deal's invoice. | One invoice with the prepaid products at 0 and one 'Pre-Need Balance' line = only what is still owed. |  |
| 5 | In Books, open the first retainer and the top-up retainer. | Both have the comment 'USED FOR AT-NEED DEAL ... do NOT apply this retainer to any invoice'. Do NOT apply either retainer. |  |
