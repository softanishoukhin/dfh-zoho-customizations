# Rollback

Each phase is independently reversible while adjacent phases haven't
started -- this is exactly why `deployment-checklist.md` phases things out
and tests between each one. If something goes wrong mid-phase:

## Phase 1 (client scripts) rollback

The full original content of all 16 live scripts was captured before this
task started (2026-08-13) and is preserved verbatim in this session's
investigation notes / can be re-pulled live from Zoho's own script version
history (Setup > Developer Space > Client Scripts keeps prior revisions --
each script listing showed a `precedence`/revision history via its
`hosting.url` filerevision path, e.g. `.../filerevision/r14/...`). If a
trimmed script causes a problem, the fastest fix is usually forward (fix the
trimmed version), but if a full revert is needed, use Zoho's own script
history to restore the prior revision rather than reconstructing from
memory.

## Phase 2 (SO-function guards) rollback

Re-add the exact 8-line block from `part4-removal/so-function-guard-removal.md`
to the top of whichever function needs it back. Trivial, self-contained,
no side effects to unwind.

## Phase 3 (function/button deletion) rollback

If deleted (not just deactivated), these would need to be rebuilt from the
ZP-TBD-9 folder's originals (`../ZP-TBD-9_quote_creation_and_so_suppression/`)
-- this is exactly why `deployment-checklist.md` suggests deactivating first
and only hard-deleting after a confirmed safety window.

## Phase 4 (Pull button) rollback

Deactivate/delete the button, delete `pullProductsFromDeal`. No other
system depends on it -- fully isolated.

## Phase 5 (Closed-Lost cleanup) rollback

**Deactivate the workflow rule immediately if anything looks wrong** -- this
is the only phase in this task with an irreversible real-world effect
(deleted Books/CRM records can't be un-deleted). Deactivating the rule stops
any further deletions instantly; it does not undo ones already made. This is
exactly why Phase 5 in the checklist insists on non-production/already-settled
test Deals first, and why the function's own design (Books-first,
keep-CRM-record-on-Books-failure) exists -- to minimize the chance of a
partial, hard-to-diagnose failure state.

## Full rollback to ZP-TBD-9's behavior

Not recommended and not prepared as a turnkey script -- ZP-TBD-9's own
`rollback.deluge` exists in its folder, but reverting all the way back means
re-introducing the exact popup/race/inconsistency problems Andrea's
post-mortem identified. If something here needs backing out, prefer fixing
forward within this task over reverting to the prior design.
