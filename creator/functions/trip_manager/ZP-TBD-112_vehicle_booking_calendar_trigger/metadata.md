# ZP-TBD-112 -- Vehicle bookings on the Zoho Calendar (Trip Manager trigger + backfill)

**Folder number is a placeholder**: rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-14, NOT applied, NOT tested.** Full guideline: `guideline.md` (this folder).

| | |
|---|---|
| Reported by | Andrea, 2026-10-14 -- vehicle bookings stopped showing on the calendar view |
| Creator | Trip Manager, `saveAssignment(tripId, hearseId, removalId, rentalId, driverId, attendantId, departureTime)` (Trip_Manager.ds line 4244, pulled 2026-10-14) |
| CRM rules | Vehicle Bookings: "Add to Calendar" `6503357000023387062` (create, Calendar_View_enabled = true, last run 2026-09-30 11:35:35); "On Update - Add to Calendar" `6503357000064478100` (Name update, Calendar_Event_UID not empty) |
| CRM function | `add_to_calendar` (automation, arg crmid) -> Zoho Calendar `96ad489318f1477bb552861bc8dac057` |
| Backfill | `crm/functions/vehicle_bookings/ZP-TBD-112_vehicle_booking_calendar_backfill/backfillVehicleBookingCalendar.deluge` |
| Related | ZP-TBD-63 (saveAssignment double-booking fix), ZP-TBD-111 (Ship In bookings) |

## Files

- `guideline.md`
- `saveAssignment_FULL_UPDATED.deluge` -- the whole function to paste (Part A)
- `rollback/saveAssignment_FULL_CURRENT.deluge` -- the whole live function (Trip_Manager.ds lines 4244-4557)
- `saveAssignment_booking_block_UPDATED.deluge` / `rollback/saveAssignment_booking_block_CURRENT.deluge` -- just the changed block (lines 4502-4537), for reference
- Test cases: `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-112_Vehicle_Booking_Calendar_Test_Journeys.xlsx`
