# Zoho Connections — DFH (org 871210233)

Connection names seen in use across today's work. Scopes are best-known, not verified against
the Connections admin screen — confirm and correct when next touching each one.

| Connection Name | Used For | Notes |
|---|---|---|
| `zohooauth` | CRM-to-CRM REST calls from CRM Automation functions (`invokeurl` to `zohoapis.com/crm/...`) | Used in `onDeceasedPickupCreate`, `createSalesOrderForPoliceCase`, `createSalesOrderForHospitalCase`, `createJobInAmber`, `sendCompleteStatusToAmber` |
| `zohocrm_connection` | CRM REST calls made *from Creator* (Driver App, NOK Intake Deluge functions) | Used throughout `Driver_App.ds` and `NOK_Information_Form.ds` |
| (Amber Connect API) | Outbound calls to `api-gateway.amberconnect.com` for job create/complete | Passed as `?APIKey=<redacted>` directly in the URL query string in the live function (3 occurrences). This is the correct/intended pattern for this integration — not a Connection. |
| (Google Maps Geocoding API) | Address → lat/long lookup inside `createJobInAmber` | Assigned directly to a local variable in the live function body. Also the intended pattern here, not a Connection. |

## Repo policy for these keys
Both API keys above are masked in `crm/functions/trips/ZP-TBD-1_amber_integration_fix/function.deluge`
as `<AMBER_API_KEY>` / `<GOOGLE_MAPS_API_KEY>` — this repo (and GitHub) never holds the real
values, only the live Deluge functions do. That's just standard practice for what goes in
Git, not a comment on whether the live approach is right — it is. Pull the real values from
the live function when reconstructing it for deployment; don't paste them back into this repo.

## CRM Functions REST-execute key (`<CRM_FUNCTIONS_ZAPIKEY>`)

A single shared zapikey is used org-wide for calling CRM Functions' REST API (API-key auth,
`.../crm/v7/functions/<lowercase_api_name>/actions/execute?auth_type=apikey&zapikey=...`). This
is the pattern used whenever a Creator widget (portal context) needs to reach a CRM
Standalone/Automation function that must run in CRM admin/system context — most commonly for
`zoho.writer` merges and CRM Attachments access, which don't work reliably from portal context.
Seen in: Driver App's `generateHangTag`/`getHangTagFile` bridges, and NOK Intake's
`createPoliceDropoff`/`getDropoffHangTagFile` widgetLookup actions (ZP-TBD-8). Masked as
`<CRM_FUNCTIONS_ZAPIKEY>` everywhere in this repo — pull the real value from the live function's
own REST API tab when reconstructing for deployment.
