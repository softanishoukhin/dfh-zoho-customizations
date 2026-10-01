# ZP-TBD-85 — Instalments created 3 Books retainers instead of 1 (race in the master-retainer logic)

**Source:** Andrea's issue list, 2026-09-30, "Instalments create a separate Books retainer each. The requirement
is ONE." Severity: fix now. Test deal: Preneed ZZTEST Buyer 0929-1944 (`6503357000084395430`), Contract Value
525,000, Payment Type -> Instalments. Result: RET-K-2026-000137 / 000138 / 000139, each 525,000 (Books showed
1,575,000 held against a 525,000 contract).

## Root cause (checked against live source 2026-09-30)

ZP-TBD-74 (one master retainer per Pre-Need Deal) **is live** — the live `createretainerinvoiceinbooks` body is
the ZP-TBD-74 build plus a few debug `info` lines (snapshot in `rollback/`). All three retainers being exactly the
full contract value (525,000), rather than 262,500 / 131,250 / 131,250, is proof that all three invoices went down
ZP-TBD-74's "no master yet -> I become the master" branch.

Why all three: ZP-TBD-74 was designed when the instalment invoices were created by **separate button clicks**,
minutes apart. ZP-TBD-81 (live 2026-09-29) changed that: `standalone.setupPreNeedPaymentPlan` creates the Deposit,
Instalment 1 and Instalment 2 invoices **within seconds of each other**. The Invoices rule "Create Invoice in Books"
(id `6503357000009264079`, on create, `Retainer_Invoice = true` -> `createRetainerInvoiceInBooks`) fires once per
invoice, so three copies of the function run in parallel. Each one:

1. sleeps 10 s (Creator `Sleep_API`),
2. looks for a sibling Deposit/Instalment invoice that already has a `Books_Invoice_ID`,
3. finds none (the others are asleep too, nobody has created anything yet),
4. creates its own full-contract master.

A classic check-then-create race. The repo brief's defect-table explanation ("only updates when Books_Invoice_ID is
already set") describes the pre-ZP-TBD-74 code; the current cause is the race above.

## Fix (only `createretainerinvoiceinbooks` changes)

1. **Election — exactly one invoice creates the master.** Among the active (not Void/Cancelled) Deposit/Instalment
   invoices on the Deal, the **oldest** one is elected: `Created_Time`, then Deposit < Instalment 1 < 2 < 3, then
   record id. No lock is needed: the oldest invoice always exists before any younger one is created, so every
   younger invoice sees it and defers to it; the oldest one elects itself even if it sees no sibling at all.
   Record ids are **not** used as the primary key because CRM ids are not in creation order (checked live:
   `...84424071` was created after `...84497167`).
2. **Everyone else waits.** A non-elected invoice polls the elected invoice every 10 s, up to 2 minutes, for its
   `Books_Invoice_ID`, then links itself (same link step as ZP-TBD-74). It **never** falls back to creating a
   retainer itself. On timeout it adds a Note "Books retainer not linked" to the invoice and stops.
3. **The master links its siblings.** Right after the elected invoice creates the master, it writes the master's
   `Books_Invoice_ID` / `Books_Invoice_Number` onto every unlinked Deposit/Instalment sibling. So a sibling that
   is still waiting, or has timed out, still ends up linked; a sibling that hasn't woken up yet sees its own
   `Books_Invoice_ID` already set and exits through the existing "already linked" guard.
4. Linking to an existing master now only considers active Deposit/Instalment invoices (ZP-TBD-74 accepted any
   `Retainer_Invoice = true` sibling, including Void ones).

Unchanged on purpose: the master is still sized to the Deal's full `Product_Selection` (ZP-TBD-74 design, and
what Andrea asked for: "one retainer at the full contract value"); deposit and instalment payments still post
against it through `createPaymentsOnBooksForRetainerInvoice` (ZP-TBD-66), which reads `Books_Invoice_ID` off the
invoice being paid. With all three invoices sharing one `Books_Invoice_ID`, the "retainer ignores its own invoice
amount" and "liability 3x" points in Andrea's report go away with the duplicates.

## Not in scope, noted

- **Deposit invoice Grand_Total went to 0 after the payment synced back.** Andrea did not claim this as proven
  (she had hand-edited Status / Total_Paid_Amount / Payment_Made on that invoice). To look at separately with a
  clean payment on the retest.
- **Xero.** `syncretainerinvoicetoxero` fires on retainer create/update. Whether it posted anything for
  RET-K-2026-000137..139 should be checked in Xero before those test retainers are deleted.
- **Real Deals.** Any real Pre-Need Deal switched to Instalments between ZP-TBD-81 going live (2026-09-29) and this
  fix will have the same 3 retainers. Check Books retainers with `cf_related_crm_deal_id` repeated.

## Files

| File | Purpose |
|---|---|
| `createRetainerInvoiceInBooks_UPDATED.deluge` | Full replacement body for `createretainerinvoiceinbooks`. |
| `rollback/createRetainerInvoiceInBooks_LIVE_2026-09-30.deluge` | Live body pulled 2026-09-30, before this change. |
| `guideline.md` | Apply, cleanup and rollback steps. |
| `test-cases.md` | Test plan (xlsx copy in `widgets\testCases\ZP-TBD-85_master_retainer_race_test_cases.xlsx`). |

## Status

Built 2026-09-30 on live source. Not applied, not tested.
