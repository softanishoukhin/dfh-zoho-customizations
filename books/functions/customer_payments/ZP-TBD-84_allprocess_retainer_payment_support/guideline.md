# ZP-TBD-84 -- `allprocessonpaymentcreateandupdate`: support retainer invoice payments

**Status: built 2026-09-29, NOT applied, NOT tested.** Built on the live source pulled 2026-09-29 (already contains
the ZP-TBD-76 and ZP-TBD-82 blocks). Masked copy of the live body: `rollback/allprocessonpaymentcreateandupdate_CURRENT.deluge`.
Full updated body (keys masked, for reference): `allprocessonpaymentcreateandupdate_UPDATED.deluge`. Apply with the
find/replace steps below so the live API keys stay as they are.

## The bug (found by user 2026-09-29)

The function was written for invoice payments only. A payment on a **retainer invoice** comes back with
`"invoices": []` and the target in `"retainerinvoice_id"` (sample: PAY-K-2026-001751 on RET-K-2026-000133), so
`...get("invoices").get(0)` fails:

| Where | When it fails | Effect |
|---|---|---|
| `createmanualpaymenttocrminvoice` part, `invoiceDetails = ... get("invoices").get(0) ...` | retainer payment entered **in Books** (`cf_payment_created_from = Books`) | Function stops. The payment never reaches the CRM Invoice's `Invoice_Payers`; the Xero overpayment call and the **ZP-TBD-82 contract check never run**. |
| `preventSyncToCRMInvoice` part, `info invoiceData.get(0)...` | retainer payment created from **CRM or Fygaro** | Same stop, earlier. |

Retainer statuses do reach CRM (`syncretainerinvoicestatusbetweencrmandxero`, status only), which is why this
went unnoticed. The payment rows themselves never did.

## What changes

- **Retainer payment entered in Books:** it's now written to the CRM Invoice's `Invoice_Payers` (Payer, Amount,
  Date, Mode, Account, Books Payment ID), the same as invoice payments. The CRM Invoice is found through the
  retainer's `cf_crm_invoice_id`.
- **Retainer payment from CRM / Fygaro:** the "mark invoice as updated from CRM" step is skipped. It only exists for
  invoices (retainers have no `cf_updated_from_crm` field).
- **Exchange-rate webhook `iw_updatepaymentamount`:** called for invoice payments only, as before. A retainer
  payment keeps the amount it was entered with. See "Check" below.
- Everything after it runs again for retainer payments: Xero overpayment call, ZP-TBD-82 contract check.
- Invoice payments behave exactly as before.

## Apply

Books > Settings > Automation > Custom Functions > `allprocessonpaymentcreateandupdate` > Edit.

### Fix 1 -- CRM / Fygaro part

Find:

```
if(paymentCreatedFrom == "CRM" || paymentCreatedFrom == "Fygaro")
```

Replace with:

```
// ZP-TBD-84: invoice payments only -- a retainer invoice payment has "invoices": [] and no cf_updated_from_crm to set
if((paymentCreatedFrom == "CRM" || paymentCreatedFrom == "Fygaro") && ifnull(invoiceData,list()).size() > 0)
```

### Fix 2 -- find the CRM Invoice from an invoice OR a retainer (the line that fails)

Find these lines (inside `if(paymentCreatedFrom == "Books")`):

```
	invoiceDetails = zoho.books.getRecordsByID("invoices",organizationID,paymentDetails.get("payment").get("invoices").get(0).get("invoice_id"),"zohobooksconnection");
	info "invoiceDetails";
	info invoiceDetails;
	if(invoiceDetails.get("invoice").get("custom_field_hash").containKey("cf_crm_invoice_id"))
	{
		crmInvoiceId = invoiceDetails.get("invoice").get("custom_field_hash").get("cf_crm_invoice_id");
```

Replace with:

```
	// ZP-TBD-84: a payment is applied either to invoice(s) ("invoices" list) or to one retainer invoice
	// ("retainerinvoice_id", "invoices" is empty). Both carry cf_crm_invoice_id -> the CRM Invoice to update.
	paymentInvoicesList = ifnull(paymentDetails.get("payment").get("invoices"),list());
	paymentRetainerId = ifnull(paymentDetails.get("payment").get("retainerinvoice_id"),"");
	isRetainerPayment = false;
	crmInvoiceId = "";
	if(paymentInvoicesList.size() > 0)
	{
		invoiceDetails = zoho.books.getRecordsByID("invoices",organizationID,paymentInvoicesList.get(0).get("invoice_id"),"zohobooksconnection");
		info "invoiceDetails";
		info invoiceDetails;
		crmInvoiceId = ifnull(invoiceDetails.get("invoice").get("custom_field_hash").get("cf_crm_invoice_id"),"");
	}
	else if(paymentRetainerId != "")
	{
		isRetainerPayment = true;
		retainerInvoiceDetails = zoho.books.getRecordsByID("retainerinvoices",organizationID,paymentRetainerId,"zohobooksconnection");
		info "retainerInvoiceDetails";
		info retainerInvoiceDetails;
		crmInvoiceId = ifnull(retainerInvoiceDetails.get("retainerinvoice").get("custom_field_hash").get("cf_crm_invoice_id"),"");
	}
	if(crmInvoiceId != "" && crmInvoiceId != "null")
	{
```

(The next line, `crmInvoiceDetails = zoho.crm.getRecordById("Invoices",crmInvoiceId);`, stays as it is.)

### Fix 3 -- exchange-rate webhook for invoice payments only

**3a.** Find:

```
			updatePaymentAmountBasedOnExchangeRate = invokeurl
```

Directly **above** it, add:

```
			// ZP-TBD-84: iw_updatepaymentamount is written for invoice payments; a retainer payment is left as entered
			if(isRetainerPayment == false)
			{
```

**3b.** A few lines further down, find the end of the 10-second `Sleep_API` call and the payment re-read after it:

```
			catch (e)
			{
				info e;
			}
			paymentDetails = zoho.books.getRecordsByID("customerpayments",organizationID,paymentID,"zohobooksconnection");
```

Add a closing `}` between them:

```
			catch (e)
			{
				info e;
			}
			}
			paymentDetails = zoho.books.getRecordsByID("customerpayments",organizationID,paymentID,"zohobooksconnection");
```

So the `if` wraps: the webhook call, the `cf_amount_converted` stamp and the 10-second sleep. Save.

## Check

1. **`iw_updatepaymentamount`** (incoming webhook, not visible to us) -- if it already handles retainer payments
   (reads `retainerinvoice_id`), tell us and we'll drop the Fix 3 guard so retainer payments get converted too. For
   Pre-Need today, retainer and payment are both JMD, so nothing needs converting.
2. **CRM round trip** -- writing `Invoice_Payers` on the CRM retainer invoice may kick off
   `createPaymentsOnBooksForRetainerInvoice` (as it does for invoices via `createPaymentsOnBooks`). The row already
   carries `Books_Payment_ID`, so it takes its **update** branch (PUT on the same payment), not create. Confirm in
   test that no second Books payment appears (TC-03 in the test sheet).

## Rollback

Paste `rollback/allprocessonpaymentcreateandupdate_CURRENT.deluge` back after putting the live keys into its
`<BOOKS_WEBHOOK_ENCAPIKEY>` (3) and `<CRM_ZAPIKEY>` (1) placeholders. Or undo the 3 fixes by hand: Fix 1 -> back to
the plain `if(... "CRM" || ... "Fygaro")`; Fix 2 -> the original 6 lines; Fix 3 -> remove the `if(...){` and its `}`.
