Task ID: ZP-TBD-1 (placeholder — assign real Zoho Projects task ID)
Zoho App: CRM
Module: Trips
Function Name: createJobInAmber, standalone.sendCompleteStatusToAmber
Function Type: Standalone (both), invoked by Workflow + directly from within createJobInAmber
Trigger Source: Workflow rule "Send Amber Completion When No Deal Present" (Trips, field_update
on Trip_Status = Completed AND Amber_Completion_Sent = false); createJobInAmber is also called
by three older creation rules ("Create Job in Amber" [inactive], "Create Job in Amber on Update"
[active, edit-only], "Create Job in Amber V2" [active, unreliable timer] — left as-is, see below)
Related Workflow Name: Send Amber Completion When No Deal Present (id 6503357000071400424)
Related Button Name: n/a
Input Arguments: crmid (Int) — the Trip record ID, for both functions
Connection Name: none — both functions call `api-gateway.amberconnect.com` and
`maps.googleapis.com` directly with the API key inline in the URL, which is the intended
pattern for this integration. Keys are masked in this repo's function.deluge; see
shared/connection-notes/zoho_connections.md.
Required Scopes: ZohoCRM.modules.ALL (reads/writes Trips, Deals, Contacts, Deceased_Pickups,
Products)
Related Fields: Trips.Amber_Connect_Job_ID, Trips.Amber_Completion_Sent,
Trips.Amber_Completion_Response, Trips.Amber_Vehicle, Products.Amber_Auth_Token
Related Modules: Trips, Deals, Contacts, Deceased_Pickups, Products
Created By: Dale Delapenha (original), modified by developer + Claude Code 2026-07-02/03
Last Updated By: Claude Code (verified/backfilled into this repo 2026-07-03)
Sandbox Tested: No — tested directly in production with clearly-tagged "ZZTEST" records,
deleted after (see test-cases.md). No CRM Sandbox was used for this round.
Production Deployed: Yes
Production Deployment Date: 2026-07-03
Notes:

## Background
Amber job tracking (a third-party dispatch/vehicle system) was failing for Police and Hospital
multi-deceased trips, which have no Deal directly on the Trip record (the Deal lives on the
Trip's Deceased_Pickups child instead). The original functions assumed every Trip had a Deal
and crashed dereferencing `tripDetails.get("Deal").get("id")`.

## Round 1 (completed before this repo existed — backfilled from a developer handoff doc)
1. `createJobInAmber` — added a Deceased_Pickups fallback to resolve the Deal when Trip.Deal
   is empty; falls back to `CustomerName = "Unknown Deceased"` if no Deal resolves at all.
2. `sendCompleteStatusToAmber` — removed the unconditional Deal load entirely; the completion
   payload never needed Deal data.
3. New workflow rule "Send Amber Completion When No Deal Present" created, calling a small
   Automation wrapper function (`standalone.sendCompleteStatusToAmber` can't be selected
   directly in a workflow function picker since it's a Standalone function).

## Round 2 (done today, 2026-07-03, in this session)
Root cause: the Deal was never actually the problem for Round 2 — it was a trigger-timing gap.
Three legacy job-*creation* rules exist: one is OFF, one only fires on edit (not creation), and
the "V2" timer rule is unreliable. A trip created fully-formed and marked Completed with no
intermediate edit fell through all three, so it never got a Job ID, so completion could never
fire either.

Fix applied:
1. Appended a ~10-line block to the end of `createJobInAmber`: if the trip is already
   `Completed` and now has a real Job ID, call `sendCompleteStatusToAmber` immediately —
   same pattern as `updateDealStagetoInitialTripCompleted`.
2. Edited "Send Amber Completion When No Deal Present": removed the
   `Amber_Connect_Job_ID is not empty` condition (it was excluding exactly the trips that
   needed a job created), and changed the instant action from the completion wrapper to
   `createJobInAmber` directly.
3. **Developer follow-up, done live, not by Claude**: also removed the `Deal is empty`
   condition from the same rule, making it apply to every trip completion regardless of Deal
   presence. Confirmed correct — `createJobInAmber` is idempotent (updates an existing job
   rather than duplicating) so this doesn't create duplicate-job risk.

## Known open issue — NOT fixed, flagged for a decision
Testing surfaced that a separate legacy rule ("On Create - Create Trips for Regular Trip",
Deals module, fires 5 minutes after any Deal is created) still creates a stray, orphaned Trip
for Police (and likely Hospital) per-deceased Deals from the new multi-deceased architecture —
it predates that architecture and has no awareness that these child Deals already belong to a
real, in-progress Trip. Confirmed via a real test run (see test-cases.md). Not touched — needs
a decision on the fix approach (likely: extend the exclusion pattern already used for the
Funeral-pipeline sequence of that same rule, via `Created_From_Hospital_or_Police_Case_Deal_ID`).

## Known open issue — needs a decision
`Number_of_distance_in_km` does not come back from Amber on Police cases. Confirmed by
inspecting the raw `Amber_Completion_Response` — the completion payload has no
distance/mileage field at all. If real driven distance is expected, it would need a different
Amber endpoint (job details/tracking), not this one.
