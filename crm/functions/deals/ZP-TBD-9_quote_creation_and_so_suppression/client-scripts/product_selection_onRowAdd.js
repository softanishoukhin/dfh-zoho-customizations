/**
 * REVERTED 2026-08-10 -- do not add the quote-prompt logic here.
 *
 * onRowAdd fires when "Add Row" is clicked, BEFORE the user has picked a
 * product or entered quantity/price -- row_data at that point is empty. The
 * confirm-and-suppress logic needs real field data, so it belongs on
 * beforeRowUpdate instead (which fires right before the row's data actually
 * saves) -- see product_selection_beforeRowUpdate.js.
 *
 * This event should be left exactly as it was before this feature touched
 * it: just the existing Trigger_Based_On_Subform stamp. On the
 * Funeral_w_Burial layout specifically, this event also still has some
 * commented-out sample lines (openMailer/showConfirmation boilerplate from
 * the Kaizen article) left over from early experimentation -- delete those
 * when reverting; they were never active logic.
 */

// [Standard PC/HP layout only -- unrelated, unchanged]
// mandatoryError = PrimaryAndSecondaryMandatory(row_data, index);
// if ( mandatoryError == false ) {
//     return false;
// }

var time = ZDK.Apps.CRM.Functions.execute("getcurrentdatetime", { "fieldAPIName": "Trigger_Based_On_Subform", "crmid": $Page.record_id, "module": "Deals", "minutes": 1 });
