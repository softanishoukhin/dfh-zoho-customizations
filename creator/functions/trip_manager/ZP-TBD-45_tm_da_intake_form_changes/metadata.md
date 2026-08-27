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
