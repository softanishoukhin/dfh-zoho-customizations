// ABANDONED -- confirmed live (2026-09-18): Client Scripts run in a restricted sandbox with
// NO DOM access at all ("document" is undefined there -- copyToClipboard() below threw
// "Cannot read properties of undefined (reading 'createElement')" on the very first test,
// before even reaching navigator.clipboard). Genuine clipboard access needs a real iframe
// with full DOM, i.e. a Widget-type button, not a Client Script. Replaced by
// D:\Office\Andrea_Projects\DFH\widgets\copyPreNeedQuestionnaireLink\copyPreNeedQuestionnaireLinkWidget
// (source copied into creator/forms/pre_need_questionnaire/... next to the other widget
// copies in this repo). Kept here only as the record of what was tried and why it doesn't
// work -- do not deploy this file.
//
// Client Script: attached directly to the "Send Pre-Need Questionnaire" button on Deals
// (Setup > Deals > Buttons > Send Pre-Need Questionnaire > Action Type = Client Script).
// Replaces the old behavior (open the link in a new tab) with: build/save the link via the
// sendPreNeedQuestionnaire Custom Function (unchanged logic, now returns the URL instead of
// calling openUrl itself), copy it to the clipboard, and show a confirmation -- so staff can
// paste it straight into WhatsApp/email instead of the widget opening in a stray tab.
//
// ZDK.Client.showAlert and $Page.record_id are confirmed live in this org already
// (ZP-TBD-28_casket_colors_blocking_unrelated_edits/onSaveEditPage_FIX.js). The clipboard
// copy pattern (navigator.clipboard.writeText with an execCommand fallback) is copied from
// D:\Office\Andrea_Projects\DFH\widgets\copyPaymentLink\copyPaymentLinkWidget\app\app.js.
//
// NOT YET CONFIRMED LIVE: the exact shape ZDK.Apps.CRM.Functions.execute() returns for a
// Custom Function's `return sendUrl;` value. Handled defensively below (checks a few likely
// shapes) -- if the alert shows an empty/wrong link on first test, log(response) and adjust
// extractLink() to match what's actually returned.
function sendPreNeedQuestionnaireClick(){
	try
	{
		var recordId = $Page.record_id;
		var response = ZDK.Apps.CRM.Functions.execute("sendPreNeedQuestionnaire", { "recordId": recordId });
		var link = extractLink(response);

		if (!link)
		{
			ZDK.Client.showAlert("Could not generate the Pre-Need Questionnaire link.");
			return false;
		}

		copyToClipboard(link);
		ZDK.Client.showAlert("Pre-Need Questionnaire link copied to clipboard.");
	}
	catch (e)
	{
		ZDK.Client.showAlert("Error generating the link: " + e);
	}
	return false;
}

function extractLink(response){
	if (!response) return "";
	if (typeof response === "string") return response;
	if (response.output) return response.output;
	if (response.result) return response.result;
	if (response.details && response.details.output) return response.details.output;
	return "";
}

function copyToClipboard(text){
	if (navigator.clipboard && navigator.clipboard.writeText)
	{
		navigator.clipboard.writeText(text);
		return;
	}
	var $tmp = document.createElement("textarea");
	$tmp.value = text;
	document.body.appendChild($tmp);
	$tmp.select();
	document.execCommand("copy");
	document.body.removeChild($tmp);
}
