# Hillview Group — exact product tagging table

All ids live-verified 2026-08-21 against the full Products module (1,151 records, paged
completely — this is not a sample). Apply the new `Hillview Group` picklist value to each
product below in the Products module (Setup > Products > open each record > set
`Hillview Group`). Everything not listed here (all catering/food under the Hillview
parent, Miscelleneous, and the 9 supplier-side Headstone products) stays **blank**.

## Hillview 3

| Product | id | Parent_Product |
|---|---|---|
| 0/Sized w/ Headstone Upgrade + Picture | `6503357000065401297` | Hillview (vendor White Services (Headstone)) |
| Reg w/ Headstone Upgrade + Picture | `6503357000065401286` | Hillview (vendor White Services (Headstone)) |
| Hillveiw- Sepulchre | `6503357000001258178` | Hillview |

## Hillview 2

| Product | id | Parent_Product |
|---|---|---|
| 0/Sized w/ Headstone Upgrade | `6503357000065401294` | Hillview (vendor White Services (Headstone)) |
| Reg w/ Headstone Upgrade | `6503357000065401283` | Hillview (vendor White Services (Headstone)) |
| Hillview-Columbarium | `6503357000001258188` | Hillview |
| Preneed(2025) Hillview-Columbarium | `6503357000059207439` | Pre Need |
| Hillview- Vault C/R | `6503357000001258183` | Hillview |
| Preneed(2025) Hillview- Vault C/R | `6503357000059207434` | Pre Need |
| Hillview-vault in Sepulchre section | `6503357000001258190` | Hillview |
| Preneed(2025)Hillview-vault in Sepulchre section | `6503357000059207441` | Pre Need |

## Hillview 1

| Product | id | Parent_Product |
|---|---|---|
| Preneed(2025) Hillview-Preneed- Regular | `6503357000059207440` | Pre Need |
| Preneed(2025) Hillview Vault Reg | `6503357000059207438` | Pre Need |
| Preneed(2025) Hillview Phase1 | `6503357000059207442` | Pre Need |
| Vault- Child | `6503357000001258192` | Hillview |
| Preneed(2025) Hillview Urn Vault | `6503357000059207443` | Pre Need |
| Preneed(2025) Hillview- 1 of 4 in Family plot | `6503357000059207430` | Pre Need |
| Preneed(2025) Hillview- Family Double (Phase 1&2) | `6503357000059207431` | Pre Need |
| Preneed(2025) Hillview- Family plot (4) | `6503357000059207432` | Pre Need |
| Preneed(2025) Hillview- Family plot (8) | `6503357000059207433` | Pre Need |
| Preneed(2025) Hillview- Vault in family plot | `6503357000059207435` | Pre Need |
| Hillview Vault 0/Sized | `6503357000001258185` | Hillview |
| Preneed(2025) Hillview Vault 0/Sized | `6503357000059207436` | Pre Need |
| Hillview Vault 0/Sized Plus | `6503357000001258186` | Hillview |
| Preneed(2025) Hillview Vault 0/Sized Plus | `6503357000059207437` | Pre Need |

**Not mapped — flagged, not guessed:** "Phase 3 Traditional." The only live product with
"Phase 3" in its name is `Hillview Phase 3 Traditional` (id `6503357000065930092`), which
is the catering-parented item, confirmed distinct and out of scope. No standalone match
exists after a full sweep. Skipped per the user's decision (2026-08-21) — Andrea needs to
either point to the correct existing product or confirm one needs to be created.

## Confirmed NOT tagged (stays blank) — the 9 supplier-side Headstone products

All parented under the Headstone product (`6503357000031324015`), all PO-side only, must
never trigger the workflow:

| Product | id |
|---|---|
| Headstone (Half Bible) | `6503357000001258194` |
| Headstone- Bible | `6503357000001258195` |
| Headstone- Gravemarker | `6503357000001258196` |
| Headstone- Oval | `6503357000001258197` |
| Headstone- Oval upgrade | `6503357000001258198` |
| Headstone- Square | `6503357000001258199` |
| Picture on Headstone | `6503357000043945001` |
| Headstone Etching | `6503357000057337152` |
| Test Headstone Product 01 | `6503357000079218005` |

## Pre-existing data inconsistency, not in scope for this rework

`Metal Headstone Dovecot Re Opening` (`6503357000045886553`) and
`Marble Headstone Dovecot Re Opening` (`6503357000045886546`) currently carry
`Include_in_Headstone_Workflow=true` despite being parented under "Outside Cemetery," not
"Headstone." They are not in the brief's Hillview table, so they're left untouched (stay
blank) here — flagged for Andrea to decide on separately.
