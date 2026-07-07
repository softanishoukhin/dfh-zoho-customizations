# Companion client-side changes (not Deluge)

Files: `NOKIntake/app/widget.html` and `NOKIntake/app/app.js` (widget JavaScript/HTML, not Zoho
functions). Full current files are the source of truth; this summarizes what was added for
Police Dropoff — entirely new code, not a modification of existing Deal Type flows.

## widget.html

- Added `<option value="Police Dropoff">Police Dropoff</option>` to the `Deal_Type` select.
- Added a new, self-contained block (`#wrap_Dropoff_Block`, hidden by default): a "Number of
  Deceased Being Dropped Off" number input (1-10, `#Dropoff_Count`), a container
  (`#dropoff_sets`) that JS populates with one repeating field-set per deceased, a dedicated
  "Submit Drop Off" button (`#dropoffSaveBtn`), and a results container (`#dropoff_results`).

## app.js

- `RULES["Police Dropoff"]` — minimal top fields only (Call Taken By, DFH Destination); no
  collapsible sections shown; everything else on the form hides for this type.
- `applyDealType()` — extended to show/hide `#wrap_Dropoff_Block`, hide the standard `#saveBtn`
  for this Deal Type, and call `renderDropoffSets()` on first display.
- New functions: `renderDropoffSets(n)` (builds 1-10 repeating deceased field sets — name/last
  name, "unidentified" checkbox that disables+clears the name fields, Date of Death, Sex,
  morgue check-in: Location/Refrigerator/Row/Drawer, Condition, Deceased Size),
  `dropoffValidate(n)`, `buildDropoffPayload(n)`, `dropoffResultCard(row)`, `submitDropoff()`,
  `printDropoffHangTag(dealId, opsId, targetId)`.
- `submitDropoff()` — **own submission path**, does NOT use `ZOHO.CREATOR.DATA.addRecords`
  (the standard path that writes to `NOK_Information_Form` and fires that form's on-success
  workflow). Instead calls the new `createPoliceDropoff` widgetLookup action directly with a
  JSON-stringified payload of all deceased in the batch. This is deliberate — see this ticket's
  `metadata.md` for why (avoids needing any change to the form's existing per-Deal-Type
  submission workflow, and avoids the resource constraints on new Deals workflows/fields).
- `printDropoffHangTag()` — calls the new `getDropoffHangTagFile` widgetLookup action, decodes
  the returned base64 PDF into a Blob, and opens it in a new tab (simpler than the Driver App's
  inline PDF viewer, since this widget has no equivalent viewer scaffolding).
- Condition options for this flow (`DROPOFF_CONDITIONS`) deliberately use the full Good/Fair/
  Decomposed scale with correct spelling, matching what `CreateSalesOrderforPoliceCase` checks
  on the Deal — NOT the older `HOSP_CONDITIONS` typo'd scale used elsewhere in this same file for
  a different (Hospital multi-deceased) flow.
