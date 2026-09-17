Task ID: ZP-TBD-70 (placeholder — this is T-10 in Andrea's Pre-Need task series, projectDocuments/task10.txt)
Zoho App: Creator (`pre-need-questionnaire`) + CRM (Deals fields + new custom module) + a CRM
  Deals custom button.
Module/Form:
  - Creator: Form `Final_Wishes_Form`, Page `Final_Wishes_Form1` (perma-link/public, no login).
  - CRM: 7 new fields on Deals (Standard__s layout, "PC" pipeline).
  - CRM: new custom module `Pre_Need_Questionnaire` (flat fields, `Deal_Name` lookup to Deals,
    `Persons_Responsible` subform, `Signature` Image Upload) — added mid-build after the Creator
    form's own quirks (composite fields, subform rows, Signature field) made it the more reliable
    source of truth. Both stores are written on every submit; the CRM module drives edit/resume.
Function Name (all 5 live in the Creator app, as Custom APIs — source copied into functions/ next
  to this file):
  - getDeal(deal_id) — GET. Deal + Contact prefill lookup, returns Deal_Name and the Deal's edit URL.
  - getCreatorRecord(record_id) — GET. Reads a Final_Wishes_Form record. No longer used by the
    widget's boot flow (superseded by getQuestionnaireForDeal) but kept, still callable.
  - submitFinalWishes(deal_id, data, crm_record_id) — POST. Creates the Final_Wishes_Form record
    (native `insert into` syntax) AND upserts the Pre_Need_Questionnaire CRM record (create or
    update depending on whether crm_record_id was passed in).
  - completePreNeedQuestionnaire(deal_id, record_id, signature_data, crm_record_id) — POST. Deal
    status -> Completed + date + resumable edit URL, and uploads the signature onto BOTH the
    Deal's Pre_Need_Signature and the CRM module's own Signature field.
  - getQuestionnaireForDeal(deal_id) — GET. COQL-looks-up the CRM module record for this Deal;
    this is now the PRIMARY prefill/resume source, including redrawing a previously-captured
    signature onto the canvas.
Function Type: Creator Custom API, same trigger style as NOKIntake's getPrefillAndUser/upsertDeal.
Trigger Source: Final_Wishes_Form widget (app.js, copied into widget/ next to this file), called
  via ZOHO.CREATOR.DATA.invokeCustomApi (GET calls) and .invokeCustomApi with a JSON payload (POST
  calls, submitFinalWishes/completePreNeedQuestionnaire — a large payload including a base64
  signature image would blow past a query-string GET's URL-length limit).
Connection Name:
  - zohocrm_connection — regular record CRUD (Deal/CRM-module GET/PUT, COQL lookups).
  - zoho_oauth_connection — file processing specifically (ZFS uploads for the signature, and the
    download_fields_attachment fetch used to redraw an existing signature on resume). Per the
    user's explicit instruction; zohocrm_connection's scope wasn't sufficient for these.
Related Fields (Deals, Standard__s layout): Pre_Need_Questionnaire_Status (picklist), 
  Pre_Need_Questionnaire_Edit_URL (website), Pre_Need_Specialist (text), Pre_Need_Date (date),
  Pre_Need_Date_Completed (date), Pre_Need_Signature (image upload), Pre_Need_Payer_Or_Beneficiary
  (picklist).
Related Modules: Deals (Standard__s / "PC" pipeline), Contacts (prefill lookup), new custom module
  Pre_Need_Questionnaire.
Created By: Claude Code, 2026-09-17
Last Updated By: Claude Code, 2026-09-17
Sandbox Tested: No — tested live in production
Production Deployed: Yes — confirmed working end-to-end by the user (2026-09-17): submit, edit/
  resume with correct prefill including the signature redrawing onto the canvas, no duplicate CRM
  records on resubmit, mobile view, no-login access, and the CRM launcher button's fresh-send flow.

Notes:

This went through three architecture revisions during the build (v1: Creator form only, mistakenly
modeled on "Request NOK Information" instead of NOKIntake itself; v2: corrected to NOKIntake's own
pattern, still Creator-form-only; v3/final: added the parallel CRM module after repeated Creator-
side friction). See guideline.md for the full as-built writeup and every confirmed gotcha
(composite-field dot-notation, subform row-constructor syntax, the Signature field type's outright
rejection of programmatic writes, ZFS's two-step file-attach mechanism, single-attachment-per-
upload tokens, and the Image-Upload-field-holds-multiple-images delete-then-reupload requirement).

Field-limit risk that was flagged early (Deals at 302 custom fields) did not block this build — all
7 new Deal fields were created successfully.
