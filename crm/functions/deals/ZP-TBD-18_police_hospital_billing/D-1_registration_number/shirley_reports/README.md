# D-1 -- Ms. Shirley's police/hospital reports

**STATUS (2026-08-17): COMPLETE.** All 3 steps done and confirmed live. Registration Number
is synced into Analytics, added to all 3 Analytics query tables, and displayed in all 3
reports where it structurally applies (the other 4 are hospital-specific summary/count
reports with no per-record layout, so it doesn't apply there -- confirmed with user).

**Located 2026-08-15.** These live in **Zoho Analytics**, workspace "Zoho CRM Reports"
(orgId `871315529`, workspaceId `2981994000000006002`) -- confirmed by keyword-matching
against `Deals.Selected_Hospital`'s active hospitals (CRH/HIH/NCH/UHWI = Cornwall Regional,
Hope Institute, National Chest, University Hospital of the West Indies -- the same four
hospitals confirmed as the only ones actually in live use, see
`H-1_hospital_storage_fix/metadata.md`).

**No write/update tool is available for Zoho Analytics query tables via the connector**
(checked -- only read tools exist, same limitation as most other integrations here). This
needs to be applied through the Zoho Analytics UI directly -- can't be done via MCP the way
CRM functions were. Guideline only.

## The reports (7 total, backed by 3 query tables)

| Report (Pivot) | Backed by (Query Table) |
|---|---|
| Hospital Invoicing Report | Query Table for Hospital Invoicing Report |
| CRH - Hospital Invoicing Report | Query Table for Hospital Invoicing Report |
| HIH - Hospital Invoicing Report | Query Table for Hospital Invoicing Report |
| NCH - Hospital Invoicing Report | Query Table for Hospital Invoicing Report |
| UHWI - Hospital Invoicing Report | Query Table for Hospital Invoicing Report |
| Police Invoicing Report | Query Table for  Government Invoicing Report *(sic -- double space in the live name)* |
| Weekly Police Autopsy Report | Weekly Police Autopsy Status |

All three query tables are built directly on the CRM-synced **Deals** table, filtered by
`Pipeline = 'Hospital Cases'` or `Pipeline = 'Police Cases'` and joined to Invoices/Invoiced
Items/Products/Accounts (or, for the autopsy-status one, Trips/Deceased Pickups/Contacts).

## Step 0 -- DONE, confirmed live (2026-08-15)
User added `Registration_Number` to the Analytics sync's field selection. Re-checked live:
the Deals table in Analytics now has 294 synced columns including `Registration Number`
(Plain Text, columnId `2981994000005832022`). Ready for Step 1.

## Step 1 -- DONE, confirmed live (2026-08-15)
Verified all three query tables directly via `getQueryTableDetails`: "Registration Number"
column present and correctly positioned in all three (SELECT + GROUP BY for 1a/1b, both
UNION branches for 1c). Ready for Step 2 (adding the column to each Pivot's layout).

## Step 1 (reference) -- add the column to each query table's SQL

### 1a. "Query Table for Hospital Invoicing Report" (feeds 5 of the 7 reports)
In the SELECT list, add right after `"Deals"."Name of Deceased" AS "Name of Deceased",`:
```sql
		 "Deals"."Registration Number" AS "Registration Number",
```
In the GROUP BY list, add right after `"Deals"."Name of Deceased",`:
```sql
	 "Deals"."Registration Number",
```

### 1b. "Query Table for  Government Invoicing Report" (feeds Police Invoicing Report)
In the SELECT list, add right after `"Deals"."Name of Deceased" AS "Name of Deceased",`:
```sql
		 "Deals"."Registration Number" AS "Registration Number",
```
In the GROUP BY list, add right after `"Deals"."Name of Deceased",`:
```sql
	 "Deals"."Registration Number",
```

### 1c. "Weekly Police Autopsy Status" (feeds Weekly Police Autopsy Report)
This one is a UNION of two branches feeding an outer `SELECT deal_trip_data.*` -- no
GROUP BY, so it's simpler, but the column must be added to **both** UNION branches (their
column lists must match) in the same position, e.g. right after
`"Deals"."Name of Deceased" as "Name of Deceased",` in each branch:
```sql
			 "Deals"."Registration Number" as "Registration Number",
```
The outer query's `deal_trip_data.*` picks it up automatically once it's in the inner
SELECT lists -- no change needed to the outer query itself.

## Step 2 -- DONE, confirmed (2026-08-17)
Added to the 3 reports where it belongs: "Hospital Invoicing Report", "Police Invoicing
Report", "Weekly Police Autopsy Report".

Not added to CRH/HIH/NCH/UHWI - Hospital Invoicing Report -- confirmed with user these 4
are summary/count reports (counts per hospital, no per-record columns at all), so there is
no row-level layout for Registration Number to attach to. This is expected, not a gap --
Registration Number is still fully available in the underlying query table if a per-record
breakdown is ever added to these 4 later.

All 7 reports now correctly reflect Registration Number wherever it's structurally
applicable. D-1 reports sub-task is complete.

## Test

Once a Deal has a Registration Number (from either Driver App check-in path, now live),
confirm it appears correctly in whichever of the 7 reports that Deal's pipeline/hospital
matches (e.g. a Police Cases deal should show it in "Police Invoicing Report" and "Weekly
Police Autopsy Report" if within that report's 7-day window; a Hospital Cases deal for
Cornwall Regional should show it in both "Hospital Invoicing Report" and "CRH - Hospital
Invoicing Report").
