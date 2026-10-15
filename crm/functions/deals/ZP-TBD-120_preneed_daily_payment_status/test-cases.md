# ZP-TBD-120 - Daily job sets Pre-Need Past due - tests

## Test data (set up first)

| What | Where | Enter / check |
|---|---|---|
| Deal A - test Pre-Need Deal, part paid | Any 'DFH Test' Pre-Need Deal with the Deposit paid, instalments not paid | Payment Status pill shows 'Payments in progress'. |
| Deal B - test Pre-Need Deal, paid in full | Any 'DFH Test' Pre-Need Deal fully paid | Payment Status pill shows 'Paid in full'. |
| How to run the job now | Setup > Automation > Schedules > Daily Pre-Need Payment Status > edit the function > Save & Execute | Same as the 06:00 run. |

## Tests

| Step | Where | Do this | You should see | Pass / Fail |
|---|---|---|---|---|
| 1 | Deal A | Set 'Pre-Need Balance Due Date' to YESTERDAY. Save. Check the pill: it does not change yet. | Payment Status still 'Payments in progress' (no payment, so nothing fired). |  |
| 2 | The schedule | Run the job now. | Log ends with 'ZP-TBD-120 done: ... open Pre-Need Deals ...'. |  |
| 3 | Deal A > Pre-Need screen | Refresh. | Payment Status pill = Past due (check the colour). |  |
| 4 | Deal A's retainer in Books | Open it. | Notes show today's '(Updated ...)' date; any instalment whose due date has passed says OVERDUE. |  |
| 5 | Deal B > Pre-Need screen | Refresh. | Still 'Paid in full' (not touched). |  |
| 6 | Deal A | Put the Balance Due Date back to a future date. Run the job again. | Payment Status returns to 'Payments in progress'. |  |
| 7 | Setup > Automation > Schedules | The morning after deployment, open the schedule's history. | It ran at 06:00 with no error. |  |
