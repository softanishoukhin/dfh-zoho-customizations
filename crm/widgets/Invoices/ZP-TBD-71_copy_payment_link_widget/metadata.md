# ZP-TBD-71 — Copy Payment Link widget (Invoices)

**Widget:** `D:\Office\Andrea_Projects\DFH\widgets\copyPaymentLink\copyPaymentLinkWidget\app\widget.html`
(source mirrored in this folder — `app/widget.html`, `app/app.js`).

## What it does

Widget-type popup opened from a custom button on the Invoices module. Lists
the Invoice's `Potential_Payers` related records in a dropdown ("Send an
invoice to whom?"). Once a payer is selected, builds two Fygaro payment
links from that Invoice's amount fields and the selected payer's record id,
each with a copy-to-clipboard icon.

- JMD link base: `https://www.fygaro.com/en/pb/fcc1b731-0deb-4893-a8e8-92c3e90a913e`
- USD link base: `https://www.fygaro.com/en/pb/3d8fef8a-2e68-436f-9fb5-2f2783253bdb`
- Query string: `?amount={value}&custom_reference={value}` (URL-encoded)

## Field / module references (see `shared/field-api-names/` conventions)

- `Invoices.Amount_in_JMD` — text field, e.g. `"623450.00"`
- `Invoices.Amount_in_USD` — text field, e.g. `"3949.56"`
- `Potential_Payers` — standalone custom CRM module, related-list API name
  `Potential_Payers` on Invoices (`Invoices/{id}/Potential_Payers`)
- `Potential_Payers.Name` — display label used in the dropdown
- `Potential_Payers.id` (system id) — used as `custom_reference`; there is
  no separate "Potential Payer Id" custom field, the record's own id is
  used

## Build notes

- Vanilla widget SDK pattern (jQuery + `ZohoEmbededAppSDK.min.js`), matching
  `preNeedFromContactWidget`'s convention: `app/widget.html` (markup/CSS +
  script tags) with logic split into a separate `app/app.js`, no build step.
- `ZOHO.CRM.API.getRecord` (Invoices) + `ZOHO.CRM.API.getRelatedRecords`
  (`RelatedList: "Potential_Payers"`) — no CRM function call needed, purely
  client-side link generation from already-available record data.
- Copy button uses `navigator.clipboard.writeText` with an
  `document.execCommand("copy")` fallback; shows a "Copied!" tooltip on
  success and an error banner if the copy itself fails (rather than failing
  silently).
- If an amount field is blank on the Invoice, that row shows "Amount not
  set on this Invoice" instead of generating a broken link.

## Outstanding

- CRM custom button (Widget type) on Invoices module still needs to be
  created/pointed at this widget — not yet done as of this commit.
- Task ID is a placeholder (`ZP-TBD-71`) pending a real Zoho Projects task
  number.

## Status

Built and tested working in the live widget 2026-09-18. Not yet deployed
via a CRM button.
