# ZP-TBD-73 -- Pre-Need Funeral Contract via Zoho Sign template (T-14)

**Folder number is a placeholder** (`ZP-TBD-73`) -- rename once a real Zoho Projects task ID exists.

**Status: DRAFT, not deployed, not tested.** Function body written; the Sign template itself is built
manually in the Zoho Sign editor (T-14 is a MANUAL task -- pasted `${}` placeholders do not work in Sign,
fields must come from Sign's own field picker).

| | |
|---|---|
| Function | `button.sendPreNeedFuneralContract(int crmid)` -- Deals custom button, returns `string` (`result.toString()`) |
| Sign template ID | `441773000001137101` |
| Model | `automation.sendEmbeddedEmbalmingAuthForm` (template `441773000001042043`) -- same createUsingTemplate + embedtoken pattern |
| Source contract | Writer doc `ubfm148d1038a8ca14b7ebff242b4a8728552` ("Pre Need Funeral Burial Contract.pdf") |
| Connection | `zohooauth` (needs `ZohoSign.documents.ALL`, `ZohoSign.templates.ALL`) |

## Field map (Sign label -> source)

Sign prefill keys are the field **labels**. The template currently uses the default `Text - N` labels;
renaming them in the Sign editor requires renaming the keys in `function.deluge` too.

| Sign label | Contract slot | Source | State |
|---|---|---|---|
| Text - 1 / 2 / 3 | Contract date: day / month / year | `zoho.currenttime` (`dd`, `MMM`, `yyyy`) | as drafted by developer |
| Text - 4 | ? | -- | **unmapped, purpose unknown** |
| Text - 5 | Buyer name | `Deals.Contact_Name` (name) | as drafted |
| Text - 6 | Buyer address | `Contacts.Mailing_Street` | as drafted |
| Text - 7 | TRN | `Accounts.Deceased_TRN` | as drafted -- **confirm this is the Buyer's TRN, not the beneficiary's** (field is labelled "Deceased TRN") |
| Text - 8 | Casket price | `Deals.Casket_Price` | as drafted |
| Text - 9 | Total contract price | `Deals.Amount` | **commented out** -- box not seen, number unconfirmed |
| Text - 10 | Deposit | `Deals.Pre_Need_Deposit_Amount` (new, created 2026-09-21) | filled |
| Text - 11 | Installment amount | `Deals.Installment_1_Amount` | filled, CONFIRM |
| Text - 12 | Installment day of month | day of `Deals.Installment_1_Due_Date` | filled, CONFIRM |
| Text - 13 | Commencement month/year | month+year of `Deals.Installment_1_Due_Date` | filled, CONFIRM |
| Text - 14 / 15 | Balance date (day / month-year) | `Deals.Pre_Need_Balance_Due_Date` (new, created 2026-09-21) | filled |
| Text - 16 | "Or in Full" amount | `Deals.Amount` | filled, CONFIRM |
| (Package contents) | Package contents | none on Deals | **not filled -- no source field, label unknown** |

Unset keys are simply omitted, so those boxes stay empty on the contract.

## Companion change: `calculateInstallmentAmount`

`button.calculateInstallmentAmount` (existing Deals button) split the whole `Amount` evenly into
Installment 1-3. With a deposit, it now splits `Amount - Pre_Need_Deposit_Amount` instead
(`calculateInstallmentAmount_UPDATED.deluge`). Blank deposit = 0 = identical to old behaviour. A deposit
larger than the total returns a message and writes nothing. **The specialist must enter the deposit BEFORE
clicking Calculate Installment Amount**, otherwise the installments are computed on the full total.
Base for this update was the version pasted by the user on 2026-09-21 (writes `Installment_3_Amount`);
the older backup in `All functions/Backup DFH/` still writes `Installment_4_Amount` -- do not use it.
Not in the repo before this; not yet deployed.

## Companion change: deposit retainer invoice (`createPreNeedDepositRetainerInvoice`)

Decision (user, 2026-09-21): `createInvoiceIfPaymentTypeIsPaymentInFull` is **not modified**. A separate new
function, `automation.createPreNeedDepositRetainerInvoice(Int crmid)` (`createPreNeedDepositRetainerInvoice.deluge`),
creates one retainer invoice for `Pre_Need_Deposit_Amount`.

- **Trigger (to be created by hand):** Deals workflow rule, on field update of `Pre_Need_Balance_Due_Date`
  (any value / not empty) -> Function `createPreNeedDepositRetainerInvoice`. Workflow criteria can't gate on the
  deposit itself, so that check lives in the function.
- **Order of entry:** the specialist must enter the **deposit first**, balance due date last -- the deposit is read
  at the moment the balance date is provided. Editing the deposit afterwards does NOT update the invoice.
- **Idempotency:** skips if an Invoice with Subject `Deposit Invoice%` already exists on the Deal, so re-editing the
  balance date can't create a second one.
- **Skips (logs via `info`, creates nothing):** deposit blank/0, deposit > Amount, Deal has no products, invoice already exists.
- **Shape:** same as the installment invoices -- `Retainer_Invoice = true`, deposit spread across the Deal's product rows,
  `List_Price = share / Quantity` (ZP-TBD-67 fix), Due Date = today, Potential Payers created for the Account's contacts.
  Subject `Deposit Invoice - <Deal name>`; linked to the Pre-Need Sales Order if one exists.
- **Not verified:** the workflow rule that will call it doesn't exist yet; `standalone.COQLQuery` was used exactly as
  `createInvoiceIfPaymentTypeIsPaymentInFull` uses it (`.size()`, `.toList()`) but `Subject like` in that helper is untested.
- **Interplay to watch in test:** deposit is spread by product row, so the installment invoices (which split
  `Amount - Deposit` after `calculateInstallmentAmount`) plus the deposit invoice should sum to the Deal Amount.

## Companion change: `updateDealAmountForPreNeed`

`standalone.updateDealAmount` derives `Deals.Amount` from the Deal's Family/Other **invoice**. For pre-need that's
wrong once deposit + installment retainer invoices exist (each holds only a slice). New function
`standalone.updateDealAmountForPreNeed(Int crmid)` (`updateDealAmountForPreNeed.deluge`) calculates it from
`Product_Selection` instead. The old function is not modified.

- `Amount = sum(Quantity x Unit_Price) - sum(Discount)` over the subform rows (blank/0 Quantity counts as 1, same as
  the invoice-creating functions). This equals the old function's `Sub_Total`.
- `Total_Discount = sum(Discount)`.
- **`Total_Tax`** is calculated per row as `(Quantity x Unit_Price - Discount) x rate / 100`, summed. The subform itself has
  no Tax field (fields: Parent_Product, Child_Product, Quantity, Child_Category, Unit_Price [read-only, comes from the
  product], Discount, plus casket/ID helpers), so the rate comes from the row's **Child_Product -> `Products.Tax`**.
  `Products.Tax` is a multi-select picklist whose values embed the rate ("GCT on Sales - 15.0 %", "Tax Exempt - 0.0 %",
  "Zero Rated - 0.0 %", ...); the function parses the number after the last "-" and **adds up** all selected taxes on a product.
  Rate is cached per product id, so a product repeated across rows costs one lookup.
- `Amount` stays **tax-exclusive**, matching the old function (`Sub_Total` + adjustment, no tax).
- **Verify in test:** the deposit/installment invoice functions don't pass `Line_Tax`, so whether those invoices actually
  carry the product's tax depends on CRM's default-tax behaviour. Compare Deal `Total_Tax` against the invoices' `Tax` total
  on the first real test and tell us if they differ.
- **Assumption to confirm:** subform `Discount` (added 2026-07-08) is a row-level **amount**, not per-unit and not a percent.
- Writes only when Amount/Total_Discount actually changed (avoids a loop if an edit workflow calls it).
- **Not yet done -- callers:** backup copies of `Create Retainer Invoice in Books` and `Create Sales Order from Deals` call
  `standalone.updateDealAmount`. They must route pre-need Deals to the new function (e.g. branch on the Deal's Pipeline;
  the ZP-TBD-67 test Deal shows Pipeline "Pre Need" -- confirm the exact value). Those backups may be stale: pull the live
  source first and grep every function for direct calls before changing any of them.
- **Not verified:** the Deal lookup tool returned no record body, so this was written from field metadata, not checked
  against a real Deal's subform rows.

## T-16: product discount carried into invoices

`Product_Selection.Discount` was never copied onto invoices. Fixed in both live builders using the **live source pulled from
CRM on 2026-09-21** (`rollback/` holds the pre-change copies):
- `createInvoiceIfPaymentTypeIsPaymentInFull_DISCOUNT.deluge` -- direct copy of the row Discount (3 places).
- `createInstallmentInvoice_DISCOUNT.deluge` -- pro-rata (installment amounts are already net of discount, a direct copy
  would discount twice); tax now computed after the line discount.
- `createPreNeedDepositRetainerInvoice.deluge` -- same pro-rata rule as the installment builder.
Full rationale, formulas, apply steps and rollback in `guideline.md`. Tests D1-D13 in `test-cases.md`.
Resolved by reading the live installment builder: it **does** send explicit `Line_Tax`/`Tax` (first tax on the product
only), so installment invoices carry tax. The pay-in-full builder sends none.

## Open items
1. What is Text - 4? Where does Package contents live (which Text - N, which CRM field)?
2. Where do Deposit and Balance date come from -- new Deals fields, or the Pre-Need Questionnaire module?
3. Is `Accounts.Deceased_TRN` the right source for the buyer's TRN on a pre-need Deal?
4. Signing mode: drafted as **embedded, on-site** (recipient email `info@dfhja.com`, same as the embalming form).
   If the contract should be emailed to the buyer instead, change `recipient_email`, drop `is_embedded` /
   the embedtoken block, and drop `is_quicksend` handling as needed.
5. The signer `action_id` and `role` are read live from `GET /templates/{id}` (response shape
   `templates.actions[0].{action_id,role}` assumed from Sign API docs, **not yet verified against a real response**).
   If the first test fails on "Could not read signer action", paste the message back -- it prints the raw response.
6. No Deal status field is updated (the embalming form sets `Embalming_Auth_Form_Status`; no pre-need equivalent exists).

## Deployment
1. Confirm the open items above and finish the mapping.
2. CRM > Setup > Developer Space > Functions > create `sendPreNeedFuneralContract` (category: Button), paste `function.deluge`.
3. Create a Deals custom button that calls it; show `sign_url` to the user the same way the embalming button does.
4. Test per `test-cases.md`.

## Rollback
New function and new button only -- remove the button and delete the function. Nothing existing is modified.
