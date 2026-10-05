Task ID: ZP-TBD-98
Zoho App: Creator -- Operations App (operations-app) + CRM (one new field) + Trip Manager (Report 4 only)
Requested by: Andrea, 2026-10-05 -- "DFH_Urgent_Ops_Reports_Requirements_2026-10-04.md"
Status: built 2026-10-05 (Ops + TM parts), both widgets tested locally against a mocked SDK; NOT yet deployed

## Ask
1. Give the Operations App an interface like Trip Manager / Driver App, converted to a portal app.
2. Card view of ALL deceased records, using the data the app holds today (Deceased_Record_Form).
3. New "Reports" section with Andrea's views (1, 2, 3, 4 + 4b, 6, 7), editable where noted, each
   with an Excel export formatted for printing. Views only -- no existing workflow changed.
4. Report 4 also in Trip Manager.

## What exists today (identified, not changed)
- CRM `create_record_to_the_creator` (standalone) mirrors a Deal into Creator `Deceased_Record_Form`
  (+ Location, ID_Visit, Embalming, Casket_Management) and writes `Creator_Deceased_Record_ID` back
  to the Deal. Related: `updateembalmingoncreator`, `updateidvisitoncreator`,
  `updatelocationoncreator`, `createcasketmanagementtocreator`, `maintaindeceasedstatus`,
  `syncdeceasedidentitytoops`. The card view reads this mirror as-is.
- Creator workflow `Submit_Record_to_CRM` is **inactive**; it also writes to module names
  `Work_Order` / `Operatoins` that no longer match the CRM (`Operations`). Left untouched --
  noted only.
- CRM workflow "New - Create Trip on the Day of Autopsy Date with Task and Send Embalming Auth
  Form fro Repatriatio" (id 6503357000011553584): fires on a field update of
  `Autopsy_Date_Time` OR `Autopsy_Locations`, and only acts when `Autopsy_Required = Yes` and the
  Pipeline is in its list. Report 4b saves exactly those two fields WITH the workflow trigger,
  so this rule still creates the autopsy trip. Not changed.
- Autopsy locations = Accounts with `Account_Type = 'Autopsy Location'`.
- Driver notes header written by DA/TM `addDealNote`: `[[author|yyyy-MM-dd h:mm a]]\n<text>`.

## Files
- `operations_app_functions.deluge` -- 19 Creator functions (8 helpers + 11 behind Custom APIs).
- Widget: `D:\Office\Andrea_Projects\DFH\widgets\OpsApp\OperationsApp\OpsAppWidget\`
  (`app/widget.html`, `app/app.js`, `app/lib/exceljs.min.js`, `plugin-manifest.json`);
  packed zip `dist/OpsAppWidget.zip`.

## Deploy -- in this order

### Step 1 -- CRM: new field (Report 3)
CRM > Setup > Modules > **Operations** > layout editor:
- Add a **Pick List** field, label **Re-Measured Size**.
- Values (same as the Operations `Deceased_Size` field): Unknown · 26 x 78 to infinity ·
  24 x 77 to still fit in mold at HVMG · 21x 73 Semi & S requires 3 inches head clearance · 28 x 80
- Drop it right next to the existing **Deceased Size** field. Save.
- Check the API name is **Re_Measured_Size** (Setup > Developer Hub > APIs > API names >
  Operations). If Zoho generated anything else, tell us -- the code uses that exact name.
  (Until the field exists the Embalming view still works; that one column is read-only and a
  note says so.)

### Step 2 -- Creator functions
Operations App > Workflow > Functions > New Function (Deluge). Add each function from
`operations_app_functions.deluge`, one per editor, in file order (helpers first):
opsCoqlQuery, opsCoql, opsCoqlIn, opsGetByIds, opsLkId, opsIndexById, opsStamp, opsRange,
then the eleven below.

### Step 3 -- Creator Custom APIs
Operations App > Microservices > Custom API > Create. Same settings as the Driver App / Trip
Manager APIs (Authentication: OAuth2; User Scope: include the **portal users / portal profile**
you set up in Step 5). Response type: Standard.

| Custom API name (link name)      | Method | Function                     | Parameters (from body)       |
|----------------------------------|--------|------------------------------|------------------------------|
| Ops_Get_Deceased_Cards           | POST   | opsGetDeceasedCards          | pageNo, pageSize             |
| Ops_Get_Picklists                | GET    | opsGetPicklists              | --                           |
| Ops_Report_Initial_Pickups       | POST   | opsReportInitialPickups      | fromDate, toDate             |
| Ops_Report_Autopsy_Results       | POST   | opsReportAutopsyResults      | fromDate, toDate             |
| Ops_Report_Embalming             | GET    | opsReportEmbalming           | --                           |
| Ops_Report_Upcoming_Autopsies    | GET    | opsReportUpcomingAutopsies   | --                           |
| Ops_Report_Awaiting_Autopsy      | GET    | opsReportAwaitingAutopsy     | --                           |
| Ops_Report_Family_Viewing        | GET    | opsReportFamilyViewing       | --                           |
| Ops_Report_Driver_Notes          | POST   | opsReportDriverNotes         | fromDate, toDate             |
| Ops_Save_Fields                  | POST   | opsSaveFields                | updatesJson                  |
| Ops_Save_Autopsy_Schedule        | POST   | opsSaveAutopsySchedule       | dealId, autopsyDateTime, locationId |

The names must match exactly -- `app.js` calls them by these names (API map at the top).

### Step 4 -- Widget + page
1. Operations App > Settings > Widgets > Create > upload `dist/OpsAppWidget.zip`
   (index `/app/widget.html`).
2. Create a Page **Operations** (blank) and drop that widget on it, full width/height.

### Step 5 -- Convert to a portal app (same pattern as Driver App / Trip Manager)
1. Operations App > Settings > Users and Control > **Portal** -- enable the customer portal
   if it isn't on for this app yet.
2. Portal profile (e.g. **Operations Staff**, based on the existing "Customer" profile):
   access to the **Operations** page only; allow the 11 Custom APIs above.
3. Navigation: put the **Operations** page first so it is the portal landing page. Existing
   sections/reports stay for admins -- nothing is removed.
4. Invite the portal users (Ms Shirley, Mr Samuels, ops staff) to that profile.

### Step 6 -- Trip Manager: Report 4
See `../../trip_manager/ZP-TBD-98_upcoming_autopsies/metadata.md` (7 functions, Custom API
`TM_Upcoming_Autopsies`, updated TM widget zip).

## How each view gets its data / what it writes
All reads are live CRM (COQL + REST GET through `zoho_oauth_connection`), except the card view
(Creator `Deceased_Record_Form`). All edits go through `opsSaveFields`, which only accepts the
module/field pairs in its whitelist. Edits to Deals / Operations / Deceased Pickups / Contacts /
Notes fire workflows (same as editing in CRM). **Edits to Trips do NOT fire workflows**, so
fixing an old trip's date/driver/mileage from a report doesn't re-send it to Amber or Trip
Manager.

| View | Rows | Editable -> CRM field(s) | Read-only |
|---|---|---|---|
| 1 Initial Pickups | Trips of type Police Case Pickup / Initial Police Case Pickup / Hospital Storage / Hospital Pickups / First Call, `Scheduled_Date` in range; one row per Deceased Pickup (police/hospital), one per trip (first call) | pickup date -> Trip.Scheduled_Date; name/DOB -> Deal (or Pickup First/Last when no Deal yet); sex -> Deal; address -> Deal Street_1/City **and** Pickup Deceased_Street_Address/City; pickup location -> Trip Place_of_Removal(_Other)/Hospital_Name/Ward; NOK -> police/hospital: Pickup NOK_First/Last/Phone only (the existing "On Deceased Pickups Edit" workflow / onDeceasedPickupCheckIn copies them to the NOK Contact First/Last/**Phone**); first call: the Deal's NOK Contact First/Last/**Phone** (changed from Mobile 2026-10-05 after testing -- DFH's NOK number lives in Contact.Phone); doctor/police/TOD -> Deal (Pickup when no Deal); driver/attendant -> Trip; call taken by -> Deal; mileage -> Trip; size -> Deal (Pickup when no Deal); fridge + condition -> Operations | age, pickup type |
| 2 Autopsy Results | children of "Multi Deceased Autopsy Trip" parents in range, grouped by parent; month totals per result | case name/date -> parent Trip; name -> Deal; result + reschedule reason -> Operations (Related_Trip = child); receiving FH + reason -> Deal; driver -> child Trip | -- |
| 3 Embalming | Deals with auth AND burial order received, and (funeral today+ OR Embalming Request not Completed) | every column; status = Operations.Status (Requested/Scheduled/Completed) | status when the Deal has no Embalming Request record |
| 4 Upcoming Autopsies | autopsy trips (Autopsy Initial / Multi / Reschedule) today..+2 days, their children, and Deals with Autopsy_Date_Time in that window but no trip; grouped by location | name -> Deal; date + location -> the autopsy Trip (or, if no trip yet, Deal via the workflow-triggering save); fridge -> Operations | trip type |
| 4b Awaiting Autopsy Date (Ms Shirley) | Deals with Is_Deceased_In_Our_Care = Yes, Autopsy_Required = Yes, no Autopsy_Date_Time, Stage not closed/completed, not departed | date + location -> Deal Autopsy_Date_Time + Autopsy_Locations, **with workflow trigger** | the rest |
| 6 Family Viewing | Deals with funeral today+ AND (appearance answer OR new requested funeral time) | every column (owner choices = funeral directors already on these Deals) | -- |
| 7 Driver Notes | Deal notes with the `[[driver|time]]` header dated on the funeral day, for Funeral trips in range (up to today) | name + funeral date -> Deal; driver/time/text -> the Note (header rebuilt) | -- |

## Decisions / assumptions to confirm with Andrea
1. **Trip type** (Report 4) and **pickup type** (Report 1) are read-only -- changing a trip's
   type has its own reclassify logic in DA; not something to do from a report.
2. Report 4 "next two days" = today plus the next two days.
3. "In our care" (4b) = Deal `Is_Deceased_In_Our_Care = Yes` (per user, 2026-10-05). That flag
   is set to Yes when the initial pickup completes (DA completeJob,
   updatedealstagetoinitialtripcompleted, createonePoliceDropoffDeceased) but nothing sets it
   back to No when the body leaves, so these stay as a backstop: Stage not one of Closed Lost /
   Closed Lost to Competition / Funeral Completed / Completed / Cremation Completed / DFH Not
   Selected / Letter of No Interest / Not Interested / Survey Sent / Survey Completed, and
   Deceased_Departed not ticked.
4. Location filter (Report 1): Kingston = Kingston / 20A; Montego Bay = Montego Bay / Union St /
   OPS Center (from Operations.Location, else the Pickup's Location).
5. Report 3 "not yet embalmed" needs an Embalming Request record that isn't Completed; Deals
   with no Embalming Request at all only show while their funeral is today or later.
6. Report 7 counts any note with the app header (DA and TM both write it); notes typed straight
   into CRM have no header and are not included.

## Testing done (2026-10-05)
- `node --check app.js` clean; `zet validate` passed; `zet pack` OK.
- Headless Edge render of every view against a mocked Creator SDK with realistic data:
  card grid + detail panel, all 7 report tables, grouping (2, 4), totals (2), notes banners
  (3, 4, 4b), the edit modal, a save (Report 7 note -> one `Notes.Note_Content` update with the
  header rebuilt), and Excel export (valid .xlsx blob produced).
- Not yet run against live CRM -- needs Steps 1-5 first.

## Trip Manager part (Report 4) -- DONE 2026-10-05
User confirmed the workspace TM + DA widgets are the live source. Built in
`../../trip_manager/ZP-TBD-98_upcoming_autopsies/` (functions, Custom API
`TM_Upcoming_Autopsies`, widget change inside TM's second IIFE only). Repo copy of the Ops
widget source: `widget/` in this folder (the ExcelJS bundle is the same file TM already ships
in `app/lib/`, not duplicated here).
