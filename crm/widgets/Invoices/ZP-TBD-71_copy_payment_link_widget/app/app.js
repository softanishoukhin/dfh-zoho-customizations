// Copy Payment Link widget.
// Triggered by a Widget-type custom button on the Invoices module. Lists the
// Invoice's Potential Payers in a dropdown, and once one is picked, builds
// the JMD and USD Fygaro payment links from that Invoice's Amount_in_JMD /
// Amount_in_USD fields and the selected payer's record id (custom_reference).

var invoiceId = null;
var invoiceRecord = null;

var JMD_BASE_URL = "https://www.fygaro.com/en/pb/fcc1b731-0deb-4893-a8e8-92c3e90a913e";
var USD_BASE_URL = "https://www.fygaro.com/en/pb/3d8fef8a-2e68-436f-9fb5-2f2783253bdb";

$(function () {
  $("#payerSelect").on("change", onPayerSelected);
  $("#copyJmdBtn").on("click", function () { copyLink("#jmdLink", "#copyJmdBtn", "#jmdCopiedMsg"); });
  $("#copyUsdBtn").on("click", function () { copyLink("#usdLink", "#copyUsdBtn", "#usdCopiedMsg"); });
  $("#closeBtn").on("click", closeWidget);

  ZOHO.embeddedApp.on("PageLoad", function (data) {
    // data.EntityId is always an array in the CRM widget SDK, even for a
    // single-record button context -- always take the first element.
    invoiceId = $.isArray(data.EntityId) ? data.EntityId[0] : data.EntityId;
    loadInvoice();
    loadPotentialPayers();
  });
  ZOHO.embeddedApp.init();
});

function loadInvoice() {
  ZOHO.CRM.API.getRecord({ Entity: "Invoices", RecordID: invoiceId }).then(function (response) {
    invoiceRecord = response.data[0];
  }).catch(function (err) {
    showStatus("error", "Could not load this Invoice's details: " + JSON.stringify(err));
  });
}

function loadPotentialPayers() {
  showStatus("loading", "Loading potential payers...");

  ZOHO.CRM.API.getRelatedRecords({
    Entity: "Invoices",
    RecordID: invoiceId,
    RelatedList: "Potential_Payers",
    page: 1,
    per_page: 200
  }).then(function (response) {
    hideStatus();
    var payers = (response && response.data) || [];
    var $select = $("#payerSelect");
    $select.find("option:not(:first)").remove();

    if (payers.length === 0) {
      showStatus("error", "No potential payers found on this Invoice.");
      return;
    }

    payers.forEach(function (payer) {
      $select.append($("<option>").val(payer.id).text(payer.Name || payer.id));
    });
  }).catch(function (err) {
    showStatus("error", "Could not load potential payers: " + JSON.stringify(err));
  });
}

function onPayerSelected() {
  var payerId = $("#payerSelect").val();
  if (!payerId) {
    $("#linksSection").removeClass("visible");
    return;
  }

  if (!invoiceRecord) {
    showStatus("error", "This Invoice's amounts haven't loaded yet -- please wait a moment and try again.");
    return;
  }

  hideStatus();
  setLinkRow("#jmdRow", "#jmdLink", JMD_BASE_URL, invoiceRecord.Amount_in_JMD, payerId);
  setLinkRow("#usdRow", "#usdLink", USD_BASE_URL, invoiceRecord.Amount_in_USD, payerId);
  $("#linksSection").addClass("visible");
}

function setLinkRow(rowSelector, inputSelector, baseUrl, amount, payerId) {
  var $row = $(rowSelector);
  var $input = $(inputSelector);

  if (!amount) {
    $row.find(".copy-btn").prop("disabled", true);
    $input.replaceWith($("<span>").addClass("unavailable").attr("id", inputSelector.slice(1)).text("Amount not set on this Invoice"));
    return;
  }

  var link = baseUrl + "?amount=" + encodeURIComponent(amount) + "&custom_reference=" + encodeURIComponent(payerId);
  $input.val(link);
}

function copyLink(inputSelector, btnSelector, msgSelector) {
  var $input = $(inputSelector);
  var link = $input.val();
  if (!link) { return; }

  var copyPromise;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    copyPromise = navigator.clipboard.writeText(link);
  } else {
    copyPromise = $.Deferred();
    try {
      $input.prop("readonly", false).select();
      var ok = document.execCommand("copy");
      $input.prop("readonly", true);
      if (ok) { copyPromise.resolve(); } else { copyPromise.reject(); }
    } catch (e) {
      $input.prop("readonly", true);
      copyPromise.reject(e);
    }
    copyPromise = copyPromise.promise();
  }

  copyPromise.then(function () {
    var $btn = $(btnSelector);
    var $msg = $(msgSelector);
    $btn.addClass("copied");
    $msg.addClass("visible");
    setTimeout(function () {
      $btn.removeClass("copied");
      $msg.removeClass("visible");
    }, 1200);
  }, function () {
    showStatus("error", "Couldn't copy the link automatically -- please select and copy it manually.");
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
