# ZP-TBD-75 -- Pre-Need payment schedule: real contract terms instead of a fixed 3-way split

**Status: applied to live CRM and confirmed working by live testing (2026-09-23).** Applied by hand via
the CRM function editor, per this guideline (no CRM function-code write API is available to this
session). Three real Deluge bugs were caught and fixed during drafting/testing, not after deployment --
see "Fixes found during drafting/testing" below. Still open: Andrea's confirmation on rounding intent,
and a decision on deprecating `Number_of_Installments`/`Total_Installments` (see metadata.md).

Source: Andrea's task doc (`projectDocuments/t18.txt`), using the real Nastassia Hedge contract as
the worked example. Investigated against live CRM on 2026-09-23.

## What's wrong today

`button.calculateInstallmentAmount` divides `Contract_Value - Pre_Need_Deposit_Amount` by the org
variable `Total_Installments` (hardcoded `"3"`) into three **always-equal** parts, written to
`Installment_1_Amount`, `Installment_2_Amount`, `Installment_3_Amount`. It ignores the actual dates
and amounts written in the contract. `Number_of_Installments` (Deals picklist, 2/3/4) is defined but
has zero references anywhere in CRM -- confirmed dead.

## Decisions made with the user before building this

1. **Reuse the existing live fields.** `Pre_Need_Deposit_Amount` and `Pre_Need_Balance_Due_Date`
   already exist and already drive `createPreNeedDepositRetainerInvoice` -- they are not renamed.
   Only 2 of Andrea's 4 requested fields are genuinely new.
2. **Installment count is derived from the date range**, not from `Number_of_Installments` (which
   stays dead -- not repurposed here). Number of periods = how many `Installment_Day_of_Month` dates
   fall between `Installment_Commencement_Date` and `Pre_Need_Balance_Due_Date`, plus the balance date
   itself as the final period.

## New Deals fields to add

| Field label | API name | Type | Notes |
|---|---|---|---|
| Installment Day of Month | `Installment_Day_of_Month` | Number | 1-31. Which day each monthly installment falls on. |
| Installment Commencement Date | `Installment_Commencement_Date` | Date | When the first installment (after the deposit) is due. |

Deals is at 315/~500 custom fields (checked 2026-09-23) -- room for these 2 without a field-limit
sparsity sweep. Add both to the Pre-Need section of the Deal layout, next to `Pre_Need_Deposit_Amount`
and `Pre_Need_Balance_Due_Date`.

## The calculation rewrite

`button.calculateInstallmentAmount` -- full replacement in `calculateinstallmentamount_UPDATED.deluge`
(current live source snapshotted in `rollback/calculateinstallmentamount_CURRENT.deluge`).

Key behavior changes:
- `installment_base = Contract_Value - Pre_Need_Deposit_Amount` (unchanged).
- Builds the due-date list: `Installment_Commencement_Date`, then +1 calendar month on
  `Installment_Day_of_Month` repeatedly while the date is before `Pre_Need_Balance_Due_Date`, then
  appends `Pre_Need_Balance_Due_Date` itself as the final period. The balance due date **is** the last
  installment -- there's no separate "final balance" field, matching how the old 3-way split already
  worked (the last slot was always the remainder).
- `installment_base` is split evenly across however many periods that produces, last period absorbs
  the rounding remainder -- same rounding technique as today, just count-aware instead of fixed at 3.
- Still capped at 3 periods (`Installment_1/2/3`) since that's all the Deal has slots for. If the date
  range needs a 4th payment, the function now returns a clear error instead of silently dropping a
  payment or throwing an index-out-of-bounds like the old code would have.
- **Always blanks all 3 slots first**, then fills only however many are actually used. This matters:
  see the invoice-guard fix below for why a blank slot has to stay blank, not stale.
- Deposit-covers-everything case (`installment_base <= 0`) now returns a clear message and blanks all
  3 slots, instead of dividing zero by the org variable.

`Total_Installments` org variable is no longer read anywhere -- it's now orphaned. Left in place; flag
for cleanup later if wanted.

⚠️ **Verify before applying:** the month-rollover logic (`cursorDate.getMonth()` /
`cursorDate.getYear()` / string rebuild → `.toDate()`) was written defensively because a Deluge
`addMonth()` date built-in wasn't confirmed available in this org's runtime. Deluge also has no
while/for loop -- only `for each` -- so the rollover iterates a fixed 6-entry dummy list and `break`s
early once `cursorDate >= balanceDueDate` (the real cap is the ">3 periods" check right after). Test
the date math in a CRM function's debug console against a couple of real date pairs before relying on
it (see Test plan).

`recordInfo.get("Pre_Need_Balance_Due_Date")` / `recordInfo.get("Installment_Commencement_Date")` come
back from `zoho.crm.getRecordById` as **String**, not Deluge's `Date` type -- comparing Strings with
`>`/`<`/`>=` throws `Comparison of non numeric expression is not supported`. Both are explicitly
converted with `.toDate()` right after the null-check (same reason the old code needed `.toLong()` on
the `Total_Installments` org variable before using it numerically). `Installment_Day_of_Month` is
converted with `.toLong()` for the same reason before it's used in `<`/`+` arithmetic.

## Confirmed trigger mechanism (per user, 2026-09-23)

`createInvoiceForInstallment1/2/3` (`createinvoiceifpaymenttypeisintallments` /
`createinvoiceforinstallment2` / `createinvoiceforinstallment3`) are fired from inside
`automation.handleWorkflowTriggerAndActionByTimelineProcess` -- a large multi-purpose dispatcher that
runs on every Deal edit and checks which fields changed via `standalone.isThisFieldUpdatedThenGetValue`.
The relevant block, verbatim from live source, repeated per slot (shown for slot 1):

```deluge
if(returnedValue.contains("Installment_1_Due_Date") && recordInfo.get("Payment_Type") == "Installments" && !isNull(recordInfo.get("Installment_1_Amount")))
{
	createInvoiceForInstallment1 = invokeurl [ url :".../functions/createinvoiceifpaymenttypeisintallments/actions/execute?...&crmid=" + crmid  type :GET ];
}
```

Three things have to be true for slot N to fire: (1) `Installment_N_Due_Date` was part of this save's
changed fields, (2) `Deals.Payment_Type == "Installments"`, (3) `Installment_N_Amount` is not null.
No change is needed to this dispatcher itself -- see the two fixes below, both of which work *with*
its existing guard rather than around it.

Still not confirmed: what triggers `button.calculateInstallmentAmount` itself (custom button
placement) -- no CRM tool available to this session lists buttons on a layout.

## Three fixes this rework depends on

**1. Blank unused slots with `null`, not `""`.** `calculateinstallmentamount_UPDATED.deluge` always
writes all 6 `Installment_1/2/3_Amount`/`_Due_Date` fields on every run (see below), clearing whichever
slots aren't used this time. Since `calculateInstallmentAmount` always sets `Installment_N_Due_Date`
(even to blank), `returnedValue.contains("Installment_N_Due_Date")` is true on every run for every
slot -- so the dispatcher's `!isNull(Installment_N_Amount)` check is the *only* thing stopping it from
calling `createInvoiceForInstallmentN` for an unused slot. An empty string (`""`) on a currency field
is not guaranteed to read back as `isNull()` -- it can coerce to `0`, or the API can reject it outright.
`null` is the correct value to actually clear a field via `zoho.crm.updateRecord`, so the draft uses
`null` for all 6 fields, not `""`.

**2. Defense-in-depth guard inside `standalone.createInstallmentInvoice` (api_name `createinstallments`)
itself.** Even with fix #1, `standalone.createInstallmentInvoice` has **no guard of its own** today --
it was never needed, because `Total_Installments` was always `3`, so every slot was always populated.
As a backstop against a future edge case (e.g. an installment amount that rounds to exactly `0` while
still being non-null, or the dispatcher's `Payment_Type`/field-changed conditions someday changing),
`createinstallments_UPDATED.deluge` (current live source snapshotted in
`rollback/createinstallments_CURRENT.deluge`) adds a guard immediately after fetching `recordInfo`:

```deluge
guardAmount = ifnull(recordInfo.get(installmentAmountFieldAPI),0);
guardDueDate = recordInfo.get(installmentDueDateFieldAPI);
if(guardAmount <= 0 || isNull(guardDueDate))
{
	info "No amount/due date on " + installmentAmountFieldAPI + " for Deal " + crmid + " - installment invoice not created";
	return "";
}
```

This is a single shared fix (all 3 wrapper functions call this one standalone function), so nothing
needs to change in `createInvoiceForInstallment1/2/3` or in the dispatcher.

**3. Enable workflow triggering on the `Deals` update itself.** `zoho.crm.updateRecord` called from
inside a Deluge function does **not** fire workflow rules by default -- that's exactly why the *old*
`calculateInstallmentAmount` only ever wrote `Installment_1/2/3_Amount`, never the due dates: due
dates were left for staff to type in manually via the UI, and a real UI save *does* fire workflows
normally, which is what actually ran `handleWorkflowTriggerAndActionByTimelineProcess` and created the
invoices. This rewrite now sets the due dates programmatically (the whole point of the task -- staff
shouldn't have to type them in once they're date-derived), so without explicitly enabling workflow
triggering on this update, the dispatcher would never run and no invoice would ever get created.

Both `zoho.crm.updateRecord` calls in `calculateinstallmentamount_UPDATED.deluge` pass
`{"trigger":{"workflow"}}` as a 4th argument. **Confirmed by live testing (2026-09-23): the singular
`"trigger"` key is correct** -- it fires `handleWorkflowTriggerAndActionByTimelineProcess` as intended.
DFH's own commented-out reference to this pattern inside that same dispatcher
(`//, {"triggers":{"workflow"}}`, plural) was an untested typo, not a working alternative.

## Test plan (using the real Nastassia Hedge numbers)

On a test Deal, with `Payment_Type = "Installments"` (required by the dispatcher's own gate -- see
above; without it, none of the 3 invoice functions fire regardless of amounts):
1. `Contract_Value = 385750`, `Pre_Need_Deposit_Amount = 192875`,
   `Installment_Commencement_Date = 2026-07-28`, `Installment_Day_of_Month = 28`,
   `Pre_Need_Balance_Due_Date = 2026-08-28`.
2. Click Calculate Installment Amount. Expect: `Installment_1_Amount = 96437.50` (or `96440` if
   Andrea wants the deposit itself re-entered as the rounder -- confirm against the actual contract),
   due `2026-07-28`; `Installment_2_Amount` = remainder, due `2026-08-28` (the balance date);
   `Installment_3_Amount`/`Installment_3_Due_Date` blank.
   - Note: the task doc's exact numbers (96,440 installment / ~96,435 balance) don't split perfectly
     50/25/25 off 385,750 -- confirm with Andrea whether the deposit or the split should absorb the
     rounding, since the contract itself may round differently than an even split.
3. Change `Pre_Need_Balance_Due_Date` to `2026-09-28` (2 monthly periods before balance). Expect 3
   periods used: `Installment_1` (28 Jul), `Installment_2` (28 Aug), `Installment_3` (28 Sep, balance).
4. Change it to `2026-11-28` (4 periods needed). Expect the "only 3 Installment slots" error, no
   fields written.
5. Set `Pre_Need_Deposit_Amount = Contract_Value`. Expect "Deposit covers the full contract value",
   all 3 slots blanked.
6. Re-run step 2's scenario. Clicking Calculate Installment Amount should now, by itself, fire
   `handleWorkflowTriggerAndActionByTimelineProcess` via the `{"trigger":{"workflow"}}` update -- no
   separate manual save needed. Expect an invoice created for Installment 1 and Installment 2 only --
   **no** invoice attempt for Installment 3 (blank slot, so `isNull(Installment_3_Amount)` is true and
   the dispatcher skips it), and no error in the function log. If no invoice is created at all, the
   `{"trigger":{"workflow"}}` key name likely needs adjusting (see fix #3 above) before anything else
   in this plan can be trusted.
7. Confirm `createPreNeedDepositRetainerInvoice` still fires and creates the deposit invoice as before
   -- this function is untouched by this change.

## Apply -- done, 2026-09-23

1. CRM > Setup > Developer Space > Fields > Deals: added `Installment_Day_of_Month` (Number) and
   `Installment_Commencement_Date` (Date), per the table above.
2. `calculateInstallmentAmount` replaced with `calculateinstallmentamount_UPDATED.deluge`.
3. `createInstallments` (display name "Create Installment Invoice from Deal") replaced with
   `createinstallments_UPDATED.deluge`.
4. Confirmed via live testing: calculation, due-date generation, workflow trigger, and automatic
   installment invoice creation all work as intended.

## Rollback

Paste the matching file from `rollback/` back over each function in full.
