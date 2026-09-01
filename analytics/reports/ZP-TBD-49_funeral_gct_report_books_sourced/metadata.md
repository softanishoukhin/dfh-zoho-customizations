# ZP-TBD-49 — Funeral GCT Report, rebuilt from Zoho Books data

**Source:** `projectDocuments/Funeral_GCT_Report_Zoho_Analytics_Requirements.md`,
plus two screenshots of the existing CRM-sourced report (pages 1 and 5,
covering Jul 1 – Jul 30 2026 funerals).

## The ask

Andrea wants a **Funeral GCT Report** in Zoho Analytics that looks identical
to the existing CRM report (same columns, order, formatting, Grand Summary),
but the financial numbers must come from **Zoho Books**, not CRM — because
CRM's own numbers are rollup fields on the Deal that don't reflect real,
current Books data (a symptom of the same "frozen at creation" issue found
elsewhere in the PH Billing work).

Required columns, in order: Deal Name, Funeral Date, Invoice Total, Total
Paid Amount, Zero Rated, Tax Exempt, Total Taxable, Tax, Discount, Balance —
plus a Grand Summary row and a Funeral Date filter that defaults to the
current month but allows any month/date/custom range.

## Step 1 findings — existing report is CRM-sourced, not Books-sourced

Zoho Analytics org id `871315529` ("developmentsminerva"). Found the existing
report family, all in the **"Zoho CRM Reports"** workspace
(`2981994000000006002`), all built directly on the CRM **Deals** table
(`parentViewId 2981994000000006050`):
- "Funeral GCT Report" (Pivot, `2981994000002319271`)
- "Funeral GCT Report v2" (Report, `2981994000005269286`)
- "Funeral GCT Report-Copy" (Pivot, `2981994000005528805`)

Confirms the complaint: today's numbers are CRM Deal rollup fields, not real
Books data.

## Step 2 — real Books tables found

Separate workspace **"Zoho Books Analytics"** (`2981994000001906002`)
already syncs real Books tables. Confirmed live column lists (user pulled
these directly from the Analytics UI):

- **Invoices**: `Invoice ID, Invoice Number, ..., Total (BCY), Balance (BCY),
  Discount Amount (BCY), Sub Total (BCY), ..., DECEASED NAME, CRM Invoice ID,
  ..., Related CRM Deal ID, ...` — the last two are custom fields already
  built for exactly this kind of cross-system reporting: `DECEASED NAME`
  covers the Deal Name column directly, and `Related CRM Deal ID` bridges
  straight to the CRM Deal (no need to hop through CRM Invoices first).
- **Invoice Payments**: `Invoice Payment ID, Payment ID, Invoice ID,
  Amount (BCY), ...` — summed per Invoice ID gives Total Paid Amount.
- **Invoice Items**: `Item ID, Invoice ID, ..., Tax Amount, Total (BCY),
  Sub Total (BCY), ..., Tax ID, ...` — no tax breakdown at the invoice
  header level; had to be built by grouping this table by tax type per
  invoice.
- **Taxes**: `Tax ID, Tax Name, Tax Type, Tax Percentage, ...`.

**Gap:** no Funeral Date anywhere in Books (expected — it's a CRM Deal
concept). Bridged via `Related CRM Deal ID`.

## Step 3 — cross-workspace blocker and the fix

Tried adding a second **Zoho CRM** data-source connection directly into the
Books Analytics workspace to pull in Funeral Date — blocked: *"The Zoho CRM
integration for the organization ... is already configured in the Zoho
Analytics workspace 'Zoho CRM Reports'. You cannot set up another
integration with the same account."* Zoho only allows one connection per
source account across all workspaces.

**Fix used:** a separate, real Zoho Analytics feature — **"Zoho Analytics
Workspace"** as an import source (distinct from "Zoho CRM"). This reuses the
CRM connection already living in "Zoho CRM Reports" rather than creating a
new one. Set up as: a small Query Table in "Zoho CRM Reports" holding just
`Deal ID, Deal Name, Funeral Date and Time`, imported into "Zoho Books
Analytics" as a new synced table **"CRM Deals (Funeral Date)"**, on a daily
auto-sync schedule.

## Step 4 — the business-rule discovery: Zero Rated is a flat constant

Every row in both screenshot pages shows **exactly $100,000.00** in the Zero
Rated column regardless of invoice size — confirmed with the developer this
is Jamaica's flat statutory GCT zero-rating allowance for funeral invoices,
not a calculated sum of specific line items. Verified by reconciling actual
screenshot rows: `Zero Rated + Tax Exempt + Total Taxable + Tax == Invoice
Total` held exactly (to the cent) on both Cassel Lyons and Jahmar Junior
Johnson's rows once Zero Rated is treated as a flat $100,000 deducted from
the raw taxable pool before the 15% GCT is applied.

## Final Query Table SQL (workspace: Zoho Books Analytics)

Table name: `Funeral GCT - Base`.

```sql
SELECT
		 inv."Invoice ID" AS "Invoice ID",
		 d."Deal Name" AS "Deal Name",
		 d."Funeral Date and Time" AS "Funeral Date",
		 inv."Total (BCY)" AS "Invoice Total",
		 IFNULL(pay."Total Paid", 0) AS "Total Paid Amount",
		 100000 AS "Zero Rated",
		 IFNULL(tax."Tax Exempt", 0) AS "Tax Exempt",
		 GREATEST(IFNULL(tax."Raw Taxable", 0) -100000, 0) AS "Total Taxable",
		 GREATEST(IFNULL(tax."Raw Taxable", 0) -100000, 0) * 0.15 AS "Tax",
		 inv."Discount Amount (BCY)" AS "Discount",
		 inv."Balance (BCY)" AS "Balance"
FROM  "Invoices" inv
INNER JOIN "CRM Deals (Funeral Date)" d ON inv."Related CRM Deal ID"  = d."Id" 
LEFT JOIN(	SELECT
			 "Invoice ID",
			 SUM("Amount (BCY)") AS "Total Paid"
	FROM  "Invoice Payments" 
	GROUP BY  "Invoice ID" 
) pay ON inv."Invoice ID"  = pay."Invoice ID" 
LEFT JOIN(	SELECT
			 ii."Invoice ID" AS "Invoice ID",
			 SUM(CASE
					 WHEN t."Tax Name"  = 'Tax Exempt' THEN ii."Sub Total (BCY)"
					 ELSE 0
				 END) AS "Tax Exempt",
			 SUM(CASE
					 WHEN t."Tax Name"  <> 'Tax Exempt'
					 OR	t."Tax Name"  IS NULL THEN ii."Sub Total (BCY)"
					 ELSE 0
				 END) AS "Raw Taxable"
	FROM  "Invoice Items" ii
LEFT JOIN "Taxes" t ON ii."Tax ID"  = t."Tax ID"  
	GROUP BY  ii."Invoice ID" 
) tax ON inv."Invoice ID"  = tax."Invoice ID"  
```

Notes on two deliberate design choices:
- `INNER JOIN` (not `LEFT JOIN`) to `CRM Deals (Funeral Date)` — per the
  developer's request, an Invoice with a blank or unmatched
  `Related CRM Deal ID` should simply not appear in the report at all,
  rather than showing with a blank Deal Name/Funeral Date.
- `ROUND(...,2)` was considered for the calculated columns but currency
  formatting (2 decimals, `$` symbol) is applied as a **display format** on
  each money column in the Report/Pivot view instead, via Analytics' column
  "Format Column" option — not baked into the SQL, since a `$`-prefixed
  string column would break the Grand Summary's ability to sum it.

## Remaining build steps (not yet done as of 2026-09-01)

1. Build the Tabular Report / Pivot view on top of `Funeral GCT - Base` with
   the 10 columns in the required order, currency formatting applied, and a
   Grand Summary row.
2. Add the Funeral Date range filter, defaulting to current month.
3. Verify against the CRM report screenshots (Cassel Lyons and Jahmar Junior
   Johnson rows already reconciled by formula above; full row-by-row/Grand
   Summary comparison still pending).

## Status

In progress. Query table built and iterated live with the developer through
several corrections (join type, decimal/currency handling). Steps 1-2 above
still pending before this can be marked complete.
