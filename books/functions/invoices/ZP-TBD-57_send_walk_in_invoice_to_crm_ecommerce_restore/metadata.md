# ZP-TBD-57 — `send_walk_in_invoice_to_crm` overwrite recovery + Funeral GCT Report fix

**Source:** Andrea's handoff, 2026-09-07 (`AndreaTask1.txt`). The function had
been accidentally overwritten by a prior Claude Code session; the restored
version in place was an old Aug 6 base, missing ~145 lines of Flower
Order/eCommerce work Dev #2 built between Aug 10–26.

## What was found (confirmed live, not assumed)

- **Live function before this fix** (257 lines): an old pre-eCommerce base
  plus one real fix — the `crmContactId != ""` contact guard, protecting the
  `Contact_Name`/`Deal_Name__s` block when a Books customer has no CRM
  contact. No Flower Order/eCommerce logic at all.
- **Developer-supplied Aug 25 version** (400 lines,
  `sendWalkInInvoiceToCRM25August.txt`): had the full Flower Order/eCommerce
  logic (flower-keyword matching against `{"Wreath","Floral","Spray",
  "Basket","Heart","Circle","Cross"}`, CRM Product create/link with
  `Parent_Product` set to a cached "Flowers" product ID, Books item import
  via `/crm/item/{id}/import`, `"Flower Order" - <date> - <funeral date> -
  <deal name>"` subject line, `Is_Ecommerce` field) — but did **not** have
  the contact guard. Its `Contact_Name`/`Deal_Name__s`/
  `getRecordById("Contacts",...)` block ran unconditionally.
- Books' own function execution history (`list_custom_function_histories`)
  confirmed executions through the whole Aug 17–31 window but, as expected,
  doesn't retain code snapshots — only the developer's locally-saved Aug 25
  file made the real recovery possible.

## Funeral GCT Report bug — confirmed by direct code inspection

Both the live (Aug 6) and developer (Aug 25) versions shared the same root
cause. The original opening block:

```deluge
try
{
    dealId = invoiceInfo.get("custom_field_hash").get("cf_select_the_deceased_unformatted");
    isThisTiedToADeceased = invoiceInfo.get("custom_field_hash").get("cf_is_this_tied_to_a_deceased");
    crmDealInfo = zoho.crm.getRecordById("Deals",dealId);
}
catch (e)
{
    dealId = null;
    isThisTiedToADeceased = false;
}
```

reads `dealId` from Books' own invoice data and calls the CRM Deal lookup
**in the same try**. If `zoho.crm.getRecordById("Deals",dealId)` throws for
any reason, the catch wipes `dealId` back to `null` — even though that value
came straight from Books and had nothing to do with the CRM call failing.
`cf_related_crm_deal_id` (which the Funeral GCT Report depends on, not
`cf_select_the_deceased`) is written far later, gated entirely behind that
same `dealId` — so a single flaky CRM lookup silently drops the invoice from
the report, with no visible error to the cashier.

## Fix applied

1. **Merged the contact guard into the Aug 25 base** — wrapped the
   `Contact_Name`/`Deal_Name__s`/`getRecordById("Contacts",...)` block in
   `if(crmContactId != "")`/`else`, exactly matching the Aug 6 version's
   protection. Everything else in the Aug 25 version (Flower Order,
   eCommerce logic, funeral date parsing, Subject/Status branching) kept
   unchanged.
2. **Split the dealId read from the CRM lookup**, and write
   `cf_related_crm_deal_id` immediately:

```deluge
dealId = null;
isThisTiedToADeceased = false;
try
{
    dealId = invoiceInfo.get("custom_field_hash").get("cf_select_the_deceased_unformatted");
    isThisTiedToADeceased = invoiceInfo.get("custom_field_hash").get("cf_is_this_tied_to_a_deceased");
}
catch (e)
{
    dealId = null;
    isThisTiedToADeceased = false;
}
// Populate cf_related_crm_deal_id immediately from Books' own data, before
// attempting the CRM Deal lookup below -- so the Funeral GCT Report can
// still identify this invoice even if the CRM call fails.
if(!isNull(dealId) && dealId != "")
{
    earlyDealIdMap = Map();
    earlyCustomFieldsList = list();
    earlyFieldMap = Map();
    earlyFieldMap.put("api_name","cf_related_crm_deal_id");
    earlyFieldMap.put("value",dealId);
    earlyCustomFieldsList.add(earlyFieldMap);
    earlyDealIdMap.put("custom_fields",earlyCustomFieldsList);
    earlyDealIdMap.put("reason","Populate related deal id early (before CRM lookup)");
    try
    {
        zoho.books.updateRecord("Invoices",organizationID,invoiceID,earlyDealIdMap,"zohobooksconnection");
    }
    catch (e)
    {
        info e;
    }
}
try
{
    crmDealInfo = zoho.crm.getRecordById("Deals",dealId);
}
catch (e)
{
    crmDealInfo = null;
}
```

3. Added `&& !isNull(crmDealInfo)` to the main sync guard
   (`if(!isNull(dealId) && isThisTiedToADeceased == true && !isNull(crmDealInfo))`)
   so every downstream behavior is unchanged from today when the CRM call
   fails — the CRM-sync block still just gets skipped, no new crash risk —
   while `cf_related_crm_deal_id` is now guaranteed to be set beforehand
   regardless of that outcome.

Full final script is committed alongside this file
(`send_walk_in_invoice_to_crm.deluge`).

## The 2 remaining affected invoices — fixed and verified

Of the 5 invoices identified in the handoff, 3 were already fixed before
this session. The remaining 2 were corrected directly by the developer and
verified live against Books:

| Invoice | Customer | Amount | `cf_select_the_deceased_unformatted` | `cf_related_crm_deal_id` (after fix) |
|---|---|---|---|---|
| INV-MB-2026-000135 (`5830143000029814663`) | Rosetta Whyte | $27,300 | `6503357000063581032` | `6503357000063581032` ✓ |
| INV-K-2026-002570 (`5830143000030566453`) | Barbara Chin | $26,000 | `6503357000066611020` | `6503357000066611020` ✓ |

Both confirmed via live `get_invoice` — `cf_related_crm_deal_id` matches
`cf_select_the_deceased_unformatted` exactly on both, `last_modified_time`
shows today's date (2026-09-07) confirming the edits took.

## Not yet actioned — separate report-side issues from the same handoff

Two further items from Andrea's handoff are report/data issues, not
function bugs, and are tracked separately (not part of this ticket's scope):

- **Funeral vs Walk-In indistinguishable in the report** — it currently
  groups by deceased name only, so a $500 walk-in and a $20,000 funeral
  invoice for the same deceased show as one combined total with no
  indication 49 of 52 reachable walk-ins are walk-ins at all. Proposed fix:
  sync `cf_is_this_tied_to_a_deceased` and `cf_select_the_deceased` into
  Analytics so the report can split Funeral vs Walk-In and show invoice
  number under the deceased.
- **4 walk-in invoices ($295,950 total) tied to Deals with no funeral
  date** — the report filters on funeral date, so these never appear
  regardless of the fix above. Needs the funeral date added to those 4
  Deals directly.

## Status

Restore, contact guard merge, report-bug fix, and both invoice corrections
confirmed live and verified 2026-09-07. The two report-side data/Analytics
issues above are open, pending developer/Andrea prioritization.
