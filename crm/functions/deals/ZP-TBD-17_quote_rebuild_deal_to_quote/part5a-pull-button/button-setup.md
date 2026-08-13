# "Pull Products from Deal" button -- setup steps

## 1. Create the function

Setup > Developer Space > Functions > New Function. Paste
`pullProductsFromDeal.deluge`. Confirm the signature is:

```
string standalone.pullProductsFromDeal(String quoteId)
```

## 2. Create the button

Setup > Customization > Modules and Fields > **Quotes** > Buttons > New
Custom Button.

- Button label: **Pull Products from Deal**
- Placement: Quote record detail page, top button bar (per spec 5a: "Native
  custom button on the Quote record's top button bar")
- Action: **Writing Function** -> select `pullProductsFromDeal`
- Argument mapping: `quoteId` <- `{$Quotes.id}`

## 3. Confirm Quote knows its source Deal

`Quotes.Deal_Name` already exists as a native lookup to Deals (confirmed
live 2026-08-13, already populated by the existing quote-creation flow) --
no new field needed. If a Quote is created some OTHER way (manually, not
via a Deal), Deal_Name will be blank and the button will return "This Quote
has no linked Deal to pull products from" -- expected, not a bug, per the
workflow's "Build manually: add products by hand for an independent quote"
path (Part 3).

## 4. Test (see ../test-cases.md for the full matrix)

- Click on a Quote whose Deal has products -> line items populate, matching
  the Deal's Product Selection.
- Edit the Deal's products, click again -> Quote's line items REPLACE with
  the new set (not appended/duplicated).
- Click on a Quote with no Deal_Name -> clear error message, no crash.
- Click on a Quote whose Deal has an empty Product Selection -> clear error
  message, no crash, Quote's existing line items (if any) are left alone
  (the function returns before touching Product_Details).
