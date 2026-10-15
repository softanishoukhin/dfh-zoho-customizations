# ZP-TBD-97 -- PN-08: six instalment fields on Deals

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: checked 2026-10-02. Andrea decided 2026-10-14 (PRENEED_DEV_LIST_2026-10-14, PN-08 answer): delete
Commencement Date + Day of Month, HIDE Number_of_Installments (live data on 2 Deals), keep Create_Installment_Invoice
1/2/3. Re-checked 2026-10-15 against all 10 live Pre-Need widgets (PN Invoices, Payment Plan, Plan Editor, Payment
Status, Products Editor/View, Contacts Editor, Wishes View, Payer Emails, Start a Preneed): no reference.
Guideline rewritten; NOT applied yet** (manual Setup steps -- see `guideline.md`).

**Source:** `projectDocuments/PRENEED_DEV_TICKETS_2026-10-01.md`, PN-08 -- "not read or written by any of the eight
functions ... Confirm nothing else uses them, then remove -- or tell Andrea which are still needed and why."

## Findings (live, 2026-10-02)

| Field | Used by | Deals with a value | Verdict |
|---|---|---|---|
| `Number_of_Installments` | Nothing (no function, rule or layout rule; already found dead in ZP-TBD-75) | 2 (old) | **Remove** |
| `Installment_Commencement_Date` | Nothing since ZP-TBD-81 (29 Sep) replaced the ZP-TBD-75 date-driven schedule | 1 | **Remove** |
| `Installment_Day_of_Month` | Nothing since ZP-TBD-81 | 1 | **Remove** |
| `Create_Installment_Invoice_1` | **Written** on every Installment 1 invoice build: `createInstallmentInvoice` -> `standalone.save_api_responses("Create_Installment_Invoice_" + N, ...)` stores the CRM API reply (a log). Never read. | 7 | Keep (log) -- hide from layouts |
| `Create_Installment_Invoice_2` | Same, Installment 2 | 7 | Keep (log) -- hide from layouts |
| `Create_Installment_Invoice_3` | Same, Installment 3 -- only reachable through the old Installment 3 path | 1 | Goes with **PN-06** (Instalment 3 decision) |

Why the ticket missed the log fields: the field name is built at run time (`"Create_Installment_Invoice_" + N`), so a
search for the literal field name doesn't find the write.

Also checked: the Deal dispatcher `handleWorkflowTriggerAndActionByTimelineProcess` (no reference), the old
per-installment functions `createInvoiceForInstallment1/2/3` (pass-throughs to `createInstallmentInvoice`), all 104
Deal workflow rules' saved criteria (no reference), Deal layout rules (none keyed on these fields), the whole
`dfh-zoho-customizations` repo and `widgets` folder (only the log write above).

If the log fields are ever removed, also delete the `save_api_responses` line at the end of `createInstallmentInvoice`
(otherwise that write just fails quietly every time).

Bonus: Deals is at its field limit -- removing the 3 dead fields frees 3 slots.
