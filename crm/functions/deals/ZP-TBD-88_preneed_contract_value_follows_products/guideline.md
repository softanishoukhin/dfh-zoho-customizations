# ZP-TBD-88 — Contract Value follows the products straight away; a stale payment plan is locked + flagged

**Status: built 2026-09-30, not applied, not tested.** Built on live sources pulled 2026-09-30 (`update_contract_value`,
`handleworkflowtriggerandactionbytimelineprocess`, `getpreneedcontracttype`, the Product Selection rule
"Update Contract Value for Pre Need New").

## What changes for staff

- **Contract Value updates on save.** Before, it only updated about 5 minutes after a product line was added or
  changed, and never when a line was removed. Now it updates as soon as the Deal is saved, for adds, edits and
  removals alike.
- **Contract Value can't be typed in any more** (read-only on the Pre Need layout). It's always the product total,
  so a hand-typed figure was always going to be overwritten.
- **If the products change after the payment plan was made**, the plan, its invoices and the Books retainer are
  **not** changed automatically. Instead:
  - a Note **"Contract Value no longer matches the payment plan"** goes on the Deal, saying what changed and how to
    fix it;
  - the contract **can't be sent** (button, WhatsApp link or automatic send) until the plan matches again.
- **How staff fix it:**
  - *If nothing has been paid:* delete the Deposit/Installment invoices (or the Lump Sum invoice) in CRM and the
    matching retainer/invoice in Books, then click **Calculate Installment Amount**.
  - *If a payment was taken:* speak to Accounts first.

## Pieces

| # | Item | Change | File |
|---|---|---|---|
| 1 | `standalone.checkPreNeedPlanMatchesContract` | **new** | `checkPreNeedPlanMatchesContract_NEW.deluge` |
| 2 | `standalone.recalcPreNeedContractValue` | **new** (the Update_Contract_Value calculation + lock/warn Note) | `recalcPreNeedContractValue_NEW.deluge` |
| 3 | `automation.Update_Contract_Value` | body -> calls #2 | `Update_Contract_Value_UPDATED.deluge` |
| 4 | `handleWorkflowTriggerAndActionByTimelineProcess` | +1 block at the top | patch below |
| 5 | `getPreNeedContractType` | +1 guard | patch below |
| 6 | Client scripts, Deals, layout "PC, HP" | new onLoad script: Contract Value read-only | `crm/client_scripts/ZP-TBD-88_.../contractValueReadOnly_onLoad.js` |

Apply in this order (#1 before #2, both before #3-#5).

### Steps 1-2 — new standalone functions

Setup > Functions > New Function > **Standalone**:

- `checkPreNeedPlanMatchesContract`: argument `crmid` (**String**), return type string.
- `recalcPreNeedContractValue`: argument `crmid` (**Int**), return type string.

Paste the files. Both use connection `zohooauth`.

### Step 3 — `Update_Contract_Value`

Paste `Update_Contract_Value_UPDATED.deluge` over the body. The Product Selection rule "Update Contract Value for
Pre Need New" stays as it is, as a backstop.

### Step 4 — dispatcher `handleWorkflowTriggerAndActionByTimelineProcess`

Find (the first lines of the function):

```
recordInfo = recordInfo.get("data").get(0);
// ClothesReceivedProcess
```

Between those two lines, add:

```
// ZP-TBD-88: Pre-Need Contract Value follows the products on every save (was: 5 min after a row change, never on
// a removed row). Placed first, so a Payment Type chosen in the same save builds the plan from the new value.
if(recordInfo.get("Pipeline") == "Pre Need")
{
	contractValueResult = standalone.recalcPreNeedContractValue(crmid);
	info contractValueResult;
}
```

It sits outside the `returnedValue.size() > 0` check on purpose: a save that only changed product lines may not
list any changed Deal field.

### Step 5 — `getPreNeedContractType` (every contract send point goes through it)

Find:

```
if(paymentType != "Lump Sum" && paymentType != "Installments")
{
	result.put("message","Select a Payment Type (Lump Sum or Installments) first.");
	return result.toString();
}
```

Directly **below** it, add:

```
// ZP-TBD-88: never send a contract while the payment plan was built for a different Contract Value
planCheck = standalone.checkPreNeedPlanMatchesContract(crmid).toMap();
if(planCheck.get("mismatch") == true)
{
	result.put("message",planCheck.get("message"));
	return result.toString();
}
```

### Step 6 — client script (read-only Contract Value)

Setup > Developer Hub > Client Script > New. Module **Deals**, layout **PC, HP**, event **Page > onLoad**, then paste
`contractValueReadOnly_onLoad.js`. Create it three times:

- **Create** page;
- **Edit** page;
- **Detail** page (to stop inline edit). If the Detail page reports `setReadOnly` as unsupported, delete that copy
  and tell us.

Not covered by client scripts: the **Zoho CRM mobile app** (client scripts don't run there) and the **canvas view**
"DFH Deal - MASTER TEMPLATE". If staff use either, set the field read-only in the canvas builder / tell staff.

## How it works (technical)

- **Before:** Product Selection rule "Update Contract Value for Pre Need New" (id 6503357000083554062), date/time
  trigger = row `Modified_Time` **+ 5 minutes**, once, related criteria Deals.Pipeline = Pre Need ->
  `Update_Contract_Value`. That's why Andrea saw no change for 200 s and then a "late" jump: it was the first save's
  5-minute run arriving. A deleted row has no Modified_Time, so removing a product never recalculated.
- **Now:** rule "Custom Manage - Trigger on Any Field Update" (Deals, every edit, no criteria) -> dispatcher -> first
  block -> `recalcPreNeedContractValue` (REST v8 GET, sums `qty x Unit_Price - Discount` + tax from `Products.Tax`
  text, writes `Contract_Value`/`Total_Discount`/`Total_Tax` only if changed, via `zoho.crm.updateRecord` with no
  trigger, so no loop). The Product Selection page's onSave script ("Update Subform Trigger Time") also stamps
  `Trigger_Based_On_Subform`, a Deal edit, so the dispatcher runs after a product-only save either way.
- **Mismatch** (`checkPreNeedPlanMatchesContract`): compares Contract_Value with the **Books** totals of the plan
  documents, not with Deal fields. A button re-run rewrites the Deal's schedule fields but not the deposit invoice
  or the master retainer, so the Deal fields can look fixed when the billing isn't.
  - Installments = the master retainer total (created at the full product total, ZP-TBD-74).
  - Lump Sum = the Lump Sum Books invoice total.

  Neither changes after a payment. Tolerance 1.00 (Books rounds retainers to 0.125). No Books document yet -> no
  check.
- **Note** only when Contract_Value actually changed (compared at 2 decimals) **and** the plan doesn't match, so the
  5-minute backstop run doesn't add a second one.
- **Amount** is not touched (decision 2026-09-30): Contract_Value is the real figure for Pre-Need.

## Known limits

- Deleting a CRM invoice doesn't delete its Books document; staff delete both (the Note says so). A **Void** Deposit
  invoice still blocks a new one (`createPreNeedDepositRetainerInvoice` checks by Subject, not status), so it must be
  deleted, not voided.
- Plans made before this change are checked too, from the next time Contract_Value changes (Note) or a contract is
  sent (block).

## Rollback

| # | Rollback |
|---|---|
| 6 | Delete the three client scripts. |
| 5 | Delete the ZP-TBD-88 block from `getPreNeedContractType`. |
| 4 | Delete the ZP-TBD-88 block from the dispatcher. |
| 3 | Paste back `rollback/Update_Contract_Value_CURRENT.deluge`. |
| 1-2 | Delete the two new functions (after 3-5). |
