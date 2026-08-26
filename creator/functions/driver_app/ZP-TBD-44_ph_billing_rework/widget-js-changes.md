# Widget JS changes -- Driver App (app/app.js)

Not a `.ds` file -- edited directly in the local repo
(`d:\Office\Andrea_Projects\DFH\widgets\driverApp\driverApp\app\app.js`), per the project's
Creator-.ds-only guideline rule. Part of ZP-TBD-44 (PH Billing rework, items 1-4 -- see
`crm/functions/deals/ZP-TBD-44_ph_billing_rework/metadata.md` for the full feature).

## Autopsy reschedule reason options

The single `"Autopsy not done"` option (widget key `notdone`) is split into two, so the driver
can record whether the family or the police officer failed to show -- previously both were
indistinguishable under one option, which meant no-show billing could never be routed correctly.

```js
// before
var reasons = [['xray','X-ray required'],['notdone','Autopsy not done'],['dfh','Problem caused by DFH']];

// after
var reasons = [['xray','X-ray required'],['family_noshow','Family did not show'],['officer_noshow','Officer did not show'],['dfh','Problem caused by DFH']];
```

No other JS changes needed -- `setAutopsyReschedule()` / `saveAutopsyDisposition()` already pass
`d.reschedule` through generically regardless of which key is selected, POSTing it as
`rescheduleReason` to `Save_Autopsy_Disposition` exactly as before. The corresponding
`Driver_App.ds` `rescheduleMap` (Creator side) and the CRM `Operations.Reschedule_Reason`
picklist / `handleAutopsyReschedule` function were updated to match -- see the CRM-side
metadata.md for the full chain.

## Registration Number placement (items 13-14)

**Item 13 -- removed from the hospital multi-deceased check-in screen.** `hospMorgueCard`
(hospital screen) had its own Registration Number input; removed entirely. Left untouched on the
police/regular screen (`autopsyCheckinHtml`), which still has it.

```js
// removed from hospMorgueCard's body string
+ '<label class="field-lbl">Registration Number</label>'
+ '<input type="text" class="van-select"' + ro + ' value="' + jsAttr(b.Registration_Number || '') + '" oninput="hospSetField(' + u + ',\'Registration_Number\',this.value)" placeholder="Pre-printed registration #">'
```

**Item 14 -- now required before "Complete Trip" enables**, for every deceased not already in
DFH's care (`d.inCare !== 'Yes'` -- those are exactly the ones the morgue check-in fields, and
Registration Number, apply to). In `renderAutopsyBatchInner()`:

```js
// before
var done = 0;
for (var i = 0; i < bodies.length; i++){ if (bodies[i].outcome) done++; }
var pending = bodies.length - done;

// after
var done = 0;
var regMissing = 0;
for (var i = 0; i < bodies.length; i++){
  var bd = bodies[i];
  var regOk = (bd.inCare === 'Yes') || !!(bd.checkinRegistrationNumber && ('' + bd.checkinRegistrationNumber).trim());
  if (!regOk) regMissing++;
  if (bd.outcome && regOk) done++;
}
var pending = bodies.length - done;
```

Bottom helper text also updated to say "Enter the Registration Number for every deceased not
already in DFH's care to complete." when that's specifically what's blocking completion, instead
of the generic "Set an outcome for every deceased" message.
