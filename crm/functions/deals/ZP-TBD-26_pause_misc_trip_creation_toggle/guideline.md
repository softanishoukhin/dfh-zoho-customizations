# ZP-TBD-26 -- Easy ON/OFF switch: pause Pre-Visit and Document Pickup trip creation

**STATUS (2026-08-18): DEPLOYED AND CONFIRMED PASSING.** Deployed as a Text-type Org
Variable with values `"ON"`/`"OFF"` (compared as a string) rather than the originally
proposed Boolean `true`/`false` -- `getOrgVariable` returns a string, so this is actually
the cleaner match and is what's live. Guideline below updated to reflect the actual
deployed code.

Andrea's request (2026-08-18): temporarily stop Trip Manager from getting flooded with
Pre-Visit and Document/miscellaneous trips while the Ops App is being built, WITHOUT a
"complicated coding change that takes hours to turn off and back on." Operational trips
(initial pickups -- police, hospital, first call, wholesale local, airport; Funerals;
Cremations; Ship-ins; Repats) must keep being created as normal.

## The mechanism -- one Org Variable, no code redeploy to toggle

Every function below gets exactly **one guard line** added at the very top. All 8 check
the SAME single CRM Org Variable. Flipping that one variable is the entire ON/OFF switch
-- Setup > Developer Space > Connections > Org Variables already has a precedent for this
exact pattern in this org (`tripOwnerID` is an existing Org Variable used the same way in
several of these same functions), so this isn't a new mechanism, just one more variable.

### One-time setup (do this once)
1. Setup > Developer Space > Connections > Org Variables (or wherever `tripOwnerID` lives
   in your org's Setup menu -- same place).
2. Create a new Org Variable:
   - API name: `Pause_Misc_Trip_Creation`
   - Type: **Text**
   - Default value: **"OFF"** (normal operation, nothing paused)
3. Save.

### To pause the two trip types (any time, takes seconds)
Set `Pause_Misc_Trip_Creation` to **"ON"**. No code change, no redeploy.

### To resume (any time, takes seconds)
Set `Pause_Misc_Trip_Creation` back to **"OFF"**.

## What gets paused vs. what keeps running

Every trip-creation function tied to a document/pre-visit-sounding trigger was pulled and
checked live for the EXACT `Trip_Type` it writes -- several workflow *names* are
misleading (e.g. "Create Regular Trip on Completion of Form D" actually creates a
**Police Case Pickup** trip, not a document trip -- confirmed from its live source, left
untouched).

**PAUSED by this switch (8 functions):**

| Function (Setup > Developer Space > Functions) | id | Writes Trip_Type |
|---|---|---|
| `createTripForPreVisit` | `6503357000001905294` | Pre-Visit |
| `createTripsforRegularTripFuneralWithBurial` | `6503357000007957106` | Document Pickup |
| `createTripOnTransitPermitReady` | `6503357000012111001` | Document Pickup |
| `createTripsOnEmbassyPassportPUDate` | `6503357000012213017` | Document Pickup |
| `createTripAndTaskForTranslationRequired` | `6503357000012213193` | Document Pickup (creates 3 separate trips -- Translation drop-off, Pick-up Translated Documents, Pick-up Legalized Documents) |
| `preDepartureDocumentCollection` | `6503357000012619165` | Document Pickup |
| `createTripForProofOfDeath` | `6503357000031483020` | Document Pickup |
| `createMOHTripOnCompletionofFormEandFormC` | `6503357000009170017` | MOH Trip -- confirmed in scope by Andrea (2026-08-18): "document-errand trip in spirit" even though its literal type isn't "Document Pickup" |

**NOT paused -- confirmed left running, per Andrea's answers and live-verified Trip_Type:**
- `createTripOnCremationIssued` (`6503357000031483056`) -- writes **Ashes Pickup**.
  Confirmed by Andrea: part of the Cremations flow, keep running.
- `createRegularTripOnCompletionFormD` (`6503357000009170169`) -- despite the workflow's
  name, writes **Police Case Pickup**, not a document trip. Left untouched.
- `createTripForRepatriation` (`6503357000073755127`) -- writes **Airport Dropoff**, the
  actual repat outbound trip. Left untouched (Repats must keep running).
- `createTripsFromDealsForFuneralWithBurials`, `createTripsForRegularTrip`, and every
  function creating Funeral, Cremation, Ship In, First Call, Police/Hospital initial
  pickup, or Airport trips -- untouched, none of these were in the document/pre-visit
  candidate set to begin with.

## The exact guard to add -- same one line, top of each of the 8 functions

Add this as the FIRST executable line inside the function body (right after the opening
`{`, before anything else runs -- no Deal GET, no Trips search, nothing, if paused):

```deluge
if(zoho.crm.getOrgVariable("Pause_Misc_Trip_Creation") == "ON")
{
	return;
}
```

Example -- `createTripForPreVisit` before/after:

```deluge
void automation.createTripForPreVisit(Int crmid)
{
	if(zoho.crm.getOrgVariable("Pause_Misc_Trip_Creation") == true)
	{
		return;
	}
	dealDetails = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v7/Deals/" + crmid
		...
```

Apply the identical 4-line guard (just the `if` block above) to the very top of the other
7 functions listed in the table -- nothing else in any of these functions needs to change.

## Deploy
1. Create the `Pause_Misc_Trip_Creation` Org Variable (one-time setup above).
2. Open each of the 8 functions listed above in Setup > Developer Space > Functions, add
   the 4-line guard as the first line inside the function body, save.
3. **Test 1 (paused):** set `Pause_Misc_Trip_Creation` to "ON". Trigger each of the 8
   functions' normal trigger fields on a test Deal (e.g. set Pre_Visit_Viewing_Date, mark
   Form_D_Uploaded... whichever applies) -- confirm no Trip record is created for any of
   them.
4. **Test 2 (operational trips unaffected while paused):** with the variable still "ON",
   confirm Funeral, Cremation, Ship In, Repat, and Police/Hospital/First Call/Wholesale
   Local/Airport initial pickup trips still get created normally -- these functions were
   never touched, so they should be completely unaffected, but worth confirming live.
5. **Test 3 (resume):** set `Pause_Misc_Trip_Creation` back to "OFF". Repeat test 1's
   triggers -- confirm all 8 trip types now get created again normally.

## CONFIRMED (2026-08-18)
User deployed and tested all 3 steps above -- passing. Live and active.
