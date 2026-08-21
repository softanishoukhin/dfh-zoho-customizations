# ZP-TBD-39 — Test plan

Apply and test in stages, not all at once -- each stage below builds on the last.

## Stage 1 — Trigger and popup (no email/routing yet)

1. Deal + a catering product (blank `Hillview_Group`) → nothing fires, no popup, no
   `Headstone_Request_Sent` write. Confirms the old `Parent_Product=="Headstone"` /
   `Included_Headstone_Product` paths are fully retired.
2. Deal + a Hillview 1 product (from `product-mapping.md`), `Date_of_Death` missing →
   save succeeds, FD sees the info popup naming exactly "Date of Death" as missing;
   nothing is sent to anyone, `Headstone_Request_Sent` stays false.
3. Enter the missing date + tick `Name_Spelling_Verified`, save again → popup does NOT
   appear (nothing missing); `manageZeroRatedHeadstoneProduct` fires and completes the
   routing (Stage 2/3 below).
4. Re-save the same Deal again (no further changes) → confirm nothing re-sends (`Headstone_Request_Sent`
   is already true, function returns early).

## Stage 2 — Hillview 1 (straight to vendor)

5. With a Hillview-1-only Deal and complete data: confirm the vendor receives an email
   with a working edit link (not the family), and confirm no family email/status change
   happens. Confirm `Headstone_Form_Edit_URL` is populated on the Deal.
6. Open the vendor's link -- confirm `Pre_fill_Data` correctly populates `Select_Product`
   for that vendor's Hillview 1 product(s) (this exercises the fixed `Hillview_Group`
   filter from Creator guideline §1).

## Stage 3 — Hillview 2/3 (family first)

7. Deal + a Hillview 3 product, data already complete at save → no popup; family gets the
   form with Oval/Square, epitaph, AND the picture upload; their inputs land on the new
   Deal fields (`Headstone_Shape`, `Headstone_Picture`, and the epitaph field once its
   name is confirmed with Andrea).
8. Repeat with a Hillview 2 product -- confirm the SAME family form does NOT show the
   picture upload, but does show Oval/Square + epitaph.
9. Family submits → vendor gets the draft-request email (unchanged existing mechanism).

## Stage 4 — Vendor draft, rename, and approval/rejection

10. Vendor uploads a draft and ticks the field now labeled **"Ready for Family"** →
    confirm `Headstone_Vendor_Status` is written as `Ready for Family` (the renamed
    picklist value, not the old string) and the family is notified.
11. Family declines in the form → confirm `NOK_Not_Approved` is set to true on the Deal,
    `Headstone_Request_Status` moves to `NOK Review` as before, and the vendor-redraft loop
    continues exactly as it does today.
12. Family approves → confirm `Headstone_Request_Status` moves to `NOK Approved`.

## Stage 5 — PO creation (the fixed bug)

13. Immediately after step 12, confirm a CRM Purchase Order is actually created (this is
    the step that has never worked before the lookup-bug fix) -- open it and verify:
    - `Headstone_PO = true`
    - One PO **per vendor** if the Deal had headstone products from more than one vendor
    - `Vendor_Name` = the correct vendor for each PO
    - `Product_Details` has one line per approved headstone product, correct quantity and
      price (this is the part the old bug silently broke -- the line items should no
      longer be empty)
    - The Deal and Contact are correctly linked on the PO
    - The approved draft file is attached to the Deal

## Stage 6 — PO → Books validation (required, never proven before for a headstone)

14. Confirm the existing "Create Purchase Order to Books" CRM workflow rule fires on the
    new PO (its only criterion is Vendor Name not empty, per the brief -- should fire
    automatically) and the **Purchase Order appears in Zoho Books** against the correct
    Books vendor. If the Books vendor or item mapping fails for any headstone product
    (White Services (Headstone) in particular), fix the mapping before continuing --
    don't treat a missing Books PO as a code bug in this guideline's changes until the
    vendor/item mapping itself is confirmed correct.
15. Confirm matching line items, amounts, and tax treatment between the CRM PO and the
    Books PO.
16. Confirm the Books workflow "Create Bill on Creating PO" fires and a **Bill is created
    in Books** against the vendor, with amounts matching the PO.

## Stage 7 — Full chain, one real Deal, start to finish

17. Run one complete real (or realistic test) Deal through the entire chain: product added
    → popup (if applicable) → data completed → vendor or family routing → draft → family
    approval → CRM PO → Books PO → Books Bill. Record IDs (or screenshot) at each hop as
    evidence, per the brief's explicit request -- "The CRM PO was created" alone is not
    sufficient proof; the Books PO and Bill must be shown too.
