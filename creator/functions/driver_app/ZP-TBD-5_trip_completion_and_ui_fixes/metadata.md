Task ID: ZP-TBD-5 (placeholder)
Zoho App: Creator (Driver App)
Function Name: completeJob (Task 8 branch)
Function Type: Standalone Creator function, called by the widget when the driver taps
"Complete Trip"
Trigger Source: Driver App UI action
Related Workflow Name: n/a (fires the "Action based on Different Stage Update" CRM workflow
indirectly, via the Stage=Trip Completed REST PUT with trigger:workflow)
Related Button Name: "Complete Trip" button in the shared multi-body checkin screen
Input Arguments: tripId (String), completionTime (String)
Connection Name: zohocrm_connection
Required Scopes: ZohoCRM.modules.ALL
Related Fields: Deals.Stage, .Is_Deceased_In_Our_Care, .Initial_Trip_Completed_At;
Deceased_Pickups.Trip, .Deal; Trips.Trip_Status
Related Modules: Trips, Deals, Deceased_Pickups
Created By: developer (original Hospital-only branch), fixed by Claude Code 2026-07-03
Last Updated By: Claude Code
Sandbox Tested: No — tested live with ZZTEST Police and Hospital records
Production Deployed: Yes
Production Deployment Date: 2026-07-03
Notes:

Also see `widget-js-changes.md` in this folder for the companion client-side (app.js) fixes
made during the same test pass — those are JavaScript, not Deluge, and live in the driverApp
widget's own separate git repo.

This is the change that made ZP-TBD-3 (Sales Order fallback) actually reachable in practice —
before this fix, nothing ever moved a multi-deceased child Deal's Stage to "Trip Completed"
at all, so the Sales Order workflow never fired regardless of whether the fallback function
worked correctly.
