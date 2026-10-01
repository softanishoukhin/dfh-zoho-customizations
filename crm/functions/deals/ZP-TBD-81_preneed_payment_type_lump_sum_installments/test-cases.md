# ZP-TBD-81 -- test cases

Full set also in `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-81_PreNeed_Payment_Type_Test_Cases.xlsx`.
Use a Pre Need test Deal with products (Contract Value > 0). "Due +7" = invoice creation date + 7 days.

| # | Setup | Action | Expected |
|---|---|---|---|
| T1 | New Pre Need Deal, Contract Value 400,000, no signing date | Set Payment Type = Installments | Contract Signing Date = today; Must End By = today + 6 months; Deposit 200,000; Inst 1 100,000 due end of (this month + 2); Inst 2 100,000 due end of (this month + 4); Balance Due Date = Inst 2 date; Inst 3 blank. Invoices: Deposit 200,000 due +7, Installment 1, Installment 2 with those due dates. |
| T2 | Same, signing date 15-Oct-2026 entered first | Set Payment Type = Installments | Inst 1 due 31-Dec-2026, Inst 2 due 28-Feb-2027, Must End By 15-Apr-2027. |
| T3 | Signing date 31-Aug-2026 | Installments | Must End By 28-Feb-2027 (clamped); Inst 1 31-Oct-2026; Inst 2 31-Dec-2026. |
| T4 | Signing date 20-Nov-2026 | Installments | Year rollover: Inst 1 31-Jan-2027, Inst 2 31-Mar-2027, Must End By 20-May-2027. |
| T5 | Contract Value 100,000.01 | Installments | Rounding: 50% is rounded to 2 decimals (50,000.01 or 50,000.00 depending on Deluge's half-rounding), installment 2 absorbs the remainder -- the three amounts must sum exactly to 100,000.01. |
| T6 | New Pre Need Deal, Contract Value 400,000 | Set Payment Type = Lump Sum | One invoice (Invoice_For Other) 400,000 due +7; Deposit, Balance Due Date, Installment 1-3 blank; Must End By set. No Deposit/Installment invoices. |
| T7 | T1 Deal (installment invoices exist) | Change Payment Type to Lump Sum | Nothing changes, no new invoice (function log: "already has Deposit/Installment invoices"). |
| T8 | T6 Deal (Lump Sum invoice exists) | Change Payment Type to Installments | Nothing changes, no new invoice. |
| T9 | T7, then void the Deposit + Installment invoices | Change Payment Type to Lump Sum | Lump Sum invoice created; plan fields cleared. |
| T10 | T1 Deal | Change Contract Signing Date to 1st of next month | Installment dates/Must End By recalculated; the 2 installment invoices updated (not duplicated); Deposit invoice unchanged (no 2nd one). |
| T11 | T1 Deal | Click Calculate Installment Amount | Popup shows the plan summary; no duplicate invoices. |
| T12 | At-Need Deal (not Pre Need) | Set Payment Type | Nothing happens. |
| T13 | Pre Need Deal with no products | Set Payment Type = Installments | Nothing written; button (if clicked) says Contract Value is blank. |
| T14 | Pre Need Deal | Clear Payment Type (-None-) | Nothing happens. |
| T15 | T1 Deal | Send Pre-Need contract | Contract shows Deposit 200,000, installment 100,000 commencing on Inst 1 date, balance on or before Inst 2 date, "Or in Full" 400,000. |
| T16 | T6 Deal | Send Pre-Need contract | Deposit / installment / balance boxes empty; "Or in Full" 400,000. |
| T17 | Existing Deal that had "Pay in Full" before the rename | Open Deal | Shows Lump Sum. |
| T18 | Any Pre Need Deal | Edit an unrelated field (e.g. Description) | Plan not rebuilt, no invoice change. |
| T19 | T6 Deal (Lump Sum invoice due +7) | Edit an unrelated Deal field, then add/change a Potential Payer on the invoice | Lump Sum invoice Due Date is still creation + 7 days (not moved to +1 year). |
| T20 | T6 Deal | Move Stage to Contract Signed | No second run of the Pay-in-Full function (rule condition 6 removed); invoice unchanged. |
