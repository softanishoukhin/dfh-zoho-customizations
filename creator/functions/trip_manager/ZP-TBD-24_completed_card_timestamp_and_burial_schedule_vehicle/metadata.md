Task ID: ZP-TBD-24 (placeholder)
Zoho App: Creator (Trip Manager widget + Trip_Manager.ds)
Reported by: user, 2026-08-18 (screenshot, All Trips dispatch board + Burial Schedule request)

## 1. Completed Trips card missing a timestamp -- FIXED (direct edit, widget.html)
Reported: cards that were previously showing three timestamps left-to-right (Created,
Started, Completed) are now missing one -- confirmed via screenshot (Hospital Storage and
several Pickup Trip cards showing only "Scheduled" + "Created", no "Completed" time,
despite the card's own badge showing "Completed").

**Root cause:** a prior fix in this same repo (see
`../ZP-TBD-21_funeral_card_timestamps_and_stamp_fix/metadata.md`, Round 2) scoped the
"Started"/"Done" timestamp lines on dispatch cards to `cat === "funeral"` only, in response
to a different complaint about a Police Case Pickup card showing a "Done" stamp. That
change was broader than intended -- it silently removed the "Done" timestamp from every
non-funeral card that had always shown it (Hospital Storage, Pickup/Transport trips, etc.),
which is the regression reported here.

**Fix (widget.html, `buildCard`):** removed the `cat === "funeral"` gate from both the
"Started" and "Done" timestamp lines -- they now show for every trip category again,
matching the original pre-session behavior, while still keying off the same
`Trip_Status === "Started"` / `isDone && Completion_Time` conditions as before. Applied
directly to the live workspace copy of `tripManagerApp/app/widget.html` (per
[[feedback_widget_js_html_direct_edit]]).

## 2. Burial Schedule missing manually (TM) assigned vehicles -- guideline provided, not deployed
Reported: the Burial Schedule report in Trip Manager only shows vehicles booked from the
invoice; it should also show vehicles Trip Manager staff assigned manually, matching the
old CRM report.

**Root cause (Trip_Manager.ds, `getBurialSchedule`):** the function only ever reads
`Deals.Hearse` (a picklist populated by the invoice/sales-order booking flow). It never
looks at the Funeral trip's own `Vehicle` / `Amber_Vehicle` / `Rental_Vehicles` lookup
fields -- which is what actually gets set when Trip Manager manually assigns/changes a
hearse on the dispatch board (`saveAssignment`). So any funeral where TM manually
assigned or overrode the vehicle shows blank in the Burial Schedule even though a vehicle
is genuinely assigned.

**Fix (guideline, `getBurialSchedule_FIX.deluge`, this folder):** the same batched Trips
COQL query that already pulls `Departure_Time` per Deal now also pulls `Vehicle`,
`Amber_Vehicle`, and `Rental_Vehicles`. A resolved vehicle name (checked in that priority
order) is captured per Deal. When building each output row, the Hearse column uses
`Deals.Hearse` if it has a value; otherwise it falls back to the TM-assigned vehicle name.
No change to the widget.html rendering side -- it already just displays whatever `hearse`
value comes back.

## Deploy
1. Open `list getBurialSchedule(String fromDate, String toDate)` in the Trip Manager
   Creator app's function editor.
2. Replace its full contents with `getBurialSchedule_FIX.deluge` (the whole function, not
   a diff).
3. Test: open the Burial Schedule for a date range that includes at least one funeral
   where the vehicle was assigned manually via Trip Manager's dispatch board rather than
   coming from an invoice booking -- confirm the Hearse column now shows it. Also test a
   funeral with an invoice-booked Hearse and NO manual TM assignment -- confirm that value
   still shows unchanged (Hearse picklist takes priority, as before).
