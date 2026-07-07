# Deployment Checklist — ZP-TBD-8 (Creator/widget side)

- [x] Apply the two new action branches in `function.deluge` to the live `widgetLookup` function inside `NOK_Information_Form.ds`, inserted before the final `else { res.put("error","unknown action"); }`.
- [x] Paste the real `<CRM_FUNCTIONS_ZAPIKEY>` value into both branches on deploy (capture from CRM → Functions → REST API tab for `createpolicedropoffcase`; the `gethandtagfileapi1` key is already deployed and reused, matching the Driver App pattern).
- [x] Update `NOKIntake/app/widget.html` and `NOKIntake/app/app.js` per `widget-js-changes.md`.
- [x] Repack `dist/NOKIntake.zip` with the updated widget files and upload to the live Creator widget.
- [x] Confirm all 4 CRM-side functions exist and are deployed (see crm/functions/deals/ZP-TBD-8_police_dropoff_workflow/deployment-checklist.md).
- [ ] Run full test suite (DFH_Police_Dropoff_Test_Cases.xlsx) end to end — pending as of 2026-07-07.
- [ ] Rename this folder / update Task ID once a real Zoho Projects ticket number is assigned.
