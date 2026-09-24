Task ID: ZP-TBD-78
Zoho App: CRM (Deals fields, Deceased_Pickups fields, 2 workflow rules, 1 button, 3 new functions,
1 patched function) + Creator NOKIntake (widget + `.ds` guideline) + 1 new CRM widget.
Source: Andrea's task doc `D:\Office\Andrea_Projects\DFH\projectDocuments\pre need to at need conversion.txt`
(section "Pre-Need -> At-Need Conversion"). Status: **built 2026-09-24 as guideline + widget edits --
NOT deployed, NOT tested.**

## Requirement (from the task doc)
A person with a Pre-Need plan dies and DFH is called via Police (PC), Hospital (HC) or First Call (FC).
Do NOT convert the Pre-Need Deal. Intake creates a normal new PC/HC/FC Deal but recognises the
Pre-Need:
- **A.** at Intake, search Pre-Need records by First + Last name (+ DOB when available); popup
  (Name / DOB / Address, Confirm / Cancel); on Confirm the new Deal is linked to the Account created for
  the Pre-Need and carries a Pre-Need status field.
- **B.** second safety check whenever a PC/HC/FC Deal is created: flag "Possible Pre-Need Match" and show
  the matches (Name + DOB + Address + CRM URL); ideally a Link action to pick the right one.
- **C.** handle the duplicate Account when Intake missed the match: link the At-Need Deal to the
  Pre-Need Account and merge/delete/otherwise handle the duplicate -- "propose the simplest safe option".

## Decisions (confirmed with the developer 2026-09-24, not yet with Andrea)
| Question | Decision |
|---|---|
| Cancel on the Intake popup | = **not the same person**. Intake carries on, `Pre_Need_Status = "Not a Match"`, so B does not re-flag it. |
| DOB at Intake | Add an **optional** DOB input for FC/HC/PC (none existed). Blank = name-only match. |
| Duplicate Account (C) | **Re-point, delete only if empty.** Deal + Contacts + Operations move to the Pre-Need Account; duplicate is deleted (Recycle Bin, 60 days) only if provably empty **and** created within 1 day of the Deal, else renamed `DUPLICATE - <name>` for manual review. |
| Deals field limit | The org's field-creation limit has been raised -- new Deals fields are fine. |

## Facts confirmed live 2026-09-24 (DFH CRM org 871210233)
- **`ZohoCRM_getFields` (DFH MCP 1)**: Deals 347 fields / 317 custom; `Deals.Type` picklist includes
  `Pre Need`, `First Call`, `Hospital`, `Police`. `Accounts.Date_of_Birth`, `Deceased_First_Name`,
  `Deceased_Last_Name`, `Deceased_Street_Address(_2)`, `Deceased_City/State/Zip_Code/Country`,
  `Deceased_TRN` all exist. **No** existing Pre-Need-status / match field on Deals.
- **Real Pre-Need Deals** (`Type = 'Pre Need'`, 8 in the org): `Deal_Name = Name_of_Deceased = Account_Name`
  (full "First Last"), `Date_of_Birth` **null on the Deal** -> DOB/address must be read from the Account.
  Stages seen: Requested, Consultation Scheduled, Contract Signed, Hold for Burial Request.
- **Accounts have the same `Account_Type = "Deceased"` for pre-need and at-need people** (3,031 Deceased
  Accounts), so a Pre-Need Account can only be identified by its `Type = 'Pre Need'` Deal.
- **NOKIntake First Call** creates Account + Deal in Creator (`accountManagement` +
  `dealInformationManagementV2`). **Hospital and Police do NOT** -- they create a Trip + a
  `Deceased_Pickups` child and the live CRM function `automation.onDeceasedPickupCreate` (pulled
  2026-09-24) creates the Account + Deal, with **no DOB anywhere in that path**. That is why part A
  needed two extra Deceased_Pickups fields and a patched `onDeceasedPickupCreate`.
- The generic "Zoho CRM" MCP connector points at a different org (its COQL rejects DFH custom fields
  and shows 0 Pre Need Deals) -- do not use it for DFH data checks.

## What this touches
| Item | Change |
|---|---|
| Deals fields | +2: `Pre_Need_Status` (picklist: Matched / Possible Match / Not a Match), `Pre_Need_Possible_Matches` (multi-line text) |
| Deceased_Pickups fields | +2: `Matched_PreNeed_Account_Id` (text), `PreNeed_Not_A_Match` (checkbox) |
| `standalone.findPreNeedMatches` | NEW shared matcher (api name `findpreneedmatches`) |
| `automation.flagPossiblePreNeedMatch` | NEW -- part B safety check, called by 2 Deals workflow rules |
| `standalone.linkPreNeedToDeal` | NEW -- part C link + duplicate cleanup (api name `linkpreneedtodeal`) |
| `automation.onDeceasedPickupCreate` | PATCHED (3 marked blocks) -- `onDeceasedPickupCreate_MERGED.deluge` |
| Deals workflow rules | +2 (create; Name/DOB edit) |
| Deals detail button | +1 Widget button "Link Pre-Need" -> `widgets/linkPreNeed/linkPreNeedWidget` |
| NOKIntake `.ds` | guideline only -- `creator/functions/nok_intake/ZP-TBD-78_.../guideline.md` |
| NOKIntake widget | edited directly -- `widget-js-changes.md` |

## Known limits / open items
1. **Nothing here has run yet.** The Deluge was written against the live code and repo conventions
   (no ternary, no while, string returns, REST v8 for reads) but no live execution -- first real run
   is the test pass.
2. **Matching is name-based.** Two people with the same name and no DOB on either side will be listed
   as "possible" -- staff verify Name/DOB/Address (that is the design). If a Pre-Need was entered under
   a different spelling, the Link widget lets staff search a different name.
3. **Pre-need Deals migrated later (Scenario 2, ~211 historic plans)** must follow the same shape
   (`Type = 'Pre Need'`, Account = the person) to be found. Not built yet.
4. **Books link of the duplicate Account is not checked by code** (no reliable API from CRM for it).
   The delete path is limited to Accounts with no Deals/Contacts/Operations left and created with the
   same Deal, and the link is refused outright once the At-Need Deal has any Quote / Sales Order /
   Invoice. Confirm with the developer that a fresh intake-created Deceased Account has no Books
   customer before relying on the delete (test case TC-C4).
5. **Other lookups to the duplicate Account.** Checked 2026-09-24: the only Trips lookup to Accounts
   is `Autopsy_Location` (a facility, not the deceased), so Trips needs no re-pointing. Deals,
   Contacts and Operations are covered by `linkPreNeedToDeal`. Lookups on other modules (Quotes /
   Invoices / Sales Orders via the Deal) are covered by the "no billing documents yet" guard.
6. Hospital/Police: only the ONE deceased entered at Intake is checked at Intake; further deceased on
   the same trip added later are covered by part B only.
7. The Intake popup's matcher (Creator) and the CRM matcher are two copies of the same logic --
   change one, change both.
