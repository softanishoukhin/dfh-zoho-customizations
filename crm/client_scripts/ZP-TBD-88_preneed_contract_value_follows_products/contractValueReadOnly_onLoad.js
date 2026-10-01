/**
 * ZP-TBD-88 -- Contract Value is read-only.
 * Deals, layout "PC, HP" (the Pre Need layout) -- add as a page onLoad script on BOTH the Create page and the
 * Edit page (and the Detail page, see guideline.md).
 *
 * Contract Value is always the total of the Product Selection lines, recalculated by
 * standalone.recalcPreNeedContractValue on every save. A figure typed by hand would be overwritten, so staff
 * must not be able to type one. Done here, not with field permissions: a read-only field permission would also
 * stop the function from writing the field.
 **/
try {
    var contractValueField = ZDK.Page.getField('Contract_Value');
    if (contractValueField) {
        contractValueField.setReadOnly(true);
    }
} catch (e) {
    log('ZP-TBD-88: could not make Contract_Value read-only: ' + e);
}
