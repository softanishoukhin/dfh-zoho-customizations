Task ID: ZP-TBD-103
Zoho Apps: CRM (Products) + Funeral Preparation app + Driver App + Trip Manager
Requested by: Andrea, 2026-10-07 -- "funeral equipment is a great parent product category suggestion ...
please move forward with that and set that up and fold that into the new funeral app where the load list
stuff displays".
Status: built 2026-10-07, NOT deployed.

## Outcome
- A new parent product **Funeral Equipment** holds hearse items that aren't florals, merchandise or
  programmes: Easel, Lighting, and anything added later.
- Funeral Equipment lines show on every load list: the Funeral Preparation checklist (Section 4), the
  Driver App "Load the car" list, and the Trip Manager Daily Funeral Report / Driver Sheet (under Items).
- Lighting still drives "Lighting required: Yes" in the Funeral Preparation checklist (Section 3), and
  Easel / Lighting stay out of the programme count (Section 5).
- Deals that already have Easel / Lighting under Programs keep showing them (Programs is still on the list).

## Why code changes are needed
All load lists pick up Product Selection / walk-in invoice lines by the parent product's NAME, exactly
"Flowers", "Cremation Merchandise" or "Programs". "Funeral Equipment" is added to that rule in each place.

## Deploy -- in this order

### Step 1 -- CRM: the parent product
1. CRM > Products: create **Funeral Equipment** the same way the existing parent product **Programs** is
   set up (same kind of record, same settings, price $0). The name must be exactly `Funeral Equipment`.
2. Open the products **Easel** and **Lighting** and change their parent from Programs to
   **Funeral Equipment** (the same field that links them to Programs today). Save.
3. From now on add Easel / Lighting to a Deal's Product Selection under parent **Funeral Equipment**.
(The CRM connector was not available when this was written, so the exact field names on the Product
record weren't re-checked -- mirror whatever Programs uses.)

### Step 2 -- Funeral Preparation app
Workflow > Functions > `fpLoadList` > replace the body with the `fpLoadList` function from
`../ZP-TBD-100_funeral_preparation_app/funeral_prep_functions.deluge` (2 conditions now include
"Funeral Equipment"). Upload `FuneralPrep\FuneralPrepWidget\dist\FuneralPrepWidget.zip` to BOTH widgets
(index `/app/viewing.html` and `/app/prep.html`) -- only a message text changed.

### Step 3 -- Driver App (guideline; the .ds is not edited)
Function **getFuneralStartInfo** -- 2 lines:
- Find:    `if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs")`
  Replace: `if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs" || parentName == "Funeral Equipment")`
- Find:    `if(invParentName == "Flowers" || invParentName == "Cremation Merchandise" || invParentName == "Programs")`
  Replace: `if(invParentName == "Flowers" || invParentName == "Cremation Merchandise" || invParentName == "Programs" || invParentName == "Funeral Equipment")`
No widget change: the Driver App prints each item with its category.

### Step 4 -- Trip Manager (guideline; the .ds is not edited)
Function **getDailyFuneralRollup** -- 2 identical lines (Product Selection and walk-in invoice):
- Find:    `if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs")`
  Replace: `if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs" || parentName == "Funeral Equipment")`
Function **getTripDetail** -- 2 lines:
- Find:    `if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs")`
  Replace: `if(parentName == "Flowers" || parentName == "Cremation Merchandise" || parentName == "Programs" || parentName == "Funeral Equipment")`
- Find:    `if(wParentName == "Flowers" || wParentName == "Cremation Merchandise" || wParentName == "Programs")`
  Replace: `if(wParentName == "Flowers" || wParentName == "Cremation Merchandise" || wParentName == "Programs" || wParentName == "Funeral Equipment")`
No widget change: Trip Manager shows non-Flowers lines under "Items".
(Lines taken from the Trip_Manager.ds / Driver_App.ds exports of 2026-10-06; none of these functions
changed since.)

## Test
1. Deal with a funeral tomorrow: add **Easel** and **Lighting** under parent Funeral Equipment, save.
2. Funeral Preparation > Funeral Prep > open the funeral: Section 4 lists Easel and Lighting
   (category Funeral Equipment); Section 3 says Lighting required: Yes; Section 5 doesn't count them.
3. Driver App: open the funeral trip -> "Load the car" lists Easel and Lighting (Funeral Equipment).
4. Trip Manager: Daily Funeral Report / Driver Sheet for that funeral lists them under Items.
5. A Deal that still has Lighting under Programs keeps showing it everywhere.
