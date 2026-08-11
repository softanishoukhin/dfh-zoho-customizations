/**
 * Client Script -- Deals module, PAGE-LEVEL onSave event (type: page, no
 * subform resource), on the existing "Update Subform Trigger Time" script
 * that already lives on all 8 module_create / module_edit pages (4 layouts x
 * 2). This is a DIFFERENT event than product_selection_beforeRowUpdate.js
 * (which only covers the module_detail page's inline subform editing) --
 * without this, a Deal created via the full Create form, or edited via the
 * full Edit form, with products already in Product_Selection, would bypass
 * the suppression fix entirely. Confirmed live 2026-08-10: these onSave
 * scripts already stamp Trigger_Based_On_Subform via getcurrentdatetime
 * (same now+1min buffer), so the same race existed here too, just unguarded.
 *
 * Unlike beforeRowUpdate, onSave fires once per full-page Save click and
 * gives the WHOLE current Product_Selection subform state via
 * ZDK.Page.getField('Product_Selection').getValue() -- not one row at a
 * time. KNOWN LIMITATION: if someone fills in more than one product before
 * ever clicking Save for the first time, only subform_data[0] is captured
 * into the initial Quote (same 4-scalar pattern as beforeRowUpdate, to avoid
 * the JSON-blob 400 Bad Request found earlier). Rows 2+ will appear on the
 * Quote the next time Product_Selection is touched (e.g. later on the detail
 * page), which re-syncs the full list from the server. This does NOT affect
 * the suppression guarantee itself -- Awaiting_Quote_Acceptance is still set
 * before Trigger_Based_On_Subform regardless of how many rows are captured.
 *
 * NOT YET VERIFIED LIVE: whether $Page.record_id resolves to a real ID
 * during the module_create page's onSave (a brand-new Deal has no ID until
 * it's actually saved). The existing getcurrentdatetime call already relies
 * on this same assumption and is live in production, so this isn't new risk
 * -- but confirm with a console.log($Page.record_id) on one test Create
 * before trusting it, same as the row_data-shape check done for
 * beforeRowUpdate.
 *
 * Insert this block AFTER the existing subform_data collection loop already
 * in each of these 8 scripts (unchanged, left exactly as-is), and BEFORE the
 * final getcurrentdatetime line (also unchanged).
 *
 * IMPORTANT: ZDK.Apps.CRM.Functions.execute(...) does NOT return the
 * function's return string directly -- it returns a result object, and the
 * actual string is at result._details.output. Confirmed live 2026-08-10.
 * Every comparison against "true"/"false" below reads that property, not the
 * raw execute() return value.
 */

if (subform_data.length > 0) {
    alreadyPrompted = ZDK.Apps.CRM.Functions.execute("hasQuotePromptBeenShown", { "crmid": $Page.record_id });
    alreadyPromptedResult = alreadyPrompted._details.output;
    if (alreadyPromptedResult != "true") {
        // First time this Deal is being saved with at least one product --
        // mark it asked FIRST, then ask once.
        ZDK.Apps.CRM.Functions.execute("markQuotePromptShown", { "crmid": $Page.record_id });
        var isProceed = ZDK.Client.showConfirmation('Do you want to create a quote for this deal?', 'Yes', 'No');
        if (isProceed) {
            var firstRow = subform_data[0];
            var productId = "";
            var productQty = "";
            var productPrice = "";
            var productDiscount = "";
            if (firstRow && firstRow.Child_Product) {
                productId = firstRow.Child_Product.id;
                productQty = firstRow.Quantity;
                productPrice = firstRow.Unit_Price;
                productDiscount = firstRow.Discount;
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
        // If "No": do nothing. Awaiting_Quote_Acceptance stays false,
        // Trigger_Based_On_Subform below stamps normally. Quote_Prompt_Shown
        // is already set true above, so this Deal is never asked again on
        // any future save.
    }
    // No "else" branch -- ongoing sync for already-asked Deals is no longer
    // attempted from onSave at all (see REMOVED note below). Falls through
    // to just the getcurrentdatetime stamp either way.
}

/**
 * REMOVED 2026-08-10 (twice, different reasons):
 * 1st removal -- an early version called the FULL createOrUpdateQuoteFromDeal
 * pipeline (PDF regenerate + WorkDrive re-upload + duplicate email) here on
 * every single Edit-page save, which broke the post-save redirect.
 * 2nd removal (this one) -- replaced that with a cheap syncQuoteLineItemsOnly
 * call instead, encoding the live subform_data as a delimited string. Worked,
 * but turned out unnecessary: the same sync is now called from inside the 4
 * SO-creation automation functions themselves (createSalesOrderFor...,
 * guarded by isQuoteAwaitingAcceptance), which the existing workflow rule
 * already calls ~1 minute after Trigger_Based_On_Subform changes -- and that
 * field gets stamped from every page (detail, create, edit) whenever
 * Product_Selection changes, via the unconditional getcurrentdatetime call
 * below. That server-side sync reads Product_Selection directly (guaranteed
 * persisted by then, no client-passed data needed at all) and is strictly
 * simpler and more reliable than anything client-script-side could do here.
 * onSave's only remaining job is the one-time first prompt/Quote-creation.
 */
