Task ID: ZP-TBD-98 (Trip Manager part -- Report 4 "Upcoming Autopsies")
Zoho App: Creator -- Trip Manager
Requested by: Andrea, 2026-10-05 (same doc as the Operations App part)
Status: built 2026-10-05, tested locally (mocked SDK); NOT yet deployed
Main ticket notes: ../../operations_app/ZP-TBD-98_ops_portal_cards_and_reports/metadata.md

## What it adds
Tools > **Upcoming Autopsies** -- autopsies today + the next two days, earliest first, grouped by
autopsy location: deceased name, autopsy date & time, autopsy location, fridge position, trip
type. Read-only (Mr Samuels opens it himself; nothing is sent out). Refresh link, Print (same
branded print header as Burial Schedule) and Export Excel (landscape, fit to width, header row
repeats on every printed page). Re-fetches every time the view is opened.

## Files
- `trip_manager_functions.deluge` -- 7 functions copied unchanged from the Operations App file
  (6 helpers + opsReportUpcomingAutopsies), so both apps show the same list.
- `widget/widget.html` -- the full updated TM widget (copy of
  `DFH\widgets\tripManagerApp\app\widget.html`); packed zip
  `DFH\widgets\tripManagerApp\dist\tripManagerApp.zip`.

## Widget changes (all inside the SECOND IIFE -- the analytics/tools one)
- Sidebar Tools: new `.nav-item[data-antool="autopsies"]`.
- `TITLES` / `RENDER`: "autopsies" entries.
- `render()`: `isAut` bypass (like the Daily Funeral Report), shows Print + Export Excel.
- `ANALYTICS_API_METHOD`: `"TM_Upcoming_Autopsies": "GET"`.
- New: `AUT` state, `autNormalize`, `loadUpcomingAutopsies`, `renderUpcomingAutopsies`,
  `exportUpcomingAutopsiesExcel`; `data-autrefresh` in the `#an-body` click delegation.
- Excel button handler now dispatches by view (autopsies -> new export, otherwise the Daily
  Funeral Report export as before).
Nothing in the first IIFE changed; no cross-IIFE variables are used.

## Deploy
1. Trip Manager > Workflow > Functions: add the 7 functions from `trip_manager_functions.deluge`
   (helpers first). Uses TM's existing `zoho_oauth_connection`.
2. Trip Manager > Microservices > Custom API: **TM_Upcoming_Autopsies**, GET, function
   `opsReportUpcomingAutopsies`, no parameters, same auth / portal user scope as TM's other APIs.
3. Trip Manager > Settings > Widgets: update the TM widget with `dist/tripManagerApp.zip`.

## Testing done
- Both inline `<script>` blocks pass `node --check`; `zet validate` passed; `zet pack` OK.
- Headless Edge render of the full TM widget with a mocked SDK: nav item opens the view, the
  list groups by location, a multi-deceased child with no own date takes the parent trip's
  date/location, a Deal-only row shows "No trip yet", Excel export produced a valid .xlsx, and
  exactly one `TM_Upcoming_Autopsies GET` call was made.
