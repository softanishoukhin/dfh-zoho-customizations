# Deployment Checklist — ZP-TBD-6

- [x] Paste `CreateSalesOrderforPoliceCase.deluge` over the live function of the same name (Automation, id 6503357000003436189).
- [x] Paste `updateSalesOrderOnNumberOfDistanceinKMUpdate.deluge` over the live function of the same name (Automation, id 6503357000016798029).
- [x] Create new Standalone function `patchPickupQuantityOnSalesOrder` from `patchPickupQuantityOnSalesOrder.deluge`.
- [x] Create new Standalone function `patchAutopsyTripQuantityOnSalesOrder` from `patchAutopsyTripQuantityOnSalesOrder.deluge`.
- [x] Confirm workflow rule "Update Sales Order on Km Update" (id 6503357000016798049) still points at `updateSalesOrderOnNumberOfDistanceinKMUpdate`.
- [x] User separately updated that same workflow rule's trigger criteria to OR (Trip_Status=Completed OR KM changes) to fix the order-dependency bug found in tester round 3 — no function change required for that part.
- [x] Run full test suite (see test-cases.md) — all 15 passed.
- [ ] Rename this folder / update Task ID once a real Zoho Projects ticket number is assigned.
