# ZP-TBD-56-3 — Fix self-retrigger loop in `allprocessonpaymentcreateandupdate`

**Source:** third fix from the [[ZP-TBD-56 Xero API call-volume audit]],
item #3 in its prioritized list — corrected after the original diagnosis
didn't survive a live check.

## Correction to the original audit finding

The original audit described item #3 as a race between two functions,
`createpaymentsonxero` and `allprocessonpaymentcreateandupdate`, both firing
independently on the same Customer Payment event. That turned out to be
wrong once checked against live execution history:

- **`createpaymentsonxero`** (function id `5830143000000555584`) has **zero
  executions in the last 3 months** and has no workflow rule attached
  (`related_rules: ""` in the live function list). It is not racing with
  anything — it simply never runs. Its old job (creating the Xero Payment
  for a Customer Payment) is superseded by `createinvoiceonxero`'s own
  direct call to the `iw_create_payments_on_xero` webhook at invoice-creation
  time.
- **The real bug is `allprocessonpaymentcreateandupdate` retriggering
  itself.** Its execution history showed it ran **4 times against the same
  Customer Payment record on the same day** (`entity_id
  5830143000035613032`). It's bound to Books' "On Any Create or Update"
  workflow on Customer Payments (`paymentWorkflowTriggerOnAnyCreateOrUpdate`,
  id `5830143000026196101`), and partway through its own execution it writes
  back to that same payment record several times (`cf_payer_name`,
  `account_id`, `cf_amount_converted`) — each write that actually changes a
  value re-fires the same workflow, re-running the whole function again.
  The worst offender was the `cf_payer_name` write in the
  `populatepayernameoncreateforanalytics` section: it had **no idempotency
  check at all**, unconditionally recomputing and rewriting the payer name
  on every single pass (unlike the currency-conversion section further down,
  which already carries the `alreadyConverted` guard from [[ZP-TBD-55]]).

## Fix applied

Replaced the `//populatepayernameoncreateforanalytics start ... end` block.
Same four name-resolution paths (CRM payer lookup by `cf_payer_unformatted`,
manual fallback via `cf_new_payer_name_if_not_found`, primary contact
person, plain customer name) are preserved exactly, but the name is now
computed once into `finalPayerName` instead of writing immediately in each
branch, and the single write at the end only fires when `finalPayerName`
actually differs from the payment's current `cf_payer_name`:

```deluge
//populatepayernameoncreateforanalytics start
try 
{
	getUrl("https://www.zohoapis.com/creator/custom/delapenhafuneralhome/Sleep_API?publickey=69fNOfX03TwjyaAgAYyRTJSBd&seconds=30");
}
catch (e)
{
	info e;
}
paymentID = customer_payment.get("payment_id");
organizationID = organization.get("organization_id");
try 
{
	payerID = customer_payment.getJSON("custom_field_hash").get("cf_payer_unformatted");
	payerDetails = zoho.crm.getRecordById("Contacts",payerID);
	payerName = payerDetails.get("Full_Name");
}
catch (e)
{
	try 
	{
		payerName = customer_payment.getJSON("custom_field_hash").get("cf_new_payer_name_if_not_found");
	}
	catch (e)
	{
		payerName = null;
	}
}
info customer_payment;
info "payerDetails";
info payerDetails;
finalPayerName = null;
contactPersons = list();
if(!isNull(payerName))
{
	finalPayerName = payerName;
}
else
{
	customerDetails = zoho.books.getRecordsByID("contacts",organizationID,customer_payment.get("customer_id"),"zohobooksconnection");
	try 
	{
		contactPersons = customerDetails.get("contact").get("contact_persons");
		if(contactPersons.size() > 0)
		{
			for each  contactPerson in contactPersons
			{
				if(contactPerson.get("is_primary_contact") == true)
				{
					finalPayerName = contactPerson.get("first_name") + " " + contactPerson.get("last_name");
					break;
				}
			}
		}
		else
		{
			finalPayerName = customer_payment.get("customer_name");
		}
	}
	catch (e)
	{
		finalPayerName = customer_payment.get("customer_name");
	}
}
existingPayerName = ifnull(customer_payment.getJSON("custom_field_hash").get("cf_payer_name"),"");
if(!isNull(finalPayerName) && finalPayerName != existingPayerName)
{
	paymentMap = Map();
	customFieldsList = list();
	fieldMap = Map();
	fieldMap.put("api_name","cf_payer_name");
	fieldMap.put("value",finalPayerName);
	customFieldsList.add(fieldMap);
	paymentMap.put("custom_fields",customFieldsList);
	response = zoho.books.updateRecord("customerpayments",organizationID,paymentID,paymentMap,"zohobooksconnection");
	info response;
}
info "contactPersons";
info contactPersons;
//populatepayernameoncreateforanalytics end
```

**Behavior change: none for what gets stored** — all four name-resolution
paths produce identical results to before. The only change is that the
write is skipped when the computed name already matches, removing the
worst source of this function's self-retrigger cascade.

**Not fully eliminated**: the `account_id` update and the
`cf_amount_converted` stamp elsewhere in the function are each legitimate
one-time writes, so a payment can still legitimately re-enter the function
once or twice as those settle. This fix removes the offender that had zero
guard at all and was rewriting on every single pass.

## Not yet applied — left to developer discretion

**Disable `createpaymentsonxero`** (0 executions in 3 months, no workflow
attached, functionally superseded). No functional risk either way since
nothing calls it today — pure cleanup. Settings → Automation → Custom
Functions → `createpaymentsonxero` → toggle inactive, whenever convenient.

## Status

Part B (self-retrigger fix) applied live 2026-09-04, confirmed by developer.
Part A (disable dead function) not yet actioned.
