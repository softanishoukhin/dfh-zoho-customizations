# Plot # flow: Deal → Headstone Form → Vendor

**Andrea's ask (2026-08-28, Headstone request process series, Task 2):** when the Plot # becomes
available on a Deal, it should flow onto the Headstone Form as read-only, and the vendor should
get an email saying the Plot # has been assigned, with a button to view the updated form.
Trigger: `Plot_No` field changes from blank → has a value. She specifically asked that the CRM
trigger side go through `automation.handleWorkflowTriggerAndActionByTimelineProcess` (the
existing generic any-Deal-edit dispatcher), matching the convention already used for every other
field-driven action in this org.

**Which field:** `Deals.Plot_No` (label "Plot No.") — confirmed with the user over the other
candidate, `Deals.Plot` (a separate, unrelated text field).

## Live-verified pieces this reuses

Read `Headstone_Request.ds` in full (confirmed current). Key facts that shape this design:
- `Headstone_Request_Form` (Creator) has no `Plot_No` field today — needs adding.
- Each Deal can have **more than one** `Headstone_Request_Form` record — one per Hillview‑1
  vendor (`createFormRecordAndNotifyVendor` inserts one per distinct vendor found on the Deal's
  Hillview‑1 product lines). Both `deal_id` and `vendor_id` are plain text fields on the form (no
  CRM lookup type), so `Headstone_Request_Form[deal_id == crmid]` is the correct query — plural,
  not singular.
- The existing `thisapp.sendEmailToVendor(email, vendorID, dealID, creatorRecordID)` function is
  the proven pattern for vendor email: it fetches a CRM Vendors-module email template by id via
  REST, does **text substitution** on literal placeholder strings baked into the template body
  (`${!Vendors.id}` → vendor id, `kPzioASdoC9fvRK0` → deal id — these are not real CRM merge
  fields, they're placeholder text the template author put in the button's href, replaced with
  Deluge `.replaceAll()`), then sends via `Vendors/{id}/actions/send_mail`. Pulled the actual live
  template (id `6503357000032002034`, "Headstone Request for Vendor") via the CRM API to confirm
  its exact body — it's just an empty paragraph placeholder plus a "Headstone Form" button
  linking to `Headstone_Form_Page?Is_Vendor=yes&vendor_id=${!Vendors.id}&deal_id=kPzioASdoC9fvRK0`.
- CRM already calls into Creator via a public Custom API + `getUrl(...)`, e.g.
  `manageZeroRatedHeadstoneProduct`'s call to `Notify_Headstone_Vendor` — same pattern reused
  here, so `handleWorkflowTriggerAndActionByTimelineProcess` doesn't need to touch the Creator
  Data API directly.

## Design

**CRM side:** one new branch inside `handleWorkflowTriggerAndActionByTimelineProcess`, calling a
new Creator Custom API. **Creator side:** the new Custom API updates every `Headstone_Request_Form`
record for that Deal and sends the vendor notification, using a **new** email template (mirroring
the existing one, different wording) and a new function that mirrors `sendEmailToVendor`.

### Step 1 — new field on `Headstone_Request_Form` (`.ds`, apply directly in Creator)
```
Plot_No
(
	type = text
	displayname = "Plot #"
	read only = true
	row = 1
	column = 1
	width = medium
)
```
Place it next to `Deceased_Name`/`Date_of_Birth` in the top section. **Note:** verify `read only
= true` is accepted by this Creator version when you add the field in the UI — if the field
builder doesn't expose that as a direct property, use a **Form Rule** instead (On Load → make
`Plot_No` read-only), which is the standard, always-available way to lock a field down for every
viewer including the vendor. Either approach is fine; just confirm the field truly can't be
edited by the vendor or family once live.

### Step 2 — new CRM Email Template (Vendors module)
Duplicate the existing "Headstone Request for Vendor" template (id `6503357000032002034`) via
CRM Setup → Templates, rename it e.g. "DFH - Plot Number Assigned", and change its content to:
- Subject: `DFH - Plot Number Assigned`
- Body: replace the empty placeholder paragraph with something like *"The Plot # has been
  assigned: **kPzioASdoC9fvPLT**"* (a new literal placeholder token — pick anything sufficiently
  unique that would never appear in real content by coincidence; the exact string used here is
  just an example, keep it consistent with whatever you pick).
- Keep the same button, same href (`...?Is_Vendor=yes&vendor_id=${!Vendors.id}&deal_id=kPzioASdoC9fvRK0`)
  — no changes needed there, the vendor still lands on the same Headstone Form page.

Note the new template's id once created — it goes into Step 3.

### Step 3 — new Creator function, mirrors `sendEmailToVendor` exactly
```
void notifyVendorPlotNumberAssigned(string email, string vendorID, string dealID, string plotNo)
{
	templateurl = "https://www.zohoapis.com/crm/v2.1/settings/email_templates/" + "<NEW_TEMPLATE_ID_FROM_STEP_2>";
	templatedata = invokeurl
	[
		url :templateurl
		type :GET
		connection:"zoho_oauth_connection"
	];
	templatecontent = templatedata.get("email_templates").get("0").get("content");
	revisedcontent = templatecontent.replaceAll("\$\{!Vendors.id\}",vendorID).replaceAll("kPzioASdoC9fvRK0",dealID).replaceAll("kPzioASdoC9fvPLT",plotNo);
	response = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v8/settings/variables/6503357000008905011"
		type :GET
		connection:"zoho_oauth_connection"
	];
	fromEmail = response.get("variables").get(0).get("value");
	data_list = List();
	data_map = Map();
	from_map = Map();
	from_map.put("email",fromEmail);
	data_map.put("from",from_map);
	to_list = List();
	to_map = Map();
	to_map.put("email",email);
	to_list.add(to_map);
	data_map.put("to",to_list);
	data_map.put("org_email",true);
	data_map.put("subject","DFH - Plot Number Assigned");
	data_map.put("content",revisedcontent);
	data_map.put("mail_format","html");
	data_list.add(data_map);
	req_map = Map();
	req_map.put("data",data_list);
	sendMailResult = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v8/Vendors/" + vendorID + "/actions/send_mail"
		type :POST
		parameters:req_map.toString()
		connection:"zoho_oauth_connection"
	];
}
```
Add this alongside `sendEmailToVendor` in the same `Headstone_Request_Form` script section.

### Step 4 — new Creator Custom API, updates every form record for the Deal and notifies each vendor
```
map Update_Plot_Number_And_Notify_Vendor(string crmid, string plotNo)
{
	response = Map();
	if(isNull(crmid) || crmid == "" || isNull(plotNo) || plotNo == "")
	{
		response.put("status","error");
		response.put("message","Missing crmid or plotNo.");
		return response;
	}
	formRecords = Headstone_Request_Form[deal_id == crmid];
	// Determine which vendors to notify directly from the CRM Deal's product lines -- NOT from
	// the Creator record's vendor_id, which is written later and can lag or still be blank at
	// this point. Unlike createFormRecordAndNotifyVendor, this does NOT restrict to "Hillview 1"
	// -- that filter only makes sense for that function's specific job (deciding the immediate-
	// to-vendor routing at intake). By the time a Plot # exists, a Hillview 2/3 Deal may already
	// be at the vendor stage too (after family approval), so any Hillview-tagged product with a
	// vendor counts here.
	dealInfo = zoho.crm.getRecordById("Deals",crmid.toLong());
	existingProducts = ifnull(dealInfo.get("Product_Selection"),list());
	vendorIds = list();
	for each item in existingProducts
	{
		childID = "";
		if(item.contains("Child_Product") && item.get("Child_Product") != null && item.get("Child_Product").contains("id"))
		{
			childID = item.get("Child_Product").get("id");
		}
		if(childID == "")
		{
			continue;
		}
		productInfo = zoho.crm.getRecordById("Products",childID.toLong());
		hillviewGroup = ifnull(productInfo.get("Hillview_Group"),"");
		if(hillviewGroup == "" || hillviewGroup == "-None-")
		{
			continue;
		}
		vendorId = "";
		try
		{
			vendorId = ifnull(productInfo.get("Vendor_Name").get("id"),"");
		}
		catch (eVendor)
		{
			vendorId = "";
		}
		if(vendorId != "" && !vendorIds.contains(vendorId))
		{
			vendorIds.add(vendorId);
		}
	}
	// Notification pass FIRST, against the pre-update Plot_No snapshot still held in
	// formRecords -- must happen before the update pass below, since updating the records
	// first would make every "already sent" check see the NEW value and permanently look
	// like it was already sent, silently killing all future notifications.
	notifiedCount = 0;
	for each vendorId in vendorIds
	{
		// Idempotency: check the matching form record's stored Plot_No, keyed by vendor_id --
		// still fine to read vendor_id here for matching purposes, just not as the source of
		// truth for who to notify.
		alreadySentForThisPlot = false;
		for each formRec in formRecords
		{
			if(ifnull(formRec.vendor_id,"") == vendorId && ifnull(formRec.Plot_No,"") == plotNo)
			{
				alreadySentForThisPlot = true;
			}
		}
		info alreadySentForThisPlot;
		if(!alreadySentForThisPlot)
		{
			try
			{
				vendorInfo = zoho.crm.getRecordById("Vendors",vendorId.toLong());
				vendorEmail = ifnull(vendorInfo.get("Email"),"");
				if(vendorEmail != "")
				{
					thisapp.notifyVendorPlotNumberAssigned(vendorEmail,vendorId,crmid,plotNo);
					notifiedCount = notifiedCount + 1;
				}
			}
			catch (eVendorNotify)
			{
			}
		}
	}
	// Update pass SECOND -- every Headstone_Request_Form record tied to this Deal gets the new
	// Plot_No, regardless of vendor, now that the notification decisions above are locked in.
	updatedCount = 0;
	for each formRec in formRecords
	{
		theRecord = Headstone_Request_Form[ID == formRec.ID];
		theRecord.Plot_No = plotNo;
		updatedCount = updatedCount + 1;
	}
	response.put("status","success");
	response.put("updated",updatedCount);
	response.put("notified",notifiedCount);
	return response;
}
```
Publish this as a **public** Custom API (same visibility as `Notify_Headstone_Vendor`, since CRM
calls it via `getUrl` with a `publickey`, not an authenticated connection). Note the public key
once published — it goes into Step 5.

**Improvement (from the user, after initial deployment):** the first working version determined
which vendor to notify from `formRec.vendor_id` (the Creator record's own field). That's
unreliable — the Creator record's `vendor_id` is written by `createFormRecordAndNotifyVendor`
*after* the record is created, so depending on timing it can still be blank or stale when this
function runs. Fixed to derive the vendor list straight from the CRM Deal's Hillview-1 product
lines instead (the same source of truth `createFormRecordAndNotifyVendor` itself uses), and only
uses `formRec.vendor_id` for the idempotency match, not for deciding who gets emailed.

**Second improvement (from the user, after re-deployment):** the notify and update passes were
originally in the opposite order (update the records, then check idempotency). Reordered so the
notify pass runs **first**, against the still-unmodified `formRecords` snapshot, and the update
pass runs after. Doing it the other way round risks the idempotency check reading the value this
same run just wrote, permanently reading as "already sent" and killing all future notifications
for that record.

**Correction history (both from the user, testing live):** the first draft used
`formRecUpdate = Map(); ...; update Headstone_Request_Form[ID == formRec.ID] set formRecUpdate;`
— not valid, `update ... set` doesn't take a Map variable. The second attempt,
`update Headstone_Request_Form[ID == formRec.ID] set [ Plot_No = plotNo ];`, **also did not
work**. **What actually works, confirmed live:** fetch the record as a variable, then assign the
field directly —
```
theRecord = Headstone_Request_Form[ID == formRec.ID];
theRecord.Plot_No = plotNo;
```
This is the pattern shown above and the one to use for any future single-field Creator form
record update in this codebase.

The `alreadySentForThisPlot` check is the idempotency guard: if `Plot_No` on the Deal gets
re-saved with the *same* value it already had (a re-save that doesn't actually change anything),
the vendor won't get a duplicate email — but if it's edited to a genuinely different value, a
fresh notification goes out, which matches "Plot # has been assigned" being meaningful
information each time it actually changes.

### Step 5 — one new branch in `handleWorkflowTriggerAndActionByTimelineProcess` (CRM, per
Andrea's explicit instruction to use this exact function for any Deal-edit trigger)
Add this alongside the other `returnedValue.contains(...)` blocks (e.g. right after the "Create
Deceased Account Record" block):
```
//Start Plot Number Assigned
if(returnedValue.contains("Plot_No") && !isNull(recordInfo.get("Plot_No")) && recordInfo.get("Plot_No") != "")
{
	try
	{
		getUrl("https://www.zohoapis.com/creator/custom/delapenhafuneralhome/Update_Plot_Number_And_Notify_Vendor?publickey=<NEW_PUBLIC_KEY_FROM_STEP_4>&crmid=" + crmid + "&plotNo=" + zoho.encryption.urlEncode(recordInfo.get("Plot_No")));
	}
	catch (eNotify)
	{
	}
}
//End Plot Number Assigned
```
This fires whenever `Plot_No` is touched on a Deal edit and currently has a value — matching the
exact same pattern every other field-driven branch in this function already uses (e.g. the
`Cremation_Date`/`ID_Date`/`Name_of_Deceased` blocks: "field was touched in this save AND has a
value now," not a strict stored-old-value comparison, since this dispatcher doesn't track
previous values). The idempotency guard lives in Step 4's Creator function instead (comparing
against what's already stored on the Headstone Form record), so a Deal getting re-saved without
`Plot_No` actually changing won't re-notify the vendor even though this branch itself doesn't
distinguish "was blank before" from "was already set."

## Why this uses `handleWorkflowTriggerAndActionByTimelineProcess`

Per Andrea's explicit instruction. This also matches the same discovery from Task 1 (FD manual
entry) — this dispatcher already fires on every single Deal edit and is where every other
similar "field X got a value → do Y" behavior in this org already lives, so it's the correct,
consistent place for this too rather than a brand-new standalone workflow rule.

## Status

Not yet applied — pending: the `.ds` field addition, the new CRM email template (Step 2), the
two new Creator functions (Steps 3-4) published with a public key, and the new branch in
`handleWorkflowTriggerAndActionByTimelineProcess` (Step 5) with the real template id and public
key substituted in. Test: (1) set `Plot_No` on a Deal that already has one or more Headstone
Request Form records → confirm each gets `Plot_No` updated and each vendor gets exactly one
email with a working "View Form" link showing the assigned Plot #; (2) confirm the Plot # field
is genuinely not editable when opening the form as the vendor; (3) re-save the same Deal without
changing `Plot_No` → confirm no duplicate email goes out; (4) change `Plot_No` to a different
value afterward → confirm a fresh email does go out.
