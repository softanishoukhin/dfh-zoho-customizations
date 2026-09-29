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

## Decisions (developer, 2026-09-29)
| Question | Answer |
|---|---|
| Product rule: name starts with "Preneed" and contains "Hillview" (so `Hillview-Preneed- Regular` is excluded) | Confirmed |
| Create the retainer while the At-Need invoice is still draft | Yes |
| Create a CRM Pre-Need Deal as well | No -- scope is the At-Need Deal only |
| Retainer to Xero | **Exactly like other retainers** (existing `syncretainerinvoicetoxero` + Schedule, Receive Money into BNS DFH-Checking coded to PRE NEED) |
| At-Need payment later deleted/refunded | Not handled now |
| Deposit account for the "mark paid" payment | "Hillview Pre-Need Clearing" -- see Setup |

## Design (Books-side, one new function, no changes to any live function)
`hillviewPreNeedRetainerSync_NEW.deluge` -- Books custom function on **Invoice**, workflow rule on
create + edit, no criteria (the function exits on the first loop when there is no Hillview line).

| Event on the At-Need Books invoice | Result |
|---|---|
| Hillview Pre-Need line present (draft or not), no retainer linked | Retainer created (same customer + contact persons, one line per Hillview line: amount after discount + the line's own tax), linked both ways, comment added |
| Hillview line edited, retainer unpaid | Retainer lines replaced to match |
| Hillview line removed / invoice voided, retainer unpaid | Retainer voided |
| Same, but retainer already paid | Nothing changed, alert email |
| Invoice status becomes `paid` | Retainer marked sent (if draft) and paid with a Books payment: mode "Paid via At-Need Invoice", deposit account "Hillview Pre-Need Clearing", amount = retainer balance |

The function's own writes to the invoice (lock + link fields) are sent with
`X-ZOHO-Execute-CustomFunction: false` -- the same pattern `createinvoiceonxero` uses -- so they do not re-run
`updateInvoiceToXero` (which otherwise re-syncs the whole invoice to Xero on every edit).

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
  `hillview`** (also excludes the `Non Taxable - Preneed(2025) Hillview Vault Reg` companion row).
- **Tax:** all Hillview Pre-Need products are Tax Exempt today, so the retainer's tax is $0. The code copies each
  line's own `tax_id`, so a taxed product would carry its tax.
- **`allprocessonpaymentcreateandupdate`** (every payment): for a retainer payment it reads
  `cf_related_crm_deal_id`, overwrites that Deal's `Amount_Paid_To_Date` and runs the ZP-TBD-82 contract check.
  The Hillview retainer does **not** get that field (the At-Need Deal id goes in the retainer notes). Its
  "Books"/"CRM" blocks behave as for today's CRM-created retainer payments (same payload shape as
  `createPaymentsOnBooksForRetainerInvoice`, `cf_payment_created_from` not set).
- **`syncretainerinvoicestatusbetweencrmandxero`**: only acts when `cf_crm_invoice_id` is set -> no-op here.
- **`addpreneeddifferenceandcreditnoteonretainerapply`** (every retainer edit, no criteria): exits when the
  retainer is not applied to an invoice -> no-op here. If staff ever *apply* the Hillview retainer to an
  invoice it would run the Pre-Need difference / credit-note logic -- hence the "do not apply" notes/comments.
- **`createinvoiceonxero`** codes each At-Need invoice line to the Xero account with the same name as the Books
  line's account -> the Hillview line goes to **PRE NEED 26100**.

### Accounting effect -- accepted as decided
- **Xero:** the At-Need invoice (Hillview line -> PRE NEED) and its payment (-> bank) are unchanged. The retainer
  additionally posts a Receive Money into **BNS DFH-Checking**, coded to PRE NEED, when it is created -- exactly
  like other retainers. So in Xero the Hillview amount appears **twice** in BNS DFH-Checking and twice in PRE NEED
  (26100), and the BNS bank reconciliation has one extra receipt per Hillview purchase. Chosen deliberately on
  2026-09-29 over the clearing-account alternatives (Receive Money into a "Hillview Pre-Need Clearing" bank
  account, with or without an automatic reversing journal). Dale should be told before go-live.
- **Books:** the retainer payment is Dr "Hillview Pre-Need Clearing" / Cr retainer; no new money in a real bank.
- The paid retainer stays as **unused retainer credit** on the customer. It must not be applied or refunded;
  the notes + comment say so.

## Setup (manual)
| Item | Detail |
|---|---|
| Books Invoice custom field | "Hillview Retainer ID", text, api_name `cf_hillview_retainer_id` |
| Books Retainer Invoice custom field | "Hillview Source Invoice ID", text, api_name `cf_hillview_source_invoice_id` |
| Books account | **"Hillview Pre-Need Clearing"**, type **Bank** (so it can be the Deposit To of a payment), no bank feed. Holds only the "Paid via At-Need Invoice" payments. Until it exists the retainer is created but not marked paid (alert email). |
| Books custom function | `hillviewPreNeedRetainerSync` (Invoice) |
| Books workflow rule | "Hillview Pre-Need Retainer" -- Invoices, created or edited, no criteria, action = the function |

## Not covered
- Partial payments on the At-Need invoice: the retainer is marked paid only when the invoice is fully paid.
- At-Need payment deleted/refunded after the retainer was marked paid (decided: not now).
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
syncretainerinvoicestatusbetweencrmandxero, allprocessonpaymentcreateandupdate, createinvoiceonxero,
addpreneeddifferenceandcreditnoteonretainerapply; workflows updateInvoiceToXero,
addPreNeedDifferenceAndCreditNoteOnRetainerApply. Repo: ZP-TBD-65 Schedule rebuild, ZP-TBD-74, ZP-TBD-80, ZP-TBD-56-2.
