/* Pre-Need Final Wishes Questionnaire widget.
   Mirrors NOKIntake/app/app.js's architecture: SDK-readiness poll, query-param
   capture via ZOHO.CREATOR.UTIL, Custom-API prefill/resume, addRecords submit,
   then a completion Custom API that writes status back to the Deal. Trimmed to
   only what this simpler questionnaire needs -- no First-Call case-intake logic. */

/* ---------- Custom API config ----------
   ZOHO.CREATOR.DATA.addRecords() 401s on this public perma-link page (no logged-in
   user -- confirmed via Network tab). Calling Zoho's REST Publish API directly
   from the browser was tried next, but that's blocked by CORS (it's built for
   server-to-server/curl callers, not browser JS -- confirmed via a failed
   preflight with 0 response headers). Submission now goes entirely through a
   4th Custom API, submitFinalWishes, which creates the record server-side
   using Deluge's native "insert into" syntax -- the one channel already
   proven to work unauthenticated on this page (same as getDeal/getCreatorRecord). */
var WORKSPACE = "delapenhafuneralhome";
var FORM_NAME = "Final_Wishes_Form";
var APIS = {
  getDeal:                     { api_name: "getDeal",                     public_key: "usxZzuH5bvRuvZMYaQn1hjX5U" },
  getCreatorRecord:            { api_name: "getCreatorRecord",             public_key: "BM5useYDWwdOh8JWr3wUUZsKR" },
  completePreNeedQuestionnaire:{ api_name: "completePreNeedQuestionnaire", public_key: "4z8aDE1HzH45eeM61C6RYQS9R" },
  submitFinalWishes:           { api_name: "submitFinalWishes",           public_key: "krnq7hv4Jx8nbhDjFOHms3FP1" },
  getQuestionnaireForDeal:     { api_name: "getQuestionnaireForDeal",     public_key: "0PZsPy7Nhd1UBeEBkPbZayKkr" }
};

/* ---------- small helpers (mirror NOKIntake's v()/setVal()/clean()) ---------- */
function v(id){ var el = $('#' + id); return el.length ? (el.val() || "") : ""; }
function setVal(id, val){ var $e = $('#' + id); if ($e.length && val !== undefined && val !== null) $e.val(val).trigger('input'); }
function setMsg(text, ok){ $('#msg').text(text).removeClass('ok err').addClass(ok ? 'ok' : 'err'); }
function showThankYou(){ $('#msg').text('').removeClass('ok err'); $('#thankYouModal').addClass('show'); }
$(document).on('click', '#tyCloseBtn', function(){ window.location.reload(); });
function showOverlay(text){ $('#overlayText').text(text || 'Working...'); $('#overlay').addClass('show'); }
function hideOverlay(){ $('#overlay').removeClass('show'); }
function clean(data){
  $.each(Object.keys(data), function(_, k){
    var val = data[k];
    if (val && typeof val === 'object' && !(val instanceof Array)){
      var allEmpty = Object.keys(val).every(function(kk){ return !val[kk]; });
      if (allEmpty) delete data[k];
    } else if (val === "" || val === null || val === undefined){
      delete data[k];
    }
  });
  return data;
}
function escapeHtmlDf(s){ return ('' + s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function markErr(id, msg){
  var $row = $('#' + id).closest('.row');
  $row.addClass('invalid');
  if (!$row.find('.field-err').length) $row.append($('<div class="field-err">').text(msg));
  $('#' + id).closest('.sec').addClass('open');
}

/* ---------- Address / Name field builders (write side -- matches Creator's
   addRecords JSON shape; postal_Code capital-C, per NOKIntake's addrObj()) ---------- */
function nameObj(p){ return { "first_name": v(p+"_first_name"), "last_name": v(p+"_last_name") }; }
function addrObj(p){
  var out = {};
  var subfields = ['address_line_1','address_line_2','district_city','state_province','postal_Code','country'];
  for (var i=0;i<subfields.length;i++){
    var id = p + '_' + subfields[i];
    if ($('#' + id).length) out[subfields[i]] = v(id);
  }
  return out;
}
/* Read side -- Creator returns composite fields with lowercase keys
   (postal_code, not postal_Code) when you read a saved record back;
   confirmed live in NOKIntake's setAddr() with the same comment. */
function setName(prefix, n){ if (!n) return; setVal(prefix+'_first_name', n.first_name); setVal(prefix+'_last_name', n.last_name); }
function setAddr(prefix, a){
  if (!a) return;
  setVal(prefix+'_address_line_1', a.address_line_1);
  setVal(prefix+'_address_line_2', a.address_line_2);
  setVal(prefix+'_district_city',  a.district_city);
  setVal(prefix+'_state_province', a.state_province);
  setVal(prefix+'_postal_Code',    a.postal_code);
  setVal(prefix+'_country',        a.country);
}

/* ---------- collapsible sections ---------- */
$(document).on('click', '.sec > .head', function(){
  $(this).closest('.sec').toggleClass('open');
});

/* ===================================================================
   Phone country-code picker + validation -- copied from NOKIntake's
   generic implementation (applies to every phone field, per that
   widget's own rule). Only one phone field type here: the Persons
   Responsible subform's Phone, one instance per row.
   =================================================================== */
var DEFAULT_PHONE_COUNTRY = 'jm';
var COUNTRY_CODES = [
  ["jm","1","Jamaica"],["af","93","Afghanistan"],["al","355","Albania"],["dz","213","Algeria"],
  ["as","1684","American Samoa"],["ad","376","Andorra"],["ao","244","Angola"],["ai","1264","Anguilla"],
  ["ag","1268","Antigua and Barbuda"],["ar","54","Argentina"],["am","374","Armenia"],["aw","297","Aruba"],
  ["au","61","Australia"],["at","43","Austria"],["az","994","Azerbaijan"],["bs","1242","Bahamas"],
  ["bh","973","Bahrain"],["bd","880","Bangladesh"],["bb","1246","Barbados"],["by","375","Belarus"],
  ["be","32","Belgium"],["bz","501","Belize"],["bj","229","Benin"],["bm","1441","Bermuda"],
  ["bt","975","Bhutan"],["bo","591","Bolivia"],["ba","387","Bosnia and Herzegovina"],["bw","267","Botswana"],
  ["br","55","Brazil"],["io","246","British Indian Ocean Territory"],["vg","1284","British Virgin Islands"],
  ["bn","673","Brunei"],["bg","359","Bulgaria"],["bf","226","Burkina Faso"],["bi","257","Burundi"],
  ["kh","855","Cambodia"],["cm","237","Cameroon"],["ca","1","Canada"],["cv","238","Cape Verde"],
  ["bq","599","Caribbean Netherlands"],["ky","1345","Cayman Islands"],["cf","236","Central African Republic"],
  ["td","235","Chad"],["cl","56","Chile"],["cn","86","China"],["cx","61","Christmas Island"],
  ["cc","61","Cocos"],["co","57","Colombia"],["km","269","Comoros"],["cd","243","Congo"],["cg","242","Congo"],
  ["ck","682","Cook Islands"],["cr","506","Costa Rica"],["hr","385","Croatia"],["cu","53","Cuba"],
  ["cw","599","Curaçao"],["cy","357","Cyprus"],["cz","420","Czech Republic"],["ci","225","Côte d’Ivoire"],
  ["dk","45","Denmark"],["dj","253","Djibouti"],["dm","1767","Dominica"],["do","1","Dominican Republic"],
  ["ec","593","Ecuador"],["eg","20","Egypt"],["sv","503","El Salvador"],["gq","240","Equatorial Guinea"],
  ["er","291","Eritrea"],["ee","372","Estonia"],["et","251","Ethiopia"],["fk","500","Falkland Islands"],
  ["fo","298","Faroe Islands"],["fj","679","Fiji"],["fi","358","Finland"],["fr","33","France"],
  ["gf","594","French Guiana"],["pf","689","French Polynesia"],["ga","241","Gabon"],["gm","220","Gambia"],
  ["ge","995","Georgia"],["de","49","Germany"],["gh","233","Ghana"],["gi","350","Gibraltar"],
  ["gr","30","Greece"],["gl","299","Greenland"],["gd","1473","Grenada"],["gp","590","Guadeloupe"],
  ["gu","1671","Guam"],["gt","502","Guatemala"],["gg","44","Guernsey"],["gn","224","Guinea"],
  ["gw","245","Guinea-Bissau"],["gy","592","Guyana"],["ht","509","Haiti"],["hn","504","Honduras"],
  ["hk","852","Hong Kong"],["hu","36","Hungary"],["is","354","Iceland"],["in","91","India"],
  ["id","62","Indonesia"],["ir","98","Iran"],["iq","964","Iraq"],["ie","353","Ireland"],
  ["im","44","Isle of Man"],["il","972","Israel"],["it","39","Italy"],["jp","81","Japan"],
  ["je","44","Jersey"],["jo","962","Jordan"],["kz","7","Kazakhstan"],["ke","254","Kenya"],
  ["ki","686","Kiribati"],["xk","383","Kosovo"],["kw","965","Kuwait"],["kg","996","Kyrgyzstan"],
  ["la","856","Laos"],["lv","371","Latvia"],["lb","961","Lebanon"],["ls","266","Lesotho"],
  ["lr","231","Liberia"],["ly","218","Libya"],["li","423","Liechtenstein"],["lt","370","Lithuania"],
  ["lu","352","Luxembourg"],["mo","853","Macau"],["mk","389","Macedonia"],["mg","261","Madagascar"],
  ["mw","265","Malawi"],["my","60","Malaysia"],["mv","960","Maldives"],["ml","223","Mali"],
  ["mt","356","Malta"],["mh","692","Marshall Islands"],["mq","596","Martinique"],["mr","222","Mauritania"],
  ["mu","230","Mauritius"],["yt","262","Mayotte"],["mx","52","Mexico"],["fm","691","Micronesia"],
  ["md","373","Moldova"],["mc","377","Monaco"],["mn","976","Mongolia"],["me","382","Montenegro"],
  ["ms","1664","Montserrat"],["ma","212","Morocco"],["mz","258","Mozambique"],["mm","95","Myanmar"],
  ["na","264","Namibia"],["nr","674","Nauru"],["np","977","Nepal"],["nl","31","Netherlands"],
  ["nc","687","New Caledonia"],["nz","64","New Zealand"],["ni","505","Nicaragua"],["ne","227","Niger"],
  ["ng","234","Nigeria"],["nu","683","Niue"],["nf","672","Norfolk Island"],["kp","850","North Korea"],
  ["mp","1670","Northern Mariana Islands"],["no","47","Norway"],["om","968","Oman"],["pk","92","Pakistan"],
  ["pw","680","Palau"],["ps","970","Palestine"],["pa","507","Panama"],["pg","675","Papua New Guinea"],
  ["py","595","Paraguay"],["pe","51","Peru"],["ph","63","Philippines"],["pl","48","Poland"],
  ["pt","351","Portugal"],["pr","1","Puerto Rico"],["qa","974","Qatar"],["ro","40","Romania"],
  ["ru","7","Russia"],["rw","250","Rwanda"],["re","262","Réunion"],["bl","590","Saint Barthélemy"],
  ["sh","290","Saint Helena"],["kn","1869","Saint Kitts and Nevis"],["lc","1758","Saint Lucia"],
  ["mf","590","Saint Martin"],["pm","508","Saint Pierre and Miquelon"],["vc","1784","Saint Vincent and the Grenadines"],
  ["ws","685","Samoa"],["sm","378","San Marino"],["sa","966","Saudi Arabia"],["sn","221","Senegal"],
  ["rs","381","Serbia"],["sc","248","Seychelles"],["sl","232","Sierra Leone"],["sg","65","Singapore"],
  ["sx","1721","Sint Maarten"],["sk","421","Slovakia"],["si","386","Slovenia"],["sb","677","Solomon Islands"],
  ["so","252","Somalia"],["za","27","South Africa"],["kr","82","South Korea"],["ss","211","South Sudan"],
  ["es","34","Spain"],["lk","94","Sri Lanka"],["sd","249","Sudan"],["sr","597","Suriname"],
  ["sj","47","Svalbard and Jan Mayen"],["sz","268","Swaziland"],["se","46","Sweden"],["ch","41","Switzerland"],
  ["sy","963","Syria"],["st","239","São Tomé and Príncipe"],["tw","886","Taiwan"],["tj","992","Tajikistan"],
  ["tz","255","Tanzania"],["th","66","Thailand"],["tl","670","Timor-Leste"],["tg","228","Togo"],
  ["tk","690","Tokelau"],["to","676","Tonga"],["tt","1868","Trinidad and Tobago"],["tn","216","Tunisia"],
  ["tr","90","Turkey"],["tm","993","Turkmenistan"],["tc","1649","Turks and Caicos Islands"],["tv","688","Tuvalu"],
  ["vi","1340","U.S. Virgin Islands"],["ug","256","Uganda"],["ua","380","Ukraine"],["ae","971","United Arab Emirates"],
  ["gb","44","United Kingdom"],["us","1","United States"],["uy","598","Uruguay"],["uz","998","Uzbekistan"],
  ["vu","678","Vanuatu"],["va","39","Vatican City"],["ve","58","Venezuela"],["vn","84","Vietnam"],
  ["wf","681","Wallis and Futuna"],["eh","212","Western Sahara"],["ye","967","Yemen"],["zm","260","Zambia"],
  ["zw","263","Zimbabwe"],["ax","358","Åland Islands"]
];
var phoneFieldState = {};
function countryByIso2(iso2){ for (var i=0;i<COUNTRY_CODES.length;i++){ if (COUNTRY_CODES[i][0]===iso2) return COUNTRY_CODES[i]; } return COUNTRY_CODES[0]; }
function flagEmoji(iso2){ if (!iso2 || iso2.length!==2) return ''; var cc = iso2.toUpperCase(); return String.fromCodePoint(127397 + cc.charCodeAt(0)) + String.fromCodePoint(127397 + cc.charCodeAt(1)); }
function digitsOnly(s){ return ('' + (s||'')).replace(/[^0-9]/g, ''); }

function initPhoneField(fieldId){
  var $input = $('#' + fieldId);
  if (!$input.length || $input.data('phoneCcInit')) return;
  $input.data('phoneCcInit', true);
  $input.attr('type','tel').attr('autocomplete','tel').attr('placeholder','Phone number');
  var $wrap = $('<div class="phone-cc-wrap"></div>');
  $input.before($wrap);
  var $btn = $('<button type="button" class="phone-cc-btn"><span class="pcc-flag"></span><span class="pcc-dial"></span><span class="pcc-caret">&#9662;</span></button>');
  var $dd = $('<div class="phone-cc-dd"><input type="text" class="phone-cc-search" placeholder="Search country..."/><div class="phone-cc-list"></div></div>');
  $wrap.append($btn).append($dd);
  $input.detach().appendTo($wrap);
  phoneFieldState[fieldId] = { iso2: DEFAULT_PHONE_COUNTRY };
  renderPhoneCCList(fieldId);
  updatePhoneCCDisplay(fieldId);
  $btn.on('click', function(ev){
    ev.stopPropagation();
    $('.phone-cc-dd.open').not($dd).removeClass('open');
    $dd.toggleClass('open');
    if ($dd.hasClass('open')){
      $dd.find('.phone-cc-search').val('').trigger('input').focus();
      positionPhoneCCDropdown($wrap, $dd);
    }
  });
  $dd.on('click', function(ev){ ev.stopPropagation(); });
  $dd.find('.phone-cc-search').on('input', function(){ renderPhoneCCList(fieldId, $(this).val()); });
  $input.on('blur', function(){ validatePhoneFieldUI(fieldId); });
}
function positionPhoneCCDropdown($wrap, $dd){
  $dd.css({ top:'', bottom:'', left:'', maxHeight:'' });
  var rect = $wrap[0].getBoundingClientRect();
  var viewportH = window.innerHeight || document.documentElement.clientHeight;
  var viewportW = window.innerWidth || document.documentElement.clientWidth;
  var margin = 8;
  var spaceBelow = viewportH - rect.bottom - margin;
  var spaceAbove = rect.top - margin;
  var openUp = spaceAbove > spaceBelow;
  var available = openUp ? spaceAbove : spaceBelow;
  var capped = Math.max(140, Math.min(available, 340));
  var ddWidth = $dd.outerWidth() || 260;
  var left = rect.left;
  if (left + ddWidth > viewportW - margin){ left = Math.max(margin, viewportW - ddWidth - margin); }
  var css = { left: left + 'px', maxHeight: capped + 'px' };
  if (openUp){ css.bottom = (viewportH - rect.top + 4) + 'px'; css.top = 'auto'; }
  else { css.top = (rect.bottom + 4) + 'px'; css.bottom = 'auto'; }
  $dd.css(css);
}
function renderPhoneCCList(fieldId, filterText){
  var $wrap = $('#' + fieldId).closest('.phone-cc-wrap');
  var $list = $wrap.find('.phone-cc-list');
  var q = (filterText || '').trim().toLowerCase();
  var html = '';
  for (var i=0;i<COUNTRY_CODES.length;i++){
    var c = COUNTRY_CODES[i];
    if (q && c[2].toLowerCase().indexOf(q) === -1 && c[1].indexOf(q) === -1) continue;
    html += '<div class="phone-cc-item" onclick="selectPhoneCountry(\'' + fieldId + '\',\'' + c[0] + '\')">'
      + '<span class="pcc-flag">' + flagEmoji(c[0]) + '</span>'
      + '<span class="pcc-name">' + escapeHtmlDf(c[2]) + '</span>'
      + '<span class="pcc-dial-sm">+' + c[1] + '</span>'
      + '</div>';
  }
  $list.html(html || '<div class="phone-cc-empty">No matches</div>');
}
function selectPhoneCountry(fieldId, iso2){
  phoneFieldState[fieldId] = phoneFieldState[fieldId] || {};
  phoneFieldState[fieldId].iso2 = iso2;
  updatePhoneCCDisplay(fieldId);
  $('#' + fieldId).closest('.phone-cc-wrap').find('.phone-cc-dd').removeClass('open');
  validatePhoneFieldUI(fieldId);
  $('#' + fieldId).focus();
}
function updatePhoneCCDisplay(fieldId){
  var st = phoneFieldState[fieldId] || { iso2: DEFAULT_PHONE_COUNTRY };
  var c = countryByIso2(st.iso2);
  var $wrap = $('#' + fieldId).closest('.phone-cc-wrap');
  $wrap.find('.phone-cc-btn .pcc-flag').text(flagEmoji(c[0]));
  $wrap.find('.phone-cc-btn .pcc-dial').text('+' + c[1]);
}
function checkPhoneField(fieldId){
  var raw = digitsOnly($('#' + fieldId).val());
  if (!raw) return { valid: true, empty: true };
  var st = phoneFieldState[fieldId] || { iso2: DEFAULT_PHONE_COUNTRY };
  var c = countryByIso2(st.iso2);
  if (!(window.libphonenumber && typeof window.libphonenumber.isValidPhoneNumber === 'function')){
    return { valid: true, empty: false };
  }
  var ok = false;
  try { ok = window.libphonenumber.isValidPhoneNumber(raw, st.iso2.toUpperCase()); }
  catch (e){ ok = false; }
  var msg = ok ? '' : ('Enter a valid ' + c[2] + ' phone number.');
  return { valid: ok, empty: false, message: msg };
}
function validatePhoneFieldUI(fieldId){
  var $input = $('#' + fieldId);
  $input.val(digitsOnly($input.val()));
  var $row = $input.closest('.row');
  $row.find('.field-err').remove();
  $row.removeClass('invalid');
  var res = checkPhoneField(fieldId);
  if (!res.valid){ markErr(fieldId, res.message); }
}
function getFullPhoneNumber(fieldId){
  var raw = digitsOnly($('#' + fieldId).val());
  if (!raw) return '';
  var st = phoneFieldState[fieldId] || { iso2: DEFAULT_PHONE_COUNTRY };
  var c = countryByIso2(st.iso2);
  return '+' + c[1] + raw;
}
function setFullPhoneNumber(fieldId, fullValue){
  var s = ('' + (fullValue || '')).trim();
  if (!s){ return; }
  var digits = digitsOnly(s);
  if (!digits){ return; }
  var hadPlus = s.charAt(0) === '+';
  var best = null;
  if (hadPlus){
    for (var i=0;i<COUNTRY_CODES.length;i++){
      var c = COUNTRY_CODES[i];
      if (digits.indexOf(c[1]) === 0){
        if (!best || c[1].length > best[1].length) best = c;
      }
    }
  }
  if (best){
    phoneFieldState[fieldId] = { iso2: best[0] };
    $('#' + fieldId).val(digits.substring(best[1].length));
  } else {
    phoneFieldState[fieldId] = { iso2: DEFAULT_PHONE_COUNTRY };
    $('#' + fieldId).val(digits);
  }
  updatePhoneCCDisplay(fieldId);
}
$(document).on('click', function(){ $('.phone-cc-dd.open').removeClass('open'); });
$(window).on('scroll', function(){ $('.phone-cc-dd.open').removeClass('open'); });

/* ===================================================================
   Persons Responsible subform (dynamic rows)
   =================================================================== */
var prCounter = -1;
function prRowHtml(idx){
  return '<div class="pr-row" data-idx="'+idx+'">' +
    '<button type="button" class="pr-remove" data-idx="'+idx+'">Remove</button>' +
    '<div class="row"><label>First Name</label><input id="pr_first_'+idx+'"/></div>' +
    '<div class="row"><label>Last Name</label><input id="pr_last_'+idx+'"/></div>' +
    '<div class="row"><label>Relationship</label><input id="pr_relationship_'+idx+'"/></div>' +
    '<div class="row"><label>Phone</label><input id="pr_phone_'+idx+'"/></div>' +
  '</div>';
}
function prAddRow(){
  prCounter++;
  $('#prList').append(prRowHtml(prCounter));
  initPhoneField('pr_phone_' + prCounter);
  return prCounter;
}
$(document).on('click', '#prAddBtn', function(){ prAddRow(); });
$(document).on('click', '.pr-remove', function(){ $(this).closest('.pr-row').remove(); });
function buildPersonsResponsible(){
  var out = [];
  $('#prList .pr-row').each(function(){
    var idx = $(this).data('idx');
    var first = v('pr_first_' + idx);
    var last = v('pr_last_' + idx);
    var rel = v('pr_relationship_' + idx);
    var phone = getFullPhoneNumber('pr_phone_' + idx);
    if (!first && !last && !rel && !phone) return;
    out.push({ "Name": { "first_name": first, "last_name": last }, "Relationship": rel, "Phone": phone });
  });
  return out;
}
function fillPersonsResponsible(rows){
  $('#prList').empty();
  prCounter = -1;
  if (!rows || !rows.length) return;
  for (var i=0;i<rows.length;i++){
    var idx = prAddRow();
    var row = rows[i];
    var nameObjR = row.Name || {};
    setVal('pr_first_' + idx, nameObjR.first_name);
    setVal('pr_last_' + idx, nameObjR.last_name);
    setVal('pr_relationship_' + idx, row.Relationship);
    if (row.Phone) setFullPhoneNumber('pr_phone_' + idx, row.Phone);
  }
}

/* ===================================================================
   Interment Type (multi-select) checkboxes
   =================================================================== */
function buildIntermentType(){
  var out = [];
  if ($('#Interment_Type_Urn').is(':checked')) out.push('Urn');
  if ($('#Interment_Type_Keepsake').is(':checked')) out.push('Keepsake Urn');
  if ($('#Interment_Type_Scattering').is(':checked')) out.push('Scattering Urn');
  return out;
}
function fillIntermentType(list){
  list = list || [];
  $('#Interment_Type_Urn').prop('checked', list.indexOf('Urn') !== -1);
  $('#Interment_Type_Keepsake').prop('checked', list.indexOf('Keepsake Urn') !== -1);
  $('#Interment_Type_Scattering').prop('checked', list.indexOf('Scattering Urn') !== -1);
}

/* ===================================================================
   Signature pad (plain canvas -- no external signature library so no
   new CSP domain is needed). The captured base64 PNG data URL is sent
   straight to completePreNeedQuestionnaire, which uploads it onto the
   Deal's Pre_Need_Signature field -- Creator's own Signature field type
   rejects programmatic writes entirely, confirmed live, so it's never
   targeted at all (see submitFinalWishes.dg / completePreNeedQuestionnaire.dg).
   =================================================================== */
var sigCtx, sigDrawing = false, sigHasContent = false;
var sigCssWidth = 0, sigCssHeight = 0; // exposed so fillSignatureFromDataUrl() can drawImage() at the same scale
function initSignaturePad(){
  var canvas = document.getElementById('sigCanvas');
  if (!canvas) return;
  var ratio = window.devicePixelRatio || 1;
  // canvas.clientWidth/clientHeight are 0 here -- the Sign-off section starts
  // collapsed (display:none), so the canvas has no rendered size yet at boot.
  // Size off the always-visible .wrap container instead, matching the CSS
  // rule (#sigCanvas{width:100%;height:180px}) so drawing coordinates line up.
  var cssWidth = ($('.wrap').width() || 320) - 28; // minus .sec/.body padding
  var cssHeight = 180;
  sigCssWidth = cssWidth;
  sigCssHeight = cssHeight;
  canvas.width = cssWidth * ratio;
  canvas.height = cssHeight * ratio;
  sigCtx = canvas.getContext('2d');
  sigCtx.scale(ratio, ratio);
  // Canvas defaults to a transparent background; toDataURL('image/png') keeps
  // that transparency, which renders as solid BLACK in Zoho's image preview
  // instead of white. Fill white explicitly so the exported PNG always has a
  // real background.
  sigCtx.fillStyle = '#ffffff';
  sigCtx.fillRect(0, 0, cssWidth, cssHeight);
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = 'round';
  sigCtx.strokeStyle = '#1f2430';
  function pos(ev){
    var rect = canvas.getBoundingClientRect();
    var x, y;
    if (ev.touches && ev.touches.length){ x = ev.touches[0].clientX - rect.left; y = ev.touches[0].clientY - rect.top; }
    else { x = ev.clientX - rect.left; y = ev.clientY - rect.top; }
    return { x: x, y: y };
  }
  function start(ev){ sigDrawing = true; sigHasContent = true; var p = pos(ev); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); ev.preventDefault(); }
  function move(ev){ if (!sigDrawing) return; var p = pos(ev); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); ev.preventDefault(); }
  function end(){ sigDrawing = false; }
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);
  $('#sigClearBtn').on('click', function(){
    sigCtx.fillStyle = '#ffffff';
    sigCtx.fillRect(0, 0, cssWidth, cssHeight);
    sigHasContent = false;
  });
}
function getSignatureDataUrl(){
  if (!sigHasContent) return '';
  var canvas = document.getElementById('sigCanvas');
  return canvas.toDataURL('image/png');
}
// Redraws a previously-captured signature (from getQuestionnaireForDeal's
// signatureDataUrl) onto the pad on resume. A data: URL is same-origin, so
// drawImage() here never taints the canvas for a later toDataURL() re-export
// -- unlike a remote <img> URL would.
function fillSignatureFromDataUrl(dataUrl){
  if (!dataUrl || !sigCtx) return;
  var img = new Image();
  img.onload = function(){
    sigCtx.drawImage(img, 0, 0, sigCssWidth, sigCssHeight);
    sigHasContent = true;
  };
  img.src = dataUrl;
}

/* ===================================================================
   Custom API calls -- mirrors NOKIntake's callApi()/apiData() exactly
   (query_params passed as a STRING, not an object -- this SDK build
   mishandles object query_params), generalized for 3 separate
   api_name/public_key pairs instead of NOKIntake's single widgetLookup.
   =================================================================== */
function buildQS(paramsObj){
  var parts = [];
  for (var k in paramsObj){ if (paramsObj.hasOwnProperty(k)) parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(paramsObj[k] || "")); }
  return parts.join("&");
}
function callApi(apiKey, paramsObj){
  var cfg = APIS[apiKey];
  var qs = buildQS(paramsObj || {});
  var config = {
    api_name: cfg.api_name,
    workspace_name: WORKSPACE,
    http_method: "GET",
    public_key: cfg.public_key,
    query_params: qs
  };
  return ZOHO.CREATOR.DATA.invokeCustomApi(config).then(function(r){
    return r;
  }).catch(function(){
    var url = "https://www.zohoapis.com/creator/custom/" + WORKSPACE + "/" + cfg.api_name +
              "?" + qs + "&publickey=" + encodeURIComponent(cfg.public_key);
    return fetch(url).then(function(resp){ return resp.json(); });
  });
}
function apiData(resp){
  try{
    if (resp && resp.output) return (typeof resp.output === 'string') ? JSON.parse(resp.output) : resp.output;
    if (resp && resp.result) return (typeof resp.result === 'string') ? JSON.parse(resp.result) : resp.result;
    if (resp && resp.code && resp.data) return resp.data;
    return resp;
  }catch(e){ return {}; }
}
// POST variant -- sends arguments as a JSON body (config.payload), not a query
// string, so a large payload (the whole questionnaire + signature image) isn't
// bound by URL length limits. "payload" is the documented key for this,
// distinct from "query_params" (which NOKIntake's callApi() above works around
// a known SDK bug for).
function callApiPost(apiKey, payloadObj){
  var cfg = APIS[apiKey];
  var config = {
    api_name: cfg.api_name,
    workspace_name: WORKSPACE,
    http_method: "POST",
    content_type: "application/json",
    public_key: cfg.public_key,
    payload: payloadObj
  };
  return ZOHO.CREATOR.DATA.invokeCustomApi(config).then(function(r){
    return r;
  }).catch(function(){
    var url = "https://www.zohoapis.com/creator/custom/" + WORKSPACE + "/" + cfg.api_name +
              "?publickey=" + encodeURIComponent(cfg.public_key);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadObj)
    }).then(function(resp){ return resp.json(); });
  });
}

/* ---------- record_id parsing from the Deal's edit-URL field (mirrors
   NOKIntake's recordIdFromUrl()) ---------- */
function recordIdFromUrl(u){
  if (!u) return "";
  try{
    var m = ("" + u).match(/[?&]record_id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }catch(e){ return ""; }
}

/* ===================================================================
   Prefill / resume
   =================================================================== */
function fillFormFromRecord(d){
  setName('Pre_Planner_Name', d.Pre_Planner_Name);
  setAddr('Pre_Planner_Address', d.Pre_Planner_Address);
  fillPersonsResponsible(d.Persons_Responsible);
  if (d.Disposition_Preference) $('input[name="Disposition_Preference"][value="' + d.Disposition_Preference + '"]').prop('checked', true);
  setVal('Cemetery', d.Cemetery);
  setAddr('Burial_Location', d.Burial_Location);
  setVal('Ashes_Instructions', d.Ashes_Instructions);
  setVal('Place_of_Worship', d.Place_of_Worship);
  setVal('Ceremony_Preferences', d.Ceremony_Preferences);
  setVal('Obituary_Information', d.Obituary_Information);
  setVal('Clothing_and_Accessories', d.Clothing_and_Accessories);
  setVal('Flowers', d.Flowers);
  setVal('Songs', d.Songs);
  setVal('Readings', d.Readings);
  setVal('Prayers', d.Prayers);
  setVal('Imagined_Service', d.Imagined_Service);
  fillIntermentType(d.Interment_Type);
  setVal('Interment_Description', d.Interment_Description);
  setVal('Programme_Style', d.Programme_Style);
  setVal('Headstone_Type', d.Headstone_Type);
  setVal('Inscription', d.Inscription);
  setVal('Additional_Instructions', d.Additional_Instructions);
}
// Prefill from the CRM module Pre_Need_Questionnaire (flat fields -- see
// getQuestionnaireForDeal.dg). Persons_Responsible rows there only carry a
// single combined "Name1" string (no first/last split), so it's adapted into
// the same {Name:{first_name,last_name}, Relationship, Phone} shape
// fillPersonsResponsible() already expects from the Creator-record path.
function fillFormFromCrm(d){
  if (d.signatureDataUrl) fillSignatureFromDataUrl(d.signatureDataUrl);
  setVal('Pre_Planner_Name_first_name', d.Pre_Planner_First_Name);
  setVal('Pre_Planner_Name_last_name', d.Pre_Planner_Last_Name);
  setVal('Pre_Planner_Address_address_line_1', d.Pre_Planner_Address_Line_1);
  setVal('Pre_Planner_Address_address_line_2', d.Pre_Planner_Address_Line_2);
  setVal('Pre_Planner_Address_district_city', d.Pre_Planner_City);
  setVal('Pre_Planner_Address_state_province', d.Pre_Planner_State);
  setVal('Pre_Planner_Address_postal_Code', d.Pre_Planner_Postal_Code);
  setVal('Pre_Planner_Address_country', d.Pre_Planner_Country);

  var adaptedRows = [];
  var rawRows = d.Persons_Responsible || [];
  for (var i = 0; i < rawRows.length; i++){
    var row = rawRows[i];
    var full = ('' + (row.Name1 || '')).trim();
    var parts = full.split(' ');
    adaptedRows.push({
      Name: { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') },
      Relationship: row.Relationship,
      Phone: row.Phone
    });
  }
  fillPersonsResponsible(adaptedRows);

  if (d.Disposition_Preference) $('input[name="Disposition_Preference"][value="' + d.Disposition_Preference + '"]').prop('checked', true);
  setVal('Cemetery', d.Cemetery);
  setVal('Burial_Location_address_line_1', d.Burial_Location_Line_1);
  setVal('Burial_Location_address_line_2', d.Burial_Location_Line_2);
  setVal('Burial_Location_district_city', d.Burial_Location_City);
  setVal('Burial_Location_state_province', d.Burial_Location_State);
  setVal('Burial_Location_postal_Code', d.Burial_Location_Postal_Code);
  setVal('Ashes_Instructions', d.Ashes_Instructions);
  setVal('Place_of_Worship', d.Place_of_Worship);
  setVal('Ceremony_Preferences', d.Ceremony_Preferences);
  setVal('Obituary_Information', d.Obituary_Information);
  setVal('Clothing_and_Accessories', d.Clothing_and_Accessories);
  setVal('Flowers', d.Flowers);
  setVal('Songs', d.Songs);
  setVal('Readings', d.Readings);
  setVal('Prayers', d.Prayers);
  setVal('Imagined_Service', d.Imagined_Service);
  fillIntermentType(d.Interment_Type);
  setVal('Interment_Description', d.Interment_Description);
  setVal('Programme_Style', d.Programme_Style);
  setVal('Headstone_Type', d.Headstone_Type);
  setVal('Inscription', d.Inscription);
  setVal('Additional_Instructions', d.Additional_Instructions);
}

/* ===================================================================
   Submit -> addRecords -> completePreNeedQuestionnaire
   =================================================================== */
function buildData(){
  return {
    "Deal_ID": SYS.deal_id,
    "Pre_Planner_Name": nameObj('Pre_Planner_Name'),
    "Pre_Planner_Address": addrObj('Pre_Planner_Address'),
    "Persons_Responsible": buildPersonsResponsible(),
    "Disposition_Preference": $('input[name="Disposition_Preference"]:checked').val() || "",
    "Cemetery": v('Cemetery'),
    "Burial_Location": addrObj('Burial_Location'),
    "Ashes_Instructions": v('Ashes_Instructions'),
    "Place_of_Worship": v('Place_of_Worship'),
    "Ceremony_Preferences": v('Ceremony_Preferences'),
    "Obituary_Information": v('Obituary_Information'),
    "Clothing_and_Accessories": v('Clothing_and_Accessories'),
    "Flowers": v('Flowers'),
    "Songs": v('Songs'),
    "Readings": v('Readings'),
    "Prayers": v('Prayers'),
    "Imagined_Service": v('Imagined_Service'),
    "Interment_Type": buildIntermentType(),
    "Interment_Description": v('Interment_Description'),
    "Programme_Style": v('Programme_Style'),
    "Headstone_Type": v('Headstone_Type'),
    "Inscription": v('Inscription'),
    "Additional_Instructions": v('Additional_Instructions')
  };
}
$(document).on('click', '#saveBtn', function(){
  $('#saveBtn').prop('disabled', true);
  showOverlay("Saving your information...");
  setMsg("Saving...", true);
  var payloadData = clean(buildData());
  var signatureData = getSignatureDataUrl(); // sent separately -- Creator's Signature field can't be written via Deluge, see completePreNeedQuestionnaire.dg
  callApiPost('submitFinalWishes', { deal_id: SYS.deal_id, data: JSON.stringify(payloadData), crm_record_id: SYS.crmQid }).then(function(resp){
    console.log("submitFinalWishes response:", resp); // remove once confirmed
    var d = apiData(resp) || {};
    if (d.status === "success" && d.recordId){
      if (d.crmQuestionnaireId) SYS.crmQid = d.crmQuestionnaireId;
      // POST (not the GET callApi()) -- a base64 signature image can be many
      // KB, well past safe URL query-string length.
      callApiPost('completePreNeedQuestionnaire', { deal_id: SYS.deal_id, record_id: d.recordId, signature_data: signatureData, crm_record_id: SYS.crmQid }).then(function(resp2){
        console.log("completePreNeedQuestionnaire response:", apiData(resp2)); // remove once confirmed
        hideOverlay();
        showThankYou();
      }).catch(function(e2){
        console.log("completePreNeedQuestionnaire failed:", e2); // main data still saved -- shown as success regardless
        hideOverlay();
        showThankYou();
      });
      return;
    }
    hideOverlay();
    setMsg("Save returned: " + JSON.stringify(resp), false);
    $('#saveBtn').prop('disabled', false);
  }).catch(function(e){
    hideOverlay();
    setMsg("Error: " + JSON.stringify(e), false);
    $('#saveBtn').prop('disabled', false);
  });
});

/* ===================================================================
   Boot: SDK readiness -> capture URL params -> prefill/resume
   =================================================================== */
var SYS = { deal_id: "", record_id: "", owner: "", edit_url: "", crmQid: "" };
var sdkReady = false, sdkPollTimer = null;
function fromObj(p){
  if (!p) return;
  SYS.deal_id = p.deal_id || SYS.deal_id;
  SYS.record_id = p.record_id || SYS.record_id;
  SYS.owner = p.owner || SYS.owner;
}
function captureParams(){
  return new Promise(function(resolve){
    var done = false;
    function finish(){ if (!done){ done = true; resolve(); } }
    try{
      if (window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.UTIL && ZOHO.CREATOR.UTIL.getQueryParams){
        var r = ZOHO.CREATOR.UTIL.getQueryParams();
        if (r && r.then){ r.then(function(p){ fromObj(p); finish(); }).catch(function(){ finish(); }); return; }
        else { fromObj(r); finish(); return; }
      }
    }catch(e){}
    finish();
  });
}
function onSdkReady(){
  captureParams().then(function(){
    if (!SYS.deal_id){ return; }
    showOverlay("Loading details...");
    callApi('getDeal', { deal_id: SYS.deal_id }).then(function(r){
      var d = apiData(r) || {};
      $('#dealSub').text(d.dealName ? ("For: " + d.dealName) : "");
      SYS.edit_url = d.editUrl || "";
      // Prefill/resume now sources from the CRM module Pre_Need_Questionnaire
      // (per the user's decision), not Final_Wishes_Form/getCreatorRecord --
      // that stays a parallel write-only store.
      return callApi('getQuestionnaireForDeal', { deal_id: SYS.deal_id }).then(function(r2){
        var qd = apiData(r2) || {};
        if (qd.found && qd.record){
          SYS.crmQid = qd.record.id || "";
          fillFormFromCrm(qd.record);
        } else {
          var parts = ('' + (d.plannerName || '')).split(' ');
          setVal('Pre_Planner_Name_first_name', parts[0] || '');
          setVal('Pre_Planner_Name_last_name', parts.slice(1).join(' '));
          setAddr('Pre_Planner_Address', d.plannerAddress);
        }
        hideOverlay();
      });
    }).catch(function(e){
      hideOverlay();
      setMsg("Could not load deal details: " + JSON.stringify(e), false);
    });
  });
}
function checkReady(attempt){
  attempt = attempt || 0;
  if (sdkReady) return;
  if (window.ZOHO && ZOHO.CREATOR && ZOHO.CREATOR.DATA && typeof ZOHO.CREATOR.DATA.addRecords === 'function'){
    sdkReady = true;
    if (sdkPollTimer){ clearTimeout(sdkPollTimer); sdkPollTimer = null; }
    onSdkReady();
    return;
  }
  if (attempt > 150){
    setMsg("Zoho DATA API not available.", false);
    return;
  }
  sdkPollTimer = setTimeout(function(){ checkReady(attempt + 1); }, 100);
}

// Live "N / 2000" counter under every capped textarea -- generic, so any
// textarea[maxlength] gets one without needing its own hand-written markup.
function initCharCounters(){
  $('textarea[maxlength]').each(function(){
    var $ta = $(this);
    var max = parseInt($ta.attr('maxlength'), 10) || 0;
    var $count = $('<div class="char-count"></div>');
    $ta.after($count);
    function update(){
      var len = $ta.val().length;
      $count.text(len + ' / ' + max);
      $count.toggleClass('near-limit', len >= max);
    }
    $ta.on('input', update);
    update();
  });
}

$(document).ready(function(){
  initSignaturePad();
  initCharCounters();
  prAddRow();
  checkReady(0);
});
