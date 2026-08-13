// Unchanged -- existing "Update Subform Trigger Time" logic. All quote-sync
// logic that used to run before this line has been removed (ZP-TBD-17) --
// billing now runs unconditionally, the same as any Deal that never used
// the Quote flow.
var time = ZDK.Apps.CRM.Functions.execute("getcurrentdatetime", { "fieldAPIName": "Trigger_Based_On_Subform", "crmid": $Page.record_id, "module": "Deals", "minutes": 1 });