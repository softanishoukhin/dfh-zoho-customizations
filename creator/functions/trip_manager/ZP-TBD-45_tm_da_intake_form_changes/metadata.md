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
- **`app/lib/xlsx.full.min.js`** (SheetJS) — new `exportDailyReportExcel()` builds a real `.xlsx`
  file: header row frozen (`ws["!freeze"]`), day-groups as merged full-width rows, autofilter,
  sensible column widths. Since it's a real Excel file, Andrea has full control over Excel's own
  print/page-setup from there, which sidesteps the same shrinking problem a second, independent
  way.
- The existing "Print" button is reused for the PDF export specifically on the Daily Funeral
  Report view (relabeled "Export PDF" there); it's untouched everywhere else (Burial Schedule,
  Driver Sheet Detail still use the normal browser print dialog, since only the Daily Funeral
  Report was reported as a problem). A new "Export Excel" button sits next to it, visible only on
  the Daily Funeral Report view.

Not yet tested live (needs a real render to confirm PDF/Excel output visually) — pending
Andrea's test.
