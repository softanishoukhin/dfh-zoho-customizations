# Reconciliation -- "DFH_Ops_App_and_Family_Viewing_Requests_2026-10-05.md" (as of 2026-10-07)

Every item in Andrea's document, with where it was done. Tickets: ZP-TBD-99 (Ops App round 2 + DA + TM),
ZP-TBD-100 (Funeral Preparation app), ZP-TBD-101 (stage reset fix, found in testing), ZP-TBD-102
(Casket edit queue), ZP-TBD-103 (Funeral Equipment parent product).

## Operations App
| Item | Status | Where |
|---|---|---|
| New CRM fields Removed for Autopsy, In Fridge Aisle | Live | ZP-TBD-99 |
| Both fields in opsSaveFields and the view queries | Live | ZP-TBD-99 |
| R4b: Police OR Autopsy Required, in our care, no date | Live | ZP-TBD-99 |
| R4b: save also sets Autopsy Required = Yes, workflows on | Live | ZP-TBD-99 |
| R4: time/location edits save with workflows | Live | ZP-TBD-99 |
| R4: Remove from fridge date, Removed for Autopsy tick, In Fridge Aisle | Live | ZP-TBD-99 |
| All Deceased: hide after date (deal-type table) | Live | ZP-TBD-99 |
| All Deceased: In Fridge Aisle + Removed for Autopsy on the detail panel | Live | ZP-TBD-99 |
| R1: In Fridge Aisle in Fridge # and its edit window | Live | ZP-TBD-99 |
| R2: no change | -- | -- |
| R3: exclusions, hide after date, rule removed, "to be embalmed" total | Live | ZP-TBD-99 |
| R3: Richard Bourke troubleshoot | Done (cause found) | ZP-TBD-99 -- question to Andrea on Ashes in Church |
| R6: reuse in Funeral Prep, then remove once Funeral Prep is live | Built 2026-10-07: removed from the Ops portal menu (code kept) -- needs Ops widget re-upload | ZP-TBD-100 |
| R7: no change | -- | -- |

## Driver App
| In Fridge Aisle tick at morgue check-in -> saveMorgueCheckin | Live | ZP-TBD-99 |
| (Hospital/police multi-body check-in) | Not built -- question to Andrea | ZP-TBD-99 |

## Trip Manager
| Upcoming Autopsies: Remove from fridge, Removed for Autopsy (RO), In Fridge Aisle (RO) | Live | ZP-TBD-99 |

## Funeral Preparation app
| Item | Status | Where |
|---|---|---|
| New Creator app, portal, pages, Custom APIs | Live, all tests passed | ZP-TBD-100 |
| Two users, two parts | Live | ZP-TBD-100 |
| Replaces the Embalming Complete email | Live -- the old email still goes out until Andrea says stop (question) | ZP-TBD-100 |
| Both form versions, same fields, same Deal writes | Live | ZP-TBD-100 |
| Funeral_Viewing_Form_Submitted fires the existing workflows, same CRM result | Live (CRM function patched to accept the app's submit) | ZP-TBD-100 |
| Reuse Report 6 code | Done | ZP-TBD-100 |
| Deceased_Status values Ready for Viewing / Transfer Received (CRM + Ops App) | Live | ZP-TBD-100 |
| Part 1: viewing list, Transfer Received (placeholder), Ready for Viewing, form, changes to complete | Live | ZP-TBD-100 |
| Part 2: funerals for the day ahead + sections 1-5 | Live | ZP-TBD-100 |
| Easel and Lighting $0 products | Lighting in use; Easel to confirm | CRM |
| Dev advice on a new parent product | Done -> Andrea approved "Funeral Equipment" | ZP-TBD-103 (built, not deployed) |

## Casket Management app
| Edit queue: one list, acknowledge (close) each edit, acknowledged no longer new | Built, not deployed | ZP-TBD-102 |
| Notification per new edit (Dale's alternative) | Not built -- optional | -- |

## Found during the work (not in the document)
| Any Deal edit resets Stage to Funeral Scheduled | Fix built, waiting for Andrea's OK | ZP-TBD-101 |
| Deal Casket Type is rebuilt from the casket product line | App adjusted (read only / Mark checked) | ZP-TBD-100 |
| Programmes field missing from the burial (FB) Deal layout | Added by the admin | ZP-TBD-100 |

## Still open with Andrea
1. Embalming: leave out Cremation with Service "Ashes in Church"?
2. In Fridge Aisle on the Driver App hospital/police multi-body check-in?
3. Upcoming Autopsies: look further than 2 days ahead?
4. Clear Row / Drawer when In Fridge Aisle is ticked?
5. Stop the old Zoho Form email now the app is live?
6. Cremation Only gets the cremation form version -- OK?
7. Family contact for the driver -- also on the driver sheet?
8. Hide discount lines ("Less ...") on the load lists?
9. Apply the stage-reset fix (ZP-TBD-101)?

## Documents to update when the Google Docs connector is back
- Operations Portal tab: remove Part 9 (Family Viewing Forms), its menu-table row and its Appendix A row;
  point to the Funeral Preparation tab instead.
- Funeral Preparation tab, Section 4: add Funeral Equipment to the categories.
