# Quote PDF template -- group by parent category (Part 5c)

## STATUS: investigated, NOT built -- needs a decision before implementation

Andrea's spec for this part is one sentence: "Update the quote print/PDF
template so products are grouped by the same parent categories and use the
same child-product filtering as the deal subtable." Investigating what that
actually requires turned up a real prerequisite the spec doesn't mention, so
per the same "stop and raise it" instruction that applied to the Ship-In gap,
this is being flagged rather than built on an assumption.

## What's confirmed live (2026-08-13)

- The current Writer template ("Quote – Merge Template.zdoc", document id
  `0votx2af8768ad5a3464fabc49a89d3f4abb1`) has ONE flat repeating table over
  `Quoted_Items`, with merge fields: `Product_Name`, `Quantity`, `List_Price`,
  `Discount`, `Tax`, `Net_Total`. No category/grouping field exists in the
  template at all -- confirmed via the Writer API's field inspector.
- `standalone.generateQuotePdf` builds that flat list by reading the Quote's
  own `Quoted_Items` subform and passing through those same six fields, per
  row, with no category information -- confirmed by pulling the live
  function in full.
- **The Quote's `Quoted_Items` subform does not currently carry a
  Parent_Product (category) field at all.** The function that builds a
  Quote's line items (today: `createOrUpdateQuoteFromDeal`; going forward:
  `pullProductsFromDeal`, see `../part5a-pull-button/`) only ever writes
  `product` / `quantity` / `list_price` / `Discount` per row -- never a
  parent/category reference.
- By contrast, `Sales_Orders.Ordered_Items` and `Invoices.Invoiced_Items`
  **do** carry a `Parent_Product` field per line -- confirmed directly, since
  `deleteFamilyBillingOnClosedLost` (Part 5b) reads `line.get("Parent_Product")`
  off exactly those two subforms as part of its delete-safety guard. So this
  org's inventory line-item subforms CAN carry a category reference -- Quotes
  just doesn't have one today.

## What this means for building 5c as specified

Grouping the quote PDF by parent category needs the category to travel with
each Quoted_Items row, which needs, in order:

1. **A new custom field on the Quoted_Items line-item subform** (Setup >
   Customization > Modules and Fields > Quotes > line item fields),
   mirroring the `Parent_Product` field that already exists on
   Sales_Orders.Ordered_Items / Invoices.Invoiced_Items.
2. **A change to `pullProductsFromDeal`** (Part 5a) to also write that field
   per row -- trivial once (1) exists, since the Deal's own
   `Product_Selection` rows already carry `Parent_Product` (this function
   already reads that subform).
3. **A change to `generateQuotePdf`** to read the new field back and include
   it in the merge data per row (e.g. `Quoted_Items.Parent_Product_Name`).
4. **Restructuring the Writer template itself** to group/section its
   repeating table by that field, and to apply whatever "same child-product
   filtering as the deal subtable" means concretely (this phrase from the
   spec wasn't fully clear from context alone -- worth confirming with
   Andrea exactly what filtering behavior on the Deal subtable this should
   mirror). Grouped/sectioned repeating tables in a Zoho Writer merge
   template are built in Writer's own document editor (Insert > Merge
   Fields, table/section grouping) -- this is a manual document-design task,
   not something achievable purely through the API tools available this
   session.

## Recommendation

Steps 1-3 are small, low-risk, additive changes (a new field + two small
Deluge edits) -- happy to build them once the field is confirmed wanted.
Step 4 is a genuine document-design task that needs someone with Writer
template-editing familiarity (and ideally a concrete example of what the
grouped Deal subtable view looks like today, to mirror exactly, per "use the
same child-product filtering as the deal subtable").

**Not implemented pending sign-off** -- please confirm before this is built:
(a) is a new Parent_Product field on Quoted_Items the right approach, and
(b) what exactly "same child-product filtering as the deal subtable" should
mean for the template (a screenshot or specific example of the deal
subtable's grouped/filtered view would remove any ambiguity here).
