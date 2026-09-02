# ZP-TBD-52 — MP Commitment Redesign: Invoice-Level, Fully Automatic

**Source:** `projectDocuments/mp commitment process 09022026.txt`, from Andrea.
**Supersedes:** [[ZP-TBD-50]]'s Contact-level design (the two custom fields
on Contacts and the `addtagtocontact` auto-tag function are both deactivated
— see below).

## Why the original design (ZP-TBD-50) had to change

ZP-TBD-50 put `MP Commitment Letter Date`/`MP Commitment Amount` on the
**deceased/family's** Contact record. Andrea's real-world objection: an MP's
commitment is tied to a *specific invoice*, not a general record — and the
manual "cashier links things together" step she originally asked for turned
out to be, in her words, "not usable." She wants the whole thing to happen
naturally while the cashier is already working on the invoice, with zero
extra steps to remember.

## New design

- **MP = a plain Books Contact** (Customer-type, no commitment fields on it
  at all — same `Pledge-MP` tag from ZP-TBD-50 still applies for finding MP
  contacts).
- **Commitment info moves to the Invoice**, entered directly on the
  **family's own invoice**:
  - `MP Contact` — new Lookup custom field (Module: Customers)
  - `MP Commitment Amount` — new Amount custom field
  - `MP Commitment Letter Date` — new Date custom field
- The cashier's only action: on the family invoice, pick the MP + enter the
  two commitment fields. Everything else happens automatically:
  1. A negative "Third-Party Pledge Contribution" line is added to that same
     family invoice.
  2. A separate invoice is created for the MP, same item, positive amount.
  3. The commitment letter attachment is copied from the family invoice to
     the new MP invoice automatically (no manual re-attach step).
  4. The MP invoice also inherits the family invoice's
     `cf_related_crm_deal_id` (added on request, so the MP invoice carries
     the same CRM bridge as everything else in this org).

## Old setup deactivated

- Contacts custom fields `MP Commitment Letter Date` / `MP Commitment
  Amount` — deactivated, not deleted.
- Workflow "Add Tag to MP Contacts" (`addtagtocontact` function) —
  deactivated.

## Function — `createMPCommitmentInvoice` (entity: `invoice`)

Went through two live-tested rounds of bug fixes after the initial version:

**Round 1 (found live 2026-09-02):** the original idempotency check searched
for an existing MP invoice by `invoice_number`, but this org's Books
numbering settings rejected setting a custom `invoice_number` on the new MP
invoice — so that line was removed during testing, which silently broke the
dedupe check entirely (it could never match anything). **Fixed** by using
`reference_number` instead (free text, not subject to auto-numbering rules)
as the dedupe key, both when creating and when searching.

**Round 2 (found live 2026-09-02):** even with dedupe working, a value
*correction* (e.g. cashier enters $2,000, then corrects it to $3,000) was
appending a second negative line ($2,000 + $3,000 = -$5,000 shown) and
creating a second, separate MP invoice, rather than correcting the existing
ones. **Fixed** by finding the existing pledge line item (matched by
`item_id`) and the existing MP invoice (matched by `reference_number`)
first, and updating them in place — only appending/creating on the genuine
first run for that family invoice. The letter attachment is only copied on
that first run (not re-copied on a later amount-only correction, since the
letter itself doesn't usually change).

```deluge
organizationID = organization.get("organization_id");
invoiceID = invoice.get("invoice_id");
invoiceDetails = zoho.books.getRecordsByID("invoices",organizationID,invoiceID,"zohobooksconnection");
invoiceInfo = invoiceDetails.get("invoice");
mpContactId = "";
commitmentAmount = 0;
letterDate = "";
relatedCrmDealId = "";
for each  customField in invoiceInfo.get("custom_fields")
{
	if(customField.get("api_name") == "cf_mp_contact")
	{
		mpContactId = ifnull(customField.get("value"),"");
	}
	if(customField.get("api_name") == "cf_mp_commitment_amount")
	{
		commitmentAmount = ifnull(customField.get("value"),0);
	}
	if(customField.get("api_name") == "cf_mp_commitment_letter_date")
	{
		letterDate = ifnull(customField.get("value"),"");
	}
	if(customField.get("api_name") == "cf_related_crm_deal_id")
	{
		relatedCrmDealId = ifnull(customField.get("value"),"");
	}
}
if(mpContactId == "" || commitmentAmount == 0 || letterDate == "")
{
	return;
}
pledgeItemSearch = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/items?name=Third-Party Pledge Contribution&organization_id=" + organizationID
	type :GET
	connection:"zohobooksconnection"
];
pledgeItemId = "";
if(pledgeItemSearch.get("items").size() > 0)
{
	pledgeItemId = pledgeItemSearch.get("items").get(0).get("item_id");
}
mpContactDetails = zoho.books.getRecordsByID("contacts",organizationID,mpContactId,"zohobooksconnection");
mpName = mpContactDetails.get("contact_name");

// 1. Family invoice's own pledge line -- update in place if it already
// exists (find by item_id), only append a new one on the very first run.
existingFamilyLineItems = invoiceInfo.get("line_items");
newFamilyLineItems = list();
foundExistingFamilyLine = false;
for each  lineItem in existingFamilyLineItems
{
	if(lineItem.get("item_id") == pledgeItemId)
	{
		lineItem.put("description","Less: Pledge - " + mpName);
		lineItem.put("rate",commitmentAmount * -1);
		lineItem.put("quantity",1);
		foundExistingFamilyLine = true;
	}
	newFamilyLineItems.add(lineItem);
}
if(!foundExistingFamilyLine)
{
	negativeLineItem = Map();
	negativeLineItem.put("item_id",pledgeItemId);
	negativeLineItem.put("name","Third-Party Pledge Contribution");
	negativeLineItem.put("description","Less: Pledge - " + mpName);
	negativeLineItem.put("rate",commitmentAmount * -1);
	negativeLineItem.put("quantity",1);
	newFamilyLineItems.add(negativeLineItem);
}
familyUpdateMap = Map();
familyUpdateMap.put("line_items",newFamilyLineItems);
updateFamilyInvoice = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/invoices/" + invoiceID + "?organization_id=" + organizationID
	type :PUT
	parameters:familyUpdateMap.toString()
	connection:"zohobooksconnection"
];
//info updateFamilyInvoice;

// 2. The MP's own invoice -- update in place if one already exists for
// this family invoice (found via reference_number), only create fresh the
// first time.
mpReferenceNumber = "MPCOMMIT-" + invoiceID;
existingMpInvoiceCheck = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/invoices?reference_number=" + mpReferenceNumber + "&organization_id=" + organizationID
	type :GET
	connection:"zohobooksconnection"
];
existingMpInvoices = existingMpInvoiceCheck.get("invoices");

mpLineItem = Map();
mpLineItem.put("item_id",pledgeItemId);
mpLineItem.put("name","Third-Party Pledge Contribution");
mpLineItem.put("description","Funeral service contribution - " + ifnull(invoiceInfo.get("customer_name"),""));
mpLineItem.put("rate",commitmentAmount);
mpLineItem.put("quantity",1);
mpLineItemsList = list();
mpLineItemsList.add(mpLineItem);
mpCustomFieldsList = list();
if(relatedCrmDealId != "")
{
	relatedDealFieldMap = Map();
	relatedDealFieldMap.put("api_name","cf_related_crm_deal_id");
	relatedDealFieldMap.put("value",relatedCrmDealId);
	mpCustomFieldsList.add(relatedDealFieldMap);
}

mpInvoiceId = "";
isNewMpInvoice = false;
if(existingMpInvoices.size() > 0)
{
	mpInvoiceId = existingMpInvoices.get(0).get("invoice_id");
	mpUpdateMap = Map();
	mpUpdateMap.put("customer_id",mpContactId);
	mpUpdateMap.put("date",letterDate);
	mpUpdateMap.put("line_items",mpLineItemsList);
	if(mpCustomFieldsList.size() > 0)
	{
		mpUpdateMap.put("custom_fields",mpCustomFieldsList);
	}
	updateMpInvoice = invokeurl
	[
		url :"https://www.zohoapis.com/books/v3/invoices/" + mpInvoiceId + "?organization_id=" + organizationID
		type :PUT
		parameters:mpUpdateMap.toString()
		connection:"zohobooksconnection"
	];
	info updateMpInvoice;
}
else
{
	isNewMpInvoice = true;
	mpInvoiceMap = Map();
	mpInvoiceMap.put("customer_id",mpContactId);
	mpInvoiceMap.put("reference_number",mpReferenceNumber);
	mpInvoiceMap.put("date",letterDate);
	mpInvoiceMap.put("line_items",mpLineItemsList);
	if(mpCustomFieldsList.size() > 0)
	{
		mpInvoiceMap.put("custom_fields",mpCustomFieldsList);
	}
	createMpInvoice = invokeurl
	[
		url :"https://www.zohoapis.com/books/v3/invoices?organization_id=" + organizationID
		type :POST
		parameters:mpInvoiceMap.toString()
		connection:"zohobooksconnection"
	];
	info createMpInvoice;
	try
	{
		mpInvoiceId = createMpInvoice.get("invoice").get("invoice_id");
	}
	catch (e)
	{
		mpInvoiceId = "";
	}
}

// 3. Copy the commitment letter over -- only needed the first time; an
// update to an existing MP invoice doesn't need the letter re-copied.
if(mpInvoiceId != "" && isNewMpInvoice == true)
{
	try
	{
		letterFile = invokeurl
		[
			url :"https://www.zohoapis.com/books/v3/invoices/" + invoiceID + "/attachment?organization_id=" + organizationID
			type :GET
			connection:"zohobooksconnection"
		];
		letterFile.setParamName("attachment");
		uploadLetterToMpInvoice = invokeurl
		[
			url :"https://www.zohoapis.com/books/v3/invoices/" + mpInvoiceId + "/attachment?organization_id=" + organizationID
			type :POST
			files:letterFile
			connection:"zohobooksconnection"
		];
		info uploadLetterToMpInvoice;
	}
	catch (e)
	{
		info e;
	}
}
```

**Workflow:** module Invoices, trigger On Update, criteria: MP Contact is
not empty AND MP Commitment Amount is not empty AND MP Commitment Letter
Date is not empty.

## Field API names confirmed live

`cf_mp_contact` (Lookup → Customers), `cf_mp_commitment_amount` (Amount),
`cf_mp_commitment_letter_date` (Date) — all new on Invoices.
`cf_related_crm_deal_id` and `cf_deceased_name` were pre-existing Invoice
fields (from ZP-TBD-49) reused here, not created new.

## Follow-up needed: ZP-TBD-51 dashboard is now stale

The Outstanding MP Invoices dashboard query (ZP-TBD-51) was written against
the OLD Contact-level fields (joining to a `Customers` "fam" record to pull
commitment amount/letter date by name-matching). Now that those fields live
directly on the invoice, that query needs to be simplified to read
`MP Commitment Amount`/`MP Commitment Letter Date` straight off the same
Invoices row — no more name-matching join needed. **Not yet updated.**

## Status

Confirmed working live 2026-09-02, after fixing both the reference_number
dedupe bug and the append-instead-of-update bug during testing.
