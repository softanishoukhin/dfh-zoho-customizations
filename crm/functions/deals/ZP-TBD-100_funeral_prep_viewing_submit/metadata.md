Task ID: ZP-TBD-100 (CRM part)
Function: automation.sendEmailToOwnerToReviewFuneralViewingForm (id 6503357000008121029)
Called by workflow "Send Email to Owner to Review the Funeral Viewing Form" (6503357000008121082)
Status: built 2026-10-06 from the live code, NOT applied.

## Why
The Funeral Preparation app (Creator, ZP-TBD-100) recreates the Family Viewing Form and writes
the same Deal fields through the CRM API, setting Funeral_Viewing_Form_Submitted in the same
update. The workflow fires, but this function only acted on a Timeline entry whose source is
`zoho_forms` -- and only looked at the very first entry -- so an app submission would create no
tasks, move no funeral time and send no emails.

## Change (Timeline loop only)
- Loops over the Timeline entries of the last 10 minutes and processes the first one that is:
  a `zoho_forms` update (as before), OR a non-`workflow` update whose field history includes
  `Funeral_Viewing_Form_Submitted`.
- `workflow` entries are skipped, so the rule's own "Unselect Funeral Viewing Form Submitted"
  field update is never taken for the submission.
- Everything inside (funeral-time move + task + location email; appearance task + viewing email;
  grave-type task + trip alert + location email) and everything after the loop (owner email) is
  byte-for-byte the live code.
- An app submission has no form PDF on the Deal, so the owner email goes without an attachment
  (agreed with the user 2026-10-06).

## Deploy
Setup > Developer Hub > Functions > sendEmailToOwnerToReviewFuneralViewingForm > replace the body
with `sendEmailToOwnerToReviewFuneralViewingForm_UPDATED.deluge` > Save. No workflow change.
