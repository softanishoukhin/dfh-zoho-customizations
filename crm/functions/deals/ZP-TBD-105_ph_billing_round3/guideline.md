# ZP-TBD-105 Round 3 -- MNSJ monthly invoicing + every billing code changeable

Andrea 2026-10-12: "MNSJ should follow the same process as Police and Hospital" + finish the
outstanding work. Two remaining items from the round-2 open list:

1. **MNSJ monthly:** MNSJ case invoices stop going to Xero one by one; only the monthly MNSJ
   invoice goes to Xero (same as Police / Hospital).
2. **Billing codes:** the six scenarios the app showed as "Fixed in the CRM code" can all be
   changed from the Billing codes screen.

All live sources pulled 2026-10-12 (Books `createinvoiceonxero`; CRM
`StorageFeebasedonLetterofNoInterestWorkflow` 6503357000003302110,
`updateSalesorderWithStorageFee` 6503357000003289008,
`UpdateStorageFeeonHospitalReleaseDate` 6503357000003769101,
`createSalesOrderForHospitalCase` 6503357000003769347, plus read-only checks of
`CreateSalesOrderforPoliceCase`, `handleAutopsyReschedule`, `CreateInvoiceonSelectingDFHNotSelected`,
`generateDelayedLONIInvoice`).

## What the live check found

Of the six "fixed" scenarios, four already pick their product by tag since ZP-TBD-33
(2026-08-20) -- the hardcoded id is only the fallback when nothing is tagged:

| Scenario | Live | Tag (police parent IFSLM 6503357000020022236 / hospital) |
|---|---|---|
| Decomposition fee | tag | `Decomp Fee` |
| Reschedule trip / X-ray trip | tag | `Reschedule Trip` / `X-ray Trip` |
| Transfer trip -- police | tag | `Transfer Trip` |
| Transfer trip -- **hospital** | **hardcoded 6503357000004300027** | -> new: hospital `Transfer Trip`, else police `Transfer Trip` |
| LONI storage (IFSL + MNSJ) | **hardcoded 6503357000002869275 / 6503357000019249225** | -> new: `Storage` / `Decompose Storage` |
| Hospital family storage | tag | hospital `Storage - Family` |

Checked live 2026-10-12: the hardcoded LONI products ARE the products carrying the `Storage`
(IFSLM Police Case Storage Fee, TRIP-3, 1,500) and `Decompose Storage` (IFSLM Decomposition
Storage Fee, STORAGE-1, 2,000) tags, and Transfer Trip (TRIP-5) carries `Transfer Trip` -- so
**billing is identical the day this is deployed**; it only lets the Billing codes screen reach
these two places.

Second issue fixed: the three storage recalculations (LONI, autopsy completed, hospital release
date) find the existing storage line by ONE product id. Once a storage product is changed on the
Billing codes screen, a case created before the change would get a SECOND storage line on its next
recalculation. They now find the storage line by the product's category and swap it for the
current product.

---

## Step 1 -- Books: MNSJ no longer goes to Xero on its own

Books > Settings > Automation > Custom Functions > **createinvoiceonxero**. Find (1 line):
```deluge
	if(crmInvoiceDetails.get("Invoice_For") != "Hospital" && crmInvoiceDetails.get("Invoice_For") != "Police" && crmInvoiceDetails.get("Invoice_For") != "Wholesale")
```
Replace with:
```deluge
	if(crmInvoiceDetails.get("Invoice_For") != "Hospital" && crmInvoiceDetails.get("Invoice_For") != "Police" && crmInvoiceDetails.get("Invoice_For") != "Wholesale" && crmInvoiceDetails.get("Invoice_For") != "MNSJ")
```
**Also the Schedule:** the function's own header says "If Update here then update to Schedule too".
Books > Settings > Automation > **Schedules** -- open the schedule that re-runs the Xero invoice sync
(it is not visible to our tools) and make the same one-line change there, if it has this line.

Effect: new MNSJ case invoices stay in Books only; the monthly MNSJ invoice (no CRM invoice behind
it) goes to Xero as before. MNSJ invoices that already went to Xero stay there as single invoices
and are paid one by one; Step 2 stops them being added to a monthly invoice.

## Step 2 -- Creator functions (app Police & Hospital Billing)

From `creator/functions/ph_billing/ZP-TBD-105_ph_billing_app/ph_billing_functions.deluge`, replace
the whole body of:
- **phMonthlyAdd** -- refuses an invoice that already has a Xero invoice id in Books.
- **phBillingCodes** -- returns the fallback products (shown under a scenario with nothing linked).
- **phSetBillingCode** -- accepts the new scenarios (police: Decomp Fee, Transfer Trip, Reschedule
  Trip, X-ray Trip; hospital: Decompose, PME Transport Fee, Transfer Trip) and refuses a product that
  already bills another scenario or belongs to another hospital.

No new Custom APIs, no new forms.

## Step 3 -- CRM: `automation.StorageFeebasedonLetterofNoInterestWorkflow`

**3a.** Find:
```deluge
	// Fetch "Storage Fee" product details -- decomposed bodies use the decomp storage rate instead
	storageProductIdToUse = "6503357000002869275";
	if(isDecomposedLoni)
	{
		storageProductIdToUse = "6503357000019249225";
	}
	productDetails = zoho.crm.getRecordById("Products",storageProductIdToUse);
```
Replace with:
```deluge
	// Fetch "Storage Fee" product details -- decomposed bodies use the decomp storage rate instead.
	// ZP-TBD-105 R3: by tag, so the Billing codes screen reaches the LONI split (IFSL + MNSJ).
	storageCategory = "Storage";
	storageProductIdToUse = "6503357000002869275";
	if(isDecomposedLoni)
	{
		storageCategory = "Decompose Storage";
		storageProductIdToUse = "6503357000019249225";
	}
	linkedStorageProducts = standalone.COQLQuery("select Product_Name from Products where Parent_Product = '6503357000020022236' and Product_Category = '" + storageCategory + "'");
	if(linkedStorageProducts.size() > 0)
	{
		storageProductIdToUse = linkedStorageProducts.toList().get(0).get("id");
	}
	productDetails = zoho.crm.getRecordById("Products",storageProductIdToUse);
```
(The MNSJ block further down already uses `storageProductIdToUse`, so MNSJ follows too.)

**3b.** Find this block (it is just after `lineItemList` is filled from the Sales Order):
```deluge
	// Check if "Storage Fee" already exists
	existingStorageFeeIndex = -1;
	for each  item in lineItemList
	{
		if(item.contains("Product_Name"))
		{
			productName = item.get("Product_Name");
			if(productName != null && productName.contains("id") && productName.get("id") == storageProductID)
			{
				existingStorageFeeIndex = lineItemList.indexOf(item);
				break;
			}
		}
	}
```
Replace the whole block with:
```deluge
	storageCats = {"Storage","Decompose Storage"};
	storageFallbackIds = {"6503357000002869275","6503357000019249225"};
	// ZP-TBD-105 R3: find the storage line by its product's category, not by one product id.
	// If the storage product was changed on the Billing codes screen while this case was open,
	// the old line is replaced by the current product instead of a second storage line being added.
	existingStorageFeeIndex = -1;
	lineProductIds = list();
	for each  item in lineItemList
	{
		if(item.contains("Product_Name"))
		{
			productName = item.get("Product_Name");
			if(productName != null && productName.contains("id"))
			{
				lineProductIds.add("'" + productName.get("id") + "'");
			}
		}
	}
	storageLineProductIds = list();
	if(lineProductIds.size() > 0)
	{
		lineProductCats = standalone.COQLQuery("select id, Product_Category from Products where id in (" + lineProductIds.toString(",") + ") limit 200");
		if(lineProductCats.size() > 0)
		{
			lineProductCatsList = lineProductCats.toList();
			for each  lpc in lineProductCatsList
			{
				lpcMap = (lpc + "").toMap();
				if(storageCats.contains(ifnull(lpcMap.get("Product_Category"),"")))
				{
					storageLineProductIds.add(lpcMap.get("id") + "");
				}
			}
		}
	}
	for each  item in lineItemList
	{
		if(item.contains("Product_Name"))
		{
			productName = item.get("Product_Name");
			if(productName != null && productName.contains("id"))
			{
				lineProdId = productName.get("id") + "";
				isStorageLine = false;
				if(lineProdId == storageProductID + "")
				{
					isStorageLine = true;
				}
				if(storageLineProductIds.contains(lineProdId))
				{
					isStorageLine = true;
				}
				if(storageFallbackIds.contains(lineProdId))
				{
					isStorageLine = true;
				}
				if(isStorageLine)
				{
					existingStorageFeeIndex = lineItemList.indexOf(item);
					break;
				}
			}
		}
	}
	if(existingStorageFeeIndex >= 0)
	{
		matchedStorageItem = lineItemList.get(existingStorageFeeIndex);
		if(matchedStorageItem.get("Product_Name").get("id") + "" != storageProductID + "")
		{
			// old product -> drop it; the existing "not found" branch below adds the current one
			lineItemList.remove(existingStorageFeeIndex);
			existingStorageFeeIndex = -1;
		}
	}
```

## Step 4 -- CRM: `automation.updateSalesorderWithStorageFee` (autopsy completed)

Find this block:
```deluge
	// Check if "Storage Fee" already exists
	existingStorageFeeIndex = -1;
	// Initialize index variable to -1
	for each  item in lineItemList
	{
		if(item.contains("Product_Name"))
		{
			productName = item.get("Product_Name");
			if(productName != null && productName.contains("id") && productName.get("id") == storageProductID)
			{
				existingStorageFeeIndex = lineItemList.indexOf(item);
				// Get the index of the matching item
				break;
			}
		}
	}
```
Replace the whole block with:
```deluge
	storageCats = {"Storage"};
	storageFallbackIds = {"6503357000002869275"};
	// ZP-TBD-105 R3: find the storage line by its product's category, not by one product id.
	// If the storage product was changed on the Billing codes screen while this case was open,
	// the old line is replaced by the current product instead of a second storage line being added.
	existingStorageFeeIndex = -1;
	lineProductIds = list();
	for each  item in lineItemList
	{
		if(item.contains("Product_Name"))
		{
			productName = item.get("Product_Name");
			if(productName != null && productName.contains("id"))
			{
				lineProductIds.add("'" + productName.get("id") + "'");
			}
		}
	}
	storageLineProductIds = list();
	if(lineProductIds.size() > 0)
	{
		lineProductCats = standalone.COQLQuery("select id, Product_Category from Products where id in (" + lineProductIds.toString(",") + ") limit 200");
		if(lineProductCats.size() > 0)
		{
			lineProductCatsList = lineProductCats.toList();
			for each  lpc in lineProductCatsList
			{
				lpcMap = (lpc + "").toMap();
				if(storageCats.contains(ifnull(lpcMap.get("Product_Category"),"")))
				{
					storageLineProductIds.add(lpcMap.get("id") + "");
				}
			}
		}
	}
	for each  item in lineItemList
	{
		if(item.contains("Product_Name"))
		{
			productName = item.get("Product_Name");
			if(productName != null && productName.contains("id"))
			{
				lineProdId = productName.get("id") + "";
				isStorageLine = false;
				if(lineProdId == storageProductID + "")
				{
					isStorageLine = true;
				}
				if(storageLineProductIds.contains(lineProdId))
				{
					isStorageLine = true;
				}
				if(storageFallbackIds.contains(lineProdId))
				{
					isStorageLine = true;
				}
				if(isStorageLine)
				{
					existingStorageFeeIndex = lineItemList.indexOf(item);
					break;
				}
			}
		}
	}
	if(existingStorageFeeIndex >= 0)
	{
		matchedStorageItem = lineItemList.get(existingStorageFeeIndex);
		if(matchedStorageItem.get("Product_Name").get("id") + "" != storageProductID + "")
		{
			// old product -> drop it; the existing "not found" branch below adds the current one
			lineItemList.remove(existingStorageFeeIndex);
			existingStorageFeeIndex = -1;
		}
	}
```
(Only `Storage` here: this function has always billed the normal rate and must not swap a
decomposed storage line for it.)

## Step 5 -- CRM: `automation.UpdateStorageFeeonHospitalReleaseDate`

Find this block (one tab deeper, inside `if(!isNull(productDetails))`):
```deluge
		// Check if "Storage Fee" already exists
		existingStorageFeeIndex = -1;
		for each  item in lineItemList
		{
			if(item.contains("Product_Name"))
			{
				productName = item.get("Product_Name");
				if(productName != null && productName.contains("id") && productName.get("id") == storageProductID)
				{
					existingStorageFeeIndex = lineItemList.indexOf(item);
					break;
				}
			}
		}
```
Replace the whole block with:
```deluge
		storageCats = {"Storage"};
		storageFallbackIds = {"6503357000078744158","6503357000002869275"};
		// ZP-TBD-105 R3: find the storage line by its product's category, not by one product id.
		// If the storage product was changed on the Billing codes screen while this case was open,
		// the old line is replaced by the current product instead of a second storage line being added.
		existingStorageFeeIndex = -1;
		lineProductIds = list();
		for each  item in lineItemList
		{
			if(item.contains("Product_Name"))
			{
				productName = item.get("Product_Name");
				if(productName != null && productName.contains("id"))
				{
					lineProductIds.add("'" + productName.get("id") + "'");
				}
			}
		}
		storageLineProductIds = list();
		if(lineProductIds.size() > 0)
		{
			lineProductCats = standalone.COQLQuery("select id, Product_Category from Products where id in (" + lineProductIds.toString(",") + ") limit 200");
			if(lineProductCats.size() > 0)
			{
				lineProductCatsList = lineProductCats.toList();
				for each  lpc in lineProductCatsList
				{
					lpcMap = (lpc + "").toMap();
					if(storageCats.contains(ifnull(lpcMap.get("Product_Category"),"")))
					{
						storageLineProductIds.add(lpcMap.get("id") + "");
					}
				}
			}
		}
		for each  item in lineItemList
		{
			if(item.contains("Product_Name"))
			{
				productName = item.get("Product_Name");
				if(productName != null && productName.contains("id"))
				{
					lineProdId = productName.get("id") + "";
					isStorageLine = false;
					if(lineProdId == storageProductID + "")
					{
						isStorageLine = true;
					}
					if(storageLineProductIds.contains(lineProdId))
					{
						isStorageLine = true;
					}
					if(storageFallbackIds.contains(lineProdId))
					{
						isStorageLine = true;
					}
					if(isStorageLine)
					{
						existingStorageFeeIndex = lineItemList.indexOf(item);
						break;
					}
				}
			}
		}
		if(existingStorageFeeIndex >= 0)
		{
			matchedStorageItem = lineItemList.get(existingStorageFeeIndex);
			if(matchedStorageItem.get("Product_Name").get("id") + "" != storageProductID + "")
			{
				// old product -> drop it; the existing "not found" branch below adds the current one
				lineItemList.remove(existingStorageFeeIndex);
				existingStorageFeeIndex = -1;
			}
		}
```

In Steps 3b, 4 and 5 only the found block is replaced. The code below it in each function (update the
quantity / add a new line / remove at 0 days) stays exactly as it is.

## Step 6 -- CRM: `automation.createSalesOrderForHospitalCase` (hospital Transfer trip)

Find:
```deluge
		if(tripInfo.get("Trip_Type") == "Transfer to Other Funeral Home")
		{
			productDetails = zoho.crm.getRecordById("Products","6503357000004300027");
```
Replace with:
```deluge
		if(tripInfo.get("Trip_Type") == "Transfer to Other Funeral Home")
		{
			// ZP-TBD-105 R3: by tag -- this hospital's Transfer Trip, else the police Transfer Trip.
			transferProductId = "6503357000004300027";
			transferFound = false;
			if(!isNull(recordInfo.get("Selected_Hospital")))
			{
				hospTransfer = standalone.COQLQuery("select Product_Name from Products where Product_of_This_Hospital = '" + recordInfo.get("Selected_Hospital").get("id") + "' and Product_Category = 'Transfer Trip'");
				if(hospTransfer.size() > 0)
				{
					transferProductId = hospTransfer.toList().get(0).get("id");
					transferFound = true;
				}
			}
			if(transferFound == false)
			{
				policeTransfer = standalone.COQLQuery("select Product_Name from Products where Parent_Product = '6503357000020022236' and Product_Category = 'Transfer Trip'");
				if(policeTransfer.size() > 0)
				{
					transferProductId = policeTransfer.toList().get(0).get("id");
				}
			}
			productDetails = zoho.crm.getRecordById("Products",transferProductId);
```

## Step 7 -- Widget
Re-upload `widgets\PHBilling\PHBillingWidget\dist\PHBillingWidget.zip`. The Billing codes screen
now lists every scenario (police: + Decomposition fee, Reschedule trip, X-ray trip, Transfer;
hospital: + Decomposition fee, PME transport fee, Transfer). A scenario with nothing linked shows
"Not linked -- the CRM falls back to <product>". The "Fixed in the CRM code" box is gone.

## Test focus
- New MNSJ case invoice (LONI > 2 days): reaches Books, NOT Xero; add it to the MNSJ monthly
  invoice; Mark as sent -> only the monthly invoice appears in Xero.
- An MNSJ invoice from before today that is in Xero: Add to monthly invoice is refused with the
  "already sent to Xero on its own" message.
- LONI on a police case: same products / prices as before (no tag changed).
- Billing codes: change police Storage to a test product, enter a LONI date on an existing case ->
  the storage line becomes the test product (ONE line, IFSL 2 days, MNSJ the rest); change it back.
- Billing codes: try to pick the Reschedule Trip product for X-ray Trip -> refused.
- Hospital transfer trip completed -> Transfer Trip product (unchanged unless re-tagged).
