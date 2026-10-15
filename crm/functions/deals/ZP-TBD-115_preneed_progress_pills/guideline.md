# ZP-TBD-115 -- Pre-Need progress pills (tickets 1-3 of PRENEED_DEV_LIST_2026-10-14)

Live code pulled 2026-10-15. Apply in any order; each step is independent.

---

## Ticket 1 -- "Payment Plan Set Up" goes green when the plan's invoices are created

### 1a -- new function
CRM > Setup > Developer Hub > Functions > + New Function
- Name `markPaymentPlanSetUp` (API name `markpaymentplansetup`), category **Automation**
- Argument: `crmid` (Int)
- Body: `markPaymentPlanSetUp_NEW.deluge`. Save.

### 1b -- new workflow rule
CRM > Setup > Automation > Workflow Rules > Invoices > + Create Rule
- Name: **Pre-Need - Payment Plan Set Up**
- When: **On a record action > Create**
- Condition: **Invoice For** is any of **Deposit, Installment 1, Installment 2, Installment 3, Other**
- Instant action: **Function** > `markPaymentPlanSetUp`, argument `crmid` = **Invoices > Invoice Id**
- Save.

Why a function and not a plain field update: "Other" is also the type of every ordinary funeral invoice, so the
function checks the Deal is a Pre-Need Deal before setting the pill. It only ever sets Yes.

---

## Ticket 2 -- "Invoice(s) Sent" goes green when the first invoice is sent

### 2a -- `markInvoiceSent` (API name `markinvoicesent`)
Replace the whole body with `markInvoiceSent_UPDATED.deluge`. Save.
New: after marking the invoice Sent, a Pre-Need Deal gets `Invoice_s_Sent = Yes` (only set, never cleared).

### 2b -- `ButtonSendEmailForPaymentByPotentialPayers` (API name `buttonsendemailforpaymentbypotentialpayers`)
So that a **Lump Sum** invoice sent by email also turns the pill green.

FIND:
```
if(isPreNeedPlanInvoice)
{
	info standalone.markInvoiceSent(recordInfo.get("Invoice").get("id").toString());
```
REPLACE WITH:
```
// ZP-TBD-115: any invoice on a Pre-Need Deal (incl. the Lump Sum one) goes through markInvoiceSent, which also
// sets the Deal's "Invoice(s) Sent" pill. It never overwrites Paid / Partially Paid / Overdue.
if(isPreNeedPlanInvoice || ifnull(dealInfo.get("Type"),"") == "Pre Need")
{
	info standalone.markInvoiceSent(recordInfo.get("Invoice").get("id").toString());
```
Save.

WhatsApp: **no change needed.** The Pre-Need screen's invoice list is the related-list widget **PN Invoices**
(`PN_Invoices`, Dale's, v10 of 2026-10-02). Its per-invoice WhatsApp button builds the link and opens a send panel;
clicking **Open WhatsApp** in that panel calls its own `markInvoicesSent()`, which writes `Invoice_s_Sent = Yes` on
the Deal (Trigger []). Its Email button does the same after the email function succeeds. Confirmed working
2026-10-15 on test Deal "DFH Test Test 1015202603" -- the pill turns green only after **Open WhatsApp**, not on the
first WhatsApp click. Note: that widget does not mark the invoice itself Sent (only the Deal pill) -- per-invoice
status is ticket 5.

Why not Andrea's suggested "Status = Sent" rule on Invoices: `markInvoiceSent` (and the email button) save the
invoice without firing workflows, so a rule watching Status would never run.

---

## Ticket 3 -- "Contract Status" shows Sent when the contract goes out

Same patch in both contract-send functions. Every send path uses one of them: the Send Pre Need Funeral Contract
button and the automatic send use `sendPreNeedFuneralContractEmail`; the WhatsApp "Add contract link" uses
`sendPreNeedFuneralContractEmbedded`. (The old 2025 Writer send, `sendPreNeedContract`, set Sent; the line was
not carried over when the send moved -- that is why Sent never appears.)

### 3a -- `sendPreNeedFuneralContractEmail` (API name `sendpreneedfuneralcontractemail`)
### 3b -- `sendPreNeedFuneralContractEmbedded` (API name `sendpreneedfuneralcontractembedded`)

In EACH, FIND (appears once, near the end):
```
zoho.crm.updateRecord("Deals",crmid.toLong(),stampMap);
```
REPLACE WITH:
```
// ZP-TBD-115 (ticket 3): the contract is out -> Contract Status "Sent", but only while it is still blank. Never
// overwrite "Signed" (e.g. the Full contract going out after the 1-page one was signed). No workflow trigger.
currentContractStatus = ifnull(recordInfo.get("Contract_Status"),"").toString();
if(currentContractStatus == "" || currentContractStatus == "-None-")
{
	stampMap.put("Contract_Status","Sent");
}
zoho.crm.updateRecord("Deals",crmid.toLong(),stampMap);
```
Save. (`zoho.crm.updateRecord` without a 4th argument fires no workflows -- the same as `{"trigger":{}}`.)

---

## Rollback
- Ticket 1: deactivate the rule.
- Ticket 2: paste `rollback/markInvoiceSent_LIVE_2026-10-15.deluge`; put the 2b FIND text back.
- Ticket 3: put the FIND line back in both functions.

## Test
`widgets\testCases\ZP-TBD-115_PreNeed_Progress_Pills_Test_Journeys.xlsx` -- check the pill colours on the
Pre-Need canvas screen at each step, not just the field values.
