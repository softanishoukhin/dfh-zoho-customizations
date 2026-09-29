# ZP-TBD-83 -- Test cases

Full set (21 cases): `D:\Office\Andrea_Projects\DFH\widgets\testCases\ZP-TBD-83_Hillview_PreNeed_Retainer_Test_Cases.xlsx`

Gating cases -- run first:
- **TC-01** api names of the two new custom fields (a mismatch silently breaks the link / idempotency).
- **TC-05** exactly one Xero Receive Money for the retainer (wait 10 min to cover the catch-up Schedule).
- **TC-06** saving the invoice several times still gives exactly one retainer.
- **TC-14 / TC-15** paid in full -> retainer paid, nothing extra posted to Xero.
