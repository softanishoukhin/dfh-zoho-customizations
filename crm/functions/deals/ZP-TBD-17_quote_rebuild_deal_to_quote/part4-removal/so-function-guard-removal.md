# Remove the suppression guard from the 4 Sales-Order-creation functions

Pulled live 2026-08-13, confirmed byte-identical across all four. Delete exactly
these 8 lines from the very top of each function's body (the first thing
inside the opening `{`), and nothing else in these functions changes.

## Lines to delete (identical in all 4 functions)

```deluge
if(standalone.isQuoteAwaitingAcceptance(crmid) == "true")
{
	try 
	{
		standalone.syncQuoteLineItemsOnly(crmid);
	}
	catch (e)
	{
	}
	return;
}
```

## Where, exactly (confirmed live 2026-08-13)

1. **`automation.createSalesOrderForDifferentPipelines(Int crmid)`** -- guard is
   immediately after the opening `{`. The very next lines after deleting the
   guard become the `recordInfo = invokeurl [...]` REST GET of the Deal --
   unchanged, don't touch.
2. **`automation.createSalesOrderFromDeals(Int crmid)`** -- same position.
   Next line after the guard is removed becomes
   `standalone.manageZeroRatedProduct(crmid);` -- unchanged.
3. **`automation.createSalesOrderForHospitalCase(Int crmid)`** -- same
   position. Next line becomes the `try { getUrl(".../Sleep_API...") }`
   block -- unchanged.
4. **`automation.CreateSalesOrderforPoliceCase(Int crmid)`** -- same position.
   Next line becomes the same `try { getUrl(".../Sleep_API...") }` block --
   unchanged.

## Why this is safe to do mechanically

This guard is a clean, self-contained prefix in all four functions -- it does
not share any variable, branch, or side effect with anything after it (the
`return;` is the only thing that ever made it interact with the rest of the
function, by skipping it entirely). Deleting it does not require re-reading
or re-verifying anything else in these functions; everything below it runs
exactly as it always has for a Deal that was never in the Quote flow.

## After this, also remove (once nothing sets the flag anymore)

Per Andrea's spec, once `Awaiting_Quote_Acceptance` is never set true by
anything (all 16 client scripts in `client-scripts/` are updated first), this
guard going inert is enough on its own -- `standalone.isQuoteAwaitingAcceptance`
will always evaluate `!= "true"`, so the guard's `if` body never runs even if
left in place. Deleting it outright (as directed above) is for cleanliness,
not correctness -- do the client-script updates FIRST, confirm a few normal
Deals still auto-invoice correctly, THEN remove these 8-line blocks, per the
deployment order in `../deployment-checklist.md`.
