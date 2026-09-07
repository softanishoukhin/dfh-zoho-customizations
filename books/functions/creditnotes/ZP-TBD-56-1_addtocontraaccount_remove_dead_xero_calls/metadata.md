# ZP-TBD-56-1 — Remove dead Xero calls from `addtocontraaccountfornewcreatedcreditnote`

**Source:** first fix from the ZP-TBD-56 Xero API call-volume audit, item #5
in its prioritized list.

## What was live

`addtocontraaccountfornewcreatedcreditnote` (function id `5830143000004786013`,
entity `creditnote`, trigger workflow `updateCreditNoteToContraBank`) did two
things:

1. **Real, active work**: rewrite the credit note's own line items to point at
   a contra bank account (`account_id: 5830143000000594545`) and PUT that back
   to Books. This is the function's actual job.
2. **Fully wasted work**: a Xero token refresh (2 calls: `identity.xero.com`
   POST + CRM org-variable PUT), a Xero Accounts fetch, a Xero TaxRates fetch,
   and — not previously noticed in the original audit pass — **a Books
   `items` lookup per line item in a loop**. All of it fed into building
   `prePaymentItemList`, whose only consumer (`xeroCreditNoteMap.put(
   "LineItems", prePaymentItemList)`) sat inside a fully commented-out block
   (the real Xero Credit Note + Allocation creation, superseded by ZP-TBD-54's
   `createprepaymentinxerofromcreditnote` webhook). None of it was reachable.
   `creditNoteDate` was also dead — declared, never referenced anywhere,
   including in the commented-out code.

## Fix applied

Replaced the function body, keeping only the real contra-account
reclassification:

```deluge
creditnoteID = creditnote.get("creditnote_id");
organizationID = organization.get("organization_id");
creditNoteDetails = zoho.books.getRecordsByID("creditnotes",organizationID,creditnoteID,"zohobooksconnection");
creditNoteInfo = creditNoteDetails.get("creditnote");

newLineItemsList = list();
for each  line_item in creditNoteInfo.get("line_items")
{
	newLineItemMap = Map();
	newLineItemMap.put("item_id",line_item.get("item_id"));
	newLineItemMap.put("account_id","5830143000000594545");
	newLineItemMap.put("quantity",line_item.get("quantity"));
	newLineItemMap.put("rate",line_item.get("rate"));
	newLineItemMap.put("discount",line_item.get("discount"));
	newLineItemMap.put("tax_id",line_item.get("tax_id"));
	newLineItemsList.add(newLineItemMap);
}
parameters_data = Map();
parameters_data.put("line_items",newLineItemsList);
response = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/creditnotes/" + creditnoteID + "?organization_id=" + organizationID
	type :PUT
	parameters:parameters_data.toString()
	connection:"zohobooksconnection"
	content-type:"application/json"
];
```

**Behavior change: none.** Every removed line either fed dead code or was
never referenced. Per credit note, call count drops from ~4 Xero calls + N
per-line-item Books lookups + 2 Books calls, down to just the 2 Books calls
(get + update).

## Status

Applied live 2026-09-04, confirmed by developer.
