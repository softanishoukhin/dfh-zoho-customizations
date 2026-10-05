// ============================================================================
// DFH Operations App -- app.js  (ZP-TBD-98)
// Portal widget: deceased card view (Creator Deceased_Record_Form, as it is today)
// + Reports section (live CRM data through the app's Custom APIs, inline edit
// back to CRM, formatted Excel export).
// Plain JS (no jQuery). One IIFE; all clicks are wired with event delegation, so
// nothing needs to be exposed on window.
// ============================================================================
(function(){
"use strict";

// ===== 1. CONSTANTS & STATE =====
var WS = "delapenhafuneralhome";
var API = {
  cards:       { name:"Ops_Get_Deceased_Cards",        method:"POST" },
  picklists:   { name:"Ops_Get_Picklists",             method:"GET"  },
  r1:          { name:"Ops_Report_Initial_Pickups",    method:"POST" },
  r2:          { name:"Ops_Report_Autopsy_Results",    method:"POST" },
  r3:          { name:"Ops_Report_Embalming",          method:"GET"  },
  r4:          { name:"Ops_Report_Upcoming_Autopsies", method:"GET"  },
  r4b:         { name:"Ops_Report_Awaiting_Autopsy",   method:"GET"  },
  r6:          { name:"Ops_Report_Family_Viewing",     method:"GET"  },
  r7:          { name:"Ops_Report_Driver_Notes",       method:"POST" },
  save:        { name:"Ops_Save_Fields",               method:"POST" },
  saveAutopsy: { name:"Ops_Save_Autopsy_Schedule",     method:"POST" }
};
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// CRM picklist values (from the live field metadata, 2026-10-05)
var PL = {
  sex: ["Male","Female"],
  dealSize: ["Unknown","Small: 22x76","Medium: 24x79","Large: 29x83","26 x 78 to infinity","24 x 77 to still fit in mold at HVMG","21x 73 Semi & S requires 3 inches head clearance","28 x 80"],
  pickupSize: ["Unknown","24 x 77 to still fit in mold at HVMG","21x 73 Semi & S requires 3 inches head clearance","26 x 78 to infinity","28 x 80"],
  opsSize: ["Unknown","26 x 78 to infinity","24 x 77 to still fit in mold at HVMG","21x 73 Semi & S requires 3 inches head clearance","28 x 80"],
  placeOfRemoval: ["Residence","Hospital","Funeral Home","Nursing Home","Other"],
  opsLocation: ["Montego Bay","Kingston","Union St","20A","OPS Center"],
  fridge: ["1","2","3"],
  row: ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20"],
  drawer: ["A","B","C","D","E"],
  room: ["Morgue","Embalming","Holding Area"],
  condition: ["Good","Decomposed","Fair","Needs attention"],
  outcome: ["Return to DFH","Transfer out","Reschedule"],
  reschedule: ["X-ray required","Autopsy not done","Problem caused by DFH","Family did not show","Officer did not show"],
  embStatus: ["Requested","Scheduled","Completed"]
};

var state = {
  sdkReady:false, view:"cards", loginEmail:"",
  cards:[], cardsTotal:0, cardsPage:0, cardsDone:false, cardsLoading:false, selCardId:"",
  cf:{ status:"", type:"", loc:"", q:"" },
  picklists:null,
  rep:{},          // per report: { rows, meta, loading, error, filters }
  edit:null        // open modal context
};

// ===== 2. UTILITIES =====
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function pad2(n){ return (n<10?"0":"")+n; }
function str(v){ return v==null ? "" : String(v); }
function lkName(o){ return (o && typeof o==="object") ? str(o.name) : ""; }
function lkId(o){ if(o && typeof o==="object") return str(o.id); return str(o); }
function obj(o){ return (o && typeof o==="object") ? o : {}; }
function errMsg(e){ if(e && e.message) return e.message; try{ return JSON.stringify(e); }catch(_){ return String(e); } }

// Jamaica is -05:00 all year, no DST. CRM values are read as literal wall-clock
// text (same approach as Trip Manager / Driver App), never through a Date object.
function jamNow(){ return new Date(Date.now() - 5*3600*1000); }
function todayKey(){ var j=jamNow(); return j.getUTCFullYear()+"-"+pad2(j.getUTCMonth()+1)+"-"+pad2(j.getUTCDate()); }
function monthRange(){
  var j=jamNow(), y=j.getUTCFullYear(), m=j.getUTCMonth();
  var last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  return { from:y+"-"+pad2(m+1)+"-01", to:y+"-"+pad2(m+1)+"-"+pad2(last) };
}
function dPart(iso){ iso=str(iso); return iso.length>=10 ? iso.substring(0,10) : ""; }
function tPart(iso){ iso=str(iso); var i=iso.indexOf("T"); return i<0 ? "" : iso.substring(i+1,i+6); }
function fmtDate(iso){
  var d=dPart(iso); if(!d) return "";
  var p=d.split("-"); return MONTHS[parseInt(p[1],10)-1]+" "+parseInt(p[2],10)+", "+p[0];
}
function fmtTime(iso){
  var t=tPart(iso); if(!t) return "";
  var hh=parseInt(t.substring(0,2),10), mm=t.substring(3,5); if(isNaN(hh)) return "";
  var ap=hh>=12?"PM":"AM", h=hh%12; if(h===0) h=12; return h+":"+mm+" "+ap;
}
function fmtDT(iso){ var d=fmtDate(iso), t=fmtTime(iso); return d && t ? d+" "+t : (d||""); }
function sortKey(iso){ return str(iso).replace(/[^0-9]/g,"").substring(0,14); }
// datetime-local "2026-10-05T14:30" -> "2026-10-05T14:30:00-05:00"
function localToIso(v){ v=str(v).trim(); if(!v) return ""; if(v.length===16) v+=":00"; return v.substring(0,19)+"-05:00"; }
function isoToLocal(iso){ iso=str(iso); return iso.length>=16 ? iso.substring(0,16) : ""; }
function ageAt(dob, ref){
  dob=dPart(dob); if(!dob) return "";
  ref=dPart(ref)||todayKey();
  var a=dob.split("-").map(Number), b=ref.split("-").map(Number);
  var age=b[0]-a[0]; if(b[1]<a[1] || (b[1]===a[1] && b[2]<a[2])) age--;
  return age>=0 && age<130 ? String(age) : "";
}
function joinNonEmpty(arr, sep){ return arr.filter(function(x){ return str(x).trim()!==""; }).join(sep||", "); }
function locGroup(v){
  v=str(v).toLowerCase(); if(!v) return "";
  if(v.indexOf("kingston")>=0 || v==="20a" || v.indexOf("20a ")===0) return "Kingston";
  if(v.indexOf("montego")>=0 || v.indexOf("union")>=0 || v.indexOf("ops center")>=0 || v.indexOf("mobay")>=0) return "Montego Bay";
  return "";
}

var toastT=null;
function toast(msg, kind){
  var t=$("toast"); t.textContent=msg; t.className="toast show"+(kind?" "+kind:"");
  clearTimeout(toastT); toastT=setTimeout(function(){ t.className="toast"; }, kind==="err"?6000:3000);
}

// ===== 3. API =====
function unwrap(resp){
  if(resp==null) return null;
  var out=resp;
  if(typeof out==="object"){
    if(out.result!==undefined) out=out.result;
    else if(out.output!==undefined) out=out.output;
  }
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
      ZOHO.CREATOR.API.invokeCustomApi(cfg).then(function(r){ resolve(unwrap(r)); }).catch(function(e){ console.error("[OPS]",m.name,e); reject(e); });
    }catch(e){ reject(e); }
  });
}
function getLoginEmail(){
  return new Promise(function(resolve){
    try{
      var ip=ZOHO.CREATOR.UTIL.getInitParams();
      if(ip && typeof ip.then==="function"){ ip.then(function(r){ resolve((r&&r.loginUser)||""); }, function(){ resolve(""); }); }
      else resolve((ip&&ip.loginUser)||"");
    }catch(e){ resolve(""); }
  });
}
function loadPicklists(){
  if(state.picklists) return Promise.resolve(state.picklists);
  return call("picklists").then(function(r){
    state.picklists = { drivers:(r&&r.drivers)||[], attendants:(r&&r.attendants)||[], autopsyLocations:(r&&r.autopsyLocations)||[] };
    var byName=function(a,b){ return str(a.name).localeCompare(str(b.name)); };
    state.picklists.drivers.sort(byName); state.picklists.attendants.sort(byName); state.picklists.autopsyLocations.sort(byName);
    return state.picklists;
  }).catch(function(){ state.picklists={drivers:[],attendants:[],autopsyLocations:[]}; return state.picklists; });
}

// ===== 4. NAVIGATION =====
function setView(v){
  state.view=v;
  var items=document.querySelectorAll(".nav-item");
  for(var i=0;i<items.length;i++){ items[i].classList.toggle("active", items[i].getAttribute("data-view")===v); }
  $("app").classList.remove("sidebar-open"); $("app").classList.remove("show-detail");
  if(v==="cards") renderCardsView(); else openReport(v);
}

// ===== 5. CARD VIEW (Deceased_Record_Form) =====
function loadCards(reset){
  if(reset){ state.cards=[]; state.cardsPage=0; state.cardsDone=false; }
  if(state.cardsLoading || state.cardsDone) return;
  state.cardsLoading=true;
  var next=state.cardsPage+1;
  call("cards",{ pageNo:String(next), pageSize:"200" }).then(function(r){
    state.cardsLoading=false;
    var list=(r && r.cards) || [];
    state.cards=state.cards.concat(list);
    state.cardsPage=next;
    state.cardsTotal=(r && r.total) || state.cards.length;
    if(list.length<200) state.cardsDone=true;
    $("badgeCards").textContent=state.cardsTotal;
    if(state.view==="cards"){
      if(state.cardsDone) renderCardsHeader();   // filter dropdowns now cover every record
      renderCardList();
    }
    // keep paging in the background so search/filters cover every record
    if(!state.cardsDone) loadCards(false);
  }).catch(function(e){
    state.cardsLoading=false;
    if(state.view==="cards") $("cardList").innerHTML='<div class="list-empty">Could not load deceased records: '+esc(errMsg(e))+'</div>';
  });
}
function cardStatusColor(s){
  s=str(s);
  if(!s || s==="Unassigned") return "var(--taupe)";
  if(s.indexOf("Pending")===0) return "var(--amber)";
  if(s==="Cremated" || s==="Ready for Delivery") return "var(--slate)";
  if(s.indexOf("Ready")===0) return "var(--green)";
  return "var(--plum-l)";
}
function cardFridge(c){
  var fr=c.mb_fridge||c.kg_fridge;
  return joinNonEmpty([c.location, c.room, fr?("Fridge "+fr):"", c.row?("Row "+c.row):"", c.drawer?("Drawer "+c.drawer):""], " · ");
}
function renderCardsView(){
  renderCardsHeader();
  $("contentArea").innerHTML =
    '<div class="list-pane" id="cardList"></div>'+
    '<div class="detail-wrap"><div class="detail-hdr" id="cardDetailHdr"><button class="back-btn" data-act="detail-back">&#8592; Back</button>'+
      '<div class="d-name">Select a deceased record</div></div><div class="detail-body" id="cardDetail"><div class="detail-empty">Click a card to see its details.</div></div></div>';
  renderCardList();
  if(state.selCardId) renderCardDetail(state.selCardId);
}
function renderCardsHeader(){
  var statuses={}, types={};
  state.cards.forEach(function(c){ if(c.status) statuses[c.status]=1; if(c.deal_type) types[c.deal_type]=1; });
  var opt=function(map, cur, label){
    var h='<option value="">'+label+'</option>';
    Object.keys(map).sort().forEach(function(k){ h+='<option'+(k===cur?" selected":"")+'>'+esc(k)+'</option>'; });
    return h;
  };
  $("viewHeader").innerHTML =
    '<div class="vh-row"><div class="view-title">All Deceased</div><div class="view-sub" id="cardCount"></div>'+
    '<div class="vh-actions"><button class="btn" data-act="cards-refresh"><i class="ti ti-refresh"></i>Refresh</button></div></div>'+
    '<div class="filters">'+
      '<select class="filter-select" data-cf="status">'+opt(statuses,state.cf.status,"All statuses")+'</select>'+
      '<select class="filter-select" data-cf="type">'+opt(types,state.cf.type,"All deal types")+'</select>'+
      '<select class="filter-select" data-cf="loc"><option value="">All locations</option>'+
        ["Montego Bay","Kingston"].map(function(l){ return '<option'+(l===state.cf.loc?" selected":"")+'>'+l+'</option>'; }).join("")+'</select>'+
      '<div class="search-box"><i class="ti ti-search"></i><input id="cardSearch" placeholder="Search name…" value="'+esc(state.cf.q)+'"></div>'+
    '</div>';
}
function filteredCards(){
  var q=state.cf.q.trim().toLowerCase();
  return state.cards.filter(function(c){
    if(state.cf.status && c.status!==state.cf.status) return false;
    if(state.cf.type && c.deal_type!==state.cf.type) return false;
    if(state.cf.loc && locGroup(c.location)!==state.cf.loc) return false;
    if(q && str(c.name).toLowerCase().indexOf(q)<0) return false;
    return true;
  });
}
function renderCardList(){
  var el=$("cardList"); if(!el) return;
  if(!state.cards.length){
    el.innerHTML = state.cardsDone ? '<div class="list-empty">No deceased records yet.</div>' : '<div class="loading"><i class="ti ti-loader-2"></i>Loading deceased records…</div>';
    return;
  }
  var list=filteredCards();
  var cc=$("cardCount"); if(cc) cc.textContent=list.length+" of "+state.cardsTotal+(state.cardsDone?"":" (loading…)");
  if(!list.length){ el.innerHTML='<div class="list-empty">No records match these filters.</div>'; return; }
  // group by date received (pickup date, else date added) -- newest first
  var groups={}, order=[];
  list.forEach(function(c){
    var k=c.pickup_date || dPart(c.added) || "";
    if(!groups[k]){ groups[k]=[]; order.push(k); }
    groups[k].push(c);
  });
  order.sort(function(a,b){ return a<b?1:(a>b?-1:0); });
  var tk=todayKey(), h="";
  order.forEach(function(k){
    var lbl = !k ? "No date" : (k===tk ? "Today — "+fmtDate(k) : fmtDate(k));
    h+='<div class="day-group"><div class="day-label">'+esc(lbl)+' · '+groups[k].length+'</div><div class="card-grid">';
    groups[k].forEach(function(c){
      var fr=cardFridge(c);
      h+='<div class="tc'+(c.id===state.selCardId?" sel":"")+'" data-card="'+esc(c.id)+'">'+
        '<div class="card-top"><span class="sdot" style="background:'+cardStatusColor(c.status)+'"></span><div class="card-name">'+esc(c.name||"(no name)")+'</div></div>'+
        (fr?'<div class="card-line"><i class="ti ti-fridge"></i>'+esc(fr)+'</div>':'')+
        (c.funeral?'<div class="card-line"><i class="ti ti-calendar-event"></i>Funeral '+esc(fmtDT(c.funeral))+'</div>':'')+
        (c.dod?'<div class="card-line"><i class="ti ti-calendar"></i>Died '+esc(fmtDate(c.dod))+(c.sex?' · '+esc(c.sex):'')+'</div>':'')+
        '<div class="card-bot">'+
          (c.deal_type?'<span class="badge b-type">'+esc(c.deal_type)+'</span>':'')+
          '<span class="badge b-status">'+esc(c.status||"Unassigned")+'</span>'+
          (c.autopsy_required==="Yes"?'<span class="badge b-warn">Autopsy'+(c.autopsy_done_at?" done":"")+'</span>':'')+
          (c.condition==="Decomposed"?'<span class="badge b-red">Decomposed</span>':'')+
        '</div></div>';
    });
    h+='</div></div>';
  });
  el.innerHTML=h;
}
function frow(label, val){
  var v=str(val);
  return '<div class="frow"><span class="flbl">'+esc(label)+'</span><span class="fval'+(v?"":" empty")+'">'+(v?esc(v):"—")+'</span></div>';
}
function renderCardDetail(id){
  var c=null; state.cards.forEach(function(x){ if(x.id===id) c=x; });
  if(!c) return;
  state.selCardId=id;
  $("cardDetailHdr").innerHTML='<button class="back-btn" data-act="detail-back">&#8592; Back</button>'+
    '<div class="d-name">'+esc(c.name||"(no name)")+'</div><div class="d-meta">'+esc(joinNonEmpty([c.deal_type, c.status||"Unassigned"]," · "))+'</div>';
  var h='';
  h+='<div class="container white"><div class="con-title"><i class="ti ti-user"></i>Deceased</div>'+
    frow("Sex",c.sex)+frow("Size",c.size)+frow("Condition",c.condition)+frow("Date of death",fmtDate(c.dod))+
    frow("Pickup completed",fmtDate(c.pickup_date))+frow("Funeral",fmtDT(c.funeral))+frow("Pickup address",c.address)+frow("Funeral director",c.employee)+'</div>';
  h+='<div class="container"><div class="con-title"><i class="ti ti-fridge"></i>Location</div>'+
    frow("Location",c.location)+frow("Room",c.room)+frow("Refrigerator",c.mb_fridge||c.kg_fridge)+frow("Row",c.row)+frow("Drawer",c.drawer)+'</div>';
  h+='<div class="container white"><div class="con-title"><i class="ti ti-stethoscope"></i>Autopsy</div>'+
    frow("Required",c.autopsy_required)+frow("Scheduled",fmtDT(c.autopsy_at))+frow("Completed",fmtDT(c.autopsy_done_at))+'</div>';
  h+='<div class="container white"><div class="con-title"><i class="ti ti-eye"></i>ID Visit</div>'+
    frow("Required",c.id_required)+frow("Date & time",fmtDT(c.id_visit_at))+frow("Status",c.id_visit_status)+frow("Family member",c.family_member)+'</div>';
  h+='<div class="container white"><div class="con-title"><i class="ti ti-droplet"></i>Embalming</div>'+
    frow("Work order",c.work_order_type)+frow("Status",c.embalming_status)+frow("Scheduled",fmtDT(c.embalming_at))+frow("Assigned to",c.assigned_to)+frow("Case location",c.case_location)+'</div>';
  h+='<div class="container white"><div class="con-title"><i class="ti ti-box"></i>Casket</div>'+
    frow("Product",c.product)+frow("Size",c.casket_size)+frow("Status",c.casket_status)+frow("Colours",joinNonEmpty([c.primary_color,c.secondary_color]," / "))+frow("Casket ID",c.casket_id)+'</div>';
  $("cardDetail").innerHTML=h;
  var cards=document.querySelectorAll("#cardList .tc");
  for(var i=0;i<cards.length;i++) cards[i].classList.toggle("sel", cards[i].getAttribute("data-card")===id);
  $("app").classList.add("show-detail");
}

// ===== 6. REPORT ENGINE =====
// Each report: { title, sub, range(bool), load(meta)->Promise(rows), columns[], filters(),
//   rowFilter(row), sort(rows), group(row)->{key,label,sub}, totals(rows), note(meta) }
// Column: { label, w (excel width), text(row) (plain, used for export), html(row)?,
//   edit?(row) -> { title, fields:[...] } | null }
// Edit field: { label, type:text|textarea|date|datetime|select|bool|lookup, value,
//   options[], lookupOptions[{id,name}], hint, targets:[{m,id,f}], key (row prop to update),
//   nameKey (row prop for lookup display) }
function rs(id){ if(!state.rep[id]) state.rep[id]={ rows:null, meta:{}, loading:false, error:"", f:{} }; return state.rep[id]; }

function openReport(id){
  var def=REPORTS[id], s=rs(id);
  if(def.range && !s.f.from){ var mr=monthRange(); s.f.from=mr.from; s.f.to=mr.to; }
  renderReportHeader(id);
  $("contentArea").innerHTML='<div class="report-pane"><div id="repTop"></div><div class="table-wrap" id="repTable"></div></div>';
  if(s.rows===null) loadReport(id); else renderReportBody(id);
}
function loadReport(id){
  var def=REPORTS[id], s=rs(id);
  s.loading=true; s.error="";
  if(state.view===id) $("repTable").innerHTML='<div class="loading"><i class="ti ti-loader-2"></i>Loading from CRM…</div>';
  Promise.all([def.load(s), loadPicklists()]).then(function(res){
    s.rows=res[0]||[]; s.loading=false;
    if(state.view===id){ renderReportHeader(id); renderReportBody(id); }
  }).catch(function(e){
    s.loading=false; s.error=errMsg(e); s.rows=null;
    if(state.view===id) $("repTable").innerHTML='<div class="list-empty">Could not load this report: '+esc(s.error)+'</div>';
  });
}
function renderReportHeader(id){
  var def=REPORTS[id], s=rs(id);
  var h='<div class="vh-row"><div class="view-title">'+esc(def.title)+'</div><div class="view-sub">'+esc(def.sub||"")+'</div>'+
    '<div class="vh-actions"><button class="btn" data-act="rep-refresh"><i class="ti ti-refresh"></i>Refresh</button>'+
    (def.noExport?'':'<button class="btn primary" data-act="rep-export"><i class="ti ti-file-spreadsheet"></i>Export Excel</button>')+'</div></div><div class="filters">';
  if(def.range){
    h+='<span class="flabel">From</span><input type="date" class="filter-date" data-rf="from" value="'+esc(s.f.from)+'">'+
       '<span class="flabel">To</span><input type="date" class="filter-date" data-rf="to" value="'+esc(s.f.to)+'">'+
       '<button class="filter-pill" data-act="rep-month">This month</button>';
  }
  if(def.filters) h+=def.filters(s);
  h+='<div class="search-box"><i class="ti ti-search"></i><input data-rf="q" placeholder="Search name…" value="'+esc(s.f.q||"")+'"></div></div>';
  $("viewHeader").innerHTML=h;
}
function visibleRows(id){
  var def=REPORTS[id], s=rs(id);
  var q=str(s.f.q).trim().toLowerCase();
  var rows=(s.rows||[]).filter(function(r){
    if(q && str(r.name).toLowerCase().indexOf(q)<0) return false;
    if(def.rowFilter && !def.rowFilter(r, s)) return false;
    return true;
  });
  if(def.sort) rows=def.sort(rows.slice());
  return rows;
}
function renderReportBody(id){
  var def=REPORTS[id], s=rs(id);
  var rows=visibleRows(id);
  var top='';
  if(def.note){ var n=def.note(s); if(n) top+='<div class="report-note"><i class="ti ti-info-circle"></i>'+esc(n)+'</div>'; }
  if(def.totals){
    top+='<div class="totals">'+def.totals(rows).map(function(t){ return '<div class="total-chip"><b>'+t.count+'</b>'+esc(t.label)+'</div>'; }).join("")+'</div>';
  }
  $("repTop").innerHTML=top;
  if(!rows.length){ $("repTable").innerHTML='<div class="list-empty">Nothing to show for these filters.</div>'; return; }
  var h='<table class="rpt" style="min-width:'+Math.max(900, def.columns.length*112)+'px"><thead><tr>';
  def.columns.forEach(function(c){ h+='<th>'+esc(c.label)+'</th>'; });
  h+='</tr></thead><tbody>';
  var lastGroup=null;
  rows.forEach(function(r, ri){
    if(def.group){
      var g=def.group(r);
      if(g.key!==lastGroup){
        lastGroup=g.key;
        h+='<tr class="grp"><td colspan="'+def.columns.length+'">'+esc(g.label)+(g.sub?'<span class="sub">'+esc(g.sub)+'</span>':'')+'</td></tr>';
      }
    }
    h+='<tr>';
    def.columns.forEach(function(c, ci){
      var ed=c.edit ? c.edit(r) : null;
      var inner=c.html ? c.html(r) : esc(c.text(r));
      if(inner==="" ) inner='<span class="cell-empty">—</span>';
      h+='<td class="'+(ed?"ed":"ro")+'"'+(ed?' data-edit="'+ri+':'+ci+'"':'')+'>'+inner+'</td>';
    });
    h+='</tr>';
  });
  h+='</tbody></table>';
  $("repTable").innerHTML=h;
  s.visible=rows;
}

// ---- edit modal ----
function openEdit(id, ri, ci){
  var def=REPORTS[id], s=rs(id), row=s.visible[ri], col=def.columns[ci];
  var spec=col.edit(row); if(!spec) return;
  state.edit={ id:id, row:row, spec:spec };
  $("modalTitle").textContent=spec.title||col.label;
  $("modalSub").textContent=row.name||"";
  $("modalErr").style.display="none";
  var h='';
  spec.fields.forEach(function(f, fi){
    var dis = (!f.targets || !f.targets.length) && !spec.special;
    var v=f.value==null?"":String(f.value);
    h+='<div class="mf"><label>'+esc(f.label)+'</label>';
    if(f.type==="textarea") h+='<textarea data-fi="'+fi+'"'+(dis?" disabled":"")+'>'+esc(v)+'</textarea>';
    else if(f.type==="date") h+='<input type="date" data-fi="'+fi+'" value="'+esc(dPart(v))+'"'+(dis?" disabled":"")+'>';
    else if(f.type==="datetime") h+='<input type="datetime-local" data-fi="'+fi+'" value="'+esc(isoToLocal(v))+'"'+(dis?" disabled":"")+'>';
    else if(f.type==="bool") h+='<div class="chk"><input type="checkbox" data-fi="'+fi+'"'+(v==="true"?" checked":"")+(dis?" disabled":"")+'> Yes</div>';
    else if(f.type==="select"){
      var opts=f.options.slice(); if(v && opts.indexOf(v)<0) opts.unshift(v);
      h+='<select data-fi="'+fi+'"'+(dis?" disabled":"")+'><option value="">-None-</option>'+opts.map(function(o){ return '<option'+(o===v?" selected":"")+'>'+esc(o)+'</option>'; }).join("")+'</select>';
    }
    else if(f.type==="lookup"){
      var lo=f.lookupOptions.slice(); var has=lo.some(function(o){ return o.id===v; });
      if(v && !has) lo.unshift({id:v, name:f.currentName||v});
      h+='<select data-fi="'+fi+'"'+(dis?" disabled":"")+'><option value="">-None-</option>'+lo.map(function(o){ return '<option value="'+esc(o.id)+'"'+(o.id===v?" selected":"")+'>'+esc(o.name)+'</option>'; }).join("")+'</select>';
    }
    else h+='<input type="text" data-fi="'+fi+'" value="'+esc(v)+'"'+(dis?" disabled":"")+'>';
    var hint=f.hint||"";
    if(dis) hint="No linked CRM record to save this to.";
    else if(f.targets && f.targets.length>1) hint=(hint?hint+" ":"")+"Saves to: "+f.targets.map(function(t){ return t.m.replace("Deceased_Pickups","Deceased Pickup").replace("Contacts","NOK Contact")+"."+t.f; }).join(" + ");
    if(hint) h+='<div class="hint">'+esc(hint)+'</div>';
    h+='</div>';
  });
  $("modalFields").innerHTML=h;
  $("modalSave").disabled=false;
  $("modalBg").classList.add("open");
}
function closeEdit(){ $("modalBg").classList.remove("open"); state.edit=null; }
function readField(f, fi){
  var el=document.querySelector('#modalFields [data-fi="'+fi+'"]');
  if(!el) return "";
  if(f.type==="bool") return el.checked ? "true" : "false";
  if(f.type==="datetime") return localToIso(el.value);
  return str(el.value).trim();
}
function saveEdit(){
  var ctx=state.edit; if(!ctx) return;
  var spec=ctx.spec, updates=[], newVals=[], changed=false;
  spec.fields.forEach(function(f, fi){
    var v=readField(f, fi); newVals.push(v);
    var old=f.value==null?"":String(f.value);
    if(f.type==="datetime") old=localToIso(isoToLocal(old));
    if(f.type==="bool") old=(old==="true")?"true":"false";
    if(v===old) return;
    changed=true;
    (f.targets||[]).forEach(function(t){ updates.push({ m:t.m, id:t.id, f:t.f, v:v }); });
  });
  // composite fields (e.g. a note's header + text) are rebuilt into one value
  if(spec.build && changed){ updates=spec.build(newVals); }
  if(!updates.length){ closeEdit(); return; }
  $("modalSave").disabled=true;
  call("save",{ updatesJson: JSON.stringify(updates) }).then(function(r){
    if(r && r.status==="success"){
      spec.fields.forEach(function(f, fi){
        if(f.key) ctx.row[f.key]=newVals[fi];
        if(f.nameKey){
          var nm=""; (f.lookupOptions||[]).forEach(function(o){ if(o.id===newVals[fi]) nm=o.name; });
          ctx.row[f.nameKey]=nm;
        }
      });
      if(spec.after) spec.after(ctx.row, newVals);
      closeEdit(); renderReportBody(ctx.id); toast("Saved to CRM","ok");
    } else {
      $("modalSave").disabled=false;
      var e=$("modalErr"); e.textContent=(r && r.message) || "Save failed"; e.style.display="block";
    }
  }).catch(function(e){
    $("modalSave").disabled=false;
    var el=$("modalErr"); el.textContent="Save failed: "+errMsg(e); el.style.display="block";
  });
}
// edit-field helpers
function T(m,id,f){ return id ? [{ m:m, id:id, f:f }] : []; }
function TT(){ var out=[]; for(var i=0;i<arguments.length;i++) out=out.concat(arguments[i]); return out; }
function fld(label, type, key, row, targets, extra){
  var f={ label:label, type:type, key:key, value:row[key], targets:targets };
  if(extra) for(var k in extra) f[k]=extra[k];
  return f;
}
function sel(label, key, row, targets, options, extra){ return fld(label,"select",key,row,targets,Object.assign({options:options},extra||{})); }
function lookup(label, key, nameKey, row, targets, list){
  return fld(label,"lookup",key,row,targets,{ nameKey:nameKey, lookupOptions:list||[], currentName:row[nameKey] });
}
function cellSub(main, sub){ return (main?esc(main):'<span class="cell-empty">—</span>')+(sub?'<span class="cell-sub">'+esc(sub)+'</span>':''); }
function yesNo(v){ return v==="true" ? "Yes" : "No"; }
function ynBadge(v){ return v==="true" ? '<span class="badge b-green">Yes</span>' : '<span class="badge b-red">No</span>'; }
function plDrivers(){ return (state.picklists&&state.picklists.drivers)||[]; }
function plAttendants(){ return (state.picklists&&state.picklists.attendants)||[]; }
function plAutopsyLocs(){ return (state.picklists&&state.picklists.autopsyLocations)||[]; }

// ===== 7. REPORT DEFINITIONS =====
var REPORTS={};

// ---- Report 1: Initial Pickups Log ----
REPORTS.r1={
  title:"Initial Pickups Log", sub:"Police, hospital (incl. Hospital Storage) and first call pickups · by pickup date, newest first", range:true,
  load:function(s){
    return call("r1",{ fromDate:s.f.from, toDate:s.f.to }).then(function(r){
      return ((r&&r.rows)||[]).map(function(x){
        var t=obj(x.trip), p=obj(x.pickup), d=obj(x.deal), n=obj(x.nok), o=obj(x.ops);
        var hasD=!!d.id, hasP=!!p.id, hasO=!!o.id;
        var pickupName=joinNonEmpty([p.First_Name,p.Last_Name]," ");
        return {
          tripId:str(t.id), pickupId:str(p.id), dealId:str(d.id), opsId:str(o.id), nokId:str(n.id),
          tripType:str(t.Trip_Type), dealType:str(d.Type),
          pickupDate:str(t.Scheduled_Date), completedAt:str(d.Initial_Trip_Completed_At),
          name: str(d.Name_of_Deceased)||pickupName, pFirst:str(p.First_Name), pLast:str(p.Last_Name),
          dob:str(d.Date_of_Birth), dod:str(d.Date_of_Death)||str(p.Date_of_Death),
          sex:str(d.Sex),
          street: hasD ? str(d.Street_1) : str(p.Deceased_Street_Address), city: hasD ? str(d.City) : str(p.Deceased_City),
          pStreet:str(p.Deceased_Street_Address), pCity:str(p.Deceased_City),
          place:str(t.Place_of_Removal), placeOther:str(t.Place_of_Removal_Other), hospital:str(t.Hospital_Name), ward:str(t.Ward),
          nokFirst: hasP ? str(p.NOK_First_Name) : str(n.First_Name), nokLast: hasP ? str(p.NOK_Last_Name) : str(n.Last_Name),
          nokPhone: hasP ? str(p.NOK_Phone) : str(n.Phone||n.Mobile), dealNok: lkName(d.Contact_Name),
          doctor: hasD ? str(d.Doctor_Name) : str(p.Doctor_Name), doctorPhone: hasD ? str(d.Doctor_Phone) : str(p.Doctor_Phone),
          police: hasD ? str(d.Police_Office_Name) : str(p.Police_Officer_Name), policePhone: hasD ? str(d.Police_Phone_Number) : str(p.Police_Phone_Number),
          tod: hasD ? str(d.Time_of_Death) : str(p.Time_of_Death),
          driverId:lkId(t.Driver), driver:lkName(t.Driver), attId:lkId(t.Attendant_NEW), att:lkName(t.Attendant_NEW),
          callTakenBy:str(d.Call_Taken_By), km:str(t.Number_of_distance_in_km),
          size: hasD ? str(d.Deceased_Size) : str(p.Deceased_Size),
          fridge:str(o.Refrigerator||p.Refrigerator), row:str(o.Row||p.Row), drawer:str(o.Drawer||p.Drawer), room:str(o.Room||p.Room), loc:str(o.Location||p.Location),
          condition:str(o.Condition||p.Condition), needsAttn:str(o.Needs_Attention_Description),
          hasD:hasD, hasP:hasP, hasO:hasO
        };
      });
    });
  },
  filters:function(s){
    var types=["Police","Hospital","First Call"];
    var h='<select class="filter-select" data-rf="ptype"><option value="">All pickup types</option>'+types.map(function(t){ return '<option'+(s.f.ptype===t?" selected":"")+'>'+t+'</option>'; }).join("")+'</select>';
    h+='<select class="filter-select" data-rf="loc"><option value="">All locations</option>'+["Montego Bay","Kingston"].map(function(t){ return '<option'+(s.f.loc===t?" selected":"")+'>'+t+'</option>'; }).join("")+'</select>';
    return h;
  },
  rowFilter:function(r, s){
    if(s.f.ptype){
      var g = r.tripType==="First Call" ? "First Call" : (r.tripType.indexOf("Police")>=0 ? "Police" : "Hospital");
      if(g!==s.f.ptype) return false;
    }
    if(s.f.loc && locGroup(r.loc)!==s.f.loc) return false;
    return true;
  },
  sort:function(rows){ return rows.sort(function(a,b){ var x=sortKey(a.pickupDate), y=sortKey(b.pickupDate); return x<y?1:(x>y?-1:0); }); },
  columns:[
    { label:"Pickup date", w:14, text:function(r){ return fmtDT(r.pickupDate); },
      edit:function(r){ return { title:"Pickup date", fields:[ fld("Pickup date & time (Trip)","datetime","pickupDate",r,T("Trips",r.tripId,"Scheduled_Date")) ] }; } },
    { label:"Name & age", w:24, text:function(r){ var a=ageAt(r.dob,r.dod); return r.name+(a?" ("+a+")":""); },
      html:function(r){ var a=ageAt(r.dob,r.dod); return cellSub(r.name, a?("Age "+a):""); },
      edit:function(r){
        if(r.hasD) return { title:"Name & date of birth", fields:[ fld("Name of deceased","text","name",r,T("Deals",r.dealId,"Name_of_Deceased")),
          fld("Date of birth (age is calculated)","date","dob",r,T("Deals",r.dealId,"Date_of_Birth")) ] };
        return { title:"Name", fields:[ fld("First name","text","pFirst",r,T("Deceased_Pickups",r.pickupId,"First_Name")), fld("Last name","text","pLast",r,T("Deceased_Pickups",r.pickupId,"Last_Name")) ],
          after:function(row){ row.name=joinNonEmpty([row.pFirst,row.pLast]," "); } };
      } },
    { label:"Sex", w:8, text:function(r){ return r.sex; },
      edit:function(r){ return { fields:[ sel("Sex","sex",r,T("Deals",r.dealId,"Sex"),PL.sex) ] }; } },
    { label:"Address", w:26, text:function(r){ return joinNonEmpty([r.street,r.city]); },
      edit:function(r){ return { title:"Address", fields:[
        fld("Street","text","street",r,TT(T("Deals",r.dealId,"Street_1"),T("Deceased_Pickups",r.pickupId,"Deceased_Street_Address"))),
        fld("City","text","city",r,TT(T("Deals",r.dealId,"City"),T("Deceased_Pickups",r.pickupId,"Deceased_City"))) ] }; } },
    { label:"Pickup location", w:24, text:function(r){ return joinNonEmpty([r.place==="Other"?r.placeOther:r.place, r.hospital, r.ward?("Ward "+r.ward):""]); },
      edit:function(r){ return { title:"Pickup location", fields:[
        sel("Place of removal","place",r,T("Trips",r.tripId,"Place_of_Removal"),PL.placeOfRemoval),
        fld("Place of removal (other)","text","placeOther",r,T("Trips",r.tripId,"Place_of_Removal_Other")),
        fld("Hospital name","text","hospital",r,T("Trips",r.tripId,"Hospital_Name")),
        fld("Ward","text","ward",r,T("Trips",r.tripId,"Ward")) ] }; } },
    { label:"NOK name & phone", w:24, text:function(r){ return joinNonEmpty([joinNonEmpty([r.nokFirst,r.nokLast]," "), r.nokPhone]," · "); },
      html:function(r){ return cellSub(joinNonEmpty([r.nokFirst,r.nokLast]," "), joinNonEmpty([r.nokPhone, (r.dealNok && r.dealNok!==joinNonEmpty([r.nokFirst,r.nokLast]," "))?("Deal: "+r.dealNok):""]," · ")); },
      // Police / hospital bodies: save to the Deceased Pickup only -- the existing CRM workflow
      // "On Deceased Pickups Edit" (onDeceasedPickupCheckIn) copies the pickup's NOK fields onto
      // the NOK Contact (First/Last name and Phone). First call (no pickup): save to the Deal's NOK
      // Contact directly, using Phone like that sync and the NOK Intake app.
      edit:function(r){
        if(r.hasP) return { title:"Next of kin", fields:[
          fld("NOK first name","text","nokFirst",r,T("Deceased_Pickups",r.pickupId,"NOK_First_Name"),{hint:"Saved on the Deceased Pickup; CRM then updates the NOK Contact."}),
          fld("NOK last name","text","nokLast",r,T("Deceased_Pickups",r.pickupId,"NOK_Last_Name")),
          fld("NOK phone","text","nokPhone",r,T("Deceased_Pickups",r.pickupId,"NOK_Phone"),{hint:"CRM copies it to the NOK Contact's Phone."}) ] };
        return { title:"Next of kin", fields:[
          fld("NOK first name","text","nokFirst",r,T("Contacts",r.nokId,"First_Name")),
          fld("NOK last name","text","nokLast",r,T("Contacts",r.nokId,"Last_Name")),
          fld("NOK phone","text","nokPhone",r,T("Contacts",r.nokId,"Phone")) ] };
      } },
    { label:"Doctor / police, time of death", w:28,
      text:function(r){ return joinNonEmpty([ r.doctor?("Doctor: "+joinNonEmpty([r.doctor,r.doctorPhone]," ")):"", r.police?("Police: "+joinNonEmpty([r.police,r.policePhone]," ")):"", r.tod?("Time of death: "+r.tod):"" ]," · "); },
      edit:function(r){
        var M=r.hasD?"Deals":"Deceased_Pickups", id=r.hasD?r.dealId:r.pickupId;
        return { title:"Doctor / police / time of death", fields:[
          fld("Doctor name","text","doctor",r,T(M,id,"Doctor_Name")),
          fld("Doctor phone","text","doctorPhone",r,T(M,id,"Doctor_Phone")),
          fld("Police officer name","text","police",r,T(M,id,r.hasD?"Police_Office_Name":"Police_Officer_Name")),
          fld("Police phone","text","policePhone",r,T(M,id,"Police_Phone_Number")),
          fld("Time of death","text","tod",r,T(M,id,"Time_of_Death")) ] }; } },
    { label:"Driver & attendant", w:20, text:function(r){ return joinNonEmpty([r.driver, r.att]," / "); },
      html:function(r){ return cellSub(r.driver, r.att?("Att: "+r.att):""); },
      edit:function(r){ return { title:"Driver & attendant", fields:[
        lookup("Driver","driverId","driver",r,T("Trips",r.tripId,"Driver"),plDrivers()),
        lookup("Attendant","attId","att",r,T("Trips",r.tripId,"Attendant_NEW"),plAttendants()) ] }; } },
    { label:"Call taken by", w:14, text:function(r){ return r.callTakenBy; },
      edit:function(r){ return { fields:[ fld("Call taken by","text","callTakenBy",r,T("Deals",r.dealId,"Call_Taken_By")) ] }; } },
    { label:"Mileage (km)", w:13, text:function(r){ return r.km; },
      edit:function(r){ return { fields:[ fld("Distance (km)","text","km",r,T("Trips",r.tripId,"Number_of_distance_in_km")) ] }; } },
    { label:"Body size", w:18, text:function(r){ return r.size; },
      edit:function(r){ return { fields:[ r.hasD ? sel("Body size (Deal)","size",r,T("Deals",r.dealId,"Deceased_Size"),PL.dealSize) : sel("Body size (Pickup)","size",r,T("Deceased_Pickups",r.pickupId,"Deceased_Size"),PL.pickupSize) ] }; } },
    { label:"Fridge #", w:18, text:function(r){ return joinNonEmpty([r.loc, r.room, r.fridge?("Fridge "+r.fridge):"", r.row?("Row "+r.row):"", r.drawer?("Drawer "+r.drawer):""]," · "); },
      edit:function(r){ return { title:"Fridge position (Operations)", fields:[
        sel("Location","loc",r,T("Operations",r.opsId,"Location"),PL.opsLocation),
        sel("Room","room",r,T("Operations",r.opsId,"Room"),PL.room),
        sel("Refrigerator","fridge",r,T("Operations",r.opsId,"Refrigerator"),PL.fridge),
        sel("Row","row",r,T("Operations",r.opsId,"Row"),PL.row),
        sel("Drawer","drawer",r,T("Operations",r.opsId,"Drawer"),PL.drawer) ] }; } },
    { label:"Condition", w:18, text:function(r){ return joinNonEmpty([r.condition, r.needsAttn]," — "); },
      html:function(r){ return cellSub(r.condition, r.needsAttn); },
      edit:function(r){ return { title:"Deceased condition (Operations)", fields:[
        sel("Condition","condition",r,T("Operations",r.opsId,"Condition"),PL.condition),
        fld("Needs attention description","textarea","needsAttn",r,T("Operations",r.opsId,"Needs_Attention_Description")) ] }; } },
    { label:"Pickup type", w:16, text:function(r){ return joinNonEmpty([r.tripType, r.dealType]," / "); },
      html:function(r){ return cellSub(r.tripType, r.dealType?("Deal: "+r.dealType):""); } }
  ]
};

// ---- Report 2: Multi-Deceased Autopsy Case Results ----
REPORTS.r2={
  title:"Multi-Deceased Autopsy Case Results", sub:"Multi Deceased Autopsy Trip cases · one row per body", range:true,
  load:function(s){
    return call("r2",{ fromDate:s.f.from, toDate:s.f.to }).then(function(r){
      var parents={}; ((r&&r.parents)||[]).forEach(function(p){ parents[str(p.id)]=p; });
      return ((r&&r.rows)||[]).map(function(x){
        var c=obj(x.child), d=obj(x.deal), o=obj(x.ops), p=obj(parents[str(x.parentId)]);
        var childDrv=lkId(c.Driver);
        return {
          parentId:str(p.id||x.parentId), caseName:str(p.Name), caseDate:str(p.Scheduled_Date), caseLoc:lkName(p.Autopsy_Location),
          childId:str(c.id), dealId:str(d.id), opsId:str(o.id),
          name:str(d.Name_of_Deceased), outcome:str(o.Outcome), reason:str(o.Reschedule_Reason),
          recvHome:str(d.Name_of_Receiving_Funeral_Home), recvReason:str(d.Reason_for_not_Selecting_DFH),
          driverId: childDrv || lkId(p.Driver), driver: childDrv ? lkName(c.Driver) : lkName(p.Driver)
        };
      });
    });
  },
  sort:function(rows){ return rows.sort(function(a,b){ var x=sortKey(a.caseDate)+a.parentId, y=sortKey(b.caseDate)+b.parentId; if(x!==y) return x<y?1:-1; return a.name.localeCompare(b.name); }); },
  group:function(r){ return { key:r.parentId, label:(r.caseName||"Autopsy case")+" — "+fmtDT(r.caseDate), sub:r.caseLoc }; },
  totals:function(rows){
    var c={"Return to DFH":0,"Transfer out":0,"Reschedule":0,"No result yet":0};
    rows.forEach(function(r){ if(c[r.outcome]!==undefined) c[r.outcome]++; else c["No result yet"]++; });
    return Object.keys(c).map(function(k){ return { label:k, count:c[k] }; });
  },
  columns:[
    { label:"Case & autopsy date", w:26, text:function(r){ return joinNonEmpty([r.caseName, fmtDT(r.caseDate)]," — "); },
      edit:function(r){ return { title:"Case (parent trip)", fields:[
        fld("Case name","text","caseName",r,T("Trips",r.parentId,"Name")),
        fld("Autopsy date & time","datetime","caseDate",r,T("Trips",r.parentId,"Scheduled_Date")) ],
        after:function(row){ (rs("r2").rows||[]).forEach(function(x){ if(x.parentId===row.parentId){ x.caseName=row.caseName; x.caseDate=row.caseDate; } }); } }; } },
    { label:"Deceased name", w:24, text:function(r){ return r.name; },
      edit:function(r){ return { fields:[ fld("Name of deceased","text","name",r,T("Deals",r.dealId,"Name_of_Deceased")) ] }; } },
    { label:"Result", w:16, text:function(r){ return r.outcome; },
      html:function(r){ var cls=r.outcome==="Return to DFH"?"b-green":(r.outcome==="Transfer out"?"b-warn":(r.outcome==="Reschedule"?"b-red":"")); return r.outcome?'<span class="badge '+cls+'">'+esc(r.outcome)+'</span>':''; },
      edit:function(r){ return { fields:[ sel("Result","outcome",r,T("Operations",r.opsId,"Outcome"),PL.outcome) ] }; } },
    { label:"Reschedule reason", w:20, text:function(r){ return r.reason; },
      edit:function(r){ return { fields:[ sel("Reschedule reason","reason",r,T("Operations",r.opsId,"Reschedule_Reason"),PL.reschedule) ] }; } },
    { label:"Receiving funeral home", w:22, text:function(r){ return r.recvHome; },
      edit:function(r){ return { fields:[ fld("Receiving funeral home","text","recvHome",r,T("Deals",r.dealId,"Name_of_Receiving_Funeral_Home")) ] }; } },
    { label:"Reason it went elsewhere", w:28, text:function(r){ return r.recvReason; },
      edit:function(r){ return { fields:[ fld("Reason for not selecting DFH","textarea","recvReason",r,T("Deals",r.dealId,"Reason_for_not_Selecting_DFH")) ] }; } },
    { label:"Driver", w:18, text:function(r){ return r.driver; },
      edit:function(r){ return { fields:[ lookup("Driver (this body's trip)","driverId","driver",r,T("Trips",r.childId,"Driver"),plDrivers()) ] }; } }
  ]
};

// ---- Report 3: Embalming View ----
REPORTS.r3={
  title:"Embalming", sub:"Authorisation + burial order received · funeral today or later, or not yet embalmed · soonest funeral first",
  load:function(s){
    return call("r3").then(function(r){
      s.meta.hasReMeasured = !!(r && (r.hasReMeasuredField===true || r.hasReMeasuredField==="true"));
      return ((r&&r.rows)||[]).map(function(x){
        var d=obj(x.deal), o=obj(x.ops);
        return {
          dealId:str(d.id), opsId:str(o.id), name:str(d.Name_of_Deceased),
          pickupAt:str(d.Initial_Trip_Completed_At), funeral:str(d.Funeral_Time),
          auth:str(d.Embalming_Auth_form_Received), burial:str(d.Burial_Order_Received),
          status:str(o.Status), sched:str(o.Schedule_the_Embalming), reportDone:str(o.Embalming_Report_Uploaded),
          size:str(d.Deceased_Size), reSize:str(o.Re_Measured_Size)
        };
      });
    });
  },
  note:function(s){
    var n=[];
    if(s.meta && s.meta.hasReMeasured===false) n.push("The new Operations field \"Re-Measured Size\" is not in CRM yet, so that column can't be saved until it is created.");
    if((s.rows||[]).some(function(r){ return !r.opsId; })) n.push("Rows with no Embalming Request record show the status as read-only.");
    return n.join(" ");
  },
  filters:function(s){
    return '<select class="filter-select" data-rf="st"><option value="">All stages</option>'+PL.embStatus.concat(["(none)"]).map(function(t){ return '<option'+(s.f.st===t?" selected":"")+'>'+t+'</option>'; }).join("")+'</select>';
  },
  rowFilter:function(r,s){ if(!s.f.st) return true; if(s.f.st==="(none)") return !r.status; return r.status===s.f.st; },
  sort:function(rows){ return rows.sort(function(a,b){ var x=sortKey(a.funeral)||"99999999", y=sortKey(b.funeral)||"99999999"; return x<y?-1:(x>y?1:0); }); },
  columns:[
    { label:"Deceased name", w:24, text:function(r){ return r.name; },
      edit:function(r){ return { fields:[ fld("Name of deceased","text","name",r,T("Deals",r.dealId,"Name_of_Deceased")) ] }; } },
    { label:"Pickup date", w:14, text:function(r){ return fmtDT(r.pickupAt); },
      edit:function(r){ return { fields:[ fld("Initial trip completed at","datetime","pickupAt",r,T("Deals",r.dealId,"Initial_Trip_Completed_At")) ] }; } },
    { label:"Funeral date & time", w:16, text:function(r){ return fmtDT(r.funeral); },
      edit:function(r){ return { fields:[ fld("Funeral date & time","datetime","funeral",r,T("Deals",r.dealId,"Funeral_Time"),{hint:"Changes the funeral date on the Deal (same as editing it in CRM)."}) ] }; } },
    { label:"Authorisation received", w:12, text:function(r){ return yesNo(r.auth); }, html:function(r){ return ynBadge(r.auth); },
      edit:function(r){ return { fields:[ fld("Embalming authorisation received","bool","auth",r,T("Deals",r.dealId,"Embalming_Auth_form_Received")) ] }; } },
    { label:"Burial order received", w:12, text:function(r){ return yesNo(r.burial); }, html:function(r){ return ynBadge(r.burial); },
      edit:function(r){ return { fields:[ fld("Burial order received","bool","burial",r,T("Deals",r.dealId,"Burial_Order_Received")) ] }; } },
    { label:"Embalming status", w:14, text:function(r){ return r.status; },
      html:function(r){ if(!r.status) return ""; var cls=r.status==="Completed"?"b-green":(r.status==="Scheduled"?"b-status":"b-warn"); return '<span class="badge '+cls+'">'+esc(r.status)+'</span>'; },
      edit:function(r){ return { fields:[ sel("Embalming status (Requested → Scheduled → Completed)","status",r,T("Operations",r.opsId,"Status"),PL.embStatus) ] }; } },
    { label:"Scheduled date", w:16, text:function(r){ return fmtDT(r.sched); },
      edit:function(r){ return { fields:[ fld("Embalming scheduled for","datetime","sched",r,T("Operations",r.opsId,"Schedule_the_Embalming")) ] }; } },
    { label:"Embalming report filled out", w:12, text:function(r){ return yesNo(r.reportDone); }, html:function(r){ return ynBadge(r.reportDone); },
      edit:function(r){ return { fields:[ fld("Embalming report filled out","bool","reportDone",r,T("Operations",r.opsId,"Embalming_Report_Uploaded")) ] }; } },
    { label:"Original body size", w:18, text:function(r){ return r.size; },
      edit:function(r){ return { fields:[ sel("Body size (Deal)","size",r,T("Deals",r.dealId,"Deceased_Size"),PL.dealSize) ] }; } },
    { label:"Re-measured size", w:18, text:function(r){ return r.reSize; },
      edit:function(r){ var ok=rs("r3").meta.hasReMeasured; return { fields:[ sel("Re-measured size (Operations)","reSize",r,ok?T("Operations",r.opsId,"Re_Measured_Size"):[],PL.opsSize) ] }; } }
  ]
};

// ---- Report 4: Upcoming Autopsies ----
function bestOps(list){
  var best=null;
  (list||[]).forEach(function(o){
    var score=(o.Refrigerator?2:0)+(o.Location?1:0);
    if(!best || score>best.s || (score===best.s && sortKey(o.Modified_Time)>sortKey(best.o.Modified_Time))) best={ s:score, o:o };
  });
  return best ? best.o : {};
}
REPORTS.r4={
  title:"Upcoming Autopsies", sub:"Today and the next two days · earliest first, grouped by autopsy location",
  load:function(s){
    return call("r4").then(function(r){
      s.meta.from=r&&r.from; s.meta.to=r&&r.to;
      return ((r&&r.rows)||[]).map(function(x){
        var t=obj(x.trip), p=obj(x.parent), d=obj(x.deal), o=bestOps(x.opsList);
        var hasTrip=!!t.id;
        var dateTripId = hasTrip ? (t.Scheduled_Date || !p.id ? str(t.id) : str(p.id)) : "";
        var at = hasTrip ? str(t.Scheduled_Date || p.Scheduled_Date) : str(d.Autopsy_Date_Time);
        var locObj = hasTrip ? (t.Autopsy_Location || p.Autopsy_Location) : d.Autopsy_Locations;
        var locTripId = hasTrip ? (t.Autopsy_Location || !p.id ? str(t.id) : str(p.id)) : "";
        var type = p.id ? "Multi Deceased Autopsy Trip" : str(t.Trip_Type);
        return {
          tripId:str(t.id), dateTripId:dateTripId, locTripId:locTripId, dealId:str(d.id), opsId:str(o.id), hasTrip:hasTrip,
          name:str(d.Name_of_Deceased), at:at, dealAt:str(d.Autopsy_Date_Time),
          locId:lkId(locObj), locName:lkName(locObj),
          fridge:str(o.Refrigerator), row:str(o.Row), drawer:str(o.Drawer), loc:str(o.Location),
          type: type || "No trip yet", tripStatus:str(t.Trip_Status)
        };
      });
    });
  },
  sort:function(rows){ return rows.sort(function(a,b){ var g=(a.locName||"~").localeCompare(b.locName||"~"); if(g) return g; var x=sortKey(a.at), y=sortKey(b.at); return x<y?-1:(x>y?1:0); }); },
  group:function(r){ return { key:r.locName||"", label:r.locName||"No autopsy location set" }; },
  note:function(s){ return s.meta && s.meta.from ? ("Showing "+fmtDate(s.meta.from)+" to "+fmtDate(s.meta.to)+".") : ""; },
  columns:[
    { label:"Deceased name", w:26, text:function(r){ return r.name; },
      edit:function(r){ return { fields:[ fld("Name of deceased","text","name",r,T("Deals",r.dealId,"Name_of_Deceased")) ] }; } },
    { label:"Autopsy date & time", w:18, text:function(r){ return fmtDT(r.at); },
      html:function(r){ return cellSub(fmtDT(r.at), (r.dealAt && sortKey(r.dealAt).substring(0,12)!==sortKey(r.at).substring(0,12))?("Deal: "+fmtDT(r.dealAt)):""); },
      edit:function(r){
        if(r.hasTrip) return { fields:[ fld("Autopsy date & time (autopsy trip)","datetime","at",r,T("Trips",r.dateTripId,"Scheduled_Date")) ] };
        return autopsyScheduleEdit(r);
      } },
    { label:"Autopsy location", w:24, text:function(r){ return r.locName; },
      edit:function(r){
        if(r.hasTrip) return { fields:[ lookup("Autopsy location (autopsy trip)","locId","locName",r,T("Trips",r.locTripId,"Autopsy_Location"),plAutopsyLocs()) ] };
        return autopsyScheduleEdit(r);
      } },
    { label:"Fridge position", w:22, text:function(r){ return joinNonEmpty([r.loc, r.fridge?("Fridge "+r.fridge):"", r.row?("Row "+r.row):"", r.drawer?("Drawer "+r.drawer):""]," · "); },
      edit:function(r){ return { title:"Fridge position (Operations)", fields:[
        sel("Location","loc",r,T("Operations",r.opsId,"Location"),PL.opsLocation),
        sel("Refrigerator","fridge",r,T("Operations",r.opsId,"Refrigerator"),PL.fridge),
        sel("Row","row",r,T("Operations",r.opsId,"Row"),PL.row),
        sel("Drawer","drawer",r,T("Operations",r.opsId,"Drawer"),PL.drawer) ] }; } },
    { label:"Trip type", w:22, text:function(r){ return r.type; } }
  ]
};
// Deal-only rows (autopsy date on the Deal but no trip yet): save through the
// workflow-triggering endpoint, same as the "awaiting autopsy date" view.
function autopsyScheduleEdit(r){
  return { title:"Autopsy date & location (Deal)", special:true, fields:[
      fld("Autopsy date & time","datetime","at",r,[]),
      lookup("Autopsy location","locId","locName",r,[],plAutopsyLocs()) ],
    customSave:function(vals){ return call("saveAutopsy",{ dealId:r.dealId, autopsyDateTime:vals[0], locationId:vals[1] }); } };
}

// ---- Report 4b: Cases awaiting an autopsy date (Ms Shirley) ----
REPORTS.r4b={
  title:"Cases Awaiting an Autopsy Date", sub:"In our care · autopsy required · no autopsy date yet · enter the date and location, then Save",
  load:function(){
    return call("r4b").then(function(r){
      return ((r&&r.rows)||[]).map(function(d){
        return { dealId:str(d.id), name:str(d.Name_of_Deceased), pipeline:str(d.Pipeline), stage:str(d.Stage),
          pickupAt:str(d.Initial_Trip_Completed_At), dod:str(d.Date_of_Death), autopsyType:str(d.Autopsy_Type),
          locId:lkId(d.Autopsy_Locations), locName:lkName(d.Autopsy_Locations), owner:lkName(d.Owner), created:str(d.Created_Time) };
      });
    });
  },
  sort:function(rows){ return rows.sort(function(a,b){ var x=sortKey(a.pickupAt||a.created), y=sortKey(b.pickupAt||b.created); return x<y?-1:(x>y?1:0); }); },
  note:function(){ return "Saving here sets the Deal's Autopsy Date/Time and Autopsy Location, and the existing CRM workflow then creates the autopsy trip."; },
  columns:[
    { label:"Deceased name", w:26, text:function(r){ return r.name; }, html:function(r){ return cellSub(r.name, r.pipeline); } },
    { label:"Pickup date", w:14, text:function(r){ return fmtDate(r.pickupAt); } },
    { label:"Date of death", w:14, text:function(r){ return fmtDate(r.dod); } },
    { label:"Autopsy type", w:16, text:function(r){ return r.autopsyType; } },
    { label:"Stage", w:18, text:function(r){ return r.stage; } },
    { label:"Autopsy date & time", w:20, text:function(){ return ""; },
      html:function(r){ return '<input type="datetime-local" class="cell-input" data-aw="dt" data-deal="'+esc(r.dealId)+'">'; } },
    { label:"Autopsy location", w:24, text:function(r){ return r.locName; },
      html:function(r){
        return '<select class="cell-input" data-aw="loc" data-deal="'+esc(r.dealId)+'"><option value="">— choose —</option>'+
          plAutopsyLocs().map(function(o){ return '<option value="'+esc(o.id)+'"'+(o.id===r.locId?" selected":"")+'>'+esc(o.name)+'</option>'; }).join("")+'</select>'+
          '<button class="btn primary save-btn" data-act="aw-save" data-deal="'+esc(r.dealId)+'"><i class="ti ti-device-floppy"></i>Save</button>';
      } }
  ]
};

// ---- Report 6: Family Viewing Forms ----
REPORTS.r6={
  title:"Family Viewing Forms", sub:"Appearance answer or new funeral time requested · funeral today or later · soonest first",
  load:function(){
    return call("r6").then(function(r){
      return ((r&&r.rows)||[]).map(function(d){
        return { dealId:str(d.id), name:str(d.Name_of_Deceased), ownerId:lkId(d.Owner), owner:lkName(d.Owner),
          viewing:str(d.Pre_Visit_Viewing_Date), funeral:str(d.Funeral_Time),
          changes:str(d.Changes_in_Deceased_Appearence), newTime:str(d.New_Requested_Funeral_Date_and_Time) };
      });
    });
  },
  sort:function(rows){ return rows.sort(function(a,b){ var x=sortKey(a.funeral), y=sortKey(b.funeral); return x<y?-1:(x>y?1:0); }); },
  columns:[
    { label:"Deceased name", w:24, text:function(r){ return r.name; },
      edit:function(r){ return { fields:[ fld("Name of deceased","text","name",r,T("Deals",r.dealId,"Name_of_Deceased")) ] }; } },
    { label:"Funeral director", w:18, text:function(r){ return r.owner; },
      edit:function(r){
        var seen={}, opts=[]; (rs("r6").rows||[]).forEach(function(x){ if(x.ownerId && !seen[x.ownerId]){ seen[x.ownerId]=1; opts.push({id:x.ownerId,name:x.owner}); } });
        opts.sort(function(a,b){ return a.name.localeCompare(b.name); });
        return { fields:[ lookup("Funeral director (Deal owner)","ownerId","owner",r,T("Deals",r.dealId,"Owner"),opts) ] };
      } },
    { label:"Viewing date", w:14, text:function(r){ return fmtDate(r.viewing); },
      edit:function(r){ return { fields:[ fld("Viewing date","date","viewing",r,T("Deals",r.dealId,"Pre_Visit_Viewing_Date")) ] }; } },
    { label:"Funeral date & time", w:18, text:function(r){ return fmtDT(r.funeral); },
      edit:function(r){ return { fields:[ fld("Funeral date & time","datetime","funeral",r,T("Deals",r.dealId,"Funeral_Time"),{hint:"Changes the funeral date on the Deal (same as editing it in CRM)."}) ] }; } },
    { label:"Appearance changes", w:40, text:function(r){ return r.changes; },
      edit:function(r){ return { fields:[ fld("Changes in deceased appearance","textarea","changes",r,T("Deals",r.dealId,"Changes_in_Deceased_Appearence")) ] }; } },
    { label:"New funeral time", w:18, text:function(r){ return fmtDT(r.newTime); },
      edit:function(r){ return { fields:[ fld("New requested funeral date & time","datetime","newTime",r,T("Deals",r.dealId,"New_Requested_Funeral_Date_and_Time")) ] }; } }
  ]
};

// ---- Report 7: Funeral Trip Driver Notes ----
function buildNote(driver, stamp, text){ return "[["+driver+"|"+stamp+"]]\n"+text; }
REPORTS.r7={
  title:"Funeral Trip Driver Notes", sub:"Driver notes written on the day of the funeral · newest first", range:true,
  load:function(s){
    return call("r7",{ fromDate:s.f.from, toDate:s.f.to }).then(function(r){
      return ((r&&r.rows)||[]).map(function(x){
        return { dealId:str(x.dealId), noteId:str(x.noteId), name:str(x.deceased), funeral:str(x.funeral),
          driver:str(x.driver), stamp:str(x.stamp), created:str(x.created), text:str(x.text) };
      });
    });
  },
  sort:function(rows){ return rows.sort(function(a,b){ var x=sortKey(a.created), y=sortKey(b.created); return x<y?1:(x>y?-1:0); }); },
  columns:[
    { label:"Deceased name", w:24, text:function(r){ return r.name; },
      edit:function(r){ return { fields:[ fld("Name of deceased","text","name",r,T("Deals",r.dealId,"Name_of_Deceased")) ] }; } },
    { label:"Funeral date", w:16, text:function(r){ return fmtDT(r.funeral); },
      edit:function(r){ return { fields:[ fld("Funeral date & time","datetime","funeral",r,T("Deals",r.dealId,"Funeral_Time"),{hint:"Changes the funeral date on the Deal (same as editing it in CRM)."}) ] }; } },
    { label:"Driver", w:18, text:function(r){ return r.driver; }, edit:function(r){ return noteEdit(r); } },
    { label:"Note date & time", w:18, text:function(r){ return r.stamp; }, edit:function(r){ return noteEdit(r); } },
    { label:"Note", w:60, text:function(r){ return r.text; },
      html:function(r){ return esc(r.text).replace(/\n/g,"<br>"); }, edit:function(r){ return noteEdit(r); } }
  ]
};
function noteEdit(r){
  return { title:"Driver note", fields:[
      fld("Driver","text","driver",r,T("Notes",r.noteId,"Note_Content")),
      fld("Note date & time (as written in the note header)","text","stamp",r,T("Notes",r.noteId,"Note_Content")),
      fld("Note","textarea","text",r,T("Notes",r.noteId,"Note_Content")) ],
    build:function(vals){ return [{ m:"Notes", id:r.noteId, f:"Note_Content", v:buildNote(vals[0],vals[1],vals[2]) }]; } };
}

// ===== 8. EXCEL EXPORT (formatted for printing) =====
function exportReport(id){
  if(typeof ExcelJS==="undefined"){ toast("Excel library not loaded","err"); return; }
  var def=REPORTS[id], s=rs(id), rows=s.visible||visibleRows(id);
  var cols=def.columns;
  var wb=new ExcelJS.Workbook(); wb.creator="DFH Operations";
  var ws=wb.addWorksheet(def.title.substring(0,31), {
    pageSetup:{ orientation:"landscape", paperSize:1, fitToPage:true, fitToWidth:1, fitToHeight:0,
      margins:{ left:0.3, right:0.3, top:0.5, bottom:0.5, header:0.2, footer:0.2 }, printTitlesRow:"4:4" },
    headerFooter:{ oddFooter:"&L"+def.title+"&RPage &P of &N" },
    views:[{ state:"frozen", ySplit:4 }]
  });
  ws.columns=cols.map(function(c){ return { width:c.w||16 }; });
  var nCols=cols.length;
  ws.mergeCells(1,1,1,nCols);
  var t=ws.getCell(1,1); t.value="Delapenha Funeral Home — "+def.title; t.font={ bold:true, size:14, color:{argb:"FF3D1E4A"} };
  ws.mergeCells(2,1,2,nCols);
  var rangeTxt = def.range ? ("Period: "+fmtDate(s.f.from)+" to "+fmtDate(s.f.to)+" · ") : "";
  var sub=ws.getCell(2,1); sub.value=rangeTxt+"Generated "+fmtDT(jamNowIso())+" · "+rows.length+" row(s)"; sub.font={ italic:true, size:9, color:{argb:"FF8A7D92"} };
  if(def.totals){
    ws.mergeCells(3,1,3,nCols);
    ws.getCell(3,1).value=def.totals(rows).map(function(x){ return x.label+": "+x.count; }).join("   ·   ");
    ws.getCell(3,1).font={ bold:true, size:10, color:{argb:"FF5C2D6E"} };
  }
  var hdr=ws.getRow(4);
  cols.forEach(function(c,i){
    var cell=hdr.getCell(i+1); cell.value=c.label;
    cell.font={ bold:true, color:{argb:"FFFFFFFF"}, size:10 };
    cell.fill={ type:"pattern", pattern:"solid", fgColor:{argb:"FF5C2D6E"} };
    cell.alignment={ vertical:"middle", wrapText:true };
    cell.border=thinBorder();
  });
  hdr.height=32;   // room for a header that wraps onto two lines (e.g. "Mileage (km)")
  var rIdx=5, lastGroup=null;
  rows.forEach(function(r){
    if(def.group){
      var g=def.group(r);
      if(g.key!==lastGroup){
        lastGroup=g.key;
        ws.mergeCells(rIdx,1,rIdx,nCols);
        var gc=ws.getCell(rIdx,1); gc.value=g.label+(g.sub?"  ("+g.sub+")":"");
        gc.font={ bold:true, size:10, color:{argb:"FF3D1E4A"} };
        gc.fill={ type:"pattern", pattern:"solid", fgColor:{argb:"FFEDE0F2"} };
        gc.border=thinBorder();
        rIdx++;
      }
    }
    var row=ws.getRow(rIdx);
    cols.forEach(function(c,i){
      var cell=row.getCell(i+1), txt=c.text(r)||"";
      // plain numbers (e.g. mileage) as real numbers, so Excel doesn't flag "number stored as text"
      cell.value = /^-?\d+(\.\d+)?$/.test(txt) ? Number(txt) : txt;
      cell.font={ size:9.5 }; cell.alignment={ vertical:"top", wrapText:true }; cell.border=thinBorder();
    });
    rIdx++;
  });
  wb.xlsx.writeBuffer().then(function(buf){
    var blob=new Blob([buf],{ type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download=def.title.replace(/[^A-Za-z0-9]+/g,"_")+"_"+todayKey()+".xlsx";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }).catch(function(e){ toast("Excel export failed: "+errMsg(e),"err"); });
}
function thinBorder(){ var b={ style:"thin", color:{argb:"FFD4C8BC"} }; return { top:b, left:b, bottom:b, right:b }; }
function jamNowIso(){ var j=jamNow(); return j.getUTCFullYear()+"-"+pad2(j.getUTCMonth()+1)+"-"+pad2(j.getUTCDate())+"T"+pad2(j.getUTCHours())+":"+pad2(j.getUTCMinutes())+":00"; }

// ===== 9. EVENTS =====
document.addEventListener("click", function(e){
  var t=e.target;
  var nav=t.closest(".nav-item"); if(nav){ setView(nav.getAttribute("data-view")); return; }
  var card=t.closest("[data-card]"); if(card){ renderCardDetail(card.getAttribute("data-card")); return; }
  var ed=t.closest("td.ed"); if(ed){ var p=ed.getAttribute("data-edit").split(":"); openEdit(state.view, +p[0], +p[1]); return; }
  var act=t.closest("[data-act]"); if(!act) return;
  var a=act.getAttribute("data-act");
  if(a==="cards-refresh"){ state.selCardId=""; loadCards(true); renderCardsView(); }
  else if(a==="detail-back"){ $("app").classList.remove("show-detail"); }
  else if(a==="rep-refresh"){ loadReport(state.view); }
  else if(a==="rep-export"){ exportReport(state.view); }
  else if(a==="rep-month"){ var s=rs(state.view), mr=monthRange(); s.f.from=mr.from; s.f.to=mr.to; renderReportHeader(state.view); loadReport(state.view); }
  else if(a==="aw-save"){ saveAwaiting(act.getAttribute("data-deal"), act); }
});
document.addEventListener("change", function(e){
  var t=e.target;
  if(t.hasAttribute("data-cf")){ state.cf[t.getAttribute("data-cf")]=t.value; renderCardList(); return; }
  if(t.hasAttribute("data-rf")){
    var k=t.getAttribute("data-rf"), s=rs(state.view);
    if(k==="q") return;
    s.f[k]=t.value;
    if(k==="from" || k==="to"){ if(s.f.from && s.f.to) loadReport(state.view); }
    else renderReportBody(state.view);
  }
});
document.addEventListener("input", function(e){
  var t=e.target;
  if(t.id==="cardSearch"){ state.cf.q=t.value; renderCardList(); return; }
  if(t.getAttribute && t.getAttribute("data-rf")==="q"){ rs(state.view).f.q=t.value; if(rs(state.view).rows) renderReportBody(state.view); }
});
$("modalCancel").addEventListener("click", closeEdit);
$("modalBg").addEventListener("click", function(e){ if(e.target===$("modalBg")) closeEdit(); });
$("modalSave").addEventListener("click", function(){
  var ctx=state.edit;
  if(ctx && ctx.spec.customSave){
    var vals=ctx.spec.fields.map(function(f,fi){ return readField(f,fi); });
    if(!vals[0]){ var er=$("modalErr"); er.textContent="Enter the autopsy date and time."; er.style.display="block"; return; }
    $("modalSave").disabled=true;
    ctx.spec.customSave(vals).then(function(r){
      if(r && r.status==="success"){
        ctx.row.at=vals[0]; ctx.row.dealAt=vals[0]; ctx.row.locId=vals[1];
        plAutopsyLocs().forEach(function(o){ if(o.id===vals[1]) ctx.row.locName=o.name; });
        closeEdit(); renderReportBody(ctx.id); toast("Saved — CRM will create the autopsy trip","ok");
      } else { $("modalSave").disabled=false; var e1=$("modalErr"); e1.textContent=(r&&r.message)||"Save failed"; e1.style.display="block"; }
    }).catch(function(err){ $("modalSave").disabled=false; var e2=$("modalErr"); e2.textContent="Save failed: "+errMsg(err); e2.style.display="block"; });
    return;
  }
  saveEdit();
});
function saveAwaiting(dealId, btn){
  var dtEl=document.querySelector('[data-aw="dt"][data-deal="'+dealId+'"]');
  var locEl=document.querySelector('[data-aw="loc"][data-deal="'+dealId+'"]');
  var dt=localToIso(dtEl && dtEl.value), loc=locEl ? locEl.value : "";
  if(!dt){ toast("Enter the autopsy date and time first","err"); return; }
  if(!loc){ toast("Choose the autopsy location first","err"); return; }
  btn.disabled=true;
  call("saveAutopsy",{ dealId:dealId, autopsyDateTime:dt, locationId:loc }).then(function(r){
    if(r && r.status==="success"){
      var s=rs("r4b"); s.rows=(s.rows||[]).filter(function(x){ return x.dealId!==dealId; });
      if(state.rep.r4) state.rep.r4.rows=null;   // upcoming list is now stale
      renderReportBody("r4b"); toast("Saved — CRM will create the autopsy trip","ok");
    } else { btn.disabled=false; toast((r&&r.message)||"Save failed","err"); }
  }).catch(function(e){ btn.disabled=false; toast("Save failed: "+errMsg(e),"err"); });
}
$("hamburgerBtn").addEventListener("click", function(){ $("app").classList.toggle("sidebar-open"); });
$("sidebarOverlay").addEventListener("click", function(){ $("app").classList.remove("sidebar-open"); });

// ===== 10. INIT =====
function init(){
  $("todayLbl").textContent=fmtDate(todayKey());
  renderCardsView();
  if(typeof ZOHO==="undefined" || !ZOHO.CREATOR){
    $("cardList").innerHTML='<div class="list-empty">Creator widget SDK not loaded. Open this page inside Zoho Creator.</div>';
    return;
  }
  ZOHO.CREATOR.init().then(function(){
    state.sdkReady=true;
    getLoginEmail().then(function(em){
      state.loginEmail=em||"";
      var ini=(em||"").split("@")[0].split(/[._-]/).map(function(p){ return p.charAt(0).toUpperCase(); }).join("").substring(0,2);
      $("avatar").textContent=ini||"··"; $("avatar").title=em||"";
    });
    loadCards(true);
    loadPicklists();
  }).catch(function(e){
    $("cardList").innerHTML='<div class="list-empty">Could not start: '+esc(errMsg(e))+'</div>';
  });
}
init();

})();
