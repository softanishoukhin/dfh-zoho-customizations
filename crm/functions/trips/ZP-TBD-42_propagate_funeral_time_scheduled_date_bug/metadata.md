# ZP-TBD-42 — Trip Scheduled_Date reverting to stale value after manual departure edit

Reported by Andrea: Trip **Funeral Trip for Ceford Hyman**. The Deal's Funeral Time changed
from Aug 21, 2026 10:00 PM to Aug 22, 2026 11:00 AM (banner: "Funeral time changed — review and
update the departure time below."). Andrea used the TM widget's assignment screen to manually
set Departure Date & Time to 08/22/2026 09:45 AM and saved. The TM details view still showed
**Scheduled Departure: Aug 21, 2026 · 10:00 PM** — the old, pre-change value — instead of the
new departure just entered.

## Root cause — confirmed and fixed by the user directly in CRM

`automation.propagateFuneralTimeToTrips` recalculates each linked Trip's `Scheduled_Date`
whenever a Deal's `Funeral_Time` field changes (departure = funeral time minus 2 hours). This
function runs independently of `saveAssignment` (the TM widget's manual-save function, see
`Trip_Manager.ds`) — so a Funeral_Time change firing this automation can silently overwrite a
departure time an operator just entered by hand, if the automation's write lands after (or
around the same time as) the manual save.

The automation itself had a bug that made this worse: it computed the new Scheduled_Date with

```deluge
scheduledDateForTrip = funeralTime.toDateTime().subHour(2).toString("yyyy-MM-dd'T'HH:mm:ss");
```

`toDateTime()` with no format argument does not reliably parse an ISO datetime string
(`Funeral_Time` comes through as e.g. `2026-08-22T11:00:00-05:00`), so the parse was silently
wrong and the resulting `subHour(2)` calculation produced a bad/stale value.

**Fix applied live by the user:**

```deluge
scheduledDateForTrip = funeralTime.toTime("yyyy-MM-dd'T'HH:mm:ss").subHour(2).toString("yyyy-MM-dd'T'HH:mm:ss");
```

`toTime(format)` parses against an explicit format instead of relying on ambiguous default
parsing, so the datetime object — and the subsequent `subHour(2)` — is now correct.

## Status

**Applied live and confirmed** — the user made this fix directly in the CRM function editor for
`automation.propagateFuneralTimeToTrips`. Documented here for the repo record only; no further
action needed unless verification on the Ceford Hyman trip turns up something else.

## Open question (not yet resolved, worth flagging to Andrea)

Even with the parsing bug fixed, the underlying race is still possible in principle: if a Deal's
Funeral_Time is edited again *after* an operator manually sets a departure time in TM, the
automation will still recompute and overwrite `Scheduled_Date` (that's its job — keep departure
in sync with funeral time by default). That's likely the intended behavior, but worth confirming
with Andrea that "automation always wins on Funeral_Time change, operator must re-save departure
after" is the desired rule, rather than "operator's manual departure edit should take precedence
once set."
