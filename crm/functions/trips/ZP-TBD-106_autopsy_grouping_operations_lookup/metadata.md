# ZP-TBD-106: Autopsies not linking the deceased on one record (split / duplicate autopsy trips)

**Source:** Andrea, 2026-10-08. "Autopsies are not linking the deceased on one record. This is a huge issue."
The screenshot (TM All Trips, Today, 7 Oct) shows House of Tranquillity Funeral Home 08:30 as a shared
"Autopsy Trip 2026-10-07" (Ramona Rhyne, Vilma Henry, Rohan thomas, Colver Williams, Dave Benaine), plus a separate
card for each of those deceased, plus a second shared trip holding only Roy Robinson. Andrea also asked: "there
should be an available lookup field now to properly link these. I would like the process updated so that the
lookup field is used to link the records."

## Root cause (checked against live data and live source, 2026-10-08)

| # | Symptom | Cause |
|---|---|---|
| 1 | Roy Robinson on his own shared trip | **Twin parents.** `groupAutopsyTrips` is check-then-create. It is started up to 3 times at once for the same child: Trips rule "Group Autopsy Trip Under Parent" (create), Trips rule "On Edit - Group Autopsy Trip Under Parent" (Scheduled_Date / Autopsy_Location change), and `createTripOnTheDayOfAutopsyDateWithTask`, whose date-change branch both updates the child *with* workflow trigger and calls `groupautopsytrips` directly over REST. Parallel runs each find no parent and each create one. Live data: every recent batch has two parents created in the same second (House of Tranquillity 7 Oct `…84882275` + `…84894215` at 14:01:51; Forensic 8 Oct, Archer's 10 Oct, Ops Center 9 Oct, Kingston 7 Oct and 20 Oct likewise). Roy's child was stamped on one twin; later children found the other (COQL `limit 1` with no ordering). |
| 2 | Each deceased also shown as its own card | **TM filter defect.** The children *were* linked (`Parent_Trip` set). "Cascade Autopsy Parent Status" copies the parent's Started onto them, so they leave DO NOT SCHEDULE. TM `fetchTrips` (ZP-TBD-19) should then hide them but (a) only runs that check in the Autopsy category, not All, and (b) calls `.containKey("id")` on `Parent_Trip`, a **text** field. That throws, the empty catch swallows it, and the child stays visible. |
| 3 | Rohan thomas twice | **Duplicate child.** Deal rule "New - Create Trip on the Day of Autopsy Date…" fires on Autopsy_Date_Time *or* Autopsy_Locations; two near-simultaneous runs of `createTripOnTheDayOfAutopsyDateWithTask` both found no trip and both created one (`…84900247`, `…84879238`, both 14:11:01). |
| 4 | "Lookup field" | None exists. `Trips.Parent_Trip` is a text field. **Trips has no lookup slots left** (confirmed by the user), Deals.Trips is already written by ~29 functions (current-trip pointer), and Operations had no Trip lookup besides Related_Trip. |

## Fix

**Lookup:** new lookup **Operations.Autopsy_Trip → Trips**. Operations is the per-deceased record (one per child
trip, already linked to the Deal, Deceased and NOK), so the shared autopsy trip now shows every deceased in one
related list. `Parent_Trip` (text) is still written so the Driver App, Trip Manager and the status cascade keep
working unchanged.

**Race lock:** new Trips text field **Autopsy_Group_Key** with "Do not allow duplicate values". The CRM's unique
check is atomic, so it acts as a lock that Deluge doesn't otherwise have:

- shared trip: `MDAT|<Autopsy_Location id>|<yyyy-MM-dd>`. A parallel run that loses gets DUPLICATE_DATA and joins
  the winner's trip (the response carries the winner's id).
- per-deceased trip: `AI|<Deal id>`. A parallel run that loses stops (no second trip, no second Form E task).

| Function | Change |
|---|---|
| `groupAutopsyTrips` (automation) | Keyed parent create + join-on-duplicate; COQL ordered oldest-first; reads Parent_Trip as text; stamps Operations.Autopsy_Trip; summary via new helper. |
| `rebuildAutopsyTripSummary` (standalone, NEW) | Deceased_Names_Summary from Operations.Autopsy_Trip → Related_Deal → Name_of_Deceased (one name per Deal). |
| `createOperationsRecordOnTripCreation` (automation) | After creating an autopsy child's Operations record, re-reads Parent_Trip and links Autopsy_Trip (covers the Ops record being created in parallel with grouping). |
| `createTripOnTheDayOfAutopsyDateWithTask` (automation) | Keyed child create; losing run stops; Form E task moved to the end and skipped by the losing run. |
| TM `fetchTrips` (Creator, guideline only) | Child filter in every category, Parent_Trip read as text. See `creator/functions/trip_manager/ZP-TBD-106_autopsy_child_filter/`. |
| `zptbd106AutopsyGroupingCleanup` (standalone, NEW, one-off) | Dry-run-first: merges untouched twins, deletes empty untouched shared trips, back-fills Autopsy_Trip, reports duplicate children and started/assigned twins for manual handling. |

No workflow rule changes. Driver App unchanged.

## Not in scope, noted

- **Readers still use Parent_Trip.** DA `getAutopsyChildren`, DA completion cascade, `cascadeAutopsyParentStatus`
  and TM read the text field, which stays in sync. Moving them to the lookup changes no behaviour and adds risk.
- **Moved autopsy date.** The deceased moves to the new day's shared trip (as before); the old shared trip can be
  left with no deceased. The cleanup removes those; making it automatic is a possible follow-up.
- **TM Kingston / Mobay filter** keeps a trip only if its Deal is in that location. Shared trips have no Deal, so
  they disappear under those filters. Seen while reading `fetchTrips`; not changed.
- **Date-less autopsy trips.** "Autopsy Trip" children created 2026-10-02 08:03 (Forensic Institute) have no
  Scheduled_Date and so can never group. Seen in the data; source rule not traced here.

## Files

| File | Purpose |
|---|---|
| `groupAutopsyTrips_UPDATED.deluge` | Full replacement body. |
| `createOperationsRecordOnTripCreation_UPDATED.deluge` | Full replacement body. |
| `createTripOnTheDayOfAutopsyDateWithTask_UPDATED.deluge` | Full replacement body. The zapikey is masked: keep the live value. |
| `rebuildAutopsyTripSummary_NEW.deluge` | New standalone function. |
| `zptbd106AutopsyGroupingCleanup_NEW.deluge` | New one-off standalone function. |
| `rollback/*_LIVE_2026-10-08.deluge` | Live bodies pulled 2026-10-08, before this change. |
| `guideline.md` | Fields, apply order, cleanup run, rollback. |
| `test-cases.md` | Test plan (xlsx in `widgets\testCases\ZP-TBD-106_autopsy_grouping_test_cases.xlsx`). |

## Status

Built 2026-10-08 on live source. Not applied, not tested.
