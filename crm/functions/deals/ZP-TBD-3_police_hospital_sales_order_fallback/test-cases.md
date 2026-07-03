# Test Cases

## Test Case 1 — Police multi-deceased Sales Order via fallback
Scenario: A Police Deal with no Trip.Deal reaches Stage = Trip Completed.
Input Record: ZZTEST Police 1 (deleted after test)
Steps: Complete the trip in the Driver App (advances the child Deal's stage via
ZP-TBD-5's completeJob fix) → workflow fires CreateSalesOrderforPoliceCase
Expected Result: Sales Order created with correct pickup-fee + storage-fee line items
Actual Result: Passed. Sales Order created, Amount = $1,680, correctly linked to
Police_Account
Status: Passed

## Test Case 2 — Hospital multi-deceased Sales Order via fallback
Scenario: A Hospital Deal with no Trip.Deal reaches Stage = Trip Completed.
Input Record: ZZTEST Hospital 1 (deleted after test)
Expected Result: Sales Order + Invoice created with hospital pickup + storage line items
Actual Result: Passed. Sales Order + Invoice created, Amount = $4,750
Status: Passed

## Test Case 3 — Old single-Deal path unaffected (regression)
Scenario: Confirm Wholesale/First Call Deals (which do have a Trip.Deal) still use the
original direct lookup path, not the fallback.
Actual Result: Passed — Wholesale Local/Airport Sales Orders both created correctly via the
direct `tripList.size() > 0` branch; fallback code path never entered for these
Status: Passed

## Edge Cases Tested
- Fallback Trip not yet Completed — not exercised directly this round, but the
  `dpTripStatus == "Completed"` gate is in place and matches the same safety principle
  applied elsewhere today (see ZP-TBD-1 metadata)
- No Deceased_Pickups child at all for a given Deal — not exercised; would fall through with
  `haveTrip`/the loop staying empty, same silent-no-op behavior as before this fix (acceptable,
  since that scenario shouldn't occur for a Deal created by onDeceasedPickupCreate)
