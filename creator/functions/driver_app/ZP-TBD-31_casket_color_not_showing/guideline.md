# ZP-TBD-31 — Casket color not showing (Driver App + Trip Manager)

**STATUS (2026-08-19): DEPLOYED AND CONFIRMED PASSING.** Also switched the casket color
display in both apps from a color swatch (hex-to-visual-box) to plain labeled text
("Primary Color: X" / "Secondary Color: Y") per Andrea's follow-up feedback — no code
converts the color name to an actual rendered color anymore.

App: Zoho Creator "Driver App". Function: `map getFuneralStartInfo(String tripId)` in
`Driver_App.ds`. Guideline only.

Found while testing ZP-TBD-30 (TM Trip Details Card): casket product name shows correctly
in both DA and TM, but the color never shows in either app.

## Root cause (confirmed live via `ZohoCRM_getFields` on Deals)

`getFuneralStartInfo` reads casket color from the **Product_Selection subform row**:
`Casket_Color`, `Casket_Trim_Color`, `Casket_Secondary_Color`. **None of these fields exist
anywhere in the Deals module** (checked the full live field list, subform fields included —
zero matches for any of the three names).

The real casket color fields are `Primary_Color` and `Secondary_Color` — **Deal-level
fields**, not subform-row fields. This is the same pair of fields already used by the
`casketSpecialInstructionsTimin` client script fixed in [[ZP-TBD-28]] (`onSaveEditPage`
reads `ZDK.Page.getField("Primary_Color")` / `("Secondary_Color")`), and the same pair
`Casket_Color_Selected_Time` is stamped alongside. So the color has always lived on the
Deal itself (one casket color per Deal, set once via that flow) — it was never per-subform-
row data, which is also why the old field names being wrong never got noticed: a Deal only
ever has one casket line in practice, so the fields were guessed rather than confirmed.

This is the canonical function (per [[TM_Urgent_Change_Request]] — TM must reuse DA's exact
logic), so fixing it here is what both apps need.

## The fix

`dealInfo` (the full Deal record, already fetched with no `fields` restriction at
`Driver_App.ds` ~line 2088) already contains `Primary_Color` and `Secondary_Color` — no new
API call needed, just read them once and use them instead of the per-row fields.

### Step 1 — read the Deal-level colors once, before the Product_Selection loop
Find where `haveCasket = false;` / `urnName = "";` are initialized just before the
`for each line in ...` loop (~line 2140-2160 region, right before the loop that contains
the `// --- Casket (first "Caskets" line wins) ---` comment) and add:
```deluge
dealCasketPrimary = ifnull(dealInfo.get("Primary_Color"),"");
dealCasketSecondary = ifnull(dealInfo.get("Secondary_Color"),"");
```

### Step 2 — use them in the Casket block (Step 5, Product_Selection path)
Find (~line 2184-2219):
```deluge
// --- Casket (first "Caskets" line wins) ---
if(parentName == "Caskets" && !haveCasket)
{
	cPrimary = "";
	try 
	{
		cPrimary = ifnull(line.get("Casket_Color"),"");
	}				catch (eC1)
	{
		cPrimary = "";
	}
	cSecondary = "";
	try 
	{
		cSecondary = ifnull(line.get("Casket_Trim_Color"),"");
	}				catch (eC2)
	{
		cSecondary = "";
	}
	if(cSecondary == "")
	{
		try 
		{
			cSecondary = ifnull(line.get("Casket_Secondary_Color"),"");
		}					catch (eC3)
		{
			cSecondary = "";
		}
	}
	casketOut = Map();
	casketOut.put("name",childName);
	casketOut.put("primary",cPrimary);
	casketOut.put("secondary",cSecondary);
	result.put("casket",casketOut);
	haveCasket = true;
}
```
Replace with:
```deluge
// --- Casket (first "Caskets" line wins). Color comes from the Deal itself
// (Primary_Color / Secondary_Color) -- there is no per-row color field. ---
if(parentName == "Caskets" && !haveCasket)
{
	casketOut = Map();
	casketOut.put("name",childName);
	casketOut.put("primary",dealCasketPrimary);
	casketOut.put("secondary",dealCasketSecondary);
	result.put("casket",casketOut);
	haveCasket = true;
}
```

### Step 3 — same fix in the Walk-In Invoice fallback (Step 6, ~line 2334-2368)
Find:
```deluge
if(invParentName == "Caskets" && !haveCasket)
{
	iPrimary = "";
	try 
	{
		iPrimary = ifnull(invLine.get("Casket_Color"),"");
	}					catch (eIc1)
	{
		iPrimary = "";
	}
	iSecondary = "";
	try 
	{
		iSecondary = ifnull(invLine.get("Casket_Trim_Color"),"");
	}					catch (eIc2)
	{
		iSecondary = "";
	}
	if(iSecondary == "")
	{
		try 
		{
			iSecondary = ifnull(invLine.get("Casket_Secondary_Color"),"");
		}						catch (eIc3)
		{
			iSecondary = "";
		}
	}
	casketOut2 = Map();
	casketOut2.put("name",invChildName);
	casketOut2.put("primary",iPrimary);
	casketOut2.put("secondary",iSecondary);
	result.put("casket",casketOut2);
	haveCasket = true;
}
```
Replace with:
```deluge
if(invParentName == "Caskets" && !haveCasket)
{
	casketOut2 = Map();
	casketOut2.put("name",invChildName);
	casketOut2.put("primary",dealCasketPrimary);
	casketOut2.put("secondary",dealCasketSecondary);
	result.put("casket",casketOut2);
	haveCasket = true;
}
```

## Corresponding fix already folded into ZP-TBD-30 (Trip Manager)

`ZP-TBD-30`'s guideline (`Trip_Manager.ds` `getTripDetail`) has been updated to match this
fix exactly: it now reads `Primary_Color`/`Secondary_Color` from the Deal record it already
fetches (added to the `fields` param) instead of the nonexistent per-row subform fields.
See that guideline for the exact diff.

## Test
1. Open a Deal with a casket color already set (`Primary_Color`/`Secondary_Color` populated,
   any Deal from the 682-record backlog mentioned in [[ZP-TBD-28]] works) and its funeral
   trip in Driver App — confirm the casket color swatches/names now show.
2. Open the same trip in Trip Manager (after ZP-TBD-30 is also applied) — confirm the Casket
   row shows the same colors.
3. Confirm a Deal with no casket color set still shows the casket name with no color
   (empty string, not an error).
