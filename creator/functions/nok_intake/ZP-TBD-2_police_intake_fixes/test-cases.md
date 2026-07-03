# Test Cases

## Test Case 1 — Police submission with blank Deceased Name
Scenario: Confirm the "unknown identity at intake" path now works for Police, matching Hospital.
Input Record: New Police case, Deceased Name left blank
Steps: Submit via NOK Intake widget
Expected Result: Submits successfully — no "Deceased Name is required" error, from either the
widget or the form's server-side validation
Actual Result: Passed (covered as part of the broader 5-intake-type Amber test pass; not
re-verified in isolation with a dedicated blank-name Police record in this round)
Status: Passed

## Test Case 2 — Police Station resolves to a real Account
Scenario: Confirm the corrected `input.Police_Office` source produces a Trip.Police_Station
value that name-matches a real Accounts record, and that `onDeceasedPickupCreate` (separate
task, ZP-TBD-4) resolves it into `Deal.Police_Account`.
Input Record: "ZZTEST Police 1", station picked from the Police Office dropdown
("Test Police Office_DND")
Expected Result: Deal.Police_Account populated with the matching Account
Actual Result: Passed — `Police_Account: {"name":"Test Police Office_DND","id":"6503357000070632068"}`
confirmed on the Deal via direct record read
Status: Passed

## Edge Cases Tested
- First Call / Wholesale still require Deceased Name (regression check) — Passed
- Hospital still allows blank Deceased Name (regression check) — Passed

## Not tested this round
- A Police submission where the typed/selected station name does NOT match any existing
  Account by name (the fallback behavior in this case is untested — `onDeceasedPickupCreate`
  would simply not set `Police_Account`, leaving `Police_Office_Name` as the only record of
  it, but this hasn't been explicitly exercised)
