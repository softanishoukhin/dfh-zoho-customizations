# Deployment checklist -- P-1 and D-1 only

The rest of this task (P-2, P-3, P-4, H-1 remediation) isn't ready to deploy
yet -- see `findings/open-questions-consolidated.md` for what's blocking each.

## P-1 -- LNI 2-day storage cap

**STATUS (2026-08-15): DEPLOYED AND CONFIRMED PASSING.** Earlier notes had incorrectly
claimed this was already live -- re-verified live 2026-08-15, found the clamp still
missing, reprovided the exact guideline, user pasted it in and tested. Confirmed: LNI 3+
days after pickup caps storage at 2 days; same/next-day LNI still bills 1 day, unaffected.

1. Open `automation.StorageFeebasedonLetterofNoInterestWorkflow` in the CRM
   function editor (id `6503357000003302110`).
2. Replace its full contents with
   `P-1_lni_2day_cap/StorageFeebasedonLetterofNoInterestWorkflow_UPDATED.deluge`
   (the whole file -- it's the complete function with one addition, not a
   diff).
3. No workflow change needed -- the calling workflow ("Storage Fee based on
   Letter of No Interest Workflow") is untouched.
4. **Test:** find or create a police-case Deal with `Initial_Trip_Completed_At`
   set, then set `Letter_of_No_Interest_Date` 3+ days later -> confirm the
   Police Cases Sales Order's storage line quantity caps at 2, not the real
   day count. Same-day/next-day LNI -> still 1, unaffected by the cap.
5. **Do NOT** also apply this to `updateSalesorderWithStorageFee` (the
   autopsy-path function) yet -- that's gated on O-A2/O-7, unanswered.

## D-1 -- Registration number (CRM-side only; Driver App form field and
report updates are separate, not covered here)

1. Create the new `Registration_Number` text field on **Deceased_Pickups**,
   **Operations**, and **Deals** (Setup > Customization > Modules and
   Fields). Add it to the Deceased_Pickups check-in layout near
   Refrigerator/Row/Drawer.
2. Open `automation.onDeceasedPickupCheckIn` (id `6503357000069144520`) in
   the CRM function editor.
3. Follow `D-1_registration_number/onDeceasedPickupCheckIn_CHANGES.md` --
   add the two small blocks at the two verified insertion points (inside the
   `if(opsId != "")` block, and inside the `dealUpd` block). Do NOT replace
   the whole function -- it does much more than this (NOK sync, Account
   creation, hang tags, Transport auto-create) and none of that needs
   touching.
4. **Test:** check in a Deceased Pickup with a registration number entered
   (once the Driver App form field exists -- until then, can be tested by
   setting the field directly on a Deceased_Pickups record and re-triggering
   the check-in workflow) -> confirm it lands on both the linked Operations
   record and the Deal.
5. **Still needed, not in this checklist:** the Driver App check-in form
   field itself, and updating Ms. Shirley's reports -- both wait on her
   answer to MS_SHIRLEY_FOLLOWUP.md question #7.
