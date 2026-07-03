Task ID: ZP-TBD-2 (placeholder)
Zoho App: Creator
Module: NOK_Information_Form (NOKIntake app)
Function Name: n/a — inline event-script edits within the form, not standalone functions
Function Type: Workflow (on validate, on success)
Trigger Source: Form submit (on validate), on success actions gated by Deal_Type
Related Workflow Name: "Managing Mandatory Fields" (on validate), the Police-new-submission
"actions" block (~line 6827)
Related Button Name: n/a
Input Arguments: n/a (form fields: Deceased_Name, Deal_Type, Police_Office, Police_Office_Name)
Connection Name: n/a
Required Scopes: n/a
Related Fields: NOK_Information_Form.Deceased_Name, .Deal_Type, .Police_Office,
.Police_Office_Name, .Police_Phone_Number
Related Modules: Trips.Police_Station (destination field for Fix 2)
Created By: developer (original form), fixes by Claude Code 2026-07-03
Last Updated By: Claude Code
Sandbox Tested: No — DS files cannot be branched/tested the way standalone functions can;
changes were pasted directly into the live form after live-source verification
Production Deployed: Yes
Production Deployment Date: 2026-07-03
Notes:

This is the NOK Intake widget's server-side Creator form, not a Zoho CRM function — the
"function.deluge" convention doesn't map perfectly (this file holds excerpted event-block
diffs, not one self-contained function). Also see
`creator/functions/nok_intake/ZP-TBD-2_police_intake_fixes/widget-js-changes.md` for the
companion client-side (widget app.js) validation fix, which is JavaScript, not Deluge.
