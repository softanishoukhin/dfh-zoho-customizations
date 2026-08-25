# ZP-TBD-41 guideline

## §1 — Fix `senddriversheet` (CRM function, id `6503357000068702056`... actually see note)

**Note:** confirm the function id via CRM function list search for api name `senddriversheet`
before editing — do not guess. Open it in the CRM function editor (`button.sendDriverSheet`).

Find this block (it's the walk-in-invoice loop, after the two `for each item in lineItemList`
loops that build `casketProduct`/`floralProduct` from `Product_Selection`):

```deluge
relatedInvoices = zoho.crm.getRelatedRecords("Invoices","Deals",tripInfo.get("Deal").get("id"));
for each  relatedInvoceInfo in relatedInvoices
{
	relatedInvoiceRecordInfo = zoho.crm.getRecordById("Invoices",relatedInvoceInfo.get("id"));
	if(relatedInvoiceRecordInfo.get("Is_walk_in_Invoice") == true)
	{
		for each  relatedInvoiceItem in relatedInvoiceRecordInfo.get("Invoiced_Items")
		{
			try 
			{
				if(relatedInvoiceItem.get("Parent_Product").get("name") == "Flowers")
				{
					floralProduct.add(item.get("Product_Name").get("name"));
				}
			}
			catch (e)
			{
				info e;
			}
			try 
			{
				if(relatedInvoiceItem.get("Parent_Product").get("name") == "Caskets")
				{
					casketProduct.add(item.get("Product_Name").get("name"));
				}
			}
			catch (e)
			{
				info e;
			}
		}
	}
}
```

Replace **both** `item.get("Product_Name").get("name")` calls with
`relatedInvoiceItem.get("Product_Name").get("name")` — `item` is a leftover loop variable from
the earlier `Product_Selection` loop and does not refer to the invoice row being processed:

```deluge
relatedInvoices = zoho.crm.getRelatedRecords("Invoices","Deals",tripInfo.get("Deal").get("id"));
for each  relatedInvoceInfo in relatedInvoices
{
	relatedInvoiceRecordInfo = zoho.crm.getRecordById("Invoices",relatedInvoceInfo.get("id"));
	if(relatedInvoiceRecordInfo.get("Is_walk_in_Invoice") == true)
	{
		for each  relatedInvoiceItem in relatedInvoiceRecordInfo.get("Invoiced_Items")
		{
			try 
			{
				if(relatedInvoiceItem.get("Parent_Product").get("name") == "Flowers")
				{
					floralProduct.add(relatedInvoiceItem.get("Product_Name").get("name"));
				}
			}
			catch (e)
			{
				info e;
			}
			try 
			{
				if(relatedInvoiceItem.get("Parent_Product").get("name") == "Caskets")
				{
					casketProduct.add(relatedInvoiceItem.get("Product_Name").get("name"));
				}
			}
			catch (e)
			{
				info e;
			}
		}
	}
}
```

That's the only change needed in this function. Everything downstream (`data.put("floral_item",
floralProduct.toString())` etc.) already works off the corrected lists.

## §2 — Fix `getTripDetail` in `Trip_Manager.ds` (Creator widget script — guideline only, do not
edit the .ds file directly)

Around line 3342, `getTripDetail` builds `dealMerchandise` only from
`dealRec.get("Product_Selection")`. Add a walk-in-invoice merge block right after that existing
loop closes (after the `for each productRow in productRows { ... }` block, still inside the
`if(dealRec.containKey("Product_Selection"))` scope is fine, or just after it — either works
since `dealId` is already in scope). Model it on the proven pattern already in this same file at
`getDailyFuneralRollup` steps 5–6 (COQL against `Invoices` filtered by `Is_walk_in_Invoice = true
and Deal_Name__s = dealId`, then COQL against `Invoiced_Items` for those invoice ids), but scoped
to a single Deal since `getTripDetail` only ever handles one trip/deal at a time:

```deluge
try 
{
	wq = Map();
	wq.put("select_query","select id from Invoices where Is_walk_in_Invoice = true and Deal_Name__s = " + dealId + " limit 50");
	wresp = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v7/coql"
		type :POST
		parameters:wq.toString()
		headers:{"Content-Type":"application/json"}
		connection:"zoho_oauth_connection"
	];
	if(wresp.containKey("data"))
	{
		walkInIds = "";
		for each  wr in wresp.get("data")
		{
			wid = "" + wr.get("id");
			if(walkInIds == "")
			{
				walkInIds = wid;
			}
			else
			{
				walkInIds = walkInIds + "," + wid;
			}
		}
		if(walkInIds != "")
		{
			xq = Map();
			xq.put("select_query","select Parent_Id, Parent_Product, Product_Name from Invoiced_Items where Parent_Id in (" + walkInIds + ") limit 200");
			xresp = invokeurl
			[
				url :"https://www.zohoapis.com/crm/v7/coql"
				type :POST
				parameters:xq.toString()
				headers:{"Content-Type":"application/json"}
				connection:"zoho_oauth_connection"
			];
			if(xresp.containKey("data"))
			{
				for each  xr in xresp.get("data")
				{
					try 
					{
						wParentName = ifnull(xr.get("Parent_Product").get("name"),"");
						wChildName = ifnull(xr.get("Product_Name").get("name"),"");
						if(wParentName == "Caskets" && !haveCasket)
						{
							dealCasket.put("name",wChildName);
							dealCasket.put("primary",dealCasketPrimary);
							dealCasket.put("secondary",dealCasketSecondary);
							haveCasket = true;
						}
						if(wParentName == "Flowers" || wParentName == "Cremation Merchandise" || wParentName == "Programs")
						{
							wLine = Map();
							wLine.put("category",wParentName);
							wLine.put("name",wChildName);
							dealMerchandise.add(wLine);
						}
					}
					catch (eWRow)
					{
					}
				}
			}
		}
	}
}
catch (eWalkIn)
{
}
```

Notes:
- `haveCasket` is declared inside the existing `if(dealRec.containKey("Product_Selection"))`
  block — if you place this new block outside that `if`, declare `haveCasket = false` before it
  (or reuse whatever the existing scoping allows) so a walk-in casket doesn't get skipped when a
  Deal has no `Product_Selection` casket row at all.
- Uses the same COQL connection name (`zoho_oauth_connection`) already used elsewhere in this
  file for COQL calls — confirm that's still the correct connection name before applying (check
  another COQL call in the current `Trip_Manager.ds`, e.g. inside `getDailyFuneralRollup`).
