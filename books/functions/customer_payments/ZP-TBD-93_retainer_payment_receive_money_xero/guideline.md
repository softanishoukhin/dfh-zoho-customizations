# ZP-TBD-93 -- Retainer payments to Xero: one Receive Money per payment

**Status: built 2026-10-01, NOT applied, NOT tested.** Built on live sources pulled 2026-10-01
(`syncretainerinvoicetoxero`, `createinvoiceonxero`, `allprocessonpaymentcreateandupdate`, workflow rules).

## The problem (reported by user 2026-10-01)

For an invoice payment, `createinvoiceonxero` -> `iw_create_payments_on_xero` records the payment in Xero
against the Xero invoice. For a retainer, nothing happens when a payment is made. Instead,
`syncretainerinvoicetoxero` and its catch-up Schedule post **one Receive Money for the retainer's full total**
when the retainer is created, then never post again. That is the known gap from ZP-TBD-74
("leave as is", 2026-09-22):

- Xero shows the whole Pre-Need contract as received the moment the deposit retainer is made.
- The real payments (deposit, instalments) never appear in Xero, and their bank (e.g. CIBC DFH-JDM) never
  matches the lump's bank (always BNS DFH-Checking).

Example: RET-K-2026-000148 has one lump of JMD 824,760 in BNS DFH-Checking. Its three payments
(412,380 + 206,190 + 206,190, deposited to CIBC DFH-JDM) are not in Xero.

## Decisions (user, 2026-10-01)

1. **Old lumps stay.** Retainers already in Xero (lump, or the pre-2026-09-09 Xero invoice) are not touched,
   and their payments are not posted again.
2. **Bank = the payment's own account.** The Xero bank account with the same name as the Books payment's
   Deposit To account. Hillview clearing, or no match, falls back to BNS DFH-Checking (no match also sends an
   email).
3. **Lines = pro-rata of the retainer's lines.** Same PRE NEED (26100) account and tax codes the lump used,
   sent tax-inclusive, with the rounding cent on the last line. Each Receive Money equals the payment exactly,
   and all payments together equal what the lump would have been.

## What changes

- **New** `createretainerpaymentinxero` (Customer Payment) on a new rule. Each payment on a retainer that
  isn't in Xero yet -> one Receive Money (payment date, payment amount, payment's bank). Its Xero ID is saved
  on the payment (`Xero Bank Transaction ID`), so it's posted once only.
- **Turned off:** the lump. Workflow rule `Sync Retainer Invoice To Xero` and the catch-up Schedule
  `createRetainerInvoiceToXero` are deactivated. No code edits, and switching them back on undoes it.
- Invoice payments, the At-Need retainer credit note (`createinvoiceonxero`) and the overpayment/refund
  webhook are unchanged.

## Apply -- in this order

### 1. New custom field -- Customer Payments

Books > Settings > Preferences > Customer Payments > Field Customization > New Custom Field:
**Label** `Xero Bank Transaction ID`, **Data type** Text Box (Single Line), not mandatory, not shown on PDF.
Check the API name is `cf_xero_bank_transaction_id`. If it differs, tell us and we'll update the function.

### 2. New custom function

Books > Settings > Automation > Custom Functions > New: **Name** `createretainerpaymentinxero`,
**Module** Customer Payments. Paste `createretainerpaymentinxero_NEW.deluge`, then replace the two
placeholders at the top:

| Placeholder | Copy it from |
|---|---|
| `<BOOKS_WEBHOOK_ENCAPIKEY_GETXEROMASTERDATA>` | `createinvoiceonxero` -- the `iw_getxeromasterdata` URL, the `encapiKey=` value |
| `<XERO_CLIENT_SECRET>` | `syncretainerinvoicetoxero` -- the `xeroClientSecret` line |

Save.

### 3. New workflow rule

Books > Settings > Automation > Workflow Rules > New:

- **Name** `Retainer Payment To Xero`, **Module** Customer Payments
- **When** Created or Edited, edit = when any field is updated
- **Criteria** `Xero Bank Transaction ID` *is empty*
- **Action** Custom Function -> `createretainerpaymentinxero`

**If Books refuses a new rule (rule limit):** add `createretainerpaymentinxero` as a second action on the
existing `paymentWorkflowTriggerOnAnyCreateOrUpdate` rule (no criteria, every create/edit). The function
checks the field itself, so it works without the criteria. It just runs a little more often.

### 4. Stop the old "full amount" post -- do this last

Two things post the old full-amount Receive Money today: a workflow rule and a Schedule. Switch both off.
You don't edit any code; you only switch them to Inactive.

**4a. The workflow rule**

1. Books > Settings > Automation > **Workflow Rules**.
2. Find the rule **Sync Retainer Invoice To Xero** (module: Retainer Invoices).
3. Open its menu (the "..." or toggle on the row) and choose **Mark as Inactive**.

**4b. The Schedule**

1. Books > Settings > Automation > **Schedules** (a separate tab next to Workflow Rules / Custom Functions).
2. Find the schedule **createRetainerInvoiceToXero** (it runs about every 7 minutes).
3. Open it and look at the code. It should only fetch retainer invoices and create a Xero "Receive Money"
   (`BankTransactions`, `Type: RECEIVE`). That's what our repo copy does:
   `books/functions/preneed/ZP-TBD-65_preneed_scenario1_new_pre_need/createRetainerInvoiceToXero_SCHEDULE_REBUILD.deluge`.
4. If that's all it does -> **Mark as Inactive** (or Pause).
   If it also does something else -> leave it on and send us its code. We'll give you a small change instead.

**Why last:** until 4a/4b are off, a new retainer can still get the old full-amount post. That's harmless:
the new function sees the retainer already has its full amount in Xero and doesn't post its payments again.

**To undo:** mark both Active again.

## Behaviour after this

| Situation | Xero |
|---|---|
| New retainer created | nothing (no lump) |
| Payment on a new retainer (Books, CRM or Fygaro) | one Receive Money ~1 minute after the save: payment's date, amount and bank, PRE NEED lines pro-rata |
| Payment on a retainer that already has a lump / old Xero invoice | nothing (already in Xero in full) |
| Payment edited or deleted after it was posted | **not followed** -- fix the Receive Money in Xero by hand |
| Payment not in JMD | not posted, email to us |
| Xero error / daily limit | not posted, field left empty, email to us -- edit + save the payment later to retry |
| Hillview retainer marked paid (ZP-TBD-83) | one Receive Money into BNS DFH-Checking, PRE NEED -- same as its lump today, now dated when the At-Need invoice is paid |

The rest of the Pre-Need flow balances the same way. When the retainer is applied to the At-Need invoice,
`createinvoiceonxero` still raises the PRE NEED credit note for the applied amount. That amount is now
covered by the per-payment Receive Moneys instead of one lump.

## Notes

- **Wait time.** The function waits 45 s before reading the payment, because
  `allprocessonpaymentcreateandupdate` corrects a Books payment's Deposit To account about 30-35 s after save.
  It then posts, so the Receive Money appears about a minute after the payment.
- **No double posts.** One save can start the function more than once (create plus the edits other
  functions make). Each run writes a `PENDING|...` claim into the field, waits 5 s and re-reads it. Only
  the run whose claim is still there goes on. Its own writes use `X-ZOHO-Execute-CustomFunction: false`, so
  they don't fire workflows. A claim stays only if the function is cut off mid-run. In that case, clear
  `Xero Bank Transaction ID` on the payment and save, and it retries.
- **Xero calls per payment.** 1 token refresh, the cached master data (0-3 calls), and 0-2 contact calls
  (only for a new contact): about 2-3 Xero calls in all, which is less than the lump used.
- **Not covered.** Retainers created before today that never got a lump: their past payments stay out of
  Xero (post by hand if any exist). Their future payments will post.

## Test

Test cases: `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-93_Retainer_Payment_Receive_Money_Test_Cases.xlsx`.

## Rollback

Deactivate `Retainer Payment To Xero` (or remove the extra action), then re-activate
`Sync Retainer Invoice To Xero` and the Schedule. Receive Moneys already posted per payment stay in Xero. Before
re-activating, check that any retainer that got per-payment posts has `cf_xero_bank_transaction_id` filled on
the retainer, so the lump doesn't post it a second time.
