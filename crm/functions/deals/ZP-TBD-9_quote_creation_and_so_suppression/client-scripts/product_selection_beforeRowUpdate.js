/**
 * Client Script -- Deals module, Product_Selection subform, beforeRowUpdate
 * event (NOT onRowAdd -- see note in product_selection_onRowAdd.js for why
 * that was wrong). Applies to all 4 Deals layouts: Standard (PC, HP),
 * Cremation_with_Service, Funeral_w_Burial, Ship_In_Layout.
 *
 * beforeRowUpdate fires right before a row's field data (product, quantity,
 * etc.) is actually saved -- onRowAdd fires when "Add Row" is clicked, before
 * the user has picked anything, so row_data there would be empty.
 *
 * Whether the confirm dialog has already been shown for this Deal is tracked
 * as its own System_Data flag (Quote_Prompt_Shown), independent of row index
 * -- NOT index==0. Editing an already-saved first row later also fires
 * beforeRowUpdate for index 0, and index alone can't distinguish "this row's
 * first save" from "editing it again next week" -- the flag can.
 *
 * NOTE: On the Standard (PC, HP) layout, keep the existing
 * PrimaryAndSecondaryMandatory(row_data, index) guard ABOVE this block,
 * unchanged -- it's unrelated layout-specific validation, already present in
 * that layout's beforeRowUpdate "Update Subform Trigger Time" script.
 *
 * IMPORTANT: ZDK.Apps.CRM.Functions.execute(...) does NOT return the
 * function's return string directly -- it returns a result object, and the
 * actual string is at result._details.output. Confirmed live 2026-08-10.
 * Every comparison against "true"/"false" below reads that property, not the
 * raw execute() return value.
 */

alreadyPrompted = ZDK.Apps.CRM.Functions.execute("hasQuotePromptBeenShown", { "crmid": $Page.record_id });
alreadyPromptedResult = alreadyPrompted._details.output;
if (alreadyPromptedResult != "true") {
    // First time this Deal has ever had a product row saved -- mark it asked
    // FIRST (so a page refresh or double-fire mid-dialog can't cause a second
    // prompt), then ask once.
    ZDK.Apps.CRM.Functions.execute("markQuotePromptShown", { "crmid": $Page.record_id });
    var isProceed = ZDK.Client.showConfirmation('Do you want to create a quote for this deal?', 'Yes', 'No');
    if (isProceed) {
        // Pass the row's own scalar fields, not a JSON blob -- ZDK sends
        // function args as URL query params even on a POST call, and a raw
        // JSON object with {, }, :, , in it 400's. Flat short values avoid
        // that. Sets Awaiting_Quote_Acceptance=true as the very first line
        // inside this call (see createOrUpdateQuoteFromDeal.deluge),
        // builds/updates the Quote from these scalars directly (not a fresh
        // server read -- this row may not be persisted yet), generates the
        // PDF, uploads it, and emails the link. Blocks until done, so the
        // getcurrentdatetime call below only runs after this is resolved.
        var productId = "";
        var productQty = "";
        var productPrice = "";
        var productDiscount = "";
        if (row_data && row_data.Child_Product) {
            productId = row_data.Child_Product.id;
            productQty = row_data.Quantity;
            productPrice = row_data.Unit_Price;
            productDiscount = row_data.Discount;
        }
        ZDK.Apps.CRM.Functions.execute("createOrUpdateQuoteFromDeal", {
            "dealId": $Page.record_id,
            "firstRowProductId": productId,
            "firstRowQuantity": productQty,
            "firstRowUnitPrice": productPrice,
            "firstRowDiscount": productDiscount,
            "forceEmpty": "",
            "editedRowIndex": "",
            "editedRowProductId": "",
            "editedRowQuantity": "",
            "editedRowUnitPrice": "",
            "editedRowDiscount": "",
            "deletedRowIndex": ""
        });
    }
    // If Cancel: do nothing. Awaiting_Quote_Acceptance stays false, and
    // Trigger_Based_On_Subform below stamps normally -- same behavior as any
    // Deal that has never used the Quote flow. Quote_Prompt_Shown is still
    // set true above, so this Deal is never asked again.
} else {
    // Already asked (this row or an earlier one) -- don't re-prompt, but if
    // this Deal already opted into the Quote flow, keep the Quote's line
    // items in sync with whatever row just changed.
    alreadyInQuoteFlow = ZDK.Apps.CRM.Functions.execute("isQuoteAwaitingAcceptance", { "crmid": $Page.record_id });
    alreadyInQuoteFlowResult = alreadyInQuoteFlow._details.output;
    if (alreadyInQuoteFlowResult == "true") {
        // Pass this row's fresh values (and its index) so the function can
        // patch them into the server-read list instead of trusting the
        // server's stale copy of the row that's mid-save right now -- this
        // is what was causing edited Quantity/Discount not to show up on
        // the Quote (beforeRowUpdate is pre-commit, so a fresh server read
        // of Product_Selection still has the OLD value for this row).
        var editedProductId = "";
        var editedQty = "";
        var editedPrice = "";
        var editedDiscount = "";
        if (row_data && row_data.Child_Product) {
            editedProductId = row_data.Child_Product.id;
            editedQty = row_data.Quantity;
            editedPrice = row_data.Unit_Price;
            editedDiscount = row_data.Discount;
        }
        ZDK.Apps.CRM.Functions.execute("createOrUpdateQuoteFromDeal", {
            "dealId": $Page.record_id,
            "firstRowProductId": "",
            "firstRowQuantity": "",
            "firstRowUnitPrice": "",
            "firstRowDiscount": "",
            "forceEmpty": "",
            "editedRowIndex": index.toString(),
            "editedRowProductId": editedProductId,
            "editedRowQuantity": editedQty,
            "editedRowUnitPrice": editedPrice,
            "editedRowDiscount": editedDiscount,
            "deletedRowIndex": ""
        });
    }
}

// Unchanged -- existing "Update Subform Trigger Time" logic, runs regardless
// of the above. Stamps Trigger_Based_On_Subform = now + 1 minute, which is
// what the "Create or Update Sales Order from Deals V2" workflow watches.
var time = ZDK.Apps.CRM.Functions.execute("getcurrentdatetime", { "fieldAPIName": "Trigger_Based_On_Subform", "crmid": $Page.record_id, "module": "Deals", "minutes": 1 });
