# ZP-TBD-45 — TM / DA / Intake Form Changes

Andrea is sending these as a series of individual small requests across Trip Manager, Driver
App, and the NOK Intake Form. This ticket tracks the whole series as items land, rather than one
function at a time. Widget JS/HTML changes are edited directly in the local repo (per the
project's Creator-.ds-only guideline rule) and tracked here since the individual widget projects
(tripManagerApp, in this case) don't have their own git repos — everything lives in this one.

## Done and confirmed live

### Task 1 — Daily Funeral Report: freeze the column labels
Andrea wants the column header row to stay visible when scrolling down a long report, so she
doesn't lose track of which column means what.

Same underlying issue as the earlier Burial Schedule frozen-header fix (native
`position:sticky` on `<th>` is not reliably honored in this widget's runtime, confirmed
earlier) — reused the existing `setupFrozenHead`/`teardownFrozenHead` JS-driven mechanism rather
than building something new.

**`app/widget.html` changes:**
- `renderDailyReport()` now calls `setupFrozenHead(...)` on its table wrap
  (`#an-dfrwrap-tbl`), right after the existing horizontal-scroll sync (`dfrSyncTop()`).
- The central view-switch teardown in `render()` was only preserving the frozen header for
  `state.view === "burial"` — extended to also preserve it for `"dailyreport"`, otherwise
  navigating into the Daily Funeral Report would immediately tear down its own freshly-created
  header.

**Follow-up fix (same task):** Andrea reported the synced horizontal-scrollbar strip above the
table (`#an-dfrtop` / `#an-btop`) was not freezing along with the header — it scrolled away on
its own while the header stayed pinned. `setupFrozenHead` now takes an optional second
parameter, the scrollbar element, and pins it in `position:fixed` directly above the header
clone whenever the header itself is shown (with a spacer inserted before it so nothing else
jumps when it's popped out of flow, and its own inline positioning cleared when hidden again).
Applied to **both** call sites since they share the same function:

```js
// Daily Funeral Report
setupFrozenHead(document.getElementById("an-dfrwrap-tbl"),document.getElementById("an-dfrtop"));

// Burial Schedule (bt was already in scope at this call site)
setupFrozenHead(bw,bt);
```

The scrollbar stays fully interactive while pinned — dragging it or scrolling it still moves the
table horizontally, since it's the same live element repositioned, not a clone.

Confirmed deployed and tested by Andrea, passed.

### Task 2 — Daily Funeral Report: Excel/print layout was shrinking to fit one page
Andrea's actual "Print" button only ever triggered the browser's native `window.print()` — there
was no real Excel export anywhere in the app. The font-shrinking she saw is the browser print
dialog's own "fit to page" scaling, which cannot be turned off or overridden from the page's own
CSS or JS (confirmed by inspecting the existing print CSS, which was already correctly written
for multi-page: `thead{display:table-header-group}` for repeating headers, `tr{page-break-inside:
avoid}`, no page-height constraint forcing one sheet — none of that matters once the browser's
own scale setting overrides it).

**Fix: stopped relying on browser print for this report, added two real export options
instead.** Both libraries are bundled locally in `app/lib/` (installed via npm, dist files
copied in) rather than loaded from a CDN — no `plugin-manifest.json` change needed, since a
local `<script src="lib/...">` reference doesn't touch CSP.

- **`app/lib/jspdf.umd.min.js`** + **`app/lib/jspdf.plugin.autotable.min.js`** (jsPDF 3.x +
  AutoTable) — new `exportDailyReportPdf()` builds a genuine multi-page landscape PDF: fixed
  8pt font that never shrinks, header row repeats on every page (AutoTable's own pagination, not
  the browser's), day-group divider rows, branded header + page-number footer redrawn per page.
- **`app/lib/exceljs.min.js`** (ExcelJS) — new `exportDailyReportExcel()` builds a real `.xlsx`
  file: header row frozen (`views:[{state:"frozen",ySplit:1}]`) and styled (solid plum fill,
  bold white text, matching the on-screen header), day-groups as merged full-width styled rows,
  autofilter, sensible column widths, wrapped cell text. Downloaded via `wb.xlsx.writeBuffer()` +
  a `Blob`/temporary `<a download>` link (ExcelJS has no built-in browser save helper). Since
  it's a real Excel file, Andrea has full control over Excel's own print/page-setup from there,
  which sidesteps the same shrinking problem a second, independent way.
- The existing "Print" button is reused for the PDF export specifically on the Daily Funeral
  Report view (relabeled "Export PDF" there); it's untouched everywhere else (Burial Schedule,
  Driver Sheet Detail still use the normal browser print dialog, since only the Daily Funeral
  Report was reported as a problem). A new "Export Excel" button sits next to it, visible only on
  the Daily Funeral Report view.

**Follow-up fix (same task):** Andrea's first live test of the Excel export came back as "excel
formatting with header color could be better." Root cause: the first version was built with
SheetJS (`xlsx` npm package) — its free/Community Edition can write formulas, merges, freeze
panes, and autofilters into a real `.xlsx`, but **cannot write cell styles (fill color, bold,
font color) at all** — that's a Pro-only feature of that library, undocumented until you hit it.
Every style object set on a cell was silently dropped on write, which is why the header rendered
in plain default black-on-white regardless of what was set. Swapped the Excel export from
SheetJS to **ExcelJS** (`app/lib/exceljs.min.js`, replacing `app/lib/xlsx.full.min.js` which was
removed), which has full free-tier support for cell fills/fonts — the header row now renders
with a solid plum background and bold white text, and the day-group divider rows get a light
plum tint to match. PDF export (`app/lib/jspdf.umd.min.js` + AutoTable) is unaffected.

Confirmed deployed and tested by Andrea, passed.

### Task 3 — Crematory Drop-off: proper TM/DA configuration
Andrea's brief (`projectDocuments/crematoryDropoffconfiguration.txt`): Crematory Drop-off trips
were never properly built out for the driver flow. `Trip_Type = "Crematory Dropoff"` already
exists and is actively used in CRM, and Trip Manager already assigns it fine in practice — its
`categoryOf()` function (in `tripManagerApp/app/widget.html`) silently defaulted any
unrecognized trip type to `"pickup"`, so nothing blocked TM assignment. Added
`"Crematory Dropoff":1` to the `PICKUP_TYPES` map there explicitly, so this no longer depends on
an implicit default.

The real gap was **Driver App** (`driverApp/app/app.js`): a Crematory Dropoff trip fell through
to the generic body-pickup flow (`renderJobDetail`'s default branches) — Place of Removal,
Pronouncement of Death, Police on Scene, Morgue location/drawer, Condition/Size — none of which
applies to driving an already-prepared deceased to a crematory and back. There was also nowhere
to capture what Andrea needs, and no fields on Operations to store it.

**Fix — new dedicated flow**, following the same shape as the existing Repatriation flow
(`renderRepatriationStart`/`renderRepatriationSteps`) and its checkbox-gate pattern
(`repatRow`/`repatGateCheck`):
- `openJobDetail`'s dispatcher gets two new branches for `Trip_Type === "Crematory Dropoff"`:
  not-started → `renderCrematoryDropoffStart`, on-scene (`Started`/`Completed`) →
  `renderCrematoryDropoffComplete`.
- `renderCrematoryDropoffStart(trip)` — pre-start checklist, 2 items: "Documents collected",
  "Deceased loaded" (`crematoryRow` — a dedicated row helper, not `repatRow`; `repatRow` hardcodes
  `onchange="repatGateCheck()"`, which no-ops here since `state.repatSteps` is never set for this
  flow, so reusing it directly silently never enabled Start Trip — caught during Andrea's live
  test). Both must be checked to enable Start Trip
  (`crematoryStartGateCheck`), which reuses the existing generic `Save_Start_Job` API — no new
  start API needed. Checklist state persists via the existing `Checklist_State` field
  (`persistChecklistState`/`restoreChecklistState`, same mechanism as every other flow in this
  app — works automatically because it walks every input/select/textarea id under
  `#detail-body`, not a hardcoded field list).
- `renderCrematoryDropoffComplete(trip)` — completion form: Funeral Home (`<select>`,
  `Honeyghan's` default-selected + `Other`), Receiving Attendant (text), Pickup Items for Return
  (textarea, required — driver types "None" if nothing to return, per Andrea's instruction that
  everything listed is required). All three gate the "Complete Trip" button
  (`crematoryCompleteGateCheck`). Handles the `Trip_Status === "Completed"` reopen case the same
  way `renderJobDetail`/`renderRepatriationSteps` do (`applyCompletedReadOnly`).
- `submitCrematoryDropoffComplete()` calls a **new** custom API, `Complete_Crematory_Dropoff`
  (not yet created in Creator — guideline below), with `tripId`, `funeralHomeName`,
  `receivingAttendant`, `pickupItems`, `completionTime`.

**CRM change needed (guideline — apply directly in Zoho, not done here):** add 3 new fields to
the **Operations** module:
| API Name | Type | Notes |
|---|---|---|
| `Funeral_Home_Name` | Picklist | Values: `Honeyghan's` (default), `Other` |
| `Receiving_Attendant` | Single Line | — |
| `Pickup_Items_for_Return` | Multi Line (text area) | — |

**Deluge — new Creator custom API `Complete_Crematory_Dropoff`** (POST). Mirrors the existing
`Save_Complete_Job`/`Save_Start_Job` pattern already used by every other flow in this app.
Resolves the Operations record via `Related_Trip` on Operations matched to the trip id (one
dedicated Operations record per trip — see the "Found and fixed" note below). As-deployed
version (created directly in Creator by the user, with two corrections over the original
guideline draft: `.toLong()` on both `updateRecord` calls since Deluge's CRM connector wants an
int64 id rather than the raw string, and `{"trigger":{"workflow"}}` on the Trip completion
update so anything tied to `Trip_Status = Completed` still fires):

```deluge
map Complete_Crematory_Dropoff(string tripId, string funeralHomeName, string receivingAttendant, string pickupItems, string completionTime)
{
	// Complete_Crematory_Dropoff -- Creator custom API, POST
	// input: tripId, funeralHomeName, receivingAttendant, pickupItems, completionTime
	response = Map();
	if(tripId == null || tripId == "")
	{
		response.put("status","error");
		response.put("message","Missing tripId.");
		return response;
	}
	opsRows = zoho.crm.searchRecords("Operations","(Related_Trip:equals:" + tripId + ")");
	if(opsRows != null && opsRows.size() > 0)
	{
		opsId = opsRows.get(0).get("id");
		opsUpdate = Map();
		opsUpdate.put("Funeral_Home_Name",funeralHomeName);
		opsUpdate.put("Receiving_Attendant",receivingAttendant);
		opsUpdate.put("Pickup_Items_for_Return",pickupItems);
		zoho.crm.updateRecord("Operations",opsId.toLong(),opsUpdate);
	}
	else
	{
		response.put("status","error");
		response.put("message","No Operations record linked to this trip (Related_Trip) -- could not save drop-off details.");
		return response;
	}
	tripUpdate = Map();
	tripUpdate.put("Trip_Status","Completed");
	tripUpdate.put("Completion_Time",completionTime);
	zoho.crm.updateRecord("Trips",tripId.toLong(),tripUpdate,{"trigger":{"workflow"}});
	response.put("status","success");
	return response;
}
```

**Found and fixed while testing:** a fresh Crematory Dropoff test trip had no Operations record
at all, so `Complete_Crematory_Dropoff`'s `Related_Trip:equals:<tripId>` search (correct as
written) came up empty. Root cause traced to the CRM workflow rule **"Create Operations Record
On Trip Creation"** (id `6503357000066905449`, fires `automation.createOperationsRecordOnTripCreation`
on every Trip create) — its criteria was `Trip_Type not_equal [Funeral, Airport Dropoff, Ashes
Pickup, Transfer to Other Funeral Home, Autopsy Reschedule, Document Pickup, Pre-Visit, Burial
Order, Hospital Storage, MOH Trip, Multi Deceased Autopsy Trip]`, and Crematory Dropoff was
sitting in that exclusion list, so it silently never got its own Operations record like every
other trip type does. Fixed by removing Crematory Dropoff from that exclusion list (done
directly in CRM, confirmed via the live workflow rule). `Complete_Crematory_Dropoff`'s
`Related_Trip` resolution logic did not need to change — the app's per-trip Operations record
convention (one dedicated Operations record per trip, not per Deal) was confirmed correct by
reading `automation.createOperationsRecordOnTripCreation`'s source directly.

Confirmed deployed and tested by Andrea, passed.

### Task 4 — Intake App (NOKIntake): future pickup date
Andrea's brief (`projectDocuments/Intake App — future pickup date.txt`): the Intake App
(confirmed to mean the **NOKIntake** widget, `widgets/NOKIntake/NOKIntake`) has no way to
schedule a pickup for a future date — First Call and Wholesale (Local/Airport) trips are
effectively created for "now." Wants a new field, **"Schedule Date and Time"**, shown only for
Deal Type First Call / Wholesale Local / Wholesale Airport (not Police, not Hospital), that
becomes the Trip's `Scheduled_Date`. TM still assigns/changes the actual time and driver later.

Traced across three layers:
- `widgets/NOKIntake/NOKIntake/app/app.js` — the widget's own visibility engine
  (`RULES[<effective deal type>].fields`, toggled by `applyDealType()`). `effectiveType()` splits
  `Deal_Type = "Wholesale"` into `Wholesale_Local`/`Wholesale_Airport` via the `Wholesale_Type`
  sub-select. `buildData()` submits via `ZOHO.CREATOR.DATA.addRecords` into the Creator form
  `NOK_Information_Form` — not a direct CRM write — so any new field has to exist on that form.
- `widgets/NOKIntake/NOKIntake/Intake_Form.ds` — the real Creator form schema + its on-submit
  workflow (guideline-only, per the `.ds` rule). The workflow reads `theForm.<field>` and builds
  `dealDataMap`, which creates/updates the actual CRM Deal.
- Two CRM automation functions create the Trip, pulled live, **neither honors a user-supplied
  schedule today**:
  - `Create Trips from Deals for First Call` (`automation.createTripsFromDealsForFirstCall`, id
    `6503357000021370161`) — never sets `Scheduled_Date` at all.
  - `Create Trip for Wholesale` (`automation.createTripForWholesale`, id `6503357000027289033`)
    — handles both Local and Airport. Airport sets `Scheduled_Date = Arriving_Date_Time` (flight
    arrival); Local defaults to `zoho.currenttime.addBusinessDay(1)` (next business day).

**Widget changes (done, direct-edited):**
- `app/widget.html` — new field, same shape as the existing `wrap_Notes`/`wrap_Call_Taken_By`
  rows, placed near Pickup Location:
  ```html
  <div class="row" id="wrap_Schedule_Date_and_Time"><label>Schedule Date and Time</label><input id="Schedule_Date_and_Time" type="datetime-local"/></div>
  ```
- `app/app.js`:
  - Added `"wrap_Schedule_Date_and_Time"` to `TOP_FIELDS`.
  - Added `"wrap_Schedule_Date_and_Time"` to the `fields` array of exactly the 3 in-scope
    `RULES` entries: `"First Call"`, `"Wholesale_Local"`, `"Wholesale_Airport"` — this is what
    scopes the field to only those types; `"Police"`/`"Hospital"` were left untouched.
  - New helper `vDateTime(id)` next to `vDate(id)` — converts the `datetime-local` input's
    `YYYY-MM-DDTHH:mm` into a full ISO 8601 string with the Jamaica offset, e.g.
    `2026-08-30T10:00:00-05:00` (same convention as `jamaicaNowIso()` in
    `driverApp/app/app.js`). Returns `""` when empty — field is optional.
    **Corrected after deployment:** the Creator field turned out to be a single-line text field,
    not a real `datetime` field, so `vDateTime()` was changed to emit a full ISO string (parseable
    downstream) instead of the original `dd-MMM-yyyy HH:mm:ss` shape, which only made sense for a
    genuine Creator datetime field.
  - Added `"Schedule_Date_and_Time": vDateTime("Schedule_Date_and_Time")` to `buildData()`.

**CRM change needed (guideline):** add one new field to **Deals**: `Schedule_Date_and_Time` —
Single Line (text), storing the ISO string as submitted (e.g. `2026-08-30T10:00:00-05:00`).

**Creator form guideline — `Intake_Form.ds`** (apply directly in Creator, not edited here):
new field definition — **single line text**, matching what the user actually created on the
form (not a `type = datetime` field, since the value stored is an ISO string, not a native
Creator datetime value):
```
Schedule_Date_and_Time
(
	type = singleline
	displayname = "Schedule Date and Time"
	maxchar = 30
	row = 1
	column = 1
	width = medium
)
```
Plus one line added to the on-submit workflow's `dealDataMap` construction (near the existing
conditional puts for First Call/Wholesale, e.g. around the block that already gates on
`theForm.Deal_Type == "First Call" || ... isDealTypeWholesaleLocal ...`):
```
if(theForm.Deal_Type == "First Call" || theForm.Deal_Type == "Wholesale")
{
	dealDataMap.put("Schedule_Date_and_Time",theForm.Schedule_Date_and_Time);
}
```
Verify the exact insertion point and value shape against the live `.ds` before pasting — the
snippet above is for reference, not a verbatim live excerpt.

**Deluge guideline — update both trip-creation functions** to prefer the new field over their
current defaults, falling back to today's behavior when it's blank (so deals that don't set it
keep working exactly as now). No parsing needed on the Deluge side — `Schedule_Date_and_Time`
is a plain string (`2026-08-30T10:00:00-05:00`) in the exact same ISO shape as the `iso_format`
variable `createTripForWholesale` already builds for its own Local-pickup default and passes
straight into `tripMap.put("Scheduled_Date", ...)`, so passing `recordInfo.get("Schedule_Date_and_Time")`
through unparsed the same way is correct and consistent with the existing code:
- `createTripsFromDealsForFirstCall` — after building `tripMap`, add:
  ```
  if(!isNull(recordInfo.get("Schedule_Date_and_Time")) && recordInfo.get("Schedule_Date_and_Time") != "")
  {
  	tripMap.put("Scheduled_Date",recordInfo.get("Schedule_Date_and_Time"));
  }
  ```
- `createTripForWholesale` — in each of the `Wholesale_Type == "Airport"` / `else` (Local)
  branches, check the new field first and only fall back to `Arriving_Date_Time` /
  `addBusinessDay(1)` when it's blank, e.g.:
  ```
  if(!isNull(recordInfo.get("Schedule_Date_and_Time")) && recordInfo.get("Schedule_Date_and_Time") != "")
  {
  	tripMap.put("Scheduled_Date",recordInfo.get("Schedule_Date_and_Time"));
  }
  else if(recordInfo.get("Wholesale_Type") == "Airport")
  {
  	tripMap.put("Scheduled_Date",recordInfo.get("Arriving_Date_Time"));
  	tripMap.put("Trip_Type","Wholesale Airport");
  	tripMap.put("Name","Initial Trip for " + recordInfo.get("Account_Name").get("name"));
  }
  else
  {
  	date_str = zoho.currenttime.addBusinessDay(1);
  	parsed_date = date_str.toTime("dd-MMM-yyyy HH:mm:ss");
  	iso_format = parsed_date.toString("yyyy-MM-dd'T'HH:mm:ssXXX");
  	tripMap.put("Scheduled_Date",iso_format);
  	tripMap.put("Trip_Type","Wholesale Local");
  	tripMap.put("Name","Pickup Trip for " + recordInfo.get("Account_Name").get("name"));
  }
  ```
  (the `Trip_Type`/`Name` puts still need to happen regardless of which Scheduled_Date branch
  fires — restructure carefully against the live function rather than pasting this over it
  wholesale, since the original also has an `if(recordInfo.get("Wholesale_Type") == "Airport")`
  test used for `Trip_Type`/`Name` that must stay correct independent of the new date-priority
  check.)

Out of scope: Police and Hospital deal types (untouched), `Wholesale_Type` itself. No
required-field validation on the new field — optional, since TM can still adjust the time later.

**As deployed:** `createTripsFromDealsForFirstCall` matches the guideline exactly. In
`createTripForWholesale`, the `Schedule_Date_and_Time`-first check was wired into the **Local**
branch only — the **Airport** branch still always uses `Arriving_Date_Time` unconditionally,
never checking the new field. Flagged during review; the user confirmed this is intentional —
**Wholesale Airport stays flight-arrival-only**, so in practice the new field only affects First
Call and Wholesale Local, despite Andrea's brief listing Wholesale Airport as in-scope too. Also
separately confirmed via the live CRM workflow-rule trace: only Wholesale Local is actually wired
to call `createTripForWholesale` automatically ("On Create - Create Trips for Regular Trip",
condition #5, `Pipeline = Wholesale AND Wholesale_Type = Local`) — no rule was found calling it
automatically for Wholesale Airport, so the Airport branch's behavior here may rarely matter in
practice.

Confirmed deployed and tested by Andrea, passed.

### Task 5 — Intake App (NOKIntake): Case Location field
Andrea's brief (`projectDocuments/Intake App — Case Location.txt`): the Deal already has a
**Case Location** field; she wants it added to the Intake App form, positioned directly above
**Destination**, defaulting to **Mobay** unless changed.

Confirmed live (`Deals.Case_Location`, field id `6503357000001131206`) — a picklist, only 2
values:
- `Delapenha Funeral Home - 20A W. Kings House Rd., Kingston`
- `Delapenha Funeral Home - 45 Union St., Montego Bay` (the CRM API's own metadata response
  truncated this to "...Montego" for its `actual_value` — confirmed with the user this is just
  an API-response quirk, the real field value is the full "...Montego Bay")

**Widget changes (done, direct-edited):**
- `app/widget.html` — new `<select id="Case_Location">` with the 2 real Deal picklist values
  verbatim, placed immediately before the existing `wrap_DFH_Destination` row, defaulted
  (`selected`) to the Montego Bay/Mobay option.
- `app/app.js`:
  - Added `"wrap_Case_Location"` to `TOP_FIELDS`.
  - Added `"wrap_Case_Location"` to the `fields` array of every `RULES` entry that already shows
    `wrap_DFH_Destination` — `"First Call"`, `"Hospital"`, `"Police"`, `"Wholesale_Airport"`,
    `"Ship In"` — positioned right before `wrap_DFH_Destination` in each array, matching the
    field's actual DOM position set in the HTML (array order doesn't control layout, only
    show/hide, but keeping it consistent for readability). `"Wholesale_Local"` was deliberately
    **not** touched — it never shows Destination at all, so there's no "above Destination"
    position to anchor to there.
  - Added `"Case_Location": v("Case_Location")` to `buildData()`.

**Creator form guideline — `Intake_Form.ds`** (apply directly in Creator, not edited here): new
picklist field mirroring the Deal's real values exactly, plus one `dealDataMap.put` line
(unconditional — Case Location isn't scoped to specific deal types like the Schedule Date field
was):
Matches the exact shape of the form's existing `Deal_Type` picklist field:
```
Case_Location
(
	type = picklist
	displayname = "Case Location"
	maxchar = 120
	values = {"Delapenha Funeral Home - 20A W. Kings House Rd., Kingston","Delapenha Funeral Home - 45 Union St., Montego Bay"}
	initial value = "Delapenha Funeral Home - 45 Union St., Montego Bay"
	row = 1
	column = 1
	width = medium
)
```
```
dealDataMap.put("Case_Location",theForm.Case_Location);
```
Verify the insertion point in the on-submit workflow before pasting.

Confirmed deployed and tested by Andrea, passed.

### Task 6 — Transportation Module: trigger on Case Location vs Destination
Andrea's brief (`projectDocuments/Transportation Module.txt`): when a deceased's Case Location
differs from the Destination, a Transportation record should be created in CRM. She said an
existing function already does something similar and should be modified rather than rebuilt.

**v1 (built, deployed, tested, passed — then reversed by Andrea, see below):** found
`onDeceasedPickupCheckIn` (CRM automation, id `6503357000069144520`, fires from the Driver App's
Police/Hospital morgue check-in flow) already had a "Transport auto-create" block. After three
rounds of correction (each documented in earlier revisions of this ticket — the short version:
the Deal linked from a Police/Hospital pickup never carries `Case_Location`/`DFH_Destination` at
all, since `Intake_Form.ds` posts those trips/pickups straight from raw form input, bypassing
Deal creation entirely), the working v1 design added a `Destination` field to `Deceased_Pickups`,
captured `Location`/`Destination` directly from the intake form's `input.*` in `Intake_Form.ds`'s
Hospital/Police blocks, and compared `Location` vs `Destination` in `onDeceasedPickupCheckIn`.
This was deployed and confirmed working.

**Reversed by Andrea (this revision):** she came back and said the Transportation check is
**not supposed to apply to Police or Hospital cases at all** — v1's scope was backwards. It
should instead apply to **First Call, Wholesale Local, and Wholesale Airport** (not Police, not
Hospital). Confirmed with the user: fully revert the v1 Police/Hospital code, and build the real
version against the trip-creation functions for the three correct types instead.

**Step 1 — revert `Intake_Form.ds`:** remove the two capture blocks added in v1 (the
`caseLocRaw`/`childMap.put("Location"...)`/`childMap.put("Destination"...)` lines) from both the
Hospital intake block (~line 7278) and the Police intake block (~line 7570). Restore
`childMap.put("Trip",tlk);` to being followed directly by whatever came after it before v1 (the
NOK-fields handling).

**Step 2 — revert `onDeceasedPickupCheckIn`:** remove the entire "Transport auto-create
(ZP-TBD-45 Task 6)" block (the `caseLoc`/`destLoc` comparison and everything inside its `if`),
restoring the function to having no Transport-creation logic at all, right before
`if(!childUpd.isEmpty())`.

**Step 3 — optional cleanup:** the `Destination` field added to `Deceased_Pickups` in v1 is now
unused and can be deleted from that module whenever convenient — not urgent, just noise.

**Step 4 — the real fix: add the check to `createTripsFromDealsForFirstCall` and
`createTripForWholesale`.** Both already `GET` the full Deal (`recordInfo`, via
`https://www.zohoapis.com/crm/v7/Deals/` + crmid) at the top, which for these types **does**
carry `Case_Location` and `DFH_Destination` — collected directly at intake for First Call and
Wholesale Airport (Task 5), and now also for Wholesale Local (see the widget change below). Both
functions already build `tripCreationResult` via `zoho.crm.createRecord("Trips", tripMap,
{"trigger":{"workflow"}})` inside their `if(tripAvailable == false)` branch — add this right
after that line (after the existing `info tripCreationResult;`), in both functions:

```
// ZP-TBD-45 Task 6 (revised scope -- First Call / Wholesale Local / Wholesale Airport only):
// if the deceased's Case Location differs from the Destination, a Transportation record is
// needed. Idempotency keyed on Related_Trip (not Operations), since Operations record creation
// is a separate async workflow and may not exist yet at this exact moment.
caseLocRaw = ifnull(recordInfo.get("Case_Location"),"");
caseLoc = "";
if(caseLocRaw.contains("Kingston") || caseLocRaw.contains("Kings House"))
{
	caseLoc = "Kingston";
}
else if(caseLocRaw.contains("Montego") || caseLocRaw.contains("Union"))
{
	caseLoc = "Montego Bay";
}
destRaw = ifnull(recordInfo.get("DFH_Destination"),"");
destLoc = "";
if(destRaw.contains("Kingston"))
{
	destLoc = "Kingston";
}
else if(destRaw.contains("Montego") || destRaw.contains("Mobay") || destRaw.contains("Union"))
{
	destLoc = "Montego Bay";
}
if(caseLoc != "" && destLoc != "" && caseLoc != destLoc)
{
	existingTransport = false;
	try
	{
		tQuery = Map();
		tQuery.put("select_query","select id from Transport where Related_Trip = '" + tripCreationResult.get("id") + "' and Category = 'Deceased' limit 1");
		tResp = invokeurl
		[
			url :"https://www.zohoapis.com/crm/v7/coql"
			type :POST
			parameters:tQuery.toString()
			headers:{"Content-Type":"application/json"}
			connection:"zohooauth"
		];
		if(tResp.containKey("data") && tResp.get("data").size() > 0)
		{
			existingTransport = true;
		}
	}
	catch (eTCheck)
	{
	}
	if(!existingTransport)
	{
		transportMap = Map();
		transportMap.put("Name","Deceased Transport: " + recordInfo.get("Account_Name").get("name"));
		transportMap.put("Category","Deceased");
		transportMap.put("Transport_Status","Requested");
		transportMap.put("Current_Location",caseLoc);
		tripLkT = Map();
		tripLkT.put("id",tripCreationResult.get("id"));
		transportMap.put("Related_Trip",tripLkT);
		try
		{
			zoho.crm.createRecord("Transport",transportMap);
		}
		catch (eTCreate)
		{
		}
	}
}
```

This block is identical in both functions. In `createTripForWholesale` it goes once, after the
shared `tripCreationResult` line (applies to both the Airport and Local branches, since both
converge on that same trip-creation call).

**Step 5 — widget change (done, direct-edited):** Wholesale Local's intake form previously
showed neither Case Location nor Destination at all (it never displayed `wrap_DFH_Destination`),
so there was nothing to compare for that type. Added both `wrap_Case_Location` and
`wrap_DFH_Destination` to the `"Wholesale_Local"` `RULES` entry in
`widgets/NOKIntake/NOKIntake/app/app.js`, matching how every other in-scope type already shows
both fields.

**Scope (confirmed with the user):** First Call, Wholesale Local, Wholesale Airport only. Police
and Hospital explicitly excluded per Andrea's correction — v1's Police/Hospital-only mechanism
is fully reverted, not left running alongside the new one.

Not yet applied — pending the user reverting the v1 `.ds`/`onDeceasedPickupCheckIn` code and
pasting the new block into `createTripsFromDealsForFirstCall` and `createTripForWholesale`, then
testing: (1) First Call/Wholesale Local/Wholesale Airport with Case Location ≠ Destination →
expect a Transport record; (2) same with them equal → expect none; (3) a Police or Hospital case
with a mismatch → expect **no** Transport record (confirms the revert actually took).
