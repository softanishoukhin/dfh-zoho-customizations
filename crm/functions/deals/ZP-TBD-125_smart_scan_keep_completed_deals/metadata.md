Task ID: ZP-TBD-125
Zoho App: CRM -- Deals -> Deals_Active_Record_List (feeds the Creator "Scan Document Manager" / Smart Scan Deal dropdown)
Requested by: Andrea, 2026-10-22: "Pia went to scan and upload the cremation certificate but deal isn't showing as an
available selection because cremation date has passed ... The certificate has to be uploaded after the cremation is
completed for repats." Decision 2026-10-22: completed Deals stay on the list permanently; only lost Deals drop off.
Status: APPLIED 2026-10-22. Live function confirmed via API; backfill run: "Deals scanned (not lost): 2387 |
already on list: 1087 | to add: 1300 | created: 1300 | failed: 0". List 1,097 -> 2,397; Errol Joseph Ng-You on the list.
Behaviour tests (Test 2-6) pending.

## Root cause
Not the cremation date. Smart Scan's Deal dropdown is the CRM module `Deals_Active_Record_List`
(Creator datasource `zohocrm_deals_active_record_list`, no filter on the Creator side). On every Deal edit the dispatcher
`updateCasketPrice` (workflow "Update Casket Price and Different Forms Received Date") calls
`standalone.addRecordsToDealActiveRecordList(crmid)`, which keeps a Deal on the list only while its Stage's
`deal_category` is **Open**, and deletes it otherwise.
Many post-service stages are **Closed Won**: Cremation Scheduled, Cremation Completed, Completed, Funeral Completed,
Ready for Pickup, Scheduled for Disposal (also Hold for Clothing, Payments In Progress, Burial Order Received, ...).
So a repat that reached Cremation Completed vanished from Smart Scan exactly when the certificate had to be uploaded.
A new "Completed"/"Closed" stage would not help -- it would be Closed too.
Evidence 2026-10-22: Errol Joseph Ng-You (6503357000085823383, Cremation Completed) NOT on the list; Ena Smellie
(6503357000083421315, Family Visit = Open) on the list. List size before: 1,097 of 3,243 Deals.

## What changes (outcome)
- Completed Deals stay available in Smart Scan, so certificates and other documents can be uploaded after the
  cremation / funeral.
- A Deal leaves the list only if it is lost (Stage category Closed Lost: Closed Lost, Closed Lost to Competition,
  DFH Not Selected) or deleted (existing "On Delete a Deal" -> `deleteRecordFromActiveRecordList`, unchanged).
- One-time backfill puts back the completed Deals that already dropped off.

## How it works (technical)
- `addRecordsToDealActiveRecordList_FULL.deluge` -- full replacement, built on the live source pulled 2026-10-22
  (identical to the 2026-09-30 backup). Only change: the stage filter is now
  `deal_category == "Open" || deal_category == "Closed Won"` (was `== "Open"`). Signature, connection `zohooauth`,
  create/update/delete branches unchanged.
- `backfillDealActiveRecordList.deluge` -- NEW standalone `backfillDealActiveRecordList(string dryRun)`.
  Reads the Stage categories, loads every Deal_ID already on the list (COQL, 2000/page), loads all non-lost Deals
  (COQL `Stage not in (<Closed Lost stages>)`), and creates the missing list records in batches of 100 via
  v8 POST with `trigger: []` (no workflows -- same as the live createRecord). Name format matches the live function:
  `Deal_Name ( Contact First Last )`. `dryRun = "true"` only counts.

## Deploy
1. CRM > Setup > Developer Hub > Functions > `addRecordsToDealActiveRecordList` > Edit. Confirm the editor still matches
   the base (only the `deal_category` line differs), paste `addRecordsToDealActiveRecordList_FULL.deluge`, Save.
2. New standalone function `backfillDealActiveRecordList` (argument `dryRun`, String) from
   `backfillDealActiveRecordList.deluge`, Save.
3. Run it with `dryRun = true` -> note "to add" (expected roughly 3,243 - 1,097 - lost Deals).
4. Run it with `dryRun = false` -> "created" should equal "to add", "failed: 0".
5. Recount `Deals_Active_Record_List` -> should be about 1,097 + created.

## Test
1. Errol Joseph Ng-You is in the list after the backfill (count `Deal_ID = 6503357000085823383` = 1); Smart Scan >
   Document Manager > Deals shows him; upload a document -> it lands on the Deal.
2. Move a test Deal to Cremation Completed -> it stays in Smart Scan.
3. Move a test Deal to Completed / Funeral Completed -> it stays.
4. Move a test Deal to Closed Lost -> it leaves the list.
5. Move it back to an Open stage -> it comes back.
6. Delete a test Deal -> its list record is removed (unchanged behaviour).
