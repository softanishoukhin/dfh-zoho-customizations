# Entire Hillview Group headstone process — TEMPORARILY DISABLED (2026-08-28)

**Scope:** Andrea means the **entire process built around Hillview Group** should be off — the
whole automatic routing/notification pipeline, not just the Plot Number piece. Everything built
in this ticket (Tasks 1–3) is already tested and confirmed passing; this is a temporary pause,
not a rollback.

**Read this whole file before doing anything else in this ticket** — it records exactly what
was turned off and exactly how to turn it back on. Update the checkboxes below as each step is
done/undone so this stays accurate.

## Correction (from the user, caught after the first version of this file)

The first version of this file disabled things by deactivating the one workflow rule
(`Trigger Headstone Process on Completion`) known to call `manageZeroRatedHeadstoneProduct`.
**That was incomplete.** The user found a second, independent caller:
`standalone.createSalesOrderForShipInsV2` calls `standalone.manageZeroRatedHeadstoneProduct(crmid)`
directly, near the top of its own code — and that function is wired into the **shared** "Custom
Manage - Trigger on Any Field Update" dispatcher via completely unrelated fields
(`Casket_Type`/`Primary_Color`/`Secondary_Color`/`Handles`/`Casket_Graphics_Wrap`/`Special_Instructions1`),
nothing to do with the workflow rule. So the earlier "only trigger" claim was wrong — it was only
the only *workflow rule* calling it directly as an instant action; it did not account for other
functions calling it as a plain cross-function call in their own code.

**Redesigned approach:** instead of trying to find and disable every caller (fragile — there
could be more we haven't found), the kill switch goes **inside the two functions that actually
do the sending**, so it blocks every caller regardless of how many exist. This is simpler and
more robust than the first version.

## Switch 1 — one line inside `standalone.manageZeroRatedHeadstoneProduct` itself

This is the core routing function (Hillview 1 → straight to vendor; Hillview 2/3 → family
first). Add an early return as the very first line of the function body:

```
string standalone.manageZeroRatedHeadstoneProduct(Int crmid)
{
	// TEMPORARILY DISABLED 2026-08-28 (Andrea: vendor/product config unavailable for a few
	// days) -- delete this comment and the "return \"\";" line right below it to re-enable.
	// Confirmed multiple callers exist (the "Trigger Headstone Process on Completion" workflow
	// rule, AND standalone.createSalesOrderForShipInsV2 calling this directly) -- disabling at
	// the source here, rather than trying to find and block every caller, is what actually
	// covers all of them, including any we haven't found.
	return "";

	recordInfo = zoho.crm.getRecordById("Deals",crmid);
	... (everything else in the function stays exactly as it is, completely unchanged below this point)
```

Everything that calls this function (the workflow rule, `createSalesOrderForShipInsV2`, and
anything else that might) keeps running normally — Sales Order creation, casket updates, etc.
are all unaffected. Only the headstone routing/notification logic itself becomes a no-op.

**To turn back ON:** delete those few comment lines and the `return "";` line, so the function
body runs exactly as it did before, unchanged.

- [ ] Turned off (confirm here once done, with the date)
- [ ] Turned back on (confirm here once done, with the date)

*(Optional extra safety, not required since Switch 1 above already covers it: the workflow
rule "Trigger Headstone Process on Completion", id `6503357000080581033`, Deals module, can also
be set Inactive in Setup → Automation → Workflow Rules. Harmless either way — leaving it Active
is fine once Switch 1 is in place, since the function it calls is a no-op.)*

## Switch 2 — one line inside `notifyVendorPlotNumberAssigned` itself

This is the function that actually sends the Plot Number email (called by
`Update_Plot_Number_And_Notify_Vendor`, Task 2). Same pattern — add an early return as the very
first line:

```
void notifyVendorPlotNumberAssigned(string email, string vendorID, string dealID, string plotNo)
{
	// TEMPORARILY DISABLED 2026-08-28 (Andrea: vendor/product config unavailable) -- delete
	// this comment and the "return;" line right below it to re-enable.
	return;

	templateurl = "https://www.zohoapis.com/crm/v2.1/settings/email_templates/" + "<TEMPLATE_ID>";
	... (everything else stays exactly as it is, completely unchanged below this point)
```

`Update_Plot_Number_And_Notify_Vendor` keeps running exactly as before — every linked Headstone
Request Form record still gets `Plot_No` updated normally; only the actual email send becomes a
no-op. (This function only has the one caller we wrote ourselves in this ticket, so there's no
equivalent "hidden second caller" risk here — but guarding at the send function itself is still
the more robust place for it, same principle as Switch 1.)

**To turn back ON:** delete those comment lines and the `return;` line.

- [ ] Turned off (confirm here once done, with the date)
- [ ] Turned back on (confirm here once done, with the date)

## What is deliberately NOT touched

- `sendEmailToVendorForDraft` and any vendor-facing email tied to a vendor's own interaction
  with an **already-existing** Headstone Request Form (e.g. uploading a draft) — pre-existing
  ZP-TBD-39 functionality, not something this ticket's tasks introduced, and it can only fire on
  a request that already made it to a vendor. Since Switch 1 stops any *new* request from ever
  reaching a vendor, there should be nothing new in flight for this to fire on during the pause
  — but if Andrea specifically means this too, it needs its own separate decision.
- Everything else confirmed working from Tasks 1–3 (the FD manual-entry trigger's field
  detection, the Hillview App display fields) — none of that sends anything to a vendor.
- Sales Order creation, casket-detail updates, and every other unrelated thing
  `createSalesOrderForShipInsV2` and the shared "Custom Manage - Trigger on Any Field Update"
  dispatcher do — all untouched and continue exactly as normal.

## To resume

Once the vendor/product configuration person is back and ready: remove both early-return guards
(Switch 1 and Switch 2), then do one quick live smoke test (one Deal through each path — a
fresh Hillview 1 product, and a Plot # assignment) to confirm both are actually working again
before considering it fully back in production use. Also worth deliberately re-testing the
`createSalesOrderForShipInsV2` path specifically (edit `Casket_Type`/`Primary_Color`/etc. on a
Deal with a Hillview 1 product already on it) since that's the path that was missed the first
time around.

## Guideline for Andrea — how to turn it back on

Both switches here are inside Deluge function code, not a CRM Setup toggle — so unlike the
first version of this plan, there isn't a simple checkbox Andrea can flip herself this time.
**When she's ready, just let us know and we'll remove both guards and confirm with a live test**
(including the Sales-Order-triggered path specifically, since that's the one that was easy to
miss). This should take only a few minutes once we're asked.
