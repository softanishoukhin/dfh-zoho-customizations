# ZP-TBD-89 — Nothing fills the contract's items list (Pre_Need_Contract_Description)

**Source:** `projectDocuments/DEV_LIST_2026-09-29.md`, item 5c (severity: fix now).

## Live facts (2026-09-30)

- `Deals.Pre_Need_Contract_Description` (rich text) exists. **No function writes it**: checked the full function
  export `crm-functions_20260930115301`. The only readers are the two contract senders
  (`sendPreNeedFuneralContractEmail`, `sendPreNeedFuneralContractEmbedded`), which strip the HTML and put it in
  Zoho Sign field **Text - 28**.
- The dev's test Deal had hand-typed placeholder text ("Hello, this is a test line 1…"), so the merge was proven,
  but nothing builds the content.

## Decisions (user, 2026-09-30) — answers the open point in Andrea's brief §6

1. **Generated, always matches the products, read-only** (not editable prose).
2. **Name only**, one line per item; "Non Taxable -" twin merged into its product's line; quantity shown only if
   > 1; "Pre-Need Balance" left out.

## Build

- `recalcPreNeedContractValue` (ZP-TBD-88, runs on every Pre-Need save) also builds the list.
- Both contract senders call it right before reading the Deal.
- Client script: the field is read-only.

## Files

| File | Purpose |
|---|---|
| `recalcPreNeedContractValue_UPDATED.deluge` | full body |
| `rollback/recalcPreNeedContractValue_CURRENT.deluge` | ZP-TBD-88 body (= live 2026-09-30) |
| `crm/client_scripts/ZP-TBD-89_preneed_contract_description/contractValueReadOnly_onLoad.js` | client script |
| `guideline.md`, `test-cases.md` | apply steps (incl. sender patches), tests (xlsx in `widgets\testCases\ZP-TBD-89_contract_description_test_cases.xlsx`) |

## Status

Built 2026-09-30. Not applied, not tested. Repo not committed.
