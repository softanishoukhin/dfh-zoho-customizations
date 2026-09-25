Task ID: ZP-TBD-79
Zoho App: CRM (1 new Deals field, 1 new Button function, 1 Deals detail-page button)
Source: `D:\Office\Andrea_Projects\DFH\projectDocuments\Get Pre Need Info.txt`
Depends on: ZP-TBD-78 (Link Pre-Need) -- the At-Need Deal must already be `Pre_Need_Status = Matched`.
Status: **built 2026-09-25 as guideline -- NOT deployed, NOT tested.**

## Requirement (from the task doc)
After the Pre-Need is linked, a new Deal button **Get Pre Need Info** pulls everything relevant from
the Pre-Need setup into the At-Need Deal (questionnaire, church, obituary, funeral wishes,
burial/cremation choice, contacts, products, payments, other equivalent fields) and moves the Deal
from First Call / Hospital / Police into the real funeral type (Funeral with Burial, Cremation with
Service, Cremation Only).

## Decisions (developer, 2026-09-25)
| Question | Decision |
|---|---|
| Burial / cremation type | Burial -> `Funeral w/Burial`. Cremation -> `Cremation with Service` **for now**. The "Cremation Only" rule is **pending Andrea**. |
| Existing At-Need values | **Blank fields only** -- nothing intake entered is overwritten. |
| Product price | **Keep the Pre-Need contract price.** |
| Remaining installments / reminders | **Not stopped** for now -- **pending Andrea**. |
| Hospital / Police Deals | Converted **in place** (same Deal), like First Call. |

## Facts confirmed live 2026-09-25 (DFH CRM org 871210233)
- **Deals are converted in place today.** In the last 200 Deals: 32 First Call -> Funeral w/Burial,
  17 Hospital -> Funeral w/Burial, 3 Police -> Funeral w/Burial, 5 FC -> Cremation with Service, etc.
  `Initial_Pipeline` keeps the origin. The old "create a new Funeral Deal from the Police/Hospital
  Deal" function `createADealFromHospitalOrPoliceCase` was used for only 2 of those 200.
- **A Type change drives the pipeline.** Workflow function `automation.updateDealPipelineOnTypeUpdate`
  calls `standalone.updatetPipelineBasedOnDealType`, which sets Pipeline + Layout + Stage "Requested"
  per Type (Funeral w/Burial -> pipeline 6503357000006886532 / layout 6503357000006886002; Cremation
  with Service -> 6503357000008248886 / 6503357000008248362; Cremation Only -> 6503357000011060073 /
  6503357000008248362). It also sends the "We are Here to Help" email + family follow-up task if not
  already sent (normal conversion behaviour). The button just sets `Type` with workflows on.
- **Type picklist spelling:** `Funeral w/Burial` (with "w/"), `Cremation with Service`, `Cremation Only`.
  `Service_Type` picklist: `Funeral with Burial` | `Cremation`.
- **The funeral Sales Order ignores the Deal row price.** Workflow "Create or Update Sales Order from
  Deals V2" (id 6503357000049124145, date/time rule on `Trigger_Based_On_Subform`) ->
  `automation.createSalesOrderForDifferentPipelines` -> `automation.createSalesOrdersForShipIns`, which
  writes `List_Price = Products.Unit_Price` (catalogue) and `Discount = row Discount`. So the button
  sets `Unit_Price` = catalogue price and `Discount` = catalogue total - contract total on each new row.
  The Quote button (`createQuoteFromDeal`) uses row Unit_Price + Discount, so Quote and SO agree.
- **`Trigger_Based_On_Subform` is stamped server-side without workflows** by
  `standalone.getCurrentDateTime` (what the Product Selection client scripts call) and the date/time
  rule still fires -- so the button reuses that call (+2 minutes, to let the pipeline move first).
- **Real Pre-Need Deals leave the funeral fields blank** (Service_Type, Casket_or_Urn, Church...) --
  the burial/cremation choice comes from the questionnaire's `Disposition_Preference`, falling back to
  the Pre-Need Deal's `Service_Type`.
- Pre-Need `Product_Selection` rows carry: Parent_Product, Child_Product, Child_Category, Quantity,
  Unit_Price, Discount, Casket_Trim_Color, Sales_Order_Row_ID (not copied -- belongs to the Pre-Need SO).
- `Pre_Need_Questionnaire` CRM module: lookup `Deal_Name` -> Deals; `Persons_Responsible` subform with
  plain-text `Name1`, `Relationship`, `Phone`.

## What this touches
| Item | Change |
|---|---|
| Deals field | +1 `Pre_Need_Deal_URL` (URL, label "Pre-Need Deal"). Records the source plan as a clickable link; the function reads the Deal id from the end of it. **Not a lookup: Deals is at its lookup-field limit** (developer, 2026-09-25). Because a URL field gives no related list on the Pre-Need Deal, the first run also adds a Note "Used for At-Need Deal" on the Pre-Need Deal. |
| `button.getPreNeedInfo` | NEW -- `getPreNeedInfo.deluge` |
| Deals button | +1 "Get Pre Need Info" (detail page) |
| Existing functions / workflows | **None changed.** Reuses the Type-change workflow, `getCurrentDateTime` and the SO workflow as they are. |

Field-by-field mapping: `field-mapping.md`.

## Known limits / open items
1. **Nothing here has run yet** -- first real run is the test pass.
2. **Cremation Only** is never chosen automatically yet (pending Andrea). Staff change the Type by hand
   for a cremation-only plan.
3. **Installments / reminders keep running** after the death (pending Andrea). The Note on the Deal says so.
4. **Catalogue cheaper than contract:** a discount cannot raise a price, so that line bills at today's
   (lower) price and the button lists it under "Please check".
5. **ZP-TBD-65 Stage 2 interaction:** `addPreNeedDifferenceLineAndFlagRetainerCredit` compares retainer
   lines with at-need invoice lines by product name. With the contract price carried over the
   difference should be ~0 -- verify in test TC-10 that no wrong "Pre-Need Difference" line appears.
6. Pre-Need Deals in Scenario 2 (historic migration, not built) need `Type = Pre Need`, the person's
   Account and ideally a questionnaire for this button to find anything.
7. The Pre-Planner address in the questionnaire is not copied to the Deal: the pre-planner can be the
   payer rather than the deceased, and the deceased's address already lives on the linked Account.
