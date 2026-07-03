Task ID: ZP-TBD-4 (placeholder)
Zoho App: CRM
Module: Deceased_Pickups (trigger) / Deals (write target)
Function Name: onDeceasedPickupCreate (isPolice branch only — see function.deluge note)
Function Type: Workflow ("On Deceased Pickup Create", Deceased_Pickups on create)
Trigger Source: Deceased_Pickups record created
Related Workflow Name: On Deceased Pickup Create
Input Arguments: pickupId (Int)
Connection Name: none — uses native zoho.crm.* tasks, no invokeurl in this branch
Related Fields: Deals.Police_Account (lookup -> Accounts), Deals.Police_Office_Name (text),
Trips.Police_Station
Related Modules: Deceased_Pickups, Deals, Trips, Accounts
Created By: developer (original isPolice branch), fixed by Claude Code 2026-07-03
Last Updated By: Claude Code
Sandbox Tested: No — tested live with ZZTEST Police record
Production Deployed: Yes
Production Deployment Date: 2026-07-03
Notes:

`Deals.Police_Account` (lookup to Accounts) already existed on the Deals module, unused —
confirmed via connector field metadata (`getFields`, module=Deals). The isHospital branch of
this same function already resolves `Selected_Hospital` by searching Accounts by name; the
isPolice branch never had the equivalent step, only writing the plain-text
`Police_Office_Name`. Fix adds the same `Account_Name:equals:<name>` search pattern already
proven in the isHospital branch.

Verified live: Deal 6503357000071493023 (ZZTEST Police 1, since deleted) showed
`Police_Account: {"name":"Test Police Office_DND","id":"6503357000070632068"}` correctly
resolved after this fix.
