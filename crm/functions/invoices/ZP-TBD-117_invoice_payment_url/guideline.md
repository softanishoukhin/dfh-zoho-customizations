# ZP-TBD-117 -- Payment link saved on the invoice as a field (ticket 10 of PRENEED_DEV_LIST_2026-10-14)

Live code pulled 2026-10-15. Do step 1 FIRST (the functions write the field; saving them before it exists fails).

## 1 -- new field
CRM > Setup > Customization > Modules and Fields > Invoices > Standard layout
- Drag a **URL** field. Label **Payment URL** (API name becomes `Payment_URL`). Save the layout.
- Put it near Amount in JMD / Amount in USD so staff see it.

## 2 -- `refreshInvoiceAmountsForPotentialPayer` (API name `refreshinvoiceamountsforpotentialpayer`)
Feeds the Pre-Need screen WhatsApp button, Generate Payment Link, Send Links via WhatsApp and the instalment reminders.

FIND (inside the try, appears once):
```
	crmInvoiceMap.put("Amount_in_GBP",amountDueInGBP.round(2).toString());
```
REPLACE WITH:
```
	crmInvoiceMap.put("Amount_in_GBP",amountDueInGBP.round(2).toString());
	// ZP-TBD-117: keep the payment link on the invoice itself (Payment_URL), same link the widgets build.
	// Fygaro takes JMD and USD only: a USD Deal gets the USD link, every other Deal the JMD link.
	// custom_reference = this payer, so the payment is matched back to them. Not written when nothing is owed.
	paymentUrl = "";
	if(dealInfo.get("Currency_Used_for_this_Deal") == "USD")
	{
		if(amountDueInUSD > 0)
		{
			paymentUrl = "https://www.fygaro.com/en/pb/3d8fef8a-2e68-436f-9fb5-2f2783253bdb?amount=" + amountDueInUSD.round(2).toString() + "&custom_reference=" + crmid;
		}
	}
	else
	{
		if(amountDueInJMD > 0)
		{
			paymentUrl = "https://www.fygaro.com/en/pb/fcc1b731-0deb-4893-a8e8-92c3e90a913e?amount=" + amountDueInJMD.round(2).toString() + "&custom_reference=" + crmid;
		}
	}
	if(paymentUrl != "")
	{
		crmInvoiceMap.put("Payment_URL",paymentUrl);
	}
```
Save.

## 3 -- `ButtonSendEmailForPaymentByPotentialPayers` (API name `buttonsendemailforpaymentbypotentialpayers`)
The "Send Invoice for Payment" email button (also the Email button on the Pre-Need screen).

FIND (appears once, NOT indented):
```
crmInvoiceMap.put("Amount_in_GBP",amountDueInGBP.round(2).toString());
```
REPLACE WITH the same block as step 2 (indentation does not matter). Save.

## Result
Whenever a payment link is generated or an invoice is sent for payment -- WhatsApp, email, Generate Payment Link,
reminders -- the invoice's **Payment URL** holds that link with the amount currently due. It can be clicked on the
invoice and used in email templates as `${Invoices.Payment URL}`.
- Filled the first time a link is generated; empty before that.
- Each new send refreshes it (new amount after a part payment). The last payer a link was made for is the one in it.
- When nothing is owed it is left as it was (no zero-amount link).

## Rollback
Remove the inserted block from both functions. The field can stay (or be deleted).

## Test
`widgets\testCases\ZP-TBD-117_Invoice_Payment_URL_Tests.xlsx`
