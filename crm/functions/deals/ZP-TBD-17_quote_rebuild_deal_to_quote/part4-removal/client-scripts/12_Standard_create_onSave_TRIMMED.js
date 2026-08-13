/**
 * log("sample logging statement") --> can be used to print any data in the browser console.
 * ZDK module can be used for customising the UI and other functionalities.
 * return false to prevent <SAVE> action
**/
var subform_data = ZDK.Page.getField('Product_Selection').getValue();
var sum = 0;
if (subform_data.length > 0) {
for (var i = 0; i < subform_data.length; i++)
{
    var parentProductID = subform_data[i].Parent_Product.id;
    var primaryColorFieldValue = subform_data[i].Casket_Color;
    var secondaryColorFieldValue = subform_data[i].Casket_Secondary_Color;
    // if (parentProductID == "6503357000001251079" && (primaryColorFieldValue == null || secondaryColorFieldValue == null)) {
    //     ZDK.Client.showAlert(`Primary and Secondary Color is Required for Casket Product.`);
    //     return false;
    // }
}
}
// Unchanged -- existing "Update Subform Trigger Time" logic. All quote-sync
// logic that used to run between the loop above and this line has been
// removed (ZP-TBD-17) -- billing now runs unconditionally on every save with
// at least one product, same as any Deal that never used the Quote flow.
var time = ZDK.Apps.CRM.Functions.execute("getcurrentdatetime", { "fieldAPIName": "Trigger_Based_On_Subform", "crmid": $Page.record_id, "module": "Deals", "minutes":1 });