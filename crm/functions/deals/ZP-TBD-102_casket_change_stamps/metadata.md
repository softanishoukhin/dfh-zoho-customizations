Task ID: ZP-TBD-102 (follow-up)
Zoho App: CRM -- Deals automation function `handleWorkflowTriggerAndActionByTimelineProcess`
("Handel Workflow Trigger and Action by Timeline Process", id 6503357000033955065), run by workflow rule
"Custom Manage - Trigger on Any Field Update" (6503357000013615196, Deals, on every edit).
Found: 2026-10-07 while testing the Casket Management edit queue.
Status: guideline written 2026-10-07; NOT applied.

## Problem
In the Casket Management edit queue every edit showed "Edited (date not recorded)", even right after a
colour change in CRM.

Checked live 2026-10-07:
- Operations records for every recent deal, not just the test casket, have Casket_Type_Changed_On /
  Colors_Changed_On / Handles_Changed_On / Special_Instructions_Changed_On / Funeral_Date_Changed_On empty.
- The functions that write those stamps exist (Casket On Colors `casketoncolours`, Casket Colors Changed
  `casketcolorschanged`, Casket Type Changed, Casket On Handles, Casket On Special Instructions, Casket On
  Funeral Date, Casket Funeral Date Changed; all created 2026-08-03), but **no workflow rule calls them**.
  This was checked on all 104 Deals rules and all 5 Operations rules. Their REST API mode is "None", so
  nothing calls them by URL either.
- On a colour change the deal's timeline shows the "Custom Manage" rule running the dispatcher. The
  dispatcher sees Primary_Color etc. changed, but only rebuilds the Sales Order (`createsalesordersforshipins`).
  Nothing stamps the Operations record.

## What changes (outcome)
- When Casket Type, Primary/Secondary Colour, Handles, Special Instructions or Funeral Date/Time changes
  on a Deal, the deal's newest Operations record gets the matching "changed on" date/time.
- The Casket Management queue then shows "Edited <date/time>" instead of "date not recorded".
- Edits made before this fix keep showing "date not recorded". They still work in the queue, because
  of the value-hash in the edit key.

## How it works (technical)
- A new block in the dispatcher sits inside `if(returnedValue.size() > 0)`, next to the existing
  casket-fields Sales Order block. It uses the same `returnedValue` list of changed fields that the
  dispatcher already builds through `standalone.isThisFieldUpdatedThenGetValue`.
- Field to stamp: Casket_Type -> Casket_Type_Changed_On; Primary_Color / Secondary_Color ->
  Colors_Changed_On; Handles -> Handles_Changed_On; Special_Instructions1 -> Special_Instructions_Changed_On;
  Funeral_Time -> Funeral_Date_Changed_On.
- Operations record: newest by Created_Time for the deal, found with
  `standalone.COQLQuery(... order by Created_Time desc limit 1)`. This is the same record Casket
  Management's `casketBuildList` reads, since it also sorts by Created_Time desc and takes the first per deal.
- The stamp is written as `zoho.currenttime.toString("yyyy-MM-dd'T'HH:mm:ss","America/Jamaica")`, a
  single `zoho.crm.updateRecord` with every changed stamp, and no workflow trigger.
- The stamp is written inline, not by calling the existing casket* functions. Those are `automation.*`
  functions with REST mode None, so a dispatcher can't call them without enabling REST on each one. They
  stay as they are, unused.

## Apply (guideline -- CRM > Setup > Developer Hub > Functions)
1. Open **Handel Workflow Trigger and Action by Timeline Process** and click Edit.
2. Find this line (it appears once):
   ```
   	//End Arrival Time Confirmed
   ```
3. Paste the whole content of `casket_change_stamps_block.deluge` on a new line **directly below** it.
4. Save.

## Test
1. Open Deal **DFH ZZTEST Casket Queue** and change the Primary Colour, then save.
2. Wait about 10 seconds. In CRM, open the deal's Operations record "DFH ZZTEST Casket Queue - 05-Oct-2026 -
   Ops Record". **Colors Changed On** now shows the current date and time.
3. In Casket Management, click Refresh. The Colours edit is back under **New edits** and shows
   "Edited <date> <time>" instead of "date not recorded".
4. Change Handles on the same deal. Only **Handles Changed On** is set, and Colors Changed On keeps its earlier time.
5. Change a field unrelated to the casket, such as Notes. None of the five stamps change.
