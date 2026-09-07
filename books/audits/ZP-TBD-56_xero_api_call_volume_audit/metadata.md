# ZP-TBD-56 — Xero API Call-Volume Audit

**Source:** developer request, following the 5,000-calls/day rate limit hit
during the same-day build of ZP-TBD-48/50/52/54/55. Full audit run via a
background research agent across 28 functions/webhooks; 18 touch Xero.

## Scope

18 custom functions pulled live via `ZohoBooks_get_custom_function` (org
`872327358`) + 10 incoming webhooks read from local backup
`D:\Office\Andrea_Projects\DFH\backup\2026\09042026\*.txt` (not visible via
the Books API). No code changed — audit only.

## 1. The shared boilerplate, confirmed and quantified

Every Xero-touching function independently does its own: (1)
`zoho.crm.getOrgVariable("xeroRefreshToken")` → POST
`identity.xero.com/connect/token`, (2) PUT
`zohoapis.com/crm/v7/settings/variables` (rotating the same CRM variable id
`6503357000009423001` everywhere), (3) often `GET .../Accounts`, (4) often
`GET .../TaxRates`, (5) sometimes `GET .../TrackingCategories`.

**14 independent code paths do their own token refresh.** Per-invocation
boilerplate call count:

| # | Function/webhook | Token+CRM PUT | Accounts | TaxRates | Tracking | Total |
|---|---|---|---|---|---|---|
| 1 | `createinvoiceonxero` (fn) | 2 | 1 | 1 | 1 | 5 |
| 2 | `syncretainerinvoicetoxero` (fn) | 2 | 1 | 1 | 1 | 5 |
| 3 | `createbillinxero` (fn) | 2 | 1 | 1 | 1 | 5 |
| 4 | `addtocontraaccountfornewcreatedcreditnote` (fn) | 2 | 1 | 1 | 0 | 4 — fully wasted, see §3 |
| 5 | `createprepaymentinxerofromcreditnote` (webhook) | 2 | 1 | 1 | 0 | 4 |
| 6 | `create_payments_on_xero` (webhook) | 2 | 1 | 0 | 0 | 3 |
| 7 | `createpaymentsonxeroforbill` (webhook) | 2 | 1 | 0 | 0 | 3 |
| 8 | `createoverpaymentinxerofromrefund` (webhook) | 2 | 1 | 0 | 0 | 3 — unconditional even with 0 refunds |
| 9 | `createcreditnoteforwriteoffandrounding` (webhook) | 2 | 1 | 0 | 0 | 3 — appears orphaned |
| 10 | `syncstatusacrosscrmandxero` (fn) | 2 | 0 | 0 | 0 | 2 |
| 11 | `syncretainerinvoicestatusbetweencrmandxero` (fn) | 2 | 0 | 0 | 0 | 2 |
| 12 | `deleteexistingpaymentsfromxero` (webhook) | 2 | 0 | 0 | 0 | 2 |
| 13 | `deleteexistingpaymentsfromxerobill` (webhook) | 2 | 0 | 0 | 0 | 2 |
| 14 | `createcreditnotefromdebitnotetoxero` (webhook) | 2 | 0 | 0 | 0 | 2 |

`createcreditnotesinxerofrombooksdebitnotes` and `createpaymentsonxero` are
thin wrappers with no boilerplate of their own — they just invoke #14/#6
above via incoming-webhook calls.

## 2. Trigger chains — how far one user action cascades

**Chain A — one new/updated Invoice:** `createinvoiceonxero` → (if already
in Xero) `deleteexistingpaymentsfromxero` → `create_payments_on_xero` → per
debit note: `createcreditnotefromdebitnotetoxero` → per applied credit note:
`createprepaymentinxerofromcreditnote`. One invoice with one debit note and
one applied credit note = **4 separate Xero-auth cycles (8 calls just for
login)** + Accounts fetched 3× + TaxRates fetched 2× = **~23 Xero calls for
one invoice**.

**Chain B — Invoice status change:** `syncstatusacrosscrmandxero` does its
own independent token refresh. Since an invoice is very often created *and*
immediately marked "sent" in the same user action, **Chain A and Chain B
fire near-simultaneously** — the concrete race-condition exposure for the
shared refresh-token rotation.

**Chain C — Customer Payment (CORRECTED 2026-09-04, see [[ZP-TBD-56-3]]):**
the original pass diagnosed this as `createpaymentsonxero` and
`allprocessonpaymentcreateandupdate` racing each other. A live check
disproved that: `createpaymentsonxero` has **zero executions in the last 3
months** and no workflow attached — it's dead, not racing anything. The real
bug was worse: **`allprocessonpaymentcreateandupdate` retriggers itself.**
Confirmed via execution history — it ran **4 times against the same payment
record on the same day**. It's bound to Books' "On Any Create or Update"
workflow on Customer Payments, and partway through its own run it writes
back to that same record several times (`cf_payer_name`, `account_id`,
`cf_amount_converted`); any write that changes a value re-fires the same
workflow. The `cf_payer_name` write had no idempotency guard at all and
rewrote unconditionally on every pass — fixed in [[ZP-TBD-56-3]] by
computing the name once and only writing when it actually changed.
`createpaymentsonxero` being disabled is a separate, optional cleanup item
(no functional impact either way since nothing calls it).

**Chain D — new Bill:** `createbillinxero` → (if exists)
`deleteexistingpaymentsfromxerobill` → unconditionally
`createpaymentsonxeroforbill`. ≈13 Xero calls per new bill.

**Chain E — Credit Note refund, hidden re-cascade:**
`createbilloncreditnoterefund` (ZP-TBD-48) creates its Books Bill with
`X-ZOHO-Execute-CustomFunction:"true"` — the ONLY place across all 18
functions where this is explicitly turned ON (everywhere else it's `"false"`
specifically to *prevent* cascading). That new Bill re-triggers
`createbillinxero` as a brand-new top-level event — a full second Chain D
hidden behind a credit-note refund.

## 3. Additional redundancies found beyond the known pattern

- **`addtocontraaccountfornewcreatedcreditnote` does the expensive part and
  throws it away** — logs into Xero and fetches Accounts+TaxRates on every
  credit note, but the actual Xero-writing code is commented out (from the
  ZP-TBD-54 pivot). Pure waste today.
- **`createoverpaymentinxerofromrefund`** pays the full token+Accounts cost
  unconditionally before checking whether `payment_refunds` even has
  anything to process.
- **`createcreditnoteforwriteoffandrounding`** — only caller found is
  commented out inside `createinvoiceonxero`. Looks orphaned; would add a
  5th chained cascade to Chain A if its caller were ever re-enabled.
- **Duplicate `getpaymentcurrencycode` call** — both payment-entity
  functions call it independently for the same payment, no caching.
- **N+1 loops making per-item Xero/Books calls that could be batched**:
  `create_payments_on_xero`/`createpaymentsonxeroforbill` do a separate
  `getRecordsByID` per payment in a loop instead of a batch fetch;
  `deleteexistingpaymentsfromxero`/`...forxerobill` do a separate Xero
  `CreditNotes?where=Reference==...` query per payment in a loop instead of
  one filtered query.
- **Inconsistent boilerplate**: some webhooks skip the Accounts/TaxRates
  fetch entirely — not a bug, but shows the copy-paste was never even
  consistent, which matters for centralizing.
- **Race condition**: 14 independent code paths all read-then-rewrite the
  same CRM org variable (`xeroRefreshToken`) with no locking. Chains A and C
  show this is a real, not theoretical, exposure.
- **Credentials duplicated ~14×**: `client_id`, `client_secret`,
  `xero-tenant-id`, and the refresh-token variable id are copy-pasted
  identically into every function/webhook — the direct reason 5 new
  integrations built the same day all inherited the same over-calling
  problem at once.

## 4. Prioritized reduction opportunities

1. ~~**Centralize the Xero token refresh**~~ **DEPRIORITIZED 2026-09-04** —
   `identity.xero.com/connect/token` is Xero's separate OAuth authorization
   server, architecturally distinct from the metered `api.xero.com`
   Accounting API; the daily/per-minute rate limits (and their
   `X-DayLimit-Remaining` etc. headers) apply to Accounting API calls, not
   the token endpoint. Centralizing this would not have reduced the actual
   problem (hitting the 5,000/day cap). The one remaining reason to do it —
   14 functions independently rotating the same stored refresh token, a
   theoretical race if two refresh concurrently — is further softened by
   Xero's ~1 minute grace window where the previous refresh token stays
   valid after a new one is issued, which covers the realistic concurrency
   window for these functions. Optional future cleanup, not prioritized.
2. **Cache Accounts/TaxRates/TrackingCategories** — the real target. These
   ARE metered `api.xero.com` calls, re-fetched fresh independently in up to
   3 places per invoice cascade despite being near-static reference data.
   Store in a CRM org variable refreshed hourly/daily instead of
   per-invocation.
3. ~~**Fix the Chain C double-processing** on Customer Payments — merge or
   clearly split `createpaymentsonxero`/`allprocessonpaymentcreateandupdate`
   responsibilities; remove the duplicate `getpaymentcurrencycode` call.~~
   **DONE 2026-09-04, corrected diagnosis** — see [[ZP-TBD-56-3]]. The real
   issue was `allprocessonpaymentcreateandupdate` self-retriggering via its
   own unconditional `cf_payer_name` write, not a race between two
   functions. Fixed. `createpaymentsonxero` confirmed dead (0 executions in
   3 months) — disabling it is optional cleanup, not yet actioned.
4. ~~**Early-exit guard** on `createoverpaymentinxerofromrefund` — check
   `payment_refunds` is non-empty *before* the token/Accounts fetch.~~ **DONE
   2026-09-04** — see [[ZP-TBD-56-2]].
5. ~~**Strip the dead Xero calls** out of
   `addtocontraaccountfornewcreatedcreditnote`.~~ **DONE 2026-09-04** — see
   [[ZP-TBD-56-1]] (also removed a per-line-item Books `items` lookup not
   caught in the original pass, since it fed the same dead code path).
6. **Confirm `createcreditnoteforwriteoffandrounding` is truly unused**;
   disable if so. **CONFIRMED orphaned 2026-09-04** — no active caller
   anywhere live (`createinvoiceonxero`'s only reference to it is commented
   out; `syncretainerinvoicetoxero` never references it at all). Also
   functionally superseded — `createinvoiceonxero` already applies write-off
   and rounding adjustments directly as extra Xero invoice line items.
   **Left active per developer decision** (not disabled) — revisit if
   priorities change.
7. ~~**Reconsider `createbilloncreditnoterefund`'s**
   `X-ZOHO-Execute-CustomFunction:"true"` — the one deliberate cascade
   trigger, doubling the cost of every credit-note refund.~~ **REVIEWED
   2026-09-04, no action** — this flag is required for the refund Bill
   (ZP-TBD-48) to actually reach Xero via the normal `createbillinxero`
   pipeline; turning it off would silently break that feature. The
   idempotency check (`existingBillCheck` by `REFUND-<refundId>` bill
   number) is already solid. Real cost reduction here only comes from the
   root-cause fix in item #9.
8. **Batch the N+1 loops** in the payment-creation and delete-payments
   webhooks.
9. **Extract the Accounts/TaxRates/TrackingCategories fetch into one shared,
   cached helper** (narrowed 2026-09-04 — token refresh excluded per item
   #1) — the maintainable root-cause fix that makes #2 possible and prevents
   the next new integration from repeating this.

## Status

Audit complete 2026-09-04, no code changed yet. Awaiting developer priority
call on which fix(es) to implement first.
