Task ID: ZP-TBD-6 (placeholder)
Zoho App: CRM
Module: Deals (via Trips edits) / Sales_Orders
Function Names: CreateSalesOrderforPoliceCase, updateSalesOrderOnNumberOfDistanceinKMUpdate,
patchPickupQuantityOnSalesOrder (new), patchAutopsyTripQuantityOnSalesOrder (new)
Function Type: Automation (CreateSalesOrderforPoliceCase, updateSalesOrderOnNumberOfDistanceinKMUpdate),
Standalone (the two new patch functions)
Trigger Source: "Action based on Different Stage Update" (Deals, Stage=Trip Completed, Pipeline=Police
Cases) for CreateSalesOrderforPoliceCase; "Update Sales Order on Km Update" (Trips workflow) for
updateSalesOrderOnNumberOfDistanceinKMUpdate
Related Workflow Name: Action based on Different Stage Update (id 6503357000003436242, sequence 1);
Update Sales Order on Km Update (id 6503357000016798049)
Input Arguments: crmid (Int) for the two automation functions; dealId (Int), newKm (Float) for the two
new patch functions
Connection Name: zohooauth (REST reads/writes), no connection needed for standalone.COQLQuery
Related Fields: Trips.Number_of_distance_in_km, Trips.Trip_Type, Trips.Parent_Trip, Deals.Condition,
Deals.Autopsy_Required, Sales_Orders.Ordered_Items
Related Modules: Deals, Trips, Deceased_Pickups, Sales_Orders, Products
Created By: Claude Code, 2026-07-03/04
Last Updated By: Claude Code (superseded again in ZP-TBD-8 for Police Dropoff billing — see that
ticket for the current live version of CreateSalesOrderforPoliceCase)
Sandbox Tested: No — tested live
Production Deployed: Yes
Production Deployment Date: 2026-07-03/04

Notes:

Andrea's requirement: "On a police case, both the initial trip and the autopsy trip, the qty must be
the total KM on the trip. It has to be for both. Hospital is per hospital pricing and is flat rate."

Root cause found: CreateSalesOrderforPoliceCase's pickup line item read Quantity from the DEAL's own
Number_of_distance_in_km (a stale mirror, only ever copied from whichever trip wrote to it first), not
the actual trip. The Autopsy Trip line item was hardcoded to Quantity 1 with no KM lookup at all.

Fix: pickup line item now reads Quantity from the trip record fetched via COQL. Autopsy Trip line item
looks up that deceased's own "Autopsy Initial" trip; if its own KM is empty it falls back to the KM on
the shared "Multi Deceased Autopsy Trip" parent via Parent_Trip (the real vehicle dispatch is usually
recorded on the parent, not the individual child).

Separately, updateSalesOrderOnNumberOfDistanceinKMUpdate (fired when KM is entered/edited AFTER the
Sales Order already exists) had its real update logic commented out — it only ever mirrored KM to the
Deal once. Rewrote it to resolve the Deal even when the Trip has no direct Deal link (via
Deceased_Pickups), fetch Pipeline via invokeurl REST GET (zoho.crm.getRecordById does not reliably
return Deals.Pipeline in this org — see shared/connection-notes), and patch ONLY the relevant line
item's Quantity via the two new patch-only helper functions — never rebuilding the whole Sales Order,
so an already-correct storage-day quantity is never reset. Added a dedicated branch for when KM changes
on a "Multi Deceased Autopsy Trip" PARENT (which has no Deal of its own): it fans the new KM out to
every child's own Deal/Sales Order via patchAutopsyTripQuantityOnSalesOrder.

Root cause for KM-before-vs-after-completion order dependency (found in tester round 3): the workflow
rule "Update Sales Order on Km Update" originally only watched the KM field, with no guarantee the trip
was actually Completed by the time it ran. User fixed this directly in the workflow rule: trigger
criteria broadened to OR (Trip_Status=Completed OR KM changes), but the sequence's own ACTION criteria
still requires Trip_Status=Completed — so the patch function only ever runs once the trip is genuinely
done, regardless of which field change triggered the rule.
