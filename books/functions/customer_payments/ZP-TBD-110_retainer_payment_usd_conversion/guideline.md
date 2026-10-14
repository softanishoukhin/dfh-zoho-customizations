# ZP-TBD-110 -- USD payments on retainer invoices: convert to JMD once, never twice

**Status: Parts A and B deployed 2026-10-14, testing. The "Part A fix" (Invoice Payers row) was applied the same day and confirmed working.** Two parts, apply both together:

| Part | Where | What |
|---|---|---|
| **A** | Books function `allprocessonpaymentcreateandupdate` | converts a USD payment entered **in Books** on a retainer (amount x Exchange Rate) |
| **B** | CRM function `createPaymentsOnBooksForRetainerInvoice` | when CRM re-syncs a payment that is already in Books, it keeps the Books amount instead of converting it again |

Both are built on the live source pulled 2026-10-14. Masked copies of the live bodies are in each part's `rollback/`
folder; full bodies after the change are the `_UPDATED.deluge` files. Each change is one block you paste in, so
the live API keys stay as they are.

- Part A files: this folder (`retainer_conversion_block.deluge`)
- Part B files: `crm/functions/invoices/ZP-TBD-110_retainer_payment_resync_no_reconversion/` (`resync_keep_books_amount_block.deluge`)

## The problem (Andrea, 2026-10-13/14)

A USD card payment on a Pre-Need retainer was not converted to JMD. PAY-MB-2026-002720 (Ethlyn Tomlinson,
RET-MB-2026-000005) was entered in Books on 1 Sep 2026 as **2,000** with Exchange Rate **157** and saved as
**JMD 2,000**. It stayed that way until staff changed it to 314,000 by hand on 12 Oct.

### Payments entered in Books (Part A)

For invoice payments the conversion is done by the incoming webhook `iw_updatepaymentamount`, called from
`allprocessonpaymentcreateandupdate`. For a retainer payment three things stop it:

| # | Where | Why it skips a retainer payment |
|---|---|---|
| 1 | `allprocess...`, `if(isRetainerPayment == false)` (ZP-TBD-84) | we excluded retainer payments on purpose, assuming they are always JMD. That was wrong. |
| 2 | `allprocess...`, `if(crmInvoiceId != "" ...)` | the conversion sits inside the "write to the CRM Invoice" part, so it needs `cf_crm_invoice_id` on the retainer. Retainers made by hand in Books (like RET-MB-2026-000005) don't have it. |
| 3 | `iw_updatepaymentamount` itself | it reads `invoices[0]` and applies the payment to that invoice. A retainer payment has `"invoices": []`. |

On 1 Sep the function also crashed on this payment ("line 169 ... Given index 0 is greater than the list size"):
the old retainer bug fixed by ZP-TBD-84. With today's code it would still not convert, for reasons 1-3.

### Payments recorded in CRM (Part B)

`createPaymentsOnBooksForRetainerInvoice` creates the Books payment for a payment row added on a Pre-Need CRM
Invoice. It **does** convert a USD row correctly when it creates the payment (CRM amount x Books' USD rate). The
danger is when it **re-syncs** a payment that already has a `Books_Payment_ID` (it does this for every row, each time
the invoice's payment rows change):

- it recomputes the amount from the CRM row and converts it again;
- but `allprocessonpaymentcreateandupdate` writes the Books amount (JMD) back into the row's **Amount Paid**,
  while the row's Payment Mode stays "Online Credit Card USD";
- so the next re-sync multiplies the JMD figure by the USD rate: 2,000 USD -> 314,000 -> **49,298,000**. That is the
  same double conversion as the July 2026 payment inflation incident.

This happens for a USD payment entered in Books on a CRM-linked retainer (Part A now converts those, and the JMD
amount is written back to CRM), and for a CRM-recorded USD row once its amount is written back. Even without the
write-back, every re-sync re-prices an unchanged USD payment at that day's Books rate.

(The invoice version, `createPaymentsOnBooks`, has no re-sync branch, so invoice payments are not affected.)

## What changes

### Part A -- Books, a USD payment entered in Books on a retainer

A new step at the top of `allprocessonpaymentcreateandupdate` converts it itself:

- **When:** the payment is on a retainer (`retainerinvoice_id` set, no invoices), Payment Created From = **Books**,
  it is **not** a payment created by CRM (CRM payments always carry `cf_actual_paid_amount`; CRM converts those
  already), it has an **Exchange Rate above 1**, it is not yet marked **Amount Converted**, and it was **created today**.
- **What:** amount x Exchange Rate (rounded to 2 decimals) is saved **in the same write** as Amount Converted = true.
- **Never twice:** every later run (the edit this write causes, the Processed By edit, a staff edit) sees Amount
  Converted = true and skips. The "created today" rule protects older retainer payments that have a rate filled in
  but were never marked (for example PAY-MB-2026-002720, already corrected by hand): editing them will not multiply
  them again.
- **Safety check:** if amount x rate is more than the retainer's total, the amount was most likely typed in JMD
  already. It is left as it is and staff get an email.
- **Email on any problem** (too big, Books refused the write, payment no longer linked to its retainer): to the
  payment's Processed By Email, cc the CRM org variable `CCEmailToSendErrorOnBooksPaymentMode`. If Processed By
  isn't filled in yet, it goes to that list.
- Everything after it in the function (Deal Amount Paid To Date, CRM Invoice_Payers, Xero overpayment call, contract
  check) works with the converted JMD amount.
- **Invoice payments: no change.**

### Part B -- CRM, re-sync of a payment already in Books

In `createPaymentsOnBooksForRetainerInvoice`, before it updates an existing Books payment, it now reads that payment
and compares:

- if the payment mode is the same **and** the CRM amount equals either the Books amount (the row was written back in
  JMD) or the original amount Books keeps in **Actual Paid Amount** (nothing changed in CRM),
  -> the **Books amount is kept**: no new conversion, no new rate.
- if the amount or the payment mode really changed in CRM -> converted as before.

New payments from CRM are not changed: they convert once at creation, as today.

Receipts: the receipt emailed on create (`sendpaymentreceipt`) shows the entered figure with the deposit account's
currency, e.g. "USD 2000". The receipt link rebuilt on edit (`loadreceiptlink`) shows the JMD amount. Same as
invoice payments today.

## Apply

### Part A -- Books

Books > Settings > Automation > Custom Functions > `allprocessonpaymentcreateandupdate` > Edit.

1. Near the top, find these two lines (they appear once):

   ```
   info "paymentData";
   info paymentData;
   ```

2. Directly **below** them (above the `// ====` line that starts the T-24 / ZP-TBD-76 block), paste the whole of
   `retainer_conversion_block.deluge`, from `//ZP-TBD-110 start` to `//ZP-TBD-110 end`.

3. Save.

### Part A fix (2026-10-14, found in testing) -- the CRM Invoice Payers row was not added

**Symptom:** a USD payment entered in Books on a CRM-linked retainer converted correctly (e.g. 500 x 157 = 78,500), but
no row appeared in the CRM invoice's Invoice Payers. Log: `alreadyConverted = true`, then an empty `payersList`.

**Cause:** further down, the part that writes the payment to the CRM Invoice only adds a row when the payment is
**not yet** converted (the July double-conversion guard). Part A converts and stamps the retainer payment first, so
that guard skipped the row.

**Fix:** Books > `allprocessonpaymentcreateandupdate` > Edit. Find (it appears once):

```
		if(alreadyExistInCRMPayerList == false && alreadyConverted == false)
```

Replace that one line with:

```
		// ZP-TBD-110 fix: a retainer payment is converted and stamped (cf_amount_converted) at the top of this function,
		// so for a retainer payment the stamp must not stop its Invoice_Payers row from being added -- only "already in
		// the list" counts. Invoice payments keep both checks exactly as before.
		addPayerRow = false;
		if(alreadyExistInCRMPayerList == false)
		{
			if(alreadyConverted == false)
			{
				addPayerRow = true;
			}
			else if(isRetainerPayment == true)
			{
				addPayerRow = true;
			}
		}
		if(addPayerRow == true)
```

Leave the `{` on the next line and everything after it as it is. Save. Invoice payments behave exactly as before; a
retainer payment is converted only by the Part A step (the old conversion webhook stays skipped for retainers).

**For a payment already affected** (converted but no CRM row): open the payment in Books, click Edit, change nothing
(or add a Reference), Save. The function runs again and adds the row with the JMD amount.

### Part B -- CRM

CRM > Setup > Developer Hub > Functions > `createPaymentsOnBooksForRetainerInvoice` > Edit.

1. Find this part (in the `else` branch that updates an existing Books payment, near the end of the function):

   ```
   				catch (eExistingPayment)
   				{
   					info "ZP-TBD-95: could not read Books payment " + payer.get("Books_Payment_ID") + ": " + eExistingPayment;
   				}
   			}
   			info paymentMap;
   ```

2. Paste the whole of `resync_keep_books_amount_block.deluge` **between** the `}` that closes the ZP-TBD-95
   `if(...Deposit... Installment...)` block and the line `info paymentMap;`. So it ends up as:

   ```
   				catch (eExistingPayment)
   				{
   					info "ZP-TBD-95: could not read Books payment " + payer.get("Books_Payment_ID") + ": " + eExistingPayment;
   				}
   			}
   			// ZP-TBD-110: re-syncing a payment that is already in Books must never convert it a second time.
   			...  (the rest of the block)  ...
   			catch (eResync)
   			{
   				info "ZP-TBD-110: could not compare with Books payment " + payer.get("Books_Payment_ID") + ": " + eResync;
   			}
   			info paymentMap;
   			paymentResult = invokeurl
   ```

3. Save.

## Check while testing

1. **Books accepts the amount change on a retainer payment** (Part A). After the run the payment must still show
   its retainer, and the retainer's Payment Made must go up by the JMD amount. If Books refuses the write you'll get
   the "did not accept" email: send us its text.
2. **One conversion only** (Part A). In the payment's Books function log the first run shows
   `ZP-TBD-110 conversion 2000 x 157 = 314000 -> {"code":0,...`; the runs after it show `converted=true`.
3. **CRM re-sync keeps the amount** (Part B). In the CRM function's log (Developer Hub > Functions >
   `createPaymentsOnBooksForRetainerInvoice` > Logs) each existing row shows `ZP-TBD-110 re-sync check: ... keep=true`.
4. **Deal Amount Paid To Date** on the Pre-Need Deal shows the JMD total.

## Known limits

- A Books payment that should have converted but didn't on the day it was created is not retried on a later day.
  Fix the amount by hand and tick Amount Converted.
- A JMD amount entered in Books with an Exchange Rate filled in is still converted if the result fits under the
  retainer total. Same as for invoice payments today: leave Exchange Rate empty when the amount is already JMD.
- After a CRM row is written back in JMD, its Amount Paid shows the JMD figure next to a USD payment mode. That was
  already so; Part B makes it harmless. To correct a USD amount later, change it in CRM (it re-converts) or in Books.
- Not changed: `createPaymentsOnBooksForRetainerInvoice` still leaves Payment Created From to Books' default. Setting
  it to CRM / Fygaro like the invoice version would change which steps run in Books and how reports group these
  payments, so we left it.

## Rollback

- Part A: delete everything from `//ZP-TBD-110 start` to `//ZP-TBD-110 end` and save. Or paste
  `rollback/allprocessonpaymentcreateandupdate_CURRENT.deluge` back after putting the live keys into its
  `<BOOKS_WEBHOOK_ENCAPIKEY>` (3) and `<CRM_ZAPIKEY>` (1) placeholders.
- Part B: delete the block from `// ZP-TBD-110: re-syncing` to the end of its `catch (eResync) {...}` and save. Or
  paste `rollback/createPaymentsOnBooksForRetainerInvoice_CURRENT.deluge` back (it has no keys).
- Part B on its own is safe to keep if Part A is rolled back.
