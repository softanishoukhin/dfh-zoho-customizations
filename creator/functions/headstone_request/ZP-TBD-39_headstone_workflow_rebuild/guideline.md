# ZP-TBD-39 — Creator-side changes (`Headstone_Request.ds`)

App: Zoho Creator "Headstone Request". Guideline only, same as every `.ds` change in this
engagement — apply directly in the Creator Workflow/Form Builder editors. Read live and in
full (1699 lines) before writing this; every function/workflow named below was confirmed
to exist with the code quoted.

**Open item found while writing this, not in the brief's 4-field list:** the process
description says Hillview 2/3 family verification includes "Epitaph / Bible verse," but
the brief's "four new Deal fields" table has no field for it. A 5th field is needed --
recommend `Headstone_Epitaph` (multi-line text) on Deals. Flagging rather than silently
adding a field the brief never asked for; confirm the name/type with Andrea before adding
it, then treat it exactly like the other 4 fields everywhere below.

---

## 1. Change every `Parent_Product == "Headstone"` filter to `Hillview_Group != blank`

Four confirmed locations, all currently gated on the CRM Deal's linked `Products.Parent_Product.name == "Headstone"` (and, in three of the four, also `Include_in_Headstone_Workflow == true`):

### `Pre_fill_Data` (on load)
Two branches. Find:
```deluge
if(input.Is_Vendor == "yes" && existingProduct.get("Parent_Product").get("name") == "Headstone")
{
	if(productVendorID == input.vendor_id)
	{
		...
	}
}
else if(existingProduct.get("Parent_Product").get("name") == "Headstone" && productInfo.get("Include_in_Headstone_Workflow") == true)
{
	...
}
```
Replace both `Parent_Product` tests with a `Hillview_Group` presence test on the SAME
`productInfo` record already being fetched in this loop (both branches already resolve
`productInfo = zoho.crm.getRecordById("Products", existingProduct.get("Child_Product").get("id"))` earlier in the loop -- reuse it, don't re-fetch):
```deluge
if(input.Is_Vendor == "yes" && ifnull(productInfo.get("Hillview_Group"),"") != "" && ifnull(productInfo.get("Hillview_Group"),"") != "-None-")
{
	if(productVendorID == input.vendor_id)
	{
		...
	}
}
else if(ifnull(productInfo.get("Hillview_Group"),"") != "" && ifnull(productInfo.get("Hillview_Group"),"") != "-None-")
{
	...
}
```
Drop the separate `Include_in_Headstone_Workflow == true` condition -- `Hillview_Group`
being set is now the single source of truth for "this product is in the workflow," per
the brief's stated goal of consolidating the trigger onto one field.

### `Auto_Populate_Subform_Pic` (on user input of `Auto_Populate_Subform_Picklist_Values`)
Same two-branch filter (identical structure to `Pre_fill_Data`'s) -- apply the identical
replacement. Then find the picklist-population block:
```deluge
headstoneProducts = zoho.crm.searchRecords("Products","(Parent_Product:equals:Headstone)");
headstoneProductsMap = list();
for each  headstoneProduct in headstoneProducts
{
	productInfoNew = zoho.crm.getRecordById("Products",headstoneProduct.get("id").toLong());
	if(productInfoNew.get("Include_in_Headstone_Workflow") == true)
	{
		headstoneProductsMap.add(headstoneProduct.get("Product_Name") + "-" + headstoneProduct.get("id"));
	}
}
```
Replace with:
```deluge
headstoneProducts = zoho.crm.searchRecords("Products","(Hillview_Group:starts_with:Hillview)");
headstoneProductsMap = list();
for each  headstoneProduct in headstoneProducts
{
	headstoneProductsMap.add(headstoneProduct.get("Product_Name") + "-" + headstoneProduct.get("id"));
}
```
(`starts_with:Hillview` matches `Hillview 1`/`2`/`3` and excludes blank -- confirm this
criteria syntax works against a picklist field in your Creator version; if not, fall back
to three OR'd `:equals:` criteria for the three values.)

### `Populate_Headstone_Produc` (on add row of `Select_Product`)
Same picklist-population pattern, identical fix:
```deluge
headstoneProducts = zoho.crm.searchRecords("Products","(Parent_Product:equals:headstone)");
headstoneProductsMap = list();
for each  headstoneProduct in headstoneProducts
{
	productInfoNew = zoho.crm.getRecordById("Products",headstoneProduct.get("id").toLong());
	if(productInfoNew.get("Include_in_Headstone_Workflow") == true)
	{
		headstoneProductsMap.add(headstoneProduct.get("Product_Name") + "-" + headstoneProduct.get("id"));
	}
}
```
Replace identically to the block above (`Hillview_Group:starts_with:Hillview`).

### `checkApprovedAllVendorProducts`
Find:
```deluge
if(existingProduct.get("Parent_Product").get("name") == "Headstone" && productInfo.get("Include_in_Headstone_Workflow") == true)
```
Replace with:
```deluge
if(ifnull(productInfo.get("Hillview_Group"),"") != "" && ifnull(productInfo.get("Hillview_Group"),"") != "-None-")
```

### `createPurchaseOrderForTheParticularVendor`
Find:
```deluge
if(productID != "" && parentProduct == "Headstone" && productInfo.get("Include_in_Headstone_Workflow") == true)
```
Replace with:
```deluge
hillviewGroupOnProduct = ifnull(productInfo.get("Hillview_Group"),"");
if(productID != "" && hillviewGroupOnProduct != "" && hillviewGroupOnProduct != "-None-")
```
(The now-unused `parentProduct` variable can stay or be removed -- harmless either way.)

---

## 2. Fix the product-lookup bug in `afterApprovingAndSubmittingTheForm`

Confirmed live: this is why no headstone PO has ever been created. Find:
```deluge
queryMap = Map();
queryMap.put("select_query","select Product_Name, Unit_Price from Products where Product_Name = '" + product.Product_Name + "' limit 1");
response = invokeurl
[
	url :"https://www.zohoapis.com/crm/v8/coql"
	type :POST
	parameters:queryMap.toString()
	connection:"zoho_oauth_connection"
];
```
Replace with the exact pattern already proven correct in `sendEmailToVendorForDraft`
(split on `-`, take the id, query by id):
```deluge
splitedProductName = product.Product_Name.toList("-");
productID = splitedProductName.get(splitedProductName.size() - 1);
productID = productID.trim();
queryMap = Map();
queryMap.put("select_query","select Product_Name, Unit_Price, Vendor_Name, Parent_Product from Products where id = '" + productID + "' limit 1");
response = invokeurl
[
	url :"https://www.zohoapis.com/crm/v8/coql"
	type :POST
	parameters:queryMap.toString()
	connection:"zoho_oauth_connection"
];
```
This is a straight copy of `sendEmailToVendorForDraft`'s already-working lookup, per the
brief's explicit instruction. There's also a large commented-out dead-code block
(~lines 354-424 in the live file) duplicating PO-building logic inline right after this --
delete it as part of this same cleanup pass, it's unreachable and confusing to leave.

**Second, independent fragility found while reading this (not the bug named in the
brief, but related):** this function calls `thisapp.createPurchaseOrderForTheParticularVendor(theForm)`
unconditionally after setting `Headstone_Request_Status = "NOK Approved"`, but
`createPurchaseOrderForTheParticularVendor` only does anything when
`dealInfo.get("Headstone_Vendor_Status") == "Ready for Family"` (post-rename) is already
true at that moment -- which should be the case if the process ran in order (vendor
approves first, family second), but nothing here confirms it. Recommend adding a defensive
check right before the call:
```deluge
dealCheck = zoho.crm.getRecordById("Deals",theForm.deal_id.toLong());
if(dealCheck.get("Headstone_Vendor_Status") != "Ready for Family")
{
	info "afterApprovingAndSubmittingTheForm: family approved before vendor status was Ready for Family -- PO creation skipped, investigate.";
}
else
{
	thisapp.createPurchaseOrderForTheParticularVendor(theForm);
}
```
This doesn't change normal-path behavior (the PO still creates exactly when it does
today) -- it only turns a silent, invisible no-op into a logged one if the ordering is
ever violated, which will make the financial-chain testing in `test-plan.md` much easier
to debug if something doesn't fire.

---

## 3. Rename `Approved_by_Vendor` label and the `"Vendor Approved"` string

- **Form Builder > `Approved_by_Vendor` field**: change the display label from "Approved"
  to **"Ready for Family"**. (Do not confuse with `Approved_By_Vendor_Row`, a separate
  per-subform-row checkbox used only for UI show/hide -- leave that one alone, it's not
  named in the brief.)
- **`afterProcessedByVendor`**: find `dealMap.put("Headstone_Vendor_Status","Vendor Approved");`
  → replace the string with `"Ready for Family"`.
- **`checkApprovedAllVendorProducts`**: find `dealMap.put("Headstone_Vendor_Status","Vendor Approved");`
  (in the `if(approvedByAllVendors == true)` branch) → replace the string with
  `"Ready for Family"`.
- **`createPurchaseOrderForTheParticularVendor`**: find
  `if(dealInfo.get("Headstone_Vendor_Status") == "Vendor Approved")` → replace the string
  with `"Ready for Family"`.

Do this only after the CRM-side picklist value itself has been renamed (§6 of the CRM
guideline) -- otherwise these three writes will store a value the picklist no longer
recognizes.

---

## 4. New: `standalone.createFormRecordAndNotifyVendor(String crmid)`

New Creator function, called via REST from CRM's rewritten
`manageZeroRatedHeadstoneProduct` (see the CRM guideline §4) for the Hillview-1
straight-to-vendor path -- no family step. Creates a bare Creator record scoped to the
vendor and emails them the edit link; the existing `Pre_fill_Data` (on load) already knows
how to populate `Select_Product` for a vendor viewing their own record (`Is_Vendor=="yes"`
branch, per §1 above) once the fixed Hillview_Group filter is in place -- this function
does not duplicate that population logic, it only creates the record and sends the email.

**Design simplification, flagged as an assumption:** written for the common case of a
single vendor across a Deal's Hillview 1 product lines. If a Deal ever has Hillview 1
products from two different vendors, this creates one record/email per vendor but only
stores the LAST one's edit URL on the Deal's single `Headstone_Form_Edit_URL` field --
confirm with Andrea whether multi-vendor Hillview 1 Deals are realistic enough to need a
proper multi-URL design before relying on this as-is.

```deluge
string standalone.createFormRecordAndNotifyVendor(String crmid)
{
	dealInfo = zoho.crm.getRecordById("Deals",crmid.toLong());
	existingProducts = ifnull(dealInfo.get("Product_Selection"),list());
	vendorGroups = Map();
	// vendorId -> true, just to dedupe
	for each  item in existingProducts
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
		if(hillviewGroup != "Hillview 1")
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
		if(vendorId != "")
		{
			vendorGroups.put(vendorId,true);
		}
	}

	lastEditUrl = "";
	for each  vendorId in vendorGroups.keys()
	{
		newForm = Headstone_Request_Form();
		newForm.deal_id = crmid;
		newForm.vendor_id = vendorId;
		newForm.Is_Vendor = "yes";
		insertResult = newForm.insert();
		if(insertResult == "success")
		{
			recordId = newForm.ID;
			editUrl = "https://creatorapp.zoho.com/delapenhafuneralhome/headstone-request/Headstone_Form_Page?deal_id=" + crmid + "&Is_Vendor=yes&vendor_id=" + vendorId + "&record_id=" + recordId;
			// Confirm this base URL matches the live Headstone_Form_Page URL exactly --
			// copy it from the existing "Headstone Request" email template's link rather
			// than retyping, to avoid a typo'd domain/path.
			lastEditUrl = editUrl;
			vendorInfo = zoho.crm.getRecordById("Products",vendorId.toLong());
			// NOTE: confirm whether Vendor_Name on Products actually points to a
			// Vendors/Accounts/Contacts module record, not Products -- adjust the
			// getRecordById module name accordingly; not independently verified this pass.
			vendorEmail = ifnull(vendorInfo.get("Email"),"");
			if(vendorEmail != "")
			{
				// Copy the exact email-sending mechanism already proven in
				// sendEmailToVendorForDraft (not fully quoted in this pass's research --
				// pull it fresh before writing this block) rather than inventing a new
				// one here. Point the link at editUrl above instead of the draft-request
				// link it normally sends.
			}
		}
	}
	dealUpdateMap = Map();
	if(lastEditUrl != "")
	{
		dealUpdateMap.put("Headstone_Form_Edit_URL",lastEditUrl);
	}
	zoho.crm.updateRecord("Deals",crmid.toLong(),dealUpdateMap);
	return "";
}
```

**This function is a starting skeleton, not a finished drop-in** -- two pieces need
confirming live before it's trustworthy: (1) whether `Products.Vendor_Name` resolves to a
`Vendors`, `Accounts`, or `Contacts` module record (the guideline above guesses
`Products`, which is almost certainly wrong -- fix before applying), and (2) the exact
email-sending block from `sendEmailToVendorForDraft`, which needs to be pulled fresh and
copied in rather than written from scratch. Flagging both explicitly rather than
presenting invented code as proven.

**Also needed:** register this as a Custom API (`Get_Headstone_Vendor_Notify` or similar
name, matching this project's established Custom-API-per-function convention) so the CRM
REST call in the guideline's §4 (`.../functions/createformrecordandnotifyvendor/actions/execute`)
resolves -- Creator functions calling out from CRM via `invokeurl` need to be exposed the
same way `sendheadstonerequest` already is.

---

## 5. Family form -- three variants by Hillview Group

Add to the form, driven by whichever `Hillview_Group` the Deal's qualifying product
carries (resolve once in `Pre_fill_Data`, store on a hidden form field, e.g.
`input.Hillview_Group_On_Form`, then use it to show/hide the fields below in
`Show_Hide_Disabled_Fields`):

- **All variants (Hillview 1/2/3):** Deceased Name/DOB/DOD already shown read-only (from
  ZP-TBD-27's prior fix) -- no change needed here. Add **Headstone Shape** (Oval/Square
  picklist) as a required family input on ALL variants -- writes to the new
  `Headstone_Shape` Deal field on submit.
- **Hillview 2 and 3 only:** add the epitaph/Bible-verse input (see the open item at the
  top of this file re: the missing 5th Deal field) -- shown for these two groups, hidden
  for Hillview 1 (which never reaches the family form at all, per §4).
- **Hillview 3 only:** additionally show the picture-upload input -- writes to the new
  `Headstone_Picture` Deal field on submit.

## 6. `NOK Not Approved` handling

Find the "not approved" branch in `afterApprovingAndSubmittingTheForm` (the `else` of
whatever condition reads the family's Approve/Reject choice on submit -- confirm the exact
field name live, the research pass for this guideline focused on the approved path's bug
and didn't quote the reject branch verbatim). Add:
```deluge
dealMap.put("NOK_Not_Approved",true);
```
alongside whatever it already sets on rejection (per the live code seen in
`afterProcessedByVendor`'s parallel "not approved" branch, it currently sets
`Headstone_Request_Status = "NOK Review"` -- keep that, just add the new field write next
to it). The existing loop (vendor re-drafts, family reviews again) continues unchanged.

## 7. Strip unused form fields

Per the brief's "strip form fields the new process no longer uses" -- do this last, after
everything above is applied and tested, so it's clear from live testing which fields are
actually still read/written by the rebuilt workflow before removing anything.
