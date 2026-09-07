# ZP-TBD-60 — Funeral GCT Report: Funeral vs Walk-In visibility

**Source:** `DEV_HANDOFF_20260904.md`, item 5.

## Problem

The Funeral GCT Report grouped everything by the deceased's name (`Deal
Name`), so a family's funeral invoice and any walk-in invoice for the same
deceased got summed into one line with no indication a walk-in existed.
49 of the 52 walk-ins reaching the report were invisible this way.

Root cause: neither `cf_is_this_tied_to_a_deceased` nor
`cf_select_the_deceased` was synced from Books into the Analytics
`Invoices` table (workspace `Zoho Books Analytics`,
`2981994000001906002`), so Analytics had no way to distinguish a walk-in
invoice from an ordinary one. The closest existing field, `Source = User`,
matched 56 of 61 walk-ins but also 163 ordinary invoices — unusable.

## Fix applied

1. **Synced `cf_is_this_tied_to_a_deceased`** into the Invoices table
   (confirmed live as column `"Is this tied to a deceased?"`, Boolean,
   `columnId 2981994000006332069`) via Books → Analytics sync config, then
   full re-sync (row count 2308 → 2310, confirming the sync ran and picked
   up recent invoices).
2. **`cf_select_the_deceased` could not be added** — Analytics doesn't
   support syncing lookup-type Books custom fields. Confirmed this doesn't
   block anything: `cf_is_this_tied_to_a_deceased`'s mere presence/value is
   itself the walk-in signal (only ever set by the walk-in intake screen —
   ordinary Deal-driven funeral invoices never touch it), and the deceased
   link needed for grouping is already covered by the existing
   `Related CRM Deal ID` column (now reliable per [[ZP-TBD-57]]'s fix) and
   `DECEASED NAME`.
3. **Updated the `Funeral GCT - Base` query table** (`2981994000006131035`,
   a raw SQL QueryTable feeding the `Funeral GCT Report` Pivot) to add two
   columns:

```sql
inv."Invoice Number" AS "Invoice Number",
CASE WHEN inv."Is this tied to a deceased?" = true THEN 'Walk-In' ELSE 'Funeral' END AS "Invoice Type",
```

   (inserted into the existing SELECT list; every other join/column in the
   query — the `Invoice Items`/`Taxes` line-item tax breakdown, the
   `Customer Payments` anchor-invoice payment logic, the `INNER JOIN` to
   `CRM Deals (Funeral Date)` on `Related CRM Deal ID` — left untouched).

4. **Updated the `Funeral GCT Report` Pivot** (`2981994000006131287`) —
   added `Invoice Type` and `Invoice Number` as nested row-grouping levels
   underneath `Deal Name`, so each deceased's line expands to show every
   invoice individually labeled Funeral or Walk-In instead of one summed
   total.

## Related, not fixed here

The `Funeral GCT - Base` query's `INNER JOIN` to `CRM Deals (Funeral Date)`
on `Related CRM Deal ID` is also why invoices tied to a Deal with no
funeral date never reach the report at all — that's the separate item 6
data-fix (4 Deals, $295,950, blocked on Andrea providing the actual
dates).

## Status

Deployed and confirmed working by the developer, 2026-09-08.
