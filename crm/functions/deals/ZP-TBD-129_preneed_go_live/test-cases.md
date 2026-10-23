# ZP-TBD-129 - Pre-Need go-live (contract number + register import) - tests

## Test data (set up first)

| What | Where | Enter / check |
|---|---|---|
| Test register rows | CRM > Pre-Need Imports > Import (or + New) | R1 CON-KNG-2024-999901, KNG, Covered 'DFH Test Legacy One', contract 2024-05-01, JMD, amount 300000, paid 150000, first deposit 2024-05-01, Pre-Need, New. |
|  |  | R2 CON-MB-2024-999902, MB, Covered 'DFH Test Legacy Two', contract 2024-06-01, amount 200000, paid 0, Pre-Need, New. |
|  |  | R3 CON-MB-2026-999903, MB, Covered 'DFH Test New Three', contract 2026-01-10, amount 250000, paid 100000, Pre-Need, New. |
|  |  | R4 CON-MB-24-1, MB, Covered 'DFH Test Bad Four', contract 2024-01-01, amount 100000, paid 0, New (wrong number on purpose). |
|  |  | R5 CON-KNG-2025-999905, KNG, Covered 'DFH Test AtNeed Five', contract 2025-03-01, amount 180000, paid 180000, At-Need, invoice INV-TEST, New. |
| Run the importer | Setup > Functions > runPreNeedImport > Save & Execute | mode = dry / commit1 / commit |
| Clean up after | CRM + Books | Delete the DFH Test Deals, Accounts, Contacts, the Books draft credit notes and the 5 import rows. |

## Tests

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Books > Workflow Rules | Open 'Sync Retainer Invoice To Xero'. | It is Inactive (A1). |  |
| 2 | Runner | Run mode = dry. | R1, R2, R3, R5 = Dry Run OK; R4 = Dry Run Problem ('Contract Number must look like ...'). Nothing created anywhere. |  |
| 3 | R1 Import Message | Read it. | WILL DO: New Account 'DFH Test Legacy One' ... | Books draft credit note JMD 150000 (PRE NEED). |  |
| 4 | R5 Import Message | Read it. | Includes the NOTE that the credit note is NOT applied to the at-need invoice. |  |
| 5 | Runner result | Look at register_totals. | legacy_open_paid counts R1 and R2 only (150000); R5 is At-Need, R3 is not legacy. |  |
| 6 | Runner | Run mode = commit1. | Exactly one row becomes Imported: R1 (rows go in contract-number order, CON-KNG-2024-999901 first). |  |
| 7 | R1 Deal | Open CRM Deal from CRM Deal ID. | Pre-Need Deal, Contract Number CON-KNG-2024-999901, value 300000, paid 150000, Case Location Kingston, Contract Status Signed, NO Payment Type, NO invoices, a Note 'Imported pre-need contract ...'. |  |
| 8 | Books | Open the credit note in Books Credit Note ID. | Status DRAFT, one line on PRE NEED, Zero Rated, 150000, reference 'Pre-Need CON-KNG-2024-999901'. Customer has Policy Number CON-KNG-2024-999901. |  |
| 9 | Runner | Run mode = commit. | R2, R3, R5 Imported. R2 and R3 have no credit note; R5 has a draft. |  |
| 10 | Runner | Set R1 back to Dry Run OK and run commit again. | No second Deal and no second credit note ('Deal already has this number' / 'credit note already in Books'). |  |
| 11 | CRM > Deals | Create a Pre-Need Deal (Create Pre-Need Deal button). Case Location empty. | No Contract Number (A3 rule active after the import). |  |
| 12 | Same Deal | Set Case Location = Kingston. Save. | Contract Number = CON-KNG-2026-000001 (or next after the highest KNG 2026). |  |
| 13 | Another Pre-Need Deal | Set Case Location = Montego Bay. | CON-MB-2026-<next>. |  |
| 14 | First Deal | Change Case Location to Montego Bay. | Contract Number does NOT change. |  |
