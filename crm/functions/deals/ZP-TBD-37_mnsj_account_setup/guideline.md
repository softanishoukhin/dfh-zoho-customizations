# ZP-TBD-37 — Create the MNSJ Account (outstanding billing party)

Requested by Andrea, 2026-08-20: *"please just create the new acct that is outstanding.
client can adjust this."* This was the one genuinely-blocked open item from the 2026-08-19
code map (§3/§8) -- no MNSJ Account/Contact existed anywhere in the system, confirmed by a
name search across Deluge functions and Deal fields at the time. Andrea has now authorized
creating a placeholder Account so the MNSJ billing split (ZP-TBD-38) can be built --
DFH will correct the real name/address/contact details afterward.

## What this does

`createMNSJAccount_ONETIME.deluge` (in this folder) creates:
- One **Accounts** record, `Account_Name = "MNSJ"` -- no address/phone/email guessed, left
  blank for DFH to fill in.
- One **Contacts** record under it, `Last_Name = "MNSJ Billing Contact"` -- a placeholder so
  the Sales Order/Invoice `Contact_Name` lookup (used elsewhere for pulling
  Billing_City/Zip/etc.) has something to resolve against.

It's idempotent -- if an Account named "MNSJ" already exists, it prints that id and does
nothing else, so it's safe to run more than once by accident.

## How to run it

1. Paste the script into a new (or scratch) CRM function in the function editor and
   execute it once (same one-time-script pattern as H-1's
   `linkHospitalStorageProducts_ONETIME.deluge`).
2. Note the Account id it prints (`MNSJ Account created, id = ...`).
3. Carry that id into [[ZP-TBD-38]]'s guideline everywhere it says
   `<MNSJ_ACCOUNT_ID_HERE>`.

## Test

1. Confirm exactly one new Account named "MNSJ" exists after running, with exactly one
   Contact under it.
2. Re-run the script -- confirm it reports the existing Account id and creates nothing
   further (no duplicate).
