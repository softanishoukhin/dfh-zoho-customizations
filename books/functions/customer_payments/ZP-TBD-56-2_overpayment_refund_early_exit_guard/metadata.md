# ZP-TBD-56-2 — Early-exit guard on `createoverpaymentinxerofromrefund`

**Source:** second fix from the [[ZP-TBD-56 Xero API call-volume audit]],
item #4 in its prioritized list.

## Problem

`createoverpaymentinxerofromrefund` (incoming webhook, entity
`customer_payment`, built in [[ZP-TBD-55]]) fires on every Customer Payment
save. Before this fix, it unconditionally paid the full Xero setup cost —
token refresh (2 calls: `identity.xero.com` POST + CRM org-variable PUT),
Accounts fetch, and contact resolution — even when every refund on the
payment had already been processed, or the payment had no refunds at all.
Since most payment saves are not a fresh refund, nearly all of that cost was
wasted on every invocation.

## Fix applied

Inserted an early-exit check immediately after the two `for each customField`
loops that read `cf_xero_overpayment_id`/`cf_xero_processed_refund_ids`, and
before the `xeroRefreshToken = zoho.crm.getOrgVariable(...)` line:

```deluge
hasUnprocessedRefund = false;
for each  refundEntry in paymentInfo.get("payment_refunds")
{
	refundId = refundEntry.get("payment_refund_id");
	refundAmount = refundEntry.get("amount_bcy");
	if(!processedRefundIds.contains(refundId) && refundAmount != null && refundAmount != 0)
	{
		hasUnprocessedRefund = true;
	}
}
if(!hasUnprocessedRefund)
{
	resultMap = Map();
	resultMap.put("message","No unprocessed refunds - skipped Xero call");
	resultMap.put("code",0);
	return resultMap;
}
```

The skip conditions (`processedRefundIds.contains(refundId)`,
`refundAmount == null || == 0`) exactly mirror the ones the real processing
loop further down already uses, so this changes nothing about what gets
processed — it only stops the expensive Xero setup from running when there's
nothing for it to do.

## Status

Applied live 2026-09-04, confirmed by developer.
