// ============================================================================
// DFH Funeral Preparation -- app.js  (ZP-TBD-100)
// One widget, two entry pages (portal profiles get only their own page):
//   viewing.html -> window.FP_PART = "viewing"  Part 1 Family Viewing (Union Street)
//   prep.html    -> window.FP_PART = "prep"     Part 2 Pre-Funeral Reconciliation (Ms FS)
// Live CRM data through the app's Custom APIs; the app's own ticks/answers are saved
// in Creator forms by those APIs. Plain JS, one IIFE, event delegation (data-act).
// ============================================================================
(function(){
"use strict";

// ===== 1. CONSTANTS & STATE =====
var WS = "delapenhafuneralhome";
var PART = window.FP_PART === "prep" ? "prep" : "viewing";
var API = {
  viewingList:   { name:"FP_Viewing_List",    method:"GET"  },
  getCase:       { name:"FP_Get_Case",        method:"POST" },
  setStatus:     { name:"FP_Set_Status",      method:"POST" },
  submitViewing: { name:"FP_Submit_Viewing",  method:"POST" },
  toggleChange:  { name:"FP_Toggle_Change",   method:"POST" },
  changesList:   { name:"FP_Changes_List",    method:"GET"  },
  funeralList:   { name:"FP_Funeral_List",    method:"POST" },
  saveDealField: { name:"FP_Save_Deal_Field", method:"POST" },
  saveCheck:     { name:"FP_Save_Check",      method:"POST" }
};
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
// quick-add suggestions for the family's appearance requests (Andrea's examples + common ones)
var CHANGE_SUGGESTIONS = ["Shave","Less make-up","More make-up","Bringing a hat","Change hairstyle","Lipstick colour","Remove jewellery","Add glasses"];

var state = {
  sdkReady:false, view: PART==="prep" ? "prep" : "viewList", loginEmail:"",
  vl:{ rows:null, loading:false, error:"", sel:"", f:{ q:"", show:"open" } },
  ch:{ rows:null, loading:false, error:"", f:{ q:"", show:"open" } },
  pr:{ rows:null, loading:false, error:"", sel:"", date:"", f:{ q:"" } },
  cases:{},          // dealId -> getCase result
  modal:null
};

// ===== 2. UTILITIES =====
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function pad2(n){ return (n<10?"0":"")+n; }
function str(v){ return v==null ? "" : String(v); }
function lkName(o){ return (o && typeof o==="object") ? str(o.name) : str(o); }
function obj(o){ return (o && typeof o==="object") ? o : {}; }
function errMsg(e){ if(e && e.message) return e.message; try{ return JSON.stringify(e); }catch(_){ return String(e); } }
function truthy(v){ return v===true || v==="true"; }
// Jamaica is -05:00 all year. CRM values are read as wall-clock text, never through Date.
function jamNow(){ return new Date(Date.now() - 5*3600*1000); }
function todayKey(){ var j=jamNow(); return j.getUTCFullYear()+"-"+pad2(j.getUTCMonth()+1)+"-"+pad2(j.getUTCDate()); }
function addDaysKey(key, n){ var p=key.split("-").map(Number), x=new Date(Date.UTC(p[0],p[1]-1,p[2]+n)); return x.getUTCFullYear()+"-"+pad2(x.getUTCMonth()+1)+"-"+pad2(x.getUTCDate()); }
function dPart(iso){ iso=str(iso); return iso.length>=10 ? iso.substring(0,10) : ""; }
function tPart(iso){ iso=str(iso); var i=iso.indexOf("T"); return i<0 ? "" : iso.substring(i+1,i+6); }
function fmtDate(iso){ var d=dPart(iso); if(!d) return ""; var p=d.split("-"); return MONTHS[parseInt(p[1],10)-1]+" "+parseInt(p[2],10)+", "+p[0]; }
function fmtTime(iso){ var t=tPart(iso); if(!t) return ""; var hh=parseInt(t.substring(0,2),10), mm=t.substring(3,5); if(isNaN(hh)) return ""; var ap=hh>=12?"PM":"AM", h=hh%12; if(h===0) h=12; return h+":"+mm+" "+ap; }
function fmtDT(iso){ var d=fmtDate(iso), t=fmtTime(iso); return d && t ? d+" "+t : (d||""); }
function sortKey(iso){ return str(iso).replace(/[^0-9]/g,"").substring(0,14); }
function sameMinute(a,b){ return sortKey(a).substring(0,12)===sortKey(b).substring(0,12); }
function localToIso(v){ v=str(v).trim(); if(!v) return ""; if(v.length===16) v+=":00"; return v.substring(0,19)+"-05:00"; }
function isoToLocal(iso){ iso=str(iso); return iso.length>=16 ? iso.substring(0,16) : ""; }
function byWho(email, at){ var who=str(email).split("@")[0]; return joinNonEmpty([who, fmtDT(at)]," · "); }
function joinNonEmpty(arr, sep){ return arr.filter(function(x){ return str(x).trim()!==""; }).join(sep||", "); }
function norm(s){ return str(s).trim().toLowerCase().replace(/\s+/g," "); }

var toastT=null;
function toast(msg, kind){
  var t=$("toast"); t.textContent=msg; t.className="toast show"+(kind?" "+kind:"");
  clearTimeout(toastT); toastT=setTimeout(function(){ t.className="toast"; }, kind==="err"?6000:3000);
}

// ===== 3. API =====
function unwrap(resp){
  if(resp==null) return null;
  var out=resp;
  if(typeof out==="object"){ if(out.result!==undefined) out=out.result; else if(out.output!==undefined) out=out.output; }
  if(typeof out==="string"){ var s=out.trim(); if(s.charAt(0)==="{"||s.charAt(0)==="["){ try{ return JSON.parse(s); }catch(e){} } }
  return out;
}
function call(key, params){
  return new Promise(function(resolve, reject){
    if(!state.sdkReady){ reject(new Error("Creator SDK not ready")); return; }
    var m=API[key]; if(!m){ reject(new Error("No API mapping for "+key)); return; }
    var cfg={ api_name:m.name, workspace_name:WS, http_method:m.method };
    if(m.method==="POST"){ cfg.content_type="application/json"; cfg.payload=params||{}; }
    try{
      ZOHO.CREATOR.API.invokeCustomApi(cfg).then(function(r){ resolve(unwrap(r)); }).catch(function(e){ console.error("[FP]",m.name,e); reject(e); });
    }catch(e){ reject(e); }
  });
}
function ok(r){ return r && r.status==="success"; }
function loadCase(dealId, force){
  if(!force && state.cases[dealId]) return Promise.resolve(state.cases[dealId]);
  return call("getCase",{ dealId:dealId }).then(function(r){
    if(!ok(r)) throw new Error((r&&r.message)||"Could not load this case");
    state.cases[dealId]=r; return r;
  });
}

// ===== 4. SHELL & NAVIGATION =====
var NAV = PART==="prep"
  ? [ { label:"Pre-Funeral", items:[ { view:"prep", icon:"ti-checklist", text:"Funeral Prep", badge:"badgePrep" } ] } ]
  : [ { label:"Family Viewing", items:[
        { view:"viewList", icon:"ti-eye", text:"Viewing List", badge:"badgeView" },
        { view:"changes", icon:"ti-brush", text:"Changes to Complete", badge:"badgeChg" } ] } ];
function renderSidebar(){
  var h="";
  NAV.forEach(function(sec){
    h+='<div class="sidebar-section"><div class="sidebar-label">'+esc(sec.label)+'</div>';
    sec.items.forEach(function(it){
      h+='<div class="nav-item'+(state.view===it.view?" active":"")+'" data-view="'+it.view+'"><i class="ti '+it.icon+'"></i>'+esc(it.text)+'<span class="nav-badge" id="'+it.badge+'">…</span></div>';
    });
    h+='</div>';
  });
  $("sidebar").innerHTML=h;
  $("logoSub").textContent = PART==="prep" ? "Funeral Prep" : "Family Viewing";
}
function setView(v){
  state.view=v;
  var items=document.querySelectorAll(".nav-item");
  for(var i=0;i<items.length;i++) items[i].classList.toggle("active", items[i].getAttribute("data-view")===v);
  $("app").classList.remove("sidebar-open"); $("app").classList.remove("show-detail");
  if(v==="viewList") openViewList();
  else if(v==="changes") openChanges();
  else openPrep();
}
function badge(id, n){ var b=$(id); if(b) b.textContent = n==null ? "…" : n; }
function splitPane(listHtml, wide){
  $("contentArea").innerHTML='<div class="list-pane" id="listPane">'+listHtml+'</div>'+
    '<div class="detail-wrap'+(wide?" wide":"")+'"><div class="detail-hdr" id="detailHdr"><button class="back-btn" data-act="detail-back">&#8592; Back</button><div class="d-name">Select a deceased</div></div>'+
    '<div class="detail-body" id="detailBody"><div class="detail-empty">Click a deceased to open it.</div></div></div>';
}
function header(title, sub, extra){
  return '<div class="vh-row"><div class="view-title">'+esc(title)+'</div><div class="view-sub">'+esc(sub)+'</div>'+
    '<div class="vh-actions"><button class="btn" data-act="refresh"><i class="ti ti-refresh"></i>Refresh</button></div></div>'+(extra||"");
}

// ===== 5. PART 1 -- VIEWING LIST =====
function statusBadge(s){
  if(!s) return '<span class="badge b-slate">No status</span>';
  var cls = s==="Ready for Viewing" ? "b-green" : (s==="Transfer Received" ? "b-status" : "b-type");
  return '<span class="badge '+cls+'">'+esc(s)+'</span>';
}
function openViewList(){
  var s=state.vl;
  $("viewHeader").innerHTML=header("Viewing List","Embalming complete · Funeral with Burial, Cremation with Service, Cremation Only · soonest funeral first",
    '<div class="filters">'+
      ['open','viewed','all'].map(function(k){ var lbl={open:"To view",viewed:"Form done",all:"All"}[k]; return '<button class="filter-pill'+(s.f.show===k?" active":"")+'" data-act="vl-show" data-k="'+k+'">'+lbl+'</button>'; }).join("")+
      '<div class="search-box"><i class="ti ti-search"></i><input id="vlSearch" placeholder="Search name…" value="'+esc(s.f.q)+'"></div></div>');
  splitPane('', true);
  if(s.rows===null) loadViewList(); else { renderViewList(); if(s.sel) renderViewCase(s.sel); }
}
function loadViewList(){
  var s=state.vl; s.loading=true;
  if(state.view==="viewList") $("listPane").innerHTML='<div class="loading"><i class="ti ti-loader-2"></i>Loading from CRM…</div>';
  call("viewingList").then(function(r){
    s.loading=false;
    if(!ok(r)) throw new Error((r&&r.message)||"Could not load the viewing list");
    s.rows=(r.rows||[]).map(function(x){
      var d=obj(x.deal), f=obj(x.form);
      return { dealId:str(d.id), name:str(d.Name_of_Deceased)||str(d.Deal_Name), pipeline:str(d.Pipeline), type:str(d.Type), stage:str(d.Stage),
        funeral:str(d.Funeral_Time), owner:lkName(d.Owner), loc:str(d.Case_Location), church:str(d.Church_Chapel),
        status:str(x.deceased_status), hasOps:truthy(x.has_ops), viewed:!!f.id, viewedAt:str(f.submitted_at), viewedBy:str(f.submitted_by),
        openChanges:parseInt(x.open_changes,10)||0, version:str(x.version) };
    });
    badge("badgeView", s.rows.filter(function(r){ return !r.viewed; }).length);
    if(state.view==="viewList") renderViewList();
  }).catch(function(e){
    s.loading=false; s.rows=null;
    if(state.view==="viewList") $("listPane").innerHTML='<div class="list-empty">Could not load the viewing list: '+esc(errMsg(e))+'</div>';
  });
}
function vlFiltered(){
  var s=state.vl, q=norm(s.f.q);
  return (s.rows||[]).filter(function(r){
    if(s.f.show==="open" && r.viewed) return false;
    if(s.f.show==="viewed" && !r.viewed) return false;
    if(q && norm(r.name).indexOf(q)<0) return false;
    return true;
  }).sort(function(a,b){ var x=sortKey(a.funeral)||"99999999", y=sortKey(b.funeral)||"99999999"; return x<y?-1:(x>y?1:0); });
}
function renderViewList(){
  var el=$("listPane"); if(!el) return;
  var list=vlFiltered();
  if(!list.length){ el.innerHTML='<div class="list-empty">'+(state.vl.f.show==="open"?"No one is waiting for a viewing.":"Nothing to show.")+'</div>'; return; }
  var h='<div class="card-grid">';
  list.forEach(function(r){
    h+='<div class="tc'+(r.dealId===state.vl.sel?" sel":"")+'" data-act="vl-open" data-deal="'+esc(r.dealId)+'">'+
      '<div class="card-top"><span class="sdot" style="background:'+(r.viewed?"var(--green)":"var(--amber)")+'"></span><div class="card-name">'+esc(r.name||"(no name)")+'</div></div>'+
      (r.funeral?'<div class="card-line"><i class="ti ti-calendar-event"></i>Funeral '+esc(fmtDT(r.funeral))+'</div>':'<div class="card-line"><i class="ti ti-calendar-event"></i>No funeral date yet</div>')+
      (r.church?'<div class="card-line"><i class="ti ti-building-church"></i>'+esc(r.church)+'</div>':'')+
      '<div class="card-bot"><span class="badge b-type">'+esc(r.pipeline||r.type)+'</span>'+statusBadge(r.status)+
        (r.viewed?'<span class="badge b-green">Form done</span>':'<span class="badge b-warn">Form not done</span>')+
        (r.openChanges?'<span class="badge b-red">'+r.openChanges+' change'+(r.openChanges>1?"s":"")+' to do</span>':'')+'</div></div>';
  });
  el.innerHTML=h+'</div>';
}
function renderViewCase(dealId){
  state.vl.sel=dealId;
  var row=null; (state.vl.rows||[]).forEach(function(r){ if(r.dealId===dealId) row=r; });
  var cards=document.querySelectorAll("#listPane .tc");
  for(var i=0;i<cards.length;i++) cards[i].classList.toggle("sel", cards[i].getAttribute("data-deal")===dealId);
  $("app").classList.add("show-detail");
  $("detailHdr").innerHTML='<button class="back-btn" data-act="detail-back">&#8592; Back</button><div class="d-name">'+esc(row?row.name:"")+'</div><div class="d-meta">'+esc(row?joinNonEmpty([row.pipeline, row.funeral?("Funeral "+fmtDT(row.funeral)):""]," · "):"")+'</div>';
  $("detailBody").innerHTML='<div class="loading"><i class="ti ti-loader-2"></i>Loading…</div>';
  loadCase(dealId).then(function(c){ if(state.vl.sel===dealId && state.view==="viewList") paintViewCase(c); })
    .catch(function(e){ $("detailBody").innerHTML='<div class="list-empty">'+esc(errMsg(e))+'</div>'; });
}
function frow(label, val){ var v=str(val); return '<div class="frow"><span class="flbl">'+esc(label)+'</span><span class="fval'+(v?"":" empty")+'">'+(v?esc(v):"—")+'</span></div>'; }
function paintViewCase(c){
  var d=obj(c.deal), f=obj(c.form), st=str(c.deceased_status), dealId=str(d.id);
  var h='';
  // status buttons
  h+='<div class="container"><div class="con-title"><i class="ti ti-flag"></i>Status</div>'+
    frow("Deceased status", st||"No status yet")+
    '<div class="status-row">'+
      '<button class="btn status-btn'+(st==="Transfer Received"?" on":"")+'" data-act="set-status" data-status="Transfer Received" data-deal="'+esc(dealId)+'"><i class="ti ti-truck-delivery"></i>Transfer Received</button>'+
      '<button class="btn status-btn'+(st==="Ready for Viewing"?" on":"")+'" data-act="set-status" data-status="Ready for Viewing" data-deal="'+esc(dealId)+'"><i class="ti ti-eye-check"></i>Ready for Viewing</button>'+
    '</div><div class="ph-note">Transfer Received is a placeholder until the transfer process is finalised. Ready for Viewing: press it when the deceased comes down from the Operations Center.</div>'+
    (c.ops_id?'':'<div class="ph-note" style="color:var(--red)">No Operations record in CRM yet -- the status can\'t be saved.</div>')+'</div>';
  // case details
  h+='<div class="container white"><div class="con-title"><i class="ti ti-user"></i>Deceased</div>'+
    frow("Name",d.Name_of_Deceased)+frow("Date of death",fmtDate(d.Date_of_Death))+frow("Funeral",fmtDT(d.Funeral_Time))+
    frow("Church / chapel",d.Church_Chapel)+frow("Casket type",d.Casket_Type)+(c.version==="Funeral with Burial"?frow("Grave type",d.Grave_Type):"")+
    frow("Funeral director",d.Owner)+frow("Form version",c.version)+'</div>';
  // form
  h+='<div class="container white"><div class="con-title"><i class="ti ti-forms"></i>Family Viewing Form</div>';
  if(f.id){
    h+=frow("Completed",byWho(f.submitted_by,f.submitted_at))+frow("Contact for the driver",joinNonEmpty([f.contact_name,f.contact_phone]," · "))+
      frow("Time change requested",f.time_change==="Yes"?("Yes -- "+fmtDT(f.new_funeral_time)):"No")+frow("Staff initials",f.staff_initials);
  } else h+='<div class="ph-note" style="font-style:normal;margin-bottom:6px">Not completed yet. Fill it in with the family during the viewing.</div>';
  h+='<button class="btn primary" style="margin-top:8px" data-act="open-form" data-deal="'+esc(dealId)+'"><i class="ti ti-pencil"></i>'+(f.id?"Open / update the form":"Fill in the form")+'</button></div>';
  // changes to complete
  h+='<div class="container white"><div class="con-title"><i class="ti ti-brush"></i>Changes to complete</div>'+changesHtml(c.changes||[], dealId, true)+'</div>';
  $("detailBody").innerHTML=h;
}
function changesHtml(list, dealId, editable){
  if(!list.length) return '<div class="ph-note" style="font-style:normal">No changes requested.</div>';
  return list.map(function(ch){
    return '<label class="chg'+(ch.done?" done":"")+'"><input type="checkbox"'+(ch.done?" checked":"")+(editable?"":" disabled")+' data-act="toggle-change" data-item="'+esc(ch.id)+'" data-deal="'+esc(dealId)+'">'+
      '<span class="ct"><span class="tx">'+esc(ch.text)+'</span>'+(ch.done?'<span class="cb">Done -- '+esc(byWho(ch.done_by,ch.done_at))+'</span>':'')+'</span></label>';
  }).join("");
}
function setStatus(dealId, status, btn){
  var c=state.cases[dealId];
  if(c && str(c.deceased_status)===status){ toast("Already set to "+status); return; }
  btn.disabled=true;
  call("setStatus",{ dealId:dealId, status:status }).then(function(r){
    btn.disabled=false;
    if(!ok(r)){ toast((r&&r.message)||"Could not save the status","err"); return; }
    if(c) c.deceased_status=status;
    (state.vl.rows||[]).forEach(function(x){ if(x.dealId===dealId) x.status=status; });
    renderViewList(); if(c) paintViewCase(c);
    toast("Status set to "+status,"ok");
  }).catch(function(e){ btn.disabled=false; toast("Could not save the status: "+errMsg(e),"err"); });
}
function toggleChange(itemId, dealId, done, input){
  input.disabled=true;
  call("toggleChange",{ itemId:itemId, done: done?"true":"false" }).then(function(r){
    input.disabled=false;
    if(!ok(r)){ input.checked=!done; toast((r&&r.message)||"Could not save","err"); return; }
    var upd=function(ch){ if(ch.id===itemId){ ch.done=done; ch.done_by=str(r.done_by); ch.done_at=str(r.done_at); } };
    var c=state.cases[dealId]; if(c) (c.changes||[]).forEach(upd);
    (state.ch.rows||[]).forEach(function(g){ (g.changes||[]).forEach(upd); });
    (state.vl.rows||[]).forEach(function(x){ if(x.dealId===dealId) x.openChanges=Math.max(0, x.openChanges+(done?-1:1)); });
    if(state.view==="viewList"){ renderViewList(); if(c) paintViewCase(c); }
    else if(state.view==="changes") renderChanges();
    toast(done?"Marked done":"Marked not done","ok");
  }).catch(function(e){ input.disabled=false; input.checked=!done; toast("Could not save: "+errMsg(e),"err"); });
}

// ===== 6. PART 1 -- FAMILY VIEWING FORM (modal) =====
function openForm(dealId){
  loadCase(dealId).then(function(c){
    var d=obj(c.deal), f=obj(c.form), burial=c.version==="Funeral with Burial";
    var changes = (c.changes||[]).map(function(ch){ return ch.text; });
    if(!changes.length && f.changes_text) changes=f.changes_text.split(/\r?\n/).filter(function(x){ return x.trim(); });
    state.modal={ dealId:dealId, burial:burial, version:c.version, funeralShown:str(d.Funeral_Time), changes:changes.length?changes:[""] };
    $("modalBox").classList.add("wide");
    $("modalTitle").textContent="Family Viewing Form -- "+c.version;
    $("modalSub").textContent=str(d.Name_of_Deceased);
    $("modalErr").style.display="none";
    var h='';
    h+='<div class="two"><div class="mf"><label>Deceased name</label><input id="ff_name" value="'+esc(f.deceased_name||d.Name_of_Deceased)+'"></div>'+
       '<div class="mf"><label>Date of death</label><input type="date" id="ff_dod" value="'+esc(dPart(f.date_of_death||d.Date_of_Death))+'"></div></div>';
    // Casket type is read-only: CRM rebuilds the Deal's Casket Type from its casket product line,
    // so a typed value would not stick (change the casket product in CRM instead)
    h+='<div class="two"><div class="mf"><label>Casket type (from the casket product in CRM)</label><input id="ff_casket" value="'+esc(d.Casket_Type)+'" disabled></div>'+
       '<div class="mf"><label>Funeral date &amp; time (CRM)</label><input value="'+esc(fmtDT(d.Funeral_Time)||"Not set")+'" disabled></div></div>';
    if(burial){
      var gt=f.grave_type||str(d.Grave_Type);
      h+='<div class="mf"><label>Grave type</label><select id="ff_grave"><option value="">-- choose --</option>'+["Vault","Sepulcher"].map(function(o){ return '<option'+(o===gt?" selected":"")+'>'+o+'</option>'; }).join("")+'</select></div>';
    }
    var tc=f.time_change==="Yes";
    h+='<div class="mf"><label>Did the family ask to change the funeral time?</label><div class="radio-row">'+
       '<label><input type="radio" name="ff_tc" value="No"'+(tc?"":" checked")+' data-act="ff-tc"> No</label><label><input type="radio" name="ff_tc" value="Yes"'+(tc?" checked":"")+' data-act="ff-tc"> Yes</label></div></div>';
    h+='<div class="mf" id="ff_newtime_wrap" style="display:'+(tc?"block":"none")+'"><label>New funeral date &amp; time</label><input type="datetime-local" id="ff_newtime" value="'+esc(isoToLocal(f.new_funeral_time))+'"><div class="hint">CRM moves the funeral to this time and tells the funeral director, the same as the Zoho Form did.</div></div>';
    h+='<div class="two"><div class="mf"><label>Contact the driver should call on the day</label><input id="ff_cname" placeholder="Name" value="'+esc(f.contact_name)+'"></div>'+
       '<div class="mf"><label>Contact phone</label><input id="ff_cphone" type="tel" placeholder="e.g. 876 555 1234" value="'+esc(f.contact_phone)+'"></div></div>';
    h+='<div class="mf"><label>How the deceased looks -- every change the family wants</label><div id="ff_changes"></div>'+
       '<div class="chips">'+CHANGE_SUGGESTIONS.map(function(s){ return '<button type="button" class="chip" data-act="ff-chip" data-text="'+esc(s)+'">+ '+esc(s)+'</button>'; }).join("")+'</div>'+
       '<button type="button" class="btn" data-act="ff-add"><i class="ti ti-plus"></i>Add a change</button>'+
       '<div class="mf" style="margin-top:8px"><div class="chk"><input type="checkbox" id="ff_none"'+(f.id && !changes.filter(function(x){ return x.trim(); }).length?" checked":"")+'> The family is happy with how the deceased looks -- no changes</div></div></div>';
    h+='<div class="mf"><label>Staff initials</label><input id="ff_initials" maxlength="6" style="max-width:120px" value="'+esc(f.staff_initials)+'"></div>';
    $("modalFields").innerHTML=h;
    renderFormChanges();
    $("modalSave").textContent="Submit"; $("modalSave").disabled=false;
    $("modalBg").classList.add("open");
  }).catch(function(e){ toast("Could not open the form: "+errMsg(e),"err"); });
}
function readFormChanges(){
  var m=state.modal; if(!m) return;
  var ins=document.querySelectorAll("#ff_changes input"); m.changes=[];
  for(var i=0;i<ins.length;i++) m.changes.push(ins[i].value);
}
function renderFormChanges(){
  var m=state.modal, el=$("ff_changes"); if(!m||!el) return;
  el.innerHTML=m.changes.map(function(t,i){
    return '<div class="chg-edit"><input value="'+esc(t)+'" placeholder="e.g. Less make-up"><button type="button" class="btn" data-act="ff-del" data-i="'+i+'" title="Remove"><i class="ti ti-x"></i></button></div>';
  }).join("");
}
function closeModal(){ $("modalBg").classList.remove("open"); $("modalBox").classList.remove("wide"); state.modal=null; }
function submitForm(){
  var m=state.modal; if(!m) return;
  readFormChanges();
  var err=function(msg){ var e=$("modalErr"); e.textContent=msg; e.style.display="block"; $("modalFields").parentNode.scrollTop=0; };
  var tcEl=document.querySelector('input[name="ff_tc"]:checked'), tc=tcEl?tcEl.value:"No";
  var changes=m.changes.map(function(x){ return x.trim(); }).filter(function(x){ return x; });
  var none=$("ff_none").checked;
  var payload={
    version:m.version, deceasedName:$("ff_name").value.trim(), dateOfDeath:$("ff_dod").value,
    casketType:$("ff_casket").value.trim(), graveType:m.burial?$("ff_grave").value:"",
    funeralTime:m.funeralShown, timeChange:tc, newFuneralTime: tc==="Yes" ? localToIso($("ff_newtime").value) : "",
    contactName:$("ff_cname").value.trim(), contactPhone:$("ff_cphone").value.trim(), staffInitials:$("ff_initials").value.trim(),
    changes: none ? [] : changes
  };
  if(!payload.deceasedName) return err("Enter the deceased's name.");
  if(m.burial && !payload.graveType) return err("Choose the grave type (Vault or Sepulcher).");
  if(tc==="Yes" && !payload.newFuneralTime) return err("Enter the new funeral date and time, or choose No.");
  if(!payload.contactPhone) return err("Enter the phone number the driver should call on the day.");
  if(!changes.length && !none) return err("Add the changes the family wants, or tick 'no changes'.");
  if(changes.length && none) return err("You ticked 'no changes' but also listed changes -- untick it or remove the changes.");
  if(!payload.staffInitials) return err("Enter your initials.");
  $("modalSave").disabled=true; $("modalSave").textContent="Submitting…";
  call("submitViewing",{ dealId:m.dealId, formJson:JSON.stringify(payload) }).then(function(r){
    if(!ok(r)){ $("modalSave").disabled=false; $("modalSave").textContent="Submit"; return err((r&&r.message)||"Submit failed"); }
    var dealId=m.dealId; closeModal();
    toast("Viewing form submitted -- CRM has been updated","ok");
    delete state.cases[dealId]; state.ch.rows=null;
    (state.vl.rows||[]).forEach(function(x){ if(x.dealId===dealId){ x.viewed=true; x.openChanges=payload.changes.length; } });
    renderViewList(); renderViewCase(dealId);
    badge("badgeView", (state.vl.rows||[]).filter(function(r){ return !r.viewed; }).length);
  }).catch(function(e){ $("modalSave").disabled=false; $("modalSave").textContent="Submit"; err("Submit failed: "+errMsg(e)); });
}

// ===== 7. PART 1 -- CHANGES TO COMPLETE =====
function openChanges(){
  var s=state.ch;
  $("viewHeader").innerHTML=header("Changes to Complete","Every viewed case and the appearance changes from its form · tick each one when it's done",
    '<div class="filters">'+['open','all'].map(function(k){ return '<button class="filter-pill'+(s.f.show===k?" active":"")+'" data-act="ch-show" data-k="'+k+'">'+(k==="open"?"Still to do":"All")+'</button>'; }).join("")+
    '<div class="search-box"><i class="ti ti-search"></i><input id="chSearch" placeholder="Search name…" value="'+esc(s.f.q)+'"></div></div>');
  $("contentArea").innerHTML='<div class="list-pane" id="listPane"></div>';
  if(s.rows===null) loadChanges(); else renderChanges();
}
function loadChanges(){
  var s=state.ch;
  if(state.view==="changes") $("listPane").innerHTML='<div class="loading"><i class="ti ti-loader-2"></i>Loading…</div>';
  call("changesList").then(function(r){
    if(!ok(r)) throw new Error((r&&r.message)||"Could not load");
    s.rows=(r.rows||[]).map(function(x){ var d=obj(x.deal); return { dealId:str(d.id), name:str(d.Name_of_Deceased)||str(d.Deal_Name), funeral:str(d.Funeral_Time), pipeline:str(d.Pipeline), changes:x.changes||[] }; });
    badge("badgeChg", s.rows.reduce(function(n,g){ return n+g.changes.filter(function(c){ return !c.done; }).length; },0));
    if(state.view==="changes") renderChanges();
  }).catch(function(e){ s.rows=null; if(state.view==="changes") $("listPane").innerHTML='<div class="list-empty">Could not load: '+esc(errMsg(e))+'</div>'; });
}
function renderChanges(){
  var s=state.ch, el=$("listPane"); if(!el) return;
  var q=norm(s.f.q);
  var groups=(s.rows||[]).filter(function(g){
    if(q && norm(g.name).indexOf(q)<0) return false;
    if(s.f.show==="open" && !g.changes.some(function(c){ return !c.done; })) return false;
    return true;
  }).sort(function(a,b){ var x=sortKey(a.funeral)||"99999999", y=sortKey(b.funeral)||"99999999"; return x<y?-1:(x>y?1:0); });
  badge("badgeChg", (s.rows||[]).reduce(function(n,g){ return n+g.changes.filter(function(c){ return !c.done; }).length; },0));
  if(!groups.length){ el.innerHTML='<div class="list-empty">'+(s.f.show==="open"?"Every change is done.":"No viewed cases yet.")+'</div>'; return; }
  el.innerHTML=groups.map(function(g){
    var left=g.changes.filter(function(c){ return !c.done; }).length;
    return '<div class="chg-group"><div class="gh"><span class="gn">'+esc(g.name)+'</span><span class="gm">'+esc(joinNonEmpty([g.funeral?("Funeral "+fmtDT(g.funeral)):"No funeral date", g.pipeline]," · "))+'</span>'+
      '<span class="badge '+(left?"b-red":"b-green")+'" style="margin-left:auto">'+(left?left+" to do":"All done")+'</span></div>'+changesHtml(g.changes, g.dealId, true)+'</div>';
  }).join("");
}

// ===== 8. PART 2 -- FUNERAL PREP =====
function openPrep(){
  var s=state.pr;
  if(!s.date) s.date=addDaysKey(todayKey(),1);
  $("viewHeader").innerHTML=header("Funeral Prep","The funerals for the day ahead · click a funeral to open its checklist",
    '<div class="filters"><span class="flabel">Funerals on</span><input type="date" class="filter-date" id="prDate" value="'+esc(s.date)+'">'+
    '<button class="filter-pill" data-act="pr-day" data-k="0">Today</button><button class="filter-pill" data-act="pr-day" data-k="1">Tomorrow</button>'+
    '<div class="search-box"><i class="ti ti-search"></i><input id="prSearch" placeholder="Search name…" value="'+esc(s.f.q)+'"></div></div>');
  splitPane('', true);
  if(s.rows===null) loadPrep(); else { renderPrep(); if(s.sel) renderPrepCase(s.sel); }
}
function loadPrep(){
  var s=state.pr;
  if(state.view==="prep") $("listPane").innerHTML='<div class="loading"><i class="ti ti-loader-2"></i>Loading from CRM…</div>';
  call("funeralList",{ forDate:s.date }).then(function(r){
    if(!ok(r)) throw new Error((r&&r.message)||"Could not load the funerals");
    s.rows=(r.rows||[]).map(function(x){ var d=obj(x.deal); return { dealId:str(d.id), name:str(d.Name_of_Deceased)||str(d.Deal_Name), funeral:str(d.Funeral_Time),
      pipeline:str(d.Pipeline), type:str(d.Type), church:str(d.Church_Chapel), interment:str(d.Place_of_Internment), owner:lkName(d.Owner),
      viewed:truthy(x.viewed), openChanges:parseInt(x.open_changes,10)||0, ticks:parseInt(x.ticks,10)||0 }; });
    badge("badgePrep", s.rows.length);
    if(state.view==="prep") renderPrep();
  }).catch(function(e){ s.rows=null; if(state.view==="prep") $("listPane").innerHTML='<div class="list-empty">Could not load the funerals: '+esc(errMsg(e))+'</div>'; });
}
function renderPrep(){
  var s=state.pr, el=$("listPane"); if(!el) return;
  var q=norm(s.f.q);
  var list=(s.rows||[]).filter(function(r){ return !q || norm(r.name).indexOf(q)>=0; })
    .sort(function(a,b){ var x=sortKey(a.funeral), y=sortKey(b.funeral); return x<y?-1:(x>y?1:0); });
  if(!list.length){ el.innerHTML='<div class="list-empty">No funerals on '+esc(fmtDate(s.date))+'.</div>'; return; }
  el.innerHTML='<div class="day-label">'+esc(fmtDate(s.date))+' · '+list.length+' funeral'+(list.length>1?"s":"")+'</div><div class="card-grid">'+list.map(function(r){
    return '<div class="tc'+(r.dealId===s.sel?" sel":"")+'" data-act="pr-open" data-deal="'+esc(r.dealId)+'">'+
      '<div class="card-top"><span class="sdot" style="background:'+(r.ticks?"var(--green)":"var(--taupe)")+'"></span><div class="card-name">'+esc(r.name)+'</div></div>'+
      '<div class="card-line"><i class="ti ti-clock"></i>'+esc(fmtTime(r.funeral))+(r.church?" · "+esc(r.church):"")+'</div>'+
      (r.interment?'<div class="card-line"><i class="ti ti-map-pin"></i>'+esc(r.interment)+'</div>':'')+
      '<div class="card-bot"><span class="badge b-type">'+esc(r.pipeline||r.type)+'</span>'+
        (r.viewed?'<span class="badge b-green">Viewing form done</span>':'<span class="badge b-warn">No viewing form</span>')+
        (r.openChanges?'<span class="badge b-red">'+r.openChanges+' change'+(r.openChanges>1?"s":"")+' not done</span>':'')+
        '<span class="badge b-slate">'+r.ticks+' tick'+(r.ticks===1?"":"s")+'</span></div></div>';
  }).join("")+'</div>';
}
function renderPrepCase(dealId, force){
  state.pr.sel=dealId;
  var cards=document.querySelectorAll("#listPane .tc");
  for(var i=0;i<cards.length;i++) cards[i].classList.toggle("sel", cards[i].getAttribute("data-deal")===dealId);
  $("app").classList.add("show-detail");
  if(force || !state.cases[dealId]) $("detailBody").innerHTML='<div class="loading"><i class="ti ti-loader-2"></i>Loading…</div>';
  loadCase(dealId, force).then(function(c){ if(state.pr.sel===dealId && state.view==="prep") paintPrepCase(c); })
    .catch(function(e){ $("detailBody").innerHTML='<div class="list-empty">'+esc(errMsg(e))+'</div>'; });
}
function chk(c, key){ var e=obj(obj(c.checks)[key]); return str(e.v) ? e : null; }
function tickHtml(c, key, label){
  var e=chk(c,key);
  return '<label class="tick"><input type="checkbox"'+(e?" checked":"")+' data-act="check" data-key="'+esc(key)+'" data-deal="'+esc(str(obj(c.deal).id))+'"><span>'+esc(label)+'</span>'+
    (e?'<span class="by">'+esc(byWho(e.by,e.at))+'</span>':'')+'</label>';
}
function secHtml(n, title, done, body){
  return '<div class="sec"><div class="sec-h"><span class="n">'+n+'</span><span class="t">'+esc(title)+'</span>'+
    '<span class="s badge '+(done?"b-green":"b-warn")+'">'+(done?"Done":"To check")+'</span></div><div class="sec-b">'+body+'</div></div>';
}
// Section 2 rows: the viewing form answer next to the Deal value
function reconRows(c){
  var d=obj(c.deal), f=obj(c.form), rows=[];
  if(!f.id) return rows;
  var formTime = f.time_change==="Yes" && f.new_funeral_time ? f.new_funeral_time : f.funeral_time;
  rows.push({ key:"Name_of_Deceased", label:"Deceased name", form:f.deceased_name, deal:str(d.Name_of_Deceased), show:function(v){ return v; }, same:function(a,b){ return norm(a)===norm(b); } });
  rows.push({ key:"Date_of_Death", label:"Date of death", form:dPart(f.date_of_death), deal:dPart(d.Date_of_Death), show:fmtDate, same:function(a,b){ return dPart(a)===dPart(b); } });
  rows.push({ key:"Funeral_Time", label:"Funeral time", form:formTime, deal:str(d.Funeral_Time), show:fmtDT, same:function(a,b){ return !a || sameMinute(a,b); } });
  if(c.version==="Funeral with Burial") rows.push({ key:"Grave_Type", label:"Grave type", form:f.grave_type, deal:str(d.Grave_Type), show:function(v){ return v; }, same:function(a,b){ return norm(a)===norm(b); } });
  // Casket type can't be saved from here (CRM rebuilds it from the casket product line) -- a
  // difference is only marked checked; the casket product is changed in CRM
  rows.push({ key:"Casket_Type", label:"Casket type", form:f.casket_type, deal:str(d.Casket_Type), noFormSave:true, show:function(v){ return v; }, same:function(a,b){ return norm(a)===norm(b); } });
  rows.push({ key:"Changes_in_Deceased_Appearence", label:"Appearance changes", form:f.changes_text, deal:str(d.Changes_in_Deceased_Appearence), show:function(v){ return v; }, same:function(a,b){ return norm(a)===norm(b); } });
  rows.forEach(function(r){ r.diff=!r.same(r.form, r.deal); });
  return rows;
}
function paintPrepCase(c){
  var d=obj(c.deal), dealId=str(d.id), f=obj(c.form);
  $("detailHdr").innerHTML='<button class="back-btn" data-act="detail-back">&#8592; Back</button><div class="d-name">'+esc(d.Name_of_Deceased||d.Deal_Name)+'</div>'+
    '<div class="d-meta">'+esc(joinNonEmpty([d.Pipeline, d.Church_Chapel, d.Owner]," · "))+'</div>';
  var h='';
  // 1. funeral time
  var s1=!!chk(c,"funeral_time");
  h+=secHtml(1,"Funeral time",s1,
    '<div class="big-time">'+esc(fmtDT(d.Funeral_Time)||"Not set")+'</div>'+
    '<div class="ph-note" style="font-style:normal">Compare it with the time printed on the funeral programme.</div>'+
    '<div class="inline-edit"><input type="datetime-local" id="ftEdit" value="'+esc(isoToLocal(d.Funeral_Time))+'"><button class="btn" data-act="save-ft" data-deal="'+esc(dealId)+'"><i class="ti ti-device-floppy"></i>Correct the time</button></div>'+
    tickHtml(c,"funeral_time","The time matches the programme"));
  // 2. viewing form differences
  var rows=reconRows(c), open=0, b2='';
  if(!f.id) b2='<div class="ph-note" style="font-style:normal">No viewing form was completed in the app for this funeral.</div>';
  else {
    b2='<table class="cmp"><tr><th></th><th>Viewing form</th><th>Deal (CRM)</th></tr>';
    rows.forEach(function(r){
      var resolved=chk(c,"recon:"+r.key), isOpen=r.diff && !resolved;
      if(isOpen) open++;
      b2+='<tr class="'+(isOpen?"diff":"")+'"><td class="fl">'+esc(r.label)+'</td><td>'+esc(r.show(r.form)||"—")+'</td><td>'+esc(r.show(r.deal)||"—")+
        (r.diff?(resolved?'<div class="cb" style="font-size:9.5px;color:var(--muted)">Checked: '+esc(resolved.v==="form"?"form value saved":"Deal value kept")+' -- '+esc(byWho(resolved.by,resolved.at))+'</div>':
          (r.noFormSave
            ? '<div class="acts"><button class="btn" data-act="recon" data-pick="deal" data-field="'+esc(r.key)+'" data-deal="'+esc(dealId)+'">Mark checked</button></div><div class="cb" style="font-size:9.5px;color:var(--muted)">To change it, change the casket product on the Deal in CRM.</div>'
            : '<div class="acts"><button class="btn" data-act="recon" data-pick="form" data-field="'+esc(r.key)+'" data-deal="'+esc(dealId)+'">Use form value</button>'+
              '<button class="btn" data-act="recon" data-pick="deal" data-field="'+esc(r.key)+'" data-deal="'+esc(dealId)+'">Keep Deal value</button></div>')):'')+'</td></tr>';
    });
    b2+='</table>'+(open?'':'<div class="ph-note" style="font-style:normal;color:var(--green)">No open differences.</div>');
  }
  h+=secHtml(2,"Viewing form differences",!!f.id && !open,b2);
  // 3. cosmetizing
  var chs=c.changes||[], left=chs.filter(function(x){ return !x.done; }).length;
  h+=secHtml(3,"Cosmetizing",!left,
    '<div class="frow"><span class="flbl">Lighting required</span><span class="fval">'+(c.lighting?'<span class="badge b-warn">Yes</span>':'No')+'</span></div>'+
    '<div style="margin-top:6px">'+changesHtml(chs, dealId, false)+'</div>'+
    (left?'<div class="ph-note" style="color:var(--red)">'+left+' change'+(left>1?"s are":" is")+' not ticked done by the viewing person yet.</div>':''));
  // 4. load list
  var load=c.load||[], loadLeft=load.filter(function(it){ return !chk(c,"load:"+it.key); }).length;
  h+=secHtml(4,"Load list -- florals, easel, lighting, other items for the hearse",load.length>0 && !loadLeft,
    load.length ? load.map(function(it){ return tickHtml(c,"load:"+it.key, joinNonEmpty([it.name, it.qty&&it.qty!=="1"?("x "+it.qty):"", it.category, it.source==="Walk-in invoice"?"walk-in invoice":""]," · ")); }).join("")
      : '<div class="ph-note" style="font-style:normal">No Flowers, Cremation Merchandise, Programs or Funeral Equipment items on this Deal or its walk-in invoice.</div>');
  // 5. programmes
  // Easel and Lighting are $0 products parked under the Programs parent (so they reach the load
  // lists) -- they are not programmes, so they are left out of the programme count here
  var progs=load.filter(function(it){ var n=norm(it.name); return it.category==="Programs" && n.indexOf("easel")<0 && n.indexOf("lighting")<0; });
  h+=secHtml(5,"Programmes",!!chk(c,"programmes"),
    (progs.length?progs.map(function(it){ return '<div class="frow"><span class="flbl">'+esc(it.name)+'</span><span class="fval"><b>'+esc(it.qty||"1")+'</b> to go with the hearse</span></div>'; }).join(""):'<div class="ph-note" style="font-style:normal">No programme items on the load list.</div>')+
    '<div class="frow"><span class="flbl">Printed (Deal Programmes)</span><span class="fval">'+esc(d.Programmes||"—")+'</span></div>'+
    tickHtml(c,"programmes","The correct quantity is ready"));
  $("detailBody").innerHTML=h;
}
function saveCheck(dealId, key, on, input){
  if(input) input.disabled=true;
  return call("saveCheck",{ dealId:dealId, checkKey:key, value: on===false ? "" : (on===true?"yes":on) }).then(function(r){
    if(input) input.disabled=false;
    if(!ok(r)){ if(input) input.checked=!input.checked; toast((r&&r.message)||"Could not save","err"); return false; }
    var c=state.cases[dealId]; if(c) c.checks=obj(r.checks);
    var row=null; (state.pr.rows||[]).forEach(function(x){ if(x.dealId===dealId) row=x; });
    if(row){ var n=0, ck=obj(r.checks); Object.keys(ck).forEach(function(k){ if(str(obj(ck[k]).v)) n++; }); row.ticks=n; renderPrep(); }
    if(c && state.view==="prep" && state.pr.sel===dealId) paintPrepCase(c);
    return true;
  }).catch(function(e){ if(input){ input.disabled=false; input.checked=!input.checked; } toast("Could not save: "+errMsg(e),"err"); return false; });
}
function saveDealField(dealId, field, value){
  return call("saveDealField",{ dealId:dealId, fieldName:field, value:value }).then(function(r){
    if(!ok(r)){ toast((r&&r.message)||"Save failed","err"); return false; }
    var c=state.cases[dealId]; if(c) obj(c.deal)[field]=value;
    return true;
  });
}

// ===== 9. EVENTS =====
function wire(){
  document.addEventListener("click", function(ev){
    var nav=ev.target.closest(".nav-item"); if(nav){ setView(nav.getAttribute("data-view")); return; }
    var a=ev.target.closest("[data-act]"); if(!a) return;
    var act=a.getAttribute("data-act"), deal=a.getAttribute("data-deal");
    if(act==="refresh"){
      state.cases={};
      if(state.view==="viewList"){ state.vl.rows=null; loadViewList(); if(state.vl.sel) renderViewCase(state.vl.sel); }
      else if(state.view==="changes"){ state.ch.rows=null; loadChanges(); }
      else { state.pr.rows=null; loadPrep(); if(state.pr.sel) renderPrepCase(state.pr.sel,true); }
    }
    else if(act==="detail-back") $("app").classList.remove("show-detail");
    else if(act==="vl-show"){ state.vl.f.show=a.getAttribute("data-k"); openViewList(); }
    else if(act==="vl-open") renderViewCase(deal);
    else if(act==="set-status") setStatus(deal, a.getAttribute("data-status"), a);
    else if(act==="toggle-change" && a.tagName==="INPUT") toggleChange(a.getAttribute("data-item"), deal, a.checked, a);
    else if(act==="open-form") openForm(deal);
    else if(act==="ff-tc"){ $("ff_newtime_wrap").style.display = a.value==="Yes" ? "block" : "none"; }
    else if(act==="ff-add"){ readFormChanges(); state.modal.changes.push(""); renderFormChanges(); var ins=document.querySelectorAll("#ff_changes input"); if(ins.length) ins[ins.length-1].focus(); }
    else if(act==="ff-chip"){ readFormChanges(); var m=state.modal, t=a.getAttribute("data-text");
      if(!m.changes.some(function(x){ return norm(x)===norm(t); })){ var blank=m.changes.indexOf(""); if(blank>=0) m.changes[blank]=t; else m.changes.push(t); renderFormChanges(); }
      $("ff_none").checked=false; }
    else if(act==="ff-del"){ readFormChanges(); state.modal.changes.splice(parseInt(a.getAttribute("data-i"),10),1); if(!state.modal.changes.length) state.modal.changes.push(""); renderFormChanges(); }
    else if(act==="ch-show"){ state.ch.f.show=a.getAttribute("data-k"); openChanges(); }
    else if(act==="pr-day"){ state.pr.date=addDaysKey(todayKey(), parseInt(a.getAttribute("data-k"),10)); state.pr.rows=null; state.pr.sel=""; openPrep(); }
    else if(act==="pr-open") renderPrepCase(deal);
    else if(act==="check" && a.tagName==="INPUT") saveCheck(deal, a.getAttribute("data-key"), a.checked, a);
    else if(act==="save-ft"){
      var v=localToIso($("ftEdit").value); if(!v){ toast("Pick the correct date and time first","err"); return; }
      var c=state.cases[deal]; if(c && sameMinute(v, obj(c.deal).Funeral_Time)){ toast("That is already the funeral time"); return; }
      if(!window.confirm("Change the funeral time on the Deal to "+fmtDT(v)+"? CRM and Trip Manager are updated as usual.")) return;
      a.disabled=true;
      saveDealField(deal,"Funeral_Time",v).then(function(done){ a.disabled=false; if(done){ toast("Funeral time corrected in CRM","ok");
        (state.pr.rows||[]).forEach(function(x){ if(x.dealId===deal) x.funeral=v; }); renderPrep(); paintPrepCase(state.cases[deal]); } })
        .catch(function(e){ a.disabled=false; toast("Save failed: "+errMsg(e),"err"); });
    }
    else if(act==="recon"){
      var field=a.getAttribute("data-field"), pick=a.getAttribute("data-pick"), cc=state.cases[deal];
      var row=null; reconRows(cc).forEach(function(r){ if(r.key===field) row=r; });
      if(!row) return;
      a.disabled=true;
      var after=function(){ return saveCheck(deal,"recon:"+field,pick); };
      if(pick==="form"){
        saveDealField(deal, field, field==="Date_of_Death"?dPart(row.form):row.form).then(function(done){ if(done){ toast(row.label+" saved to the Deal","ok"); return after(); } a.disabled=false; })
          .catch(function(e){ a.disabled=false; toast("Save failed: "+errMsg(e),"err"); });
      } else after();
    }
  });
  document.addEventListener("input", function(ev){
    var id=ev.target.id;
    if(id==="vlSearch"){ state.vl.f.q=ev.target.value; renderViewList(); }
    else if(id==="chSearch"){ state.ch.f.q=ev.target.value; renderChanges(); }
    else if(id==="prSearch"){ state.pr.f.q=ev.target.value; renderPrep(); }
  });
  document.addEventListener("change", function(ev){
    if(ev.target.id==="prDate" && ev.target.value){ state.pr.date=ev.target.value; state.pr.rows=null; state.pr.sel=""; openPrep(); }
  });
  $("modalCancel").addEventListener("click", closeModal);
  $("modalSave").addEventListener("click", submitForm);
  $("hamburgerBtn").addEventListener("click", function(){ $("app").classList.toggle("sidebar-open"); });
  $("sidebarOverlay").addEventListener("click", function(){ $("app").classList.remove("sidebar-open"); });
}

// ===== 10. INIT =====
function initials(email){ var n=str(email).split("@")[0].replace(/[^a-zA-Z]/g," ").trim().split(/\s+/); return ((n[0]||"").charAt(0)+(n[1]||"").charAt(0)).toUpperCase() || "··"; }
function start(){
  renderSidebar(); wire();
  var j=jamNow(); $("todayLbl").textContent=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][j.getUTCDay()]+", "+fmtDate(todayKey());
  ZOHO.CREATOR.init().then(function(){
    state.sdkReady=true;
    try{
      var ip=ZOHO.CREATOR.UTIL.getInitParams();
      var setU=function(p){ state.loginEmail=(p&&p.loginUser)||""; $("avatar").textContent=initials(state.loginEmail); };
      if(ip && typeof ip.then==="function") ip.then(setU,function(){}); else setU(ip);
    }catch(e){}
    setView(state.view);
    if(PART==="viewing"){ loadChanges(); }
  }).catch(function(e){ $("contentArea").innerHTML='<div class="list-empty">Could not start: '+esc(errMsg(e))+'</div>'; });
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
