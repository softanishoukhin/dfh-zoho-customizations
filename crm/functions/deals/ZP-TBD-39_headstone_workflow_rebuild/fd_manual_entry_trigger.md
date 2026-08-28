# FD manual entry — headstone process was never actually wired to fire

**Andrea's ask (2026-08-28, new task in the Headstone request process series):** a Funeral
Director should be able to sit with the family and manually fill in the Deal fields himself
(instead of the family completing the online form), and that should trigger the same headstone
process — vendor gets notified with all the required information, exactly as if the family had
submitted it. Andrea's own assumption: the required fields already exist on the Deal, so this
"might already work." She asked us to check first, and only build something if it doesn't.

## Finding: it doesn't — nothing currently calls the trigger function at all

Traced every place that could plausibly fire `standalone.manageZeroRatedHeadstoneProduct`
(the function this whole ZP-TBD-39 rebuild already rewrote — see `guideline.md` §4) and found
**none of them actually call it**:

- **The FD completeness-check client script** (`checkHillviewCompleteness`, on the `Funeral_w_Burial`
  Deal edit page, confirmed live) only reads the `Product_Selection` subform for a
  `Hillview_Group`-tagged line, then checks `Date_of_Birth`/`Date_of_Death`/`Name_Spelling_Verified`
  and shows a `ZDK.Client.showAlert(...)` listing what's missing. It **never calls the headstone
  function** — it only nags the FD about missing fields, then always lets the save proceed
  (`return $Lt._aR(true)` unconditionally).
- **No Deals workflow rule references it**, checked exhaustively across every trigger type live
  (`create`: 4 rules, `edit`: 3, `create_or_edit`: 3, `field_update`: 46, `date_or_datetime`: 42
  — every single one inspected by name and, where a Deal-field-update lookalike appeared,
  fetched in full to confirm its actual action).
- **The org's own generic "any field update" dispatcher**
  (`automation.handleWorkflowTriggerAndActionByTimelineProcess`, wired to fire on literally every
  Deal edit via the "Custom Manage - Trigger on Any Field Update" rule, and which explicitly
  checks dozens of individual field names to route to the right sub-process) has **no branch at
  all** for `Name_Spelling_Verified`, `Date_of_Birth`, `Date_of_Death`, or `Hillview`/Headstone
  fields.

**Conclusion:** this isn't an FD-specific gap — the whole automatic trigger was apparently never
finished being wired up after the ZP-TBD-39 rebuild landed. Today, *nobody's* edits fire the
vendor notification automatically — not an FD typing the fields directly, and not the family
completing their own form either, unless something manually invokes the function (e.g. directly
via API/testing).

## Fix (guideline — apply directly in CRM; no write-capable MCP tool exists for CRM functions
or workflow rules)

**Step 1 — new function**, a thin wrapper (workflow instant actions in this org call
`automation.`-prefixed functions, not `standalone.` ones directly — same convention as everywhere
else in this codebase):

```
void automation.triggerHeadstoneProcessOnCompletion(Int crmid)
{
	try
	{
		standalone.manageZeroRatedHeadstoneProduct(crmid);
	}
	catch (e)
	{
	}
}
```

**Step 2 — new Deals workflow rule**, matching the exact shape of the existing "Hillview Notify
Family" rule (field_update, `repeat: true`) and "Update NOK and SFH form completed status"
(OR-group across multiple fields):
- **Name:** e.g. "Trigger Headstone Process on Completion"
- **Module:** Deals
- **Trigger:** On a field update — `repeat: true`
- **Criteria:** any value change on `Name_Spelling_Verified` **OR** `Date_of_Birth` **OR**
  `Date_of_Death`
- **Instant action:** `automation.triggerHeadstoneProcessOnCompletion`

This means whichever of the three fields gets filled in *last* (by the FD directly, or by
whatever already updates them from the family's form) fires the check — `manageZeroRatedHeadstoneProduct`
itself already re-validates all three are present and only proceeds once they all are, so it's
safe for this to fire multiple times as each field gets filled in one at a time.

## Known limitation to flag for Andrea

This only fires off the three named fields. If an FD adds the Hillview-tagged headstone product
to the Deal *after* all three fields are already filled in (rather than before), nothing
re-triggers the check at that point, since the product-selection subform isn't part of this new
rule's criteria. Practically: as long as the FD's step-by-step order is "make sure the headstone
product is on the Deal, then fill in the three fields" (see the FD instructions below), this
isn't an issue — but if the product could plausibly be added last, a second workflow rule keyed
off the `Product_Selection` subform would be needed too. Flagging this so Andrea can confirm
which order actually happens in practice before we decide whether it's worth the extra rule.

## Simple step-by-step instructions for the FD (once the above is applied and tested)

1. Open the Deal for the family sitting with you.
2. Make sure the headstone product the family chose is already added to the Deal's product list
   (Product Selection).
3. Fill in (or confirm) the deceased's **Date of Birth** and **Date of Death**.
4. Check the **Name Spelling Verified** box once you've confirmed the spelling with the family.
5. Save the Deal.
6. That's it — the vendor is notified automatically the same way it would be if the family had
   filled out the form themselves. No separate form, no extra button.

## Status

Not yet applied — pending the user creating the wrapper function and the workflow rule from this
guideline, then testing: (1) a Deal with a Hillview-tagged product, fill in the 3 fields
manually as an FD would, save → confirm the vendor gets notified / family gets the form,
whichever routing applies; (2) confirm a Deal missing one of the 3 fields does **not** fire
anything yet, and the FD popup still nags about what's missing, unchanged from today.
