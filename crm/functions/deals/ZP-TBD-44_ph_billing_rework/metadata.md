# ZP-TBD-44 — Police/Hospital Billing rework

Source: `D:\Office\Andrea_Projects\DFH\projectDocuments\PH-BILLING-DEV-TASKS.md` (Andrea's
detailed dev task list, verified against live production 2026-08-24) plus follow-up comments
from Andrea the same evening. Multi-day effort — this ticket tracks the whole rework as items
land, rather than one function at a time.

## Status: IN PROGRESS. Items below are confirmed live; everything else from the task list is
still open (see the source doc's Part 2/3/4 for the full remaining list — autopsy reschedule
billing items 1-6, advance reschedule item 10, hospital reschedule billing item 11, registration
number placement items 13-15, plus the new master/child Books invoice requirement Andrea raised
separately, still to be designed).

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

## Open items carried over from the source doc (not started)

See `PH-BILLING-DEV-TASKS.md` Part 2 items 1-6 (autopsy reschedule billing, one connected job),
9 (X-ray field on Deal), 10 (advance reschedule), 11 (hospital reschedule billing), 13-15
(registration number placement), and Part 4 V2/V3 validations. Also open: a new requirement from
Andrea for a master/child Books invoice linking mechanism (she recalls building something like
this months ago; not yet located in the repo, CRM function names, or CRM Invoices fields —
needs either her memory of a keyword/date to search precisely, or a fresh design).

Full documentation set (admin setup, initial-trip billing logic, decomposed charges, storage
logic, LONI/Release rules, family storage invoices, autopsy trips incl. reschedule, DA
disposition flow, X-rays, deceased renaming, reports, Books invoice creation/sending) requested
by Andrea — not started, to be written incrementally as each piece above is confirmed rather
than as one final pass.
