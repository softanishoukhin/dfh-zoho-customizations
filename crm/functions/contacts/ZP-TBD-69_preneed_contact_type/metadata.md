# ZP-TBD-69 — Pre-Need Contact_Type (T-07)

**Source:** `D:\Office\Andrea_Projects\DFH\projectDocuments\task7.txt`. Closely related to
[[ZP-TBD-68]] (T-06, `createPreNeedDealFromContact`) — T-06 creates the Contacts, T-07 makes sure
they get the correct `Contact_Type`. No separate function created; this is a patch to the T-06
function plus one manual field change.

## The ask

Every Contact involved in a Pre-Need must end up with a valid `Contacts.Contact_Type`. Today that
picklist has an `IFR` value but no value for the person who pays. Task:

1. Add a new valid picklist value for the payer.
2. Make `Contact_Type` required for Contacts created through T-06.
3. Assign the correct value depending on role (payer vs. IFR/beneficiary).

Explicit warning in the brief: don't use both `Contact_Type` and `Is_this_Contact_IFR` to represent
the same thing (they could end up disagreeing) — use `Contact_Type` only. Also explicitly warns not
to copy the existing bug in `convertLeadOnChangingLeadStatus`, which writes the
`Pre_Need_Contact_Role` answer ("For Self"/"For Spouse"/"For Family Member") straight into
`Contact_Type` — those are not valid picklist values.

## Confirmed live 2026-09-16 before building (per the live-source-first rule)

- Pulled `Contacts.Contact_Type` via `ZohoCRM_getFields`: picklist, `system_mandatory: false`,
  current valid values — `-None-`, `Deceased Contact`, `IFR`, `Guarantor`, `JTB Rep`, `Tour Rep`,
  `Forensics Lab`, `Police`, `Hospital`, `Funeral Home`, `Driver`, `Doctor`, `Attendant`,
  `Portal User`, `On Scene Contact`, `Investigating Officer`, `Amber Driver` (unused). No payer
  value exists.
- Re-pulled `convertLeadOnChangingLeadStatus`'s live source via `ZohoCRM_getFunctionCode` and
  confirmed the bug the brief describes is real and live today:
  `intendedFuneralReciepent.put("Contact_Type",ifnull(recordInfo.get("Pre_Need_Contact_Role"),""))`.
  This only ever runs for the beneficiary/IFR Contact in the Lead flow — the payer Contact in that
  same function never gets `Contact_Type` set at all.
- Searched the repo for every `createRecord("Contacts", ...)` call site: T-06
  (`createPreNeedDealFromContact`), `ZP-TBD-37_mnsj_account_setup`, and
  `ZP-TBD-10_nok_contact_hospital_police`, plus Lead conversion and Creator/NOKIntake paths outside
  this repo. None of those besides T-06 are in scope for this ticket.

## Decisions confirmed with the user (task7.txt explicitly said not to invent these)

- **New picklist value: `"Payer"`.** Matches task6.txt's own role terminology ("Primary Contact /
  Payer") and task7.txt's own illustrative examples.
- **Enforcement is function-level only, not a layout-level required field.** Marking
  `Contact_Type` as System Required in the Contacts layout would be global — every other
  Contact-creation path in the org (NOKIntake, Lead conversion, manual CRM entry, MNSJ setup, the
  hospital/police intake path) would need auditing first or would start failing on save. T-07's own
  wording ("required for Contacts created through T-06") is scoped to T-06, so
  `createPreNeedDealFromContact` now sets `Contact_Type` explicitly on every Contact it creates or
  touches instead.

## What was changed

`crm/functions/contacts/ZP-TBD-68_preneed_from_contact/createPreNeedDealFromContact.deluge`
(patched in place, same file — not a new function):

- Scenario 1 (payer = beneficiary): the existing `selfAccountLinkMap` update (already setting
  `Account_Name`) now also sets `Contact_Type = "Payer"`. She never gets the IFR Deal-Contact-Role
  either (only "Primary Contact", per the existing logic further down), so `Contact_Type` mirrors
  that — "Payer" only, not "IFR".
- Scenario 2 (payer ≠ beneficiary):
  - The new beneficiary `Contact` create now includes `Contact_Type = "IFR"`.
  - A new small `updateRecord` call sets `Contact_Type = "Payer"` on the pre-existing payer
    Contact, deliberately *not* touching `Account_Name` (that stays untouched per the existing
    ZP-TBD-68 decision — reassigning the payer's own Account would silently break it).
- `Is_this_Contact_IFR` is not written anywhere in this function — deliberately, per the brief's
  warning against two fields for the same fact.

## Deployment (manual — no write API for CRM picklist values or CRM functions from this session)

1. **Add the picklist value:** Setup → Customization → Modules → Contacts → `Contact Type` field →
   add value `Payer` (any position; suggest right after `IFR`).
2. **Re-paste the updated function body** into the existing `createPreNeedDealFromContact` CRM
   function (Setup → Developer Space → Functions) — same function as ZP-TBD-68, not a new one. If
   ZP-TBD-68 hasn't been created live yet, this patch is already included in the file to paste.
3. No new fields, no layout changes, no workflow changes needed.

## Testing

Same two scenarios as ZP-TBD-68 (T-06), extended to check `Contact_Type`:

- **Test 1 (buy for self):** after clicking the button and answering Yes, the Contact's
  `Contact_Type` = `Payer` (not blank, not `For Self`).
- **Test 2 (buy for someone else):** payer Contact's `Contact_Type` = `Payer`; new beneficiary
  Contact's `Contact_Type` = `IFR`. Neither is blank.

Not yet live-tested — depends on ZP-TBD-68 itself first being deployed and tested (see that
ticket's status).

## Open items / not addressed (deliberately, out of scope)

- The bug in the live `convertLeadOnChangingLeadStatus` (writing `Pre_Need_Contact_Role` into
  `Contact_Type`) is confirmed but **not fixed** — task7.txt only warns not to copy it into the new
  function, it doesn't ask for the old Lead function to be patched. That function is slated for
  retirement once T-06 is confirmed working (per ZP-TBD-68); fixing it is a separate call for
  Andrea/Dale if the Lead flow stays alive longer than expected.
- No layout-level required-field change, and no audit of the other Contact-creation paths
  (NOKIntake, MNSJ setup, hospital/police intake, Lead conversion) — explicitly out of scope per
  the confirmed function-level-only decision above.

## Status

Patch written 2026-09-16, same day as ZP-TBD-68's first build. Not yet deployed or tested — blocked
on ZP-TBD-68 itself being created live first (same underlying CRM function).
