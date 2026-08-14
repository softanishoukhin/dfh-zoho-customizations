Task ID: ZP-TBD-20 (placeholder)
Zoho App: CRM
Module: Deals -> Quotes
Function Names: button.createQuoteFromDeal (built + live), button.clearQuoteProducts (spec'd,
not yet confirmed built)
Function Type: Button (both, per DFH's confirmed convention: functions written from inside a
button's own action-setup flow get the `button.` category automatically)
Trigger Source: Deal detail page custom button "Create Quote" (Client Script) — see
button-setup.md
Related Fields: Deals.Product_Selection, Quotes.Quoted_Items, Quotes.Deal_Name,
Quotes.Contact_Name, Quotes.Account_Name, Quotes.Quote_Stage
Related Modules: Deals, Quotes
Created By: Andrea's spec (DFH_CreateQuoteButton_Fix_Spec_2026-08-14.docx), built by client's
developer, guided by Claude Code
Last Updated By: Claude Code (synced to live 2026-08-14 after user's live corrections)
Sandbox Tested: No — tested live on one Deal
Production Deployed: Yes (createQuoteFromDeal + Client Script only) — 2026-08-14

## Background
Andrea's spec: the shipped design put "Pull Products from Deal" on the Quote itself, but Zoho
won't save a Quote with zero line items — forcing staff to create a throwaway product just to
save the Quote before they could pull. This moves Quote creation to a one-click button on the
Deal: create the Quote, auto-pull the Deal's products, generate the PDF, and open the new
Quote — all in one click.

## What was guided vs. what changed live
Guided the user through building the Deal button function and an initial Client Script draft.
The user's developer then tested live and reported two categories of correction, applied here
via live source pull (per this repo's live-source-first rule):

1. **Deluge function** (`createQuoteFromDeal.deluge`): the create-Quote line-item write uses
   capitalized keys (`Product_Name`/`Quantity`/`List_Price`) rather than the lowercase system
   keys the original draft used — see the file's own header note for why this is NOT the same
   pattern as `pullProductsFromDeal`'s confirmed fix (that one needed lowercase, for a
   different reason: it's a PUT-update on an existing Quote's `Quoted_Items`, not a POST-create
   of a new one). Also added an `Account_Name` carry-over from the Deal (the original spec only
   carried Contact_Name), because the Quotes layout requires an Account.
2. **Client Script**: `$Page.record_id` instead of an event-object read; Zoho's real API is
   `ZDK.Apps.CRM.Functions.execute(...)` (not `ZDK.Apps.CRM.API.invokeCustomFunction`), the
   response field is `response._details.output` (leading underscore), and navigation uses
   `ZDK.Client.navigateTo('record_detail', {module, record_id})` rather than
   `ZDK.Page.setRedirectURL(url)`. The first draft guessed at all three API names since they
   weren't independently verified before testing — now corrected to the confirmed-working
   calls for future reference.

## clearQuoteProducts — built, deployed, blocked on a platform constraint (2026-08-14)
Built and deployed per spec. First live test: button reported "Products cleared" but the line
items stayed on the Quote. Root cause traced by pulling the live function: the original code
only checked for a THROWN exception from `invokeurl`, but Deluge's `invokeurl` does not throw
on an API-level rejection -- it returns a normal response Map with the error embedded inside.
The function always fell through to the success return regardless of what Zoho actually did.

Deployed a diagnostic fix (`clearQuoteProducts.deluge`, this folder) that reads the real PUT
response. Retested — actual Zoho response:
```
{"data":[{"code":"MANDATORY_NOT_FOUND","details":{"api_name":"Quoted_Items","json_path":"$.data[0].Quoted_Items"},"message":"required field not found","status":"error"}]}
```

**Root cause: the Quotes layout has `Quoted_Items` (Product Details) marked Mandatory.** Zoho
rejects any save — including this PUT — that would leave a Quote with zero line items. This
directly contradicts the "Clear Products" button's whole purpose (letting staff build an
independent quote by hand starting from zero products) and is the same constraint the spec
doc's own background section named as the ORIGINAL problem this whole feature was meant to
get away from ("Zoho won't save a Quote without a line item").

**This cannot be fixed in Deluge.** A mandatory-field validation is enforced by the layout
itself before any custom code runs. The only fix is a layout change: Setup → Customization →
Modules and Fields → Quotes → Layout → Product Details section → uncheck "Mark as Mandatory".

**Status: NOT applied.** User's call — flagged as a layout-wide change (affects every way a
Quote gets saved, not just this button) that needs Andrea's decision, not something to push
through unilaterally. Documented here for the completion report. `clearQuoteProducts` stays
deployed with the diagnostic fix in place (so any future failure is visible instead of silently
reporting success), but the button will keep failing with this same MANDATORY_NOT_FOUND error
until/unless the layout is changed.
