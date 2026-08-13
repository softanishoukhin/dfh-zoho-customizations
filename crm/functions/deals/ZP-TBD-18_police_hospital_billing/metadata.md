Task ID: ZP-TBD-18 (placeholder)
Zoho App: CRM (Deals, Operations, Deceased_Pickups, Sales_Orders, Products, Trips)
Created By: Claude Code, 2026-08-14
Sandbox Tested: No
Production Deployed: No -- guideline only, per this repo's standing practice.

## Source documents (provided by Andrea, `D:\Office\Andrea_Projects\DFH\projectDocuments\`)

`PH_Billing_Requirements_FINAL.md`, `DEVELOPER_BUILD_DOC.md`,
`FUNCTION_SOURCES.md`, `MS_SHIRLEY_FOLLOWUP.md`.

## Andrea's instruction (2026-08-14)

"Get started ingesting everything...making sure it's all clear...and please
come back to me with any questions or clarifications. I have a couple follow
up items to address tomorrow, but you can get started on what's safe/clear...
if CC inserted anything questionable...please verify with me... Let me know
what you were able to address in completion report."

## What this pass actually did

1. **Verified, not assumed.** `FUNCTION_SOURCES.md` states it was read from
   the CRM function editor, but several entries are paraphrased with `...`
   gaps rather than verbatim pulls. Per this project's standing rule (live
   source first, never build on a secondhand summary), every function the
   requirements touch was re-pulled in full via MCP before anything was
   built. Two real gaps in the summarized docs were found this way -- see
   `findings/verification-findings.md`.
2. **A live-data audit** (Products module, hospital Storage-product linkage)
   turned up something bigger than the scope it was checking -- see Finding
   2 in the same file. Flagged as likely higher-priority than the new-build
   items themselves.
3. **Built the two safe/clear items** whose requirements, live function
   source, and field-level facts are all fully confirmed with no open
   questions blocking them: **P-1** (LNI 2-day storage cap) and the CRM-side
   half of **D-1** (registration number field + one function's two-line
   change). See their respective subfolders.
4. **Did not build** P-2, P-3, P-4, or H-1's logic -- each has at least one
   real open question (some newly discovered, most already flagged in the
   source docs) that a guess would paper over rather than resolve. See
   `findings/open-questions-consolidated.md`.

## Folder contents

- `P-1_lni_2day_cap/StorageFeebasedonLetterofNoInterestWorkflow_UPDATED.deluge`
  -- the full live function (verified, id `6503357000003302110`) with the
  one-line cap added.
- `D-1_registration_number/onDeceasedPickupCheckIn_CHANGES.md` -- new-field
  spec + the exact two insertion points in `onDeceasedPickupCheckIn`
  (verified against the full live function, id `6503357000069144520`), not
  built as a full function file since it's a small, precisely-located
  addition to an ~13KB function -- easier to apply as a diff than
  re-paste the whole thing.
- `findings/verification-findings.md` -- the full verification writeup:
  what matched, what didn't, and why it matters.
- `findings/live-sources-verbatim.md` -- the complete live source for every
  function pulled this pass, for traceability and so later P-2/P-3/H-1 work
  doesn't need to re-pull them.
- `findings/open-questions-consolidated.md` -- every open question, old and
  new, in one place.
- `deployment-checklist.md` -- how to apply P-1 and D-1's CRM-side pieces.

## Explicitly not started (per Andrea's own note: "I have a couple follow up
items to address tomorrow")

P-2 (reschedule trip), P-3 (reschedule billing + Task for Shirley), P-4
(X-ray/radiology), and H-1's actual remediation (beyond the audit that found
the gap) all wait on answers already itemized in
`findings/open-questions-consolidated.md`.
