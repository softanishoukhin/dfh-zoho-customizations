# Hillview App: show headstone information on the record detail page

**Andrea's ask (2026-08-28, Headstone request process series, Task 3):** the Hillview App's
record detail page should show Plot #, Headstone Product, all headstone information, and Status
— whatever the current process already collects (e.g. Vendor Approved, Family Approved), not a
new status system.

## Understanding the app correctly (corrected after an earlier wrong read)

`widgets/hillviewApp/hillviewApp` (live-verified, `Hillview_Staff_Portal.ds` current):
- **`app/widget.html` + `app/main.js`** is a list page ("List of All Hillview Deals") — a table
  of Hillview deals pulled via a Custom API (`Fetch_All_Hillview_Deal_Records`), each row with a
  **"View Details"** link. That link (`generateDetailUrl` in `main.js`) opens
  `#Form:Hillview_Form?deal_id=<id>` — **the `Hillview_Form` Creator form itself, in edit mode,
  for that Deal.** This is the actual "record detail page" Andrea means, not the report's
  separate quickview/detailview section (which is a minor, secondary view, not what staff click
  into from the list).
- `Hillview_Form` already does a live `GET` on the Deal (`https://www.zohoapis.com/crm/v8/Deals/`
  + deal_id) in its **on load** script and prefills fields from it: `Deceased_name`, NOK
  info (via a Contacts lookup), `Deal_Type`, `Plot1` (from `Deal.Plot`), `Deceased_Size`,
  `Funeral_Time`, and rebuilds its own `Hillview_Products` subform from `Deal.Product_Selection`
  lines where `Parent_Product == "Hillview"`. This is exactly the established pattern to extend
  for the new headstone fields — read-only display data pulled from the same already-fetched
  `dealDetails`/`existingProducts` variables, no new CRM call needed.
- **Existing bug found while tracing this:** the form's own `Plot` field (displayname "Plot #")
  is what staff type into and gets pushed to `Deal.Plot_No` on save (`dealMap.put("Plot_No",input.Plot)`)
  — but it is **never prefilled from `Deal.Plot_No` on load**. Reopening a Deal that already has
  a Plot # (set here or anywhere else, e.g. an FD setting it directly on the Deal) shows this
  field blank instead of the real current value. Fixing this alongside the new display fields,
  since Andrea explicitly listed "Plot #" as something the detail page should show correctly.

## Design

All additions go into the **on load** script of `Hillview_Form` (the block starting `record
event = on add or edit` / `on load`, right where `dealDetails` and `existingProducts` are
already in scope) — no new CRM calls, no new Custom APIs, everything reuses data already fetched
on that same page load.

### Step 1 — new read-only fields on `Hillview_Form` (`.ds`, apply directly in Creator)
Add these near `Plot`/`Plot1` (same section, row 1):
```
Headstone_Product
(
	type = textarea
	displayname = "Headstone Product"
	read only = true
	height = 60px
	row = 1
	column = 1
	width = medium
)
Headstone_Shape_Display
(
	type = text
	displayname = "Headstone Shape"
	read only = true
	row = 1
	column = 1
	width = medium
)
Headstone_Epitaph_Display
(
	type = textarea
	displayname = "Headstone Epitaph"
	read only = true
	height = 60px
	row = 1
	column = 1
	width = medium
)
Headstone_Request_Status_Display
(
	type = text
	displayname = "Headstone Request Status"
	read only = true
	row = 1
	column = 1
	width = medium
)
Headstone_Vendor_Status_Display
(
	type = text
	displayname = "Headstone Vendor Status"
	read only = true
	row = 1
	column = 1
	width = medium
)
```
As before, verify `read only = true` is accepted directly by this Creator version's field
builder when adding these; if not, use a Form Rule (On Load → make these fields read-only)
instead — same caveat as the Plot # field added earlier in the Headstone Request Form.

Field name choices: kept `_Display` suffixes on the two that could otherwise collide in meaning
with existing concepts (`Headstone_Shape_Display` vs. a hypothetical future real `Headstone_Shape`
field on this form) — feel free to rename to plain `Headstone_Shape`/`Headstone_Epitaph` etc. if
no collision risk actually exists on this form; just keep the names distinct from `Headstone_Request_Form`'s
own field names since they're different forms in different apps.

### Step 2 — extend the on-load script
Add this inside the existing `if(!isNull(input.deal_id)) { ... }` block, anywhere after
`dealDetails` is assigned (e.g. right before `input.Auto_Populate_Subform_Picklist_Values = true;`)
— reuses `dealDetails` and `existingProducts`, both already fetched above in the same block:
```
// Fix: Plot # was never prefilled on load, so reopening a Deal that already has one showed
// this field blank. Deal.Plot_No is the real "Plot #" (confirmed earlier in this same ticket).
input.Plot = ifnull(dealDetails.get("Plot_No"),"");

// Headstone information (ZP-TBD-39 process) -- read-only display, straight off the Deal.
// Whatever the existing process already captures, not a new status system.
input.Headstone_Shape_Display = ifnull(dealDetails.get("Headstone_Shape"),"");
input.Headstone_Epitaph_Display = ifnull(dealDetails.get("Headstone_Epitaph1"),"");
input.Headstone_Request_Status_Display = ifnull(dealDetails.get("Headstone_Request_Status"),"");
input.Headstone_Vendor_Status_Display = ifnull(dealDetails.get("Headstone_Vendor_Status"),"");

// Headstone Product: the product line(s) actually tagged for the headstone workflow
// (Hillview_Group set), not the plain "Hillview" parent-category lines already shown in the
// Hillview_Products subform above -- these can differ (a Deal can have Hillview-category
// products that aren't part of the headstone/vendor process at all).
headstoneProductNames = list();
for each existingProduct in existingProducts
{
	try
	{
		childProductInfo = zoho.crm.getRecordById("Products",existingProduct.get("Child_Product").get("id").toLong());
		hillviewGroupOnLine = ifnull(childProductInfo.get("Hillview_Group"),"");
		if(hillviewGroupOnLine != "" && hillviewGroupOnLine != "-None-")
		{
			headstoneProductNames.add(existingProduct.get("Child_Product").get("name"));
		}
	}
	catch (e)
	{
	}
}
input.Headstone_Product = headstoneProductNames.toString();
```

**Why `Headstone_Product` is derived from `Hillview_Group`, not the local `Hillview_Products`
subform already on this form:** that existing subform tracks the broader "Hillview" product
category (`Parent_Product == "Hillview"`) for the Hillview site visit itself — a different,
wider set than the specific product(s) that actually went through the headstone/vendor approval
workflow (`Hillview_Group` set — Hillview 1/2/3). They can legitimately differ on a Deal, so
showing both separately (existing subform = Hillview site products; new field = the actual
headstone workflow product) avoids conflating two different things Andrea's own process already
tracks separately.

**Status fields, kept as-is rather than combined:** `Headstone_Request_Status` (e.g. "Submitted",
"NOK Received") and `Headstone_Vendor_Status` (e.g. "Ready for Family" — the renamed "Vendor
Approved") are the two real status fields the current process already writes to the Deal, per
the ZP-TBD-39 rebuild. Shown as two separate read-only fields rather than merged into one, so
nothing is invented or reinterpreted — exactly "whatever the current process already collects."

## Status

Confirmed deployed and tested by Andrea, passed.
