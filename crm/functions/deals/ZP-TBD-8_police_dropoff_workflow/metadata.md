Task ID: ZP-TBD-8 (placeholder)
Zoho App: CRM
Module: Deals, Operations, Accounts
Function Names (new): createPoliceDropoffCase, createOnePoliceDropoffDeceased,
generateHangTagForDealNoTrip, onPoliceDropoffNameCorrected
Function Names (modified): CreateSalesOrderforPoliceCase, createTripFromDealForPoliceCases,
handleWorkflowTriggerAndActionByTimelineProcess
Function Type: Standalone (all 4 new + the 3 modified are Automation, except
handleWorkflowTriggerAndActionByTimelineProcess which is also Automation)
Trigger Source: createPoliceDropoffCase is called directly from the Intake widget via a new
widgetLookup action (see creator/functions/nok_intake/ZP-TBD-8_police_dropoff_workflow in this
repo) — no CRM workflow trigger for case creation. onPoliceDropoffNameCorrected is called from a
new branch inside the existing catch-all dispatcher handleWorkflowTriggerAndActionByTimelineProcess
(workflow: "Custom Manage - Trigger on Any Field Update", id 6503357000013615196) — no new
workflow rule was created.
Related Workflow Name: Custom Manage - Trigger on Any Field Update (id 6503357000013615196,
reused, not new); Action based on Different Stage Update (id 6503357000003436242, reused —
fires CreateSalesOrderforPoliceCase when the new Deal's Stage is explicitly moved to Trip
Completed); On Create - Create Trips for Regular Trip (id 6503357000007302136, the scheduled
workflow that createTripFromDealForPoliceCases' new guard defends against)
Input Arguments: see each .deluge file's signature
Connection Name: zohooauth (all REST reads/writes), zoho.crm.* SDK tasks for simple creates
Related Fields: Deals.Is_Deceased_In_Our_Care, Deals.Sex, Deals.Condition, Deals.Deceased_Size,
Deals.Stage, Deals.Name_of_Deceased, Operations.Location/Refrigerator/Row/Drawer/Condition,
Operations.Deceased_Size (new field, created directly by user on the Operations module)
Related Modules: Deals, Accounts, Operations, Trips (read-only, for the "no trip exists" guard
checks)
Created By: Claude Code, 2026-07-07
Last Updated By: Claude Code
Sandbox Tested: No — tested live
Production Deployed: Yes
Production Deployment Date: 2026-07-07

Notes — resource constraints:

Before building, the client flagged hard limits: max 3 more Deals workflow rules available, no
new fields on Deals, no new lookup fields on Trips (module at max). This feature was designed to
use 0 new Deals workflow rules and 0 new Deals fields:
  - Case creation and Stage-driven billing run as direct function calls / REST updates under our
    own control — no new workflow needed to trigger them.
  - The one thing that genuinely needed an edit-trigger (the rename cascade) was added as a new
    `if` branch inside the client's existing catch-all dispatcher rule/function rather than a new
    workflow rule.
  - Every piece of drop-off data reuses existing Deal fields (Is_Deceased_In_Our_Care, Condition,
    Deceased_Size, Sex, Stage, Name_of_Deceased). The only new field created anywhere is
    Operations.Deceased_Size (Operations module was not under the stated constraints).

Notes — architecture (trip-less):

Police Dropoff cases never get a Trip record. `createOnePoliceDropoffDeceased` creates the
Account + Deal (Stage starts at "Trip Requested" — confirmed mandatory on Deal creation in this
org, cannot be omitted — then moved to "Trip Completed" via a SEPARATE follow-up update so the
existing Stage-change billing workflow fires as a genuine edit) + Operations record directly, with
no Trip anywhere in the chain. `CreateSalesOrderforPoliceCase` was extended to also bill a Deal
with no Trip when `Is_Deceased_In_Our_Care == "Yes"` (the drop-off signature) — Storage (+ Decomp
Fee if Condition = Decomposed) with no Pickup line item, since there is no DFH-dispatched trip to
bill for. The Autopsy Trip line item is untouched — a real autopsy still involves a real trip
later, created and billed exactly as for any other Police case.

Notes — bugs found during testing (chronological):

1. Phantom pickup trip: the scheduled workflow "On Create - Create Trips for Regular Trip" fires
   5 minutes after ANY Deal's Created_Time and, for any Police Cases Deal with Account_Name set,
   unconditionally calls createTripFromDealForPoliceCases — with no awareness of drop-off cases.
   Fixed by adding an `Is_Deceased_In_Our_Care == "Yes"` guard to that function (this is now its
   SECOND guard, alongside the ZP-TBD-7 Deceased_Pickups guard).
2. Billing never fired: setting Stage directly to "Trip Completed" in the Deal CREATE payload
   didn't persist reliably. Manual live testing then revealed the real constraint: Stage is a
   MANDATORY field on Deal creation in this org (create fails outright with
   `MANDATORY_NOT_FOUND` / api_name "Stage" if omitted). Fixed by creating with Stage =
   "Trip Requested" (a normal, valid starting value) and moving it to "Trip Completed" via a
   separate, explicit UPDATE call immediately after — which reliably fires the billing workflow
   as a genuine edit.
3. Date of Death not saving: the submitted date string was converted into a raw Deluge date
   object and embedded directly in the REST JSON payload; its default text form did not match
   what the API expects for a Date field, so it was silently dropped rather than erroring. Fixed
   by explicitly re-formatting to an ISO "yyyy-MM-dd" string before sending.
4. Sex not saving: the Sex value was used to build the "Unidentified..." display name but was
   never actually written onto the Deal's own Sex field. Fixed by mapping M/F to Male/Female
   (matching the Deal's Sex picklist) and adding it to the create payload.

Open item: Operations.Condition's picklist (`-None-`, `Good`, `Needs attention`) does not include
`Decomposed`, so a Decomposed value sent to that field will not be represented on the Operations
record, even though it is correctly written to the Deal's own Condition field (which does support
it, and is what billing reads). Recommend the client add `Decomposed` as a picklist value on
Operations.Condition — a value addition, not a new field, so it does not touch the stated field
limits.
