Task ID: ZP-TBD-99 (Trip Manager part)
App: Zoho Creator (Trip Manager)
Requested by: Andrea, 2026-10-06 -- Upcoming Autopsies in Trip Manager: show "Remove from fridge"
(autopsy date - 2 days), Removed for Autopsy and In Fridge Aisle, all read only.
Status: built 2026-10-06, tested locally (mocked SDK: table + Excel export), NOT deployed.
Needs the CRM fields Operations.In_Fridge_Aisle + Removed_for_Autopsy first.

## Server
`opsReportUpcomingAutopsies` -- replace the body with `trip_manager_functions.deluge`. Only the
Operations COQL changed (adds In_Fridge_Aisle, Removed_for_Autopsy). Identical to the Operations
App copy. Custom API TM_Upcoming_Autopsies unchanged.

## Widget (second IIFE of app/widget.html; packed dist/tripManagerApp.zip)
- `autNormalize`: In fridge aisle appended to the fridge position; `removeBy` (new
  `autRemoveBy`, autopsy date - 2 days) and `removed`.
- Table + Excel export: new columns "Remove from fridge" and "Removed for autopsy" (Yes/No);
  group row colspan 5 -> 7.
