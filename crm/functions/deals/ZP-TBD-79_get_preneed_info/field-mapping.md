# ZP-TBD-79 -- Pre-Need -> At-Need field mapping

Rule for every row: the At-Need Deal field is written **only when it is blank**. The Pre-Need Deal
is read first (staff-entered contract data), the questionnaire second (family's wishes).

## A. Pre-Need Questionnaire (CRM module `Pre_Need_Questionnaire`) -- all 32 answer fields

| Questionnaire field | At-Need Deal field | How |
|---|---|---|
| Disposition_Preference | `Type`, `Service_Type`, `Casket_or_Urn` | Burial -> Type `Funeral w/Burial`, Service_Type `Funeral with Burial`, Casket_or_Urn `Casket`. Cremation -> Type `Cremation with Service`, Service_Type `Cremation`, Casket_or_Urn `Urn` if an urn was chosen. |
| Place_of_Worship | `Church_Chapel` | direct |
| Obituary_Information | `Obituary_Info` | direct |
| Flowers | `Flowers` | direct |
| Programme_Style | `Programmes` | direct |
| Inscription | `Headstone_Epitaph1` | direct |
| Cemetery | `Place_of_Internment` | joined with the burial location lines, ", " separated |
| Burial_Location_Line_1 / Line_2 / City / State / Postal_Code | `Place_of_Internment` | (as above) |
| Interment_Type (Urn / Keepsake Urn / Scattering Urn) | `Casket_or_Urn` + wishes block | Urn if any urn chosen on a cremation plan; full list in the wishes block |
| Ceremony_Preferences | wishes block | no matching Deal field |
| Imagined_Service | wishes block | no matching Deal field |
| Songs | wishes block | no matching Deal field |
| Readings | wishes block | no matching Deal field |
| Prayers | wishes block | no matching Deal field |
| Clothing_and_Accessories | wishes block | no matching Deal field (Clothing Checklist is a separate lookup record) |
| Ashes_Instructions | wishes block | no matching Deal field |
| Interment_Description | wishes block | no matching Deal field |
| Headstone_Type | wishes block | `Headstone_Shape` only allows Oval / Square, so free text cannot go there |
| Additional_Instructions | wishes block | no matching Deal field |
| Persons_Responsible (Name1, Relationship, Phone) | wishes block | plain text rows, not CRM Contacts -- listed as "Persons responsible" |
| Pre_Planner_First_Name / Last_Name | -- | already the linked Account (ZP-TBD-78) |
| Pre_Planner_Address_Line_1 / 2 / City / State / Postal_Code / Country | -- | not copied: the pre-planner may be the payer, and the deceased's address is on the Account |
| Signature | -- | stays on the Pre-Need (signed contract evidence) |
| Email | -- | not a person field for the funeral |
| Name, Owner, system fields | -- | system |

**Wishes block** = `Funeral_Special_Instructions` (blank-only), starting "PRE-NEED WISHES", one
labelled line per answer, the Pre-Need Deal's own Funeral_Special_Instructions first. The same block
is always written into the "Pre-Need info pulled" Note, so nothing is lost when the field was
already filled at intake.

## B. Pre-Need Deal -> At-Need Deal (same field)
Service_Type, Service_Format_Type, Casket_or_Urn, Casket_Type, Primary_Color, Secondary_Color,
Handles, Special_Instructions1 (Casket Special Instructions), Hillview (only true -> true), Plot,
Plot_No, Grave_Type, Church_Chapel, Place_of_Internment, Obituary, Obituary_Info, Flowers,
Programmes, Headstone_Epitaph1, Headstone_Shape, Funeral_Special_Instructions (into the wishes
block), Date_of_Birth, Place_of_Birth, City_of_Birth, Country_of_Birth, Sex, Marital_Status,
Occupation, Parish, Case_Location, Currency_Used_for_this_Deal, Pre_Need_Specialist,
Amount_Paid_To_Date (snapshot), Contact_Name (only if the At-Need Deal has none).

## C. Other carry-overs
| What | How |
|---|---|
| Products (`Product_Selection`) | Each Pre-Need row not already on the Deal is added: same Parent/Child product, category, quantity, trim colour. `Unit_Price` = today's catalogue price, `Discount` = catalogue total - contract total, so Quote/SO/Invoice land on the contract price. |
| Contacts | The Pre-Need Deal's Contact Roles (payer, beneficiary, NOK...) are added to the At-Need Deal with the same role. |
| Payments already made | `Amount_Paid_To_Date` snapshot + Note listing contract value, deposit, paid to date, payment type. The retainer itself is applied at at-need invoicing (ZP-TBD-65 Stage 2). |
| Questionnaire link | `Pre_Need_Deal` lookup -> the Pre-Need Deal (the questionnaire hangs off that Deal). |

## D. Deliberately NOT copied (would re-trigger Pre-Need billing automations)
Contract_Value, Pre_Need_Deposit_Amount, Payment_Type, Installment_1/2/3_Amount + Due_Date,
Installment_Commencement_Date, Installment_Day_of_Month, Pre_Need_Balance_Due_Date,
Create_Sales_Order / Create_Installment_Invoice_* (API logs), Pre_Need_Questionnaire_* status/URL,
Pre_Need_Signature, Pre_Need_Contract_Description, Pre_Need_Payer_Or_Beneficiary, Stage, Pipeline,
Layout, Amount.
