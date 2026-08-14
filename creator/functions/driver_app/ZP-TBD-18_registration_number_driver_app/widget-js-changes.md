# D-1 -- Driver App client-side changes (app.js)

Two separate check-in screens need the Registration Number field added -- they're
completely independent UIs backed by the two separate server functions documented in
`metadata.md`.

## A. Regular/police single-deceased check-in (`autopsyCheckinHtml`, ~line 2536)

### A1. Add the input field to the render function

Current (`app/app.js` ~line 2537-2557):
```javascript
function autopsyCheckinHtml(d){
  if (d.inCare === 'Yes') return '';
  var uid = jsAttr(d.childTripId);
  var rowVals = []; for (var ri = 1; ri <= 20; ri++){ rowVals.push('' + ri); }
  var drawerVals = ['A','B','C','D','E'];
  return '<div class="sec-lbl" style="margin-top:12px;">Morgue check-in</div>'
    + '<div class="sub-box">'
    + '<div class="fld"><label class="fld-lbl">Condition</label>'
    + '<select class="fld-inp" onchange="setAutopsyCheckinField(\'' + uid + '\',\'checkinCondition\',this.value)">' + conditionOptionsHtml(d.checkinCondition) + '</select></div>'
    + '<div class="fld"><label class="fld-lbl">Deceased size</label>'
    + '<select class="fld-inp" onchange="setAutopsyCheckinField(\'' + uid + '\',\'checkinSize\',this.value)">' + sizeOptionsHtml(d.checkinSize) + '</select></div>'
    + '<div class="fld"><label class="fld-lbl">DFH Location</label>'
    + '<select class="fld-inp" onchange="setAutopsyCheckinField(\'' + uid + '\',\'checkinLocation\',this.value)">' + decOptionsHtml(['Kingston','Montego Bay'], d.checkinLocation) + '</select></div>'
    + '<div class="fld"><label class="fld-lbl">Refrigerator</label>'
    + '<select class="fld-inp" onchange="setAutopsyCheckinField(\'' + uid + '\',\'checkinRefrigerator\',this.value)">' + decOptionsHtml(refrigeratorValsFor(d.checkinLocation), d.checkinRefrigerator) + '</select></div>'
    + '<div class="fld"><label class="fld-lbl">Row</label>'
    + '<select class="fld-inp" onchange="setAutopsyCheckinField(\'' + uid + '\',\'checkinRow\',this.value)">' + decOptionsHtml(rowVals, d.checkinRow) + '</select></div>'
    + '<div class="fld"><label class="fld-lbl">Drawer</label>'
    + '<select class="fld-inp" onchange="setAutopsyCheckinField(\'' + uid + '\',\'checkinDrawer\',this.value)">' + decOptionsHtml(drawerVals, d.checkinDrawer) + '</select></div>'
    + '</div>';
}
```

**Add** a new `.fld` block, right after Drawer (order doesn't matter, these are independent
fields -- placed last so it doesn't disturb the fridge/row/drawer grouping visually):
```javascript
    + '<div class="fld"><label class="fld-lbl">Registration Number</label>'
    + '<input type="text" class="fld-inp" value="' + jsAttr(d.checkinRegistrationNumber || '') + '" oninput="setAutopsyCheckinField(\'' + uid + '\',\'checkinRegistrationNumber\',this.value)" placeholder="Pre-printed registration #"></div>'
```
(`setAutopsyCheckinField` is already generic -- `d[field] = value; saveAutopsyCheckinFields(uid);` -- reused as-is, no changes needed to that function.)

### A2. Initialize the new state field

Current (~line 2825-2826):
```javascript
        checkinCondition: '', checkinSize: '', checkinLocation: '',
        checkinRefrigerator: '', checkinRow: '', checkinDrawer: '',
```
**Change** to:
```javascript
        checkinCondition: '', checkinSize: '', checkinLocation: '',
        checkinRefrigerator: '', checkinRow: '', checkinDrawer: '', checkinRegistrationNumber: '',
```

### A3. Send it in BOTH `Save_Morgue_Checkin` call sites

There are two places this payload is built -- the debounced auto-save, and the batch
"save family and check-in" sequential flow. Both need the new key.

**Site 1 -- `saveAutopsyCheckinFields`, ~line 2471-2480:**
```javascript
    if (d.checkinLocation && d.checkinRow && d.checkinDrawer){
      chain = chain.then(function(){
        return callApi('Save_Morgue_Checkin', 'POST', {
          tripId: d.childTripId,
          location: d.checkinLocation,
          refrigerator: d.checkinRefrigerator || '',
          row: d.checkinRow,
          drawer: d.checkinDrawer,
          registrationNumber: d.checkinRegistrationNumber || ''
        });
      });
    }
```

**Site 2 -- `autopsySaveFamilyAndCheckin`, ~line 3020-3031:** identical addition, same
`registrationNumber: d.checkinRegistrationNumber || ''` line added to that payload object.

## B. Hospital multi-deceased check-in (`renderHospitalCheckin` / per-body card, ~line 3931)

### B1. Add the input field

Current (~line 3940-3941):
```javascript
    + '<label class="field-lbl">Refrigerator<span class="field-req">*</span></label>'
    + '<select class="van-select" id="hosp-fridge-' + u + '"' + ro + ' onchange="hospSetField(' + u + ',\'Refrigerator\',this.value)">' + hospOpt(hospFridgeVals(b.Location), b.Refrigerator, 'Select…') + '</select>'
    + '<div class="two"><div>'
    + '<label class="field-lbl">Row<span class="field-req">*</span></label>'
    + '<select class="van-select"' + ro + ' onchange="hospSetField(' + u + ',\'Row\',this.value)">' + hospOpt(hospRowVals(), b.Row, 'Row…') + '</select>'
    + '</div><div>'
    + '<label class="field-lbl">Drawer<span class="field-req">*</span></label>'
    + '<select class="van-select"' + ro + ' onchange="hospSetField(' + u + ',\'Drawer\',this.value)">' + hospOpt(HOSP_DRAWERS, b.Drawer, 'Drawer…') + '</select>'
    + '</div></div>'
```
**Add**, right after the Row/Drawer `.two` div closes:
```javascript
    + '<label class="field-lbl">Registration Number</label>'
    + '<input type="text" class="van-select"' + ro + ' value="' + jsAttr(b.Registration_Number || '') + '" oninput="hospSetField(' + u + ',\'Registration_Number\',this.value)" placeholder="Pre-printed registration #">'
```
Key is `Registration_Number` (matches the CRM field api_name exactly) -- `hospSetField` is
generic (`b[key] = val`) and this key must match what `saveDeceasedPickup`'s
`supportedKeys` list expects (see `metadata.md` for the one-line addition needed there).

No init needed for `b.Registration_Number` -- `hospSetField` sets it on first use, and every
other free-text field in this object (`Doctor_Name`, etc.) works the same way without an
explicit init.

## Test (both paths)

- **Regular/police trip:** enter a registration number on the check-in screen, confirm it
  saves (via the debounced auto-save or the final batch save) -- check the Trip's Operations
  record AND the Deal both show it.
- **Hospital multi-deceased:** enter a registration number on one body's card, confirm it
  reaches that child's own Deceased_Pickups record, and from there (via the already-fixed
  `onDeceasedPickupCheckIn`) onto that child's own Operations and Deal.
- Re-enter the same value a second time on either screen -- confirm no duplicate/erroring
  write (both server functions already guard on value-changed).
