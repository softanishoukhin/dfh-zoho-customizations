# Deployment checklist -- apply and test in this order

Andrea's words: "make sure there is nothing in here that breaks something
else unrelated," and "make sure ... the core functions this code was added
to are re-tested." Both mean: don't flip everything at once. Each phase
below ends with a real test before moving to the next, so if something's
wrong, it's caught with the smallest possible blast radius and the clearest
possible cause.

## Phase 1 -- Trim the 16 client scripts (Part 4)

1. For each of the 16 scripts in `part4-removal/client-scripts/`, open the
   matching live script (by the id in `metadata.md`'s inventory table) in
   Setup > Developer Space > Client Scripts, and replace its content with
   the `_TRIMMED.js` version.
2. **After EVERY SINGLE ONE**, before moving to the next: open a test Deal
   on that exact layout/page, add a product, Save. Confirm:
   - No popup appears.
   - No error in the browser console.
   - `Trigger_Based_On_Subform` gets stamped (check the field value updates
     to ~now+1 minute) -- **except** on script #15 (Ship-In Create page),
     where per the documented pre-existing gap it will NOT stamp. That's
     expected, not a failure, for that one script only.
3. Do all 16 before moving to Phase 2. Do not leave a mix of old and new
   scripts live longer than it takes to test each one -- a Deal saved
   through an old script while its sibling is new could still hit the
   (now partially dismantled) quote functions.

## Phase 2 -- Remove the SO-function guards (Part 4)

1. Only after all 16 scripts are confirmed trimmed and tested.
2. For each of the 4 functions in `part4-removal/so-function-guard-removal.md`,
   delete the 8-line guard block. Save.
3. After EACH function: trigger it for real (create/edit a Deal with
   products on that pipeline, wait ~1 minute or manually re-trigger
   `Trigger_Based_On_Subform`) and confirm the Sales Order + Invoice are
   created correctly, same as before this whole task started. This is the
   "re-test the core functions" Andrea asked for -- see `test-cases.md`
   Section A for the full per-pipeline matrix.

## Phase 3 -- Delete the now-unused functions and buttons (Part 4)

Only after Phases 1-2 are both confirmed working for a few real saves. See
`part4-removal/functions-and-buttons-to-delete.md`. Deactivate first if you
want a safety window before hard-deleting.

## Phase 4 -- Build the Pull Products from Deal button (Part 5a)

Follow `part5a-pull-button/button-setup.md`. Test per `test-cases.md`
Section B before moving on -- this one is low-risk (doesn't touch billing at
all), but confirm it anyway.

## Phase 5 -- Build the Closed-Lost cleanup (Part 5b)

**Highest-risk phase -- this permanently deletes Zoho Books records.**
Follow `part5b-closed-lost-cleanup/workflow-setup.md`. Before activating the
workflow rule for real:

1. Confirm the criteria targets the correct Stage value(s) and pipelines
   (see the open questions in that doc -- Closed Lost vs. Closed Lost to
   Competition, and confirming Wholesale truly has no closed stage).
2. Run every scenario in `test-cases.md` Section C on non-production or
   already-settled test Deals first if at all possible.
3. Only then activate against real data.

## Phase 6 -- Quote template grouping (Part 5c)

**Not started.** Needs a decision first -- see
`part5c-quote-template/template-update-guide.md`. Do this phase last
regardless, since it depends on nothing else in this task and nothing else
depends on it.

## Rollback

See `rollback.md` if any phase needs to be backed out.
