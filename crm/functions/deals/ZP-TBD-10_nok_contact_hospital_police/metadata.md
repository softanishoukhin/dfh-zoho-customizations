Task ID: ZP-TBD-10 (placeholder)
Zoho App: CRM
Module: Deceased_Pickups (trigger) / Contacts (write target) / Deals (link target)
Function Name: automation.onDeceasedPickupCreate (id 6503357000068702919)
Function Type: Workflow ("On Deceased Pickup Create", id 6503357000068702927, Deceased_Pickups on create)
Trigger Source: Deceased_Pickups record created
Input Arguments: pickupId (Int)
Connection Name: zohooauth
Related Fields: Deceased_Pickups.NOK_First_Name/NOK_Last_Name/NOK_Relationship/NOK_Phone/
NOK_Email (text, written by NOK_Information_Form.ds), Deceased_Pickups.NOK_Contact (lookup),
Deals.Contact_Name
Related Modules: Deceased_Pickups, Contacts, Deals, Operations
Created By: fix by Claude Code, 2026-08-06 and 2026-08-07 (two related fixes to the same function)
Last Updated By: Claude Code
Sandbox Tested: No — tested live
Production Deployed: Yes
Production Deployment Date: 2026-08-06 (fix #1) and 2026-08-07 (fix #2)
Notes:

Two stacked bugs in the same function, found and fixed in sequence:

FIX #1 (2026-08-06): onDeceasedPickupCreate never converted the NOK's plain text fields
(written onto Deceased_Pickups by NOK_Information_Form.ds) into an actual CRM Contact. The
Hospital branch never attempted it at all. The Police branch tried to read
dp.get("NOK_Contact").get("id") — a lookup field nothing upstream ever populated, always
resolved empty. Root-caused via live testing that confirmed Hospital/Police NOK info reached
the intake record fine but never became a Contact for either case type. Fix: build the
Contact from the real text fields (find-by-email if present, else create), once, ahead of the
isHospital/isPolice branching, and link it via Deals.Contact_Name in both branches.

FIX #2 (2026-08-07): after FIX #1 shipped, testing surfaced a follow-on bug — completing a
Hospital/Police trip through the Driver App created a SECOND, duplicate Contact. Root cause:
a separate, pre-existing function, automation.onDeceasedPickupCheckIn (fires on driver
check-in/trip completion), already has its own correct find-or-create NOK logic keyed off
Deceased_Pickups.NOK_Contact — but FIX #1 never wrote the newly-created Contact back onto that
field, so check-in always found it empty and created its own duplicate, overwriting
Deals.Contact_Name to point at the duplicate. Confirmed against a real test Deal
(crm.zoho.com/.../Potentials/6503357000077020001) — two Contact_Roles entries, both the same
name, ~2.5 minutes apart. Fix: write the Contact back onto Deceased_Pickups.NOK_Contact
immediately after creating/finding it.

Known follow-up (not part of this task): the duplicate Contact left on the flagged test Deal
from before FIX #2 needs manual cleanup — not something achievable via read-only CRM access.
