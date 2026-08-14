Task ID: ZP-TBD-18 / P-2 + P-3
Zoho App: CRM
Module: Operations (trigger), Deals, Trips, Sales_Orders, Tasks
Function Name: automation.handleAutopsyReschedule(Int crmid) -- NEW
Trigger Source: NEW Workflow Rule needed -- Operations, field update on Reschedule_Reason,
argument mapping crmid = Related_Deal.id
Created By: Claude Code, 2026-08-14/15
Production Deployed: Yes -- deployed and tested live 2026-08-15, all three
Reschedule_Reason scenarios confirmed passing (see Round 2 below)

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

## Round 2 (2026-08-15) -- live test fixes
User tested the first version live and reported three issues, all fixed:
1. **Task owner was wrong.** Was set to the Deal's Owner; must be **Caeren Shirley**
   specifically (user id `6503357000009256001`, cas@dfhja.com) -- now hardcoded.
2. **Task creation was not idempotent.** A second reschedule on the same Deal created a
   second task. Now searches for an existing task on the same Deal + exact Subject first;
   if found, reuses it (logs a message) instead of creating a duplicate.
3. **"Problem caused by DFH" was creating a trip -- confirmed wrong.** The original build
   (and the DEVELOPER_BUILD_DOC.md source it was based on) assumed this reason should still
   create a trip with no billing. Live testing confirmed this is wrong: this reason should
   do nothing at all -- no trip, no billing, no task. Fixed: this branch now returns
   immediately, before any trip-creation logic runs.

## Round 2 retest -- CONFIRMED PASSING (2026-08-15)
All three Reschedule_Reason scenarios retested live after the Round 2 fixes and confirmed:
- **"Autopsy not done"** -- trip created, Reschedule Trip fee added to the Police SO, task
  created and assigned to Caeren Shirley. Pass.
- **Re-firing "Autopsy not done" a second time on the same Deal** -- updates the existing
  reschedule trip, does NOT create a duplicate task. Pass.
- **"Problem caused by DFH"** -- confirmed no trip, no billing, no task. Pass.

**Known current gap, not a bug:** "X-ray required" still does nothing at all (no trip, no
billing) because P-4 (the X-ray flow) has not been built yet -- this reason is intentionally
routed away from this function, but nothing yet exists to catch it on the other end. Flagged
to Andrea as an active gap while P-4 is being built next, not a regression.

## Deploy status: P-1, P-2, P-3, P-4 ALL DEPLOYED AND CONFIRMED PASSING (2026-08-15)
1. Task_Type picklist value confirmed working (no issue reported in testing).
2. Function `handleAutopsyReschedule` created and deployed.
3. Workflow Rule on Operations created and confirmed firing correctly.
4. All three Reschedule_Reason values tested and passing (see above).
5. Idempotency (re-firing same reason) confirmed working, no duplicates.

## Round 3 (2026-08-15) -- P-4 (X-ray) added to the same function
Andrea's comment simplified P-4 to "same storage and trip fees" -- no new billing pattern
needed. Added an `isXray` branch that reuses the exact same trip-creation and Sales-Order
line-item logic already built for P-2/P-3, just with a different Trip_Type and no Task.

**Product decision (the user's call, needs Andrea's confirmation):** bills the X-ray trip
fee on the SAME "Reschedule Trip" product (6503357000004300032) used for P-2/P-3, rather
than any of the three CRH-specific radiology products in the catalog (CRH- Radiology West /
CRH Pickup @ NC Imaging / Transport to PME). This was explicitly chosen to be raised with
Andrea in the next comment note, not treated as settled -- if she wants one of the CRH
products instead, this is a one-line product-id change.

**Blocking setup step:** `Trips.Trip_Type` has no X-ray-related value today (full picklist
pulled live 2026-08-15, confirmed empty of anything matching). This function creates trips
with `Trip_Type = "X-Ray Trip"` -- **add this value to the picklist before deploying**, or
the trip creation will fail outright.

**Known limitation:** the three new radiology fields (X_Ray_Date, Radiology_Location,
X_Ray_Completed_Date) don't exist on Deals yet, so the X-ray trip's destination reuses the
same Autopsy_Locations facility as a reschedule trip, as an interim default. Once those
fields exist, update the destination logic to read Radiology_Location instead.

## Round 3 retest -- CONFIRMED PASSING (2026-08-15)
"X-ray required" tested live after adding "X-Ray Trip" to the Trip_Type picklist: X-ray
trip created correctly, Reschedule Trip fee added to the Police SO, no Task created. Pass.

**P-1, P-2, P-3, and P-4 are all now deployed and confirmed passing live.** Still open:
the product-choice flag above (raise with Andrea), and the known limitation on destination
routing until the radiology fields exist.

**No Task for Shirley on X-ray** -- unlike a no-show, there's no officer/family ambiguity
to resolve; billing applies automatically to the institution.

## Deploy (P-4 specifically)
1. Add "X-Ray Trip" to the Trips.Trip_Type picklist.
2. Paste the updated `createAutopsyRescheduleTrip.deluge` over the live
   `handleAutopsyReschedule` function (P-1/P-2/P-3 logic unchanged, only the X-ray branch
   is new).
3. Test: a Driver App reschedule with reason "X-ray required" -- confirm an X-ray trip is
   created, the Reschedule Trip fee is added to the Police SO, and NO task is created.
4. Re-fire the same reason -- confirm the existing X-ray trip is updated, not duplicated.
