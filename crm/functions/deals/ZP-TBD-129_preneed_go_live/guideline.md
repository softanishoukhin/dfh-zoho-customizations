# ZP-TBD-129 -- Pre-Need go-live (Sync Spec v2): Books side ready for Sunday

Plan: `projectDocuments/PRENEED_GO_LIVE_PLAN_2026-10-25.md`. Live checked 2026-10-23. Do A1-A4 before Sunday.

## A1 -- stop the wrong Xero posting (do first)
Books > Settings > Automation > Workflow Rules > **Sync Retainer Invoice To Xero** > **Deactivate**.
Why: it posts ONE Xero Receive Money for the retainer's **whole contract value** on the retainer date, paid or not
(spec: only money actually paid, payment by payment, and nothing for an unpaid retainer). New deposits stay correct
in Books and are pushed by the new sync next week. Nothing else uses this rule.

## A2 -- new fields
| Where | Field | Type | API name |
|---|---|---|---|
| CRM > Deals | **Contract Number** | Single Line, **Do not allow duplicate values** ticked | `Contract_Number` |
| Books > Settings > Preferences > Customers and Vendors > Field Customization | **Policy Number** | Text | `cf_policy_number` |
| Books > Settings > Preferences > Invoices > Field Customization > **Line Item** | **Contracted Item** | Checkbox | `cf_contracted_item` |
- Contract Number = the policy number (assumption D2: one number per contract). Put it on the Pre-Need layout ("PC, HP")
  near Contract Value. Deals is at its field limit; this uses one of the two slots freed in PN-08.
- Contracted Item is created now; it is filled once the at-need billing decision (D1) is made -- today contracted
  products are $0 prepaid lines and don't reach the at-need invoice.
- In Xero the policy number will go in the contact's **Account Number** (Xero contacts have no custom fields); that is
  written by the new sync, nothing to do now.

## A3 -- contract number
1. CRM > Setup > Functions > + New: `assignPreNeedContractNumber` (Automation), argument `crmid` (Int), body
   `assignPreNeedContractNumber_NEW.deluge`. Save.
2. **After Sunday's import has finished** (so no new Deal takes a number the register gives to another contract --
   the field is unique): CRM > Workflow Rules > Deals > + New: **Pre-Need - Contract Number**, On **Create or Edit** (edit: repeat every time),
   condition **Type = Pre Need** AND **Contract Number is empty** AND **Case Location is not empty**, action Function
   `assignPreNeedContractNumber`, `crmid` = Deals > Deal Id. Save.
- Format CON-MB-2026-000001 / CON-KNG-2026-000001: branch from Case Location (Montego Bay -> MB, Kingston -> KNG),
  year from Contract Signing Date (else today), next number = highest existing + 1 for that branch and year.
- **Pre-Need Deals start with no Case Location** (the Create Pre-Need Deal button doesn't ask for it), so the number
  appears as soon as staff set Case Location. Staff procedure: set Case Location when the plan is set up.
- After Sunday's import the counters simply continue from the highest imported number. Existing Deals that got a
  number before the import are corrected by the import (the register has the final numbers).

## A4 -- legacy register import
### Set up the staging module (once)
CRM > Setup > Modules and Fields > + New Module **Pre-Need Imports** (API name `Pre_Need_Imports`). Rename the record
name field to **Contract Number** (API `Name`). Add:
| Label | Type | API name |
|---|---|---|
| Branch | Pick list: MB, KNG | `Branch` |
| Payer Name | Single Line | `Payer_Name` |
| Payer Email | Email | `Payer_Email` |
| Payer Phone | Phone | `Payer_Phone` |
| Covered Name | Single Line (person the plan is for) | `Covered_Name` |
| Covered DOB | Date | `Covered_DOB` |
| Contract Date | Date | `Contract_Date` |
| Currency | Pick list: JMD, USD, GBP | `Currency` |
| Contract Amount | Decimal (2 places) | `Contract_Amount` |
| Paid To Date | Decimal (2 places) | `Paid_To_Date` |
| First Deposit Date | Date | `First_Deposit_Date` |
| Deposit Dates | Multi Line | `Deposit_Dates` |
| Plan Status | Pick list: Pre-Need, At-Need | `Plan_Status` |
| At Need Date | Date | `At_Need_Date` |
| At Need Invoice Number | Single Line | `At_Need_Invoice_Number` |
| Import Status | Pick list: New, Dry Run OK, Dry Run Problem, Imported, Failed (default New) | `Import_Status` |
| Import Message | Multi Line (large) | `Import_Message` |
| CRM Deal ID | Single Line | `CRM_Deal_ID` |
| Books Credit Note ID | Single Line | `Books_Credit_Note_ID` |
Then CRM > Setup > Functions > + New: `runPreNeedImport` (Standalone), argument `mode` (String), body
`runPreNeedImport_NEW.deluge`. Save.

### Load the register
Fill `projectDocuments/PreNeed_Register_Import_Template.xlsx` (one row per contract; Import Status = New), then CRM >
Pre-Need Imports > Import > the file. Dates as YYYY-MM-DD.

### Run (Sunday)
1. **Dry run:** Setup > Functions > runPreNeedImport > Save & Execute, `mode` = `dry`. Repeat until no "New" rows are
   left (20 rows per run). Each row gets Dry Run OK / Dry Run Problem and an Import Message saying what will happen.
   Fix problem rows in the module, set them back to New, run dry again.
2. **Tie-out:** the result shows `legacy_open_paid` = money held on open legacy plans. It must equal Xero PRE NEED at
   1 Nov 2025 (workbook: 8,450,364.50) once the register is complete -- explain every difference before step 3.
3. **Pilot:** `mode` = `commit1` (ONE row). Check: Deal (contract #, value, paid, Case Location, no Payment Type, no
   invoices), Note on the Deal, Books customer Policy Number, Books credit note in **Draft** with line PRE NEED.
4. **Commit:** `mode` = `commit` (20 per run) until all rows are Imported. A Failed row says why; nothing after it in
   that row was done. If a credit note did not stay a draft the run stops -- void that credit note in Books.
- Imported Deals are created without workflow triggers and without Payment Type, so no payment plan, invoices, tasks
  or emails are created.
- Contracts dated from 1 Nov 2025: no Books entry is made (their retainers already exist); the row only links/creates
  the Deal and reports.
- At-Need legacy rows: the draft credit note is created but not applied to the at-need invoice (Accounts, D1).

## A5 -- clean-up before go-live (findings 2026-10-23)
- Our own test Deals ("DFH Test ...") are already gone from live CRM; the client's 22 Oct test retainers were deleted.
- Still in live CRM, owned by Andrea/Dale (left for them to decide): Pre-Need Deals "Dale testing" (x2), "Andrea Ryan
  Testing", "Andrea Testing", "Andrea Ryan", "Do_Not_Delete DFH Test DPr003", and their Books retainers
  RET-K-2026-000158 / -000171 / -000173 / -000174.
- **Duplicates to merge before the import:** 4 Pre-Need Deals "Joy Jeannite" created 15 Oct 16:21-16:32
  (6503357000086796190, -86732128, -86750193, -86756179). Keep one (the one with invoices/payments, if any), delete the
  rest; otherwise the import cannot tell which one the contract belongs to (it reports a problem).
- Xero RET invoices named in the client workbook (clean-up next week, sync off): RET-MB-2024-000023/24,
  RET-MB-2025-000012/16/17/21/22/33/37/45, RET-MB-2026-000002/03/04/10/14 (+ the full list from Xero then).
