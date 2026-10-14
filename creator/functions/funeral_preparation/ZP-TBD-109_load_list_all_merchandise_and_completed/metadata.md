Task ID: ZP-TBD-109
Zoho Apps: Creator -- Funeral Preparation, Driver App, Trip Manager; CRM -- Deals layouts (no new fields)
Requested by: Andrea, 2026-10-13 (follow-up to ZP-TBD-107)
Status: built 2026-10-13; the Funeral Prep widget was tested locally against a mocked SDK. NOT deployed.
Base: live exports from 12-Oct-2026 -- Funeral_Preparation.ds 21:34, Driver_App.ds 21:42, Trip_Manager.ds 21:41.

## Andrea's asks -> what changes
| # | Andrea | Now |
|---|---|---|
| 1 | Load list = ALL merchandise, package + add-ons | **Every** product line on the Deal (and its walk-in invoice) is on the load list EXCEPT services, vehicles and the burial site (see "Excluded parent products"). This brings in Stationary (fans, portraits, standee, ribbons), Video/Multimedia, Additional Services and any new category. The **package contents**, which are only written in the Deal's **Funeral Special Instructions** (e.g. "100 PROGRAMMES / 1 COMPLI / 25 FANS"), are shown as one block with one tick: "The package items are ready". The same product rule applies in the **Driver App** ("Load the car") and **Trip Manager** (Daily Funeral Report, Driver Sheet). The package block is in Funeral Prep only. |
| 2 | Mark the reconciliation completed once everything is checked | **Automatic.** When all 5 sections are Done, the funeral is marked **Completed**: a green banner at the top of the checklist with who and when, a **Completed** badge on the card and a green dot. If anything is unticked later, it reopens by itself. A banner shows "x of 5 sections done" until then. |
| 3 | ID Date field | The field already exists: Deals **ID Date** (`ID_Date`). Funeral Directors can edit it. It is on the **FB** (burial) layout, but buried 17th in the "Funeral and Family Visit" section, and it is **missing** from the **CO, CS, WH, FC, FR, RC** (cremation) and **SI** (Ship In) layouts. The fix is a layout change only (Step 1). ID Viewings already reads this field (ZP-TBD-107). |

## Decisions (user, 2026-10-13)
- Merchandise = all product lines except service/vehicle/plot parents (list below).
- Package items = Funeral Special Instructions text, one block, one tick.
- The same load-list rule applies everywhere: Funeral Prep, Driver App and Trip Manager.
- Completion is automatic.

## Excluded parent products (same list in all 3 apps)
Caskets, Hearses & Transport, Hearse Rental, Removal Vehicles, Chapel, Catering, Hillview, Outside Cemetery,
Pre Need, Exhumation, IFSLM, Headstone, Media, Cremation w/ Funeral Service, Cremation Only, HIH, UHWI, NCH, CRH.
- The casket and urn are already shown separately in the Driver App and Trip Manager, so Caskets stays out of the load list.
- Lines with no parent product, or no product name, are left out.
- **Included** (not on the list): Flowers, Cremation Merchandise, Programs, Funeral Equipment, Stationary, Video/Multimedia, Additional Services (Pedestal, also Delivery / Courier / Misc / Transit Permit), and any parent product added later. To hide a category, add its exact name to the list in all 3 places.

## Other change
- `fpViewingList` (ZP-TBD-107): the transfer-trip pick had `prevWhen != "" && (tWhen == "" || ...)`. Creator dropped the brackets on save, which changed the logic. When a Deal has 2 transfer trips, the wrong one could be shown. Replaced with nested ifs. This only matters for Deals with more than one transfer trip.

## How it works (technical)
- `fpLoadList` (replaced): adds the package item `{key:"pkg", kind:"package", name:<Funeral_Special_Instructions>}` first when that field isn't empty. Product lines are kept when `parentName != "" && childName != ""` and `!excluded.contains(parentName)`. The walk-in invoice works the same way.
- Completion: the widget saves check key `completed` (via the existing `fpSaveCheck`, so there is no new API) when all 5 sections are Done, and clears it when one isn't. This happens while the checklist is open, at the moment the last tick is made or removed.
  - Section 2 with no viewing form now has a tick "Checked -- there is no viewing form for this funeral" (key `recon:noform`). Without it, a funeral with no viewing form could never be complete.
  - Section 4 is Done when every load item, including the package tick, is ticked. A funeral with nothing to load is Done.
- `fpFuneralList` (replaced): returns `completed` per row and leaves the `completed` key out of the tick count.

## Files
- `funeral_prep_functions_zptbd109.deluge` -- `fpLoadList`, `fpFuneralList` (full code).
- `widget/app/` -- repo copy of `widgets\FuneralPrep\FuneralPrepWidget\app\`. The packed zip is `FuneralPrepWidget\dist\FuneralPrepWidget.zip`.

## Deploy (guideline; the .ds files are not edited)

### Step 1 -- CRM: ID Date on the layouts
Setup > Modules and Fields > **Deals**:
1. Layout **FB**, section "Funeral and Family Visit": drag **ID Date** up next to **Viewing Date** (the first field of the section). Save.
2. Layout **CO, CS, WH, FC, FR, RC**, section "Family Visit and Funeral Dates": drag the existing field **ID Date** from the field list next to **Viewing Date**. Save.
3. Layout **SI**, section "Key Dates": add **ID Date** next to **Viewing Date**. Save.
(PC, HP already has it in "Key Dates". No new field is created.)

### Step 2 -- Funeral Preparation app (Creator)
1. Workflow > Functions: **replace the whole body** of `fpLoadList` and `fpFuneralList` with the code in `funeral_prep_functions_zptbd109.deluge`.
2. Function `fpViewingList`, **find**:
   ```
   if(prevWhen != "" && tWhen == "" || thisapp.fpStamp(tWhen) >= thisapp.fpStamp(prevWhen))
   {
   	useIt = false;
   }
   ```
   **replace with:**
   ```
   if(prevWhen != "")
   {
   	if(tWhen == "")
   	{
   		useIt = false;
   	}
   	else if(thisapp.fpStamp(tWhen) >= thisapp.fpStamp(prevWhen))
   	{
   		useIt = false;
   	}
   }
   ```
3. Settings > Widgets: upload `FuneralPrepWidget\dist\FuneralPrepWidget.zip` to **both** widgets: DFH Family Viewing (`/app/viewing.html`) and DFH Pre-Funeral Reconciliation (`/app/prep.html`).
No new form, Custom API or profile change is needed.

### Step 3 -- Driver App: function `getFuneralStartInfo` (2 lines)
**Line 1.** Find:
```
if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs" || parentName == "Funeral Equipment")
```
Replace with:
```
loadListExcluded = {"Caskets","Hearses & Transport","Hearse Rental","Removal Vehicles","Chapel","Catering","Hillview","Outside Cemetery","Pre Need","Exhumation","IFSLM","Headstone","Media","Cremation w/ Funeral Service","Cremation Only","HIH","UHWI","NCH","CRH"};
if(parentName != "" && childName != "" && !loadListExcluded.contains(parentName))
```
**Line 2.** Find:
```
if(invParentName == "Flowers" || invParentName == "Cremation Merchandise" || invParentName == "Programs" || invParentName == "Funeral Equipment")
```
Replace with:
```
loadListExcluded = {"Caskets","Hearses & Transport","Hearse Rental","Removal Vehicles","Chapel","Catering","Hillview","Outside Cemetery","Pre Need","Exhumation","IFSLM","Headstone","Media","Cremation w/ Funeral Service","Cremation Only","HIH","UHWI","NCH","CRH"};
if(invParentName != "" && invChildName != "" && !loadListExcluded.contains(invParentName))
```
Save. No widget change.

### Step 4 -- Trip Manager: 2 functions
**`getDailyFuneralRollup`**: this line appears **twice** (once for Product Selection, once for the walk-in invoice). Change both. Find:
```
if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs" || parentName == "Funeral Equipment")
```
Replace with:
```
loadListExcluded = {"Caskets","Hearses & Transport","Hearse Rental","Removal Vehicles","Chapel","Catering","Hillview","Outside Cemetery","Pre Need","Exhumation","IFSLM","Headstone","Media","Cremation w/ Funeral Service","Cremation Only","HIH","UHWI","NCH","CRH"};
if(parentName != "" && childName != "" && !loadListExcluded.contains(parentName))
```
**`getTripDetail`**: 2 lines.
- Line 1 (Product Selection): the same find/replace as above (`parentName` / `childName`).
- Line 2 (walk-in invoice). Find:
```
if(wParentName == "Flowers" || wParentName == "Cremation Merchandise" || wParentName == "Programs" || wParentName == "Funeral Equipment")
```
Replace with:
```
loadListExcluded = {"Caskets","Hearses & Transport","Hearse Rental","Removal Vehicles","Chapel","Catering","Hillview","Outside Cemetery","Pre Need","Exhumation","IFSLM","Headstone","Media","Cremation w/ Funeral Service","Cremation Only","HIH","UHWI","NCH","CRH"};
if(wParentName != "" && wChildName != "" && !loadListExcluded.contains(wParentName))
```
Save both. No widget change.

## Test (quick)
1. CRM: open a burial, a cremation-with-service and a Ship In Deal. **ID Date** is next to Viewing Date on each.
2. Use a Deal with a funeral tomorrow, with these lines: Fans (Stationary), a flower, a programme, a Hearse, a Casket, and Funeral Special Instructions "100 PROGRAMMES / 1 COMPLI". In Funeral Prep, Section 4 shows:
   - the package block with one tick
   - Fans, the flower and the programme

   It does **not** show the Hearse or the Casket.
3. Driver App "Load the car" and the Trip Manager Daily Funeral Report / Driver Sheet list the Fans too. The casket still shows in its own place.
4. Tick everything in Sections 1 to 5. On the last tick:
   - the green banner "Reconciliation complete -- <you> · <time>" appears
   - the card shows **Completed**
   - Refresh: it is still Completed
5. Untick one item. The banner goes back to "4 of 5 sections done" and the Completed badge is gone.
6. A funeral without a viewing form: tick "Checked -- there is no viewing form for this funeral". Section 2 is Done.

## Open for Andrea
- Additional Services (Pedestal, but also Delivery / Courier / Misc / Transit Permit) now show on the load list. Should any of these be hidden?
- Discount lines ("Less Compli/Casket Spray", under Flowers) still show (open question from ZP-TBD-100).
