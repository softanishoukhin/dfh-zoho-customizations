Task ID: ZP-TBD-70 (placeholder — T-10, projectDocuments/task10.txt)
Zoho App: CRM
Module/Form: Deals — custom button ("Send Pre-Need Questionnaire")
Function Name: none live currently — the button is a Widget
(copyPreNeedQuestionnaireLinkWidget/, source copied next to this file), not a Deluge
function. sendPreNeedQuestionnaire.deluge and copyPreNeedQuestionnaireLink.js (the client
script) are both kept as reference/history only; see their own top-of-file notes for why each
was superseded.
Function Type: Deals custom button, Action Type = Widget
Trigger Source: staff clicking "Send Pre-Need Questionnaire" button on the Deal record page
Connection Name: none — the widget calls ZOHO.CRM.API directly in the browser
Related Fields: Pre_Need_Questionnaire_Status, Pre_Need_Date, Pre_Need_Questionnaire_Edit_URL
Related Modules: Deals (Standard__s layout / "PC" pipeline)
Created By: Claude Code, 2026-09-17
Last Updated By: Claude Code, 2026-09-18
Sandbox Tested: No — tested live
Production Deployed: Yes — confirmed working live 2026-09-18 (fresh send, resend-for-edit, and
one-click Copy all passed as part of the full 27-case test pass)

History of this button's implementation (each step confirmed live before moving to the next):
1. Deluge "Writing Function" action, ends with openUrl() -- worked, but opened a new tab
   instead of copying the link, which the user wanted changed.
2. Client Script action calling a converted Custom Function -- abandoned: Client Scripts run
   in a sandbox with NO DOM access at all ("document" is undefined), confirmed live via
   "TypeError: Cannot read properties of undefined (reading 'createElement')" on the very
   first test. Genuine clipboard access isn't reachable from that sandbox.
3. Widget action (current) -- a real iframe with full DOM/clipboard access, mirroring
   D:\Office\Andrea_Projects\DFH\widgets\copyPaymentLink\copyPaymentLinkWidget's own proven
   pattern. Does the URL-build-and-save logic directly via ZOHO.CRM.API (getRecord +
   updateRecord with Trigger:["workflow"]), not by calling any Deluge function.

Notes:

Companion piece to the Creator-side functions in
creator/forms/pre_need_questionnaire/ZP-TBD-70_pre_need_questionnaire_build/ — this is the
CRM-side half of the same task (the "launcher"), kept in crm/functions per the repo's app-based
top-level split rather than bundled with the Creator function files.

The perma-link token in sendPreNeedQuestionnaire.deluge was taken directly from the live page URL
the user published themselves (2026-09-17):
https://creatorapp.zohopublic.com/delapenhafuneralhome/pre-need-questionnaire/page-perma/Final_Wishes_Form1/zS4dtZBC7VwnvsJTumgwyfTbG89Sw2kXaKMjrnkt0pghN0V7ePR1u6JaRW3Cv8CsvRHbB0nRCyqHqCw741YfYh8wdZYtWrh540uA
Note the page link name is `Final_Wishes_Form1` (Creator auto-suffixed it), which differs from
the form's own link name `Final_Wishes_Form` (confirmed via ZohoCreator_getForms) -- the "1" only
matters for this URL, not for any Custom API or addRecords call, which all target the form name.

To create the button itself (Setup > Deals > Buttons > New Custom Button, placed on the Deal
detail page for the layout(s) Pre-Need uses): Action Type = "Writing Function", paste
sendPreNeedQuestionnaire.deluge as the function body.

Fixed bug (confirmed live, 2026-09-17): the function originally rebuilt
Pre_Need_Questionnaire_Edit_URL unconditionally on every click, discarding any &record_id= a
prior completion had appended -- so re-clicking to resend/edit an already-completed questionnaire
always reopened a blank form. Current version reads the Deal's existing edit URL first and
carries record_id forward if present, only resetting status/date on a genuinely first-time send.
