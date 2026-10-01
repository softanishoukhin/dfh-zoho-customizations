# ZP-TBD-91 -- Last Pre-Need instalment payment refused by Books (rounding cent)

**Status: built 2026-10-01, not applied.** Built on the live source of
`automation.createPaymentsOnBooksForRetainerInvoice` pulled 2026-10-01.

## What happens today

Pre-Need plan invoices (Deposit, Installment 1, Installment 2) are slices of ONE Books master retainer (ZP-TBD-74/85).
CRM recalculates each line's GCT to 3 decimals, so the slices show half-cents:

| Deal 6503357000084728571 | CRM invoice total | Paid |
|---|---|---|
| Deposit | 20,020.005 (shown 20,020.01) | 20,020.01 |
| Installment 1 | 10,010.0025 | 10,010.00 |
| Installment 2 | 10,010.0025 | 10,010.00 -> **refused** |
| Books retainer RET-K-2026-000149 | 40,040.00 | balance 10,009.99 |

Paid as shown, the slices add up to 40,040.01 -- one cent over the retainer. Books does not accept a retainer
payment above its balance, so the last payment is never created (`Books_Payment_ID` stays empty, error email via
`sendEmailOnError`).

## Fix

`automation.createPaymentsOnBooksForRetainerInvoice` (CRM > Setup > Functions). Find these two lines (just after
the big currency `try/catch`):

```
		totalActualAmountPaid = totalActualAmountPaid + amountPaid.round(2);
		paymentMap.put("amount_applied",amountPaid);
```

Directly **above** them, add:

```
		// ZP-TBD-91: Pre-Need plan invoices are slices of ONE Books retainer and CRM keeps their GCT to 3 decimals
		// (e.g. 20,020.005), so the payments can add up to a cent or two more than the retainer. Books refuses a
		// retainer payment above its balance -> when a NEW payment is over the balance by rounding only (<= 1.00),
		// record exactly the remaining balance and say so on the Books payment.
		if(isNull(payer.get("Books_Payment_ID")) && amountDueInBooks > 0 && amountPaid > amountDueInBooks && amountPaid - amountDueInBooks <= 1)
		{
			paymentMap.put("description","Paid " + amountPaid.round(2) + " - recorded as the remaining retainer balance " + amountDueInBooks + " (rounding)");
			amountPaid = amountDueInBooks;
			paymentMap.put("amount",amountPaid.round(2));
		}
```

Save.

### Why this shape

- Only **new** payments (no `Books_Payment_ID`) are capped -- an edit of an existing payment (PUT) is left alone,
  because there the Books balance already excludes that payment.
- Only overshoots of **1.00 or less** (in the retainer's currency, after the existing currency conversion) are
  treated as rounding. A real overpayment still goes to Books unchanged and still raises the error email, so nobody
  silently loses money.
- `amount_applied` (top level and per retainer) and `Total_Actual_Paid_Amount` all follow the capped amount, because
  they are set after this block.
- The CRM payer row keeps what the customer actually paid (10,010.00); the Books payment's description shows the
  1-cent difference for the accountant.

## Fix this Deal after applying

On invoice "Invoice - Test DFH Test D 10012026 - Installment 2" (6503357000084558122), re-save the Invoice Payers
row (e.g. open the row, re-select the Paid Date, save) so the payment workflow runs again. Expected: Books payment of
10,009.99, retainer RET-K-2026-000149 = Paid, the row gets a Books Payment ID.

(Without the code fix, the same Deal can be cleared by changing that row's Amount Paid to 10,009.99 -- but the next
Pre-Need plan would hit the same cent again.)

## Not changed (noted)

- The half-cent invoice totals themselves (deposit/installment builders, ZP-TBD-87). CRM keeps line tax to 3 decimals,
  and a 15% line can only land on a whole cent when its net is a multiple of 0.20, so the builders cannot always hit
  the planned amount exactly. Capping at payment time handles every case; changing the builders would not.

## Rollback

Delete the ZP-TBD-91 block. Nothing else was changed.
