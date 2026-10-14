Task ID: ZP-TBD-99
Zoho App: Creator -- Operations App (portal) + Trip Manager + Driver App; CRM (two new Operations fields)
Requested by: Andrea, 2026-10-06 -- "DFH_Ops_App_and_Family_Viewing_Requests_2026-10-05.md"
(Operations App part only. Casket Management = for Andrea's review; Funeral Preparation app = later.)
Status: built 2026-10-06; Ops + TM widgets tested locally against a mocked SDK; DA widget syntax-checked;
NOT yet deployed.

## Ask (Operations App part)
- New CRM fields on Operations: **Removed for Autopsy** and **In Fridge Aisle** (tick boxes).
- All Deceased: hide a case once its date has passed (rules below); show In Fridge Aisle (Location)
  and Removed for Autopsy (Autopsy) on the card detail.
- R1 Initial Pickups: In Fridge Aisle in the Fridge # column and its edit window.
- R3 Embalming: leave out Cremation Only, Repatriation with Cremation, Ship In with Service Type =
  Cremation; drop cases after their date (same rules as All Deceased); remove the "not Completed,
  whatever the date" rule; show a "to be embalmed" total above the table.
- R4 Upcoming Autopsies: autopsy time/location edits save WITH workflows; new "Remove from fridge"
  date (autopsy date - 2 days); Removed for Autopsy tick (editable); In Fridge Aisle in the fridge
  position. Trip Manager copy: same columns, read only.
- R4b Awaiting Autopsy Date: (Type = Police OR Autopsy Required = Yes) AND in our care AND no
  autopsy date; saving also sets Autopsy Required = Yes (workflows on).
- Driver App: In Fridge Aisle tick box on the morgue check-in screen, saved to Operations.
- R2, R7: no change. R6: stays until the Funeral Preparation app is live.

## Hide-date rules (opsHideDate / opsIsGone) -- All Deceased + Embalming only
| Deal Type | Hidden after |
|---|---|
| Funeral w/Burial | Funeral date |
| Cremation with Service -- Body in Church | Cremation date |
| Cremation with Service -- Ashes in Church | Funeral date |
| Cremation with Service -- blank / No Service | Later of funeral and cremation dates |
| Cremation Only | Cremation date |
| Full Body Repatriation, Repatriation with Cremation | Flight date (Departing_Date_Time) |
| Ship In | Service_Type = Cremation -> cremation date; otherwise funeral date |
| Police / Hospital / First Call | Stage DFH Not Selected / Closed Lost / Closed Lost to Competition -> hidden now; otherwise Service_Type = Cremation -> cremation date, Funeral with Burial -> funeral date |
A case with no date yet stays visible. "Passed" = the date is before today (it still shows on the day itself).

## Root cause found on the way
R4b came back empty because its COQL chained 4 conditions without nested brackets (COQL allows only
2 conditions per bracket level). Rewritten with nested brackets; the new Embalming query follows
the same rule.

## Files
- `operations_app_functions.deluge` -- full current set (21 functions). Versus ZP-TBD-98:
  NEW `opsHideDate`, `opsIsGone`; CHANGED `opsGetDeceasedCards`, `opsReportInitialPickups`,
  `opsReportEmbalming`, `opsReportUpcomingAutopsies`, `opsReportAwaitingAutopsy`,
  `opsSaveAutopsySchedule`, `opsSaveFields`. No signature changes -> no Custom API changes.
- `widget/app.js`, `widget/widget.html` -- repo copy of the Ops widget
  (`D:\Office\Andrea_Projects\DFH\widgets\OpsApp\OperationsApp\OpsAppWidget\`, packed
  `dist/OpsAppWidget.zip`).
- Trip Manager: `trip_manager/ZP-TBD-99_upcoming_autopsies_fridge_fields/` (one function +
  widget copy; packed `tripManagerApp\dist\tripManagerApp.zip`).
- Driver App: `driver_app/ZP-TBD-99_in_fridge_aisle/` (saveMorgueCheckin guideline + metadata;
  app.js edited directly, packed `driverApp\dist\driverApp.zip`).

## Deploy -- in this order

### Step 1 -- CRM: two new fields on Operations (do this first -- the code reads them)
CRM > Setup > Modules > **Operations** > layout editor:
1. **Checkbox** field, label **In Fridge Aisle** -- place it with the morgue fields (Location, Room,
   Refrigerator, Row, Drawer).
2. **Checkbox** field, label **Removed for Autopsy** -- place it with the autopsy fields.
Save, then check the API names are exactly **In_Fridge_Aisle** and **Removed_for_Autopsy**
(Setup > Developer Hub > APIs > API names > Operations). If Zoho generated anything else, tell us.
Until both exist, All Deceased, R1 and R4 (Ops + TM) fail to load -- so do this step before Step 2.

### Step 2 -- Operations App functions
Operations App > Workflow > Functions:
- **New** functions: `opsHideDate`, `opsIsGone` (helpers, no Custom API). Create these first --
  the changed functions below call them.
- **Replace the body** of: `opsGetDeceasedCards`, `opsReportInitialPickups`, `opsReportEmbalming`,
  `opsReportUpcomingAutopsies`, `opsReportAwaitingAutopsy`, `opsSaveAutopsySchedule`,
  `opsSaveFields`.
No Custom API changes (same names, methods and parameters).

### Step 3 -- Operations App widget
Upload `OpsAppWidget\dist\OpsAppWidget.zip` over the existing widget (same widget, new version).

### Step 4 -- Trip Manager
- Replace the body of `opsReportUpcomingAutopsies` in the Trip Manager app with
  `trip_manager/ZP-TBD-99_upcoming_autopsies_fridge_fields/trip_manager_functions.deluge`
  (only the Operations query line changed).
- Upload `tripManagerApp\dist\tripManagerApp.zip`.

### Step 5 -- Driver App
See `driver_app/ZP-TBD-99_in_fridge_aisle/metadata.md`: replace `saveMorgueCheckin`, add the
`inFridgeAisle` parameter to the **Save_Morgue_Checkin** Custom API, upload `driverApp.zip`.

## What changed, by screen
- **All Deceased**: `opsGetDeceasedCards` reads each card's Deal (Type, Stage, Funeral_Time,
  Cremation_Date, Departing_Date_Time, Service_Format_Type, Service_Type) and leaves out cases where
  `opsIsGone` is true. Reads In_Fridge_Aisle / Removed_for_Autopsy from the deal's Operations record
  that holds the fridge position (same rule as R4). Returns `hidden` (count left out) and `hasMore`
  (page was full). Widget pages on `hasMore` (pages can now come back short), shows
  "N past their funeral / cremation / flight date not shown", adds "In fridge aisle" to the card
  line and both fields to the detail panel.
- **R1**: Operations fields now include In_Fridge_Aisle; Fridge # shows "In fridge aisle"; the edit
  window has an In fridge aisle tick (-> Operations.In_Fridge_Aisle).
- **R3**: nested-bracket COQL (auth + burial order received, stage not closed, some relevant date
  today or later or not set); then type exclusions + `opsIsGone`. The "not Completed" union is gone.
  Returns `toEmbalm`; widget shows a "to be embalmed" total chip (rows whose Embalming Request status
  is not Completed -- no Embalming Request counts as not Completed). Also in the Excel export.
- **R4**: Operations fields include In_Fridge_Aisle + Removed_for_Autopsy. New columns
  "Remove from fridge" (autopsy date - 2 days, red "Due" badge when today or past and not yet
  removed) and "Removed for autopsy" (editable -> Operations.Removed_for_Autopsy). Autopsy date/time
  and location edits on trip rows are sent with `"wf":"1"`; `opsSaveFields` then saves that Trip WITH
  workflows. Only Trips.Scheduled_Date / Trips.Autopsy_Location honour the flag -- every other Trips
  edit still saves without workflows. Deal-only rows (no trip yet) already saved through
  `opsSaveAutopsySchedule` with workflows.
- **R4b**: query `(((Type = 'Police' or Autopsy_Required = 'Yes') and Is_Deceased_In_Our_Care = 'Yes')
  and (Autopsy_Date_Time is null and Stage not in (closed)))`; Deceased_Departed backstop kept.
  `opsSaveAutopsySchedule` also writes `Autopsy_Required = Yes` in the same update (workflow on), so
  the existing CRM rule 6503357000011553584 (acts only when Autopsy Required = Yes) creates the trip
  for police cases too. Widget adds Type to the name cell and an "Autopsy required" column.
- **opsSaveFields** whitelist: Operations `In_Fridge_Aisle`, `Removed_for_Autopsy` (bool).
- No CRM workflow changed.

## Open questions for Andrea
1. **Richard Bourke** (Cremation with Service, Ashes in Church, funeral 26 Sep): he was on Embalming
   only because of the old "not Completed, whatever the date" rule, now removed -- so he drops off.
   Should Cremation with Service **Ashes in Church** be left out of Embalming altogether (body is
   cremated before the service)?
2. **Driver App hospital / police multi-body check-in**: the per-body fridge positions there are saved
   on the Deceased Pickup and copied to Operations by CRM `onDeceasedPickupCheckIn`. Adding In Fridge
   Aisle there needs a new Deceased Pickups field + a change to that CRM function. Wanted?
3. **Remove from fridge** = 2 days before the autopsy date. R4 itself only shows autopsies from today
   to 2 days ahead, so that date is always today or earlier there ("Due"). Should R4 look further
   ahead so staff see it coming?
4. When In Fridge Aisle is ticked, any old Row / Drawer on the record is left as it was (the driver
   sends none). Should ticking it clear Row / Drawer?
