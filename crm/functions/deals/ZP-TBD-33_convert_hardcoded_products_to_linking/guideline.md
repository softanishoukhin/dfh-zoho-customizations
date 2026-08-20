# ZP-TBD-33 — Convert remaining hardcoded Police/Hospital products to the linking process

**STATUS (2026-08-20): DEPLOYED AND CONFIRMED PASSING.** All three parts (Part A --
Transfer/Reschedule/Decomp in CreateSalesOrderforPoliceCase, Part B -- Reschedule/X-ray in
handleAutopsyReschedule, Part C -- Hospital Release Family Bill fix in
CreateInvoiceonSelectingDFHNotSelected) applied and tested by the user, all passing.

Requested by Andrea (`phBillingTask08202026.txt`, 2026-08-20): "convert all of the billing
for police and hospital to the linking process... get converted where it's not." Per the
`PH_Billing_Code_Map_2026-08-19.docx` sent yesterday, "the linking process" is the existing
Parent_Product + Product_Category COQL pattern already working for Pickup/Storage/
Decompose Storage/Autopsy Trip -- this guideline converts every remaining hardcoded
(non-linking) product id in the Police/Hospital billing functions to that same pattern.

Live-verified 2026-08-20 -- all three functions below were pulled in full via
`getFunctionCode` this session (superseding any paraphrase from the 2026-08-19 code map).

**Field-limit note:** confirmed with the user this session that the Deal field-limit
increase has landed, so new Deal fields (e.g. the X-ray field from ZP-TBD-18) can be added
now if a future task needs one. Nothing in this guideline requires a new Deal field --
it's entirely a Products-module + function change.

**Deal fields check (2026-08-20):** live `getFields` on Deals shows no custom field
created after 2026-08-17 -- if Andrea already added fields/lookups referenced in her
message, they aren't visible on the Deals module as of this pull. Worth a quick confirm
with her on which module they landed on (a different module isn't unusual, since she also
mentioned "more lookups for custom modules") -- not a blocker for this guideline, which
doesn't depend on any new field.

---

## Part A -- `automation.CreateSalesOrderforPoliceCase` (id `6503357000003436189`)

Three hardcoded product ids found in this function (Pickup/Storage/Decompose-Storage/
Autopsy-Trip were **already** linked via COQL -- those are untouched):

1. `Trip_Type == "Transfer to Other Funeral Home"` -> hardcoded `6503357000004300027`
2. `Trip_Type == "Autopsy Reschedule"` -> hardcoded `6503357000004300032` (same id
   `handleAutopsyReschedule` uses, see Part B)
3. Decomp fee (`Condition == "Decomposed"`) -> hardcoded `6503357000002869270`

### Products-module setup (do this first)
For each of the 3 items above, tag the product you want billed with:
- `Parent_Product` = the Police parent (`6503357000020022236`)
- `Product_Category` = a new category value, one of:
  - `"Transfer Trip"` (item 1)
  - `"Reschedule Trip"` (item 2 -- same category name used in Part B, so both functions
    resolve to the same product with one relink)
  - `"Decomp Fee"` (item 3)

If no product carries that category yet, create the category value on the existing
product currently hardcoded (i.e. give `6503357000004300027` a `Product_Category` of
`"Transfer Trip"` and a `Parent_Product` of the Police parent, etc.) so the lookup finds
something immediately and behavior doesn't change on deploy -- then relink whenever the
product needs to change later.

### Code changes
Find (the Transfer / Autopsy-Reschedule branch, near the top of the `if(haveTrip)` block):
```deluge
if(tripInfo.get("Trip_Type") == "Transfer to Other Funeral Home")
{
	productDetails = zoho.crm.getRecordById("Products","6503357000004300027");
}
else if(tripInfo.get("Trip_Type") == "Autopsy Reschedule")
{
	productDetails = zoho.crm.getRecordById("Products","6503357000004300032");
}
else if(tripInfo.get("Created_on_This_Field_Update") == "Initial_Trip")
```
Replace with:
```deluge
if(tripInfo.get("Trip_Type") == "Transfer to Other Funeral Home")
{
	transferTripProductOfPolice = "select Product_Name from Products where Parent_Product = '6503357000020022236' and Product_Category = 'Transfer Trip'";
	transferTripProducts = standalone.COQLQuery(transferTripProductOfPolice);
	if(transferTripProducts.size() > 0)
	{
		transferTripProducts = transferTripProducts.toList();
		productDetails = zoho.crm.getRecordById("Products",transferTripProducts.get(0).get("id"));
	}
	else
	{
		productDetails = zoho.crm.getRecordById("Products","6503357000004300027");
	}
}
else if(tripInfo.get("Trip_Type") == "Autopsy Reschedule")
{
	rescheduleTripProductOfPolice = "select Product_Name from Products where Parent_Product = '6503357000020022236' and Product_Category = 'Reschedule Trip'";
	rescheduleTripProducts = standalone.COQLQuery(rescheduleTripProductOfPolice);
	if(rescheduleTripProducts.size() > 0)
	{
		rescheduleTripProducts = rescheduleTripProducts.toList();
		productDetails = zoho.crm.getRecordById("Products",rescheduleTripProducts.get(0).get("id"));
	}
	else
	{
		productDetails = zoho.crm.getRecordById("Products","6503357000004300032");
	}
}
else if(tripInfo.get("Created_on_This_Field_Update") == "Initial_Trip")
```

Find (the Decomp fee block):
```deluge
if(recordInfo.get("Condition") == "Decomposed")
{
	productDetails = zoho.crm.getRecordById("Products","6503357000002869270");
	//Decomp fee
```
Replace with:
```deluge
if(recordInfo.get("Condition") == "Decomposed")
{
	decompFeeProductOfPolice = "select Product_Name from Products where Parent_Product = '6503357000020022236' and Product_Category = 'Decomp Fee'";
	decompFeeProducts = standalone.COQLQuery(decompFeeProductOfPolice);
	if(decompFeeProducts.size() > 0)
	{
		decompFeeProducts = decompFeeProducts.toList();
		productDetails = zoho.crm.getRecordById("Products",decompFeeProducts.get(0).get("id"));
	}
	else
	{
		productDetails = zoho.crm.getRecordById("Products","6503357000002869270");
	}
	//Decomp fee
```

Everything else in the function (tax handling, quantity, Sales Order build, invoice
trigger) is unchanged.

---

## Part B -- `automation.handleAutopsyReschedule` (id `6503357000078744177`)

Currently one hardcoded id, reused for both the Police-officer-no-show reschedule AND the
X-ray trip (there is no separate X-ray product yet -- this converts the *lookup mechanism*
to linking, it does not by itself pick a different X-ray product; that's still Andrea/
Shirley's product decision from the open questions in the code map).

### Products-module setup
- Reschedule (non-X-ray): reuse the same `Product_Category = "Reschedule Trip"` set up in
  Part A -- one relink now changes the product in both functions at once.
- X-ray: tag a product with `Parent_Product` = Police parent, `Product_Category` =
  `"X-ray Trip"`. Until Andrea/Shirley pick the real X-ray product, tag the *current*
  fallback product (`6503357000004300032`) with this category too, so nothing changes on
  deploy -- then relinking to a real X-ray/radiology product later is a pure Products-module
  edit, no code change, once that decision is made.

### Code change
Find:
```deluge
rescheduleTripProductId = "6503357000004300032";
// Reschedule Trip, per DEVELOPER_BUILD_DOC.md §0
```
Replace with:
```deluge
rescheduleTripCategory = "Reschedule Trip";
if(isXray)
{
	rescheduleTripCategory = "X-ray Trip";
}
rescheduleTripProductQuery = "select Product_Name from Products where Parent_Product = '6503357000020022236' and Product_Category = '" + rescheduleTripCategory + "'";
rescheduleTripProductsFound = standalone.COQLQuery(rescheduleTripProductQuery);
if(rescheduleTripProductsFound.size() > 0)
{
	rescheduleTripProductsFound = rescheduleTripProductsFound.toList();
	rescheduleTripProductId = rescheduleTripProductsFound.get(0).get("id");
}
else
{
	rescheduleTripProductId = "6503357000004300032";
}
```
The rest of the function (existing-line lookup by `rescheduleTripProductId`, quantity
increment, Sales Order update, Task creation, idempotency) is unchanged -- it already reads
`rescheduleTripProductId` as a variable, so nothing downstream needs to change.

---

## Part C -- `automation.CreateInvoiceonSelectingDFHNotSelected` (id `6503357000003769135`)

This is the "possible bug" flagged in yesterday's code map, now confirmed from the full
live source: the function already runs a per-hospital COQL lookup
(`Product_of_This_Hospital` + `Product_Category = 'Storage'`) into `productDetails`, then
**ignores it** and bills a second, hardcoded product (`6503357000019249158`,
`billableProductDetails`) instead -- using the looked-up product's `Unit_Price` but the
hardcoded product's id and Tax. Converting this to linking means actually using what the
lookup already found, the same way the Police LONI Family Bill function does today.

### Products-module setup
Tag a **Storage - Family** category product per hospital: `Product_of_This_Hospital` =
that hospital's Account, `Product_Category` = `"Storage - Family"` (a new, distinct
category from the existing `"Storage"` one already used for the non-family hospital
storage bill, so the two don't collide). Until each hospital has one, the fallback below
keeps using the current hardcoded product (`6503357000019249158`), so nothing changes for
hospitals that haven't been tagged yet.

### Code change
Find (inside the `if(!isNull(recordInfo.get("Selected_Hospital")))` block):
```deluge
storageProductOfHospital = "select Product_Name from Products where Product_of_This_Hospital = '" + recordInfo.get("Selected_Hospital").get("id") + "' and Product_Category = 'Storage'";
storageProducts = standalone.COQLQuery(storageProductOfHospital);
if(storageProducts.size() > 0)
{
	storageProducts = storageProducts.toList();
	//info storageProductOfHospital;
	productDetails = zoho.crm.getRecordById("Products",storageProducts.get(0).get("id"));
	billableProductDetails = zoho.crm.getRecordById("Products","6503357000019249158");
	productMap = Map();
	// 			productMap.put("Product_Name",productDetails.get("id"));
	productMap.put("Product_Name","6503357000019249158");
	productMap.put("Quantity",extraStorageDaysForAutopsy);
	productMap.put("List_Price",productDetails.get("Unit_Price"));
	lineAmount = productMap.get("Quantity") * productMap.get("List_Price");
	taxList = billableProductDetails.get("Tax");
```
Replace with:
```deluge
storageFamilyProductOfHospital = "select Product_Name from Products where Product_of_This_Hospital = '" + recordInfo.get("Selected_Hospital").get("id") + "' and Product_Category = 'Storage - Family'";
storageFamilyProducts = standalone.COQLQuery(storageFamilyProductOfHospital);
if(storageFamilyProducts.size() > 0)
{
	storageFamilyProducts = storageFamilyProducts.toList();
	billableProductDetails = zoho.crm.getRecordById("Products",storageFamilyProducts.get(0).get("id"));
}
else
{
	billableProductDetails = zoho.crm.getRecordById("Products","6503357000019249158");
}
productMap = Map();
productMap.put("Product_Name",billableProductDetails.get("id"));
productMap.put("Quantity",extraStorageDaysForAutopsy);
productMap.put("List_Price",billableProductDetails.get("Unit_Price"));
lineAmount = productMap.get("Quantity") * productMap.get("List_Price");
taxList = billableProductDetails.get("Tax");
```
Note this drops the now-unused `productDetails` (the `'Storage'`-category lookup) entirely
from this block -- it was only ever used for `Unit_Price` in the old buggy version, and the
new version prices off the correct `Storage - Family` product instead. The `else` branch
(no `Selected_Hospital`) is unchanged -- it already only uses the hardcoded fallback, which
is now consistent with the "no hospital-specific family product tagged yet" fallback above.

---

## Test plan

1. **Part A -- Transfer/Reschedule/Decomp**: before tagging any new categories, confirm a
   Police Deal with `Condition = Decomposed` still bills the same Decomp fee product as
   today (fallback path). Then tag a *different* test product with `Product_Category =
   'Decomp Fee'` under the Police parent and re-trigger -- confirm the new product bills
   instead, with no code change. Repeat for Transfer and Autopsy Reschedule trip types.
2. **Part B -- Reschedule/X-ray**: trigger a driver-app "Autopsy not done" reschedule --
   confirm the Reschedule Trip fee still bills correctly (fallback path, no category tagged
   yet). Then tag a test product `Product_Category = 'Reschedule Trip'` and re-trigger --
   confirm it swaps with no code change. Separately trigger an X-ray reschedule and confirm
   it independently resolves via `'X-ray Trip'` category (currently falls back to the same
   product as before, by design, until the real X-ray product is chosen).
3. **Part C -- Hospital Release Family Bill**: trigger on a hospital Deal with `DFH not
   selected` and a release-date gap, no `Storage - Family` product tagged for that hospital
   yet -- confirm it still bills the same fallback product/price as before (no regression).
   Then tag a hospital-specific `Storage - Family` product and re-trigger -- confirm the
   invoice now bills that product, at that product's own price and tax, instead of the
   previous hardcoded/mismatched combination.
4. Cross-check invoice totals before/after for a few live-like test Deals to confirm no
   accidental price/tax change slipped in in the fallback (unchanged) path -- the fallback
   branches are written to reproduce today's exact behavior byte-for-byte.

## Explicitly not touched in this pass

- Invoice naming (IFSL/MNSJ/hospital-name/Family Transfer wording) -- separate work, still
  blocked on the MNSJ split decision per yesterday's code map.
- The MNSJ 2-day split itself -- confirmed net-new development, not a linking conversion.
- The rename-retention field and reschedule Task removal -- separate, already-scoped items
  from yesterday's code map, not touched here.
- X-ray's actual billing product -- still Andrea/Shirley's decision; Part B only makes that
  decision a one-field relink instead of a code change once they decide.
