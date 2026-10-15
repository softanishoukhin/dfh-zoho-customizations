# ZP-TBD-119 -- Payment plan and next due date on the Books retainer (tickets 6 + 7 of PRENEED_DEV_LIST_2026-10-14)

Live data read 2026-10-15. Do the steps in order.

## What the cashier will see on the retainer
**Notes** (printed on the retainer PDF / email -- Standard Template prints Notes when filled):
```
PAYMENT PLAN - take only the NEXT PAYMENT amount shown below.

Deposit: JMD 375050.03 - due 14 Oct 2026 - PAID
Installment 1: JMD 187525.02 - due 14 Jan 2027 - NOT PAID
Installment 2: JMD 187525.01 - due 14 Apr 2027 - NOT PAID

NEXT PAYMENT: Installment 1 - JMD 187525.02 - due 14 Jan 2027
(Updated 15 Oct 2026)
```
**Reference#**: `Next due 14 Jan 2027 - Installment 1` (or `Paid in full`) -- a column in the Books Retainer Invoices
list, searchable. Books retainers have **no due date field** (not in the API at all), so this is the date to work to.

## 1 -- CRM function `writePreNeedScheduleToRetainer`
CRM > Setup > Developer Hub > Functions > + New Function
- Name `writePreNeedScheduleToRetainer` (API name `writepreneedscheduletoretainer`), category **Standalone**
- Argument `crmid` (String) -- the Deal id. Body: `writePreNeedScheduleToRetainer_NEW.deluge`. Save.
- Function menu (...) > **REST API** > switch on **API Key**. Save.

## 2 -- CRM function `refreshPreNeedRetainerSchedule`
- Name `refreshPreNeedRetainerSchedule`, category **Automation**, argument `crmid` (Int).
- Body: `refreshPreNeedRetainerSchedule_NEW.deluge`. Save.

## 3 -- rule "Pre-Need - Payment Plan Set Up" (Invoices, from ZP-TBD-115)
CRM > Setup > Automation > Workflow Rules > Invoices > **Pre-Need - Payment Plan Set Up** > Edit
- Keep the instant action (markPaymentPlanSetUp).
- **+ Scheduled Action** > **1 Hour(s) after Rule Trigger Time** > Function > `refreshPreNeedRetainerSchedule`,
  `crmid` = **Invoices > Invoice Id**. Save.
(The hour lets the retainer be created in Books first. A plan rebuild re-creates invoices, so it runs again.)

## 4 -- Books: `allprocessonpaymentcreateandupdate` (after every payment)
In the `for each dealIdToCheck in contractDealIds` loop, directly AFTER the ZP-TBD-118 lines
(`info "ZP-TBD-118 invoice statuses for Deal " ...;`), add:
```
		// ZP-TBD-119: the plan and the next payment are written into the retainer's Notes / Reference
		scheduleResult = invokeurl
		[
			url :"https://www.zohoapis.com/crm/v7/functions/writepreneedscheduletoretainer/actions/execute?auth_type=apikey&zapikey=ZAPIKEY&crmid=" + dealIdToCheck
			type :GET
		];
		info "ZP-TBD-119 retainer schedule for Deal " + dealIdToCheck + ": " + scheduleResult;
```
`ZAPIKEY` = the same key as in the two calls around it. Save. (It runs after the ZP-TBD-118 status call, so the
Paid / Not paid lines are already up to date.)

## 5 -- existing Pre-Need Deals (one-off)
For each open Pre-Need Deal (and Andrea's "Dale testing"): Setup > Functions > writePreNeedScheduleToRetainer >
**Save & Execute** with `crmid` = the Deal id. Then open its retainer in Books: Notes and Reference are filled.

## 6 -- confirm on paper (Andrea's question)
Open the retainer in Books > **PDF/Print** and **Send** preview: the Notes block must show at the bottom. If it does
not, Books > Settings > Templates > Retainer Invoices > Standard Template > Edit > make sure **Notes** is ticked.

## Notes
- The OVERDUE marks and "Updated" date refresh on every payment. Ticket 4's daily job will also call this function
  so they stay current between payments.
- Top-up retainers ("Pre-Need top-up of RET-...") keep their own note.
- Rollback: remove the scheduled action and the Books lines; clear Notes / Reference by hand if wanted.

## Test
`widgets\testCases\ZP-TBD-119_Retainer_Payment_Plan_Tests.xlsx`
