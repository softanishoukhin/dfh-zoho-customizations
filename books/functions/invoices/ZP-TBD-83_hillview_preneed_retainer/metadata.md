# ZP-TBD-83 -- Hillview Pre-Need (vault / plot) bought on an At-Need invoice

**Source:** Andrea, 2026-09-29 (new Pre-Need scenario, separate from ZP-TBD-65/74/80).
Built 2026-09-29 on live source pulled the same day. **Not deployed, not tested.**

## Requirement
A family with an existing At-Need Deal/invoice sometimes also buys a Hillview vault or plot as a
Pre-Need item. When such a product is on the At-Need invoice:
1. Automatically create a Books **Retainer Invoice** for the same customer = Hillview product amount +
   applicable sales tax.
2. When the At-Need invoice is **paid in full**, the retainer must show the Hillview amount (incl. tax) as
   paid -- without staff collecting that money a second time.

## Design (Books-side, one new function, no changes to any live function)
`hillviewPreNeedRetainerSync_NEW.deluge` -- Books custom function on **Invoice**, workflow rule on
create + edit, no criteria (the function exits on the first loop when there is no Hillview line).

| Event on the At-Need Books invoice | Result |
|---|---|
| Hillview Pre-Need line present, no retainer linked | Retainer created (same customer + contact persons, one line per Hillview line: amount after discount + the line's own tax), linked both ways, comment added |
| Hillview line edited, retainer unpaid | Retainer lines replaced to match |
| Hillview line removed / invoice voided, retainer unpaid | Retainer voided |
| Same, but retainer already paid | Nothing changed, alert email |
| Invoice status becomes `paid` | Retainer marked sent (if draft) and paid with a Books payment: mode "Paid via At-Need Invoice", deposit account "Hillview Pre-Need Clearing", amount = retainer balance |

### Why Books-side and not a CRM "Retainer" invoice
The org has a dormant CRM prototype for this (`standalone.createRetainerInvoiceForPlotItem`: "Retainer Sales
Order" -> CRM Invoice `Invoice_For = Retainer Plot` -> `createRetainerInvoiceInBooks`). Checked live
2026-09-29: **0** Retainer Sales Orders and **0** Retainer Plot invoices exist, and nothing calls it. Not reused,
because a CRM Invoice on the At-Need Deal would:
- be counted by `standalone.updateDealAmount` (Deal amount inflated by the Hillview amount a second time);
- hold up `updatedealstagetoinvoicespaidinfullonceallinvoices` until the retainer is "paid";
- get Potential Payers, payment links and reminders -- i.e. staff/family chased for the money twice;
- make `createRetainerInvoiceInBooks` write `cf_related_crm_deal_id` = the At-Need Deal (see below).

### Live facts that shaped it (2026-09-29)
- **Product names:** the 13 live products are named `Preneed(2025) Hillview ...` (parent "Pre Need", Sales
  Account "PRE NEED", all **Tax Exempt 0%**). A literal "contains 'Preneed Hillview'" test matches none of
  them. Rule used: name lower-cased with spaces/hyphens removed **starts with `preneed` and contains
  `hillview`**. This excludes `Non Taxable - Preneed(2025) Hillview Vault Reg` (zero-rated companion row) and
  the at-need product `Hillview-Preneed- Regular` (parent "Hillview", Sales Account "Sales") -- confirm with
  Andrea that the latter is really an at-need item.
- **Tax:** because all Hillview Pre-Need products are Tax Exempt today, the "applicable sales tax" on the
  retainer is $0. The code copies each line's own `tax_id`, so a taxed product would carry its tax.
- **`syncretainerinvoicetoxero`** (workflow "Sync Retainer Invoice To Xero") posts a Xero Receive Money for the
  full total of every new retainer, and the ZP-TBD-65 Schedule `createRetainerInvoiceToXero` does the same as a
  7-minute catch-up. Both skip a retainer whose `cf_xero_bank_transaction_id` is filled. The new retainer is
  created with that field pre-set to `NOT SYNCED - Hillview Pre-Need paid via At-Need invoice`, so neither posts
  it -- the cash already reaches Xero through the At-Need invoice and its payment. No edit to either.
- **`allprocessonpaymentcreateandupdate`** (every payment): for a retainer payment it reads
  `cf_related_crm_deal_id` and overwrites that Deal's `Amount_Paid_To_Date` and runs the ZP-TBD-82 contract
  check. The Hillview retainer does **not** get that field (the At-Need Deal id goes in the retainer notes).
  Its "Books"/"CRM" blocks behave exactly as for today's CRM-created retainer payments (same payload shape as
  `createPaymentsOnBooksForRetainerInvoice`, `cf_payment_created_from` not set).
- **`syncretainerinvoicestatusbetweencrmandxero`**: only acts when `cf_crm_invoice_id` is set -> no-op here.
- **`addpreneeddifferenceandcreditnoteonretainerapply`** (every retainer edit, no criteria): exits when the
  retainer is not applied to an invoice -> no-op here. If staff ever *apply* the Hillview retainer to an
  invoice it would run the Pre-Need difference / credit-note logic -- hence the "do not apply" notes/comments.
- **`updateInvoiceToXero`** fires `createinvoiceonxero` on every edit of an invoice that has a Xero id. This
  function edits the invoice twice, once only per Hillview invoice (lock + link) -> 2 extra Xero re-syncs of
  that invoice. Nothing is written to the invoice on the paid step.

### Accounting effect (for Dale)
- **Xero:** unchanged from today -- At-Need invoice line coded to PRE NEED (26100) via the product's Sales
  Account, payment into the bank. The retainer never reaches Xero.
- **Books:** the retainer payment is Dr "Hillview Pre-Need Clearing" / Cr retainer (unearned) and the At-Need
  invoice line is Cr PRE NEED. The clearing account therefore carries a debit equal to the Hillview amounts --
  Dale decides how he wants it (e.g. clear it periodically against PRE NEED). No money is counted twice in the
  bank.
- The paid retainer stays as **unused retainer credit** on the customer. It must not be applied or refunded;
  the notes + comment say so.

## New setup (manual)
| Item | Detail |
|---|---|
| Books Invoice custom field | "Hillview Retainer ID", text, api_name `cf_hillview_retainer_id` |
| Books Retainer Invoice custom field | "Hillview Source Invoice ID", text, api_name `cf_hillview_source_invoice_id` |
| Books account | "Hillview Pre-Need Clearing" (type per Dale). Until it exists the retainer is created but not marked paid; an alert email says so |
| Books custom function | `hillviewPreNeedRetainerSync` (Invoice) |
| Books workflow rule | "Hillview Pre-Need Retainer" -- Invoices, created or edited, no criteria, action = the function |

## Open questions
**Andrea**
1. Confirm the name rule (starts with "Preneed", contains "Hillview"), and that `Hillview-Preneed- Regular` is
   an at-need product (excluded).
2. Should the retainer also be created while the At-Need invoice is still **draft**? (Built: yes -- it follows the
   invoice and is voided if the line is removed.)
3. Should the Hillview purchase also create a **Pre-Need Deal** in CRM? Without one, the ZP-TBD-78/79/80
   conversion flow (Find Pre-Need matches / Get Pre Need Info) will not find this purchase when the plot is used.
   Not built.

**Dale**
4. Deposit account for the "mark paid" payment -- name/type of "Hillview Pre-Need Clearing", and how it is
   cleared.
5. OK that the retainer never posts to Xero (Xero already has it through the At-Need invoice)?
6. Invoice paid, then the payment is deleted/refunded -> retainer stays paid (not reversed automatically).

## Not covered
- Partial payments on the At-Need invoice: the retainer is marked paid only when the invoice is fully paid.
- Currency: the retainer takes the customer's default currency (same as the At-Need invoice in normal cases).
- Existing At-Need invoices that already hold a Hillview line get a retainer on their next edit (any save).

## Files
| File | Purpose |
|---|---|
| `hillviewPreNeedRetainerSync_NEW.deluge` | New Books custom function body |
| `guideline.md` | Deployment steps + rollback |
| `test-cases.md` | Pointer to the xlsx test set |

## Sources checked (live, 2026-09-29)
CRM: `getFunctions` (all 3 pages), `getFunctionCode` createretainerinvoiceforplotitem, createsalesordersforshipins,
checkhillviewupgradefield, createpaymentsonbooksforretainerinvoice; Products (all 987), record counts for Retainer
Sales Orders / Retainer Plot invoices. Books: custom function list; syncretainerinvoicetoxero,
syncretainerinvoicestatusbetweencrmandxero, allprocessonpaymentcreateandupdate,
addpreneeddifferenceandcreditnoteonretainerapply; workflows updateInvoiceToXero,
addPreNeedDifferenceAndCreditNoteOnRetainerApply. Repo: ZP-TBD-65 Schedule rebuild, ZP-TBD-74, ZP-TBD-80, ZP-TBD-56-2.
