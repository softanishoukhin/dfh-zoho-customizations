Task ID: ZP-TBD-18 / H-1
Zoho App: CRM
Module: Products (data fix), Deals (code fix)
Function Names: standalone.linkHospitalStorageProducts_ONETIME (new, one-time),
automation.UpdateStorageFeeonHospitalReleaseDate (existing, fixed)
Created By: Claude Code, 2026-08-14/15, per Andrea's direct instruction
Production Deployed: Yes -- both pieces run/pasted live and confirmed passing 2026-08-15

## Andrea's instruction (verbatim, 2026-08-14)
"You told me you fixed this on a prior problem and now it's back. So, did you know was a
problem 3 weeks ago and only fixed it for 1 hospital and not the others? This needs to be
fixed. Please explain how this was a known issue and not fixed for all accounts. Each
hospital account record is easy to match its products with the account it goes with."

## Two separate problems, both addressed

**1. Data:** 20 of 21 "Storage for <Hospital>" Products had `Product_of_This_Hospital`
empty; only "HIH Storage Fee" was linked. Each of the 20 was individually verified live
(a direct GET on the matching Account record, confirming Account_Type=Hospital and an
exact name match to the product) before being included in the fix script -- not a blind
name-search guess. See `linkHospitalStorageProducts_ONETIME.deluge` for the full verified
id-pair list and per-pair notes.

**2. Code:** `UpdateStorageFeeonHospitalReleaseDate`'s Hospital branch has no fallback when
the per-hospital product lookup returns zero rows -- unlike its own Police branch, which
already falls back to the standard police storage product. This is why the gap was
"silent" -- no error anywhere, the billing block was just skipped. See
`UpdateStorageFeeonHospitalReleaseDate_FIX.deluge`.

## Deploy
1. Run `linkHospitalStorageProducts_ONETIME.deluge` once via Setup > Developer Space >
   Deluge Debugger (or a temporary Standalone function), then archive/delete it -- it's a
   one-shot repair, not a recurring process.
2. Paste `UpdateStorageFeeonHospitalReleaseDate_FIX.deluge` over the live function of the
   same name.
3. Test: find or create a Hospital Cases Deal for one of the 20 newly-linked hospitals,
   set Initial_Trip_Completed_At and Hospital_Release_Date, confirm the Sales Order gets
   the correct hospital-specific storage product (not the police fallback) at the right
   day count.
4. Confirm the fallback path (paste-in-place, then temporarily unlink one hospital to
   test) writes the info log message and still bills correctly on the fallback product,
   rather than silently doing nothing.

## Not included
"Storage for Princess Margaret Hospital" -- different Product_Category than the other 21,
matching Account not found in the same id block. Needs manual lookup before linking.

## Round 2 -- deployed and tested (2026-08-15)
User ran `linkHospitalStorageProducts_ONETIME.deluge` live (21 linked) and pasted
`UpdateStorageFeeonHospitalReleaseDate_FIX.deluge` over the live function. Confirmed passing.

**Important context from the user, worth carrying forward:** in practice, DFH's actual
hospital-storage caseload only touches four hospitals -- **National Chest, Cornwall
Regional, University Hospital of the West Indies, and Hope Institute Hospital** -- and all
four already had `Product_of_This_Hospital` correctly set *before* this fix ran. So the
20-hospital data fix, while real and now correct, was not actually blocking any live
billing case at the time it was found -- the silent-failure risk it closed was latent
(would have mattered the moment a hospital outside these four was used), not actively
broken for current casework. Both the code fallback fix and the full 21-hospital link are
still valid and deployed; this is just the accurate story on real-world impact, to be
communicated to Andrea via the completion note rather than overstating urgency.

## Round 3 -- live correction to the fallback product (2026-08-15)
User applied one further correction directly to the live function: the fallback product
used when a hospital has no linked Storage product was changed from the police storage
product (`6503357000002869275`, my original suggestion) to a NEW dedicated product the user
created for this purpose -- **"Storage for Hospital"** (id `6503357000078744158`,
Product_Category "Storage", Product_Code `STORAGEFORHOSPITAL`). This is the correct call --
billing an unlinked hospital case on the police storage product would have been
semantically wrong (different rate, wrong reporting bucket) even as an emergency fallback.

**Flag:** this new fallback product's `Unit_Price` is currently `0`. If the fallback path
ever actually fires, the line item bills at $0 until a real price is set. Worth confirming
the intended rate with Andrea/Shirley, or at minimum setting a sane default so this doesn't
silently under-bill if it's ever hit.

Repo file (`UpdateStorageFeeonHospitalReleaseDate_FIX.deluge`) updated to match the live
corrected version exactly.
