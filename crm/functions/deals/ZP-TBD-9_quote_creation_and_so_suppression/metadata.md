*** SUPERSEDED 2026-08-13 -- see ../ZP-TBD-17_quote_rebuild_deal_to_quote/ ***
Andrea's post-mortem (attached to her 2026-08-13 comment,
DFH_Quote_Rebuild_Complete_Spec_2026-08-12.docx) determined this entire
feature -- the popup, the suppression flag, the race-condition fixes, the
12-client-script sync logic, convertQuoteToSalesOrder -- does not meet the
actual requirement and must be removed. createOrUpdateQuoteFromDeal and
generateQuotePdf are the only pieces reused (trimmed/unchanged respectively)
in the rebuild. Left in place here for history; do not build on top of
anything in this folder going forward -- see ZP-TBD-17 instead.
*** END SUPERSEDED NOTICE ***

Task ID: ZP-TBD-9 (placeholder)
Zoho App: CRM (+ Zoho Writer, Zoho WorkDrive)
Module: Deals (buttons + suppression guard), Quotes (new Quote_Public_URL field), System_Data
(suppression flag storage, Deals field limit already reached)
Function Names:
  - standalone.isQuoteAwaitingAcceptance (new, id 6503357000077155018)
  - standalone.setQuoteAwaitingAcceptance (new, id 6503357000077155023)
  - standalone.generateQuotePdf (new, id 6503357000077155036)
  - standalone.createOrUpdateQuoteFromDeal (new, id 6503357000077155045)
  - standalone.convertQuoteToSalesOrder (new, id 6503357000077155050)
  - automation.createSalesOrderForDifferentPipelines (modified — guard added 2026-08-07, guard
    extended to sync 2026-08-10, id 6503357000005749466)
  - automation.createSalesOrderFromDeals (modified — same, id 6503357000001327430)
  - automation.createSalesOrderForHospitalCase (modified — same, id 6503357000003769347)
  - automation.CreateSalesOrderforPoliceCase (modified — same, id 6503357000003436189)
  - standalone.hasQuotePromptBeenShown (new, 2026-08-10)
  - standalone.markQuotePromptShown (new, 2026-08-10)
  - standalone.syncQuoteLineItemsOnly (new, 2026-08-10 — signature changed same day, see
    "Architecture simplification" note below)
Function Type: 2 new Deal custom buttons ("Create/Update Quote", "Convert Quote to Sales Order")
+ 1 new Quotes custom view ("Open Quotes") added to the FD Home Page dashboard
Trigger Source: manual button click (both new buttons); the 4 modified functions are triggered
exactly as before, by the pre-existing "Create or Update Sales Order from Deals V2" workflow
rule (id 6503357000049124145, unmodified) on Deals.Trigger_Based_On_Subform changing.
Input Arguments: createOrUpdateQuoteFromDeal(String dealId), convertQuoteToSalesOrder(String
dealId), generateQuotePdf(String quoteId, String dealId), isQuoteAwaitingAcceptance(Int crmid),
setQuoteAwaitingAcceptance(Int crmid, Boolean value)
Connection Name: zohooauth (CRM/Writer/WorkDrive folder-create+upload calls), zohoworkdrive
(WorkDrive permissions/share call only)
Related Fields: New — Quotes.Quote_Public_URL (URL/text). Suppression flag is NOT a Deals
field (Deals had already hit its field-creation limit) — stored instead as a System_Data row
per Deal (Name="Awaiting_Quote_Acceptance", Module_Name="Deals", Module_ID=<dealId>,
System_Info="true"/"false").
Related Modules: Deals, Quotes, Quoted_Items (subform), Contacts, System_Data
Created By: Claude Code, 2026-08-04 (design) / 2026-08-07 (build + deploy + test)
Last Updated By: Claude Code
Sandbox Tested: No — tested live per DFH's established practice
Production Deployed: Yes
Production Deployment Date: 2026-08-07
Notes:

Design history: originally scoped Awaiting_Quote_Acceptance as a new boolean field on Deals,
gated via the SO-creation workflow rule's criteria. Deals had already hit its field-creation
limit, so the flag moved to the existing "System Data - Not Delete" module (api_name
System_Data) instead, using the same query convention already proven in
standalone.checkExistenceInSystemDataModule. Because System_Data.Module_ID is a plain text
field (no true CRM lookup relationship to Deals), workflow rule CRITERIA cannot read it — so
the suppression check moved from the workflow rule into a 3-line guard at the very start of
each of the 4 functions the workflow already calls. The workflow rule itself received NO
changes.

Quote PDF: generated via a Zoho Writer Mail Merge Template ("Quote – Merge Template.zdoc",
Writer document_id 0votx2af8768ad5a3464fabc49a89d3f4abb1, registered as CRM Mail Merge
Template id 6503357000077155034 on the Quotes module), merged via zoho.writer.mergeAndStore
and downloaded as PDF — same mechanism already proven for the Hang Tag
(standalone.generateHangTag), but this is the first time in this org a SUBFORM
(Quoted_Items) has been merged this way, not just scalar fields. Subform row keys must be the
full DOTTED merge-tag IDs (e.g. "Quoted_Items.Product_Name"), confirmed live via the Zoho
Writer API's field inspector (Get_All_Fields) against the actual built template — bare field
names silently match nothing.

Public sharing: reuses the exact WorkDrive folder-create + file-upload pattern already proven
in button.sendAllAttachmentToAWorkdriveFolder (id 6503357000051815321) — the only change is
the permissions call's shared_type, "everyone" instead of "teammembers", so family/contacts
can view without a Zoho login.

Convert-to-Sales-Order deliberately does NOT use Zoho's native Inventory Convert API
(POST .../actions/convert). DFH's 4 existing SO-creation functions inject pipeline-specific
logic (hospital/police fee substitutions, autopsy trip KM overrides, tax-percentage lookups)
that only exists in those functions, not in the Quote's Quoted_Items — native Convert would
produce a Sales Order missing all of that. Instead, convertQuoteToSalesOrder clears the
suppression flag and re-touches Trigger_Based_On_Subform, re-firing the exact same,
unmodified pipeline that runs for every other Deal.

Bugs found and fixed during live testing (2026-08-07), all in generateQuotePdf /
createOrUpdateQuoteFromDeal — see test-cases.md:
  1. CRM standalone functions can only declare "string" as their return type (not map/
     boolean/void, and not a raw file object across a function-call boundary) — forced
     restructuring generateQuotePdf to do its entire job internally.
  2. Quote creation initially failed — Zoho's inventory subform write API expects lowercase
     product/quantity/list_price keys under a "Product_Details" payload key, not the
     capitalized read-time field names.
  3. Quote PDF line-items table rendered blank — two stacked causes: dotted merge-tag key
     names (above), AND zoho.crm.getRecordById silently dropping subform data (same known
     issue already documented in Driver_App.ds for Product_Selection) — switched to a REST
     v8 GET for the Quote fetch.
  4. Currency values showing 4+ decimal places — added .round(2) to every currency field
     going into the merge.
  5. Success message not displaying in the button's popup — final return was raw JSON
     instead of a plain message like every other return path in the function.

Race-condition fix (2026-08-10): a real timing bug was found after the above sign-off —
Trigger_Based_On_Subform (and the SO-creation workflow it schedules) gets stamped by the
Product_Selection onRowAdd client script on every row add, via
ZDK.Apps.CRM.Functions.execute("getcurrentdatetime", {..., "minutes": 1}) — i.e. now + 1
minute, NOT Zoho scheduler latency as first suspected. That 1-minute buffer was an earlier,
undocumented attempt to give staff time to click "Create/Update Quote" before the SO/Invoice
auto-fires. It wasn't reliable — Andrea: "I cannot have issues on timing. period... It can't
fail because of 1 minute less here or there... no extra steps because of timing."

Fix: moved the suppression decision out of the button and into the SAME onRowAdd event that
stamps Trigger_Based_On_Subform, so nothing is timed anymore — it's a synchronous call chain,
not a race.
  - createOrUpdateQuoteFromDeal(String dealId, String firstRowData) — added firstRowData param
    (the row-add event's own row_data, JSON-stringified) so the function doesn't have to
    re-read Product_Selection from the server for the first row, which may not be persisted
    yet at that instant. Also moved standalone.setQuoteAwaitingAcceptance(dealId,true) to the
    very first line of the function, before the Deal lookup — was previously set only after
    the Quote record was created.
  - New client script client-scripts/product_selection_onRowAdd.js, replacing the old
    "Create/Update Quote" button, on all 4 Deals layouts (Standard PC/HP, Cremation_with_Service,
    Funeral_w_Burial, Ship_In_Layout): on the first product row added, shows
    ZDK.Client.showConfirmation('Do you want to open the mailer window?', 'Proceed', 'Cancel').
    Proceed calls createOrUpdateQuoteFromDeal synchronously (blocking) BEFORE the existing
    getcurrentdatetime call below it runs — so Awaiting_Quote_Acceptance is guaranteed true
    before Trigger_Based_On_Subform is ever stamped. Cancel = normal auto SO/Invoice pipeline,
    same as any Deal that never uses quotes. Rows after the first don't re-prompt, but silently
    re-sync the Quote's line items if the Deal already opted in (via
    standalone.isQuoteAwaitingAcceptance guard), so products added after the initial quote
    don't fall off it.
  - Old "Create/Update Quote" button is superseded and should be deactivated once this is live
    and tested — see deployment-checklist.md.

Bug fix -- Edit-page save not navigating to detail page (2026-08-10): reported live -- after
Save on the Edit page, for a Deal already in the Quote flow, the record stopped navigating to
its detail page (only a report-only CSP console notice showed, which is unrelated Zoho
client-script-engine noise, not the actual cause). Root cause: onSave's "already prompted" else
branch re-ran the FULL createOrUpdateQuoteFromDeal pipeline (Quote rebuild, PDF regenerate,
WorkDrive re-upload, and a duplicate "your quote is ready" email to the customer) on EVERY
single Edit-page save once Awaiting_Quote_Acceptance was true -- completely regardless of
whether that particular save touched Product_Selection at all. Several seconds of unrelated
synchronous work on every edit was blocking Zoho's own post-save redirect. Fixed by removing
that else branch entirely from product_selection_onSave_createEdit.js -- onSave now only ever
does the one-time first prompt/Quote-creation; ongoing sync stays exclusively the detail page's
job (beforeRowUpdate/beforeRowDelete), which only fire when Product_Selection actually changes.
No diffing mechanism was added to onSave to detect "did this save touch products" -- removed
rather than guessed at, since onSave only ever sees the whole subform_data array, not a diff
against the pre-save state.

CORRECTION (2026-08-10, same day): removing the else branch entirely (above) turned out to be
too blunt. Confirmed live: beforeRowUpdate/beforeRowDelete do NOT fire at all on the Edit
page's Product_Selection subform -- those events only exist on the detail page's client
scripts. That means onSave's sync branch was the ONLY mechanism that could ever catch product
changes made via the full Edit form, and removing it outright left Edit-page product edits with
no sync path at all once a Deal had already been prompted once.

Real fix: added a new, deliberately CHEAP function, standalone.syncQuoteLineItemsOnly(String
dealId, String lineItemsEncoded) -- updates only the existing Quote's Product_Details via one
zoho.crm.updateRecord call. No Deal/Contact lookup, no PDF regeneration, no WorkDrive upload, no
sendmail. Reinstated the else branch in product_selection_onSave_createEdit.js to call this
instead of the full createOrUpdateQuoteFromDeal -- built from the live subform_data (accurate,
not a stale server read, since onSave already has ZDK.Page.getField('Product_Selection').
getValue() available), encoded as a plain delimited string ("_F_" between fields, "_R_" between
rows) rather than JSON, to avoid the earlier JSON-blob 400 Bad Request problem -- letters-only
delimiters need no URL encoding regardless of exactly how ZDK serializes function args. If no
existing Quote is found (shouldn't happen once Awaiting_Quote_Acceptance is true, but handled
defensively), the function is a no-op.

Related, NOT changed -- worth deciding on separately: the detail page's beforeRowUpdate/
beforeRowDelete sync calls still re-send the "your quote is ready" email every time, any time a
product is added/edited/deleted on a Deal already in the Quote flow, even well after the
original quote was sent and possibly already accepted. Whether staff want a re-send on every
post-send product tweak (e.g. a quantity correction) or only on the original send is a real
product decision, not fixed here -- flag to Andrea/the user if unwanted.

Live-applied change synced to repo (2026-08-12): both the Quote create and update calls
(zoho.crm.createRecord/updateRecord("Quotes", ...)) now pass {"trigger":{"workflow"}} --
Deluge's zoho.crm.createRecord/updateRecord do NOT fire CRM workflow rules by default, so any
workflow configured on the Quotes module (e.g. notifications, field updates) would otherwise
silently never run when a Quote is created/updated through this function. Applied directly live
by the user; pulled via MCP and synced here, not authored by Claude.

Bug fix -- Quote missing the Casket Non-Taxable/Media product and Media_Selections record
(2026-08-12): user reported that when creating a Quote (the "Yes" path), the Casket product
itself was added correctly, but the auto-added zero-rated "Non-Taxable" Media product (when a
Casket row has Casket_Package_For = Montego Bay or Kingston) was missing, and no matching
Media_Selections CRM record was being created either. Root cause: the normal SO-creation
pipeline (createSalesOrderForDifferentPipelines) calls two existing, already-proven functions
before building its line items -- standalone.manageCasketPackageProduct(crmid) (adds the
zero-rated Media product to Product_Selection for qualifying Casket rows) and
standalone.manageMediaSelectoinsRecord(recordInfo,crmid) (creates/updates the Media_Selections
record for each Media-parent row and writes its id back onto Product_Selection). That entire
pipeline is suppressed for the whole time a Deal is in the Quote flow, so these two functions
were simply never being called at all for Quote-flow Deals.

Fixed by calling both from two places, in the same order the SO pipeline already uses
(manageCasketPackageProduct first, since manageMediaSelectoinsRecord depends on the Media row
it adds):
  - createOrUpdateQuoteFromDeal.deluge's sync branch (else branch, firstRowProductId blank) --
    re-fetches dealInfo afterward since both helpers mutate Product_Selection.
  - syncQuoteLineItemsOnly.deluge (the automation-guard-triggered backstop) -- arguably the
    more important of the two, since it's the guaranteed ~1-minute catch-up for every
    Quote-flow Deal from any page, with no pre-commit staleness concern at all.

Known, accepted gap: the very first product added to a brand-new Deal (createOrUpdateQuoteFromDeal's
firstRowProductId branch, used only for that one first-ever row) does NOT get this treatment --
these two helpers read Product_Selection fresh from the server, which would race the
still-uncommitted first row the same way everything else in this file already had to work
around. If that first product is itself a qualifying Casket, the companion product/Media
Selection record appear after the next product change or the ~1 minute automation-guard
backstop, not instantly -- same "eventually correct" pattern already accepted elsewhere in this
feature (e.g. the multi-row-on-first-save limitation).

Not yet applied live -- both repo files updated, need pasting into
standalone.createOrUpdateQuoteFromDeal and standalone.syncQuoteLineItemsOnly respectively.

Bug fix -- convertQuoteToSalesOrder allowed converting an empty Quote (2026-08-12): user
flagged that converting a Quote with zero line items into a Sales Order would silently proceed
-- releasing Awaiting_Quote_Acceptance and re-triggering the SO/Invoice pipeline off an empty
Quote. Pulled the live function via MCP first (repo copy had drifted -- live uses
standalone.getCurrentDateTime + string "false" for setQuoteAwaitingAcceptance, not a direct
zoho.crm.updateRecord + boolean false like the stale repo copy had; synced to match).

Fixed: moved the Quote lookup to the very top of the function, before any release/re-trigger
side effects. If a Quote is found, fetches it via REST v8 GET (not getRecordById -- same known
subform-dropping gotcha already fixed in generateQuotePdf.deluge) and checks Quoted_Items is
non-empty. If empty, returns "No items in quote -- please check the Quote before converting."
and does NOT touch Awaiting_Quote_Acceptance, Trigger_Based_On_Subform, or Quote_Stage. If no
Quote is found at all (quoteId stays ""), behavior is unchanged from before -- still
releases/re-triggers, since that covers a Quote having been deleted after being sent while the
Deal is still marked Awaiting_Quote_Acceptance.

Second guardrail added same day: if the Quote's Quote_Stage is already "Closed Won" (this
function's own marker for "already converted"), return "This Quote has already been converted
to a Sales Order." instead of proceeding -- checked before the empty-items check, using the
same REST v8 GET already being made (no extra API call). This isn't just a messaging
improvement: without it, clicking Convert a second time would re-touch
Trigger_Based_On_Subform for a Deal that already has its Sales Order/Invoice, risking
re-firing that pipeline a second time.

Not yet applied live -- repo file updated, needs pasting into
standalone.convertQuoteToSalesOrder (id 6503357000077155050) same as any other function in this
folder.

RESOLVED (2026-08-11, pulled live via MCP, all 40 test cases confirmed passed): the
generateQuotePdf investigation above is closed. Live code now calls the v2 REST endpoint
directly via invokeurl (POST .../writer/api/v2/documents/{id}/merge/store, merge_data wrapped
as {"data":data}) instead of the native zoho.writer.mergeAndStore task, and correctly extracts
document_info.get("records").get(0).get("document_id") -- confirms the v2 REST doc's
records[]-wrapped shape WAS the right model after all, just not reachable through the native
Deluge task the way it was originally called. Bonus simplification that came with this: 
output_settings now includes folder_id (the Deal's WorkDrive folder) and output_format="pdf",
so the merge/store call writes the PDF directly into WorkDrive in one step -- the old separate
"download the merged doc, then upload it to WorkDrive" block is gone entirely, and mergedId
(records[0].document_id) doubles directly as the WorkDrive resource_id for the sharing/
permissions call. Repo file updated to match live exactly (pulled via MCP, not hand-edited).

Also pulled live and synced to repo (2026-08-11), independent changes made directly in CRM,
not previously reflected here: createOrUpdateQuoteFromDeal now (a) calls
standalone.setQuoteAwaitingAcceptance(dealId.toLong(),"true") with a string "true" rather than
boolean true, (b) every return path now returns the literal string "true" instead of
result.toString() (the descriptive id/status/message map is still built and populated, just no
longer returned to the caller), and (c) the customer email now goes out via
standalone.sendEmail(contactEmail, 6503357000077425285, "Quotes", quoteId) -- a proper CRM Email
Template send -- instead of the original inline-HTML sendmail block (left in place, commented
out, for reference).

Architecture simplification -- sync moved server-side (2026-08-10, user's idea): rather than
patching client-script sync gaps page by page, moved ongoing Quote-sync into the 4 SO-creation
automation functions themselves (createSalesOrderForDifferentPipelines, createSalesOrderFromDeals,
createSalesOrderForHospitalCase, CreateSalesOrderforPoliceCase) -- each already has an
isQuoteAwaitingAcceptance guard at the very top that just returned early. The existing workflow
rule ("Create or Update Sales Order from Deals V2") already calls these ~1 minute after
Trigger_Based_On_Subform changes, which gets stamped from EVERY page (detail, create, edit)
whenever Product_Selection changes via the client scripts already built for this feature. By the
time these functions run, the change is guaranteed persisted server-side -- no pre-commit
staleness, no need for client-passed row data, no delimited-string encoding, none of the
workarounds the client-script side needed all day.

Each guard now does: if awaiting acceptance, try a cheap sync, then return (SO creation still
skipped either way). syncQuoteLineItemsOnly.deluge REDESIGNED to take just Int crmid -- reads
Product_Selection directly via zoho.crm.getRecordById (safe now, not stale) and updates only the
Quote's Product_Details. Still no PDF regen, no WorkDrive re-upload, no email -- same
deliberate restriction as before, just simpler to implement now that it's server-triggered.

onSave's else branch (the lightweight sync added earlier the same day) removed AGAIN --
unnecessary now that the guard-function sync covers Edit-page changes more simply and reliably.
onSave's only remaining job is the one-time first prompt/Quote-creation. The detail page's
beforeRowUpdate/beforeRowDelete sync branches (editedRowIndex/deletedRowIndex patching) were
NOT removed -- kept as-is for immediate/precise feedback there, with the guard-function sync now
acting as an authoritative backstop on top, not a replacement.

Investigation, not yet resolved (2026-08-10): user linked the Writer "Merge and Store V2" REST
API doc (zoho.com/writer/help/api/v1/merge-and-store-v2.html) asking to update
generateQuotePdf's `document_info = zoho.writer.mergeAndStore(...)` call to match it. That URL
describes the RAW REST v2 endpoint (POST .../merge/store, multipart form, merge_data wrapped as
{"data":[...]}, ASYNC -- returns immediately with status "inprogress", document_id nested
inside a records[] array, requires polling merge_report_data_url for completion) -- a
materially different calling convention from the native Deluge task
zoho.writer.mergeAndStore(document_id, data, output_settings, connection) already in use here,
which passes data as a flat Map (not wrapped) and has been confirmed live-working since
2026-08-07 with a flat, synchronous, top-level document_info.get("document_id") extraction. A
second linked community-forum URL (help.zoho.com/.../need-help-with-merge-and-store-v2-api-call)
turned out to be an unresolved question thread, no answer to draw from either.

Given this is a proven production PDF-generation path, did NOT blindly change the extraction to
match the v2 REST shape (records[0].document_id + polling) -- that would very likely break the
already-working flat extraction if the Deluge task doesn't actually mirror the raw REST v2
response shape (plausible: Deluge's native task may abstract/block on the older v1-style
synchronous behavior regardless of which REST version it calls internally).

Added a temporary `info document_info;` debug line right after the mergeAndStore call, to
confirm the ACTUAL live response shape on the next real quote-creation test, before deciding
whether any change is warranted at all. Remove this line once confirmed. If it turns out
document_info really is the async records[]-wrapped shape, mergedId is currently coming back
empty every time and the function is silently failing past that point on every single call --
would explain if the WorkDrive link / email were ever seen to intermittently not populate.

Wording (2026-08-10): confirm dialog buttons shortened from 'Yes, Create Quote'/'No, Create
Invoice and Sales Order' to plain 'Yes'/'No' -- Zoho's showConfirmation button labels have a
character limit the longer text was hitting. Message text unchanged ("Do you want to create a
quote for this deal?"). Updated in both product_selection_beforeRowUpdate.js and
product_selection_onSave_createEdit.js. isProceed logic unaffected (still true for the first
button, false for the second).

Extension 5 (2026-08-10): "delete one row out of several" was originally left as an accepted
"one step behind, catches up on next touch" limitation (see Extension 2) to avoid the JSON-blob
multi-row problem. Found live to actually leave the deleted product stuck on the Quote with no
guarantee anything would ever touch that Deal's Product_Selection again to trigger the
correction -- same silent-staleness bug as the add-row (Extension 4) and edit-quantity
(Extension 3) cases, just for delete. Fixed the same way: createOrUpdateQuoteFromDeal gained a
12th parameter, deletedRowIndex (String) -- when set and in bounds, excludes that entry from
the server-read productRows before building quotedItems. product_selection_beforeRowDelete.js's
"other products remain" branch now passes deletedRowIndex=index.toString() instead of nothing.
This is safe/precise (not another "one step behind" patch) because the server-side
Product_Selection read at beforeRowDelete time still reflects the pre-deletion state in the
same row order as the client, so excluding the same index the client is deleting produces
exactly the correct post-deletion list. All other call sites (beforeRowUpdate's two calls,
onSave_createEdit's two calls, beforeRowDelete's forceEmpty="true" call) updated to pass
deletedRowIndex="" -- unaffected.

Extension 4 (2026-08-10): adding a NEW product row (2nd, 3rd, etc.) to a Deal already in the
Quote flow silently failed to reach the Quote -- the previously-added product(s) stayed on it,
but the newly-added one never showed up. Root cause: the editedRowIndex patch added for
Extension 3 only handled in-bounds indices (idx < productRows.size()) -- but a brand-new row is
also not yet reflected in the server-side Product_Selection read (same pre-commit staleness as
everything else in this feature), so its index (e.g. 1, for the 2nd product) was always >= the
stale server list's size (1, since the server still only had the 1 old row). That made
`idx < productRows.size()` false, so the whole patch block silently did nothing -- the new row's
data was dropped entirely, not appended, not replacing anything. Fixed: when editedRowIndex is
out of bounds for the (stale) server-read productRows, append the fresh row instead of no-oping.
In-bounds indices (genuine edits of an already-existing row, Extension 3's original case) are
unaffected -- still replace, not append. No client-script change needed for this one -- only
createOrUpdateQuoteFromDeal.deluge changed.

Extension 3 (2026-08-10): editing Quantity or Discount on an EXISTING product row wasn't
propagating to the Quote. Root cause was the same class of bug as the deletion gap above:
beforeRowUpdate is pre-commit, so the sync branch's server read of Product_Selection still had
the OLD Quantity/Unit_Price/Discount for whichever row was mid-save -- the "sync" silently
rebuilt the Quote from stale data for that one row. Fixed by adding 5 more parameters to
createOrUpdateQuoteFromDeal (editedRowIndex, editedRowProductId, editedRowQuantity,
editedRowUnitPrice, editedRowDiscount, all String) -- 11 params total now. When editedRowIndex
is set, the function reads Product_Selection from the server as before, then rebuilds the list
with the entry at that index replaced by the fresh values passed in, before building
quotedItems -- patches the one stale row instead of trusting the server's copy of it.
product_selection_beforeRowUpdate.js's sync branch now passes row_data's current scalars +
index every time (previously passed nothing). All other call sites (the "first ever" branch,
both onSave_createEdit.js calls, both beforeRowDelete.js calls) updated to pass the 5 new
params blank -- unaffected, since the function only activates the patch when editedRowIndex is
non-empty.

NOT fixed, same limitation family: onSave_createEdit.js's sync branch (Edit page full-page
Save, editing Quantity/Discount on an existing row as part of a broader edit) still reads
Product_Selection from the server without any row-level correction, since onSave only knows
the whole subform_data array, not which single row changed -- same "one step behind, corrects
on next touch" limitation already documented for the multi-row-on-first-save case. Only the
detail page's per-row beforeRowUpdate got the precise fix, since that's the only event that
reliably knows both "this one row changed" and "here are its fresh values" at the same time.

Extension 2 (2026-08-10): product deletion was not synced to the Quote at all -- beforeRowDelete
only stamped Trigger_Based_On_Subform. Fixed with client-scripts/product_selection_beforeRowDelete.js
on all 4 detail-page layouts (script ids: Standard PC/HP 6503357000049041302,
Cremation_with_Service 6503357000049041270, Funeral_w_Burial 6503357000049124130, Ship_In_Layout
6503357000049041348). Reads the current subform via ZDK.Page.getField('Product_Selection').getValue()
and excludes the row at `index` to compute the correct post-deletion count itself, rather than
trusting a fresh server read (beforeRowDelete is pre-commit, so the row being deleted is still
present server-side at this point -- same staleness direction as beforeRowUpdate, reversed).
createOrUpdateQuoteFromDeal gained a 6th parameter, forceEmpty (String) -- when "true", skips
product-list building entirely and directly clears the existing Quote's Product_Details to an
empty list (previously, an empty product list just bailed with a message and left the old
Quote's line items stale forever, since deleting the last product leaves no future subform
event to trigger a correction). All 4 existing call sites (in beforeRowUpdate and
onSave_createEdit) updated to pass forceEmpty="" (unaffected). Deleting one row out of several
(not down to zero) deliberately still uses the existing "one step behind, self-corrects on next
touch" sync -- full multi-row precision for that case was scoped out to avoid reintroducing the
JSON-blob 400 Bad Request problem (Correction 2). Not yet verified live: whether
ZDK.Page.getField(...) works the same way on module_detail as it does on module_create/edit
(proven there, assumed here).

Extension (2026-08-10): the same prompt-once/suppress logic added to the Create and Edit
pages' PAGE-LEVEL onSave event (type: page, not subform), on all 4 layouts (8 scripts total --
module_create + module_edit x 4). These already had an active "Update Subform Trigger Time"
onSave script stamping Trigger_Based_On_Subform via getcurrentdatetime, same now+1min buffer
as the detail-page subform events -- meaning the same race existed here too, just unguarded,
for Deals created or fully-edited with products already in Product_Selection. New reference
file client-scripts/product_selection_onSave_createEdit.js, inserted into the existing 8
scripts after their existing subform_data-collection loop (unchanged) and before the existing
getcurrentdatetime line (unchanged). Script IDs: Standard PC/HP create 6503357000049041314 /
edit 6503357000049041322, Cremation_with_Service create 6503357000049041284 / edit
6503357000049041290, Funeral_w_Burial create 6503357000049041396 / edit 6503357000049041402,
Ship_In_Layout create 6503357000049041362 / edit 6503357000049041380.

Known limitation: onSave gives the WHOLE current Product_Selection state at once
(ZDK.Page.getField('Product_Selection').getValue()), not one row like beforeRowUpdate -- but
createOrUpdateQuoteFromDeal is still single-row-scalar only (to avoid the JSON-blob 400 found
earlier), so only subform_data[0] is captured into the initial Quote if multiple products were
filled in before the first-ever Save. Rows 2+ appear on the Quote the next time
Product_Selection is touched (re-syncs from the server). Suppression timing itself is
unaffected either way. Not yet verified live: whether $Page.record_id resolves to a real ID
during module_create's onSave (brand-new Deal, no ID until saved) -- the pre-existing
getcurrentdatetime call already makes this same assumption in production, so this isn't new
risk, but confirm before trusting it.

CORRECTION 3 (2026-08-10, live-tested): ZDK.Apps.CRM.Functions.execute(...) does not return the
called function's return string directly -- it returns a result object, with the actual string
at result._details.output. The "true"/"false" comparisons in both
product_selection_beforeRowUpdate.js and product_selection_onSave_createEdit.js (for
hasQuotePromptBeenShown and isQuoteAwaitingAcceptance) were comparing the raw object against
"true", which is always false regardless of the function's actual answer -- meaning the prompt
would have fired on every save, and the "already in quote flow, keep in sync" branch would
never have run. Fixed by reading .{_details.output} into a separate *Result variable before
comparing (alreadyPromptedResult, alreadyInQuoteFlowResult). Note: the unrelated
getcurrentdatetime call's return value was never used for any logic, so it wasn't affected by
this and doesn't need the same fix.

Not yet verified live: whether the client-side row_data object from ZDK's row-save event uses
the same key shape (Child_Product.id, Quantity, Unit_Price/Price, Discount) as the REST-API
shape from dealInfo.get("Product_Selection") that the rest of createOrUpdateQuoteFromDeal was
written against. Confirm via browser console before trusting firstRowData in production — see
deployment-checklist.md.

CORRECTION (2026-08-10, same day): the first pass of this fix put the new logic on the
Product_Selection onRowAdd event and gated the one-time prompt on index==0. Both were wrong,
caught by the user before deployment:
  - onRowAdd fires when "Add Row" is clicked, BEFORE the user has entered a product/qty/price
    -- row_data would be empty at that point. Moved to beforeRowUpdate instead, which fires
    right before the row's actual field data saves.
  - index==0 can't distinguish "this row's first-ever save" from "editing that same row again
    next week" -- both fire beforeRowUpdate for index 0. Replaced with a dedicated System_Data
    flag, Quote_Prompt_Shown (same storage convention as Awaiting_Quote_Acceptance, just a
    different Name key), set the first time the prompt is shown and checked before ever
    showing it again for that Deal -- independent of which row index triggered it.
  - Two new functions: standalone.hasQuotePromptBeenShown(Int crmid), standalone.
    markQuotePromptShown(Int crmid) -- direct clones of isQuoteAwaitingAcceptance/
    setQuoteAwaitingAcceptance's System_Data query pattern, different Name key.
  - client-scripts/product_selection_onRowAdd.js is now a revert note (goes back to just the
    original getcurrentdatetime stamp, nothing added). The live logic lives in the new
    client-scripts/product_selection_beforeRowUpdate.js, applied to the existing
    beforeRowUpdate "Update Subform Trigger Time" script on all 4 layouts (not onRowAdd).

CORRECTION 2 (2026-08-10, live-tested): first live test of the beforeRowUpdate call threw
400 Bad Request. Root cause: ZDK.Apps.CRM.Functions.execute sends function arguments as URL
query parameters even though the underlying call is POST — passing one JSON-stringified
blob (firstRowData, containing raw {, }, :, , characters) as a single param value produced a
malformed/oversized URL the endpoint rejected. This also gave us the real live row_data shape
for free (confirmed via the failed request's own query string): {Child_Product:{id,name},
Child_Category, Discount, Quantity, Unit_Price, Parent_Product, plus several always-null
fields (Casket_Package_For, Invoice_Row_ID, Media_Selections_Record_ID, Sales_Order_Row_ID,
Vehicle_Booking_ID) irrelevant here} — matches what createOrUpdateQuoteFromDeal's parsing
already expected.

Fix: replaced the single firstRowData JSON param with four flat scalar params —
firstRowProductId, firstRowQuantity, firstRowUnitPrice, firstRowDiscount — read directly off
row_data.Child_Product.id / .Quantity / .Unit_Price / .Discount in the client script. Matches
the same flat-scalar-args pattern already proven working via getcurrentdatetime. Function
signature is now createOrUpdateQuoteFromDeal(String dealId, String firstRowProductId, String
firstRowQuantity, String firstRowUnitPrice, String firstRowDiscount) — builds a single-row
Product_Selection-shaped Map from those four scalars when firstRowProductId is non-empty,
else falls back to the old server-read (used by the "already in quote flow, keep in sync"
branch, which passes all four as empty strings).
