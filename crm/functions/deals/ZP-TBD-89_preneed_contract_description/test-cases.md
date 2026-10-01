# ZP-TBD-89 — Test cases

| # | Scenario | Steps | Expected |
|---|---|---|---|
| T1 | List fills on save | Fresh Pre-Need Deal: add `Preneed(2025) Hillview Vault Reg` + its `Non Taxable -` twin, Save, refresh. | Pre-Need Contract Description = `- Preneed(2025) Hillview Vault Reg` (ONE line for the pair). |
| T2 | More items | Add a casket and its Non Taxable twin, and a flower product, Save. | 3 lines, in the order added. |
| T3 | Quantity | Set a flower line quantity to 2, Save. | That line reads `- 2 x <name>`. |
| T4 | Remove | Delete the flower line, Save. | Its line disappears. |
| T5 | Contract prints it | Send the contract (after the deposit is paid). | Page 1 items block shows the same lines, one per line, fully visible (check the box is big enough). |
| T6 | Read-only | Edit page, then inline edit on the Detail page. | Pre-Need Contract Description can't be typed in (Contract Value still read-only too). |
| T7 | Refresh before send | On a Deal saved BEFORE this change (blank description), send the contract without saving first. | Contract items block is filled; the Deal's field is now filled too. |
| T8 | No needless writes | Save the Deal again without product changes. | Function log says "Contract Value unchanged" with no "items list updated". |
| T9 | Special characters | Product with `&` in its name. | Shows `&` correctly on the Deal and on the contract (no `&amp;`). |
