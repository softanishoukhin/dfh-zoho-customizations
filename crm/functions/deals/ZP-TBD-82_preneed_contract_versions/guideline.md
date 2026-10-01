# ZP-TBD-82 -- Pre-Need contract: Full vs 1-Page, sent by payment status

**Status: built 2026-09-29, NOT applied, NOT tested.** Built on live source pulled 2026-09-29
(`sendPreNeedFuneralContract`, `sendPreNeedFuneralContractEmbedded`, Books `allprocessonpaymentcreateandupdate`).

**Depends on ZP-TBD-81** (Payment Type `Lump Sum` / `Installments`, 50% Deposit invoice + Installment invoices).
Apply ZP-TBD-81 first.

## What changes for staff

- **Lump Sum** -> when the Lump Sum invoice is paid, the **Full contract** is emailed to the buyer automatically.
- **Installments** -> nothing is sent at first. When the **50% deposit invoice is paid**, the **1-page contract** is
  emailed automatically. When **every installment is paid** (balance 0), the **Full contract** is emailed automatically.
- Payment route doesn't matter: Fygaro, cash/check entered on the CRM invoice, or a payment entered in Books.
- The **Send Pre Need Funeral Contract** button and the **Send Links via WhatsApp** widget ("Add contract link")
  now send the right version too. Before anything is paid they don't send; they show why
  (e.g. "The 50% deposit invoice is not paid yet...").
- Each version goes out automatically **once**. The buttons can still resend it at any time.

## Pieces

| # | Item | Change | File |
|---|---|---|---|
| 1 | Zoho Sign | 2 templates: Full, 1-Page (your part) | -- |
| 2 | Deals fields | +2: `One_Page_Contract_Sent_At`, `Full_Contract_Sent_At` (DateTime) | -- |
| 3 | `standalone.getPreNeedContractType` | **new** -- decides Full / One Page / nothing | `getPreNeedContractType_NEW.deluge` |
| 4 | `standalone.sendPreNeedFuneralContractEmail` | **new** -- the button's body, template-aware | `sendPreNeedFuneralContractEmail_NEW.deluge` |
| 5 | `button.sendPreNeedFuneralContract` | body replaced by a call to #4 | `sendPreNeedFuneralContract_UPDATED.deluge` |
| 6 | `standalone.sendPreNeedFuneralContractEmbedded` | 3 small patches (WhatsApp widget link) | patch below |
| 7 | `standalone.autoSendPreNeedContract` | **new** -- automatic send, REST API key on | `autoSendPreNeedContract_NEW.deluge` |
| 8 | Books `allprocessonpaymentcreateandupdate` | +1 block at the end | `books/functions/preneed/ZP-TBD-82_preneed_contract_on_payment/allprocessonpaymentcreateandupdate_PATCH.deluge` |

Apply in this order. #8 goes **last** -- it's the only thing that makes anything happen automatically.

## Step 1 -- Zoho Sign templates

Build the two templates (Full = new first page + existing legal pages; 1-Page = new first page only) and note both
template IDs. The functions pre-fill fields by **label** (`Text - 1`, `Text - 5`, ... -- same keys as today). A
label that isn't on a template is simply not filled. If you rename labels in the new templates, rename the
`field_text_data.put("...")` keys in #4 and #6 to match.

## Step 2 -- Deals fields

| Label | API name | Type | Layout |
|---|---|---|---|
| 1-Page Contract Sent At | `One_Page_Contract_Sent_At` | Date/Time | Pre-Need section, read-only |
| Full Contract Sent At | `Full_Contract_Sent_At` | Date/Time | Pre-Need section, read-only |

The API names must match exactly; if CRM generates different ones, tell us and we'll adjust the functions.
To make the automatic send go out again for a Deal, clear the field.

## Step 3 -- `getPreNeedContractType` (new)

Setup > Functions > New Function > Category **Standalone**, name `getPreNeedContractType`, argument `crmid`
(**String**), return type string. Paste `getPreNeedContractType_NEW.deluge`. At the top, replace:

```
FULL_TEMPLATE_ID = "<FULL_TEMPLATE_ID>";
ONE_PAGE_TEMPLATE_ID = "<ONE_PAGE_TEMPLATE_ID>";
```

with the two template IDs from Step 1. Save.

## Step 4 -- `sendPreNeedFuneralContractEmail` (new)

New Function > **Standalone**, name `sendPreNeedFuneralContractEmail`, argument `crmid` (**String**), return type
string. Paste `sendPreNeedFuneralContractEmail_NEW.deluge`. Save.

This is the live button's body with 4 changes: template from #3, Sign Documents record named
"Pre-Need Funeral Contract - Full" / "- One Page", the matching Sent At field stamped on success, and it returns
JSON (`status`, `message`, `contract_type`, `request_id`). The commented-out embed-token block was dropped (the
embedded function covers that).

## Step 5 -- button body

Open `Send Pre Need Funeral Contract` (`button.sendPreNeedFuneralContract`), paste
`sendPreNeedFuneralContract_UPDATED.deluge` over the whole body. The live body is in
`rollback/sendPreNeedFuneralContract_CURRENT.deluge`.

## Step 6 -- `sendPreNeedFuneralContractEmbedded` (WhatsApp widget link)

**6a.** Find:

```
accountInfo = zoho.crm.getRecordById("Accounts",accountId.toLong());
templateId = "441773000001137101";
```

Replace the `templateId = ...` line with:

```
// ZP-TBD-82: Full or One Page, depending on what has been paid
contractTypeInfo = standalone.getPreNeedContractType(crmid).toMap();
templateId = ifnull(contractTypeInfo.get("template_id"),"");
contractType = ifnull(contractTypeInfo.get("contract_type"),"");
if(templateId == "")
{
	result.put("message",contractTypeInfo.get("message"));
	return result.toString();
}
```

**6b.** Find:

```
	recordmap.put("Name","Pre-Need Funeral Contract");
```

Replace with:

```
	recordmap.put("Name","Pre-Need Funeral Contract - " + contractType);
```

**6c.** Find (near the end):

```
result.put("status","success");
result.put("sign_url",sign_url);
```

Directly **above** those two lines, add:

```
// ZP-TBD-82: remember that this version went out, so the automatic send doesn't send it again
stampMap = Map();
if(contractType == "Full")
{
	stampMap.put("Full_Contract_Sent_At",zoho.currenttime.toString("yyyy-MM-dd'T'HH:mm:ss","America/Jamaica"));
}
else
{
	stampMap.put("One_Page_Contract_Sent_At",zoho.currenttime.toString("yyyy-MM-dd'T'HH:mm:ss","America/Jamaica"));
}
zoho.crm.updateRecord("Deals",crmid.toLong(),stampMap);
result.put("contract_type",contractType);
```

No widget change is needed: the widget already shows the function's `message` when no `sign_url` comes back
("Contract link not added: The 50% deposit invoice is not paid yet...").

## Step 7 -- `autoSendPreNeedContract` (new)

New Function > **Standalone**, name `autoSendPreNeedContract`, argument `crmid` (**String**), return type string.
Paste `autoSendPreNeedContract_NEW.deluge`. Save.

Then on the function: **REST API > API Key > enable**. Copy the API key URL. Check that the function's API name is
`autosendpreneedcontract`; if it isn't, use the one CRM shows in Step 8.

## Step 8 -- Books payment function (last)

Books > Settings > Automation > Custom Functions > `allprocessonpaymentcreateandupdate` (Customer Payment).
At the **very end** of the script, after:

```
info "refundOverpaymentProcessToXero";
info refundOverpaymentProcessToXero;
```

paste the whole `allprocessonpaymentcreateandupdate_PATCH.deluge` block. Replace `<CRM_ZAPIKEY>` with the `zapikey`
value from the Step 7 URL. Save.

## How it works (technical)

- **Trigger:** every Books customer payment (create/edit) runs `allprocessonpaymentcreateandupdate`. All three
  payment routes end up there: Fygaro (`cf_payment_created_from = Fygaro`), CRM `Invoice_Payers` ->
  `createPaymentsOnBooksForRetainerInvoice` / `createPaymentsOnBooks` (`CRM`), and payments entered in Books (`Books`).
- **Deal lookup (Books):** the new block collects the payment's retainer(s) (`retainerinvoice_id` + `retainerinvoices`)
  and invoice(s) (`invoices`), reads `cf_related_crm_deal_id` from each (checked live 2026-09-29: present on both
  the Deposit retainer and the regular invoice), and calls `autosendpreneedcontract` once per distinct Deal through
  its API key URL. It's wrapped in try/catch, so a failure never breaks payment processing. It sits at the end, after
  the existing 30s/10s `Sleep_API` waits.
- **Decision (`getPreNeedContractType`):** reads the Deal via REST v8 GET (Pipeline must be `Pre Need`, Payment Type
  `Lump Sum` / `Installments`), then every related CRM Invoice except Void/Cancelled. Invoice roles by `Invoice_For`
  (same as ZP-TBD-81): `Deposit`, `Installment N`, `Other`/blank = Lump Sum.
  - Lump Sum: the Lump Sum invoice's Books document is paid (status `paid`, or balance <= 0 with total > 0 and not
    draft/void) -> Full.
  - Installments: **the Deposit and Installment invoices all share ONE master Books retainer** for the whole contract
    (ZP-TBD-74; found live 2026-09-30 on Deal 6503357000084470306 -> RET-K-2026-000142), which only turns `paid` at the
    very end. So the function adds up `payment_made` over the distinct plan retainers (void ones skipped):
    `>= Contract_Value` (or every retainer `paid`) -> Full; `>= Pre_Need_Deposit_Amount` (blank -> 50% of Contract_Value)
    -> One Page. 1.00 tolerance for Books' 0.125 rounding. Also works if a Deal still has one retainer per invoice.
  - Otherwise returns an empty type and a message saying why (incl. "paid X of Y").
- **Send once (`autoSendPreNeedContract`):** skips if that version's Sent At field is already set (One Page is also
  skipped once Full was sent). It stamps the field **before** sending, because Books can run the payment function
  twice for one payment (create + the function's own edits to the payment), and clears it again if the send fails.
  It then calls `sendPreNeedFuneralContractEmail` (Zoho Sign emails the request, `is_quicksend`).
- **Buttons:** both send points go through `getPreNeedContractType`, so they always pick the matching template and
  refuse before anything is paid. Both stamp the Sent At field on success, so a manual send also counts as "sent"
  for the automatic step.
- **If the deposit and all installments are paid at once**, the 1-page is skipped and the Full contract goes out.

## Known limits

- Deals whose deposit was already paid before go-live get nothing automatically until their next payment. Use the
  button for those.
- Every Books payment now makes 1 extra CRM call (plus 1 Books GET per applied invoice). For non-Pre-Need Deals the
  CRM function stops after the Deal GET.
- A partially paid deposit doesn't count as paid.

## Rollback

| # | Rollback |
|---|---|
| 8 | Delete the `//ZP-TBD-82 start` ... `//ZP-TBD-82 end` block from the Books function. Do this first -- it stops all automatic sends. |
| 7 | Delete `autoSendPreNeedContract`. |
| 6 | 6c: delete the stamp block + `result.put("contract_type",contractType);`. 6b: put back `recordmap.put("Name","Pre-Need Funeral Contract");`. 6a: put back `templateId = "441773000001137101";` in place of the ZP-TBD-82 block. |
| 5 | Paste `rollback/sendPreNeedFuneralContract_CURRENT.deluge` back over the button. |
| 4 | Delete `sendPreNeedFuneralContractEmail`. |
| 3 | Delete `getPreNeedContractType`. |
| 2 | Hide the 2 fields (deleting them loses the send history). |
