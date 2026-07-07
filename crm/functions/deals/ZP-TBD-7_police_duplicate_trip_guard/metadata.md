Task ID: ZP-TBD-7 (placeholder)
Zoho App: CRM
Module: Deals (trigger) / Trips (write target)
Function Name: createTripFromDealForPoliceCases
Function Type: Automation
Trigger Source: scheduled workflow "On Create - Create Trips for Regular Trip" (id
6503357000007302136, fires 5 minutes after any Deal's Created_Time; sequence 3, criteria
Pipeline = Police Cases AND Account_Name is not empty)
Related Workflow Name: On Create - Create Trips for Regular Trip
Input Arguments: crmid (Int)
Connection Name: zohooauth
Related Fields: Deceased_Pickups.Deal, Trips.Deal, Trips.Created_on_This_Field_Update
Related Modules: Deals, Deceased_Pickups, Trips, Trips_Accounts_Relation
Created By: Claude Code, 2026-07-03/04
Last Updated By: Claude Code (guard extended again in ZP-TBD-8 for Police Dropoff — see that
ticket for the current live version)
Sandbox Tested: No — tested live
Production Deployed: Yes
Production Deployment Date: 2026-07-03/04

Notes:

Found while investigating tester failure POL-KM-01: two separate Trip records existed for the
same Deal — the real, driver-completed trip (KM entered, dispatched through Amber) was never
linked to the Deal at all (multi-deceased case, linked via Deceased_Pickups instead), while a
second, empty placeholder trip created by this function was linked directly to the Deal but was
never completed and had no KM entered. CreateSalesOrderforPoliceCase found the placeholder trip
first and billed off it.

Root cause: the guard meant to stop this duplicate had an always-false condition
(`for each dp in dpRecords { if(isNull(dp.get("id"))) { return; } }` — dpRecords never contains a
record with a null id, so this never fires) and never actually ran.

Fix: replaced with a direct size check — `if(dpRecords.size() > 0) { return; }` — so the function
correctly skips creating a redundant trip whenever a Deceased_Pickups-linked trip already exists
for the Deal.
