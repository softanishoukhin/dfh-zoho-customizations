# ZP-TBD-86 — Test cases

xlsx copy: `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-86_questionnaire_gaps_test_cases.xlsx`.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| T1 | Contact widget: DOB required | Contact > Create Pre-Need Deal > Yes. Clear the DOB. | Create button stays disabled. Enter a DOB -> enabled. A future DOB -> disabled. |
| T2 | Contact widget: Yes (buying for self) | Contact with no DOB, click Yes, enter DOB, create. | Deal: Pre-Need Payer Or Beneficiary = **Beneficiary / IFR**. Account Date of Birth = entered DOB. Payer Contact DOB now filled. |
| T3 | Contact widget: No (for someone else) | Click No, enter the beneficiary incl. DOB, create. | Deal: Pre-Need Payer Or Beneficiary = **Payer**. New IFR Contact and Account both carry the DOB. |
| T4 | Specialist on first send | On the T3 Deal, click Send Pre-Need Questionnaire. | Deal: Pre-Need Specialist = your name; Pre-Need Date = today; Status = Sent. |
| T5 | Specialist not replaced | Another user resends the link on the same Deal. | Pre-Need Specialist unchanged (still the first sender). |
| T6 | Questionnaire: DOB prefill | Open the link from T4. | Beneficiary section shows "Date of Birth of the person this plan is for" pre-filled with the Account's DOB. |
| T7 | Questionnaire: DOB required | Clear the DOB, Submit. | Not submitted. Beneficiary section opens, the field is red with a message. A future date -> same. |
| T8 | Questionnaire: answers saved | Fill in, submit. | Pre-Need Questionnaire record: Is the Pre-Planner the Beneficiary (IFR)? = the answer given; Beneficiary Date of Birth = the DOB. |
| T9 | Answers restored on resume | Reopen the link. | IFR Yes/No and DOB show what was saved. |
| T10 | DOB fills a blank Account | Deal whose Account has no DOB (e.g. a Lead-converted Pre-Need). Submit the questionnaire with a DOB. | Account Date of Birth = the questionnaire DOB. No Note. |
| T11 | DOB differs from Account | Account DOB 1950-03-15; submit questionnaire with 1950-03-16. | Account unchanged. Deal Note "Pre-Need Questionnaire: please check" with the DOB line. Resubmit with the same DOB -> no second Note. |
| T12 | IFR answer disagrees with staff | Deal from T3 (Payer). Family answers **Yes** and submits. | Deal Note with the IFR line. Resubmit unchanged -> no second Note. |
| T13 | IFR answer agrees | Deal from T2 (Beneficiary / IFR). Family answers Yes. | No Note. |
| T14 | Older record | Reopen a questionnaire saved before this change. | Loads normally. IFR answer derived from names as before; DOB falls back to the Account's. |
| T15 | Get Pre Need Info unchanged | Link an at-need Deal to a Pre-Need with a submitted questionnaire; click Get Pre Need Info. | Church, Obituary, Flowers, Programmes, Epitaph, Place of Internment filled; "PRE-NEED WISHES" block in Special Instructions and the Note; Pre-Need Specialist copied. |
