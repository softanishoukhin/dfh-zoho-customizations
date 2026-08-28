# ZP-TBD-39 — Headstone Approval Workflow rebuild

## ⚠ ENTIRE HILLVIEW GROUP HEADSTONE PROCESS TEMPORARILY DISABLED (2026-08-28)

Andrea asked the whole process (not just the Plot Number piece) to be paused for a few days
(vendor/product config person unavailable). **See `TEMPORARILY_DISABLED_2026-08-28.md` in this
same folder before touching anything else in this ticket** — it has the exact 2 switches that
were flipped off, exactly how to flip them back on, and a plain-English guideline for Andrea.

Source: `D:\Office\Andrea_Projects\DFH\projectDocuments\DEV_BRIEF.md` (full rework spec),
`D:\Office\Andrea_Projects\DFH\projectDocuments\HeadstoneRequestTasks.txt` (Andrea's
message, decoded). Live-verified 2026-08-20/21 against DFH CRM org871210233 and
`D:\Office\Andrea_Projects\DFH\widgets\headstoneRequests\Headstone_Request.ds` (read in
full, 1699 lines). Guideline only, per this project's standing rule — nothing has been
written to CRM functions or the `.ds` file directly.

**Status: guideline complete, NOT yet applied/deployed.** This is a large rebuild — apply
it in the order below, testing each stage before moving to the next, rather than deploying
everything at once.

## Files in this package

CRM side (`crm/functions/deals/ZP-TBD-39_headstone_workflow_rebuild/`):
- `metadata.md` — this file.
- `product-mapping.md` — the exact `Hillview Group` product-tagging table, with live
  Product ids, plus the two open items flagged for Andrea.
- `guideline.md` — Products field, Deal fields, FD popup client script, the
  `manageZeroRatedHeadstoneProduct` rewrite, button removal, the `Ready for Family` rename,
  and the read-only field locks.
- `test-plan.md` — the "prove it works" checklist from the brief, including the full
  financial chain (CRM PO → Books PO → Books Bill), since that leg has never
  successfully run for a headstone.

Creator side (`creator/functions/headstone_request/ZP-TBD-39_headstone_workflow_rebuild/`):
- `guideline.md` — every `Headstone_Request.ds` change: the `Parent_Product=="Headstone"`
  filters, the product-lookup bug fix, the vendor-approval rename, the new Hillview-1
  direct-to-vendor record creation, the three form variants, and the `NOK Not Approved`
  handling.

## Key discoveries this rework needed to reconcile (live reality vs. the brief)

1. **The current trigger has a second, undocumented path.** Besides the
   `Parent_Product=="Headstone"` line-item check, `manageZeroRatedHeadstoneProduct` also
   auto-injects a headstone product whenever a Hillview-parented product with a non-null
   `Products.Included_Headstone_Product` lookup is added. **Decision (confirmed with the
   user): `Hillview Group` replaces this mechanism entirely** — the injection logic is
   removed, not kept alongside the new field.
2. **The button and the automatic email are the same function**
   (`button.sendHeadstoneRequest` calls the identical `sendheadstonerequest` REST endpoint
   that `manageZeroRatedHeadstoneProduct` already calls). Removing the button does not
   remove any duplicate logic — see `guideline.md` §5 for exactly what changes and what
   must be kept.
3. **A second, independent bug**, beyond the one named in the brief: in
   `afterApprovingAndSubmittingTheForm`, `thisapp.createPurchaseOrderForTheParticularVendor`
   is called without first confirming `Headstone_Vendor_Status == "Vendor Approved"` (which
   is the gate that function itself checks at its own top). Combined with the product-
   lookup bug, this is a second reason no PO has ever fired — both are fixed in the
   Creator-side guideline.
4. **Hillview 1/2/3 candidate products span three different Parent_Product values**
   (`Pre Need`, the historic `Hillview` parent, and a `White Services (Headstone)`-vendor
   set) — not one "Hillview" category. `product-mapping.md` gives exact ids rather than a
   parent-based rule.
5. **Two products already flagged as inconsistent, independent of this rework**:
   `Metal Headstone Dovecot Re Opening` / `Marble Headstone Dovecot Re Opening` currently
   have `Include_in_Headstone_Workflow=true` despite being parented under "Outside
   Cemetery," not "Headstone." Left untouched here (out of the rework's stated scope) but
   flagged as a pre-existing data inconsistency for Andrea to decide on separately.

## Resolved since first draft

- **5th Deal field (epitaph/Bible verse) added, confirmed 2026-08-24: `Headstone_Epitaph1`**
  (multi-line text). Used throughout the Creator-side guideline's §5 form-variant section.
- **The two open unknowns in the Creator-side `createFormRecordAndNotifyVendor` function
  (Vendor_Name's target module, the real vendor email-sending mechanism) are resolved** --
  see that guideline's §4, pulled directly from `sendEmailToVendorForDraft`'s live code.
- **The FD popup Client Script's subform-read approach is confirmed correct, deployed, and
  tested passing** — `subform.getValue()` + direct property access (`row.Child_Product.id`),
  not the originally-drafted `getRows()`/`getField()` guess. See this folder's
  `guideline.md` §3.

## New task (2026-08-28): FD manual entry — trigger was never actually wired up

Andrea asked whether an FD can manually fill in the Deal fields (instead of the family
completing the online form) and have that trigger the same headstone process. Investigated
exhaustively (every Deals workflow rule of every trigger type, the FD completeness-check client
script, and the org's generic any-field-update dispatcher) and found **`manageZeroRatedHeadstoneProduct`
is not called from anywhere at all** — the rebuild's trigger wiring was apparently never
finished. This isn't FD-specific: today, *nothing's* edits (FD or family) actually fire the
vendor notification. See `fd_manual_entry_trigger.md` in this same folder for the full guideline
(new wrapper function + new field-update workflow rule) and the FD step-by-step instructions.
Confirmed deployed and tested by Andrea, passed.

## New task (2026-08-28, Task 2): Plot # flow — Deal → Headstone Form → Vendor

Andrea wants the Plot # to flow from the Deal onto the Headstone Form (read-only) as soon as
it's assigned, with an automatic vendor email ("Plot # has been assigned") containing a View
Form button. Per her explicit instruction, the CRM-side trigger goes through
`handleWorkflowTriggerAndActionByTimelineProcess` (the same generic dispatcher from Task 1).
Full guideline — new `Plot_No` field on `Headstone_Request_Form`, a new CRM email template, two
new Creator functions, and the new dispatcher branch — is in `plot_number_flow.md` in this same
folder. Not yet applied.

## New task (2026-08-28, Task 3): Hillview App — show headstone info on the record detail page

Andrea wants the Hillview App's record detail page (opened via "View Details" from its list
widget) to show Plot #, Headstone Product, all headstone information, and Status — whatever the
current process already collects, not a new status system. Traced the app fully
(`widgets/hillviewApp/hillviewApp`): the real "record detail page" is the `Hillview_Form`
Creator form itself (opened per-Deal), which already prefills from a live Deal GET on load —
extended that same prefill with the new headstone fields (Headstone_Product, Headstone Shape,
Headstone Epitaph, Headstone Request Status, Headstone Vendor Status), all read-only. Also found
and fixed a real existing bug along the way: the form's own Plot # field was never prefilled on
load, so reopening a Deal that already had one showed it blank. Full guideline in
`hillview_app_headstone_display.md` in this same folder. Confirmed deployed and tested by
Andrea, passed.

## Open items for Andrea (not guessed — see `product-mapping.md` for detail)

1. "Phase 3 Traditional" (listed under Hillview 1) has no matching standalone product
   live — confirmed after a full sweep of all 1,151 Products records. Skipped from the
   Hillview 1 tagging per the user's decision; flagged for Andrea to clarify or create.
2. Three Hillview 2 items (Columbarium, Vault C/R, vault in Sepulchre section) exist as
   duplicate pairs (an original "Hillview"-parented record and a newer "Preneed(2025)"
   twin). **Both twins are tagged**, per the user's decision, so transactions against
   either one trigger correctly. The same duplication risk may apply to some Hillview 1
   items that weren't individually re-checked for old-Hillview twins (only the ones
   explicitly named in this pass were verified) — worth a spot-check before Andrea signs
   off on the final tagging.
3. `Headstone_Request_Status` / `Headstone_Vendor_Status` are currently associated with
   only the `Funeral_w_Burial` layout. If other Deal layouts also need this workflow, they
   need the fields added to those layouts before the read-only lock (§8 of `guideline.md`)
   is applied there too.
4. **Mixed-group Deals, found during testing 2026-08-24:** if a Hillview 1 product is
   added first (routes straight to vendor, `Headstone_Request_Sent` flips true) and a
   Hillview 2/3 product gets added to the same Deal afterward, nothing re-evaluates --
   the fire-once guard silently absorbs the second save, so the family never gets involved
   even though a stricter-group product is now on the Deal. Not covered by the brief.
   Needs a decision from Andrea: should adding a Hillview 2/3 product after the vendor
   path already fired re-open the process to the family, or is the current "first
   qualifying save decides, permanently" behavior acceptable?
