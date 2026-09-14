# ZP-TBD-65 — Pre-Need Scenario 1 (new pre-need, end to end)

**Source:** Andrea Ryan's call readout with Dale, 2026-09-07 (`PreNeed_Call_Readout_20260907.md`),
plus live-org investigation 2026-09-09 before any build work started, per the standing
live-source-first rule. Org: Delapenha Funeral Home Ltd, Books org id `872327358`.

## The ask (Scenario 1 only — historic migration is ZP-TBD-66, separate)

1. Customer pays for a pre-need → Books Retainer Invoice → pushes to Xero → lands coded to
   the **Pre-Need Liability** account (so Dale can reconcile the bank).
2. Person dies → Books raises the at-need invoice → the existing Retainer Invoice is applied to
   it (native Books behavior, already works, no dev needed) → invoice carries the actual
   products **at today's price**.
3. **New:** a single **"Pre-Need Difference"** product/line item (negative amount) brings the
   invoice back down to the original contract price the family actually paid. One line total,
   not one per product — Dale wants it trackable as a product, which is why it's a line item and
   not a bottom-line discount.
4. Cashier (not the FD) owns applying the retainer and adding the Pre-Need Difference line —
   the FD only adds products.
5. **New:** when the retainer invoice is applied in Books, a **Xero Credit Note** must be
   created against the Xero invoice, coded to Pre-Need Liability, so that applying it converts
   the money from liability to sales revenue.

## Answers received (2026-09-09, same review cycle)

1. **Product name:** confirmed as **"Pre-Need Difference"** — to be created in **both CRM and
   Books**.
2. **Overpayment case (contract > at-need invoice):** not in scope for this ticket.
3. **Cancellation:** not in scope for this ticket.
4. **Taxability:** confirmed **non-taxable**.
5. **Xero "pre need" account:** confirmed via live Chart of Accounts screenshot — code `26100`,
   name `PRE NEED` ("REVENUE FOR FUTURE SALES"), **Type: Liability**, Tax Rate: Tax Exempt (0%),
   YTD balance ~31.5M JMD. So the account referenced by `syncretainerinvoicetoxero`'s hardcoded
   `accountName = "pre need"` lookup is real and correctly typed — that part of point 1 below is
   confirmed good, once the mechanism itself (see next point) is fixed.
6. **Receive Money vs. Invoice+Payment — confirmed: must be a literal native Xero "Receive Money"
   transaction.** This overrides the current mechanism. `syncretainerinvoicetoxero` today creates
   a Xero Invoice (ACCREC) + Payment, not a Receive Money bank transaction — **this needs an
   actual rebuild of that function**, not a tweak, exactly as flagged as a risk before asking.
   See the revised design below.

**Follow-up question raised by answer 6 — now resolved.** Bank account confirmed:
**BNS DFH-Checking**, Xero `AccountID` = `AB461C09-78F6-4BFC-AF77-D045F5EEEB07`. Chosen over the
other JMD-feed accounts (`CIBC DFH-JDM`, `NCB JDM`, `DFH - CONSTRUCTION JMD`) because it's the
account with by far the highest reconciliation activity (1,674 pending items vs. single/double
digits elsewhere) — the one Dale actually reconciles day to day, per the original stated purpose
of this whole receive-money requirement. No more blocking questions remain for Stage 1.

## What we found already live (before writing any new code)

### 1. Retainer invoice → Xero push already exists and already targets a "pre need" account

`syncretainerinvoicetoxero` (function id `5830143000019094452`, entity `retainer_invoice`,
workflow **"Sync Retainer Invoice To Xero"**) creates/updates a Xero Invoice (`Type: ACCREC`)
from the Books Retainer Invoice, then calls the `iw_create_payments_on_xero` incoming webhook to
record a matching Xero Payment against it. For every retainer invoice line item it does:

```deluge
accountName = "pre need";  // hardcoded lookup name, not derived from the line item
accountId = accountMap.get(accountName);
if(isNull(accountId))
{
    accountId = defaultAccountId;  // "d82dba9b-5cd3-41a9-97c8-d3a3ceb98c5a"
}
lineItemMap.put("AccountId", accountId);
```

**Confirmed (see Answers section above):** the "pre need" account is real, code `26100`, Type
Liability. **But the mechanism itself is confirmed wrong** — Dale wants a literal native Xero
"Receive Money" transaction, not an Invoice+Payment pair. This function needs to be rebuilt to
call Xero's `BankTransactions` API (`Type: "RECEIVE"`) instead of `Invoices` + a payment webhook.
Still open: which Xero bank account to post against (see follow-up question above).

### 2. Books Credit Note → real Xero Credit Note, allocated to invoice — already built (ZP-TBD-54)

`createinvoiceonxero` (the existing at-need invoice → Xero push, function id
`5830143000000527001`, workflow **"updateInvoiceToXero"**) already loops
`invoices/{id}/creditsapplied` and, for each credit found, calls the incoming webhook
`createprepaymentinxerofromcreditnote` (name is legacy/misleading — per ZP-TBD-54 it creates a
**real** Xero Credit Note, with tax, and allocates it against the Xero invoice via
`PUT /CreditNotes/{id}/Allocations`). Confirmed working live 2026-09-03. Full webhook source is
in `books/functions/creditnotes/ZP-TBD-54_creditnote_xero_sync_and_allocation/metadata.md`.

**This is architecturally almost exactly what Dale is asking for in the new pre-need flow** —
except it is wired to actual Books **Credit Note** module records (via `invoices_credited`), and
a Retainer Invoice application is a *different* native Books mechanism, not a Credit Note
record. So this pipeline does not fire today when a retainer is applied — it only fires for
manually-created Books Credit Notes (e.g. the refund flow, ZP-TBD-48).

### 3. The actual gap

**Nothing today creates a Xero credit note when a retainer invoice is applied to an at-need
invoice.** Books applies the retainer natively (confirmed, no dev needed for that part per the
call), but that application is invisible to both Xero-sync pipelines above. Left alone, the
retainer amount stays coded to Pre-Need Liability in Xero forever and never converts to revenue.

The lowest-risk fix, following the pattern DFH has already used twice (ZP-TBD-48: Books Bill →
existing `createbillinxero` pipeline; ZP-TBD-54: Books Credit Note → Xero Credit Note pipeline):
when a retainer invoice is detected as applied to an invoice, **auto-create a real Books Credit
Note** (coded to Pre-Need Liability, for the applied amount, against that invoice) so the
existing ZP-TBD-54 pipeline carries it to Xero automatically — no new Xero-side code required.

### 4. A conflict this design would hit — found by reading the live function, not assumed

`addtocontraaccountfornewcreatedcreditnote` (function id `5830143000004786013`, entity
`creditnote`, workflow **"updateCreditNoteToContraBank"**, fires on **every** Credit Note
create) unconditionally rewrites all of a new credit note's line items onto a single hardcoded
"CONTRA ACCOUNT" (`account_id: 5830143000000594545`):

```deluge
newLineItemMap.put("account_id", "5830143000000594545");
```

If we auto-create a Books Credit Note coded to Pre-Need Liability per point 3 above, this
existing workflow will immediately recode it to CONTRA ACCOUNT instead, silently defeating the
liability-to-revenue requirement. **This needs an explicit exclusion** — e.g. gate
`updateCreditNoteToContraBank`'s criteria (or the function itself, per the trace-all-callers
rule) to skip credit notes created by the new pre-need function, identified by a reason code,
credit note prefix/series, or a custom field flag set at creation time.

## Stage 2 design revision (2026-09-11) — supersedes design points 3/4 below

Investigated a real live Invoice (Howard Morgan's, id `5830143000031561865`, unrelated to
pre-need — used only because its ID was already known) via `ZohoBooks_get_invoice` to find the
actual field shape for "a retainer/credit was applied to this invoice." Confirmed: the Invoice
object carries top-level `credits_applied` and `unused_retainer_payments` numeric fields (both 0
on this invoice, since it never had either applied).

**Revised understanding of the existing mechanism:** `createinvoiceonxero` already calls
`GET /invoices/{id}/creditsapplied` and loops the `credits` array, but only ever reads
`creditnote_id` off each entry, calling the ZP-TBD-54 webhook with it. Zoho Books' documented
shape for this endpoint returns entries for **both** credit-note-sourced and
retainer-invoice-sourced credits in the same list, distinguished by which ID field is present
(`creditnote_id` vs. a retainer-invoice equivalent). If that holds here, **a retainer application
is already flowing through this exact loop today — the code just doesn't recognize it**, since it
unconditionally assumes `creditnote_id`.

**This changes the design for the better:** instead of auto-creating a synthetic Books Credit
Note purely to piggyback the existing ZP-TBD-54 pipeline (the original plan, design points 3/4
below), branch the existing loop directly: when an entry has no `creditnote_id` but does have a
retainer-invoice id, build and POST a real Xero Credit Note (coded to Pre-Need Liability, 26100)
and allocate it against the invoice **inline, in the same function** — reusing the Xero
token/headers/contact already in scope at that point in `createinvoiceonxero`. No new Books
Credit Note record is ever created for this case, which means **the
`addtocontraaccountfornewcreatedcreditnote` contra-account conflict (design point 4, original)
no longer applies** — there's nothing for that workflow to clobber, since it only fires on Books
Credit Note module records.

**NOT verified against live data — the one thing to confirm before this ships:** the exact key
name Zoho Books uses for a retainer-invoice entry in the `creditsapplied` response (tried
`retainerinvoice_id` and `retainer_invoice_id` defensively in the patch below), and the amount
key (tried `amount_applied` and `credits_applied`). No MCP tool in this session reaches the raw
`/creditsapplied` sub-resource directly, and no real retainer-applied invoice exists in this org
yet (Stage 1 only just went live) to inspect. **First real retainer-applied invoice created after
Stage 1 goes live should be pulled via `ZohoBooks_get_invoice` (or the raw endpoint) to confirm
the exact keys before trusting this in production.**

### Patch: `createinvoiceonxero` — branch the existing credits-applied loop

Function id `5830143000000527001`. Locate this existing block (inside the
`if(triggerFieldValueIsAvailableOnCRMToCreateInvoiceOnXero == true)` section, after the
debit-notes handling, before the `refreshedXeroInvoice` re-read):

```deluge
creditNotesUnderThisInvoice = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/invoices/" + invoiceID + "/creditsapplied?organization_id=" + organizationID
	type :GET
	connection:"zohobooksconnection"
];
for each  creditNoteUnderThisInvoice in creditNotesUnderThisInvoice.get("credits")
{
	createCreditNotePrepaymentToXero = invokeurl
	[
		url :"https://www.zohoapis.com/books/v3/settings/incomingwebhooks/iw_createprepaymentinxerofromc/execute?auth_type=apikey&encapiKey=wSsVR60l%2BkP2X%2Ft1yWX%2FJek6ngtTBF2nFx542Vf37CT0Hf%2FLpcc6xkKaUFSnSPUbQmVuQmEW9bstmUoH0WEG2d8kmFoJCyiF9mqRe1U4J3x19Oya3lWkByoywFHdfc5dh04%2B2zEoTp198zjsgf6MMXmsTZ6S&creditnote_id=" + creditNoteUnderThisInvoice.get("creditnote_id")
		type :GET
	];
	info createCreditNotePrepaymentToXero;
}
```

Replace it with (see `createinvoiceonxero_STAGE2_PATCH.deluge` alongside this file for the full
block):

```deluge
creditNotesUnderThisInvoice = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/invoices/" + invoiceID + "/creditsapplied?organization_id=" + organizationID
	type :GET
	connection:"zohobooksconnection"
];
for each  creditNoteUnderThisInvoice in creditNotesUnderThisInvoice.get("credits")
{
	sourceCreditNoteId = creditNoteUnderThisInvoice.get("creditnote_id");
	sourceRetainerInvoiceId = creditNoteUnderThisInvoice.get("retainerinvoice_id");
	if(isNull(sourceRetainerInvoiceId) || sourceRetainerInvoiceId == "")
	{
		sourceRetainerInvoiceId = creditNoteUnderThisInvoice.get("retainer_invoice_id");
	}

	if(!isNull(sourceCreditNoteId) && sourceCreditNoteId != "")
	{
		// Unchanged -- existing Books-Credit-Note path (ZP-TBD-54).
		createCreditNotePrepaymentToXero = invokeurl
		[
			url :"https://www.zohoapis.com/books/v3/settings/incomingwebhooks/iw_createprepaymentinxerofromc/execute?auth_type=apikey&encapiKey=wSsVR60l%2BkP2X%2Ft1yWX%2FJek6ngtTBF2nFx542Vf37CT0Hf%2FLpcc6xkKaUFSnSPUbQmVuQmEW9bstmUoH0WEG2d8kmFoJCyiF9mqRe1U4J3x19Oya3lWkByoywFHdfc5dh04%2B2zEoTp198zjsgf6MMXmsTZ6S&creditnote_id=" + sourceCreditNoteId
			type :GET
		];
		info createCreditNotePrepaymentToXero;
	}
	else if(!isNull(sourceRetainerInvoiceId) && sourceRetainerInvoiceId != "")
	{
		// NEW (ZP-TBD-65 Stage 2): a pre-need retainer was applied to this invoice.
		amountApplied = creditNoteUnderThisInvoice.get("amount_applied");
		if(isNull(amountApplied))
		{
			amountApplied = creditNoteUnderThisInvoice.get("credits_applied");
		}
		if(!isNull(amountApplied) && amountApplied != 0 && !isNull(xeroInvoiceIdForAddingNote))
		{
			try
			{
				preNeedLiabilityAccountId = xeroAccountsMap.get("pre need");
				if(isNull(preNeedLiabilityAccountId))
				{
					preNeedLiabilityAccountId = "d82dba9b-5cd3-41a9-97c8-d3a3ceb98c5a";
				}
				retainerCreditNoteLineItem = Map();
				retainerCreditNoteLineItem.put("AccountID",preNeedLiabilityAccountId);
				retainerCreditNoteLineItem.put("Description","Pre-Need retainer applied - " + sourceRetainerInvoiceId);
				retainerCreditNoteLineItem.put("Quantity",1);
				retainerCreditNoteLineItem.put("UnitAmount",amountApplied);
				retainerCreditNoteLineItem.put("TaxType","NONE");
				retainerCreditNoteMap = Map();
				retainerCreditNoteMap.put("Type","ACCRECCREDIT");
				retainerCreditNoteMap.put("Contact",{"ContactID":createContactInXero.get("Contacts").get(0).get("ContactID")});
				retainerCreditNoteMap.put("Date",zoho.currentdate.toString("yyyy-MM-dd"));
				retainerCreditNoteMap.put("Status","AUTHORISED");
				retainerCreditNoteMap.put("LineItems",{retainerCreditNoteLineItem});
				createRetainerCreditNoteInXero = invokeurl
				[
					url :"https://api.xero.com/api.xro/2.0/CreditNotes"
					type :POST
					body:retainerCreditNoteMap.toString()
					headers:headers
				];
				retainerXeroCreditNoteId = "";
				if(createRetainerCreditNoteInXero.containKey("CreditNotes") && createRetainerCreditNoteInXero.get("CreditNotes").size() > 0)
				{
					retainerXeroCreditNoteId = createRetainerCreditNoteInXero.get("CreditNotes").get(0).get("CreditNoteID");
				}
				if(retainerXeroCreditNoteId != "")
				{
					allocationMap = Map();
					allocationLineMap = Map();
					allocationLineMap.put("Invoice",{"InvoiceID":xeroInvoiceIdForAddingNote});
					allocationLineMap.put("Amount",amountApplied);
					allocationLineMap.put("Date",zoho.currentdate.toString("yyyy-MM-dd"));
					allocationMap.put("Allocations",{allocationLineMap});
					createRetainerAllocation = invokeurl
					[
						url :"https://api.xero.com/api.xro/2.0/CreditNotes/" + retainerXeroCreditNoteId + "/Allocations"
						type :PUT
						parameters:allocationMap.toString()
						headers:headers
					];
					info createRetainerAllocation;
				}
			}
			catch (e)
			{
				sendmail
				[
					from :zoho.adminuserid
					to :"softanis.noushadurrahman@gmail.com"
					subject :"Pre-Need Retainer Credit Note Error"
					message :"Invoice: " + invoiceID + ", Retainer: " + sourceRetainerInvoiceId + " - " + e.toString()
				]
				info "Error: Pre-Need retainer credit note creation failed";
				info e;
			}
		}
	}
}
```

Note the Xero `CreditNotes/{id}/Allocations` endpoint requires `PUT`, not `POST` — this is a
confirmed gotcha from ZP-TBD-54's own build notes, already applied correctly above.

### Pre-Need Difference product — manual setup (no create-product API available to this session)

Create in **CRM Products module first** (name "Pre-Need Difference", confirmed), then let it
sync/import into Books as an Item the same way other DFH products do (per the existing
CRM→Books product sync pattern already in use elsewhere in this org). Settings:
- **Sales Account: same "Sales" account used by every other product line** (`5830143000000000388`
  in this org, confirmed from a live invoice) — **not** the Pre-Need Liability account. This
  product lives on the at-need invoice as an ordinary negative sales adjustment, netting down
  total sales revenue like any other line item. The Pre-Need Liability account (26100) is touched
  only by the separate retainer-credit-note mechanism above, in Xero — these are two different
  mechanisms for two different purposes; do not conflate them.
- **Tax: None / Non-Taxable** (confirmed).
- **Rate: 0.00 default** — the cashier enters the actual negative amount per invoice, since the
  gap is different for every family.

**Update 2026-09-11 — Andrea confirmed she wants this automated.** New function delivered:
`addPreNeedDifferenceLineOnRetainerApply_NEW.deluge`. Design: matches retainer invoice line items
against the at-need invoice's line items **by `item_id`**, and only nets the gap for products
common to both — deliberately NOT just using the invoice's remaining balance after the retainer
applies, since the call notes are explicit that the FD adds new products onto the same invoice;
a balance-based calculation would incorrectly zero out the cost of those new products too, not
just the real contract-price gap. Overpayment case (gap < 0) sends an alert email instead of
silently doing nothing, since that case is confirmed out of scope but shouldn't go unnoticed.

**Deployment requirement — workflow ordering:** this new function's workflow rule must be ordered
to fire **before** `updateInvoiceToXero` (`createinvoiceonxero`) on the Invoices module in Books'
workflow rule list, so the Xero push (and the new retainer-credit-note patch) sees the complete
line items including this difference line. `createinvoiceonxero` re-fetches the invoice fresh by
ID rather than trusting the trigger payload, which is why this ordering should work even within
one trigger cascade — **not verified live**, first real retainer-applied invoice should confirm
the difference line is present in what actually gets pushed to Xero, not just added on a
subsequent edit.

**Also still needed:** fill in `PRE_NEED_DIFFERENCE_ITEM_ID` in this function once the product is
created (see manual setup step above) — currently a placeholder.

**Update 2026-09-11 (revision) — redesigned on confirmed-live data, both prior Stage 2 files
superseded.** A real live test (retainer RET-K-2026-000048 applied to invoice
INV-K-2026-003661) showed that `zoho.books.getRecordsByID("RetainerInvoices", ...)` returns a
sibling top-level `invoices` array — every invoice the retainer has been applied to, each entry
carrying `invoice_id` and `amount_applied` directly. This is confirmed-live ground truth, replacing
the earlier unverified guess at a key inside `/invoices/{id}/creditsapplied`. Both earlier Stage 2
files (`addPreNeedDifferenceLineOnRetainerApply_NEW.deluge` and
`createinvoiceonxero_STAGE2_PATCH.deluge`) are now marked superseded in-file — do not deploy
either, and revert the patch if it was already applied to `createinvoiceonxero`.

**New consolidated function:** `addPreNeedDifferenceAndCreditNoteOnRetainerApply_REVISED.deluge`,
entity `retainer_invoice`, does both Stage 2 jobs (the Pre-Need Difference line and the Xero
retainer credit note) from one place, triggered by the retainer invoice's own record updating
when it gets applied (confirmed live: the test retainer went from created to drawn/balance-0
about 11 minutes later, matching the application). No changes to `createinvoiceonxero` needed at
all anymore. Requires a new Invoices custom field, "Xero Retainer Credit Note ID" — **live api_name
confirmed as `cf_xero_retainer_credit_note_id`** (note the extra underscore between "credit" and
"note") — as an independent idempotency marker separate from the Pre-Need Difference line check,
so a partial failure (line added, Xero call then fails) can retry just the missing half.

**Update 2026-09-11 (reorganization) — split into two smaller pieces to remove a race risk.**
Andrea/the developer correctly flagged that applying a retainer to an invoice ALSO triggers the
invoice's own `updateInvoiceToXero` workflow (`createinvoiceonxero`), which already does all the
Xero setup this ticket needs. Having the Retainer-Invoice-side function ALSO independently refresh
the Xero token and build its own contact/account context meant two functions reacting to the same
event both hitting Xero — Xero refresh tokens are one-time-use, so two near-simultaneous refreshes
risk one failing or the stored token ending up inconsistent, and the old "defer if the invoice
isn't synced to Xero yet" fallback had no guaranteed retry trigger.

**`addPreNeedDifferenceAndCreditNoteOnRetainerApply_REVISED.deluge` is now superseded.** Replaced
by two pieces:
1. **`addPreNeedDifferenceLineAndFlagRetainerCredit_NEW.deluge`** (Retainer Invoice module,
   unchanged trigger) — does ONLY the Pre-Need Difference line (the one job that genuinely needs
   to run from the retainer side), then writes two handoff fields onto the invoice:
   `cf_preneed_retainer_applied_amount` and `cf_preneed_retainer_number`. No Xero calls at all in
   this function anymore.
2. **`createinvoiceonxero_STAGE2_HANDOFF_PATCH.deluge`** — a small addition to the existing,
   already-live `createinvoiceonxero`, inserted anywhere after `xeroInvoiceIdForAddingNote` is
   set. Reads the handoff fields and creates the Xero Credit Note using the token/headers/contact
   **already established earlier in that same execution** — no duplicate Xero setup, and the
   credit note is guaranteed to run exactly when the Xero invoice is known to exist. This replaces
   `createinvoiceonxero_STAGE2_PATCH.deluge` (already marked superseded) — this is a cleaner
   version of the same idea, using the confirmed-live handoff mechanism instead of an unverified
   `/creditsapplied` key guess.

**New prerequisite fields (Invoices module):** `cf_preneed_retainer_applied_amount` (Decimal),
`cf_preneed_retainer_number` (Text) — expected api_names, confirm live before deploying, same
lesson as `cf_xero_retainer_credit_note_id` (guessed wrong the first time).

**Correction 2026-09-11 — matching key changed from item_id to product name.** Live data showed
Retainer Invoice line items in this org do **not** carry `item_id` at all — only `line_item_id`
(a transaction-specific id, not a catalog product reference; retainer lines are entered as free
text against `description`, not selected from the Items list). The at-need invoice side does
have `item_id`, but with nothing to match against on the retainer side, matching switched to
**product name** instead: retainer line `description` vs. at-need line `name` (falling back to
`description`), both normalized (trimmed, lowercased). This is inherently a little less precise
than id-matching would have been — a retyped description with different wording could fail to
match — but it's the only signal available given the retainer side's actual data shape.

**Update 2026-09-11 (earlier, superseded) — Stage 2 reported fully deployed.** Product created (Books item_id
`5830143000035961673`, confirmed filled into the live function), `addPreNeedDifferenceLineOnRetainerApply`
deployed as its own function + workflow rule, `createinvoiceonxero_STAGE2_PATCH` applied to the
live `createinvoiceonxero`. **Not yet test-executed.** Full Stage 2 test set delivered
(`ZP-TBD-65_Stage2_PreNeedDifference_and_RetainerCreditNote_Test_Cases.xlsx/csv`, 15 cases) in
`D:\Office\Andrea_Projects\DFH\widgets\testCases\`. TC-01 (confirm retainer detection actually
fires at all) and TC-07 (confirm the workflow-ordering assumption holds) are the two gating
unknowns — everything else depends on those two working.

## Design for this ticket (updated after answers received) — ORIGINAL, see revision above for 3/4

0. **Rebuild `syncretainerinvoicetoxero`'s Xero call** from Invoice+Payment to a native Receive
   Money `BankTransaction` (`Type: "RECEIVE"`), `BankAccount: {"AccountID":
   "AB461C09-78F6-4BFC-AF77-D045F5EEEB07"}` (BNS DFH-Checking), one line item coded to the
   `PRE NEED` (26100) liability account, exempt tax type (0% per the confirmed account setup),
   non-taxable. This replaces the ACCREC invoice + `iw_create_payments_on_xero` call currently in
   that function — the debit-note handling block at the bottom of that function is
   retainer-specific and needs re-checking once the invoice mechanism is gone (it currently
   assumes an `xeroInvoiceId` exists). **No remaining blockers — ready to build.**
1. **Pre-Need Difference product** — create in **both CRM and Books**, name confirmed as
   "Pre-Need Difference." Non-taxable, confirmed.
2. **Cashier-facing calculation** — when the cashier applies the retainer invoice to the new
   at-need invoice, compute `(sum of at-need line items matching the pre-need contract) − (original
   contract price)` and add one Pre-Need Difference line for the negative of that gap. Needs a
   reliable way to identify "the pre-need contract price" per family — likely the original
   Retainer Invoice's line item total(s), read via `zoho.books.getRecordsByID("RetainerInvoices",
   ...)`. Exact UI/workflow trigger (button vs. automatic on retainer-apply) to be confirmed with
   Andrea/Dale.
3. **New retainer-applied → Xero credit note function** — new custom function, entity
   `invoice` (or `retainer_invoice`, TBD based on which side reliably reports the application),
   workflow trigger on invoice update where a retainer invoice is newly applied. Creates a Books
   Credit Note coded to Pre-Need Liability for the applied amount, tagged so
   `updateCreditNoteToContraBank` skips it (see point 4). Reuses the existing ZP-TBD-54 pipeline
   for the actual Xero push — no duplicate Xero API code.
4. **Verification needed on live data** (cannot be done without a real retainer-applied
   invoice in the org): confirm exactly which Books API field reports "this invoice had a
   retainer invoice applied to it" and for what amount — this is the one piece that determines
   the trigger condition for point 3 and could not be confirmed from function code alone.

## Remaining open questions

- Still need to confirm exactly which Books API field reports "a retainer invoice was applied to
  this invoice, for this amount" (point 4 of the design above) — needs a real retainer-applied
  invoice to inspect, or Zoho Books API docs/support. This is the only remaining unknown, and it
  only affects the trigger condition for the new credit note function, not Stage 1.
- Out of scope for this ticket, deferred: overpayment/refund case, cancellation process.

## Stage 1 build — complete, pending manual deployment

Two Deluge files delivered alongside this entry, built directly on the live-pulled source (both
re-fetched fresh via the Books custom-function API immediately before writing, confirmed
byte-identical to what was read during investigation — nothing built from memory of an earlier
read):

- **`syncretainerinvoicetoxero_REBUILD.deluge`** — full replacement body for function id
  `5830143000019094452`. Creates a native Xero `BankTransactions` Receive Money transaction
  (`Type: "RECEIVE"`) instead of an ACCREC Invoice + Payment. Line item coded to the confirmed
  `PRE NEED` account (26100), `BankAccount` set to the confirmed `AB461C09-78F6-4BFC-AF77-D045F5EEEB07`
  (BNS DFH-Checking). Idempotency guard added (a Receive Money transaction has no natural
  "does this already exist" lookup the way an Invoice number did) via a new custom field. Dead
  commented-out "PROCESS CREDIT NOTES" block from the old version removed during the rebuild.
- **`syncretainerinvoicestatusbetweencrmandxero_TRIM.deluge`** — full replacement body for
  function id `5830143000024812988`. Removes the now-obsolete "push AUTHORISED status to the
  Xero Invoice" block (no Xero Invoice exists anymore for a retainer once Stage 1 goes live) —
  this block had no try/catch, so left in place it was a live risk once `cf_xero_invoice_id`
  stops being populated for new retainers. The unrelated CRM-Invoice-status mirror is kept as-is.
  **Deployed and confirmed live 2026-09-09** — see the test cases file below for what still
  needs live verification (TC-08, TC-09, TC-12).
- **`createRetainerInvoiceToXero_SCHEDULE_REBUILD.deluge`** — a third dependent found by Andrea
  after deployment, not caught during the initial trace: a Zoho Books **Schedule** (Settings >
  Automation > Schedules, not a Custom Function — no MCP tool in this session reaches Schedules,
  so this was built on a user-exported file rather than a fresh API pull; flagged for a manual
  re-check against the live Schedule editor before deploying). Runs every ~7 minutes as a
  catch-up net for retainer invoices the on-edit workflow missed, and duplicated the *entire* old
  Invoice(ACCREC)+Payment logic from `syncretainerinvoicetoxero`. Left unrebuilt, it would have
  created a **second, duplicate Xero record** for every retainer invoice the rebuilt function had
  already correctly posted as a Receive Money transaction — a real double-booking risk on the
  ledger. Rebuilt identically (Receive Money, same 26100 account, same BNS DFH-Checking bank
  account), with the idempotency guard using `continue` instead of `return` since this runs over
  a batch of retainer invoices per execution, not a single record. Also dropped a dead
  write-off/rounding-adjustment block copy-pasted from the Invoice-side sync function — Retainer
  Invoices don't carry `write_off_amount`/`roundoff_value`, so it was already permanently inert.

### Deployment checklist (manual — no Books custom-function write API available to this session)

1. **New custom field, Retainer Invoices module:** "Xero Bank Transaction ID" (Text, single
   line). Confirm the live api_name once created (expected `cf_xero_bank_transaction_id`,
   matching the `cf_xero_invoice_id` / `cf_xero_credit_note_id` naming already in use elsewhere)
   — correct the two references in the REBUILD file if the actual api_name differs.
2. Paste `syncretainerinvoicetoxero_REBUILD.deluge` into function `5830143000019094452`
   (`syncretainerinvoicetoxero`), replacing the current body.
3. Paste `syncretainerinvoicestatusbetweencrmandxero_TRIM.deluge` into function
   `5830143000024812988` (`syncretainerinvoicestatusbetweencrmandxero`), replacing the current
   body.
4. Live test: create a real retainer invoice for a small amount, confirm (a) a Receive Money
   transaction appears in Xero under BNS DFH-Checking coded to PRE NEED (26100), (b) the new
   `cf_xero_bank_transaction_id` field populates on the Books retainer invoice, (c) re-saving the
   same retainer invoice does not create a second Receive Money transaction (idempotency guard),
   (d) the CRM Invoice status mirror in the trimmed status-sync function still fires correctly.
5. Paste `createRetainerInvoiceToXero_SCHEDULE_REBUILD.deluge` into the live Schedule (Settings >
   Automation > Schedules), replacing its current body — re-check it against the live editor
   first, since this file was built from a user-exported copy, not a fresh API pull. Confirm the
   ~7-minute catch-up run does not create a duplicate Receive Money transaction for a retainer
   invoice already synced by the on-edit function (the idempotency guard should make this a
   no-op via `continue`).
6. Once all three are confirmed live, come back to this document to close it out and move to
   Stage 2 (the retainer-applied → Xero credit note logic, design already captured above —
   trigger condition still needs verifying against a real retainer-applied invoice).

## Status

**CONFIRMED COMPLETE 2026-09-14 — both stages tested live and working**, using the final versions
of every file listed above (`syncretainerinvoicetoxero_REBUILD`,
`syncretainerinvoicestatusbetweencrmandxero_TRIM`, `createRetainerInvoiceToXero_SCHEDULE_REBUILD`
for Stage 1; `addPreNeedDifferenceLineAndFlagRetainerCredit_NEW` +
`createinvoiceonxero_STAGE2_HANDOFF_PATCH` for Stage 2). Completion report and release notes
delivered to Andrea 2026-09-14
(`D:\Office\Andrea_Projects\DFH\completionReport\PreNeed_Scenario1_Completion_Report_20260914.docx`
and `..._Release_Notes_20260914.docx`); repo-side entry in
`dfh-zoho-customizations/release-notes/2026-09-14.md`. Out of scope, confirmed: overpayment/
refund case, cancellation process. Scenario 2 (historic migration, ~211 records) not started —
separate piece of work.
