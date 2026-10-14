Task ID: ZP-TBD-108 item 1 (Driver App part of "Transfer of Deceased to Other Funeral Homes")
App: Zoho Creator (Driver App)
Functions: NEW `getTransferPickupInfo`, NEW `Complete_Transfer_Out` -- see `transfer_out_functions.deluge`
(no existing function is replaced; built against the Driver_App.ds export of 04-Oct-2026 + workspace app.js)
Source: client brief `projectDocuments/Transfer_of_Deceased_Designer_Brief-1.docx`, analysis
`projectDocuments/Transfer_of_Deceased_Analysis_and_Workflow_2026-10-12.docx` (section 6, "cleared to start" #1).
Status: built 2026-10-12, NOT deployed.

## What changes for the driver
A "Transfer to Other Funeral Home" trip no longer drops into the generic pickup form (Place of
Removal, morgue check-in). It now has its own two screens, built on the Crematory Dropoff pattern:

- **Before start:** shows where to collect the deceased (Location / Room / Fridge / Row / Drawer, or
  "In fridge aisle"), where to deliver, the receiving contact, schedule and vehicle. Start Trip
  unlocks after 3 ticks (documents collected, hang tag checked, deceased loaded) + Condition at pickup.
- **On delivery:** Receiving Funeral Home (pre-filled from the Deal), Received By, Condition at
  pickup (carried over, editable), Condition at delivery. Complete Trip unlocks when the required
  fields are filled. The camera button (Scan Document -> WorkDrive) is now available on transfer
  trips so the driver can photograph the signed receipt (stand-in until Q6 decides on an
  on-screen signature).

On Complete: Trip -> Completed + Completion_Time (workflow trigger on, same as Crematory);
Operations (the trip's record) -> Receiving_Attendant; one Deal note with the full delivery record:
`[[driver|timestamp]]` + "Transfer out - delivered to X / Received by / Condition at pickup /
Condition at delivery".

Not in this item: marking the deceased Transferred Out / not in our care (item 2), signature (Q6),
trip direction (Q1).

## Why the position is read from the Deal, not the trip
CRM `createOperationsRecordOnTripCreation` (rule "Create Operations Record On Trip Creation")
creates a NEW blank Operations record for every non-Funeral trip, so the transfer trip's own
Operations record has no position. `getTransferPickupInfo` searches Operations by Related_Deal,
skips the transfer trip's record, and returns the most recently modified one that has a Location
(the check-in record, which the Ops App also syncs Location/Row/Drawer back to).

## Deploy (Creator -- guideline, the .ds is not edited)
1. Driver App > Workflow > Functions > New function `getTransferPickupInfo` (return type map,
   arg `string tripId`) > paste function 1 from `transfer_out_functions.deluge` > Save.
2. New function `Complete_Transfer_Out` (return type map, args in order: tripId, receivingHome,
   receivedBy, pickupCondition, deliveryCondition, author, completionTime -- all string) > paste
   function 2 > Save.
3. Microservices > Custom API > New, mirroring the settings of **Complete_Crematory_Dropoff**
   (same authentication / user scope / portal access):
   - **Get_Transfer_Pickup_Info** -- POST, function `getTransferPickupInfo`, map `tripId` from
     the request body.
   - **Complete_Transfer_Out** -- POST, function `Complete_Transfer_Out`, map all 7 arguments
     from the request body.
   The names must match exactly -- the widget calls them by these names.
4. Upload `widgets/driverApp/driverApp/dist/driverApp.zip` as the new Driver App widget version
   (only app/app.js changed).

## Widget -- app.js (edited directly)
- `openJobDetail`: new routing for `Trip_Type = "Transfer to Other Funeral Home"` -> 
  `renderTransferOutStart` (not started) / `renderTransferOutComplete` (Started or Completed);
  hang-tag print hidden on these screens (body is already tagged).
- New section "7b-2. TRANSFER OUT": `TRANSFER_OUT_TYPE`, `transferPositionText`,
  `transferDestText`, `loadTransferInfo` (calls Get_Transfer_Pickup_Info), `renderTransferOutStart`,
  `transferStartGateCheck`, `transferStartTrip` (Save_Start_Job), `renderTransferOutComplete`,
  `transferCompleteGateCheck`, `submitTransferOutComplete` (Complete_Transfer_Out).
- `persistChecklistState` now **returns** its save promise (all existing callers ignore the return
  value) so `transferStartTrip` waits for the pickup condition to be saved before starting.
- `SCAN_TRIP_TYPES` + "Transfer to Other Funeral Home" (camera button).
- Field state uses the shared Checklist_State mechanism (ids `tx-c-docs`, `tx-c-tag`,
  `tx-c-loaded`, `tx-pickup-cond`, `tx-recv-home`, `tx-recv-by`, `tx-deliv-cond`).

## Test
1. Create a transfer trip (Books "Create Transfer Trip" on a paid family invoice, or a Trip with
   Trip_Type "Transfer to Other Funeral Home" on a Deal whose deceased was checked in to the morgue).
   Claim it from Available Trips.
2. Open it: the start screen shows Collect from = the check-in position (compare with the Ops App
   card), Deliver to, Receiving contact. Start Trip stays disabled until 3 ticks + pickup condition.
3. Leave the trip and come back before starting: ticks and condition are still there.
4. Start -> the delivery screen opens with Condition at pickup carried over and Receiving Funeral
   Home pre-filled from the Deal (Name of Receiving Funeral Home).
5. Camera button is visible; scan a page.
6. Complete -> Trip_Status Completed + Completion_Time; trip's Operations record Receiving_Attendant
   = Received By; Deal has a new note with all four lines; trip reopens read-only.
7. Deceased with In Fridge Aisle ticked at check-in -> position shows "In fridge aisle" (no row/drawer).
8. Deal with no checked-in Operations record -> "Position not found -- check the Ops App", screens
   still work.
9. Regression: a Crematory Dropoff trip and a First Call pickup still open their usual screens.
