# ZP-TBD-34 — Invoice naming: IFSL, Hospital Name, Family Transfer

Requested by Andrea (`PH_Billing process and Workflows.docx`, "New Invoice Naming
Structure"), scoped in the 2026-08-19 code map and confirmed 2026-08-20: implement the 3
naming rules that don't depend on the still-unbuilt MNSJ split (see [[ZP-TBD-33]] /
`billing-code-map-2026-08-19.md` §3). The MNSJ-specific "MNSJ Police Storage" naming stays
blocked until that split exists -- since every police storage invoice today is effectively
the IFSL invoice (no MNSJ path exists yet), naming it "IFSL Police Storage" now is correct
today and becomes the IFSL half of the naming once MNSJ is added later.

Live-verified 2026-08-20 -- all 4 functions below pulled in full via `getFunctionCode`
this session.

**"Family Transfer" wording, per Andrea's own note**: *"Just Add 'Family Transfer' in
addition to what is already there at the beginning."* Read literally as a prepend onto the
existing Subject wording, not a rebuilt/cleaned-up subject -- that's what's implemented
below.

---

## 1. Police Storage → include "IFSL Police Storage"

`standalone.createInvoiceBasedOnSalesOrderForPolice` (id `6503357000003727101`)

Find:
```deluge
invoiceMap.put("Subject","Invoice  - " + ifnull(salesOrderInfo.get("Subject"),""));
```
Replace with:
```deluge
invoiceMap.put("Subject","IFSL Police Storage - " + ifnull(salesOrderInfo.get("Subject"),""));
```

---

## 2. Hospital Storage → `<Hospital Name> Storage`

`standalone.createInvoiceBasedOnSalesOrderForHospital` (id `6503357000016355283`)

Find:
```deluge
invoiceMap.put("Subject","Invoice  - " + ifnull(salesOrderInfo.get("Subject"),""));
```
Replace with:
```deluge
hospitalNameForInvoice = "";
try
{
	hospitalNameForInvoice = ifnull(recordInfo.get("Selected_Hospital").get("name"),"");
}
catch (eHospName)
{
	hospitalNameForInvoice = "";
}
if(hospitalNameForInvoice != "")
{
	invoiceMap.put("Subject",hospitalNameForInvoice + " Storage - " + ifnull(salesOrderInfo.get("Subject"),""));
}
else
{
	invoiceMap.put("Subject","Invoice  - " + ifnull(salesOrderInfo.get("Subject"),""));
}
```
The fallback (no `Selected_Hospital` set) keeps today's exact naming so nothing breaks if
this ever fires without a hospital selected.

---

## 3. Police Family Bill (LONI gap) → prepend "Family Transfer"

`automation.generateDelayedLONIInvoice` (id `6503357000003727049`)

Find:
```deluge
invoiceMap.put("Subject","Delayed LONI Invoice  - " + ifnull(recordInfo.get("Name_of_Deceased"),""));
```
Replace with:
```deluge
invoiceMap.put("Subject","Family Transfer - Delayed LONI Invoice  - " + ifnull(recordInfo.get("Name_of_Deceased"),""));
```

---

## 4. Hospital Family Bill (release gap) → prepend "Family Transfer"

`automation.CreateInvoiceonSelectingDFHNotSelected` (id `6503357000003769135`)

Find:
```deluge
invoiceMap.put("Subject","Hospital Case Invoice  - " + ifnull(recordInfo.get("Name_of_Deceased"),""));
```
Replace with:
```deluge
invoiceMap.put("Subject","Family Transfer - Hospital Case Invoice  - " + ifnull(recordInfo.get("Name_of_Deceased"),""));
```

---

## Explicitly not done here

- **"MNSJ Police Storage" naming** -- blocked until the MNSJ split (separate Sales Order /
  billing party) exists. Once built, `createInvoiceBasedOnSalesOrderForPolice` (or its
  MNSJ-side equivalent) needs its own `"MNSJ Police Storage - " + ...` naming line,
  distinguished by which SO/payer the invoice is for.
- No other logic in any of these 4 functions is touched -- line items, tax, due dates,
  Potential Payers, Sales Order status updates all stay exactly as they are.

## Test

1. Trigger a Police Cases invoice (any existing test Deal that already creates one) --
   confirm the Subject now reads `"IFSL Police Storage - <original text>"`.
2. Trigger a Hospital Cases invoice for a Deal with `Selected_Hospital` set -- confirm the
   Subject now reads `"<Hospital Name> Storage - <original text>"`. Trigger one with no
   `Selected_Hospital` (if that's ever a real path) -- confirm it falls back to the old
   `"Invoice  - <original text>"` naming, not a broken/empty hospital name.
3. Trigger `generateDelayedLONIInvoice` (police LONI-date gap) -- confirm the Subject now
   starts with `"Family Transfer - Delayed LONI Invoice  - <deceased name>"`.
4. Trigger `CreateInvoiceonSelectingDFHNotSelected` (hospital release-date gap) -- confirm
   the Subject now starts with `"Family Transfer - Hospital Case Invoice  - <deceased
   name>"`.
5. Confirm none of the 4 invoices' line items, totals, tax, or due dates changed --
   only the Subject text.
