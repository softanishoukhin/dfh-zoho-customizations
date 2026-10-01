# ZP-TBD-92 -- Payment receipt (WorkDrive link) for retainer invoice payments

**Status: built 2026-10-01, NOT applied, NOT tested.** Built on the live source pulled 2026-10-01.
Copies of the live bodies, with keys masked, are in `rollback/`.

## The bug (reported by user 2026-10-01)

PAY-K-2026-001771 (`5830143000037650006`) got no receipt and no `Download Payment Receipt` link. The same is
true for PAY-K-2026-001772 and PAY-K-2026-001773. All three are payments on **retainer** RET-K-2026-000148
(a Pre-Need deposit).

A retainer payment has `"invoices": []` and stores its target in `"retainerinvoice_id"`. Both receipt functions
start by reading the first invoice:

```
booksInvoiceId = customer_payment.get("invoices").get(0).get("invoice_id");
```

On a retainer payment this line fails. The function stops before the Writer merge, the WorkDrive upload and
the `cf_download_payment_receipt` write, so no receipt is made and no email goes out.

| Function | Workflow | Effect on a retainer payment |
|---|---|---|
| `sendpaymentreceipt` | `Send Payment Receipt - On Create` | No receipt, no link, no email to the payer |
| `loadreceiptlink` | `GenerateReceiptOnEdit` (any edit) | No receipt, no link. The manual "edit and save to regenerate" workaround doesn't work either |
| Payment custom **button** function (generate receipt) | clicked by staff | Button fails, no receipt, no link |

The same bug was fixed in `allprocessonpaymentcreateandupdate` under ZP-TBD-84 (now live). The two receipt
functions weren't part of that fix.

## What changes

- **`sendpaymentreceipt`:** reads the invoice **or** the retainer the payment is on. On a retainer, the
  deceased name comes from the retainer's `cf_crm_invoice_id` -> CRM Invoice `Deal_Name__s`, the same way it
  does for invoices. Retainers have no `cf_is_ecommerce`, so the receipt is emailed to the payer as usual. A
  payment applied to neither one now falls back to the customer name instead of failing.
- **`loadreceiptlink` and the receipt button function:** the invoice lookup is removed. It was dead code: the line right after it sets
  `deceasedName = customer_payment.get("customer_name")` and overwrites the result. Removing it changes nothing
  for invoice payments and stops the crash on retainer payments.
- Invoice payments behave exactly as before in all three functions.

## Apply

Books > Settings > Automation > Custom Functions.

### Fix 1 -- `sendpaymentreceipt`

Find:

```
booksInvoiceId = customer_payment.get("invoices").get(0).get("invoice_id");
booksInvoiceDetailsData = zoho.books.getRecordsByID("invoices",organizationID,booksInvoiceId,"zohobooksconnection");
booksInvoiceDetails = booksInvoiceDetailsData.get("invoice");
deceasedName = "";
if(booksInvoiceDetails.get("custom_field_hash").containKey("cf_crm_invoice_id"))
{
	crmInvoiceDetails = zoho.crm.getRecordById("Invoices",booksInvoiceDetails.get("custom_field_hash").get("cf_crm_invoice_id"));
	deceasedName = crmInvoiceDetails.get("Deal_Name__s").get("name");
}
else if(booksInvoiceDetails.containKey("customer_name"))
{
	deceasedName = booksInvoiceDetails.get("customer_name");
}
```

Replace with:

```
// ZP-TBD-92: a payment is applied either to invoice(s) ("invoices" list) or to one retainer invoice
// ("retainerinvoice_id", "invoices" is empty -- Pre-Need deposits/instalments). Read the record it is on.
receiptPaymentData = zoho.books.getRecordsByID("customerpayments",organizationID,paymentID,"zohobooksconnection").get("payment");
receiptInvoicesList = ifnull(receiptPaymentData.get("invoices"),list());
receiptRetainerId = ifnull(receiptPaymentData.get("retainerinvoice_id"),"");
booksInvoiceDetails = Map();
if(receiptInvoicesList.size() > 0)
{
	booksInvoiceId = receiptInvoicesList.get(0).get("invoice_id");
	booksInvoiceDetailsData = zoho.books.getRecordsByID("invoices",organizationID,booksInvoiceId,"zohobooksconnection");
	booksInvoiceDetails = booksInvoiceDetailsData.get("invoice");
}
else if(receiptRetainerId != "")
{
	booksRetainerDetailsData = zoho.books.getRecordsByID("retainerinvoices",organizationID,receiptRetainerId,"zohobooksconnection");
	booksInvoiceDetails = booksRetainerDetailsData.get("retainerinvoice");
}
if(!booksInvoiceDetails.containKey("custom_field_hash"))
{
	booksInvoiceDetails.put("custom_field_hash",Map());
}
deceasedName = "";
if(booksInvoiceDetails.get("custom_field_hash").containKey("cf_crm_invoice_id"))
{
	crmInvoiceDetails = zoho.crm.getRecordById("Invoices",booksInvoiceDetails.get("custom_field_hash").get("cf_crm_invoice_id"));
	deceasedName = crmInvoiceDetails.get("Deal_Name__s").get("name");
}
else if(booksInvoiceDetails.containKey("customer_name"))
{
	deceasedName = booksInvoiceDetails.get("customer_name");
}
else
{
	deceasedName = ifnull(customer_payment.get("customer_name"),"");
}
```

Nothing else changes. Further down, `customFields = booksInvoiceDetails.get("custom_field_hash");` (the
e-commerce check) now reads the retainer's fields on a retainer payment. Save.

### Fix 2 -- `loadreceiptlink`

Find:

```
booksInvoiceId = customer_payment.get("invoices").get(0).get("invoice_id");
booksInvoiceDetailsData = zoho.books.getRecordsByID("invoices",organizationID,booksInvoiceId,"zohobooksconnection");
booksInvoiceDetails = booksInvoiceDetailsData.get("invoice");
deceasedName = "";
if(booksInvoiceDetails.get("custom_field_hash").containKey("cf_crm_invoice_id"))
{
	crmInvoiceDetails = zoho.crm.getRecordById("Invoices",booksInvoiceDetails.get("custom_field_hash").get("cf_crm_invoice_id"));
	deceasedName = crmInvoiceDetails.get("Deal_Name__s").get("name");
}
```

Replace with:

```
// ZP-TBD-92: invoice lookup removed -- its result was overwritten by customer_name just below, and it failed on
// retainer payments ("invoices" is empty), so no receipt link was made for them.
deceasedName = "";
```

Leave the commented `/*else if ...*/` block and `deceasedName = customer_payment.get("customer_name");` as
they are. Save.

### Fix 3 -- the receipt custom button function

Books > Settings > Customization > Custom Buttons > the Customer Payment receipt button > Edit its function.

Make exactly the same find/replace as in **Fix 2**. The 9 lines are identical in this function, and so is the
`deceasedName = customer_payment.get("customer_name");` that overwrites them. Save.

## Regenerate the 3 missing receipts

After the fixes, open each payment in Books and click the receipt button. You can also click **Edit**, then
**Save** without changing anything, which makes `GenerateReceiptOnEdit` run `loadreceiptlink`. Either way,
`Download Payment Receipt` gets filled:

- PAY-K-2026-001771 (`5830143000037650006`)
- PAY-K-2026-001772 (`5830143000037650052`)
- PAY-K-2026-001773 (`5830143000037640003`)

This only creates the link. It doesn't email the payer: neither `loadreceiptlink` nor the button function
sends email, and `Send Payment Receipt - On Edit` is inactive.

## Test

1. **The 3 payments above:** after clicking the button (or Edit > Save), the button shows "Reciept Generated
   Successfully." and `Download Payment Receipt` holds a WorkDrive link. The PDF shows
   the right receipt no, amount (JMD), date, mode and payer.
2. **New retainer payment** (record a payment on a test Pre-Need deposit retainer in Books): the link appears and
   the payer gets the receipt email. The deceased-name line shows the CRM Deal name.
3. **Regular invoice payment:** same receipt, link and email as before (regression).
4. **E-commerce invoice payment:** link is made, no email to the client (regression).
5. **Button on a regular invoice payment:** succeeds and regenerates the link as before (regression).

## Note (no change made)

The functions fill the receipt's deceased-name line differently. `sendpaymentreceipt` uses the CRM
Deal name, while `loadreceiptlink` and the button use the Books customer name. This was already the case before this fix, and
we kept it as is.

## Rollback

Paste `rollback/sendpaymentreceipt_CURRENT.deluge` and `rollback/generate_receipt_button_CURRENT.deluge` back
after putting the live key into each one's `<BOOKS_WEBHOOK_ENCAPIKEY>` placeholder (1 each). `rollback/loadreceiptlink_CURRENT.deluge` has no keys and can be
pasted back as it is.
