# ZP-TBD-96 -- PN-04: sending an invoice marks it as Sent

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-10-02 on live source. NOT applied, NOT tested.** Apply per `guideline.md`.

**Source:** `projectDocuments/PRENEED_DEV_TICKETS_2026-10-01.md`, PN-04 -- "When a WhatsApp or email send
completes successfully, set that invoice's Status to Sent." The Invoices `Status` picklist already has "Sent".

## Live facts (2026-10-02)

- **Email** = `button.ButtonSendEmailForPaymentByPotentialPayers` (per Potential Payer). It already marks the Books
  document sent (`/status/sent`) and copies the Books status onto the CRM invoice -- but only when the Books status
  does not contain "paid". Pre-Need plan invoices share ONE Books retainer (ZP-TBD-74), which is `partially_paid`
  from the deposit on -> every installment emailed after the deposit stayed "Created". Before the deposit, it copied
  the retainer's status, not the invoice's own.
- The email itself is sent by `standalone.sendInvoiceNotificationFromCRM`, which returns "" whatever happens (it does
  not report success). It is shared by every invoice type, so it is NOT changed: Sent = the send was made, the same
  moment Books marks its copy sent.
- **WhatsApp** opens WhatsApp with the message prefilled (`whatsappHelper.js`); the actual send happens in WhatsApp,
  so no Zoho code can see it complete. -> the screen calls `markInvoiceSent` when it opens WhatsApp.
- The Deal-level "Send Links via WhatsApp" widget sends the NEWEST invoice's payment link -> not changed (marking
  that invoice Sent would often be the wrong invoice).
- The DPr003 invoices were never in Books until 2026-10-02 (PN-02), so the email button could not have run on them --
  why they all still show "Created".
- Status sync from Books (`syncretainerinvoicestatusbetweencrmandxero`) mirrors the retainer's status onto ONE CRM
  invoice (`cf_crm_invoice_id`, normally the Deposit). Unchanged; it can still set the Deposit to Sent / Partially
  Paid / Paid when the retainer's status changes.

## Rule

Created / Draft / Ready / Approved / blank -> **Sent**. Anything else (Paid, Partially Paid, Overdue, Void,
Cancelled, Delivered, Sent) is left alone. No workflow trigger.

## Files

| File | Purpose |
|---|---|
| `markInvoiceSent_NEW.deluge` | New standalone function (`markinvoicesent`, REST API on) |
| `guideline.md` | Apply steps: function, email-button find/replace (2a, 2b), what the screen calls |
| `test-cases.md` | Tests (xlsx: `widgets\testCases\ZP-TBD-96_Invoice_Marked_Sent_Test_Journeys.xlsx`) |

## Open

- PN-05 (`Invoice_s_Sent` on the Deal) is pending Andrea; once agreed it can be set from `markInvoiceSent`.
- Andrea to wire the screen's WhatsApp button to `markinvoicesent` (Step 3).
