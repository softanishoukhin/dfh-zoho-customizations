Task ID: ZP-TBD-21 (placeholder)
Zoho App: Creator (Driver App + Trip Manager widgets)
Modules: Trips
Reported by: user, 2026-08-17 -- screenshot of Marva Stewart funeral trip showing
"Last updated by dfhmorguem@gmail.com · 2026-08-12" in Trip Manager's dispatch detail
panel, despite the trip already showing "Started" -- i.e. the last-updated info is stale
and doesn't reflect the driver's own action.

## Two separate issues found

### 1. "Last updated by" (App_Modified_By) does not reflect driver actions -- root cause found, NOT fully fixed
`App_Modified_By` on Trips is written by exactly one function, `setTripUpdatedBy` (Creator
Custom API `Set_Trip_Updated_By1`, called by the Driver App's `daStampTrip(tripId)` helper
in app.js). Read by Trip Manager's dispatch detail panel via `getTripUpdatedBy`
(`Get_Trip_Updated_By`).

**The Driver App already calls `daStampTrip()` after every start and complete action**
(`startFuneralTrip`, `apStartTrip`, `startCurrentJob`, `autopsyStartTrip`, and the various
complete-job paths all call it on success) -- this is not a missing call, it already
exists in app.js. So the mechanism to keep "Last updated by" current on driver actions was
already built.

**Why it's going stale anyway:** `daStampTrip` was fire-and-forget with BOTH the success
and failure branches empty:
```js
callApi('Set_Trip_Updated_By1', 'POST', { tripId: tripId, name: daAuthor() }).then(function(){}, function(){});
```
If the `Set_Trip_Updated_By1` Custom API call fails for any reason -- not published, a
param mismatch, a transient error, `daAuthor()` returning empty because driverName/
loginEmail weren't populated yet at that point in the session -- nothing surfaces
anywhere. The driver sees "Trip started" either way. This is consistent with what the
user saw: a trip clearly Started, but the stamp stuck on the prior manual Trip-Manager
edit from days earlier.

**Fixed (app.js, direct edit per house rule -- workspace copy confirmed current):**
`daStampTrip` now logs to console on both a non-success result and an outright failure,
so a silent stamp failure is at least diagnosable going forward, without disrupting the
driver's flow (no alert/block added -- this stays best-effort, matching its original
design intent).

**NOT fixed -- needs a live check the connector can't do:** whether `Set_Trip_Updated_By1`
is actually a valid, published Creator Custom API pointed at `setTripUpdatedBy` with
matching param names (`tripId`, `name`). No available tool lists Creator Custom APIs.
**Guideline: check this directly in Zoho Creator** -- Application > Settings (or the app's
Custom API section) > confirm `Set_Trip_Updated_By1` exists, is published/live, and its
mapped function + parameter names match `Driver_App.ds`'s `setTripUpdatedBy(String
tripId, String name)`. If it's missing/unpublished/misconfigured, that is almost
certainly the actual root cause of the stale timestamp, and the console.error added above
will confirm it the next time a driver starts or completes a trip (open DevTools console
on the Driver App during a live test).

### 2. Dispatch board funeral cards didn't show a "Started" timestamp -- FIXED
The Analytics dashboard's drill-down modal already showed both "Started (app)"
(Departure_Time) and "Completed (app)" (Completion_Time) correctly -- that side was never
broken. The dispatch board's card view (`buildCard` in widget.html) only ever showed a
"Done <Completion_Time>" line when a trip was fully Completed; there was no equivalent
line for a trip that's Started but not yet done, and no Started-time shown even after
completion.

**Fixed (widget.html, direct edit):** funeral-category cards now show:
- "Started `<Departure_Time>`" while `Trip_Status === "Started"` (in progress, not yet
  done).
- Once Completed, both "Started `<Departure_Time>`" and "Done `<Completion_Time>`" show
  together, so the full start-to-finish timeline is visible on the card, not just in the
  detail panel.
- Scoped to `cat === "funeral"` only, per the user's request -- other trip categories
  unchanged.

Data was already being fetched (`Departure_Time` and `Completion_Time` are both in
`fetchTrips`'s field list, Trip_Manager.ds line 409) -- this was a display-only gap, not
a missing-data problem.

## Deploy
1. `app.js` and `widget.html` changes are already applied directly to the live workspace
   copies (per [[feedback_widget_js_html_direct_edit]]) -- no separate paste-in-place step
   needed, unlike .ds functions.
2. **User to verify in Zoho Creator:** confirm the `Set_Trip_Updated_By1` Custom API is
   published and correctly wired. Then do a live test: start a funeral trip as a driver,
   confirm (a) the dispatch card shows "Started <time>" immediately, and (b) the trip
   detail panel's "Last updated by" updates to the driver's name/time, not the old
   Trip-Manager stamp. If (b) still doesn't update, check the browser console for the new
   `daStampTrip` error logs to see exactly what's failing.
