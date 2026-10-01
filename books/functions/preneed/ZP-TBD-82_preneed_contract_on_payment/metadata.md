# ZP-TBD-82 -- Books side: check the Pre-Need contract after every payment

Block appended to the end of Books custom function `allprocessonpaymentcreateandupdate`
(entity Customer Payment, id `5830143000026196041`). Calls CRM `standalone.autoSendPreNeedContract` for each Deal
the payment touches.

Full guideline, design and rollback: `crm/functions/deals/ZP-TBD-82_preneed_contract_versions/guideline.md` (Step 8).
`<CRM_ZAPIKEY>` is a placeholder -- the real key only goes into the live function.
