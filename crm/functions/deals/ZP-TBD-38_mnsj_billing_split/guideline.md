# ZP-TBD-38 — MNSJ 2-day overflow billing split

Depends on [[ZP-TBD-37]] (MNSJ Account must exist first -- run that script and paste the
resulting Account id everywhere below marked `<MNSJ_ACCOUNT_ID_HERE>`).

Implements the rule from `PH_Billing process and Workflows.docx`: *"Government pays
storage up to 2 days -> IFSL invoice; the days beyond 2 are not eaten and not billed to the
family -> separate invoice to MNSJ. Example: held 5 days -> IFSL gets 2, MNSJ gets 3."*

Live-verified 2026-08-20 against `automation.StorageFeebasedonLetterofNoInterestWorkflow`
(id `6503357000003302110`) -- pulled fresh this session, confirms the P-1 2-day cap is
live exactly as documented (`if(extraStorageDaysForAutopsy > 2){
extraStorageDaysForAutopsy = 2; }`), so this guideline adds the MNSJ overflow billing
alongside it without touching the existing IFSL logic at all.

## Setup (do this first, in Zoho CRM Setup -- not code)

1. **Sales_Orders module > `Sales_Order_Type` picklist:** add a new value,
   `"Police Cases - MNSJ"`. Keeping it a distinct value (not reusing `"Police Cases"`) is
   what lets every existing `where Sales_Order_Type = 'Police Cases' limit 1` COQL query
   elsewhere in the codebase keep matching only the IFSL Sales Order -- the MNSJ one is
   invisible to all that existing code by construction.
2. **Invoices module > `Invoice_For` picklist:** add a new value, `"MNSJ"` (alongside the
   existing `Police`/`Hospital`/`Family`).

## Code change 1 — bill the MNSJ overflow

`automation.StorageFeebasedonLetterofNoInterestWorkflow` (id `6503357000003302110`)

Find (the very end of the `if(salesOrders.size() > 0)` block, right after the existing
IFSL invoice call):
```deluge
	if(!isNull(recordInfo.get("Account_Name")))
	{
		standalone.createInvoiceBasedOnSalesOrderForPolice(crmid);
	}
}
}
```
Replace with:
```deluge
	if(!isNull(recordInfo.get("Account_Name")))
	{
		standalone.createInvoiceBasedOnSalesOrderForPolice(crmid);
	}
	// ===== MNSJ overflow billing (ZP-TBD-38) =====
	// Government (IFSL) only covers the first 2 storage days; any additional days beyond
	// that are NOT eaten by DFH and are NOT billed to the family -- they go to MNSJ as a
	// separate invoice. Recompute the UNCAPPED day count to know how many days are left
	// over after the 2-day IFSL cap above.
	totalStorageDaysUncapped = 0;
	try
	{
		totalStorageDaysUncapped = recordInfo.get("Initial_Trip_Completed_At").days360(recordInfo.get("Letter_of_No_Interest_Date"));
		totalStorageDaysUncapped = totalStorageDaysUncapped + 1;
	}
	catch (eUncapped)
	{
		totalStorageDaysUncapped = 0;
	}
	mnsjDays = totalStorageDaysUncapped - 2;
	if(mnsjDays > 0)
	{
		mnsjAccountId = "<MNSJ_ACCOUNT_ID_HERE>";
		mnsjSalesOrders = standalone.COQLQuery("select Subject from Sales_Orders where Deal_Name = '" + crmid + "' and Sales_Order_Type = 'Police Cases - MNSJ' limit 1");
		mnsjProductDetails = zoho.crm.getRecordById("Products","6503357000002869275");
		// same Storage Fee product used for the IFSL side -- Andrea's spec doesn't call
		// for a different product, only a different payer/invoice
		mnsjLineItemList = list();
		mnsjProductMap = Map();
		mnsjProductMap.put("Product_Name",mnsjProductDetails.get("id"));
		mnsjProductMap.put("Quantity",mnsjDays);
		mnsjProductMap.put("List_Price",mnsjProductDetails.get("Unit_Price"));
		mnsjLineItemList.add(mnsjProductMap);
		mnsjSoMap = Map();
		mnsjSoMap.put("Ordered_Items",mnsjLineItemList);
		if(mnsjSalesOrders.size() == 0)
		{
			mnsjSoMap.put("Subject",ifnull(recordInfo.get("Deal_Name"),"") + "-" + ifnull(recordInfo.get("Name_of_Deceased"),"") + "-MNSJ");
			mnsjSoMap.put("Sales_Order_Type","Police Cases - MNSJ");
			mnsjSoMap.put("Deal_Name",crmid);
			mnsjSoMap.put("Account_Name",mnsjAccountId);
			mnsjSoMap.put("Parent_Account",mnsjAccountId);
			mnsjRecordList = list();
			mnsjRecordList.add(mnsjSoMap);
			mnsjDataMap = Map();
			mnsjDataMap.put("data",mnsjRecordList);
			createMnsjSO = invokeurl
			[
				url :"https://www.zohoapis.com/crm/v2.1/Sales_Orders"
				type :POST
				parameters:mnsjDataMap.toString()
				connection:"zohooauth"
			];
			info createMnsjSO;
		}
		else
		{
			mnsjRecordList = list();
			mnsjRecordList.add(mnsjSoMap);
			mnsjDataMap = Map();
			mnsjDataMap.put("data",mnsjRecordList);
			updateMnsjSO = invokeurl
			[
				url :"https://www.zohoapis.com/crm/v2.1/Sales_Orders/" + mnsjSalesOrders.toList().get(0).get("id")
				type :PUT
				parameters:mnsjDataMap.toString()
				connection:"zohooauth"
			];
			info updateMnsjSO;
		}
		standalone.createInvoiceBasedOnSalesOrderForMNSJ(crmid);
	}
}
}
```

## Code change 2 — new function: `standalone.createInvoiceBasedOnSalesOrderForMNSJ`

New function, cloned from `standalone.createInvoiceBasedOnSalesOrderForPolice` (id
`6503357000003727101`) with the Sales_Order_Type/Invoice_For/Subject swapped for MNSJ.
Everything else (Contact billing address copy, line items from the Sales Order, Potential
Payers creation, Sales Order status update) is identical:

```deluge
string standalone.createInvoiceBasedOnSalesOrderForMNSJ(Int crmid)
{
getRecordInfo = invokeurl
[
	url :"https://www.zohoapis.com/crm/v2.1/Deals/" + crmid
	type :GET
	connection:"zohooauth"
];
recordInfo = getRecordInfo.get("data").get(0);
salesOrders = standalone.COQLQuery("select Subject from Sales_Orders where Deal_Name = '" + crmid + "' and Sales_Order_Type = 'Police Cases - MNSJ' limit 1");
if(salesOrders.size() > 0)
{
	salesOrderDetails = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v7/Sales_Orders/" + salesOrders.toList().get(0).get("id")
		type :GET
		connection:"zohooauth"
	];
	salesOrderInfo = salesOrderDetails.get("data").get(0);
	existingInvoiceList = standalone.COQLQuery("select Subject from Invoices where Deal_Name__s = '" + crmid + "' and Invoice_For = 'MNSJ' limit 1");
	invoiceMap = Map();
	if(!isNull(salesOrderInfo.get("Account_Name")))
	{
		invoiceMap.put("Account_Name",salesOrderInfo.get("Account_Name").get("id"));
	}
	if(!isNull(salesOrderInfo.get("Parent_Account")))
	{
		invoiceMap.put("Parent_Account",salesOrderInfo.get("Parent_Account").get("id"));
	}
	if(!isNull(salesOrderInfo.get("Contact_Name")))
	{
		invoiceMap.put("Contact_Name",salesOrderInfo.get("Contact_Name").get("id"));
		contactInfo = zoho.crm.getRecordById("Contacts",salesOrderInfo.get("Contact_Name").get("id"));
		invoiceMap.put("Billing_City",ifnull(contactInfo.get("Mailing_City"),""));
		invoiceMap.put("Billing_Code",ifnull(contactInfo.get("Mailing_Zip"),""));
		invoiceMap.put("Billing_Country",ifnull(contactInfo.get("Mailing_Country"),""));
		invoiceMap.put("Billing_State",ifnull(contactInfo.get("Mailing_State"),""));
		invoiceMap.put("Billing_Street",ifnull(contactInfo.get("Mailing_Street"),""));
	}
	if(existingInvoiceList.size() == 0)
	{
		invoiceMap.put("Deal_Name__s",crmid);
		invoiceMap.put("Invoice_For","MNSJ");
		invoiceMap.put("Invoice_Date",zoho.currentdate.toString("yyyy-MM-dd"));
		invoiceMap.put("Status","Created");
		invoiceMap.put("Subject","MNSJ Police Storage - " + ifnull(salesOrderInfo.get("Subject"),""));
	}
	if(!isNull(recordInfo.get("Letter_of_No_Interest_Date")))
	{
		invoiceMap.put("Due_Date",recordInfo.get("Letter_of_No_Interest_Date"));
	}
	lineItemList = list();
	for each  product in salesOrderInfo.get("Ordered_Items")
	{
		productMap = Map();
		if(!isNull(product.get("Parent_Product")))
		{
			productMap.put("Parent_Product",product.get("Parent_Product").get("id"));
		}
		productMap.put("Product_Name",product.get("Product_Name").get("id"));
		productMap.put("Quantity",product.get("Quantity"));
		productMap.put("List_Price",product.get("List_Price"));
		productMap.put("Discount",ifnull(product.get("Discount"),0));
		productMap.put("Tax",ifnull(product.get("Tax"),0));
		productMap.put("Line_Tax",ifnull(product.get("Line_Tax"),list()));
		lineItemList.add(productMap);
	}
	invoiceMap.put("Invoiced_Items",lineItemList);
	recordList = list();
	recordList.add(invoiceMap);
	dataMap = Map();
	dataMap.put("data",recordList);
	if(existingInvoiceList.size() == 0)
	{
		createInvoice = invokeurl
		[
			url :"https://www.zohoapis.com/crm/v2.1/Invoices"
			type :POST
			parameters:dataMap.toString()
			connection:"zohooauth"
		];
		if(createInvoice.get("data").get(0).get("code") == "SUCCESS")
		{
			createdInvoiceId = createInvoice.get("data").get(0).get("details").get("id");
			createdInvoiceDetails = zoho.crm.getRecordById("Invoices",createdInvoiceId);
			accountID = createdInvoiceDetails.get("Account_Name").get("id");
			relatedContacts = zoho.crm.getRelatedRecords("Contacts","Accounts",accountID);
			for each  contact in relatedContacts
			{
				potentialPayers = Map();
				potentialPayers.put("Name",ifnull(contact.get("First_Name"),"") + " " + contact.get("Last_Name"));
				potentialPayers.put("Account",accountID);
				potentialPayers.put("Invoice",createInvoice.get("data").get(0).get("details").get("id"));
				potentialPayers.put("Contact",contact.get("id"));
				createPotentialPayerResult = zoho.crm.createRecord("Potential_Payers",potentialPayers);
			}
		}
	}
	else
	{
		updateInvoice = invokeurl
		[
			url :"https://www.zohoapis.com/crm/v2.1/Invoices/" + existingInvoiceList.toList().get(0).get("id")
			type :PUT
			parameters:dataMap.toString()
			connection:"zohooauth"
		];
	}
	salesOrderMap = Map();
	salesOrderMap.put("Status","Approved");
	zoho.crm.updateRecord("Sales_Orders",salesOrders.toList().get(0).get("id"),salesOrderMap);
}
return "";
}
```

## Why this design

- **Same Storage Fee product on both sides** (`6503357000002869275`) -- Andrea's spec
  distinguishes IFSL vs MNSJ by *payer/invoice*, not by product, so no new product is
  needed. If she later wants a distinct MNSJ-branded product, that's a Products-module
  relink following the same linking pattern from [[ZP-TBD-33]], not a code change.
- **A new `Sales_Order_Type` value** rather than reusing `'Police Cases'` with a different
  Account -- keeps every existing `limit 1` COQL query elsewhere in the codebase (there are
  several) safely matching only the original IFSL Sales Order, with zero risk of an
  ambiguous "which of the two Police Cases SOs did this pick" bug.
- **Uncapped day count recomputed independently** rather than reusing
  `extraStorageDaysForAutopsy` after the cap -- the IFSL side needs the capped number, the
  MNSJ side needs "everything past the cap," so both are derived from the same underlying
  `days360(...)+1` calculation but used differently.

## Test

1. On a test Police Deal, set `Initial_Trip_Completed_At` and a `Letter_of_No_Interest_Date`
   5 days later (matching Andrea's own example). Confirm: the IFSL Sales Order/invoice
   bills exactly 2 days of Storage Fee (unchanged from before), and a new MNSJ Sales
   Order/invoice is created billing exactly 3 days of the same product, addressed to the
   MNSJ Account.
2. Set the gap to exactly 2 days -- confirm NO MNSJ Sales Order/invoice gets created
   (`mnsjDays` = 0, block skipped entirely).
3. Set the gap to 1 day -- confirm the IFSL side bills 1 day (unchanged prior behavior)
   and still no MNSJ invoice.
4. Re-trigger on the same 5-day-gap Deal a second time (e.g. re-save the field) -- confirm
   it updates the existing MNSJ Sales Order/invoice in place rather than creating a
   duplicate.
5. Confirm the MNSJ invoice's Subject reads `"MNSJ Police Storage - <original SO subject>"`
   per [[ZP-TBD-34]]'s naming work, now unblocked by this guideline.
