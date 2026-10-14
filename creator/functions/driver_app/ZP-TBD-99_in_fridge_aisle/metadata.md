Task ID: ZP-TBD-99 (Driver App part)
App: Zoho Creator (Driver App)
Function: map saveMorgueCheckin(...) -- UPDATED, see saveMorgueCheckin_UPDATED.deluge
(built from the live Driver_App.ds export of 04-Oct-2026)
Requested by: Andrea, 2026-10-06 -- add an In Fridge Aisle tick box to the morgue check-in screen
("drivers tick it when every row and drawer is full and the deceased is on a trolley in the fridge
aisle"), saved to the CRM Operations record.
Status: built 2026-10-06, NOT deployed. Needs the CRM field Operations.In_Fridge_Aisle first
(see operations_app/ZP-TBD-99_ops_app_changes_round2/metadata.md, Step 1).

## Server -- saveMorgueCheckin (guideline; the .ds is not edited)
1. New 7th parameter `String inFridgeAisle`: "true" / "false" writes Operations.In_Fridge_Aisle;
   "" or not sent leaves it untouched (the hospital/police multi-body call does not send it).
2. Row and Drawer are no longer required when `inFridgeAisle = "true"`. Location is still required.
3. Row / Drawer are written only when given (before: always written, always required).
Everything else (Operations lookup by Related_Trip then Related_Deal, Room = Morgue, Refrigerator
1/2/3 only, Registration_Number + Deal write) is unchanged.

Deploy:
- Driver App > Workflow > Functions > `saveMorgueCheckin` > replace the whole function with
  `saveMorgueCheckin_UPDATED.deluge` > Save.
- Microservices > Custom API > **Save_Morgue_Checkin** > Edit > re-select the function so the new
  argument appears > map **inFridgeAisle** (from request body, optional) > Save. Existing
  callers that don't send it keep working.

## Widget -- app.js (edited directly; packed dist/driverApp.zip)
- Single-body morgue box (police / first call pickup): In fridge aisle tick under Drawer
  (`#morgue-aisle`), kept in `state.morgue.aisle`. Complete Pickup gate: Row + Drawer required
  only when the tick is off. `finishMorgueAndComplete` sends `inFridgeAisle` "true"/"false".
- Autopsy-return morgue check-in (`autopsyCheckinHtml`): In fridge aisle tick per body
  (`checkinAisle`, starts ""). Both save paths (debounced `saveAutopsyCheckinFields` and the batch
  `autopsySaveFamilyAndCheckin`) save when Location + (Row and Drawer, or the tick) are set, and
  send `inFridgeAisle` = "" until the driver touches the tick.
- Hospital / police multi-body screen: unchanged (open question for Andrea -- fridge positions
  there go through Deceased Pickups + CRM onDeceasedPickupCheckIn).
