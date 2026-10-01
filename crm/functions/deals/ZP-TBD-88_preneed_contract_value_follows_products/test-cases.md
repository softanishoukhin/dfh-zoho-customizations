# ZP-TBD-88 — Test cases

Use a fresh Pre-Need test Deal (Create Pre-Need Deal on a Contact).

| # | Scenario | Steps | Expected |
|---|---|---|---|
| T1 | Read-only | Open the Deal's Edit page; also try inline edit on the Detail page. | Contract Value can't be typed in (edit and detail). |
| T2 | Add products, immediate | Add 2 product lines (e.g. 225,000 + 100,000), Save. Refresh after ~20 s. | Contract Value = 325,000 (plus tax if any line is taxable) straight away, not after 5 minutes. |
| T3 | Change a line | Change a quantity or discount, Save. | Contract Value follows on the next refresh. |
| T4 | Remove a line | Delete one product line, Save. | Contract Value drops accordingly (this never happened before). |
| T5 | Same-save Payment Type | Add a product AND set Payment Type = Installments in the same save. | Plan built from the NEW Contract Value (deposit = 50% of the new total). |
| T6 | Change after plan -> Note | On the T5 Deal, add another product, Save. | Contract Value updates. Note "Contract Value no longer matches the payment plan" with old -> new and the plan total. Invoices and Books retainer unchanged. |
| T7 | No duplicate Note | Wait 6 minutes (the backstop rule runs), then save the Deal again without product changes. | No second Note. |
| T8 | Contract blocked | Click Send Pre Need Funeral Contract (also try the WhatsApp contract link). | Refused with "The Contract Value (...) no longer matches the payment plan (...)". No contract sent. |
| T9 | Fix path | Nothing paid: delete the Deposit and Installment invoices in CRM and the retainer in Books; click Calculate Installment Amount. | New invoices and ONE new retainer at the new value. Contract send no longer blocked by the mismatch (it may still wait for the deposit payment, as normal). |
| T10 | Change back = no mismatch | On a matching Deal, change a product and change it back in the next save. | Note only for the first change; after the change back, no block. |
| T11 | Lump Sum | Lump Sum Deal with its invoice in Books; add a product. | Note + contract blocked, same as T6/T8 (compares with the Lump Sum Books invoice). |
| T12 | Not Pre-Need | Edit a Police / Hospital Deal on the same layout. | Nothing changes for them (Contract Value read-only, which is harmless; no recalc, no Note). |
| T13 | Amount | Check Amount on the Pre-Need Deal. | Unchanged (blank) -- Contract Value is the real figure. |
