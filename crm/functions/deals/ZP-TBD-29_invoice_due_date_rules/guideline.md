# ZP-TBD-29 — Invoice due-date rules (1-year default + per-pipeline operational date)

**STATUS (2026-08-18): DEPLOYED AND CONFIRMED PASSING.** User applied the fix to both
functions and tested all 5 scenarios (1-year default, date-entered-later replacement,
Cremation with Service body/ashes-in-church exception, Ship-in resolving to either
scenario, Books/Xero propagation) -- confirmed working. The one residual open item noted
below (exact workflow wiring for the recalculation trigger) is resolved by this
confirmation -- the recalculation fires correctly in practice.

Source: `task08182026.txt`. Applies to Deals pipelines: Funeral with Burial, Cremation with
Service, Cremation Only, Ship Ins, Full Body Repatriation, Repatriation with Cremation.

## Research summary (confirmed live)

**Root cause, confirmed:** the invoice-creation functions for these pipelines currently
leave `Due_Date` unset (blank) when the relevant operational date (Funeral Time /
Cremation Date / Departing Date Time) doesn't exist yet at creation time — this is what's
causing bookkeeping problems, matching Andrea's description exactly.

**The correct per-pipeline due-date mapping already exists, "basically correct" as she
said** — duplicated identically in two functions:
- `standalone.updateSalesOrderAndInvoiceBasicInfo` (updates an existing invoice)
- `standalone.createInvoiceForShipinsV2` (creates AND updates — its due-date block runs
  on both paths, not just creation)

Both cover all 5 target pipelines, with these confirmed gaps:
- **Cremation with Service's body-in-church/ashes-in-church exception is not
  implemented** — the branch exists in a comment but is dead code; it always falls back
  to Funeral Time.
- **Ship Ins always use Funeral Time only** — never Cremation Date — even though the spec
  says Ship-ins should follow whichever of the Funeral/Cremation rules applies once they
  resolve into one of those scenarios.
- **Cremation Only's due-date line is missing `.toString("yyyy-MM-dd")`** — inconsistent
  with every other branch, a latent formatting bug.
- Repats already work correctly (Due Date = Departing Date/Time) — no change needed there.

**The field for body-in-church/ashes-in-church already exists** —
`Service_Format_Type` (Deals, picklist, scoped to the Cremation with Service layout),
values: `Body in Church`, `Ashes in Church`, `No Service`, `-None-`. No new field needed.

**Books/Xero sync — already fully wired, confirmed live, no new sync needed:**
- `createInvoiceInBooks` pushes the CRM Invoice's `Due_Date` straight into the Books
  invoice's `due_date` (guarded by a CRM-vs-Books modified-time check, so it only pushes
  when CRM is the newer side — safe, existing conflict handling).
- `syncBooksInvoiceToXeroThroughCRM` pushes the Books invoice's `due_date` straight into
  Xero's `DueDate`.

So fixing the CRM-side calculation is the entire job — the existing sync machinery
carries a corrected `Due_Date` through to Books and Xero automatically, the same way it
already does for every other invoice field change.

**Out of scope, confirmed and left untouched:**
- `automation.CreateInvoicefromSOonChangingDealStageChange` — confirmed Police Cases only
  (queries `Sales_Order_Type = 'Police Cases'`).
- `automation.createInvoiceIfPaymentTypeIsPaymentInFull` — confirmed Pre-Need only
  (queries `Sales_Order_Type = 'Pre-Need'`).

**Not independently re-verified:** the exact workflow rule(s) that invoke
`updateSalesOrderAndInvoiceBasicInfo` and `createInvoiceForShipinsV2` on Funeral_Time /
Cremation_Date / Departing_Date_Time field changes. Both functions are clearly live,
active, and central to this invoice bucket (matching Sales_Order_Type 'Other'/'Ship In
Services' used throughout the rest of this codebase's due-date and invoice logic) — but
this should be confirmed with a live test (below) rather than assumed from code alone.

---

## The fix — same corrected due-date block, applied to both functions

Replace the existing `if(recordInfo.get("Pipeline") == "Cremation Only") { ... }` through
`else { ... }` due-date block in **both** `updateSalesOrderAndInvoiceBasicInfo` and
`createInvoiceForShipinsV2` with:

```deluge
oneYearDefault = zoho.currentdate.addYear(1).toString("yyyy-MM-dd");
if(recordInfo.get("Pipeline") == "Cremation Only")
{
	if(!isNull(recordInfo.get("Cremation_Date")))
	{
		invoiceMap.put("Due_Date",recordInfo.get("Cremation_Date").toString("yyyy-MM-dd"));
	}
	else
	{
		invoiceMap.put("Due_Date",oneYearDefault);
	}
}
else if(recordInfo.get("Pipeline") == "Full Body Repatriation" || recordInfo.get("Pipeline") == "Repatriation with Cremation")
{
	if(!isNull(recordInfo.get("Departing_Date_Time")))
	{
		invoiceMap.put("Due_Date",recordInfo.get("Departing_Date_Time").toString("yyyy-MM-dd"));
	}
	else
	{
		invoiceMap.put("Due_Date",oneYearDefault);
	}
}
else if(recordInfo.get("Pipeline") == "Cremation with Service")
{
	serviceFormat = ifnull(recordInfo.get("Service_Format_Type"),"");
	if(serviceFormat == "Body in Church" && !isNull(recordInfo.get("Cremation_Date")))
	{
		invoiceMap.put("Due_Date",recordInfo.get("Cremation_Date").toString("yyyy-MM-dd"));
	}
	else if(!isNull(recordInfo.get("Funeral_Time")))
	{
		// Ashes in Church, No Service, or Service_Format_Type not yet set -- default to
		// Funeral Date, matching the existing (pre-exception) behavior.
		invoiceMap.put("Due_Date",recordInfo.get("Funeral_Time").toString("yyyy-MM-dd"));
	}
	else
	{
		invoiceMap.put("Due_Date",oneYearDefault);
	}
}
else if(recordInfo.get("Pipeline") == "Ship Ins")
{
	// Ship-ins follow whichever of the Funeral/Cremation rules applies once the deal
	// resolves into one of those scenarios -- prefer Cremation_Date if present, else
	// Funeral_Time, else the 1-year default.
	if(!isNull(recordInfo.get("Cremation_Date")))
	{
		invoiceMap.put("Due_Date",recordInfo.get("Cremation_Date").toString("yyyy-MM-dd"));
	}
	else if(!isNull(recordInfo.get("Funeral_Time")))
	{
		invoiceMap.put("Due_Date",recordInfo.get("Funeral_Time").toString("yyyy-MM-dd"));
	}
	else
	{
		invoiceMap.put("Due_Date",oneYearDefault);
	}
}
else
{
	//Funeral with Burial
	if(!isNull(recordInfo.get("Funeral_Time")))
	{
		invoiceMap.put("Due_Date",recordInfo.get("Funeral_Time").toString("yyyy-MM-dd"));
	}
	else
	{
		invoiceMap.put("Due_Date",oneYearDefault);
	}
}
```

**What changed vs. the original, per branch:**
- Cremation Only: added `.toString("yyyy-MM-dd")` (was missing, latent bug) + 1-year
  fallback (was: leave unset/blank).
- Repat: unchanged mapping, added 1-year fallback (was: leave unset/blank).
- Cremation with Service: **new** `Service_Format_Type` branch — Body in Church →
  Cremation Date, everything else (Ashes in Church / No Service / not yet set) → Funeral
  Date (preserves current behavior for the non-exception cases) + 1-year fallback.
- Ship Ins: **new** — prefers Cremation Date, falls back to Funeral Date, matching "follow
  whichever scenario it becomes" + 1-year fallback.
- Funeral with Burial (the `else`): unchanged mapping, added 1-year fallback.

This single block change satisfies both halves of the request at once: it's the same
logic that runs on invoice creation (via `createInvoiceForShipinsV2`, whose due-date block
runs on both create and update) AND on every subsequent update once the real date is
entered (both functions) — so the "1-year placeholder → auto-replaced with the correct
date" behavior falls out naturally from reusing the same block, no separate mechanism
needed.

---

## Deploy
1. Open `standalone.updateSalesOrderAndInvoiceBasicInfo` in the CRM function editor, find
   its due-date `if/else if/else` block (search for `"Cremation Only"`), replace with the
   block above.
2. Open `standalone.createInvoiceForShipinsV2`, find the equivalent block (also searches
   for `"Cremation Only"`), replace it the same way.
3. **Test 1 — 1-year default on creation, all 5 pipelines:** create a new Deal in each of
   the 5 pipelines with no Funeral_Time/Cremation_Date/Departing_Date_Time set yet, get an
   invoice created for it, confirm `Due_Date` = exactly one year from the Invoice Date.
4. **Test 2 — date entered later replaces the default:** on each of those same 5 Deals,
   now enter the relevant date and confirm the invoice's `Due_Date` updates to the correct
   operational date (per the mapping table above) -- this is the step that also confirms
   whether the recalculation is actually wired to fire on that field's update; if it does
   NOT update automatically, that's the residual open item flagged above and a workflow
   rule needs to be added on that field's field_update calling
   `updateSalesOrderAndInvoiceBasicInforWorkflow`.
5. **Test 3 — Cremation with Service exception:** on a Cremation with Service Deal, set
   `Service_Format_Type = "Body in Church"` and a Cremation Date (different from the
   Funeral Date) -- confirm Due_Date follows the Cremation Date, not the Funeral Date. Then
   set `Service_Format_Type = "Ashes in Church"` -- confirm Due_Date follows the Funeral
   Date instead.
6. **Test 4 — Ship-in resolving to either scenario:** on a Ship Ins Deal, enter only a
   Funeral Time -- confirm Due_Date follows it. On a different Ship Ins Deal, enter only a
   Cremation Date -- confirm Due_Date follows that instead.
7. **Test 5 — Books and Xero propagate:** after Test 2 changes an invoice's Due_Date in
   CRM, confirm (once the existing CRM→Books sync runs) the Books invoice's due date
   updates to match, and (once the existing Books→Xero sync runs) Xero's invoice due date
   matches too. No new sync code needed for this per the research above -- this test is to
   confirm the existing pipeline still behaves as expected once the CRM value is correct.
