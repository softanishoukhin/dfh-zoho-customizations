Task ID: ZP-TBD-105
Zoho App: NEW Creator app "Police & Hospital Billing" (portal + widget) + round 2: 1 new Books
incoming webhook (pre-launch delete). No CRM function change.
Requested by: Andrea, 2026-10-07 -- `projectDocuments\ph billing comments 10072026.txt`; round 2
from her replies 2026-10-08 / 2026-10-09.
Status: v1 DEPLOYED 2026-10-08 (testing in progress). Round 2 built 2026-10-09, widget tested
locally against a mocked SDK (monthly list, monthly invoice, cover sheet + Excel, billing codes,
feedback + export, case-screen monthly controls); NOT deployed -- see "ROUND 2 -- deploy" at the end.

## What it is
One portal page where the person who manages Police / Hospital billing follows and corrects
every P/H case until billing is right, then ticks it off.

- **Lists (sidebar):** Police (open) · Hospital (open) · Needs attention · Not picked up yet ·
  Billing closed · All cases. Police has All / Pickups / Drop-offs pills. Search by name,
  police, hospital, registration #. "Cases from" date (default 2026-07-01).
- **Which cases:** Deals whose **Pipeline OR Initial_Pipeline** is Police Cases / Hospital Cases,
  created on/after the "Cases from" date. A case that later became Funeral with Burial,
  Cremation etc. keeps showing (Initial_Pipeline keeps "Police Cases" / "Hospital Cases" --
  checked live: 17 Hospital→Funeral with Burial, 2 Police→Funeral with Burial in the last 200
  Deals). It stays on the open lists until someone ticks **Billing closed**.
- **Case screen, left column** (each block has Edit; saves go to the CRM with workflows ON):
  - Case: stage (P/H stages only), in our care, condition, registration #, case #, police officer.
  - Initial trip: trip, completed time, pickup date, **KM from Amber -- editable** (blank KM =
    $0 trip fee, flagged). Drop-offs: "no initial trip, no trip fee".
  - Police: **Letter of No Interest** block (officer interest, police interest, letter of
    interest, LONI date, family-received LONI date) + a storage check (pickup→LONI days, IFSL
    max 2, MNSJ the rest, family days).
  - Hospital: **Release** block (release date, family-received release date) + storage check.
  - Police: **Autopsy, reschedule & X-ray** (required, type, location, date/time, completed,
    X-ray) + the autopsy / reschedule / X-ray / batch trips with their KM and the driver's
    **outcome** (editable -- a reschedule creates and bills the trip exactly as from the Driver App).
  - All trips (KM editable on each), notes & change history.
- **Case screen, right column -- Billing:** each Sales Order (IFSL Police / MNSJ / Family /
  Hospital) with its lines (product, category, qty, price, discount, amount) and **Edit lines**
  (change product, qty, price, discount; add / remove lines; search any active product). Under
  it, its invoice: status, **CRM total vs Books total** (red when they differ), a warning when
  the invoice lines differ from the Sales Order, **Push to Books**, links to CRM / Books.
  Invoices with no Sales Order of their own (family storage invoices) are edited directly.
  Funeral / cremation invoices on the same Deal are listed read-only.
- **Billing closed** (top right): tick with an optional note; Reopen to bring it back.

## Decisions (user, 2026-10-07)
1. **Line edits change the Sales Order AND its invoice** (the invoice is rebuilt from the SO,
   exactly like the CRM invoice functions do), then Books is scheduled to update. Reason: the CRM
   billing functions rebuild invoices from the Sales Order, so an invoice-only edit would be
   wiped by the next automatic run.
2. **Billing closed lives in the app** (form PH_Case_Status: who / when / note) -- no Deals field
   (Deals is near its field limit).
3. **Cases from 2026-07-01** by default (same window the billing audits used); the date is
   changeable on the list.

## Facts this is built on (checked live 2026-10-07)
- CRM Invoice → Books: rule "Create Invoice in Books" (on create) and rule "Update Invoice in
  Books based Item Update" (6503357000062407114, date-time rule on `Invoice_Items_Updated_At`)
  both run "Create Invoice in Books"; from Books the invoice syncs to Xero. The app sets
  `Invoice_Items_Updated_At` = now + 2 min after changing lines (same pattern as
  `createInvoiceForShipInsV2`).
- Sales Order → invoice mapping used by the CRM functions (`createInvoiceBasedOnSalesOrderFor*`):
  Police Cases → Invoice_For Police · Police Cases - MNSJ → MNSJ · Police Cases - Family → Family ·
  Hospital Cases → Hospital. They copy all SO lines with a full-list v2.1 PUT.
- Driver disposition fields: Operations `Outcome` (Return to DFH / Transfer out / Reschedule),
  `Reschedule_Reason`, linked to the trip by `Related_Trip`; "Handle Autopsy Reschedule" fires
  on `Reschedule_Reason`.
- Police products: `Parent_Product = 6503357000020022236`; hospital products:
  `Product_of_This_Hospital = <hospital Account>`. These are the "suggested" products in the
  line editor; any active product can be searched.

## Files
- `ph_billing_functions.deluge` -- 28 Creator functions (17 helpers, 11 behind Custom APIs;
  the COQL / REST query helpers are the Operations App ones renamed ph*).
- `widget/` -- repo copy of `D:\Office\Andrea_Projects\DFH\widgets\PHBilling\PHBillingWidget\`
  (`app/widget.html`, `app/app.js`, `plugin-manifest.json`); packed
  `PHBillingWidget\dist\PHBillingWidget.zip`.

## Deploy -- in this order

### Step 1 -- Create the Creator app
1. Creator > Create App > from scratch > name **Police & Hospital Billing** (link name
   `police-hospital-billing` -- Creator set this automatically from the name and it can't be
   changed; nothing in the functions or widget depends on it). Settings > Time zone **America/Jamaica** (the functions write -05:00 times),
   date format dd-MMM-yyyy.
2. Create these 2 forms. Field link names must match exactly.

**Form `PH_Case_Status`** (one record per Deal -- the Billing-closed tick)
| Field link name | Type |
|---|---|
| Deal_ID | Single Line |
| Billing_Closed | Decision Box |
| Closed_By | Single Line |
| Closed_At | Single Line |
| Notes | Multi Line |

**Form `PH_Change_Log`** (one record per change made in the app)
| Field link name | Type |
|---|---|
| Deal_ID | Single Line |
| Action_Type | Single Line |
| Detail | Multi Line |
| Changed_By | Single Line |
| Changed_At | Single Line |

### Step 2 -- Connection
Microservices > Connections: link **zoho_oauth_connection** to this app (the same shared Zoho
OAuth connection the Operations / Funeral Preparation apps use -- CRM COQL + modules).
**Books check:** the CRM-vs-Books box reads `GET books/v3/invoices/{id}` with the same
connection, so it needs the scope **ZohoBooks.invoices.READ**. If the connection doesn't have it,
either add the scope (re-authorise) or leave it -- everything else works and the Books box just
says "Books could not be read".

### Step 3 -- Functions
Workflow > Functions > New Function (namespace "Deluge"). Add each function from
`ph_billing_functions.deluge`, one per editor, **in file order** (helpers first):
phCoqlQuery, phCoqlAll, phCoql, phCoqlIn, phGetByIds, phLkId, phLkName, phRestGet, phNow, phLog,
phInvoiceForType, phInvoiceLocked, phLines, phBooksInvoice, phReplaceLines, phStampBooksSync,
phMirrorSoToInvoice, then the 11 below. (The 2 forms must exist first.)

### Step 4 -- Custom APIs
Microservices > Custom API > Create. Authentication OAuth2; User Scope: the portal profile from
Step 6; Response type Standard. POST parameters come from the request body.

| Custom API (link name) | Method | Function | Parameters |
|---|---|---|---|
| PH_Case_List | POST | phCaseList | fromDate |
| PH_Get_Case | POST | phGetCase | dealId |
| PH_Save_Deal | POST | phSaveDeal | dealId, fieldsJson |
| PH_Save_Trip_KM | POST | phSaveTripKm | dealId, tripId, km |
| PH_Save_Outcome | POST | phSaveOutcome | dealId, opsId, outcome, reason |
| PH_Save_Lines | POST | phSaveLines | dealId, target, recordId, linesJson |
| PH_Resync_Invoice | POST | phResyncInvoice | dealId, invoiceId |
| PH_Search_Products | POST | phSearchProducts | q |
| PH_Set_Closed | POST | phSetClosed | dealId, closed, notes |
| PH_Add_Note | POST | phAddNote | dealId, note |
| PH_Picklists | GET | phPicklists | -- |

### Step 5 -- Widget and page
1. Settings > Widgets > Create: name **DFH Police & Hospital Billing**, upload
   `PHBillingWidget\dist\PHBillingWidget.zip`, index file **/app/widget.html**.
2. Create page **PH Billing** (link name PH_Billing) -> add the widget (full width, full height).

### Step 6 -- Portal
Enable the portal (same way as the Operations portal). One profile **PH Billing** -> page
PH_Billing; all 11 Custom APIs above. Invite the billing user(s) (Ms. Shirley / Andrea).

## How it works (technical)
- **List** (`phCaseList`) -- FETCH ONLY (first version joined everything in Deluge and hit
  Creator's "Number of statement execution limit exceed" on live data, 2026-10-08). Now one
  paged COQL per module, each filtered through its Deal lookup:
  Deals `((Pipeline in (Police, Hospital)) or (Initial_Pipeline in (Police, Hospital))) and Created_Time >= fromDate`
  (account names via `Selected_Hospital.Account_Name` / `Police_Account.Account_Name`);
  Trips / Deceased_Pickups on `Deal.<same filter>` (shared pickup trip fields via `Trip.*`);
  Sales_Orders on `Deal_Name.<same>`; Invoices on `Deal_Name__s.<same>` (retried without the
  formula `Grand_Total` if COQL refuses it); PH_Case_Status where Billing_Closed = true.
  Default fromDate 2026-06-01 (Andrea 2026-10-08). The widget (`buildCases`) joins the rows.
  Kind = Initial_Pipeline first, else Pipeline. Drop-off = police, no pickup trip, in our care =
  Yes. Picked up = Initial_Trip_Completed_At set, pickup trip Completed, or drop-off.
  Warnings: KM missing (police pickup), no P/H Sales Order, no Police/Hospital invoice, invoice
  not in Books.
- **Case** (`phGetCase`): Deal (REST v8), Trips (own + via Deceased_Pickups + batch parents),
  Operations, every Sales Order / Invoice (REST v8 with lines), product category / code / price,
  Books copy of each invoice (`phBooksInvoice`), suggested products, status + log.
- **Deal saves** (`phSaveDeal`): whitelist of 20 fields; `zoho.crm.updateRecord` with
  `{"trigger":{"workflow"}}`. Stage limited to Trip Completed, Autopsy Requested / Scheduled /
  Rescheduled / Completed, Letter of No Interest, DFH Selected, DFH Not Selected, Embalming
  Authorization, Closed Lost. Old → new value written to the log.
- **KM** (`phSaveTripKm`): Trips.Number_of_distance_in_km with workflows (the CRM's
  `updateSalesOrderOnNumberOfDistanceinKMUpdate` re-prices the SO; fixed-KM autopsy locations
  keep their fixed KM). The trip must belong to the case (on the Deal, via Deceased_Pickups, or
  the batch parent of one of its trips).
- **Outcome** (`phSaveOutcome`): Operations Outcome + Reschedule_Reason with workflows -- the
  same write the Driver App makes, so "Handle Autopsy Reschedule" runs.
- **Lines** (`phSaveLines` + `phReplaceLines`): full-list v2.1 PUT of the line items (kept lines
  carry their id), then a re-read; any old line still there is removed with v8 `_delete`, so the
  result is exactly what the user saved. Target "so": then `phMirrorSoToInvoice` copies the SO's
  lines (with the CRM-applied Line_Tax) onto its invoice and stamps `Invoice_Items_Updated_At`.
  Target "invoice": invoice lines + stamp. Paid / Partially Paid / Void / Cancelled invoices are
  never changed (message says to correct in Books).
- **Push to Books** (`phResyncInvoice`): re-copy from the matching SO if there is one, then stamp.
- **Billing closed** (`phSetClosed`): upsert PH_Case_Status + log line.

## Found while building (for Andrea)
1. **Books can fall behind the CRM on P/H invoices.** The CRM functions that rebuild a P/H invoice
   after a recalculation (`createInvoiceBasedOnSalesOrderForPolice` / `ForMNSJ` / `ForHospital`)
   update the CRM invoice lines but never set `Invoice_Items_Updated_At`, which is what pushes
   line changes to Books. So after e.g. a new LONI or release date, the Books invoice can keep the
   old amount. The app shows CRM vs Books side by side and has **Push to Books** to fix one case.
   A permanent fix is one line in each of those functions (not part of this build).
2. **Blank KM bills a $0 trip fee** -- e.g. Jaheem Parkinson (Deal 6503357000084808315): pickup
   line quantity 0 → $0. The app lists these under Needs attention ("KM missing") and lets the KM
   be entered.

## Open questions for Andrea
1. Who should get portal access (Ms. Shirley, Andrea, others)?
2. Stage list in the app (above) -- add or remove any?
3. Should "Billing closed" also set something in the CRM (e.g. Deal `Invoice_Status`)? Today it
   is app-only.
4. Cases from 2026-07-01 by default -- OK?

---

# ROUND 2 (Andrea 2026-10-08 / 2026-10-09)

## What Andrea asked / answered
- Billing closed stays in the app only. Cases from **June 1** (default now 2026-06-01).
- **Monthly billing (agreed model):** one **monthly invoice per institution** in Books -- one line
  per case -- is the invoice that is sent and paid. The case invoices stay linked to it and show
  as paid in the app when it is paid. User ticks cases onto the month's invoice, marks it sent,
  prints the cover sheet to send with it.
- **Cover sheets** replace the Analytics reports, modelled exactly on the Analytics query tables.
- **Delete button:** pre-launch clean-up only (test invoices before go-live; DFH tests for a full
  month first), P/H invoices only, never family; no payments on them.
- **Billing codes:** override per invoice (already: Edit lines) AND change the code a scenario
  always bills, picked by searching (also by parent product).
- **Feedback box** + simple export of all case and invoice info for Claude Code (daily review).
- **Family invoices** reviewed in the app with their Books payment status, never on the monthly
  P/H invoice.
- **Full correction across records** -- CRM, Books and Xero stay in sync.

## How it works (technical)
- **Monthly invoice = Books "master" invoice**, same fields as the existing Books button
  "Create Master Invoice" (`projectDocuments\Create_Master_Invoice.txt`): `cf_is_master_invoice`
  = true on the monthly invoice, `cf_master_invoice_id` = its id on every case invoice. One line
  per case: description "<case invoice no.> - <case>", rate = the case invoice's CURRENT CRM
  Grand_Total, qty 1. Customer = the institution's Books customer (chosen once per institution,
  form PH_Org_Map). Institution = the case invoice's CRM `Parent_Account`; one batch per
  institution + payer type (Police / MNSJ / Hospital) + month (forms PH_Monthly_Batch, PH_Batch_Item).
- Only a case invoice still **Draft in Books** can be added (if it were already Sent on its own the
  balance would be counted twice). Already-linked (cf_master_invoice_id set) is refused too.
- **Mark as sent** = save the monthly invoice with current totals + Books `POST /invoices/{id}/status/sent`.
  After that no case can be added / removed. The monthly invoice has no CRM invoice behind it, so
  the existing Books function `createinvoiceonxero` sends it to Xero (Police / Hospital case
  invoices are skipped by that function, so nothing is in Xero twice for them).
- **Stays in sync:** after Edit lines on a case whose invoice is on a monthly invoice already in
  Books, the widget rebuilds that monthly invoice right away (PH_Monthly_Build, send=false). Changes
  the CRM makes later (a new LONI date ...) show as "changed" on the monthly invoice screen and on
  the case, with an Update button. A paid monthly invoice is never changed from the app.
- **Payment status:** PH_Monthly_Status reads the monthly invoice + its payments from Books; the
  case screen shows "Paid -- through the <month> monthly invoice" when Books says paid.
- **Cover sheet** (widget, built in JS): Police / MNSJ = columns of "Query Table for  Government
  Invoicing Report"; Hospital = "Query Table for Hospital Invoicing Report" minus Registration Number
  (removed from the Hospital report, ZP-TBD-44 item 15). Same sums as the SQL: Number of Days =
  sum(qty) of category Storage lines, rate = sum(list price) of Storage lines, KM = sum(qty) of
  Pickup/Trip lines, Decomposition Fee = product 6503357000002869270 lines, Total = sum(line Total),
  Pickup Cost (hospital) = Hospital Cases SO Pickup lines, Times Rescheduled = Stage History rows
  "Autopsy Rescheduled". Rows = the cases on that monthly invoice (not the SQL's "Pipeline = Police
  Cases" filter, which drops cases that became funerals). Print (landscape) + Excel (ExcelJS).
- **Billing codes:** police scenarios = products under the police parent by Product_Category
  (Pickup, Storage, Decompose Storage, Autopsy Trip, Storage - Family); hospital scenarios =
  Product_of_This_Hospital + category (Pickup, Storage, Storage - Family, Autopsy Trip, PME Fee).
  Change = new product gets the tag; any other product with the same tag is unlinked (lookup
  cleared, category kept so old invoices still report). The CRM billing functions pick by this tag,
  so nothing else changes. Six scenarios have the product id written into CRM functions -- shown
  read-only ("Fixed in the CRM code"), see open item 4.
- **Pre-launch delete:** PH_Delete_Invoice / PH_Delete_Monthly -> Books incoming webhook
  `iw_ph_delete_invoice` (repo `books/functions/ph_billing/ZP-TBD-105_ph_billing_delete/`) voids it
  in Xero (deletes it if still draft there) and deletes it in Books; then the CRM invoice is deleted
  (so the CRM can't push it back). Refused for family invoices, paid invoices, and invoices on a
  monthly invoice.
- **Feedback:** form PH_Feedback; box on each case; sidebar Feedback list (Open / Done); Export =
  Markdown file with every item + the full case, trips, outcomes, SO / invoice lines, Books status,
  monthly link and history.

## ROUND 2 -- deploy (in this order)

### R2 Step 1 -- Creator forms (app Police & Hospital Billing). All Single Line unless stated.
- **PH_Feedback:** Deal_ID, Case_Name, Feedback (Multi Line), Feedback_Status, Created_By, Created_At, Done_By, Done_At
- **PH_Org_Map:** Org_Account_ID, Org_Name, Books_Customer_ID, Books_Customer_Name
- **PH_Monthly_Batch:** Org_Account_ID, Org_Name, Payer_Type, Bill_Month, Books_Customer_ID,
  Books_Customer_Name, Master_Invoice_ID, Master_Invoice_Number, Batch_Status, Sent_At, Sent_By, Total
- **PH_Batch_Item:** Batch_Ref, Deal_ID, Case_Name, CRM_Invoice_ID, Books_Invoice_ID, Invoice_Number,
  Amount, Added_By, Added_At

### R2 Step 2 -- Connection scopes
`zoho_oauth_connection` needs, on top of what it has: **ZohoBooks.invoices.ALL** (create / update /
mark sent / read monthly invoices), **ZohoBooks.contacts.READ** (Books customer search),
**ZohoCRM.modules.products.UPDATE** (billing codes), **ZohoCRM.modules.invoices.DELETE** (pre-launch
delete). Re-authorise after adding them.

### R2 Step 3 -- Books incoming webhook (pre-launch delete)
Books > Settings > Developer Space > Incoming Webhooks > New: name `iw_ph_delete_invoice`, script
from `books/functions/ph_billing/ZP-TBD-105_ph_billing_delete/iw_ph_delete_invoice.deluge`, doing
the two COPY steps written at its top (read invoice_id like iw_deleteexistingpaymentsfromx; Xero
token block from createinvoiceonxero). Save, copy its URL.

### R2 Step 4 -- Creator functions
Replace the body of: **phCaseList** (invoices now carry Parent_Account), **phGetCase** (mixed
&& / || conditions rewritten as nested ifs -- the live copy had lost its brackets),
**phSearchProducts** (also searches / returns the parent product).
Add, in this order: phBooks, phBooksOk, phDeleteWebhookUrl (**paste the Step 3 URL into it**),
phFeedbackAdd, phFeedbackList, phFeedbackSet, phMonthlyList, phMonthlyAdd, phMonthlyRemove,
phMonthlyBuild, phMonthlyStatus, phCoverData, phProductInfo, phBooksCustomers, phOrgMapSave,
phDeleteInvoice, phDeleteMonthly, phBillingCodes, phSetBillingCode. (Forms from Step 1 first.)

### R2 Step 5 -- Custom APIs (same settings as v1; add each to the PH Billing portal profile)
| Custom API | Method | Function | Parameters |
|---|---|---|---|
| PH_Feedback_Add | POST | phFeedbackAdd | dealId, caseName, feedback |
| PH_Feedback_List | GET | phFeedbackList | -- |
| PH_Feedback_Set | POST | phFeedbackSet | feedbackId, feedbackStatus |
| PH_Monthly_List | GET | phMonthlyList | -- |
| PH_Monthly_Add | POST | phMonthlyAdd | dealId, invoiceId, billMonth |
| PH_Monthly_Remove | POST | phMonthlyRemove | itemId |
| PH_Monthly_Build | POST | phMonthlyBuild | batchId, send |
| PH_Monthly_Status | POST | phMonthlyStatus | batchId |
| PH_Cover_Data | POST | phCoverData | invoiceIdsJson, dealIdsJson, wantSalesOrders |
| PH_Product_Info | POST | phProductInfo | productIdsJson |
| PH_Books_Customers | POST | phBooksCustomers | q |
| PH_Org_Map_Save | POST | phOrgMapSave | orgAccountId, orgName, customerId, customerName |
| PH_Delete_Invoice | POST | phDeleteInvoice | dealId, invoiceId |
| PH_Delete_Monthly | POST | phDeleteMonthly | batchId |
| PH_Billing_Codes | GET | phBillingCodes | -- |
| PH_Set_Billing_Code | POST | phSetBillingCode | scope, category, productId |

### R2 Step 6 -- Widget
Re-upload `PHBillingWidget\dist\PHBillingWidget.zip` (now includes app/lib/exceljs.min.js).

## ROUND 3 (2026-10-12) -- MNSJ monthly + every billing code changeable
Andrea 2026-10-12: MNSJ follows the same monthly process. Deploy guideline (Books + Creator + CRM +
widget, 7 steps): `crm/functions/deals/ZP-TBD-105_ph_billing_round3/guideline.md`. Creator changes in
this folder's ph_billing_functions.deluge: phMonthlyAdd (refuses invoices already in Xero),
phBillingCodes (fallback products), phSetBillingCode (new scenarios + one-scenario-per-product
guard). Closes open items 1 and 4 below.

## Open items (round 2)
1. **CLOSED by round 3.** MNSJ invoices went to Xero one by one (createinvoiceonxero only skipped
   Police / Hospital / Wholesale) -- "MNSJ" added to that skip list.
2. **Case invoice status in Books:** the app only adds case invoices still in Draft in Books.
   During testing check what status P/H case invoices actually have in Books (the CRM rule "Update
   Status to Books Invoice" copies the CRM status across).
3. **Creating the monthly invoice through the API** may trigger the Books rule "Sync Invoice in CRM
   from Books on Create" -- check in testing that it does not create a CRM invoice for it.
4. **CLOSED by round 3** (4 of the 6 were already tag-driven since ZP-TBD-33; LONI storage and
   hospital Transfer converted). **Billing codes fixed in CRM code** (decomposition fee 6503357000002869270, reschedule / X-ray
   trip 6503357000004300032, transfer trip 6503357000004300027, LONI storage 6503357000002869275 /
   6503357000019249225, hospital family storage 6503357000019249158) -- a CRM update is needed so
   these follow the Billing codes screen too. Needs the live function code (pulled when the MCP
   connection is back) -- next step after round 2 is tested.
5. **Cover sheet layout:** built from the query tables' columns and sums; the pivot's own layout
   (grouping / subtotals) can't be read through the API -- compare one printout with the Analytics
   report during testing.
