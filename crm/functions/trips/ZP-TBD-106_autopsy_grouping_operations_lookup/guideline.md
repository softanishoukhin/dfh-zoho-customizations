# ZP-TBD-106: Deployment guideline

**Status: written 2026-10-08, not applied, not tested.** Follow the steps in order. Step 3 won't save until
steps 1 and 2 are done, because the code refers to the new fields and the new function.

## 1. Create two fields (CRM > Setup > Customization > Modules and Fields)

**a) Operations → new Lookup field**

| Setting | Value |
|---|---|
| Field label | Autopsy Trip |
| Lookup module | Trips |
| Related list title (shown on the Trip) | Deceased on this Autopsy Trip |
| API name (check after save) | `Autopsy_Trip` |

Put it on the Operations layout near Related Trip. Read-only for users is fine, since only functions write it.

**b) Trips → new Single Line field**

| Setting | Value |
|---|---|
| Field label | Autopsy Group Key |
| Do not allow duplicate values | **ticked** (this is the whole point: it is the lock) |
| API name (check after save) | `Autopsy_Group_Key` |

This is a text field, not a lookup, so the Trips lookup limit doesn't apply. It can sit in any section of the Trips
layout and can be read-only. If Trips refuses it because of the total field limit, stop and tell us.

If either API name comes out different, tell us before step 3.

## 2. New standalone function: `rebuildAutopsyTripSummary`

Setup > Developer Space > Functions > New Function. Category **Standalone**. Name `rebuildAutopsyTripSummary`,
argument `parentTripId` (String). Paste `rebuildAutopsyTripSummary_NEW.deluge`. Save.

## 3. Update three functions

For each one: open it, compare the live body with the file in `rollback/`. If it was edited after 2026-10-08,
stop and tell us so we can merge. Otherwise paste the `_UPDATED` file over the whole body and save.

| Function | File |
|---|---|
| `createOperationsRecordOnTripCreation` | `createOperationsRecordOnTripCreation_UPDATED.deluge` |
| `groupAutopsyTrips` | `groupAutopsyTrips_UPDATED.deluge` |
| `createTripOnTheDayOfAutopsyDateWithTask` | `createTripOnTheDayOfAutopsyDateWithTask_UPDATED.deluge`: **before saving**, copy the `zapikey=` value from the live `groupautopsytrips/actions/execute` line and put it in place of `<KEEP_THE_LIVE_ZAPIKEY>`. |

No workflow rule changes.

## 4. Trip Manager (Creator)

Apply `creator/functions/trip_manager/ZP-TBD-106_autopsy_child_filter/guideline.md` (one block in `fetchTrips`).

## 5. Clean up existing records

New standalone function `zptbd106AutopsyGroupingCleanup`, arguments `fromDate`, `toDate`, `applyChanges` (all
String). Paste `zptbd106AutopsyGroupingCleanup_NEW.deluge`. Save.

1. **Dry run:** Execute with `fromDate = 2026-09-01`, `toDate = 2026-12-31`, `applyChanges = no`. Nothing is
   changed. **Send us the output.** It lists:
   - `TWINS … keep …` and, for each extra shared trip, either `MERGE+DELETE` (untouched: its deceased move to the
     kept trip, then it is deleted together with its own Ops record) or `MANUAL` (already started or assigned, so
     it is left alone). The 7 Oct House of Tranquillity pair (Roy Robinson) will be MANUAL because both trips are
     Completed.
   - `EMPTY+DELETE`: untouched shared trips with no deceased.
   - `DUPLICATE CHILD (MANUAL)`: the same Deal twice under one shared trip (Rohan thomas, 7 Oct).
   - `LINKS`: per shared trip, how many Operations records will get the Autopsy Trip link.
2. Before applying, check in Amber that none of the trips marked for deletion has a live Amber job. Deleting a
   Trip also fires "On Delete - Update existing sales order based on new trips". Shared trips have no Deal, so
   that rule should do nothing, but the dry run is the time to object.
3. **Apply:** same dates, `applyChanges = yes`. Send us the output.
4. If the run times out, split the window (e.g. a month at a time). It is safe to run more than once.

The cleanup function can be deleted once we've both checked the result.

## 6. Retest

See `test-cases.md` (xlsx: `widgets\testCases\ZP-TBD-106_autopsy_grouping_test_cases.xlsx`).

## Rollback

1. Paste each `rollback/*_LIVE_2026-10-08.deluge` back (restore the live zapikey in
   `createTripOnTheDayOfAutopsyDateWithTask`).
2. TM: put the old block back (see the TM guideline).
3. The two fields and `rebuildAutopsyTripSummary` can stay; nothing reads them after rollback. Rollback brings
   back twin shared trips and the per-deceased cards in TM All.
