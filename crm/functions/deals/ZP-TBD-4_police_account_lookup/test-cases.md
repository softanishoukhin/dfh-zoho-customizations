# Test Cases

## Test Case 1 — Police_Account resolves on a known station
Scenario: NOK Intake submission with a station picked from the Police Office dropdown.
Input Record: ZZTEST Police 1, station "Test Police Office_DND" (a persistent test fixture
account — not deleted)
Expected Result: Deal.Police_Account populated with that Account's ID
Actual Result: Passed — confirmed via direct record read
Status: Passed

## Edge Cases Tested
- Station name with no matching Account — not exercised this round;
  `matchedPoliceAccounts.isEmpty()` guard means `Police_Account` simply stays unset in that
  case (same graceful-degradation pattern as the isHospital branch), `Police_Office_Name`
  still gets the raw text either way
