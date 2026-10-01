# ZP-TBD-XX — Questionnaire: Beneficiary/IFR defaults from the Pre-Need Deal

Builds on ZP-TBD-70 (questionnaire) and ZP-TBD-68 (Contact "Create Pre-Need Deal" button).

## Andrea's requirement

> On the questionnaire, we need some defaults to set based on whether the person is planning and
> paying for themself or planning and paying for someone else. The person paying tab is fine.
> Pre planner is fine and should be the name of the person responsible for planning, whether they
> are intended Funeral recipient or not. Person responsible should be renamed to Beneficiary and
> include the name of the IFR. The button for I am same as IFR should prefill based on how the form
> is filled out from the contact record button that creates the preneed deal.

- **Person Paying** is the Contact button widget (`preNeedFromContactWidget`). No change.
- **Pre-Planner**: no change. It still defaults to the Deal's Contact (the payer).

## What changes (plain language)

1. The Pre-Planner section gets a new question: **"Is the Pre-Planner also the Beneficiary (the
   person the funeral is for)?"** with Yes and No options.
   - It is pre-selected from the staff's answer on the Contact button: **Yes** if staff chose "payer
     is also the person the funeral is for", **No** otherwise.
2. **"Persons Responsible" is renamed to "Beneficiary"**, with a note that the Beneficiary is the
   Intended Funeral Recipient (IFR).
   - The IFR's name (from the Deal's Account) is filled into the Beneficiary list automatically.
3. If the family changes the Yes/No answer:
   - **Yes:** the Pre-Planner's name is copied into the Beneficiary row.
   - **No:** a row holding the Pre-Planner's name is switched back to the IFR from the Deal, or
     cleared if the IFR from the Deal is the Pre-Planner themself.

## Technical

### How the staff's answer is recovered
`createPreNeedDealFromContact` does not store `isPayerSame` in a field. Deals is at its field
limit, so we did not add one. The answer is recovered from what that function leaves behind:

| Staff answer | Trace on the Deal | `payerIsIfr` |
|---|---|---|
| No (Scenario 2) | a Contact with the **IFR** Contact Role (`GET /crm/v7/Deals/{id}/Contact_Roles`) | `"false"` |
| Yes (Scenario 1) | no IFR role, and the payer Contact's `Account_Name` = the Deal's `Account_Name` | `"true"` |
| Neither (e.g. old Lead-created Deals) | — | `""` → widget compares the Pre-Planner name with the IFR name |

The IFR's name is read from the Deal's Account: `Deceased_First_Name`/`Deceased_Last_Name`. If
both are blank, it falls back to splitting `Account_Name`.

### Storage
- No new fields. The Beneficiary rows are still the `Persons_Responsible` subform in both the
  Creator form `Final_Wishes_Form` and the CRM module `Pre_Need_Questionnaire`. `submitFinalWishes`
  and `getQuestionnaireForDeal` are unchanged.
- The Yes/No answer is not saved. On resume it is re-derived from the saved Beneficiary rows:
  - **Yes** if any row has the Pre-Planner's name, otherwise **No**.
  - Only if no Beneficiary names were saved at all: the IFR from the Deal is filled in and the
    toggle takes the Deal-derived default.
- Saved rows are never topped up with the Deal's IFR. An earlier build did that, and it broke
  TC-09. On a buying-for-self Deal where the family answered No and entered someone else, the
  Pre-Planner was re-added as a row and flipped the toggle to Yes. All 4 questionnaires that
  predate this change are test records (checked 2026-09-28), so nothing needs back-filling.

### Files
| File | Change |
|---|---|
| `functions/getDeal.dg` | + Account GET, + Contact_Roles GET; returns `ifrFirstName`, `ifrLastName`, `payerIsIfr` |
| `widget/widget.html` | Pre-Planner Yes/No radios `Pre_Planner_Is_IFR`; section renamed to Beneficiary + hint |
| `widget/app.js` | `SYS.ifrFirst/ifrLast/payerIsIfr`; `applyIfrDefaultsFresh()`, `applyIfrDefaultsOnResume()`, `Pre_Planner_Is_IFR` change handler |

## Apply steps

1. **getDeal Custom API function** (Creator → Pre-Need Questionnaire → Microservices → Custom API
   `getDeal`, function `getDeal`). This repo copy was built on top of the ZP-TBD-70 repo copy
   (last changed 2026-09-18). **Before pasting, diff it against the live function.** If live has
   changed since then, merge the `ZP-TBD-XX` blocks onto live instead of replacing it.
   - `zohocrm_connection` needs read access to Accounts and to Deals Contact Roles. If either call
     is refused, it fails safe (blank name / blank default), so check the test results below.
2. **Widget:** zip and upload the updated `app/` (same `Pre_Need_Questionnaire` widget, same
   perma-link, no config change).
3. **Optional (label only, API names unchanged):** rename the subform label "Persons responsible"
   to "Beneficiary" on the Creator form `Final_Wishes_Form`, and on the CRM module
   `Pre_Need_Questionnaire`, so staff see the same wording.

## Test cases

Full set (16 cases, with pre-conditions, steps and a Status column):
`widgets/testCases/ZP-TBD-XX_Questionnaire_Beneficiary_IFR_Defaults_Test_Cases.xlsx`. Summary:

| # | Setup | Expected |
|---|---|---|
| 1 | New Deal from Contact, staff answer **Yes** (Mary for herself). Open questionnaire link. | Pre-Planner = Mary; "Is the Pre-Planner also the Beneficiary?" = **Yes**; Beneficiary row 1 = Mary |
| 2 | New Deal from Contact, staff answer **No** (Mary pays for mother Joan). Open link. | Pre-Planner = Mary; toggle = **No**; Beneficiary row 1 = Joan |
| 3 | Case 2, family switches toggle to **Yes** | Beneficiary row Joan → Mary |
| 4 | Case 3, switch back to **No** | Beneficiary row Mary → Joan |
| 5 | Case 1, family switches to **No** | Beneficiary row Mary is cleared (the IFR from the Deal is Mary herself) |
| 6 | Case 2: submit, then reopen the link | Toggle = **No**, Joan still listed, other answers intact |
| 7 | Case 1: submit, then reopen | Toggle = **Yes**, Mary listed |
| 8 | Case 2 with an extra Beneficiary row added (e.g. a son) → submit → reopen | Both rows kept; toggle = **No** |
| 9 | Questionnaire saved with **no** Beneficiary names → reopen | IFR name filled in, toggle = Deal default |
| 9b | Buying-for-self Deal, family picks **No** and enters Joan → submit → reopen | Toggle = **No**, only Joan listed (no Mary row re-added) |
| 10 | Older Lead-created Pre-Need Deal | IFR name filled from the Account; toggle defaults by name comparison, or is left unselected if the Account has no name |
| 11 | Submit in any case → check the CRM `Pre_Need_Questionnaire` record + Creator record | Beneficiary rows saved in the Persons Responsible subform exactly as shown |
