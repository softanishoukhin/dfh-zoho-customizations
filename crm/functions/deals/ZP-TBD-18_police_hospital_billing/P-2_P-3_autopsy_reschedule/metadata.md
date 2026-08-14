Task ID: ZP-TBD-18 / P-2 + P-3
Zoho App: CRM
Module: Operations (trigger), Deals, Trips, Sales_Orders, Tasks
Function Name: automation.handleAutopsyReschedule(Int crmid) -- NEW
Trigger Source: NEW Workflow Rule needed -- Operations, field update on Reschedule_Reason,
argument mapping crmid = Related_Deal.id
Created By: Claude Code, 2026-08-14/15
Production Deployed: No -- built, not yet deployed or tested

## Andrea's clarification that unblocked this (verbatim, 2026-08-14)
"You have the entire logic for an autopsy trip. The deceased gets picked up from morgue
location they are at and is transported to an autopsy location. a reschedule brings them
back to the morgue and back to the autopsy location on a reschedule."

## What this confirmed
The live template `automation.createTripOnTheDayOfAutopsyDateWithTask` (pulled and read in
full 2026-08-14) branches on `Deals.Is_Deceased_In_Our_Care`: Scenario A (pickup = DFH's
own Kingston/Mobay location, destination = autopsy facility) or Scenario B (reverse). A
reschedule can only fire after the deceased has already been picked up once -- that's the
entire premise of a no-show or frozen-body reschedule -- so Is_Deceased_In_Our_Care is
always effectively "Yes" by reschedule time. That's exactly Scenario A, exactly what Andrea
described. The earlier "open question" wasn't a real gap -- the answer was already in the
live function.

## What was built
`automation.handleAutopsyReschedule(Int crmid)`, branching on `Operations.Reschedule_Reason`:
- **"Autopsy not done"** -- creates/updates the reschedule Trip (Scenario A clone,
  Trip_Type "Autopsy Reschedule", marker "Autopsy_Reschedule"), adds the Reschedule Trip
  fee (product 6503357000004300032) to the Police Cases Sales Order, creates a Task for Ms.
  Shirley ("Raise manual reschedule invoice -- decide police-officer vs family charge") --
  per Andrea's 2026-08-13 design decision (system can't tell officer- vs family-no-show).
- **"Problem caused by DFH"** -- trip only, no billing, no task. DFH absorbs the cost.
- **"X-ray required"** -- does nothing; routed to P-4 (see PH_Billing_Full_Working_Document,
  section 6 -- next step, not yet built).
- Forensics/IFSL never billed, either branch.

## Deliberately NOT included
No independent recomputation of the Police SO's storage line item. That continues to run
off the existing LNI (P-1) and autopsy-completed storage functions on their own date
fields. Adding a second storage adjustment here risked fighting those functions over the
same line item. Flag to Andrea/Shirley if a reschedule is confirmed to need its own,
separate storage adjustment.

## Open item before deploy
The Task is created with `Task_Type = "Reschedule Manual Invoice"` -- this exact picklist
value has NOT been confirmed to exist on the Tasks module. Verify it exists (Setup >
Customization > Modules and Fields > Tasks > Task_Type) or substitute an existing value
before deploying.

## Deploy
1. Confirm/add the Task_Type picklist value (see above).
2. Create the function `handleAutopsyReschedule` from `createAutopsyRescheduleTrip.deluge`
   (file name kept for repo continuity with the original build-doc naming; the actual
   function inside is `handleAutopsyReschedule`).
3. Create the new Workflow Rule on Operations described above.
4. Test all three Reschedule_Reason values via a real or test Driver App reschedule:
   confirm the trip creates correctly, confirm "Autopsy not done" adds the fee + task,
   confirm "Problem caused by DFH" does neither, confirm "X-ray required" does nothing here.
5. Confirm re-firing the same reason on the same Deal updates the existing reschedule trip
   rather than creating a duplicate.
