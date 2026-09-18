# ZP-TBD-70 (T-10) — Pre-Need Final Wishes Questionnaire — as-built guideline (v4, final)

**Status: production-deployed and confirmed working end-to-end (2026-09-18, full test pass).** This
supersedes the earlier v1/v2/v3 drafts in this folder's git history — v1 got the widget-template
question wrong, v2 didn't yet know about the CRM-module pivot, and v3 still had the launcher as a
Deluge button (since replaced by a Widget, §5) plus two live prefill bugs (§8). Read this file, not
the git history, for how it actually works today.

Source code lives in two places:
- `functions/` next to this file — the 5 Creator Custom API Deluge functions, copied from
  `D:\Office\Andrea_Projects\DFH\widgets\Pre-Need Questionnaire\Pre_Need_Questionnaire\functions\`
  (the live source of truth — paste any future edits there first, then re-copy here).
- `widget/` next to this file — `app.js` / `widget.html`, copied from
  `...\Pre_Need_Questionnaire\app\` (that folder has no git repo of its own, unlike NOKIntake/
  Driver App, so this copy is the only version control it has).
- The CRM launcher's own source (the live Widget, plus the two abandoned attempts kept as
  history) lives in `crm/functions/deals/ZP-TBD-70_pre_need_questionnaire_build/` and
  `crm/client_scripts/ZP-TBD-70_pre_need_questionnaire_build/` — see §5.

---

## 1. Zoho Creator Application

| | |
|---|---|
| Workspace | `delapenhafuneralhome` |
| App link name | `pre-need-questionnaire` |
| Form | `Final_Wishes_Form` |
| Page | `Final_Wishes_Form1` (Creator auto-suffixed the "1" — only matters for the URL, the form itself is `Final_Wishes_Form`) |
| Page perma-link | `https://creatorapp.zohopublic.com/delapenhafuneralhome/pre-need-questionnaire/page-perma/Final_Wishes_Form1/zS4dtZBC7VwnvsJTumgwyfTbG89Sw2kXaKMjrnkt0pghN0V7ePR1u6JaRW3Cv8CsvRHbB0nRCyqHqCw741YfYh8wdZYtWrh540uA` |
| Form component | also published separately (Publish > Publish New) — required for the SDK's public write path to have any effect, though ultimately unused (see §6, submission architecture) |

---

## 2. Deal fields (Deals module, `Standard__s` layout — the "PC" pipeline)

| Field | Type |
|---|---|
| `Pre_Need_Questionnaire_Status` | Picklist: `-None-`, `Sent`, `Completed` |
| `Pre_Need_Questionnaire_Edit_URL` | Website — holds the perma link; gets `&record_id=` appended once a submission exists, so reopening it resumes instead of starting blank |
| `Pre_Need_Specialist` | Single line text |
| `Pre_Need_Date` | Date |
| `Pre_Need_Date_Completed` | Date |
| `Pre_Need_Signature` | Image Upload |
| `Pre_Need_Payer_Or_Beneficiary` | Picklist: `Payer`, `Beneficiary / IFR` |

Deals was already at 302 custom fields when this started; all 7 fields were created without
issue — the field-limit risk flagged at the start of this task didn't materialize.

---

## 3. CRM module: Pre-Need Questionnaire (`Pre_Need_Questionnaire`)

Added mid-build, kept **in parallel** with `Final_Wishes_Form` (both get written on every
submit) — but this module is now the **primary source for edit/resume prefill**, not the Creator
form. Full field list and rationale: see `new_crm_module_guideline.md` in this same folder. Flat
fields throughout (no composite Name/Address types) — CRM writes proved far more reliable than
Creator's own composite-field/subform/Signature-field quirks (§8).

Subform `Persons_Responsible`'s own fields, as Zoho actually created them: `Name1` (plain text —
"Name" got auto-suffixed since it collided with a reserved name), `Relationship`, `Phone`.

---

## 4. `Final_Wishes_Form` fields (Creator form — kept as a parallel store)

Unchanged from the original build — see the field table in this folder's git history (v2) if
needed; the field list itself never changed, only how it's populated (§8) and that it's no longer
the resume/prefill source.

---

## 5. CRM launcher (Deals custom button — "Send Pre-Need Questionnaire")

**Current, live implementation: a Widget-type button**, not Deluge. Source:
`copyPreNeedQuestionnaireLinkWidget/` next to this file (copied from
`D:\Office\Andrea_Projects\DFH\widgets\copyPreNeedQuestionnaireLink\copyPreNeedQuestionnaireLinkWidget`,
which has no git repo of its own — same situation as the main questionnaire widget). Clicking it
opens a small popup that builds/saves the link and shows a one-click **Copy** button, mirroring
`copyPaymentLinkWidget`'s own proven pattern — everything (reading the Deal's existing edit URL,
preserving `record_id` on resend, building the link, saving it back) happens directly in the
widget's JS via `ZOHO.CRM.API.getRecord`/`updateRecord` (`Trigger:["workflow"]`), no Deluge
function involved.

**Two earlier implementations were tried and abandoned, in this order (both kept in the repo as
reference/history, both marked dead in their own file headers):**
1. `sendPreNeedQuestionnaire.deluge` as a plain button "Writing Function" ending in `openUrl()` —
   worked, but opened a new tab instead of letting staff copy the link, which the user wanted
   changed. Its resend-preserves-`record_id` fix (reads the Deal's current edit URL first, only
   resets status/date on a genuinely first send) is the same logic now reimplemented in the widget.
2. Converting that into a callable Custom Function + a Client Script on the button, to copy the
   returned URL to the clipboard — **abandoned**: confirmed live that Zoho CRM Client Scripts run
   in a sandbox with **no DOM access at all** (`document` is `undefined` there — a `TypeError:
   Cannot read properties of undefined (reading 'createElement')` on the very first test, before
   even reaching `navigator.clipboard`). Genuine clipboard access needs a real iframe with full
   DOM, i.e. a Widget, not a Client Script — this is a platform limitation, not a code bug, and
   applies to any future "copy X to clipboard from a CRM button" request in this org.

---

## 6. The 5 Custom APIs — submission & prefill architecture

**Why not `ZOHO.CREATOR.DATA.addRecords()`:** it 401s for an unauthenticated visitor on this public
perma-link page — confirmed via the browser Network tab, request to
`creatorapp.zohopublic.com/creator/v2.1/data/.../form/Final_Wishes_Form`.

**Why not Zoho's REST Publish API either** (the documented `privatelink`-authenticated endpoint
meant for exactly this "anonymous submit" case): calling it directly from browser JS is blocked by
CORS — that API is built for server-to-server/curl callers, not client-side fetch.

**What actually works:** routing everything through Custom APIs (`ZOHO.CREATOR.DATA.
invokeCustomApi`), the one channel already proven unauthenticated-safe on this page (same as
`getDeal`). `submitFinalWishes` creates the record server-side using Deluge's native `insert into
Form [...]` syntax — confirmed live elsewhere in this org (`Driver_App.ds:770`,
`Headstone_Request.ds:737`) — never REST, never the SDK write path.

- GET calls (`getDeal`, `getCreatorRecord`, `getQuestionnaireForDeal`) use `query_params` as a
  plain string (not an object — the SDK build in use here mishandles an object there, same
  workaround NOKIntake's own `callApi()` uses), with a raw-`fetch()` fallback to the publickey URL
  if `invokeCustomApi` rejects.
- POST calls (`submitFinalWishes`, `completePreNeedQuestionnaire`) use the `payload` config key
  instead — a real JSON body, not a query string, since the signature image alone can be tens of
  KB, well past safe URL length.

---

## 7. Widget behavior (`app/app.js`)

1. SDK-readiness poll (mirrors NOKIntake), then `captureParams()` via
   `ZOHO.CREATOR.UTIL.getQueryParams()` for `deal_id`/`owner`.
2. `getDeal(deal_id)` — shows the Deal name in the header, prefills planner name/address as a
   fallback if there's no existing questionnaire yet.
3. `getQuestionnaireForDeal(deal_id)` — COQL-finds an existing CRM module record for this Deal; if
   found, prefills every field from it (including redrawing the signature, §8) and remembers its
   id (`SYS.crmQid`) for the eventual upsert.
4. On submit: `submitFinalWishes` (creates/updates both stores) -> `completePreNeedQuestionnaire`
   (Deal write-back + signature upload to both targets) -> thank-you modal. Modal's Close button
   does `window.location.reload()`, not just hiding itself.
5. Persons Responsible subform uses NOKIntake's full phone country-code picker component, copied
   in per that widget's own "applies to every phone field" rule.

---

## 8. Confirmed gotchas (the expensive lessons — read before touching signature/CRM-module code)

**Creator composite fields reject plain Maps in `insert into`.** `Pre_Planner_Name=dataMap.get(...)`
threw *"An invalid expression has been assigned to the Pre_Planner_Name field."* Composite fields
(Name, Address) need per-subfield dot notation instead: `Pre_Planner_Name.first_name=...`.

**Creator subform rows need a row-constructor + `collection()`.** Not a plain List of Maps:
`row = Final_Wishes_Form.Persons_Responsible(); row.Name.first_name = ...; rows.insert(row);` then
`Persons_Responsible=rows` in the insert block.

**Creator's native Signature field type rejects programmatic writes outright** — *"Signature field
'Signature' cannot be updated"*, confirmed live. `submitFinalWishes` never even tries; the
signature is captured as a canvas PNG and handled entirely through the CRM side instead.

**Deluge's `null` locks a variable's type.** `x = null;` then later `x = List(); x.add(...)`
throws *"'add' function is applicable for LIST expression, but 'x' is of type NULLTYPE"* even
though `x` was reassigned. Initialize collection variables as `List()`/`Map()` from the start, not
`null`, and check `.size() > 0` rather than `!= null`.

**COQL lookup-field comparisons.** The user's own tested fix: `where Deal_Name = '<id>'` (quoted
string, no `.id` dot-notation) against the `zoho_oauth_connection` connection — not
`zohocrm_connection`, and not the `Deal_Name.id = <id>` (unquoted) form some Zoho docs suggest.
Whichever form is wrong for a given connection/org fails *silently* if the invokeurl error is
swallowed into "not found" — surface `queryError`/raw response rather than assuming empty means
empty.

**Image/File Upload custom fields are a two-step process**, confirmed against Zoho's official v8
docs (two earlier single-step guesses were both wrong):
1. `POST https://www.zohoapis.com/crm/v8/files` (multipart, the file needs
   `.setParamName("file")` first) -> `response.data[0].details.id` is the ZFS file id.
2. Set the field's value to `[{"File_Id__s": "<that id>"}]` via a normal record update.

Base64-to-file conversion is `zoho.encryption.base64DecodeToFile(text, fileName)` (not
`base64Decode(...,true)`, which doesn't exist for this). The reverse, for redrawing a saved
signature on resume, is `zoho.encryption.base64Encode(file)`, fed from the documented
`GET .../{module}/{id}/actions/download_fields_attachment?fields_attachment_id={id}` endpoint.

**ZFS file ids are single-attachment tokens.** Reusing one upload's file id to attach the same
image to two different fields/records silently succeeds on the first attach and does nothing on
the second (no error, field just stays empty) — confirmed live. Upload separately, once per
target.

**Image Upload fields configured for one image still hold a list**, and adding a new
`File_Id__s` entry only *appends* — it doesn't replace the old one. Since this org's fields are
configured for exactly one image, replacing means an explicit delete-then-reupload as two
*separate* update calls per the user's own research: first `{"id":"<existing entry
id>","_delete":null}` alone, then (separately) the new `File_Id__s` entry.

**File processing uses `zoho_oauth_connection`, not `zohocrm_connection`** — the latter's scope
wasn't sufficient for ZFS upload/download specifically (per the user's explicit instruction),
even though it's fine for regular record CRUD.

**A transparent canvas exports as solid black in Zoho's preview.** `toDataURL('image/png')` keeps
the canvas's default transparency; Zoho's own image preview renders that as black rather than
white. Fill the canvas white before drawing (and again on Clear).

**Zoho CRM Client Scripts have no DOM access.** `document`/`window` DOM APIs (and therefore
`document.execCommand` and, in practice, `navigator.clipboard`) are not usable there — confirmed
live, see §5. If a future task wants a CRM button to touch the clipboard, do the local file
system, or do anything else DOM-dependent, it needs a Widget-type button, not a Client Script.

**`setAddr()`'s composite-address read side expects lowercase `postal_code`, not `postal_Code`.**
Two different address-prefill paths exist in this widget: reading a genuinely-saved Creator/CRM
composite Address object (which Zoho itself returns with a lowercase `postal_code` key -- same
convention NOKIntake's own `setAddr()` comment already flagged), and `getDeal.dg`'s own
hand-built `plannerAddress` Map (the Contact-based fallback prefill for a fresh Deal with no
questionnaire yet). The second one was built with capital-C `postal_Code`, silently mismatching
what `setAddr()` reads for that field and leaving Postal Code blank on every fresh-Deal prefill,
confirmed live -- fixed by matching the lowercase key. `address_line_2` was simply never set at
all in that same Map (Contacts does have a `Mailing_Street_2` field to source it from, confirmed
via getFields -- it just wasn't wired up originally).

---

## 9. Confirmed test results (2026-09-18, full pass)

- Fresh submission: creates linked `Final_Wishes_Form` + `Pre_Need_Questionnaire` records, no
  login required, works on an actual phone.
- Editing/resubmitting the same Deal: updates the existing `Pre_Need_Questionnaire` record (no
  duplicate), prefills every field including the previously-drawn signature, and replacing the
  signature actually replaces it (old one gone, not appended).
- Fresh-Deal prefill (no questionnaire yet): Pre-Planner name/address, including Address Line 2
  and Postal Code, all prefill correctly from the linked Contact.
- CRM launcher widget: fresh send, resend-for-edit, and one-click Copy all confirmed working.
- All 11 long-text fields are capped at 2000 characters (`maxlength`) with a live "N / 2000"
  counter underneath, correct immediately whether the field starts blank or prefilled.
- Full 27-case test pass (`DFH_PreNeed_Questionnaire_Test_Cases.xlsx` in
  `D:\Office\Andrea_Projects\DFH\widgets\testCases\`) confirmed by the user.
