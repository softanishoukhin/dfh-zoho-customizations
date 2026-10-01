# ZP-TBD-90 — ON HOLD: print clause 20 on the contract

**Do not apply yet.** The current Full contract template ("Pre-Need Contract – Casket") has no clause 20 (it ends at
clause 19). Waiting for Andrea to share the contract that has clause 20 (Disposition of Cremated Remains), most
likely a separate cremation version.

When it's known:

1. If it's a **new cremation contract**, it must first be set up as a Zoho Sign template, and the senders /
   `getPreNeedContractType` taught to pick it when the questionnaire says Cremation. That is a separate piece of
   work to scope then.
2. In that template, note the label of the text field on each clause-20 line (e.g. "Text - 38"), or of the single
   field if the clause has one.
3. In **each** of `sendPreNeedFuneralContractEmail` and `sendPreNeedFuneralContractEmbedded`, directly **below**
   `field_text_data.put("Text - 28",descText);` add the block below with the labels filled in.

```
// ZP-TBD-90: contract clause 20 -- Disposition of Cremated Remains, from the Pre-Need Questionnaire record.
// Sign field labels on clause 20 (from the template). A label left "" is not filled.
CLAUSE20_RELEASED_TO_LABEL = "";
CLAUSE20_INTERRED_AT_LABEL = "";
CLAUSE20_OTHER_LABEL = "";
// ...or ONE field for the whole clause -> gets e.g. "Released to: John Brown"
CLAUSE20_SINGLE_LABEL = "";
try 
{
	crdQuery = Map();
	crdQuery.put("select_query","select Cremated_Remains_Disposition, Cremated_Remains_Details from Pre_Need_Questionnaire where Deal_Name = '" + crmid + "' order by Modified_Time desc limit 1");
	crdResp = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v7/coql"
		type :POST
		parameters:crdQuery.toString()
		connection:"zohooauth"
	];
	crdRows = crdResp.get("data");
	if(crdRows != null && crdRows.size() > 0)
	{
		crdChoice = ifnull(crdRows.get(0).get("Cremated_Remains_Disposition"),"").toString();
		crdDetails = ifnull(crdRows.get(0).get("Cremated_Remains_Details"),"").toString().trim();
		crdLineText = crdDetails;
		if(crdLineText == "")
		{
			crdLineText = "Yes";
		}
		if(crdChoice == "Released to" || crdChoice == "Interred or Scattered at" || crdChoice == "Other")
		{
			if(CLAUSE20_SINGLE_LABEL != "")
			{
				field_text_data.put(CLAUSE20_SINGLE_LABEL,(crdChoice + ": " + crdDetails).trim());
			}
			else if(crdChoice == "Released to" && CLAUSE20_RELEASED_TO_LABEL != "")
			{
				field_text_data.put(CLAUSE20_RELEASED_TO_LABEL,crdLineText);
			}
			else if(crdChoice == "Interred or Scattered at" && CLAUSE20_INTERRED_AT_LABEL != "")
			{
				field_text_data.put(CLAUSE20_INTERRED_AT_LABEL,crdLineText);
			}
			else if(crdChoice == "Other" && CLAUSE20_OTHER_LABEL != "")
			{
				field_text_data.put(CLAUSE20_OTHER_LABEL,crdLineText);
			}
		}
	}
}
catch (eCrd)
{
	// no questionnaire yet / COQL "no rows" reply -> clause 20 left blank, the contract still goes out
	info "ZP-TBD-90: clause 20 not filled: " + eCrd;
}
```
