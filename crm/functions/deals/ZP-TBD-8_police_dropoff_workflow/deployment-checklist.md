# Deployment Checklist — ZP-TBD-8 (CRM side)

- [x] Create new Standalone function `createPoliceDropoffCase` from `createPoliceDropoffCase.deluge`. Enable REST API (API-key auth) — this is the entry point the widget bridge calls.
- [x] Create new Standalone function `createOnePoliceDropoffDeceased` from `createOnePoliceDropoffDeceased.deluge`.
- [x] Create new Standalone function `generateHangTagForDealNoTrip` from `generateHangTagForDealNoTrip.deluge`.
- [x] Create new Automation function `onPoliceDropoffNameCorrected` from `onPoliceDropoffNameCorrected.deluge`. Enable REST API (API-key auth) — called from the dispatcher branch below.
- [x] Paste `CreateSalesOrderforPoliceCase.deluge` over the live function of the same name (already modified once in ZP-TBD-6/7 — this is the cumulative final version).
- [x] Paste `createTripFromDealForPoliceCases.deluge` over the live function of the same name (already modified once in ZP-TBD-7 — this is the cumulative final version, now with 2 guards).
- [x] Add the new "Police Dropoff - deceased name corrected while in our care" branch to the live `handleWorkflowTriggerAndActionByTimelineProcess` (do not touch any other branch — see `handleWorkflowTriggerAndActionByTimelineProcess.deluge`'s header note for exactly what's new).
- [x] User created new picklist field `Deceased_Size` on the Operations module directly (mirroring the Deal's own picklist values, minus the unused Small/Medium/Large options).
- [ ] Recommended, not yet applied: add `Decomposed` as a picklist value on Operations.Condition (currently `-None-`/`Good`/`Needs attention` only) — see metadata.md "Open item."
- [ ] Full end-to-end retest pending as of 2026-07-07 (last fix applied: Stage/DOD/Sex corrections in `createOnePoliceDropoffDeceased`).
- [ ] Rename this folder / update Task ID once a real Zoho Projects ticket number is assigned.
