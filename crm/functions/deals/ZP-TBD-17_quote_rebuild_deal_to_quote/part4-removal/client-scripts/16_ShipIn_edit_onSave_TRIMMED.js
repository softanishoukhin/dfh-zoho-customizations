// Unchanged -- existing "Update Subform Trigger Time" logic. Unlike its
// Cremation/Funeral/Standard Edit-page siblings, this script never had a
// casket-color validation block -- the quote comment block used to start
// right at the top of the file, and this stamp was the trailing line after
// it. All quote-sync logic that used to run before this line has been
// removed (ZP-TBD-17) -- billing now runs unconditionally, the same as any
// Deal that never used the Quote flow.
var time = ZDK.Apps.CRM.Functions.execute("getcurrentdatetime", { "fieldAPIName": "Trigger_Based_On_Subform", "crmid": $Page.record_id, "module": "Deals", "minutes":1 });