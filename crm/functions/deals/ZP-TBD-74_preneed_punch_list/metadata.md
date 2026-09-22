# ZP-TBD-74 -- Pre-Need punch list (2 blockers, 5 fixes, 2 new features)

Andrea's punch list on top of the Pre-Need build (ZP-TBD-68/69/70, ZP-TBD-73). Task ID `ZP-TBD-74` taken
from the tag already present in the live `createRetainerInvoiceInBooks` code for B2, applied here
consistently for the whole list. Verified against live CRM/Books/Creator on 2026-09-22.

| Item | Status | Evidence |
|---|---|---|
| B1 -- contract button doesn't send | **Confirmed done** | `sendPreNeedFuneralContract` uses `zoho.sign.createUsingTemplate(..., is_quicksend:"true")` -- Zoho Sign emails the request directly; no discarded URL. `sendPreNeedFuneralContractEmbedded` returns `sign_url` for an on-site embedded flow. Flag: orphaned 3rd function `sendPreNeedContract` (Writer-based, no live caller) -- see guideline.md. |
| B2 -- 1 Deal = 1 master retainer | **Confirmed done** | `createRetainerInvoiceInBooks` (ZP-TBD-74 block) links Deposit/Installment 1-3 CRM Invoices to one existing Books retainer via sibling-invoice lookup instead of creating a new one each time. Trigger: active workflow "Create Invoice in Books". |
| F1 -- stop Pre-Need welcome email | **Not done** -- fix drafted, not applied | `populateCRMID` still unconditionally sends template `6503357000020253003` for `Type == "Pre Need"`. Guideline + before/after diff in `guideline.md`; `populatecrmid_UPDATED.deluge` ready to paste in. Workflow itself correctly left active per Andrea's instruction. |
| F2 -- contract TRN from Contact, not Account | **Confirmed done** | New `Contacts.TRN` field (text, id `6503357000083368034`). Both contract functions now read `contactInfo.get("TRN")`; no reference to `Deceased_TRN` remains in either. |
| F3 -- notify on questionnaire->CRM sync failure | **Confirmed done** | `retryPreNeedCrmSync` (+ button wrapper) retries the CRM write 3x and clears/sets `Pre_Need_CRM_Sync_Status`/`_Error` on the Deal. Creator-side `submitFinalWishes.dg` (local workspace copy, not re-pulled live) emails `info@dfhja.com` on total failure with Deal ID/timestamp/error and points staff to the Retry button. |
| F4 -- questionnaire module on real profiles | **Confirmed done** (current state) | `Pre_Need_Questionnaire` module now assigned to exactly the org's 5 real profiles (Administrator, Standard, Operations, Management, Funeral Director) -- matches `getProfiles` exactly. Whether the original wrong assignment was intentional is unanswerable from CRM data (no permission-history API). |
| F5 -- Potential Payers still created | **Confirmed done** | "Create Invoice Payer" workflow is confirmed inactive, but `createPreNeedDepositRetainerInvoice` and `createInstallmentInvoice` each create `Potential_Payers` inline on first invoice creation -- independent of that workflow. |
| R1 -- Send Questionnaire by Email button | **Confirmed done** (button placement not independently listable) | `sendPreNeedQuestionnaireEmail` builds/preserves the edit URL and sends template `6503357000083377766` ("Pre-Need Final Wishes Questionnaire") to the Contact's email. `_buttonBody` wrapper follows the same pattern as every other working custom button in this org. CRM tools have no "list buttons on layout" call, so on-layout visibility wasn't independently re-checked. |
| R2 -- Relationship picklist consistency | **Partially done -- needs a decision** | Widget/Creator/CRM subform all use the same 15-value list (confirmed identical). Not literally sourced from `Relation_to_Deceased` (the only matching Contacts field: 18 values, scrambled display/actual pairs) as Andrea's wording asked. See guideline.md for the two ways to close this out. |

## Sources checked
- CRM: `ZohoCRM_getFunctionCode` (populateCRMID, sendPreNeedFuneralContract, sendPreNeedFuneralContractEmbedded, sendPreNeedContract, createRetainerInvoiceInBooks, createPreNeedDepositRetainerInvoice, createInstallmentInvoice, retryPreNeedCrmSync, sendPreNeedQuestionnaireEmail), `getWorkflowRules` (Deals, Invoices), `getFields`/`getPickListValues` (Contacts, Pre_Need_Questionnaire subform), `getModuleByApiName` (Pre_Need_Questionnaire), `getProfiles`, `getEmailTemplates`.
- Creator: `ZohoCreator_getFormMetadata` (Final_Wishes_Form / Persons_Responsible subform).
- Local workspace: `Pre-Need Questionnaire\Pre_Need_Questionnaire\functions\submitFinalWishes.dg`, `app\app.js` (PR_RELATIONSHIP_OPTIONS).

## Open before this can be called fully complete
1. Apply the F1 fix (guideline.md) and retest.
2. Get a decision on R2's source-field mismatch.
3. Decide whether to delete/deprecate the orphaned `sendPreNeedContract` function (B1 flag).
