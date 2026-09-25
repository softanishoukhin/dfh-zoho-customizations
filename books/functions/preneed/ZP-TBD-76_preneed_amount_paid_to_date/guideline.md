# ZP-TBD-76 (T-24) — deployment guideline

Two things to apply by hand — a CRM field and a Books function body. No write API is available
to this session for either, so both steps are manual.

## Step 1 — Create the Deal field

Zoho CRM → Setup → Customization → Modules and Fields → **Deals** → Fields → New Field.

| Setting | Value |
|---|---|
| Field type | Currency |
| Field label | Amount Paid To Date |
| API name | `Amount_Paid_To_Date` |
| Decimal places | 2 (match `Amount` / the installment fields already on Deals) |
| Currency | Same base currency as `Amount` / the installment fields |

Add it to the Pre-Need layout section, next to `Amount` (Total Amount) and the Installment
Amount fields, so it reads naturally alongside the contract total.

**If Zoho blocks the new field with a field-limit error** (Deals is already at 326 custom
fields as of 2026-09-23 — this org has hit Deals' field ceiling before, see
[[project_deals_field_limit_sparsity_analysis]] / [[project_system_data_field_bypass]] in
memory): run the sparsity sweep from that prior work to find an unused field to retire first,
or fall back to the System_Data-module bypass pattern used for ZP-TBD-44. Either way the Deluge
write in Step 2 (`zoho.crm.updateRecord("Deals", relatedDealIdForSync, dealAmountPaidMap)`)
stays the same — you're only changing where the physical field lives, not this function.

## Step 2 — Replace the Books custom function body

Zoho Books → Settings → Automation → Custom Functions → **allprocessonpaymentcreateandupdate**
(entity: Customer Payment, id `5830143000026196041`, drives workflow
`paymentWorkflowTriggerOnAnyCreateOrUpdate`).

1. Before touching anything, copy the function's current body and paste it into
   `rollback/allprocessonpaymentcreateandupdate_LIVE_2026-09-23.deluge` in this folder if it
   differs from what's already saved there (it shouldn't — that file was pulled live
   2026-09-23 immediately before this change).
2. Select all, delete, paste in the full contents of
   `allprocessonpaymentcreateandupdate_UPDATED.deluge` from this folder.
3. Save.

No new workflow rule is needed — `paymentWorkflowTriggerOnAnyCreateOrUpdate` already fires on
every Customer Payment create/edit unconditionally (confirmed live: `rule_type: add_edit`,
`apply_rule_always: true`, no field-level condition), which is exactly the "keep updating as
payments are received" behavior T-24 asks for.

## Test plan

Use a Pre-Need test Deal that already has a master retainer (e.g. one of the `DFH Test
DPn...`/`DFH Test DPre...` records created 2026-09-22/23 — `RET-K-2026-000102`,
`RET-K-2026-000105`, `RET-K-2026-000106` all currently show `payment_made: 0`, good starting
points).

1. **Before any payment**: confirm `Amount_Paid_To_Date` is blank on the Deal (expected — see
   "Known gap" in `metadata.md`).
2. **Record a first payment** against the retainer (either via the CRM installment-payment flow
   that drives `createPaymentsOnBooksForRetainerInvoice`, or by recording a payment directly on
   the retainer invoice in Books). Confirm:
   - The retainer's `payment_made` in Books matches the amount just paid.
   - `Amount_Paid_To_Date` on the linked Deal updates to that same amount within the webhook's
     normal delay.
3. **Record a second, smaller payment** that does **not** fully pay off the retainer (stays
   `partially_paid`, i.e. the exact case that would silently fail if this had been hooked to
   `syncretainerinvoicestatusbetweencrmandxero` instead). Confirm `Amount_Paid_To_Date` updates
   to the new cumulative `payment_made` total.
4. **Pay off the retainer fully** (status moves to `paid`). Confirm `Amount_Paid_To_Date` equals
   the full contract amount.
5. **Regression check**: record a payment against a normal (non-retainer) CRM-linked invoice —
   confirm the existing `Invoice_Payers` sync, payer-name population, and overpayment-to-Xero
   behavior in this function are unaffected (the new block is a no-op for these since they carry
   no `retainerinvoice_id`).

## Rollback

Paste `rollback/allprocessonpaymentcreateandupdate_LIVE_2026-09-23.deluge` back into
`allprocessonpaymentcreateandupdate` and save. The `Amount_Paid_To_Date` field on Deals can stay
in place (it's inert without the function block) or be removed independently.
