# Open questions -- consolidated (2026-08-14)

Combines the requirements docs' own open items with what live verification
turned up. Organized by urgency, not by category, since the new findings
change the priority order.

## NEW -- found during live verification, not in the original docs

### Q-NEW-1 (urgent, independent of this whole release): hospital storage billing may already be broken for ~20 of 21 hospitals
See `verification-findings.md` Findings 1 & 2 in full. Short version: the live
`UpdateStorageFeeonHospitalReleaseDate` function only has a billing fallback
for Police Cases, not Hospital Cases -- and a live-data audit found 20 of the
21 "Storage for [Hospital]" products have their `Product_of_This_Hospital`
link empty (only Hope Institute Hospital's is actually linked, via a
differently-named product, "HIH Storage Fee"). If a Hospital Cases Deal for
any of the other 20 hospitals reaches its release date, the function's own
logic appears to silently skip billing and invoice generation entirely.
**Questions:**
- Should someone check a real recent Hospital Cases Deal for one of the 20
  affected hospitals to confirm whether this is actually happening (i.e. is
  hospital revenue currently going unbilled), or is there something else in
  play I haven't found?
- If confirmed: is linking the 20 products' `Product_of_This_Hospital` field
  (pure data fix, no code change) enough, or does the function also need a
  fallback added for the Hospital Cases branch (a real logic change, needs
  sign-off on what that fallback should be)?
- This feels higher-priority than the new-build items in the requirements
  doc, purely because it's plausibly costing money right now, today,
  independent of this release. Your call on sequencing.

### Q-NEW-2: P-2's reschedule trip -- which pickup/destination scenario?
See Finding 3. The trip-creation template (`createTripOnTheDayOfAutopsyDateWithTask`)
branches on `Deals.Is_Deceased_In_Our_Care` into two different pickup/
destination patterns (DFH-office-to-facility, or facility-to-DFH-office) --
this wasn't in the build doc's summary at all. **Question:** for the
reschedule trip (both the driver-app "Autopsy not done" no-show path and the
advance-notice office path), which scenario applies? My read of the
requirement text ("deceased is returned to storage" after a failed
post-mortem) suggests Scenario A (pickup from DFH storage, destination =
facility) for the driver-app path, since the body cycles back into DFH's
care between the failed attempt and the reschedule -- but this needs your
confirmation, not my guess, before P-2 is built.

### Q-NEW-3: P-2's reschedule Task -- does it need its own dedup?
The template function's Task creation ("Follow Up Completion of Form E...")
runs on every invocation with an Autopsy_Date_Time set, not just on first
trip creation -- confirmed by reading the full live function. If a P-2 clone
follows the build doc's idempotency guidance literally (which only guards
the trip, not any task), and the office advance-notice path or the
driver-app path can fire more than once for the same reschedule, it would
create duplicate Tasks. Does the reschedule flow need its own equivalent
task, and if so, does it need dedup, or is a duplicate task an acceptable/
rare edge case?

---

## From the original requirements docs -- still open

| # | Question | Owner | Status |
|---|---|---|---|
| O-A2 / O-7 | Does the 2-day storage cap apply to the autopsy-completed path too, or LNI only? | Shirley | Open. The autopsy-path function (`updateSalesorderWithStorageFee`) is now fully pulled and verified (see `live-sources-verbatim.md`) -- the same one-line cap can be added the moment this is answered, no further investigation needed on my end. |
| O-B | P-2 advance-notice path: new `Autopsy_Reschedule_Date` Deal field? | Andrea + dev | Recommended in the docs, not yet confirmed. Also now tangled with Q-NEW-2 above -- the advance-notice path's pickup/destination scenario needs deciding regardless of which field triggers it. |
| O-C | Automate the 6-week -> $3,500/day family storage accrual, or keep manual? | Andrea | Open. Not started -- this is a real scope decision (automate vs. leave manual), not something to build a guess at. |
| O-D | Confirm every hospital has a Storage product linked via `Product_of_This_Hospital` | Andrea + dev | **Answered by live audit -- see Q-NEW-1/Finding 2. Only 1 of 21 does.** |
| O-E / #2 (Shirley) | Decomp $2,000/day rate on the LNI path -- should it switch from the $1,500 product? | Shirley | Open. P-1's guideline (built) intentionally does NOT touch product selection, only adds the cap -- per the build doc's own instruction not to change the product used without this answer. |
| O-6 | Dev-validate the family $7,500 transfer + $3,500 storage hit the correct products on the family invoice; confirm the police $1,500-to-transfer charge is intended | Dev + Shirley | **Not yet done** -- ran out of scope for this pass after the hospital-product audit above. Next step if you want it prioritized. |
| #1 (Shirley) | 2-day cap on autopsy path -- same as O-A2/O-7, phrased for Shirley | Shirley | Open |
| #3a (Shirley) | Reschedule/no-show -- is there also a return-trip fee beyond storage + reschedule-trip fee? | Shirley | Open |
| #4 (Shirley) | X-ray trip -- exactly which charges (imaging fee / transport / storage)? | Shirley | Open -- blocks P-4 |
| #5b (Shirley) | Is the police $1,500/day transfer charge intentional alongside the family $7,500/day? | Shirley | Open -- related to O-6 |
| #7 (Shirley) | Registration number -- confirm "all reports" or a specific list | Shirley | Open -- D-1's CRM-side change (field + function) is built regardless; report updates wait on this answer |
