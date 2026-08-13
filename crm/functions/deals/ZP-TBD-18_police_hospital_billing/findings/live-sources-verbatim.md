# Verbatim live function sources, pulled 2026-08-14 for verification

All pulled via MCP `getFunctionCode` by numeric id (bare/qualified names don't
work with that tool -- only numeric IDs, confirmed this session). Kept here for
traceability and so P-2/P-3/H-1 follow-up work doesn't need to re-pull them.
See `verification-findings.md` for what these revealed vs. what
`FUNCTION_SOURCES.md` claimed.

---

## `automation.UpdateStorageFeeonHospitalReleaseDate` (id `6503357000003769101`)

```deluge
void automation.UpdateStorageFeeonHospitalReleaseDate(Int crmid)
{
getRecordInfo = invokeurl
[
	url :"https://www.zohoapis.com/crm/v2.1/Deals/" + crmid
	type :GET
	connection:"zohooauth"
];
recordInfo = getRecordInfo.get("data").get(0);
salesOrders = standalone.COQLQuery("select Subject from Sales_Orders where Deal_Name = '" + crmid + "' and Sales_Order_Type = 'Hospital Cases' limit 1");
info salesOrders;
if(salesOrders.size() > 0)
{
	salesOrderDetails = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v7/Sales_Orders/" + salesOrders.toList().get(0).get("id")
		type :GET
		connection:"zohooauth"
	];
	salesOrderInfo = salesOrderDetails.get("data").get(0);
	storageDaysForAutopsy = recordInfo.get("Initial_Trip_Completed_At").days360(recordInfo.get("Hospital_Release_Date"));
	storageDaysForAutopsy = storageDaysForAutopsy + 1;
	if(storageDaysForAutopsy <= 0)
	{
		storageDaysForAutopsy = 1;
	}
	if(recordInfo.get("Pipeline") == "Police Cases")
	{
		storageProductOfPolice = "select Product_Name from Products where Parent_Product = '6503357000020022236' and Product_Category = 'Storage'";
		storageProducts = standalone.COQLQuery(storageProductOfPolice);
		if(storageProducts.size() > 0)
		{
			storageProducts = storageProducts.toList();
			productDetails = zoho.crm.getRecordById("Products",storageProducts.get(0).get("id"));
		}
		else
		{
			productDetails = zoho.crm.getRecordById("Products","6503357000002869275");
		}
	}
	else if(recordInfo.get("Pipeline") == "Hospital Cases")
	{
		if(!isNull(recordInfo.get("Selected_Hospital")))
		{
			storageProductOfHospital = "select Product_Name from Products where Product_of_This_Hospital = '" + recordInfo.get("Selected_Hospital").get("id") + "' and Product_Category = 'Storage'";
			storageProducts = standalone.COQLQuery(storageProductOfHospital);
			if(storageProducts.size() > 0)
			{
				storageProducts = storageProducts.toList();
				productDetails = zoho.crm.getRecordById("Products",storageProducts.get(0).get("id"));
			}
		}
		else
		{
			productDetails = null;
		}
	}
	if(!isNull(productDetails))
	{
		storageProductID = productDetails.get("id");
		lineItemList = list();
		if(salesOrderInfo.get("Ordered_Items").size() > 0)
		{
			lineItemList = salesOrderInfo.get("Ordered_Items");
		}
		existingStorageFeeIndex = -1;
		for each  item in lineItemList
		{
			if(item.contains("Product_Name"))
			{
				productName = item.get("Product_Name");
				if(productName != null && productName.contains("id") && productName.get("id") == storageProductID)
				{
					existingStorageFeeIndex = lineItemList.indexOf(item);
					break;
				}
			}
		}
		if(existingStorageFeeIndex >= 0)
		{
			existingItem = lineItemList.get(existingStorageFeeIndex);
			existingItem.put("Quantity",storageDaysForAutopsy);
			lineItemList.remove(existingStorageFeeIndex);
			lineItemList.add(existingItem);
		}
		else
		{
			productMap = Map();
			productMap.put("Product_Name",storageProductID);
			productMap.put("Quantity",storageDaysForAutopsy);
			productMap.put("List_Price",productDetails.get("Unit_Price"));
			lineItemList.add(productMap);
		}
		salesOrderMap = Map();
		salesOrderMap.put("Ordered_Items",lineItemList);
		recordList = list();
		recordList.add(salesOrderMap);
		dataMap = Map();
		dataMap.put("data",recordList);
		info dataMap;
		updateSalesOrder = invokeurl
		[
			url :"https://www.zohoapis.com/crm/v2.1/Sales_Orders/" + salesOrders.toList().get(0).get("id")
			type :PUT
			parameters:dataMap.toString()
			connection:"zohooauth"
		];
		info updateSalesOrder;
		standalone.createInvoiceBasedOnSalesOrderForHospital(crmid);
	}
}
}
```

---

## `automation.updateStorageFeeOnTransferToAnohterFuneralHome` (id `6503357000003553141`, note the live typo "Anohter")

```deluge
void automation.updateStorageFeeOnTransferToAnohterFuneralHome(Int crmid)
{
getRecordInfo = invokeurl
[
	url :"https://www.zohoapis.com/crm/v2.1/Deals/" + crmid
	type :GET
	connection:"zohooauth"
];
recordInfo = getRecordInfo.get("data").get(0);
salesOrders = standalone.COQLQuery("select Subject from Sales_Orders where Deal_Name = '" + crmid + "' and Sales_Order_Type = 'Police Cases' limit 1");
info salesOrders;
if(salesOrders.size() > 0)
{
	salesOrderDetails = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v7/Sales_Orders/" + salesOrders.toList().get(0).get("id")
		type :GET
		connection:"zohooauth"
	];
	salesOrderInfo = salesOrderDetails.get("data").get(0);
	storageDaysForAutopsy = recordInfo.get("Initial_Trip_Completed_At").days360(recordInfo.get("Date_of_the_transfer_trip"));
	info storageDaysForAutopsy;
	if(storageDaysForAutopsy <= 0)
	{
		storageDaysForAutopsy = 1;
	}
	productDetails = zoho.crm.getRecordById("Products","6503357000002869275");
	storageProductID = productDetails.get("id");
	lineItemList = list();
	if(salesOrderInfo.get("Ordered_Items").size() > 0)
	{
		lineItemList = salesOrderInfo.get("Ordered_Items");
	}
	existingStorageFeeIndex = -1;
	for each  item in lineItemList
	{
		if(item.contains("Product_Name"))
		{
			productName = item.get("Product_Name");
			if(productName != null && productName.contains("id") && productName.get("id") == storageProductID)
			{
				existingStorageFeeIndex = lineItemList.indexOf(item);
				break;
			}
		}
	}
	if(existingStorageFeeIndex >= 0)
	{
		existingItem = lineItemList.get(existingStorageFeeIndex);
		existingItem.put("Quantity",storageDaysForAutopsy);
		lineItemList.remove(existingStorageFeeIndex);
		lineItemList.add(existingItem);
	}
	else
	{
		productMap = Map();
		productMap.put("Product_Name",storageProductID);
		productMap.put("Quantity",storageDaysForAutopsy);
		productMap.put("List_Price",productDetails.get("Unit_Price"));
		lineItemList.add(productMap);
	}
	salesOrderMap = Map();
	salesOrderMap.put("Ordered_Items",lineItemList);
	recordList = list();
	recordList.add(salesOrderMap);
	dataMap = Map();
	dataMap.put("data",recordList);
	info dataMap;
	updateSalesOrder = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v2.1/Sales_Orders/" + salesOrders.toList().get(0).get("id")
		type :PUT
		parameters:dataMap.toString()
		connection:"zohooauth"
	];
	info updateSalesOrder;
	// 	dealMap = Map();
	// 	dealMap.put("Stage","Autopsy Completed");
	// 	zoho.crm.updateRecord("Deals",crmid,dealMap);
}
}
```

---

## `automation.createTripOnTheDayOfAutopsyDateWithTask` (id `6503357000009016197`) -- P-2 clone template

```deluge
void automation.createTripOnTheDayOfAutopsyDateWithTask(Int crmid)
{
dealDetails = invokeurl
[
	url :"https://www.zohoapis.com/crm/v7/Deals/" + crmid
	type :GET
	connection:"zohooauth"
];
recordInfo = dealDetails.get("data").get(0);
pipeline = recordInfo.get("Pipeline");
trips = zoho.crm.getRelatedRecords("Trips","Deals",crmid);
tripAvailable = false;
tripId = null;
for each  trip in trips
{
	if(trip.get("Trip_Type") == "Autopsy Initial" && trip.get("Created_on_This_Field_Update") == "Autopsy_Date")
	{
		tripId = trip.get("id");
		tripAvailable = true;
		break;
	}
}
tripMap = Map();
isInCare = ifnull(recordInfo.get("Is_Deceased_In_Our_Care"),"");
if(isInCare == "Yes")
{
	// Scenario A: Pickup = DFH location from Operations, Destination = autopsy facility
	opsCriteria = "(Related_Deal:equals:" + crmid + ")";
	opsRecords = zoho.crm.searchRecords("Operations",opsCriteria,1,1);
	for each  op in opsRecords
	{
		if(ifnull(op.get("id"),"") != "")
		{
			opsLocation = ifnull(op.get("Location"),"");
			if(opsLocation == "Kingston")
			{
				tripMap.put("Pickup_Street_Address","20A W. Kings House Rd.");
				tripMap.put("Pickup_City","Kingston");
			}
			else if(opsLocation == "Montego Bay")
			{
				tripMap.put("Pickup_Street_Address","45 Union St.");
				tripMap.put("Pickup_City","Montego Bay");
			}
			else if(opsLocation != "")
			{
				tripMap.put("Pickup_Street_Address",opsLocation);
				tripMap.put("Pickup_City","Montego Bay");
			}
			break;
		}
	}
	if(!isNull(recordInfo.get("Autopsy_Locations")))
	{
		try
		{
			autopsyAcct = zoho.crm.getRecordById("Accounts",recordInfo.get("Autopsy_Locations").get("id"));
			tripMap.put("Destination_Street_Address",ifnull(autopsyAcct.get("Billing_Street"),""));
			tripMap.put("Destination_City",ifnull(autopsyAcct.get("Billing_City"),""));
		}
		catch (eAcct)
		{
		}
	}
}
else
{
	// Scenario B: Pickup = autopsy facility, Destination = DFH
	if(!isNull(recordInfo.get("Autopsy_Locations")))
	{
		try
		{
			autopsyAcct = zoho.crm.getRecordById("Accounts",recordInfo.get("Autopsy_Locations").get("id"));
			tripMap.put("Pickup_Street_Address",ifnull(autopsyAcct.get("Billing_Street"),""));
			tripMap.put("Pickup_City",ifnull(autopsyAcct.get("Billing_City"),""));
		}
		catch (eAcct)
		{
		}
	}
	tripMap.put("Destination_Street_Address","45 Union St.");
	tripMap.put("Destination_City","Montego Bay");
}
if(!isNull(recordInfo.get("Autopsy_Locations")))
{
	autopsyLocId = "";
	try
	{
		autopsyLocId = ifnull(recordInfo.get("Autopsy_Locations").get("id"),"");
	}
	catch (eLoc)
	{
		autopsyLocId = "";
	}
	if(autopsyLocId != "")
	{
		locMap = Map();
		locMap.put("id",autopsyLocId);
		tripMap.put("Autopsy_Location",locMap);
	}
}
if(!isNull(recordInfo.get("Autopsy_Date_Time")))
{
	tripMap.put("Scheduled_Date",recordInfo.get("Autopsy_Date_Time"));
	mp = Map();
	mp.put("Subject","Follow Up Completion of Form E for " + recordInfo.get("Account_Name").get("name"));
	mp.put("$se_module","Deals");
	mp.put("What_Id",crmid);
	mp.put("Owner",recordInfo.get("Owner").get("id"));
	mp.put("Due_Date",recordInfo.get("Autopsy_Date_Time").toDate().addDay(2));
	mp.put("Status","Not Started");
	mp.put("Send_Notification_Email",true);
	mp.put("Task_Type","Completion of Form E");
	createTask = zoho.crm.createRecord("Tasks",mp);
	// NOTE (verification finding): this Task creation is OUTSIDE the
	// tripAvailable==false check below -- it runs on EVERY invocation that
	// has an Autopsy_Date_Time, including the "trip already exists, just
	// update it" branch. A P-2 clone needs its own guard if this pattern is
	// reused, or every re-run duplicates the Task.
}
if(tripAvailable == false)
{
	tripMap.put("Name","Autopsy Trip");
	tripMap.put("Trip_Type","Autopsy Initial");
	tripMap.put("Trip_Status","DO NOT SCHEDULE");
	tripMap.put("Deal",crmid);
	tripMap.put("Created_on_This_Field_Update","Autopsy_Date");
	tripMap.put("Owner",recordInfo.get("Owner").get("id"));
	tripCreationResult = zoho.crm.createRecord("Trips",tripMap,{"trigger":{"workflow"}});
	info tripCreationResult;
	tripAccountRelation = Map();
	tripAccountRelation.put("Trips",tripCreationResult.get("id"));
	tripAccountRelation.put("Related_Account_Record",recordInfo.get("Account_Name").get("id"));
	zoho.crm.createRecord("Trips_Accounts_Relation",tripAccountRelation);
	dealMap = Map();
	dealMap.put("Trips",tripCreationResult.get("id"));
	zoho.crm.updateRecord("Deals",crmid,dealMap);
}
else
{
	zoho.crm.updateRecord("Trips",tripId,tripMap,{"trigger":{"workflow"}});
}
}
```

---

## `automation.updateSalesorderWithStorageFee` (id `6503357000003289008`) -- the autopsy-path storage function (P-1's "also apply the cap here" target, NOT sourced at all in FUNCTION_SOURCES.md)

```deluge
void automation.updateSalesorderWithStorageFee(Int crmid)
{
getRecordInfo = invokeurl
[
	url :"https://www.zohoapis.com/crm/v2.1/Deals/" + crmid
	type :GET
	connection:"zohooauth"
];
recordInfo = getRecordInfo.get("data").get(0);
taxFieldResponse = invokeurl
[
	url :"https://www.zohoapis.com/crm/v8/settings/fields/6503357000000002797?module=Products"
	type :GET
	connection:"zohooauth"
];
taxFieldMap = Map();
fieldsList = taxFieldResponse.get("fields");
if(fieldsList != null && fieldsList.size() > 0)
{
	pickListValues = fieldsList.get(0).get("pick_list_values");
	for each  pickVal in pickListValues
	{
		actualValue = pickVal.get("actual_value");
		valParts = actualValue.toList(" - ");
		taxName = valParts.get(0);
		pctPart = valParts.get(1).replaceAll(" %","").trim();
		pctNum = pctPart.toDecimal();
		entry = Map();
		entry.put("id",pickVal.get("id"));
		entry.put("percentage",pctNum);
		entry.put("name",taxName);
		taxFieldMap.put(actualValue,entry);
	}
}
salesOrders = standalone.COQLQuery("select Subject from Sales_Orders where Deal_Name = '" + crmid + "' and Sales_Order_Type = 'Police Cases' limit 1");
info salesOrders;
if(salesOrders.size() > 0)
{
	salesOrderDetails = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v7/Sales_Orders/" + salesOrders.toList().get(0).get("id")
		type :GET
		connection:"zohooauth"
	];
	salesOrderInfo = salesOrderDetails.get("data").get(0);
	storageDaysForAutopsy = recordInfo.get("Initial_Trip_Completed_At").days360(recordInfo.get("Autopsy_Completed_Date_Time"));
	storageDaysForAutopsy = storageDaysForAutopsy + 1;
	// ^^^ P-1 cap would go here (same pattern as the LNI-path function) --
	// NOT applied, gated on open question O-A2/O-7 (does the 2-day cap
	// apply to the autopsy-completed path, or LNI only?).
	storageProductOfPolice = "select Product_Name from Products where Parent_Product = '6503357000020022236' and Product_Category = 'Storage'";
	storageProducts = standalone.COQLQuery(storageProductOfPolice);
	if(storageProducts.size() > 0)
	{
		storageProducts = storageProducts.toList();
		productDetails = zoho.crm.getRecordById("Products",storageProducts.get(0).get("id"));
	}
	else
	{
		productDetails = zoho.crm.getRecordById("Products","6503357000002869275");
	}
	storageProductID = productDetails.get("id");
	lineItemList = list();
	if(salesOrderInfo.get("Ordered_Items").size() > 0)
	{
		lineItemList = salesOrderInfo.get("Ordered_Items");
	}
	existingStorageFeeIndex = -1;
	for each  item in lineItemList
	{
		if(item.contains("Product_Name"))
		{
			productName = item.get("Product_Name");
			if(productName != null && productName.contains("id") && productName.get("id") == storageProductID)
			{
				existingStorageFeeIndex = lineItemList.indexOf(item);
				break;
			}
		}
	}
	if(existingStorageFeeIndex >= 0)
	{
		existingItem = lineItemList.get(existingStorageFeeIndex);
		existingItem.put("Quantity",storageDaysForAutopsy);
		lineItemList.remove(existingStorageFeeIndex);
		lineItemList.add(existingItem);
	}
	else
	{
		productMap = Map();
		productMap.put("Product_Name",storageProductID);
		productMap.put("Quantity",storageDaysForAutopsy);
		productMap.put("List_Price",productDetails.get("Unit_Price"));
		lineAmount = productMap.get("Quantity") * productMap.get("List_Price");
		taxList = productDetails.get("Tax");
		if(taxList != null && taxList.size() > 0)
		{
			taxInfo = taxFieldMap.get(taxList.get(0));
			if(taxInfo != null)
			{
				taxPct = taxInfo.get("percentage");
				taxValue = (lineAmount * taxPct / 100).round(2);
				taxEntry = Map();
				taxEntry.put("id",taxInfo.get("id"));
				taxEntry.put("name",taxInfo.get("name"));
				taxEntry.put("percentage",taxPct);
				taxEntry.put("value",taxValue);
				productMap.put("Line_Tax",{taxEntry});
				productMap.put("Tax",taxValue);
			}
			else
			{
				productMap.put("Line_Tax",list());
				productMap.put("Tax",0);
			}
		}
		else
		{
			productMap.put("Line_Tax",list());
			productMap.put("Tax",0);
		}
		lineItemList.add(productMap);
	}
	salesOrderMap = Map();
	salesOrderMap.put("Ordered_Items",lineItemList);
	recordList = list();
	recordList.add(salesOrderMap);
	dataMap = Map();
	dataMap.put("data",recordList);
	info dataMap;
	updateSalesOrder = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v2.1/Sales_Orders/" + salesOrders.toList().get(0).get("id")
		type :PUT
		parameters:dataMap.toString()
		connection:"zohooauth"
	];
	info updateSalesOrder;
	dealMap = Map();
	dealMap.put("Stage","Autopsy Completed");
	zoho.crm.updateRecord("Deals",crmid,dealMap);
	standalone.createInvoiceBasedOnSalesOrderForPolice(crmid);
}
}
```

---

## `saveAutopsyDisposition` -- Driver App (Creator), `Driver_App.ds` line 3726, NOT a CRM function

Read directly from the local, confirmed-current `Driver_App.ds`. The relevant
excerpt (full function is longer -- also writes Outcome, and continues past
what's shown here):

```deluge
map saveAutopsyDisposition(String childTripId, String opsId, String outcome, String recvHome, String recvReason, String rescheduleReason)
{
	...
	rescheduleMap = Map();
	rescheduleMap.put("xray","X-ray required");
	rescheduleMap.put("notdone","Autopsy not done");
	rescheduleMap.put("dfh","Problem caused by DFH");
	...
	if(resolvedOpsId != "")
	{
		opsRow = Map();
		opsRow.put("Outcome",outcomeLabel);
		if(outcomeLabel == "Reschedule")
		{
			rr = ifnull(rescheduleReason,"").trim();
			rrLabel = ifnull(rescheduleMap.get(rr),"");
			if(rrLabel == "") { rrLabel = rr; }
			if(rrLabel != "") { opsRow.put("Reschedule_Reason",rrLabel); }
		}
		opsDataList = List(); opsDataList.add(opsRow);
		opsTrigger = List(); opsTrigger.add("workflow");
		opsBody = Map(); opsBody.put("data",opsDataList); opsBody.put("trigger",opsTrigger);
		opsResp = invokeurl
		[
			url :"https://www.zohoapis.com/crm/v7/Operations/" + resolvedOpsId
			type :PUT
			parameters:opsBody.toString()
			headers:{"Content-Type":"application/json"}
			connection:"zohocrm_connection"
		];
		...
	}
	...
}
```

Confirms: writes `Operations.Reschedule_Reason` with the exact three labels,
via a REST PUT that explicitly passes `"trigger":["workflow"]` -- so a new
Workflow Rule on Operations, trigger = field update on `Reschedule_Reason`,
WILL fire from this call.
