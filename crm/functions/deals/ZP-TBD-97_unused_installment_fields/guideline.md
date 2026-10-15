# ZP-TBD-97 -- PN-08 tidy of the instalment fields on Deals

Andrea's decision (PRENEED_DEV_LIST_2026-10-14, PN-08 answer). Re-checked live 2026-10-15: nothing reads or writes
the two fields being deleted (no live Pre-Need widget, no function in the repo; the repo only mentions them as
"not copied / not used"). All by hand in Setup -- no code change.

| Field | Decision |
|---|---|
| `Installment_Commencement_Date` | **Delete** |
| `Installment_Day_of_Month` | **Delete** |
| `Number_of_Installments` | **Keep, hide** -- live data on Janet Turnbull and Nastassia Hedge |
| `Create_Installment_Invoice_1` / `_2` / `_3` | **Keep as they are** -- in use (the plan invoice build writes its log there) |

## 1 -- record what is there first
Deals list view > filter **Installment Commencement Date is not empty** > export (Commencement Date, Day of Month,
Deal Name). Andrea says it is one Deal. Keep the file with this ticket.

## 2 -- delete the two date fields
Setup > Customization > Modules and Fields > Deals > **Fields** tab. For `Installment Commencement Date`, then
`Installment Day of Month`: field menu (...) > **Delete** > confirm.
If Zoho says the field is used by a rule, report, view, layout rule or validation, it names it: remove the field
there, then delete again. Deleting can't be undone -- that is why step 1 comes first.
Bonus: Deals is at its field limit; this frees 2 slots.

## 3 -- hide Number of Installments (keep the data)
Setup > Customization > Modules and Fields > Deals > open each Deal layout that shows it (at least the Pre-Need
layout) > drag **Number of Installments** off the layout (to the field list on the left) > Save.
The values stay on the Deals and can still be seen in reports/exports. If it also appears on the Pre-Need canvas
screen, remove it there too (Canvas designer).

## 4 -- check
Create a new Pre-Need Deal, set Payment Type = Installments: the Deposit and both Installment invoices are created
as normal, and the Pre-Need screen shows no error.
