# ZP-TBD-61 — Cashier-triggered "Create Transfer Trip" button on Invoices

**Source:** `transfer_trip_request_explanation.md`. Andrea wanted a simple
button a cashier could click on a Books invoice to create the Transfer
Trips that Hospital, Police, and Mobay-Closed-Lost-First-Call cases
eventually need, as an unassigned/available trip drivers can pick up from
the Driver App — mirroring how First Call pickups already work, without
the cashier having to build a Trip record by hand.

## Facts confirmed live before building (not assumed)

- **Pipeline** values gating the three rules: `"Hospital Cases"`,
  `"Police Cases"`, `"First Call"`.
- **Letter-received fields** on Deals: Hospital → `Hospital_Release_Date`
  (non-blank = received). Police → `Receiving_Letter_of_No_Interest_Date`
  (confirmed with the developer over two other similarly-named date fields
  that turned out not to be it).
- **First Call location gate**: `Case_Location` (the two full branch-address
  strings — matched by `.contains("Kingston")`/`.contains("Montego Bay")`)
  + `Stage == "Closed Lost"`.
- **Trip_Type**: no `"Transfer Trip"` value exists on the Trips module;
  reused the existing `"Transfer to Other Funeral Home"` value instead of
  adding a new picklist entry.
- **"Ops" destination**: confirmed to always mean the same Mobay Ops Center
  address block already hardcoded in the four existing trip-creation
  automations (`createTripsFromDealsForFirstCall`,
  `createTripForWholesale`, `createTripFromDealForPoliceCases`,
  `createTripsFromDealForHospitalCase`) — reused verbatim rather than
  inventing a new address representation.
- **Available/unassigned trip mechanics**: `Trip_Status = "Requested"`,
  `Driver`/`Driver_App_User` left blank. The Driver App's `Driver_App.ds` →
  `fetchAvailablePool()` filters on a **hardcoded allow-list** of
  `Trip_Type` values — `"Transfer to Other Funeral Home"` had to be added
  to it, or trips created by this button would never show up as claimable.
- **Family invoice identification** — resolved with the developer: Books
  custom buttons can't be conditionally hidden per invoice, so this button
  appears on every invoice. On click, the function cross-references the
  Books invoice's `cf_crm_invoice_id` to its CRM Invoices record and checks
  `Invoice_For == "Family" || Invoice_For == ""`. If it doesn't qualify, the
  button tells the cashier to open the family invoice instead, rather than
  silently proceeding or failing.
- **Pickup address for Hospital/Police Transfer Trips**: reused the exact
  `Location_Street_1`/`Location_City`/`Location_Zip` fields the existing
  `createTripFromDealForPoliceCases` function already uses for the
  deceased's current location — confirmed by pulling that function's live
  source directly rather than guessing a hospital/MOH-lookup-based field.

## What was built

**1. New Books custom button** — `Create Transfer Trip` (id
`5830143000035748114`), entity Invoice, page view "Details Page Menu"
(per-record, not mass-action — confirmed against the existing
`Create Master Invoice` button, which turned out to be a mass-action button
with no per-invoice context, so not a usable template for wiring, though
its `code`/`message` return convention — `0 = success, non-zero = failure`
— was confirmed correct and reused as-is).

**2. New Books custom function** (entity `invoice`), full logic:

```deluge
invoiceID = invoice.get("invoice_id");
organizationID = organization.get("organization_id");
response = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/invoices/" + invoiceID + "?organization_id=" + organizationID
	type :GET
	connection:"zohobooksconnection"
];
invoiceInfo = response.get("invoice");
dealId = "";
crmInvoiceId = "";
try
{
	dealId = ifnull(invoiceInfo.get("custom_field_hash").get("cf_related_crm_deal_id"),"");
	crmInvoiceId = ifnull(invoiceInfo.get("custom_field_hash").get("cf_crm_invoice_id"),"");
}
catch (e)
{
	dealId = "";
	crmInvoiceId = "";
}
resultMap = Map();
if(dealId == "")
{
	resultMap.put("message","This invoice isn't linked to a case yet.");
	resultMap.put("code",1);
	return resultMap;
}
dealDetails = invokeurl
[
	url :"https://www.zohoapis.com/crm/v7/Deals/" + dealId
	type :GET
	connection:"zohocrmconnection"
];
recordInfo = dealDetails.get("data").get(0);
pipeline = ifnull(recordInfo.get("Pipeline"),"");
caseLocation = ifnull(recordInfo.get("Case_Location"),"");
stage = ifnull(recordInfo.get("Stage"),"");
hospitalReleaseDate = ifnull(recordInfo.get("Hospital_Release_Date"),"");
noInterestDate = ifnull(recordInfo.get("Receiving_Letter_of_No_Interest_Date"),"");
pickupStreet = "";
pickupCity = "";
pickupZip = "";
destinationStreet = "";
destinationStreet2 = "";
destinationCity = "";
if(pipeline == "Hospital Cases" || pipeline == "Police Cases")
{
	// Confirm this invoice is actually the family invoice before checking
	// anything else -- Books buttons can't be hidden conditionally, so this
	// button appears on every invoice regardless of type.
	isFamilyInvoice = false;
	if(crmInvoiceId != "")
	{
		try
		{
			crmInvoiceDetails = zoho.crm.getRecordById("Invoices",crmInvoiceId);
			invoiceFor = ifnull(crmInvoiceDetails.get("Invoice_For"),"");
			if(invoiceFor == "Family" || invoiceFor == "")
			{
				isFamilyInvoice = true;
			}
		}
		catch (e)
		{
			isFamilyInvoice = false;
		}
	}
	if(isFamilyInvoice == false)
	{
		resultMap.put("message","This isn't the family invoice -- open the family invoice to trigger the Transfer Trip.");
		resultMap.put("code",1);
		return resultMap;
	}
	letterReceived = false;
	if(pipeline == "Hospital Cases" && hospitalReleaseDate != "")
	{
		letterReceived = true;
	}
	if(pipeline == "Police Cases" && noInterestDate != "")
	{
		letterReceived = true;
	}
	if(letterReceived == false)
	{
		if(pipeline == "Hospital Cases")
		{
			resultMap.put("message","The Hospital Release Letter hasn't been received yet.");
		}
		else
		{
			resultMap.put("message","The No Interest Letter hasn't been received yet.");
		}
		resultMap.put("code",1);
		return resultMap;
	}
	if(invoiceInfo.get("status") != "paid")
	{
		resultMap.put("message","The family invoice isn't paid yet.");
		resultMap.put("code",1);
		return resultMap;
	}
	// Both conditions met -- Transfer Trip to Ops (Mobay Ops Center),
	// pickup = wherever the deceased currently is on the Deal.
	pickupStreet = ifnull(recordInfo.get("Location_Street_1"),"");
	pickupCity = ifnull(recordInfo.get("Location_City"),"");
	pickupZip = ifnull(recordInfo.get("Location_Zip"),"");
	destinationStreet = "Mobay Ops Center";
	destinationStreet2 = "";
	destinationCity = "Montego Bay";
}
else if(pipeline == "First Call" && stage == "Closed Lost" && caseLocation.contains("Montego Bay"))
{
	pickupStreet = "Mobay Ops Center";
	pickupCity = "Montego Bay";
	pickupZip = "";
	destinationStreet = "Delapenha Funeral Home (Montego Bay)";
	destinationStreet2 = "45 Union Street";
	destinationCity = "Montego Bay";
}
else if(pipeline == "First Call" && stage == "Closed Lost" && caseLocation.contains("Kingston"))
{
	resultMap.put("message","Kingston First Call cases don't need a Transfer Trip.");
	resultMap.put("code",0);
	return resultMap;
}
else
{
	resultMap.put("message","Transfer Trip isn't applicable for this case.");
	resultMap.put("code",1);
	return resultMap;
}
// Duplicate check -- one Transfer Trip per Deal.
existingTrips = zoho.crm.getRelatedRecords("Trips","Deals",dealId);
for each  trip in existingTrips
{
	if(trip.get("Trip_Type") == "Transfer to Other Funeral Home")
	{
		resultMap.put("message","A Transfer Trip already exists for this case.");
		resultMap.put("code",0);
		return resultMap;
	}
}
tripMap = Map();
tripMap.put("Name","Transfer Trip for " + recordInfo.get("Account_Name").get("name"));
tripMap.put("Trip_Type","Transfer to Other Funeral Home");
tripMap.put("Trip_Status","Requested");
tripMap.put("Deal",dealId);
tripMap.put("Pickup_Street_Address",pickupStreet);
tripMap.put("Pickup_City",pickupCity);
tripMap.put("Pickup_Sector_Code",pickupZip);
tripMap.put("Destination_Street_Address",destinationStreet);
tripMap.put("Destination_Street_Address_2",destinationStreet2);
tripMap.put("Destination_City",destinationCity);
current_time = zoho.currenttime.toTime();
start_time = (zoho.currentdate + " 09:00:00").toTime();
end_time = (zoho.currentdate + " 17:00:00").toTime();
if(current_time >= start_time && current_time <= end_time)
{
	tripMap.put("Owner",zoho.crm.getOrgVariable("tripOwnerID"));
}
else
{
	tripMap.put("Owner",recordInfo.get("Owner").get("id"));
}
tripCreationResult = zoho.crm.createRecord("Trips",tripMap,{"trigger":{"workflow"}});
tripAccountRelation = Map();
tripAccountRelation.put("Trips",tripCreationResult.get("id"));
tripAccountRelation.put("Related_Account_Record",recordInfo.get("Account_Name").get("id"));
zoho.crm.createRecord("Trips_Accounts_Relation",tripAccountRelation);
dealMap = Map();
dealMap.put("Trips",tripCreationResult.get("id"));
zoho.crm.updateRecord("Deals",dealId,dealMap);
resultMap.put("message","Transfer Trip created and available for drivers to pick up.");
resultMap.put("code",0);
return resultMap;
```

**3. Driver App change** (`widgets/driverApp/driverApp/Driver_App.ds`,
guideline-only per the standing rule) — added
`allowedTypes.add("Transfer to Other Funeral Home");` to
`fetchAvailablePool()`'s allow-list, alongside the existing `"First Call"`,
`"Police Case Pickup"`, `"Initial Police Case Pickup"`, `"Hospital Storage"`
entries.

**4. Widget change** (`widgets/driverApp/driverApp/app/app.js`, direct edit
— not a `.ds` file) — added a case to `badgeForType()` so these trips show
a `"Transfer"` badge in the driver's list instead of falling through to the
generic default.

## Out of scope

- The four existing trip-creation automations (First Call, Wholesale,
  Police, Hospital) are untouched — this is a separate, new button-
  triggered path.
- No new CRM Trip_Type picklist value (reused an existing one).
- No handling for Wholesale or any pipeline besides Hospital/Police/First
  Call, per the brief.

## Status

Button, function, `.ds` change, and widget change all deployed and
confirmed live 2026-09-07 (button + function pulled back and verified
byte-for-byte against what was specified, one deliberate connection-name
substitution noted above). **Not yet tested against real Hospital/Police/
Mobay-First-Call scenarios** — see the plan's verification checklist
(`transient-booping-cupcake.md`) for the specific test cases to run before
considering this fully proven in production.
