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
  "Deceased loaded" (`repatRow` reused as-is). Both must be checked to enable Start Trip
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

**Deluge guideline — new Creator custom API `Complete_Crematory_Dropoff`** (POST). Mirrors the
existing `Save_Complete_Job`/`Save_Start_Job` pattern already used by every other flow in this
app. Resolves the Operations record the same way the app's other trip-linked saves do — via
`Related_Trip` on Operations matched to the trip id (same relationship already exposed elsewhere
as `operations_id` in trip/pickup rows, e.g. the Hospital/Autopsy batch flows):

```deluge
// Complete_Crematory_Dropoff -- Creator custom API, POST
// input: tripId, funeralHomeName, receivingAttendant, pickupItems, completionTime
response = Map();
tripId = input.tripId;
funeralHomeName = input.funeralHomeName;
receivingAttendant = input.receivingAttendant;
pickupItems = input.pickupItems;
completionTime = input.completionTime;

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
	zoho.crm.updateRecord("Operations",opsId,opsUpdate);
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
zoho.crm.updateRecord("Trips",tripId,tripUpdate);

response.put("status","success");
return response;
```

Before wiring this up live: confirm `Related_Trip` on Operations is actually how existing trips
resolve their `operations_id` elsewhere in this app (the Hospital Storage / Autopsy batch flows
already surface `operations_id` per trip/pickup row from some existing Deluge function) — pull
that function's source first and reuse its exact resolution logic instead of assuming
`Related_Trip:equals` is correct, in case it's actually keyed off `Related_Deal` or a different
relationship.

Not yet tested live — pending the 3 Operations fields + `Complete_Crematory_Dropoff` custom API
being created in Creator, then republish + Andrea walking a real Crematory Dropoff trip
end-to-end.
