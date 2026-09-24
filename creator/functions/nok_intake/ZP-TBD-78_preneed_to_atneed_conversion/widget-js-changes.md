# ZP-TBD-78 -- NOKIntake widget changes (APPLIED 2026-09-24 in `widgets/NOKIntake/NOKIntake/app`)

Direct edits (widget JS/HTML are editable directly; the `.ds` is guideline-only, see `guideline.md`).
`node --check app/app.js` passes. **Not yet deployed / not yet tested live.**

## `app/widget.html`
- New optional row `wrap_Deceased_DOB` / input `#Date_of_Birth` (type=date) right under Deceased Name,
  hidden by default.

## `app/app.js`
| Change | Detail |
|---|---|
| DOB visibility | `wrap_Deceased_DOB` added to `DECEASED_TAB_FIELDS` and to `deceasedFields` for **First Call, Hospital, Police only** (other deal types never see it). |
| DOB payload | `buildData()` sends `"Date_of_Birth": vDate("Date_of_Birth")` (same dd-MMM-yyyy convention as Date_of_Death; blank values are stripped by `clean()`). Both prefill paths now `setVal('Date_of_Birth', isoFromDMY(d.Date_of_Birth))`. |
| Pre-Need check | New `PRENEED_CHECK_DEAL_TYPES`, `checkPreNeedBeforeSubmit()`, `showPreNeedConfirm()`. Calls `callApi('checkPreNeed', {name, dob})` (guideline.md step 3). Brand-new First Call / Hospital / Police records with a name only; skipped in edit mode (`SYS.deal_id`) and when the duplicate-Deal popup already matched a Deal. |
| Popup | Text: "There is a matching Pre Need Account with this name. Verify the DOB and Address (if available) to confirm the match." Shows Name / DOB / Address per match (click a card to pick when there are several) + Confirm / Cancel. Built with DOM `.textContent` only. |
| Confirm | `Matched_PreNeed_Account_Id = <Account id>` added to the `addRecords` payload. |
| Cancel | Means "not the same person" (decision confirmed with the developer): submit carries on as a normal new record and `PreNeed_Not_A_Match = true` is sent. |
| `submit()` | Refactored into two `.then` steps (duplicate check -> Pre-Need check -> save). The "Checking..." overlay is hidden while the popup is up. Any lookup failure resolves to "carry on" -- a backend hiccup never blocks a real submission. |

## Deploy-order dependency
`Matched_PreNeed_Account_Id` and `PreNeed_Not_A_Match` must exist on the Creator form
**before** this widget is uploaded, otherwise `addRecords` would be posting unknown fields. The
`checkPreNeed` lookup action is the other half -- without it the popup simply never appears.
Build/upload: same `zet pack` + Index File `/widget.html` procedure as every other NOKIntake release.
