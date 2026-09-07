# ZP-TBD-56-4 — Shared cached Xero Accounts/TaxRates/TrackingCategories lookup

**Source:** the root-cause fix from the [[ZP-TBD-56 Xero API call-volume
audit]], items #2 and #9 in its prioritized list.

## Problem

`createinvoiceonxero`, `syncretainerinvoicetoxero`, and `createbillinxero`
each independently fetched Xero's full Accounts, TaxRates, and
TrackingCategories on every single invocation — 3 real, metered
`api.xero.com` calls repeated in up to 3 places per invoice/bill cascade,
for data (bank accounts, tax rates, revenue-center/motor-vehicle tracking
options) that changes essentially never day-to-day.

## Storage design — two false starts before landing on WorkDrive

The combined trimmed dataset (Name→ID maps for ~280 accounts, ~14 taxes, and
~114 tracking options across 2 categories) is ~30-40KB:

1. **CRM Org Variable** (`xeroRefreshToken`'s storage mechanism) — rejected.
   Even a single ~20-25KB chunk (just the accounts map alone) hit
   `{"code":"BODY_SIZE_REACHED",...}` on `PUT
   /crm/v7/settings/variables`, confirmed even with a Multi Line field type.
   CRM Org Variables are sized for small config values (tokens), not bulk
   reference data.
2. **Filtering to only Revenue/Expense-class, active accounts** — considered
   but not needed once WorkDrive removed the size constraint; would have
   added risk (depends on unconfirmed Xero `Class`/`Status` field behavior)
   for a problem that no longer existed.
3. **Zoho WorkDrive file** — the answer. One JSON file
   (`xeroMasterDataCache.json`) in a dedicated WorkDrive folder, holding the
   full trimmed dataset with no practical size concern.

## WorkDrive mechanics (confirmed live, not assumed)

- Connection: `wdconnection` (Books → Settings → Automation → Connections →
  WorkDrive scope).
- Folder ID: `a9gtj00b68dcb37df4a52998f4656e8753c52`.
- **Write/overwrite**: `POST
  https://www.zohoapis.com/workdrive/api/v1/upload?filename=xeroMasterDataCache.json&parent_id=<folder_id>&override-name-exist=true`,
  body `files:{"content":<jsonString>}`. Response:
  `data[0].attributes.resource_id`. Confirmed live: re-uploading with the
  same filename+parent_id creates a new **version** of the same file
  (`versionInfo.updateType: "UPDATE_TYPE_REV_UPLOAD_FOR_SAMENAME"`) —
  **the resource_id never changes**, so it's safe to hardcode once
  (`a9gtj01ac7583e12d436e944ded302bb75c1e`), same convention as every other
  hardcoded ID in this codebase.
- **Read**: `GET https://workdrive.zoho.com/api/v1/download/<resource_id>`
  (note: `workdrive.zoho.com`, NOT `www.zohoapis.com`), header
  `Accept: application/vnd.api+json`. This returns a Deluge **file object**,
  not JSON/text — confirmed the hard way:
  - `info downloadResult;` → only prints the filename, not content.
  - `downloadResult.toString()` → returns `null`.
  - `invokeurl ... detailed:true` → `.responseText` is still just the
    filename string, even though the response headers (`content-length`,
    `content-type: application/download`) confirm the real bytes are there.
    Deluge treats a file/attachment-stream response as an opaque file
    reference for re-attaching elsewhere, not as inspectable text.
  - **The actual fix**: `fileObject.getFileContent()` — returns the real
    text content, which can then be parsed with `.toMap()`.

## Final `getxeromasterdata` incoming webhook

```deluge
resultMap = Map();
fileId = "a9gtj01ac7583e12d436e944ded302bb75c1e";
headersMap = Map();
headersMap.put("Accept","application/vnd.api+json");
useCache = false;
cacheMap = Map();
try
{
	fileObject = invokeurl
	[
		url :"https://workdrive.zoho.com/api/v1/download/" + fileId
		type :GET
		headers:headersMap
		connection:"wdconnection"
	];
	fileContent = fileObject.getFileContent();
	cacheMap = fileContent.toMap();
	cachedUntil = cacheMap.get("cachedUntil").toTime("yyyy-MM-dd'T'HH:mm:ss");
	if(zoho.currenttime < cachedUntil)
	{
		useCache = true;
	}
}
catch (e)
{
	useCache = false;
}
if(useCache == true)
{
	resultMap.put("accounts",cacheMap.get("accounts"));
	resultMap.put("taxes",cacheMap.get("taxes"));
	resultMap.put("trackingCategories",cacheMap.get("trackingCategories"));
	resultMap.put("fromCache",true);
	resultMap.put("message","Success");
	resultMap.put("code",0);
	return resultMap;
}
xeroRefreshToken = zoho.crm.getOrgVariable("xeroRefreshToken");
tokenResponse = invokeurl
[
	url :"https://identity.xero.com/connect/token"
	type :POST
	parameters:{"grant_type":"refresh_token","refresh_token":xeroRefreshToken,"client_id":"6793DCCECBC842A78F4823D608636FFD","client_secret":"v8ATq7H7hiOn63lryHETiXz6UtkCQZookKUD3tjAMcf4uoQE"}
	headers:{"Content-Type":"application/x-www-form-urlencoded"}
];
xeroRefreshTokenVariable = Map();
xeroRefreshTokenVariable.put("id","6503357000009423001");
xeroRefreshTokenVariable.put("value",tokenResponse.get("refresh_token"));
variables_list = List();
variables_list.add(xeroRefreshTokenVariable);
param = Map();
param.put("variables",variables_list);
invokeurl
[
	url :"https://www.zohoapis.com/crm/v7/settings/variables"
	type :PUT
	parameters:param.toString()
	connection:"zohocrmconnection"
];
xeroHeaders = Map();
xeroHeaders.put("xero-tenant-id","879c4d25-cee8-46c1-89f9-80dcfe572eb2");
xeroHeaders.put("Authorization","Bearer " + tokenResponse.get("access_token"));
xeroHeaders.put("Accept","application/json");
xeroHeaders.put("Content-Type","application/json");
xeroAccountsRaw = getUrl("https://api.xero.com/api.xro/2.0/Accounts",xeroHeaders);
xeroTaxesRaw = getUrl("https://api.xero.com/api.xro/2.0/TaxRates",xeroHeaders);
xeroTrackingRaw = getUrl("https://api.xero.com/api.xro/2.0/TrackingCategories",xeroHeaders);
accountsMap = Map();
for each  acct in xeroAccountsRaw.get("Accounts")
{
	accountsMap.put(acct.get("Name").toLowerCase(),acct.get("AccountID"));
}
taxesMap = Map();
for each  tax in xeroTaxesRaw.get("TaxRates")
{
	taxesMap.put(tax.get("Name").toLowerCase(),tax.get("TaxType"));
}
trackingMap = Map();
for each  category in xeroTrackingRaw.get("TrackingCategories")
{
	optionsMap = Map();
	for each  option in category.get("Options")
	{
		optionsMap.put(option.get("Name").toLowerCase(),option.get("TrackingOptionID"));
	}
	categoryEntry = Map();
	categoryEntry.put("categoryId",category.get("TrackingCategoryID"));
	categoryEntry.put("options",optionsMap);
	trackingMap.put(category.get("Name").toLowerCase(),categoryEntry);
}
newCacheMap = Map();
newCacheMap.put("cachedUntil",zoho.currenttime.addMinutes(60).toString("yyyy-MM-dd'T'HH:mm:ss"));
newCacheMap.put("accounts",accountsMap);
newCacheMap.put("taxes",taxesMap);
newCacheMap.put("trackingCategories",trackingMap);
uploadResult = invokeurl
[
	url :"https://www.zohoapis.com/workdrive/api/v1/upload?filename=xeroMasterDataCache.json&parent_id=a9gtj00b68dcb37df4a52998f4656e8753c52&override-name-exist=true"
	type :POST
	files :{"content":newCacheMap.toString()}
	connection:"wdconnection"
];
resultMap.put("accounts",accountsMap);
resultMap.put("taxes",taxesMap);
resultMap.put("trackingCategories",trackingMap);
resultMap.put("fromCache",false);
resultMap.put("message","Success");
resultMap.put("code",0);
return resultMap;
```

TTL: 60 minutes (`cachedUntil`, compared directly against `zoho.currenttime`
— a plain datetime comparison, no duration/minutes math needed).

## Callers updated

Each caller replaces its own 3-call Accounts/TaxRates/TrackingCategories
fetch with one `invokeurl` to this webhook's execute URL, then reads
`.get("response").get("accounts"|"taxes"|"trackingCategories")` — already
lowercased-name-keyed maps, so every consuming lookup collapses from a
`for each ... if(...toLowerCase()==...toLowerCase())` loop into a direct
`.containKey()`/`.get()`.

- **`createinvoiceonxero`** — DONE 2026-09-04, confirmed working live. Diff:
  replaced the 3-call fetch block; the line-item account lookup; the tax
  lookup; the whole `cf_revenue_centers`/`cf_motor_vehicle` tracking loop;
  and both write-off/rounding account lookups (identical block, appeared
  twice).
- **`syncretainerinvoicetoxero`** — pending.
- **`createbillinxero`** — pending.

## Status

Webhook live and confirmed (`fromCache:true` observed on a real second
call). `createinvoiceonxero` integrated and confirmed working. Two callers
remaining.
