# ZP-TBD-106: Test cases

Spreadsheet copy with Result column: `widgets\testCases\ZP-TBD-106_autopsy_grouping_test_cases.xlsx`.

## Test data

| Item | What | Value / how |
|---|---|---|
| L1 | Autopsy location 1 | Any autopsy-location Account, e.g. House of Tranquillity Funeral Home |
| L2 | Autopsy location 2 | A different autopsy-location Account, e.g. Archer's Funeral Home & Supplies |
| D1 | Autopsy day 1 | A day with NO shared autopsy trip yet at L1 (e.g. 3 days from today), time 08:30 |
| D2 | Autopsy day 2 | Another free day at L1 (e.g. 4 days from today), time 08:30 |
| D3 | Autopsy day 3 | Another free day at L1 (e.g. 5 days from today), time 08:30 |
| Deals A-E | Five test Deals | Create each the way you normally create a police/hospital case (or via the Intake app). Name of Deceased: DFH Test 106-A, 106-B, 106-C, 106-D, 106-E. Is Deceased In Our Care = No. Leave the three autopsy fields empty until the test says to set them. |
| Autopsy fields | On the Deal | Autopsy Required = Yes; Autopsy Locations = (the Lx given); Autopsy Date Time = (the Dx given). Set Autopsy Locations and Autopsy Date Time in ONE save unless the test says otherwise. |
| Where to look | Shared autopsy trip | CRM > Trips, search Name 'Autopsy Trip yyyy-mm-dd' (Trip Type = Multi Deceased Autopsy Trip). Its related list 'Deceased on this Autopsy Trip' lists the deceased's Operations records. |
| Where to look | Per-deceased trip | CRM > Deal > related list Trips: 'Autopsy Trip' (Trip Type = Autopsy Initial). Its Parent Trip field holds the shared trip's id. |
| Where to look | Operations record | CRM > Operations, the record whose Related Deal is the test Deal: field 'Autopsy Trip'. |
| Timing | Wait | Allow ~15 seconds after each save before checking; the functions run in the background. |

## Cases

| ID | Area | Where | Precondition | Action | Expected |
|---|---|---|---|---|---|
| TC01 | Setup | CRM Setup > Modules and Fields | Guideline steps 1-4 applied | Open Operations fields, then Trips fields | Operations has lookup 'Autopsy Trip' (API Autopsy_Trip) to Trips. Trips has 'Autopsy Group Key' (API Autopsy_Group_Key) with 'Do not allow duplicate values' ticked. |
| TC02 | Link | CRM > Deal DFH Test 106-A | Deal A created, autopsy fields empty | Set Autopsy Required = Yes, Autopsy Locations = L1, Autopsy Date Time = D1 08:30. Save once. | Deal A has exactly ONE 'Autopsy Trip' (Autopsy Initial, DO NOT SCHEDULE). Exactly ONE shared 'Autopsy Trip D1' exists for L1. |
| TC03 | Link | CRM > Operations (Related Deal = 106-A) | TC02 done | Open Deal A's Operations record | 'Autopsy Trip' = the shared 'Autopsy Trip D1'. |
| TC04 | Link | CRM > Trips > shared 'Autopsy Trip D1' | TC02 done | Open the shared trip | Related list 'Deceased on this Autopsy Trip' shows Deal A's Operations record. Deceased Names Summary = DFH Test 106-A. Autopsy Group Key starts with 'MDAT\|'. |
| TC05 | Link | CRM > Deal DFH Test 106-B | TC02 done | Set the autopsy fields to L1 / D1 08:30. Save once. | No new shared trip: still only ONE 'Autopsy Trip D1' at L1. Its related list shows A and B; Summary = DFH Test 106-A,DFH Test 106-B. |
| TC06 | Race (Roy case) | CRM > Deal DFH Test 106-C | Deal C created | Set the autopsy fields to L1 / D2 08:30. Save once. | Exactly ONE shared 'Autopsy Trip D2' at L1, holding C. |
| TC07 | Race (Roy case) | CRM > Deal DFH Test 106-C | TC06 done | Change Autopsy Date Time to D3 08:30. Save once. | Exactly ONE shared 'Autopsy Trip D3' at L1 (this date-change path is the one that used to make two). Deal C's Operations 'Autopsy Trip' = 'Autopsy Trip D3'. Summary of D3 = DFH Test 106-C. |
| TC08 | Race (Roy case) | CRM > Trips > shared 'Autopsy Trip D2' | TC07 done | Open the D2 shared trip | Deceased Names Summary is now empty and its related list is empty (C moved to D3). Known leftover, see metadata 'Moved autopsy date'. |
| TC09 | Duplicate child | CRM > Deal DFH Test 106-D | Deal D created | Set Autopsy Required = Yes and Autopsy Locations = L1. Save. Within 5 seconds set Autopsy Date Time = D1 08:30. Save. | Deal D has exactly ONE 'Autopsy Trip' (not two) and exactly ONE open task 'Follow Up Completion of Form E for DFH Test 106-D'. D is under the shared 'Autopsy Trip D1' (Summary = A, B, D). |
| TC10 | Separate location | CRM > Deal DFH Test 106-E | Deal E created | Set the autopsy fields to L2 / D1 08:30. Save once. | A separate shared 'Autopsy Trip D1' for L2 holding only E. The L1 D1 trip is unchanged. |
| TC11 | Trip Manager | Trip Manager > All Trips | TC05 done | On the L1 D1 shared trip assign a vehicle and a driver | The shared trip shows as one card with names 106-A,106-B,106-D. No separate 'Autopsy Trip' cards for A, B or D. |
| TC12 | Trip Manager | Driver App (assigned driver) | TC11 done | Start the L1 D1 shared trip | Trip starts. The DA shows a deceased card for each of A, B and D (unchanged behaviour). |
| TC13 | Trip Manager | Trip Manager > All Trips, then Autopsy, Today, Scheduled | TC12 done (trip Started) | Look at each tab | Only the shared trip's card is shown, status Started. No per-deceased 'Autopsy Trip' cards in any tab (this is the screenshot defect). |
| TC14 | Regression | Driver App | TC13 done | Complete the shared trip in the DA | Shared trip Completed; A, B and D's own Autopsy Trips become Completed; their Operations records still show Autopsy Trip = the shared trip. |
| TC15 | Cleanup | CRM > Functions > zptbd106AutopsyGroupingCleanup > Execute | Guideline step 5 function saved | Run fromDate 2026-09-01, toDate 2026-12-31, applyChanges no | A report is returned. Lines TWINS / MERGE+DELETE / MANUAL / EMPTY+DELETE / DUPLICATE CHILD / LINKS. Nothing changed: a trip listed as MERGE+DELETE still exists. |
| TC16 | Cleanup | Same | TC15 report reviewed by us | Run the same dates with applyChanges yes | Report shows 'deleted …' lines and 'summary ->' lines, no ERROR lines. |
| TC17 | Cleanup | CRM > Trips, search 'Autopsy Trip 2026-10-08' | TC16 done | Look at Forensic Institute shared trips for 8 Oct | Only ONE remains (was two). Its related list shows the 6 deceased (Timarley shakes, Staford Haughton, Antoinette Morris Campbell, Dane Gordom, "DRIVER" Unidentified Male, Asher Dove). |
| TC18 | Cleanup | Trip Manager > All Trips (future days) | TC16 done | Scroll the upcoming days | No empty 'Autopsy Trip' cards with 'Needs Vehicle + Driver' left from twins (e.g. Kingston 7/8/20 Oct, Ops Center 9 Oct, Archer's 10 Oct). |
