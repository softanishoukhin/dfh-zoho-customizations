# Police & Hospital Billing — Product & Code Location Map (2026-08-19)

Requested by Andrea (`phBillingTasks.txt` + `PH_Billing process and Workflows.docx`,
2026-08-19): a complete map of every billing scenario to its live workflow, function,
product-selection code, and conditions, so she (with CC's help) can make small product/
naming changes herself later without needing a developer for every tweak. This is Phase 1
(documentation) only — no code was changed. Phase 2 (the actual new-rule implementation:
MNSJ split, new invoice naming, X-ray field once unblocked, rename-retention field, task
removal) is separate follow-up work, estimated 2-3 days per Andrea's own message.

Live-verified 2026-08-19 against DFH CRM org871210233. Every function was pulled in full
via `getFunctionCode` by numeric id this session (bare/qualified names don't work with
that tool); every workflow trigger via `getWorkflowRules`/`getWorkflowRuleById`. A few
items could not be fully closed out this session -- see **Open Questions** at the bottom,
not guessed.

---

## 1. Scenario Table

| Deal Type / Scenario | Products Possible | Product Actually Added | Workflow Trigger | Function (name + id) | Where Product Is Selected (code location) | Conditions | Where Andrea Can Change the Product |
|---|---|---|---|---|---|---|---|
| **Police Pickup** — Initial Trip Fee (KM as qty) | Any Product with `Parent_Product = 6503357000020022236` (Police parent) and `Product_Category = 'Pickup'`; fallback `6503357000002869122` | Whichever Pickup-category child product is linked to the Police parent | Workflow "Create or Update Sales Order from Deals V2" (id `6503357000049124145`), branch 4, criteria `Pipeline = 'Police Case - Turn Off'` | `automation.CreateSalesOrderforPoliceCase` (id `6503357000003436189`) | `pickupTripProductOPolice = "select Product_Name from Products where Parent_Product = '6503357000020022236' and Product_Category = 'Pickup'"` — used when `tripInfo.get("Created_on_This_Field_Update") == "Initial_Trip"` | Requires a completed Trip, OR `Is_Deceased_In_Our_Care = Yes` for the dropoff branch | Relink the `Product_Category = 'Pickup'` child under Parent_Product `6503357000020022236` in Products — no code change needed |
| **Police Pickup** — KM as Quantity | n/a (quantity, not product) | `Quantity` set from `tripInfo.get("Number_of_distance_in_km")` (defaults to 1) | Trip field-update on `Number_of_distance_in_km` -> `automation.updateSalesOrderOnNumberOfDistanceinKMUpdate` (id `6503357000016798029`) | `standalone.patchPickupQuantityOnSalesOrder` (id `6503357000071756187`) | Set in `CreateSalesOrderforPoliceCase`, re-patched on KM change | Only `Pipeline == 'Police Cases'` and not an Autopsy Initial trip | Quantity mechanism, not a product — nothing to redirect |
| **Police Pickup** — Decomp storage fee | Decomp fee: hardcoded `6503357000002869270`; Decomp-storage: `Product_Category='Decompose Storage'` under Police parent, fallback `6503357000019249225` | Both a one-time Decomp fee line and a Decompose-Storage line, replacing the normal Storage line | Same function/trigger as Police Pickup | `automation.CreateSalesOrderforPoliceCase` (id `6503357000003436189`) | `if(recordInfo.get("Condition") == "Decomposed") { ...getRecordById("Products","6503357000002869270"); ...Product_Category='Decompose Storage' }` | Gated on `Deals.Condition == "Decomposed"` | The Decomp-fee id `6503357000002869270` is a true hardcode (no COQL fallback) — change it directly in code, or relink the Decompose-Storage category child |
| **Police Dropoff** — no trip, storage only | Storage: `Product_Category='Storage'` under Police parent, fallback `6503357000002869275`; or Decompose-Storage if `Condition == 'Decomposed'` | Storage line only — no pickup line item at all | Same function/trigger — dropoff is a branch inside `CreateSalesOrderforPoliceCase`, not a separate function | `automation.CreateSalesOrderforPoliceCase` (id `6503357000003436189`) | `isDropoff = true` when no Trip found AND `Is_Deceased_In_Our_Care == "Yes"`; skips the pickup-line block | `Is_Deceased_In_Our_Care = "Yes"`, no Trip record | Same Storage-category product link as Police Pickup |
| **Hospital Pickup** — Initial trip + daily storage, hospital-specific, no KM/no decomp | Pickup: `Product_of_This_Hospital=<hospital>` + `Product_Category='Pickup'`, fallback `6503357000003769464`. Storage: same pattern + `Product_Category='Storage'` | One fixed-qty (=1) Pickup line per hospital, resolved via `Selected_Hospital` | Same "Create or Update Sales Order from Deals V2" workflow, branch 3, `Pipeline = 'Hospital Case - Turn Off'` | `automation.createSalesOrderForHospitalCase` (id `6503357000003769347`) | `pickupTripProductOfHospital = "select Product_Name from Products where Product_of_This_Hospital = '" + Selected_Hospital.id + "' and Product_Category = 'Pickup'"` | Fires on `Created_on_This_Field_Update == "Initial_Trip"` or `Trip_Type == "Hospital Storage"`; quantity hardcoded to 1 (confirmed: no KM for hospital) | Relink the product under `Products.Product_of_This_Hospital = <that hospital's Account>` — **confirmed live: only Hope Institute Hospital's product is linked (differently named "HIH Storage Fee"); the other 20 "Storage for [Hospital]" products are still unlinked**, same gap the 2026-08-14 H-1 audit found |
| **Police LONI** — 2-day cap to IFSL | Storage: `Parent_Product=6503357000020022236` + `Product_Category='Storage'`, fallback `6503357000002869275` (IFSLM Police Case Storage Fee, $1,500) | Same Storage product as Police Pickup/Dropoff | Workflow "Storage Fee based on Letter of No Interest Workflow" (id `6503357000003302135`), field-update on `Letter_of_No_Interest_Date` | `automation.StorageFeebasedonLetterofNoInterestWorkflow` (id `6503357000003302110`) | Days = `Initial_Trip_Completed_At.days360(Letter_of_No_Interest_Date) + 1`, then the P-1 2-day clamp (deployed/confirmed 2026-08-17 per project memory) | Applies only when `Letter_of_No_Interest_Date` is set (police, no autopsy) | Change the Storage-category product under the Police parent |
| **Police LONI Family Bill** | Storage - Family: `6503357000019249158` (hardcoded) | This exact product | Not independently confirmed by workflow id this session (see Open Questions) | `automation.generateDelayedLONIInvoice` (id `6503357000003727049`) — confirmed correct by its body | `extraStorageDaysForAutopsy = Letter_of_No_Interest_Date.days360(Receiving_Letter_of_No_Interest_Date) + 1`; product COQL `Parent_Product='6503357000020022236' and Product_Category='Storage - Family'`, fallback `6503357000002869275` | Fires when `Receiving_Letter_of_No_Interest_Date` is later than `Letter_of_No_Interest_Date` | Relink the `'Storage - Family'` category child under the Police parent |
| **Police Autopsy (Completed)** | Autopsy Trip: `Product_Category='Autopsy Trip'` under Police parent. Storage: same Storage-category | One Autopsy-Trip line (qty = KM, with 3 fixed-KM overrides for known locations) + Storage line | SO/trip fee: same "Create or Update Sales Order from Deals V2" (Police branch). Storage continuation: "Update Sales Order with Storage Fee" (id `6503357000003289112`), field-update on `Autopsy_Completed_Date_Time` | Trip fee: `automation.CreateSalesOrderforPoliceCase` (id `6503357000003436189`). Storage: `automation.updateSalesorderWithStorageFee` (id `6503357000003289008`) | `if(Autopsy_Required == "Yes") { ...Product_Category = 'Autopsy Trip' }`; KM fixed at 167/180/54 for 3 specific Autopsy_Location ids | Gated on `Autopsy_Required == "Yes"`; storage days = `Initial_Trip_Completed_At.days360(Autopsy_Completed_Date_Time) + 1` | Relink the `'Autopsy Trip'` category product; the 3 fixed-KM overrides are hardcoded in `updateSalesOrderOnNumberOfDistanceinKMUpdate` (id `6503357000016798029`), not COQL-driven |
| **Police Autopsy (Rescheduled)** — officer no-show | Reschedule Trip fee: hardcoded `6503357000004300032` | This exact product | Workflow "Handle Autopsy Reschedule" (id `6503357000078744185`), Operations field-update, `Reschedule_Reason != EMPTY` | `automation.handleAutopsyReschedule` (id `6503357000078744177`) | `rescheduleTripProductId = "6503357000004300032"` — billed on the **Police Cases** Sales Order, then `standalone.createInvoiceBasedOnSalesOrderForPolice(crmid)` | Fires for `Reschedule_Reason == "Autopsy not done"` or `"X-ray required"`; returns immediately with no billing for `"Problem caused by DFH"`. **Bills the existing Police (IFSL) SO — there is no separate MNSJ SO/Account yet, see §3** | Change the hardcoded id `6503357000004300032` directly in `handleAutopsyReschedule` |
| **Police X-ray** | Same hardcoded `6503357000004300032` (Reschedule Trip product), reused — no distinct X-ray/radiology product yet | Same product as reschedule | Same "Handle Autopsy Reschedule" workflow, distinguished by `Reschedule_Reason == "X-ray required"` | `automation.handleAutopsyReschedule` (id `6503357000078744177`) | Creates a `Trip_Type = "X-Ray Trip"` trip, bills the same `rescheduleTripProductId` — no separate X-ray branch in the billing block | Comment in code confirms: billed straight to the institution automatically, no Task | Same hardcoded id — swap to one of the CRH radiology products once Andrea/Shirley confirm which one |
| **Hospital Autopsy** | Autopsy Trip: `Product_of_This_Hospital=<hospital>` + `Product_Category='Autopsy Trip'`, fallback `6503357000004300032`. Plus hospital-specific PME Fee / PME Transport Fee for 2 specific hospitals | Hospital-specific Autopsy Trip line, qty=1; optionally PME Fee/PME Transport Fee | Same "Create or Update Sales Order from Deals V2" (Hospital branch) | `automation.createSalesOrderForHospitalCase` (id `6503357000003769347`) | `autopsyTripProductOfHospital = "...Product_of_This_Hospital = '" + Selected_Hospital.id + "' and Product_Category = 'Autopsy Trip'"`; 2 hospital ids (`6503357000022426824`, `6503357000022426825`) hardcoded for PME logic | Gated on `Autopsy_Required == "Yes"` AND `Selected_Hospital` set | Relink the category children under each hospital's `Product_of_This_Hospital` |
| **Hospital Release / Family Bill** | Storage-Family: hardcoded `6503357000019249158` — same fixed id regardless of which hospital | This exact product, qty = day-gap | Function found by content match; triggering workflow rule id not independently confirmed this session (see Open Questions) | `automation.CreateInvoiceonSelectingDFHNotSelected` (id `6503357000003769135`) | `extraStorageDaysForAutopsy = Initial_Trip_Completed_At.days360(Hospital_Release_Date) + 1`; `productMap.put("Product_Name","6503357000019249158")` | Fires when `extraStorageDaysForAutopsy > 0` | **Likely bug, not something Andrea asked for but worth knowing before touching this**: the code fetches the hospital-specific storage product via COQL for its Unit_Price/Tax, then ignores the lookup and bills a single fixed product id regardless of hospital |

---

## 2. Invoice Naming Code

`createInvoiceBasedOnSalesOrderForPolice` (id `6503357000003727101`) and
`createInvoiceBasedOnSalesOrderForHospital` (id `6503357000016355283`) — both pulled in
full. Both simply do:
```deluge
invoiceMap.put("Subject","Invoice  - " + ifnull(salesOrderInfo.get("Subject"),""));
```
(double space, verbatim). The Sales Order's own Subject (built in `CreateSalesOrderforPoliceCase`/
`createSalesOrderForHospitalCase`) is:
```deluge
soMap.put("Subject", recordInfo.get("Deal_Name") + "-" + ifnull(recordInfo.get("Name_of_Deceased"),"") + "-" + ...timestamp...);
```

**None of the 4 new naming rules exist in code today** — confirmed by reading both
invoice functions and the two family-bill functions in full:
- "IFSL Police Storage" in the name — not present anywhere.
- "MNSJ Police Storage" — not present; no MNSJ concept exists in the system at all (see §3).
- `<Hospital Name> Storage` — not present; hospital invoices use the same generic pattern as police.
- "Family Transfer" prefix — not present. `generateDelayedLONIInvoice` and
  `CreateInvoiceonSelectingDFHNotSelected` build their own Subjects independently
  (`"Delayed LONI Invoice  - " + Name_of_Deceased` and `"Hospital Case Invoice  - " +
  Name_of_Deceased`), neither says "Family Transfer".

**All 4 naming changes require new code** — one line each in the `invoiceMap.put("Subject", ...)`
calls in these 4 functions. None currently branch on Sales_Order_Type/Invoice_For to pick a
naming template, so distinguishing "IFSL" vs "MNSJ" invoices additionally requires the
MNSJ split (§3) to exist first.

---

## 3. MNSJ Split — Does Not Exist, Needs to Be Built From Scratch

Searched this session: all 383 live CRM functions (name-search "mnsj" — zero matches), all
322 Deals fields (zero matches), and `handleAutopsyReschedule`'s billing logic (bills
everything to the single existing **Police Cases** Sales Order, no second
Sales_Order_Type or second Account/Contact routing anywhere).

**Not fully closed out:** a direct Accounts/Contacts search for an existing "MNSJ" record
wasn't completed this session (tool limitation, see Open Questions) — so an MNSJ contact
record itself might already exist even though no code references it yet.

Conclusion: the 2-day IFSL/MNSJ split, the MNSJ billing party, and the MNSJ invoice path
are net-new work, not a partially-built feature. `Sales_Order_Type` currently only
supports `'Police Cases'` / `'Hospital Cases'` — a new type or a parallel Sales Order is
needed to keep the two payers' line items separate.

---

## 4. Rename Function (Unidentified → Identified)

Three related functions found, none matching Andrea's description exactly (none retain the old name):

1. **`automation.onPoliceDropoffNameCorrected`** (id `6503357000071818139`) — closest
   match. Updates `Deals.Deal_Name`, `Accounts.Account_Name`, rebuilds `Operations.Name`,
   regenerates the hang tag. Overwrites the old name, does not preserve it anywhere.
2. **`standalone.refreshDeceasedNameOnRelatedRecords`** (id `6503357000072827006`) —
   broader cascade (Deal, open Trips, Sales Orders, Invoices, Operations, Clothing
   Checklist). Same story, no retention.
3. **`standalone.syncDeceasedIdentityToOps`** (id `6503357000072827001`) — pushes
   name/condition/sex/size to the Creator-side `Deceased_Records` report. No retention.

**Confirmed gap:** no "Unidentified Name" field exists on Deals or Operations today
(checked the full field list). Building this means: add `Unidentified_Name` to Deals and
Operations, then in `onPoliceDropoffNameCorrected` (the narrowest match), capture the old
`Deal_Name` into that field before it gets overwritten.

---

## 5. Reschedule Task — Exact Location to Remove

Confirmed live in `automation.handleAutopsyReschedule` (id `6503357000078744177`):

```deluge
taskSubject = "Raise manual reschedule invoice -- decide police-officer vs family charge";
existingTaskCriteria = "(What_Id:equals:" + crmid + ")and(Subject:equals:" + taskSubject + ")";
existingTasks = List();
try { existingTasks = zoho.crm.searchRecords("Tasks",existingTaskCriteria,1,1); }
catch (eTaskSearch) { existingTasks = List(); }
if(existingTasks.size() == 0)
{
	taskMap = Map();
	taskMap.put("Subject",taskSubject);
	taskMap.put("$se_module","Deals");
	taskMap.put("What_Id",crmid);
	taskMap.put("Owner","6503357000009256001"); // Caeren Shirley
	taskMap.put("Due_Date",zoho.currentdate.addDay(2));
	taskMap.put("Status","Not Started");
	taskMap.put("Send_Notification_Email",true);
	taskMap.put("Task_Type","Reschedule Manual Invoice");
	createTask = zoho.crm.createRecord("Tasks",taskMap);
}
else { info "Task already exists..."; }
```
Sits after the `if(isXray) { ...; return; }` guard, so it only ever runs on the
`"Autopsy not done"` path, never for X-ray. Removing it is a clean deletion of this one
block — the trip-creation and billing logic above it are self-contained and don't depend
on it.

---

## 6. X-ray Field Blocker — Confirmed Still True

Regex-searched the full 322-field live Deals field list for `x.?ray`/`radiology` — zero
matches. No X-ray field exists on Deals today. Confirmed genuinely blocked on the Zoho
field-limit increase, matching Andrea's note. Same check for a Deal-level MNSJ field —
also absent.

---

## 7. Tax Configuration — Mechanism Confirmed, Live Values Not Checked

Every billing function (`CreateSalesOrderforPoliceCase`, `createSalesOrderForHospitalCase`,
`updateSalesorderWithStorageFee`) resolves tax identically: fetches the `Products.Tax`
picklist metadata, matches the specific product's `Tax` value against it, computes
`taxValue = (lineAmount * taxPct / 100).round(2)`. **Whether a product is taxed is
controlled entirely by that product's own `Tax` field value — no code-level "is this
government" override exists.** This means: to satisfy "no tax on institution invoices,"
Andrea can go directly to each Police/Hospital product's `Tax` field and clear it — no code
change needed. Not checked this session: the actual current `Tax` value on each specific
product used above.

---

## Open Questions (surfacing tonight per Andrea's request — not guessed)

1. **Police LONI Family Bill & Hospital Release Family Bill workflow trigger ids** — both
   functions (`generateDelayedLONIInvoice`, `CreateInvoiceonSelectingDFHNotSelected`) were
   confirmed correct by their code body, but their triggering Workflow Rule wasn't
   independently traced by id this session.
2. **Does an MNSJ Account/Contact already exist?** Not ruled out — no code references it,
   but a direct Accounts/Contacts name search wasn't completed. Worth a 30-second manual
   check (Accounts list view, filter name contains "MNSJ") before treating this as 100%
   net-new.
3. **Police LONI 2-day cap's exact current code** — memory says P-1 shipped and was
   confirmed working live 2026-08-17; this session relied on that prior verification
   rather than re-pulling the function fresh. Worth a quick re-pull before Phase 2 touches
   this function again.
4. **Tax field live values** on the specific products above — mechanism confirmed, actual
   on/off state not checked per-product.
5. **Hospital Release family-bill hardcode** (`6503357000019249158` always used regardless
   of hospital, despite a hospital-specific product being looked up and then discarded) —
   flagged as a likely pre-existing bug, independent of anything Andrea asked for. Worth
   deciding whether to fix it as part of Phase 2 or leave it (it currently means every
   hospital's family-bill storage line bills the same product regardless of hospital).
6. **"Police Case - Turn Off" / "Hospital Case - Turn Off"** — the live Pipeline criteria
   values on the Sales-Order-creation workflow. These read like leftover/renamed labels
   from a past pipeline restructure — worth confirming with Andrea/Dale these are still
   the intended live values, not stale criteria that happen to still match.
7. **Which product should bill an X-ray trip** — still Andrea/Shirley's call, per the
   source document's own note (one of 3 CRH radiology products vs. continuing to reuse the
   generic Reschedule Trip product).

## Not Yet Investigated

- Whether the 20 unlinked hospital Storage products are actively causing missed billing
  today, or something else is covering for it.
- The 3 CRH radiology product ids (not pulled/identified this session).
