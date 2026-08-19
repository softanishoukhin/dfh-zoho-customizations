# ZP-TBD-32 — TM Driver Sheet: eligible-funerals list + print sheet

App: Zoho Creator "Trip Manager". New functions in `Trip_Manager.ds` + two new Custom
APIs, following the exact pattern already used for `getBurialSchedule` /
`Get_Burial_Schedule`. Guideline only.

Source spec: `TM_Urgent_Change_Request_Explanation.md`, Sections 2-5. Implements the
"Driver Sheets" sidebar tool (previously a placeholder that just toasted "Coming soon").

**Closed-out rule, confirmed with the user (2026-08-19):** "not closed out" is decided by
`Trip_Status` alone (`!= 'Completed'`) — **not** by the linked Deal's `Stage`. Checked live:
Deals has ~80 Stage values and roughly 40 carry `deal_category: "Closed Won"` (things like
"Funeral Completed", "Ready for Pickup", "Hold for Clothing") while a Deal can legitimately
still be in an open stage ("Ready for Driver", "Trip Scheduled") right up to the funeral.
COQL can't return `deal_category` directly, so checking it would mean hardcoding a ~40-value
stage list that silently goes stale whenever a new stage is added — rejected as too fragile.
If a real case shows up later where a Completed-Deal funeral still appears on the list, that's
the signal to revisit this, not something to guess now.

## Reuse rule — no separate merchandise logic

`getDriverSheetPrintData` does **not** re-implement casket/merchandise/deceased-name
lookup. It calls the existing `getTripDetail(tripId)` function directly (same `.ds` file,
a normal in-app function call) and returns its result as-is. `getTripDetail` already
carries everything the sheet needs, once [[ZP-TBD-30]] and [[ZP-TBD-31]] are applied:
`deal_deceased_name`, `deal_casket` (name/primary/secondary — plain text, no swatch),
`deal_merchandise` (Flowers/Cremation Merchandise/Programs, same grouping as Driver App),
`deal_church`, `deal_internment`, `deal_grave_type`, `deal_funeral_special_instructions`,
plus the raw Trip fields `Driver`, `Attendant_NEW`, `Vehicle`/`Amber_Vehicle`/
`Rental_Vehicles`, `Scheduled_Date`, `Departure_Time`. This is the same guarantee the spec
asks for in Section 6: one calculation, reused everywhere (DA, TM card, TM Driver Sheet).

## New function 1 — `list getDriverSheetList()`

Same shape/batching pattern as `getBurialSchedule` (`Trip_Manager.ds` ~line 1435), but
keyed off Trips (so "a related trip has been created" and "driver hasn't completed it" are
enforced directly) instead of Deals.

```deluge
list getDriverSheetList()
{
	result = List();
	nowStr = zoho.currenttime.toString("yyyy-MM-dd'T'HH:mm:ss") + "-05:00";
	trips = List();
	try
	{
		tq = Map();
		tq.put("select_query","select id, Name, Trip_Status, Scheduled_Date, Deal from Trips where ((Trip_Type = 'Funeral' and Trip_Status != 'Completed') and Scheduled_Date >= '" + nowStr + "') order by Scheduled_Date asc limit 200");
		tresp = invokeurl
		[
			url :"https://www.zohoapis.com/crm/v7/coql"
			type :POST
			parameters:tq.toString()
			headers:{"Content-Type":"application/json"}
			connection:"zoho_oauth_connection"
		];
		if(tresp.containKey("data"))
		{
			trips = tresp.get("data");
		}
	}	catch (eTrips)
	{
	}
	if(trips.isEmpty())
	{
		return result;
	}
	dealIds = List();
	for each  tr in trips
	{
		try
		{
			dLk = tr.get("Deal");
			did = "" + dLk.get("id");
			if(did != "" && did != "null" && !dealIds.contains(did))
			{
				dealIds.add(did);
			}
		}		catch (eLk)
		{
		}
	}
	dealById = Map();
	batch = "";
	batchCount = 0;
	idx = 0;
	total = dealIds.size();
	for each  did in dealIds
	{
		if(batch == "")
		{
			batch = did;
		}
		else
		{
			batch = batch + "," + did;
		}
		batchCount = batchCount + 1;
		idx = idx + 1;
		if(batchCount == 50 || idx == total)
		{
			try
			{
				dq = Map();
				dq.put("select_query","select id, Name_of_Deceased, Church_Chapel, Funeral_Time from Deals where id in (" + batch + ") limit 50");
				dresp = invokeurl
				[
					url :"https://www.zohoapis.com/crm/v7/coql"
					type :POST
					parameters:dq.toString()
					headers:{"Content-Type":"application/json"}
					connection:"zoho_oauth_connection"
				];
				if(dresp.containKey("data"))
				{
					for each  d in dresp.get("data")
					{
						dealById.put("" + d.get("id"),d);
					}
				}
			}			catch (eDeals)
			{
			}
			batch = "";
			batchCount = 0;
		}
	}
	for each  tr in trips
	{
		row = Map();
		tripId = "" + tr.get("id");
		row.put("tripId",tripId);
		dealId = "";
		try
		{
			dLk = tr.get("Deal");
			dealId = "" + dLk.get("id");
		}		catch (eLk2)
		{
			dealId = "";
		}
		row.put("dealId",dealId);
		deal = Map();
		if(dealById.containKey(dealId))
		{
			deal = dealById.get(dealId);
		}
		row.put("deceasedName",ifnull(deal.get("Name_of_Deceased"),""));
		row.put("church",ifnull(deal.get("Church_Chapel"),""));
		// Same precedence used everywhere else in TM: Deal's Funeral_Time first, Trip's
		// Scheduled_Date as fallback (see widget.html renderDetail()).
		funeralDT = ifnull(deal.get("Funeral_Time"),"");
		if(funeralDT == "")
		{
			funeralDT = ifnull(tr.get("Scheduled_Date"),"");
		}
		row.put("funeralDateTime",funeralDT);
		result.add(row);
	}
	return result;
}
```

## New function 2 — `map getDriverSheetPrintData(string tripId)`

```deluge
map getDriverSheetPrintData(string tripId)
{
	return getTripDetail(tripId);
}
```

## Custom API setup (mirrors `Get_Burial_Schedule`)

**Method must match whether the function takes arguments** -- same rule already followed
by the widget's own `API_MAP` (`getRemovalVehicles`/`getRentalVehicles`/`getDrivers`/
`getAttendants` are all GET with no arguments; `saveAssignment`/`fetchTrips` are POST
because they take a payload). `getDriverSheetList()` takes no parameters, so its Custom
API **must be GET**, not POST -- a POST-configured no-argument API is rejected by Zoho
Creator with a generic "Improper Configuration" error at call time. `getDriverSheetPrintData`
takes `tripId`, so it stays POST.

1. **Setup > Integrations > Custom API** (or wherever `Get_Burial_Schedule` is registered
   in this workspace) > add a new Custom API named `Get_Driver_Sheet_List`, **GET**, script
   body:
   ```deluge
   response = Map();
   response.put("result",getDriverSheetList());
   return response;
   ```
2. Add a second Custom API named `Get_Driver_Sheet_Print_Data`, POST, expecting a
   `tripId` parameter in the payload, script body:
   ```deluge
   response = Map();
   response.put("result",getDriverSheetPrintData(input.tripId));
   return response;
   ```
   (Match whatever exact request/response wrapper shape `Get_Burial_Schedule` uses today —
   the widget's `unwrap()` already handles `{result:...}` / `{output:...}` /
   `{details:{output:...}}` shapes, so follow the same one already live for consistency.)

## Widget-side (already applied directly, no guideline needed)

`tripManagerApp/app/widget.html` — new "Driver Sheets" screen added to the existing
Analytics/Burial subsystem (same print-header + `@media print` machinery already used by
Burial Schedule, so no new print CSS needed):
- Sidebar nav item switched from the old placeholder `data-tool="sheets"` to
  `data-antool="driversheets"`, alongside Burial Schedule.
- `driversheets` view: table of eligible funerals (Date, Time, Deceased, Service Location,
  Print link) from `getDriverSheetList` / `Get_Driver_Sheet_List`, matching Section 3's
  filtering rules already enforced server-side.
- Clicking Print switches to a `driversheet-detail` view that fetches
  `Get_Driver_Sheet_Print_Data` for that trip and renders a full sheet (Deceased, Funeral
  Date/Time, Church, Burial/Interment, Grave Type, Casket incl. colors, Merchandise/Floral,
  Hearse, Driver, Attendant, Departure Time, Special Instructions) using the same branded
  `an-print-header` + Print button + `window.print()` flow Burial Schedule already has.

## Test
1. Open Trip Manager > Driver Sheets — confirm only upcoming Funeral trips with a date/time
   and a Trip_Status other than Completed appear, sorted soonest first.
2. Confirm a Funeral trip with `Trip_Status = Completed` does NOT appear.
3. Confirm a Deal/Trip pair with no `Scheduled_Date`/`Funeral_Time` does NOT appear.
4. Click Print on a row — confirm the sheet shows the same casket color, merchandise, and
   deceased name as the TM Trip Details Card and Driver App for that same trip (cross-check
   against ZP-TBD-30/31).
5. Confirm the Print button produces a clean landscape print preview (same DFH-branded
   header style as the existing Burial Schedule print).
