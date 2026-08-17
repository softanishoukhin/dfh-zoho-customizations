# D-1 -- Ms. Shirley's police/hospital reports

**STATUS (2026-08-15 -- re-checked after the pause): sync is healthy now, but the new field
still isn't in the sync's column selection.** Original blocker (record-level sync stalled --
live Deals 2751 vs. synced 2683, a 68-record gap) is RESOLVED: re-checked live, Deals is now
2772 records vs. 2769 synced -- a normal ~3-record lag, not a stall. Whatever was wrong with
the sync got fixed between the pause and now.

**New, narrower finding:** `Registration_Number` (created on Deals partway through this
task) is confirmed NOT present among the Deals table's 293 synced columns in Analytics --
this is a separate step from the record sync being healthy. A newly created CRM field is
not automatically added to an existing Analytics sync's column selection; it has to be
added explicitly. **Before Step 1 below can be applied, open Analytics' Workspace Settings
-> Zoho CRM Integration -> the Deals table's field mapping, and add `Registration_Number`
to the synced fields.** No tool in this connector can do this -- Analytics field-sync
configuration isn't exposed via any available API here.

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

## Step 0 -- add Registration_Number to the Analytics sync's field selection (CONFIRMED STILL NEEDED, 2026-08-15)

Confirmed live: the Deals table in Analytics has 293 synced columns and `Registration_Number`
is not one of them. Add it: Analytics -> Workspace Settings -> Zoho CRM Integration -> Deals
table's field mapping -> add `Registration_Number` to the synced fields -> save/re-sync. Once
that's done, re-check the Deals table's column list in Analytics before moving to Step 1 --
don't assume it landed just because the setting was saved; confirm the column actually
appears.

## Step 1 -- add the column to each query table's SQL

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

## Step 2 -- add the new column to each Pivot report's layout

Editing the query table's SQL makes the column *available*, but each of the 7 Pivot
reports needs the new "Registration Number" column manually dragged into its report layout
in the Zoho Analytics UI (Pivot views don't auto-display newly added source columns). Do
this for all 7 reports listed in the table above.

## Test

Once a Deal has a Registration Number (from either Driver App check-in path, now live),
confirm it appears correctly in whichever of the 7 reports that Deal's pipeline/hospital
matches (e.g. a Police Cases deal should show it in "Police Invoicing Report" and "Weekly
Police Autopsy Report" if within that report's 7-day window; a Hospital Cases deal for
Cornwall Regional should show it in both "Hospital Invoicing Report" and "CRH - Hospital
Invoicing Report").
