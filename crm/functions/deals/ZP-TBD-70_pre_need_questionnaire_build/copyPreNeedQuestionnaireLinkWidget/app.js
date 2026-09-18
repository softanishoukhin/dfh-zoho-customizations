// Send Pre-Need Questionnaire widget.
// Triggered by a Widget-type custom button on the Deals module.
//
// Replaces an earlier attempt to do this via a Client Script -- confirmed live that Client
// Scripts run in a sandbox with NO DOM access at all ("document" is undefined there), so
// clipboard copy isn't possible from one. A Widget (this file) runs in a real iframe with
// full DOM/clipboard access instead, same as copyPaymentLinkWidget's own proven pattern,
// which this mirrors closely.
//
// Everything -- reading the Deal's existing edit URL, preserving any existing &record_id=
// on resend (same fix as the old Deluge button body had), building the link, and saving it
// back to the Deal -- is done directly here via ZOHO.CRM.API, not by calling out to any
// Deluge function. No cross-boundary call, no dependency on the sendPreNeedQuestionnaire
// Custom Function conversion done for the (abandoned) Client Script attempt.

var PERMA_URL = "https://creatorapp.zohopublic.com/delapenhafuneralhome/pre-need-questionnaire/page-perma/Final_Wishes_Form1/zS4dtZBC7VwnvsJTumgwyfTbG89Sw2kXaKMjrnkt0pghN0V7ePR1u6JaRW3Cv8CsvRHbB0nRCyqHqCw741YfYh8wdZYtWrh540uA";

var dealId = null;

$(function () {
  $("#copyBtn").on("click", copyLink);
  $("#closeBtn").on("click", closeWidget);

  ZOHO.embeddedApp.on("PageLoad", function (data) {
    // data.EntityId is always an array in the CRM widget SDK, even for a single-record
    // button context -- always take the first element.
    dealId = $.isArray(data.EntityId) ? data.EntityId[0] : data.EntityId;
    buildAndSaveLink();
  });
  ZOHO.embeddedApp.init();
});

function recordIdFromUrl(u) {
  if (!u) return "";
  var m = ("" + u).match(/[?&]record_id=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function buildAndSaveLink() {
  showStatus("loading", "Generating the link...");

  ZOHO.CRM.API.getRecord({ Entity: "Deals", RecordID: dealId }).then(function (dealResp) {
    var dealRecord = (dealResp && dealResp.data && dealResp.data[0]) || {};
    var existingUrl = dealRecord.Pre_Need_Questionnaire_Edit_URL || "";
    var existingRecordId = recordIdFromUrl(existingUrl);

    return ZOHO.CRM.CONFIG.getCurrentUser().then(function (userResp) {
      var user = (userResp && userResp.users && userResp.users[0]) || userResp || {};
      var ownerEmail = user.email || "";

      var sendUrl = PERMA_URL + "?deal_id=" + encodeURIComponent(dealId) + "&owner=" + encodeURIComponent(ownerEmail);
      if (existingRecordId) {
        sendUrl += "&record_id=" + encodeURIComponent(existingRecordId);
      }

      var apiData = {
        id: dealId,
        Pre_Need_Questionnaire_Edit_URL: sendUrl
      };
      // Only a genuinely first-time send flips status/date -- resending to let the family
      // edit an already-completed questionnaire shouldn't reset either.
      if (!existingRecordId) {
        apiData.Pre_Need_Questionnaire_Status = "Sent";
        apiData.Pre_Need_Date = todayStr();
      }

      var updateConfig = {
        Entity: "Deals",
        APIData: apiData,
        Trigger: ["workflow"]
      };

      return ZOHO.CRM.API.updateRecord(updateConfig).then(function () {
        showLink(sendUrl);
      });
    });
  }).catch(function (err) {
    showStatus("error", "Could not generate the link: " + JSON.stringify(err));
  });
}

function todayStr() {
  var d = new Date();
  var mm = ("0" + (d.getMonth() + 1)).slice(-2);
  var dd = ("0" + d.getDate()).slice(-2);
  return d.getFullYear() + "-" + mm + "-" + dd;
}

function showLink(url) {
  hideStatus();
  $("#linkInput").val(url);
  $("#linkRow").addClass("visible");
}

function copyLink() {
  var $input = $("#linkInput");
  var link = $input.val();
  if (!link) { return; }

  var copyPromise;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    copyPromise = navigator.clipboard.writeText(link);
  } else {
    $input.prop("readonly", false).select();
    document.execCommand("copy");
    $input.prop("readonly", true);
    copyPromise = $.Deferred().resolve().promise();
  }

  copyPromise.then(function () {
    var $btn = $("#copyBtn");
    var $msg = $("#copiedMsg");
    $btn.addClass("copied");
    $msg.addClass("visible");
    setTimeout(function () { $btn.removeClass("copied"); $msg.removeClass("visible"); }, 1200);
  });
}

function showStatus(type, message) {
  $("#statusBanner").attr("class", type).text(message);
}

function hideStatus() {
  $("#statusBanner").attr("class", "").text("");
}

function closeWidget() {
  ZOHO.CRM.UI.Popup.closeReload();
}
