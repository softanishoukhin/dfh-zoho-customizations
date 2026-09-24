# ZP-TBD-77 -- Test cases

Use a Pre-Need test Deal with an installment invoice; temporarily edit Due_Date so the trigger falls on the
next 09:00 run (or run `standalone.sendInstallmentReminder` by hand from Setup > Functions with a real invoice id and the stage under test).

| # | Setup | Expected |
|---|---|---|
| 1 | Unpaid Installment 1 invoice, Due_Date = today + 7 | One email, "Installment Invoice" template, PDF attached |
| 2 | Same invoice, Due_Date = today + 1 | One email, 1-day template |
| 3 | Due_Date = today - 3, unpaid | One email, overdue template |
| 4 | After test 3, check `Next_Overdue_Reminder_At` | Set to about now + 10 days (Jamaica time) |
| 5 | Set `Next_Overdue_Reminder_At` to a few minutes ahead on an unpaid overdue invoice | Rule D fires, one overdue email, field moves +10 days again (**this proves the chain re-arms**; if it does not fire, see guideline note 7) |
| 6 | Invoice Status = Paid, any of the above | No email |
| 7 | Status = Void, then Cancelled | No email |
| 8 | Status = Partially Paid | Email sent |
| 9 | Invoice_For = Family/Police/Deposit | No email (rule criteria + function guard) |
| 10 | Contact has no email | No email, log "no contact email" |
| 11 | Invoice with no Due_Date | No email, log "no Due_Date" |
| 12 | Invoice paid after 7-day email, before 1-day | 1-day and later reminders do not send |
| 13 | Edit Due_Date forward on an unpaid invoice | Reminders follow the new date |
| 14 | Installment invoice created 3 days before due | 7-day reminder skipped (Zoho: past trigger), 1-day still sends |
| 15 | Invoice whose `Amount_in_JMD/USD` are blank or stale (e.g. after a partial payment) | Refresh runs first; email pay buttons show the current Books balance, not the old value |
| 16 | Click the JMD and USD buttons in a received reminder | URL has `amount=<balance>` and `custom_reference=<Potential Payer id of the invoice's contact>` |
| 17 | Account with 2 contacts (2 Potential Payers on the invoice), invoice Contact_Name = the second | Link carries the second payer's id, not the first |
| 18 | Invoice contact has no Potential Payer for that invoice | No email, log "no Potential Payer found" |
| 19 | Books balance 0 but CRM Status not yet synced to Paid | No email, log "Books balance is 0" |
| 20 | Run within 2 minutes of an invoice sync to Books | No email, log "amount refresh failed ... being synced" |
| 21 | Same as 5 but write the field via the function (not by hand) and wait for rule D | Rule D still fires -- confirms `updateRecord` alone re-schedules a date-based rule |
| 22 | Invoice becomes Paid while `Next_Overdue_Reminder_At` is still in the future | Rule D does not execute, no email, chain ends |
| 23 | Overdue chain running, then Due_Date moved forward 30 days | Next rule D run: no email, field cleared; after new Due_Date + 3 days rule C sends and restarts the chain |
| 24 | Refresh fails (run inside the Books-sync window) at stage `OVERDUE` | No email, field set to about tomorrow |
| 25 | Standalone function with template IDs still `0` | No email, log "template id ... not configured" |
| 26 | Each of the 4 wrappers run by hand on the same unpaid invoice | A -> 7-day template, B -> 1-day template, C and D -> overdue template (C/D also set the next-reminder field) |
| 27 | Rules A-D each use a different wrapper | All four save and run without a "function already used" conflict |
