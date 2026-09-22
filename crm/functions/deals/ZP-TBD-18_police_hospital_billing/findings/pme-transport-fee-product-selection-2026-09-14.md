# PME Transport Fee products (Archers/Tranquillity/Doyles/Kris Radiology) — how selection actually works

Requested by Andrea, 2026-09-14: she found 8 live Products (Archers, Tranquillity, Doyles,
Kris Radiology — each with a one-way and a round-trip variant) all sitting under the same
Parent_Product and the same Product_Category, and wants the actual selection mechanism
documented — which facility, one-way vs round-trip, why police-only, what happens when a
new facility is added. Not a pricing/design question — she wants the mechanism.

## The 8 products, confirmed live (Products module, 2026-09-14)

| Product | id | Parent_Product | Product_Category | Unit_Price |
|---|---|---|---|---|
| Archers PM Trip O/W | `6503357000079200120` | IFSLM (`6503357000020022236`) | PME Transport Fee | 167 |
| Archers PM Trip R/T | `6503357000079200123` | IFSLM | PME Transport Fee | 334 |
| Tranquillity PM Trip O/W | `6503357000079200103` | IFSLM | PME Transport Fee | 180 |
| Tranquillity PM Trip R/T | `6503357000079200106` | IFSLM | PME Transport Fee | 360 |
| Doyles PM Trip O/W | `6503357000079200130` | IFSLM | PME Transport Fee | 59 |
| Doyles PM Trip R/T | `6503357000079200133` | IFSLM | PME Transport Fee | 108 |
| Kris Radiology PM Trip O/W | `6503357000079200136` | IFSLM | PME Transport Fee | 179 |
| Kris Radiology PM Trip R/T | `6503357000079200139` | IFSLM | PME Transport Fee | 348 |

All 8 have `Product_of_This_Hospital` blank/null. **Andrea is right: Parent_Product +
Product_Category is identical across all 8 — that pair alone cannot pick one.** Some other
field or piece of code would have to disambiguate by facility name and by O/W vs R/T.

## What was checked to find that "some other field or code"

Every live Deluge function that could plausibly bill a police/autopsy/PME trip was pulled
fresh via `getFunctionCode` on 2026-09-14 (not read from any prior doc or repo copy, per
this project's live-source-first rule) and searched for any reference to
`Product_Category = 'PME Transport Fee'` that is NOT scoped by `Product_of_This_Hospital`
(the hospital-side products under CRH/NCH/UHWI/HIH use that same category name too, but are
a separate, already-working mechanism — see Not This below):

1. **`automation.CreateSalesOrderforPoliceCase`** (id `6503357000003436189`) — the main
   Police billing function. Confirmed live 2026-09-14 in full. It resolves the Autopsy Trip
   line item via `Parent_Product = '6503357000020022236' and Product_Category = 'Autopsy
   Trip'` — a **different** category (`'Autopsy Trip'`, singular product) from `'PME
   Transport Fee'`. Facility is handled entirely through KM quantity, not product choice:
   the trip's `Autopsy_Location` lookup resolves to an Account, and if that Account's
   `Autopsy_Fixed_KM` field is set, that fixed KM becomes the billed quantity against the
   *one* Autopsy Trip product. No reference anywhere in this function to `'PME Transport
   Fee'`, `Archers`, `Tranquillity`, `Doyles`, or `Radiology`.
2. **`automation.createSalesOrderForHospitalCase`** (id `6503357000003769347`) — confirmed
   live 2026-09-14 in full. It does query `Product_Category = 'PME Transport Fee'`, but
   always scoped `Product_of_This_Hospital = '<Selected_Hospital id>'` and gated behind two
   specific hardcoded hospital ids (`6503357000022426824` = Cornwall Regional,
   `6503357000022426825` = National Chest). Since the 8 products above all have
   `Product_of_This_Hospital` blank, this function's queries can never match any of them.
3. **`automation.handleAutopsyReschedule`** (id `6503357000078744177`) — confirmed live
   2026-09-14 in full. Its X-ray branch resolves the fee via `Product_Category = 'X-ray
   Trip'` — a single, separate product (`X-ray Trip`, id `6503357000079403026`), not any of
   the 4 "Kris Radiology PM Trip" products. No reference to `'PME Transport Fee'` or any of
   the 8 facility names anywhere in this function.

**Not This** — the hospital `'PME Transport Fee'`/`'PME Fee'` products (tagged to Cornwall
Regional and National Chest via `Product_of_This_Hospital`) are a real, working, separate
mechanism inside `createSalesOrderForHospitalCase`, driven by `Hospital_Autopsy_Location`
containing `"DFH"` or `"2"`. That mechanism has nothing to do with the 8 Archers/
Tranquillity/Doyles/Kris Radiology products — it just happens to reuse the same category
label.

## Conclusion: there is no live selection mechanism for these 8 products today

No automation anywhere in the org currently reads `Product_Name`, an O/W-vs-R/T flag, or a
per-deceased facility field to pick among the 8. They are not wired into
`CreateSalesOrderforPoliceCase`, `createSalesOrderForHospitalCase`, or
`handleAutopsyReschedule` — the three functions that own every other police/autopsy billing
line item in the system. Given this team's established pattern (the `X-ray Trip` product and
the hospital PME products both sat in the catalog, fully priced, for days-to-weeks before
code was written to select them — see `billing-code-map-2026-08-19.md` §Open Questions item
7), these 8 read as products **staged ahead of a build that hasn't been wired up yet**, not
a mechanism that's live and just underdocumented.

### Answering the four questions directly

- **Which facility?** No code determines this today. Nothing reads `Autopsy_Location`,
  `Selected_Hospital`, or any other field to choose between Archers/Tranquillity/Doyles/Kris
  Radiology. If these are being billed today, it is by a person manually adding the
  correctly-named line item to a Sales Order/Quote — Parent+Category alone, in that manual
  product picker, gives no help narrowing to one, which is exactly the ambiguity Andrea
  found.
- **One-way or round-trip?** Same answer — no field or automation flag exists anywhere in
  the Deals/Trips/Operations schema (checked as part of this pass) that distinguishes O/W
  from R/T. It's a manual judgment call at line-item-entry time, same as the facility choice.
- **Police-only?** All 8 sit under `Parent_Product = IFSLM`, which is the parent every
  Police-side function uses (`CreateSalesOrderforPoliceCase`'s hardcoded parent id matches
  exactly). No Hospital-side function ever queries this parent. So in practice these can only
  sensibly be added to a Police Sales Order — but that's a naming/organizational convention,
  not an enforced code rule; nothing stops a user from manually attaching one of these 8 to
  a Hospital Sales Order.
- **What happens when a new facility is added?** Nothing automated, because nothing
  automated exists yet. Today, "adding a facility" just means creating two more Products
  (O/W + R/T) under the same Parent_Product/Product_Category by hand — which is exactly
  how Kris Radiology was added alongside the original three. If/when this gets wired into
  code (most naturally as a COQL lookup keyed on the trip's actual facility + a direction
  flag, mirroring the pattern already used for `'Autopsy Trip'`/`'Pickup'`/`'Storage'`
  elsewhere in these same functions), a new facility would then need that same facility
  identifier set on its Account (or wherever the direction/facility signal is decided to
  live) — same shape as `Autopsy_Fixed_KM` today.

## Follow-up: Andrea pushed back, exhaustive re-check confirms the same result

Andrea's own framing (received back via her round-2 doc, `PH_BILLING_DEV_ROUND2_20260831.md`
item 12): "The design is correct and is not being questioned... the code must be selecting on
something further." That's a direct claim that live code does this today. Re-checked rather
than assumed either way, per this project's live-source-first rule — pulled/scanned every
remaining plausible candidate, not just the three functions above:

- `automation.updateSalesOrderOnNumberOfDistanceinKMUpdate` (id `6503357000016798029`, the
  Trips field-update function that carries the 3 hardcoded fixed-KM overrides) — pulled live
  in full. Confirmed it still only overrides KM **quantity** on the single `'Autopsy Trip'`
  product via 3 hardcoded Account ids (Archers/Tranquillity/Doyles equivalents at 167/180/54
  km) — no fourth override for Kris Radiology, no reference to `'PME Transport Fee'` or any
  of the 8 product ids/names.
- `standalone.patchAutopsyTripQuantityOnSalesOrder` and its sibling
  `patchPickupQuantityOnSalesOrder` (repo copies, confirmed previously matching live
  byte-for-byte per this ticket's Round 2 note) — same single-product `'Autopsy Trip'`
  category lookup, no facility branching.
- `automation.updateSalesOrderForNewTrips` (id `6503357000003436498`) and
  `automation.OnDeleteupdateExistingSalesOrder` (id `6503357000003436642`) — both pulled live
  in full. Both are a separate, older KM-total mechanism for Transfer/Document
  Pickup/Airport Pickup/Pre-Visit/Initial-Pickup trip types, keyed to a fixed set of
  hardcoded generic product ids. No reference to `'PME Transport Fee'` or the 8 facility
  names.
- **Every** workflow-attached function on Trips (25 total) and Operations (4 total) —
  listed by name via `getAllAutomationFunctions`. Nothing named anything resembling PME,
  Radiology, PM Trip, Archers, Tranquillity, or Doyles exists outside the `Autopsy_Fixed_KM`
  mechanism already covered above.
- Scanned all ~65 Deals-module workflow-attached function names the same way. Same result —
  nothing matches.

**This doesn't change the finding: no live automation function anywhere in the org currently
references these 8 products or discriminates by facility name / O/W vs R/T.** If Andrea has
a specific function name in mind that does this, naming it would let this be checked
directly and immediately — that's a 30-second confirmation either way, faster than more
scanning. Otherwise the working hypothesis stays: correct selection today depends on a human
choosing the right one of the 8 by name at line-item-entry time (Sales Order/Quote product
picker), which is exactly the ambiguity that prompted the question — the *design* (facility ×
direction, police-only) is sound, but nothing in code enforces or automates it yet.

## Open question for Andrea

Is the intent to **replace** the existing single-product, KM-quantity `'Autopsy Trip'`
mechanism (Parent+Category='Autopsy Trip', quantity driven by `Autopsy_Fixed_KM`) with these
8 named, flat-priced O/W/R/T products? Or are these a **separate** billing scenario (e.g.
specifically for post-mortem/radiology *transport* legs, distinct from the main autopsy
trip)? The two mechanisms currently coexist in the Products module with no code connecting
either to the 8 new products, so this needs a decision before any code gets written, not
just a wiring task.
