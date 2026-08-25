# ZP-TBD-43 — Burial Schedule report: freeze the column-header row on scroll

Requested by Andrea: on the Burial Schedule report in Trip Manager, the top pane with the
column labels (Deceased / Casket / Church-Chapel / Place of Internment / Departure / Funeral /
Hearse) should stay visible ("frozen") once you scroll down through the list, instead of
scrolling off screen with the rows.

## What was tried first (didn't work) — CSS `position:sticky`

The Burial Schedule table already had `#content-analytics th{position:sticky;top:0}` (shared
by every `.dtbl-wrap` report table in Analytics). Two real CSS bugs were found and fixed along
the way, and neither one fixed the actual symptom:

1. `.dtbl-wrap{overflow-x:auto}` with no `overflow-y` set implicitly computes `overflow-y:auto`
   too (CSS spec quirk), turning the wrapper into its own unintended vertical scroll box and
   making it the sticky containing block instead of the real scroll pane. Fixed by adding
   `overflow-y:visible` explicitly.
2. `#content-analytics table{border-collapse:collapse}` is a known cause of `position:sticky`
   silently failing on `<th>` in several browser/webview engines. Fixed by switching to
   `border-collapse:separate;border-spacing:0`.

Both fixes are correct and were kept, but the header still didn't freeze after either — and
after confirming with Andrea via DevTools that `#an-body` genuinely is the scrolling container
(ruling out an iframe/auto-height issue), it was clear native `position:sticky` on `<th>` is
just not reliably honored inside this widget's embedded runtime at all, regardless of correct
CSS. (The codebase already has precedent for this exact class of problem — the horizontal
top-scrollbar sync for these same tables, `#an-btop`/`#an-bspacer`, exists because native
horizontal scrollbars weren't behaving reliably here either.)

## Actual fix — JS-driven frozen header (not CSS sticky)

Added `setupFrozenHead(wrap)` / `teardownFrozenHead()` in `Trip_Manager.ds`'s widget script
(`app/widget.html`), scoped to the Burial Schedule table only (`#an-bwrap`):

- On `renderBurial()`, clones the real `<thead>` into a separate `position:fixed` table appended
  inside `#content-analytics` (so the existing `#content-analytics th` / `#content-analytics
  table` scoped CSS still styles it — an earlier draft appended it to `document.body` instead,
  which rendered it with no styling at all; caught and fixed the same day, see widget-js-
  changes.md).
- On every scroll of `#an-body` (and the table's own horizontal scroll, and window resize),
  measures the real header's pixel position and per-column widths and repositions/re-widths the
  clone to match exactly, showing it only once the real header has scrolled above the visible
  top of the pane and the table itself hasn't fully scrolled past.
- Mirrors horizontal scroll via `transform:translateX(-scrollLeft)` so column alignment holds if
  you scroll the table sideways too.
- Torn down (listeners removed, clone removed) when leaving the Burial Schedule view or closing
  the Analytics panel, so it can't get left floating over other screens.

See `widget-js-changes.md` for the actual before/after code.

## Scope

Deliberately scoped to Burial Schedule only, not applied to every `.dtbl-wrap` report table in
Analytics — this is real per-table JS wiring (not a one-line CSS rule), so it was kept narrow to
what Andrea actually asked for. If other report tables need the same treatment later, the
`setupFrozenHead`/`teardownFrozenHead` functions are written generically enough (they take the
wrap element as a parameter) to be reused elsewhere with minimal changes.

## Status

**Applied and confirmed working** — edited directly in `app/widget.html` (per project
convention: widget JS/HTML is safe to edit directly, unlike `.ds` files), rebuilt, republished,
and confirmed fixed by Andrea/the user in-app.
