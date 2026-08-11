/**
 * Client Script -- Deals module, Product_Selection subform, beforeRowDelete
 * event. Applies to all 4 Deals layouts: Standard (PC, HP),
 * Cremation_with_Service, Funeral_w_Burial, Ship_In_Layout.
 *
 * Before this: deleting a product did NOT touch the Quote at all --
 * beforeRowDelete only stamped Trigger_Based_On_Subform. A deleted product
 * would sit stale on the Quote until some LATER add/edit on the same Deal
 * happened to trigger the sync branch in product_selection_beforeRowUpdate.js
 * -- and if the deleted row was the LAST product, even that wouldn't help,
 * since there'd be no future subform event left to trigger a correction, and
 * the old sync path just bailed on an empty product list without clearing
 * anything.
 *
 * beforeRowDelete is a pre-commit hook (fires before the row is actually
 * removed server-side), so a fresh zoho.crm.getRecordById read at this point
 * would still see the row about to be deleted -- same problem as
 * beforeRowUpdate racing its own save, just in reverse. To get the correct
 * post-deletion state, read the CLIENT-SIDE current subform via
 * ZDK.Page.getField('Product_Selection').getValue() (same API already
 * proven in the onSave scripts) and exclude the row at `index` ourselves,
 * rather than trusting a server round-trip.
 *
 * NOT YET VERIFIED LIVE: whether ZDK.Page.getField(...) works the same way
 * on the module_detail page as it does on module_create/module_edit (where
 * it's already proven). Confirm with a quick console.log before trusting
 * this in production.
 *
 * Both cases now get precise, immediate handling: deleting down to zero
 * products uses forceEmpty="true" (clears the Quote's line items exactly);
 * deleting one row out of several passes deletedRowIndex so
 * createOrUpdateQuoteFromDeal can exclude that exact entry from its
 * server-read list, instead of the earlier "one step behind, catches up on
 * next touch" fallback (found insufficient live 2026-08-10 -- the deleted
 * product was staying on the Quote with no further subform event guaranteed
 * to ever correct it). This still avoids the JSON-blob 400 Bad Request
 * problem found earlier -- only a single index is passed, not row data.
 */

alreadyInQuoteFlow = ZDK.Apps.CRM.Functions.execute("isQuoteAwaitingAcceptance", { "crmid": $Page.record_id });
alreadyInQuoteFlowResult = alreadyInQuoteFlow._details.output;
if (alreadyInQuoteFlowResult == "true") {
    var currentSubform = ZDK.Page.getField('Product_Selection').getValue();
    var remainingCount = 0;
    if (currentSubform) {
        for (var i = 0; i < currentSubform.length; i++) {
            if (i !== index) {
                remainingCount++;
            }
        }
    }
    if (remainingCount === 0) {
        // This is the row being deleted right now -- nothing will be left
        // on the subform once it's gone. Tell the function directly rather
        // than let it read Product_Selection (which would still show this
        // row, since it isn't actually removed server-side yet).
        ZDK.Apps.CRM.Functions.execute("createOrUpdateQuoteFromDeal", { "dealId": $Page.record_id, "firstRowProductId": "", "firstRowQuantity": "", "firstRowUnitPrice": "", "firstRowDiscount": "", "forceEmpty": "true", "editedRowIndex": "", "editedRowProductId": "", "editedRowQuantity": "", "editedRowUnitPrice": "", "editedRowDiscount": "", "deletedRowIndex": "" });
    } else {
        // Other products remain -- tell the function exactly which index is
        // being removed so it can exclude that entry from the server-read
        // list itself, instead of trusting the server's copy (which still
        // includes this row, since it isn't removed server-side yet).
        ZDK.Apps.CRM.Functions.execute("createOrUpdateQuoteFromDeal", { "dealId": $Page.record_id, "firstRowProductId": "", "firstRowQuantity": "", "firstRowUnitPrice": "", "firstRowDiscount": "", "forceEmpty": "", "editedRowIndex": "", "editedRowProductId": "", "editedRowQuantity": "", "editedRowUnitPrice": "", "editedRowDiscount": "", "deletedRowIndex": index.toString() });
    }
}

// Unchanged -- existing "Update Subform Trigger Time" logic, runs regardless
// of the above.
var time = ZDK.Apps.CRM.Functions.execute("getcurrentdatetime", { "fieldAPIName": "Trigger_Based_On_Subform", "crmid": $Page.record_id, "module": "Deals", "minutes": 1 });
