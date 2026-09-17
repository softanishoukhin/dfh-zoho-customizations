# New CRM module: Pre-Need Questionnaire

**Status: confirmed live and working (2026-09-17).** For the final, fully-confirmed mechanism
(ZFS two-step file upload, delete-then-reupload for signature replacement, the
`zoho_oauth_connection` used for file processing, and every other gotcha hit along the way), see
`creator/forms/pre_need_questionnaire/ZP-TBD-70_pre_need_questionnaire_build/guideline.md` §6-8 --
this file is kept as the original module-design rationale, not the up-to-date mechanism reference.

Added after the Creator-form-only design (`Final_Wishes_Form`) hit repeated friction with
Creator's own Deluge quirks (composite fields rejecting plain Maps, subform rows needing a
row-constructor + `collection()`, the Signature field type rejecting programmatic writes
outright). Per the user's decision (2026-09-17): **keep both** -- `Final_Wishes_Form` keeps
being created exactly as before, and this new CRM module is created *in addition*, linked to the
Deal. Going forward, **edit/resume prefill sources from this CRM module**, not from
`Final_Wishes_Form`/`getCreatorRecord`.

## Module setup (CRM Setup > Modules > Create New Custom Module)

| | |
|---|---|
| Module display name | **Pre-Need Questionnaire** |
| Module API name | `Pre_Need_Questionnaire` |
| Lookup to Deals | `Deal_Name` (Lookup field -> Deals) -- this is what "linked to the deal" means; one questionnaire record per Deal |

## Fields (flat, no composite types -- avoids every quirk hit on the Creator side)

| Field | Type |
|---|---|
| `Deal_Name` | Lookup (Deals) |
| `Pre_Planner_First_Name` | Single Line |
| `Pre_Planner_Last_Name` | Single Line |
| `Pre_Planner_Address_Line_1` | Single Line |
| `Pre_Planner_Address_Line_2` | Single Line |
| `Pre_Planner_City` | Single Line |
| `Pre_Planner_State` | Single Line |
| `Pre_Planner_Postal_Code` | Single Line |
| `Pre_Planner_Country` | Single Line |
| `Persons_Responsible` | Subform (Name, Relationship, Phone -- CRM's native subform, created via the module's own subform builder) |
| `Disposition_Preference` | Picklist: Burial, Cremation |
| `Cemetery` | Single Line |
| `Burial_Location_Line_1` | Single Line |
| `Burial_Location_Line_2` | Single Line |
| `Burial_Location_City` | Single Line |
| `Burial_Location_State` | Single Line |
| `Burial_Location_Postal_Code` | Single Line |
| `Ashes_Instructions` | Multi-Line |
| `Place_of_Worship` | Single Line |
| `Ceremony_Preferences` | Multi-Line |
| `Obituary_Information` | Multi-Line |
| `Clothing_and_Accessories` | Multi-Line |
| `Flowers` | Multi-Line |
| `Songs` | Multi-Line |
| `Readings` | Multi-Line |
| `Prayers` | Multi-Line |
| `Imagined_Service` | Multi-Line |
| `Interment_Type` | Multi-Select Picklist: Urn, Keepsake Urn, Scattering Urn |
| `Interment_Description` | Multi-Line |
| `Programme_Style` | Single Line |
| `Headstone_Type` | Single Line |
| `Inscription` | Multi-Line |
| `Additional_Instructions` | Multi-Line |
| `Signature` | Image Upload -- lives HERE now, not (only) on the Deal. Uses the exact same `zoho.encryption.base64DecodeToFile` + `.setParamName("file")` + multipart POST mechanism already used for `Deals.Pre_Need_Signature`, just targeting this module/record instead |

## What changes in the widget's Custom APIs once this module exists

- `submitFinalWishes` keeps its existing `insert into Final_Wishes_Form [...]` block unchanged,
  and additionally does an **upsert** into `Pre_Need_Questionnaire`: COQL-search for an existing
  record where `Deal_Name = <deal_id>`; `zoho.crm.updateRecord` if found, `zoho.crm.createRecord`
  if not. This prevents duplicate CRM records across repeated edit/resubmit cycles.
- A new lookup path (extending `getDeal` or a new function) queries `Pre_Need_Questionnaire` by
  `Deal_Name` on page load to drive prefill/resume, replacing reliance on
  `Pre_Need_Questionnaire_Edit_URL`'s `record_id` + `getCreatorRecord`.
- Signature upload target moves from `Deals.Pre_Need_Signature` to this module's own `Signature`
  field.
