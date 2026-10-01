# ZP-TBD-81 -- Pre-Need payment plan driven by Payment Type (Lump Sum / Installments)

**Status: built 2026-09-29, NOT applied, NOT tested.** Built on live source pulled from CRM on 2026-09-29.

## What changes for staff

- On a Pre Need Deal, staff pick **Payment Type** (`Lump Sum` or `Installments`). That's all -- the plan
  and the invoices are built automatically. No more typing a deposit, commencement date, day of month or
  balance date, and no more clicking Calculate Installment Amount first.
- **Contract Signing Date** (new) defaults to today; staff can change it and the plan rebuilds.
- **Must End By Date** (new, read-only) = Contract Signing Date + 6 months.
- **Lump Sum** -> one invoice for the full Contract Value, due in 7 days.
- **Installments** -> 50% invoice due in 7 days, then 2 x 25% installments due at the end of
  (signing month + 2) and the end of (signing month + 4).
  Example: signed 15 Oct 2026, Contract Value 400,000 -> 200,000 due 22 Oct (7 days from the day it is
  created), 100,000 due 31 Dec 2026, 100,000 due 28 Feb 2027; Must End By 15 Apr 2027.
- The Calculate Installment Amount button still works, as a manual "rebuild the plan" (e.g. after the
  products change).

## Pieces

| # | Item | Change | File |
|---|---|---|---|
| 0 | Rule "Action on Changing Different Deal Stage Action 3" | delete condition 6 (old Pay-in-Full trigger at Contract Signed) | -- |
| 1 | Deals fields | +2: `Contract_Signing_Date` (Date), `Must_End_By_Date` (Date) | -- |
| 2 | `Payment_Type` picklist | rename `Pay in Full` -> `Lump Sum` | -- |
| 3 | `standalone.setupPreNeedPaymentPlan` | **new** -- the schedule logic moved out of the button | `setupPreNeedPaymentPlan_NEW.deluge` |
| 4 | `createInvoiceIfPaymentTypeIsPaymentInFull` | Due Date today -> today + 7, only set on create; enable REST API (OAuth) | patch below |
| 4c | `standalone.updateSalesOrderAndInvoiceBasicInfo` | stop resetting a Pre Need invoice's Due Date to +1 year on every Deal edit | patch below |
| 5 | `createPreNeedDepositRetainerInvoice` | Due Date today -> today + 7 | patch below |
| 6 | `button.calculateInstallmentAmount` | body replaced by a call to #3 | `calculateinstallmentamount_UPDATED.deluge` |
| 7 | `handleWorkflowTriggerAndActionByTimelineProcess` | +1 block: Payment_Type / Contract_Signing_Date edit -> #3 | patch below |
| 8 | Deal layout | show the 2 new fields; hide the now-unused ZP-TBD-75 inputs | -- |

Apply in this order -- #3 checks for the value `Lump Sum`, so #2 must be done first, and #7 goes last so
nothing fires before the rest is in place.

## Step 0 -- remove the old Pay-in-Full trigger (before anything else)

Found live (2026-09-29): Deals workflow rule **"Action on Changing Different Deal Stage Action 3"**
(id 6503357000003769203, on Stage update), **condition 6**:

> Stage = Contract Signed AND Pipeline = Pre Need AND Payment Type = Pay in Full
> -> function "On Deal - Create Invoice if Payment Type is Payment in Full"

This is the only place in CRM that uses the value "Pay in Full". So today the Lump Sum invoice is only created
when the Deal reaches **Contract Signed**; from now on it is created as soon as Payment Type is chosen (#3).

Setup > Automation > Workflow Rules > "Action on Changing Different Deal Stage Action 3" > **delete condition 6**
(leave the other 9 conditions alone). Otherwise the invoice function runs a second time at Contract Signed and
rewrites the Lump Sum invoice's lines.

## What uses "Pay in Full" / Payment_Type (full check, 2026-09-29)

| Where | Uses | Change |
|---|---|---|
| Rule "Action on Changing Different Deal Stage Action 3", condition 6 | `Payment_Type = Pay in Full` | delete (Step 0) |
| `handleWorkflowTriggerAndActionByTimelineProcess` | `Payment_Type == "Installments"` | none (value unchanged); +1 block (Step 7) |
| `calculateInstallmentAmount` (button) | `Payment_Type == "Installments"` | body replaced (Step 6) |
| `getPreNeedInfo` (button) | prints Payment Type into a Note | none -- note will just say "Lump Sum" |
| `createInvoiceIfPaymentTypeIsPaymentInFull` | no check (Feb 2026 version had `== "Pay in Full"`; live one doesn't) | Step 4 |

How it was checked: the June 2026 export of all 417 CRM functions (`crm-functions_20260626093738`) + its
`associated_place` data; every live function changed since then that touches invoices, payments, quotes, sales
orders, Books/Xero or Pre-Need (the rest are trips, hang tags, casket graphics, Amber, Police/Hospital-only);
the conditions of all 7 Deals rules that fire on a Stage change; and the any-edit rules "Custom Manage - Trigger on
Any Field Update", "Create or Update Sales Order from Deals" and "Update Casket Price and Different Forms Received
Date". Payment Type lives only on Deals, so rules of other modules can't test it.

## Step 1 -- new Deals fields

| Label | API name | Type | Layout |
|---|---|---|---|
| Contract Signing Date | `Contract_Signing_Date` | Date | Pre-Need section, editable |
| Must End By Date | `Must_End_By_Date` | Date | Pre-Need section, **read-only** |

Deals is at 321 custom fields (checked 2026-09-29) -- no field-limit issue. The API names must match
exactly; if CRM generates a different one, tell us and we'll adjust the function.

## Step 2 -- rename the picklist value

Deals > `Payment_Type` > edit option `Pay in Full` -> `Lump Sum`. Existing Deals move with the rename.

**Code / rules that check the old text:** only condition 6 of the rule in Step 0 (deleted there). No function
compares against "Pay in Full" -- see the table above.

After renaming, tell us -- we re-read the field's API value to confirm it now reads `Lump Sum` (Zoho can keep
an old internal value after a rename; if it does, #3 needs to compare against that instead).

## Step 3 -- new standalone function

Setup > Functions > New Function > Category **Standalone**, name `setupPreNeedPaymentPlan`, argument
`crmid` (Int), return type string. Paste `setupPreNeedPaymentPlan_NEW.deluge`. Save.

Uses connection `zohooauth` (same as the other Pre-Need functions).

## Step 4 -- `createInvoiceIfPaymentTypeIsPaymentInFull`

a) **Enable REST API -> OAuth** on this function (it currently has REST API off; #3 calls it through its
execute endpoint, the same way the dispatcher calls the deposit function).

b) Due date. Find (right after the `Subject` line, outside the `if`):

```
invoiceMap.put("Due_Date",zoho.currentdate.toString("yyyy-MM-dd"));
```

Delete that line. Then, inside the `if(existingInvoiceList.size() == 0)` block, directly under
`invoiceMap.put("Invoice_Date",zoho.currentdate.toString("yyyy-MM-dd"));`, add:

```
	// ZP-TBD-81: Lump Sum is due within 7 days. Only set on create, so a re-run doesn't keep pushing it out.
	invoiceMap.put("Due_Date",zoho.currentdate.addDay(7).toString("yyyy-MM-dd"));
```

## Step 4c -- `updateSalesOrderAndInvoiceBasicInfo` (keeps the 7-day due date)

Found live 2026-09-29: rule "Create or Update Sales Order from Deals" (every Deal edit, condition 2 includes
Pre Need) -> `updateSalesOrderAndInvoiceBasicInforWorkflow` -> `standalone.updateSalesOrderAndInvoiceBasicInfo`.
It rewrites the Due Date of the Deal's `Other` invoice from the pipeline rules; Pre Need falls into the
Funeral-with-Burial branch -> **today + 1 year**. Without this patch, the first edit of the Deal after the Lump Sum
invoice is created would move its due date a year out. (Also runs from Potential Payer changes via
`udpateSalesOrderAndInvoiceBasicInfoFromPotentialPayer`.)

In the invoice part of the function, find:

```
	recordList = list();
	recordList.add(invoiceMap);
```

Directly **above** those two lines, add:

```
	// ZP-TBD-81: a Pre-Need Lump Sum invoice keeps the due date it was created with (7 days) -- never recalculated here
	if(recordInfo.get("Pipeline") == "Pre Need")
	{
		invoiceMap.remove("Due_Date");
	}
```

## Step 5 -- `createPreNeedDepositRetainerInvoice`

Find:

```
// Deposit is paid up front, so it is due immediately
invoiceMap.put("Due_Date",zoho.currentdate.toString("yyyy-MM-dd"));
```

Replace with:

```
// ZP-TBD-81: the 50% first invoice is due within 7 days, same as Lump Sum
invoiceMap.put("Due_Date",zoho.currentdate.addDay(7).toString("yyyy-MM-dd"));
```

## Step 6 -- button body

Open `Calculate Installment Amount` (`calculateinstallmentamount`), paste
`calculateinstallmentamount_UPDATED.deluge` over the whole body. The live body is snapshotted in
`rollback/calculateinstallmentamount_CURRENT.deluge`.

## Step 7 -- dispatcher

`handleWorkflowTriggerAndActionByTimelineProcess`. Find the end of the Pre-Need deposit block:

```
	if(returnedValue.contains("Pre_Need_Balance_Due_Date") && !isNull(recordInfo.get("Pre_Need_Balance_Due_Date")))
	{
		...
	}
```

Directly **after** its closing brace, add:

```
	//ZP-TBD-81: Pre-Need payment plan follows Payment_Type (Lump Sum / Installments)
	if((returnedValue.contains("Payment_Type") || returnedValue.contains("Contract_Signing_Date")) && recordInfo.get("Pipeline") == "Pre Need" && !isNull(recordInfo.get("Payment_Type")))
	{
		paymentPlanResult = standalone.setupPreNeedPaymentPlan(crmid);
		info paymentPlanResult;
	}
```

## Step 8 -- layout

Add the 2 new fields to the Pre-Need section. `Installment_Commencement_Date` and `Installment_Day_of_Month`
(ZP-TBD-75 inputs) are no longer read by anything -- hide them from the layout (don't delete yet).

## How it works (technical)

- **Trigger:** "Custom Manage - Trigger on Any Field Update" (Deals, on edit) -> dispatcher ->
  `standalone.isThisFieldUpdatedThenGetValue` lists the changed fields -> new block calls
  `standalone.setupPreNeedPaymentPlan(crmid)` when `Payment_Type` or `Contract_Signing_Date` changed on a
  `Pre Need` Deal with a Payment Type set. Deal **create** does not run the dispatcher -- Payment Type is set
  by staff on an edit (nothing in the Questionnaire sync writes it).
- **Reads** the Deal via REST v8 GET (dates come back as strings -> `.toDate()` before any math).
- **Dates:** first-of-month list for signing month +1..+7 via manual month/year rollover (the ZP-TBD-75
  pattern already proven live); end of month N = first of month N+1 `.subDay(1)`; Must End By = signing day
  in month +6, clamped to that month's last day.
- **Amounts:** 50% = `round(Contract_Value x 0.5, 2)`; remaining split in two, the 2nd installment absorbs
  the rounding cent, so the three invoices always sum to Contract_Value.
- **Writes** (one `zoho.crm.updateRecord`, deliberately **without** a workflow trigger -- the function creates
  the invoices itself, so no dispatcher block should fire a second time):
  - both types: `Must_End_By_Date`, `Contract_Signing_Date` (only if it was blank), `Installment_1..3_Amount/_Due_Date` cleared to `null`;
  - Lump Sum: `Pre_Need_Deposit_Amount` / `Pre_Need_Balance_Due_Date` cleared;
  - Installments: `Pre_Need_Deposit_Amount` = 50%, `Installment_1/2_Amount/_Due_Date`, `Pre_Need_Balance_Due_Date` = installment 2 date.
- **Invoices:**
  - Lump Sum -> `createinvoiceifpaymenttypeispaymentinfull` via `/crm/v7/functions/.../actions/execute?auth_type=oauth`
    (automation function, so REST, not a direct call). Idempotent: updates the existing `Invoice_For = Other` invoice.
  - Installments -> `createpreneeddepositretainerinvoice` via the same REST call the dispatcher already uses (skips
    if a `Deposit Invoice%` exists), then `standalone.createInstallmentInvoice(crmid, "Installment_N_Amount",
    "Installment_N_Due_Date")` directly for N = 1, 2 (updates an existing `Installment N` invoice instead of duplicating).
- **Contract:** `sendPreNeedFuneralContract` already reads `Pre_Need_Deposit_Amount` (Deposit),
  `Installment_1_Amount` + `_Due_Date` (installment amount / commencing), `Pre_Need_Balance_Due_Date`
  (balance on or before) -- the new plan fills exactly those, so the contract needs no change. Payment Type
  must therefore be chosen **before** the contract is sent.
- **Guards** (return a message, write nothing): not Pre Need; Payment Type blank; Contract Value blank/0;
  switching to Lump Sum while an active Deposit/Installment invoice exists; switching to Installments while
  an active Lump Sum (`Invoice_For` Other/blank) invoice exists. Void/Cancelled invoices are ignored.
- **Messages:** the button shows the returned text; from the dispatcher it only goes to the function log (`info`).

## Known limits (not changed by this task)

- The 50% invoice is **not** updated if the Contract Value changes afterwards (deposit function skips when a
  deposit invoice exists -- existing ZP-TBD-73 behaviour). The installment invoices **are** updated on a re-run.
- A re-run (button, or editing the signing date) rewrites installment invoices even if one was already paid.
  Only re-run before payments start.
- With the 50% due in 7 days, the ZP-TBD-77 "7 days before due" reminder lands on the creation day.

## Rollback

| # | Rollback |
|---|---|
| 7 | Delete the ZP-TBD-81 block from the dispatcher. Do this first -- it stops all new behaviour. |
| 6 | Paste `rollback/calculateinstallmentamount_CURRENT.deluge` back (fill the 3 `<ZAPIKEY>` placeholders from the dispatcher's URLs). |
| 5 | Put back `// Deposit is paid up front, so it is due immediately` + `zoho.currentdate.toString("yyyy-MM-dd")`. |
| 4c | Delete the ZP-TBD-81 `if(... "Pre Need") { invoiceMap.remove("Due_Date"); }` block. |
| 4 | Move the Due_Date line back outside the `if` with `zoho.currentdate.toString("yyyy-MM-dd")`; REST API can stay on. |
| 3 | Delete `setupPreNeedPaymentPlan`. |
| 2 | Rename `Lump Sum` back to `Pay in Full`. |
| 1 | Hide the 2 fields (deleting loses their data). |
| 0 | Re-add condition 6 to "Action on Changing Different Deal Stage Action 3": Stage = Contract Signed AND Pipeline = Pre Need AND Payment Type = Lump Sum (or Pay in Full if #2 was rolled back) -> "On Deal - Create Invoice if Payment Type is Payment in Full". |
