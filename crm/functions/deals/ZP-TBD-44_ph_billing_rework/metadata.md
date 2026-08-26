# ZP-TBD-44 — Police/Hospital Billing rework

Source: `D:\Office\Andrea_Projects\DFH\projectDocuments\PH-BILLING-DEV-TASKS.md` (Andrea's
detailed dev task list, verified against live production 2026-08-24) plus follow-up comments
from Andrea the same evening. Multi-day effort — this ticket tracks the whole rework as items
land, rather than one function at a time.

## Status: IN PROGRESS. All of Part 2 (items 1-15) is now closed — see below for detail on each.
Still open: item 6 (blocked on Andrea), Part 4 V2/V3 validations, and the new master/child Books
invoice requirement Andrea raised separately (still to be designed), plus the full documentation
set requested.

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

**Known residual gap, not fixed today:** the *old* parent batch trip's cached
`Deceased_Names_Summary` text isn't refreshed when a child leaves it — only the *new* parent's
summary gets rebuilt inside `groupAutopsyTrips`. So the old batch trip can keep showing a
deceased who's no longer actually scheduled for that date until something else happens to touch
it. Display-only, not a billing issue — low priority.

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
Confirmed both check-in screens live in `app.js`: `autopsyCheckinHtml` (police/regular morgue
check-in, inside the Autopsy Batch flow) already had the Registration Number field; a second,
separate screen `hospMorgueCard` (hospital multi-deceased check-in) also had one.

**Fix applied, edited directly (widget JS, not a `.ds` file):**
- Item 13: removed the Registration Number field entirely from `hospMorgueCard` (hospital
  screen). Left untouched on the police/regular screen (`autopsyCheckinHtml`).
- Item 14: `renderAutopsyBatchInner`'s "Complete Trip" gate (`allSet`/`done` calculation) now
  also requires a non-blank Registration Number for every deceased not already in DFH's care
  (`d.inCare !== 'Yes'`), not just an outcome selection. Bottom helper text updated to say so
  when that's what's blocking completion.

### Item 15 — registration number on the Hospital Invoicing Report
Confirmed the report exists (`Hospital Invoicing Report`, Zoho Analytics Pivot view, id
`2981994000000178879`, workspace `2981994000000006002`), and confirmed the Police Invoicing
Report (`2981994000000148618`) is a separate, independent Pivot view in the same workspace, so
removing the field from Hospital's layout alone couldn't affect Police's. No tool access to edit
Analytics view fields — done manually by the user (Registration_Number removed from the Hospital
report's pivot field selection). **User-confirmed, not independently verified** — no tool
available here to read back the report's column list.

## Open items carried over from the source doc (not started)

See `PH-BILLING-DEV-TASKS.md` item 6 (above, blocked on Andrea) and Part 4 V2/V3 validations.
Also open: a new requirement from Andrea for a master/child Books invoice linking mechanism (she
recalls building something like this months ago; not yet located in the repo, CRM function
names, or CRM Invoices fields — she is checking her own records for it).

Full documentation set (admin setup, initial-trip billing logic, decomposed charges, storage
logic, LONI/Release rules, family storage invoices, autopsy trips incl. reschedule, DA
disposition flow, X-rays, deceased renaming, reports, Books invoice creation/sending) requested
by Andrea — not started, to be written incrementally as each piece above is confirmed rather
than as one final pass.
