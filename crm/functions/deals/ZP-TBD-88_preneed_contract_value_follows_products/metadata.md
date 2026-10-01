# ZP-TBD-88 — Contract Value recalculates late / wipes a manual figure; payment schedule doesn't follow

**Source:** `projectDocuments/DEV_LIST_2026-09-29.md`, item 4 (severity: confirm before go-live).

## Andrea's findings vs what's live (checked 2026-09-30)

| Andrea | Cause |
|---|---|
| Contract Value "did not react to the first product change" for 200 s, then updated after a 2nd save | Not unreliable, just **delayed by design**: Product Selection rule "Update Contract Value for Pre Need New" runs `Update_Contract_Value` **5 minutes after** a row's Modified_Time. 200 s < 5 min; the "2nd save" jump was the 1st save's scheduled run. A **removed** row never triggers it. |
| It overwrote a hand-typed 800,000 | By design: Contract_Value = the product total. The field was editable, so a typed figure looked accepted. |
| Schedule stayed at 800,000 when Contract Value dropped to 200,000 | Nothing re-checks the plan after the products change. The plan (and its invoices + master retainer) is built once, when Payment Type is chosen (ZP-TBD-81). |
| Amount vs Contract_Value, which is real? | **Contract_Value** for Pre-Need: every Pre-Need function reads it (plan, deposit, contract, Get Pre Need Info). `Amount` is only set by `updateDealAmount` from a 'Family'/'Other' invoice, so it's blank on Installments pre-needs. |

## Decisions (user, 2026-09-30)

1. Stale plan -> **lock + warn**: never change invoices/retainer automatically; Note on the Deal + block the contract send.
2. Contract Value **read-only via client script** (not field permission, so functions can still write it).
3. **Amount left blank**; tell Andrea Contract_Value is the real field for Pre-Need, and the user guide should say so.

## Files

| File | Purpose |
|---|---|
| `checkPreNeedPlanMatchesContract_NEW.deluge` | new: compares Contract_Value with the plan's Books totals |
| `recalcPreNeedContractValue_NEW.deluge` | new: the calculation (moved from Update_Contract_Value) + mismatch Note |
| `Update_Contract_Value_UPDATED.deluge` | backstop rule's function -> calls the above |
| `rollback/Update_Contract_Value_CURRENT.deluge` | live body 2026-09-30 |
| `crm/client_scripts/ZP-TBD-88_preneed_contract_value_follows_products/contractValueReadOnly_onLoad.js` | read-only client script |
| `guideline.md` | apply steps, incl. find/replace patches for the dispatcher and getPreNeedContractType |
| `test-cases.md` | tests (xlsx in `widgets\testCases\ZP-TBD-88_contract_value_test_cases.xlsx`) |

## Status

Built 2026-09-30. Not applied, not tested. Repo not committed.
