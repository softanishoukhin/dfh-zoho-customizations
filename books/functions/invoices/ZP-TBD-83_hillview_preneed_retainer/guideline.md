# ZP-TBD-83 -- Deployment guideline

Nothing live is modified. Everything below is new, so rollback = deactivate the new workflow rule.

## 1. Books custom fields
1. Settings > Preferences > **Invoices** > Field Customization > New Custom Field
   - Label `Hillview Retainer ID`, type Text (single line). Confirm the api_name is **`cf_hillview_retainer_id`**.
   - Do not show it on the PDF template.
2. Settings > Preferences > **Retainer Invoices** > Field Customization > New Custom Field
   - Label `Hillview Source Invoice ID`, type Text. Confirm api_name **`cf_hillview_source_invoice_id`**.

If Books gives a different api_name, change it in the function (search `cf_hillview_`) before saving.

## 2. Clearing account
Banking > Add Bank Account (manual, no feed), name exactly **`Hillview Pre-Need Clearing`**, currency JMD.
It must be a Bank-type account so it can be the "Deposit To" of the retainer payment.
If the name differs, change `CLEARING_ACCOUNT_NAME` at the top of the function.
Without this account the retainer is still created, but it is not marked paid (alert email instead).

## 3. Custom function
Settings > Automation > Custom Functions > New
- Name `hillviewPreNeedRetainerSync`, Module **Invoice**
- Paste the body of `hillviewPreNeedRetainerSync_NEW.deluge`
- Uses the existing connection `zohobooksconnection` (same as the other Books functions)

## 4. Workflow rule -- reuse the inactive `addPreNeedDifferenceLineOnRetainerApply`
The Books Invoice module is at its workflow-rule limit (2026-09-30), so no new rule can be created. Checked live
2026-09-30:

| Rule | Trigger | Criteria | Fit |
|---|---|---|---|
| `addPreNeedDifferenceLineOnRetainerApply` (id 5830143000035961690) | Created or Edited, any field | none | **Use this** -- INACTIVE, only action is the superseded ZP-TBD-65 invoice-side function |
| `triggerOnInvoiceUpdate` | Edited, `invoice_balance` changes | none | Backup -- misses invoice creation |
| `Sync Invoice between CRM and Books` | Edited | 3 sub-rules with criteria | No |
| `syncStatusBetweenCRMandBooks` | Edited, `status` changes | none | No -- misses creation + line changes |

Steps:
1. Settings > Automation > Workflow Rules > `addPreNeedDifferenceLineOnRetainerApply` > Edit.
2. Rename to `Hillview Pre-Need Retainer`.
3. Remove the action `addpreneeddifferencelineonretainerapply`; add Custom Function `hillviewPreNeedRetainerSync`.
4. Keep When = Created or Edited, any field, no criteria. Save and **Activate**.

The function filters itself (exits immediately when the invoice has no Hillview Pre-Need line), so running on every
invoice save is safe.

Backup: add the function as a 2nd action on `triggerOnInvoiceUpdate` (then the retainer appears on the first balance
change -- a payment or a line change -- instead of on invoice creation).

**Watch in TC-14:** if recording the payment does not count as an invoice edit, the retainer is only marked paid on
the next save of the invoice. If so, add a call from `allprocessonpaymentcreateandupdate` (runs on every payment).

## 5. Check before go-live
- Tell Dale: each Hillview retainer posts a Receive Money into BNS DFH-Checking (coded PRE NEED) like other
  retainers, on top of the At-Need invoice and its payment (decided 2026-09-29, see metadata.md).
- Run the test set (TC-01 first: api names of the two new fields).

## Rollback
Deactivate the rule `Hillview Pre-Need Retainer` (it was inactive before this ticket). Retainers already created stay; void any that
are not wanted by hand (and delete their "Paid via At-Need Invoice" payment first if one was recorded).
