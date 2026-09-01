# ZP-TBD-51 — Outstanding MP Invoices Dashboard

**Source:** follow-up ask from Andrea after ZP-TBD-50 (MP Commitment Split
Invoicing). Wants a Zoho Books dashboard widget listing every unpaid MP
invoice: Deceased Name, Funeral Date, MP Commitment Amount, MP Commitment
Letter Date.

## The linking problem

MP Commitment Amount/Letter Date live on the **deceased/family's** Contact
record (by Andrea's own rule in ZP-TBD-50 — never on an invoice). The invoice
that needs an "is it paid?" check is the **MP's own invoice**, billed to a
different Contact entirely. Nothing structurally linked "this MP invoice" to
"this deceased case."

**Fix — reuse an existing field, no new one added:** Invoices already carry
a **"DECEASED NAME"** custom field (discovered in ZP-TBD-49, used for the
Funeral GCT Report). SOP amended (see ZP-TBD-50 addendum) so the cashier
fills this in on the MP's invoice too when creating it. That gives a
reliable, structured match back to the deceased's Contact record by name.

## Why this is an Analytics report, not a native Books widget

A native Zoho Books dashboard widget only lists one module with simple
filters — it can't join Invoices + the deceased Contact's custom fields +
the CRM Deal's Funeral Date. This reuses the same **Zoho Books Analytics**
workspace and **"CRM Deals (Funeral Date)"** synced table already built for
ZP-TBD-49, then gets embedded into the Books Dashboard as an Analytics
report widget.

## Step 1 — Query Table: "Outstanding MP Invoices"

Confirmed live column list for the "Customers" table (Zoho Books Analytics
workspace) includes the two new custom fields already synced (no refresh
needed): `Customer ID, Customer Name, Display Name, Email, Status, Created
Time, Company Name, First Name, Last Name, Last Modified Time, CRM Reference
ID, Taxable, MP Commitment Letter Date, MP Commitment Amount, Pledge-MP,
Pledge-MPID, Commitment Status, Commitment StatusID`.

```sql
SELECT
    inv."Invoice Number" AS "Invoice Number",
    inv."DECEASED NAME" AS "Deceased Name",
    d."Funeral Date and Time" AS "Funeral Date",
    fam."MP Commitment Amount" AS "MP Commitment Amount",
    fam."MP Commitment Letter Date" AS "MP Commitment Letter Date",
    inv."Balance (BCY)" AS "Balance"
FROM "Invoices" inv
INNER JOIN "Customers" mp ON inv."Customer ID" = mp."Customer ID"
INNER JOIN "Customers" fam ON inv."DECEASED NAME" = fam."Customer Name"
LEFT JOIN "CRM Deals (Funeral Date)" d ON inv."Related CRM Deal ID" = d."Id"
WHERE (mp."Pledge-MP" IS NOT NULL AND mp."Pledge-MP" <> '')
AND inv."Balance (BCY)" > 0
```

Logic: start from Invoices, keep only those billed to a `Pledge-MP`-tagged
customer with a real outstanding balance (`mp` join + WHERE), separately look
up the deceased's own Contact record by name match (`fam` join) for the
commitment fields, and pull Funeral Date via the same CRM Deal bridge used in
ZP-TBD-49.

## Step 2 — Report view

Tabular Report on top of the query table, showing only the 4 columns Andrea
asked for, in order: Deceased Name, Funeral Date, MP Commitment Amount,
Letter Date. Invoice Number/Balance stay in the query table for filtering
only.

## Step 3 — Embed in Books Dashboard

Books → Dashboard → Add Widget → "Zoho Analytics Report" (exact wording may
vary by plan) → select this report.

## Status

Guideline delivered 2026-09-01, not yet built/tested live.
