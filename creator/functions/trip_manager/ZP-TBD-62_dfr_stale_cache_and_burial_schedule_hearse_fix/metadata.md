Task ID: ZP-TBD-62
Zoho App: Creator (Trip Manager widget + Trip_Manager.ds)
Reported by: user, 2026-09-08 -- "moving between reports does not refresh the information" +
"even after a refresh, the Burial Schedule does not show the hearses"

## 1. Daily Funeral Report / Tools tabs showing stale data after an All Trips edit -- FIXED (direct edit, widget.html)

Reported: pull up the Daily Funeral Report, go back to All Trips, edit a trip's hearse/
driver/departure time and save, return to the Daily Funeral Report -- the edit does not
show until Trip Manager is closed/reopened or its refresh button is hit. Also affects the
other Tools/analytics tabs (Overview, Unscheduled, Scheduled, Driver Adoption, Burial
Schedule) the same way.

**Root cause:** the Tools/analytics subsystem caches its data behind "have I loaded this
at all" flags, not a freshness check -- `loaded` gates the shared Overview/Burial dataset
fetch (`ensureLoaded()`), `dfrKey` gates the Daily Funeral Report's fetch keyed by date
range (`loadDailyReport()`/`renderDailyReport()`). All Trips' "Save Assignment" button
(`doSave()`) only ever refreshed its own list (`loadTrips()`) -- it never touched these
flags, so navigating back into any Tools tab just re-rendered whatever was cached from
the last time that tab loaded, silently ignoring the edit. Only a full widget reload
resets `loaded`/`dfrKey` back to their initial unset state.

**Fix (`app/widget.html`, `doSave()`):** on a successful save, clear `loaded = false;
dfrKey = "";` right alongside the existing `loadTrips()` call. This does not force an
immediate re-fetch (so bouncing between Tools tabs stays fast) -- it just makes sure the
NEXT time any of those tabs is opened, it fetches fresh data instead of reusing what was
cached before the edit.

Applied directly to the live workspace copy of `tripManagerApp/app/widget.html` (per
[[feedback_widget_js_html_direct_edit]]). No `.ds` change for this part.

## 2. Burial Schedule not showing manually-assigned hearses -- CORRECTS ZP-TBD-24 part 2

ZP-TBD-24 (2026-08-18) already root-caused and wrote a guideline for this exact symptom
(`getBurialSchedule` only reading `Deals.Hearse`, never the Funeral trip's own `Vehicle`/
`Amber_Vehicle`/`Rental_Vehicles`), logged as "guideline provided, not deployed." This
session the user confirmed that guideline WAS deployed to the live `getBurialSchedule` --
but the symptom was still live. Live debugging (real CRM data + three rounds of
temporary in-function debug instrumentation, output surfaced directly in the Hearse
column) found the ZP-TBD-24 fix itself had **two separate bugs**, neither of them a
deployment problem:

**Bug A -- COQL WHERE clause needs bracket grouping.** The new Trips sub-query combined
two conditions with a flat `and`:
`where Deal in (...) and Trip_Type = 'Funeral'`. Per Zoho's COQL docs (and per the
existing rule in [[feedback_creator_customapi_method_and_coql_brackets]]), COQL requires
every multi-condition WHERE to be bracket-grouped, unlike Deluge's other criteria
syntaxes. The un-bracketed query threw on every call, was silently swallowed by the
surrounding `catch(eTrips){}`, and `vehByDeal` never got a single entry.
Fix: `where (Deal in (...) and Trip_Type = 'Funeral')`.

**Bug B -- `isNull()` is unreliable on a Map from an `invokeurl`/COQL JSON response.**
After fixing Bug A, live debug output proved the Trips query now succeeded (real rows
came back, including the exact record needed -- Deal "Bryan Nembhard", Trip `Vehicle:
{"name":"Delapenha Black Hummer","id":"..."}`) -- yet `vehByDeal` was STILL empty. Adding
debug output around the extraction (`if(!isNull(vLk)){ vehName = vLk.get("name"); }`)
proved `isNull(vLk)` returned the literal value `null`, not a real boolean, on this
Map -- `zoho.crm.getRecordById`/`searchRecords` results apparently don't have this
issue, but a Map decoded from a raw `invokeurl` HTTP response body does. Since
`!isNull(vLk)` never evaluated true, the `if` branch never ran and `vehName` silently
stayed `""` for every trip regardless of what `Vehicle` actually held -- with no
exception anywhere to reveal it. Calling `.get("name")` directly (no `isNull()` guard)
was proven to work perfectly on the same value in the same debug session.
Fix: removed the `isNull()` guard on all three vehicle-lookup reads (`Vehicle`,
`Amber_Vehicle`, `Rental_Vehicles`); each now calls `.get("name")` directly inside its
existing `try/catch`, which already correctly handles a genuine null (proved live --
`Amber_Vehicle`/`Rental_Vehicles` were genuinely null on the same test record and threw
no exception).

**Fix file:** `getBurialSchedule_FIX_v2.deluge`, this folder -- the complete function,
both bugs corrected, all temporary debug instrumentation removed. This supersedes the
`getBurialSchedule_FIX.deluge` guideline from ZP-TBD-24 (part 2) -- that guideline's
*intent* (fall back to the TM-assigned vehicle) was correct, its implementation had the
two bugs above.

**Confirmed live** (2026-09-08): after deploying this version, Bryan Nembhard's Burial
Schedule row shows "Delapenha Black Hummer" (previously blank).

Related memory: [[feedback_creator_customapi_method_and_coql_brackets]] (updated with the
`isNull()` finding as a third gotcha).
