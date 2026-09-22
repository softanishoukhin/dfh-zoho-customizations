Task ID: ZP-TBD-70 (T-10) — CRM-sync failure notification/retry, added 2026-09-22 after Andrea
flagged that a failed CRM sync looked identical to a successful submission.
Zoho App: CRM
Function Name: retryPreNeedCrmSync(String dealId) — standalone Custom Function
Function Type: Setup > Automation > Functions > Custom Functions (NOT the button's own inline
editor — see retryPreNeedCrmSync_buttonBody.deluge for that thin wrapper)
Trigger Source: staff clicking "Retry CRM Sync" custom button on a Deal flagged
Pre_Need_CRM_Sync_Status = "Failed"
Connection Name: pre_need_creator_connection (Creator READ scope, for zoho.creator.getRecords --
placeholder name, verify/create before use) + zoho_oauth_connection (COQL lookup, same as
getQuestionnaireForDeal.dg) + zohocrm_connection is NOT used here directly (zoho.crm.* builtins
used instead)
Related Fields (Deals): Pre_Need_CRM_Sync_Status (new, Picklist: -None-/Failed),
Pre_Need_CRM_Sync_Error (new, Multi-line text)
Related Modules: Deals, the new custom module Pre_Need_Questionnaire, Creator app
pre-need-questionnaire (report All_Final_Wishes)
Created By: Claude Code, 2026-09-22
Production Deployed: No — not yet created in Setup

Notes:

Companion to submitFinalWishes.dg's own new retry block (in
creator/forms/pre_need_questionnaire/ZP-TBD-70_pre_need_questionnaire_build/functions/) -- that
file retries the CRM write 3x at submit time and, only if still failing, flags the Deal +
emails info@dfhja.com (per the user's explicit choice over a background Schedule -- a staff-visible
flag + manual retry was preferred for this low-volume feature). This function is the manual retry
path staff use once the underlying issue (e.g. a brief CRM API outage) has cleared.

Setup steps required (none of this exists yet):
1. Add 2 new fields to Deals (same layout the other Pre-Need fields are on, Standard__s / "PC"
   pipeline): Pre_Need_CRM_Sync_Status (Picklist: -None-, Failed) and Pre_Need_CRM_Sync_Error
   (Multi-line text).
2. Create/verify a connection with Creator READ scope, named pre_need_creator_connection (or
   substitute the real name in both submitFinalWishes.dg's retry block -- no, that file doesn't
   need this connection, only retryPreNeedCrmSync.deluge does, since only the retry path reads
   back from Final_Wishes_Form).
3. Create the standalone Custom Function retryPreNeedCrmSync (Setup > Automation > Functions),
   paste retryPreNeedCrmSync.deluge.
4. Create the Deals custom button "Retry CRM Sync" (Action Type = Writing Function), paste
   retryPreNeedCrmSync_buttonBody.deluge.
5. Re-paste the updated submitFinalWishes.dg (with the new retry/flag/email block) into its
   existing Custom API editor in the pre-need-questionnaire Creator app.

UNVERIFIED, flag before trusting live:
- standalone.retryPreNeedCrmSync(deal.id) call shape from the button body -- per
  [[feedback_deluge_automation_vs_standalone_calls]] the standalone. prefix is this org's
  established convention for cross-calling a Custom Function, but this specific function has
  never actually been created/tested yet.
- sendmail's from: address (zoho.adminuserid) -- the safest documented option, but never
  exercised live in this codebase before; if it fails, check whether Zoho CRM's own sendmail
  rules (noted as more permissive than other services in Zoho's docs) require something else.
