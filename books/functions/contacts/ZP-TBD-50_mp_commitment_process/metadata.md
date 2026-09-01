# ZP-TBD-50 — MP Commitment Split Invoicing

**Source:** `projectDocuments/mp commitment process.txt`, from Andrea.

## The ask

When a Member of Parliament (MP) commits to paying part of a funeral bill,
Andrea wants "split invoicing" — two separate invoices (one to the family for
their reduced portion, one to the MP for their committed portion) instead of
one invoice with an informal note. See the source file for the full worked
example ($200,000 funeral, family pays $150,000, MP pays $50,000).

## Scope breakdown

This request splits into three kinds of work:

**A. One-time Books setup** (done, see Status below):
- MP customer placeholders (MP #1, MP #2, ...) tagged `Pledge-MP`
- Two Contact custom fields: `cf_mp_commitment_letter_date` (Date),
  `cf_mp_commitment_amount` (Amount) — deliberately on the Contact record,
  not the invoice, per Andrea's explicit requirement
- Reporting Tag "Commitment Status" with option "MP Commitment"
  (`tag_id 5830143000000000335`, `option_id 5830143000035287212`)
- Service-type Item "Third-Party Pledge Contribution" (used with a negative
  amount on the family invoice, positive on the MP invoice — same item,
  same income account, so revenue recognition still totals correctly with
  no double-counting)

**B. A cashier SOP** (documentation, not automation — Andrea's design is
deliberately manual at these steps): upload the commitment letter to the
Contact, add the negative pledge line to the family invoice, create the MP's
own invoice with the same item positive, re-attach the letter to it, and use
Books' existing Aged Receivables / Customer Statements / Payment Reminders to
collect from the MP.

**C. One real automation** — entity `contact`. Function
`addtagtocontact`, workflow **"Add Tag to MP Contacts"**:

```deluge
organizationID = organization.get("organization_id");
contactID = contact.get("contact_id");
contactDetails = zoho.books.getRecordsByID("contacts",organizationID,contactID,"zohobooksconnection");
contactDetails = contactDetails.get("contact");
letterDate = "";
commitmentAmount = 0;
for each  customField in contactDetails.get("custom_fields")
{
	if(customField.get("api_name") == "cf_mp_commitment_letter_date")
	{
		letterDate = ifnull(customField.get("value"),"");
	}
	if(customField.get("api_name") == "cf_mp_commitment_amount")
	{
		commitmentAmount = ifnull(customField.get("value"),0);
	}
}
if(letterDate == "" || commitmentAmount == 0)
{
	return;
}
existingTags = ifnull(contactDetails.get("tags"),list());
mpCommitmentTagId = "5830143000000000335";
mpCommitmentTagOptionId = "5830143000035287212";
alreadyTagged = false;
for each  existingTag in existingTags
{
	if(existingTag.get("tag_option_id") == mpCommitmentTagOptionId)
	{
		alreadyTagged = true;
		break;
	}
}
if(alreadyTagged == true)
{
	return;
}
newTagMap = Map();
newTagMap.put("tag_id",mpCommitmentTagId);
newTagMap.put("tag_option_id",mpCommitmentTagOptionId);
existingTags.add(newTagMap);
tagUpdateMap = Map();
tagUpdateMap.put("tags",existingTags);
updateContactTags = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/contacts/" + contactID + "?organization_id=" + organizationID
	type :PUT
	parameters:tagUpdateMap.toString()
	connection:"zohobooksconnection"
];
info updateContactTags;
```

Workflow trigger: module **Contacts**, **On Update**, criteria "MP Commitment
Amount" is not empty AND "MP Commitment Letter Date" is not empty.

## Status

Confirmed live 2026-09-01, verified directly:
- Both custom fields confirmed via `get_fields_meta` — exact api_names match
  the function (`cf_mp_commitment_letter_date`, `cf_mp_commitment_amount`).
- `addtagtocontact` confirmed live via `list_custom_functions`/
  `get_custom_function`, code matches (with one correct addition already
  applied: unwrapping `contactDetails.get("contact")` from the API response,
  needed because `zoho.books.getRecordsByID` wraps a single contact under a
  `"contact"` key).
- Tag "Commitment Status" / option "MP Commitment" confirmed via `get_tags` /
  `get_all_tag_options`.
- "Third-Party Pledge Contribution" Item and MP customer placeholders
  confirmed done by the user directly (not independently verified via API —
  no item-list tool was available in this session's toolset).

Cashier SOP (part B) delivered to the developer as a step-by-step document,
not yet formally handed to staff.

## Addendum 2026-09-01 — Outstanding MP Invoices Dashboard (ZP-TBD-51)

Andrea's follow-up ask: a dashboard showing all unpaid MP invoices (Deceased
Name, Funeral Date, MP Commitment Amount, MP Commitment Letter Date). See
`analytics/reports/ZP-TBD-51_outstanding_mp_invoices_dashboard/metadata.md`
for the full design.

**SOP update (Step 5, creating the MP's own invoice):** the cashier must also
fill in the **"DECEASED NAME"** custom field on the MP invoice (this field
already exists on every invoice in this org — it's the same one used for the
Funeral GCT Report). This is what lets the dashboard match "this MP invoice"
back to "this deceased's commitment info" reliably, since Andrea's rule keeps
the commitment fields off the invoice itself — no new field needed, just an
extra fill-in step using something that was already there.
