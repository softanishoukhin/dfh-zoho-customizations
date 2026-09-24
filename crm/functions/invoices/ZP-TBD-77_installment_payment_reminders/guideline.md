# ZP-TBD-77 -- Installment payment reminders: apply guideline

Nothing here is applied to live CRM yet. Order matters: field -> templates -> standalone function -> 4 wrapper functions -> workflow rules.

## 0. Create 1 field on Invoices

Setup > Modules and Fields > Invoices > add a **Date/Time** field: label `Next Overdue Reminder At`, API name
`Next_Overdue_Reminder_At`. Zoho date-based rules cannot recur (the Recur dropdown only offers Once / Every Month /
Every Year), so the "every 10 days" is driven by this field: the function moves it 10 days forward after each overdue
reminder and rule D fires on it. Nobody edits it by hand; it can sit in a read-only/internal section of the layout.
Written in the org's standard form: `zoho.currenttime.addDay(10).toString("yyyy-MM-dd'T'HH:mm:ss","America/Jamaica")`.

## 1. Create 3 Email Templates -- in the **Potential Payers** module, cloned from "Invoice Notification"

The pay links need the Potential Payer's id as `custom_reference` (Fygaro uses it to match the payment back to
the payer), so these templates must belong to the **Potential_Payers** module, exactly like the existing
"Invoice Notification" template (`6503357000019017359`). Clone that template three times (Setup > Templates >
Email > Potential Payers > Invoice Notification > Clone) and change only the subject and the intro paragraph.
**Keep the two pay buttons untouched:**

```
https://www.fygaro.com/en/pb/fcc1b731-0deb-4893-a8e8-92c3e90a913e?amount=${!Potential_Payers.Invoice.Amount_in_JMD}&custom_reference=${!Potential_Payers.id}
https://www.fygaro.com/en/pb/3d8fef8a-2e68-436f-9fb5-2f2783253bdb?amount=${!Potential_Payers.Invoice.Amount_in_USD}&custom_reference=${!Potential_Payers.id}
```

| Clone name | Used by | Suggested subject | Intro paragraph |
|---|---|---|---|
| Installment Invoice - 7 Days Before | Rule A | `Installment invoice ${!Potential_Payers.Invoice.Books_Invoice_Number} - due ${!Potential_Payers.Invoice.Due_Date}` | Your installment invoice is shown below and is due on the date shown. |
| Installment Reminder - 1 Day Before | Rule B | `Reminder: invoice ${!Potential_Payers.Invoice.Books_Invoice_Number} is due tomorrow` | A friendly reminder that your installment is due tomorrow. |
| Installment Overdue Reminder | Rules C + D | `Overdue: invoice ${!Potential_Payers.Invoice.Books_Invoice_Number} was due ${!Potential_Payers.Invoice.Due_Date}` | Our records show this installment is now past due... |

The existing "Thank you for reaching out regarding payment options..." opening reads as a reply to an enquiry, so
replace it in all three. Bank-transfer attachments and the rest of the template can stay as they are.

Note the 3 template IDs (open the template, the ID is in the URL). They are pasted into the standalone function in step 2.

**Trade-off to be aware of:** because the mail is sent from the Potential Payer record, the Invoice PDF is not
auto-attached (that only works when sending from the Invoices module -- the reason `standalone.sendEmail` only
adds `inventory_details` for `Invoices`). The email body shows invoice number, date, due date and amount, plus the
pay buttons and bank details.

## 2. Create the functions (1 standalone + 4 workflow wrappers)

A workflow can't reuse one function with different parameters, so the logic lives in one **standalone** function and
each rule gets its own tiny **workflow** function that just calls it with a fixed stage.

**2a. Standalone** -- Setup > Developer Space > Functions > New > **Standalone**, Deluge. Paste
`sendInstallmentReminder.deluge`. API name `sendInstallmentReminder`
(signature `string standalone.sendInstallmentReminder(int crmid, String stage)`).
Fill in the three template IDs from step 1 in the CONFIG block at the top (`templateBefore7`, `templateBefore1`,
`templateOverdue`). They are `0` in the repo file; while `0` the function refuses to send and logs it, so it can't
mail anything by accident. The template IDs live only here, so a template swap is a one-place edit.

**2b. Four wrappers** -- New > **Workflow** category, module **Invoices**, Deluge, one argument `crmid`. Paste one file each:

| File | API name | Calls stage | Used by |
|---|---|---|---|
| `wrapper_A_7DaysBefore.deluge` | `sendInstallmentReminder7DaysBefore` | `BEFORE_7` | Rule A |
| `wrapper_B_1DayBefore.deluge` | `sendInstallmentReminder1DayBefore` | `BEFORE_1` | Rule B |
| `wrapper_C_3DaysOverdue.deluge` | `sendInstallmentReminder3DaysOverdue` | `OVERDUE` | Rule C |
| `wrapper_D_RepeatOverdue.deluge` | `sendInstallmentReminderRepeatOverdue` | `OVERDUE` | Rule D |

C and D pass the same stage but are separate wrappers on purpose, so no workflow function is shared between rules.
This is the same pattern as the existing `automation.sendInvoiceEmailToNOK` -> `standalone.sendEmail`.

What the function does, in order: (0) pick the template from the stage; (1) re-check the invoice is unpaid, an installment and has a due date, and read the invoice's contact and that
contact's email itself (so no email merge field is needed in the rules); (2) for `OVERDUE`, skip and clear the chain
if the invoice is not yet 3 days past due; (3) find the invoice's Contact, then that contact's
Potential Payer **for this invoice** (`select Name from Potential_Payers where Contact = <invoice contact> and
Invoice = <invoice>`); (4) call `standalone.refreshInvoiceAmountsForPotentialPayer(payerId)` so
`Amount_in_JMD` / `Amount_in_USD` hold today's Books balance (they are otherwise blank until someone presses
"Send Invoice for Payment", and stale after a partial payment) -- if that fails or the balance is 0 nothing is
sent; (5) `standalone.sendEmail(contactEmail, templateId, "Potential_Payers", payerId)`.

Dependencies, all already live: `standalone.COQLQuery`, `standalone.refreshInvoiceAmountsForPotentialPayer`
(ZP-TBD-72), `standalone.sendEmail` (reads `globalFromEmail`; reply-to is the Potential Payer's owner).

## 3. Create 4 date-based Workflow Rules (Setup > Automation > Workflow Rules > Module: Invoices)

All four: **Execute on: Date or Date-Time > Due_Date**, time `09:00` (matches the existing
"Notify to Owner on Overdue" rule), and the **same criteria**:

- `Invoice For` is any of `Installment 1`, `Installment 2`, `Installment 3`
- `Status` is not `Paid`
- `Status` is not `Void`
- `Status` is not `Cancelled`

Action on each: **Instant action > Function > that rule's own wrapper** (table below), with the single argument
`crmid` = `${!Invoices.id}`. Nothing else is passed -- the stage, template and recipient email are all worked out
inside the standalone function.

| Rule name | Execute on | When | Wrapper function |
|---|---|---|---|
| Installment Reminder - 7 Days Before | `Due_Date` | 7 days **before**, Once | `sendInstallmentReminder7DaysBefore` |
| Installment Reminder - 1 Day Before | `Due_Date` | 1 day **before**, Once | `sendInstallmentReminder1DayBefore` |
| Installment Reminder - 3 Days Overdue | `Due_Date` | 3 days **after**, Once | `sendInstallmentReminder3DaysOverdue` |
| Installment Reminder - Every 10 Days Overdue | `Next_Overdue_Reminder_At` | on the field's date/time (0 days after), Once | `sendInstallmentReminderRepeatOverdue` |

Rule D is the same rule you already started ("Installment Reminder - Every 1..."): change *Based on which Date/Time
field* from Due Date to `Next Overdue Reminder At`, set the days to `0` (on the date), Recur stays **Once**. If the UI
asks for an execution time, use `09:00`; the function stamps the field with now + 10 days, so it lands at about the
same time of day anyway.

**How the 10-day chain works.** Rule C (day 3) sends the first overdue reminder and the function writes
`Next_Overdue_Reminder_At` = now + 10 days. That fires rule D on day 13, which sends and writes +10 days again, and so
on. One reminder per 10 days, no matter how the rules are scheduled.

| Situation when a rule fires | Function does | Chain |
|---|---|---|
| Paid / Void / Cancelled | nothing (rule criteria also block it) | ends |
| Books balance is 0 | nothing | ends |
| Email sent | sends, sets field +10 days | continues |
| Amount refresh failed (e.g. Books-sync window) | nothing sent, sets field +1 day | retries tomorrow |
| No contact email / no Potential Payer | nothing sent (logged), sets field +10 days | continues, picks up once fixed |
| Due_Date was moved forward so it is not yet 3 days overdue | nothing, **clears** the field | rule C restarts it after the new date |

Do **not** touch the existing rules: `Notify to Owner on Overdue` (Due_Date +1 business day, creates an
internal Task for the owner -- complementary, sends nothing to the client) and the inactive
`Trigger Invoice Email to NOK`.

## 4. Things to know before testing

1. **Date-based rules never fire for a moment already in the past.** If an installment invoice is created less
   than 7 days before its Due_Date, the 7-day reminder is skipped (and the same for 1 day). This is
   Zoho behaviour, not the function.
2. **If Due_Date is edited** on an invoice, Zoho reschedules the pending actions relative to the new date.
   Reminders already sent are not recalled.
3. **Paid stops everything.** Criteria are re-checked each time a rule fires, and the function re-checks status
   itself, so an invoice paid between reminders gets no more emails. Status is whatever CRM holds -- if a Books
   payment hasn't synced to CRM yet the client can still get a reminder.
4. Reminders go to the email on the invoice's `Contact_Name` contact, using the Potential Payer that belongs to that same
   contact. Nothing is sent (only logged) if the contact has no email, the invoice has no contact, no Potential
   Payer exists for that contact + invoice (Potential Payers are created for the Account's contacts when the
   installment invoice is created -- a contact added to the Account later has none), or the amount refresh fails
   (e.g. inside the 2-minute Books-sync window). Another payer's link is never substituted, because the
   `custom_reference` decides who Fygaro credits.
   Function logs are the only trace of a skipped reminder -- check them during testing.
5. Scope is Installment 1/2/3 invoices only. `Deposit` and the final balance are not covered -- say if wanted.
6. Each reminder makes ~1 COQL call, 3 Books calls (invoice + 2 exchange rates), 1-2 CRM updates and 1 send_mail --
   negligible volume.
7. **Must be verified first (test 21):** the function writes `Next_Overdue_Reminder_At` with a plain
   `zoho.crm.updateRecord`, which does not fire workflow rules by default. Date-based rules should still pick up the
   new value (the existing Sync_To_Books_At / Trigger_Payment_Workflow rules work the same way), but if rule D does
   not fire on the new date, the fallback is to pass `{"trigger":{"workflow"}}` as the 4th argument of those
   `updateRecord` calls. Avoid that unless needed: it also fires every other Invoice edit workflow (e.g. the Books
   sync rules) on each write.
8. Invoices already overdue when this goes live are not picked up (rule C's day-3 moment has passed). Seed them by
   setting `Next_Overdue_Reminder_At` on each one by hand, or ask for a one-off backfill function.

## 5. Rollback

Deactivate the 4 workflow rules (Setup > Workflow Rules > toggle off). The new field and function can stay (harmless
without the rules) or be deleted.
