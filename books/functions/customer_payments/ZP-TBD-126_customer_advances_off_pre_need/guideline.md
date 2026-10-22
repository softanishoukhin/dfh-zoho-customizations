# ZP-TBD-126 -- At-need payments off 823 PRE NEED (Customer Advances)

Source: `projectDocuments/DEV_DOC_PRENEED_CUSTOMER_ADVANCES_FIX_2026-10-21.md` (approach approved by Andrea), with the
corrections in `projectDocuments/REVIEW_PRENEED_ADVANCES_AND_DEPOSIT_SYNC_2026-10-22.md`. Live code read 2026-10-22.
Do the steps in order. **Part B (the 212 old payments) is on hold** -- the impacted-payments list was not provided.

## Root cause (confirmed live)
`customer_advance_account_id` is set per payment.
- Payments **created by CRM** (`createPaymentsOnBooks`) don't send it -> Books gives them **PRE NEED**
  (PAY-K-2026-000706, "Payment Created From = CRM"). Any overpayment / early payment then sits in PRE NEED.
- Payments **entered by cashiers** in Books get Accounts Receivable or the account the cashier picks
  (PAY-MB-2026-003148 / -003169 = Accounts Receivable, PAY-MB-2026-003191 = CONTRA ACCOUNT).
- Pre-need plan (retainer) payments = PRE NEED -- correct, must stay.
- `generatewalkininvoicefromfygaro` always pays exactly the invoice total -> never leaves anything unused -> no change.

## Step 1 -- new account (Books)
Books > Accountant > Chart of Accounts > + New Account
- Account Type **Other Current Liability**, Name **Customer Advances**, Code **824**. Save.
- Open it and copy its id from the browser address bar (the long number). It is used in Steps 2-4.
- Do NOT change the retainer setting (Settings > Preferences > Retainer Invoices) -- it stays on 823 PRE NEED.

## Step 2 -- test on ONE payment (before any code change)
Test payment: **PAY-K-2026-000706** (Dean Hasting, 500,000, Books id `5830143000014772050`): created by CRM, advance
account PRE NEED, fully used on INV-K-2026-001138, no refunds, already in Xero. (It is one of the doc's own examples.)
1. Books > that payment: note / screenshot the Journal (More > View Journal) -- the PRE NEED lines.
2. CRM > Setup > Functions > + New Function: `setPaymentAdvanceAccount` (Standalone), arguments `paymentIds` (String),
   `newAdvanceAccountId` (String), body `setPaymentAdvanceAccount_NEW.deluge`. Save.
3. Save & Execute with `paymentIds` = `5830143000014772050`, `newAdvanceAccountId` = the 824 id. Copy the result.
4. Check:
   - result `MOVED` and `unchanged_check` = OK (amount, bank account, unused, invoices, refunds unchanged);
   - Books > the payment > View Journal: the lines that were PRE NEED now show Customer Advances, **on the same dates**
     (21 Jan 2026 and 9 Feb 2026);
   - Books > Chart of Accounts > PRE NEED > transactions: this payment is gone;
   - INV-K-2026-001138 still Paid; the bank account (BNS DFH-Checking) unchanged;
   - Xero: the payment is untouched (nothing should have been sent -- automations were switched off).
5. **If Books refuses the change, or the journal is not re-dated to the original dates: stop and report.** To undo,
   run the same function with `newAdvanceAccountId` = `5830143000000594557` (PRE NEED). Never undo with Edit > Save
   in the Books screen (that runs the payment automations).

## Step 3 -- Part A: CRM `createPaymentsOnBooks` (API name `createpaymentsonbooks`)
FIND (once):
```
		paymentMap.put("custom_fields",customFieldsListForPayment);
		if(payer.get("Payment_Mode").toLowerCase() == "bank transfer")
```
REPLACE WITH:
```
		paymentMap.put("custom_fields",customFieldsListForPayment);
		// ZP-TBD-126: an at-need payment's unused money (early payment / overpayment) belongs in Customer Advances,
		// not 823 PRE NEED (Books' default for API payments). Pre-need plan payments go through
		// createPaymentsOnBooksForRetainerInvoice and are not affected.
		if(recordInfo.get("Retainer_Invoice") != true)
		{
			paymentMap.put("customer_advance_account_id","PUT_824_ACCOUNT_ID_HERE");
		}
		if(payer.get("Payment_Mode").toLowerCase() == "bank transfer")
```
Replace `PUT_824_ACCOUNT_ID_HERE` with the 824 id. Save.

## Step 4 -- Part A safety net: Books workflow on Customer Payments
Books > Settings > Automation > Custom Functions > + New (module **Customer Payments**): name
`moveatneedadvanceoffpreneed`, body `moveAtNeedAdvanceOffPreNeed_NEW.deluge` (put the 824 id in
`CUSTOMER_ADVANCES_ACCOUNT_ID`). Save.
Books > Settings > Automation > Workflow Rules > + New: module Customer Payments, name **At-need advances off PRE
NEED**, When **Created**, no criteria, action **Custom Function** = moveatneedadvanceoffpreneed. Save.
It only changes a payment that is (a) not on a retainer, (b) on PRE NEED, (c) not described as pre-need.

## Step 5 -- check (new payments)
`widgets\testCases\ZP-TBD-126_Customer_Advances_Tests.xlsx`.

## Part B -- the 212 old payments: ON HOLD
Needs `IMPACTED_PAYMENTS_2026-10-21.csv` (not provided). When it arrives: check each payment's
"Payment Created From" / notes so no genuine (older) pre-need money is moved, then run `setPaymentAdvanceAccount`
with the ids in batches of ~20 and keep every result. Never Edit > Save them in the Books screen (that runs the Xero
overpayment sync and the bank-account reset). Also confirm first whether the PRE NEED balance that matters is read
in Books or Xero -- this fix changes Books only.

## Rollback
Step 3: remove the inserted block. Step 4: deactivate the rule. A moved payment: run `setPaymentAdvanceAccount`
with its id and `newAdvanceAccountId` = `5830143000000594557` (PRE NEED).
