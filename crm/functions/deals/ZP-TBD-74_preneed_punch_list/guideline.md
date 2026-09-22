# ZP-TBD-74 -- F1: stop the Pre-Need welcome email

**Status: guideline only, not yet applied.** No CRM function-code write API is available to this
session, so this change must be pasted into the CRM function editor by hand (same as any other
Deluge function edit).

## What's wrong

`automation.populateCRMID` (fires from the active Deals workflow "Populate CRM ID in Deals Modules",
`create` trigger) unconditionally sends email template `6503357000020253003`
("We Are Here to Help DFH for Pre Need") whenever the new Deal's `Type` is `"Pre Need"`. Andrea wants
this stopped, but the workflow itself must stay active -- it also creates the Booking_User_ID link,
NOK/SFH form URLs, Wotzell log updates, trip creation for Wholesale/Ship Ins, and the Clothing
Checklist record, none of which should be touched.

## The fix

Isolate the change to the one `if/else` block that sends the welcome email. Pre-Need deals now send
nothing there; all other deal types are unaffected. The `We_are_Here_to_Help_Email_Sent` flag is still
set either way, since other logic may read it.

Before (live today):
```deluge
if(recordInfo.get("Type") == "Pre Need")
{
	standalone.sendEmail(contactInfo.get("Email"),"6503357000020253003","Deals",crmid);
}
else
{
	standalone.sendEmail(contactInfo.get("Email"),"6503357000001574114","Deals",crmid);
}
```

After (`populatecrmid_UPDATED.deluge`):
```deluge
if(recordInfo.get("Type") != "Pre Need")
{
	standalone.sendEmail(contactInfo.get("Email"),"6503357000001574114","Deals",crmid);
}
```

## Apply

1. CRM > Setup > Developer Space > Functions > `populateCRMID`.
2. Pull the live source first (per standing rule) and confirm it still matches
   `rollback/populatecrmid_CURRENT.deluge` -- if not, re-derive the diff against whatever is live.
3. Replace just the `if/else` block above with the version in `populatecrmid_UPDATED.deluge`. Nothing
   else in the function changes.
4. Save and publish. Do not touch the workflow rule itself.

## Test

1. Create a new Deal with `Type = Pre Need` on a Pipeline other than Police Cases / Hospital Cases /
   First Call / Wholesale. Confirm no "We Are Here to Help DFH for Pre Need" email is received, and
   `We_are_Here_to_Help_Email_Sent` is still set to `true` on the Deal.
2. Create a new Deal with `Type != Pre Need` (any other type) on the same kind of Pipeline. Confirm the
   original welcome email (template `6503357000001574114`) still sends as before.
3. Confirm Booking_User_ID, NOK/SFH form URLs, and Wotzell log updates still populate on both -- nothing
   else in `populateCRMID` should change behaviour.

## Rollback

Paste `rollback/populatecrmid_CURRENT.deluge` back over the function in full.

---

# R2 -- Relationship picklist: source field is unclear

**Not resolved -- needs a decision, not a code change.**

The widget, Creator questionnaire, and CRM `Pre_Need_Questionnaire` subform now use a consistent
15-value Relationship picklist (Mother, Father, Brother, Sister, Husband, Wife, Son, Daughter,
Grandaughter, Grandson, Partner, Cousin, Family, Friend, Other) -- confirmed identical across all
three surfaces as of 2026-09-22.

Andrea asked for this to be sourced from "the existing Contact Relationship picklist." The only
field on Contacts that matches that description is `Relation_to_Deceased` (picklist, field id
`6503357000001130167`), and it does **not** match:

- It has 18 values, not 15 (adds `Parent`, `Sibling`, `Aunt/Uncle`).
- Its stored `actual_value` for several options doesn't match the `display_value` shown to users --
  e.g. displayed "Husband" is stored as `Grandparent`, displayed "Father" is stored as `Spouse`. This
  looks like corrupted/relabeled legacy data, not something safe to point a new field at directly.

So the three new surfaces are internally consistent with each other, but not literally sourced from
the existing Contact field as asked. Two ways to close this out -- **needs Andrea/user's call**:

1. Confirm `Relation_to_Deceased` isn't actually the field she meant (maybe a different, not-yet-found
   field, or she's fine with an independent list) -- if so, this item is done as-is.
2. If it must be sourced from `Relation_to_Deceased`, that field's actual/display mismatch needs fixing
   first (separate task -- touches existing Contact records), then the picklist values need to be
   re-aligned across widget/Creator/CRM to match it, including `Parent`/`Sibling`/`Aunt-Uncle`.

---

# B1 -- orphaned legacy contract function

**Flag only, no action taken.** `automation.sendPreNeedContract` (`sendpreneedcontract`) is a third,
older function that generates the Pre-Need contract via `zoho.writer.mergeAndSign` against Writer
document `ubfm148d1038a8ca14b7ebff242b4a8728552` -- a completely different mechanism from the two
current Zoho Sign-based functions (`sendPreNeedFuneralContract`, `sendPreNeedFuneralContractEmbedded`,
see ZP-TBD-73). No active Deals workflow rule references it (checked all 102 Deals workflow rules), so
it looks orphaned. Recommend deleting it or explicitly marking it deprecated so it doesn't get
mistaken for a live path later. Left untouched pending confirmation.
