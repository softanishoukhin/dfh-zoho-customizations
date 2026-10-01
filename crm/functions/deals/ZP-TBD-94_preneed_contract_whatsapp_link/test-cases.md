# ZP-TBD-94 -- test cases

Full test set (16 cases): `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-94_PreNeed_Contract_WhatsApp_Link_Test_Cases.xlsx`

Key cases:

| # | Case | Expected |
|---|---|---|
| TC-02 | Contact without email -> Add contract link | Link added; Sign recipient = info@dfhja.com |
| TC-04 | Open the WhatsApp link 10+ minutes later | Contract opens (the CC 2-minute issue) |
| TC-05 | Open, close, open again | Opens again (fresh URL each time) |
| TC-08 | Open after signing | "already been signed" message |
| TC-09 | Request expiry | One year out via the Extend API (if ~99 days, see guideline step D) |
| TC-10 | Changed `did` in the link | "not valid" message |
