# ZP-TBD-39 — CRM-side changes

**STATUS (2026-08-21): APPLIED IN SANDBOX, TESTING IN PROGRESS.** Not yet deployed to
production -- waiting on the Creator-side changes (see the sibling guideline in
`creator/functions/headstone_request/ZP-TBD-39_headstone_workflow_rebuild/guideline.md`,
still in progress) before this goes live, since the CRM-side routing calls into
Creator-side functions that aren't finished/tested yet.

Apply in this order. Each numbered section is independently testable before moving to the
next.

---

## 1. Products — new `Hillview Group` field

**Setup > Products > Fields > add a new Picklist field**, copying the pattern of the
existing `Vehicle_Class` field ("Product Display Group"):
- API name: `Hillview_Group`
- Values: `Hillview 1`, `Hillview 2`, `Hillview 3` (blank/`-None-` is the default, no value
  needed for "everything else")

Then tag the exact products listed in `product-mapping.md` in this folder. Do not use a
parent-category shortcut ("everything under Hillview") — confirmed live that the target
products span three different `Parent_Product` values, so a category rule would both miss
real targets and wrongly include catering.

## 2. Deals — four new fields

| Field | API name | Type |
|---|---|---|
| Headstone Shape | `Headstone_Shape` | Picklist: `Oval`, `Square` |
| Name Spelling Verified | `Name_Spelling_Verified` | Checkbox |
| Headstone Picture | `Headstone_Picture` | File upload |
| NOK Not Approved | `NOK_Not_Approved` | Checkbox |

Deals currently has 323 fields in use — confirmed comfortable headroom for these 4, no
field-limit concern.

## 3. FD popup — new Client Script on Deals

**Setup > Developer Space > Client Script > Deals > (all layouts in scope, matching the
brief's "all layouts") > Edit Page and Create Page.**

Non-blocking by design: both handlers always `return true`, regardless of what the popup
shows.

```javascript
function checkHillviewCompleteness(){
	var missing = [];
	var hasHillviewProduct = false;
	var subform = ZDK.Page.getField("Product_Selection");
	var rows = subform ? subform.getRows() : [];
	for (var i = 0; i < rows.length; i++){
		var row = rows[i];
		var childProductField = row.getField("Child_Product");
		var childId = childProductField ? childProductField.getValue() : null;
		if (!childId) continue;
		var productRecord = ZDK.Apps.CRM.Products.fetchById(childId);
		var hillviewGroup = productRecord ? productRecord.Hillview_Group : null;
		if (hillviewGroup && hillviewGroup !== "-None-"){
			hasHillviewProduct = true;
			break;
		}
	}
	if (!hasHillviewProduct) return;

	var dob = ZDK.Page.getField("Date_of_Birth").getValue();
	var dod = ZDK.Page.getField("Date_of_Death").getValue();
	var nameVerified = ZDK.Page.getField("Name_Spelling_Verified").getValue();

	if (!dob) missing.push("Date of Birth");
	if (!dod) missing.push("Date of Death");
	if (!nameVerified) missing.push("Name Spelling Verified");

	if (missing.length > 0){
		ZDK.Client.showAlert("Missing information: " + missing.join(", ") + ".");
	}
}

function onSaveCreatePage(){
	checkHillviewCompleteness();
	return true;
}

function onSaveEditPage(){
	checkHillviewCompleteness();
	return true;
}
```

**Confirm before finalizing:** `ZDK.Page.getField("Product_Selection").getRows()` and
per-row `row.getField(...)` are the documented shape for reading subform rows in a Client
Script, but this codebase's only proven prior Client Script precedent
(`casketSpecialInstructionsTimin`, ZP-TBD-28) only ever read single top-level fields and
used `ZDK.Apps.CRM.<Module>.fetchById(...)` (which this script also uses, for the linked
Product) — subform row iteration has not been exercised in this codebase before. Spot-check
the exact method names against the CRM Client Script editor's autocomplete/ZDK reference
when applying, before relying on this in production.

## 4. `standalone.manageZeroRatedHeadstoneProduct` (id `6503357000031808072`) — rewrite

Full live source (as of 2026-08-20) is in `../../../../findings` — not duplicated here;
see git history of this repo if you need the exact before/after diff. Replace the entire
function body with:

```deluge
string standalone.manageZeroRatedHeadstoneProduct(Int crmid)
{
recordInfo = zoho.crm.getRecordById("Deals",crmid);
productSelection = ifnull(recordInfo.get("Product_Selection"),list());

// ===== New trigger test: any product line whose Child_Product has Hillview_Group set =====
// Replaces the old Parent_Product=="Headstone" check AND the Included_Headstone_Product
// auto-injection block entirely -- confirmed with the user this mechanism is fully
// retired, not kept alongside the new field.
hillviewGroupsPresent = list();
// distinct group values found on this Deal's product lines
for each  item in productSelection
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
	childInfo = zoho.crm.getRecordById("Products",childID);
	hillviewGroup = ifnull(childInfo.get("Hillview_Group"),"");
	if(hillviewGroup != "" && hillviewGroup != "-None-")
	{
		if(!hillviewGroupsPresent.contains(hillviewGroup))
		{
			hillviewGroupsPresent.add(hillviewGroup);
		}
	}
}

if(hillviewGroupsPresent.isEmpty())
{
	return "";
}

// Already sent once? Fire only once per Deal.
if(recordInfo.get("Headstone_Request_Sent") == true)
{
	return "";
}

// ===== Completeness check =====
dobOk = !isNull(recordInfo.get("Date_of_Birth"));
dodOk = !isNull(recordInfo.get("Date_of_Death"));
nameVerifiedOk = ifnull(recordInfo.get("Name_Spelling_Verified"),false) == true;

if(!(dobOk && dodOk && nameVerifiedOk))
{
	// Not complete yet -- do nothing. The FD popup (client script) already told them
	// what's missing at save time. The next qualifying save re-evaluates this function.
	return "";
}

// ===== Routing =====
// Design decision (not covered explicitly by the brief): if a Deal ever carries a mix of
// Hillview groups, route by the "strictest" one present -- any Hillview 2 or 3 present
// sends to the family first; only route straight to the vendor when every qualifying line
// is Hillview 1.
routeToFamily = hillviewGroupsPresent.contains("Hillview 2") || hillviewGroupsPresent.contains("Hillview 3");

updateMap = Map();
updateMap.put("Headstone_Request_Sent",true);

if(routeToFamily)
{
	// Unchanged existing path: family gets the form first (Hillview 2/3).
	updateMap.put("Headstone_Request_Status","NOK Received");
	zoho.crm.updateRecord("Deals",crmid,updateMap);
	sendHeadStoneRequest = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v7/functions/sendheadstonerequest/actions/execute?auth_type=apikey&zapikey=1003.e2dbe4df1dd83bbca7110c05c43a1a22.3baee41485bf8bce183704938c9d0653&crmid=" + crmid
		type :GET
	];
}
else
{
	// Hillview 1 -- no family step. Straight to vendor: create the Creator form
	// record(s) (one per vendor, since different Hillview 1 products can have different
	// vendors) and email each vendor their edit link. See the Creator-side guideline,
	// standalone.createFormRecordAndNotifyVendor, for the record-creation half of this.
	updateMap.put("Headstone_Request_Status","Submitted");
	zoho.crm.updateRecord("Deals",crmid,updateMap);
	createVendorRecords = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v7/functions/createformrecordandnotifyvendor/actions/execute?auth_type=apikey&zapikey=1003.e2dbe4df1dd83bbca7110c05c43a1a22.3baee41485bf8bce183704938c9d0653&crmid=" + crmid
		type :GET
	];
}
return "";
}
```

**Deluge-only note:** no ternary anywhere above (per this project's standing rule) — the
`routeToFamily` branch uses if/else.

**API key note:** the same `zapikey` already used by the live function's REST call to
`sendheadstonerequest` is reused verbatim for the new
`createformrecordandnotifyvendor` call — confirm this key is still valid/scoped correctly
for the new Custom API when it's created (see the Creator-side guideline for that setup).

## 5. Retire the manual path

- **Remove the "Send Headstone Request" custom button** from the Deals layout(s) it's on.
- **Keep the underlying function** `button.sendHeadstoneRequest` / the
  `sendheadstonerequest` REST endpoint (id `6503357000031453550`) — confirmed live it's the
  *same* function `manageZeroRatedHeadstoneProduct` already calls for the Hillview 2/3
  family-routing path (§4 above). Deleting it would break that call.
- **Do not delete the "Headstone Request" email template** (id `6503357000031453543`) —
  confirmed live it's in active, recent use via the automatic path (`last_used_time`
  2026-08-19), not solely by the manual button as the brief assumed. It stays in use for
  the Hillview 2/3 family-email path.

## 6. Rename `Vendor Approved` → `Ready for Family`

**`Headstone_Vendor_Status` picklist (Deals)**: rename the value `Vendor Approved` to
`Ready for Family` directly in the picklist editor (renaming a picklist value in Zoho CRM
updates it everywhere it's already stored — no data migration needed).

Code that references the literal string `"Vendor Approved"` and needs updating to
`"Ready for Family"` — all in `Headstone_Request.ds`, see the Creator-side guideline:
- `afterProcessedByVendor` (writes the value)
- `checkApprovedAllVendorProducts` (writes the value)
- `createPurchaseOrderForTheParticularVendor` (gates on the value)

## 7. Lock the process fields

**Read-only on all Deal layouts** (confirmed both `Headstone_Request_Status` and
`Headstone_Vendor_Status` are currently associated with only the `Funeral_w_Burial` layout
— add them to any other layout that needs this workflow before locking there too):

- `Headstone_Request_Sent`
- `Headstone_Request_Status`
- `Headstone_Vendor_Status`
- `Headstone_Form_Edit_URL`

Set via Setup > Modules and Fields > Deals > each field > Layout-level "Read-Only" toggle
(or the field-level permission if you want it locked org-wide rather than per-layout).
