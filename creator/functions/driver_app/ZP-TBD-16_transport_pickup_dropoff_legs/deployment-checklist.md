# Deployment Checklist -- Driver App side

Do this AFTER the Trip Manager side and the CRM Leg field are both live (this side depends on
the Leg field existing and on items actually being assignable with a leg in the first place).

1. [ ] Confirm the Transport.Leg field exists (added during the Trip Manager side's deployment).
2. [ ] In Zoho Creator, open the Driver App's function editor for **Driver_App.ds**.
3. [ ] Update `getTripTransportItems` -- replace with getTripTransportItems.deluge (removes the
   hardcoded Scheduled-only filter, adds `leg` to the response). This is the SAME function name
   as the Trip Manager side's function of the same name, but they are two separate functions in
   two separate .ds files -- update both, they don't share code.
4. [ ] Add the new function `setTransportItemStatus` -- paste setTransportItemStatus.deluge.
5. [ ] Publish/save both in Creator.
6. [ ] Register `setTransportItemStatus` as a Custom API if this app requires that step --
   suggested name to match convention: `Set_Transport_Item_Status`.
7. [ ] Apply the app.js changes (see widget-js-changes.md) -- per-item checkboxes split by leg,
   replacing the old single aggregate "Transport items loaded" checkbox, wired to call
   `setTransportItemStatus` per item and to render on any trip type (not just Multi Deceased
   Autopsy Trip).
8. [ ] Run through test-cases.md.
