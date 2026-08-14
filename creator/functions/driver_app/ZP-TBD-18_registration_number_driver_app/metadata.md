Task ID: ZP-TBD-18 / D-1 (Driver App side)
App: Zoho Creator (Driver App)
Functions: map saveMorgueCheckin(...) (UPDATED, see saveMorgueCheckin_UPDATED.deluge),
map saveDeceasedPickup(String pickupId, String tripId, Map fields) (one-line addition, see below)
Created By: Claude Code, 2026-08-15
Production Deployed: Yes -- .ds changes (saveMorgueCheckin + saveDeceasedPickup
supportedKeys) pasted in by the user and confirmed passing 2026-08-15; app.js UI changes
applied directly to the workspace (committed to the Driver App's own repo, commit
`5844ab9`) and confirmed passing in the same test.

## Finding: TWO separate check-in code paths, only one covered by the earlier CRM-side fix
The CRM-side D-1 work (`crm/functions/deals/ZP-TBD-18_police_hospital_billing/D-1_registration_number/`)
fixed `onDeceasedPickupCheckIn`, which only fires for the HOSPITAL multi-deceased path
(Driver App's `saveDeceasedPickup` -> Deceased_Pickups module -> CRM workflow ->
`onDeceasedPickupCheckIn`). The regular/police single-deceased trip check-in uses a
completely different function, `saveMorgueCheckin`, which writes DIRECTLY to Operations via
REST and previously had NO Deal write of any kind. This function is never in the call chain
of `onDeceasedPickupCheckIn` at all -- the earlier CRM fix does not reach it.

Given the requirement text ("driver enters the pre-printed registration number at check-in,
alongside the fridge/row/drawer info") and that `saveMorgueCheckin` is literally the
fridge/row/drawer function for the regular-trip path, this path needed its own independent
fix for D-1 to be complete.

## What was built

**1. `saveMorgueCheckin` -- new `registrationNumber` parameter** (`saveMorgueCheckin_UPDATED.deluge`):
- Written to `Operations.Registration_Number`, same "only write if present" pattern already
  used for `refrigerator`.
- NEW: resolves the Trip's Deal (this function didn't do this before at all) and writes
  `Deals.Registration_Number` there too, guarded so it only writes if the value actually
  changed, and wrapped so a Deal-write failure never breaks the overall Operations-write
  success result (matches how other side-effect propagation in this app is handled
  non-fatally elsewhere).

**2. `saveDeceasedPickup` -- one-line addition to `supportedKeys`** (id `6503357000069144520`
region, function at Driver_App.ds line 4714): add `"Registration_Number"` to the
`supportedKeys` list (line 4775). This function already forwards any key in that list to
the CRM Deceased_Pickups record generically -- no other change needed, the existing
`onDeceasedPickupCheckIn` fix picks it up from there.

**3. `widget-js-changes.md`** -- the app.js UI changes for both check-in screens (regular
and hospital), including both call sites of `Save_Morgue_Checkin` (a debounced auto-save
and a batch save flow) that both needed the new field added to their payloads.

## Deploy status: COMPLETE (2026-08-15)
1. `"Registration_Number"` added to `supportedKeys` in `saveDeceasedPickup` -- done.
2. `saveMorgueCheckin_UPDATED.deluge` pasted over the live function -- done.
3. app.js changes (both screens, all edit points) applied directly to the workspace -- done.
4. Both paths tested and **confirmed passing**.

D-1 is now fully deployed end-to-end: Driver App capture (both check-in screens) -> CRM
(Operations + Deal, both paths) -- see also the CRM-side fix at
`crm/functions/deals/ZP-TBD-18_police_hospital_billing/D-1_registration_number/`, also
confirmed passing. Only remaining D-1 piece: locating and updating Ms. Shirley's reports.
