# Test Cases — ZP-TBD-6 Police KM-Based Quantity Billing

Full test suite: `D:\Office\Andrea_Projects\DFH\widgets\testCases\DFH_Police_Billing_KM_Quantity_Test_Cases.xlsx`
(15 cases, POL-KM-01 through POL-KM-15). Covers: pickup KM read location, stale-Deal-mirror
regression, autopsy child KM direct entry, autopsy KM blank fallback, independent pickup/autopsy
quantities, multi-deceased pickup, no-autopsy regression, Hospital flat-rate regression,
re-trigger-after-completion, end-to-end total, autopsy parent/child KM fallback, order-independence
(KM before and after trip completion), duplicate-trip guard, and Embalming-outcome isolation.

Status: all 15 cases passed (confirmed by user 2026-07-07, after 3 rounds of tester failures and
fixes — see this ticket's metadata.md and ZP-TBD-7 for the duplicate-trip guard fix that resolved
round 1).
