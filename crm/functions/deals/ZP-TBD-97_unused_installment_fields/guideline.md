# ZP-TBD-97 -- Remove the 3 unused instalment fields

Deleting a field deletes its data for good. Do it only after Andrea has agreed.

## Before you start

1. Make sure nothing on Andrea's Pre-Need screen shows these fields (the ticket says none do).
2. Export the 3 fields for the few Deals that have a value, as a record of what was there:
   Deals list view -> filter "Number of Installments is not empty" (and the same for the other two) -> export.

## Delete (Setup > Modules and Fields > Deals > Fields)

For each field, in this order:
1. `Number_of_Installments`
2. `Installment_Commencement_Date`
3. `Installment_Day_of_Month`

Click the field's menu > **Delete**. If Zoho lists a layout rule, workflow, report, custom view or validation rule
that still uses the field, remove the field from that item first, then delete the field.

## Keep, but hide

`Create_Installment_Invoice_1` and `Create_Installment_Invoice_2`: leave them (the system writes a log into them),
but take them off the Deal layouts so staff don't see them.

`Create_Installment_Invoice_3`: decide together with PN-06 (Instalment 3).

## Check

Create a new Pre-Need Deal, set Payment Type = Installments, and confirm the deposit and both installment invoices
are created as normal.
