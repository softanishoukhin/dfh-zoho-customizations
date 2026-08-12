# Test Cases -- Trip Manager side

Status: Not yet executed -- backend guideline delivered 2026-08-12, not yet applied live.

## TC-1 -- Create a transport item from TM
Use the new "Transports" panel's create form. Expect: new Transport record in CRM,
Transport_Status="Requested", no Related_Trip/Leg, shows on the dashboard as unassigned.

## TC-2 -- Assign an item to a trip's Pickup leg
Open any trip (not just Multi Deceased Autopsy Trip), Pickup section, assign an item. Expect:
Transport_Status="Scheduled", Related_Trip=that trip, Leg="Pickup". Item disappears from the
Requested-candidates picker, appears under "Assigned to this trip / Pickup".

## TC-3 -- Assign an item to the same trip's Dropoff leg
Same trip, Dropoff section, assign a different item. Expect: Leg="Dropoff", appears under
"Assigned to this trip / Dropoff", independent of the Pickup-leg item from TC-2.

## TC-4 -- Remove/unassign an item
Unassign an item that's currently Scheduled (not Completed). Expect: Related_Trip and Leg
clear, Transport_Status reverts to "Requested", item reappears in the assignment picker and as
unassigned on the dashboard.

## TC-5 -- Refuse to unassign a Completed item
Attempt to unassign an item whose Transport_Status is already "Completed" (set it Completed via
CRM directly, or after running the Driver App side's TC). Expect: error message, no change to
the record.

## TC-6 -- Dashboard shows everything, correctly
Open the Transports dashboard with a mix of Requested/Scheduled/Completed items across several
trips. Expect: all of them listed, each showing its real status, its trip name if assigned (and
none if not), and unassigned (Requested) ones clearly distinguishable at a glance.

## TC-7 -- Assigning to a nonexistent trip/transport id fails cleanly
Call assignTransportItem with a bogus transportId or tripId. Expect: status="error" with a
clear message, not a silent partial write.

## TC-8 -- Trip type is no longer a gate
Confirm the transport picker/section now appears on a normal (non-autopsy) trip type, not just
Multi Deceased Autopsy Trip.

## TC-9 -- Regression: existing Multi Deceased Autopsy Trip transport flow still works
Re-run whatever the old picker flow was on an Autopsy trip -- confirm assigning still works
end to end with the new leg-aware version (pick a leg, same as any other trip type now).

## TC-10 -- getAllTransportItems performance/limit
Confirm the dashboard loads acceptably with the current live Transport record count (query is
capped at 200 -- flag if DFH's actual volume is anywhere near that, since older records would
silently drop off the list, ordered newest-first).
