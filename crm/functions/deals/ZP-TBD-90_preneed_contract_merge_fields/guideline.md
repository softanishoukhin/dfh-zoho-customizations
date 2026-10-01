# ZP-TBD-90 — Contract merge fields: Buyer's TRN + Disposition of Cremated Remains (clause 20)

**Source:** `projectDocuments/DEV_LIST_2026-09-29.md`, item 5d (second half). The three instalment fields in the
first half are not needed (explained to Andrea, no build).
**Status: built 2026-10-01, not applied, not tested.**

## Decisions (user, 2026-10-01)

| Point | Decision |
|---|---|
| Buyer's TRN | Entered by staff on the Contact **Create Pre-Need Deal** widget (required), saved to `Contacts.TRN`. The contract already prints `Contacts.TRN` (Sign "Text - 7"). |
| Clause 20 | Asked on the **questionnaire** (only for a cremation), saved on the Pre-Need Questionnaire record. **Printing it on the contract is on hold** — see below. |
| Contract date | **No change.** The contract keeps printing the day it is sent; `Contract_Signing_Date` stays the payment plan's date (drives Must End By). No `Contract_Date` field. |

**Why clause 20 printing is on hold:** the current Full contract template ("Pre-Need Contract – Casket",
`441773000001137101`, PDF of 2026-09-25) has clauses **1–19 only** (ends at 19 · Construction) and no Disposition of
Cremated Remains. Andrea's clause 20 is most likely in a separate **cremation** version of the contract, which is
not a Sign template yet. Asked Andrea for that contract. The sender change is kept ready in
`onhold_clause20_sender_patch.md`, to apply once it's known where clause 20 lives.

## What changes for staff and families

- **Create Pre-Need Deal** (Contact button) has a new required **Buyer (payer) TRN** box, pre-filled from the
  Contact and saved on the Contact. On "Yes, buying for self" the beneficiary TRN follows it automatically.
- **Questionnaire:** when **Cremation** is chosen, a new question appears: *"What should happen to the cremated
  remains?"* (Released to a person / Interred or scattered at a place / Other), plus a details box (the person's
  name, the place, or a description). Choosing Burial hides it and clears any earlier answer. The answer is saved on
  the Pre-Need Questionnaire record, ready for the contract.

## Apply — in this order

### Step 1 — two new fields on the CRM module **Pre-Need Questionnaire**

| Label | API name | Type |
|---|---|---|
| Disposition of Cremated Remains | `Cremated_Remains_Disposition` | Pick List: `Released to`, `Interred or Scattered at`, `Other` (exact text) |
| Cremated Remains Details | `Cremated_Remains_Details` | Single Line (255) |

Add both to the module's layout.

### Step 2 — Creator function `submitFinalWishes` (app Pre-Need Questionnaire)

Find (once, in the CRM part):

```
			crmMap.put("Additional_Instructions",ifnull(dataMap.get("Additional_Instructions"),""));
```

Directly **below** it, add:

```
			// ZP-TBD-90: contract clause 20 -- Disposition of Cremated Remains (blank for a burial)
			crmMap.put("Cremated_Remains_Disposition",ifnull(dataMap.get("Cremated_Remains_Disposition"),""));
			crmMap.put("Cremated_Remains_Details",ifnull(dataMap.get("Cremated_Remains_Details"),""));
```

### Step 3 — Creator function `getQuestionnaireForDeal`

Find:

```
		record.put("Additional_Instructions",ifnull(recData.get("Additional_Instructions"),""));
```

Directly **below** it, add:

```
		// ZP-TBD-90: contract clause 20
		savedCrd = ifnull(recData.get("Cremated_Remains_Disposition"),"").toString();
		if(savedCrd == "-None-")
		{
			savedCrd = "";
		}
		record.put("Cremated_Remains_Disposition",savedCrd);
		record.put("Cremated_Remains_Details",ifnull(recData.get("Cremated_Remains_Details"),"").toString());
```

### Step 4 — upload the two widgets (zips rebuilt 2026-10-01)

| Widget | Zip | Where |
|---|---|---|
| Create Pre-Need Deal (Contact) | `widgets\preNeedFromContact\preNeedFromContactWidget\dist\preNeedFromContactWidget.zip` | CRM > Setup > Developer Hub > Widgets |
| Pre-Need questionnaire | `widgets\Pre-Need Questionnaire\Pre_Need_Questionnaire\dist\Pre_Need_Questionnaire.zip` | Creator app "Pre-Need Questionnaire" > Widgets |

Copies of the changed files are in `widget/`.

## How it works (technical)

- **Buyer TRN:** the widget loads `Contacts.TRN` into the new `#buyerTRN` box. The Create button needs it filled. On
  submit, the widget saves it with `ZOHO.CRM.API.updateRecord` (Contacts, only if changed) **before** calling
  `createpreneeddealfromcontact`, so that function needs no change. On "Yes" the `#benTRN` box mirrors it, and goes
  to `Accounts.Deceased_TRN` as before.
- **Clause 20:** `#cremRemainsBlock` shows only while Disposition = Cremation. `buildData()` sends
  `Cremated_Remains_Disposition` / `Cremated_Remains_Details` as blank for a burial, so a change to burial clears
  them. `submitFinalWishes` writes them to the CRM record (not to the Creator form `Final_Wishes_Form`), and
  `getQuestionnaireForDeal` returns them for resume.

## Not changed

- Contract senders (`sendPreNeedFuneralContractEmail` / `...Embedded`): clause 20 printing is on hold (see above).
- `createpreneeddealfromcontact`, `Final_Wishes_Form`.

## Rollback

| Step | Rollback |
|---|---|
| 4 | Re-upload the previous widget versions from `creator/forms/pre_need_questionnaire/ZP-TBD-86_questionnaire_gaps/widget/` (`preNeedFromContactWidget/`, `Pre_Need_Questionnaire/`), re-packed with `zet pack`. |
| 3, 2 | Delete the ZP-TBD-90 blocks. |
| 1 | Hide the two fields. |
