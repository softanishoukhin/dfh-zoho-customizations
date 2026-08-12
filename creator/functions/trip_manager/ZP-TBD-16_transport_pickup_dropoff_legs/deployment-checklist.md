# Deployment Checklist -- Trip Manager side

Do this BEFORE the driver_app side (DA's getTripTransportItems depends on the Leg field
existing, and both apps depend on the CRM field being live first).

1. [ ] Add the `Leg` picklist field to the Transport module -- see crm-field-changes.md.
2. [ ] In Zoho Creator, open the Trip Manager app's function editor for **Trip_Manager.ds**.
3. [ ] Update `assignTransportItem` -- replace the existing 2-param version with the 3-param
   version in assignTransportItem.deluge (adds `leg`, adds existence checks). This is a
   BREAKING signature change -- the widget.html call site must be updated in the same
   deployment (see widget-js-changes.md), not left calling the old 2-arg shape.
4. [ ] Add the new function `unassignTransportItem` -- paste unassignTransportItem.deluge.
5. [ ] Update `getTripTransportItems` -- replace with getTripTransportItems.deluge (removes the
   hardcoded Scheduled-only filter, adds leg/status to the response).
6. [ ] Add the new function `getAllTransportItems` -- paste getAllTransportItems.deluge.
7. [ ] Add the new function `createTransportItem` -- paste createTransportItem.deluge.
8. [ ] `getTransportItems` -- confirm it's unchanged from what's already live (no action needed,
   just a sanity check while you're in there).
9. [ ] Publish/save all of the above in Creator.
10. [ ] Register each new function as a Custom API if this app requires that step for the
    widget to call it (matches however `Get_Transport_Items`/`Assign_Transport_Item`/
    `Get_Trip_Transport_Items` are currently exposed) -- suggested Custom API names to match the
    existing naming convention:
    - `unassignTransportItem` → `Unassign_Transport_Item`
    - `getAllTransportItems` → `Get_All_Transport_Items`
    - `createTransportItem` → `Create_Transport_Item`
11. [ ] Apply the widget.html changes (see widget-js-changes.md) -- the new API map entries,
    the generalized per-trip leg picker, the remove/unassign button, and the new "Transports"
    left-nav panel.
12. [ ] Run through test-cases.md.
