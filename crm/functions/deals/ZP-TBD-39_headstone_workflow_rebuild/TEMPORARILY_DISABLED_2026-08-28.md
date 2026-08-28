# Headstone vendor-sending process — TEMPORARILY DISABLED (2026-08-28)

**Why:** Andrea asked to pause anything that sends information to a vendor for a few days —
the person who configures products/vendors is unavailable, and she doesn't want the process
actively contacting vendors while that setup isn't ready. Everything built in this ticket
(Tasks 1–3) is already tested and confirmed passing; this is a temporary pause, not a rollback.

**Read this whole file before doing anything else in this ticket** — it records exactly what
was turned off and exactly how to turn it back on. Update the checkboxes below as each step is
done/undone so this stays accurate.

## What actually sends something to a vendor (confirmed exhaustively during Task 1's
investigation — nothing else in this org can reach a vendor for headstones)

1. **`standalone.manageZeroRatedHeadstoneProduct`** — the core routing function (Hillview 1 →
   straight to vendor via `createFormRecordAndNotifyVendor`/`sendEmailToVendor`; Hillview 2/3 →
   family first). Its **only** trigger, anywhere in this org, is the workflow rule below (Task 1
   confirmed nothing else calls it — no other workflow rule of any trigger type, no client
   script).
2. **`Update_Plot_Number_And_Notify_Vendor`** (Creator, Task 2) — emails a vendor when a Deal's
   `Plot_No` gets a value. Triggered from `automation.handleWorkflowTriggerAndActionByTimelineProcess`,
   which itself is wired to the "Custom Manage - Trigger on Any Field Update" workflow rule — a
   shared rule used by dozens of unrelated processes, so that rule must **not** be touched.

Two separate, narrow switches are needed — one CRM-side (no code), one Creator-side (one line).

## Switch 1 — CRM workflow rule (no code, just a toggle)

**Rule:** `Trigger Headstone Process on Completion`
**Rule ID:** `6503357000080581033`
**Module:** Deals

**To turn OFF:** Setup → Automation → Workflow Rules → Deals → find "Trigger Headstone Process
on Completion" → toggle it **Inactive**.

**To turn back ON:** same place, toggle it back to **Active**. Nothing else needs to change —
this fully restores Task 1's behavior exactly as tested.

- [ ] Turned off (confirm here once done, with the date)
- [ ] Turned back on (confirm here once done, with the date)

## Switch 2 — one line in `Update_Plot_Number_And_Notify_Vendor` (Creator)

Find this line inside the function (in the notify loop, right where the email actually gets
sent):
```
thisapp.notifyVendorPlotNumberAssigned(vendorEmail,vendorId,crmid,plotNo);
notifiedCount = notifiedCount + 1;
```

**To turn OFF**, comment out just those two lines:
```
// TEMPORARILY DISABLED 2026-08-28 (Andrea: vendor/product config unavailable) -- delete this
// comment block and uncomment the two lines below to re-enable.
// thisapp.notifyVendorPlotNumberAssigned(vendorEmail,vendorId,crmid,plotNo);
// notifiedCount = notifiedCount + 1;
```
Everything else in the function keeps running exactly as before — `Plot_No` still updates on
every linked Headstone Request Form record, so nothing about the Plot # flow itself breaks;
only the vendor email is skipped.

**To turn back ON:** delete the comment markers, restore the two original lines exactly as they
were (shown above, uncommented).

- [ ] Turned off (confirm here once done, with the date)
- [ ] Turned back on (confirm here once done, with the date)

## What is deliberately NOT touched

- `sendEmailToVendorForDraft` and any vendor-facing email tied to a vendor's own interaction
  with an **already-existing** Headstone Request Form (e.g. uploading a draft) — this is
  pre-existing ZP-TBD-39 functionality, not something this ticket's tasks introduced, and it can
  only fire on a request that already made it to a vendor. Since Switch 1 stops any *new*
  request from ever reaching a vendor, there should be nothing in flight for this to fire on
  during the pause — but if Andrea specifically means this too, it needs its own separate
  decision (not covered by these two switches).
- Everything else confirmed working from Tasks 1–3 (the FD manual-entry trigger's field
  detection, the Plot_No field itself updating on the Headstone Request Form, the Hillview App
  display fields) — none of that sends anything to a vendor, so none of it needs to change.

## To resume

Once the vendor/product configuration person is back and ready: flip Switch 1 back on, restore
Switch 2's two lines, then do one quick live smoke test (one Deal through each path — a fresh
Hillview 1 product, and a Plot # assignment) to confirm both switches actually took effect
before considering it fully back in production use.
