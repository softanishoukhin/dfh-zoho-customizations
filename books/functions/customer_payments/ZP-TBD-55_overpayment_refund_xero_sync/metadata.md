# ZP-TBD-55 — Customer Payment Overpayment Refund → Real Xero Overpayment

**Source:** developer request, continuing the same-day Xero sync work as
ZP-TBD-48/52/54. Reference:
[Xero Accounting API — Overpayments](https://developer.xero.com/documentation/api/accounting/overpayments).

## The ask

When a customer overpays and the excess is refunded back to them (Books
"Customer Payment Refund"), create a genuine **Overpayment** in Xero (not
just a Bill or a generic bank transaction) and record its refund properly,
mirroring the real accounting event.

## How Xero actually models this (confirmed via Xero's own OpenAPI spec,
not just the marketing docs, which don't render for automated fetching)

- **Creating an Overpayment**: there is no dedicated `POST /Overpayments`
  endpoint. An Overpayment is created via **`POST /BankTransactions`** with
  `Type: "RECEIVE-OVERPAYMENT"` — Xero returns it nested inside the created
  BankTransaction's own `OverpaymentID` field (not a separate `Overpayments`
  array, despite that being a very natural first guess).
- **Refunding it**: done via **`POST /Payments`**, with a dedicated
  top-level **`Overpayment`** field on the Payment object — confirmed
  directly from Xero's OpenAPI schema (`Xero-OpenAPI/xero_accounting.yaml`,
  `Payment` schema): `Invoice`, `CreditNote`, `Prepayment`, and `Overpayment`
  are four **separate** top-level fields, not one generic field reused
  across types. (`PaymentType` on the response will show
  `AROVERPAYMENTPAYMENT` for this case — read-only, Xero sets it itself.)

## New custom fields (Customer Payments module)

- **Xero Processed Refund IDs** (Text) — Books doesn't support custom
  fields on the `payment_refunds` sub-record itself, only on the parent
  Customer Payment, so this tracks which refund(s) have already been synced
  as a comma-separated list (a payment can have more than one refund over
  time).
- **Xero Overpayment ID** (Text) — same comma-separated-list pattern, one
  entry per successfully created Overpayment.

## Trigger — two wrong turns before landing on the right one

1. First attempt: workflow on the **Refund/Credit** module, calling an
   incoming webhook with `${REFUND.DEPOSIT_ID}` as `payment_id`. Turned out
   **Refund/Credit and Expense Refund modules don't actually cover Customer
   Payment refunds** — neither workflow ever fired.
2. **Final, working trigger:** ordinary **Customer Payments → On Update**
   workflow — no special module or merge field needed at all. The function
   itself loops `payment_refunds` and skips anything already recorded in
   `cf_xero_processed_refund_ids`, so it's safe to fire on every payment
   save; unprocessed refunds just get skipped as fast no-ops.

## Bugs found and fixed during live testing

1. **Idempotency check was commented out** during an earlier debug pass —
   left disabled, this caused the function's own closing write-back to
   re-trigger its own "On Update" workflow, reprocessing the same refund
   repeatedly (visible live: `cf_xero_processed_refund_ids` showed the same
   ID twice). Fixed: re-enabled the `if(processedRefundIds.contains(refundId)) continue;` skip.
2. **A refund was marked "processed" unconditionally**, even when the Xero
   call had failed — permanently hiding failures from ever being retried.
   Fixed: the `processedRefundIds` (and `xeroOverpaymentIds`) append now
   only happens inside the `if(overpaymentId != "")` success branch.
3. **Wrong extraction path for the created Overpayment ID.** Two compounding
   mistakes: (a) assumed a nested `BankTransactions[0].Overpayments[0]`
   array that doesn't exist — `OverpaymentID` sits directly on the
   BankTransaction object; (b) the call used `detailed:true` (added for
   debugging visibility), which wraps the real Xero JSON one level deeper
   under `.responseText` — the extraction needed to account for both.
   Confirmed live: Xero had actually returned `200 OK` with a valid
   `OverpaymentID` the whole time; the bug was purely in reading it back out.
4. **Wrong field name for linking the refund Payment to the Overpayment** —
   initial guess was `"Invoice":{"OverpaymentID":...}` (following the
   pattern used for regular invoice payments). Confirmed wrong, and
   confirmed the correct field, by pulling Xero's actual OpenAPI schema
   directly (`Xero-OpenAPI/xero_accounting.yaml` on GitHub) rather than
   continuing to guess from docs pages that don't render for fetching:
   `"Overpayment":{"OverpaymentID":...}` is its own dedicated top-level key.

## Final function (entity: `customer_payment`)

```deluge
paymentID = customer_payment.get("payment_id");
organizationID = organization.get("organization_id");
paymentDetails = zoho.books.getRecordsByID("customerpayments",organizationID,paymentID,"zohobooksconnection");
paymentInfo = paymentDetails.get("payment");

processedRefundIds = "";
xeroOverpaymentIds = "";
for each  customField in paymentInfo.get("custom_fields")
{
	if(customField.get("api_name") == "cf_xero_overpayment_id")
	{
		xeroOverpaymentIds = ifnull(customField.get("value"),"");
	}
	if(customField.get("api_name") == "cf_xero_processed_refund_ids")
	{
		processedRefundIds = ifnull(customField.get("value"),"");
	}
}

xeroRefreshToken = zoho.crm.getOrgVariable("xeroRefreshToken");
response = invokeurl
[
	url :"https://identity.xero.com/connect/token"
	type :POST
	parameters:{"grant_type":"refresh_token","refresh_token":xeroRefreshToken,"client_id":"6793DCCECBC842A78F4823D608636FFD","client_secret":"v8ATq7H7hiOn63lryHETiXz6UtkCQZookKUD3tjAMcf4uoQE"}
	headers:{"Content-Type":"application/x-www-form-urlencoded"}
];
xeroRefreshTokenVariable = Map();
xeroRefreshTokenVariable.put("id","6503357000009423001");
xeroRefreshTokenVariable.put("value",response.get("refresh_token"));
variables_list = List();
variables_list.add(xeroRefreshTokenVariable);
param = Map();
param.put("variables",variables_list);
responseVariableUpdate = invokeurl
[
	url :"https://www.zohoapis.com/crm/v7/settings/variables"
	type :PUT
	parameters:param.toString()
	connection:"zohocrmconnection"
];
headersData = Map();
headersData.put("xero-tenant-id","879c4d25-cee8-46c1-89f9-80dcfe572eb2");
headersData.put("Authorization","Bearer " + response.get("access_token"));
headersData.put("Accept","application/json");
headersData.put("Content-Type","application/json");
xeroAccounts = getUrl("https://api.xero.com/api.xro/2.0/Accounts",headersData);

customerDetails = zoho.books.getRecordsByID("contacts",organizationID,paymentInfo.get("customer_id"),"zohobooksconnection");
customerDetails = customerDetails.get("contact");
xeroContactId = "";
for each  customField in customerDetails.get("custom_fields")
{
	if(customField.get("api_name") == "cf_xero_contact_id" && customField.get("value") != null && customField.get("value") != "")
	{
		xeroContactId = customField.get("value");
		break;
	}
}
if(xeroContactId == "")
{
	createContactData = Map();
	createContactData.put("Name",customerDetails.get("contact_name"));
	createContactInXero = postUrl("https://api.xero.com/api.xro/2.0/Contacts",createContactData.toString(),headersData);
	try
	{
		xeroContactId = createContactInXero.get("Contacts").get(0).get("ContactID");
	}
	catch (e)
	{
		xeroContactId = createContactInXero.get("Elements").get(0).get("ContactID");
	}
	contactFieldMap = Map();
	contactFieldsList = list();
	xeroContactFieldMap = Map();
	xeroContactFieldMap.put("api_name","cf_xero_contact_id");
	xeroContactFieldMap.put("value",xeroContactId);
	contactFieldsList.add(xeroContactFieldMap);
	contactFieldMap.put("custom_fields",contactFieldsList);
	zoho.books.updateRecord("Contacts",organizationID,paymentInfo.get("customer_id"),contactFieldMap,"zohobooksconnection");
}

xeroBankAccountId = "";
for each  xeroAccount in xeroAccounts.get("Accounts")
{
	if(!isNull(paymentInfo.get("account_name")) && xeroAccount.get("Name").toLowerCase() == paymentInfo.get("account_name").toLowerCase())
	{
		xeroBankAccountId = xeroAccount.get("AccountID");
		break;
	}
}

for each  refundEntry in paymentInfo.get("payment_refunds")
{
	refundId = refundEntry.get("payment_refund_id");
	if(processedRefundIds.contains(refundId))
	{
		continue;
	}
	refundAmount = refundEntry.get("amount_bcy");
	if(refundAmount == null || refundAmount == 0)
	{
		continue;
	}

	overpaymentLineItem = Map();
	overpaymentLineItem.put("Description","Overpayment - " + paymentInfo.get("payment_number"));
	overpaymentLineItem.put("Quantity",1);
	overpaymentLineItem.put("UnitAmount",refundAmount);
	overpaymentLineItem.put("AccountId",xeroBankAccountId);
	overpaymentLineItemList = list();
	overpaymentLineItemList.add(overpaymentLineItem);
	bankTransactionMap = Map();
	bankTransactionMap.put("Type","RECEIVE-OVERPAYMENT");
	bankTransactionMap.put("Contact",{"ContactID":xeroContactId});
	bankTransactionMap.put("Date",paymentInfo.get("date"));
	bankTransactionMap.put("LineItems",overpaymentLineItemList);
	bankTransactionMap.put("BankAccount",{"AccountID":xeroBankAccountId});
	createOverpaymentInXero = invokeurl
	[
		url :"https://api.xero.com/api.xro/2.0/BankTransactions"
		type :POST
		parameters:bankTransactionMap.toString()
		headers:headersData
		detailed:true
	];
	overpaymentId = "";
	try
	{
		overpaymentId = createOverpaymentInXero.get("responseText").get("BankTransactions").get(0).get("OverpaymentID");
	}
	catch (e)
	{
		overpaymentId = "";
	}

	if(overpaymentId != "")
	{
		refundPaymentMap = Map();
		refundPaymentMap.put("Overpayment",{"OverpaymentID":overpaymentId});
		refundPaymentMap.put("Account",{"AccountID":xeroBankAccountId});
		refundPaymentMap.put("Date",refundEntry.get("date"));
		refundPaymentMap.put("Amount",refundAmount);
		createRefundPayment = invokeurl
		[
			url :"https://api.xero.com/api.xro/2.0/Payments"
			type :POST
			parameters:refundPaymentMap.toString()
			headers:headersData
			detailed:true
		];
		xeroOverpaymentIds = xeroOverpaymentIds + overpaymentId + ",";
		processedRefundIds = processedRefundIds + refundId + ",";
	}
}

updateMap = Map();
customFieldsList = list();
fieldMap = Map();
fieldMap.put("api_name","cf_xero_processed_refund_ids");
fieldMap.put("value",processedRefundIds);
customFieldsList.add(fieldMap);
overpaymentIdFieldMap = Map();
overpaymentIdFieldMap.put("api_name","cf_xero_overpayment_id");
overpaymentIdFieldMap.put("value",xeroOverpaymentIds);
customFieldsList.add(overpaymentIdFieldMap);
updateMap.put("custom_fields",customFieldsList);
invokeurl
[
	url :"https://www.zohoapis.com/books/v3/customerpayments/" + paymentID + "?organization_id=" + organizationID
	type :PUT
	parameters:updateMap.toString()
	connection:"zohobooksconnection"
];
resultMap = Map();
resultMap.put("message","Success");
resultMap.put("code",0);
return resultMap;
```

## Related finding logged separately

Xero's daily API rate limit (5,000 calls/day per tenant connection, rolling
24-hour window) was hit during this same day's heavy testing across all
five Xero-sync builds — see [[feedback_xero_daily_rate_limit]]. An empty
response with `responseCode 429` is quota exhaustion, not a code bug.

## Status

Confirmed working live end-to-end 2026-09-04: Overpayment created in Xero,
correctly refunded via a Payment referencing it, both IDs tracked back on
the Books Customer Payment, no duplicate processing.
