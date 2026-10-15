# ZP-TBD-117 -- Payment_URL field on Invoices

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: DEPLOYED + tested 2026-10-15** (user confirmed).

**Source:** `projectDocuments/PRENEED_DEV_LIST_2026-10-14.md`, ticket 10. Andrea's decision 14 Oct: the payment
link as a field (`Payment_URL`, website type) on each invoice, filled when the link is generated.

## Live facts (2026-10-15)
- Invoices has no URL field yet (76 fields; only Amount_in_JMD / USD / GBP text fields).
- Link format everywhere (copyPaymentLink, sendLinksViaWhatsApp, PN Invoices widgets):
  JMD `https://www.fygaro.com/en/pb/fcc1b731-0deb-4893-a8e8-92c3e90a913e`, USD `.../3d8fef8a-2e68-436f-9fb5-2f2783253bdb`,
  `?amount=<amount>&custom_reference=<Potential Payer id>`. Fygaro supports JMD and USD only.
- Every link path calls `refreshinvoiceamountsforpotentialpayer(crmid = payer id)`, which already writes
  Amount_in_* on the invoice -> natural place to write Payment_URL. The email button builds its link inside the
  Books email template (cf_amount_due_in_jmd + cf_crm_payer_id) but writes the same Amount_in_* map -> patched too.
- Amount = ZP-TBD-104 amount due (plan invoices: own Sub_Total + Adjustment - paid on it).
- Currency choice: Deal `Currency_Used_for_this_Deal` = USD -> USD link; JMD and GBP Deals -> JMD link.

## Files
| File | Purpose |
|---|---|
| `guideline.md` | Field + find/replace for both functions |
| `test-cases.md` | Same as the xlsx |
