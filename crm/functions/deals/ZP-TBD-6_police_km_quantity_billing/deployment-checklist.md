# Deployment Checklist — ZP-TBD-6

- [x] Paste `CreateSalesOrderforPoliceCase.deluge` over the live function of the same name (Automation, id 6503357000003436189).
- [x] Paste `updateSalesOrderOnNumberOfDistanceinKMUpdate.deluge` over the live function of the same name (Automation, id 6503357000016798029).
- [x] Create new Standalone function `patchPickupQuantityOnSalesOrder` from `patchPickupQuantityOnSalesOrder.deluge`.
- [x] Create new Standalone function `patchAutopsyTripQuantityOnSalesOrder` from `patchAutopsyTripQuantityOnSalesOrder.deluge`.
- [x] Confirm workflow rule "Update Sales Order on Km Update" (id 6503357000016798049) still points at `updateSalesOrderOnNumberOfDistanceinKMUpdate`.
- [x] User separately updated that same workflow rule's trigger criteria to OR (Trip_Status=Completed OR KM changes) to fix the order-dependency bug found in tester round 3 — no function change required for that part.
- [x] Run full test suite (see test-cases.md) — all 15 passed.
- [ ] Rename this folder / update Task ID once a real Zoho Projects ticket number is assigned.

## Round 2 Deployment (2026-08-14) — patchPickupQuantityOnSalesOrder missing-line-item fix, NOT yet deployed
- [ ] Paste the updated `patchPickupQuantityOnSalesOrder.deluge` (this folder) over the live
      Standalone function of the same name
- [ ] Test against a Deal with a Police Cases Sales Order that does NOT yet have a "Pickup"
      line item (e.g. one created with only a Storage or Decompose charge) — confirm a Pickup
      line item is now added with `Quantity = newKm`, and the invoice regenerates
- [ ] Regression-test the existing-line-item path (Sales Order already has a Pickup line item)
      still just updates the Quantity in place, unchanged from before
- [ ] Deploy together with `crm/functions/trips/ZP-TBD-1_amber_integration_fix/amberConnectResponse_FIX.deluge`
      — this fix alone does nothing if the KM never reaches `Trips.Number_of_distance_in_km`
      in the first place
