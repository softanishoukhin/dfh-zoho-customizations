# Test Cases

## Test Case 1 — NOK Contact created for a Hospital case
Scenario: NOK Intake Hospital submission with NOK First/Last name filled in.
Expected: A Contact is created with Contact_Role "NOK", linked to the new Deal's Contact_Name.
Status: Passed (confirmed live by the user, "NOK is coming properly for Hospital and Police case now").

## Test Case 2 — NOK Contact created for a Police case
Same as above, Police Case Pickup trip type.
Status: Passed.

## Test Case 3 — No duplicate Contact on trip completion (FIX #2)
Scenario: Complete a Hospital/Police trip through the Driver App after FIX #1 alone.
Expected (before FIX #2): FAILED — a second Contact was created, Deals.Contact_Name pointed
at the duplicate, two Contact_Roles entries on the Deal.
Expected (after FIX #2): Only one Contact exists end-to-end, from intake through trip completion.
Status: Fix delivered 2026-08-07 — root cause confirmed against real Deal
6503357000077020001, retest not independently confirmed in this backfill (see Andrea's
testing thread for live confirmation status).

## Known gap
Test data cleanup: the duplicate Contact (id 6503357000077045001) created on Deal
6503357000077020001 before FIX #2 was flagged for manual removal — cleanup status not
confirmed as of this backfill.
