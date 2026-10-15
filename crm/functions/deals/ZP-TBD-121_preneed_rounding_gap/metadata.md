# ZP-TBD-121 -- CRM / Books few-cent gap (Books 0.125 rounding)

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: analysed 2026-10-15. Tolerance fix built (guideline.md), NOT applied. Root-cause option needs Andrea /
accountant decision.**

**Source:** `projectDocuments/PRENEED_DEV_LIST_2026-10-14.md`, ticket 8 ("CRM and Books disagree by six cents").

## Live facts
- RET-K-2026-000174: sub_total 665,304.40 + tax 84,795.66 = 750,100.06; total 750,100; `roundoff_value` -0.06,
  `transaction_rounding_type` nearest_incremental_rounding, `rounding_increment` 0.125 (org setting).
- ZP-TBD-91 payment cap is LIVE (inside the deployed ZP-TBD-110 createPaymentsOnBooksForRetainerInvoice) -> Books
  payment_made tops out at the rounded total -> Amount_Paid_To_Date = 750,100.00.
- wfUpdatePreNeedPaymentStatus (Dale, fixed 14 Oct for a half-cent case) uses `< 0.01` -> fails for gaps 0.01-0.0625.
- Our functions already use 1.00: getPreNeedContractType ROUNDING_TOLERANCE, checkPreNeedPlanMatchesContract
  TOLERANCE, ZP-TBD-91 cap.
