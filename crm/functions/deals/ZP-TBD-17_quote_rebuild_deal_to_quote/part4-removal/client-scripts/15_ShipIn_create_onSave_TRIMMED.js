/**
 * KNOWN PRE-EXISTING GAP (found live 2026-08-13, NOT introduced by this
 * change, NOT fixed by this change -- see metadata.md "Ship-In Create-page
 * billing-stamp gap"). Every sibling script in this same family (Standard,
 * Cremation, Funeral create-page onSave; this script's own Edit-page
 * counterpart) ends with a var time = ZDK.Apps.CRM.Functions.execute(
 * "getcurrentdatetime", ...) call that stamps Trigger_Based_On_Subform. THIS
 * script never had one -- confirmed by reading the live file directly, twice,
 * before this change. That means a Ship-In Deal created via the full Create
 * form, with products already filled in before the first Save, does not get
 * its Sales Order/Invoice pipeline triggered from this page at all.
 *
 * Per instruction: this pass only removes the quote/popup logic that used to
 * sit below the loop below. It does NOT add the missing stamp -- that would
 * be a substantive fix beyond "remove the quote parts," and was flagged back
 * rather than decided unilaterally. If this gap should be closed, it needs
 * its own explicit sign-off and is a one-line addition once approved:
 *   var time = ZDK.Apps.CRM.Functions.execute("getcurrentdatetime", { "fieldAPIName": "Trigger_Based_On_Subform", "crmid": $Page.record_id, "module": "Deals", "minutes":1 });
 * placed after the loop below, matching every sibling script's pattern.
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