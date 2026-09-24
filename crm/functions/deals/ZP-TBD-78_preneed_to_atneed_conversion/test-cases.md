# ZP-TBD-78 -- test cases

Test data prefix everything `DFH Test ...` / `Do_Not_Delete DFH Test ...` per DFH convention.
**Setup for all cases:** create a Pre-Need Deal for "DFH Test Pretest" (Contact button, ZP-TBD-68) with
DOB 1950-03-15 and an address on the Account (Street 1 Test Road, City Kingston). A second Pre-Need for
"DFH Test Pretest" with DOB 1962-07-01 (different person, same name). A third for "DFH Test Solo"
(one-word name is rare -- use "DFH Test Solo" only for TC-A9).

## A. Intake (First Call / Hospital / Police)
| # | Steps | Expected |
|---|---|---|
| A1 | NOKIntake, First Call, Deceased Name "DFH Test Pretest", DOB 1950-03-15, submit | Popup: "There is a matching Pre Need Account with this name. Verify the DOB and Address..." with ONE card (the 1950 one; the 1962 person is NOT listed -- DOB differs), "DOB matches" shown. Confirm -> First Call Deal created on the **Pre-Need Account** (no new Account); Deal `Pre_Need_Status = Matched`; Pre-Need Account keeps its name/address/TRN and gets the Date of Death. |
| A2 | Same, DOB left blank | Popup lists BOTH Pretest Pre-Needs (name-only match), each with its own DOB/address; pick one card, Confirm -> linked to the picked Account. |
| A3 | Same as A1 but click **Cancel** | Deal created normally with a NEW Account; `Pre_Need_Status = Not a Match`; after ~1 min still NOT flagged "Possible Match" (safety check respects it). |
| A4 | Name "DFH Test Nobody" | No popup, normal creation. |
| A5 | Hospital, name + DOB matching, Confirm | Trip + pickup created; `onDeceasedPickupCreate` reuses the Pre-Need Account (no new Account created), Deal `Pre_Need_Status = Matched`, Ops record `Deceased` = Pre-Need Account, hang tag still generated. |
| A6 | Police, same, Cancel | New Account, Deal `Not a Match`. |
| A7 | Hospital with NO name | No popup (nothing to search); Deal named "Unknown Deceased - ..." ; no Pre-Need flag. |
| A8 | Edit an existing FC deal from the CRM link (deal_id present) | No Pre-Need check runs. |
| A9 | One-word name matching a one-word Pre-Need | Exact-match only; "DFH Test Solo" matches, "DFH Test" alone does not match "DFH Test Solo". |
| A10 | Re-submit/edit an Intake record already linked (A1) and change the address/notes | Pre-Need Account name and address are **not** overwritten or blanked (accountManagement guard). |
| A11 | First Call where the duplicate-Deal popup (existing recent deal) fires | Duplicate popup only; Pre-Need popup skipped; behaviour identical to today. |
| A12 | Lookup API down (temporarily rename the action) | Submit proceeds normally, no popup, no error shown. |

## B. Safety check after creation
| # | Steps | Expected |
|---|---|---|
| B1 | Create a Hospital case with NO Pre-Need confirmation where the deceased name+DOB matches a Pre-Need (staff clicked Cancel-less path, e.g. Intake was skipped: create the Deal from the CRM directly, Type Hospital, Name_of_Deceased "DFH Test Pretest") | Within ~1 min: `Pre_Need_Status = Possible Match`; `Pre_Need_Possible_Matches` has one line per match "Name \| DOB: ... \| Address: ... \| https://crm.zoho.com/.../Potentials/<id>"; the URL opens the Pre-Need Deal. |
| B2 | Deal's own Account is a Pre-Need Account (linked at Intake, status Matched) | Function exits; status stays Matched, no self-match. |
| B3 | Deal named "Unknown Deceased - x", later edit Name_of_Deceased to "DFH Test Pretest" | Rule 2 fires on the edit -> flagged Possible Match. |
| B4 | Flagged deal, edit name to "DFH Test Nobody" | Rule 2 re-runs, no matches -> status and match text cleared. |
| B5 | Deal with status `Not a Match`, edit name | No re-flag. |
| B6 | Non FC/HC/PC Deal (e.g. Funeral w/Burial) created with a matching name | Rule/function ignores it. |
| B7 | Two Pre-Need plans same name, different DOB, Deal has DOB matching one | Only the DOB-matching one listed. Deal without DOB -> both listed. |
| B8 | Pre-Need whose Account has no DOB/address | Lines show "not recorded". |

## C. Link + duplicate handling (Link Pre-Need widget)
| # | Steps | Expected |
|---|---|---|
| C1 | Take the B1 Deal (fresh, own auto-created duplicate Account, an NOK Contact, an Ops record). Click **Link Pre-Need**, pick the match, Confirm | Deal's Account = Pre-Need Account; `Pre_Need_Status = Matched`, matches text cleared; NOK Contact + Ops `Deceased` moved; duplicate Account **deleted** (visible in Recycle Bin); a Note "Pre-Need linked" on the Deal; widget closes and refreshes. |
| C2 | Widget opens on a Deal whose name differs in spelling; type the Pre-Need name into the search box | Finds it, link works the same. |
| C3 | Widget on a non First Call/Hospital/Police Deal | Message "Only First Call, Hospital and Police Deals can be linked"; search disabled. |
| C4 | Duplicate Account that also has another Deal (create one by hand) | After link: Deal moved, duplicate **not deleted**, renamed `DUPLICATE - <name>` with a Description pointing to the Pre-Need Account; widget says it was flagged. |
| C5 | Deal that already has a Quote / Sales Order / Invoice | Link refused with a clear message; nothing changed. |
| C6 | Old duplicate Account created > 1 day before the Deal (pre-existing at-need Account) | Not deleted, flagged. |
| C7 | Pick an Account that is NOT a Pre-Need Account (call the function with a random Account id) | Error "That Account has no Pre-Need Deal"; nothing changed. |
| C8 | Link when Deal is already on that Pre-Need Account | Status set to Matched, message says already linked. |
| C9 | Click "None of these is the same person" | `Pre_Need_Status = Not a Match`, matches text cleared, no further auto re-flag. |
| C10 | Pre-Need Account's own Date_of_Birth / TRN / address / name | Unchanged after link. Date of Death, Deceased Size, Condition copied only if blank on it. |
| C11 | Confirm the Pre-Need Deal itself is untouched (stage, contract, retainer) | Untouched; its retainer/Books link intact (Account unchanged). |
| C12 | Books: after C1, check no orphan customer / no Xero/Books sync error for the deleted duplicate Account | None (see metadata.md limit 4 -- this is the confirmation for it). |
