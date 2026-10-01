# ZP-TBD-86 — Pre-Need Questionnaire gaps (Specialist, IFR answer, DOB) + versioning facts + at-need wishes

**Source:** Andrea, `projectDocuments/Questionnaire Gaps.txt` (2026-09-30). "It works. Three small gaps, and one
decision." Checked against live sources the same day.

## Findings (live, 2026-09-30)

| Andrea's item | What we found | Decision (user, 2026-09-30) |
|---|---|---|
| Gap 1: nothing records who took the instructions | `Deals.Pre_Need_Specialist` (text) and `Pre_Need_Date` exist (ZP-TBD-70). The launcher widget already sets `Pre_Need_Date` on first send; nothing ever wrote the Specialist. | Launcher fills `Pre_Need_Specialist` with the sending staff member's name (blank-only). |
| Gap 2: the IFR answer isn't stored | Correct. It was deliberately not stored in the ZP-TBD-XX Beneficiary/IFR work ("no new fields"; it's re-derived from names on resume). `Deals.Pre_Need_Payer_Or_Beneficiary` (Payer / Beneficiary / IFR) exists but nothing writes it. | Staff answer -> `Pre_Need_Payer_Or_Beneficiary` (from `createpreneeddealfromcontact`). Family answer -> new `Pre_Need_Questionnaire.Pre_Planner_Is_IFR`. A disagreement puts a Note on the Deal. |
| Gap 3: DOB captured nowhere | Partly. The Contact "Create Pre-Need Deal" widget **has** a DOB input (optional, pre-filled from the payer on "Yes"), and `createpreneeddealfromcontact` writes it to `Accounts.Date_of_Birth`. That's the field the at-need match (ZP-TBD-78) reads. It's blank whenever staff skip it, the Lead-conversion path never captures it, and the questionnaire doesn't ask. | DOB required on the Contact widget, **and** a required Beneficiary DOB on the questionnaire (pre-filled from the Account, written to the Account if blank, stored on new `Beneficiary_Date_of_Birth`). |
| Decision: resubmission overwrites | **Only half true.** `submitFinalWishes` does `insert into Final_Wishes_Form` on **every** submit, so Creator keeps one row per submission (live: 52 rows; one Deal has 21, several have 2-9). What is overwritten: the one CRM `Pre_Need_Questionnaire` record per Deal (upsert), and the signature (Deal and CRM record: the old file is deleted, then the new one uploaded). | **Nothing built.** Report the facts; DFH decides. |
| Question: does Get Pre Need Info bring the wishes across? | **Yes.** Live `getPreNeedInfo` reads the latest Pre_Need_Questionnaire record of the Pre-Need Deal: Place_of_Worship -> Church_Chapel, Obituary_Information -> Obituary_Info, Flowers, Programme_Style -> Programmes, Inscription -> Headstone_Epitaph1, Cemetery + burial address -> Place_of_Internment, Disposition -> Service_Type / Casket_or_Urn / Deal Type. Everything else (ceremony, imagined service, songs, readings, prayers, clothing, ashes, interment type and description, headstone type, additional instructions, persons responsible) goes into a "PRE-NEED WISHES" block in `Funeral_Special_Instructions` and the "Pre-Need info pulled" Note. It also copies `Pre_Need_Specialist`. All blank-only. | No change. |

## Build

| Piece | Change |
|---|---|
| CRM module `Pre_Need_Questionnaire` | +2 fields: `Pre_Planner_Is_IFR` (Yes/No), `Beneficiary_Date_of_Birth` (Date) |
| Creator `getDeal` | also returns `ifrDateOfBirth` (Deal Account's `Date_of_Birth`) |
| Creator `getQuestionnaireForDeal` | also returns `Pre_Planner_Is_IFR`, `Beneficiary_Date_of_Birth` |
| Creator `submitFinalWishes` | saves the 2 answers on the CRM record. After a successful write: DOB -> Account if blank; Note on the Deal if the IFR answer disagrees with `Pre_Need_Payer_Or_Beneficiary`, or the DOB disagrees with the Account (only when that answer is new or changed) |
| CRM `createpreneeddealfromcontact` | writes `Pre_Need_Payer_Or_Beneficiary`; payer = IFR case also fills the payer Contact's blank DOB |
| Questionnaire widget | required DOB field (prefilled, future dates refused); sends and restores the IFR answer |
| Launcher widget | fills `Pre_Need_Specialist` (blank-only); `Pre_Need_Date` also on a resend if blank |
| Contact widget | DOB required (button disabled until filled; future dates refused) |

## Status

Built 2026-09-30, not applied, not tested. Widget zips rebuilt. Repo not committed.
