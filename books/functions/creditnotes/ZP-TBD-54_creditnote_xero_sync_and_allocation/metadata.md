# ZP-TBD-54 — Books Credit Note → Real Xero Credit Note, Allocated to Invoice

**Source:** developer request, following on from ZP-TBD-48 (refund → Xero Bill).
Reference: [Xero Accounting API — Credit Notes](https://developer.xero.com/documentation/api/accounting/creditnotes#post-creditnotes).

## The ask

The existing Xero sync for Books Credit Notes only ever pushed a **prepayment**
into Xero (via `addtocontraaccountfornewcreatedcreditnote` calling the
incoming webhook `iw_createprepaymentinxerofromc`) — a prepayment just means
"credit is owed," it isn't a real Credit Note transaction and isn't linked
to any invoice. The ask: create a genuine Xero Credit Note, with real tax,
and allocate it against the specific invoice it was actually applied to in
Books.

## Final architecture (changed during build — see below)

Initial version put the Xero Credit Note logic directly inside
`addtocontraaccountfornewcreatedcreditnote` (fires on **Credit Note create**).
**Moved during testing** to fire instead from the **Invoice** side: when a
credit note is applied to an invoice, the invoice's due amount changes,
which already fires the existing `updateInvoiceToXero` workflow — that now
also calls a new incoming webhook, **`createprepaymentinxerofromcreditnote`**
(name is legacy/misleading — it creates a real Credit Note now, not a
prepayment), passing `creditnote_id` as a param. This is more reliable than
firing on Credit Note creation, since `invoices_credited` is only guaranteed
populated once the credit note is actually applied to an invoice.

The old prepayment webhook call in `addtocontraaccountfornewcreatedcreditnote`
is commented out (not deleted), per the user's own change.

## New Credit Note custom field

**Xero Credit Note ID** (Text, single line) — api_name confirmed live:
`cf_xero_credit_note_id`. Mirrors the existing `Xero Invoice ID`
(`cf_xero_invoice_id`) pattern on Invoices.

## Bugs found and fixed during live testing

1. **Tax amount not coming through initially** — an early version looked up
   tax by matching the *Item's* default `tax_name` (via a separate
   `zoho.books.getRecordsByID("items", ...)` call) against Xero's TaxRates
   list. Final version reads `tax_name`/`account_name` directly off the
   **credit note's own line item** instead — simpler (no extra API call per
   line) and more accurate (reflects what was actually applied on this
   specific transaction, not just the item's default).
2. **Allocation call returned an empty-body 404** — root cause: used `POST`
   for `.../CreditNotes/{id}/Allocations`. Confirmed via Xero's own docs
   community/GitHub issues that this endpoint requires **`PUT`**, not POST.
   Fixed by switching that one call from the `postUrl()` shorthand (always
   POST) to `invokeurl` with `type: PUT`.
3. **Wrong custom field api_name guessed initially** (`cf_xero_creditnote_id`,
   no underscore between credit/note) — corrected to the real live value,
   `cf_xero_credit_note_id`.

## Final function — `createprepaymentinxerofromcreditnote` (incoming webhook)

```deluge
creditnoteID = params.get("creditnote_id");
organizationID = organization.get("organization_id");
creditNoteDetails = zoho.books.getRecordsByID("creditnotes",organizationID,creditnoteID,"zohobooksconnection");
creditNoteInfo = creditNoteDetails.get("creditnote");
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
xeroTaxes = getUrl("https://api.xero.com/api.xro/2.0/TaxRates",headersData);
prePaymentItemList = list();
for each  line_item in creditNoteInfo.get("line_items")
{
	prePaymentItemMap = Map();
	prePaymentItemMap.put("AccountId","2ab8922c-9fa6-4f2f-9c53-49e03bc6acdf");
	for each  xeroAccount in xeroAccounts.get("Accounts")
	{
		if(!isNull(line_item.get("account_name")) && xeroAccount.get("Name").toLowerCase() == line_item.get("account_name").toLowerCase())
		{
			xeroChartOfAccountID = xeroAccount.get("AccountID");
			prePaymentItemMap.put("AccountId",xeroChartOfAccountID);
			break;
		}
	}
	prePaymentItemMap.put("TaxType","NONE");
	for each  xeroTax in xeroTaxes.get("TaxRates")
	{
		if(!isNull(line_item.get("tax_name")) && xeroTax.get("Name").toLowerCase() == line_item.get("tax_name").toLowerCase())
		{
			xeroTaxType = xeroTax.get("TaxType");
			prePaymentItemMap.put("TaxType",xeroTaxType);
			break;
		}
	}
	prePaymentItemMap.put("Description",line_item.get("name"));
	prePaymentItemMap.put("Quantity",line_item.get("quantity"));
	prePaymentItemMap.put("UnitAmount",line_item.get("rate"));
	prePaymentItemMap.put("DiscountAmount",line_item.get("discount_amount"));
	prePaymentItemList.add(prePaymentItemMap);
}
customerDetails = zoho.books.getRecordsByID("contacts",organizationID,creditNoteInfo.get("customer_id"),"zohobooksconnection");
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
if(xeroContactId == "" || xeroContactId == "00000000-0000-0000-0000-000000000000")
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
	updateContactFieldMap = Map();
	updateContactCustomFieldsList = list();
	contactFieldMap = Map();
	contactFieldMap.put("api_name","cf_xero_contact_id");
	contactFieldMap.put("value",xeroContactId);
	updateContactCustomFieldsList.add(contactFieldMap);
	updateContactFieldMap.put("custom_fields",updateContactCustomFieldsList);
	zoho.books.updateRecord("Contacts",organizationID,creditNoteInfo.get("customer_id"),updateContactFieldMap,"zohobooksconnection");
}
xeroCreditNoteMap = Map();
xeroCreditNoteMap.put("Type","ACCRECCREDIT");
xeroCreditNoteMap.put("Contact",{"ContactID":xeroContactId});
xeroCreditNoteMap.put("Date",creditNoteInfo.get("date"));
xeroCreditNoteMap.put("Status","AUTHORISED");
xeroCreditNoteMap.put("LineItems",prePaymentItemList);
createCreditNoteInXero = postUrl("https://api.xero.com/api.xro/2.0/CreditNotes",xeroCreditNoteMap.toString(),headersData);
xeroCreditNoteId = "";
try
{
	xeroCreditNoteId = createCreditNoteInXero.get("CreditNotes").get(0).get("CreditNoteID");
}
catch (e)
{
	xeroCreditNoteId = "";
}
if(xeroCreditNoteId != "")
{
	creditNoteFieldMap = Map();
	creditNoteCustomFieldsList = list();
	xeroCreditNoteFieldMap = Map();
	xeroCreditNoteFieldMap.put("api_name","cf_xero_credit_note_id");
	xeroCreditNoteFieldMap.put("value",xeroCreditNoteId);
	creditNoteCustomFieldsList.add(xeroCreditNoteFieldMap);
	creditNoteFieldMap.put("custom_fields",creditNoteCustomFieldsList);
	updateCreditNoteXeroId = invokeurl
	[
		url :"https://www.zohoapis.com/books/v3/creditnotes/" + creditnoteID + "?organization_id=" + organizationID
		type :PUT
		parameters:creditNoteFieldMap.toString()
		connection:"zohobooksconnection"
	];
}
if(xeroCreditNoteId != "")
{
	for each  creditedInvoice in creditNoteInfo.get("invoices_credited")
	{
		booksInvoiceDetails = zoho.books.getRecordsByID("invoices",organizationID,creditedInvoice.get("invoice_id"),"zohobooksconnection");
		booksInvoiceDetails = booksInvoiceDetails.get("invoice");
		xeroInvoiceId = "";
		for each  invField in booksInvoiceDetails.get("custom_fields")
		{
			if(invField.get("api_name") == "cf_xero_invoice_id")
			{
				xeroInvoiceId = ifnull(invField.get("value"),"");
			}
		}
		if(xeroInvoiceId != "")
		{
			allocationMap = Map();
			allocationLineMap = Map();
			allocationLineMap.put("Invoice",{"InvoiceID":xeroInvoiceId});
			allocationLineMap.put("Amount",creditedInvoice.get("credited_amount"));
			allocationLineMap.put("Date",creditNoteInfo.get("date"));
			allocationList = list();
			allocationList.add(allocationLineMap);
			allocationMap.put("Allocations",allocationList);
			createAllocation = invokeurl
			[
				url :"https://api.xero.com/api.xro/2.0/CreditNotes/" + xeroCreditNoteId + "/Allocations"
				type :PUT
				parameters:allocationMap.toString()
				headers:headersData
			];
		}
	}
}
resultMap = Map();
resultMap.put("message","Success");
resultMap.put("code",0);
return resultMap;
```

## Known limitation / prerequisite

Allocation only happens if the credited invoice already has its own
`cf_xero_invoice_id` populated — i.e. that invoice must have already been
synced to Xero via the existing `createinvoiceonxero` flow *before* the
credit note is applied. If an invoice is credited before it's ever synced to
Xero, the Credit Note is still created in Xero but left unallocated (no
error, just silently skipped per the `if(xeroInvoiceId != "")` guard).

## Status

Confirmed working live 2026-09-03, including real tax amounts and correct
allocation against the originating invoice.
