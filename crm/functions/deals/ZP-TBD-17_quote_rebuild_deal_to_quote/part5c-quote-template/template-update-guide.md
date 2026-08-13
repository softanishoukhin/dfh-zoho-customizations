# Quote PDF template -- group by parent category (Part 5c)

## STATUS (2026-08-13): field approach approved, plumbing built. Template layout itself still open.

Andrea's spec for this part is one sentence: "Update the quote print/PDF
template so products are grouped by the same parent categories and use the
same child-product filtering as the deal subtable." Investigating what that
actually requires turned up a real prerequisite the spec doesn't mention.
**Decision (a) below is now confirmed: add the new field.** Decision (b) --
the exact grouping/filtering behavior for the template itself -- is still
open.

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
each Quoted_Items row. Four steps, in order:

### 1. New custom field on Quoted_Items -- DO THIS FIRST, in Zoho's UI

Mirrors `Sales_Orders.Ordered_Items.Parent_Product` /
`Invoices.Invoiced_Items.Parent_Product` exactly (config pulled and
confirmed live 2026-08-13):

- **Setup > Customization > Modules and Fields > Quotes** -> open the line
  item / Product Details section (the Quoted_Items subform editor)
- **New Field > Lookup**
- Field label: **Parent Product**
- api_name: **`Parent_Product`** (must match exactly -- the Deluge changes
  below and the existing convention on Sales_Orders/Invoices both assume
  this exact name)
- Looks up to module: **Products**
- Not mandatory, not unique (matches the Sales_Orders/Invoices field's
  config exactly)

After creating it, add it to the Quotes line-item layout so it's visible
(same layout section as Product Name / Quantity / etc.).

### 2. `pullProductsFromDeal` -- DONE, already updated

The repo's `../part5a-pull-button/pullProductsFromDeal.deluge` now also
reads each Deal product row's `Parent_Product` lookup and writes it onto the
corresponding Quoted_Items row, the same way `Discount` is already written
(custom fields use their real api_name, not the lowercase
product/quantity/list_price system-field write keys). **Re-paste that file
into the live function after creating the field in step 1** -- if you
already deployed the version without this, the field won't populate on
Quotes pulled before the re-paste; pull again on any Quote that needs it.

### 3. `generateQuotePdf` -- built, NOT yet applied live

`generateQuotePdf_ADD_PARENT_PRODUCT.deluge` (this folder) is the full live
function with exactly one addition: each row now also reads
`Parent_Product.name` and passes it to the merge data as
`Quoted_Items.Parent_Product_Name`. Paste this into the live
`generateQuotePdf` function once step 1 exists -- it's a pure addition, all
existing PDF generation/upload/link logic is untouched.

**Before trusting the merge field name**: once the CRM field exists, re-run
the Writer field inspector against the template (or just open the template
in Writer and use Insert > Merge Field) to confirm it actually offers
`Quoted_Items.Parent_Product_Name` as a mergeable field -- Writer's field
picker derives these names from the CRM field automatically, but confirm
rather than assume the string matches exactly.

### 4. Restructure the Writer template itself -- STILL OPEN, needs decision (b)

Grouping/sectioning the repeating table by `Parent_Product_Name`, and
applying whatever "same child-product filtering as the deal subtable" means
concretely, is manual work in Writer's own document editor (Insert > Merge
Fields, table/section grouping) -- not achievable purely through the API
tools available this session.

**Still needed before this step can start**: a concrete example of what
"same child-product filtering as the deal subtable" should look like --
a screenshot or specific description of the Deal subtable's grouped/filtered
view today, so the template mirrors it exactly rather than guessing at
Andrea's intent from the phrase alone.
