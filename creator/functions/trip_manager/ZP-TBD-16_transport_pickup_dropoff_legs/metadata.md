Task ID: ZP-TBD-16 (placeholder)
Zoho App: Creator (Trip Manager app) + CRM (Transport custom module, Trips module)
Apps affected: Trip Manager (this folder), Driver App (see
creator/functions/driver_app/ZP-TBD-16_transport_pickup_dropoff_legs/ -- same task, split by app
per repo convention)
Created By: Claude Code, 2026-08-12 (design + build)
Sandbox Tested: No
Production Deployed: No -- not yet applied live. This folder is the guideline; the .ds function
bodies below need to be pasted into Trip_Manager.ds in Creator by the user (per repo's hard rule:
Creator .ds files are never edited directly, only guided).

## What this task is

DFH's request (2026-08-12): generalize "Transport items" (a feature that today only exists for
Multi Deceased Autopsy Trip trips, in both TM and DA) into a full pickup/dropoff-leg transport
system available on any trip, with a dedicated "Transports" section in TM to create/view/assign
items, add/remove capability on individual trips, DA visibility split by leg with persistent
per-item checkoff, and bidirectional status sync between the apps and the CRM Transport record.

## Design decisions (confirmed with the user before building)

1. **Leg model**: one Transport record links to ONE Trip via the existing Related_Trip lookup,
   plus a NEW Leg picklist field (Pickup / Dropoff) saying which of that trip's two built-in
   addresses (Pickup_Street_Address vs Destination_Street_Address) the item belongs at. If the
   same physical item needs handling across two different trips, that's two separate Transport
   records -- matches how each record already represents one work order today, not a
   physical-item's whole lifecycle.
2. **Current_Location (Mobay/Kingston) is kept, unchanged, as a separate concept** -- it answers
   "which office does this item currently need collecting from," independent of which trip/leg
   it eventually gets assigned to. Not touched by this task.

## CRM field change needed (not a .ds file -- Setup UI, see crm-field-changes.md)

New field on the Transport module (api_name Transport, module_name CustomModule34): Leg,
Picklist, values Pickup / Dropoff, api_name "Leg". See crm-field-changes.md for exact steps.

## What was live before this task (for context/rollback)

- getTransportItems(): unscoped list, Transport_Status='Requested' only. UNCHANGED by this task.
- assignTransportItem(transportId, tripId): set Transport_Status='Scheduled' + Related_Trip. No
  existence checks, no leg concept.
- getTripTransportItems(tripId): hardcoded Transport_Status='Scheduled' filter -- a Completed
  item silently vanished from "Assigned to this trip."
- No unassign/remove function existed anywhere.
- No "all transport items" dashboard function existed anywhere.
- No function to create a new Transport record from TM existed -- TM could only assign
  already-CRM-created ones.
- All of this was gated in widget.html to only render for Trip_Type === "Multi Deceased Autopsy
  Trip" -- every other trip type had zero transport UI.

## What changes in this task

- getTransportItems(): unchanged (still the Requested-only assignment-candidate list).
- assignTransportItem(): added required `leg` param ("Pickup"/"Dropoff"), added existence checks
  for both the Transport record and the Trip before writing.
- unassignTransportItem(): NEW. Clears Related_Trip + Leg, resets status to Requested. Refuses
  to touch an already-Completed item (that's a real finished piece of work, not a picker
  mistake -- correct it directly in CRM if genuinely wrong).
- getTripTransportItems(): removed the hardcoded Transport_Status='Scheduled' filter (now
  returns everything linked to the trip, any status), added `leg` and `status` to the response
  so the UI can split Pickup/Dropoff sections and show real state instead of a hardcoded
  "Scheduled" badge.
- getAllTransportItems(): NEW. Backs the "Transports" dashboard -- every Transport record, any
  status, with `tripId`/`tripName` (from Related_Trip) and a derived `assigned` boolean so the
  UI can filter/highlight unassigned items without hardcoding status-value knowledge.
- createTransportItem(): NEW. Lets TM create a Transport record directly (always starts
  Requested/unassigned, identical starting state to a CRM-created one).

## Bug fix (2026-08-12, live-tested)

getAllTransportItems's original query had no WHERE clause ("select ... from Transport order by
... limit 200") -- COQL requires one even when nothing should be filtered out, and threw a
syntax error live. Fixed with an always-true condition (`where id is not null`), same intent
(return every record), now syntactically valid. Needs re-pasting into Trip_Manager.ds.

## Known limitation, flagged not solved

getAllTransportItems() does not fetch the related Trip's Scheduled_Date (only id/name) --
COQL dot-notation joins into a custom module's lookup weren't verified working reliably enough
to depend on for a first pass, and a per-row secondary fetch would be slow for a 200-row
dashboard. If DFH wants the trip's date on the dashboard without an extra click, that needs a
follow-up (either confirm the dot-notation join works, or the TM widget cross-references
already-loaded trip data client-side by tripId where available).

## Related files in this folder

getTransportItems.deluge, assignTransportItem.deluge, unassignTransportItem.deluge,
getTripTransportItems.deluge, getAllTransportItems.deluge, createTransportItem.deluge,
crm-field-changes.md, deployment-checklist.md, test-cases.md, rollback.deluge.

See creator/functions/driver_app/ZP-TBD-16_transport_pickup_dropoff_legs/ for the Driver App
side (per-item completion persistence) and the widget-js-changes.md files in both folders for
the actual client-side (app.js / widget.html) changes -- those are NOT .ds files and were
edited directly in this repo, not guideline-only.
