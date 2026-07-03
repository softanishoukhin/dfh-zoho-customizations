# Test Cases

Tested directly in production on 2026-07-03 using clearly-tagged "ZZTEST" records (no CRM
Sandbox used). All ZZTEST records were deleted after verification. Full record-ID list lived
only in chat at test time — not reproduced here since the records no longer exist.

## Test Case 1 — First Call
Scenario: Submit a First Call case via NOK Intake, complete the trip in the Driver App.
Input Record: Deal "ZZTEST FirstCall 1"
Steps: NOK Intake submit → Driver App pickup → Driver App complete
Expected Result: Trip completes; Amber_Connect_Job_ID populated; Amber_Completion_Sent = true
Actual Result: Passed. Job ID 273, completion sent. `Amber_Completion_Response` came back
null despite `Amber_Completion_Sent = true` — anomaly noted, not fully explained, since both
fields are set in the same update statement in the function. Worth re-checking on the next
real completion.
Status: Passed (with the response-field anomaly noted)

## Test Case 2 — Hospital
Scenario: Multi-deceased Hospital pickup, no Deal on the Trip.
Input Record: Deal "ZZTEST Hospital 1", Trip "Hospital Storage - 03-Jul-2026"
Steps: NOK Intake (Hospital, name given) → Driver App pickup/identify/check-in → complete
Expected Result: Deal/Account/Operations created for the deceased; Amber job created and
completed via the Deceased_Pickups fallback path (no Trip.Deal)
Actual Result: Passed. Job ID 274. Sales Order + Invoice created correctly ($4,750). Same
null `Amber_Completion_Response` anomaly as Test Case 1.
Status: Passed

## Test Case 3 — Police
Scenario: Multi-deceased Police pickup, no Deal on the Trip, Police Station selected from
the intake dropdown.
Input Record: Deal "ZZTEST Police 1", Trip "Police Case Pickup - 03-Jul-2026"
Steps: NOK Intake (Police, station + name given) → Driver App pickup/identify/check-in → complete
Expected Result: Amber job created/completed via fallback; Police_Account resolved on the
Deal; distance-based billing correct
Actual Result: Job ID 277. `Amber_Completion_Response`:
`{"status":false,"code":200,"JobId":"277","message":"Job request(s) processed successfully.",...}`
— note `status:false` despite `code:200` and a success message; worth asking Amber support
what that field means. `Police_Account` lookup correctly resolved to the selected station's
Account. Sales Order created correctly ($1,680) via the fallback fix in
`crm/functions/deals/ZP-TBD-3_police_hospital_sales_order_fallback/`.
**`Number_of_distance_in_km` did NOT populate** — confirmed the Amber response has no
distance field at all (see metadata.md, open issue).
**A stray duplicate Trip was created** ("Police Pickup for ZZTEST Police 1") by an unrelated
legacy rule ~4.5 minutes after the Deal was created — see metadata.md, open issue. It did not
end up firing a duplicate Amber job because its `Trip_Status = Completed` was set at creation
time rather than via a tracked edit, so the field-update-triggered completion rule never saw
a transition to fire on.
Status: Passed for the Amber integration itself; two separate open issues flagged (KM,
stray trip) that are out of scope for this task

## Test Case 4 — Wholesale Local
Scenario: Wholesale Local pickup (single-Deal, has a Trip.Deal — tests the non-fallback path
still works).
Input Record: Deal "ZZTEST DWholesale Local 1"
Expected Result: Amber job created/completed via the original Trip.Deal path
Actual Result: Passed. Job ID 278.
Status: Passed

## Test Case 5 — Wholesale Airport
Scenario: Wholesale Airport pickup (single-Deal).
Input Record: Deal "ZZTEST DWholesale Airport 1"
Expected Result: Amber job created/completed, JobType = pickup
Actual Result: Passed. Job ID 279.
Status: Passed

## Edge Cases Tested
- Missing Deal on Trip (Police/Hospital) — handled via Deceased_Pickups fallback
- Trip already Completed with no Job ID at all (create-then-complete in one event) — handled
  by the Round 2 fix
- Duplicate completion (Amber_Completion_Sent already true) — guarded, returns early
- Trip created via a path unrelated to the intended flow (the stray-trip finding) — NOT
  guarded against; flagged as an open issue, not a passed/failed test of this specific task
