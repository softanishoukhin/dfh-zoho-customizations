Task ID: ZP-TBD-18 / D-1 (Driver App side)
App: Zoho Creator (Driver App)
Functions: map saveMorgueCheckin(...) (UPDATED, see saveMorgueCheckin_UPDATED.deluge),
map saveDeceasedPickup(String pickupId, String tripId, Map fields) (one-line addition, see below)
Created By: Claude Code, 2026-08-15
Production Deployed: No -- guideline only, not applied to the live .ds (never edit Creator
.ds files directly -- see repo hard rule)

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

## Deploy
1. Add `"Registration_Number"` to the `supportedKeys` list in `saveDeceasedPickup`
   (Driver_App.ds ~line 4775) -- one-line addition, no other change to that function.
2. Paste `saveMorgueCheckin_UPDATED.deluge` over the live `saveMorgueCheckin` function in
   full (it's a complete function replacement, not a diff).
3. Apply the app.js changes in `widget-js-changes.md` (2 screens, 4 total edit points: 1
   render function + 1 init line for the regular path, 2 call-site payload additions for
   the regular path, 1 render addition for the hospital path).
4. Test both paths per the Test section in `widget-js-changes.md`.
