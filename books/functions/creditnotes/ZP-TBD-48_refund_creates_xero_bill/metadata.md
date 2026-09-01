# ZP-TBD-48 — Books Refund → Xero Payable Bill

**Source:** Andrea, via the developer, 2026-09-01. Uses the Howard Morgan credit note
refund (`CN-K-2026-000030`) as the reference example, and asked for the cashier's
refund process to be documented as part of this ticket.

## The ask

> Books refund → Xero → Bill in Xero. The reason is that the refund represents
> money that needs to be paid out. So when the refund is created in Books, it
> should sync to Xero, and Xero should create a Bill for that refund, telling
> accounting there is money owed and needs to be paid.

## How the cashier creates a refund today (documented from the Howard Morgan example)

Organization: Delapenha Funeral Home Ltd, Books org id `872327358`.

1. Cashier creates a **Credit Note** against the customer's invoice (Howard
   Morgan's `CN-K-2026-000030`, credited against invoice `5830143000031561865`,
   line item "Hearse" $60,869.57 + GCT 15% $9,130.44 = **$70,000 total**).
2. Credit Note creation fires an existing function,
   **`addtocontraaccountfornewcreatedcreditnote`** (workflow "updateCreditNoteToContraBank"),
   which re-routes the credit note's line items onto account id
   `5830143000000594545` ("CONTRA ACCOUNT") and pushes a **prepayment** into
   Xero via the incoming webhook `iw_createprepaymentinxerofromc`. This records
   "credit is owed to this customer" in Xero — not yet a cash outflow.
3. Separately, the cashier opens the same Credit Note and records a **Refund**
   against it: refund mode "Bank Transfer BNS 8811", a free-text reference
   ("Refund on Hearse") and a free-text description carrying the actual payee's
   bank details (here, a third party — "TAMARA HOLT, Bank Of Nova Scotia,
   A/C #000432999, Falmouth Branch" — not Howard Morgan himself). This is the
   step where the $70,000 actually leaves the DFH bank account
   (`BNS DFH-Checking`, account id `5830143000000594063`).
4. **Nothing happens in Xero at step 3 today.** The Credit Note record now
   carries the refund inside its `creditnote_refunds` array (confirmed live:
   `refund_id 5830143000034707671`, `amount_bcy 70000`), but no Bill, and no
   further Xero call, is ever made for it.

## Root architecture insight — why this is a small fix, not a new pipeline

A mature, already-working function, **`createbillinxero`** (workflow "Create
Bill in Xero", entity `bill`), already pushes any Books **Bill** to Xero as a
proper Accounts Payable ("ACCPAY") invoice — creates/matches the Xero contact
via the `cf_xero_contact_id` custom field, maps chart-of-accounts and tax,
handles write-offs/rounding, and even triggers Xero payment reconciliation
afterward via the `iw_createpaymentsonxeroforbill` webhook.

So the only missing piece is: **nothing today creates a Books Bill when a
refund happens.** Once a Bill exists, the existing pipeline carries it to
Xero automatically — no new Xero-side code needed at all.

## Decisions confirmed with the developer (2026-09-01)

1. **Vendor on the new Bill = paired with the customer** — see the revision
   below; the original plan (bill the customer's own contact directly) turned
   out to be impossible in current Zoho Books and was superseded.
2. **Line item account = the same CONTRA ACCOUNT** (`5830143000000594545`)
   already used by the credit note flow, for consistency.

## Revision — "Both" contact type does not exist in Zoho Books

First attempt used `creditNoteInfo.get("customer_id")` directly as the Bill's
`vendor_id`. Live test failed: `{"code":118138,"message":"Please enter a
valid vendor ID"}` — Howard Morgan's contact is `contact_type: "customer"`,
and Books' Bills API requires a Vendor-type contact.

Tried a follow-up fix (PUT the contact's `contact_type` to `"both"`) — same
error persisted. Confirmed via Zoho's own community docs: **Zoho Books
removed the "Both" contact type entirely.** A contact is either a Customer or
a Vendor; the supported pattern for a contact who is sometimes billed as a
payee is a **separate, linked Vendor contact** with the same name (Books'
"Link to Customer/Vendor" UI feature) — there is no single "both" record.

**Resolved with the developer:** the function auto-creates a paired Vendor
contact (same name as the customer) the first time it's needed, and reuses it
on future refunds via a name search — no manual per-customer setup step.
Books' "Link to Customer/Vendor" display association is UI-only as far as
could be confirmed (no documented public API for it), so it's left as an
optional manual cosmetic step, not required for the Bill/Xero flow to work.

## New function — `createBillOnCreditNoteRefund`

Entity: `creditnote`. Same call signature Books uses for its other custom
functions (`creditnote`, `organization`, `user` — all `${JSONString}` maps),
matching `addtocontraaccountfornewcreatedcreditnote`'s existing pattern.

Loops every refund already recorded on the Credit Note (not just the latest),
so it's safe to re-run if the workflow fires more than once — each refund
gets its own Bill, keyed by a unique bill number so re-runs don't duplicate.

```deluge
/*
Creates a Books Bill (vendor = an auto-created/reused Vendor contact paired
with the customer by name) for every refund recorded on this Credit Note that
doesn't already have a Bill. The existing "Create Bill in Xero"
function/workflow then pushes that Bill to Xero automatically as an Accounts
Payable bill -- no direct Xero call needed here.
*/
creditnoteID = creditnote.get("creditnote_id");
organizationID = organization.get("organization_id");
creditNoteDetails = zoho.books.getRecordsByID("creditnotes",organizationID,creditnoteID,"zohobooksconnection");
creditNoteInfo = creditNoteDetails.get("creditnote");
customerName = creditNoteInfo.get("customer_name");
vendorSearch = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/contacts?search_text=" + customerName.replace(" ","%20") + "&organization_id=" + organizationID
	type :GET
	connection:"zohobooksconnection"
];
vendorId = "";
for each  foundContact in vendorSearch.get("contacts")
{
	if(foundContact.get("contact_type") == "vendor" && foundContact.get("contact_name") == customerName)
	{
		vendorId = foundContact.get("contact_id");
		break;
	}
}
if(vendorId == "")
{
	newVendorMap = Map();
	newVendorMap.put("contact_name",customerName);
	newVendorMap.put("contact_type","vendor");
	createVendorResponse = invokeurl
	[
		url :"https://www.zohoapis.com/books/v3/contacts?organization_id=" + organizationID
		type :POST
		parameters:newVendorMap.toString()
		connection:"zohobooksconnection"
	];
	vendorId = createVendorResponse.get("contact").get("contact_id");
}
refundList = ifnull(creditNoteInfo.get("creditnote_refunds"),list());
for each  refundEntry in refundList
{
	refundId = refundEntry.get("creditnote_refund_id");
	refundAmount = refundEntry.get("amount_bcy");
	if(refundAmount == null || refundAmount == 0)
	{
		continue;
	}
	billNumber = "REFUND-" + refundId;
	existingBillCheck = invokeurl
	[
		url :"https://www.zohoapis.com/books/v3/bills?bill_number=" + billNumber + "&organization_id=" + organizationID
		type :GET
		connection:"zohobooksconnection"
	];
	if(existingBillCheck.get("bills").size() > 0)
	{
		continue;
	}
	lineItemMap = Map();
	lineItemMap.put("account_id","5830143000000594545");
	lineItemMap.put("name","Refund payable - " + creditNoteInfo.get("creditnote_number"));
	lineItemMap.put("description",ifnull(refundEntry.get("reference_number"),"") + " - " + ifnull(refundEntry.get("description"),""));
	lineItemMap.put("rate",refundAmount);
	lineItemMap.put("quantity",1);
	lineItemList = list();
	lineItemList.add(lineItemMap);
	billMap = Map();
	billMap.put("vendor_id",vendorId);
	billMap.put("bill_number",billNumber);
	billMap.put("date",refundEntry.get("date"));
	billMap.put("line_items",lineItemList);
	createBillResponse = invokeurl
	[
		url :"https://www.zohoapis.com/books/v3/bills?organization_id=" + organizationID
		type :POST
		parameters:billMap.toString()
		connection:"zohobooksconnection"
	];
	info createBillResponse;
}
```

## Workflow trigger to add in Zoho Books

New workflow rule, module **Credit Notes**, trigger **On Update**, criteria
**"Total Refunded Amount" is not 0** (or, if the Books workflow builder offers
a "field updated" trigger specifically for that field, prefer that — it fires
only on the actual change rather than every unrelated edit to the credit
note). Action: execute `createBillOnCreditNoteRefund`.

## Status

Guideline delivered 2026-09-01, currently mid-iteration on the live test
(Howard Morgan's refund) — two rounds of the `vendor_id` error worked through
above, current version (auto-create/reuse a paired Vendor contact) not yet
confirmed working live. Once it passes: confirm (a) a Bill appears in Books
numbered `REFUND-5830143000034707671` billed to a Vendor contact named
"Howard Morgan", and (b) it shows up in Xero as an ACCPAY bill shortly after,
via the existing `createbillinxero` pipeline.
