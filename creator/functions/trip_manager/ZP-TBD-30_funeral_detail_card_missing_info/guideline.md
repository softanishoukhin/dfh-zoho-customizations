# ZP-TBD-30 — TM Trip Details Card: add Deceased Name, Casket, and Merchandise/Floral

**STATUS (2026-08-19): DEPLOYED AND CONFIRMED PASSING**, including the ZP-TBD-31
casket-color fix folded in below, and the plain-text (no swatch) casket color display.

App: Zoho Creator "Trip Manager". Function: `map getTripDetail(string tripId)` in
`Trip_Manager.ds`. Guideline only — apply directly in the Creator function editor.

Source spec: `TM_Urgent_Change_Request_Explanation.md`, Section 1. Confirmed by reading
`renderDetail()` in `tripManagerApp/app/widget.html` (lines 1396-1426) that, for funeral
trips, TM is currently missing: **Deceased Name, Casket info, and the
Merchandise/Items/Floral list**. Every other field on the Driver App reference screenshot
(Funeral Date/Time, Service Location/Church, Burial/Interment, Interment/Grave Type,
Hearse, Driver, Attendant, Departure Time) already exists in TM and must not be duplicated.

## Reuse rule (per spec Section 6 — do not create a separate merchandise calculation)

`Driver_App.ds`'s `map getFuneralStartInfo(String tripId)` is the canonical source for
casket/urn/merchandise classification (Product_Selection Step 5 + Walk-In Invoice Step 6
fallback). Trip Manager is a separate Creator app, so its own function can't call DA's
function directly — but `getTripDetail` already does a REST GET on the linked Deal
(`Trip_Manager.ds` ~line 2569) and already requests `Product_Selection` in the `fields`
param (used today only for the hearse-lock check). This fix ports the **exact same**
classification rules into that existing block, so the bucket names, matching logic, and
fallback order stay identical to DA — no drift.

## The fix

### Step 1 — add `Name_of_Deceased`, `Primary_Color`, `Secondary_Color` to the Deal fields param
**Update (2026-08-19):** casket color turned out to come from Deal-level `Primary_Color`/
`Secondary_Color` fields, not from any Product_Selection subform field — see [[ZP-TBD-31]]
for the full root-cause writeup (confirmed live via `ZohoCRM_getFields`: no
`Casket_Color`/`Casket_Trim_Color`/`Casket_Secondary_Color` field exists anywhere in
Deals). Both new fields are added here.

Find (around line 2569):
```deluge
params.put("fields","Church_Chapel,Place_of_Internment,Special_Instructions,Funeral_Time,Product_Selection,Airline,Flight_Number,Airway_Bill_Number,Arriving_Date_Time,Arriving_Airport1,Airline_2,Flight_Number_2,Arriving_Date_Time_2,Airline_3,Flight_Number_3,Arriving_Date_Time_3,Departing_Date_Time,Owner,Grave_Type,Funeral_Special_Instructions");
```
Replace with (adds `Name_of_Deceased`, `Primary_Color`, `Secondary_Color`):
```deluge
params.put("fields","Church_Chapel,Place_of_Internment,Special_Instructions,Funeral_Time,Product_Selection,Airline,Flight_Number,Airway_Bill_Number,Arriving_Date_Time,Arriving_Airport1,Airline_2,Flight_Number_2,Arriving_Date_Time_2,Airline_3,Flight_Number_3,Arriving_Date_Time_3,Departing_Date_Time,Owner,Grave_Type,Funeral_Special_Instructions,Name_of_Deceased,Primary_Color,Secondary_Color");
```

### Step 2 — declare new result variables
Find the block of `dealX = "";` declarations right after `hearseLocked = false;` (~line
2536) and add three more lines there:
```deluge
dealDeceasedName = "";
dealCasket = Map();
dealMerchandise = List();
dealCasketPrimary = "";
dealCasketSecondary = "";
```

### Step 3 — read `Name_of_Deceased` alongside the other scalar Deal fields
Find the existing block that reads `Special_Instructions` (~line 2619-2627) and add right
after it:
```deluge
if(dealRec.containKey("Name_of_Deceased"))
{
	ndRaw = dealRec.get("Name_of_Deceased");
	ndStr = "" + ndRaw;
	if(ndStr != "" && ndStr != "null")
	{
		dealDeceasedName = ndStr;
	}
}
dealCasketPrimary = ifnull(dealRec.get("Primary_Color"),"");
dealCasketSecondary = ifnull(dealRec.get("Secondary_Color"),"");
```

### Step 4 — extend the existing `Product_Selection` loop with casket/urn/merchandise classification
Find the existing loop (~line 2745-2776):
```deluge
if(dealRec.containKey("Product_Selection"))
{
	productRows = dealRec.get("Product_Selection");
	for each  productRow in productRows
	{
		try
		{
			parentLk = productRow.get("Parent_Product");
			parentId = "" + parentLk.get("id");
			if(parentId == "6503357000020030033")
			{
				childLk = productRow.get("Child_Product");
				childId = "" + childLk.get("id");
				if(childId != "" && childId != "null")
				{
					childProdRec = zoho.crm.getRecordById("Products",childId.toLong(),{"connection":"zohocrm_connection"});
					if(childProdRec.containKey("id"))
					{
						abRaw = childProdRec.get("Availability_Based");
						abStr = "" + abRaw;
						if(abStr == "true")
						{
							hearseLocked = true;
						}
					}
				}
			}
		}		catch (eRow)
		{
		}
	}
}
```
Replace the body of the `try` block (keep the existing hearse-lock check exactly as-is,
just add the new classification alongside it — same shape as `getFuneralStartInfo` Step 5
in `Driver_App.ds`):
```deluge
if(dealRec.containKey("Product_Selection"))
{
	haveCasket = false;
	urnNameTm = "";
	productRows = dealRec.get("Product_Selection");
	for each  productRow in productRows
	{
		try
		{
			parentLk = productRow.get("Parent_Product");
			parentId = "" + parentLk.get("id");
			parentName = "";
			try
			{
				parentName = ifnull(parentLk.get("name"),"");
			}			catch (ePn)
			{
				parentName = "";
			}
			if(parentId == "6503357000020030033")
			{
				childLk = productRow.get("Child_Product");
				childId = "" + childLk.get("id");
				if(childId != "" && childId != "null")
				{
					childProdRec = zoho.crm.getRecordById("Products",childId.toLong(),{"connection":"zohocrm_connection"});
					if(childProdRec.containKey("id"))
					{
						abRaw = childProdRec.get("Availability_Based");
						abStr = "" + abRaw;
						if(abStr == "true")
						{
							hearseLocked = true;
						}
					}
				}
			}
			childName = "";
			try
			{
				cpLk = productRow.get("Child_Product");
				childName = ifnull(cpLk.get("name"),"");
			}			catch (eCn)
			{
				childName = "";
			}
			if(parentName == "Caskets" && !haveCasket)
			{
				dealCasket.put("name",childName);
				dealCasket.put("primary",dealCasketPrimary);
				dealCasket.put("secondary",dealCasketSecondary);
				haveCasket = true;
			}
			if(parentName == "Cremation Merchandise" && urnNameTm == "")
			{
				if(childName.toLowerCase().contains("urn"))
				{
					urnNameTm = childName;
				}
			}
			if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs")
			{
				mLineTm = Map();
				mLineTm.put("category",parentName);
				mLineTm.put("name",childName);
				dealMerchandise.add(mLineTm);
			}
		}		catch (eRow)
		{
		}
	}
}
```

### Step 5 — put the new keys on the result map
Find (~line 2793):
```deluge
result.put("deal_special_instructions",dealSpecialInstructions);
```
Add right after it:
```deluge
result.put("deal_deceased_name",dealDeceasedName);
result.put("deal_casket",dealCasket);
result.put("deal_merchandise",dealMerchandise);
```

**Walk-In Invoice fallback (DA's Step 6) intentionally NOT ported here** — `getTripDetail`
doesn't currently fetch `Invoices`/`Deal.id` in a form that makes that lookup cheap, and
Andrea's screenshot example doesn't demonstrate a walk-in-only scenario. If a live test
shows a funeral trip where DA displays merchandise from a Walk-In Invoice but TM's card
comes up empty, that's the signal to port Step 6 too (same shape as
`Driver_App.ds` lines 2259-2390) — flag it rather than guessing blind.

## Widget-side (already applied directly, no guideline needed)
`tripManagerApp/app/widget.html` `renderDetail()` now reads `t.deal_deceased_name`,
`t.deal_casket`, `t.deal_merchandise` and renders:
- A "Deceased" row (same style as the non-funeral category's `Deceased_Names_Summary` row).
- A "Casket" row/box when `deal_casket.name` is present.
- A "Merchandise" section listing every `deal_merchandise` line, grouped by `category`
  (Flowers shown under a "Floral" heading, Cremation Merchandise and Programs under
  "Items").

## Test
1. Open a Funeral with Burial trip in TM whose Deal has a Casket product selected —
   confirm Deceased Name and Casket name/colors now show on the Trip Details Card.
2. Confirm a Deal with Flowers/Programs/Cremation-Merchandise product rows shows them
   grouped correctly (Flowers under Floral, the rest under Items/Merchandise).
3. Confirm a Deal with NO products in those categories shows no empty/broken section (the
   Merchandise box should either hide or show a clean "No items" state — match existing TM
   empty-state styling).
4. Confirm nothing else on the card changed (Church, Grave Type, Departure rows etc. still
   render exactly as before).
5. Cross-check against DA: open the same trip in Driver App and confirm the casket name/
   colors and merchandise list match exactly what TM now shows.
