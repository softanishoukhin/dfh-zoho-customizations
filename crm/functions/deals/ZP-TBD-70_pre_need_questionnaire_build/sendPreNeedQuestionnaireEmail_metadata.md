Task ID: ZP-TBD-70 (T-10) — "Send Questionnaire by Email" button, added 2026-09-22
Zoho App: CRM
Function Name: sendPreNeedQuestionnaireEmail(String dealId) — standalone Custom Function
Function Type: Setup > Automation > Functions > Custom Functions (button body is a thin
wrapper, see sendPreNeedQuestionnaireEmail_buttonBody.deluge)
Trigger Source: staff clicking "Send Questionnaire by Email" custom button on a Pre-Need Deal
Connection Name: zohocrm_connection (Deal/Contact reads + Deal update), zoho_oauth_connection
(template fetch + send_mail action, matching the file-processing connection split already
established for this task)
Related Fields: Pre_Need_Questionnaire_Status, Pre_Need_Date, Pre_Need_Questionnaire_Edit_URL
(all pre-existing, reused unchanged)
Related Modules: Deals (Standard__s / "PC" pipeline), Contacts (recipient email lookup)
Created By: Claude Code, 2026-09-22
Production Deployed: No — not yet created in Setup, template not yet duplicated

Notes:

Origin template: "We Are Here to Help DFH for Pre Need" (id 6503357000020253003) -- confirmed
live and already wired to a DIFFERENT flow (consultation booking; the Deal field
We_are_Here_to_Help_Email_Sent confirms this), so it must be DUPLICATED, not modified in place.
The original's greeting/button use real Zoho merge tags (${!Deals.Contact_Name.First_Name},
${!Deals.id}), unlike Headstone_Request.ds's own email-sending code (sendEmailToVendor /
sendPlotNumberAssignedEmail) which hand-hacks arbitrary placeholder tokens into a template with
no real merge fields and does its own .replaceAll() -- that pattern isn't needed here since real
merge tags resolve automatically when the content is sent as-is.

Steps to duplicate the template (CRM Setup > Templates > Email Templates > find "We Are Here to
Help DFH for Pre Need" > Duplicate / Save As):
1. Rename the copy, e.g. "Pre-Need Final Wishes Questionnaire".
2. Change the Subject line, e.g. "Your Pre-Need Final Wishes Questionnaire".
3. Body text: replace "Book Pre Need Consultation." with wording appropriate to the
   questionnaire (e.g. "Please complete your Pre-Need Final Wishes Questionnaire using the
   link below.").
4. The button: change its label from "Schedule Now" to something like "Complete Questionnaire",
   and change BOTH href attributes (the template's button markup has the link twice -- an
   outer table-wrapping <a> and an inner text <a>, both currently pointing at the
   redirect-booking-page URL with ?crmid=${!Deals.id}) to:
   ${!Deals.Pre_Need_Questionnaire_Edit_URL}
5. Save, then open it again and copy the templateId out of the edit URL (same place the
   original template's id came from: .../templates?type=email&step=edit&templateId=<id>).
6. Paste that id into sendPreNeedQuestionnaireEmail.deluge's EMAIL_TEMPLATE_ID placeholder.

Setup steps beyond the template:
1. Create the standalone Custom Function sendPreNeedQuestionnaireEmail, paste
   sendPreNeedQuestionnaireEmail.deluge (after filling in the real template id).
2. Create the Deals custom button "Send Questionnaire by Email" (Action Type = Writing
   Function), paste sendPreNeedQuestionnaireEmail_buttonBody.deluge.

UNVERIFIED, flag before trusting live:
- Whether crm/v8/{module}/{id}/actions/send_mail actually auto-resolves ${!...} merge tags
  when the template's raw HTML content is passed through unmodified in the "content" field of
  the request (rather than referencing the template by id in the send call itself, which this
  code does NOT do). Headstone_Request.ds's own proven pattern passes revised HTML content this
  same way, but its merge tags are hand-hacked placeholders, not genuine ${!...} Zoho merge
  syntax, so that isn't direct confirmation this specific mechanism resolves real merge tags.
  If the sent email shows a literal "${!Deals.Contact_Name.First_Name}" or a dead link instead
  of the real name/URL, that's the exact symptom to look for.
- zoho.adminuserid as the "from" email in this REST payload shape -- Headstone's own code
  instead fetches a specific org variable for its "from" address; untested whether
  zoho.adminuserid resolves to a deliverable value in this exact context.
