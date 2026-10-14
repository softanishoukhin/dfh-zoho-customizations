# ZP-TBD-111 -- Ship In vehicle booking from Product Selection

**Folder number is a placeholder**: rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-14, NOT applied, NOT tested.** SI detail-page scripts added live by the user 2026-10-14.

| | |
|---|---|
| Reported by | Andrea, 2026-10-14 -- Ezra Anderson (Deal `6503357000085022186`), G Wagon on the invoice, no booking |
| Pages | Deals SI detail `6503357000049041330`, SI edit `6503357000049041378` (SI create `6503357000049041360` not changed) |
| Reference pages | FB detail `6503357000023303081`, FB edit `6503357000023387374`, FB create `6503357000023387157`, CS detail `6503357000023132037` |
| Subform layouts | Product_Selection SI `6503357000005708117` (no Vehicle_Booking_ID), FB `6503357000006886033` (has it) |
| Library | `maintainVehicleProduct.js` r24, `ondeletevehiclemanage.js` r1, `editpagevehiclemanage.js` r4, `onCreateVehicleManage.js` r4 (zappsusercontent `ac9b5813-...`) |

## Live facts (2026-10-14)

- Ezra: Funeral_Time 2026-11-08 11:00; G Wagon row `Vehicle_Booking_ID` empty; funeral Trip `6503357000085821148`
  has Vehicle = G Wagon (set by `createEventForFuneralDate` / `createSalesOrderForDifferentPipelines`), no booking.
- Vehicle_Bookings (latest 200): client-script names "<vehicle> <Mon D, YYYY hh:mm AM> <deceased>"; Trip Manager
  names "<vehicle> <yyyy-MM-ddTHH:mm:ss>". All 27 client-script bookings since July are Funeral with Burial; the
  last one 2026-09-30 (Lebert James). Duplicates seen (Dawn Campbell x3, Yvonne Dowman x3, Gwendolyn Stevens x2 with
  two name formats) -- consistent with the Create-page path not storing the booking id.
- SI Deal layout has Pipeline, Name_of_Deceased, Funeral_Time, Product_Selection; no Booking_Data (FB has it in
  "Don't Delete Fields").

## Files

- `guideline.md`
- `maintainVehicleProduct_UPDATED.js`, `ondeletevehiclemanage_UPDATED.js`, `editpagevehiclemanage_UPDATED.js`
- `page_scripts/` -- the SI page scripts (detail: as added; edit: to add)
- `rollback/` -- live library files 2026-10-14 (incl. `onCreateVehicleManage_CURRENT.js`, unchanged)
- Test cases: `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-111_Ship_In_Vehicle_Booking_Test_Journeys.xlsx`
