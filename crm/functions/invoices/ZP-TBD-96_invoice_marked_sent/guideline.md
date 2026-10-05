# ZP-TBD-96 (PN-04) -- Apply guideline

One new function + one find/replace patch. No fields, rules or buttons to create.

## Step 1 -- new function `markInvoiceSent`

CRM > Setup > Developer Hub > Functions > + New Function.
- Name: `markInvoiceSent` -- API name `markinvoicesent`
- Category: **Standalone**
- Argument: `invoiceId` (String)
- Body: paste `markInvoiceSent_NEW.deluge`. Save.
- **Enable REST API** on it (API key + OAuth), so the Pre-Need screen (Canvas) can call it.

## Step 2 -- patch `ButtonSendEmailForPaymentByPotentialPayers` (API name `buttonsendemailforpaymentbypotentialpayers`)

Why: for a Pre-Need plan invoice (Deposit / Installment) this button copied the status of the plan's ONE
Books retainer onto the CRM invoice, and skipped it completely once that retainer had any payment
(`partially_paid` contains "paid"). So every installment emailed after the deposit was paid stayed "Created".
Plan invoices now go through `markInvoiceSent` after the email is sent; every other invoice type is unchanged.

### 2a -- FIND (top level, no indentation):

```
info crmInvoiceMap;
crmInvoiceUpdateResult = zoho.crm.updateRecord("Invoices",recordInfo.get("Invoice").get("id"),crmInvoiceMap);
```

REPLACE WITH:

```
// ZP-TBD-96 (PN-04): a Pre-Need plan invoice (Deposit / Installment) shares ONE Books retainer with the rest of the
// plan, so that retainer's status says nothing about THIS invoice -- don't copy it. The invoice is marked Sent by
// markInvoiceSent after the email goes out (below). Every other invoice type keeps the Books status as before.
isPreNeedPlanInvoice = false;
if(invoiceInfo.get("Retainer_Invoice") == true && (ifnull(invoiceInfo.get("Invoice_For"),"") == "Deposit" || ifnull(invoiceInfo.get("Invoice_For"),"").startsWith("Installment")))
{
	isPreNeedPlanInvoice = true;
	crmInvoiceMap.remove("Status");
}
info crmInvoiceMap;
crmInvoiceUpdateResult = zoho.crm.updateRecord("Invoices",recordInfo.get("Invoice").get("id"),crmInvoiceMap);
```

### 2b -- FIND:

```
standalone.sendInvoiceNotificationFromCRM(crmid,booksInvoiceId,contactInfo.get("Email"));
```

REPLACE WITH:

```
standalone.sendInvoiceNotificationFromCRM(crmid,booksInvoiceId,contactInfo.get("Email"));
// ZP-TBD-96 (PN-04): the email has gone to the family -> mark the plan invoice Sent (never overwrites Paid etc.)
if(isPreNeedPlanInvoice)
{
	info standalone.markInvoiceSent(recordInfo.get("Invoice").get("id").toString());
}
```

Save.

## Step 3 -- the Pre-Need screen's WhatsApp button (Andrea)

The WhatsApp send happens in the WhatsApp app, so Zoho can't see it complete. Right after the screen's
per-invoice WhatsApp button opens WhatsApp, it calls `markinvoicesent` with that invoice's CRM id
(`invoiceId`). The function returns `{"status","changed","message"}`; the screen can show `message`.

Not changed on purpose: the Deal-level "Send Links via WhatsApp" widget. It sends the NEWEST invoice's
payment link, which is often not the invoice being paid, so marking that invoice Sent would mislead.

## Rollback

Step 2: put each FIND text back. Step 1: the function can stay (nothing calls it once 2 and 3 are undone).
