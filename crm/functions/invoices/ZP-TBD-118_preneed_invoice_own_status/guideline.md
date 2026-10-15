# ZP-TBD-118 -- Each Pre-Need plan invoice carries its own status (ticket 5 of PRENEED_DEV_LIST_2026-10-14)

Live code pulled 2026-10-15 (Books allprocessonpaymentcreateandupdate = repo ZP-TBD-110 copy). Do the steps in order.

## 1 -- new CRM function
CRM > Setup > Developer Hub > Functions > + New Function
- Name `updatePreNeedPlanInvoiceStatuses` (API name `updatepreneedplaninvoicestatuses`), category **Standalone**
- Argument: `crmid` (String) -- the Deal id
- Body: `updatePreNeedPlanInvoiceStatuses_NEW.deluge`. Save.
- Function menu (...) > **REST API** > switch on **API Key**. Save.

## 2 -- Books: `allprocessonpaymentcreateandupdate` (payment hook, runs after every payment)
Books > Settings > Automation > Custom Functions > allprocessonpaymentcreateandupdate > Edit.

FIND (near the end, inside `for each dealIdToCheck in contractDealIds`):
```
	for each  dealIdToCheck in contractDealIds
	{
```
REPLACE WITH:
```
	for each  dealIdToCheck in contractDealIds
	{
		// ZP-TBD-118: each Pre-Need plan invoice (Deposit / Installment) gets its own status from its own payments
		statusResult = invokeurl
		[
			url :"https://www.zohoapis.com/crm/v7/functions/updatepreneedplaninvoicestatuses/actions/execute?auth_type=apikey&zapikey=ZAPIKEY&crmid=" + dealIdToCheck
			type :GET
		];
		info "ZP-TBD-118 invoice statuses for Deal " + dealIdToCheck + ": " + statusResult;
```
Replace `ZAPIKEY` with the key already in the `autosendpreneedcontract` URL a few lines below (same CRM org key --
copy the part between `zapikey=` and `&crmid`). Save.

## 3 -- Books: `syncretainerinvoicestatusbetweencrmandxero` (retainer status -> CRM)
Books > Settings > Automation > Custom Functions > syncretainerinvoicestatusbetweencrmandxero > Edit.

FIND (once, near the end):
```
		crmUpdateResult = zoho.crm.updateRecord("Invoices",customField.get("value"),crmInvoiceMap);
		break;
```
REPLACE WITH:
```
		// ZP-TBD-118: a Pre-Need plan invoice (Deposit / Installment) shares this retainer with the rest of the plan,
		// so the retainer's status is not its own -- CRM updatePreNeedPlanInvoiceStatuses sets it from its own
		// payments. Only Void is still copied. Every other invoice (incl. the Lump Sum one) is copied as before.
		planCrmInvoice = zoho.crm.getRecordById("Invoices",customField.get("value").toLong());
		planInvoiceFor = ifnull(planCrmInvoice.get("Invoice_For"),"").toString();
		if((planInvoiceFor == "Deposit" || planInvoiceFor.startsWith("Installment")) && invoiceData.get("status") != "void")
		{
			info "ZP-TBD-118: " + planInvoiceFor + " " + customField.get("value") + " keeps its own status (retainer is " + invoiceData.get("status") + ")";
			break;
		}
		crmUpdateResult = zoho.crm.updateRecord("Invoices",customField.get("value"),crmInvoiceMap);
		break;
```
Save.

## 4 -- put existing Deals right (one-off)
CRM > Invoices list > filter **Invoice For = Deposit** and **Status = Partially Paid**. For each Deal in that list:
Setup > Functions > updatePreNeedPlanInvoiceStatuses > Edit > **Save & Execute** with `crmid` = the Deal id.
The log says what changed (e.g. `Deposit: Partially Paid -> Paid`). Andrea's "Dale testing" Deal is one of them.

## Rules the function follows
| Paid on the invoice (its payer rows) | Status |
|---|---|
| its own amount, to within 1 cent | **Paid** |
| something, less than its amount | **Partially Paid** |
| nothing | unchanged (Created / Sent / Overdue); a Paid / Partially Paid left by a deleted payment goes back to Sent |

Own amount = Sub Total + Adjustment. Void, Cancelled and Draft invoices are never touched. Only Deposit / Installment
invoices on a retainer; the Lump Sum invoice and ordinary funeral invoices keep the Books status as today.

## Rollback
Step 3: put the FIND text back. Step 2: delete the inserted lines. The CRM function can stay (unused).

## Test
`widgets\testCases\ZP-TBD-118_PreNeed_Invoice_Own_Status_Tests.xlsx`
