# DFH Zoho Customizations

Source-of-record repository for all Zoho Deluge / custom function / workflow work for
Delapenha Funeral Home (DFH), per *Developer Instruction Guide: Git Setup for Zoho Deluge
and Custom Function Work*.

Zoho CRM org: `871210233` (delapenhafuneralhome)

## Why this repo exists

DFH's Zoho environment (CRM, Creator, Books) has no native shared source control — multiple
people edit functions and workflows directly in the live/sandbox environment. This repo is
the version control, code review, rollback, and client-visibility layer described in the
guide. It does not run anywhere itself; code here is copy-pasted into the live Zoho function
editors following each task's `deployment-checklist.md`.

## Folder structure

```
crm/functions/{module}/{ZP-TASKID}_{short_description}/
    function.deluge
    metadata.md
    test-cases.md
    deployment-checklist.md
    rollback.deluge
crm/workflows/{module}/{ZP-TASKID}_{short_description}.md
crm/buttons/{module}/
crm/schedules/
books/functions/{module}/
inventory/functions/
creator/functions/{app}/{ZP-TASKID}_{short_description}/
creator/pages/
creator/forms/
shared/field-api-names/       -- field API name references per module
shared/api-payloads/          -- sample request/response JSON for external integrations
shared/connection-notes/      -- Zoho Connection names and what they're used for
release-notes/{date}.md       -- end-of-day rollups
```

## Rules (see the guide for full detail)

- No production code changes without first saving the code in Git.
- One branch per Zoho Projects task: `zp-taskid-short-description`.
- Every commit references the task ID: `ZP-123: message`.
- No tokens, secrets, passwords, or real customer data in this repo — use Zoho Connections
  and placeholders (see `shared/connection-notes/`).
- No hardcoded record/owner/layout IDs where avoidable — if one is unavoidable, document it
  in that task's `metadata.md`.

## Status note (2026-07-03)

This repo was just created. The first task folders below backfill work completed *before*
this process existed, so the branch/PR history for them doesn't exist retroactively — only
the code, metadata, and test results are backfilled. All Zoho Projects task IDs are
placeholders (`ZP-TBD-n`) pending real task numbers from Zoho Projects; update them and
rename the folders once assigned.
