# ZP-TBD-122 -- Receipts for payments made before 1 October, with nothing emailed (PN-07)

Andrea's answer (PRENEED_DEV_LIST_2026-10-14, PN-07): yes, create the missing receipts -- **but only if nothing is
emailed to anyone.** Checked 2026-10-15 against the live/repo Books receipt functions.

## Why a change is needed first
- Since ZP-TBD-92 (1 Oct) every new payment gets its receipt link (`Download Payment Receipt`). Older retainer
  payments (Pre-Need deposits / instalments) have none -> the Pre-Need screen's Receipt button says "no receipt yet".
- The receipt functions themselves send **no** email (the email block in `loadreceiptlink` is commented out; the
  button function has none).
- BUT both save the link with a normal Books update. Books treats that as a **payment edit**, which runs
  `allprocessonpaymentcreateandupdate` (rule "paymentWorkflowTriggerOnAnyCreateOrUpdate"). That hook calls
  `autosendpreneedcontract` and **can email the family a Pre-Need contract**, plus the Xero overpayment check etc.
- So "Edit > Save" on an old payment (the ZP-TBD-92 regenerate tip) and today's receipt button are NOT safe for the
  backfill. Do not use Edit > Save for this.

## 1 -- receipt button: save the link without running payment automations
Books > Settings > Customization > Custom Buttons > the Customer Payment **receipt** button > Edit its function.

FIND (near the end, once):
```
updatePayment = zoho.books.updateRecord("customerpayments",organizationID,paymentID,paymentRecordMap,"zohobooksconnection");
```
REPLACE WITH:
```
// ZP-TBD-122 (PN-07): save the receipt link WITHOUT running Books payment automations. A normal save counts as a
// payment edit and runs allprocessonpaymentcreateandupdate, which can email the family a Pre-Need contract.
// Making a receipt must never send anything to anyone.
receiptHeaderMap = Map();
receiptHeaderMap.put("X-ZOHO-Execute-CustomFunction","false");
updatePayment = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/customerpayments/" + paymentID + "?organization_id=" + organizationID
	type :PUT
	parameters:paymentRecordMap.toString()
	headers:receiptHeaderMap
	connection:"zohobooksconnection"
];
```
Save. Everything else in the button stays the same (Writer merge, WorkDrive upload, "Reciept Generated Successfully.").

## 2 -- create the missing receipts
Books > Sales > **Payments Received** > filter: **Download Payment Receipt is empty** and **Date before 01 Oct 2026**
(add the column / custom view if needed). Pre-Need payments are the ones on a retainer (RET-...).
For each one: open it > click the **receipt button** > "Reciept Generated Successfully." > `Download Payment Receipt`
now has the WorkDrive link. Do NOT click Edit / Save.

## What does NOT happen
- No receipt email to the payer, no contract email, no CRM email -- the button sends nothing, and the link is saved
  without running any Books payment automation.
- Amounts, dates and Xero are not touched.

## Rollback
Put the FIND line back in the button function.

## Test
`widgets\testCases\ZP-TBD-122_Old_Payment_Receipts_Tests.xlsx`
