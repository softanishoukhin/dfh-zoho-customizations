Task ID: ZP-TBD-16 (placeholder) -- same task as
creator/functions/trip_manager/ZP-TBD-16_transport_pickup_dropoff_legs/, split by app per repo
convention. Read that folder's metadata.md first for the full feature design and the CRM field
change (Transport.Leg) this side also depends on.

Zoho App: Creator (Driver App)
Created By: Claude Code, 2026-08-12
Production Deployed: No -- guideline only, per the hard rule on Creator .ds files.

## What this side of the task does

Driver App's job in this feature: show a driver, on any trip (not just Multi Deceased Autopsy
Trip), the transport items assigned to that trip's Pickup leg and Dropoff leg separately, and
let the driver check each one off individually -- with that checked state genuinely persistent
(surviving navigating to a different trip and back), which the OLD implementation didn't
actually provide per-item (see below).

## What was live before this task

- getTripTransportItems(tripId) (backend for Get_Trip_Transport_Items1): hardcoded
  Transport_Status='Scheduled' filter, no leg field returned. Only ever called from the
  Multi Deceased Autopsy Trip pre-start screen (paintAutopsyStart).
- The only checkbox was ONE aggregate "Transport items loaded" checkbox
  (`#autopsy-chk-sup`), persisted via the existing generic persistChecklistState() /
  restoreChecklistState() mechanism -- which folds it into the trip's own Checklist_State JSON
  blob alongside every other form field on that screen. That mechanism itself works correctly
  and does cover checkboxes (confirmed by reading it in full) -- the actual gap was that there
  was no PER-ITEM checkbox at all, only one aggregate flag with no record of which specific
  items were loaded.
- The individual Transport records fetched for that trip were rendered as a plain read-only
  bullet list (name/category/direction text) -- no inputs, nothing individually persisted.

## What changes in this task

- getTripTransportItems(): removed the hardcoded Scheduled-only filter (now returns every
  status, including Completed, so a reopened trip shows already-completed items as already
  checked instead of them vanishing), added `leg` to the response.
- setTransportItemStatus(transportId, completed): NEW. Per-item completion save, modeled on the
  existing saveDeceasedPickup pattern in this same file (per-record CRM persistence, not a
  trip-level JSON blob). Writes Transport_Status ("Completed"/"Scheduled") and
  Completed_Date_and_Time directly onto the ONE Transport record being checked/unchecked.
  Refuses to act on an item that isn't currently linked to a trip.

## Persistence design note -- why this is NOT built on Checklist_State

The trip's Checklist_State blob is the right mechanism for form-field state that only makes
sense in the context of that one trip's own screen (dropdowns, notes, the old aggregate
checkbox). Per-transport-item completion is different: the same kind of record independently
tracks its own real-world state (has this specific casket/item actually been loaded/dropped
off), which needs to be correct regardless of which trip screen is currently open, survive the
driver looking at a completely different trip and back, and match what TM/CRM see. Writing it
directly to the Transport record itself (read fresh via getTripTransportItems every time, same
as TM's dashboard reads it) is what actually guarantees that, rather than trusting a per-trip
cached blob to stay in sync with the CRM record's real status.

## Live-applied change synced to repo (2026-08-12)

setTransportItemStatus's Completed_Date_and_Time stamp changed from a bare `zoho.currenttime`
to `zoho.currenttime.toString("yyyy-MM-dd'T'HH:mm:ss").toTime("yyyy-MM-dd'T'HH:mm:ss").toString("yyyy-MM-dd'T'HH:mm:ss")`
-- the raw datetime object wasn't writing correctly through this zoho.crm.updateRecord call.
Applied directly live by the user (not authored by Claude); this is the confirmed-working
pattern for stamping a "right now" datetime field this way in this org -- see
feedback_deluge_currenttime_datetime_write_pattern memory for the general rule.

## Follow-up (2026-08-12): transport items rolled out to every trip-type flow

The first pass of this task only wired transport-item display into the general-purpose screen
(renderJobDetail) and the Autopsy pre-start ("Load the car") screen, and documented the other
five DA flows (Autopsy on-scene, Airport Pickup/Check-in, Repatriation Start/Steps, Funeral) as a
known, explicitly-flagged gap in widget-js-changes.md. The user challenged this directly, quoting
the original requirement back ("on DA, transport items must show on both legs of trip as well")
and asking why it wasn't implemented, since the requirement states no trip-type exception. That
was correct -- the narrowing was my own unrequested scope cut, not something the requirement
excluded. All remaining flows were then implemented in the same pass, plus one additional gap
found while auditing every render function: `renderHospitalCheckin` (the actual on-scene screen
for Hospital Storage / Police Case Pickup, not renderJobDetail's on-scene branch, which never
renders for those two trip types once a trip is started) also had no transport-item display and
was added too. See widget-js-changes.md for the full per-screen list (items 1-10) and which leg
each screen shows.

## Related files in this folder

getTripTransportItems.deluge, setTransportItemStatus.deluge, deployment-checklist.md,
test-cases.md, rollback.deluge, widget-js-changes.md (app.js changes -- not a .ds file, edited
directly in this repo).
