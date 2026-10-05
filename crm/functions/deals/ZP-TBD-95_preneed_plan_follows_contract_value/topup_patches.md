# ZP-TBD-95 -- top-up retainer: patches to the payment path

The top-up retainer (created by `setupPreNeedPaymentPlan`) means a Pre-Need Deal can now have **two** Books
retainers: the master and one "Pre-Need top-up". These three functions assumed one. Each patch is a
**find / replace** on the live body (pulled 2026-10-02). Indentation is tabs, as in the editor.

**Rollback** for every patch: put the FIND text back in place of the REPLACE text.

---

## P1 -- `createPaymentsOnBooksForRetainerInvoice` (CRM, `automation.`)

CRM > Setup > Developer Hub > Functions > `createPaymentsOnBooksForRetainerInvoice`.

### P1a -- carry a payment over to the Deal's other plan retainer

When a new payment is more than what is left on the invoice's own retainer, the rest goes to the Deal's
other plan retainer (master <-> top-up) as a second Books payment, with a second `Invoice_Payers` row.
JMD only (Pre-Need is JMD). If there is no other retainer with room for the rest, nothing changes
(the payment goes through the existing code exactly as today).

FIND (just after the ZP-TBD-91 block and the `retainerinvoices` list):

```
		if(isNull(payer.get("Books_Payment_ID")))
		{
			paymentResult = invokeurl
			[
				url :"https://www.zohoapis.com/books/v3/customerpayments?organization_id=" + organizationID
```

REPLACE WITH:

```
		// ZP-TBD-95: a Pre-Need Deal can have a "Pre-Need top-up" retainer next to its master (the contract went up
		// after a payment and Books won't change a paid retainer). When this NEW payment is more than what is left
		// on this invoice's own retainer, the rest is carried over to the Deal's other plan retainer: two Books
		// payments, and a second Invoice_Payers row for the carried part. JMD only.
		if(isNull(payer.get("Books_Payment_ID")) && amountDueInBooks > 0 && amountPaid > amountDueInBooks && paymentMadeBy == "jmd" && ifnull(booksInvoiceDetails.get("currency_code"),"") == "JMD" && !isNull(recordInfo.get("Deal_Name__s")) && (recordInfo.get("Invoice_For") == "Deposit" || ifnull(recordInfo.get("Invoice_For"),"").startsWith("Installment")))
		{
			carryRetainerId = "";
			carryRetainerNumber = "";
			carryRetainerBalance = 0.0;
			dealPlanInvoices = zoho.crm.getRelatedRecords("Invoices","Deals",recordInfo.get("Deal_Name__s").get("id"));
			for each  dealPlanInvoice in dealPlanInvoices
			{
				carryBooksId = ifnull(dealPlanInvoice.get("Books_Invoice_ID"),"").toString();
				carryStatus = ifnull(dealPlanInvoice.get("Status"),"");
				carryInvoiceFor = ifnull(dealPlanInvoice.get("Invoice_For"),"");
				if(carryBooksId != "" && carryBooksId != booksInvoiceID.toString() && carryStatus != "Void" && carryStatus != "Cancelled" && (carryInvoiceFor == "Deposit" || carryInvoiceFor.startsWith("Installment")))
				{
					carryRetainer = zoho.books.getRecordsByID("retainerinvoices",organizationID,carryBooksId,"zohooauth").get("retainerinvoice");
					if(ifnull(carryRetainer.get("status"),"") != "void" && ifnull(carryRetainer.get("balance"),0).toString().toDecimal() > 0)
					{
						carryRetainerId = carryBooksId;
						carryRetainerNumber = carryRetainer.get("retainerinvoice_number");
						carryRetainerBalance = carryRetainer.get("balance").toString().toDecimal();
						break;
					}
				}
			}
			carryAmount = (amountPaid - amountDueInBooks).round(2);
			if(carryRetainerId != "" && carryAmount <= carryRetainerBalance + 1)
			{
				// Books rounds retainers to 0.125 -> a carry a few cents over the other retainer's balance is capped
				if(carryAmount > carryRetainerBalance)
				{
					carryAmount = carryRetainerBalance;
				}
				firstPartAmount = amountDueInBooks;
				firstPartFields = list();
				carryPartFields = list();
				for each  paymentCustomFieldEntry in customFieldsListForPayment
				{
					if(paymentCustomFieldEntry.get("api_name") == "cf_actual_paid_amount")
					{
						firstPartFields.add({"api_name":"cf_actual_paid_amount","value":firstPartAmount});
						carryPartFields.add({"api_name":"cf_actual_paid_amount","value":carryAmount});
					}
					else
					{
						firstPartFields.add(paymentCustomFieldEntry);
						carryPartFields.add(paymentCustomFieldEntry);
					}
				}
				// payment 1: what is left on this invoice's own retainer
				paymentMap.put("amount",firstPartAmount);
				paymentMap.put("amount_applied",firstPartAmount);
				paymentMap.put("retainerinvoice_id",booksInvoiceID);
				paymentMap.put("retainerinvoices",{{"retainerinvoice_id":booksInvoiceID,"amount_applied":firstPartAmount}});
				paymentMap.put("custom_fields",firstPartFields);
				paymentMap.put("description","Paid " + amountPaid.round(2) + ": " + firstPartAmount + " on this retainer, " + carryAmount + " carried over to Pre-Need retainer " + carryRetainerNumber);
				firstPartResult = invokeurl
				[
					url :"https://www.zohoapis.com/books/v3/customerpayments?organization_id=" + organizationID
					type :POST
					parameters:paymentMap.toString()
					connection:"zohooauth"
				];
				info "ZP-TBD-95 firstPartResult";
				info firstPartResult;
				// payment 2: the rest on the Deal's other plan retainer
				paymentMap.put("amount",carryAmount);
				paymentMap.put("amount_applied",carryAmount);
				paymentMap.put("retainerinvoice_id",carryRetainerId);
				paymentMap.put("retainerinvoices",{{"retainerinvoice_id":carryRetainerId,"amount_applied":carryAmount}});
				paymentMap.put("custom_fields",carryPartFields);
				paymentMap.put("description","Carried over from a payment of " + amountPaid.round(2) + " on Pre-Need retainer " + ifnull(booksInvoiceDetails.get("retainerinvoice_number"),booksInvoiceID));
				carryPartResult = invokeurl
				[
					url :"https://www.zohoapis.com/books/v3/customerpayments?organization_id=" + organizationID
					type :POST
					parameters:paymentMap.toString()
					connection:"zohooauth"
				];
				info "ZP-TBD-95 carryPartResult";
				info carryPartResult;
				if(firstPartResult.containKey("payment"))
				{
					payer.put("Books_Payment_ID",firstPartResult.get("payment").get("payment_id"));
					payer.put("Amount_Paid",firstPartAmount);
					if(!isNull(payer.get("Actual_Paid_Amount")))
					{
						payer.put("Actual_Paid_Amount",firstPartAmount);
					}
					invoicePayersUpdatedList.add(payer);
				}
				else
				{
					standalone.sendEmailOnError(firstPartResult);
				}
				if(carryPartResult.containKey("payment"))
				{
					carryRow = Map();
					if(!isNull(payer.get("Payer")))
					{
						carryRow.put("Payer",payer.get("Payer").get("id"));
					}
					carryRow.put("Payment_Mode",payer.get("Payment_Mode"));
					carryRow.put("Paid_Date",payer.get("Paid_Date"));
					carryRow.put("Amount_Paid",carryAmount);
					carryRow.put("Books_Payment_ID",carryPartResult.get("payment").get("payment_id"));
					invoicePayersUpdatedList.add(carryRow);
				}
				else
				{
					standalone.sendEmailOnError(carryPartResult);
				}
				continue;
			}
		}
		if(isNull(payer.get("Books_Payment_ID")))
		{
			paymentResult = invokeurl
			[
				url :"https://www.zohoapis.com/books/v3/customerpayments?organization_id=" + organizationID
```

### P1b -- re-sync an existing payment to the retainer it is actually on

Every run of this function re-sends **every** row that already has a `Books_Payment_ID` (the `else` branch,
PUT). Today it always aims that PUT at the invoice's own retainer, with `amount_applied` capped at that
retainer's *current* balance. For a carried-over row (on the other retainer), or once a retainer is used up
(balance 0 -> `amount_applied` 0), that PUT would move or un-apply a payment that is already correct.
For Pre-Need plan invoices the PUT now goes to the retainer the payment is really on, at its full amount.

FIND:

```
		else
		{
			info paymentMap;
			paymentResult = invokeurl
			[
				url :"https://www.zohoapis.com/books/v3/customerpayments/" + payer.get("Books_Payment_ID") + "?organization_id=" + organizationID
```

REPLACE WITH:

```
		else
		{
			// ZP-TBD-95: Pre-Need plan invoice -> re-sync the payment to the retainer it is ACTUALLY on (a carried-over
			// part sits on the Deal's other retainer), at its full amount (not capped at that retainer's current
			// balance, which already includes this payment and can be 0 once the retainer is used up).
			if(recordInfo.get("Invoice_For") == "Deposit" || ifnull(recordInfo.get("Invoice_For"),"").startsWith("Installment"))
			{
				try 
				{
					existingBooksPayment = zoho.books.getRecordsByID("customerpayments",organizationID,payer.get("Books_Payment_ID"),"zohooauth").get("payment");
					existingRetainerId = ifnull(existingBooksPayment.get("retainerinvoice_id"),"").toString();
					if(existingRetainerId == "")
					{
						existingRetainerId = booksInvoiceID.toString();
					}
					paymentMap.put("retainerinvoice_id",existingRetainerId);
					paymentMap.put("amount_applied",amountPaid);
					paymentMap.put("retainerinvoices",{{"retainerinvoice_id":existingRetainerId,"amount_applied":amountPaid}});
				}
				catch (eExistingPayment)
				{
					info "ZP-TBD-95: could not read Books payment " + payer.get("Books_Payment_ID") + ": " + eExistingPayment;
				}
			}
			info paymentMap;
			paymentResult = invokeurl
			[
				url :"https://www.zohoapis.com/books/v3/customerpayments/" + payer.get("Books_Payment_ID") + "?organization_id=" + organizationID
```

---

## P2 -- `allprocessonpaymentcreateandupdate` (Books > Settings > Automation > Custom Functions)

`Amount_Paid_To_Date` on the Deal was copied from the ONE retainer the payment hit. It now adds up every
plan retainer of the Deal (master + top-up; Hillview / other retainers are not plan invoices and are not
counted).

FIND:

```
			dealAmountPaidMap = Map();
			dealAmountPaidMap.put("Amount_Paid_To_Date",ifnull(retainerInvoiceDataForDealSync.get("payment_made"),0));
```

REPLACE WITH:

```
			// ZP-TBD-95: a Pre-Need Deal can have a "Pre-Need top-up" retainer next to its master -> add up the
			// payment_made of every plan retainer of the Deal (the Books ids on its Deposit / Installment invoices)
			dealPaidTotal = ifnull(retainerInvoiceDataForDealSync.get("payment_made"),0).toString().toDecimal();
			countedRetainerIds = list();
			countedRetainerIds.add(retainerInvoiceIdForDealSync.toString());
			try 
			{
				dealInvoicesForPaid = zoho.crm.getRelatedRecords("Invoices","Deals",relatedDealIdForSync.toLong());
				for each  dealInvoiceForPaid in dealInvoicesForPaid
				{
					paidInvoiceFor = ifnull(dealInvoiceForPaid.get("Invoice_For"),"");
					paidInvoiceStatus = ifnull(dealInvoiceForPaid.get("Status"),"");
					paidBooksId = ifnull(dealInvoiceForPaid.get("Books_Invoice_ID"),"").toString();
					if((paidInvoiceFor == "Deposit" || paidInvoiceFor.startsWith("Installment")) && paidInvoiceStatus != "Void" && paidInvoiceStatus != "Cancelled" && paidBooksId != "" && !countedRetainerIds.contains(paidBooksId))
					{
						countedRetainerIds.add(paidBooksId);
						otherRetainerForPaid = zoho.books.getRecordsByID("retainerinvoices",organizationID,paidBooksId,"zohobooksconnection").get("retainerinvoice");
						if(ifnull(otherRetainerForPaid.get("status"),"") != "void")
						{
							dealPaidTotal = dealPaidTotal + ifnull(otherRetainerForPaid.get("payment_made"),0).toString().toDecimal();
						}
					}
				}
			}
			catch (ePaidSum)
			{
				info "ZP-TBD-95: could not add up the Deal's other retainers: " + ePaidSum;
			}
			dealAmountPaidMap = Map();
			dealAmountPaidMap.put("Amount_Paid_To_Date",dealPaidTotal);
```

---

## P3 -- `addpreneeddifferenceandcreditnoteonretainerapply` (Books, retainer_invoice) -- DROPPED, do not apply

> **Dropped 2026-10-02.** ZP-TBD-80 is live: Pre-Need retainers are never applied to the at-need invoice
> (`getPreNeedInfo` bills prepaid lines at 0 + a Balance line and releases the liability by Xero journal; it
> already sums master + top-up). Kept below for reference only.

Runs when a retainer is applied to the family's at-need invoice. Two problems with a top-up:
1. The contract price of a product is split over master + top-up, but the "Pre-Need Difference" line was
   worked out from this one retainer's lines -> wrong difference line.
2. It writes `cf_pre_need_retainer_applied_amount` / `_number`, which `createinvoiceonxero` reads **once**
   (one Xero credit note, then `cf_xero_retainer_credit_note_id` stops it). If master and top-up are applied
   one after the other, the second amount would never be released in Xero.

Fix: prices come from every plan retainer of the Deal; the hand-off fields are written **once**, only when
every plan retainer that has money on it has been applied to this invoice -- with the combined amount and
both numbers. `createinvoiceonxero` is not changed.

### P3a -- FIND:

```
for each  appliedInvoiceEntry in appliedInvoices
{
```

REPLACE WITH:

```
// ZP-TBD-95: a Pre-Need Deal can have a "Pre-Need top-up" retainer next to its master. The contract price of a
// product is then split over both -> add the lines of the Deal's other plan retainers to the original prices,
// and keep their applications so the hand-off fields below can wait until every paid retainer is applied.
siblingRetainers = list();
relatedDealIdForPrices = "";
try 
{
	relatedDealIdForPrices = ifnull(retainerData.get("custom_field_hash").get("cf_related_crm_deal_id"),"").toString();
}
catch (eDealId)
{
	relatedDealIdForPrices = "";
}
if(relatedDealIdForPrices != "" && relatedDealIdForPrices != "null")
{
	try 
	{
		siblingSeenIds = list();
		siblingSeenIds.add(retainerInvoiceID.toString());
		dealInvoicesForPrices = zoho.crm.getRelatedRecords("Invoices","Deals",relatedDealIdForPrices.toLong());
		for each  dealInvoiceForPrices in dealInvoicesForPrices
		{
			priceInvoiceFor = ifnull(dealInvoiceForPrices.get("Invoice_For"),"");
			priceInvoiceStatus = ifnull(dealInvoiceForPrices.get("Status"),"");
			priceBooksId = ifnull(dealInvoiceForPrices.get("Books_Invoice_ID"),"").toString();
			if((priceInvoiceFor == "Deposit" || priceInvoiceFor.startsWith("Installment")) && priceInvoiceStatus != "Void" && priceInvoiceStatus != "Cancelled" && priceBooksId != "" && !siblingSeenIds.contains(priceBooksId))
			{
				siblingSeenIds.add(priceBooksId);
				siblingResponse = zoho.books.getRecordsByID("RetainerInvoices",organizationID,priceBooksId,"zohobooksconnection");
				siblingData = siblingResponse.get("retainerinvoice");
				if(!isNull(siblingData) && ifnull(siblingData.get("status"),"") != "void")
				{
					siblingLines = ifnull(siblingData.get("line_items"),list());
					for each  siblingLine in siblingLines
					{
						siblingProductName = siblingLine.get("description");
						if(!isNull(siblingProductName) && siblingProductName.trim() != "")
						{
							siblingNameKey = siblingProductName.trim().toLowerCase();
							siblingExisting = originalPriceByProductName.get(siblingNameKey);
							if(isNull(siblingExisting))
							{
								siblingExisting = 0;
							}
							originalPriceByProductName.put(siblingNameKey,siblingExisting + siblingLine.get("item_total"));
						}
					}
					siblingInfo = Map();
					siblingInfo.put("number",siblingData.get("retainerinvoice_number"));
					siblingInfo.put("payment_made",ifnull(siblingData.get("payment_made"),0).toString().toDecimal());
					siblingInfo.put("invoices",ifnull(siblingResponse.get("invoices"),list()));
					siblingRetainers.add(siblingInfo);
				}
			}
		}
	}
	catch (eSiblings)
	{
		info "ZP-TBD-95: could not read the Deal's other retainers: " + eSiblings;
	}
}
for each  appliedInvoiceEntry in appliedInvoices
{
```

### P3b -- FIND:

```
	handoffFields = list();
	handoffFields.add({"api_name":"cf_pre_need_retainer_applied_amount","value":amountApplied});
	handoffFields.add({"api_name":"cf_pre_need_retainer_number","value":retainerData.get("retainerinvoice_number")});
	combinedUpdateMap.put("custom_fields",handoffFields);
	combinedUpdateMap.put("reason","Adjust from retainer invoice.");
	result = zoho.books.updateRecord("Invoices",organizationID,invoiceID,combinedUpdateMap,"zohobooksconnection");
```

REPLACE WITH:

```
	// ZP-TBD-95: hand-off = every plan retainer of the Deal applied to this invoice, added up. Written only once
	// every retainer that has money on it is applied (createinvoiceonxero makes ONE Xero credit note from it).
	totalAppliedForInvoice = ifnull(amountApplied,0).toString().toDecimal();
	appliedRetainerNumbers = retainerData.get("retainerinvoice_number");
	waitingForRetainer = "";
	for each  siblingInfo in siblingRetainers
	{
		siblingAppliedHere = 0.0;
		siblingApplications = siblingInfo.get("invoices");
		for each  siblingApplication in siblingApplications
		{
			if(siblingApplication.get("invoice_id") == invoiceID)
			{
				siblingAppliedAmount = siblingApplication.get("amount_applied");
				if(isNull(siblingAppliedAmount))
				{
					siblingAppliedAmount = siblingApplication.get("total_applied_retainer_amount");
				}
				siblingAppliedHere = siblingAppliedHere + ifnull(siblingAppliedAmount,0).toString().toDecimal();
			}
		}
		if(siblingAppliedHere > 0)
		{
			totalAppliedForInvoice = totalAppliedForInvoice + siblingAppliedHere;
			appliedRetainerNumbers = appliedRetainerNumbers + ", " + siblingInfo.get("number");
		}
		else if(siblingInfo.get("payment_made") > 0)
		{
			waitingForRetainer = siblingInfo.get("number");
		}
	}
	if(waitingForRetainer == "")
	{
		handoffFields = list();
		handoffFields.add({"api_name":"cf_pre_need_retainer_applied_amount","value":totalAppliedForInvoice});
		handoffFields.add({"api_name":"cf_pre_need_retainer_number","value":appliedRetainerNumbers});
		combinedUpdateMap.put("custom_fields",handoffFields);
	}
	else
	{
		info "ZP-TBD-95: Pre-Need retainer " + waitingForRetainer + " has payments but is not applied to invoice " + invoiceData.get("invoice_number") + " yet - hand-off fields wait for it";
	}
	combinedUpdateMap.put("reason","Adjust from retainer invoice.");
	result = null;
	if(combinedUpdateMap.containKey("line_items") || combinedUpdateMap.containKey("custom_fields"))
	{
		result = zoho.books.updateRecord("Invoices",organizationID,invoiceID,combinedUpdateMap,"zohobooksconnection");
	}
```
