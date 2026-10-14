# ZP-TBD-112 -- Vehicle bookings show on the Zoho Calendar again

**Status: built 2026-10-14, NOT applied, NOT tested.** Built on the Trip_Manager.ds the user pulled from Creator
2026-10-14 (`saveAssignment`, booking block at lines 4502-4537). Per our rule the .ds is not edited -- apply the
change in Creator.

| Part | Where | What |
|---|---|---|
| **A** | Creator, Trip Manager app, function `saveAssignment` | write the Vehicle Booking with the CRM workflow trigger |
| **B** | CRM standalone function `backfillVehicleBookingCalendar` (new, run once) | put the bookings already made on the calendar |

- Part A files: this folder (`saveAssignment_booking_block_UPDATED.deluge`, `rollback/..._CURRENT.deluge`)
- Part B file: `crm/functions/vehicle_bookings/ZP-TBD-112_vehicle_booking_calendar_backfill/backfillVehicleBookingCalendar.deluge`

## The problem (Andrea, 2026-10-14)

"Vehicle bookings used to show on the calendar view and stopped showing."

The calendar event is made by CRM, not by whoever creates the booking:

- CRM workflow **"Add to Calendar"** (Vehicle Bookings, on create, Calendar View enabled = true) runs function
  `add_to_calendar`, which creates the event in the **Vehicle Booking** group calendar
  (`96ad489318f1477bb552861bc8dac057`) and saves `Calendar_Event_UID` / `Event_URL` on the booking.
- **"On Update - Add to Calendar"** (Name changes, event already exists) moves the event.

A workflow only runs when the booking is written with the workflow trigger:

| Who creates the booking | Trigger? | On the calendar? |
|---|---|---|
| Deal client script (`maintainVehicleProductDetailsPage` / `onEditVehicleManage`) | yes (`"trigger":["workflow"]`) | yes |
| Trip Manager `saveAssignment` (`zoho.crm.createRecord / updateRecord`) | **no** | **no** |

Live check 2026-10-14: in the latest 60 bookings only the two made by the Deal client script (Lebert James and
Delano Luckie, 29-30 Sep) have a `Calendar_Event_UID`; every Trip Manager booking (named "vehicle
yyyy-MM-ddTHH:mm:ss") has none. "Add to Calendar" **last ran 2026-09-30 11:35:35** -- the Lebert James booking.
Since then bookings are made in Trip Manager, so nothing reached the calendar.

## What changes

- **A:** `saveAssignment` writes the booking through the CRM REST API (`POST` / `PUT /crm/v7/Vehicle_Bookings`) with
  `"trigger":["workflow"]` -- the same pattern it already uses for the Trip update a few lines above. The booking
  fields are unchanged (Name, Vehicle, Deal, Start, End, Status Confirmed, Calendar View enabled, Note), and the
  new booking id is still stamped on the Trip. Result: a new Trip Manager booking gets its calendar event; a changed
  assignment (time or vehicle -> Name changes) moves the event.
- **B:** a one-off CRM function that runs `add_to_calendar` for every **upcoming** booking (Start today or later)
  that is calendar-enabled, has a Deal and has no calendar event yet. Bookings without a Deal are skipped and
  counted (`add_to_calendar` needs the Deal owner). Past bookings are left alone.

## Apply

### Part A -- Creator, Trip Manager

Replace the whole function in one paste:

1. Open **Creator > Trip Manager app > Workflows (Developer) > Functions > `saveAssignment`** and click Edit.
2. Select **everything** in the editor (Ctrl+A) and delete it.
3. Open **`saveAssignment_FULL_UPDATED.deluge`** (this folder), copy **everything** (Ctrl+A, Ctrl+C) and paste it
   into the editor. It starts with `map saveAssignment(string tripId, string hearseId, ...` and ends with `}`.
4. Click **Save**. It must save without an error.

That's all. The file is the function exactly as it is live today (pulled 2026-10-14), with only the part that writes
the Vehicle Booking changed. What changed, for reference:

- **Before** (`rollback/saveAssignment_FULL_CURRENT.deluge`):

  ```
  vbResult = zoho.crm.createRecord("Vehicle_Bookings",vbMap,{"connection":"zohocrm_connection"});
  ```
  (and `zoho.crm.updateRecord(...)` for an existing booking) -- CRM saves the booking but its workflow rules don't run.

- **After**: the booking is sent to CRM with `"trigger":["workflow"]`:

  ```
  vbResult = invokeurl
  [
  	url :"https://www.zohoapis.com/crm/v7/Vehicle_Bookings"      (PUT .../Vehicle_Bookings/<id> for an existing one)
  	type :POST
  	parameters:vbBody.toString()                                 (vbBody = {"data":[booking], "trigger":["workflow"]})
  	headers:{"Content-Type":"application/json"}
  	connection:"zohocrm_connection"
  ];
  ```
  so CRM's "Add to Calendar" rule runs and the calendar event is made.

Just the changed lines on their own: `rollback/saveAssignment_booking_block_CURRENT.deluge` (before) and
`saveAssignment_booking_block_UPDATED.deluge` (after).

**If anything goes wrong**: open `saveAssignment` again, select all, paste `rollback/saveAssignment_FULL_CURRENT.deluge`
and Save -- that puts back today's version.

### Part B -- CRM, backfill (once, after Part A)

1. CRM > Setup > Developer Hub > Functions > New Function > **Standalone**, name `backfillVehicleBookingCalendar`,
   paste `backfillVehicleBookingCalendar.deluge`, Save. (It uses the existing `zohooauth` connection.)
2. Click **Execute**. The result reads e.g. `ZP-TBD-112 backfill: sent to calendar 41, skipped (no Deal) 2, failed 0 []`.
3. Open the Vehicle Booking calendar: the upcoming bookings are there (all-day events titled with the booking name).

## Check while testing

1. A new Trip Manager assignment -> the booking's **Event URL** is filled within a minute and the event is on the
   Vehicle Booking calendar on that day.
2. Change the departure time of that assignment in Trip Manager -> still ONE booking, the calendar event title
   changes (it carries the time).
3. CRM > Setup > Automation > Workflow Rules > "Add to Calendar": Last executed time moves to the test time.

## Notes

- The calendar events are all-day (that's how `add_to_calendar` makes them); the time is in the title.
- Some Deals now have two bookings for the same vehicle and day -- one from the Deal client script and one from Trip
  Manager (e.g. Lebert James, Delano Luckie). With Part A both are on the calendar. Not changed here.

## Rollback

- Part A: paste `rollback/saveAssignment_FULL_CURRENT.deluge` back over the whole function.
- Part B: nothing to undo (it only adds calendar events); delete the function when done.
