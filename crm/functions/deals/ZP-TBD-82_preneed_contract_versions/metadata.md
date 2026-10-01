# ZP-TBD-82 -- Pre-Need contract versions (Full / 1-Page) driven by payment status

**Folder number is a placeholder** -- rename once a real Zoho Projects task ID exists.

**Status: built 2026-09-29, NOT applied, NOT tested.** Apply per `guideline.md`. Depends on ZP-TBD-81.

## Request (Andrea, 2026-09-29)

Two contract versions: **Full** (new first page + all existing legal pages) and **1-Page** (new first page only).
- Lump Sum -> Full contract.
- Installments -> no contract at first; 50% deposit paid (Fygaro or cash/check in Books) -> 1-Page; all installments
  paid, balance 0 -> Full contract for signature.
- The right contract URL generated automatically under these conditions.

## Decisions (user, 2026-09-29)

| Question | Decision |
|---|---|
| Lump Sum: when? | When the Lump Sum invoice is **paid**. |
| "Contract URL" | The existing send points: "Send Pre Need Funeral Contract" button (Sign emails the link) and the "Send Links via WhatsApp" widget (embedded `sign_url`). Both made template-aware; the automatic send uses the email route. |
| Deposit paid / paid in full | Deposit invoice fully paid (partial doesn't count); paid in full = every Pre-Need plan invoice paid. |
| Sign templates / field mapping | User's part -- guideline only uses 2 template-ID placeholders. |
| Resend after plan changes | Out of scope. |

## Live facts (2026-09-29)

- `button.sendPreNeedFuneralContract` (String crmid): Sign template `441773000001137101`, `is_quicksend`, emails the
  buyer (Contact email); returns plain text. `standalone.sendPreNeedFuneralContractEmbedded`: same template,
  `is_embedded`, returns `sign_url`; called by the WhatsApp widget (`sendLinksViaWhatsApp`, "Add contract link").
- Books `allprocessonpaymentcreateandupdate` (id 5830143000026196041) fires on every customer payment create/edit;
  already includes the ZP-TBD-76 block (so ZP-TBD-76 is live).
- `cf_related_crm_deal_id` is present on both the Deposit retainer (RET-K-2026-000113) and a regular Pre-Need
  `Other` invoice (INV-K-2026-003845) -> a payment can be traced to its Deal on both.
- CRM Pre-Need invoices: `Invoice_For` = Deposit / Installment N (Retainer_Invoice = true), Lump Sum = Other
  (regular invoice).
- Zoho Sign MCP is disabled in this session -> template list not checked.

## Files

- `getPreNeedContractType_NEW.deluge`, `sendPreNeedFuneralContractEmail_NEW.deluge`,
  `autoSendPreNeedContract_NEW.deluge`, `sendPreNeedFuneralContract_UPDATED.deluge`
- `rollback/sendPreNeedFuneralContract_CURRENT.deluge` (live button body)
- Books block: `books/functions/preneed/ZP-TBD-82_preneed_contract_on_payment/`
- Test cases: `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-82_PreNeed_Contract_Versions_Test_Cases.xlsx` (19 cases)`
