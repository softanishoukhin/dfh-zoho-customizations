# ZP-TBD-85 — Test cases

Use a fresh Pre-Need test Deal with products (e.g. Contract Value 525,000). xlsx copy:
`D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-85_master_retainer_race_test_cases.xlsx`.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| T1 | Instalments: one retainer | Set Payment Type = Instalments. Wait ~1 min. | Books: exactly **1** retainer for this Deal, total = Contract Value (525,000). |
| T2 | All invoices linked | Open the 3 CRM invoices (Deposit, Instalment 1, Instalment 2). | All 3 show the **same** Books Invoice ID / Number. None has a "Books retainer not linked" Note. |
| T3 | Who created it | Function logs of `createretainerinvoiceinbooks` for the 3 runs. | Deposit run created the retainer; the other two log "waits for sibling invoice ..." then "Linked Invoice ...", or exit with "already has a Books retainer linked". |
| T4 | Payment plan unchanged | Check the Deal and invoice amounts/dates. | Deposit 262,500 (+7 days), Instalment 1 131,250 (end of month +2), Instalment 2 131,250 (end of month +4); sum = 525,000. |
| T5 | Deposit payment | Record the 262,500 deposit payment. | The one retainer moves to partially_paid, balance 262,500. Deposit invoice shows Partially Paid / 262,500 paid in CRM. |
| T6 | Instalment payment | Record 131,250 against Instalment 1. | Same retainer, balance 131,250. No new retainer. |
| T7 | Rebuild the plan | Click Calculate Installment Amount on the same Deal. | Instalment invoices are updated. Still 1 retainer in Books; its lines are not changed. |
| T8 | Lump Sum unaffected | New Deal, Payment Type = Lump Sum. | One invoice / one Books document as before (this fix only acts on Deposit / Instalment invoices). |
| T9 | Other invoices unaffected | Create a normal (non-Pre-Need) invoice, e.g. Police/Hospital. | Syncs to Books exactly as before. |
| T10 | Older button flow | Deal with an existing Deposit invoice already linked; add an instalment via a due-date edit. | New instalment links to the existing retainer straight away (no wait). |
