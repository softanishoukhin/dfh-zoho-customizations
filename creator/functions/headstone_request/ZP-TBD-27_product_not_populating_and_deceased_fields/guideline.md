# ZP-TBD-27 -- Headstone Request Form: product not appearing + add Deceased Name/DOB/DOD

App: Zoho Creator "Headstone Request" (`delapenhafuneralhome` / `headstone-request`)
Form: `Headstone_Request_Form`
Source reviewed: `D:\Office\Andrea_Projects\DFH\widgets\headStoneRequest\Headstone_Request.ds`
(local copy, provided by user 2026-08-18)

This is a Zoho Creator app -- guideline only, same as every `.ds`-file change in this
engagement. Apply directly in the Creator Form Builder / Workflow editor.

---

## Issue 1 -- Product not appearing on the form

### Root cause (confirmed from the live workflow script)
The **`Pre_fill_Data`** on-load workflow (form rule, `on load`) rebuilds `Select_Product`
from the Deal's `Product_Selection` every time the form opens. For each existing headstone
product it builds a `row1` and inserts it -- but only ever sets `Quantity`, `Price`,
`CRM_Row_ID`, `Approved_By_Vendor_Row`, and `Uploaded_File_By_Vendor`. **`row1.Product_Name`
is never set in either branch** (vendor path or NOK path).

The actual `Product_Name` population logic lives in a *different* workflow rule,
**`Auto_Populate_Subform_Pic`**, which only runs `on user input of
Auto_Populate_Subform_Picklist_Values`. `Pre_fill_Data` tries to chain into it at the very
end with:
```deluge
input.Auto_Populate_Subform_Picklist_Values = true;
```
**This does not work.** Setting a field's value from Deluge inside an on-load script does
not fire a real "on user input" event in Zoho Creator -- that event only fires from actual
browser/user interaction. So `Auto_Populate_Subform_Pic` silently never runs on page load,
and every inserted row has a blank `Product_Name` -- exactly the empty "Select Product"
table you're seeing.

### Fix
Set `Product_Name` directly inside `Pre_fill_Data`'s own loop, at the exact point `row1`
is already being built for each product -- no need to depend on the separate on-user-input
rule at all for the initial page load.

**Open: Workflow > `Pre_fill_Data` ("Pre-fill Data") > On Load > the custom deluge script.**

Find this block (vendor path, inside `if(input.Is_Vendor == "yes" && ...)`):
```deluge
if(productVendorID == input.vendor_id)
{
	row1 = Headstone_Request_Form.Select_Product();
	row1.Quantity=existingProduct.get("Quantity");
	row1.Price=existingProduct.get("Unit_Price");
	row1.CRM_Row_ID=existingProduct.get("id");
	providedFileByVendor = input.Approved_Products.toCollection();
	...
	input.Select_Product.insert(row1);
}
```
Add these 3 lines right after `row1 = Headstone_Request_Form.Select_Product();` (before the
existing `row1.Quantity=...` line):
```deluge
productLabel = existingProduct.get("Child_Product").get("name") + "-" + existingProduct.get("Child_Product").get("id");
row1.Product_Name:ui.add({productLabel});
row1.Product_Name = productLabel;
row1.Session_Variable_Selected_Product = productLabel;
```

Then find the NOK path (inside the `else if(existingProduct.get("Parent_Product").get("name") == "Headstone" && productInfo.get("Include_in_Headstone_Workflow") == true)` block):
```deluge
row1 = Headstone_Request_Form.Select_Product();
row1.Quantity=existingProduct.get("Quantity");
row1.Price=existingProduct.get("Unit_Price");
row1.CRM_Row_ID=existingProduct.get("id");
row1.Approved_By_Vendor_Row=approvedByVendor;
...
input.Select_Product.insert(row1);
```
Add the identical 4 lines right after `row1 = Headstone_Request_Form.Select_Product();` in
this branch too.

**Why this format:** `"Name-id"` (hyphen-joined) matches the exact convention already used
everywhere else in this app (`Auto_Populate_Subform_Pic`, `Populate_Headstone_Produc`,
`Update_Subform_Row_Inform` all parse `Product_Name` by splitting on `"-"` and taking the
last segment as the Products record id) -- so this fix stays consistent with how every
other part of the form already reads `Product_Name` back out. `:ui.add({productLabel})`
registers the value as a valid pick-list option for that row before assigning it -- Deluge
requires this for picklist fields, same pattern already used in the other two rules.

**Leave `Auto_Populate_Subform_Pic` and the
`input.Auto_Populate_Subform_Picklist_Values = true;` line at the end of `Pre_fill_Data`
as-is** -- harmless to keep, and `Auto_Populate_Subform_Pic` still legitimately fires
later if something changes the checkbox via a real click.

### Test
1. Open the Headstone Form Page link for a Deal that has at least one headstone product
   selected (`Product_Selection` subform, `Parent_Product = Headstone`,
   `Include_in_Headstone_Workflow = true` on the Products record).
2. Confirm "Select Product" now shows a row with the correct Product Name pre-filled (not
   blank, not "Please Wait...").
3. Repeat with a Vendor link (`Is_Vendor=yes&vendor_id=...`) for a product tied to that
   vendor -- confirm the same.
4. Confirm Price still populates correctly alongside it (unaffected, already worked).

---

## Issue 2 -- Add Deceased Name / Date of Birth / Date of Death (read-only)

### Live Deal fields to pull from (confirmed via `ZohoCRM_getFields`)
- `Name_of_Deceased` (text)
- `Date_of_Birth` (date)
- `Date_of_Death` (date)

### Step 1 -- add 3 new fields to the form
**Form Builder > `Headstone_Request_Form` > drag into the top `Section` (next to `Deal_Name`):**
- `Deceased_Name` -- Single Line text
- `Date_of_Birth` -- Date
- `Date_of_Death` -- Date

(Field names/types only -- exact row/column placement is your call visually; suggest same
row as `Deal_Name` and `Upload Draft Design` for a clean top block, matching how `Deal_Name`
is laid out today.)

### Step 2 -- populate them on load
**Workflow > `Pre_fill_Data` > On Load >** find this existing line:
```deluge
input.Deal_Name = ifnull(dealDetails.get("Deal_Name"),"");
```
Add right after it:
```deluge
input.Deceased_Name = ifnull(dealDetails.get("Name_of_Deceased"),"");
input.Date_of_Birth = dealDetails.get("Date_of_Birth");
input.Date_of_Death = dealDetails.get("Date_of_Death");
```

### Step 3 -- lock them read-only for BOTH NOK and Vendor
**Workflow > `Show_Hide_Disabled_Fields` > On Load >** find this existing line (near the
top, before the `if(input.Is_Vendor == "yes")` branch):
```deluge
disable Deal_Name;
```
Add right after it (outside the if/else, so it applies unconditionally to both the NOK and
Vendor views -- same as `Deal_Name` itself):
```deluge
disable Deceased_Name;
disable Date_of_Birth;
disable Date_of_Death;
```

### Test
1. Open the form as NOK (no `Is_Vendor` param, or `Is_Vendor=no`) -- confirm Deceased Name/
   DOB/DOD show the correct values from the Deal and are greyed out / not editable.
2. Open the same Deal's form as Vendor (`Is_Vendor=yes&vendor_id=...`) -- confirm the same
   3 fields show and are equally locked.
3. Confirm submitting the form (either path) doesn't error and doesn't change these 3
   values on the Deal (they're display-only, never written back -- no code in
   `afterApprovingAndSubmittingTheForm` / `afterProcessedByVendor` /
   `sendEmailToVendorForDraft` touches them, so this is safe by construction as long as
   they stay disabled).
