Task ID: ZP-TBD-3 (placeholder)
Zoho App: CRM
Module: Deals
Function Name: CreateSalesOrderforPoliceCase, createSalesOrderForHospitalCase
Function Type: Standalone, called by Workflow "Action based on Different Stage Update"
Trigger Source: Deal Stage = "Trip Completed", branched by Pipeline (Police Cases / Hospital Cases)
Related Workflow Name: Action based on Different Stage Update
Related Button Name: n/a
Input Arguments: crmid (Int) — the Deal record ID
Connection Name: zohooauth
Required Scopes: ZohoCRM.modules.ALL
Related Fields: Deals.Number_of_distance_in_km, .Condition, .Autopsy_Required,
.Police_Account, .Selected_Hospital, .Account_Name; Trips.Trip_Type,
.Created_on_This_Field_Update; Deceased_Pickups.Trip, .Deal
Related Modules: Deals, Trips, Deceased_Pickups, Products, Sales_Orders
Created By: developer (original), fixed by Claude Code 2026-07-03
Last Updated By: Claude Code
Sandbox Tested: No — tested live with ZZTEST records
Production Deployed: Yes
Production Deployment Date: 2026-07-03
Notes:

## What was broken
Both functions look up their Trip via `select ... from Trips where Deal = '<crmid>'`, which
only matches the old single-Deal-per-Trip model. Multi-deceased Police/Hospital Deals
(created per-deceased by `onDeceasedPickupCreate`, see ZP-TBD-4) have no Trip.Deal at all — the
Trip is only reachable via this Deal's own Deceased_Pickups child. Before this fix, when such
a Deal's Stage reached "Trip Completed," the Sales Order function found zero matching trips
and silently did nothing — no error, no Sales Order, no Invoice.

## Fix
Added a fallback: if the direct Trip lookup is empty, find this Deal's Deceased_Pickups
child, follow its Trip lookup, and only proceed once that Trip's own status is confirmed
`Completed` (a safety gate — don't bill off a trip the DA hasn't actually finished). Once
found this way, there's no per-child equivalent of `Created_on_This_Field_Update`, so it's
forced to `"Initial_Trip"`, routing into the same per-km (Police) / flat-rate (Hospital)
pickup-fee branch used by the original single-Deal path.

`createSalesOrderForHospitalCase` differs slightly since it loops over *all* matching trips
(`for each tripInfo in tripList.toList()`) rather than one — the fallback wraps its single
resolved trip into a one-item list so the existing loop works unchanged.

## Also masked in this repo
- `Sleep_API?publickey=<value>` — a public key for a Creator custom API used purely as an
  artificial delay (`getUrl(...&seconds=10)`), present in both functions. Lower risk than the
  Amber/Google keys (it's a "public key" auth custom API, not a full API credential) but
  masked here anyway per the guide's rule against storing any credential-shaped value in Git.

## Verified live results (2026-07-03)
- Police: Sales Order created, $1,680 (Deal 6503357000071493023 — since deleted, was a
  ZZTEST record)
- Hospital: Sales Order + Invoice created, $4,750 (Deal 6503357000071514010 — since deleted)
