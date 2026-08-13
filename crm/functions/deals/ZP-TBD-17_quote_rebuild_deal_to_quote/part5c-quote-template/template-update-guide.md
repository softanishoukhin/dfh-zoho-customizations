# Quote PDF template -- group by parent category (Part 5c)

## STATUS (2026-08-13): DONE -- field, data plumbing, and grouping all confirmed live.

Andrea's spec for this part: "Update the quote print/PDF template so
products are grouped by the same parent categories and use the same
child-product filtering as the deal subtable." The `Quoted_Items.Parent_Product`
field exists, `pullProductsFromDeal` writes it, `generateQuotePdf` passes it
to the merge, and the user has since applied Zoho Writer's native **Group
By** merge-field feature (see step 4 below) to actually group the template's
line items into sections by category -- confirmed by the user 2026-08-13:
"template is grouped." The core ask is met.

**Still open, secondary, not blocking**: whether "same child-product
filtering as the deal subtable" needs anything beyond what grouping already
provides -- worth a quick look at a generated Quote PDF against the Deal's
own subtable view side by side, and flag to Andrea only if something looks
genuinely missing (e.g. a category or product she'd expect visible isn't,
or one that should be hidden appears). Not assumed to be a gap -- just not
independently re-verified this session.

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

### 3. `generateQuotePdf` -- DONE, confirmed against live template (2026-08-13)

`generateQuotePdf_ADD_PARENT_PRODUCT.deluge` (this folder) is the full live
function with exactly one addition: each row now also reads
`Parent_Product.name` and passes it to the merge data as
`Quoted_Items.Parent_Product` -- confirmed via `ZohoWriter Get_All_Fields`
against the live template after the field was added, which returned exactly
that key (not `Quoted_Items.Parent_Product_Name`, an earlier guess that was
corrected once the real key was confirmed). Applied live by the user.

### 4. Restructure the Writer template itself -- NOT done, confirmed 2026-08-13

The user added `Parent Product` as a **plain column** to the existing flat
table -- confirmed directly. The core of Andrea's ask ("products are grouped
by the same parent categories") is still unmet: the PDF still shows one
flat list of every line item in whatever order they were pulled, just with
an extra column now showing which category each one belongs to. That's real
progress (the data is finally on the page) but it is not grouping.

Grouping/sectioning the repeating table by `Parent_Product` is manual work
in Writer's own document editor -- not achievable through the API tools
available this session (no tool here can edit a Writer document's layout).
But it's not a guess at a generic capability -- Zoho Writer has a **native
"Group By" merge-field feature built for exactly this** (confirmed via
Zoho's own documentation, 2026-08-13):

### How to actually do it (per Zoho's documentation)

1. Open the template in Writer's own editor (not the CRM's function editor)
   -- `Automate > Setup Data Source and Fields` if the repeat block isn't
   already configured.
2. The `Quoted_Items` repeating table is presumably already inserted as a
   repeat block (it merges today, just flat) -- if not already, insert the
   product line items as a repeat block first.
3. With the repeat block selected, find the **Group By** icon next to the
   data fields panel (Zoho's docs describe it as "adjacent to your data
   fields" -- exact click target should be confirmed live in the editor,
   the fetched documentation summary wasn't pixel-precise about location).
4. In the Group By popup: give the GroupSet a name, and select
   `Quoted_Items.Parent_Product` as the field to group by. This organizes
   the merged rows into sections by each unique category value automatically
   -- Zoho's docs describe this as "especially useful when dealing with
   tabular data like invoices, reports, or summaries," which is exactly this
   case.
5. Zoho Writer also supports aggregate functions (SUM/AVG/MAX/MIN) per
   group once grouped, if a per-category subtotal is wanted (not asked for
   in the spec, but available if useful -- confirm with Andrea before adding
   scope not requested).

Sources: [How to customize output with groupby and aggregate fields in merge](https://help.zoho.com/portal/en/kb/writer/automation-guide/merge-configuration/articles/writer-mail-merge-groupby-aggregate-data), [Group, aggregate, and present data in Zoho Writer's merge templates](https://www.zoho.com/writer/groupby-and-aggregate-data.html)

**Still open, separate from the grouping mechanic above**: exactly what
"same child-product filtering as the deal subtable" should mean -- a
screenshot or specific description of the Deal subtable's grouped/filtered
view today would remove any ambiguity here. This is a smaller, secondary
question from the main grouping ask (which the Group By feature above
answers directly) -- doesn't need to block starting the Group By setup.
