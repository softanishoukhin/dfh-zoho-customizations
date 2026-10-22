Task ID: ZP-TBD-124
Zoho App: Creator -- Casket Management (widget "Caskets to Build") + CRM Operations.Casket_Status picklist
Requested by: Andrea, 2026-10-22 (comment on the Casket Status dropdown screenshot):
"modify the casket status *Prime Complete* to reflect *At Primer*".
Status: built 2026-10-22; zip packed; NOT deployed.

## What changes (outcome)
- The Casket Status dropdown now reads **At Primer** where it used to read **Prime Complete**
  (same position: Ticket given, At Sander, **At Primer**, At Sprayer, Quilting, Delivered).
- Caskets already saved as "Prime Complete" show as **At Primer** and still count under "Built".

## How it works (technical)
`widget.html`:
- `STATUS_OPTS`: "Prime Complete" -> "At Primer".
- `BUILT_STATUSES`: "Prime Complete" -> "At Primer" (keeps the lifecycle bucket = built).
- `STATUS_ALIAS`: added `"Prime Complete":"At Primer"`. Every read goes through `normStatus()`
  (card pill, bucket, late flag, dropdown pre-select), so a record still holding the old text displays
  and buckets as At Primer. Safe to drop once nothing in CRM holds "Prime Complete".
- Save path unchanged: `Update_Casket_Field` -> `updateCasketFields` writes the chosen text to CRM
  `Operations.Casket_Status` (v6 PUT). No Deluge change.

Other readers checked: Operations App (`casket_status` on the Ops cards / reports) and the Funeral Prep
sync only display the stored text -- no hard-coded "Prime Complete" anywhere else. The Creator Ops form
picklist in Operations_App.ds has its own, unrelated value list.

## Files
- `widget/widget.html` -- repo copy of `D:\Office\Andrea_Projects\DFH\widgets\casketManagement\casketManagementWidget\app\widget.html`;
  packed `casketManagementWidget\dist\casketManagementWidget.zip` (app/widget.html, app/translations/en.json, plugin-manifest.json).

## Deploy (in this order)
1. **CRM picklist** -- Setup > Customization > Modules and Fields > Operations > layout > Casket Status >
   Edit Properties. **Rename** the option "Prime Complete" to "At Primer" (edit the existing value; do NOT
   add a new one and delete the old). Renaming carries the existing records over.
   Count before the change (2026-10-22): **11** Operations records with Casket_Status = "Prime Complete".
2. **Widget** -- upload `casketManagementWidget.zip` over the existing "Caskets to Build" widget
   (index `/app/widget.html`).
3. **Verify** -- CRM record count for `(Casket_Status:equals:Prime Complete)` = 0 and
   `(Casket_Status:equals:At Primer)` = 11 (plus any set since).

## Test
1. Open Caskets to Build, open any casket -> the Casket Status list shows At Primer (no Prime Complete).
2. Open one of the 11 caskets that were "Prime Complete" -> the dropdown pre-selects At Primer and the
   card pill reads At Primer; it counts in the Built tile.
3. Set a casket to At Primer -> Save -> Refresh -> still At Primer; in CRM the Operations record shows
   Casket Status = At Primer.
4. Set it to At Sprayer and back to At Primer -> both save.
