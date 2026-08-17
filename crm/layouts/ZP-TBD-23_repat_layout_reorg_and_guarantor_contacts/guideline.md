# ZP-TBD-23 — Repatriation layout reorg + guarantor Contacts migration

Source: `D:\Office\Andrea_Projects\DFH\projectDocuments\task08172026.txt`
Layouts confirmed by user (2026-08-17): **Full Body Repatriation** and **Repatriation with
Cremation** (Deals module layouts).

All field API names below verified live 2026-08-17 via `ZohoCRM_getFields` on Deals (322
fields). This is a **layout customization task** — Setup > Customization > Modules and
Fields has no write API available through this connector, so Part A is a step-by-step
guideline for the user to apply directly in the CRM UI, the same way every `.ds`-file and
layout change has been handled throughout this engagement.

---

## Part A — Field reorganization (guideline, apply in Setup > Customization)

### A1. Group departing/arriving segments together
Existing fields (confirmed live): `Departing_Date_Time`/`_2`/`_3`/`_4`,
`Arriving_Date_Time`/`_2`/`_3`/`_4`, `Flight_Number`/`_2`/`_3`/`_4`, `Airline`/`_2`/`_3`/`_4`,
`Departing_Airport` (single field), `Arriving_Airport1` (single field, picklist).

**⚠️ Open question:** only ONE `Departing_Airport` and ONE `Arriving_Airport1` field exist —
Legs 2/3/4 have their own date/time, flight number, and airline fields, but **no
per-leg airport fields**. Before regrouping, confirm with Andrea: is this intentional
(connecting-flight airports don't need to be separately tracked), or should
`Departing_Airport_2/3/4` and `Arriving_Airport_2/3/4` be added as new fields so each
leg is fully self-contained? Assuming the former (no new airport fields) unless told
otherwise — the reorg below groups what exists per leg, with each Departing field placed
immediately next to its corresponding Arriving field:

- **Leg 1 (Departing → Arriving):** `Departing_Airport`, `Departing_Date_Time`,
  `Arriving_Airport1`, `Arriving_Date_Time`, `Flight_Number`, `Airline`
- **Leg 2 (Departing → Arriving):** `Departing_Date_Time_2`, `Arriving_Date_Time_2`,
  `Flight_Number_2`, `Airline_2`
- **Leg 3 (Departing → Arriving):** `Departing_Date_Time_3`, `Arriving_Date_Time_3`,
  `Flight_Number_3`, `Airline_3`
- **Leg 4 (Departing → Arriving):** `Departing_Date_Time_4`, `Arriving_Date_Time_4`,
  `Flight_Number_4`, `Airline_4`

In Setup > Customization > Modules and Fields > Deals > [Full Body Repatriation /
Repatriation with Cremation layout] > drag each leg's Departing field(s) directly next to
its matching Arriving field(s), in this order, replacing wherever the departing/arriving
fields currently sit scattered.

### A2. Remove
- **`MOH_Location`** (picklist) — remove from these two layouts only. Do NOT delete the
  field itself — it's likely used on other pipelines/layouts (Police/Hospital autopsy
  flow references MOH elsewhere in this org). Removing from a layout ("Remove Field") does
  not delete the underlying field or its data.

### A3. Additional Stakeholders section
- **Add `Tour_Rep_Phone`** — ⚠️ **does not exist yet.** `Tour_Rep_Name` (text) and
  `Tour_Rep_Email` (email) exist; there's no phone field. Create a new **Phone** field,
  suggested API name `Tour_Rep_Phone`, add it to this section next to the existing two.

### A4. Case Info section
- **Add `Doctor_Name`** (text, exists) — also consider adding `Doctor_Phone` (phone,
  exists) alongside it since it's the natural pair; doc only asked for the name but flag
  this to Andrea as a likely-wanted addition, not assumed.
- **Move into Case Info:** `Deceased_Size` (picklist), `Sex` (picklist), `Type_of_Death`
  (text) — all three already exist elsewhere on the layout; this is a pure relocation.

### A5. Deceased info section
- **"Add place of birth"** — ⚠️ **ambiguous, needs Andrea's confirmation.** Two existing
  fields already cover this: `City_of_Birth` (text) and `Country_of_Birth` (text) — neither
  is currently on these two layouts. Recommend adding both existing fields to Deceased
  Info rather than creating a new single "Place of Birth" field, unless Andrea specifically
  wants one combined field instead.

### A6. Repat Forms — reorder into the exact sequence below
Every item mapped to its live field; two items don't exist yet and need creating first
(marked ⚠️ NEW). One item needs a field-label rename.

| # | Doc item | Field API name | Status |
|---|---|---|---|
| 1 | Deceased Identification | `Deceased_Identification` | exists (fileupload) |
| 2 | Burial Order received | `Burial_Order_Received` | exists (boolean) |
| 3 | Burial Order number | `Burial_Order_No` | exists (text) — already a field, just add to this layout/section |
| 4 | Affidavit/Certificate or Embalmer | `Affidavit_is_Completed` | exists (boolean) |
| 5 | Cremation Certificate | `Cremation_Certificate_Issued` | exists — ⚠️ there is ALSO `Cremation_Certificate_uploaded` (separate boolean); doc just says "Cremation Certificate," confirm which one(s) belong here |
| 6 | Transit Permit application uploaded | `Transit_Permit_Application_Uploaded` | exists (boolean) |
| 7 | Transit Permit application uploaded date | `Transit_Permit_Application_Upload_Date` | exists (date) |
| 8 | Transit Permit Ready | `Transit_Permit_Ready` | exists (boolean) |
| 9 | Proof of Death | `Proof_of_Death` | exists (picklist) |
| 10 | Proof of Death received date | `Proof_of_Death_received_date` | exists (date) |
| 11 | Proof of Death uploaded | `Proof_of_Death_Uploaded` | exists (boolean) |
| 12 | Translation required | `Translation_Required` | exists (boolean) |
| 13 | Legalization/translation uploaded | `Legalization_and_Translation_Uploaded` | exists (boolean) |
| 14 | Embassy Passport PU date | `Embassy_Passport_PU_Date` | exists (date) — **rename field label** to "Embassy Docs appointment date" (Setup > field > edit properties > Field Label; API name stays the same, only the display label changes) |
| 15 | Mortuary Passport uploaded date | `Mortuary_Passport_Upload_Date` | exists (date) |
| 16 | Customs Invoice | — | ⚠️ **NEW FIELD** — doesn't exist. Suggest File Upload type, API name `Customs_Invoice` |
| 17 | Brokers Docs requested | `Broker_Documents` | exists (boolean, label is literally "Broker Documents Requested" — matches). NOT `Brokers_Docs_uploaded` (a different, separate field not mentioned in the doc's list) |
| 18 | Customs Entry Docs Received | `Custom_Entry_Docs_Received` | exists (boolean) |
| 19 | Repatriation Label completed | — | ⚠️ **NEW FIELD** — doesn't exist. Suggest Boolean (checkbox) type, API name `Repatriation_Label_Completed` |

**⚠️ Open question — the "bold = separate column" instruction:** the source file
(`task08172026.txt`) is plain text and doesn't preserve bold formatting from the original
document, so which specific items were bolded is not visible here. Please re-check the
original formatted doc (or tell me directly) which of the 19 items above should go in the
separate "less commonly used" column, so the layout can be built correctly the first time.

---

## Part B — Guarantor → Contacts, and "make it a lookup" (bigger, two-part ask)

### B1. What exists today
Guarantor is currently a set of **plain text/email/phone fields** on Deals — not a
lookup, not linked to any Contact record:
`Guarantor_s_First_Name`, `Guarantor_s_Last_Name`, `Guarantor_s_Contact_Person_First_Name`,
`Guarantor_s_Contact_Person_Last_Name`, `Guarantor_s_Phone_Number`,
`Guarantor_s_Email_Address`, `Guarantor_s_Street_1`, `Guarantor_s_Street_2`,
`Guarantor_s_City`, `Guarantor_s_State`, `Guarantor_s_Zip_Code`.

"Receiving funeral home" is a single **plain text** field: `Name_of_Receiving_Funeral_Home`
— also not a lookup. (A different, already-existing lookup field,
`Receiving_Funeral_Home_for_Wholesale`, points to **Accounts** — but that's a separate
field used only on the Wholesale-related layouts, not this one.)

### B2. Andrea's request, restated precisely
1. Add a real **lookup field** for Guarantor on Deals, pointing to **Contacts** (per her
   explicit words: "create the contacts for guarantor," "move them all to contacts").
2. Make "Receiving Funeral Home" **auto-populate from Guarantor** when they're the same
   entity (which she says is the common case) — this only works cleanly if both fields
   point to the **same module**.
3. Sweep all **open (not paid in full) repatriation Deals**, find their guarantor info
   (currently only sitting in the text fields above), create a **Contact** record for each
   distinct guarantor if one doesn't already exist, and link it via the new lookup field
   — "so nothing ends up missing on existing deals."
4. She also said "they only deal with a handful of them" — implying most repat deals
   likely reuse the same small set of guarantors, so this should mostly be a
   dedupe-and-link operation, not hundreds of unique new Contacts.

### B3. ⚠️ Open design question before building — needs Andrea's decision
`Receiving_Funeral_Home_for_Wholesale`'s existing precedent points to **Accounts**
(organizations), which makes sense for a company. But Andrea's instruction for Guarantor
explicitly says **Contacts** (people), not Accounts. If "Receiving Funeral Home" on these
two layouts becomes a **new** lookup field (separate from the Wholesale one, since that
one's scoped to different layouts per its `layout_associations`), it needs to point to the
**same module as Guarantor** for the auto-populate to work directly (copy one lookup value
into the other).

**Recommendation:** make BOTH the new Guarantor lookup and the new Receiving Funeral Home
lookup point to **Contacts**, so auto-populate is a simple same-module copy. This means
"receiving funeral home" contacts get created as Contact records too (representing a
person/rep at that home, using `Name_of_Receiving_Funeral_Home`'s text value as the
Contact's name) — please confirm this is what she wants before it's built, since it's a
real design choice, not just a technical detail.

### B4. What "auto-populate" means concretely
Once both fields are lookups to the same module: a Deal-level Workflow Rule (field_update
on the new Guarantor lookup field) that runs a small function — if the new "Receiving
Funeral Home" lookup field is empty when Guarantor is set, copy the Guarantor value into
it. Staff can still override it manually for the deals where they're genuinely different.

### B5. Data migration plan (once B3 is confirmed and the new fields exist)
A one-time CRM function, guideline only (per the standing rule — CRM functions here are
always provided as paste-in-place guidelines, never edited live by me):

1. Query open repat Deals: Pipeline in [Full Body Repatriation, Repatriation with
   Cremation] AND not fully paid (need to confirm the exact "paid in full" field/criteria
   with Andrea — likely `Invoice_Status` or an installment-tracking field; not yet
   verified live).
2. For each, read the `Guarantor_s_*` text fields. Build a dedupe key (e.g. normalized
   name + phone or email) since "they only deal with a handful of them."
3. For each distinct guarantor: search Contacts for an existing match first (avoid
   duplicates); if none found, create a new Contact using the guarantor's name/phone/
   email/address fields.
4. Update each Deal's new Guarantor lookup field to point to the resolved Contact id.
5. Log every Deal touched (id, guarantor name, matched-vs-created Contact id) to a
   findings file for Andrea to spot-check before/after — this is a bulk write to
   production data, so a dry-run mode (log what WOULD happen without writing) should run
   first and be reviewed before the real pass.

**Not started** — waiting on B3's confirmation and the "paid in full" criteria before
writing the actual migration script, since guessing at either would risk creating wrong
data or missing deals.

---

## Summary of what's needed from Andrea before this can be built
1. Confirm Leg 2/3/4 airport fields — add new ones, or leave as-is (A1)?
2. Confirm "place of birth" — use existing City/Country of Birth fields, or one new
   combined field (A5)?
3. Confirm which "Cremation Certificate" field belongs in Repat Forms —
   `Cremation_Certificate_Issued`, `Cremation_Certificate_uploaded`, or both (A6 row 5)?
4. Which of the 19 Repat Forms items should be in the separate "less used" column — bold
   formatting was lost in the plain-text source (A6)?
5. Should the new "Receiving Funeral Home" lookup point to Contacts (matching Guarantor,
   enabling simple auto-populate) or Accounts (matching the existing Wholesale precedent)
   (B3)?
6. What field/criteria defines "paid in full" for the guarantor migration's deal filter
   (B5, step 1)?
