# ZP-TBD-89 — The contract's items list is built from the products

**Status: built 2026-09-30, not applied, not tested.** Built on live sources pulled 2026-09-30:
`recalcpreneedcontractvalue` (identical to the ZP-TBD-88 repo copy), `sendpreneedfuneralcontractemail`,
`sendpreneedfuneralcontractembedded`, and the live "contractValueReadOnly" client script.

## What changes for staff

- **Pre-Need Contract Description** (the included-items list printed on page 1 of the contract) now fills itself
  from the Deal's products on every save, and follows every product change:
  - one line per item, e.g. `- Preneed(2025) Hillview Vault Reg`, or `- 2 x ...` when the quantity is more than 1;
  - a product and its "Non Taxable -" twin are **one** line (the pair is one item on the contract);
  - "Pre-Need Balance" is left out.
- The field is **read-only** (like Contract Value), because typed text would be replaced on the next save.
- Just before any contract goes out, the list (and Contract Value) is refreshed first, so a Deal nobody has saved
  since this change still sends a filled list.

## Pieces

| # | Item | Change | File |
|---|---|---|---|
| 1 | `standalone.recalcPreNeedContractValue` | also builds `Pre_Need_Contract_Description` | `recalcPreNeedContractValue_UPDATED.deluge` |
| 2 | `standalone.sendPreNeedFuneralContractEmail` | +2 lines: refresh before reading the Deal | patch below |
| 3 | `standalone.sendPreNeedFuneralContractEmbedded` | same +2 lines | patch below |
| 4 | Client script "contractValueReadOnly" (Deals, PC, HP: Create, Edit, Detail) | + the description field | `crm/client_scripts/ZP-TBD-89_.../contractValueReadOnly_onLoad.js` |

### Step 1

Paste `recalcPreNeedContractValue_UPDATED.deluge` over `recalcPreNeedContractValue`. Nothing calls it differently:
the dispatcher (every Pre-Need save) and `Update_Contract_Value` (5-minute backstop) already call it (ZP-TBD-88).

### Steps 2 and 3 — both contract senders

In **each** of `sendPreNeedFuneralContractEmail` and `sendPreNeedFuneralContractEmbedded`, find this line (it
appears once in each):

```
recordInfo = zoho.crm.getRecordById("Deals",crmid);
```

Directly **above** it, add:

```
// ZP-TBD-89: bring Contract Value + the contract's items list up to date before the Deal is read
recalcBeforeSend = standalone.recalcPreNeedContractValue(crmid.toLong());
info recalcBeforeSend;
```

If that refresh changes Contract Value after the payment plan was made, `getPreNeedContractType` (called a few lines
later) already refuses the send, and the ZP-TBD-88 Note explains why. So a contract can't go out at a stale price.

### Step 4 — client script

Open the existing "contractValueReadOnly" script on the **Create**, **Edit** and **Detail** pages (Deals, layout
PC, HP) and replace the body with `contractValueReadOnly_onLoad.js`. If the Detail page can't make a rich-text field
read-only, the Contract Value part still works (each field has its own `try`).

## How it works (technical)

- Same loop that sums Contract Value: each `Product_Selection` row's `Child_Product` is already fetched once (for
  its tax rate); ZP-TBD-89 caches its contract name from the same call.
- **Twin rule:** `Products.Non_Taxable_Product_of` set -> the line takes that product's name; otherwise a name
  starting "Non Taxable - " has the prefix removed.
- **Quantity per line** = max(quantity on the taxable rows, quantity on the twin rows), so a 1 + 1 pair shows once.
- Excluded: product `6503357000084242156` / name "Pre-Need Balance" (the at-need balance line).
- Stored as rich text: `- A<br>- B`, names HTML-escaped. The senders already turn `<br>` into new lines and decode
  `&amp;` before filling Sign field **Text - 28**.
- **Change detection** compares tag-free, space-free text, so CRM re-wrapping the HTML doesn't cause a write on every
  save. Written in the same `updateRecord` as Contract Value (no workflow trigger, so no loop).
- A Deal with **no** product lines is left untouched (same as Contract Value).

## Not verified — confirm on the first test

The size of Sign field **Text - 28** on the Full and One Page templates. A long package (8+ lines) may not fit the
box; check the printed PDF on T5 (the Sign MCP is disabled in this session, so the template couldn't be inspected).

## Rollback

| # | Rollback |
|---|---|
| 4 | Put back the ZP-TBD-88 client script body (`crm/client_scripts/ZP-TBD-88_.../contractValueReadOnly_onLoad.js`). |
| 2-3 | Delete the 3 added lines from each sender. |
| 1 | Paste back `rollback/recalcPreNeedContractValue_CURRENT.deluge`. |
