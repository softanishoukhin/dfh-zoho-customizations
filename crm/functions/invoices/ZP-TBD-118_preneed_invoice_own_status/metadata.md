# ZP-TBD-118 -- Pre-Need plan invoices carry their own status

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: DEPLOYED + tested 2026-10-15** (user confirmed).

**Source:** `projectDocuments/PRENEED_DEV_LIST_2026-10-14.md`, ticket 5 ("A fully paid deposit invoice shows as
Partially Paid"): each CRM invoice should carry its own status from its own amount and its own payment.

## Live facts (2026-10-15)
- Books function `syncretainerinvoicestatusbetweencrmandxero` (rule "Sync Status Between CRM and Books for Retainer
  Invoice", on retainer status change) copies the retainer status onto the ONE CRM invoice in the retainer's
  `cf_crm_invoice_id` = the Deposit. Correction to the ticket: it is not written onto every invoice; Installment
  invoices never get a status from payments at all (they stay Created / Sent).
- Every Deposit with a settled amount on the test Deals reads "Partially Paid" (Dale testing 375,050.03 paid of
  375,050.03; DFH Test Test 1015202603 98,900 of 98,900; ...1015202601 9,297.01 of 9,297.014).
- Per-invoice paid figure: `Payment_Made` / `Total_Paid_Amount` (formulas over the Invoice_Payers rows) are right on
  all of them; `Total_Actual_Paid_Amount` is empty for payments entered in Books (Dale testing). `Grand_Total` is
  the balance after payments; `Sub_Total` + `Adjustment` is the invoice's own amount.
- Payment rows reach the CRM invoice through createPaymentsOnBooksForRetainerInvoice (CRM-entered / Fygaro) or the
  Books hook `allprocessonpaymentcreateandupdate` (Books-entered). That hook runs on EVERY payment create/edit and
  already calls a CRM function per Deal at the end (ZP-TBD-82 autosendpreneedcontract via zapikey) after a 30 s
  wait -> the status call goes in the same loop, after the payer rows are written.
- Andrea's `wfUpdatePreNeedPaymentStatus` (Deal Payment_Status) uses Amount_Paid_To_Date / Payment_Made, not
  invoice Status -> not affected.

## Files
| File | Purpose |
|---|---|
| `updatePreNeedPlanInvoiceStatuses_NEW.deluge` | CRM standalone, arg `crmid` = Deal id, REST API key |
| `guideline.md` | Steps incl. both Books find/replace patches and the one-off backfill |
| `test-cases.md` | Same as the xlsx |
