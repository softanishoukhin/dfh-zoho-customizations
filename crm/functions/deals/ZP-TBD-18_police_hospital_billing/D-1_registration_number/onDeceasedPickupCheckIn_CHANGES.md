# D-1 -- Registration number capture

Requirement (PH_Billing_Requirements_FINAL.md, D-1): the pre-printed registration
number from the driver's paper sheet must be captured digitally, flowing to the
Operations record and the Deal, and onto all of Ms. Shirley's reports.

## What's safe/clear to build now vs. what's still pending

**Safe/clear (this file covers it):** the 3 new fields, and the exact two-line
addition to `onDeceasedPickupCheckIn` to push the value from Deceased_Pickups
onto both Operations and the Deal. Verified against the FULL live function
(pulled via MCP, id `6503357000069144520`) -- not the abbreviated excerpt in
FUNCTION_SOURCES.md, which only showed a short fragment of what turned out to
be a much larger (~13KB, matches the doc's own size note), heavily
cross-module-syncing function.

**Still pending (not in scope of this file):**
- Adding the Driver App check-in form field itself (widget-side change,
  separate from this CRM-side change).
- Which specific reports need the number added -- MS_SHIRLEY_FOLLOWUP.md
  question #7 asks Shirley to confirm "all of them" vs. a specific list. Not
  guessed at here.

## 1. New field: `Registration_Number` (text) on 3 modules

Create via Setup > Customization > Modules and Fields, on each of:
- **Deceased_Pickups** (this is where the driver's input lands -- add it near
  the existing Refrigerator/Row/Drawer fields on the check-in layout, per the
  requirement: "alongside the existing refrigerator / row / drawer fields").
- **Operations**
- **Deals**

Simple single-line text field on all three -- no picklist, no special
validation called for in the requirement.

## 2. `onDeceasedPickupCheckIn` -- two additions, exact insertion points verified live

This function does far more than the D-1 requirement touches (NOK contact
sync, Deal identity-change cascade, Account creation, Ward sync, hang tag
generation, and a Transport auto-create block) -- verified by reading the
complete live function, not the FUNCTION_SOURCES.md excerpt. Both additions
below are placed using the SAME pattern the function already uses elsewhere
for driver-check-in-sourced fields, so they fit its existing style exactly.

### 2a. Operations write -- inside the existing `if(opsId != "")` block

Confirmed live, this block currently reads (abbreviated -- see the full
function for context):
```deluge
if(opsId != "")
{
	opsUpd = Map();
	v = ifnull(dp.get("Refrigerator"),""); if(v != "" && v != "-None-") { opsUpd.put("Refrigerator", v); }
	v = ifnull(dp.get("Row"),""); if(v != "" && v != "-None-") { opsUpd.put("Row", v); }
	v = ifnull(dp.get("Drawer"),""); if(v != "" && v != "-None-") { opsUpd.put("Drawer", v); }
	v = ifnull(dp.get("Room"),""); if(v != "" && v != "-None-") { opsUpd.put("Room", v); }
	v = ifnull(dp.get("Location"),""); if(v != "" && v != "-None-") { opsUpd.put("Location", v); }
	v = ifnull(dp.get("Condition"),""); if(v != "" && v != "-None-") { opsUpd.put("Condition", v); }
	v = ifnull(dp.get("Deceased_Size"),""); if(v != "" && v != "-None-") { opsUpd.put("Deceased_Size", v); }
	// <-- ADD HERE
	...
}
```
Add, right after the `Deceased_Size` line (or anywhere in this same
sequence -- these are independent, order doesn't matter):
```deluge
v = ifnull(dp.get("Registration_Number"),"");
if(v != "" && v != "-None-")
{
	opsUpd.put("Registration_Number",v);
}
```

### 2b. Deal write -- inside the existing `dealUpd` block

Confirmed live, the function already conditionally writes several
driver-check-in-sourced fields onto the Deal, all using this exact pattern
(only writes if the new value is non-empty AND differs from what's already
on the Deal):
```deluge
v = ifnull(dp.get("Deceased_Size"),"");
if(v != "" && v != "-None-" && v != "" + ifnull(dealRec.get("Deceased_Size"),""))
{
	dealUpd.put("Deceased_Size",v);
}
v = ifnull(dp.get("Condition"),"");
if(v != "" && v != "-None-" && v != "" + ifnull(dealRec.get("Condition"),""))
{
	dealUpd.put("Condition",v);
}
// ...same pattern continues for Doctor_Name, Police_Officer_Name, Police_Phone_Number, Deceased_Street_Address->Street_1, Deceased_City->City
```
Add, in the same sequence:
```deluge
v = ifnull(dp.get("Registration_Number"),"");
if(v != "" && v != "" + ifnull(dealRec.get("Registration_Number"),""))
{
	dealUpd.put("Registration_Number",v);
}
```
(No `"-None-"` check here since Registration_Number is a free-text field, not
a picklist -- matches the pattern used for the other free-text fields in this
same block, e.g. Doctor_Name, which also skips the `-None-` check.)

## Test

Driver enters a registration number at check-in on a Deceased Pickup ->
appears on the linked Operations record and the Deal. Re-checking-in with the
same number a second time makes no additional write (dedup via the
value-comparison guard, matching how every other field in this block already
behaves).
