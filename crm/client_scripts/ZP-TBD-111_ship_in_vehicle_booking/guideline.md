# ZP-TBD-111 -- Ship In Deals: book the availability-based vehicle from Product Selection

**Status: built 2026-10-14, NOT applied, NOT tested.** The SI detail-page scripts (step 3) were already added by the
user on 2026-10-14. Built on the live library files pulled 2026-10-14 (`rollback/*_CURRENT.js`).

## The problem (Andrea, 2026-10-14)

Ezra Anderson (Deal `6503357000085022186`, pipeline **Ship Ins**, layout SI, funeral 8 Nov 2026 11:00): the
"Delapenha G Wagon" (availability-based) is on Product Selection and on the invoice, but no Vehicle Booking was made.

Vehicle bookings from Product Selection are made by **client scripts**, which call shared library functions:

| Page | Script | Library function |
|---|---|---|
| Deal detail page, Product Selection row save | Maintain Vehicle Product (beforeRowUpdate) | `maintainVehicleProductDetailsPage(row_data, index)` |
| Deal detail page, Product Selection row delete | On Delete Vehicle Manage (beforeRowDelete) | `onDeleteVehicleManage(row_data, index)` |
| Deal Edit page, Save | Maintain vehicle product (onSave) | `onEditVehicleManage()` |
| Deal Create page, Save | Maintain Vehicle Product (onSave) | `onCreateVehicleManage()` |

Why it never worked for Ship In (it is not a new break -- all 27 client-script bookings since July are Funeral with
Burial Deals):

1. **The scripts were not on the SI pages.** FB and Cremation with Service have them; SI had none. (Detail page:
   added by the user 2026-10-14.)
2. **Every library function only runs for two pipelines**:
   `if (pipeline == "Cremation with Service" || pipeline == "Funeral with Burial")` -- "Ship Ins" is skipped.
3. **The SI Product Selection subform layout has no "Vehicle Booking ID" field** (the FB one has it). The detail
   function reads that cell inside a `try`; without it the catch sets `product = null` and nothing happens, silently.
4. (Edit page) the SI Deal layout has no `Booking_Data` field; `onEditVehicleManage` writes it inside the same `try`
   as the booking, so a missing field would also stop the booking.

The server side doesn't book either: `createSalesOrderForDifferentPipelines` only copies the vehicle to the funeral
Trip (`//standalone.updateVehicleBookingInformation(crmid);` is commented out, and that function only moves existing
bookings), and the Trip's `preventEditVehicle` validation rule only runs on a manual Trip save.

## What changes

- The three library functions also run for **Ship Ins**.
- `onEditVehicleManage` (Edit page, used by FB / Cremation with Service too) -- existing bugs fixed:
  - the booking's Deal was the literal text `"$Page.record_id"` -> now the Deal's id;
  - the Availability Based flag is read the same way as the detail page (`product.Availability_Based`, the old
    `product._Availability_Based` kept as a fallback);
  - the "already booked that day" check now uses Jamaica time (`-05:00`, like the detail page) instead of UTC;
  - `Booking_Data` (a debug copy) is written in its own `try`, so a layout without that field still books;
  - removing an availability-based vehicle cleared the wrong row (`getRow(index)`, `index` doesn't exist there)
    -> `getRow(i)`.
- The SI subform layout gets the "Vehicle Booking ID" field; the SI Edit page gets the two scripts FB has.

**Not changed (follow-up, needs a decision):** the Create page (`onCreateVehicleManage`). It can't link the booking to
the Deal (the Deal has no id yet), sends the literal `"$Page.record_id"`, never stores the Vehicle Booking ID on the
row (so the next save books a second time -- duplicates are visible in Vehicle Bookings), and its conflict check
doesn't exclude the Deal itself. It is NOT added to the SI Create page. A Ship In Deal created with the vehicle
already in Product Selection gets its booking at the first row save / Edit save afterwards.

**Known limit (all pipelines, unchanged):** changing the Funeral Date and Time inline on the detail page does not move
existing bookings -- only an Edit-page Save (or re-saving the vehicle row) does. The server-side mover
`updateVehicleBookingInformation` is commented out in `createSalesOrderForDifferentPipelines`.

## Apply

### 1. SI subform layout -- add "Vehicle Booking ID"

CRM > Setup > Customization > Modules and Fields > Deals > Layouts > **SI** > Product Selection subform >
add the existing field **Vehicle Booking ID** (it is already on the FB subform). Save the layout.

### 2. Library functions

CRM > Setup > Developer Hub > Client Script > the shared function library. Replace the body of each with the file
in this folder (or make the marked `ZP-TBD-111` changes by hand):

| Library file | Replace with |
|---|---|
| `maintainVehicleProduct.js` | `maintainVehicleProduct_UPDATED.js` (one line: `\|\| pipeline == "Ship Ins"`) |
| `ondeletevehiclemanage.js` | `ondeletevehiclemanage_UPDATED.js` (one line: `\|\| pipeline == "Ship Ins"`) |
| `editpagevehiclemanage.js` | `editpagevehiclemanage_UPDATED.js` (Ship Ins + the 5 fixes above) |

`onCreateVehicleManage.js` stays as it is.

### 3. SI detail page (done by the user 2026-10-14 -- check only)

Deals > SI layout > **Detail page** must have, on Product Selection:
- **Maintain Vehicle Product**, beforeRowUpdate, active -- `page_scripts/SI_detail_beforeRowUpdate_Maintain_Vehicle_Product_ADDED.js`
- **On Delete Vehicle Manage**, beforeRowDelete, active -- `page_scripts/SI_detail_beforeRowDelete_On_Delete_Vehicle_Manage_ADDED.js`

Optional: on FB, Maintain Vehicle Product runs **before** "Update Subform Trigger Time" (precedence 1 vs 2). On SI
it's the other way round. Matching FB means a row save that is refused (vehicle already booked / no funeral time)
doesn't start the Sales Order run first.

### 4. SI Edit page -- add two scripts

Deals > SI layout > **Edit page**:
- **Maintain vehicle product**, page event **onSave**, active -- paste `page_scripts/SI_edit_onSave_Maintain_vehicle_product.js`
  (same as FB: `var returnResult = onEditVehicleManage(); return returnResult;`). Put it before "Update Subform
  Trigger Time".
- **On Delete Vehicle Manage**, Product Selection **beforeRowDelete**, active -- paste
  `page_scripts/SI_edit_beforeRowDelete_On_Delete_Vehicle_Manage.js`.

### 5. Ezra Anderson

After 1-3: open the Deal, edit the "Delapenha G Wagon" row in Product Selection and save the row without changing
it. A Vehicle Booking "Delapenha G Wagon Nov 8, 2026 11:00 AM Ezra Anderson" appears under Bookings and the row's
Vehicle Booking ID is filled. (On 2026-10-14 no other G Wagon booking existed for 8 Nov.)

## Rollback

Paste the `rollback/*_CURRENT.js` files back into the library; deactivate the SI Edit-page scripts; the subform
field can stay.
