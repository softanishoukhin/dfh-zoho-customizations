# Widget JS changes -- Trip Manager (app/widget.html)

Not a `.ds` file -- edited directly in the local repo
(`d:\Office\Andrea_Projects\DFH\widgets\tripManagerApp\app\widget.html`), per the project's
Creator-.ds-only guideline rule. This file documents what changed, for reference.

## Sidebar

New "Transports" sidebar-section, separate from "Trip Views" and "Tools", with a single
`data-tool="transports"` nav-item -- per the requirement that Transports be its own left-hand
menu item, not folded into the trip filters or the Tools list.

## New "Transports" panel (view-header-transports / content-transports)

Third view alongside the existing Trips and Calendar views, following the exact same
show*View() toggle pattern already used for Calendar (`showTripsView`/`showCalendarView` were
both updated to also hide/show the third pair, since they previously only knew about each
other).

- Filter pills: All / Needs Assignment / Assigned / Completed (client-side filter over one
  `getAllTransportItems` fetch, not separate server calls per filter).
- "+ New Transport Item" toggles an inline create form (name, category, current location,
  additional info) -- calls the new `createTransportItem`.
- Each row shows: name, category, assigned trip name (or "Not assigned to a trip" in italic,
  so unassigned items are easy to spot at a glance per the requirement), leg (if assigned), and
  a real status pill (Needs Assignment / Assigned / Completed) instead of a hardcoded value.
- Scheduled (not yet Completed) items get a "Remove from trip" button -> calls
  `unassignTransportItem`. Completed items don't get one (matches the backend's refusal to
  unassign a Completed item).

## Per-trip transport section (inside renderDetail)

Previously hard-gated on `t.Trip_Type === "Multi Deceased Autopsy Trip"` -- that gate is
removed; this section now renders on every trip.

- "+ Add Transport Item" toggles the picker open (lazy-loads on first open, not on every trip
  render, since it's now shown everywhere instead of one trip type).
- The picker still buckets available (Requested-status) items by `Current_Location`
  (Kingston/Mobay) exactly as before -- per the confirmed decision that Current_Location stays
  a separate, informational concept, not replaced by the leg model.
- Each available item now gets TWO buttons, "+ Pickup Leg" and "+ Dropoff Leg", instead of one
  "Assign" button -- calls `assignTransportItem` with the corresponding `leg` value.
- Below the picker, two side-by-side boxes: "Pickup Leg" and "Dropoff Leg", each showing the
  items currently assigned to that leg (via `getTripTransportItems`, filtered client-side by
  `r.leg`), with a real status indicator (Scheduled vs Completed) and a remove (×) button on
  Scheduled ones only.

## Also fixed in passing

`transportColumn()`'s header markup had a pre-existing typo (`'<\div><div ...'` instead of
`'</div><div ...'`) that would have rendered as literal text instead of closing the header div
correctly. Fixed as part of rewriting this function (it was already being touched for the leg
changes) -- not a Transports-feature change, just cleanup of code already being replaced.

## API map additions

```js
"unassignTransportItem":{ name: "Unassign_Transport_Item", method: "POST" },
"getAllTransportItems":{ name: "Get_All_Transport_Items", method: "GET"  },
"createTransportItem": { name: "Create_Transport_Item", method: "POST" },
```
(`getTransportItems`, `assignTransportItem`, `getTripTransportItems` already existed in the map
-- only `assignTransportItem`'s call-site payload changed, to add `leg`.)
