# ZP-TBD-90 — DEV_LIST item 5d: Buyer's TRN, clause 20, contract date

## Live facts (2026-10-01)

- `Contacts.TRN` (text) exists; the contract senders already print it as Sign "Text - 7". Nothing collected it:
  the Create Pre-Need Deal widget's TRN box wrote only `Accounts.Deceased_TRN` (beneficiary), and its code still
  said Contacts had no TRN field (true on 2026-09-16, no longer).
- No field for the Disposition of Cremated Remains on Deals, Contacts, Accounts or Pre_Need_Questionnaire; the
  senders fill nothing for clause 20. Sign template field labels can't be read (Sign MCP disabled).
- The contract's own date ("this __ day of __") = the send date (`zoho.currenttime`), not `Contract_Signing_Date`.
- The three instalment fields (`Number_of_Installments`, `Installment_Day_of_Month`, `Installment_Commencement_Date`)
  are unused since ZP-TBD-81; clause 5 is filled from Installment_1_Amount / _Due_Date, Pre_Need_Deposit_Amount and
  Pre_Need_Balance_Due_Date.

- The Full contract template PDF (`D:\Downloads\Delapenha_Pre_Need_Contract_Merged.pdf`, 2026-09-25, "Pre-Need
  Contract – Casket") has clauses 1–19 only: **no clause 20**, no cremated-remains wording.

## Decisions + build

See `guideline.md`. Contact widget (Buyer TRN, required); questionnaire + 2 CRM fields + 2 Creator patches (clause 20
recorded); contract date unchanged. Printing clause 20 on the contract is **on hold** (`onhold_clause20_sender_patch.md`)
until Andrea shares the contract that has clause 20.

## Status

Built 2026-10-01, not applied, not tested. Repo not committed.
