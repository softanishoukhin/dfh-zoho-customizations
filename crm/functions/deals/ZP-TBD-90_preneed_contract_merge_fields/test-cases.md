# ZP-TBD-90 — Test cases

| # | Scenario | Steps | Expected |
|---|---|---|---|
| T1 | Buyer TRN required | Contact > Create Pre-Need Deal, clear the Buyer TRN box. | Create button stays disabled. |
| T2 | Prefill | Contact that already has a TRN. | Buyer TRN box shows it. |
| T3 | Saved to Contact | Enter/change the Buyer TRN, Yes, create. | Contact's TRN = the value entered. Account Deceased TRN = same (buyer = beneficiary). |
| T4 | Buying for someone else | No, enter the beneficiary incl. their own TRN. | Contact TRN = buyer's; the new Account's Deceased TRN = beneficiary's (different). |
| T5 | Contract prints TRN | Send the contract for the T3 Deal. | Buyer's TRN printed. |
| T6 | Clause 20 hidden for burial | Questionnaire, choose Burial. | "What should happen to the cremated remains?" not shown. |
| T7 | Clause 20 for cremation | Choose Cremation -> pick "Released to a person", details "John Brown", submit. | Pre-Need Questionnaire record: Disposition of Cremated Remains = Released to; Details = John Brown. Details label read "Released to (name of the person)". |
| T8 | Resume | Reopen the link. | Same choice and details shown. |
| T9 | Switch to burial clears it | Change to Burial, submit. | Both clause-20 fields blank on the record. |
| T10 | Contract unaffected | Send the contract for the T7 Deal. | Contract goes out as before (clause 20 printing is on hold -- the current template has no clause 20). |
