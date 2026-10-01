# ZP-TBD-94 -- metadata

| Item | Value |
|---|---|
| Task | Pre-Need contract via WhatsApp: no email requirement + long-lived signing link (CC findings) |
| Ticket | ZP-TBD-94 (placeholder; rename the folder once a real Zoho Projects ID exists) |
| Status | Applied + confirmed working 2026-10-01 |
| Changed function | `standalone.sendPreNeedFuneralContractEmbedded(String crmid)`, returns `string` (JSON) |
| New function | `standalone.getPreNeedContractSignUrl(String rid, String did)`, returns `string` (JSON); REST API (API key) on |
| New Creator page | app `nok-information-form` (owner `delapenhafuneralhome`), page `Sign_PreNeed_Contract`, variables `rid`, `did`; published |
| Caller | Widget `sendLinksViaWhatsApp` (`CONTRACT_FUNCTION = "sendpreneedfuneralcontractembedded"`), reads `status` / `sign_url` / `message`. No change needed. Only caller (ZP-TBD-73 guideline, confirmed 2026-09-21). |
| Connection | `zohooauth` (Zoho Sign + CRM), the same connection the sender already uses, so the request owner matches for `/embedtoken` |
| Sign templates | Full `441773000001137101`, One Page `441773000001155005` (from `standalone.getPreNeedContractType`) |
| Module / fields read | `zohosign__ZohoSign_Documents`: `Request_ID`, `zohosign__Deal` (link check) |
| Placeholder signer email | `info@dfhja.com`, same address the embalming embedded form uses (ZP-TBD-73 metadata) |

## Zoho facts this relies on (docs checked 2026-10-01)

- https://www.zoho.com/sign/api/embedded-signing.html
  - `recipient_email` must be given for each embedded recipient.
  - Embedded recipients get no signing link by email/SMS and no reminders.
  - The `/embedtoken` `sign_url` is *"valid for two minutes"* and *"one-time usable"*. `host` = the domain that
    shows it.
- https://www.zoho.com/sign/api/document-managment/create-document.html
  - `expiration_days`: "No of days after which the document will expire." No maximum is documented, so 365 is
    verified in testing (guideline step D).

## Decisions

- Permanent link = Creator public page (not a CRM function URL): a CRM function REST call returns JSON, not a page,
  so it can't show the contract itself. The Creator app already hosts the contract's thank-you pages, and `host`
  was already `creatorapp.zohopublic.com`.
- Link check uses the existing ZohoSign Documents record (Request_ID + Deal) rather than new fields. Deals is close
  to its field limit. That's why the sender now fails loudly if that record can't be saved.
- `sign_url` key name kept so the widget needs no redeploy.

## Open / to confirm during testing

1. `expiration_days: 365` was refused live (2026-10-01): `{"code":9011,"error_param":"expiration_days","message":"You have entered too many characters"}`,
   so the field is 2 digits max. Now 99 + `PUT /api/v1/requests/{id}/extend` (`expire_by` "dd MMMM yyyy",
   https://www.zoho.com/sign/api/document-managment/extend-document.html). Still to confirm: Zoho accepts a
   one-year extend (Guideline D).
2. The iframe version showed three nested scrollbars on mobile (user test 2026-10-01). It was replaced with a
   full-width "Open & Sign Contract" button (`target="_blank"`) that opens Zoho Sign top-level. Still to confirm:
   the button opens in the WhatsApp in-app browser (fallback `target="_top"`).
3. `info@dfhja.com` as stand-in signer email: confirm the mailbox is fine with receiving Zoho's completed-document
   copy for families without an email.

## Sources pulled

- CRM `getFunctionCode`: `sendpreneedfuneralcontractembedded` (live, 2026-10-01 -> `rollback/`),
  `getpreneedcontracttype` (template IDs).
- Widget source: `widgets\sendLinksViaWhatsApp\sendLinksViaWhatsApp\app\app.js` (`onAddContractClicked`).
- Creator page pattern: `backup\Headstone_Request.ds` (`Headstone_Form_Page`: page variables + HTML Snippet Deluge).
- Zoho Sign MCP was disabled (code 31006), so the templates' current expiry couldn't be read.
