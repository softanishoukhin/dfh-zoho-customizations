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

## 4. Attach to an existing Invoice workflow rule
The Books Invoice module is at its workflow-rule limit (2026-09-30), so no new rule is created. Instead add the
function as an **extra action** on an existing Invoice rule:
- The rule must fire on **Created or Edited**, with no criteria (or criteria every At-Need invoice meets).
- Candidates: `triggerOnInvoiceUpdate`, `Sync Invoice between CRM and Books` -- use whichever matches the above.
  Not `updateInvoiceToXero` (edit only, needs a Xero invoice id + CRM invoice id).
- Open the rule > Add Action > Custom Function > `hillviewPreNeedRetainerSync` > Save.
The function filters itself (exits immediately when the invoice has no Hillview Pre-Need line), so running on every
invoice save is safe.

If no rule fits, fallback = convert the function to an incoming webhook and call it from an existing invoice function.

**Watch in TC-14:** if recording the payment does not count as an invoice edit, the retainer is only marked paid on
the next save of the invoice. If so, add a call from `allprocessonpaymentcreateandupdate` (runs on every payment).

## 5. Check before go-live
- Tell Dale: each Hillview retainer posts a Receive Money into BNS DFH-Checking (coded PRE NEED) like other
  retainers, on top of the At-Need invoice and its payment (decided 2026-09-29, see metadata.md).
- Run the test set (TC-01 first: api names of the two new fields).

## Rollback
Remove the `hillviewPreNeedRetainerSync` action from the host Invoice workflow rule (leave the rule's own action as is). Retainers already created stay; void any that
are not wanted by hand (and delete their "Paid via At-Need Invoice" payment first if one was recorded).
