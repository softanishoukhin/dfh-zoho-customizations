Task ID: ZP-TBD-102
Zoho App: Creator -- Casket Management (widget "Caskets to Build", portal profile "Casket Manager")
Requested by: Andrea / Dale, 2026-10-05 call -- "DFH_Ops_App_and_Family_Viewing_Requests_2026-10-05.md",
section "Casket Management app (casket manager): dev changes"; confirmed by Andrea 2026-10-07.
Status: built 2026-10-07; widget tested locally against a mocked SDK; NOT deployed.

## Problem
The "Edited -- review" tile counted every casket whose current spec differs from the spec snapshot
taken the first time the casket loaded (Operations.Casket_Spec_Snapshot). The snapshot never moves
on, so once a casket was edited it stayed "edited" for good -- the casket manager had to read the whole
list (42 at the time) to find what was new.

## What changes (outcome)
- The tile is now **New edits** and counts edits the casket manager hasn't seen yet.
- Clicking it opens the **edit queue**: one line per edit (casket + field), with old -> new, when it
  was edited, and a **Mark as seen** button. **Mark all as seen** clears the queue in one go.
- A seen edit leaves the queue and stops counting as new. **Show seen edits (n)** shows them again, greyed,
  with who saw them and when, at the TOP under "Seen edits", above "Not seen yet". (2026-10-07 fix: the
  seen lines used to be added at the bottom of the queue, so in a long queue the button looked like it did nothing.)
- If the same field is changed again later, that newer edit comes back as new.
- On the casket cards the amber "changed" flag only shows for edits not yet seen; seen ones show
  "edited . seen" and the old -> new value in grey.

## How it works (technical)
- An edit = one field group whose current value differs from the snapshot -- exactly the comparisons
  the widget already used (`rowHasEdits`): Casket Type (not for Full Body Repatriation, only when the
  snapshot had one), Colours (primary/secondary together), Handles, Special Instructions, Funeral Date.
- Edit key = `<Operations id>|<group>|<that group's change stamp>|<short hash of the new value>` using
  the existing Operations stamps Casket_Type_Changed_On / Colors_Changed_On / Handles_Changed_On /
  Special_Instructions_Changed_On / Funeral_Date_Changed_On. A new change -> new stamp and/or new value
  -> new key -> new again. (2026-10-07 fix: in testing the stamp was empty on the test casket -- shown as
  "Edited (date not recorded)" -- so the value hash was added; without it a second change to the same
  field would have stayed "seen". Keys saved before this fix no longer match, so edits marked seen
  before the re-upload show as new once more.)
- 2026-10-07 root cause of the empty stamps: no CRM workflow calls the casket* stamp functions, so the
  stamps were empty on every Operations record. The fix is a block in the CRM dispatcher
  `handleWorkflowTriggerAndActionByTimelineProcess`. See
  `crm\functions\deals\ZP-TBD-102_casket_change_stamps\metadata.md`.
- Seen keys are stored in a NEW Creator form `Casket_Edit_Ack` in this app (nothing new in CRM).
- New functions `casketEditAcks()` (GET list of seen keys) and `acknowledgeCasketEdits(editsJson)`
  (POST, records keys, skips ones already recorded). The existing `casketBuildList` and
  `updateCasketFields` are NOT changed.
- The widget loads the seen list together with the casket list; if that call fails the casket list
  still loads and a warning says every edit shows as new.

## Files
- `casket_edit_queue_functions.deluge` -- the 2 new functions.
- `widget/widget.html` -- repo copy of `D:\Office\Andrea_Projects\DFH\widgets\casketManagement\casketManagementWidget\app\widget.html`;
  packed `casketManagementWidget\dist\casketManagementWidget.zip`.

## Deploy -- Casket Management app (guideline; the .ds is not edited)
1. **New form** `Casket_Edit_Ack` (label "Casket Edit Ack"). Fields, all **Single Line**, no mandatory:
   | Field link name | Type |
   |---|---|
   | Edit_Key | Single Line |
   | Operations_ID | Single Line |
   | Deceased_Name | Single Line |
   | Field_Name | Single Line |
   | Acknowledged_By | Single Line |
   | Acknowledged_At | Single Line |
2. **Functions** (Workflow > Functions > New Function, Deluge): `casketEditAcks`, then
   `acknowledgeCasketEdits` from `casket_edit_queue_functions.deluge`.
3. **Custom APIs** (Microservices > Custom API), same settings as the existing `Casket_Build_List` /
   `Update_Casket_Field` APIs (OAuth2, user scope incl. the **Casket Manager** portal profile, Standard):
   | Custom API (link name) | Method | Function | Parameters |
   |---|---|---|---|
   | Casket_Edit_Acks | GET | casketEditAcks | -- |
   | Acknowledge_Casket_Edits | POST | acknowledgeCasketEdits | editsJson (from body) |
4. **Portal profile "Casket Manager"**: allow the two new Custom APIs (like the existing two).
5. **Widget**: upload `casketManagementWidget.zip` over the existing "Caskets to Build" widget
   (index `/app/widget.html`).

## First use
After deploy every existing edit shows as new once (nothing has been marked seen yet). The casket
manager can clear the backlog with **Mark all as seen**; from then on only new edits appear.

## Test
1. Open Caskets to Build. The **New edits** tile shows a number; click it -> one line per edit.
2. Click **Mark as seen** on one line -> it disappears, the number goes down by 1.
3. Click **Show seen edits** -> the line is back, greyed, "Seen by <you> . <time>".
4. Refresh the page -> it is still seen (saved in Casket_Edit_Ack).
5. In CRM change that casket's colours again -> Refresh -> the Colours edit is back as new.
6. **Mark all as seen** -> 0 new edits; the cards show "edited . seen" instead of "changed".

## Option not built
Dale also mentioned a notification for each new edit. Not built; the queue covers the need. Can be
added later (e.g. an email/Cliq message from the CRM workflows that set the ..._Changed_On stamps).
