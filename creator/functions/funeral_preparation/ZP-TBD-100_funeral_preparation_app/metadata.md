Task ID: ZP-TBD-100
Zoho App: NEW Creator app "Funeral Preparation" (portal + widget) + CRM (2 picklist values, 1 function patch)
+ Operations App (1 picklist value)
Requested by: Andrea, 2026-10-06 -- "DFH_Ops_App_and_Family_Viewing_Requests_2026-10-05.md",
section "Funeral Preparation app: new build (APPROVED)"
Status: built 2026-10-06; widget tested locally against a mocked SDK (both parts); NOT deployed.

## What it is
One Creator app, two parts, two users, each on its own portal page:
- **Part 1 Family Viewing** (viewing person, Union Street) -- `app/viewing.html`
  - Viewing List: the cases that used to get the Family Viewing Form email.
  - Status buttons: Ready for Viewing, Transfer Received (placeholder).
  - Family Viewing Form, in the app (both versions), writing the same Deal fields as the Zoho Form.
  - Changes to Complete: every viewed case's appearance changes, ticked off when done.
- **Part 2 Pre-Funeral Reconciliation** (Ms FS) -- `app/prep.html`
  - Funeral Prep: the funerals for a day (default tomorrow); each opens a 5-section checklist:
    1 Funeral time, 2 Viewing form differences, 3 Cosmetizing, 4 Load list, 5 Programmes.

## Decisions (user, 2026-10-06)
1. Form submit: patch the CRM function `sendEmailToOwnerToReviewFuneralViewingForm` so it also
   recognises the app's submit (it only looked at Zoho Forms updates). Workflow rules unchanged;
   the Zoho Form keeps working too.
2. No PDF: the owner gets the same email and tasks; the answers are on the Deal and in the app.
   (The email has no PDF attached for app submissions.)
3. Status buttons write `Deceased_Status` on the body's fridge-position Operations record (the
   same record the Operations portal uses), and mirror it onto the Operations App Deceased record.

## What exists today (identified, not changed)
- Workflow "Actions on changing Different Deal Stage 2" (6503357000002135010), condition 10:
  Stage = **Embalming Complete** AND Pipeline in (Cremation Only, Cremation with Service, Funeral
  with Burial) -> `updateDealStageOnFamilyVisitDateAndSendFuneralViewingForm`, which sets Stage =
  **Family Visit** and emails the Zoho Form link to dfhviewing45@gmail.com (burial template
  6503357000008075090 for Funeral with Burial; cremation template 6503357000008929017 for Cremation
  with Service AND Cremation Only). -> The app's Viewing List = Stage "Family Visit" in those
  pipelines. Not changed (the email keeps going until DFH switches it off -- see open question 1).
- Workflow "Send Email to Owner to Review the Funeral Viewing Form" (6503357000008121082): on
  Funeral_Viewing_Form_Submitted = true (and appearance / new time / grave type not empty) ->
  `sendEmailToOwnerToReviewFuneralViewingForm` + field update that unticks the flag again.
  The function read the Deal Timeline and acted ONLY on a `zoho_forms` update -- hence the patch.
- Driver App load list = `getFuneralStartInfo`: Product Selection lines whose parent product is
  exactly Flowers / Cremation Merchandise / Programs, plus the same on the walk-in invoice.
  Copied into `fpLoadList` (adds Quantity).
- CRM Operations `Deceased_Status` values today: Checked In, Pending Police Investigation.

## Files
- `funeral_prep_functions.deluge` -- 21 Creator functions (7 shared helpers = the Ops App ones
  renamed fp*, 5 fp helpers, 9 behind Custom APIs).
- `widget/` -- repo copy of `D:\Office\Andrea_Projects\DFH\widgets\FuneralPrep\FuneralPrepWidget\`
  (`app/viewing.html`, `app/prep.html`, `app/app.js`, `app/style.css`, `plugin-manifest.json`);
  packed `dist/FuneralPrepWidget.zip` (one zip, two widgets).
- CRM patch: `crm/functions/deals/ZP-TBD-100_funeral_prep_viewing_submit/sendEmailToOwnerToReviewFuneralViewingForm_UPDATED.deluge`.

## Deploy -- in this order

### Step 1 -- CRM
1. Setup > Modules > **Operations** > field **Deceased Status** > add picklist values
   **Ready for Viewing** and **Transfer Received**. Save.
1b. Setup > Modules > **Deals** > layout **FB** (Funeral with Burial) > drag the existing field
   **Programmes** onto the layout (next to the other funeral details) > Save. (Found 2026-10-06:
   Programmes is on the PC/HP, SI and "CO, CS, WH, FC, FR, RC" layouts but NOT on FB, so burial
   Deals could never fill it and Section 5 showed "Printed: --" for every burial.)
2. Setup > Developer Hub > Functions > `sendEmailToOwnerToReviewFuneralViewingForm` > replace the
   body with the `_UPDATED.deluge` file > Save. Only the Timeline loop changed: it now accepts a
   Zoho Forms update OR a non-workflow update whose field history includes
   Funeral_Viewing_Form_Submitted (the app sets that flag in the same update as the answers).
   Everything after the loop (tasks, funeral-time move, location emails, owner email) is unchanged.

### Step 2 -- Operations App (Creator)
Deceased_Record_Form > field **Deceased_Status** > add the choice **Transfer Received** (Ready for
Viewing is already there). Save. (Guideline only -- the .ds is not edited.)

### Step 3 -- Create the Creator app
1. Creator > Create App > from scratch > name **Funeral Preparation** (link name
   `funeral-preparation`). Settings > Time zone **America/Jamaica**, date format dd-MMM-yyyy.
2. Create these 3 forms. All fields are **Single Line** unless stated -- the app keeps CRM values
   as text, the widget formats them. Field link names must match exactly.

**Form `FP_Viewing_Form`** (one record per Deal)
| Field link name | Type |
|---|---|
| Deal_ID | Single Line |
| Form_Version | Single Line |
| Deceased_Name | Single Line |
| Date_of_Death | Single Line |
| Casket_Type | Single Line |
| Grave_Type | Single Line |
| Funeral_Time_Shown | Single Line |
| Time_Change_Requested | Single Line |
| New_Funeral_Time | Single Line |
| Family_Contact_Name | Single Line |
| Family_Contact_Phone | Single Line |
| Staff_Initials | Single Line |
| Appearance_Changes | Multi Line |
| Submitted_At | Single Line |
| Submitted_By | Single Line |

**Form `FP_Change_Item`** (one record per requested change)
| Field link name | Type |
|---|---|
| Deal_ID | Single Line |
| Viewing_Form_ID | Single Line |
| Change_Text | Multi Line |
| Done | Decision Box |
| Done_By | Single Line |
| Done_At | Single Line |
| Sort_Order | Number |

**Form `FP_Checklist`** (one record per Deal -- Ms FS's ticks)
| Field link name | Type |
|---|---|
| Deal_ID | Single Line |
| Checks | Multi Line |
| Updated_By | Single Line |
| Updated_At | Single Line |

3. Connection (Microservices > Connections): **zoho_oauth_connection** only -- the shared Zoho
   OAuth connection that already holds all the CRM and Creator scopes (CRM COQL + modules for the
   reads/writes; Creator report update to mirror the status onto the Operations App Deceased
   record). Link it to this app the same way as in the Operations App.

### Step 4 -- Functions
Workflow > Functions > New Function (namespace "Deluge"). Add each function from
`funeral_prep_functions.deluge`, one per editor, in file order (helpers first): fpCoqlQuery, fpCoql,
fpCoqlIn, fpGetByIds, fpLkId, fpIndexById, fpStamp, fpGetDeal, fpBestOpsByDeal, fpFormVersion,
fpLoadList, fpChecks, then the nine below. (The 3 forms must exist first -- the functions use them.)

### Step 5 -- Custom APIs
Microservices > Custom API > Create. Authentication OAuth2; User Scope: the portal users / the two
portal profiles from Step 7; Response type Standard. POST parameters come from the request body.

| Custom API (link name) | Method | Function | Parameters |
|---|---|---|---|
| FP_Viewing_List | GET | fpViewingList | -- |
| FP_Get_Case | POST | fpGetCase | dealId |
| FP_Set_Status | POST | fpSetStatus | dealId, status |
| FP_Submit_Viewing | POST | fpSubmitViewing | dealId, formJson |
| FP_Toggle_Change | POST | fpToggleChange | itemId, done |
| FP_Changes_List | GET | fpChangesList | -- |
| FP_Funeral_List | POST | fpFuneralList | forDate |
| FP_Save_Deal_Field | POST | fpSaveDealField | dealId, fieldName, value |
| FP_Save_Check | POST | fpSaveCheck | dealId, checkKey, value |

### Step 6 -- Widget and pages
1. Settings > Widgets > Create: name **DFH Family Viewing**, upload
   `FuneralPrepWidget\dist\FuneralPrepWidget.zip`, index file **/app/viewing.html**.
2. Settings > Widgets > Create again with the SAME zip: name **DFH Pre-Funeral Reconciliation**,
   index file **/app/prep.html**.
3. Create page **Family Viewing** (link name Family_Viewing) -> add widget DFH Family Viewing
   (full width, full height).
4. Create page **Pre-Funeral Reconciliation** (link name Pre_Funeral_Reconciliation) -> add widget
   DFH Pre-Funeral Reconciliation (full width, full height).

### Step 7 -- Portal
Enable the portal (same way as the Operations portal). Two profiles:
- **Viewing** -> page Family_Viewing only; Custom APIs FP_Viewing_List, FP_Get_Case,
  FP_Set_Status, FP_Submit_Viewing, FP_Toggle_Change, FP_Changes_List.
- **Funeral Prep** -> page Pre_Funeral_Reconciliation only; Custom APIs FP_Funeral_List,
  FP_Get_Case, FP_Save_Deal_Field, FP_Save_Check.
Invite the viewing person to Viewing and Ms FS to Funeral Prep.

### Step 8 -- Products (Andrea's ask)
Create **Easel** and **Lighting** as $0 products with parent product **Programs**. They then show
on the Driver App load list and in Section 4 with no code change. Section 3 shows "Lighting
required: Yes" when Lighting is on the load list; Section 5 leaves Easel / Lighting out of the
programme count.

## How it works (technical)
- **Viewing List** (`fpViewingList`): COQL `Stage = 'Family Visit' and (Funeral_Time >= today or
  null)`, pipelines filtered in code; plus Deals with an `FP_Viewing_Form` record whose funeral is
  today or later. Lost stages left out. Status = best Operations record's Deceased_Status.
- **Form version** (`fpFormVersion`): Funeral with Burial pipeline -> burial version (with Grave
  Type); Cremation with Service / Cremation Only -> cremation version; else by Service_Type.
- **Submit** (`fpSubmitViewing`): upsert `FP_Viewing_Form`; one `FP_Change_Item` per change (an
  unchanged change keeps its Done tick; removed ones are deleted); then ONE Deal update with
  workflows on: Name_of_Deceased, Date_of_Death, Changes_in_Deceased_Appearence (one change per
  line), New_Requested_Funeral_Date_and_Time (only when a time change was asked), Grave_Type (burial
  only), Funeral_Viewing_Form_Submitted = true. If the flag is still ticked it is unticked first
  without workflows, so the rule always sees a change to true. The patched CRM function then moves
  the funeral, creates the owner tasks and sends the emails exactly as for a Zoho Form.
- **Family contact phone / name and staff initials** are kept in the app (the Zoho Form did not
  write them to the Deal either).
- **Status** (`fpSetStatus`): CRM Operations Deceased_Status (workflows on) on the fridge-position
  record; mirrored to Creator `operations-app` report Deceased_Records via REST PATCH (skip_workflow,
  best effort, same approach as CRM `maintainDeceasedStatus`).
- **Checklist** (`fpSaveCheck`): `FP_Checklist.Checks` JSON, key -> {v, by, at}. Keys:
  `funeral_time`, `recon:<Deal field>` (v = form | deal), `load:<ps:|wi:line id>`, `programmes`.
- **Corrections** (`fpSaveDealField`): whitelist Funeral_Time, Grave_Type, Casket_Type,
  Name_of_Deceased, Date_of_Death, Changes_in_Deceased_Appearence; workflows on.
- Section 2 compares the form with the Deal: name, date of death, funeral time (the new time if
  one was asked), grave type (burial), casket type, appearance changes.

## Open questions for Andrea
1. **The email**: once the app is live, should the CRM stop emailing the Zoho Form link to
   dfhviewing45@gmail.com (a one-line change in `updateDealStageOnFamilyVisitDateAndSendFuneralViewingForm`),
   or run both for a while?
2. **Cremation Only** gets the cremation-version form today (no grave type). Kept the same. OK?
3. **Contact for the driver**: kept in the app only (like the Zoho Form). Should it also go to the
   driver (e.g. on the funeral trip / driver sheet)?
4. **Load list**: it reuses the Driver App rule, so discount lines such as "Less Compli/Casket
   Spray" and "Less Programmes in package KGN" also appear. Leave them out of Section 4 (and the
   Driver App)?
5. **New parent product** (dev advice requested): the load lists match the parent product names
   Flowers / Cremation Merchandise / Programs exactly, in the Driver App (`getFuneralStartInfo`)
   and here (`fpLoadList`). A new parent such as "Funeral Equipment" needs that name added to both
   lists -- a one-line change in each, no other change. Until then, Easel/Lighting under Programs works.
6. **Report 6 (Ops App)**: remove it once this app is live? (Andrea's doc says yes.)
