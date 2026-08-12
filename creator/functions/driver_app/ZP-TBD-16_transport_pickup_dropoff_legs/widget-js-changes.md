# Widget JS changes -- Driver App (app/app.js)

Not a `.ds` file -- edited directly in the local repo
(`d:\Office\Andrea_Projects\DFH\widgets\driverApp\driverApp\app\app.js`), per the project's
Creator-.ds-only guideline rule.

## New shared functions (added after restoreChecklistState, ~line 1289)

- `loadTripTransportItems(tripId)` -- calls Get_Trip_Transport_Items1, splits the response by
  `leg` into Pickup/Dropoff, renders each into a given container via renderTransportLegList.
- `renderTransportLegList(containerId, items, extraOnchange)` -- renders one leg's items as
  real checkboxes (`data-transport-id`, NOT a DOM `id` -- deliberately excluded from
  persistChecklistState()'s generic id-based sweep, see the comment block in the code). Checked
  state reflects `Transport_Status === "Completed"` fresh from the fetch every time. Optional
  third arg names a global function to also call on every checkbox change (used by the autopsy
  screen to re-run its Start Trip gate check, same as it always did for "Deceased loaded").
- `allTransportItemsChecked(containerId)` -- true if every checkbox in a container is checked
  (or if there are none), used for gating.
- `window.toggleTransportItemComplete(checkboxEl)` -- reads `data-transport-id`, calls the new
  Set_Transport_Item_Status, reverts the checkbox and shows an error (via `osShowError` where
  available) on failure.

## Where it's wired in

Every DA trip-detail render function now shows its trip's transport items, per leg, using the
same shared helpers throughout (`loadTripTransportItems`, `renderTransportLegList`,
`allTransportItemsChecked`, `window.toggleTransportItemComplete`). All of these are informational
displays (checking an item off saves straight to the CRM Transport record, per-item, immediately)
except the one place that already had pre-existing gating behavior to preserve (item 2 below).

1. **renderJobDetail's on-scene ("Started") branch** -- the general-purpose trip detail screen
   used for First Call / any trip type not covered by a more specific flow. "Transport Items"
   box, right after the existing On Scene box, with two sub-lists (Pickup / Dropoff), populated
   via `loadTripTransportItems(t.id)`.
2. **paintAutopsyStart (Multi Deceased Autopsy Trip, pre-start "Load the car" screen)** -- the
   OLD single aggregate "Transport items loaded" checkbox (with a read-only bullet list under
   it) is REMOVED. Replaced with the same per-item checklist (Pickup-leg items only, since
   "load the car" = the trip's pickup leg), via `renderTransportLegList(...,
   'autopsyLoadGateCheck')`. `autopsyLoadGateCheck()` requires Deceased-loaded AND every
   rendered transport item checked (via `allTransportItemsChecked`), instead of the old single
   `#autopsy-chk-sup` flag. This is the one screen where transport-item completion gates
   Start Trip -- preserving the old aggregate checkbox's gating behavior, item-by-item now
   instead of one flag.
3. **renderAutopsyBatchInner** (Multi Deceased Autopsy Trip, on-scene per-deceased-body
   disposition screen) -- Dropoff-leg-only box (`transport-list-dropoff`), added right after the
   chips and before the per-body cards. Informational, does not gate Complete Trip.
   `loadTripTransportItems` is called once after each `$('#detail-body').html(html)`, including
   the repeated re-renders `autopsyLoadBios` triggers as bios load progressively -- an extra
   fetch on each of those re-renders was judged an acceptable, low-volume cost rather than adding
   extra state to skip it.
4. **renderAirportPickup** (Ship-In/Wholesale Airport Pickup, pre-start) -- Pickup-leg box.
5. **renderAirportCheckin** (Airport Pickup, on-scene facility check-in) -- Dropoff-leg box.
6. **renderRepatriationStart** (Airport Dropoff/Repatriation, pre-start "before leaving the
   office") -- Pickup-leg box.
7. **renderRepatriationSteps** (Repatriation, on-airport departure steps) -- Dropoff-leg box.
8. **paintFuneralStart** (Funeral w/Burial + Cremation with Service, pre-start "Load the car")
   -- Pickup-leg box.
9. **renderService** (Funeral, at-church/graveside service screen) -- Dropoff-leg box.
10. **renderHospitalCheckin** (Hospital Storage + Police Case Pickup on-scene screen -- this
    trip type's real on-scene screen, NOT renderJobDetail's on-scene branch, which only ever
    renders the pre-start "hidden until you start" placeholder for these two types) -- both legs
    shown together (Pickup / Dropoff), since this trip type has no separate pre-start-vs-dropoff
    screen the way Autopsy/Airport/Repatriation/Funeral do -- scene pickup and morgue check-in
    are just tabs of the same render.

All of the above (items 4-10) were added in a follow-up pass after the first pass shipped only
items 1-2 and left the rest as a documented gap (see prior version of this file / test cases
TC-22, TC-23). The user directly challenged that scoping -- the original requirement ("on DA,
transport items must show on both legs of trip as well") states no exception for any trip type,
so narrowing it to just the general case was an unrequested, unconfirmed scope cut, not something
the requirement itself excluded. Corrected in full rather than left as an accepted gap.

Every leg-specific box reuses `loadTripTransportItems(tripId)` unmodified even when only one leg's
container exists on a given screen (e.g. Pickup-only on `renderAirportPickup`) -- the function
always tries to populate both `#transport-list-pickup` and `#transport-list-dropoff`, and
`renderTransportLegList` no-ops (via its own `$el.length` guard) when a container isn't present
on the current screen. No new function was needed for the single-leg cases.

## Also relevant

`getTripTransportItems` in `Driver_App.ds` -- see the driver_app folder's own function file --
needs to be live (with the `leg` field in its response) before any of this renders correctly;
without it every item would show with `leg` blank and neither list would populate.
