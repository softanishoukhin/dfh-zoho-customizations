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

## Not yet done
`clearQuoteProducts` (the "Clear Products" button on the Quote, per the same spec doc) has not
been reported as built. Still pending — code is in the original spec doc, or ask again when
ready.
