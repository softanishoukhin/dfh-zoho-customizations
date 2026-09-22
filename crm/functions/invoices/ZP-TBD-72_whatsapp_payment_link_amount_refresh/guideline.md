# ZP-TBD-72 — New function: refresh Invoice JMD/USD/GBP amounts, no email/Books side effects

**Source:** T-13, `sendLinksViaWhatsApp` widget (Deals module, single button). The widget builds a
combined Questionnaire + Payment WhatsApp message. On a fresh Pre-Need test Deal, the Payment
piece silently came back empty — traced live via `ZohoCRM_getRecord`/`getRelatedRecords` to the
correct Invoice and the correct Potential Payer (Contact matched the Deal's own `Contact_Name`)
both being found successfully, but that Invoice's `Amount_in_JMD` / `Amount_in_USD` were simply
never populated.

User confirmed: in the current process those two fields only get filled in as a side effect of the
existing `buttonsendemailforpaymentbypotentialpayers` function (the Potential_Payers "Send Invoice
for Payment" button). Pulled that function's live source via `ZohoCRM_getFunctionCode` — besides
the JMD/USD/GBP calculation, it also:

- Updates the **Books** invoice's custom fields and `contact_persons` list.
- Marks the Books invoice **"Sent"** (`invokeurl POST .../status/sent`) and writes that status back
  onto the CRM Invoice's `Status` field.
- Calls `standalone.sendInvoiceNotificationFromCRM(...)` — **emails the invoice to the contact**.
- Re-points the Books invoice's payer/`contact_persons` back to the Deal's *primary* Potential
  Payer via a COQL lookup, after the above.

Calling that function from the WhatsApp button as-is would mean every WhatsApp send also silently
emails the invoice and flips it to "Sent" in Books. User chose instead to build a **new, narrower**
function: same exchange-rate + amount calculation and the same CRM `Invoices` update, with all four
of the above (Books custom fields/contact_persons, mark-sent, email, primary-payer re-pointing)
left out.

## What this function does

Same inputs/logic as `buttonsendemailforpaymentbypotentialpayers` for the amount piece only:

1. Same two Books-sync-timing guards (`Sync_To_Books_At` / `Invoice_Items_Updated_At` +2min) —
   kept as-is, this is a data-integrity check on reading a possibly-mid-sync balance, not one of
   the four side effects above.
2. Fetch the Books invoice (retainer vs regular, same as original) and live USD/GBP exchange
   rates.
3. Convert the Books invoice `balance` to JMD/USD/GBP based on the Deal's
   `Currency_Used_for_this_Deal`, same three-branch logic as the original.
4. Write `Amount_in_JMD` / `Amount_in_USD` / `Amount_in_GBP` onto the CRM `Invoices` record.
5. Return the three amounts (plus the Invoice id) as JSON so the calling widget can use them
   immediately, without a second fetch.

Dropped entirely (all four are the side effects called out above): Books custom fields update,
Books `contact_persons` update, "mark sent" + `Status` write, `sendInvoiceNotificationFromCRM`
call, and the trailing primary-payer COQL re-pointing block.

## New function code

CRM API name: `refreshinvoiceamountsforpotentialpayer` (Standalone function, called by the widget
via `ZOHO.CRM.FUNCTIONS.execute`, same call pattern `preNeedFromContactWidget` already uses against
`createpreneeddealfromcontact` — confirmed live in that widget's `widget.html`). Returns a JSON
string (CRM functions can only declare `string` return type, per the standing rule) with
`status`/`message` on error, or `status`/`invoiceId`/`amountInJMD`/`amountInUSD`/`amountInGBP` on
success.

```deluge
string standalone.refreshInvoiceAmountsForPotentialPayer(String crmid)
{
	resultMap = Map();
	try
	{
		booksOrganizationID = "872327358";
		recordInfo = zoho.crm.getRecordById("Potential_Payers",crmid);
		invoiceInfo = zoho.crm.getRecordById("Invoices",recordInfo.get("Invoice").get("id"));
		dealInfo = zoho.crm.getRecordById("Deals",invoiceInfo.get("Deal_Name__s").get("id"));
		booksInvoiceId = invoiceInfo.get("Books_Invoice_ID");

		parameterMap = Map();
		response = zoho.crm.invokeConnector("crm.getorg",parameterMap);
		try
		{
			timeZone = response.get("response").get("org").get(0).get("time_zone");
			currentTime = zoho.currenttime.toString("yyyy-MM-dd'T'HH:mm:ss",timeZone).toTime("yyyy-MM-dd'T'HH:mm:ss");
			syncTime = invoiceInfo.get("Sync_To_Books_At").toTime("yyyy-MM-dd'T'HH:mm:ss").addMinutes(2);
			if(!isNull(invoiceInfo.get("Sync_To_Books_At")) && toTime(currentTime) <= syncTime)
			{
				resultMap.put("status","error");
				resultMap.put("message","Please try after " + syncTime.toTime().toString("MMM dd, yyyy hh:mm a") + ", the invoice is being synced to Books.");
				return resultMap.toString();
			}
		}
		catch (e)
		{
			info e;
		}
		try
		{
			timeZone = response.get("response").get("org").get(0).get("time_zone");
			currentTime = zoho.currenttime.toString("yyyy-MM-dd'T'HH:mm:ss",timeZone).toTime("yyyy-MM-dd'T'HH:mm:ss");
			syncTimeBasedOnInvoiceItemUpdate = invoiceInfo.get("Invoice_Items_Updated_At").toTime("yyyy-MM-dd'T'HH:mm:ss").addMinutes(2);
			if(!isNull(invoiceInfo.get("Invoice_Items_Updated_At")) && toTime(currentTime) <= syncTimeBasedOnInvoiceItemUpdate)
			{
				resultMap.put("status","error");
				resultMap.put("message","Please try after " + syncTimeBasedOnInvoiceItemUpdate.toTime().toString("MMM dd, yyyy hh:mm a") + ", the invoice is being synced to Books.");
				return resultMap.toString();
			}
		}
		catch (e)
		{
			info e;
		}

		if(invoiceInfo.get("Retainer_Invoice") == true)
		{
			booksInvoice = zoho.books.getRecordsByID("retainerinvoices",booksOrganizationID,booksInvoiceId,"zohooauth");
			booksInvoiceDetails = booksInvoice.get("retainerinvoice");
		}
		else
		{
			booksInvoice = zoho.books.getRecordsByID("invoices",booksOrganizationID,booksInvoiceId,"zohooauth");
			booksInvoiceDetails = booksInvoice.get("invoice");
		}

		usdExchangeRateResponse = invokeurl
		[
			url :"https://www.zohoapis.com/books/v3/settings/currencies/5830143000000000097/exchangerates?organization_id=" + booksOrganizationID
			type :GET
			connection:"zohooauth"
		];
		gbpExchangeRateResponse = invokeurl
		[
			url :"https://www.zohoapis.com/books/v3/settings/currencies/5830143000000000103/exchangerates?organization_id=" + booksOrganizationID
			type :GET
			connection:"zohooauth"
		];
		usdRate = usdExchangeRateResponse.get("exchange_rates").get(0).get("rate");
		gbpRate = gbpExchangeRateResponse.get("exchange_rates").get(0).get("rate");

		if(dealInfo.get("Currency_Used_for_this_Deal") == "USD")
		{
			amountDueInUSD = booksInvoiceDetails.get("balance");
			// USD -> JMD
			amountDueInJMD = amountDueInUSD * usdRate;
			// USD -> GBP (via JMD)
			amountDueInGBP = amountDueInJMD / gbpRate;
		}
		else if(dealInfo.get("Currency_Used_for_this_Deal") == "GBP")
		{
			amountDueInGBP = booksInvoiceDetails.get("balance");
			// GBP -> JMD
			amountDueInJMD = amountDueInGBP * gbpRate;
			// GBP -> USD
			amountDueInUSD = amountDueInJMD / usdRate;
		}
		else
		{
			amountDueInJMD = booksInvoiceDetails.get("balance");
			// JMD -> USD
			amountDueInUSD = amountDueInJMD / usdRate;
			// JMD -> GBP
			amountDueInGBP = amountDueInJMD / gbpRate;
		}

		crmInvoiceMap = Map();
		crmInvoiceMap.put("Amount_in_USD",amountDueInUSD.round(2).toString());
		crmInvoiceMap.put("Amount_in_JMD",amountDueInJMD.round(2).toString());
		crmInvoiceMap.put("Amount_in_GBP",amountDueInGBP.round(2).toString());
		crmInvoiceUpdateResult = zoho.crm.updateRecord("Invoices",recordInfo.get("Invoice").get("id"),crmInvoiceMap);
		info crmInvoiceUpdateResult;

		resultMap.put("status","success");
		resultMap.put("invoiceId",recordInfo.get("Invoice").get("id"));
		resultMap.put("amountInJMD",amountDueInJMD.round(2).toString());
		resultMap.put("amountInUSD",amountDueInUSD.round(2).toString());
		resultMap.put("amountInGBP",amountDueInGBP.round(2).toString());
		return resultMap.toString();
	}
	catch (e)
	{
		resultMap.put("status","error");
		resultMap.put("message",e.toString());
		return resultMap.toString();
	}
	return "";
}
```

## Widget side

`sendLinksViaWhatsApp/app/app.js`'s `buildPaymentLinks()` now calls this function with the matched
Potential Payer's id right before building the Fygaro links, and uses the amounts straight from
the function's response instead of a separate `getRecord` on the Invoice (the function already
wrote them and handed them back, no need to re-fetch).

## Deployment (no CRM function write API available to this session)

Same limitation as every other CRM/Books custom function change in this repo — only
`ZohoCRM_getFunctionCode` (read) is available, no create/update/deploy counterpart. Steps for the
developer:

1. Setup → Developer Space → Functions → New Function → Standalone.
2. API name `refreshinvoiceamountsforpotentialpayer`, paste the body above, Save, Publish.
3. Confirm it's reachable via `ZOHO.CRM.FUNCTIONS.execute` from a widget (same REST-API-mode
   requirement as `createpreneeddealfromcontact` already relies on).

## Status

Guideline drafted 2026-09-18, function not yet created live — needs the developer to create and
publish it in CRM, then retest the `sendLinksViaWhatsApp` button against the same test Deal
(`6503357000082600056`) to confirm the Payment lines now populate.
