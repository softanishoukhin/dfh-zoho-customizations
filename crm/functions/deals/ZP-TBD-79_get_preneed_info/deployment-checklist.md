# ZP-TBD-79 deployment checklist

Order matters -- the function will not save without the field.

## 1. New Deals field
Setup > Customization > Modules and Fields > Deals > layout **PC, HP** (and the Funeral / Cremation
layouts, so it shows after the pipeline moves) > drag a **URL** field (not a Lookup -- Deals is at
its lookup-field limit):
- Label: `Pre-Need Deal`   -> set / confirm the API name is exactly **`Pre_Need_Deal_URL`**
- Read-only for users is fine (only the function writes it).

## 2. Function
The function is created from the button (step 3) so it gets the `button.` category:
- Name: `getPreNeedInfo`
- Argument: `dealId` (String) mapped to **Deals - Deal Id**
- Paste the full body of `getPreNeedInfo.deluge`
- Connection `zohooauth` must be allowed (same connection as every other DFH Deal function).
- Save. It must compile with no errors -- if Deluge flags anything, send us the exact message.

## 3. Button
Setup > Customization > Modules and Fields > Deals > Links and Buttons > **Create New Button**
- Name: `Get Pre Need Info`
- Where: **In Record** (detail page)
- Action: **Writing Function** -> the function from step 2
- Layouts: all Deal layouts used by First Call, Hospital, Police, Funeral with Burial, Cremation
  (so a re-run is still possible after the pipeline moves)
- Profiles: the same profiles that have "Link Pre-Need".

## 4. Nothing else changes
No existing function, workflow rule or client script is edited. The button relies on these staying
as they are:
- Deals workflow calling `automation.updateDealPipelineOnTypeUpdate` when Type changes
- `standalone.getCurrentDateTime`
- Workflow "Create or Update Sales Order from Deals V2" (id 6503357000049124145)

## 5. Test
Run `test-cases.md`. TC-01 (field API name) and TC-06 (price lands on contract price in the SO)
gate everything else.

## Rollback
Remove the button, delete the function, then (optionally) delete the `Pre_Need_Deal_URL` field. Data
already copied onto Deals stays -- it is ordinary field data and was only ever written to blank fields.
