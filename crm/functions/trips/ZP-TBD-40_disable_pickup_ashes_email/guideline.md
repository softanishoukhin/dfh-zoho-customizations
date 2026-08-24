# ZP-TBD-40 — Turn off the "Cremains available for pickup" email

Requested by Andrea (2026-08-24), via Carol Webster's forwarded email screenshot: a
recurring "Cremains are available at our office for pickup at your convenience" email kept
arriving even after the cremains had already been collected. Andrea's instruction: turn
off **just the email**, not the surrounding process.

## Root cause, confirmed live

`automation.sendPickupAshesEmail` (id `6503357000013618518`) sends this email
(template id `6503357000009193199`) for `Cremation with Service` / `Cremation Only` /
`Ship In` Deals, whenever the linked Trip completes and `Deals.Ashes_Pickup_Date` is still
empty. Full live source:

```deluge
void automation.sendPickupAshesEmail(Int crmid)
{
recordInfo = zoho.crm.getRecordById("Trips",crmid);
dealInfo = zoho.crm.getRecordById("Deals",recordInfo.get("Deal").get("id"));
contactInfo = zoho.crm.getRecordById("Contacts",dealInfo.get("Contact_Name").get("id"));
if(dealInfo.get("Type") == "Cremation with Service")
{
	if(dealInfo.get("Service_Format_Type") != "Body in Church" && dealInfo.get("Service_Format_Type") != "No Service")
	{
		return;
	}
}
if(dealInfo.get("Type") == "Cremation with Service" || dealInfo.get("Type") == "Cremation Only" || dealInfo.get("Type") == "Ship In")
{
	if(isNull(dealInfo.get("Ashes_Pickup_Date")))
	{
		standalone.sendEmail(contactInfo.get("Email"),"6503357000009193199","Deals",recordInfo.get("Deal").get("id"));
		tripMap = Map();
		tripMap.put("Pikcup_Ashes_Trigger_Email_Time",zoho.currenttime.addDay(1).toString("yyyy-MM-dd'T'HH:mm:ss"));
		zoho.crm.updateRecord("Trips",crmid,tripMap,{"trigger":{"workflow"}});
	}
	else
	{
		tripMap = Map();
		tripMap.put("Pikcup_Ashes_Trigger_Email_Time","");
		zoho.crm.updateRecord("Trips",crmid,tripMap);
	}
}
}
```

**Why it repeats:** two active Trips workflow rules drive this --
`Trigger on Complete Pickup Ashes Trip` (id `6503357000013618495`, fires the function once
when the trip's `Trip_Status` changes) and `Trigger on Pikcup Ashes Trigger Email Time`
(id `6503357000013727021`, a `date_or_datetime` trigger on `Pikcup_Ashes_Trigger_Email_Time`
that re-fires the same function the next day). Every time the function sends the email
with `Ashes_Pickup_Date` still empty, it sets that field to tomorrow, which the second
rule picks up and re-fires -- an indefinite daily loop until `Ashes_Pickup_Date` gets set
on the Deal. It never got set for this case, so the email kept sending after collection.

## The fix -- disable just the email, not the process

Per Andrea's instruction to turn off only the email itself, not the underlying workflow:
remove the one `standalone.sendEmail(...)` call. Leave the `Pikcup_Ashes_Trigger_Email_Time`
field bookkeeping and both trigger conditions exactly as they are -- they become harmless
no-ops (the workflow still "fires" daily, it just no longer does anything visible) rather
than requiring the two workflow rules themselves to be touched.

Find:
```deluge
	if(isNull(dealInfo.get("Ashes_Pickup_Date")))
	{
		standalone.sendEmail(contactInfo.get("Email"),"6503357000009193199","Deals",recordInfo.get("Deal").get("id"));
		tripMap = Map();
		tripMap.put("Pikcup_Ashes_Trigger_Email_Time",zoho.currenttime.addDay(1).toString("yyyy-MM-dd'T'HH:mm:ss"));
		zoho.crm.updateRecord("Trips",crmid,tripMap,{"trigger":{"workflow"}});
	}
```
Replace with:
```deluge
	if(isNull(dealInfo.get("Ashes_Pickup_Date")))
	{
		// Email disabled per Andrea's request (2026-08-24) -- it was re-sending daily
		// (via the Pikcup_Ashes_Trigger_Email_Time re-trigger loop) even after cremains
		// had already been collected, since Ashes_Pickup_Date was never being set.
		// standalone.sendEmail(contactInfo.get("Email"),"6503357000009193199","Deals",recordInfo.get("Deal").get("id"));
		tripMap = Map();
		tripMap.put("Pikcup_Ashes_Trigger_Email_Time",zoho.currenttime.addDay(1).toString("yyyy-MM-dd'T'HH:mm:ss"));
		zoho.crm.updateRecord("Trips",crmid,tripMap,{"trigger":{"workflow"}});
	}
```

**One line change** -- comment out the `standalone.sendEmail(...)` call, keep everything
else. The function still runs daily and still resets the trigger-time field, but no email
goes out until `Ashes_Pickup_Date` is set (at which point the `else` branch already clears
`Pikcup_Ashes_Trigger_Email_Time` and the loop naturally stops on its own).

## Open item worth flagging, not fixed here (out of scope for "just turn off the email")

`Ashes_Pickup_Date` not being set when cremains are actually collected is the real reason
this loop ran indefinitely for this case -- worth asking whoever handles walk-in pickups to
set that field when cremains are handed over, so the loop stops cleanly by itself even
after the email is re-enabled in the future (if it ever needs to be).

## Test

1. Confirm a Trip completing on a qualifying Deal (Cremation with Service/Cremation
   Only/Ship In, `Ashes_Pickup_Date` empty) no longer sends the pickup-ashes email.
2. Confirm `Pikcup_Ashes_Trigger_Email_Time` still gets set (function still runs, just
   silently) -- no error in the function log.
3. Set `Ashes_Pickup_Date` on a Deal that was mid-loop -- confirm the `else` branch still
   clears `Pikcup_Ashes_Trigger_Email_Time` as before.
