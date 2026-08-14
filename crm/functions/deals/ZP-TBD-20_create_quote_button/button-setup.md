# Deal button "Create Quote" — setup

- **Module:** Deals
- **Placement:** Details Page, top-right, first button
- **Action type:** Client Script
- **Function called:** `button.createQuoteFromDeal(dealId)` — see `createQuoteFromDeal.deluge`
  in this folder

## Client Script (live, confirmed working 2026-08-14)

Corrected from the first draft in two ways, confirmed by live testing:
1. `event.data.entity.get("id")` (which assumes a client-script event object) replaced with
   `$Page.record_id` — the actual global available in this button's Client Script context.
2. `ZDK.Apps.CRM.API.invokeCustomFunction(...)` replaced with
   `ZDK.Apps.CRM.Functions.execute(...)`, and the response field read as `response._details.output`
   (leading underscore) rather than `response.details.output`.
3. Navigation uses `ZDK.Client.navigateTo('record_detail', {module, record_id})` instead of
   `ZDK.Page.setRedirectURL(url)` — this is the method that actually worked live; the
   `setRedirectURL` guess from the first draft was not tested/used.

```javascript
var dealId = $Page.record_id;

response = ZDK.Apps.CRM.Functions.execute("createQuoteFromDeal", {
    "dealId": dealId
});
try {
    console.log(response);
    var quoteId = response._details.output;
    // The Deluge function returns either the new Quote id, or an
    // error string starting with "Missing"/"Deal not found"/"Failed" —
    // guard against navigating to a bad id.
    if (quoteId && quoteId.indexOf(" ") === -1 && quoteId.length > 10) {
        ZDK.Client.navigateTo('record_detail', {
            module: 'Quotes',
            record_id: quoteId
        });
    } else {
        ZDK.Client.showAlert("Could not create Quote: " + quoteId);
    }
} catch (error) {
    ZDK.Client.showAlert("Create Quote failed: " + JSON.stringify(error));
}
```

## Status
Deployed and tested live 2026-08-14 — confirmed working by the user directly on a Deal.

## Not yet confirmed
The Quote-side "Clear Products" button (`clearQuoteProducts`, part of the same spec doc)
has not been reported as built/tested yet — `getFunctionCode` found no live function at
api_name `clearquoteproducts` as of 2026-08-14. Still pending; see the original spec
(`DFH_CreateQuoteButton_Fix_Spec_2026-08-14.docx`) for its code, or ask for it again when
ready to build that piece.
