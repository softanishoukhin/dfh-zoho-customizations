# ZP-TBD-46 — Pre-Visit trips showing up in Trip Manager

**Reported by Andrea (2026-08-29):** "Pre visit trips still showing up in TM app."

## Root cause

`automation.createTripForPreVisit` creates these trips with `Trip_Type = "Pre-Visit"`
(hyphenated). Trip Manager's `fetchTrips` function only applies a `Trip_Type` filter for four
specific category tabs (Funerals, Pickups, Autopsy, Transfers). The **default view is `"All"`**
(`state.category = "All"` in `app/widget.html`), which falls through the `if/else if` chain with
no `Trip_Type` restriction applied at all — so Pre-Visit trips always showed there. The widget's
client-side `categoryOf()` also has no branch for `"Pre-Visit"` and silently mislabels any it
does see as `"Pickup"`.

Confirmed live that `createTripForPreVisit` is actively firing (`last_executed_time` the same
day this was reported), via workflow "Create Trip on Input Family Visit Date"
(id `6503357000006096219`), triggered on `Deals.Pre_Visit_Viewing_Date` field-update.

Andrea's answer: Pre-Visit trips should be excluded from Trip Manager entirely, not given their
own tab.

## Fix — applied live, confirmed by the user (2026-08-29)

In `fetchTrips` (Trip_Manager.ds), one line added right after the existing
`if(category == "Funerals") ... else if ... else if ... else if(category == "Transfers") { ... }`
chain, before `if(status == "Scheduled")`:

```deluge
extraCrit = extraCrit + "and(Trip_Type:not_equal:Pre-Visit)";
```

All four query branches in `fetchTrips` (Today, upcoming/all-future, no-scheduled-date,
completed-today) reuse the same `extraCrit` string built once at the top of the function, so
this single line covers every view. Redundant-but-harmless on the four category tabs that
already implicitly exclude `Pre-Visit` (their own `Trip_Type` lists never included it) — the
actual gap was only the unfiltered `"All"` view.

**Status: applied and confirmed live by the user.**
