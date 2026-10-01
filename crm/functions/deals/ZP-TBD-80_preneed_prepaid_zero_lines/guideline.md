# ZP-TBD-80 -- Pre-Need products at $0 on the At-Need Deal -- deployment guideline

Nothing here is applied to live yet. All code was merged onto live source pulled 2026-09-28.
Order matters: **fields -> product -> Dale's account -> connection -> new function -> 3 patches -> button body.**
The button body goes LAST: until then, `getPreNeedInfo` keeps working the ZP-TBD-79 way.

---

## 1. Two new Product_Selection subform fields

Setup > Modules and Fields > Deals > (any layout with the Product Selection subform) > edit the subform:

| Label | Type | API name (confirm after saving) | Values |
|---|---|---|---|
| Pre-Need Line | Picklist | `Pre_Need_Line` | `-None-`, `Prepaid`, `Balance` |
| Pre-Need Amount | Currency (2 dp) | `Pre_Need_Amount` | -- |

- Add both to **all 4 layouts** that carry the subform (PC/HP, SI, FB, CO/CS/WH/FC/FR/RC).
- Recommended: **read-only** for every profile except Administrator, so staff cannot un-prepay a line.
- If a live API name differs, change it in all 4 code pieces (search `Pre_Need_Line` / `Pre_Need_Amount`).

Why a new currency field: `Product_Selection.Unit_Price` is a read-only lookup field copied from the product
(confirmed live 2026-09-28), so a line cannot carry its own price there.

## 2. Product "Pre-Need Balance"

CRM > Products > New (it syncs to Books as an item, like "Pre-Need Difference"):
- Name `Pre-Need Balance`, Unit Price `0`, **no tax** (non-taxable), **Zero Rated unchecked**, Active.
- Put it under a Parent product that passes the Product Selection "Child Product" lookup filter (the filter is
  re-validated on save). Note both ids.
- In Books, set the item's sales account to the same revenue account Dale picks in step 3.
- Paste the ids into `getPreNeedInfo_UPDATED.deluge` CONFIG: `balanceProductId`, `balanceParentProductId`.

## 3. Dale: the revenue account

`releasePreNeedLiability_NEW.deluge` CONFIG `revenueAccountCode` = the Xero account CODE the Pre-Need money is
moved to (Dr 26100 PRE NEED / Cr this account). Empty = the function refuses to post, and the button says
"Liability release NOT done ... not configured" (nothing breaks; click again after it is set).

## 4. Connection `zohooauth` scopes

Add if missing: `ZohoCRM.settings.variables.ALL` (save the rotated Xero token), `ZohoBooks.retainerinvoices.READ`
and `ZohoBooks.retainerinvoices.CREATE` (retainer comment), `ZohoCRM.modules.custom.ALL` (System_Data).

## 5. New standalone function

Setup > Developer Hub > Functions > New > Standalone, Deluge. Name `releasePreNeedLiability`, arguments
`preNeedDealId` (String), `atNeedDealId` (String), `amountText` (String). Paste `releasePreNeedLiability_NEW.deluge`.
Replace `PASTE_FROM_LIVE_syncretainerinvoicetoxero` with the client secret from that live Books function.

---

## 6. Patch `automation.createSalesOrdersForShipIns` (4 insertions)

Open the live function. Insert exactly these blocks; nothing else changes.

**A1** -- directly after the line `allDealCurrentDealProduct = list();` (just before `for each  product in recordInfo.get("Product_Selection")`):

```deluge
	// ZP-TBD-80: count Pre-Need lines (see the guard before the Sales Order is written)
	billableRows = 0;
	preNeedPrepaidRows = 0;
	tripRows = 0;
```

**A2** -- inside the product loop, directly after
`productMap.put("Discount",ifnull(product.get("Discount"),0));` and before `lineAmount = productMap.get("Quantity") * productMap.get("List_Price");`:

```deluge
		// ZP-TBD-80: Pre-Need lines.
		//   Prepaid = already paid on the Pre-Need plan -> always $0, whatever the catalogue price is today.
		//   Balance = unpaid part of the Pre-Need contract -> priced from the row's Pre_Need_Amount.
		preNeedLine = ifnull(product.get("Pre_Need_Line"),"").toString();
		if(preNeedLine == "Prepaid")
		{
			prepaidQty = ifnull(product.get("Quantity"),1).toString().toDecimal();
			prepaidList = ifnull(productDetails.get("Unit_Price"),0).toString().toDecimal();
			productMap.put("Discount",(prepaidQty * prepaidList).round(2));
			preNeedPrepaidRows = preNeedPrepaidRows + 1;
		}
		else
		{
			billableRows = billableRows + 1;
			if(preNeedLine == "Balance")
			{
				productMap.put("List_Price",ifnull(product.get("Pre_Need_Amount"),0).toString().toDecimal());
				productMap.put("Discount",0);
			}
		}
```

(Tax is computed on `lineAmount - discountAmt` right below, so a prepaid line also gets $0 tax.)

**A3** -- in the TRIP loop (`for each  tripInfo in trips`), the second `soItemsList.add(productMap);` of the
function, add one line directly after it:

```deluge
				tripRows = tripRows + 1;
```

**A4** -- directly after this existing block:

```deluge
	checkLineItemsAvailableWithProduct = false;
	if(soItemsList.size() > 0)
	{
		checkLineItemsAvailableWithProduct = true;
	}
```

insert:

```deluge
	// ZP-TBD-80: a Deal holding ONLY prepaid Pre-Need lines gets no Sales Order / Invoice (nothing to bill).
	// As soon as anything billable is added, the next run builds the SO with the prepaid lines at $0 next to it.
	if(salesOrderExists == false && billableRows == 0 && tripRows == 0 && preNeedPrepaidRows > 0)
	{
		info "ZP-TBD-80: only prepaid Pre-Need lines on Deal " + crmid + " - no Sales Order created";
		checkLineItemsAvailableWithProduct = false;
	}
```

Not patched: the `createSalesOrderForShipInsV2` branch at the top (only for test Deals whose deceased name
contains `009922`).

## 7. Patch `standalone.manageZeroRatedProduct` (1 insertion)

This function runs at the start of every Sales Order build and adds a "Non Taxable - X" companion row at
**100,000** for every Zero Rated product. Without this patch a prepaid Zero Rated item would bill 100,000.

Directly before the (only) line `newItem.put("Quantity",1);` insert:

```deluge
	// ZP-TBD-80: the companion of a prepaid Pre-Need line is prepaid too (else it bills 100,000)
	if(ifnull(item.get("Pre_Need_Line"),"").toString() == "Prepaid")
	{
		newItem.put("Pre_Need_Line","Prepaid");
	}
```

## 8. Patch `standalone.sendInstallmentReminder` (API name `sendinstallmentreminder_1`)

(Not the old `automation.sendInstallmentReminderDepricated`, API name `sendinstallmentreminder`.)

**C1** -- in the Invoices GET URL, add `Deal_Name__s` to the fields:

```deluge
	url :"https://www.zohoapis.com/crm/v8/Invoices/" + crmid + "?fields=Status,Due_Date,Invoice_For,Contact_Name,Deal_Name__s"
```

**C2** -- directly after the block that returns `"not an installment invoice"`, insert:

```deluge
// ZP-TBD-80: the Pre-Need was converted to an At-Need funeral (Get Pre Need Info) -> any unpaid balance is billed
// on the At-Need invoice instead, so installment reminders stop here
dealRef = invoiceInfo.get("Deal_Name__s");
if(!isNull(dealRef))
{
	convRows = standalone.COQLQuery("select id from System_Data where Module_Name = 'Deals' and Module_ID = '" + dealRef.get("id") + "' and Name = 'Pre_Need_Converted' limit 1");
	if(convRows.size() > 0)
	{
		info "Invoice " + crmid + ": its Pre-Need was converted to At-Need - reminder (" + stage + ") not sent, chain ends";
		return "pre-need converted to at-need";
	}
}
```

## 9. Replace the `button.getPreNeedInfo` body

Paste `getPreNeedInfo_UPDATED.deluge` over the whole live body (it was merged onto the live copy pulled
2026-09-28). Fill CONFIG `balanceProductId` / `balanceParentProductId` from step 2.

## 10. Test

Run `test-cases.md` (CSV copy in `widgets\testCases\ZP-TBD-80_PreNeed_Prepaid_Zero_Test_Cases.csv`).
TC-01..03 are the gating ones.

---

## Rollback

- Steps 6-8: delete every block marked `ZP-TBD-80` (and remove `,Deal_Name__s` from C1). The functions are then
  exactly the live versions of 2026-09-28.
- Step 9: paste back `../ZP-TBD-79_get_preneed_info/getPreNeedInfo.deluge` (identical to live apart from two
  spaces in the back-link Note text).
- A posted Xero journal is NOT undone by a rollback -- reverse it in Xero by hand if needed (its id is in the
  System_Data row `Pre_Need_Liability_Released` for that Pre-Need Deal).
