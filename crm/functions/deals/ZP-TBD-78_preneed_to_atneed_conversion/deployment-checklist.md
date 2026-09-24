# ZP-TBD-78 -- deployment checklist (do in this order)

Nothing has been deployed. Every step is manual (no write API for CRM fields/rules/buttons or Creator
`.ds` from this session).

## 1. CRM fields (Setup > Customization > Modules and Fields)
- [ ] **Deals** -> add `Pre_Need_Status` -- Pick List: `Matched`, `Possible Match`, `Not a Match`.
      Confirm the API name is exactly `Pre_Need_Status` (label e.g. "Pre-Need Status").
- [ ] **Deals** -> add `Pre_Need_Possible_Matches` -- Multi Line (Large, 32000). API name exactly
      `Pre_Need_Possible_Matches` (label "Possible Pre-Need Matches").
- [ ] **Deceased_Pickups** -> add `Matched_PreNeed_Account_Id` -- Single Line.
- [ ] **Deceased_Pickups** -> add `PreNeed_Not_A_Match` -- Checkbox.
- [ ] Add both Deals fields to the Police / Hospital / First Call layouts (layout id
      `6503357000000091023` = Standard-type layout used by Police/Hospital; First Call uses
      `6503357000008248362`). Put them in a section "Pre-Need" near the top so the alert is obvious.
- [ ] **Alert on the Deal** (layout rule, Setup > Modules > Deals > Layouts > Layout Rules): when
      `Pre_Need_Status` = "Possible Match" -> show + make read-only the `Pre_Need_Possible_Matches`
      field, and set the section header to a warning colour. (Optional but recommended: create a
      Deals custom view "Possible Pre-Need Match" = Pre_Need_Status is "Possible Match" so staff have a
      worklist.)

## 2. CRM functions (Setup > Developer Space > Functions)
- [ ] New **Standalone** `findPreNeedMatches` -- paste `findPreNeedMatches.deluge`. Save; confirm API
      name `findpreneedmatches`. Connection `zohooauth`.
- [ ] New **Standalone** `linkPreNeedToDeal` -- paste `linkPreNeedToDeal.deluge`. Confirm API name
      `linkpreneedtodeal`. Connection `zohooauth` must have Accounts delete + Notes create scope; if the
      connection lacks them the function reports the failed step in its result / `info` log and the
      duplicate is left "flagged" instead of deleted.
- [ ] New **Automation** `flagPossiblePreNeedMatch` -- paste `flagPossiblePreNeedMatch.deluge`.
      Argument `dealId` (String).
- [ ] **Re-pull `onDeceasedPickupCreate` from live and diff it against
      `onDeceasedPickupCreate_MERGED.deluge`.** The only differences must be the three blocks marked
      `ZP-TBD-78` (plus the `else {` wrapper around the Account creation). If the live function has
      changed since 2026-09-24, re-apply just those three blocks to the new live code instead.
      Then paste the merged version. *(Do this only AFTER step 1 -- the function reads the two new
      Deceased_Pickups fields.)*

## 3. Workflow rules (Setup > Automation > Workflow Rules, module Deals)
- [ ] **"Flag possible Pre-Need match - on create"** -- Execute on: Create. Criteria: `Type` is
      `First Call` OR `Hospital` OR `Police`. Action: Function `flagPossiblePreNeedMatch`,
      `dealId` = Deals Id.
- [ ] **"Flag possible Pre-Need match - name or DOB changed"** -- Execute on: Edit, "When specific
      field(s) are modified": `Name_of_Deceased`, `Date_of_Birth`. Same criteria + same action.
      (Hospital/Police cases are often created as "Unknown Deceased" and named later.)
- [ ] Check the existing Deals Create/Edit rules for anything keyed on `Pre_Need_*` -- none found
      (`getFields` shows no prior Pre-Need-status field), so no conflict expected.

## 4. Link button + widget
- [ ] Build/upload `widgets/linkPreNeed/linkPreNeedWidget` (same `zet pack` procedure as
      `preNeedFromContactWidget`; Index File `/widget.html`; `plugin-manifest.json` service = CRM).
- [ ] Setup > Customization > Modules > **Deals** > Links & Buttons > New Button:
      name "Link Pre-Need", placement **Details Page**, action **Widget** -> the uploaded widget
      (open as a popup). Add it to the First Call / Hospital / Police layouts. Profile access: the
      same roles that work Police/Hospital/First Call cases.

## 5. Creator (NOKIntake) -- guideline, applied by hand
- [ ] Follow `creator/functions/nok_intake/ZP-TBD-78_preneed_to_atneed_conversion/guideline.md`
      sections 1 -> 6 in order (form fields first, then `checkPreNeedMatch`, `widgetLookup` branch,
      `accountManagement`, `dealInformationManagementV2`, the two pickup blocks).
- [ ] Only after the form fields exist: build + upload the NOKIntake widget (`app/app.js`,
      `app/widget.html` already edited).

## 6. Smoke test before telling Andrea
Run test-cases.md TC-A1 (First Call match), TC-B1 (Hospital, missed at Intake), TC-C1 (link +
duplicate deleted) -- these three prove all three parts end to end.
