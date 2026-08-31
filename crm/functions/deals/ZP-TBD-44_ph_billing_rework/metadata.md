# ZP-TBD-44 — Police/Hospital Billing rework

Source: `D:\Office\Andrea_Projects\DFH\projectDocuments\PH-BILLING-DEV-TASKS.md` (Andrea's
detailed dev task list, verified against live production 2026-08-24) plus follow-up comments
from Andrea the same evening. Multi-day effort — this ticket tracks the whole rework as items
land, rather than one function at a time.

## Status: IN PROGRESS. All of Part 2 (items 1-15) and Part 4 (V1-V3) are now closed — see below.
Still open: item 6 (blocked on Andrea), the new master/child Books invoice requirement (Andrea
is handling the explanation to herself, no design work needed from us), and the full
documentation set requested.

## Done and confirmed live

### Item 7 — 2-day storage cap was counting the pickup day
`automation.StorageFeebasedonLetterofNoInterestWorkflow`: both the IFSL day count
(`extraStorageDaysForAutopsy`) and the MNSJ overflow day count (`totalStorageDaysUncapped`) had
a stray `+ 1` that counted the pickup day itself instead of only the days after pickup. Removed
from both. Confirmed live.

### Item 8 — decomposed bodies weren't billed at the decomposed rate on a Letter of No Interest
Same function. Added `isDecomposedLoni` check (`Condition == "Decomposed"` or the `"Deocomposed"`
data-entry variant, mirroring the check already live in `CreateSalesOrderforPoliceCase`) right
after fetching the Deal. Both the IFSL and MNSJ storage-product lookups (previously two identical
hardcoded `zoho.crm.getRecordById("Products","6503357000002869275")` calls) now branch through a
shared `storageProductIdToUse` variable, using the decomp storage product
(`6503357000019249225`) when decomposed. Confirmed live. Not converted to the label/COQL lookup
pattern used elsewhere (Issue F/V3 in the source doc) — that's a separate, larger decision still
open with Andrea.

### Issue A — hospital storage billing gap since 2026-08-20
Root cause confirmed: on 2026-08-20 every hospital storage product had its `Product_Category`
changed from `Storage` to `Storage - Family`. Both `automation.createSalesOrderForHospitalCase`
and `automation.UpdateStorageFeeonHospitalReleaseDate` look up the hospital's storage line purely
by `Product_Category = 'Storage'` tagged to that `Product_of_This_Hospital` — matches nothing by
name, so after the relabel neither function could find anything to bill.

**Fix applied: data only, no code change.** 4 new products created (cloned from the existing
`Storage - Family` ones, same price, `Product_Category` set to `Storage`, linked to the same
hospital account), existing `Storage - Family` products left untouched:

| Hospital | New product | id | Price |
|---|---|---|---|
| Cornwall Regional | CRH Storage | `6503357000080324245` | $1,450 |
| National Chest | NCH Storage Fee | `6503357000080324249` | $2,500 |
| UHWI | UHWI Storage Fee | `6503357000080324253` | $1,650 |
| Hope Institute | HIH Storage Fee | `6503357000080324257` | $1,250 |

Confirmed live — all 4 correctly tagged and linked.

Andrea confirmed she wants **"Storage for Hospital"** (`6503357000078744158`, the $0 fallback
product used when a hospital has no linked `Storage` product) to **stay at $0 deliberately** —
it's a visible fail-safe so a misconfigured hospital shows up as an obvious $0 line rather than
silently billing the wrong amount. Confirmed this fallback only exists in
`UpdateStorageFeeonHospitalReleaseDate`; `createSalesOrderForHospitalCase` has no equivalent
fallback at all (a misconfigured hospital there produces no line whatsoever, not even a visible
$0 one) — flagged back to Andrea as a real inconsistency, not yet resolved.

### Item 12 — autopsy trip KM billing, generalized from 3 hardcoded locations to any location
Andrea confirmed the design intent directly: police autopsy trips are billed by KM, and the
pickup→autopsy-location distance is a known constant per location, so that constant belongs in
the trip's billed **quantity** (existing per-km pricing model is correct, not a flat per-trip
price). Confirmed via live data that only 5 distinct autopsy locations are ever actually used:
Archer's, House of Tranquillity, Doyley's (the 3 originally hardcoded) plus DFH's own two
in-house locations (Kingston, Ops Center) which correctly fall through to real driven KM already.

**Fix applied and confirmed live.** New number field **`Autopsy_Fixed_KM`** on Accounts, set on
the 3 external locations (Archer's = 167, House of Tranquillity = 180, Doyley's = 54), left
blank on Kingston/Ops Center per Andrea's explicit answer ("real driven KM" for those two — no
fixed value).

`automation.CreateSalesOrderforPoliceCase` — replaced the 3-way hardcoded `if(alId == "...")`
block with a generic lookup:

```deluge
if(!isNull(recordInfo.get("Autopsy_Date_Time")) && alId != "")
{
	try
	{
		autopsyLocationAccount = zoho.crm.getRecordById("Accounts",alId.toLong());
		fixedKmForLocation = ifnull(autopsyLocationAccount.get("Autopsy_Fixed_KM"),0);
		if(fixedKmForLocation > 0)
		{
			autopsyTripKm = fixedKmForLocation;
		}
	}
	catch (eFixedKm)
	{
		// leave autopsyTripKm as the real driven KM already computed above
	}
}
```

Any future autopsy location just needs `Autopsy_Fixed_KM` populated on its Account record — no
code change needed again. Confirmed live, matches exactly.

**Correction found in review (2026-08-29), then self-corrected again (2026-08-29): the original
$180 finding was itself a misdiagnosis — it inspected the wrong one of two same-named
products.** First pass claimed the billed DOLLAR amount was never live-verified, only the KM
lookup, and pointed at "IFSLM Autopsy Trip Police Case" id `6503357000024281102` with
`Unit_Price = 180`. That record is real, but it has **`Product_Category = null`** — it does NOT
match the billing query's `and Product_Category = 'Autopsy Trip'` clause, so it is never actually
selected by `CreateSalesOrderforPoliceCase`. It turned out to be a duplicate/orphan product (see
"Duplicate product" note below, found separately by the user) that happened to share the exact
same name and a coincidentally-plausible $180 price, which is what made the misdiagnosis
convincing.

**The real billing product is a different record: id `6503357000019249155`**, same name, `Parent_Product = IFSLM`, **`Product_Category = "Autopsy Trip"`** (matches the query), and its
live `Unit_Price` is **already `1`** (a separate `Sales_Unit_Price` field on the same record
reads `180`, which is what likely got eyeballed by mistake during manual review — the Deluge code
reads `Unit_Price`, not `Sales_Unit_Price`). So `Quantity(167) × List_Price(1) = 167` — the
billing math is already correct as configured. **No price fix is actually needed here.** Correcting the record here rather than leaving the earlier wrong guidance standing.

**Still worth one live spot-check, not because a bug is expected now, but because — per the
original "V1" note — nobody has actually confirmed a real Sales Order total end-to-end:** advance
one police autopsy case through Sales Order creation for a fixed-KM location (e.g. Archer's) and
confirm the total reads ~$167, then do the same for a Kingston/Ops Center case (real driven KM).

**Same concern flagged for Initial Police Case Pickup — not yet confirmed either way.** The
pickup-fee line item in the same function uses the identical shape:
```deluge
productMap.put("Quantity",ifnull(tripInfo.get("Number_of_distance_in_km"),1));
productMap.put("List_Price",productDetails.get("Unit_Price"));
```
Whichever Product backs this line (under IFSLM, Product_Category "Pickup") needs the same
check: open it in Setup → Products and confirm its Unit Price is $1/km, not a flat figure. Not
yet independently confirmed live which way this one currently is — check it the same way as
above before assuming it's fine or assuming it's broken.

### Duplicate product — "IFSLM Autopsy Trip Police Case" exists twice, found by the user 2026-08-29
Two Products share the exact name **"IFSLM Autopsy Trip Police Case"**, both under Parent Product
IFSLM, both showing $180 somewhere on the record (one on `Unit_Price`, the other on
`Sales_Unit_Price`) — which is exactly what caused the KM-billing misdiagnosis directly above.
- id `6503357000024281102` — **`Product_Category = null`**. Never matched by
  `CreateSalesOrderforPoliceCase`'s COQL query (`and Product_Category = 'Autopsy Trip'`). Does
  nothing. This is the orphan/duplicate.
- id `6503357000019249155` — **`Product_Category = "Autopsy Trip"`**, `Unit_Price = 1`. This is
  the one actually used for billing.

**Risk (the user's framing, correct):** anyone manually tagging/selecting this product elsewhere
(a Sales Order line, a report filter, future config work) could easily grab the wrong one by
name alone, since nothing distinguishes them visually except the category field.

**Recommendation: deactivate rather than delete `6503357000024281102`**, unless it's confirmed to
have zero historical Sales Order/Invoice line items referencing it (Zoho may block outright
deletion of a Product with existing usage anyway, and deactivating is the reversible option).
**Done — deactivated 2026-08-29.**

### Items 1-4 — autopsy reschedule no-show billing (family vs officer vs institution)
Confirmed via live code that none of this existed before tonight: every reschedule, regardless
of cause, billed the same IFSL Sales Order with just a trip fee. Andrea confirmed the design:
whoever caused the no-show pays for it — family no-show bills the family directly, officer
no-show bills MNSJ, and IFSL gets nothing added for either. Storage-on-reschedule (source doc
item 5) is confirmed **not** a bug — only the trip fee is meant to be added, nothing else.

Investigated item 6 ("family's storage isn't stopped when a new date is entered") in depth: a
`Storage - Family` product exists under the police parent (`Storage Fee`, `6503357000029739051`,
$1,500) and the system has a generic rule elsewhere (`deleteFamilyBillingOnClosedLost`) treating
`Storage - Family` lines as protected/family-owed — but no function anywhere actually creates or
updates that line on a police case. **Left open** — nothing exists yet for a stop-condition to
apply to; needs Andrea to clarify where this charge is meant to happen before it can be built.

**Build, applied and confirmed live:**
- Driver App (`app.js`): the single `"Autopsy not done"` reschedule-reason option (`notdone`
  key) split into two — `family_noshow` ("Family did not show") and `officer_noshow` ("Officer
  did not show"). Driver picks the reason at disposition time, same screen as before.
- `Driver_App.ds` `saveAutopsyDisposition`: `rescheduleMap` updated to map the two new widget
  keys to the two new CRM picklist labels.
- New picklist values: `Operations.Reschedule_Reason` gained `"Family did not show"` /
  `"Officer did not show"` (old `"Autopsy not done"` kept for historical records, never actually
  used per source doc Issue C). `Sales_Orders.Sales_Order_Type` gained `"Police Cases - Family"`
  (mirrors the existing `"Police Cases - MNSJ"`).
- New function `standalone.createInvoiceBasedOnSalesOrderForFamily` — a straight mirror of the
  existing `createInvoiceBasedOnSalesOrderForMNSJ`, creating/updating an `Invoice_For = "Family"`
  invoice from the `Police Cases - Family` Sales Order.
- `automation.handleAutopsyReschedule` rewritten: the early guard now recognizes the two new
  reasons instead of the retired `"Autopsy not done"` (a first deploy attempt accidentally lost
  the entire trip-creation block when only the billing half was patched in-place — caught during
  live re-verification and fixed by replacing the whole function body wholesale on the second
  attempt, confirmed live word-for-word afterward). Billing now branches by reason: X-ray
  unchanged (still bills IFSL), family no-show routes to the new `Police Cases - Family` Sales
  Order + Family invoice, officer no-show routes to the existing `Police Cases - MNSJ` Sales
  Order + MNSJ invoice. IFSL Sales Order is untouched on both no-show paths.

### Item 9 — X-ray field on the Deal
Confirmed via live field metadata: no X-ray field existed on Deals or Operations at all before
tonight. Andrea confirmed this is report-only — auto-set, no other behavior depends on it.

**Build, applied and confirmed live:** new checkbox field `X_Ray_Required` on Deals, defaulting
false. `automation.handleAutopsyReschedule` sets it true at the end of the X-ray billing path:

```deluge
if(isXray)
{
	xrayFlagMap = Map();
	xrayFlagMap.put("X_Ray_Required",true);
	zoho.crm.updateRecord("Deals",crmid,xrayFlagMap);
}
```

### Item 10 — advance reschedule (police send a new date before any trip happens)
Traced the actual mechanics rather than assuming the memo's framing was complete.
`automation.createTripOnTheDayOfAutopsyDateWithTask` fires on every edit to `Autopsy_Date_Time`
(field-update workflow, not the driver-disposition flow items 1-4 cover). For a single deceased
it already correctly finds the existing "Autopsy Initial" trip and updates its date — contrary
to the memo's claim that nothing updates the existing trip; this should be spot-checked live but
reads correctly in the code.

**Confirmed real gap:** each "Autopsy Initial" trip gets grouped onto a shared "Multi Deceased
Autopsy Trip" by a separate function, `automation.groupAutopsyTrips`, matched by same
location + same date and stamped via a `Parent_Trip` lookup on the child. When
`createTripOnTheDayOfAutopsyDateWithTask` updated an existing trip's date, it never re-ran that
grouping step — so the deceased's own trip got the new date, but stayed stamped to the old
date's parent batch trip and never got attached to the correct new-date one.

**Fix applied and confirmed live.** In the existing-trip branch of
`createTripOnTheDayOfAutopsyDateWithTask`:

```deluge
else
{
	zoho.crm.updateRecord("Trips",tripId,tripMap,{"trigger":{"workflow"}});
	result = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v7/functions/groupautopsytrips/actions/execute?auth_type=apikey&zapikey=1003.e2dbe4df1dd83bbca7110c05c43a1a22.3baee41485bf8bce183704938c9d0653&childTripId=" + tripId
		type :GET
	];
}
```

(REST execute call, not a direct `automation.groupAutopsyTrips(tripId)` call — a direct
cross-function call failed live with "Not able to find 'groupAutopsyTrips' function"; the REST
pattern matches how `sendheadstonerequest`/`Notify_Headstone_Vendor` are already called
elsewhere in this codebase and is confirmed working.)

**Fix required (Andrea, 2026-08-29): the old parent's `Deceased_Names_Summary` must drop the
deceased's name when a reschedule moves them to a different parent.** Previously logged as a
"known residual gap, not fixed" — now scoped as a real requirement, not just low-priority
polish: when `Autopsy_Date_Time` changes and the child re-groups onto a different Multi Deceased
Autopsy Trip, the *old* parent's cached `Deceased_Names_Summary` text is never refreshed — only
the *new* parent's summary gets rebuilt inside `groupAutopsyTrips`. So the old batch trip keeps
showing a deceased who's no longer actually scheduled for that date.

**Guideline — apply directly in `automation.groupAutopsyTrips` (CRM function, guideline only):**

1. Capture the child's *current* `Parent_Trip` **before** it gets overwritten — add this near
   the top of the function, right after `childTrip` is fetched (alongside the existing
   `tripType`/`locId` reads):
   ```deluge
   oldParentId = "";
   try
   {
   	oldParentLk = childTrip.get("Parent_Trip");
   	oldParentId = ifnull(oldParentLk.get("id"),"");
   }
   catch (eOldParent)
   {
   	oldParentId = "";
   }
   ```
2. After the existing block that rebuilds the *new* parent's `Deceased_Names_Summary` (the one
   ending in `zoho.crm.updateRecord("Trips",parentId.toLong(),summaryMap);`), add a matching
   rebuild for the *old* parent — only when the child actually moved to a different parent:
   ```deluge
   // Rebuild the old parent's summary too, since the child just left it
   if(oldParentId != "" && oldParentId != parentId)
   {
   	try
   	{
   		oldChildCriteria = "(Parent_Trip:equals:" + oldParentId + ")";
   		oldChildren = zoho.crm.searchRecords("Trips",oldChildCriteria,1,200);
   		oldNames = List();
   		for each  och in oldChildren
   		{
   			ochDealId = "";
   			try { ochDealLk = och.get("Deal"); ochDealId = ifnull(ochDealLk.get("id"),""); } catch (eOchDeal) { ochDealId = ""; }
   			if(ochDealId != "")
   			{
   				try { ochDealRec = zoho.crm.getRecordById("Deals",ochDealId.toLong()); ochName = ifnull(ochDealRec.get("Name_of_Deceased"),""); if(ochName != "") { oldNames.add(ochName); } } catch (eOchDealRead) {}
   			}
   		}
   		oldSummaryMap = Map();
   		oldSummaryMap.put("Deceased_Names_Summary",oldNames.toString());
   		zoho.crm.updateRecord("Trips",oldParentId.toLong(),oldSummaryMap);
   	}
   	catch (eOldSummary)
   	{
   	}
   }
   ```
   This mirrors the existing new-parent rebuild exactly, just scoped to whoever remains on the
   *old* parent after this child has already been re-stamped onto the new one — so the child
   itself is correctly excluded from the old parent's list (its `Parent_Trip` was already updated
   to the new id in the step above, before this runs).

**Applied 2026-08-29, still failed live: old parent kept the moved deceased's name.**
Misdiagnosed at first as `zoho.crm.searchRecords()` index lag (searchRecords does lag behind
real writes, and that theory was plausible) — **the actual root cause, found by the user
testing live, was simpler and upstream of that entirely:** `childTrip.get("Parent_Trip")`
returns as a plain ID value here, not a `{"id":..., "name":...}` lookup object, so the original
`oldParentLk.get("id")` call was throwing on every run, silently caught by
`catch (eOldParent)`, and resetting `oldParentId` back to `""` every single time. With
`oldParentId` always empty, the `if(oldParentId != "" && oldParentId != parentId)` guard was
never true, so the entire old-parent-rebuild block never ran at all — nothing to do with
`searchRecords` staleness. **Fix (applied by the user):** read the value directly instead of
calling `.get("id")` on it:
```deluge
oldParentId = "";
try
{
	oldParentLk = childTrip.get("Parent_Trip");
	oldParentId = ifnull(oldParentLk,"");
}
catch (eOldParent)
{
	oldParentId = "";
}
```

The COQL-vs-searchRecords swap below is kept anyway as a genuine reliability improvement (COQL
does still avoid a real, separate staleness risk on the summary-rebuild reads themselves), but
it was not what actually fixed this bug — the `oldParentId` read was. Replace the entire tail of
the function, from the line
`// NEW-2 (c): Rebuild the deceased-name summary on the parent every time a child groups onto it`
down to (but not including) the function's very last `}`, with:
```deluge
// NEW-2 (c): Rebuild the deceased-name summary on the parent every time a child groups onto it
// (COQL used instead of zoho.crm.searchRecords -- searchRecords reads from Zoho's search index,
// which lags a few seconds behind real writes, so a rebuild run immediately after the
// Parent_Trip stamp above could still see stale results. COQL reads live data.)
if(parentId != "")
{
	try
	{
		newChildQuery = "select id, Deal from Trips where Parent_Trip = '" + parentId + "'";
		newChildResults = standalone.COQLQuery(newChildQuery);
		newDealIds = List();
		for each  nch in newChildResults
		{
			try { nchDealLk = nch.get("Deal"); nchDealId = ifnull(nchDealLk.get("id"),""); if(nchDealId != "") { newDealIds.add(nchDealId); } } catch (eNchDeal) {}
		}
		names = List();
		if(newDealIds.size() > 0)
		{
			newIdCsv = "";
			for each  nid in newDealIds
			{
				if(newIdCsv != "") { newIdCsv = newIdCsv + ","; }
				newIdCsv = newIdCsv + "'" + nid + "'";
			}
			nameQuery = "select id, Name_of_Deceased from Deals where id in (" + newIdCsv + ")";
			nameResults = standalone.COQLQuery(nameQuery);
			for each  nr in nameResults
			{
				nm = ifnull(nr.get("Name_of_Deceased"),"");
				if(nm != "") { names.add(nm); }
			}
		}
		summaryStr = names.toString();
		summaryMap = Map();
		summaryMap.put("Deceased_Names_Summary",summaryStr);
		zoho.crm.updateRecord("Trips",parentId.toLong(),summaryMap);
	}
	catch (eSummary)
	{
	}
	// Rebuild the old parent's summary too, since the child just left it
	if(oldParentId != "" && oldParentId != parentId)
	{
		try
		{
			oldChildQuery = "select id, Deal from Trips where Parent_Trip = '" + oldParentId + "'";
			oldChildResults = standalone.COQLQuery(oldChildQuery);
			oldDealIds = List();
			for each  och in oldChildResults
			{
				try { ochDealLk = och.get("Deal"); ochDealId = ifnull(ochDealLk.get("id"),""); if(ochDealId != "") { oldDealIds.add(ochDealId); } } catch (eOchDeal) {}
			}
			oldNames = List();
			if(oldDealIds.size() > 0)
			{
				oldIdCsv = "";
				for each  oid in oldDealIds
				{
					if(oldIdCsv != "") { oldIdCsv = oldIdCsv + ","; }
					oldIdCsv = oldIdCsv + "'" + oid + "'";
				}
				oldNameQuery = "select id, Name_of_Deceased from Deals where id in (" + oldIdCsv + ")";
				oldNameResults = standalone.COQLQuery(oldNameQuery);
				for each  onr in oldNameResults
				{
					onm = ifnull(onr.get("Name_of_Deceased"),"");
					if(onm != "") { oldNames.add(onm); }
				}
			}
			oldSummaryMap = Map();
			oldSummaryMap.put("Deceased_Names_Summary",oldNames.toString());
			zoho.crm.updateRecord("Trips",oldParentId.toLong(),oldSummaryMap);
		}
		catch (eOldSummary)
		{
		}
	}
}
```
The `oldParentId` capture near the top of the function (from the earlier guideline entry) stays
exactly as already applied — only this tail section changes.

**Confirmed working live (2026-08-29).** Old parent's `Deceased_Names_Summary` now correctly
drops the moved deceased's name while keeping any deceased who remain on it, and the new
parent's summary correctly includes the moved deceased.

**Second gap found during live testing (TC-12, "Advance reschedule"), not yet fixed:** tested
the specific case where a "Multi Deceased Autopsy Trip" for the new location + date **already
exists** (the other branch of `groupAutopsyTrips` — the "create a new parent" branch already
sets `Scheduled_Date` correctly at creation time, so that half was fine). Result: the child
correctly re-groups onto the existing parent (`Parent_Trip` gets stamped), but that parent's own
`Scheduled_Date` is never touched — so if the parent's existing time-of-day differs from the
specific new time just set on the child, the parent keeps showing its old, stale time even
though the child (and the day-level date) are correct. `groupAutopsyTrips`'s COQL search only
matches by whole calendar day (`Scheduled_Date >= dayStart and <= dayEnd`), so a parent that
already exists for that day is found and reused regardless of its exact time — and nothing ever
syncs that time afterward.

**Fix (guideline — apply directly in the CRM function; no write-capable MCP tool exists for
this):** in `automation.groupAutopsyTrips`, right after `parentId` is set from the COQL search
result (before the "create parent if none found" block), add:
```deluge
if(parentId != "")
{
	try
	{
		syncMap = Map();
		syncMap.put("Scheduled_Date",childTrip.get("Scheduled_Date"));
		zoho.crm.updateRecord("Trips",parentId.toLong(),syncMap);
	}
	catch (eSync)
	{
	}
}
```
This keeps the parent trip's date/time in sync with whichever child most recently triggered a
regroup for that day/location — the reschedule that just happened is the authoritative new
schedule for the whole group. **Design assumption worth confirming with Andrea:** this
overwrites the parent's time on every regroup, so if two deceased going to the same
location/day get entered with two different specific times, the parent's displayed time will
reflect whichever one was rescheduled/grouped most recently. If she wants different behavior
(e.g., the group's time should never change once other deceased are already attached, or all
children going to the same day+location should be forced to the same time at entry), that needs
a separate decision — not guessed here.

**Confirmed deployed and tested — TC-12 now passes.** Applied live in `groupAutopsyTrips` and
re-tested for the "parent already existed" case: editing a Deal's `Autopsy_Date_Time` to a new
date/time that matches an existing Multi Deceased Autopsy Trip's day but not its exact time now
correctly updates that parent's `Scheduled_Date` to the new time, not just the child's.

**Still needs a live spot-check (found in review, 2026-08-29): the "brand-new parent" branch has
never actually been tested live, only read in code.** TC-12 only covers rescheduling onto a day/
location where a Multi Deceased Autopsy Trip **already exists**. The other branch — rescheduling
onto a day/location with **no** existing batch trip yet, so `createTripOnTheDayOfAutopsyDateWithTask`
creates a brand-new parent from scratch — looks correct by inspection but has no click-through
confirmation behind it. No code change is expected here unless this test actually turns up a
problem. **Test:** reschedule an autopsy `Autopsy_Date_Time` to a date/location combination that
has no existing Multi Deceased Autopsy Trip, and confirm a new parent trip is created with the
correct date, time, and location.

### Item 11 — hospital reschedules billed nothing (and worse: wrong Sales Order type risk)
Confirmed root cause is worse than the source doc's framing: the `Handle Autopsy Reschedule`
workflow has **no Pipeline restriction at all** — it fires for any Deal with a related
Operations record, Police or Hospital alike. Since `handleAutopsyReschedule`'s billing logic
only ever looked for/created `"Police Cases"`-family Sales Orders, a hospital reschedule would
have created a wrongly-typed Police Sales Order on a Hospital Deal, not simply skipped billing.

Andrea confirmed: hospital reschedules should reuse an existing hospital product (no new
"Reschedule Trip" category needed), no family/MNSJ fault-split (that's police-only), and storage
should be left running as normal (no change needed there since nothing already touches it).

**Fix applied and confirmed live.** `automation.handleAutopsyReschedule` now branches on
`Pipeline` right after the shared trip-creation block: Hospital Cases add one trip fee (reusing
that hospital's own `Product_Category = 'Pickup'` product, tagged via `Product_of_This_Hospital`)
to the existing `Hospital Cases` Sales Order and return early -- no family/MNSJ logic, no new
Sales Order type. Police Cases fall through to the existing items-1-4 logic unchanged.

### Items 13-14 — registration number placement (Driver App)
**Original diagnosis was wrong, caused a real regression (TC-15/TC-16), found and fixed
2026-08-29.** The original write-up claimed `hospMorgueCard` (the morgue check-in card) was
hospital-exclusive and `autopsyCheckinHtml` was the "police/regular" screen — never actually
traced which Trip_Types route to which render function. They don't split that way:
```js
if ((trip.Trip_Type || '') === 'Hospital Storage'){ hideHangTagPrint(); renderHospitalCheckin(trip); return; }
if ((trip.Trip_Type || '') === 'Police Case Pickup'){ hideHangTagPrint(); renderHospitalCheckin(trip); return; }
```
**Both "Hospital Storage" and "Police Case Pickup" (the multi-deceased police pickup trip type)
route to the same `renderHospitalCheckin` screen and the same `hospMorgueCard()` card.**
`autopsyCheckinHtml` is a completely different, *later*-stage screen — it only appears inside the
Multi Deceased Autopsy Trip batch flow, once an autopsy has actually been scheduled. So removing
Registration Number from `hospMorgueCard` "for hospital only" actually removed it from Police
Case Pickup too, at the moment it matters (the initial multi-deceased pickup), not just from
hospital. TC-15/16 caught this directly: a Police Case Pickup deal (`Trips = "Police Case Pickup
- ..."`, `Autopsy_Date_Time` still blank — no autopsy trip exists yet) was missing the field
entirely.

(Also spent time investigating a *different*, real but unrelated issue first: Task 8 flips
`Deals.Is_Deceased_In_Our_Care` to "Yes" on completion of any initial pickup trip — including
Police Case Pickup/Initial Police Case Pickup — well before an autopsy ever happens, so
`autopsyCheckinHtml`'s own `d.inCare === 'Yes'` gate would later incorrectly hide the check-in
section for these deceased *if and when* they do reach the Multi Deceased Autopsy Trip stage.
Attempted fix: a new `checkinDone` signal, computed server-side in `getAutopsyChildren` from
`Operations.Location` instead of the Deal flag, applied to `autopsyCheckinHtml`,
`autopsySaveFamilyAndCheckin`, and the chip/gate calc in `renderAutopsyBatchInner`. This was not
what TC-15/16 were actually testing — this ticket's "Police/regular" wording refers to the
*initial pickup* screen, not the autopsy-stage one.

**That `checkinDone` attempt itself caused a real, confirmed regression — found and reverted the
same night, 2026-08-29.** Each check-in field saves immediately on change
(`setAutopsyCheckinField` → `saveAutopsyCheckinFields` on every keystroke/select), so the moment
a driver picked a Location (before ever typing Registration Number), `Operations.Location` on
that trip stopped being blank. On the next render/reload, `checkinDone` read `true` from that
alone, hiding the **entire** Morgue check-in sub-box — Registration Number included, even though
it was never actually entered — and the Complete Trip gate (`regOk = bd.checkinDone || ...`)
treated the Registration Number requirement as already satisfied. That is a silent
data-integrity failure, not a display bug: a Police/regular autopsy trip could complete without
ever capturing Registration Number, defeating Item 14. **Reverted:** `autopsyCheckinHtml` no
longer hides the section at all; `renderAutopsyBatchInner`'s `regOk` now checks only the actual
`checkinRegistrationNumber` value; `autopsySaveFamilyAndCheckin`'s save block is unconditional
(each field already independently gates on having a value, so this was always safe to run every
time). Net effect: the morgue check-in section, Registration Number included, now always shows
and is always genuinely required at the autopsy stage for everyone — no attempt to auto-skip it
for hospital-sourced deceased anymore. `getAutopsyChildren`'s server-side `checkinDone`
computation is now dead code (harmless, just unused) — not reverted server-side yet, low
priority cleanup. If a real "skip re-asking for hospital-sourced deceased" behavior is wanted
later, it needs a properly-traced signal — the deceased's *original* pickup Trip_Type, not
anything on the autopsy trip's own fresh Operations record — not guessed at again under time
pressure.)

**Actual fix — `hospMorgueCard`, conditional on Trip_Type (edited directly, widget JS):**
```js
+ (((state.hosp && state.hosp.trip && (state.hosp.trip.Trip_Type || '')) === 'Police Case Pickup')
    ? ('<label class="field-lbl">Registration Number</label>'
      + '<input type="text" class="van-select"' + ro + ' value="' + jsAttr(b.Registration_Number || '') + '" oninput="hospSetField(' + u + ',\'Registration_Number\',this.value)" placeholder="Pre-printed registration #">')
    : '')
```
Placed where the field used to sit unconditionally (right after Row/Drawer, before the notes
box). No server-side change needed — `saveDeceasedPickup`'s `supportedKeys` already includes
`Registration_Number` from the original D-1 work, and `hospSetField` is a generic setter, so
re-adding the input alone reconnects the existing save path. **Confirmed working live
2026-08-29** — TC-15/TC-16 re-tested and passed.

- Item 14: `renderAutopsyBatchInner`'s "Complete Trip" gate (`allSet`/`done` calculation) now
  also requires a non-blank Registration Number for every deceased not already in DFH's care,
  not just an outcome selection. Bottom helper text updated to say so when that's what's blocking
  completion. This part was correctly scoped to the autopsy-batch stage from the start — Item 14
  is unaffected by the Item 13 misdiagnosis above.

### Item 15 — registration number on the Hospital Invoicing Report
Confirmed the report exists (`Hospital Invoicing Report`, Zoho Analytics Pivot view, id
`2981994000000178879`, workspace `2981994000000006002`), and confirmed the Police Invoicing
Report (`2981994000000148618`) is a separate, independent Pivot view in the same workspace, so
removing the field from Hospital's layout alone couldn't affect Police's. No tool access to edit
Analytics view fields — done manually by the user (Registration_Number removed from the Hospital
report's pivot field selection). **User-confirmed, not independently verified** — no tool
available here to read back the report's column list.

## Part 4 — developer validation, all closed

### V1 — the pre-filled KM on autopsy trips
Closed via Item 12 above. Confirmed still working exactly as designed, not damaged by the
KM-rework or invoice-naming projects. Andrea's answer (police autopsy trips bill by KM, the
distance is a known constant per location, so it belongs in the quantity field) resolved the
open pricing-model question — the mechanism was extended from 3 hardcoded locations to any
location via the new `Autopsy_Fixed_KM` Accounts field, rather than rebuilt as flat pricing.
**Still recommended:** a real live test on each of the 3 (now field-driven) locations to confirm
the billed amount matches what Ms. Shirley expects — mechanically correct per the code, but
worth a human sanity check on a real case.

### V2 — product tagging validation
1. **Police tagging complete, confirmed live.** All 9 scenarios (Pickup, Storage, Decompose
   Storage, Decomp Fee, Autopsy Trip, Transfer Trip, Reschedule Trip, X-ray Trip, Storage -
   Family) exist under the police parent, one product each, no duplicates causing ambiguity.
   Minor unrelated finding: an orphaned, uncategorized duplicate named "IFSLM Autopsy Trip Police
   Case" (`6503357000024281102`) sits alongside the correctly-tagged one
   (`6503357000019249155`) — harmless (never matched by any category query) but worth deleting
   for tidiness, Andrea's call.
2. **Hospital Storage label genuinely missing, confirmed and fixed** — see Issue A above.
3. **Nothing else was relabeled on 2026-08-20, confirmed live.** All ~25 hospital `Storage -
   Family` products share the exact same modification timestamp (`2026-08-20T02:34:28`, one
   outlier a few hours later same day); every other category (Pickup, PME Fee, PME Transport
   Fee, Autopsy Trip) has a completely unrelated modified time. Clean evidence only Storage was
   touched that day.
4. **No crossover risk between Storage and Storage - Family on hospital billing, confirmed
   live.** `createSalesOrderForHospitalCase` only ever queries `Product_Category = 'Storage'` —
   it never adds a `Storage - Family` line to begin with, so there's no live code path where the
   two could collide. (The `Storage - Family` hospital products that exist appear to be
   dormant/manual-only today — same situation uncovered for the police side under item 6.)
5. **"Storage for Hospital" $0 fallback confirmed to fire only when a hospital genuinely has no
   linked Storage product** (the `else` branch of the COQL lookup in
   `UpdateStorageFeeonHospitalReleaseDate`). Price confirmed deliberately $0 by Andrea (Issue A
   above).

### V3 — other confirmations
1. **Convert hardcoded LONI/MNSJ storage product lookups to the tagging/COQL pattern?** Still an
   open decision for Andrea, not implemented — recommend deferring specifically because
   `StorageFeebasedonLetterofNoInterestWorkflow` has already been edited twice tonight (items 7
   and 8); stacking a third structural change on the same function in one day raises risk for
   little immediate benefit. Worth doing later as a deliberate, separately-tested change.
2. **Hospital reschedule: branch vs. separate function?** Resolved by Item 11 above — branched
   inside `handleAutopsyReschedule` rather than a separate function, since the trip-creation half
   is already shared/pipeline-agnostic.
3. **Should the reschedule trip be created at disposition time, or only once the new date
   arrives?** Still an open decision for Andrea (her own stated concern: "nothing should sit
   incorrectly in Trip Manager"). Today it's created immediately with no date and status "DO NOT
   SCHEDULE" — visible in Trip Manager but clearly flagged as not-yet-scheduled. Not changed;
   flagging for her call rather than guessing at a workflow-visibility preference.

## Open items carried over from the source doc

Item 6 (blocked on Andrea — see above). A new requirement from Andrea for a master/child Books
invoice linking mechanism — she is explaining this to herself/handling it directly, no design
work needed from us here.

Full documentation set (admin setup, initial-trip billing logic, decomposed charges, storage
logic, LONI/Release rules, family storage invoices, autopsy trips incl. reschedule, DA
disposition flow, X-rays, deceased renaming, reports, Books invoice creation/sending) requested
by Andrea — not started, to be written incrementally as each piece above is confirmed rather
than as one final pass.

## Second independent audit — `PH_BILLING_FIXES_FOR_DEV_20260828.md`, response 2026-08-31

A second, very thorough live-data audit (workflow rules, products, real Sales Orders/Invoices —
explicitly could not read Deluge source, flagged that as a gap for us to close). Responding item
by item; only the ones needing correction or new findings are detailed below — the rest were
independently reconfirmed and match.

### Tier 1.1 — KM billed as quantity: NOT still live, but real historical invoices are wrong

**Reconciles a contradiction with what we told the user 2026-08-29.** The master Product
"IFSLM Autopsy Trip Police Case" (`6503357000019249155`) has `Unit_Price = 1` right now —
confirmed again. But that's not the whole picture: **Invoice/Sales Order line items snapshot
`List_Price` at creation time and never re-sync when the master product's price changes later.**
Pulled Denton Brown's actual invoice (`6503357000078984080`) live: the line item's own
`List_Price` is still `180` (Quantity 180 → $32,400), even though the same product's current
master `Unit_Price` reads `1`. So:
- **The config is correct going forward** — any Sales Order/Invoice created from now on will
  correctly price at $1/km.
- **The three invoices the audit found (Denton Brown, Alfred Clarke, Cassiena Anglin) are real,
  already-created, and still wrong** — they were built before the price was corrected, and
  nothing retroactively fixes them. These need manual correction (credit note + reissue, or a
  direct edit if unpaid/unsent) — this is a live-data cleanup task, not a code fix.
- **`IFSLM Initial Police Case Pickup` (`6503357000002869122`) is a real, separate, still-open
  gap** — confirmed its master `Unit_Price` is still `180` today, and it genuinely can get billed
  by driven KM (`CreateSalesOrderforPoliceCase`'s `Created_on_This_Field_Update == "Initial_Trip"`
  branch uses `Quantity = Number_of_distance_in_km`). Same $1/km reprice decision needed here,
  not yet applied.
- Recommend a live sweep of every Sales_Orders/Invoices line item referencing either product to
  find any other pre-fix invoices carrying the wrong frozen price, not just the three the audit
  happened to surface.

### Tier 1.2 — duplicate untagged Police invoice: real root cause found (not the one guessed)

The audit guessed the workflow rule "Create Invoice from SO on Changing Deal Stage to DFH
Selected or Embalming Authorization" (id `6503357000003234291`) was missing a Stage condition.
**Checked live — it isn't:** its trigger criteria correctly requires
`Stage in (DFH Selected, Embalming Authorization)`, and its one action-condition requires
`Pipeline = Police Cases`. Both are enforced.

**The real bug is in the function it calls, `automation.CreateInvoicefromSOonChangingDealStageChange`:
it has no idempotency check at all.** Every time it fires, it unconditionally clones a brand-new
Invoice from the Deal's "Police Cases" Sales Order — never checking whether a Police invoice
already exists — and it never sets `Invoice_For` on the new invoice, so it always lands with no
payer. If a Deal's Stage ever passes through "DFH Selected" or "Embalming Authorization" more
than once (a correction, a re-save, stepping back and re-forward), this creates another
untagged duplicate. Not yet fixed — needs a guard added (check for an existing untouched Police
invoice/Sales-Order-Approved state before creating another) — flagging for a decision on exactly
what "already invoiced" should mean before writing the guard, rather than guessing.

### Tier 3, item 6 — decomposed cases missing the autopsy line: confirmed NOT a code branch

Read `CreateSalesOrderforPoliceCase` fresh, in full. The autopsy-trip line item is added under
`if(recordInfo.get("Autopsy_Required") == "Yes")` — this check is completely independent of the
decomposed/non-decomposed branch above it (which only decides which *storage* product to use).
**There is no code path that skips the autopsy line because a case is decomposed.** The far more
likely explanation: `Autopsy_Required` was probably not "Yes" on the specific decomposed Deals
the audit found (Dwayne Thomas, the Unidentified Female) — plausible on its face, since a body
too decomposed for a standard autopsy is a real medical/procedural scenario, not just a
guess. Recommend checking `Autopsy_Required` on those two Deals directly to confirm; no code
change indicated by this so far.

### Tier 4, item 11 — repo drift claim is itself incorrect

The audit says `createInvoiceBasedOnSalesOrderForPolice` doesn't exist live. **It does** —
confirmed it's directly called, live, inside `CreateSalesOrderforPoliceCase`
(`standalone.createInvoiceBasedOnSalesOrderForPolice(crmid);`), and real Police invoices with
correct `Invoice_For = "Police"` exist as proof it runs successfully. This was very likely a
false negative from however the audit searched the function list (metadata search, not a direct
name lookup) — not a real repo/live drift. No reconciliation needed for this specific function;
if the repo is stale in other ways that's a separate check.

### Tier 4, item 9 — confirmed exactly as reported

Both `Post Mortem (Decomposed)` (`6503357000026737326`, `Product_Category` blank) and
`City Hospital Decompose` (`6503357000027236090`, `Product_of_This_Hospital` blank) checked live
— neither can be found by any category-based lookup as currently tagged. Andrea's call on
whether either belongs in the automated flow; not fixed, since we don't know the intended
category/hospital to tag them with.

### Not independently re-verified this pass (trusted as reported, well-evidenced with record ids)

Tier 2 item 3 (missing institution Sales Orders on ~28% of not-selected cases — the Andrew
Williams/Daniel Robinson code gap specifically still needs tracing), and Tier 3 items 4/5/7
(Condition misspelling data pattern, the exact string compared, and the un-run decomposed daily
rate) — the audit's own live-data evidence for these is thorough and specific; nothing found
during this pass contradicts them. Flagging as still open rather than closed.
