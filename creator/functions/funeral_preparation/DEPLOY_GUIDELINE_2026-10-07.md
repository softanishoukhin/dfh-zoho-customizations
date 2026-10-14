# Deploy Guideline — 7 Oct 2026

**Covers:**
- **Part A, ZP-TBD-102:** Casket Management edit queue
- **Part B, ZP-TBD-103:** Funeral Equipment parent product
- **Part C:** Operations App, removing Report 6 (Family Viewing Forms) from the menu

The parts don't depend on each other, so deploy them in any order. Within each part, follow the steps in order.

| File | Where |
|---|---|
| Casket Management widget zip | `D:\Office\Andrea_Projects\DFH\widgets\casketManagement\casketManagementWidget\dist\casketManagementWidget.zip` |
| Funeral Preparation widget zip | `D:\Office\Andrea_Projects\DFH\widgets\FuneralPrep\FuneralPrepWidget\dist\FuneralPrepWidget.zip` |
| Operations App widget zip | `D:\Office\Andrea_Projects\DFH\widgets\OpsApp\OperationsApp\OpsAppWidget\dist\OpsAppWidget.zip` |

---

## Part A — Casket Management: edit queue (ZP-TBD-102)

**After this:**
- The tile **New edits** opens a queue with one line per edit: casket, field, old → new, and when it was edited.
- **Mark as seen** (or **Mark all as seen**) removes edits from the queue.
- If the same field is changed again, that edit comes back as new.

### A1. New form `Casket_Edit_Ack`
Casket Management > Edit > Create Form > **Blank form**, name **Casket Edit Ack**. Check that the link name is `Casket_Edit_Ack`.

Add these fields. All are **Single Line**, none mandatory. Check each link name matches exactly:

| Field label | Link name |
|---|---|
| Edit Key | `Edit_Key` |
| Operations ID | `Operations_ID` |
| Deceased Name | `Deceased_Name` |
| Field Name | `Field_Name` |
| Acknowledged By | `Acknowledged_By` |
| Acknowledged At | `Acknowledged_At` |

Save the form. Don't add any form workflows.

### A2. Two new functions
Go to Workflow > Functions > **New Function**, choose namespace **Deluge**, then paste each function below into its own editor and save. Create `casketEditAcks` first.

**A2.1 `casketEditAcks`**
```
string casketEditAcks()
{
	out = Map();
	seen = Map();
	recs = Casket_Edit_Ack[ID != 0];
	for each  r in recs
	{
		k = ifnull(r.Edit_Key,"") + "";
		if(k != "")
		{
			s = Map();
			s.put("by",ifnull(r.Acknowledged_By,"") + "");
			s.put("at",ifnull(r.Acknowledged_At,"") + "");
			seen.put(k,s);
		}
	}
	out.put("success",true);
	out.put("seen",seen);
	return out.toString();
}
```

**A2.2 `acknowledgeCasketEdits`**
```
string acknowledgeCasketEdits(String editsJson)
{
	out = Map();
	out.put("success",false);
	edits = List();
	try
	{
		edits = ifnull(editsJson,"[]").toJSONList();
	}
	catch (eParse)
	{
		out.put("message","Could not read the edits sent.");
		return out.toString();
	}
	byUser = ifnull(zoho.loginuserid,"") + "";
	atText = zoho.currenttime.toString("yyyy-MM-dd'T'HH:mm:ss") + "-05:00";
	added = 0;
	for each  e in edits
	{
		m = e.toString().toMap();
		k = ifnull(m.get("key"),"") + "";
		if(k != "")
		{
			existing = Casket_Edit_Ack[Edit_Key == k];
			if(existing.count() == 0)
			{
				insert into Casket_Edit_Ack
				[
					Added_User=zoho.loginuser
					Edit_Key=k
					Operations_ID=ifnull(m.get("opsId"),"") + ""
					Deceased_Name=ifnull(m.get("name"),"") + ""
					Field_Name=ifnull(m.get("field"),"") + ""
					Acknowledged_By=byUser
					Acknowledged_At=atText
				];
				added = added + 1;
			}
		}
	}
	out.put("success",true);
	out.put("added",added);
	out.put("by",byUser);
	out.put("at",atText);
	return out.toString();
}
```

The existing functions `casketBuildList` and `updateCasketFields` are **not** changed.

### A3. Two new Custom APIs
Go to Microservices > Custom API > **Create**. Use the same settings as the existing `Casket_Build_List` and `Update_Casket_Field` APIs:
- Authentication: OAuth2
- User scope: include the **Casket Manager** portal profile
- Response: Standard

| Custom API name (link name) | Method | Function | Parameters |
|---|---|---|---|
| `Casket_Edit_Acks` | GET | casketEditAcks | none |
| `Acknowledge_Casket_Edits` | POST | acknowledgeCasketEdits | `editsJson` (from request body) |

### A4. Portal profile
Go to Settings > Users and Control > Portal > profile **Casket Manager**, and allow the two new Custom APIs, the same way the existing two are allowed.

### A5. Widget
Go to Settings > Widgets, open the existing widget **Caskets to Build**, and upload `casketManagementWidget.zip`. Keep the index file as `/app/widget.html` and save.

### A5b. CRM: record the edit date/time (added 7 Oct, after testing)
Without this step every edit shows **"Edited (date not recorded)"**. The reason is that no CRM workflow was writing the "changed on" dates to the Operations record.

1. Go to CRM > Setup > Developer Hub > Functions, open **Handel Workflow Trigger and Action by Timeline Process**, and click Edit.
2. Find the line `//End Arrival Time Confirmed`. It appears once.
3. Directly below it, paste the whole content of
   `dfh-zoho-customizations\crm\functions\deals\ZP-TBD-102_casket_change_stamps\casket_change_stamps_block.deluge`.
4. Save.

This only affects edits made after the save. Older edits keep "date not recorded" but still work in the queue.

### A6. Test
1. Open **Caskets to Build**. The **⚠ New edits** tile shows a number. Click it and the queue opens.
2. Click **Mark as seen** on one line. It disappears and the number drops by 1.
3. Click **Show seen edits**. The line is back, greyed, with "Seen by <you> · <time>".
4. Click **Refresh**. That line is still seen.
5. In CRM, change that casket's colours again, then Refresh. The Colours edit is back as new.
6. Click **Mark all as seen**. The tile shows 0, and the cards show "edited · seen" instead of "⚠ changed".

> **First use:** every existing edit shows as new once, because nothing has been marked seen yet. Click **Mark all as seen** to clear that backlog.

---

## Part B — Funeral Equipment parent product (ZP-TBD-103)

**After this:** Easel, Lighting and any other hearse equipment sit under a new parent product, **Funeral Equipment**. They show on every load list:
- Funeral Preparation checklist, Section 4
- Driver App, "Load the car"
- Trip Manager, Daily Funeral Report and Driver Sheet, under Items

### B1. CRM: create the parent product
1. Go to CRM > Products and create **Funeral Equipment** the same way the existing parent product **Programs** is set up: same kind of record, same settings, price $0. The name must be exactly `Funeral Equipment`.
2. Open the products **Easel** and **Lighting**, and change their parent from Programs to **Funeral Equipment**. Use the same field that links them to Programs today. Save.
3. From now on, add Easel and Lighting to a Deal's Product Selection under the parent **Funeral Equipment**.

Deals that already have Easel or Lighting under Programs keep showing them, because Programs stays on the load lists.

### B2. Funeral Preparation app
**B2.1** Go to Workflow > Functions > `fpLoadList` and replace the whole function with:
```
list fpLoadList(map deal)
{
	items = List();
	lines = List();
	try
	{
		pulled = deal.get("Product_Selection");
		if(pulled != null)
		{
			lines = pulled.toList();
		}
	}
	catch (eSub)
	{
		lines = List();
	}
	for each  line in lines
	{
		parentName = "";
		try
		{
			parentName = ifnull(line.get("Parent_Product").get("name"),"") + "";
		}
		catch (ePp)
		{
			parentName = "";
		}
		childName = "";
		try
		{
			childName = ifnull(line.get("Child_Product").get("name"),"") + "";
		}
		catch (eCp)
		{
			childName = "";
		}
		if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs" || parentName == "Funeral Equipment")
		{
			it = Map();
			it.put("key","ps:" + ifnull(line.get("id"),"") + "");
			it.put("source","Deal");
			it.put("category",parentName);
			it.put("name",childName);
			it.put("qty",ifnull(line.get("Quantity"),"") + "");
			items.add(it);
		}
	}
	// walk-in invoice (Invoices.Is_walk_in_Invoice = true)
	dealId = ifnull(deal.get("id"),"") + "";
	walkInId = "";
	if(dealId != "")
	{
		invs = List();
		try
		{
			invs = zoho.crm.getRelatedRecords("Invoices","Deals",dealId.toLong(),1,200,Map(),"zoho_oauth_connection");
		}
		catch (eInv)
		{
			invs = List();
		}
		for each  inv in invs
		{
			isWalkIn = false;
			try
			{
				isWalkIn = inv.get("Is_walk_in_Invoice") == true;
			}
			catch (eFlag)
			{
				isWalkIn = false;
			}
			if(isWalkIn && walkInId == "")
			{
				walkInId = ifnull(inv.get("id"),"") + "";
			}
		}
	}
	if(walkInId != "")
	{
		invResp = Map();
		try
		{
			invResp = invokeurl
			[
				url :"https://www.zohoapis.com/crm/v8/Invoices/" + walkInId
				type :GET
				connection:"zoho_oauth_connection"
			];
		}
		catch (eInvGet)
		{
			invResp = Map();
		}
		invLines = List();
		try
		{
			invData = invResp.get("data").toList();
			if(invData.size() > 0)
			{
				rawItems = invData.get(0).get("Invoiced_Items");
				if(rawItems != null)
				{
					invLines = rawItems.toList();
				}
			}
		}
		catch (eInvParse)
		{
			invLines = List();
		}
		for each  il in invLines
		{
			ipName = "";
			try
			{
				ipName = ifnull(il.get("Parent_Product").get("name"),"") + "";
			}
			catch (eIpp)
			{
				ipName = "";
			}
			icName = "";
			try
			{
				icName = ifnull(il.get("Product_Name").get("name"),"") + "";
			}
			catch (eIcp)
			{
				icName = "";
			}
			if(ipName == "Flowers" || ipName == "Cremation Merchandise" || ipName == "Programs" || ipName == "Funeral Equipment")
			{
				it2 = Map();
				it2.put("key","wi:" + ifnull(il.get("id"),"") + "");
				it2.put("source","Walk-in invoice");
				it2.put("category",ipName);
				it2.put("name",icName);
				it2.put("qty",ifnull(il.get("Quantity"),"") + "");
				items.add(it2);
			}
		}
	}
	return items;
}
```

**B2.2** Go to Settings > Widgets and upload `FuneralPrepWidget.zip` to **both** widgets. Only a message text changed.
- **DFH Family Viewing**, index `/app/viewing.html`
- **DFH Pre-Funeral Reconciliation**, index `/app/prep.html`

### B3. Driver App: function `getFuneralStartInfo`
Change 2 lines, each appearing once. Save. No widget change is needed.

**Line 1 (Product Selection)**
**Find:**
```
if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs")
```
**Replace with:**
```
if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs" || parentName == "Funeral Equipment")
```

**Line 2 (walk-in invoice)**
**Find:**
```
if(invParentName == "Flowers" || invParentName == "Cremation Merchandise" || invParentName == "Programs")
```
**Replace with:**
```
if(invParentName == "Flowers" || invParentName == "Cremation Merchandise" || invParentName == "Programs" || invParentName == "Funeral Equipment")
```

### B4. Trip Manager: 2 functions

**`getDailyFuneralRollup`:** this line appears **twice**. Change both:
**Find (both lines):**
```
if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs")
```
**Replace with:**
```
if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs" || parentName == "Funeral Equipment")
```

**`getTripDetail`:** 2 lines.

Line 1 (Product Selection):
**Find:**
```
if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs")
```
**Replace with:**
```
if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs" || parentName == "Funeral Equipment")
```

Line 2 (walk-in invoice):
**Find:**
```
if(wParentName == "Flowers" || wParentName == "Cremation Merchandise" || wParentName == "Programs")
```
**Replace with:**
```
if(wParentName == "Flowers" || wParentName == "Cremation Merchandise" || wParentName == "Programs" || wParentName == "Funeral Equipment")
```

Save both functions. No widget change is needed.

### B5. Test
1. Take a Deal with a funeral tomorrow. Add **Easel** and **Lighting** under the parent **Funeral Equipment** and save.
2. In Funeral Preparation > Funeral Prep, open that funeral and check:
   - Section 4 lists Easel and Lighting.
   - Section 3 says **Lighting required: Yes**.
   - Section 5 doesn't count Easel or Lighting.
3. In the Driver App, open the funeral trip. "Load the car" lists Easel and Lighting (Funeral Equipment).
4. In Trip Manager, the Daily Funeral Report and Driver Sheet for that funeral list them under Items.
5. A Deal that still has Lighting under Programs keeps showing it everywhere.

---

## Part C — Operations App: Report 6 off the menu

Andrea's document says to remove Family Viewing Forms from the Ops App once the Funeral Preparation app is live. The Funeral Preparation app is now live. The report's code is kept but no longer reachable.

### C1. Widget
Go to Operations App > Settings > Widgets, open the existing Operations widget, upload `OpsAppWidget.zip` (index `/app/widget.html`), and save.

### C2. Optional clean-up
In Operations App > Microservices > Custom API, you may leave **Ops_Report_Family_Viewing** in place (harmless) or remove it from the Operations Staff portal profile.

### C3. Test
1. Open the Operations portal. The Reports menu shows 1, 2, 3, 4, 4b and 7, with no Family Viewing Forms.
2. Open every other report. They all work as before.

---

## After deploying
- All the code is already in the repo:
  - `dfh-zoho-customizations\creator\functions\casket_management\ZP-TBD-102_casket_edit_queue\`
  - `dfh-zoho-customizations\creator\functions\funeral_preparation\ZP-TBD-103_funeral_equipment_parent_product\`
- Two user-guide edits are still pending, to be done when the Google Docs connector is reconnected:
  - **Operations Portal tab:** remove Part 9 (Family Viewing Forms) and its rows in the menu table and Appendix A.
  - **Funeral Preparation tab, Section 4:** add Funeral Equipment to the categories.
