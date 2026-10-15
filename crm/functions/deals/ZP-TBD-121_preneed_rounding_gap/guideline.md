# ZP-TBD-121 -- CRM and Books disagree by a few cents (ticket 8 of PRENEED_DEV_LIST_2026-10-14)

Live data read 2026-10-15.

## Cause (confirmed)
Books org setting **Rounding off in Sales Transactions = nearest incremental value 0.125**. Every Books sales total
(retainers and invoices) is rounded to a multiple of 0.125. Dale testing: products 665,304.40 + GCT 84,795.66 =
**750,100.06** (CRM Contract Value, correct to the cent) -> Books retainer total **750,100.00**, `roundoff_value` -0.06.
The gap is always between 0 and 0.0625 either way. CRM is not wrong; Books rounds.

## What it breaks
| Place | Tolerance | Effect |
|---|---|---|
| getPreNeedContractType (which contract to send) | 1.00 | fine |
| checkPreNeedPlanMatchesContract | 1.00 | fine |
| createPaymentsOnBooksForRetainerInvoice (last payment capped at the retainer balance, ZP-TBD-91) | 1.00 | fine |
| Per-invoice status (ZP-TBD-118) / retainer notes (ZP-TBD-119) | CRM rows | fine |
| **wfUpdatePreNeedPaymentStatus** (Deal Payment Status pill) | **0.01** | a fully paid plan stays **"Payments in progress"** whenever Books rounded the total down by 0.01-0.06 |

## Fix now -- `wfUpdatePreNeedPaymentStatus` (API name `wfupdatepreneedpaymentstatus`)
FIND:
```
if(contractValue > 0 && contractValue - paid < 0.01)
```
REPLACE WITH:
```
// ZP-TBD-121: Books rounds the retainer total to the nearest 0.125 (750,100.06 -> 750,100.00) and the last payment is
// recorded at the retainer balance, so "paid" can end a few cents under Contract_Value. Same 1.00 tolerance as
// getPreNeedContractType and checkPreNeedPlanMatchesContract.
if(contractValue > 0 && contractValue - paid < 1)
```
Save. Then run the daily schedule (ZP-TBD-120) once so fully paid Deals turn "Paid in full".

## Root cause -- Andrea / accountant decision (not applied)
| Option | What changes | Effect |
|---|---|---|
| **A. Books: no rounding** -- Settings > Preferences > General > Rounding off in Sales Transactions = **No Rounding** | org-wide setting, new transactions only | Books totals = CRM to the cent everywhere (Pre-Need and funeral invoices). Existing documents unchanged. Needs the accountant's OK (Xero receives the same exact totals). |
| B. Keep the 0.125 rounding | nothing | the few-cent gap stays on every Deal; all functions tolerate it (after the fix above) |
| C. Round CRM to Books' 0.125 grid | Contract Value and every plan amount on multiples of 0.125 | amounts like 750,100.13 / 375,050.06 on contracts -- not recommended |

Recommendation: fix above now; option A if the accountant has no reason to keep 0.125.

## Test
After the fix: a test Pre-Need Deal paid in full (all instalments) -> run the daily schedule -> Payment Status pill =
**Paid in full** (it stayed "Payments in progress" before).
