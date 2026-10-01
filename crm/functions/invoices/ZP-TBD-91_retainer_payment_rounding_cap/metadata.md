# ZP-TBD-91 -- Retainer payment rounding cap

**Folder number is a placeholder.** Built 2026-10-01, not applied.

| | |
|---|---|
| Reported on | Deal 6503357000084728571 (Test DFH Test D 10012026), Installment 2 payment not created in Books |
| Function changed | `automation.createPaymentsOnBooksForRetainerInvoice` (+1 block, see guideline.md) |
| Books retainer | RET-K-2026-000149 (5830143000037658022), total 40,040.00, paid 30,030.01, balance 10,009.99 |

## Root cause (checked live 2026-10-01)

- Deal Contract_Value 40,039.9985; plan 20,020 / 10,010 / 10,010 (sum 40,040).
- CRM plan invoices: deposit line 17,408.70 + tax 2,611.305 = 20,020.005; instalments 8,704.35 + 1,305.6525 = 10,010.0025.
  The builders send Tax rounded to 2 dp, but CRM recomputes it to 3 dp.
- Deposit was paid 20,020.01 (displayed rounding) -> retainer balance after Installment 1 = 10,009.99 -> Installment 2
  payer row 10,010.00 is above the balance -> Books rejects; row has no Books_Payment_ID.

## Related

ZP-TBD-74 / ZP-TBD-85 (one master retainer per Deal), ZP-TBD-87 (tax-inclusive plan invoices), ZP-TBD-81 (payment plan).

## Open

- Contract_Value itself is stored with 4 decimals (Update_Contract_Value adds unrounded tax). Harmless today because
  setupPreNeedPaymentPlan rounds it, but worth rounding at the source later.
