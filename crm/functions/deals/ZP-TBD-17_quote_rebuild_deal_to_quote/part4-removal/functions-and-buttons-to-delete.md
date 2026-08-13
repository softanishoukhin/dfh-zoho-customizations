# Remove entirely (functions + buttons)

Delete these AFTER the client-script updates and the SO-function guard removal
are live and confirmed working (see `../deployment-checklist.md` for order) --
by the time you get here, nothing should be calling any of them anymore, so
deleting them is cleanup, not a live behavior change.

## Functions to delete

Search each by name in **Setup > Developer Space > Functions** and delete
(or deactivate first, delete once confirmed nothing errors for a few days --
your call).

1. **`standalone.hasQuotePromptBeenShown(Int crmid)`** -- System_Data
   `Quote_Prompt_Shown` flag reader. Referenced only from the 16 client
   scripts (already updated by this point). Confirmed live 2026-08-13 this
   function still exists; exact function ID wasn't in the ID range this
   session's function-list pull surfaced -- search by name, not ID.
2. **`standalone.markQuotePromptShown(Int crmid)`** -- same flag, writer side.
   Same removal reasoning and same caveat on ID.
3. **`standalone.syncQuoteLineItemsOnly(Int crmid)`** -- the automation-guard
   backstop sync. Referenced from the 4 SO-creation functions' guard blocks
   (removed in `so-function-guard-removal.md`) and from the client scripts.
   Once both of those are gone, this has no callers left.
4. **`standalone.convertQuoteToSalesOrder(String dealId)`** (id
   `6503357000077155050`, confirmed live) -- per Andrea's spec: "the quote no
   longer drives billing, so there is nothing to convert. Remove entirely."
   Confirmed live code pulled 2026-08-13 -- current version has the
   empty-Quote guard and already-converted guard (2026-08-12 fixes), neither
   of which matters once this function is deleted.

## Not being deleted (still needed, unchanged)

- `standalone.isQuoteAwaitingAcceptance` / `standalone.setQuoteAwaitingAcceptance`
  -- ONLY DELETE THESE IF nothing else in the org calls them. They were
  written for this feature, but double-check first (search "Awaiting_Quote_Acceptance"
  and these two function names org-wide) since they follow the exact same
  System_Data-flag pattern as several other unrelated features in this org --
  confirm they're not reused elsewhere before deleting. If in doubt, leave
  them in place; an unused function that returns "false" from an
  empty/never-set System_Data row is harmless.
- `standalone.createOrUpdateQuoteFromDeal` -- NOT deleted, TRIMMED. See
  `../part5a-pull-button/`. The current 12-argument version becomes the base
  for the new, much smaller pull-button function -- don't delete this one
  before building its replacement from it.
- `standalone.generateQuotePdf` -- unchanged, reused per Andrea's Part 6.
- The suppression flag itself (System_Data rows with
  `Name = "Awaiting_Quote_Acceptance"` or `Name = "Quote_Prompt_Shown"`) --
  no cleanup needed. Once nothing reads or writes them, they're just inert
  rows; not worth a data-cleanup pass.

## Buttons to remove from the Deals module

Per the existing ZP-TBD-9 metadata: two native Deal custom buttons were
created for this feature --

1. **"Create/Update Quote"** -- already superseded by the client-script popup
   flow per the ZP-TBD-9 deployment checklist (was already meant to be
   deactivated once that shipped -- confirm it actually was; if not, remove
   it now).
2. **"Convert Quote to Sales Order"** -- calls `standalone.convertQuoteToSalesOrder`,
   which is being deleted above. This button must be removed in the same pass
   (a button pointing at a deleted function will error if clicked).

Find both under **Setup > Customization > Modules and Fields > Deals > Buttons**
by name. No button IDs were available to give more precisely -- there was no
list-by-module tool exposed to this session for CRM custom buttons (only
lookup-by-known-ID), so please confirm by name in the UI rather than an ID
I'd otherwise be guessing at.
