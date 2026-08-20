# ZP-TBD-36 — Retain the Unidentified name when a deceased is renamed (Identified)

Requested by Andrea (`PH_Billing process and Workflows.docx`, "Rename Function
(Unidentified → Identified)"): *"we need a way to retain the unidentified name in the
deal... insert the unidentified name in a field on Deal and the related record named,
Unidentified Name:. When renaming occurs, old value goes to this field on Deal and Ops
record."* Field-limit note: confirmed 2026-08-20 that the Deal field-limit increase has
landed, so the new `Unidentified_Name` field can be added now.

Live-verified 2026-08-20 against `automation.onPoliceDropoffNameCorrected` (id
`6503357000071818139`) -- confirmed the closest/correct match to "the function you built
awhile back" (per the 2026-08-19 code map's survey of the 3 related rename functions).
This is the only one that actually overwrites `Deal_Name`, which is the value that needs
to be captured before it's lost.

**Open question, not guessed -- confirm with Andrea before/after deploying:** if a Deal
gets renamed more than once (e.g. corrected a second time), should `Unidentified_Name`
keep the very first unidentified name, or get overwritten with whatever the name was
immediately before the latest rename? This guideline implements the literal reading of her
instruction ("when renaming occurs, old value goes to this field") -- i.e. it overwrites
`Unidentified_Name` on every rename with whatever `Deal_Name` was right before that
specific rename. If she wants the *original* unidentified name preserved permanently
through multiple renames instead, that needs a one-line guard (`if field is still empty`)
added on top of this.

## Step 1 — add the field

**Deals module:** add `Unidentified_Name` -- Single Line text.
**Operations module:** add `Unidentified_Name` -- Single Line text.

## Step 2 — capture the old name before it's overwritten

`automation.onPoliceDropoffNameCorrected` (id `6503357000071818139`)

Find (the very top of the function):
```deluge
void automation.onPoliceDropoffNameCorrected(Int crmid)
{
recordInfo = zoho.crm.getRecordById("Deals",crmid);
newName = ifnull(recordInfo.get("Name_of_Deceased"),"");
if(newName == "")
{
	return;
}
dealUpdateMap = Map();
dealUpdateMap.put("Deal_Name",newName);
try
{
	zoho.crm.updateRecord("Deals",crmid,dealUpdateMap);
}
catch (e)
{
}
```
Replace with:
```deluge
void automation.onPoliceDropoffNameCorrected(Int crmid)
{
recordInfo = zoho.crm.getRecordById("Deals",crmid);
newName = ifnull(recordInfo.get("Name_of_Deceased"),"");
if(newName == "")
{
	return;
}
oldUnidentifiedName = ifnull(recordInfo.get("Deal_Name"),"");
dealUpdateMap = Map();
dealUpdateMap.put("Deal_Name",newName);
if(oldUnidentifiedName != "" && oldUnidentifiedName != newName)
{
	dealUpdateMap.put("Unidentified_Name",oldUnidentifiedName);
}
try
{
	zoho.crm.updateRecord("Deals",crmid,dealUpdateMap);
}
catch (e)
{
}
```

Then find the Operations-update block further down:
```deluge
if(opsId != "")
{
	dodString = "DOD Unknown";
	dodValue = ifnull(recordInfo.get("Date_of_Death"),"");
	if(dodValue != "")
	{
		try
		{
			dodString = dodValue.toString("dd-MMM-yyyy");
		}
		catch (e)
		{
			dodString = "" + dodValue;
		}
	}
	opsUpdateMap = Map();
	opsUpdateMap.put("Name",newName + " - " + dodString + " - Ops Record");
	try
	{
		zoho.crm.updateRecord("Operations",opsId.toLong(),opsUpdateMap);
	}
	catch (e)
	{
	}
```
Replace the `opsUpdateMap` build with:
```deluge
	opsUpdateMap = Map();
	opsUpdateMap.put("Name",newName + " - " + dodString + " - Ops Record");
	if(oldUnidentifiedName != "" && oldUnidentifiedName != newName)
	{
		opsUpdateMap.put("Unidentified_Name",oldUnidentifiedName);
	}
	try
	{
		zoho.crm.updateRecord("Operations",opsId.toLong(),opsUpdateMap);
	}
	catch (e)
	{
	}
```

Nothing else in the function changes -- the Account rename and hang-tag regeneration below
are untouched.

## Test

1. Create/find a test Deal whose `Deal_Name` is still an unidentified placeholder (e.g.
   "Unidentified Male") with `Name_of_Deceased` set to a real name.
2. Trigger `onPoliceDropoffNameCorrected` -- confirm `Deal_Name` updates to the real name
   as before, AND confirm the new `Unidentified_Name` field on the Deal now holds
   "Unidentified Male".
3. Confirm the linked Operations record's `Unidentified_Name` field is also populated the
   same way, and that `Operations.Name` still rebuilds correctly (unchanged behavior).
4. Trigger the function again on the same Deal with no further name change (`newName ==
   Deal_Name` already) -- confirm `Unidentified_Name` is NOT overwritten with the same
   value (the `oldUnidentifiedName != newName` guard prevents a no-op rename from
   clobbering the field with itself).
