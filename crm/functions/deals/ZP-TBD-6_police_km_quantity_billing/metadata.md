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

## Round 2 (2026-08-14) — second, independent bug found in patchPickupQuantityOnSalesOrder
Re-verified this whole chain against live source while investigating Andrea's "Amber KM still not
working" report (see `crm/functions/trips/ZP-TBD-1_amber_integration_fix/metadata.md` Round 3 for the
separate Amber-payload-parsing bug that sits upstream of this one).

Live `patchPickupQuantityOnSalesOrder` matched this repo's copy exactly — no drift. But comparing it
directly against its sibling `patchAutopsyTripQuantityOnSalesOrder` (same file, same folder) surfaced a
real asymmetry: the autopsy version has a proper `else` branch that ADDS a new "Autopsy Trip" line item
if one doesn't already exist on the Police Sales Order. `patchPickupQuantityOnSalesOrder` has NO
equivalent — if the Police Sales Order exists but doesn't yet have a "Pickup" line item (for example, it
was first created for a Storage or Decompose charge only), the function does nothing: no line item is
added, the Sales Order PUT never runs, `createInvoiceBasedOnSalesOrderForPolice` never fires. It still
returns `"done"`, so this never surfaced as an error anywhere — it just silently drops the KM quantity.

This is a second, independent way police KM billing can fail, separate from (and in addition to) the
Amber-payload-parsing bug. Both need to be fixed for the full chain (Amber → Trips.Number_of_distance_in_km
→ Sales_Orders line item → Invoice) to work reliably.

Fix: `patchPickupQuantityOnSalesOrder.deluge` in this folder now has the missing `else` branch, mirroring
`patchAutopsyTripQuantityOnSalesOrder`'s existing pattern exactly (look up the Pickup product's own price,
build a new line item with `Quantity = newKm`, add it to the line item list). NOT deployed yet — needs to
be pasted over the live function and tested against a Police Sales Order that has no Pickup line item yet.
