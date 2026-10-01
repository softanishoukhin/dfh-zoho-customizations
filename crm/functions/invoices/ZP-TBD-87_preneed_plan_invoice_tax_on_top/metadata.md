# ZP-TBD-87 -- Pre-Need plan invoices: GCT added on top of a tax-inclusive amount

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-09-30, NOT applied, NOT tested.** Apply per `guideline.md`.

| | |
|---|---|
| Reported by | user (testing ZP-TBD-81/82), 2026-09-30 |
| Test Deal | 6503357000084470306 "DFH Test Pretest" -- deposit 662,680.02 on the Deal, 712,381.02 on the invoice |
| Functions | `automation.createPreNeedDepositRetainerInvoice`, `standalone.createInstallmentInvoice` (`createinstallments`) |

## Live facts (2026-09-30)

- Deal: Contract_Value = Amount = 1,325,360.0425; Pre_Need_Deposit_Amount 662,680.02; Installment 1/2 331,340.01.
- Books master retainer RET-K-2026-000142: sub_total 1,178,573.95 + GCT 146,786.09 = 1,325,360 -> Contract_Value is
  tax-inclusive. Lines: Mahoe/Cedar/Mahogany Oversized 698,478.30 (GCT 15%), S. Style Brushed 280,095.65 (GCT 15%),
  Non Taxable - Mahoe... 100,000 (0%), Non Taxable - S. Style Brushed 100,000 (Zero Rated).
- CRM invoices: Deposit 712,381.02 (paid), Installment 1/2 356,190.51 each -> equal 4-way split + 15% on 2 rows.
- Deposit builder sends no Line_Tax (CRM default product tax applies); installment builder sends Line_Tax (first tax).
- `createInvoiceIfPaymentTypeIsPaymentInFull` (Lump Sum) bills products at real prices -> not affected.

## Expected after the fix (same products, deposit 662,680.02)

| Row | Share (incl. GCT) | List_Price | GCT |
|---|---|---|---|
| Mahoe/Cedar/Mahogany Oversized | 401,625.02 | 349,239.15 | 52,385.87 |
| S. Style Brushed | 161,055.00 | 140,047.83 | 21,007.17 |
| Non Taxable - Mahoe... | 50,000.00 | 50,000.00 | 0 |
| Non Taxable - S. Style Brushed | 50,000.00 | 50,000.00 | 0 |
| **Invoice total** | **662,680.02** | | **73,393.04** |

(Assumes the Deal's Product_Selection rows carry the same prices as the retainer lines and no discounts.)

## Files

- `guideline.md`, `createPreNeedDepositRetainerInvoice_UPDATED.deluge`, `createInstallmentInvoice_UPDATED.deluge`
- `rollback/*_CURRENT.deluge` -- live bodies 2026-09-30
- Test cases: `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-87_PreNeed_Plan_Invoice_Tax_Test_Cases.xlsx`
