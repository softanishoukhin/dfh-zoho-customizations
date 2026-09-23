# ZP-TBD-75 -- Pre-Need payment schedule rework

Source: Andrea's task doc `D:\Office\Andrea_Projects\DFH\projectDocuments\t18.txt`. Investigated
against live CRM on 2026-09-23. **Applied to live CRM and confirmed working by live testing,
2026-09-23.**

## Problem

`button.calculateInstallmentAmount` splits `Contract_Value - Pre_Need_Deposit_Amount` into 3 always-
equal parts via the org variable `Total_Installments` (hardcoded `3`), ignoring the actual dates/
amounts in the contract (e.g. Nastassia Hedge: 50% deposit + 25% installment on a specific date + 25%
final balance on a specific date). `Deals.Number_of_Installments` (picklist 2/3/4) is defined but has
zero live references.

## Decisions (confirmed with user, not yet with Andrea)

| Decision | Choice |
|---|---|
| New vs. reused fields | Reuse `Pre_Need_Deposit_Amount` / `Pre_Need_Balance_Due_Date` (already live); only add `Installment_Day_of_Month` and `Installment_Commencement_Date` as new fields. |
| Installment count source | Derived from the date range (`Installment_Commencement_Date` → `Pre_Need_Balance_Due_Date`, stepping by `Installment_Day_of_Month`), not from the dead `Number_of_Installments` picklist. |

## What this touches

| Item | Change |
|---|---|
| Deals fields | +2 new: `Installment_Day_of_Month` (Number), `Installment_Commencement_Date` (Date). Deals at 315/~500 custom fields -- no sparsity sweep needed. |
| `button.calculateInstallmentAmount` | Full rewrite -- date-derived period count/amounts instead of fixed 3-way split, now also writes Due_Date (old version never did), and now passes `{"trigger":{"workflow"}}` on `zoho.crm.updateRecord` -- required so the dispatcher actually runs (in-function `updateRecord` doesn't fire workflows by default; the old code got away with this because staff typed due dates in manually via the UI, a real edit that fires workflows on its own). See `guideline.md`. |
| `standalone.createInstallmentInvoice` (api_name `createinstallments`) | Defense-in-depth guard added: skip invoice creation when the target Installment slot is blank/zero. Previously had no guard at all -- was only safe because every slot was always populated under the old fixed-3 logic. |
| `createInvoiceForInstallment1/2/3` | No change needed. |
| `automation.handleWorkflowTriggerAndActionByTimelineProcess` | No change needed -- this is the actual trigger (confirmed by user 2026-09-23), gated on `returnedValue.contains("Installment_N_Due_Date") && Payment_Type=="Installments" && !isNull(Installment_N_Amount)`. Its existing `isNull` check is why the calc function must clear unused slots with `null`, not `""` -- see below. |
| `createPreNeedDepositRetainerInvoice` | Untouched. Already uses `Pre_Need_Deposit_Amount`/`Pre_Need_Balance_Due_Date` as-is. |
| `Total_Installments` org variable | No longer read anywhere after this change -- newly orphaned, left in place. |

## Sources checked

`ZohoCRM_getFunctionCode` (calculateInstallmentAmount, createInstallments, createInvoiceForInstallment1/2/3
i.e. `createinvoiceifpaymenttypeisintallments`/`createinvoiceforinstallment2`/`createinvoiceforinstallment3`,
createPreNeedDepositRetainerInvoice, handleWorkflowTriggerAndActionByTimelineProcess -- the last one
named by the user directly, not independently discovered), `ZohoCRM_getFields` (Deals -- 345 total /
315 custom fields), `ZohoCRM_getWorkflowRules` (Deals, 102 rules -- no installment-specific criteria
found; the actual trigger is a Deal-edit dispatcher function, not a rule the workflow-rules list would
surface).

## Resolved during drafting/testing (2026-09-23)

- Month-rollover date math, `{"trigger":{"workflow"}}` (singular key confirmed correct by live test),
  and no other Deals workflow rule fired unexpectedly -- all confirmed working via live testing.
- Three real Deluge bugs were caught by the user during review/testing, not discovered by this session
  independently: no `while` loop in Deluge (only `for each`+`break`), `getRecordById` returns
  Date/Number fields as String (needs explicit `.toDate()`/`.toLong()` before comparison/arithmetic),
  and in-function `updateRecord` doesn't fire workflows without `{"trigger":{"workflow"}}`. All three
  are now general standing rules in memory, not just fixed here.

## Still open

1. Confirm with Andrea the exact rounding intent -- an even 2-way split of the Nastassia contract's
   remaining balance gives J$96,437.50/96,437.50, not the stated J$96,440/~96,435. Contract itself may
   round differently than a pure even split. Not blocking (the mechanism is confirmed correct), but
   worth a follow-up.
2. Confirm in Setup UI what triggers `calculateInstallmentAmount` itself (button placement) -- not
   independently confirmed, though moot now that it's live and working.
3. Decide whether to deprecate the now-fully-dead `Number_of_Installments` picklist and the newly
   orphaned `Total_Installments` org variable, or leave both as-is.
