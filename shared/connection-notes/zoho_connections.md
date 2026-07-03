# Zoho Connections — DFH (org 871210233)

Connection names seen in use across today's work. Scopes are best-known, not verified against
the Connections admin screen — confirm and correct when next touching each one.

| Connection Name | Used For | Notes |
|---|---|---|
| `zohooauth` | CRM-to-CRM REST calls from CRM Automation functions (`invokeurl` to `zohoapis.com/crm/...`) | Used in `onDeceasedPickupCreate`, `createSalesOrderForPoliceCase`, `createSalesOrderForHospitalCase`, `createJobInAmber`, `sendCompleteStatusToAmber` |
| `zohocrm_connection` | CRM REST calls made *from Creator* (Driver App, NOK Intake Deluge functions) | Used throughout `Driver_App.ds` and `NOK_Information_Form.ds` |
| (Amber Connect API) | Outbound calls to `api-gateway.amberconnect.com` for job create/complete | **CONFIRMED hardcoded, not a Zoho Connection.** The live `createJobInAmber` and `sendCompleteStatusToAmber` functions pass `?APIKey=<redacted>` directly in the URL query string, 3 occurrences total. |
| (Google Maps Geocoding API) | Address → lat/long lookup inside `createJobInAmber` | **CONFIRMED hardcoded.** A Google API key is assigned directly to a local variable in the function body, not stored in a Connection. |

## Real finding — not just repo housekeeping
Both API keys above are live production credentials sitting in plain text inside Deluge
function source that anyone with function-edit access to this CRM org can read. This predates
this repo and isn't something we're introducing, but it directly violates the guide's rule
against storing credentials outside of Zoho Connections, and it's now visible because we
pulled the live source to backfill history. Two independent problems:

1. **In the live Zoho org right now** — both keys are exposed to anyone with function-editor
   access. Recommend migrating both to real Zoho Connections and rotating the keys once moved,
   since the current values must be treated as already-exposed.
2. **In this repo** — the `function.deluge` files under `crm/functions/trips/ZP-TBD-1_amber_integration_fix/`
   have both keys masked as `<AMBER_API_KEY>` / `<GOOGLE_MAPS_API_KEY>`. The real values are
   **not** written anywhere in this repo. Do not paste them back in when reconstructing the
   function for deployment — pull them from the live function or wherever they end up being
   stored if migrated to Connections.

This is worth raising with Andrea/the client directly, not just fixing quietly — it's a
pre-existing exposure, not something introduced today.
