# ZP-TBD-78 -- NOKIntake `Intake_Form.ds` guideline (Pre-Need -> At-Need conversion)

**`.ds` files are guideline-only** -- nothing below has been applied to `Intake_Form.ds`. Apply each
change in the Creator editor (Deluge script builder / form builder). Anchors are quoted from the
`Intake_Form.ds` in `widgets/NOKIntake/NOKIntake` as it stood on **2026-09-24** (confirmed current by
the developer). Line numbers are approximate -- search for the quoted text.

Companion pieces: CRM functions + Deals fields + widget are in
`crm/functions/deals/ZP-TBD-78_preneed_to_atneed_conversion/`. The widget edits
(`app/app.js`, `app/widget.html`) are already made -- see `widget-js-changes.md`.

Deploy order: **1 -> 2 -> 3 -> 4 -> 5**, then upload the widget last (deployment-checklist.md).

---

## 1. Two new fields on the `NOK_Information_Form` form

Add directly after the existing `Matched_Deal_Id` field (~line 2321):

```
Matched_PreNeed_Account_Id
(
	type = text
	displayname = "Matched PreNeed Account Id"
	row = 18
	column = 1
	width = medium
)
PreNeed_Not_A_Match
(
	type = checkbox
	displayname = "PreNeed Not A Match"
	initial value = false
	row = 18
	column = 1
	width = medium
)
```

Link names must be exactly `Matched_PreNeed_Account_Id` and `PreNeed_Not_A_Match` -- the widget
posts them by that name. (`Date_of_Birth` already exists on the form, ~line 891 -- no new DOB field.)

---

## 2. New Creator function `checkPreNeedMatch` (matcher, Creator copy)

Add in the `functions { Deluge { ... } }` block, right after `checkDuplicateDeceasedDeal`
(which ends just before `string combineDateAndTimeToDateTimeFormat`, ~line 3091).

This is the Creator twin of CRM `standalone.findPreNeedMatches` (Creator cannot cross-call a CRM
function without an extra connection scope). **Keep the two in step.** Rules are documented in
`findPreNeedMatches.deluge`: a Pre-Need Account is the Account of a Deal with `Type = 'Pre Need'`;
name = whole-word first + last match; DOB differing on both sides drops the candidate.

```deluge
map checkPreNeedMatch(string fullName, string dob)
{
	result = Map();
	matches = List();
	result.put("matches",matches);
	searchRaw = ifnull(fullName,"").toString();
	norm = searchRaw.toLowerCase().replaceAll("[^a-z0-9 ]"," ").replaceAll("\\s+"," ").trim();
	if(norm == "")
	{
		return result;
	}
	searchDob = ifnull(dob,"").toString().trim();
	nameParts = norm.toList(" ");
	firstWord = nameParts.get(0);
	lastWord = nameParts.get(nameParts.size() - 1);
	twoOrMore = nameParts.size() > 1;
	safeLast = lastWord.replaceAll("'","''");
	coqlMap = Map();
	coqlMap.put("select_query","select id, Deal_Name, Name_of_Deceased, Stage, Account_Name from Deals where Type = 'Pre Need' and Deal_Name like '%" + safeLast + "%' limit 200");
	coqlResp = Map();
	try 
	{
		coqlResp = invokeurl
		[
			url :"https://www.zohoapis.com/crm/v7/coql"
			type :POST
			parameters:coqlMap.toString()
			connection:"zoho_oauth_connection"
		];
	}	catch (eCoql)
	{
		coqlResp = Map();
	}
	strong = List();
	weak = List();
	seenAccounts = List();
	if(coqlResp.containKey("data"))
	{
		for each  dealRow in coqlResp.get("data")
		{
			acctId = "";
			acctName = "";
			acctLk = dealRow.get("Account_Name");
			if(acctLk != null)
			{
				try 
				{
					acctId = ifnull(acctLk.get("id"),"").toString();
					acctName = ifnull(acctLk.get("name"),"").toString();
				}		catch (eLk)
				{
					acctId = ifnull(acctLk,"").toString();
				}
			}
			if(acctId != "" && !seenAccounts.contains(acctId))
			{
				candName = acctName;
				if(candName == "")
				{
					candName = ifnull(dealRow.get("Name_of_Deceased"),ifnull(dealRow.get("Deal_Name"),"")).toString();
				}
				candNorm = candName.toLowerCase().replaceAll("[^a-z0-9 ]"," ").replaceAll("\\s+"," ").trim();
				nameOk = false;
				if(twoOrMore)
				{
					padded = " " + candNorm + " ";
					if(padded.contains(" " + firstWord + " ") && padded.contains(" " + lastWord + " "))
					{
						nameOk = true;
					}
				}
				else
				{
					if(candNorm == norm)
					{
						nameOk = true;
					}
				}
				if(nameOk)
				{
					acctInfo = Map();
					try 
					{
						acctResp = invokeurl
						[
							url :"https://www.zohoapis.com/crm/v7/Accounts/" + acctId + "?fields=Account_Name,Date_of_Birth,Deceased_Street_Address,Deceased_Street_Address_2,Deceased_City,Deceased_State,Deceased_Zip_Code,Deceased_Country"
							type :GET
							connection:"zoho_oauth_connection"
						];
						if(acctResp.containKey("data") && !acctResp.get("data").isEmpty())
						{
							acctInfo = acctResp.get("data").get(0);
						}
					}			catch (eAcct)
					{
						acctInfo = Map();
					}
					candDob = ifnull(acctInfo.get("Date_of_Birth"),"").toString().trim();
					dobMatch = false;
					dobConflict = false;
					if(searchDob != "" && candDob != "")
					{
						if(searchDob == candDob)
						{
							dobMatch = true;
						}
						else
						{
							dobConflict = true;
						}
					}
					if(!dobConflict)
					{
						addrParts = List();
						addrKeys = {"Deceased_Street_Address","Deceased_Street_Address_2","Deceased_City","Deceased_State","Deceased_Zip_Code","Deceased_Country"};
						for each  ak in addrKeys
						{
							av = ifnull(acctInfo.get(ak),"").toString().trim();
							if(av != "")
							{
								addrParts.add(av);
							}
						}
						dealId = ifnull(dealRow.get("id"),"").toString();
						m = Map();
						m.put("accountId",acctId);
						m.put("dealId",dealId);
						m.put("name",candName);
						m.put("dob",candDob);
						m.put("address",addrParts.toString(", "));
						m.put("stage",ifnull(dealRow.get("Stage"),"").toString());
						m.put("dobMatch",dobMatch);
						seenAccounts.add(acctId);
						if(dobMatch)
						{
							strong.add(m);
						}
						else
						{
							weak.add(m);
						}
					}
				}
			}
		}
	}
	matches.addAll(strong);
	matches.addAll(weak);
	result.put("matches",matches);
	return result;
}
```

---

## 3. `widgetLookup` -- new action `checkPreNeed`

In `string widgetLookup(string action, string value)`, add a branch **after** the
`else if(action == "checkDuplicateDeal") { ... }` block and **before** the final
`else { res.put("error","unknown action"); }` (~line 5925):

```deluge
                 	else if(action == "checkPreNeed")
                 	{
                 		parsedValue = Map();
                 		try 
                 		{
                 			parsedValue = value.toMap();
                 		}		catch (e)
                 		{
                 			parsedValue = Map();
                 		}
                 		pnResult = thisapp.checkPreNeedMatch(ifnull(parsedValue.get("name"),""),ifnull(parsedValue.get("dob"),""));
                 		res.put("matches",pnResult.get("matches"));
                 	}
```

The widget already calls `callApi('checkPreNeed', JSON.stringify({name, dob}))`. Until this branch
exists the API answers `{"error":"unknown action"}` and the widget just carries on (no popup) --
so the widget is safe to deploy before or after this step.

---

## 4. `accountManagement` -- protect the Pre-Need Account (the important one)

Once a Deal is linked to a Pre-Need Account, every later edit of the same intake record runs
`accountManagement`, which today **renames the Account, blanks its address and overwrites blank
Marital Status / Occupation** for First Call / Hospital / Police. On a Pre-Need Account that would
erase what the customer gave us when they bought the plan. This change (a) makes a brand-new
matched submission use the Pre-Need Account instead of creating one, and (b) stops the overwrite.

In `map accountManagement(NOK_Information_Form theForm)` (~line 2633):

**4a.** Directly after the line

```
                 	Deceased_Account_id = ifnull(theForm.account_id,"");
```

add:

```deluge
                 	// ZP-TBD-78: a Pre-Need Account confirmed at Intake is THE Account for this Deal.
                 	preNeedAcctId = ifnull(theForm.Matched_PreNeed_Account_Id,"").toString().trim();
                 	if(preNeedAcctId != "" && Deceased_Account_id == "")
                 	{
                 		Deceased_Account_id = preNeedAcctId;
                 	}
                 	isPreNeedLinked = preNeedAcctId != "" && Deceased_Account_id == preNeedAcctId;
```

**4b.** Directly before the line

```
                 	//accDataMap.put("Deceased_Zip_Code",theForm.Address_of_Record.postal_Code);
                 	if(Deceased_Account_id != "")
```

add:

```deluge
                 	// ZP-TBD-78: on a linked Pre-Need Account never overwrite name / address /
                 	// anything the form left blank -- only at-need facts (death date, size, condition,
                 	// a DOB that was actually entered) are written.
                 	if(isPreNeedLinked)
                 	{
                 		accDataMap.remove("Account_Name");
                 		blankKeys = List();
                 		for each  accKey in accDataMap.keys()
                 		{
                 			accVal = accDataMap.get(accKey);
                 			if(accVal == null || accVal.toString().trim() == "")
                 			{
                 				blankKeys.add(accKey);
                 			}
                 		}
                 		for each  blankKey in blankKeys
                 		{
                 			accDataMap.remove(blankKey);
                 		}
                 	}
```

(The existing `if(Deceased_Account_id != "") { updateRecord ... } else { createRecord ... }` that
follows is unchanged -- with `Deceased_Account_id` now set it takes the update branch, and
`updateAccount.containKey("id")` in both on-success blocks still works because updateRecord returns
the id, same as for existing-Account edits today.)

---

## 5. `dealInformationManagementV2` -- stamp the Intake decision on the Deal

Called by both on-success blocks (FC/other and Hospital-with-deal_id), so one edit covers them.
In `map dealInformationManagementV2(NOK_Information_Form theForm)` (~line 3783), directly after

```
                 	// Set account if available
                 	if(!isBlank(theForm.account_id))
                 	{
                 		dealDataMap.put("Account_Name",theForm.account_id);
                 	}
```

add:

```deluge
                 	// ZP-TBD-78: record the Pre-Need decision made at Intake so the CRM safety
                 	// check (flagPossiblePreNeedMatch) does not second-guess a person.
                 	if(ifnull(theForm.Matched_PreNeed_Account_Id,"").toString().trim() != "")
                 	{
                 		dealDataMap.put("Pre_Need_Status","Matched");
                 	}
                 	else if(theForm.PreNeed_Not_A_Match == true)
                 	{
                 		dealDataMap.put("Pre_Need_Status","Not a Match");
                 	}
```

Needs the Deals `Pre_Need_Status` field to exist first (crm guideline / checklist step 1).

---

## 6. Hospital + Police NEW cases -- pass the decision to the pickup record

New Hospital / Police cases (`Deal_Type == "Hospital" && deal_id == ""`, and the Police equivalent)
do not run the paths above: they create a Trip and a `Deceased_Pickups` child, and the CRM function
`onDeceasedPickupCreate` builds the Account + Deal. Two new fields on the **Deceased_Pickups CRM
module** carry the decision across (checklist step 2), and the merged
`onDeceasedPickupCreate_MERGED.deluge` reads them.

In **both** workflow blocks, add this directly before the existing

```
if(input.Duplicate_Confirmed == true && !isEmpty(input.Matched_Deal_Id))
{
	dealLkForChild = Map();
```

(Hospital block ~line 7395, Police block ~line 7706 -- the one that sits right after the
`if(ne != "") { childMap.put("NOK_Email",ne); }` lines):

```deluge
											// ZP-TBD-78: Pre-Need decision made at Intake -> pickup record
											try 
											{
												if(!isEmpty(input.Matched_PreNeed_Account_Id))
												{
													childMap.put("Matched_PreNeed_Account_Id",input.Matched_PreNeed_Account_Id);
												}
												if(input.PreNeed_Not_A_Match == true)
												{
													childMap.put("PreNeed_Not_A_Match",true);
												}
											}	catch (ePn)
											{
											}
```

---

## Not changed on purpose

- `accountManagement` still creates Accounts with `Account_Type = "Deceased"` for First Call. The
  Hospital / Police path (`onDeceasedPickupCreate`) creates Accounts **without** an Account_Type --
  pre-existing behaviour, untouched here. It does not affect matching (a Pre-Need Account is found
  through its `Type = 'Pre Need'` Deal, not its Account_Type).
- The duplicate-Deal popup (`checkDuplicateDeal`) is untouched and runs first; when it matches an
  existing recent Deal the widget skips the Pre-Need check (that Deal already has its Account).
- Edit mode (form opened from a CRM Deal, `deal_id` present) never runs the Pre-Need check.
