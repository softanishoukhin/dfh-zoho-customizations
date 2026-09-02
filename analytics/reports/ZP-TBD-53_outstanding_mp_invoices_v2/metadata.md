# ZP-TBD-53 — Outstanding MP Invoices Report, redesigned for invoice-level commitments

**Source:** follow-up from Andrea after [[ZP-TBD-52]] moved MP commitment info
from the Customer to the Invoice. **Supersedes** [[ZP-TBD-51]]'s query, which
was built against the old Contact-level fields and is now stale.

## Requested columns (unchanged from her original ask, ZP-TBD-51)

MP name, Deceased name, Funeral date, MP Commitment Amount, MP Commitment
Letter Date, Invoice number, Invoice status, Amount paid, Amount
outstanding.

## Design

Base table is now the **MP's own invoice** (created/updated by ZP-TBD-52's
automation), joined back to the originating **family invoice** to pull the
commitment fields, which live there per the new design.

Identifying "which invoice is an MP invoice, and which family invoice it
belongs to" required one addition beyond what ZP-TBD-52 already had: a new
Invoice custom field **`Family Invoice ID`** (Text), set by the automation
function on every MP invoice it creates/updates, holding the originating
family invoice's ID. (`reference_number`, used for this purpose in ZP-TBD-52
itself, turned out not to be exposed as an Analytics-synced column at all —
confirmed live via the error `Invalid column 'Reference Number' used in
SELECT query`. Custom fields sync reliably; the built-in `reference_number`
field apparently doesn't.)

## Live-tested query corrections (all confirmed against real Analytics errors)

1. `Reference Number` is not a valid column → switched the whole join key to
   the new `Family Invoice ID` custom field instead.
2. `Customer Name` is not a column on Invoices (only `Customer ID` is) →
   joins to `Customers` needed for both MP Name and Deceased Name.
3. `DECEASED NAME` custom field confirmed **unreliable/blank** for invoices
   in this flow — see [[project_deceased_name_field_unreliable]]. Deceased
   Name now comes from the family invoice's own `Customer Name` via the
   `Customers` join instead, which doesn't depend on any custom field being
   filled in.
4. Verified a genuine blank Funeral Date case live: Deal `Test D
   NOK09022026` (`6503357000080879421`) has `Funeral_Date = null` in CRM
   because it's only at Stage "Requested" — confirms the query's LEFT JOIN
   logic is correct; a blank result there is real data, not a bug.

## Final query

```sql
SELECT
    mp."Invoice Number" AS "Invoice Number",
    mpCust."Customer Name" AS "MP Name",
    famCust."Customer Name" AS "Deceased Name",
    d."Funeral Date and Time" AS "Funeral Date",
    fam."MP Commitment Amount" AS "MP Commitment Amount",
    fam."MP Commitment Letter Date" AS "MP Commitment Letter Date",
    mp."Invoice Status" AS "Invoice Status",
    (mp."Total (BCY)" - mp."Balance (BCY)") AS "Amount Paid",
    mp."Balance (BCY)" AS "Amount Outstanding"
FROM "Invoices" mp
INNER JOIN "Invoices" fam ON mp."Family Invoice ID" = fam."Invoice ID"
INNER JOIN "Customers" mpCust ON mp."Customer ID" = mpCust."Customer ID"
INNER JOIN "Customers" famCust ON fam."Customer ID" = famCust."Customer ID"
LEFT JOIN "CRM Deals (Funeral Date)" d ON fam."Related CRM Deal ID" = d."Id"
WHERE mp."Family Invoice ID" IS NOT NULL AND mp."Family Invoice ID" <> ''
AND mp."Balance (BCY)" > 0
```

Amount Paid is derived (`Total (BCY) - Balance (BCY)`) rather than summed
from a separate Payments join, since both source columns already sit on the
same Invoices row.

## Status

Confirmed working live 2026-09-02, after the three column-name fixes and
the blank-Funeral-Date root-cause check above.
