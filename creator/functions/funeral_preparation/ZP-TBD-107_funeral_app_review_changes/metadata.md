Task ID: ZP-TBD-107
Zoho App: Creator -- Funeral Preparation (both parts) -- no CRM changes
Requested by: Andrea, 2026-10-08 -- DFH team review of the Funeral App (Family Viewing + Prep/Reconciliation)
Status: built 2026-10-08; widget tested locally against a mocked SDK (both parts); NOT deployed.
Base: live export `widgets\FuneralPrep\FuneralPrepWidget\Funeral_Preparation.ds` (generated 07-Oct-2026 21:07).

## Andrea's points -> what changes
| # | Andrea | Now |
|---|---|---|
| Funeral 1 | Three categories: Service Viewing, ID Viewing, Transfers | The Family Viewing part has three lists in the menu: **Service Viewings**, **ID Viewings**, **Transfers** (plus Changes to Complete). A deceased is only in the list(s) it belongs to. |
| Funeral 2 | Service viewings: funeral date present and within one week | Funeral date from today to today + 7 days. A case leaves the list once its funeral date has passed. Dec 1 funerals no longer show. |
| Funeral 3 | Case Location (Kingston / MBJ) | Each card shows **Montego Bay / Kingston**. A location filter (All / Montego Bay / Kingston) is on every list, in both parts. The choice is remembered in that browser. A case with no location shows under every choice, marked "No location", so nothing is lost. |
| Funeral 4 | Undo button | A pressed button stays green with who and when, and an **Undo** button next to it. Clicking the green button also offers Undo. Undo asks for confirmation. |
| Funeral 5 | Unique buttons per category | Service: **Ready for Viewing**. ID: **Ready for ID**, **ID done**. Transfers: **Transfer done**. The Transfer button is gone from service viewings (it was on a Cremation Only case). |
| Funeral 6 | Criteria = embalming completed (Michael Taylor showed; Carol Smith Lawrence / Ernel Porter did not) | Service Viewings = Funeral with Burial or Cremation with Service, embalming completed, funeral within the week. Cremation Only is out (that is why Michael Taylor, a May Cremation Only case at Stage "Family Visit" with no funeral date, showed). Carol and Ernel were missed because the old list needed Stage = Family Visit; they were at Embalming Complete / Funeral Scheduled. Both have a Completed Embalming Request, so they now show while their funeral is within the week. |
| Prep 1 | Driver name + case location under the deal name | The case header shows a second line, "Driver <name> · <location>". Each funeral card also shows the driver and a location badge. The driver comes from the Deal's Funeral trip (Driver, or Driver App User if no Driver is set). |
| Both 1 | Dual role for both parts | New portal profile **Viewing and Prep** with both pages and every Custom API (decision: profile with both pages, no combined page). |

## Decisions (user, 2026-10-08)
- **ID Viewings** come from the Deal field **ID Date** (`ID_Date`), today to today + 7, any deal type. The field exists, and CRM already creates the ID calendar event from it. Today almost no Deal has it filled, so staff need to fill it for ID visits. The CRM "ID Visits" module was considered and not used, because it has 0 records.
- **Transfers** come from **"Transfer to Other Funeral Home"** trips scheduled today to today + 7, or still open with no date. "DO NOT SCHEDULE" trips are left out. The soonest trip per deal is used.
- **Service types**: Funeral with Burial and Cremation with Service only.
- **Dual role**: a new profile with both existing pages.

## How it works (technical)
- **"Embalming completed"** = a CRM Operations record with `Work_Order_Type = 'Embalming Request'` and `Status = 'Completed'`. This is the same rule as the Operations App Embalming report. The Deal Stage is NOT used: it moves on (Embalming Complete -> Family Visit -> Funeral Scheduled) and is also reset by the ZP-TBD-101 issue.
- `fpViewingList` (replaced) returns one row per (deal, category) with `category`, `actions`, and for transfers `trip {when, status, driver, to}`. It runs 3 COQL pulls (Deals by Funeral_Time, Deals by ID_Date, Trips by type), then one Deals fetch. Lost / DFH Not Selected stages are left out.
- **Buttons** -> new form `FP_Action` (one record per deal + action key) and new function `fpToggleAction` (Custom API `FP_Toggle_Action`). Keys: `ready_viewing`, `ready_id`, `id_done`, `transfer_done`.
  - `ready_viewing` also writes CRM Operations `Deceased_Status = Ready for Viewing`, to the same record with the same Operations App mirror as before. The status it had before is kept in `Prev_Status`, and Undo writes that back. If it was empty, Undo clears the picklist: JSON null via REST PUT `/crm/v8/Operations`, workflows on.
  - `ready_id`, `id_done`, `transfer_done` are kept in the app only. There is no CRM field for them yet.
  - "Transfer Received" (the old placeholder) is no longer offered. The CRM value stays.
- `fpFuneralList` / `fpGetCase` (replaced) add `driver`, the Funeral trip's Driver or Driver App User name, via new helpers `fpFuneralDrivers` and `fpContactNames`. `fpGetCase` also returns `actions`, `ID_Date` and `Pre_Visit_Viewing_Date`.
- `fpSetStatus` and Custom API `FP_Set_Status` are no longer used by the widget. They stay; they're harmless.

## Files
- `funeral_app_review_functions.deluge` -- 5 new + 3 replaced functions (full code).
- `widget/app/` -- `app.js`, `style.css`, `viewing.html`, `prep.html`. This is a repo copy of
  `D:\Office\Andrea_Projects\DFH\widgets\FuneralPrep\FuneralPrepWidget\app\`. The packed zip is `FuneralPrepWidget\dist\FuneralPrepWidget.zip`.

## Deploy -- Funeral Preparation app (guideline; the .ds is not edited)

### Step 1 -- New form `FP_Action`
Edit app > Create Form > Blank, name **FP Action**. Check that the link name is `FP_Action`. Add these fields, none mandatory:

| Field label | Link name | Type |
|---|---|---|
| Deal ID | `Deal_ID` | Single Line |
| Action Key | `Action_Key` | Single Line |
| Is On | `Is_On` | Decision Box |
| Prev Status | `Prev_Status` | Single Line |
| Done By | `Done_By` | Single Line |
| Done At | `Done_At` | Single Line |

Save. Don't add any form workflows.

### Step 2 -- Functions (Workflow > Functions)
Add the **new** functions in this order (each into its own editor, namespace Deluge):
1. `fpContactNames`
2. `fpFuneralDrivers`
3. `fpActionsByDeal`
4. `fpWriteDeceasedStatus`
5. `fpToggleAction`

Then **replace the whole body** of these existing functions:
6. `fpViewingList`
7. `fpFuneralList`
8. `fpGetCase`

All code is in `funeral_app_review_functions.deluge`. Every other function stays as it is.

### Step 3 -- New Custom API
Go to Microservices > Custom API > Create. Use the same settings as the others: OAuth2, Response Standard, and the user scope covering the portal profiles.

| Custom API (link name) | Method | Function | Parameters (from request body) |
|---|---|---|---|
| `FP_Toggle_Action` | POST | fpToggleAction | dealId, actionKey, turnOn |

### Step 4 -- Widget
Go to Settings > Widgets and upload `FuneralPrepWidget\dist\FuneralPrepWidget.zip` to **both** widgets:
- DFH Family Viewing (`/app/viewing.html`)
- DFH Pre-Funeral Reconciliation (`/app/prep.html`)

### Step 5 -- Portal profiles
- **Viewing**: also allow `FP_Toggle_Action`.
- **NEW profile "Viewing and Prep"**: copy it from Viewing, then:
  - Pages: **Family_Viewing** and **Pre_Funeral_Reconciliation**.
  - Forms FP_Change_Item, FP_Viewing_Form, FP_Checklist, FP_Action: all fields visible, like the existing two profiles.
  - Custom APIs (all of them): FP_Viewing_List, FP_Get_Case, FP_Toggle_Action, FP_Submit_Viewing, FP_Toggle_Change, FP_Changes_List, FP_Funeral_List, FP_Save_Deal_Field, FP_Save_Check.
  - Move the person who does both jobs to this profile. They switch between the two pages from the portal menu.
- **Funeral Prep**: no change. Its existing APIs already cover the driver and location.

## Test (quick)
1. Viewing > **Service Viewings** shows Funeral with Burial / Cremation with Service funerals in the next 7 days whose embalming is completed. Carol Smith Lawrence and Ernel Porter appear while their funeral date is within the week. Michael Taylor (Cremation Only) and funerals after next week do not.
2. Press **Ready for Viewing**. It goes green with your name and time, and CRM Operations Deceased Status = Ready for Viewing. Press **Undo** and confirm. The button is back to normal, and the Deceased Status is back to what it was.
3. **ID Viewings**: set a test Deal's ID Date to tomorrow, then Refresh. It is listed. Press Ready for ID, then ID done. It leaves "To do" and shows under "ID done". Undo works.
4. **Transfers**: a test Deal with a "Transfer to Other Funeral Home" trip tomorrow is listed with the trip time, driver and destination. **Transfer done** and Undo work.
5. Choose **Kingston**. Only Kingston (and no-location) cases show, on every list and in Funeral Prep, and the badges count only those. Refresh the browser and Kingston is still chosen.
6. Funeral Prep: open a funeral. Under the name you see "Driver <name> · <location>", and the cards show the driver and the location.
7. Log in with a **Viewing and Prep** user. Both pages are in the menu and both work.

## Open points for Andrea
- ID Viewings rely on the Deal **ID Date** being filled in. Who fills it, and when?
- The "Ready for ID", "ID done" and "Transfer done" buttons are kept in the app only. Should any of them also write to CRM (e.g. a Deceased Status value)?
