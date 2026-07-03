# Test Cases

## Test Case 1 — Police child Deal stage advances on trip completion
Scenario: Complete a multi-deceased Police trip in the Driver App.
Input Record: ZZTEST Police 1
Expected Result: The deceased's Deal moves from "Trip Requested" to "Trip Completed",
Is_Deceased_In_Our_Care = Yes, Initial_Trip_Completed_At stamped
Actual Result: Passed — all three confirmed via direct record read after test
Status: Passed

## Test Case 2 — Hospital child Deal stage advances on trip completion
Scenario: Complete a multi-deceased Hospital trip in the Driver App.
Input Record: ZZTEST Hospital 1
Actual Result: Passed — same three fields confirmed correct
Status: Passed

## Test Case 3 — Idempotency (doesn't clobber an already-progressed Deal)
Scenario: The `dpDealStage == "Trip Requested"` guard should skip Deals already moved further.
Actual Result: Not explicitly exercised with a pre-advanced Deal this round — guard is in
place per code review but no live test forced this path
Status: Pending

## UI regression checks (widget-js-changes.md)
- Hospital screen: Ward field, "Hospital" row, hospital-name auto-Place_of_Removal all
  confirmed unchanged/working — Passed
- Police screen: no Ward field, "Police Station" row shows correctly (read-only), no
  Place_of_Removal auto-stamp, no Officer Name/Phone fields anywhere — Passed
