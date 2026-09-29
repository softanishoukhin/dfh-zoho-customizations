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

## 4. Workflow rule
Settings > Automation > Workflow Rules > New
- Name `Hillview Pre-Need Retainer`, Module **Invoice**
- When: **Created or Edited**, "any field is updated", execute every time the rule is triggered
- Criteria: none
- Action: Custom Function `hillviewPreNeedRetainerSync`

## 5. Check before go-live
- Tell Dale: each Hillview retainer posts a Receive Money into BNS DFH-Checking (coded PRE NEED) like other
  retainers, on top of the At-Need invoice and its payment (decided 2026-09-29, see metadata.md).
- Run the test set (TC-01 first: api names of the two new fields).

## Rollback
Deactivate the workflow rule `Hillview Pre-Need Retainer`. Retainers already created stay; void any that
are not wanted by hand (and delete their "Paid via At-Need Invoice" payment first if one was recorded).
