# ZP-TBD-41 — Walk-in invoice items missing from TM details view and Driver Sheet

Reported by Andrea: Deal **Gifford McFarlane**
(`https://crm.zoho.com/crm/org871210233/tab/Potentials/6503357000070754085`) has a walk-in
invoice — **Walk in Invoice - INV-MB-2026-000185** (id `6503357000079229230`, Invoiced_Items
`6503357000079229231/232/233`) — with 3 Flowers line items (Wreath (MOM/DAD), Letter Wreath ×8,
Letter Wreath ×3). None of these show up as a load-list item in the Trip Manager details view
or on the emailed Driver Sheet for the Deal's trip (`6503357000077249015`).

## Root cause — two separate gaps, confirmed live

The Deal's own `Product_Selection` subform never contains walk-in items (confirmed on this
Deal — no Flowers rows). Walk-in invoices are created outside `Product_Selection` and instead
create a standalone Sales Order (`automation.createSalesOrderAndInvoicePayerWalkInInvoice`).
So anything reading only `Product_Selection` will always miss walk-in flowers/caskets — the
code has to separately pull the Deal's related walk-in Invoices and their `Invoiced_Items`.

**1. Driver Sheet (`button.sendDriverSheet`, CRM function `senddriversheet`) — has the
walk-in merge logic, but it's broken by a variable-name bug.** It correctly loops the Deal's
walk-in Invoices, finds `Invoiced_Items` rows where `Parent_Product.name == "Flowers"` (or
`"Caskets"`), but when adding the match it reads `item.get("Product_Name")` instead of
`relatedInvoiceItem.get("Product_Name")` — `item` is a stale loop variable left over from the
**earlier**, unrelated `for each item in lineItemList` loop above it (which iterates the Deal's
own `Product_Selection`, not invoice items — `Product_Selection` rows don't even have a
`Product_Name` field, they have `Child_Product`). So `item.get("Product_Name")` is null,
`.get("name")` throws, the `catch` silently swallows it, and nothing is ever added. This bug
fires on every walk-in invoice for every Deal — not specific to this one. See guideline.md §1.

**2. TM details view (`getTripDetail` in `Trip_Manager.ds`) — has no walk-in-invoice merge at
all.** `deal_merchandise` is built purely from `dealRec.get("Product_Selection")`; there is no
equivalent of the walk-in-Invoices COQL join. (That join *does* exist elsewhere in the same
file — `getDailyFuneralRollup`, steps 5–6, explicitly commented `"Driver App step 6"` — so the
pattern to copy already exists and is proven live.) See guideline.md §2.

**TM widget's own in-app Driver Sheet option is the same gap as #2, not a third bug.**
`getDriverSheetPrintData(tripId)` — what the TM widget's own "Driver Sheet" print/preview option
calls — is a one-line wrapper: `return thisapp.getTripDetail(tripId);`. So it shares
`getTripDetail`'s data exactly. There are three driver-sheet-shaped surfaces in total:

| Surface | Function | Fixed by |
|---|---|---|
| Emailed PDF driver sheet | `button.sendDriverSheet` (CRM function `senddriversheet`) | §1 |
| TM widget's in-app Driver Sheet print/preview | `getDriverSheetPrintData` → `getTripDetail` | §2 |
| TM details view | `getTripDetail` | §2 |

## Scope

Fixing #1 alone (the one-line CRM function fix) would have caught this specific Deal's *emailed*
driver sheet only. Fixing #2 is needed so the TM widget's details screen **and** its own in-app
Driver Sheet option also show walk-in flowers/caskets — both read through `getTripDetail`, so one
fix in that function closes both. Recommend doing both §1 and §2 together since §2's fix is a
copy of already-proven logic from the same file.

## Status

**Guideline only, not yet applied.** Per project convention: `senddriversheet` is a live CRM
function — apply guideline.md §1 directly in CRM function editor. `Trip_Manager.ds` is a Creator
form script — guideline.md §2 must be applied by the user in Form Builder / Deluge editor, not
edited directly here.
