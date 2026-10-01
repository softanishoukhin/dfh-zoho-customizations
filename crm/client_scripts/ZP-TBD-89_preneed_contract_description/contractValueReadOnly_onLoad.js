/**
 * ZP-TBD-88 -- Contract Value is read-only.
 * ZP-TBD-89 -- Pre-Need Contract Description (the contract's items list) is read-only too.
 * Deals, layout "PC, HP" (the Pre Need layout) -- the existing "contractValueReadOnly" page onLoad script on the
 * Create, Edit and Detail pages: replace its body with this.
 *
 * Both fields are always built from the Product Selection lines by standalone.recalcPreNeedContractValue on every
 * save. Anything typed by hand would be overwritten, so staff must not be able to type in them. Done here, not with
 * field permissions: a read-only field permission would also stop the function from writing the fields.
 * One try per field, so a field type that doesn't support setReadOnly can't stop the other one.
 **/
try {
    var contractValueField = ZDK.Page.getField('Contract_Value');
    if (contractValueField) {
        contractValueField.setReadOnly(true);
    }
} catch (e) {
    log('ZP-TBD-88: could not make Contract_Value read-only: ' + e);
}
try {
    var contractDescriptionField = ZDK.Page.getField('Pre_Need_Contract_Description');
    if (contractDescriptionField) {
        contractDescriptionField.setReadOnly(true);
    }
} catch (e) {
    log('ZP-TBD-89: could not make Pre_Need_Contract_Description read-only: ' + e);
}
