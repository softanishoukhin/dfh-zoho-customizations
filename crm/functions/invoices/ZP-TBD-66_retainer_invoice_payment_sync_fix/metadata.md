# ZP-TBD-66 — Sync `createPaymentsOnBooksForRetainerInvoice` with `createPaymentsOnBooks`

**Source:** user flagged that recent updates to `createpaymentsonbooks` (CRM
automation function, fires on regular Invoices) were never ported to its
retainer-invoice twin, `createpaymentsonbooksforretainerinvoice`. Confirmed by
pulling both live function bodies via the CRM function-code API and diffing.

## What's actually missing in the retainer version (live-verified)

Both functions read the same CRM `Invoices` module record (`Retainer_Invoice`
boolean is what distinguishes the two flows) and create a Books
`customerpayments` record per entry in the `Invoice_Payers` subform. The
retainer twin was last updated before several fixes landed in the main
function:

1. **No balance cap.** `createpaymentsonbooks` fetches the live Books balance
   per payer (`amountDueInBooks`) and caps `amount_applied` at that balance
   if the payer amount exceeds it. The retainer version always applied the
   full `Amount_Paid` with no cap — risk of over-applying against a retainer
   invoice with a smaller remaining balance.
2. **No currency conversion.** The main function converts JMD/GBP payments
   into the invoice's actual currency (USD/GBP/JMD) via live Books exchange
   rates before setting `amount`. The retainer version had no `amount` /
   `currency_id` handling at all — it would post the raw JMD-denominated
   `Amount_Paid` regardless of the retainer invoice's real currency.
3. **Stale account-ID mapping.** The retainer version's payment-account
   mapping still keyed off `Account_Type` + exact `"Credit Card"` /
   `"Cash"` / `"Check"` / `"Bank Remittance"` strings — payment-mode values
   that predate the current granular picklist (`"bank transfer usd"`,
   `"petty cash mbj"`, `"point of sale credit card cibc usd"`, etc.). In
   practice this meant retainer payments almost always fell through to the
   generic default `account_id`, since none of the current payment modes
   match the old strings. Replaced with the same `Payment_Mode`-based
   mapping the main function now uses.
4. **No `Actual_Paid_Amount` / `cf_actual_paid_amount` handling.** Main
   function reads `Actual_Paid_Amount` off the payer (falling back to
   `Amount_Paid`) and stamps it onto the Books payment's
   `cf_actual_paid_amount` custom field, and rolls it up into
   `Total_Actual_Paid_Amount` on the CRM Invoice. Retainer version did
   neither.
5. ~~No Fygaro attribution.~~ **Declined by user — not applied.**
6. ~~No contact-only fallback.~~ **Declined by user — not applied.** The
   retainer version's original `Account_Name`-only contact resolution is
   left exactly as it was.
7. **Bug fix in passing:** the existing-payment update branch (when
   `Books_Payment_ID` already exists) called `invokeurl` with
   `parameters:paymentMap` instead of `paymentMap.toString()` — inconsistent
   with every other `invokeurl` call in both functions. Fixed.

## Code applied

Paste this over the full body of `createpaymentsonbooksforretainerinvoice`
(Setup → Automation → Functions → find it → replace → Save → Publish):

```deluge
void automation.createPaymentsOnBooksForRetainerInvoice(Int crmid)
{
records = invokeurl
[
	url :"https://www.zohoapis.com/crm/v7/Invoices/" + crmid
	type :GET
	connection:"zohooauth"
];
recordInfo = records.get("data").get(0);
booksInvoiceID = recordInfo.get("Books_Invoice_ID");
organizationID = "872327358";
if(recordInfo.get("Invoice_For") == "Police" || recordInfo.get("Invoice_For") == "Hospital")
{
	Contact_id = recordInfo.get("Parent_Account").get("id");
	relatedContact = zoho.crm.getRelatedRecords("Contacts","Accounts",Contact_id);
	Contact_person_id = relatedContact.get(0).get("id");
}
else
{
	Contact_id = recordInfo.get("Account_Name").get("id");
	Contact_person_id = recordInfo.get("Contact_Name").get("id");
}
books_con = zoho.books.getRecords("Contacts",organizationID,"zcrm_account_id=" + Contact_id,"zohooauth");
books_contact_id = books_con.get("contacts").getJSON("contact_id");
updateInvoice = "";
totalActualAmountPaid = 0;
if(!isNull(recordInfo.get("Invoice_Payers")))
{
	invoicePayersUpdatedList = list();
	for each  payer in recordInfo.get("Invoice_Payers")
	{
		booksInvoice = zoho.books.getRecordsByID("retainerinvoices",organizationID,booksInvoiceID,"zohooauth");
		booksInvoiceDetails = booksInvoice.get("retainerinvoice");
		amountDueInBooks = booksInvoiceDetails.get("balance");
		try 
		{
			payerDetails = zoho.crm.getRecordById("Contacts",payer.get("Payer").get("id"));
		}
		catch (e)
		{
			payerDetails = null;
		}
		paymentMap = Map();
		paymentMap.put("customer_id",books_contact_id);
		paymentMap.put("payment_mode",payer.get("Payment_Mode"));
		paymentMap.put("date",payer.get("Paid_Date"));
		paymentMap.put("retainerinvoice_id",booksInvoiceID);
		customFieldsListForPayment = list();
		if(!isNull(payer.get("Actual_Paid_Amount")))
		{
			try 
			{
				amountActuallyPaid = payer.get("Actual_Paid_Amount").toDecimal();
			}
			catch (e)
			{
				amountActuallyPaid = payer.get("Amount_Paid").toDecimal();
			}
			paymentCustomField4 = Map();
			paymentCustomField4.put("api_name","cf_actual_paid_amount");
			paymentCustomField4.put("value",amountActuallyPaid.round(2));
			customFieldsListForPayment.add(paymentCustomField4);
		}
		else
		{
			paymentCustomField4 = Map();
			paymentCustomField4.put("api_name","cf_actual_paid_amount");
			paymentCustomField4.put("value",payer.get("Amount_Paid"));
			customFieldsListForPayment.add(paymentCustomField4);
		}
		paymentMode = payer.get("Payment_Mode").toLowerCase();
		if(paymentMode == "bank transfer gbp" || paymentMode == "bank transfer bns gdp")
		{
			paymentMadeBy = "gbp";
		}
		else if(paymentMode == "bank transfer usd" || paymentMode == "online credit card usd" || paymentMode == "credit card usd kgn" || paymentMode == "bank transfer ncb usd" || paymentMode == "bank transfer bns usd" || paymentMode == "point of sale credit card cibc usd" || paymentMode == "credit card usd mbj")
		{
			paymentMadeBy = "usd";
		}
		else
		{
			paymentMadeBy = "jmd";
		}
		try 
		{
			if(booksInvoiceDetails.get("currency_code") == "USD" || paymentMode == "bank transfer ncb usd")
			{
				paymentMap.put("currency_id","5830143000000000097");
				if(!isNull(payer.get("Actual_Paid_Amount")))
				{
					amountPaid = payer.get("Actual_Paid_Amount");
				}
				else
				{
					amountPaid = payer.get("Amount_Paid");
				}
				if(paymentMadeBy == "gbp")
				{
					gbpRateResp = invokeurl
					[
						url :"https://www.zohoapis.com/books/v3/settings/currencies/5830143000000000103/exchangerates?organization_id=" + organizationID
						type :GET
						connection:"zohooauth"
					];
					gbpRate = gbpRateResp.get("exchange_rates").get(0).get("rate");
					usdRateResp = invokeurl
					[
						url :"https://www.zohoapis.com/books/v3/settings/currencies/5830143000000000097/exchangerates?organization_id=" + organizationID
						type :GET
						connection:"zohooauth"
					];
					usdRate = usdRateResp.get("exchange_rates").get(0).get("rate");
					jmdAmount = amountPaid * gbpRate;
					usdAmount = jmdAmount / usdRate;
					amountPaid = usdAmount;
				}
				else if(paymentMadeBy == "jmd")
				{
					usdRateResp = invokeurl
					[
						url :"https://www.zohoapis.com/books/v3/settings/currencies/5830143000000000097/exchangerates?organization_id=" + organizationID
						type :GET
						connection:"zohooauth"
					];
					usdRate = usdRateResp.get("exchange_rates").get(0).get("rate");
					amountPaid = amountPaid / usdRate;
				}
				paymentMap.put("amount",amountPaid.round(2));
			}
			else if(booksInvoiceDetails.get("currency_code") == "GBP")
			{
				paymentMap.put("currency_id","5830143000000000103");
				if(!isNull(payer.get("Actual_Paid_Amount")))
				{
					amountPaid = payer.get("Actual_Paid_Amount");
				}
				else
				{
					amountPaid = payer.get("Amount_Paid");
				}
				gbpRateResp = invokeurl
				[
					url :"https://www.zohoapis.com/books/v3/settings/currencies/5830143000000000103/exchangerates?organization_id=" + organizationID
					type :GET
					connection:"zohooauth"
				];
				gbpRate = gbpRateResp.get("exchange_rates").get(0).get("rate");
				if(paymentMadeBy == "jmd")
				{
					amountPaid = amountPaid / gbpRate;
				}
				else if(paymentMadeBy == "usd")
				{
					usdRateResp = invokeurl
					[
						url :"https://www.zohoapis.com/books/v3/settings/currencies/5830143000000000097/exchangerates?organization_id=" + organizationID
						type :GET
						connection:"zohooauth"
					];
					usdRate = usdRateResp.get("exchange_rates").get(0).get("rate");
					jmdAmount = amountPaid * usdRate;
					amountPaid = jmdAmount / gbpRate;
				}
				paymentMap.put("amount",amountPaid.round(2));
			}
			else
			{
				paymentMap.put("currency_id","5830143000000090097");
				if(!isNull(payer.get("Actual_Paid_Amount")))
				{
					amountPaid = payer.get("Actual_Paid_Amount");
				}
				else
				{
					amountPaid = payer.get("Amount_Paid");
				}
				if(paymentMadeBy == "usd")
				{
					usdRateResp = invokeurl
					[
						url :"https://www.zohoapis.com/books/v3/settings/currencies/5830143000000000097/exchangerates?organization_id=" + organizationID
						type :GET
						connection:"zohooauth"
					];
					usdRate = usdRateResp.get("exchange_rates").get(0).get("rate");
					amountPaid = amountPaid * usdRate;
				}
				else if(paymentMadeBy == "gbp")
				{
					gbpRateResp = invokeurl
					[
						url :"https://www.zohoapis.com/books/v3/settings/currencies/5830143000000000103/exchangerates?organization_id=" + organizationID
						type :GET
						connection:"zohooauth"
					];
					gbpRate = gbpRateResp.get("exchange_rates").get(0).get("rate");
					amountPaid = amountPaid * gbpRate;
				}
				paymentMap.put("amount",amountPaid.round(2));
			}
		}
		catch (e)
		{
			amountPaid = payer.get("Amount_Paid");
			paymentMap.put("amount",amountPaid.round(2));
		}
		totalActualAmountPaid = totalActualAmountPaid + amountPaid.round(2);
		paymentMap.put("amount_applied",amountPaid);
		invoicesListForPayment = list();
		invoicesListForPaymentMap = Map();
		invoicesListForPaymentMap.put("retainerinvoice_id",booksInvoiceID);
		if(amountPaid > amountDueInBooks)
		{
			invoicesListForPaymentMap.put("amount_applied",amountDueInBooks);
		}
		else
		{
			invoicesListForPaymentMap.put("amount_applied",amountPaid);
		}
		invoicesListForPayment.add(invoicesListForPaymentMap);
		paymentMap.put("retainerinvoices",invoicesListForPayment);
		if(!isNull(payerDetails))
		{
			paymentCustomField = Map();
			paymentCustomField.put("api_name","cf_payer");
			paymentCustomField.put("value",payer.get("Payer").get("id"));
			paymentCustomField.put("value_formatted",payerDetails.get("Last_Name"));
			customFieldsListForPayment.add(paymentCustomField);
		}
		paymentMap.put("custom_fields",customFieldsListForPayment);
		if(payer.get("Payment_Mode").toLowerCase() == "bank transfer")
		{
			paymentMap.put("account_id","5830143000000594055");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "bank transfer gbp")
		{
			paymentMap.put("account_id","5830143000000594051");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "bank transfer usd")
		{
			paymentMap.put("account_id","5830143000000594039");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "debit card to cash")
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "petty cash mbj")
		{
			paymentMap.put("account_id","5830143000000000361");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "petty cash kgn")
		{
			paymentMap.put("account_id","5830143000025900621");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "online credit card")
		{
			paymentMap.put("account_id","5830143000000594043");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "online credit card usd")
		{
			paymentMap.put("account_id","5830143000000594033");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "point of sale jmd")
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "point of sale credit card cibc")
		{
			paymentMap.put("account_id","5830143000000594043");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "point of sale debit card bns")
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "point of sale debit card cibc")
		{
			paymentMap.put("account_id","5830143000000594043");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "bank transfer ncb")
		{
			paymentMap.put("account_id","5830143000003093122");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "bank remittance")
		{
			paymentMap.put("account_id","5830143000000594055");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "bank transfer bns 8811")
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "bank transfer bns cons")
		{
			paymentMap.put("account_id","5830143000000594055");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "bank transfer bns gdp")
		{
			paymentMap.put("account_id","5830143000000594051");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "bank transfer ncb jmd")
		{
			paymentMap.put("account_id","5830143000003093122");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "bank transfer ncb usd")
		{
			paymentMap.put("account_id","5830143000003093128");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "cash mbj")
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "cheque mbj")
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "debit card mbj")
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "credit card mbj")
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "credit card usd mbj")
		{
			paymentMap.put("account_id","5830143000000594039");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "cash kgn")
		{
			paymentMap.put("account_id","5830143000000594043");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "cheque kgn")
		{
			paymentMap.put("account_id","5830143000000594043");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "credit card kgn")
		{
			paymentMap.put("account_id","5830143000000594043");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "credit card usd kgn")
		{
			paymentMap.put("account_id","5830143000000594033");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "debit card kgn")
		{
			paymentMap.put("account_id","5830143000000594043");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "bank transfer bns usd")
		{
			paymentMap.put("account_id","5830143000000594039");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "cash")
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "cheque")
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "online credit card jmd")
		{
			paymentMap.put("account_id","5830143000000594043");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "point of sale credit card cibc jmd")
		{
			paymentMap.put("account_id","5830143000000594043");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "point of sale credit card cibc usd")
		{
			paymentMap.put("account_id","5830143000000594033");
		}
		else if(payer.get("Payment_Mode").toLowerCase() == "point of sale credit card bns")
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		else
		{
			paymentMap.put("account_id","5830143000000594063");
		}
		if(isNull(payer.get("Books_Payment_ID")))
		{
			paymentResult = invokeurl
			[
				url :"https://www.zohoapis.com/books/v3/customerpayments?organization_id=" + organizationID
				type :POST
				parameters:paymentMap.toString()
				connection:"zohooauth"
			];
			info "paymentMap";
			info paymentMap;
			info "paymentResult";
			info paymentResult;
			if(paymentResult.containKey("payment"))
			{
				payer.put("Books_Payment_ID",paymentResult.get("payment").get("payment_id"));
				invoicePayersUpdatedList.add(payer);
			}
			else
			{
				standalone.sendEmailOnError(paymentResult);
			}
		}
		else
		{
			info paymentMap;
			paymentResult = invokeurl
			[
				url :"https://www.zohoapis.com/books/v3/customerpayments/" + payer.get("Books_Payment_ID") + "?organization_id=" + organizationID
				type :PUT
				parameters:paymentMap.toString()
				connection:"zohooauth"
			];
			info "paymentResult";
			info paymentResult;
			if(!paymentResult.containKey("payment"))
			{
				standalone.sendEmailOnError(paymentResult);
			}
		}
	}
	if(invoicePayersUpdatedList.size() > 0)
	{
		invoiceUpdateMap = Map();
		invoiceUpdateMap.put("data",{{"Invoice_Payers":invoicePayersUpdatedList,"Total_Actual_Paid_Amount":totalActualAmountPaid.round(2)}});
		invoiceUpdateMap.put("trigger",{});
		info invoiceUpdateMap;
		updateInvoiceResult = invokeurl
		[
			url :"https://www.zohoapis.com/crm/v7/Invoices/" + crmid
			type :PUT
			parameters:invoiceUpdateMap.toString()
			connection:"zohooauth"
		];
		info updateInvoiceResult;
	}
}
}
```

## Not carried over

- **Fygaro attribution** (`cf_payment_created_from`, `cf_fygaro_transaction_number`) — declined by user.
- **Contact-only fallback** (`isAccountBased` branching to `zcrm_contact_id`
  when there's no `Account_Name`) — declined by user. Retainer invoices are
  assumed to always have an `Account_Name`; if that assumption is ever wrong,
  this function will throw on `recordInfo.get("Account_Name").get("id")`.
- The main function's "Walk In" / Books error-code-`280039` retry fallback
  was not ported — specific to `"Invoice_For" == "Walk In"`, which doesn't
  appear to apply to retainer invoices.

## Status

Guideline drafted, **not yet applied live** — needs to be pasted into the
function editor and published by the developer, then tested against a real
or test retainer invoice with an `Invoice_Payers` entry before relying on it.
