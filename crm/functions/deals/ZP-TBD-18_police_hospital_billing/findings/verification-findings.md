# Police & Hospital Billing -- Live Verification Findings

**Date:** 2026-08-14
**Why this exists:** Andrea's instruction was explicit -- "if CC inserted anything
questionable...please verify with me." `FUNCTION_SOURCES.md` states it was "read
from DFH CRM via the function editor CodeMirror" and "de-neutralized," but in
several places it's a paraphrased reconstruction with `...` gaps standing in for
real logic, not a verbatim pull. Per this project's standing rule (always verify
against live source before building on top of secondhand documentation), every
function this task touches was re-pulled in full via MCP before anything below
was written. This file is the record of what matched, and -- more importantly --
what didn't.

## Summary

Most of `FUNCTION_SOURCES.md` and `DEVELOPER_BUILD_DOC.md` checks out exactly.
Every claimed-existing field (15), every claimed-absent field (5), and every
referenced Product ID (11, names and prices) matched live exactly -- no
discrepancies there at all. But two of the six functions have real gaps the
summarized docs didn't capture, and a live data audit turned up a bigger,
independent problem. None of these are "CC made something up" -- they're
"the paraphrased summary left out something load-bearing" and "a live-data
audit found something nobody had checked yet." Details below.

---

## Finding 1 -- FN-2 (`UpdateStorageFeeonHospitalReleaseDate`) has NO fallback on the hospital branch

**What the doc said:** "Storage product resolved per hospital via
`Products.Product_of_This_Hospital = Selected_Hospital` + `Product_Category='Storage'`
(police storage id `6503357000002869275` as fallback)." This reads as: if a
hospital has no linked Storage product, the function falls back to the police
rate.

**What the live code (pulled in full, id `6503357000003769101`) actually does:**
the function branches on `Deals.Pipeline`, and the fallback-to-police-storage
behavior only exists in the **Police Cases** branch:

```deluge
if(recordInfo.get("Pipeline") == "Police Cases")
{
    storageProducts = <COQL: Parent_Product='...' and Product_Category='Storage'>;
    if(storageProducts.size() > 0) { productDetails = ...; }
    else { productDetails = zoho.crm.getRecordById("Products","6503357000002869275"); }  // fallback
}
else if(recordInfo.get("Pipeline") == "Hospital Cases")
{
    if(!isNull(recordInfo.get("Selected_Hospital")))
    {
        storageProducts = <COQL: Product_of_This_Hospital='<hospital id>' and Product_Category='Storage'>;
        if(storageProducts.size() > 0) { productDetails = ...; }
        // <-- NO else. If zero results, productDetails is never assigned in this branch.
    }
    else { productDetails = null; }
}
if(!isNull(productDetails)) { ...build/update the SO line, generate invoice... }
```

**Impact:** if a Hospital Cases Deal's `Selected_Hospital` has no product
linked via `Product_of_This_Hospital`, `productDetails` never gets set, the
`if(!isNull(productDetails))` guard fails, and the entire storage-billing block
(and the invoice generation call at the end of it) is silently skipped -- no
error, no fallback, no line item, no invoice. This is a real functional gap in
the CURRENT live function, unrelated to anything this task is building --
found only because Finding 2 (below) shows this exact scenario is not
hypothetical.

**Not fixed here** -- H-1 was scoped as "verify only, no logic change," and a
genuine behavior change (adding a fallback, or deciding what SHOULD happen
when a hospital has no linked product) needs your sign-off, not a unilateral
fix. Flagged as a new open question below.

---

## Finding 2 -- 20 of ~21 hospital Storage products are NOT linked via `Product_of_This_Hospital`

Live data audit (2026-08-14, Products module, `Product_Category = 'Storage'` and
name starting "Storage for..."):

| Product | `Product_of_This_Hospital` |
|---|---|
| Storage for Institute of Forensic Science and Legal Medicine | **empty** |
| Storage for Hope Institute Hospital | **empty** |
| Storage for Bay West Wellness Hospital | **empty** |
| Storage for Doctors Hospital | **empty** |
| Storage for GWest Medical & Surgery Centre | **empty** |
| Storage for Hospiten Montego Bay | **empty** |
| Storage for Montego Bay Hospital Hospitals | **empty** |
| Storage for Andrews Memorial Hospital (Kin) | **empty** |
| Storage for Tony Thwaites Wing | **empty** |
| Storage for Bustamante Hospital for Children (KIN) | **empty** |
| Storage for Kingston Public Hospital (KIN) | **empty** |
| Storage for Medical Associates Hospital (KIN) | **empty** |
| Storage for Spanish Town Public Hospital | **empty** |
| Storage for Nuttall Memorial Hospital (KIN) | **empty** |
| Storage for Victoria Jubilee Maternity Hospital (KIN) | **empty** |
| Storage for Bellevue Hospital (KIN) | **empty** |
| Storage for St. Ann's Bay Hospital | **empty** |
| Storage for Falmouth Public General Hospital | **empty** |
| Storage for Noel Holmes Hospital | **empty** |
| Storage for St. Joseph's Hospital | **empty** |
| Storage for Percy Junior Hospital | **empty** |
| **HIH Storage Fee** | **✅ linked** -- Hope Institute Hospital (`6503357000022426827`) |

(There's a SEPARATE, unlinked product literally named "Storage for Hope
Institute Hospital" too -- it's the differently-named "HIH Storage Fee" that
carries the actual link. Worth a closer look at whether the unlinked "Storage
for Hope Institute Hospital" is dead/duplicate data.)

**This means:** per Finding 1's code path, hospital storage billing via
`UpdateStorageFeeonHospitalReleaseDate` currently works ONLY for Hope
Institute Hospital cases. For every other hospital in the system, a Hospital
Cases Deal reaching its release date should -- per the code -- silently fail
to bill storage or generate an invoice at all.

**I have not independently confirmed this is actually happening on real live
Deals** (that would mean finding a real hospital case that reached
`Hospital_Release_Date` for one of the 20 unlinked hospitals and checking
whether it actually has no storage line/invoice -- didn't do this, given time
already spent; recommend as a next step, since it would either confirm real
customer-facing billing loss, or reveal something else keeps this working
that I haven't found, e.g. these 20 products going stale/unused for another
reason). Reporting the code + data finding as-is rather than a confirmed
production incident.

**This is bigger than the "verify only, XS effort" scope H-1 was given.**
Recommend treating this as its own priority item, separate from -- and likely
more urgent than -- the new-build items, since if confirmed it means real
hospital revenue may be going unbilled today, independent of anything in
this release.

---

## Finding 3 -- FN-4 (`createTripOnTheDayOfAutopsyDateWithTask`) has logic the doc's summary omitted entirely

This is the function P-2's new reschedule-trip function is meant to clone, so
the gaps matter directly for that build, not just as trivia.

**What the doc said:** "pickup address from the Deal's Operations record
Location... destination = autopsy facility... [Task creation]... tripMap.put
Name/Owner... createRecord." Reads as one fixed pattern.

**What the live code (pulled in full, id `6503357000009016197`) actually
does -- three things the summary didn't mention:**

1. **A full pickup/destination branch on `Deals.Is_Deceased_In_Our_Care`,
   not a single fixed pattern:**
   - `Is_Deceased_In_Our_Care == "Yes"` -> Scenario A: pickup = DFH office
     (from Operations.Location, hardcoded Kingston/Montego Bay addresses),
     destination = autopsy facility (Accounts record via `Autopsy_Locations`).
     This is the ONLY scenario the doc's summary described.
   - Anything else (not yet in DFH's care) -> Scenario B, the REVERSE:
     pickup = autopsy facility, destination = DFH office (hardcoded, does
     NOT read Operations.Location at all in this branch).

   For a P-2 reschedule trip, which scenario applies isn't obvious by
   default -- per the requirement text, "deceased is returned to storage"
   after a failed post-mortem, which suggests the body cycles back into
   DFH's care between the failed attempt and the reschedule (Scenario A
   territory), but this needs an explicit decision, not an assumption baked
   into the clone. **New open question below.**

2. **`Trip_Status` is explicitly set to `"DO NOT SCHEDULE"`** on trip
   creation -- not mentioned in the doc at all. Whether the reschedule trip
   should get the same status (presumably yes, for consistency, since it
   mirrors the same "needs a human to actually schedule it" pattern) is
   worth confirming rather than assuming.

3. **The follow-up Task ("Follow Up Completion of Form E...") is created
   EVERY time this function runs** -- including the `else` branch that just
   updates an already-existing trip, not only on first creation. The doc's
   idempotency guidance ("Idempotency check on Trip_Type + a distinct
   Created_on_This_Field_Update marker") only covers trip-creation
   dedup -- it says nothing about the Task, because the doc's summary never
   showed the Task creation sits outside the `if(tripAvailable == false)`
   block. If a P-2 clone follows the doc's idempotency guidance literally
   (only guarding the trip), a re-run (e.g. the advance-notice path firing
   more than once) would create a duplicate Task every time. **Needs its own
   guard if reused.**

**Not built yet** -- P-2/P-3 aren't in the "safe/clear" set for this pass
specifically because of this: the pickup/destination scenario for a
reschedule trip needs a real decision, not a guess baked into a clone. See
open questions below.

---

## Confirmed accurate, no discrepancies found

- **FN-1** (`StorageFeebasedonLetterofNoInterestWorkflow`, id
  `6503357000003302110`) -- matches the doc's summary exactly. P-1's guideline
  in `../P-1_lni_2day_cap/` is built directly from this verified pull.
- **FN-3** (`updateStorageFeeOnTransferToAnohterFuneralHome`, id
  `6503357000003553141`) -- matches exactly, including the noted typo in the
  live api_name ("Anohter") and the commented-out Stage update.
- **FN-5** (`onDeceasedPickupCheckIn`, id `6503357000069144520`) -- the doc's
  excerpt was accurate as far as it went (just very abbreviated -- the real
  function is far larger, doing NOK sync, Deal identity-change cascades,
  Account creation, Ward sync, hang tag generation, and a Transport
  auto-create block the doc didn't mention at all, none of which D-1 needs to
  touch). D-1's insertion points in `../D-1_registration_number/` are verified
  against the complete function.
- **`updateSalesorderWithStorageFee`** (the autopsy-path storage function
  referenced but NOT sourced in FUNCTION_SOURCES.md, id
  `6503357000003289008`) -- now pulled in full. Confirmed the same one-line
  cap P-1 uses can be inserted the same way (right after the `+1`), with no
  existing minimum-1 floor to interact with. **Not applied** -- gated on
  open question O-A2/O-7 (does the 2-day cap apply here too?), unanswered.
  Also noted in passing: this function sets `Deal.Stage = "Autopsy Completed"`
  and calls the police invoice generator unconditionally (no `Account_Name`
  null-guard, unlike FN-1) -- not a problem, just a difference worth knowing
  if this function is touched later.
- **`Save_Autopsy_Disposition`** -- confirmed NOT a CRM function (searched all
  377 CRM functions in the org, not present); it's the Driver App (Creator)
  function referenced in `Driver_App.ds`. Read directly: it DOES write
  `Operations.Reschedule_Reason` with exactly the three confirmed labels
  ("X-ray required" / "Autopsy not done" / "Problem caused by DFH"), via a
  REST PUT with `"trigger":["workflow"]` -- meaning a new workflow on that
  field WILL fire correctly from this call. This fully resolves the doc's
  "near-certain, dev to confirm" note -- now certain, not just likely.
- **All 15 Deal fields** the docs claimed already exist -- confirmed present
  live with matching types (picklists' values checked too, e.g. `Pipeline`,
  `Stage`, `Autopsy_Required`, `Autopsy_Type` all match exactly).
- **All 5 fields** the docs claimed do NOT exist yet (`Registration_Number` on
  3 modules, `X_Ray_Date`, `Radiology_Location`, `X_Ray_Completed_Date`,
  `Autopsy_Reschedule_Date`) -- confirmed absent.
- **`Operations.Reschedule_Reason`** -- confirmed exists, picklist values
  exactly `X-ray required` / `Autopsy not done` / `Problem caused by DFH`
  (plus `-None-`) -- matches the requirement doc exactly.
- **All 11 referenced Product IDs** (§0 of DEVELOPER_BUILD_DOC.md) -- every
  one confirmed to exist live with the exact name and price claimed.
