# ZP-TBD-59 — MP Commitment dashboard widget: currency label + column layout

**Source:** `DEV_HANDOFF_20260904.md`, item 4.

**Widget:** `D:\Office\Andrea_Projects\DFH\widgets\mpCommitmentWidget\mpCommitmentWidget\app\widget.html`
(built and deployed earlier — see the widget's original build history for
the ZFAPPS/connection setup).

## Bugs

1. Amounts were prefixed with `$` — this is a Jamaican org, should read `JMD`.
2. The "Letter Date" column was pushed off-screen behind a horizontal
   scrollbar. Root cause: every `th`/`td` had a blanket `white-space:
   nowrap`, so the MP and Deceased name columns (the widest, most
   variable-length content) could never wrap — forcing the whole table
   wider than the dashboard panel and pushing the last column out of view.

## Fix applied

- `formatMoney()`: `"$" + ...` → `"JMD " + ...`.
- CSS: removed the blanket `white-space: nowrap` from `th, td`; kept it only
  on `.amount` (so numbers still don't wrap mid-figure) and added it to a
  new `.nowrap` class applied specifically to the Letter Date header/cells.
  MP and Deceased name columns can now wrap onto a second line instead of
  forcing horizontal overflow.

Direct edit (widget JS/HTML — no `.ds`/guideline-only restriction applies
here). Repackaged and re-uploaded to Books by the developer.

## Status

Deployed and confirmed 2026-09-07.
