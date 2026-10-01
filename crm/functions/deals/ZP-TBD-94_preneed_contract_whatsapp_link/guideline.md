# ZP-TBD-94 -- Pre-Need contract by WhatsApp: no email needed, link works for up to a year

**Status: applied + confirmed working 2026-10-01.** Built on the live source of `standalone.sendPreNeedFuneralContractEmbedded`
pulled 2026-10-01 (copy in `rollback/`). Source of the findings: `projectDocuments\Sign Whatsapp CC finding issues.txt`.

## What happens today

The WhatsApp widget (`sendLinksViaWhatsApp`, button **Add contract link**) calls `sendPreNeedFuneralContractEmbedded`:

1. **Email required.** If the NOK Contact has no email, the function stops with "Email is not available."
   (It also returns that as a plain string rather than JSON, so the widget shows a generic error instead of the
   real reason.)
2. **Link dies after 2 minutes.** The function puts Zoho Sign's embedded URL (from `/embedtoken`) straight into the
   WhatsApp message. Zoho's documentation says that URL is *"valid for two minutes"* and *"one-time usable"*. So
   the family can't open it later, and can't open it a second time.

## What changes

| # | Issue | Outcome |
|---|---|---|
| 1 | Email | Zoho Sign **requires** a `recipient_email` on every signer, embedded or not, so the email can't be removed from the API call. But Zoho never emails an embedded signer (*"Signing link via email/SMS and reminder notification will not be sent to the recipients who are mapped as Embedded recipients"*). So when the Contact has no email, `info@dfhja.com` stands in. The family doesn't need an email. The email box on the contract (Text - 23) still prints only the Contact's real email. |
| 2 | 2-minute link | WhatsApp now gets a **permanent DFH link** to a new Creator page, `Sign_PreNeed_Contract`. Each time the family opens it, the page asks CRM for a **fresh** Zoho Sign URL and shows one large **Open & Sign Contract** button. The button opens Zoho Sign full screen in the browser, in Zoho's own mobile layout. |
| 2b | 365 days | Zoho caps `expiration_days` at 2 digits (365 -> error 9011 "too many characters"). So the request is created with **99** days, then right away **extended to one year from today** through Zoho's Extend API (`PUT /requests/{id}/extend`, `expire_by`). The permanent link keeps working until then, or until it is signed. |

How the link is protected: it carries the Sign request ID **and** the Deal ID (`?rid=...&did=...`).
`getPreNeedContractSignUrl` only opens it if a ZohoSign Documents record ties that request to that Deal. If either
number is changed, the page shows "not valid".

## Pieces

| # | Where | What | File |
|---|---|---|---|
| A | CRM > Functions | **New** standalone `getPreNeedContractSignUrl(rid, did)` + REST API key | `getPreNeedContractSignUrl_NEW.deluge` |
| B | Creator app **nok-information-form** | **New** page `Sign_PreNeed_Contract`, published | `creator_page_Sign_PreNeed_Contract_snippet.html` |
| C | CRM > Functions | **Replace** `sendPreNeedFuneralContractEmbedded` | `sendPreNeedFuneralContractEmbedded_UPDATED.deluge` |
| -- | WhatsApp widget | **No change.** It already reads `sign_url` from the function's JSON, and that key now holds the permanent link. | -- |

Apply them in this order (A -> B -> C). Each step needs the URL produced by the step before it.

---

## A. CRM -- new function `getPreNeedContractSignUrl`

1. CRM > Setup > Developer Hub > Functions > **+ New Function**.
   - Function name: `getPreNeedContractSignUrl`, Display name: `Get Pre-Need Contract Sign URL`
   - Category: **Standalone**
2. Arguments: `rid` (String), `did` (String). Use exactly these names, because the Creator page passes them by name.
3. Paste `getPreNeedContractSignUrl_NEW.deluge` and **Save**.
4. In the Functions list, hover the function > **⋯** > **REST API** > switch on **API Key** > **Save**.
   Copy the API Key URL. It looks like:
   `https://www.zohoapis.com/crm/v7/functions/getpreneedcontractsignurl/actions/execute?auth_type=apikey&zapikey=1003.xxxxxxxx`
5. Quick check: **Execute** the function with `rid` / `did` from an existing ZohoSign Documents record
   (fields `Request_ID` and `Deal`). Expected: `"status":"success"` with a `sign_url` for an open request,
   `"signed"` for a completed one, or `"closed"` for an expired or recalled one.

## B. Creator -- new page `Sign_PreNeed_Contract` (app **nok-information-form**)

This is the same app that holds `Global_Thank_You_Page`, which the contract already redirects to after signing.
The page is built the same way as the Headstone app's `Headstone_Form_Page`: page variables plus an HTML Snippet
with Deluge.

1. Open **nok-information-form** > Edit > **Pages** > **+ New Page** > blank page.
   Name: `Sign_PreNeed_Contract`, Display name: `Sign Pre-Need Contract`.
2. **Page Script** > **Variables** tab: add two variables, `rid` (String) and `did` (String).
   **Script** tab:
   ```
   input.rid = input.rid;
   input.did = input.did;
   ```
3. Drag an **HTML Snippet** onto the page and stretch it to full width.
   Open its editor, paste the **whole** of `creator_page_Sign_PreNeed_Contract_snippet.html`, then replace
   `PASTE_CRM_FUNCTION_REST_API_URL_HERE` with the API Key URL from **A4**. Save.
4. Publish the page: Settings > **Publish** > Pages > `Sign_PreNeed_Contract` > **Publish**.
   Copy its permalink:
   `https://creatorapp.zohopublic.com/delapenhafuneralhome/nok-information-form/page-perma/Sign_PreNeed_Contract/<key>`
5. Quick check: open `<permalink>?rid=<rid>&did=<did>` (same values as A5) on your phone. The page should show the
   **Open & Sign Contract** button, and tapping it should open the contract full screen with **Start Signing**
   visible. Do not sign the test record unless it is a test Deal.

## C. CRM -- replace `sendPreNeedFuneralContractEmbedded`

1. CRM > Setup > Developer Hub > Functions > `sendPreNeedFuneralContractEmbedded` > Edit.
2. Replace the **whole** code with `sendPreNeedFuneralContractEmbedded_UPDATED.deluge`.
3. Replace `PASTE_SIGN_PAGE_PERMA_URL_HERE` with the permalink from **B4**. Paste the bare permalink with nothing
   after it (no `?`). The function adds `?rid=...&did=...` itself.
   Until it's replaced, **Add contract link** shows "Contract signing page URL is not set", and no Sign request
   is created.
4. **Save**.

What changed in this function (full diff against `rollback/`):

- No email -> `info@dfhja.com` is used as the signer email (Zoho requirement only, never emailed).
- `actionMap.put("expiration_days",99);` on the Sign request (Zoho's 2-digit maximum), then a
  `PUT https://sign.zoho.com/api/v1/requests/{request_id}/extend` with `expire_by` = today + 365 days
  (`dd MMMM yyyy`, e.g. `01 October 2027`). If the extend is refused, the send still goes ahead on 99 days and the
  function log shows `ZP-TBD-94 extend: ...` with Zoho's reason.
- The `/embedtoken` call is removed. `sign_url` is now `<permalink>?rid=<request_id>&did=<Deal ID>`.
- The ZohoSign Documents record is now **checked**. It used to be inside an empty `catch`. The page needs this
  record to open the link, so if it fails, staff now see a clear error instead of sending a link that won't work.
- Returns `result.toString()` everywhere (the old no-email branch returned a plain string).

## D. Check the 365 days (one time, during testing)

Confirmed in testing (2026-10-01): `expiration_days` accepts at most 2 digits, so 365 is refused at creation.
Zoho's docs don't give a maximum for the Extend API, so after the first test send:

1. Zoho Sign > **Sent** > open the new request and check its expiry date. It should be **one year from today**.
2. If it shows about 99 days instead, the extend was refused. Open the function log
   (`sendPreNeedFuneralContractEmbedded` > Logs) and read the `ZP-TBD-94 extend:` line for Zoho's reason, then send
   it to us. The link still works for the 99 days meanwhile.

## Why a button, not the contract inside the page

The first build showed Zoho Sign in an iframe. Inside Creator's own page and snippet frames, that produced three
nested scrollbars, and on a phone the **Start Signing** button was hard to find. The page now shows one button that
opens Zoho Sign full screen in the browser, which is the same way the old WhatsApp link opened it.

- The button's signing URL is created when the page loads. Zoho keeps it valid for 2 minutes and it works once. That
  is why the page says "If the contract does not open, please reload this page and tap the button again". A reload
  always gets a new URL.
- If tapping the button does nothing in some phone browser (a Creator snippet frame blocking new tabs), change
  `target="_blank"` to `target="_top"` in the snippet and save.

---

## Not changed / scope

- **Automatic send and the Send Pre Need Funeral Contract button** use `sendPreNeedFuneralContractEmail`. That's the
  email path, where Zoho emails the contract, so it still needs an email. That's intended, and those paths are
  untouched.
- **Contracts already sent by WhatsApp before this change** still carry the old 2-minute link. If a family hasn't
  signed yet, staff should send a new one with **Add contract link** after this is applied.
- Every **Add contract link** click still creates a new Sign request (unchanged; the button stays disabled after
  one click).

## Rollback

Paste `rollback/sendPreNeedFuneralContractEmbedded_CURRENT.deluge` back into `sendPreNeedFuneralContractEmbedded`.
The new function and Creator page can stay; nothing else calls them. Links already sent in the new format stop
working only if the Creator page is deleted or unpublished.
