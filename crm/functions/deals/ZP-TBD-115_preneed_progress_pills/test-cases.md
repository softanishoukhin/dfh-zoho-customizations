# ZP-TBD-115 - Pre-Need progress pills - test journeys

## Test data (set up first)

| What | Where | Enter / check |
|---|---|---|
| Two NEW Pre-Need Deals | CRM > Contacts > a test Contact > Create Pre-Need Deal (twice) | Names starting 'DFH Test'. Deal A = Installments, Deal B = Lump Sum. |
| Products | Each Deal > Product Selection | 2 or more products. Save, wait until Contract Value updates. |
| Payer email | Each Deal's Contact > Email | An inbox you can open (your own test address). |
| Where to look | The Pre-Need canvas screen of the Deal | After EVERY step check the pill COLOUR on the screen, not just the field. |
| Before you start | Both Deals' canvas screen | Payment Plan Set Up, Invoice(s) Sent and Contract Status pills are grey / empty. |

## Journey 1 - Deal A (Installments)

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Deal A | Set Payment Type = Installments. Save. Wait a minute, refresh the screen. | Payment Plan Set Up pill turns green. Invoice(s) Sent and Contract Status still grey. |  |
| 2 | Deal A > Deposit invoice > Potential Payers > open the payer | Click 'Send Invoice for Payment'. | Deposit invoice Status = Sent. Invoice(s) Sent pill turns green. |  |
| 3 | Deal A > Installment 1 invoice > Potential Payers > open the payer | Click 'Send Invoice for Payment'. | Invoice(s) Sent stays green (nothing else changes). |  |
| 4 | Deal A | Click 'Send Pre Need Funeral Contract'. | Contract Status pill shows Sent. |  |
| 5 | The contract email in the test inbox | Sign the contract. | Contract Status pill shows Signed. |  |
| 6 | Deal A | Click 'Send Pre Need Funeral Contract' again. | Contract Status stays Signed (never goes back to Sent). |  |

## Journey 2 - Deal B (Lump Sum)

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Deal B | Set Payment Type = Lump Sum. Save. Wait a minute, refresh the screen. | Payment Plan Set Up pill turns green. |  |
| 2 | Deal B > the Lump Sum invoice > Potential Payers > open the payer | Click 'Send Invoice for Payment'. | Invoice(s) Sent pill turns green. |  |

## Journey 3 - WhatsApp (a third new Installments Deal)

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | New Deal C | Create it, add products, set Payment Type = Installments. | Payment Plan Set Up green, Invoice(s) Sent grey. |  |
| 2 | Deal C > Pre-Need screen > Invoices list | Click WhatsApp on the Deposit invoice, then click 'Open WhatsApp' in the panel. | Invoice(s) Sent pill turns green (refresh the screen). It does NOT change on the first WhatsApp click alone. |  |
| 3 | Deal C > Send Links via WhatsApp | Click 'Add contract link'. | Contract Status pill shows Sent. |  |

## Journey 4 - Must not change

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | A normal funeral Deal (not Pre-Need) | Create an invoice for it the usual way. | Nothing changes on that Deal (no Pre-Need pills). |  |
| 2 | A normal funeral invoice > Potential Payers | Click 'Send Invoice for Payment'. | Works exactly as before. |  |
