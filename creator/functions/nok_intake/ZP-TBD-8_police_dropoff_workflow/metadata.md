Task ID: ZP-TBD-8 (placeholder)
Zoho App: Creator
Module/Form: NOK_Information_Form.ds — widgetLookup custom API function (action-routed)
Function Name: widgetLookup(action, value) — two new action branches: createPoliceDropoff,
getDropoffHangTagFile
Function Type: Creator custom API (public_key: yCEBn1Gf98BCsZxgPGQBrj7fJ, workspace:
delapenhafuneralhome)
Trigger Source: called directly from the Intake widget (app.js) via ZOHO.CREATOR.DATA.invokeCustomApi
Connection Name: none directly (bridges out to CRM via invokeurl + apikey auth, matching the
proven Driver App pattern for portal-context Writer/attachment access)
Related Fields: n/a — this is a thin bridge only
Related Modules: none directly — delegates to CRM functions (see crm/functions/deals/ZP-TBD-8_police_dropoff_workflow)
Created By: Claude Code, 2026-07-07
Last Updated By: Claude Code
Sandbox Tested: No — tested live
Production Deployed: Yes
Production Deployment Date: 2026-07-07

Notes:

Police Dropoff intentionally bypasses the NOK_Information_Form's normal submission path
(ZOHO.CREATOR.DATA.addRecords) entirely — no NOK_Information_Form record is ever created for a
drop-off case, so none of that form's existing per-Deal-Type on-success workflow logic is touched
or at risk. Instead, the widget calls these two new widgetLookup actions directly.

Both new actions are THIN BRIDGES only — they call the real CRM logic (createPoliceDropoffCase,
and the existing gethandtagfileapi1 for retrieval) over REST with API-key auth, exactly mirroring
the proven Driver App pattern (Generate_Hang_Tag -> regeneratehangtagapi, Get_Hang_Tag_File ->
gethandtagfileapi1) — because Writer/attachment operations don't reliably work from portal/widget
execution context and need to run in CRM admin/system context instead.

`getDropoffHangTagFile` does NOT need a new CRM function — `gethandtagfileapi1`
(standalone.getHandTagFileApi(tripId, opsId)) already supports an opsId-only mode ("MODE A" in its
own comments), used here by passing tripId empty and opsId set.

`<CRM_FUNCTIONS_ZAPIKEY>` in function.deluge is the same shared REST-execute key used throughout
this org for CRM Functions API-key auth — see shared/connection-notes/zoho_connections.md.
Real value lives only in the deployed Creator/CRM functions, never in this repo.
