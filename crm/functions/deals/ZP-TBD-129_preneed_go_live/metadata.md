# ZP-TBD-129 -- Pre-Need go-live (Pre-Need Sync Spec v2): Books/CRM side for Sun 25 Oct

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-23, NOT applied.** A1-A5 per `guideline.md`. The Xero sync rebuild (spec E1-E7) is the next
ticket. Plan: `projectDocuments/PRENEED_GO_LIVE_PLAN_2026-10-25.md`.

**Source:** Andrea 23 Oct (`projectDocuments/preNeed workflow changes 10232026.txt`), `Pre-Need Sync Spec v2.docx`
(Dale, 16 Oct), client workbook `Pre-Need Books vs Xero Nov 2025 - Jan 2026 (rerun 22 Oct 2026).xlsx`.

## Live facts (2026-10-23)
- Books rule "Sync Retainer Invoice To Xero" (5830143000019193018): On Edit, criteria cf_xero_invoice_id not empty ->
  `syncretainerinvoicetoxero` posts ONE Xero Receive Money (PRE NEED 26100, bank BNS AB461C09...) for the retainer's
  full line totals on the retainer date; idempotent on cf_xero_bank_transaction_id. Not per payment, ignores paid.
- Xero tenant 879c4d25-cee8-46c1-89f9-80dcfe572eb2 (Delapenha Funeral Home); claude.ai Xero connector connected
  2026-10-23 (read-only reporting: invoices, contacts, accounts, reports; no credit notes / journals / ledger lines).
- Deals: 362 fields (limit); Case_Location picklist "Delapenha Funeral Home - 45 Union St., Montego Bay" /
  "... - 20A W. Kings House Rd., Kingston"; Pre-Need Deals have NO Case Location (Dale testing). Layout "PC, HP"
  6503357000000091023, Pipeline "Pre Need", Stage "Requested". Account DOB = `Date_of_Birth`.
- Books: Zero Rated tax 5830143000000594721; PRE NEED 5830143000000594557. Books has a credit-note workflow
  (updateCreditNoteToContraBank) -> importer writes with X-ZOHO-Execute-CustomFunction=false.
- At-need funeral invoices come from Sales Orders (`createsalesordertobooks`); under ZP-TBD-80 contracted products
  are $0 prepaid lines / no SO when fully paid -> contracted-item flag only meaningful after decision D1.
- Last 200 Deals (23 Oct): no "DFH Test" Deals left; Andrea/Dale test Pre-Need Deals remain; 4 duplicate "Joy
  Jeannite" Pre-Need Deals (15 Oct).

## Files
| File | Purpose |
|---|---|
| `assignPreNeedContractNumber_NEW.deluge` | CRM automation; Deals rule (activate AFTER the import) |
| `runPreNeedImport_NEW.deluge` | CRM standalone, mode dry / commit1 / commit, staging module Pre_Need_Imports |
| `guideline.md` | A1-A5 |
| `test-cases.md` | Same as the xlsx |
| `projectDocuments/PreNeed_Register_Import_Template.xlsx` | Register template for DFH |
