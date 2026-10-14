# ZP-TBD-106: Trip Manager. Hide per-deceased autopsy child trips in every view

**Status:** written 2026-10-08 against the Trip_Manager.ds export taken 2026-10-08 10:10. Not applied.

Part of ZP-TBD-106 (CRM side: `crm/functions/trips/ZP-TBD-106_autopsy_grouping_operations_lookup/`).

## Problem

In **All Trips**, each deceased's own "Autopsy Trip" showed as a separate card next to the shared
"Autopsy Trip 2026-10-07" card (Andrea's screenshot, 2026-10-08). Those per-deceased trips are normally hidden
because their status is DO NOT SCHEDULE. Once the shared trip is started, the "Cascade Autopsy Parent Status" rule
copies **Started** onto them, so the status filter no longer hides them.

The filter that should catch them (`fetchTrips`, ZP-TBD-19) had two defects:

1. It only ran when the **Autopsy** category was selected, not in **All**.
2. It read `Parent_Trip` as a lookup (`ptMap.containKey("id")`). `Parent_Trip` is a **text** field that holds the
   parent's id, so the call threw, the empty `catch` swallowed it, and the child was kept.

## Change: Creator > Trip Manager > Functions > `fetchTrips`

One block only, about 20 lines below `activeTrips = List();`.

**Find:**

```
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
			}			catch (ePt)
			{
			}
		}
```

**Replace with:**

```
		// ZP-TBD-106: a per-deceased Autopsy Initial child trip (has Parent_Trip set) never shows
		// on its own in ANY view -- only the shared "Multi Deceased Autopsy Trip" parent does.
		// Parent_Trip is a TEXT field holding the parent id (not a lookup), so read it as a plain
		// value. (The old ptMap.containKey("id") threw on a text value and the catch kept the child.)
		if(keepIt)
		{
			ptVal = "";
			try 
			{
				ptVal = ifnull(tr.get("Parent_Trip"),"") + "";
			}			catch (ePt)
			{
				ptVal = "";
			}
			if(ptVal != "" && ptVal != "null")
			{
				keepIt = false;
			}
		}
```

`Parent_Trip` is already in the `fields` list that `fetchTrips` requests (`...Funeral_Time_Change_Alert,Parent_Trip`),
so nothing else needs to change. Save the function. No widget (`widget.html`) change.

## Check

- All Trips, Today: a started shared autopsy trip shows as **one** card. The per-deceased "Autopsy Trip" cards no
  longer show in any category (All / Autopsy / Today / Needs Vehicle / Needs Driver / Scheduled).
- A single-deceased autopsy trip that was never grouped (no Parent_Trip) still shows as before.

## Rollback

Put the **Find** block back.
