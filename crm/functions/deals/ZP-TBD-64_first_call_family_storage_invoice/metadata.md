Task ID: ZP-TBD-64
Zoho App: CRM (new Workflow Rule + new automation function on Deals) + Books custom
function fix (ZP-TBD-61)
Reported by: user, 2026-09-09, from `projectDocuments/firstcallInvoice.txt` -- this
directly answers the open question left in the ZP-TBD-61 Comment Note ("for First Call
there is no process to generate an invoice for the family at all").

## Requirement (from firstcallInvoice.txt, summarized)
1. Trigger: Deal on Pipeline "First Call" reaches Stage "DFH Not Selected" (family chose
   another funeral home after DFH's initial pickup). Not related to LONI or Hospital
   Release Date -- those are Hospital/Police Cases concepts.
2. Create a "Family Storage Invoice" with: a flat "Storage and Removal" product, and a
   daily/quantity-based storage product whose quantity = (DFH Not Selected date) minus
   (Initial Pickup date).
3. Conditionally add a placeholder Embalming product if the linked Operations record's
   embalming status is complete -- read from Operations, explicitly NOT from a Deal
   field.
4. Deal -> CRM Invoice -> synced to Zoho Books.
5. Andrea wants the workflow URL to hand to CC, so CC can later swap the placeholder
   Embalming product for the correct one.

**No screenshot was provided** (Andrea intended to include one showing the exact
products). Per direct instruction from the developer, this was not blocked on -- products
were picked directly from the live Products catalog and are called out explicitly below
and in the .deluge file's own header comments, for Andrea to confirm or correct.

## Facts confirmed live before building
- **Pipeline stage**: "DFH Not Selected" (`actual_value`, not just a display label) is a
  real Stage option on the First Call pipeline (id `6503357000021094078`), sequence 8,
  `forecast_type: Closed Lost`. Confirmed via `getPipelines`.
- **Pre-existing bug found while confirming this**: the existing ZP-TBD-61 "Create
  Transfer Trip" Books function's First Call branches compare `stage == "Closed Lost"` --
  but First Call has NO stage literally named "Closed Lost" (that literal value only
  exists in the Cremation/Repatriation pipelines). This means the First Call branch of
  that button has never matched a real Deal since it was built. Fixed as part of this
  same change -- see the ZP-TBD-61 folder's update below.
- **Initial Pickup date field**: `Deals.Initial_Trip_Completed_At` (datetime) -- this
  org's own existing `generateFamilyNoShowStorageInvoice` automation already uses this
  exact field for an equivalent day-count calculation, so it's the established
  precedent, not a guess. **Confirmed reliably populated for First Call specifically**
  (27 of 31 real First Call Deals sampled have it set) via the CRM workflow "Update Deal
  Stage to Initial Trip Completed" (Trips module, fires on Trip_Status -> "Completed",
  function `updateDealStagetoInitialTripCompleted`) -- applies uniformly across
  pipelines, not scenario-restricted to Hospital/Police as an earlier check of
  `Driver_App.ds` alone had suggested (that file only writes this field for Hospital/
  Police child deals; the real, pipeline-agnostic write site is this separate CRM
  workflow, not the Driver App).
- **Edge case guarded against**: the 4 unpopulated First Call Deals found while
  confirming the above were not random -- two of them ("Raissa Nifantiva",
  "Winifred Rainor") are already at Stage "DFH Not Selected" with
  `Is_Deceased_In_Our_Care = "No"` and `Initial_Trip_Completed_At` blank, meaning the
  family chose another funeral home before DFH ever actually picked up the deceased.
  There's nothing to storage-bill for in that case. The function now returns early
  (no invoice created at all) when `Initial_Trip_Completed_At` is blank, instead of
  generating a nonsensical zero-quantity storage line.

## UPDATE 2026-09-09 -- two fixes from live test feedback (TC03 failed; quantity request)
1. **TC03 (no-pickup, no-invoice edge case) failed live -- invoice was still created.**
   Root cause: the guard used `isNull(initialPickupRaw)`, and `recordInfo` (the source of
   that value) comes from an `invokeurl` GET response -- the exact same class of value
   already confirmed twice this engagement (see
   [[feedback_creator_customapi_method_and_coql_brackets]]) where `isNull()` does not
   reliably return a real boolean. Fixed by switching to the string-conversion null
   check (`"" + initialPickupRaw` compared against `""`/`"null"`) that this codebase
   already uses everywhere else for invokeurl-sourced values, instead of `isNull()`.
2. **Same-day pickup + DFH Not Selected should bill as 1 day, not 0** (Andrea's explicit
   request). Changed the floor from `if(storageDays < 0){ storageDays = 0; }` to
   `if(storageDays < 1){ storageDays = 1; }`.

Both fixes are in the current `createFirstCallStorageInvoice.deluge` in this folder --
redeploy before retesting TC02 and TC03.

## UPDATE 2026-09-09 -- TC05 failed live: created a duplicate invoice instead of updating

Live test (TC05, adding the Embalming line to a Deal that already had a Family Storage
Invoice from an earlier trigger) created a second, duplicate invoice instead of updating
the existing one. Root cause: the function had no duplicate check at all -- every workflow
firing unconditionally created a brand new invoice.

**Fix:** before creating, the function now looks up the Deal's related Invoices for one
whose Subject contains "Family Storage Invoice" (the one marker unique to this
automation). If found, it PUTs the freshly recomputed line items onto that existing
invoice instead of POSTing a new one. If not found, it creates as before.

**Open question for Andrea:** this update path does not check whether the existing
invoice has already been paid -- it will still overwrite its line items either way. Not
guarded yet since the exact CRM Invoices.Status value for "paid" wasn't confirmed and a
wrong guess could either fail to protect or wrongly block a legitimate re-run. Let us know
if this needs a payment-status guard added.

Redeploy before retesting TC05.
- **Products** (all confirmed live, none named exactly "Storage and Removal" anywhere in
  the catalog):
  - Quantity-based daily storage -> **"Storage Fee"** (id `6503357000029739051`, $1500,
    Parent_Product "IFSLM", Category "Storage - Family"). This is the ONLY product under
    IFSLM with that category, and the existing `generateFamilyNoShowStorageInvoice`
    function already uses it exactly this way (quantity-driven).
  - Flat "Storage and Removal" line -> **"Daily Storage For Removal"** (id
    `6503357000025502352`, $6521.74, Parent_Product "Additional Services"). Closest name
    match in the whole catalog; used here as a flat qty-1 line despite its own name
    saying "Daily". **Please confirm this is the intended product** -- this is the one
    genuine guess in this whole build, made explicitly because no screenshot arrived.
  - Embalming placeholder -> **"Embalming Only"** (id `6503357000031408198`, $80000,
    Parent_Product "Additional Services") -- per Andrea's own instruction not to worry
    about the correct one yet.
- **Embalming signal**: Operations module (api_name `Operations`) has a direct
  `Related_Deal` lookup to Deals (populated independent of any Trip lookup -- confirmed
  on real records). No field literally named "Embalming Complete" exists; the closest and
  most direct real-world match is `Status == "Completed"` (confirmed on a real record
  named "... to be Embalmed"). `Embalming_Report_Uploaded` (boolean) is the alternate
  candidate if this turns out wrong -- flagged as an assumption, not a certainty.
- **CRM -> Books sync**: no explicit sync call is needed. An existing, already-active
  Workflow Rule "Create Invoice in Books" (id `6503357000009264079`) fires on every
  Invoices-module create regardless of type, and pushes it to Zoho Books (confirmed --
  every existing CRM Invoice has a populated `Books_Invoice_ID`). This new invoice rides
  on that same mechanism automatically; nothing extra was built for step 4.

## What was built
1. **New function** `createFirstCallStorageInvoice(Int crmid)` -- full source in this
   folder, `createFirstCallStorageInvoice.deluge`. Built on the exact same
   invoice-creation pattern as the existing `generateDelayedLONIInvoice` function
   (billing-address resolution, tax-picklist lookup, Invoiced_Items structure,
   Potential_Payers creation) -- not written from scratch, reused this org's own proven
   pattern.
2. **Fix + payment gate on ZP-TBD-61's "Create Transfer Trip" Books function** -- see
   `../../../books/functions/invoices/ZP-TBD-61_create_transfer_trip_button/`, file
   `createTransferTrip_FIX_ZP-TBD-64.deluge`. Two changes: (a) the stage-comparison bug
   fix above, (b) per explicit decision, the Montego Bay First Call branch now requires
   this new Family Storage Invoice to be paid before creating the Transfer Trip --
   mirroring the Hospital/Police branch's existing isFamilyInvoice + paid-status pattern
   exactly. Kingston is unaffected (never creates a trip either way).

## Deploy
### Part A -- new Workflow Rule + Function on Deals
1. Create a new Function in CRM (Setup > Automation > Functions), paste in the full
   contents of `createFirstCallStorageInvoice.deluge`.
2. Create a new Workflow Rule on the **Deals** module:
   - **When**: "On a field update" -> field: **Stage**
   - **Condition**: `Pipeline` is `First Call` **AND** `Stage` is `DFH Not Selected`
   - **Instant Action**: Function -> `createFirstCallStorageInvoice`
3. Once created, **send the workflow's URL to Andrea** (Setup > Automation > Workflow
   Rules > open the rule > copy its URL from the browser address bar) so she can pass it
   to CC for the placeholder-embalming-product swap later.

### Part B -- Books function update
1. Open the existing "Create Transfer Trip" custom function in Books (the one built for
   ZP-TBD-61, entity Invoice, bound to the "Create Transfer Trip" button, id
   `5830143000035748114`).
2. Replace its full contents with `createTransferTrip_FIX_ZP-TBD-64.deluge`.

## Test
1. **Trigger fires correctly**: move a First Call test Deal's Stage to "DFH Not
   Selected". Confirm a new Invoices record is created in CRM with Subject "Family
   Storage Invoice - <name>", Invoice_For "Family", and a `Storage Fee` line with
   Quantity matching the day gap between `Initial_Trip_Completed_At` and today.
2. **Books sync**: confirm the new CRM Invoice picks up a `Books_Invoice_ID` shortly
   after creation (the existing "Create Invoice in Books" rule should fire
   automatically -- no separate step should be needed).
3. **Embalming line**: repeat with a test Deal that has a related Operations record with
   Status = "Completed" -- confirm the Embalming Only placeholder line appears. Repeat
   with Status != "Completed" (or no Operations record) -- confirm it does NOT appear.
4. **Day count**: verify against Andrea's own example (Initial Pickup Sep 1, DFH Not
   Selected Sep 5 -> Quantity 4) using two test dates set accordingly.
4b. **No-pickup edge case**: move a First Call Deal straight to "DFH Not Selected"
   without ever completing its initial pickup trip (Initial_Trip_Completed_At blank).
   Confirm NO invoice is created at all.
5. **Transfer Trip fix (ZP-TBD-61 stage bug)**: on a Montego Bay First Call Deal now at
   Stage "DFH Not Selected" with an UNPAID Family Storage Invoice, click "Create Transfer
   Trip" -- confirm it's now rejected with "The family storage invoice isn't paid yet."
   (previously this branch never matched at all, so it always fell through to "Transfer
   Trip isn't applicable for this case.").
6. **Transfer Trip success path**: mark that same invoice paid, click the button again --
   confirm the Transfer Trip is now created correctly.
7. **Kingston unaffected**: confirm a Kingston First Call Deal at "DFH Not Selected" still
   shows "Kingston First Call cases don't need a Transfer Trip." with no payment check.

## Open items for Andrea
- Confirm the "Daily Storage For Removal" product pick for the flat "Storage and
  Removal" line -- this is the one genuine guess in this build.
- Confirm the `Status == "Completed"` embalming signal is correct (vs.
  `Embalming_Report_Uploaded`).
- Provide the correct embalming product to CC once the workflow is live, using the
  workflow URL from Part A step 3.
