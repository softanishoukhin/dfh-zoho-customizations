# ZP-TBD-68 — Pre-Need from Contact (new entry point, replaces Lead-based start)

**Source:** `D:\Office\Andrea_Projects\DFH\projectDocuments\task6.txt`. Investigated live 2026-09-16
before writing anything, per the standing live-source-first rule.

## The ask

Stop starting Pre-Need from Leads. Start it from an existing Contact via a new **"Create Pre-Need
Deal"** button, which is intended to be the *only* entry point going forward, replacing the Lead
process entirely.

Clicking the button on a Contact (e.g. Mary Smith) collects: Name, Date of Birth, Address, Phone,
Email, TRN, and "Is the payer also this person?" — describing whoever the funeral is actually for.

- **Scenario 1 (Mary buys for herself):** payer = beneficiary. Creates an Account (Mary Smith,
  Account_Type = Deceased), a Deal (Pipeline = Pre Need, Account = Mary's new Account, Contact_Name
  = Mary), and gives Mary the "Primary Contact" role on the Deal.
- **Scenario 2 (Mary buys for her mother Joan):** existing Contact Mary remains the payer. Creates
  a new Account (Joan Smith, Account_Type = Deceased) and a new Contact (Joan Smith, linked to that
  Account), a Deal (Account = Joan's Account, Contact_Name = Mary), and assigns Mary "Primary
  Contact" + Joan "IFR" as Contact Roles on the Deal.

**The rule, stated explicitly in the brief:** Contact = who pays; Account = who the funeral is
for. Both records exist even when payer and beneficiary are the same person. Once the Account is
set on the Deal, **do not change it later** — the Books retainer connects to the Deal's Account, so
changing it after the fact can break the retainer's application at at-need.

**Explicit instruction:** "LIFT IT — do not rewrite." The existing `convertLeadOnChangingLeadStatus`
function already does most of this Account/Contact/Deal/Contact-Role mechanics for the Lead-based
flow; reuse/adapt its proven pieces rather than rebuilding from scratch. **But** don't copy its one
known bug (see below).

## What we found live in `convertLeadOnChangingLeadStatus` (CRM function id via API name
`convertleadonchangingleadstatus`)

Full source pulled live 2026-09-16 via `ZohoCRM_getFunctionCode` (the API name has no typo —
`convertleadonchangingleadstatus`, all lowercase, despite the Lead-conversion nature suggesting
otherwise; had to search the full function list to find it, direct guesses at the API name all
failed).

**Reusable, proven mechanics — lifted as-is into the new function:**
- The Contact Role assignment pattern: `PUT /crm/v6/Deals/{dealId}/Contact_Roles/{contactId}` with
  body `{"data":[{"Contact_Role":{"name":...,"id":...}}]}`.
- The "Primary Contact" role id, `6503357000001327140`, hardcoded in the live function — reused
  as-is since it's already proven working for real Lead conversions.
- The dynamic "look up or create" pattern for a Contact Role master record via
  `POST`/`GET /crm/v7/Contacts/roles`, including the `DUPLICATE_DATA` fallback (a create that hits
  an existing role name returns that code; the code then re-fetches the full role list to find the
  existing id instead of erroring).

**The confirmed bug — NOT copied:**
```deluge
accountMap.put("Account_Type","IFR");
... // ~20 other fields set in between
accountMap.put("Account_Type",ifnull(recordInfo.get("Account_Type"),""));
```
The second line overwrites the first with a blank, since `recordInfo` here is a **Lead** record and
Leads don't have an `Account_Type` field. The new function sets `Account_Type` to `"Deceased"`
exactly once and never touches it again.

**One more thing found by reading the live code, not mentioned in the brief — deliberately NOT
copied:** after creating the IFR Account, the old function does:
```deluge
contactMap.put("Account_Name",accountId);
zoho.crm.updateRecord("Contacts",contactId,contactMap,...);
```
This reassigns the **payer's own Contact** to belong to the newly-created beneficiary's Account.
Harmless in the old context (that Contact was freshly created seconds earlier from Lead conversion,
with no prior Account). In the new flow the payer is a pre-existing real Contact who may already
belong to their own Account — reassigning it to the beneficiary's Account would silently break
that relationship. **Confirmed with the developer 2026-09-16: do not do this.** The payer's own
Account_Name is left untouched in the new function.

## Confirmed live before building (not assumed)

- `Deals.Pipeline` value for Pre Need is literally the string **`"Pre Need"`** (both
  `display_value` and `actual_value` match) — no numeric pipeline id needed. The old function has a
  commented-out numeric value (`"6049981000002144040"`) that looks like a stale/wrong leftover from
  an earlier attempt; not reused.
- The Pre Need pipeline's first stage is **`Qualification`** (displayed as "Requested") — this is
  the initial Stage for a freshly-created Deal from this button, per the developer's explicit
  choice among the 14 Pre Need stages.
- **Neither Accounts nor Contacts has a TRN field today** — checked both modules' complete field
  lists via `ZohoCRM_getFields` directly, nothing matches "TRN," "tax," or "registration." Decision:
  add it to **Accounts** (alongside the existing `Deceased_*` fields), not Contacts. **Not yet
  created — this blocks the TRN portion of the feature until it exists.**
- Contacts already has every standard field the beneficiary-Contact creation path needs
  (`First_Name`, `Last_Name`, `Date_of_Birth`, `Email`, `Phone`, `Mailing_Street/City/State/Zip/Country`,
  `Account_Name`) — confirmed via `ZohoCRM_getFields`, nothing missing.

## What was built

- **`createPreNeedDealFromContact.deluge`** (this folder) — the new standalone CRM function.
  Return type `string` (CRM functions can't return `map` — existing hard constraint, respected
  throughout: builds a `resultMap`, returns `resultMap.toString()`).
- **`preNeedFromContactWidget`** — the CRM widget UI, built directly into the already-scaffolded
  `zet` project at
  `D:\Office\Andrea_Projects\DFH\widgets\preNeedFromContact\preNeedFromContactWidget\app\widget.html`
  (was a bare `zet create` boilerplate — `plugin-manifest.json` still just says
  `{"service": "CRM"}`, unedited). Single Yes/No toggle ("is the payer also this person?"), one
  field set for the beneficiary (pre-filled from the payer Contact's own data when "Yes," blank for
  fresh entry when "No"), submit calls
  `ZOHO.CRM.FUNCTIONS.execute("createpreneeddealfromcontact", ...)`. Built with jQuery (per
  explicit developer request) — `jquery-3.7.1` from `code.jquery.com`, matching the exact version
  already used in NOKIntake's widget.

## Deployment (manual — no write API available to this session for CRM custom fields or CRM
functions, matching the pattern already established for Books/Creator throughout this repo)

1. **Create the Accounts field:** "TRN" (suggest label; api_name will likely auto-generate as
   `Deceased_TRN` or similar if you name it "Deceased TRN" — confirm the actual live api_name once
   created and correct the one reference to it in `createPreNeedDealFromContact.deluge` if it
   differs, same lesson as ZP-TBD-65's credit-note-id field).
2. **Create the CRM function:** Setup → Developer Space → Functions → New Function → Standalone,
   return type String. Paste in `createPreNeedDealFromContact.deluge`. Confirm the resulting API
   name matches `createpreneeddealfromcontact` (all lowercase) — if Zoho generates something
   different, update the `ZOHO.CRM.FUNCTIONS.execute(...)` call in `widget.html` to match.
3. **Build and upload the widget:** from
   `D:\Office\Andrea_Projects\DFH\widgets\preNeedFromContact\preNeedFromContactWidget`, use the
   Zoho Extension Toolkit (`zet`) to package and upload as normal for this org's existing widget
   workflow.
4. **Create the Contacts button:** Setup → Customization → Modules → Contacts → Buttons → New
   Button, name "Create Pre-Need Deal", Function Type: Widget, pointing at the uploaded widget.
5. **Live test both scenarios** (see Testing below) before rolling out to replace the Lead
   process — this is meant to be the *only* entry point going forward, so it needs to hold up.

## Testing (from the brief)

**Test 1 — buying for self:** click the button from a Contact, answer Yes. Expect: 1 Contact
(unchanged), 1 new Account (Deceased), 1 new Deal (Pipeline Pre Need, Account = new Account,
Contact_Name = the Contact), Primary Contact role only.

**Test 2 — buying for someone else:** click the button from a Contact, answer No, enter a different
beneficiary. Expect: existing payer Contact untouched (including its own `Account_Name`, per the
decision above) + new beneficiary Contact + new beneficiary Account (Deceased) + new Deal (Account
= beneficiary, Contact_Name = payer) + Primary Contact role (payer) + IFR role (beneficiary).

## Bug found during live testing (2026-09-16) — fixed

First live test (Contact `6503357000082166026`, self-payer scenario) failed with:
```
Data type of the argument of the function 'zoho.crm.getRecordById' did not match the required data type of '[BIGINT]'
```
Actual arguments received by the function showed `"payerContactId":["6503357000082166026"]` — an
**array**, not a plain string. The CRM widget SDK's `PageLoad` event always returns `data.EntityId`
as an array (it supports bulk/multi-record button contexts, even though this button only ever
applies to one Contact at a time). The widget was assigning that array straight to
`payerContactId` and passing it through unchanged, so the Deluge function received a list where it
expected a plain id string. Fixed in `widget.html`: `payerContactId` now takes `data.EntityId[0]`,
not the raw array. No change needed on the function side — it was always expecting (and correctly
declared for) a plain `String`.

## Two more bugs found during live testing (2026-09-16, self-payer scenario) — fixed

1. **Pipeline, Type, and Stage came back blank on the created Deal.** Root cause: `Layout` was
   never set on the `dealMap`. This org's Deals module ties available Pipeline choices to Layout;
   without an explicit Layout, `zoho.crm.createRecord` fell back to some default layout that
   doesn't offer "Pre Need" as a valid Pipeline value, so Zoho silently dropped Pipeline (and the
   Stage that depends on it) — the record still created successfully with no error surfaced, since
   the function only checks for a returned `id`, not per-field warnings.

   **Two wrong guesses before finding the real cause via a working example:**
   - Attempt 1: `dealMap.put("Layout","6503357000000091023")` (plain id string), Pipeline as the
     label `"Pre Need"`. Live retest: Pipeline still blank, Stage-progress bar showing an entirely
     different pipeline's stage names.
   - Attempt 2: guessed Layout needed the `{"id": ...}` map form instead. Not yet tested before the
     real cause was found.
   - **Real cause, found by reading `Intake_Form.ds` (NOK Intake's Creator form, which already
     creates Pre Need Deals successfully in production):** `Pipeline` needs the **internal numeric
     Pipeline id** (`"6503357000001556214"` for Pre Need in this org), not the picklist label
     `"Pre Need"` that the REST v7 layout metadata API shows — that mismatch was the actual root
     cause all along, not Layout's format. `Layout` does take a plain id string fine (same as
     `Account_Name`/`Contact_Name`) — confirmed by the same working example, so the `{"id":...}`
     detour was reverted. `Stage` also corrected to the display label `"Requested"` (not the
     `actual_value` `"Qualification"` from the REST metadata), matching NOK Intake exactly. `Type`
     was already correct as the plain label `"Pre Need"` — confirmed against the same file
     (`dealDataMap.put("Type",theForm.Deal_Type)`, where `Deal_Type` is literally `"Pre Need"` for
     this case).
   - **Third attempt, this time confirmed correct in principle:** re-applying the (verified-correct
     via `ZohoCRM_getPipelines`) numeric Pipeline id `6503357000001556214` through the native
     `zoho.crm.createRecord` task still resolved to `"Standard (Standard)"` (the module's default
     pipeline) live — the id was right, but the native task itself is unreliable for this field
     combination. Found a directly comparable, already-proven-working example instead:
     `crm/functions/deals/ZP-TBD-8_police_dropoff_workflow/createOnePoliceDropoffDeceased.deluge`
     creates Deals via **raw REST** (`invokeurl POST https://www.zohoapis.com/crm/v7/Deals`), on
     this same Layout id, with Pipeline/Stage/Type as **label strings** (e.g.
     `dealMap.put("Pipeline","Police Cases")`) and `Account_Name`/`Contact_Name` as proper
     `{"id": "..."}` lookup maps. **Switched Deal creation in `createPreNeedDealFromContact` to
     this exact REST pattern** — Pipeline back to the label `"Pre Need"`, Layout/Stage/Type
     unchanged from the previous attempt, Account_Name/Contact_Name now wrapped as `{"id":...}`
     maps (required for raw REST, unlike the native task which tolerated bare id strings).
   - **Lesson:** the native `zoho.crm.createRecord` task is unreliable for Pipeline/Layout/Stage on
     this org's Deals module — not just a matter of finding the "right" value format for it. Use
     raw REST for this field combination, matching a proven working example, rather than the
     native task at all. Corrected in
     [[feedback_pipeline_write_needs_internal_id]] (the memory's first version, based on
     `Intake_Form.ds` alone, was itself wrong/incomplete).
   - **Not yet re-verified live after this third correction.**
   Also found: **`Type` is a separate field from `Pipeline`** and was missing entirely — added
   `Type = "Pre Need"`, matching the real live Pre-Need deal (`6503357000082023164`) inspected
   during investigation, which has `Type: "Pre Need"` alongside `Pipeline: "Pre Need"`.
2. **The new Account wasn't showing up on the Contact record, in the self-payer ("Yes") scenario.**
   The earlier decision not to reassign the payer's `Account_Name` was meant to protect Scenario 2
   (payer ≠ beneficiary) from being wrongly linked to someone else's Account. It got over-applied
   to Scenario 1 too, where payer *is* the beneficiary — there the new Account genuinely is about
   that same Contact, so linking it is correct, not a risk. Fixed: in the `isPayerSame == "true"`
   branch, the payer's own Contact now gets `Account_Name` updated to the new Account.

## Duplicate detection added (2026-09-16, during live testing)

Live-testing TC-07 (Scenario 2) repeatedly showed every submission creating a brand-new beneficiary
Account, even for the same person — the first build deliberately had no dedup, matching the
brief's literal "New Account... New Contact" wording (see the now-resolved open item below).
Confirmed with the user this should be fixed: added a COQL search-before-create step for both the
beneficiary Account (by `Account_Name` + `Account_Type = 'Deceased'`) and, in Scenario 2, the
beneficiary Contact (by `Account_Name = <resolved accountId>`), mirroring the search-then-create
pattern `convertLeadOnChangingLeadStatus` already uses for its own IFR Account. A genuinely new
beneficiary still creates fresh records as before; only a re-run with the same beneficiary now
reuses the existing Account/Contact instead of duplicating them. `Contact_Type` is set via an
explicit `updateRecord` after resolving the Contact either way, so a reused Contact from before
T-07 still ends up with the correct value.

**Note for testing:** this changes the expected result of TC-07/TC-12 in
`ZP-TBD-68_PreNeed_From_Contact_Test_Cases.csv` — re-running TC-07 with the *same* beneficiary name
now reuses the existing Account/Contact rather than creating a new one each time. TC-12 (IFR role
reuse) still needs a second, *different* beneficiary to test a second Account/Contact being created
correctly.

## Open items / not yet done

- TRN field not yet created on Accounts — blocks that one field until done (rest of the flow works
  without it).
- Function and button not yet created live (no write API from this session) — guideline delivered,
  awaiting manual setup per the deployment steps above.
- Not yet live-tested at all — this is a first build, not a confirmed-working one.
- Not addressed (not asked for): what happens to the *old* Lead-based process — presumably retired
  once this is confirmed working, but that's a decision for Andrea/Dale, not assumed here.

## Bug found during live testing (2026-09-16) — Street Address 2 not pre-filling — fixed

Scenario 1 ("Yes") live test: `payerNameSubtitle` and most fields pre-filled correctly from the
payer Contact (Street, City, State, Zip, Country, Phone, Email), but Street Address 2 stayed
blank even though the Contact had a value in it (visible in the CRM record itself: "Mailing
Street 2"). Root cause: the widget's `prefillFromPayer()` never read that field at all — confirmed
its live api_name is `Mailing_Street_2` via the Contacts field list already pulled during
investigation. Fixed in two places:
- `widget.html`'s `prefillFromPayer()` now sets `#benStreet2` from `payerContact.Mailing_Street_2`.
- `createPreNeedDealFromContact.deluge`'s Scenario 2 beneficiary Contact creation was missing the
  same field entirely (only `Mailing_Street` was being set) — added
  `beneficiaryContactMap.put("Mailing_Street_2", ...)` alongside it, for consistency (not yet
  reported as broken, but the same gap, found while fixing the reported one).

## Status

Investigation and first build complete 2026-09-16. Duplicate-detection added same day per user
request during test review. Street Address 2 pre-fill/creation bug found and fixed same day. Not
yet deployed or tested live.
