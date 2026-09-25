# ZP-TBD-76 (T-24) — Deal.Amount_Paid_To_Date synced from the Books master retainer

**Source:** `projectDocuments/t-24.txt`. Andrea wants the Deal to show how much of a
Pre-Need's contract has actually been paid, without opening Books. Investigated and built
2026-09-23, live-source-first (both the CRM Deals field list and the Books custom function
below were pulled fresh immediately before writing this).

## What Andrea asked for

- New currency field on the Deal: `Amount_Paid_To_Date`.
- Source of truth is explicitly **Books' master retainer invoice** — its `payment_made` (amount
  paid so far) and `balance` (amount outstanding) — **not** a sum of the CRM installment
  invoice amounts.
- Must keep updating every time another payment is received, including a second/third payment
  that doesn't fully pay off the balance.

## What already exists (confirmed live 2026-09-23)

- ZP-TBD-74 already gives every Pre-Need Deal **one** master Books retainer invoice: the first
  Deposit/Installment invoice becomes the master (`createretainerinvoiceinbooks`, CRM function),
  every sibling invoice just links to the same `Books_Invoice_ID`. See
  `crm/functions/invoices/ZP-TBD-74_preneed_single_master_retainer/metadata.md`.
- That same CRM function stamps every retainer invoice it creates with a custom field
  `cf_related_crm_deal_id` = the CRM Deal id — confirmed live on both `RET-K-2026-000102` and
  `RET-K-2026-000106` via `ZohoBooks_get_retainer_invoice`. This is the join key T-24 needs and
  it already exists; no new field was needed on the Books side.
- Zoho Books' `retainerinvoices` GET response carries `payment_made` and `balance` as plain
  top-level numbers — confirmed live on both retainers above (`payment_made: 0`, matching that
  neither test deal has a payment recorded yet).
- ZP-TBD-66 (`createPaymentsOnBooksForRetainerInvoice`, CRM function) already posts CRM-driven
  payments against the master retainer with **both** a singular `retainerinvoice_id` field and a
  `retainerinvoices` list on the same `customerpayments` create/update call.

## Where this hooks in — and why NOT the obvious place

The obvious-looking hook is `syncretainerinvoicestatusbetweencrmandxero` (Books custom function,
entity `retainer_invoice`, workflow `Sync Status Between CRM and Books for Retainer Invoice`,
workflow id `5830143000024871008`) — it already fires on retainer invoice create/update and
already reads the full retainer invoice record. **Rejected after checking the live workflow
rule**: its trigger config is `"field_update":["status"]` — it only fires when the retainer's
`status` field itself changes value. A retainer that's already `partially_paid` and receives
*another* payment while staying `partially_paid` (exactly Andrea's second example: paid
$173,750, then pays another $100,000, balance goes from $173,750 to $73,750 but status doesn't
change) would **never** re-fire this function. Confirmed by pulling the workflow rule directly
(`ZohoBooks_get_workflow`), not assumed.

**Used instead:** `allprocessonpaymentcreateandupdate` (Books custom function, entity
`customer_payment`, workflow `paymentWorkflowTriggerOnAnyCreateOrUpdate`, workflow id
`5830143000026196101`). Confirmed live: `"rule_type":"add_edit"`, `"apply_rule_always":true`,
`"field_update":[]`, `"field_update_comparator":"any"` — fires on **every** Customer Payment
create or edit, unconditionally, regardless of source (CRM-driven or entered directly in Books
by staff) and regardless of whether the retainer's status happens to change. This is also
already the bundling point for several unrelated payment-time processes in this org (payer-name
population, manual-payment CRM sync, overpayment-to-Xero) — same house pattern followed here: a
new clearly-commented block appended to the same function rather than a second workflow+function
pair.

## What the new block does

1. Reads the payment's target retainer invoice id off the just-fetched `paymentData` — tries the
   singular `retainerinvoice_id` field first (what ZP-TBD-66 actually sets), falls back to the
   first entry of a `retainerinvoices` list if that field is ever blank instead.
2. If found, re-fetches the full retainer invoice and reads its `cf_related_crm_deal_id` custom
   field via `custom_field_hash` (same access pattern this function already uses for
   `cf_crm_invoice_id` elsewhere).
3. If a Deal id is present, writes `Amount_Paid_To_Date = <retainer's payment_made>` onto that
   Deal via `zoho.crm.updateRecord`.
4. A payment with no retainer-invoice association at all (a normal invoice payment) skips the
   whole block silently — no effect on any existing behavior in this function.

No `zoho.crm.updateRecord` trigger option is passed, matching the rest of this function's
existing writes — nothing downstream needs to react to this specific field changing.

## Known gap — left out on purpose, flag to Andrea before relying on it

Before the **first** payment is ever recorded against a Deal's master retainer,
`Amount_Paid_To_Date` stays blank (not `$0`) — this block only runs when a payment fires the
Books webhook, so a Deal that hasn't received any payment yet never gets a value written. Andrea's
"before payment" example shows `Paid: $0` explicitly. Not fixed here to keep this change scoped
to the Books payment path only; the fix, if wanted, is a two-line addition to
`createretainerinvoiceinbooks` (CRM, ZP-TBD-74) seeding `Amount_Paid_To_Date = 0` on the Deal at
the moment the master retainer is first created. Flag to Andrea and build as a fast follow if she
wants the field to show `$0` instead of blank pre-payment.

## Files in this folder

| File | Purpose |
|---|---|
| `allprocessonpaymentcreateandupdate_UPDATED.deluge` | Full replacement body for the Books custom function `allprocessonpaymentcreateandupdate` (customfunction_id `5830143000026196041`). |
| `rollback/allprocessonpaymentcreateandupdate_LIVE_2026-09-23.deluge` | Live body pulled immediately before this change — paste back to revert. |
| `guideline.md` | CRM field creation steps + deployment/test steps. |

## Status

**Built 2026-09-23, not yet deployed, not yet tested.** No CRM/Books field-write or
function-write API is available to this session — apply by hand per `guideline.md`.
