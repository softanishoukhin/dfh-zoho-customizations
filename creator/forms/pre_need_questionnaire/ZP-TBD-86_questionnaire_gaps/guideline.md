# ZP-TBD-86 — Questionnaire gaps: Specialist, IFR answer, DOB — Deployment guideline

**Status: built 2026-09-30, not applied, not tested.** Built on live sources: CRM function
`createpreneeddealfromcontact` pulled 2026-09-30; Creator functions from the `Pre-Need_Questionnaire.ds` exported
2026-09-30 13:39; all three widgets' local sources confirmed byte-identical to their deployed zips before editing.

## What changes for staff and families

- **Pre-Need Specialist** is filled automatically with the name of the staff member who sends the questionnaire link
  (Send Pre-Need Questionnaire button). Only a blank field is filled, so a resend by someone else doesn't replace it.
  **Pre-Need Date** is still set on the first send (and now also on a resend if it was blank).
- **Create Pre-Need Deal** (Contact button): **Date of Birth is now required**. The button stays disabled until it's
  filled in, and a future date is refused. The staff Yes/No ("is the payer also the person the funeral is for?") is
  now saved on the Deal in **Pre-Need Payer Or Beneficiary**: Yes = `Beneficiary / IFR`, No = `Payer`.
- **Questionnaire:** new required field **"Date of Birth of the person this plan is for"** in the Beneficiary
  section. It's pre-filled from the Deal's Account when the Account already has a DOB.
- The family's **"Is the Pre-Planner also the Beneficiary?"** answer is now **saved** on the Pre-Need Questionnaire
  record and shown again when they reopen the link.
- On submit, the DOB is written to the **Deal's Account** (`Date_of_Birth`, the field the at-need Pre-Need match
  reads), but only if the Account has no DOB yet.
- On submit, staff get a **Note on the Deal** ("Pre-Need Questionnaire: please check") when:
  - the family's IFR answer disagrees with how staff set the Deal up, or
  - the family's DOB differs from the one already on the Account.

  The Note is written only when that answer is new or changed, never on every resubmission.

## Apply — in this order

### Step 1 — two new fields on the CRM module **Pre-Need Questionnaire**

| Label | API name | Type |
|---|---|---|
| Is the Pre-Planner the Beneficiary (IFR)? | `Pre_Planner_Is_IFR` | Pick List: `Yes`, `No` |
| Beneficiary Date of Birth | `Beneficiary_Date_of_Birth` | Date |

The module has 34 custom fields, so there's plenty of room. The API names must match exactly; if CRM generates
different ones, tell us before continuing. Add both to the module's layout.

No new Deal fields: `Pre_Need_Specialist`, `Pre_Need_Date` and `Pre_Need_Payer_Or_Beneficiary` already exist
(ZP-TBD-70) and were simply never written.

### Step 2 — Creator Custom API functions (app "Pre-Need Questionnaire" > Microservices > Custom API functions)

Paste each full body over the existing function:

| Function | File |
|---|---|
| `getDeal` | `getDeal_UPDATED.dg` |
| `getQuestionnaireForDeal` | `getQuestionnaireForDeal_UPDATED.dg` |
| `submitFinalWishes` | `submitFinalWishes_UPDATED.dg` |

`completePreNeedQuestionnaire` and `getCreatorRecord` are unchanged. The `Final_Wishes_Form` form itself is
unchanged too: no new Creator fields. The two new answers are stored on the CRM record only.

### Step 3 — CRM function `createpreneeddealfromcontact` (two small additions)

**3a.** Find:

```
	dealMap.put("Contact_Name",dealContactMap);
```

Directly **below** it, add:

```
	// ZP-TBD-86: keep the staff's "is the payer also the IFR?" answer on the Deal
	if(isPayerSame == "true")
	{
		dealMap.put("Pre_Need_Payer_Or_Beneficiary","Beneficiary / IFR");
	}
	else
	{
		dealMap.put("Pre_Need_Payer_Or_Beneficiary","Payer");
	}
```

**3b.** Find (Scenario 1, payer = IFR):

```
		selfAccountLinkMap.put("Contact_Type","Payer");
```

Directly **below** it, add:

```
		// ZP-TBD-86: the payer IS the IFR here -- keep their Contact DOB too, if it was blank
		if(!isNull(beneficiaryDOB) && beneficiaryDOB != "" && isNull(payerContact.get("Date_of_Birth")))
		{
			selfAccountLinkMap.put("Date_of_Birth",beneficiaryDOB);
		}
```

Save.

### Step 4 — upload the three widgets (zips already rebuilt 2026-09-30 in each widget's `dist/`)

| Widget | Zip | Where |
|---|---|---|
| Pre-Need questionnaire | `widgets\Pre-Need Questionnaire\Pre_Need_Questionnaire\dist\Pre_Need_Questionnaire.zip` | Creator app "Pre-Need Questionnaire" > Widgets |
| Send Pre-Need Questionnaire (launcher) | `widgets\copyPreNeedQuestionnaireLink\copyPreNeedQuestionnaireLinkWidget\dist\copyPreNeedQuestionnaireLinkWidget.zip` | CRM > Setup > Developer Hub > Widgets |
| Create Pre-Need Deal (Contact) | `widgets\preNeedFromContact\preNeedFromContactWidget\dist\preNeedFromContactWidget.zip` | CRM > Setup > Developer Hub > Widgets |

Copies of the changed source files are in `widget/` in this folder.

## Not verified — confirm on the first test

1. **Notes from Creator.** The Deal Note is posted by `submitFinalWishes` through the `zohocrm_connection`
   connection. If that connection's scopes don't include Notes, the Note silently won't appear. The response carries
   `dealNoteResponse` / `zp86Error`, which the widget logs to the browser console. Fix by adding the Notes scope to
   the connection.
2. **Meaning of `Pre_Need_Payer_Or_Beneficiary`.** We read it as "the buyer on this Deal is only the Payer, or also
   the Beneficiary / IFR". If DFH meant something else by that field, tell us.

## Known limits

- Pre-Needs created from a **Lead conversion** (`convertLeadOnChangingLeadStatus`) don't go through the Contact
  button, so they get no staff Yes/No and no required DOB there. The questionnaire's required DOB still fills the
  Account.
- Existing Deals keep a blank Specialist until the next time someone sends (or resends) the questionnaire link.

## Rollback

| Step | Rollback |
|---|---|
| 4 | Upload the previous widget versions: questionnaire = `../ZP-TBD-XX_questionnaire_beneficiary_ifr_defaults/widget/`; launcher = `crm/functions/deals/ZP-TBD-70_pre_need_questionnaire_build/copyPreNeedQuestionnaireLinkWidget/`; Contact widget = `widget/rollback_preNeedFromContactWidget/widget.html`. Re-pack each with `zet pack`. |
| 3 | Delete the two ZP-TBD-86 blocks. |
| 2 | Paste back `rollback/getDeal_CURRENT.dg`, `rollback/getQuestionnaireForDeal_CURRENT.dg`, `rollback/submitFinalWishes_CURRENT.dg`. |
| 1 | Hide the two fields (deleting them loses the saved answers). |
