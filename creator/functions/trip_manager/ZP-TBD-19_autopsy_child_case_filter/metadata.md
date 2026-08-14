Task ID: ZP-TBD-19 (placeholder)
Zoho App: Creator (Trip Manager widget)
Function: fetchTrips(string category, string status, string location) — Trip_Manager.ds
Trigger Source: widget.html "Autopsy" nav tab / view (data-view="Autopsy")
Related Fields: Trips.Parent_Trip, Trips.Trip_Type
Related Modules: Trips
Created By: Claude Code, 2026-08-14
Production Deployed: No — guideline only, not applied to the live .ds (never edit Creator
.ds files directly — see repo hard rule)

## Andrea's report (2026-08-14, Task #3)
"TM is not displaying the child autopsy cases in the view [correctly] — this broke on the
recent release. The only autopsy case that should be showing in TM is the one that has all
of the deceased attached to it. The other ones are supposed to be filtered out by the
widget/UI. The widget was updated by me only for new dashboards so your repo is stale — you
have to download a fresh version for your repo before you fix this. This should be a very
quick fix."

Andrea separately confirmed she'd already refreshed the local `tripManagerApp` files from
live herself, so this fix was written directly against her latest copy (Trip_Manager.ds /
app/widget.html as of 2026-08-14), not the stale repo copy.

## Background
A "Multi Deceased Autopsy Trip" is one vehicle dispatch record covering several deceased at
once. Each individual deceased also gets their own per-person "Autopsy Initial" Trip record,
linked back to the shared dispatch record via `Parent_Trip`. Only the parent record (the one
"that has all of the deceased attached to it") is meant to show in Trip Manager's Autopsy
view — the per-deceased children are internal billing/tracking records, not something staff
should be scheduling or dispatching individually.

Single-deceased autopsy cases (no Multi Deceased parent involved at all) never have a
Parent_Trip set, so this rule does not affect them — they should keep showing exactly as
before.

## Root cause
In `fetchTrips`, the "Autopsy" category criteria (line ~339) is:
```
extraCrit = extraCrit + "and(Trip_Type:in:Autopsy Initial,Autopsy Reschedule,Multi Deceased Autopsy Trip)";
```
This matches Trip_Type only — it has no awareness of Parent_Trip at all, so both the parent
"Multi Deceased Autopsy Trip" record AND every per-deceased "Autopsy Initial" child record
(Trip_Type is ALSO "Autopsy Initial" on the child) match and get returned together.

Confirmed there is no `Parent_Trip` exclusion anywhere else in either `Trip_Manager.ds` or
`app/widget.html` — searched both files fully, zero matches outside one unrelated dispatch
function (`childCriteria2` at Trip_Manager.ds:2792, which is Trip Manager's OWN dispatch
detail view intentionally fetching a parent's children, not the main Autopsy list). The
Zoho CRM Search Records API used here (`v6/Trips/search`) also does not support an
"is empty" criteria operator for lookup fields, so this cannot be fixed in the `criteria`
string alone — it needs a client-side (Deluge) filter after the records come back, exactly
like the existing `DO NOT SCHEDULE` / `Completed` filtering already does a few lines later.

This is very likely what "broke on the recent release" — either this exclusion existed
before as a small piece of logic that got dropped while Andrea was reworking the widget for
the new dashboards, or it was never there and simply went unnoticed until enough
multi-deceased police/hospital cases accumulated to make the duplicate children visible.

## Round 2 (2026-08-15) -- Edit 2 was broken, root cause found
User deployed both edits live. Test failed: child trips still showing (see test matrix,
"D. Trip Manager -- Autopsy child-case filter" row -- fail, "child trip is showing in TM").

**Root cause:** `Trips.Parent_Trip` is a **plain TEXT field**, not a lookup -- confirmed via
`ZohoCRM_getFields` on Trips (`api_name: Parent_Trip, data_type: text`). The original Edit 2
assumed it was a lookup and called `tr.get("Parent_Trip").containKey("id")`, which throws
when `Parent_Trip` is actually a String -- and that exception was silently swallowed by the
`try/catch` wrapped around it, so `keepIt` never flipped to `false` and nothing was ever
excluded. This is exactly why the fix compiled/deployed fine but did nothing at runtime.

**Fix:** check the text field directly instead of treating it as a Map. See the corrected
Edit 2 below (replaces the version further down in this file).
```
	if(keepIt && category == "Autopsy")
	{
		ptVal = "" + ifnull(tr.get("Parent_Trip"),"");
		if(ptVal.trim() != "")
		{
			keepIt = false;
		}
	}
```
No try/catch needed here since `tr.get("Parent_Trip")` on a text field never throws --
`ifnull` + string-coercion handles a missing/null value safely on its own.

## Fix (two small edits to `fetchTrips` in Trip_Manager.ds)

**Edit 1 — request the field.** `Parent_Trip` is not in the `fields` list the search API is
asked for, so `tr.get("Parent_Trip")` would always be empty even if we tried to check it.
Around line 409-411, change:
```
fields = "id,Name,Trip_Type,Trip_Status,Scheduled_Date,Departure_Time,";
fields = fields + "Vehicle,Amber_Vehicle,Rental_Vehicles,Driver,Attendant,Attendant_NEW,Deal,Deceased_Names_Summary,";
fields = fields + "Created_Time,Completion_Time,Hospital_Name,Autopsy_Location,Funeral_Time_Change_Alert";
```
to:
```
fields = "id,Name,Trip_Type,Trip_Status,Scheduled_Date,Departure_Time,";
fields = fields + "Vehicle,Amber_Vehicle,Rental_Vehicles,Driver,Attendant,Attendant_NEW,Deal,Deceased_Names_Summary,";
fields = fields + "Created_Time,Completion_Time,Hospital_Name,Autopsy_Location,Funeral_Time_Change_Alert,Parent_Trip";
```

**Edit 2 — filter out children in the existing post-fetch `keepIt` loop.** Around line
608-623, the function already builds `activeTrips` from `rawTrips` with a `keepIt` flag
(this is where `DO NOT SCHEDULE` and stale `Completed` trips already get dropped). Add the
child-autopsy exclusion right after the existing `trStatus` check, before the
`locationActive` block:
```
activeTrips = List();
for each  tr in rawTrips
{
	keepIt = true;
	trStatus = "" + tr.get("Trip_Status");
	if(trStatus == "DO NOT SCHEDULE")
	{
		keepIt = false;
	}
	else if(trStatus == "Completed")
	{
		if(!completedTodaySet.containKey("" + tr.get("id")))
		{
			keepIt = false;
		}
	}
	// ZP-TBD-19 fix: a per-deceased Autopsy Initial child trip (has Parent_Trip set)
	// should never show on its own in the Autopsy view -- only the shared
	// "Multi Deceased Autopsy Trip" parent (or a genuine single-deceased Autopsy
	// Initial trip, which never has a Parent_Trip) should appear.
	if(keepIt && category == "Autopsy")
	{
		try
		{
			ptMap = tr.get("Parent_Trip");
			if(ptMap != null && ptMap.containKey("id"))
			{
				keepIt = false;
			}
		}
		catch (ePt)
		{
		}
	}
	if(keepIt && locationActive)
	{
		...  // unchanged, rest of the existing loop
```

That's the whole fix — no other function or view is touched. The exclusion is scoped to
`category == "Autopsy"` specifically, so it cannot affect the Pickups/Funerals/Transfers
views or the Dispatch Board's own child-trip lookups (which intentionally want the children).

## Deploy / test
- [ ] Paste Edit 1 and Edit 2 into the live `fetchTrips` function in Trip_Manager.ds
- [ ] Open Trip Manager, Autopsy tab, on a day with a known multi-deceased autopsy case —
      confirm only ONE row shows for that dispatch (the parent), not one row per deceased
- [ ] Confirm a genuine single-deceased autopsy case (no Multi Deceased parent involved)
      still shows normally — Edit 2 must not affect it since it has no Parent_Trip
- [ ] Confirm the Dispatch Board / trip detail child-trip view (the one at
      Trip_Manager.ds:2792, `childCriteria2`) still shows children correctly when a
      dispatcher opens the parent trip's details — that logic is untouched by this fix
