# ZP-TBD-104 -- Pre-Need invoices ask for their own amount, not the whole plan

Two functions, the same two small edits in each. No fields, rules or buttons. Live bodies pulled 2026-10-07
(the email button already contains the ZP-TBD-96 changes).

**Do the edits in this order in each function: (a) Replace All first, then (b) insert the block.**
(The block itself contains the text that (a) replaces, so doing (b) first would break it.)

---

## Function 1 -- `refreshInvoiceAmountsForPotentialPayer` (API name `refreshinvoiceamountsforpotentialpayer`)

Used by: the WhatsApp payment links (Deal widget and the Pre-Need screen) and the installment reminder emails
(`sendInstallmentReminder`).

### 1a -- Find & Replace All (exactly 3 replacements)

Replace every

```
booksInvoiceDetails.get("balance")
```

with

```
amountDueForThisInvoice
```

### 1b -- FIND (one tab in front -- this function's body sits inside `try { }`):

```
	usdExchangeRateResponse = invokeurl
```

REPLACE WITH:

```
	// ZP-TBD-104: a Pre-Need plan invoice (Deposit / Installment) shares ONE Books retainer with the whole plan, so the
	// retainer's balance is everything still owed on the plan, not this invoice. Use this invoice's own amount minus
	// what has been paid on it. Every other invoice keeps the Books balance as before.
	amountDueForThisInvoice = booksInvoiceDetails.get("balance");
	if(invoiceInfo.get("Retainer_Invoice") == true && (ifnull(invoiceInfo.get("Invoice_For"),"") == "Deposit" || ifnull(invoiceInfo.get("Invoice_For"),"").startsWith("Installment")))
	{
		ownInvoiceTotal = ifnull(invoiceInfo.get("Sub_Total"),0).toString().toDecimal() + ifnull(invoiceInfo.get("Adjustment"),0).toString().toDecimal();
		paidOnThisInvoice = ifnull(invoiceInfo.get("Total_Actual_Paid_Amount"),0).toString().toDecimal();
		amountDueForThisInvoice = (ownInvoiceTotal - paidOnThisInvoice).round(2);
		if(amountDueForThisInvoice < 0)
		{
			amountDueForThisInvoice = 0;
		}
	}
	usdExchangeRateResponse = invokeurl
```

Save.

---

## Function 2 -- `ButtonSendEmailForPaymentByPotentialPayers` (API name `buttonsendemailforpaymentbypotentialpayers`)

Used by: "Send Invoice for Payment" (email).

### 2a -- Find & Replace All (exactly 3 replacements)

Replace every

```
booksInvoiceDetails.get("balance")
```

with

```
amountDueForThisInvoice
```

### 2b -- FIND (no indentation -- top level):

```
usdExchangeRateResponse = invokeurl
```

REPLACE WITH:

```
// ZP-TBD-104: a Pre-Need plan invoice (Deposit / Installment) shares ONE Books retainer with the whole plan, so the
// retainer's balance is everything still owed on the plan, not this invoice. Use this invoice's own amount minus
// what has been paid on it. Every other invoice keeps the Books balance as before.
amountDueForThisInvoice = booksInvoiceDetails.get("balance");
if(invoiceInfo.get("Retainer_Invoice") == true && (ifnull(invoiceInfo.get("Invoice_For"),"") == "Deposit" || ifnull(invoiceInfo.get("Invoice_For"),"").startsWith("Installment")))
{
	ownInvoiceTotal = ifnull(invoiceInfo.get("Sub_Total"),0).toString().toDecimal() + ifnull(invoiceInfo.get("Adjustment"),0).toString().toDecimal();
	paidOnThisInvoice = ifnull(invoiceInfo.get("Total_Actual_Paid_Amount"),0).toString().toDecimal();
	amountDueForThisInvoice = (ownInvoiceTotal - paidOnThisInvoice).round(2);
	if(amountDueForThisInvoice < 0)
	{
		amountDueForThisInvoice = 0;
	}
}
usdExchangeRateResponse = invokeurl
```

Save.

---

## Rollback

In each function: delete the inserted block (keep the `usdExchangeRateResponse = invokeurl` line), then Replace All
`amountDueForThisInvoice` with `booksInvoiceDetails.get("balance")` (3 replacements).
