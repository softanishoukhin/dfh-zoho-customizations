# ZP-TBD-120 -- Daily job: Pre-Need "Past due" (ticket 4 of PRENEED_DEV_LIST_2026-10-14)

Live code read 2026-10-15. Do the steps in order.

## 1 -- let the job call Andrea's status function
CRM > Setup > Developer Hub > Functions > **WF Update Pre-Need Payment Status** (`wfupdatepreneedpaymentstatus`)
> menu (...) > **REST API** > switch on **OAuth** > Save.
Nothing in the function changes -- this only allows our job to call it (it was "None").

## 2 -- the schedule
CRM > Setup > Automation > **Schedules** > + Create Schedule
- Name: **Daily Pre-Need Payment Status**
- Function: **Writing Function** > paste `dailyPreNeedPaymentStatus_NEW.deluge` (name `dailyPreNeedPaymentStatus`). Save.
- Start: tomorrow, **06:00**, Frequency **Daily**, no end date. Save.

## What it does every morning
For every Pre-Need Deal (Type = Pre Need) whose Payment Status is not "Paid in full":
1. Calls `wfUpdatePreNeedPaymentStatus` -- the same function the Invoices rule calls, so there is one copy of the
   money logic. A Deal whose Balance Due Date has passed and is not paid in full turns **Past due**; it only writes
   when the value changes.
2. Refreshes the plan in the Books retainer's Notes / Reference (ZP-TBD-119), so OVERDUE marks and the next due
   date are current even when no payment comes in.
Deals with no invoices yet are skipped.

## Good to know
- A Pre-Need Deal converted to At-Need keeps its own stage and Payment Status (conversion does not touch it) -- the
  job treats it like any other open Pre-Need Deal, exactly as the Invoices rule already does.
- Run it now (without waiting for 06:00): open the schedule's function > **Save & Execute**. The log ends with
  `ZP-TBD-120 done: N open Pre-Need Deals, N status checks`.
- Rollback: deactivate the schedule. Switch REST API on wfUpdatePreNeedPaymentStatus back to None if wanted.

## Test
`widgets\testCases\ZP-TBD-120_Daily_PreNeed_Past_Due_Tests.xlsx`
