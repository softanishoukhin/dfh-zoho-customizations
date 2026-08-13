/**
 * log("sample logging statement") --> can be used to print any data in the browser console.
 * ZDK module can be used for customising the UI and other functionalities.
 * return false to prevent <SAVE> action
**/
mandatoryError = PrimaryAndSecondaryMandatory(row_data, index);
if ( mandatoryError == false ) {
    return false;
}

// Unchanged -- existing "Update Subform Trigger Time" logic, runs regardless
// of the above. Stamps Trigger_Based_On_Subform = now + 1 minute, which is
// what the "Create or Update Sales Order from Deals V2" workflow watches.
var time = ZDK.Apps.CRM.Functions.execute("getcurrentdatetime", { "fieldAPIName": "Trigger_Based_On_Subform", "crmid": $Page.record_id, "module": "Deals", "minutes": 1 });