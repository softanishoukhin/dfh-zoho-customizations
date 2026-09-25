# ZP-TBD-79 test cases

Setup for all: a test Pre-Need Deal with a completed questionnaire (Disposition = Burial), 2+
products in Product Selection, a Contact Role, and Amount Paid To Date > 0. Then a First Call Deal
for the same person, linked with **Link Pre-Need** (Pre-Need Status = Matched).

| # | Scenario | Steps | Expected |
|---|---|---|---|
| TC-01 | Field API name | Open Setup > Deals > fields | Lookup field API name is exactly `Pre_Need_Deal` |
| TC-02 | Not linked | Click the button on a First Call Deal with Pre-Need Status empty | Popup: use "Link Pre-Need" first. Nothing changes. |
| TC-03 | Wrong Deal type | Click on a Pre Need / Ship In Deal | Popup: only First Call, Hospital or Police. Nothing changes. |
| TC-04 | Happy path, Burial (First Call) | Click on the linked First Call Deal | Popup summary. Church, Obituary Info, Flowers, Programmes, Place of Internment, Headstone Epitaph, Service Type = Funeral with Burial, Casket or Urn = Casket filled. Funeral Special Instructions starts "PRE-NEED WISHES". `Pre-Need Deal` points to the Pre-Need. |
| TC-05 | Type + pipeline | After TC-04, refresh | Type = Funeral w/Burial, Pipeline = Funeral with Burial, Stage = Requested (moved by the existing workflow) |
| TC-06 | Contract price | After TC-04, wait ~2-3 min | Products are on the Deal: Unit Price = catalogue, Discount = difference. A Sales Order (type Other) exists whose line totals = the Pre-Need contract line totals |
| TC-07 | Contacts | After TC-04 | Pre-Need Deal's Contact Roles appear on the At-Need Deal with the same roles; Contact Name filled if it was empty |
| TC-08 | Payments note | After TC-04 | Note "Pre-Need info pulled" lists contract value, deposit, amount paid to date; Amount Paid To Date copied |
| TC-09 | Blank-only | Before clicking, type a Church on the At-Need Deal, then click | Church keeps the typed value; the questionnaire's church only appears in the Note |
| TC-10 | Retainer difference | Take TC-06 through to the at-need invoice + apply the Pre-Need retainer | No wrong "Pre-Need Difference" line (difference ~0 for carried-over products) |
| TC-11 | Cremation | Questionnaire Disposition = Cremation, urn chosen | Type = Cremation with Service, Service Type = Cremation, Casket or Urn = Urn |
| TC-12 | Hospital Deal | Repeat TC-04 on a linked Hospital Deal | Same Deal converts in place to Funeral w/Burial; its existing hospital products are kept |
| TC-13 | Police Deal | Repeat TC-04 on a linked Police Deal | Same as TC-12 |
| TC-14 | Click twice | Click again on the TC-04 Deal | No duplicate products, no duplicate Contact Roles, no second Note, Type unchanged; popup says "Products added: 0" |
| TC-15 | No questionnaire | Pre-Need Deal without a questionnaire | Runs; "Please check: No Pre-Need Questionnaire was found"; if the Pre-Need Deal has no Service Type either, Type is NOT changed and the popup says so |
| TC-16 | Catalogue cheaper | Pre-Need row priced above today's catalogue | Row added with Discount 0; popup lists it under "Please check" |
| TC-17 | Existing products | At-Need Deal already has one of the Pre-Need products | That product is not added twice; other products are added |
