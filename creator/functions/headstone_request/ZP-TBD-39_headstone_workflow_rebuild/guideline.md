# ZP-TBD-39 — Creator-side changes (`Headstone_Request.ds`)

App: Zoho Creator "Headstone Request". Guideline only, same as every `.ds` change in this
engagement — apply directly in the Creator Workflow/Form Builder editors. Read live and in
full (1699 lines) before writing this; every function/workflow named below was confirmed
to exist with the code quoted.

**5th field, confirmed (2026-08-24):** the process description's "Epitaph / Bible verse"
input (Hillview 2/3 only, missing from the brief's original 4-field table) is now a real
field on Deals -- **`Headstone_Epitaph1`** (multi-line text). Use this exact API name
everywhere the epitaph field is referenced below.

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

**Confirmed live (2026-08-24) against the two pieces flagged open in the first draft of
this guideline** -- both resolved from `sendEmailToVendorForDraft`'s own live code, not
guessed:
- `Products.Vendor_Name` is a lookup to the **Vendors** module (confirmed both via live
  CRM field metadata and via `sendEmailToVendorForDraft`'s own
  `zoho.crm.getRecordById("Vendors", itemInfo.get("Vendor_Name").get("id")...)` call).
- The real, already-proven email delivery mechanism is the existing helper function
  `sendEmailToVendor(string email, string vendorID, string dealID, string creatorRecordID)`
  (`Headstone_Request.ds` line 741) -- it pulls email template id `6503357000032002034`,
  substitutes the deal/record/vendor ids into the template's placeholder edit-link, and
  sends via `POST /crm/v8/Vendors/{vendorID}/actions/send_mail`. **Reuse it directly below
  instead of writing new email-sending code.**
- The real base URL for a vendor edit link (found inside `sendEmailToVendor`'s own
  commented-out reference line) is:
  `https://creatorapp.zohopublic.com/delapenhafuneralhome/headstone-request/report-perma/All_Headstone_Requests/G70TtaW73JgO204waODaUDFnHmESHPh8WVGOgEpJAYDx2HD7C9bj3kqFNRH8XbC9CPag4DNT27EUShxUUhhXjY1pyFskdM6wkuhE`
  with `?record_id=<id>&Is_Vendor=yes&vendor_id=<id>&deal_id=<id>` appended.

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
	vendorIds = list();
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
		if(vendorId != "" && !vendorIds.contains(vendorId))
		{
			vendorIds.add(vendorId);
		}
	}

	lastEditUrl = "";
	for each  vendorId in vendorIds
	{
		newForm = Headstone_Request_Form();
		newForm.deal_id = crmid;
		newForm.vendor_id = vendorId;
		newForm.Is_Vendor = "yes";
		insertResult = newForm.insert();
		if(insertResult == "success")
		{
			recordId = newForm.ID.toString();
			vendorInfo = zoho.crm.getRecordById("Vendors",vendorId.toLong());
			vendorEmail = ifnull(vendorInfo.get("Email"),"");
			if(vendorEmail != "")
			{
				thisapp.sendEmailToVendor(vendorEmail,vendorId,crmid,recordId);
			}
			lastEditUrl = "https://creatorapp.zohopublic.com/delapenhafuneralhome/headstone-request/report-perma/All_Headstone_Requests/G70TtaW73JgO204waODaUDFnHmESHPh8WVGOgEpJAYDx2HD7C9bj3kqFNRH8XbC9CPag4DNT27EUShxUUhhXjY1pyFskdM6wkuhE?record_id=" + recordId + "&Is_Vendor=yes&vendor_id=" + vendorId + "&deal_id=" + crmid;
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

**Custom API setup, concrete steps (corrected 2026-08-24 -- this must be a Creator
Public Key Custom API, not a CRM-style OAuth/zapikey call):**

1. In the Creator builder, go to **Settings (gear icon) > Custom APIs > Add Custom API**.
2. Name it (e.g. `Notify_Headstone_Vendor`) -- this name goes in the CRM guideline's URL
   in place of `<CUSTOM_API_NAME>`.
3. **Method: GET.** This matches the only other CRM-to-Creator call already proven in this
   codebase -- the `Sleep_API` call at the top of `CreateSalesOrderforPoliceCase`
   (`getUrl("https://www.zohoapis.com/creator/custom/delapenhafuneralhome/Sleep_API?publickey=...&seconds=10")`).
   There is no existing precedent anywhere in this codebase for a CRM function calling a
   Creator function via OAuth or a CRM-style `zapikey` -- Public Key + GET is the pattern
   that's actually proven to work here.
4. **Authentication: Public Key.** Creator generates a key for this specific Custom API
   when you save it -- copy that key into the CRM guideline's `<CUSTOM_API_PUBLIC_KEY>`
   placeholder. It is a different key from `Sleep_API`'s (`69fNOfX03TwjyaAgAYyRTJSBd`) --
   each Custom API gets its own.
5. **Parameter:** add `crmid` as an expected input parameter (the Custom API passes
   through whatever query params the caller sends -- the CRM guideline's call appends
   `&crmid=<id>`).
6. **Function to execute:** map it to `standalone.createFormRecordAndNotifyVendor`, passing
   through the `crmid` parameter.
7. Publish/enable the Custom API, then update the CRM-side guideline's placeholders with
   the real name and key.

---

## 5. Family form -- three variants by Hillview Group

**The real submit dispatcher, confirmed live (2026-08-24):** every form submit (vendor or
family, add or edit) funnels through one workflow, `On_Submitting_the_Form` (`type = form`,
`record event = on add or edit`):
```deluge
theForm = Headstone_Request_Form[ID == input.ID];
dealInfo = zoho.crm.getRecordById("Deals",input.deal_id.toLong());
if(input.Is_Vendor == "yes")
{
	thisapp.afterProcessedByVendor(theForm);
}
else
{
	if(input.Approve == true)
	{
		thisapp.afterApprovingAndSubmittingTheForm(theForm);
	}
	else
	{
		thisapp.sendEmailToVendorForDraft(theForm);
	}
}
openUrl("https://creatorapp.zohopublic.com/delapenhafuneralhome/headstone-request/page-perma/Thank_you_Page/...","same window");
```
The family's **first** submission (giving their details, before any draft exists) is the
`Is_Vendor != "yes"` + `Approve != true` branch -- it calls `sendEmailToVendorForDraft`.
This is where the new family inputs need to land.

### Step 1 -- determine which Hillview Group applies, and show/hide accordingly
Resolve it in `Pre_fill_Data`'s existing family-branch loop (the one gated on
`Hillview_Group != blank` after the §1 fix) -- the first qualifying product's
`Hillview_Group` is already being read there via `productInfo.get("Hillview_Group")`.
Add a new **hidden Single Line text field**, `Hillview_Group_On_Form`, and set
`input.Hillview_Group_On_Form = productInfo.get("Hillview_Group");` at that point (same
pattern already used for `Session_Variable_Selected_Product` elsewhere in this form).
Then in `Show_Hide_Disabled_Fields`, add field rules keyed on
`input.Hillview_Group_On_Form`:
- **All variants (Hillview 2/3 -- Hillview 1 never reaches this form, see §4):**
  Deceased Name/DOB/DOD already shown read-only (ZP-TBD-27's prior fix, unchanged). Add
  **Headstone Shape** (new Oval/Square field on the form, not just the Deal) as a required
  input, shown for both groups.
- **Hillview 2 and 3:** show the new epitaph/Bible-verse input field.
- **Hillview 3 only:** additionally show the new picture-upload input field.

### Step 2 -- write the family's inputs to the Deal on submit
Add this to `On_Submitting_the_Form`, in the `else` branch (`Is_Vendor != "yes"`), right
before the `if(input.Approve == true)` check -- `dealInfo` is already fetched at the top
of this workflow:
```deluge
dealUpdateMap = Map();
if(!isNull(input.Headstone_Shape))
{
	dealUpdateMap.put("Headstone_Shape",input.Headstone_Shape);
}
if(!isNull(input.Headstone_Epitaph_On_Form))
{
	dealUpdateMap.put("Headstone_Epitaph1",input.Headstone_Epitaph_On_Form);
}
if(!isNull(input.Headstone_Picture_On_Form))
{
	dealUpdateMap.put("Headstone_Picture",input.Headstone_Picture_On_Form);
}
if(dealUpdateMap.size() > 0)
{
	zoho.crm.updateRecord("Deals",input.deal_id.toLong(),dealUpdateMap);
}
```
(Form field names `Headstone_Epitaph_On_Form` / `Headstone_Picture_On_Form` are
placeholders for whatever you name the new form fields in Step 1 -- keep them distinct
from the Deal field names `Headstone_Epitaph1`/`Headstone_Picture` to avoid confusing the
two in the Form Builder; adjust the exact names above to match what you actually create.)

## 6. `NOK Not Approved` handling

**Real finding, not in the brief:** this form has **no reject/decline mechanism at all
today.** Traced every use of `input.Approve` in the file -- it only has two live states:
`true` (final approval) or empty/false, which the dispatcher above routes to
`sendEmailToVendorForDraft`, i.e. treated as "send/resend to vendor," not "family rejected
the draft." `afterProcessedByVendor`'s `"NOK Review"` status write is about the *vendor*
not yet marking a draft ready, unrelated to the family declining -- do not confuse the two
as an earlier draft of this guideline briefly did.

**This means implementing "family rejects the draft" is new UI, not a find-and-modify.**
Recommend:
1. Add a new checkbox to the family's draft-review screen (shown alongside the existing
   Approve checkbox, only when they're reviewing a vendor's uploaded draft) -- e.g.
   `Reject_Draft`.
2. In `On_Submitting_the_Form`'s `else` branch, add a third case ahead of the existing two:
   ```deluge
   if(input.Reject_Draft == true)
   {
   	dealMap = Map();
   	dealMap.put("NOK_Not_Approved",true);
   	zoho.crm.updateRecord("Deals",input.deal_id.toLong(),dealMap);
   }
   else if(input.Approve == true)
   {
   	thisapp.afterApprovingAndSubmittingTheForm(theForm);
   }
   else
   {
   	thisapp.sendEmailToVendorForDraft(theForm);
   }
   ```
3. **Open design question, needs an answer before this is finished, not guessed:** what
   should happen to the vendor after a rejection -- does the vendor need to be notified to
   re-draft, and does their `Approved_by_Vendor` / draft status need to be reset so the
   "Ready for Family" loop can run again? The brief says "the existing loop continues from
   there," but there is no existing family-reject loop to continue -- confirm with Andrea
   whether rejecting should re-open the vendor's draft (reset `Approved_by_Vendor` to
   false and re-email them) or something else, then extend step 2 above accordingly.

## 7. Strip unused form fields

Per the brief's "strip form fields the new process no longer uses" -- do this last, after
everything above is applied and tested, so it's clear from live testing which fields are
actually still read/written by the rebuilt workflow before removing anything. One concrete
candidate already identified: the large commented-out dead-code block in
`afterApprovingAndSubmittingTheForm` (~lines 354-424, flagged for deletion in §2) --
anything it referenced that isn't used elsewhere is safe to remove alongside it.
