// ============================================================================
// DFH Police & Hospital Billing -- app.js  (ZP-TBD-105)
// Portal widget: every Police / Hospital case (also after it became a funeral /
// cremation case) with everything that drives its billing -- initial trip + KM,
// storage, Letter of No Interest / release dates, autopsy, reschedule, X-ray --
// and the Sales Orders / Invoices line by line, all editable. A case stays on the
// open lists until someone ticks "Billing closed".
// Data: live CRM (+ the Books copy of each invoice) through the app's Custom APIs.
// Plain JS (no jQuery). One IIFE; all clicks are wired with event delegation.
// ============================================================================
(function(){
"use strict";

// ===== 1. CONSTANTS & STATE =====
var WS = "delapenhafuneralhome";
var API = {
  list:      { name:"PH_Case_List",       method:"POST" },
  get:       { name:"PH_Get_Case",        method:"POST" },
  saveDeal:  { name:"PH_Save_Deal",       method:"POST" },
  saveKm:    { name:"PH_Save_Trip_KM",    method:"POST" },
  outcome:   { name:"PH_Save_Outcome",    method:"POST" },
  lines:     { name:"PH_Save_Lines",      method:"POST" },
  resync:    { name:"PH_Resync_Invoice",  method:"POST" },
  search:    { name:"PH_Search_Products", method:"POST" },
  closed:    { name:"PH_Set_Closed",      method:"POST" },
  note:      { name:"PH_Add_Note",        method:"POST" },
  picklists: { name:"PH_Picklists",       method:"GET"  },
  // round 2 (Andrea 2026-10-08 / 09)
  fbAdd:     { name:"PH_Feedback_Add",    method:"POST" },
  fbList:    { name:"PH_Feedback_List",   method:"GET"  },
  fbSet:     { name:"PH_Feedback_Set",    method:"POST" },
  mList:     { name:"PH_Monthly_List",    method:"GET"  },
  mAdd:      { name:"PH_Monthly_Add",     method:"POST" },
  mRemove:   { name:"PH_Monthly_Remove",  method:"POST" },
  mBuild:    { name:"PH_Monthly_Build",   method:"POST" },
  mStatus:   { name:"PH_Monthly_Status",  method:"POST" },
  cover:     { name:"PH_Cover_Data",      method:"POST" },
  prodInfo:  { name:"PH_Product_Info",    method:"POST" },
  customers: { name:"PH_Books_Customers", method:"POST" },
  orgMap:    { name:"PH_Org_Map_Save",    method:"POST" },
  delInv:    { name:"PH_Delete_Invoice",  method:"POST" },
  delMonth:  { name:"PH_Delete_Monthly",  method:"POST" },
  codes:     { name:"PH_Billing_Codes",   method:"GET"  },
  setCode:   { name:"PH_Set_Billing_Code",method:"POST" }
};
var CRM = "https://crm.zoho.com/crm/org871210233/tab/";
var BOOKS = "https://books.zoho.com/app/872327358#/invoices/";
var DEFAULT_FROM = "2026-06-01";   // Andrea 2026-10-08: start from June 1
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var MONTHS_L = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// CRM picklist values (live field metadata, 2026-10-07)
var PL = {
  yesNo: ["Yes","No"],
  condition: ["Good","Decomposed","Fair"],
  officerInterest: ["Interested","Not Interested"],
  autopsyType: ["Police Scheduled","Scheduled by DFH","Private"],
  stage: ["Trip Completed","Autopsy Requested","Autopsy Scheduled","Autopsy Rescheduled","Autopsy Completed","Letter of No Interest","DFH Selected","DFH Not Selected","Embalming Authorization","Closed Lost"],
  outcome: ["Return to DFH","Transfer out","Reschedule"],
  reason: ["Family did not show","Officer did not show","X-ray required","Problem caused by DFH"]
};
// Sales_Order_Type -> who pays
var PAYER = {
  "Police Cases":"IFSL (Police)",
  "Police Cases - MNSJ":"MNSJ",
  "Police Cases - Family":"Family (paid by the family)",
  "Hospital Cases":"Hospital"
};
var SO_ORDER = ["Police Cases","Police Cases - MNSJ","Police Cases - Family","Hospital Cases"];
var PH_INVOICE_FOR = ["Police","MNSJ","Family","Hospital"];

var state = {
  sdkReady:false, loginEmail:"",
  view:"police", sub:"all", q:"", fromDate:DEFAULT_FROM,
  cases:[], listLoading:false, listError:"", listLoaded:false, listDirty:false,
  caseId:"", c:null, caseLoading:false, caseError:"",
  picklists:null,
  modal:null,          // open modal context
  productCache:{},     // id -> product (suggested + searched), for the line editor
  // round 2
  monthly:null,        // { batches:[], items:[], orgMap:{} } from PH_Monthly_List
  billMonth:"",        // yyyy-MM shown on the Monthly invoices screen
  batchId:"",          // open monthly invoice
  batchStatus:{},      // batchId -> Books status of the monthly invoice
  cover:null,          // cover sheet being shown { batchId, kind, rows, loading, error }
  feedback:null,       // [{id,dealId,name,text,status,...}]
  fbFilter:"Open",
  codes:null           // PH_Billing_Codes result
};
var MONTHLY_FOR = ["Police","MNSJ","Hospital"];   // invoices that go on a monthly invoice (not Family)
var R2_VIEWS = { monthly:1, codes:1, feedback:1 };

// ===== 2. UTILITIES =====
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function pad2(n){ return (n<10?"0":"")+n; }
function str(v){ return v==null ? "" : String(v); }
function num(v){ var n=parseFloat(v); return isNaN(n) ? 0 : n; }
function errMsg(e){ if(e && e.message) return e.message; try{ return JSON.stringify(e); }catch(_){ return String(e); } }
function lk(o){ return (o && typeof o==="object") ? o : {id:"",name:""}; }

// Jamaica is -05:00 all year, no DST. CRM values are read as literal wall-clock
// text (same approach as the Operations portal), never through a Date object.
function jamNow(){ return new Date(Date.now() - 5*3600*1000); }
function todayKey(){ var j=jamNow(); return j.getUTCFullYear()+"-"+pad2(j.getUTCMonth()+1)+"-"+pad2(j.getUTCDate()); }
function dPart(iso){ iso=str(iso); return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.substring(0,10) : ""; }
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
function localToIso(v){ v=str(v).trim(); if(!v) return ""; if(v.length===16) v+=":00"; return v.substring(0,19)+"-05:00"; }
function isoToLocal(iso){ iso=str(iso); return iso.length>=16 ? iso.substring(0,16) : ""; }
function dayNum(d){ d=dPart(d); if(!d) return null; var p=d.split("-"); return Date.UTC(+p[0],+p[1]-1,+p[2])/86400000; }
function daysBetween(a,b){ var x=dayNum(a), y=dayNum(b); if(x===null||y===null) return null; return y-x; }
function money(v){ var n=num(v); return (n<0?"-":"")+"$"+Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function qtyTxt(v){ var n=num(v); return (Math.round(n*100)/100).toString(); }
function plural(n,w){ return n+" "+w+(n===1?"":"s"); }
function monthKey(iso){ var d=dPart(iso); return d ? d.substring(0,7) : ""; }
function monthLabel(k){ if(!k) return "No date"; var p=k.split("-"); return MONTHS_L[parseInt(p[1],10)-1]+" "+p[0]; }
function crmLink(tab,id){ return id ? CRM+tab+"/"+id : ""; }

var toastT=null;
function toast(msg, kind){
  var t=$("toast"); t.textContent=msg; t.className="toast show"+(kind?" "+kind:"");
  clearTimeout(toastT); toastT=setTimeout(function(){ t.className="toast"; }, kind==="err"?7000:3500);
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
      ZOHO.CREATOR.API.invokeCustomApi(cfg).then(function(r){
        var u=unwrap(r);
        if(u && u.status==="error"){ reject(new Error(u.message||"Request failed")); return; }
        resolve(u);
      }).catch(function(e){ console.error("[PHB]",m.name,e); reject(e); });
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
    var locs=(r&&r.autopsyLocations)||[];
    locs.sort(function(a,b){ return str(a.name).localeCompare(str(b.name)); });
    state.picklists={ autopsyLocations:locs };
    return state.picklists;
  }).catch(function(){ state.picklists={autopsyLocations:[]}; return state.picklists; });
}

// ===== 4. CASE LIST =====
function loadCases(){
  state.listLoading=true; state.listError="";
  if(!state.caseId) renderList();
  call("list",{ fromDate:state.fromDate }).then(function(r){
    state.listLoading=false; state.listLoaded=true; state.listDirty=false;
    state.cases=buildCases(r||{});
    if(r && r.message) toast(r.message,"err");
    updateBadges();
    if(!state.caseId) renderList();
  }).catch(function(e){
    state.listLoading=false; state.listError=errMsg(e);
    if(!state.caseId) renderList();
  });
}
// PH_Case_List returns raw COQL rows per module (Creator's statement limit rules out
// joining hundreds of cases in Deluge); they are joined into cases here.
var PICKUP_TYPES=["Police Case Pickup","Initial Police Case Pickup","Hospital Storage","Hospital Pickups","Initial","Home Pickups","First Call","Regular"];
function rowId(v){ if(v && typeof v==="object") return str(v.id); return str(v); }
function groupBy(rows, field){
  var m={}; (rows||[]).forEach(function(x){ var k=rowId(x[field]); if(!k) return; (m[k]=m[k]||[]).push(x); }); return m;
}
function buildCases(r){
  var tripsBy=groupBy(r.trips,"Deal"), dpBy=groupBy(r.deceasedPickups,"Deal");
  var soBy=groupBy(r.salesOrders,"Deal_Name"), invBy=groupBy(r.invoices,"Deal_Name__s");
  var closedBy={}; (r.closed||[]).forEach(function(x){ closedBy[str(x.d)]=x; });
  return (r.deals||[]).map(function(d){
    var id=str(d.id), pipe=str(d.Pipeline), ipipe=str(d.Initial_Pipeline);
    var kind=(ipipe==="Police Cases" || (ipipe!=="Hospital Cases" && pipe==="Police Cases")) ? "police" : "hospital";
    // pickup trip: own trip (completed wins), else the shared multi-deceased trip via Deceased_Pickups
    var pt=null;
    (tripsBy[id]||[]).forEach(function(t){
      var isPickup = str(t.Created_on_This_Field_Update)==="Initial_Trip" || PICKUP_TYPES.indexOf(str(t.Trip_Type))>=0;
      if(isPickup && (!pt || str(t.Trip_Status)==="Completed")) pt=t;
    });
    if(!pt){
      (dpBy[id]||[]).forEach(function(dp){
        if(!pt && rowId(dp.Trip)) pt={ Name:dp["Trip.Name"], Trip_Type:dp["Trip.Trip_Type"], Trip_Status:dp["Trip.Trip_Status"], Number_of_distance_in_km:dp["Trip.Number_of_distance_in_km"] };
      });
    }
    var isDropoff = !pt && kind==="police" && str(d.Is_Deceased_In_Our_Care)==="Yes";
    var tripStatus=pt?str(pt.Trip_Status):"", km=pt?str(pt.Number_of_distance_in_km):"";
    var pickedUp = !!str(d.Initial_Trip_Completed_At) || tripStatus==="Completed" || isDropoff;
    var sos=(soBy[id]||[]).map(function(s){ return { type:str(s.Sales_Order_Type), total:s.Grand_Total, status:str(s.Status) }; });
    var invs=(invBy[id]||[]).map(function(i){ return { id:str(i.id), for:str(i.Invoice_For), status:str(i.Status), total:i.Grand_Total, inBooks:!!str(i.Books_Invoice_ID), subject:str(i.Subject), orgId:rowId(i.Parent_Account), orgName:str(i["Parent_Account.Account_Name"]) }; });
    var warns=[];
    if(pickedUp){
      if(kind==="police" && !isDropoff && num(km)<=0) warns.push("KM missing");
      var soType=kind==="police"?"Police Cases":"Hospital Cases", invFor=kind==="police"?"Police":"Hospital";
      if(!sos.some(function(s){ return s.type===soType; })) warns.push("No "+kind+" Sales Order");
      else if(!invs.some(function(i){ return i.for===invFor; })) warns.push("No "+invFor+" invoice");
      invs.forEach(function(i){ if(!i.inBooks && i.status!=="Void" && i.status!=="Cancelled") warns.push((i.for||"An")+" invoice not in Books"); });
    }
    var cl=closedBy[id];
    return {
      id:id, name:str(d.Name_of_Deceased)||str(d.Deal_Name), kind:kind, pipeline:pipe, initialPipeline:ipipe, stage:str(d.Stage),
      created:str(d.Created_Time), pickedUpAt:str(d.Initial_Trip_Completed_At), pickupDate:str(d.Pickup_Date), inCare:str(d.Is_Deceased_In_Our_Care),
      loni:str(d.Letter_of_No_Interest_Date), receivingLoni:str(d.Receiving_Letter_of_No_Interest_Date),
      release:str(d.Hospital_Release_Date), receivingRelease:str(d.Receiving_Release_Date), condition:str(d.Condition),
      autopsyRequired:str(d.Autopsy_Required), autopsyAt:str(d.Autopsy_Date_Time), autopsyDoneAt:str(d.Autopsy_Completed_Date_Time),
      xray:d.X_Ray_Required===true || d.X_Ray_Required==="true", regNo:str(d.Registration_Number),
      hospital:str(d["Selected_Hospital.Account_Name"]), police:str(d["Police_Account.Account_Name"]),
      isDropoff:isDropoff, tripName:pt?str(pt.Name):"", tripStatus:tripStatus, tripType:pt?str(pt.Trip_Type):"", km:km, pickedUp:pickedUp,
      salesOrders:sos, invoices:invs, closed:!!cl, closedBy:cl?str(cl.by):"", closedAt:cl?str(cl.at):"", warnings:warns
    };
  });
}
function isOpen(c){ return !c.closed; }
function inView(c, v){
  if(v==="police") return c.kind==="police" && c.pickedUp && isOpen(c);
  if(v==="hospital") return c.kind==="hospital" && c.pickedUp && isOpen(c);
  if(v==="attention") return c.pickedUp && isOpen(c) && (c.warnings||[]).length>0;
  if(v==="awaiting") return !c.pickedUp && isOpen(c);
  if(v==="closed") return !!c.closed;
  return true;
}
function updateBadges(){
  var n={police:0,hospital:0,attention:0,awaiting:0,closed:0,all:0};
  state.cases.forEach(function(c){ Object.keys(n).forEach(function(v){ if(inView(c,v)) n[v]++; }); });
  $("bPolice").textContent=n.police; $("bHospital").textContent=n.hospital; $("bAttention").textContent=n.attention;
  $("bAwaiting").textContent=n.awaiting; $("bClosed").textContent=n.closed; $("bAll").textContent=n.all;
}
var VIEW_TITLE = { police:"Police cases", hospital:"Hospital cases", attention:"Needs attention", awaiting:"Not picked up yet", closed:"Billing closed", all:"All Police & Hospital cases" };
function filteredCases(){
  var q=state.q.trim().toLowerCase();
  return state.cases.filter(function(c){
    if(!inView(c,state.view)) return false;
    if(state.view==="police" && state.sub==="pickup" && c.isDropoff) return false;
    if(state.view==="police" && state.sub==="dropoff" && !c.isDropoff) return false;
    if(q){
      var hay=(str(c.name)+" "+str(c.police)+" "+str(c.hospital)+" "+str(c.regNo)+" "+str(c.tripName)).toLowerCase();
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  });
}
function renderListHeader(count){
  var subPills="";
  if(state.view==="police"){
    subPills='<div class="filters" style="margin-right:6px">'+
      [["all","All"],["pickup","Pickups"],["dropoff","Drop-offs"]].map(function(p){
        return '<button class="filter-pill'+(state.sub===p[0]?" active":"")+'" data-act="sub" data-v="'+p[0]+'">'+p[1]+'</button>';
      }).join("")+'</div>';
  }
  $("viewHeader").innerHTML =
    '<div class="vh-row"><div class="view-title">'+esc(VIEW_TITLE[state.view])+'</div><div class="view-sub">'+esc(count)+'</div>'+
      '<div class="vh-actions"><span class="flabel">Cases from</span><input type="date" class="filter-date" id="fromDate" value="'+esc(state.fromDate)+'">'+
      '<button class="btn" data-act="refresh"><i class="ti ti-refresh"></i>Refresh</button></div></div>'+
    '<div class="filters">'+subPills+
      '<div class="search-box"><i class="ti ti-search"></i><input id="caseSearch" placeholder="Search name, police, hospital, reg #…" value="'+esc(state.q)+'"></div>'+
    '</div>';
}
function caseAmount(c){
  // what the institution / payers are being billed: P/H invoices if there are any, else the Sales Orders
  var t=0, any=false;
  (c.invoices||[]).forEach(function(i){ if(PH_INVOICE_FOR.indexOf(i.for)>=0 && i.status!=="Void" && i.status!=="Cancelled"){ t+=num(i.total); any=true; } });
  if(!any) (c.salesOrders||[]).forEach(function(s){ if(PAYER[s.type]){ t+=num(s.total); any=true; } });
  return any ? money(t) : "";
}
function caseDot(c){
  if(c.closed) return "var(--green)";
  if((c.warnings||[]).length) return "var(--amber)";
  if(!c.pickedUp) return "var(--taupe)";
  return "var(--plum-l)";
}
function renderList(){
  if(state.caseId) return;                               // a case is open -- background reloads must not replace it
  if(R2_VIEWS[state.view]){ renderR2View(); return; }   // Monthly invoices / Billing codes / Feedback
  var area=$("contentArea");
  if(state.listLoading && !state.cases.length){
    renderListHeader("");
    area.innerHTML='<div class="list-pane"><div class="loading"><i class="ti ti-loader-2"></i>Loading Police &amp; Hospital cases…</div></div>';
    return;
  }
  if(state.listError){
    renderListHeader("");
    area.innerHTML='<div class="list-pane"><div class="list-empty">Could not load cases: '+esc(state.listError)+'</div></div>';
    return;
  }
  var list=filteredCases();
  renderListHeader(plural(list.length,"case")+(state.listLoading?" · refreshing…":""));
  if(!list.length){ area.innerHTML='<div class="list-pane"><div class="list-empty">No cases here.</div></div>'; return; }
  var groups={}, order=[];
  list.forEach(function(c){
    var k=monthKey(c.pickedUpAt||c.pickupDate||c.created);
    if(!groups[k]){ groups[k]=[]; order.push(k); }
    groups[k].push(c);
  });
  order.sort(function(a,b){ return a<b?1:(a>b?-1:0); });
  var h='<div class="list-pane" id="listPane">';
  order.forEach(function(k){
    groups[k].sort(function(a,b){ var x=str(a.pickedUpAt||a.created), y=str(b.pickedUpAt||b.created); return x<y?1:(x>y?-1:0); });
    h+='<div class="day-group"><div class="day-label">'+esc(monthLabel(k))+' · '+groups[k].length+'</div><div class="card-grid">';
    groups[k].forEach(function(c){ h+=caseCard(c); });
    h+='</div></div>';
  });
  h+='</div>';
  area.innerHTML=h;
}
function caseCard(c){
  var h='<div class="tc'+(c.closed?" closed":"")+'" data-act="open-case" data-id="'+esc(c.id)+'">';
  h+='<div class="card-top"><span class="sdot" style="background:'+caseDot(c)+'"></span><span class="card-name">'+esc(c.name)+'</span><span class="card-amt">'+esc(caseAmount(c))+'</span></div>';
  var when=c.isDropoff ? ("Drop-off · "+(fmtDate(c.created)||"")) : (c.pickedUpAt ? ("Picked up "+fmtDT(c.pickedUpAt)) : ("Trip "+(c.tripStatus||"not created")));
  h+='<div class="card-line"><i class="ti ti-truck"></i>'+esc(when)+'</div>';
  var who=c.kind==="police" ? (c.police||"Police account not set") : (c.hospital||"Hospital not set");
  h+='<div class="card-line"><i class="ti '+(c.kind==="police"?"ti-shield":"ti-building-hospital")+'"></i>'+esc(who)+'</div>';
  var dateLine="";
  if(c.kind==="police"){
    dateLine = c.loni ? ("LONI "+fmtDate(c.loni)) : (c.autopsyDoneAt ? ("Autopsy done "+fmtDate(c.autopsyDoneAt)) : "No Letter of No Interest yet");
    if(c.kind==="police" && !c.isDropoff && c.pickedUp) dateLine+=" · KM "+(str(c.km)!==""?qtyTxt(c.km):"—");
  } else {
    dateLine = c.release ? ("Released "+fmtDate(c.release)) : "No release date yet";
  }
  h+='<div class="card-line"><i class="ti ti-calendar"></i>'+esc(dateLine)+'</div>';
  h+='<div class="card-bot">';
  h+='<span class="badge b-type">'+(c.kind==="police"?"Police":"Hospital")+'</span>';
  if(c.isDropoff) h+='<span class="badge b-slate">Drop-off</span>';
  if(c.pipeline && c.pipeline!=="Police Cases" && c.pipeline!=="Hospital Cases") h+='<span class="badge b-status">Now '+esc(c.pipeline)+'</span>';
  else if(c.stage) h+='<span class="badge b-status">'+esc(c.stage)+'</span>';
  if(c.condition==="Decomposed") h+='<span class="badge b-red">Decomposed</span>';
  if(c.autopsyRequired==="Yes") h+='<span class="badge b-slate">Autopsy</span>';
  if(c.xray===true || c.xray==="true") h+='<span class="badge b-slate">X-ray</span>';
  (c.warnings||[]).forEach(function(w){ h+='<span class="badge b-warn"><i class="ti ti-alert-triangle"></i>'+esc(w)+'</span>'; });
  if(c.closed) h+='<span class="badge b-green"><i class="ti ti-check"></i>Billing closed</span>';
  h+='</div></div>';
  return h;
}

// ===== 5. NAVIGATION =====
function setView(v){
  state.view=v; state.sub="all"; state.batchId=""; state.cover=null;
  var items=document.querySelectorAll(".nav-item");
  for(var i=0;i<items.length;i++){ items[i].classList.toggle("active", items[i].getAttribute("data-view")===v); }
  $("app").classList.remove("sidebar-open");
  closeCase();
}
function openCase(id){
  state.caseId=id; state.c=null; state.caseError=""; state.caseLoading=true;
  $("viewHeader").style.display="none";
  renderCase();
  loadCase();
}
// Back to the list; a case changed in the app makes the list reload (totals / warnings).
function closeCase(){
  state.caseId=""; state.c=null;
  $("viewHeader").style.display="";
  if(state.listDirty) loadCases();
  else renderList();
}
function loadCase(){
  var id=state.caseId; if(!id) return;
  state.caseLoading=true;
  call("get",{ dealId:id }).then(function(r){
    if(state.caseId!==id) return;
    state.caseLoading=false; state.c=r; state.caseError="";
    (r.suggestedProducts||[]).forEach(cacheProduct);
    renderCase();
    loadCaseMonthlyStatus(r);   // Books status of any monthly invoice its invoices are on
  }).catch(function(e){
    if(state.caseId!==id) return;
    state.caseLoading=false; state.caseError=errMsg(e); renderCase();
  });
}
function afterChange(msg){
  state.listDirty=true;
  if(msg) toast(msg,"ok");
  loadCase();
}

// ===== 6. CASE SCREEN =====
function listRow(){ for(var i=0;i<state.cases.length;i++){ if(state.cases[i].id===state.caseId) return state.cases[i]; } return null; }
function renderCase(){
  var area=$("contentArea");
  var c=state.c, row=listRow();
  var name = (c && c.deal) ? (c.deal.Name_of_Deceased||c.deal.Deal_Name) : (row ? row.name : "Case");
  var h='<div class="case-wrap">';
  h+='<div class="case-hdr"><button class="back" data-act="back">&#8592; Back</button><div><div class="d-name">'+esc(name)+'</div><div class="d-meta">';
  if(c && c.deal){
    var d=c.deal;
    h+='<span>'+(c.kind==="police"?"Police case":"Hospital case")+(c.isDropoff?" · drop-off":"")+'</span>';
    if(d.Initial_Pipeline && d.Initial_Pipeline!==d.Pipeline) h+='<span>· '+esc(d.Initial_Pipeline)+' → '+esc(d.Pipeline)+'</span>';
    else h+='<span>· '+esc(d.Pipeline)+'</span>';
    h+='<span>· Stage: '+esc(d.Stage||"—")+'</span>';
    h+='<span>· <a href="'+esc(crmLink("Potentials",state.caseId))+'" target="_blank">Open Deal in CRM</a></span>';
  }
  h+='</div></div><div class="case-hdr-r">';
  h+='<button class="btn sm" style="border-color:#fff;color:#fff;background:transparent" data-act="reload-case"><i class="ti ti-refresh"></i>Refresh</button>';
  if(c && c.billing){
    if(c.billing.closed===true || c.billing.closed==="true"){
      h+='<div class="close-box on"><i class="ti ti-circle-check"></i><div>Billing closed<br><span style="opacity:.8">'+esc(c.billing.by||"")+(c.billing.at?" · "+esc(fmtDT(c.billing.at)):"")+'</span></div><button class="btn sm" data-act="reopen">Reopen</button></div>';
    } else {
      h+='<div class="close-box"><i class="ti ti-circle-dashed"></i>Billing open<button class="btn sm green" data-act="close-billing"><i class="ti ti-check"></i>Close billing</button></div>';
    }
  }
  h+='</div></div>';
  h+='<div class="case-body" id="caseBody">';
  if(state.caseLoading && !c) h+='<div class="loading"><i class="ti ti-loader-2"></i>Loading case…</div>';
  else if(state.caseError) h+='<div class="alert err"><i class="ti ti-alert-circle"></i>Could not load this case: '+esc(state.caseError)+'</div>';
  else if(c) h+='<div class="case-grid"><div class="col">'+leftColumn(c)+'</div><div class="col">'+billingColumn(c)+'</div></div>';
  h+='</div></div>';
  var keepScroll = $("caseBody") ? $("caseBody").scrollTop : 0;
  area.innerHTML=h;
  if(keepScroll && $("caseBody")) $("caseBody").scrollTop=keepScroll;
}
function fr(label, val, raw){
  var v=str(val);
  return '<div class="frow"><span class="flbl">'+esc(label)+'</span><span class="fval'+(v?"":" empty")+'">'+(v ? (raw?v:esc(v)) : "—")+'</span></div>';
}
function conTitle(icon, title, editKey){
  return '<div class="con-title"><i class="ti '+icon+'"></i>'+esc(title)+(editKey?'<span class="ct-r"><button class="btn sm ghost" data-act="edit-section" data-k="'+editKey+'"><i class="ti ti-pencil"></i>Edit</button></span>':'')+'</div>';
}
function leftColumn(c){
  var d=c.deal, h="";
  // --- Case
  h+='<div class="container">'+conTitle("ti-id-badge-2","Case","case");
  h+=fr("Type", (c.kind==="police"?"Police":"Hospital")+(c.isDropoff?" — drop-off (no initial trip)":""));
  h+=fr("Started as", d.Initial_Pipeline||d.Pipeline);
  h+=fr("Now", d.Pipeline);
  h+=fr("Stage", d.Stage);
  if(c.kind==="police"){
    h+=fr("Police account", lk(d.Police_Account).name);
    h+=fr("Police officer", [d.Police_Office_Name, d.Police_Phone_Number].filter(Boolean).join(" · "));
    h+=fr("Case number", d.Case_Number);
    h+=fr("Registration #", d.Registration_Number);
  } else {
    h+=fr("Hospital", lk(d.Selected_Hospital).name);
  }
  h+=fr("Condition", d.Condition);
  h+=fr("In our care", d.Is_Deceased_In_Our_Care);
  h+=fr("Family account", lk(d.Account_Name).name);
  h+='</div>';
  // --- Initial trip
  h+='<div class="container">'+conTitle("ti-truck","Initial trip","");
  var pt=null; (c.trips||[]).forEach(function(t){ if(t.id===c.pickupTripId) pt=t; });
  if(c.isDropoff){
    h+='<div class="alert info"><i class="ti ti-info-circle"></i>Police drop-off: the police brought the deceased in. There is no initial trip and no trip fee — storage only.</div>';
  } else if(!pt){
    h+='<div class="alert warn"><i class="ti ti-alert-triangle"></i>No initial trip found for this case.</div>';
  } else {
    h+=fr("Trip", pt.name);
    h+=fr("Type", pt.type);
    h+=fr("Status", pt.status);
    h+=fr("Completed", fmtDT(d.Initial_Trip_Completed_At || pt.completed));
    h+=fr("Pickup date", fmtDate(d.Pickup_Date));
    var kmMissing = num(pt.km)<=0;
    h+='<div class="frow"><span class="flbl">KM (from Amber)</span><span class="fval"><span class="km-chip'+(kmMissing&&c.kind==="police"?" missing":"")+'">'+(str(pt.km)!==""?esc(qtyTxt(pt.km))+" km":"blank")+'</span> <button class="btn sm ghost" data-act="edit-km" data-trip="'+esc(pt.id)+'"><i class="ti ti-pencil"></i></button></span></div>';
    if(c.kind==="police"){
      h+='<div class="hint">Police: the trip fee is billed per KM — quantity = KM × $1/km. '+(kmMissing?'<b style="color:var(--amber)">KM is blank / 0, so the trip fee bills $0 — enter the KM.</b>':'Changing the KM re-prices the Sales Order through the CRM rule.')+'</div>';
    } else {
      h+='<div class="hint">Hospital: the pickup is a flat per-hospital product (quantity 1); KM is not billed.</div>';
    }
    if(pt.rel==="shared") h+='<div class="hint">This is a multi-deceased pickup trip shared with other deceased — its KM applies to each of them.</div>';
  }
  h+='</div>';
  // --- Storage dates
  if(c.kind==="police"){
    h+='<div class="container">'+conTitle("ti-file-certificate","Letter of No Interest","loni");
    h+=fr("Investigating officer", d.Investigating_Officer_s_Interest);
    h+=fr("Police interest?", d.Police_Interest);
    h+=fr("Letter of Interest date", fmtDate(d.Letter_of_Interest_Date));
    h+=fr("Letter of No Interest date", fmtDate(d.Letter_of_No_Interest_Date));
    h+=fr("Family received LONI", fmtDate(d.Receiving_Letter_of_No_Interest_Date));
    h+=storageCalc(c);
    h+='</div>';
    // --- Autopsy
    h+='<div class="container">'+conTitle("ti-microscope","Autopsy, reschedule & X-ray","autopsy");
    h+=fr("Autopsy required?", d.Autopsy_Required);
    h+=fr("Autopsy type", d.Autopsy_Type);
    h+=fr("Autopsy location", lk(d.Autopsy_Locations).name || d.Autopsy_Location);
    h+=fr("Autopsy date / time", fmtDT(d.Autopsy_Date_Time));
    h+=fr("Autopsy completed", fmtDT(d.Autopsy_Completed_Date_Time));
    h+=fr("X-ray required", d.X_Ray_Required==="true" ? "Yes" : "No");
    h+=autopsyTrips(c);
    h+='</div>';
  } else {
    h+='<div class="container">'+conTitle("ti-door-exit","Hospital release","release");
    h+=fr("Hospital release date", fmtDate(d.Hospital_Release_Date));
    h+=fr("Family received release", fmtDate(d.Receiving_Release_Date));
    h+=storageCalc(c);
    h+='<div class="hint">Autopsies and X-rays are done by the hospital before the pickup, so they are not billed on hospital cases.</div>';
    h+='</div>';
  }
  // --- All trips
  h+='<div class="container">'+conTitle("ti-route","All trips for this deceased","");
  if(!(c.trips||[]).length) h+='<div class="hint">No trips.</div>';
  (c.trips||[]).forEach(function(t){ h+=tripRow(t, c); });
  h+='</div>';
  // --- Feedback (round 2): anything wrong that is not a billing code -> daily export
  h+=caseFeedbackBlock(c);
  // --- Notes & history
  h+='<div class="container">'+conTitle("ti-notes","Notes & history","");
  h+='<textarea class="note-in" id="noteIn" placeholder="Add a note for this case (who you called, what was agreed…)"></textarea>';
  h+='<div style="text-align:right;margin:6px 0 4px"><button class="btn sm" data-act="add-note"><i class="ti ti-plus"></i>Add note</button></div>';
  if(c.billing && c.billing.notes) h+='<div class="calc"><b>Closing note:</b> '+esc(c.billing.notes)+'</div>';
  if(!(c.log||[]).length) h+='<div class="hint">Nothing changed from this app yet.</div>';
  (c.log||[]).forEach(function(l){
    h+='<div class="log-item"><div class="li-top"><span class="li-act">'+esc(l.action)+'</span><span>'+esc(fmtDT(l.at))+'</span><span>'+esc(l.by)+'</span></div><div class="li-det">'+esc(l.detail)+'</div></div>';
  });
  h+='</div>';
  return h;
}
function storageCalc(c){
  var d=c.deal;
  var start=dPart(d.Initial_Trip_Completed_At)||dPart(d.Pickup_Date)||dPart(d.Created_Time);
  if(!start) return '<div class="calc">No pickup date yet — storage starts when the initial trip is completed.</div>';
  var t='<b>Storage check</b> (calendar days, to compare with the storage lines →)<br>';
  if(c.kind==="police"){
    var loni=dPart(d.Letter_of_No_Interest_Date);
    if(loni){
      var gap=daysBetween(start,loni);
      if(gap<0) return '<div class="calc"><b style="color:var(--red)">The Letter of No Interest date is before the pickup date — check the dates.</b></div>';
      t+='Pickup '+fmtDate(start)+' → LONI '+fmtDate(loni)+': <b>'+plural(gap,"day")+'</b><br>';
      t+='IFSL (police) pays up to 2 days: <b>'+Math.min(2,gap)+'</b> · MNSJ pays the rest: <b>'+Math.max(0,gap-2)+'</b>';
      var rec=dPart(d.Receiving_Letter_of_No_Interest_Date);
      if(rec){ var fam=daysBetween(loni,rec); if(fam>0) t+='<br>LONI → family received it: <b>'+plural(fam,"day")+'</b> (family storage)'; }
      if(d.Condition==="Decomposed") t+='<br>Decomposed: the decomposition storage rate applies, plus the one-time decomposition fee.';
    } else if(dPart(d.Autopsy_Completed_Date_Time)){
      var g2=daysBetween(start,dPart(d.Autopsy_Completed_Date_Time));
      t+='Pickup '+fmtDate(start)+' → autopsy completed '+fmtDate(d.Autopsy_Completed_Date_Time)+': <b>'+plural(g2,"day")+'</b>';
    } else {
      t+='No Letter of No Interest yet — storage still running: <b>'+plural(daysBetween(start,todayKey()),"day")+'</b> since '+fmtDate(start)+'.';
    }
  } else {
    var rel=dPart(d.Hospital_Release_Date);
    if(rel){
      var g3=daysBetween(start,rel);
      if(g3<0) return '<div class="calc"><b style="color:var(--red)">The release date is before the pickup date — check the dates.</b></div>';
      t+='Pickup '+fmtDate(start)+' → release '+fmtDate(rel)+': <b>'+plural(g3,"day")+'</b> (hospital storage)';
      var rr=dPart(d.Receiving_Release_Date);
      if(rr){ var f2=daysBetween(rel,rr); if(f2>0) t+='<br>Release → family received it: <b>'+plural(f2,"day")+'</b> (family storage)'; }
    } else {
      t+='No release date yet — storage still running: <b>'+plural(daysBetween(start,todayKey()),"day")+'</b> since '+fmtDate(start)+'.';
    }
  }
  return '<div class="calc">'+t+'</div>';
}
function opsForTrip(c, tripId){
  var out=null; (c.operations||[]).forEach(function(o){ if(o.tripId===tripId) out=o; }); return out;
}
function autopsyTrips(c){
  var types=["Autopsy Initial","Autopsy Reschedule","X-Ray Trip","Multi Deceased Autopsy Trip"];
  var list=(c.trips||[]).filter(function(t){ return types.indexOf(t.type)>=0; });
  var h='';
  if(!list.length){
    h+='<div class="hint">No autopsy trip yet. It is created when Autopsy required = Yes and an autopsy date/time is set.</div>';
  }
  list.forEach(function(t){
    h+=tripRow(t, c);
  });
  // operations records with a disposition but no matching listed trip
  var shown={}; list.forEach(function(t){ shown[t.id]=1; });
  (c.operations||[]).forEach(function(o){
    if((o.outcome||o.reason) && !shown[o.tripId]){
      h+='<div class="trip-row"><div class="tr-top"><span class="tr-name">'+esc(o.name||"Operations record")+'</span>'+outcomeBadge(o)+
        '<button class="btn sm ghost" style="margin-left:auto" data-act="edit-outcome" data-ops="'+esc(o.id)+'"><i class="ti ti-pencil"></i>Outcome</button></div></div>';
    }
  });
  h+='<div class="hint">Reschedule billing follows the reason: <b>Family did not show</b> → family pays the trip; <b>Officer did not show</b> → MNSJ pays; <b>X-ray required</b> → X-ray trip billed to IFSL; <b>Problem caused by DFH</b> → nothing billed.</div>';
  return h;
}
function outcomeBadge(o){
  if(!o) return "";
  if(o.outcome==="Reschedule") return '<span class="badge b-warn">Reschedule: '+esc(o.reason||"no reason")+'</span>';
  if(o.outcome) return '<span class="badge b-green">'+esc(o.outcome)+'</span>';
  return "";
}
function tripRow(t, c){
  var o=opsForTrip(c,t.id);
  var isAutopsy=["Autopsy Initial","Autopsy Reschedule","X-Ray Trip"].indexOf(t.type)>=0;
  var h='<div class="trip-row"><div class="tr-top"><span class="tr-name">'+esc(t.type||"Trip")+'</span>';
  h+='<span class="badge '+(t.status==="Completed"?"b-green":(t.status==="DO NOT SCHEDULE"?"b-warn":"b-status"))+'">'+esc(t.status||"—")+'</span>';
  if(t.rel==="parent") h+='<span class="badge b-slate">Batch trip</span>';
  if(t.rel==="shared") h+='<span class="badge b-slate">Shared pickup</span>';
  if(t.id===c.pickupTripId) h+='<span class="badge b-type">Initial</span>';
  h+=outcomeBadge(o);
  h+='</div><div class="tr-sub"><span>'+esc(t.name)+'</span>';
  if(t.scheduled) h+='<span><i class="ti ti-calendar"></i> '+esc(fmtDT(t.scheduled))+'</span>';
  if(t.autopsyLocation) h+='<span><i class="ti ti-map-pin"></i> '+esc(t.autopsyLocation)+(t.fixedKm?" (fixed "+esc(t.fixedKm)+" km)":"")+'</span>';
  h+='<span class="km-chip'+(num(t.km)<=0?" missing":"")+'">'+(str(t.km)!==""?esc(qtyTxt(t.km))+" km":"no KM")+'</span>';
  h+='<button class="btn sm ghost" data-act="edit-km" data-trip="'+esc(t.id)+'" title="Edit KM"><i class="ti ti-pencil"></i>KM</button>';
  if(isAutopsy && o) h+='<button class="btn sm ghost" data-act="edit-outcome" data-ops="'+esc(o.id)+'"><i class="ti ti-clipboard-check"></i>Outcome</button>';
  h+='</div></div>';
  return h;
}

// ----- billing column -----
function linesTable(lines, sub, tax, total){
  var h='<table class="lines"><thead><tr><th>Product billed</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Disc.</th><th class="num">Amount</th></tr></thead><tbody>';
  if(!lines.length) h+='<tr><td colspan="5" class="cell-empty" style="color:var(--taupe)">No lines</td></tr>';
  lines.forEach(function(l){
    var sub2=[l.category, l.code].filter(Boolean).join(" · ");
    var warn = num(l.qty)<=0 ? ' <span class="badge b-warn">qty 0</span>' : '';
    h+='<tr><td><span class="p-name">'+esc(l.productName)+'</span>'+warn+(sub2?'<span class="p-sub">'+esc(sub2)+'</span>':'')+(l.description?'<span class="p-sub">'+esc(l.description)+'</span>':'')+'</td>'+
      '<td class="num">'+esc(qtyTxt(l.qty))+'</td><td class="num">'+esc(money(l.price))+'</td><td class="num">'+(num(l.discount)?esc(money(l.discount)):"—")+'</td><td class="num">'+esc(money(lineAmount(l)))+'</td></tr>';
  });
  if(num(tax)) h+='<tr class="tot"><td colspan="4" class="num">Tax</td><td class="num">'+esc(money(tax))+'</td></tr>';
  h+='<tr class="tot"><td colspan="4" class="num">Total</td><td class="num">'+esc(money(total))+'</td></tr>';
  h+='</tbody></table>';
  return h;
}
function lineAmount(l){ var t=num(l.total); if(t || num(l.qty)===0) return t; return num(l.qty)*num(l.price)-num(l.discount); }
function linesKey(lines){ return (lines||[]).map(function(l){ return l.productId+"|"+qtyTxt(l.qty)+"|"+num(l.price).toFixed(2); }).sort().join(";"); }
function invoiceBlock(inv, so){
  var h='<div class="inv"><div class="inv-hdr"><i class="ti ti-file-invoice" style="color:var(--plum)"></i><span class="ih-title">Invoice — '+esc(inv.subject||inv.for)+'</span>';
  h+='<span class="badge '+(inv.locked?"b-green":"b-status")+'">'+esc(inv.status||"—")+'</span>';
  if(inv.retainer) h+='<span class="badge b-slate">Retainer</span>';
  h+='<span class="ih-r">';
  if(!inv.locked) h+='<button class="btn sm" data-act="resync" data-inv="'+esc(inv.id)+'" title="Re-copy from the Sales Order and update Books"><i class="ti ti-cloud-upload"></i>Push to Books</button>';
  if(!so && !inv.locked) h+='<button class="btn sm" data-act="edit-lines" data-target="invoice" data-id="'+esc(inv.id)+'"><i class="ti ti-pencil"></i>Edit lines</button>';
  h+='<a class="btn sm ghost" href="'+esc(crmLink("Invoices",inv.id))+'" target="_blank"><i class="ti ti-external-link"></i>CRM</a>';
  if(inv.booksId) h+='<a class="btn sm ghost" href="'+esc(BOOKS+inv.booksId)+'" target="_blank"><i class="ti ti-external-link"></i>Books</a>';
  // round 2: pre-launch clean-up delete -- P/H invoices only, never family invoices
  if(MONTHLY_FOR.indexOf(inv.for)>=0 && !inv.locked && !monthlyItemFor(inv.id)) h+='<button class="btn sm ghost" style="color:var(--red)" data-act="del-inv" data-inv="'+esc(inv.id)+'" title="Pre-launch clean-up: void in Xero, delete in Books and the CRM"><i class="ti ti-trash"></i>Delete</button>';
  h+='</span></div>';
  if(inv.locked) h+='<div class="alert ok"><i class="ti ti-lock"></i>This invoice is '+esc(inv.status)+' — the app will not change it. Corrections go through Books (credit note / adjustment).</div>';
  if(inv.notUpdatingReason) h+='<div class="alert warn"><i class="ti ti-alert-triangle"></i>Books did not take the last update: '+esc(inv.notUpdatingReason)+'</div>';
  h+=monthlyInvoiceControls(inv);
  // CRM vs Books
  var b=inv.books||{};
  var crmTotal=num(inv.total);
  var booksBox;
  if(b.ok){
    var diff=Math.abs(num(b.total)-crmTotal)>0.005;
    booksBox='<div class="cmp-box '+(diff?"bad":"good")+'"><div class="cb-l">Books '+esc(b.number||"")+'</div><div class="cb-v">'+esc(money(b.total))+'</div><div class="cb-s">'+esc(b.status||"")+' · balance '+esc(money(b.balance))+(diff?' · <b>does not match the CRM</b>':' · matches')+'</div></div>';
  } else {
    booksBox='<div class="cmp-box'+(inv.booksId?"":" bad")+'"><div class="cb-l">Books</div><div class="cb-v">—</div><div class="cb-s">'+esc(b.error||"Not read")+'</div></div>';
  }
  h+='<div class="cmp"><div class="cmp-box"><div class="cb-l">CRM invoice</div><div class="cb-v">'+esc(money(crmTotal))+'</div><div class="cb-s">'+
    (inv.invoiceDate?"Dated "+esc(fmtDate(inv.invoiceDate)):"")+(inv.dueDate?" · due "+esc(fmtDate(inv.dueDate)):"")+(num(inv.paid)?" · paid "+esc(money(inv.paid)):"")+'</div></div>'+booksBox+'</div>';
  if(so && linesKey(so.lines)!==linesKey(inv.lines)){
    h+='<div class="alert warn"><i class="ti ti-arrows-diff"></i>The invoice lines differ from the Sales Order.'+(inv.locked?"":" <b>Push to Books</b> re-copies the Sales Order lines onto the invoice and updates Books.")+'</div>';
  }
  if(!so) h+=linesTable(inv.lines||[], inv.subTotal, inv.taxTotal, inv.total);
  h+='<details class="more"><summary>Invoice lines'+(b.ok?" and the Books lines":"")+'</summary>';
  if(so) h+=linesTable(inv.lines||[], inv.subTotal, inv.taxTotal, inv.total);
  if(b.ok){
    h+='<table class="lines" style="margin-top:6px"><thead><tr><th>Books line</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>';
    (b.lines||[]).forEach(function(l){ h+='<tr><td>'+esc(l.name)+'</td><td class="num">'+esc(qtyTxt(l.qty))+'</td><td class="num">'+esc(money(l.rate))+'</td><td class="num">'+esc(money(l.total))+'</td></tr>'; });
    h+='</tbody></table>';
  }
  h+='<div class="hint">Last pushed to Books: '+esc(fmtDT(inv.itemsUpdatedAt)||fmtDT(inv.syncToBooksAt)||"—")+' · last update from Books: '+esc(fmtDT(inv.syncFromBooksAt)||"—")+'</div>';
  h+='</details></div>';
  return h;
}
function billingColumn(c){
  var h='';
  h+='<div class="alert info"><i class="ti ti-info-circle"></i><div>Change a Sales Order line and its invoice is rebuilt from it, and Books updates about 2 minutes later. '+
     'The CRM recalculates storage / KM lines on its own when a date, the KM or the condition changes — so make manual line corrections <b>after</b> the dates are right.</div></div>';
  var sos=(c.salesOrders||[]).slice();
  sos.sort(function(a,b){ var x=SO_ORDER.indexOf(a.type), y=SO_ORDER.indexOf(b.type); if(x<0) x=99; if(y<0) y=99; return x-y; });
  var invUsed={};
  if(!sos.length){
    var dd=c.deal;
    h+='<div class="alert warn"><i class="ti ti-alert-triangle"></i><div>No Sales Order on this case yet. '+
      (c.isDropoff || dd.Initial_Trip_Completed_At ? 'The pickup is done, so one was expected — the CRM creates it when the Deal reaches Stage <b>Trip Completed</b>. If the stage skipped that step, set the stage back to Trip Completed (Case → Edit) to let the CRM bill it.' : 'It is created when the initial trip is completed.')+'</div></div>';
  }
  sos.forEach(function(so){
    var payer=PAYER[so.type]||so.type||"Sales Order";
    h+='<div class="bill"><div class="bill-hdr"><i class="ti ti-receipt" style="color:var(--plum)"></i><span class="bh-title">'+esc(payer)+'</span><span class="bh-sub">Sales Order · '+esc(so.type)+' · '+esc(so.status||"")+'</span>';
    h+='<span class="bh-r"><button class="btn sm primary" data-act="edit-lines" data-target="so" data-id="'+esc(so.id)+'"><i class="ti ti-pencil"></i>Edit lines</button>';
    h+='<a class="btn sm ghost" href="'+esc(crmLink("SalesOrders",so.id))+'" target="_blank"><i class="ti ti-external-link"></i>CRM</a></span></div>';
    h+='<div class="bill-body">';
    if(so.parentAccount || so.account) h+='<div class="hint" style="margin:0 0 6px">Bill to: '+esc(so.parentAccount||so.account)+(so.parentAccount&&so.account?" · deceased account "+esc(so.account):"")+'</div>';
    h+=linesTable(so.lines||[], so.subTotal, so.taxTotal, so.total);
    var inv=null;
    (c.invoices||[]).forEach(function(i){ if(!inv && so.invoiceFor && i.for===so.invoiceFor){ inv=i; } });
    if(inv){ invUsed[inv.id]=1; h+=invoiceBlock(inv, so); }
    else if(so.invoiceFor) h+='<div class="inv"><div class="alert warn" style="margin:0"><i class="ti ti-file-off"></i>No '+esc(so.invoiceFor)+' invoice yet — the CRM creates it from this Sales Order when the case reaches invoicing (it will copy these lines).</div></div>';
    h+='</div></div>';
  });
  // invoices with no Sales Order of their own type on this deal
  var other=(c.invoices||[]).filter(function(i){ return !invUsed[i.id]; });
  var phOther=other.filter(function(i){ return PH_INVOICE_FOR.indexOf(i.for)>=0 || !i.for; });
  var nonPh=other.filter(function(i){ return !(PH_INVOICE_FOR.indexOf(i.for)>=0 || !i.for); });
  phOther.forEach(function(inv){
    var fam = inv.for==="Family";
    h+='<div class="bill"><div class="bill-hdr"><i class="ti '+(fam?"ti-users":"ti-file-invoice")+'" style="color:var(--plum)"></i><span class="bh-title">'+esc(fam?"Family (paid by the family)":(inv.for||"Invoice"))+'</span><span class="bh-sub">'+
      (fam?"Reviewed here, never on the monthly P/H invoice — payment status from Books below":"Invoice with no Sales Order of its own")+'</span></div><div class="bill-body">'+invoiceBlock(inv, null)+'</div></div>';
  });
  if(nonPh.length){
    h+='<div class="container"><details><summary style="cursor:pointer;font-size:11px;color:var(--plum)">Other invoices on this Deal (funeral / cremation etc.) — '+nonPh.length+'</summary>';
    nonPh.forEach(function(i){
      h+='<div class="frow"><span class="flbl">'+esc(i.subject||i.for)+'<br><span style="font-size:10px">'+esc(i.for)+' · '+esc(i.status)+'</span></span><span class="fval">'+esc(money(i.total))+' <a href="'+esc(crmLink("Invoices",i.id))+'" target="_blank">CRM</a></span></div>';
    });
    h+='</details></div>';
  }
  return h;
}

// ===== 7. MODALS =====
function openModal(o){
  state.modal=o;
  $("modalBox").className="modal"+(o.wide?" wide":"");
  $("modalTitle").textContent=o.title||"Edit";
  $("modalSub").textContent=o.sub||"";
  $("modalErr").style.display="none";
  $("modalFields").innerHTML=o.html||"";
  $("modalNote").innerHTML=o.note||"";
  $("modalSave").textContent=o.saveLabel||"Save";
  $("modalSave").disabled=false;
  $("modalBg").classList.add("open");
  if(o.onOpen) o.onOpen();
}
function closeModal(){ state.modal=null; $("modalBg").classList.remove("open"); }
function modalError(msg){ var e=$("modalErr"); e.textContent=msg; e.style.display="block"; $("modalSave").disabled=false; }
function saveModal(){
  var m=state.modal; if(!m || !m.save) return;
  $("modalSave").disabled=true; $("modalErr").style.display="none";
  m.save();
}

// ----- Deal field sections -----
function sectionFields(k, c){
  var pol=c.kind==="police";
  if(k==="case"){
    var f=[
      {api:"Stage", label:"Stage", type:"select", options:PL.stage, hint:"DFH Selected / DFH Not Selected start the family billing in the CRM."},
      {api:"Is_Deceased_In_Our_Care", label:"Is deceased in our care?", type:"select", options:PL.yesNo},
      {api:"Condition", label:"Condition", type:"select", options:PL.condition, hint:pol?"Decomposed bills the decomposition fee + decomposition storage rate (the CRM re-prices an existing Sales Order / invoice).":""}
    ];
    if(pol){
      f.push({api:"Registration_Number", label:"Registration #", type:"text"});
      f.push({api:"Case_Number", label:"Case number", type:"text"});
      f.push({api:"Police_Office_Name", label:"Police officer", type:"text"});
      f.push({api:"Police_Phone_Number", label:"Police phone", type:"text"});
    }
    return f;
  }
  if(k==="loni") return [
    {api:"Investigating_Officer_s_Interest", label:"Investigating officer's interest", type:"select", options:PL.officerInterest},
    {api:"Police_Interest", label:"Police interest?", type:"select", options:PL.yesNo},
    {api:"Letter_of_Interest_Date", label:"Letter of Interest date", type:"date"},
    {api:"Letter_of_No_Interest_Date", label:"Letter of No Interest date", type:"date", hint:"Sets the IFSL storage (max 2 days) and the MNSJ storage for the rest."},
    {api:"Receiving_Letter_of_No_Interest_Date", label:"Date the family received the LONI", type:"date", hint:"Later than the LONI date → the family is invoiced for the extra storage days."}
  ];
  if(k==="release") return [
    {api:"Hospital_Release_Date", label:"Hospital release date", type:"date", hint:"Recalculates the hospital storage days on the Sales Order."},
    {api:"Receiving_Release_Date", label:"Date the family received the release", type:"date", hint:"Later than the release date → the family is invoiced for the extra storage days."}
  ];
  if(k==="autopsy") return [
    {api:"Autopsy_Required", label:"Autopsy required?", type:"select", options:PL.yesNo, hint:"Yes adds the autopsy trip line (KM-based) to the police Sales Order."},
    {api:"Autopsy_Type", label:"Autopsy type", type:"select", options:PL.autopsyType},
    {api:"Autopsy_Locations", label:"Autopsy location", type:"lookup", source:"autopsyLocations", hint:"Locations with a fixed KM bill that KM instead of the driven KM."},
    {api:"Autopsy_Date_Time", label:"Autopsy date / time", type:"datetime", hint:"Creates / moves the autopsy trip (and its batch trip)."},
    {api:"Autopsy_Completed_Date_Time", label:"Autopsy completed", type:"datetime"},
    {api:"X_Ray_Required", label:"X-ray required", type:"bool"}
  ];
  return [];
}
var SECTION_TITLES={ "case":"Case", loni:"Letter of No Interest", release:"Hospital release", autopsy:"Autopsy & X-ray" };
function fieldValue(d, f){
  var v=d[f.api];
  if(f.type==="lookup") return lk(v).id;
  if(f.type==="date") return dPart(v);
  if(f.type==="datetime") return isoToLocal(v);
  if(f.type==="bool") return v==="true" ? "true" : "false";
  return str(v);
}
function fieldInput(f, val){
  var id='fld_'+f.api, h='<div class="mf">';
  if(f.type==="bool"){
    h+='<label class="chk"><input type="checkbox" id="'+id+'"'+(val==="true"?" checked":"")+'> '+esc(f.label)+'</label>';
  } else {
    h+='<label for="'+id+'">'+esc(f.label)+'</label>';
    if(f.type==="select"){
      var opts=f.options.slice(); if(val && opts.indexOf(val)<0) opts.unshift(val);
      h+='<select id="'+id+'"><option value="">—</option>'+opts.map(function(o){ return '<option'+(o===val?" selected":"")+'>'+esc(o)+'</option>'; }).join("")+'</select>';
    } else if(f.type==="lookup"){
      var locs=(state.picklists && state.picklists[f.source])||[], found=false;
      var oh=locs.map(function(o){ if(o.id===val) found=true; return '<option value="'+esc(o.id)+'"'+(o.id===val?" selected":"")+'>'+esc(o.name)+(o.fixedKm?" (fixed "+esc(o.fixedKm)+" km)":"")+'</option>'; }).join("");
      if(val && !found) oh='<option value="'+esc(val)+'" selected>'+esc(lk(state.c.deal[f.api]).name||val)+'</option>'+oh;
      h+='<select id="'+id+'"><option value="">—</option>'+oh+'</select>';
    } else if(f.type==="date"){
      h+='<input type="date" id="'+id+'" value="'+esc(val)+'">';
    } else if(f.type==="datetime"){
      h+='<input type="datetime-local" id="'+id+'" value="'+esc(val)+'">';
    } else {
      h+='<input type="text" id="'+id+'" value="'+esc(val)+'">';
    }
  }
  if(f.hint) h+='<div class="hint">'+esc(f.hint)+'</div>';
  return h+'</div>';
}
function readInput(f){
  var el=$('fld_'+f.api); if(!el) return null;
  if(f.type==="bool") return el.checked ? "true" : "false";
  if(f.type==="datetime") return localToIso(el.value);
  return str(el.value).trim();
}
function editSection(k){
  var c=state.c; if(!c) return;
  var go=function(){
    var fields=sectionFields(k,c), d=c.deal;
    var html=fields.map(function(f){ return fieldInput(f, fieldValue(d,f)); }).join("");
    openModal({
      title:"Edit — "+SECTION_TITLES[k], sub:(d.Name_of_Deceased||d.Deal_Name),
      html:html,
      note:"Saved to the CRM Deal with workflows on — the CRM billing rules run exactly as if typed in the CRM.",
      save:function(){
        var changed={}, n=0;
        fields.forEach(function(f){
          var nv=readInput(f), ov=fieldValue(d,f);
          if(f.type==="datetime") ov=localToIso(ov);
          if(nv!==null && nv!==ov){ changed[f.api]=nv; n++; }
        });
        if(!n){ closeModal(); return; }
        call("saveDeal",{ dealId:state.caseId, fieldsJson:JSON.stringify(changed) }).then(function(){
          closeModal(); afterChange("Saved — CRM rules are running; Refresh in a minute to see the billing update.");
        }).catch(function(e){ modalError(errMsg(e)); });
      }
    });
  };
  if(k==="autopsy") loadPicklists().then(go); else go();
}

// ----- KM -----
function editKm(tripId){
  var c=state.c, t=null; (c.trips||[]).forEach(function(x){ if(x.id===tripId) t=x; });
  if(!t) return;
  var fixedNote = t.fixedKm ? "<br>This autopsy location has a fixed "+esc(t.fixedKm)+" km — the CRM bills the fixed KM whatever is entered here." : "";
  openModal({
    title:"Trip KM", sub:t.name,
    html:'<div class="mf"><label for="kmIn">KM for this trip</label><input type="number" min="0" step="0.1" id="kmIn" value="'+esc(str(t.km))+'"><div class="hint">Use this when Amber left the KM blank or wrong.'+fixedNote+'</div></div>',
    note:"Saved on the Trip with workflows on — the CRM re-prices the trip line on the Sales Order.",
    onOpen:function(){ setTimeout(function(){ $("kmIn").focus(); },50); },
    save:function(){
      var v=str($("kmIn").value).trim();
      if(v==="" || isNaN(parseFloat(v)) || parseFloat(v)<0){ modalError("Enter the KM as a number (0 or more)."); return; }
      call("saveKm",{ dealId:state.caseId, tripId:tripId, km:v }).then(function(){
        closeModal(); afterChange("KM saved — the Sales Order updates in a moment; Refresh to see it.");
      }).catch(function(e){ modalError(errMsg(e)); });
    }
  });
}

// ----- autopsy outcome -----
function editOutcome(opsId){
  var c=state.c, o=null; (c.operations||[]).forEach(function(x){ if(x.id===opsId) o=x; });
  if(!o) return;
  var oc=o.outcome||"", rs=o.reason||"";
  var html='<div class="mf"><label for="ocIn">Outcome at the autopsy</label><select id="ocIn"><option value="">—</option>'+PL.outcome.map(function(x){ return '<option'+(x===oc?" selected":"")+'>'+esc(x)+'</option>'; }).join("")+'</select></div>'+
    '<div class="mf" id="rsWrap"><label for="rsIn">Reschedule reason</label><select id="rsIn"><option value="">—</option>'+PL.reason.map(function(x){ return '<option'+(x===rs?" selected":"")+'>'+esc(x)+'</option>'; }).join("")+'</select>'+
    '<div class="hint">Family did not show → family pays the reschedule trip · Officer did not show → MNSJ pays · X-ray required → X-ray trip, billed to IFSL · Problem caused by DFH → not billed.</div></div>';
  openModal({
    title:"Autopsy outcome", sub:o.name,
    html:html,
    note:'<b style="color:var(--amber)">A reschedule creates the new trip and bills it</b> — the same as when the driver records it in the Driver App.',
    onOpen:function(){
      var sync=function(){ $("rsWrap").style.display = $("ocIn").value==="Reschedule" ? "" : "none"; };
      $("ocIn").addEventListener("change",sync); sync();
    },
    save:function(){
      var nOc=$("ocIn").value, nRs=nOc==="Reschedule" ? $("rsIn").value : "";
      if(nOc==="Reschedule" && !nRs){ modalError("Pick the reschedule reason."); return; }
      if(nOc===oc && nRs===rs){ closeModal(); return; }
      call("outcome",{ dealId:state.caseId, opsId:opsId, outcome:nOc, reason:nRs }).then(function(){
        closeModal(); afterChange("Outcome saved — the CRM is creating / billing the trip; Refresh in a minute.");
      }).catch(function(e){ modalError(errMsg(e)); });
    }
  });
}

// ----- line editor -----
function cacheProduct(p){
  if(!p || !p.id) return;
  state.productCache[str(p.id)]={ id:str(p.id), name:str(p.Product_Name||p.name), code:str(p.Product_Code||p.code), category:str(p.Product_Category||p.category), unitPrice:str(p.Unit_Price!=null?p.Unit_Price:p.unitPrice) };
}
function productOptions(selId){
  var list=Object.keys(state.productCache).map(function(k){ return state.productCache[k]; });
  list.sort(function(a,b){ var x=(a.category||"zz")+a.name, y=(b.category||"zz")+b.name; return x.localeCompare(y); });
  var groups={}, order=[];
  list.forEach(function(p){ var g=p.category||"Other"; if(!groups[g]){ groups[g]=[]; order.push(g); } groups[g].push(p); });
  var h='<option value="">— pick a product —</option>';
  order.forEach(function(g){
    h+='<optgroup label="'+esc(g)+'">';
    groups[g].forEach(function(p){ h+='<option value="'+esc(p.id)+'"'+(p.id===selId?" selected":"")+'>'+esc(p.name)+(p.unitPrice!==""?" — "+esc(money(p.unitPrice)):"")+'</option>'; });
    h+='</optgroup>';
  });
  return h;
}
function edRowHtml(r, i){
  return '<tr data-i="'+i+'"><td><select data-ed="product" data-i="'+i+'">'+productOptions(r.productId)+'</select></td>'+
    '<td class="n"><input type="number" min="0" step="0.01" data-ed="qty" data-i="'+i+'" value="'+esc(r.qty)+'"></td>'+
    '<td class="n"><input type="number" min="0" step="0.01" data-ed="price" data-i="'+i+'" value="'+esc(r.price)+'"></td>'+
    '<td class="n"><input type="number" min="0" step="0.01" data-ed="discount" data-i="'+i+'" value="'+esc(r.discount)+'"></td>'+
    '<td class="amt" id="edAmt'+i+'">'+esc(money(num(r.qty)*num(r.price)-num(r.discount)))+'</td>'+
    '<td class="x"><button class="x-btn" data-act="ed-remove" data-i="'+i+'" title="Remove line"><i class="ti ti-x"></i></button></td></tr>';
}
function renderEditor(){
  var m=state.modal; if(!m || !m.rows) return;
  var h='<table class="ed"><thead><tr><th>Product billed</th><th>Qty</th><th>Price</th><th>Discount</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody>';
  m.rows.forEach(function(r,i){ h+=edRowHtml(r,i); });
  h+='</tbody></table>';
  h+='<div class="ed-foot"><button class="btn sm" data-act="ed-add"><i class="ti ti-plus"></i>Add line</button><span class="ed-total" id="edTotal"></span></div>';
  h+='<div class="psearch"><div class="psearch-row"><input id="pSearch" placeholder="Find any other product by name or code…"><button class="btn sm" data-act="ed-search"><i class="ti ti-search"></i>Search</button></div><div class="presults" id="pResults"></div></div>';
  $("modalFields").innerHTML=h;
  updateEdTotal();
}
function updateEdTotal(){
  var m=state.modal; if(!m || !m.rows) return;
  var t=0; m.rows.forEach(function(r,i){ var a=num(r.qty)*num(r.price)-num(r.discount); t+=a; var el=$("edAmt"+i); if(el) el.textContent=money(a); });
  var el2=$("edTotal"); if(el2) el2.innerHTML='Before tax: <b>'+esc(money(t))+'</b>';
}
function editLines(target, recId){
  var c=state.c, rec=null;
  var src = target==="so" ? (c.salesOrders||[]) : (c.invoices||[]);
  src.forEach(function(x){ if(x.id===recId) rec=x; });
  if(!rec) return;
  (rec.lines||[]).forEach(function(l){ cacheProduct({id:l.productId, name:l.productName, code:l.code, category:l.category, unitPrice:l.unitPrice}); });
  var rows=(rec.lines||[]).map(function(l){ return { id:l.id, productId:l.productId, qty:qtyTxt(l.qty), price:num(l.price).toFixed(2), discount:num(l.discount)?num(l.discount).toFixed(2):"0", description:l.description||"" }; });
  var title = target==="so" ? ("Sales Order — "+(PAYER[rec.type]||rec.type)) : ("Invoice — "+(rec.for||rec.subject));
  var invNote="";
  if(target==="so"){
    var inv=null; (c.invoices||[]).forEach(function(i){ if(!inv && rec.invoiceFor && i.for===rec.invoiceFor) inv=i; });
    invNote = inv ? (inv.locked ? ' The '+esc(inv.for)+' invoice is <b>'+esc(inv.status)+'</b>, so it will NOT be changed.' : ' The '+esc(inv.for)+' invoice is rebuilt from these lines and Books updates ~2 min later.') : ' There is no invoice for it yet.';
  } else {
    invNote=' Books updates ~2 min later.';
  }
  openModal({
    title:title, sub:rec.subject||"", wide:true, rows:rows,
    note:'Product, quantity and price are all editable.'+invNote,
    saveLabel:"Save lines",
    onOpen:function(){ renderEditor(); },
    save:function(){
      var m=state.modal, bad="";
      if(!m.rows.length) bad="Keep at least one line (a Sales Order / Invoice can't be empty).";
      m.rows.forEach(function(r){ if(!r.productId) bad="Every line needs a product."; if(num(r.qty)<0||num(r.price)<0||num(r.discount)<0) bad="Quantity, price and discount can't be negative."; });
      if(bad){ modalError(bad); return; }
      var payload=m.rows.map(function(r){ var p=state.productCache[r.productId]||{}; return { id:r.id||"", productId:r.productId, productName:p.name||"", qty:str(r.qty||"0"), price:str(r.price||"0"), discount:str(r.discount||"0"), description:r.description||"" }; });
      // the invoice these lines end up on (the SO's own invoice, or the invoice itself)
      var affectedInv = target==="invoice" ? recId : (inv ? inv.id : "");
      call("lines",{ dealId:state.caseId, target:target, recordId:recId, linesJson:JSON.stringify(payload) }).then(function(r){
        closeModal();
        var msgs=((r&&r.messages)||["Saved"]).slice();
        // round 2 -- keep the monthly invoice in step: if this invoice is on one that is
        // already in Books, its line for this case is rebuilt from the new CRM total
        rebuildMonthlyFor(affectedInv).then(function(m){ if(m) msgs.push(m); afterChange(msgs.join("\n")); });
      }).catch(function(e){ modalError(errMsg(e)); });
    }
  });
}
function edInput(el){
  var m=state.modal; if(!m || !m.rows) return;
  var i=parseInt(el.getAttribute("data-i"),10), k=el.getAttribute("data-ed"), r=m.rows[i]; if(!r) return;
  if(k==="product"){
    r.productId=el.value;
    var p=state.productCache[el.value];
    if(p && p.unitPrice!==""){ r.price=num(p.unitPrice).toFixed(2); var pin=document.querySelector('input[data-ed="price"][data-i="'+i+'"]'); if(pin) pin.value=r.price; }
  } else {
    r[k]=el.value;
  }
  updateEdTotal();
}
function edSearch(){
  var q=str($("pSearch") && $("pSearch").value).trim();
  if(q.length<2){ $("pResults").innerHTML='<div class="hint">Type at least 2 letters.</div>'; return; }
  $("pResults").innerHTML='<div class="loading" style="padding:10px"><i class="ti ti-loader-2"></i>Searching…</div>';
  call("search",{ q:q }).then(function(r){
    var list=(r&&r.products)||[];
    if(r && r.message) toast(r.message,"err");   // a refused search must not look like "no match"
    if(!list.length){ $("pResults").innerHTML='<div class="hint">'+(r&&r.message?esc(r.message):'No active product matches "'+esc(q)+'".')+'</div>'; return; }
    list.forEach(cacheProduct);
    $("pResults").innerHTML=list.map(function(p){
      return '<div class="pres"><div class="pr-name">'+esc(p.Product_Name)+'<div class="pr-sub">'+esc([p.Product_Category,p.Product_Code].filter(Boolean).join(" · "))+'</div></div><span>'+esc(money(p.Unit_Price))+'</span>'+
        '<button class="btn sm" data-act="ed-add-product" data-pid="'+esc(p.id)+'"><i class="ti ti-plus"></i>Add as line</button></div>';
    }).join("");
  }).catch(function(e){ $("pResults").innerHTML='<div class="alert err">'+esc(errMsg(e))+'</div>'; });
}
function edAdd(pid){
  var m=state.modal; if(!m || !m.rows) return;
  // keep what was typed in the search box / results while re-rendering the table
  var qv=$("pSearch")?$("pSearch").value:"", resHtml=$("pResults")?$("pResults").innerHTML:"";
  var p=pid ? state.productCache[pid] : null;
  m.rows.push({ id:"", productId:pid||"", qty:"1", price:p&&p.unitPrice!==""?num(p.unitPrice).toFixed(2):"0.00", discount:"0", description:"" });
  renderEditor();
  if($("pSearch")) $("pSearch").value=qv;
  if($("pResults")) $("pResults").innerHTML=resHtml;
}
function edRemove(i){
  var m=state.modal; if(!m || !m.rows) return;
  var qv=$("pSearch")?$("pSearch").value:"", resHtml=$("pResults")?$("pResults").innerHTML:"";
  m.rows.splice(i,1); renderEditor();
  if($("pSearch")) $("pSearch").value=qv;
  if($("pResults")) $("pResults").innerHTML=resHtml;
}

// ----- push to Books -----
function resync(invId){
  var c=state.c, inv=null; (c.invoices||[]).forEach(function(i){ if(i.id===invId) inv=i; });
  openModal({
    title:"Push to Books", sub:inv?inv.subject:"",
    html:'<div class="hint" style="font-size:12px;color:var(--mid)">If this invoice has a Sales Order of its own type, its lines are first re-copied from that Sales Order. Then Books is updated (about 2 minutes later), and from Books it goes on to Xero.</div>',
    saveLabel:"Push",
    save:function(){
      call("resync",{ dealId:state.caseId, invoiceId:invId }).then(function(r){
        closeModal(); afterChange((r&&r.message)||"Books updates in about 2 minutes");
      }).catch(function(e){ modalError(errMsg(e)); });
    }
  });
}

// ----- billing closed -----
function setClosed(closed){
  var c=state.c;
  openModal({
    title: closed ? "Close billing" : "Reopen billing", sub:(c.deal.Name_of_Deceased||c.deal.Deal_Name),
    html: closed
      ? '<div class="hint" style="font-size:12px;color:var(--mid);margin-bottom:10px">Tick this when every invoice for this case is correct. The case leaves the open lists (it stays under <b>Billing closed</b> and can be reopened).</div><div class="mf"><label for="closeNote">Closing note (optional)</label><textarea id="closeNote">'+esc((c.billing&&c.billing.notes)||"")+'</textarea></div>'
      : '<div class="mf"><label for="closeNote">Why is it being reopened?</label><textarea id="closeNote"></textarea></div>',
    saveLabel: closed ? "Close billing" : "Reopen",
    save:function(){
      var note=str($("closeNote").value).trim();
      call("closed",{ dealId:state.caseId, closed:closed?"true":"false", notes:note }).then(function(){
        closeModal();
        var row=listRow(); if(row) row.closed=closed;
        updateBadges();
        afterChange(closed ? "Billing closed" : "Billing reopened");
      }).catch(function(e){ modalError(errMsg(e)); });
    }
  });
}
function addNote(){
  var v=str($("noteIn") && $("noteIn").value).trim();
  if(!v){ toast("Type the note first","err"); return; }
  call("note",{ dealId:state.caseId, note:v }).then(function(){ afterChange("Note added"); }).catch(function(e){ toast(errMsg(e),"err"); });
}

// ===== 7b. ROUND 2 (Andrea 2026-10-08 / 09) =====
// Monthly parent/child invoicing, cover sheets, billing codes, feedback + export,
// pre-launch delete. Monthly model agreed with Andrea: ONE monthly invoice per
// institution in Books (one line per case) is sent and paid; the case invoices stay
// linked to it (cf_master_invoice_id) and show as paid in the app when it is paid.

function curMonth(){ var j=jamNow(); return j.getUTCFullYear()+"-"+pad2(j.getUTCMonth()+1); }
function monthName(ym){ ym=str(ym); if(!/^\d{4}-\d{2}$/.test(ym)) return ym; return MONTHS_L[parseInt(ym.substring(5),10)-1]+" "+ym.substring(0,4); }
function list(o,k){ return (o && o[k]) || []; }
// Creator record ids are 19 digits: as JSON numbers they lose their last digits, so use the
// text copy (idsText) when the server sends it.
function idList(o){ var t=o && o.idsText; if(typeof t==="string") return t===""?[]:t.split(",").map(function(s){ return s.trim(); }); return list(o,"ids"); }
function download(name, text, mime){
  try{
    var blob=new Blob([text],{type:mime||"text/plain"}), a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },500);
  }catch(e){ toast("Download failed: "+errMsg(e),"err"); }
}

// ----- monthly data -----
function parseMonthly(r){
  var b=r.batches||{}, it=r.items||{}, om=r.orgMap||{};
  var out={ batches:[], items:[], orgMap:{}, byInvoice:{}, byBatch:{}, batchById:{} };
  idList(b).forEach(function(id,i){
    var x={ id:str(id), orgId:str(list(b,"orgIds")[i]), orgName:str(list(b,"orgNames")[i]), payer:str(list(b,"payerTypes")[i]), month:str(list(b,"months")[i]),
      customerId:str(list(b,"customerIds")[i]), customerName:str(list(b,"customerNames")[i]), masterId:str(list(b,"masterIds")[i]),
      masterNumber:str(list(b,"masterNumbers")[i]), status:str(list(b,"statuses")[i])||"Open", sentAt:str(list(b,"sentAt")[i]), sentBy:str(list(b,"sentBy")[i]), total:str(list(b,"totals")[i]) };
    out.batches.push(x); out.batchById[x.id]=x; out.byBatch[x.id]=[];
  });
  idList(it).forEach(function(id,i){
    var x={ id:str(id), batchId:str(list(it,"batchRefs")[i]), dealId:str(list(it,"dealIds")[i]), name:str(list(it,"names")[i]), crmInvoiceId:str(list(it,"crmInvoiceIds")[i]),
      booksInvoiceId:str(list(it,"booksInvoiceIds")[i]), number:str(list(it,"numbers")[i]), amount:str(list(it,"amounts")[i]) };
    out.items.push(x); out.byInvoice[x.crmInvoiceId]=x; (out.byBatch[x.batchId]=out.byBatch[x.batchId]||[]).push(x);
  });
  list(om,"orgIds").forEach(function(id,i){ out.orgMap[str(id)]={ customerId:str(list(om,"customerIds")[i]), customerName:str(list(om,"customerNames")[i]) }; });
  return out;
}
function loadMonthly(){
  return call("mList").then(function(r){
    state.monthly=parseMonthly(r||{});
    var open=state.monthly.batches.filter(function(b){ return b.status!=="Sent"; }).length;
    if($("bMonthly")) $("bMonthly").textContent=open;
    return state.monthly;
  }).catch(function(e){ toast("Monthly invoices could not be loaded: "+errMsg(e),"err"); if(!state.monthly) state.monthly=parseMonthly({}); return state.monthly; });
}
function monthlyItemFor(invId){ return state.monthly ? state.monthly.byInvoice[str(invId)] : null; }
function loadBatchStatus(batchId){
  return call("mStatus",{ batchId:batchId }).then(function(r){ state.batchStatus[batchId]=r||{}; return r; }).catch(function(e){ state.batchStatus[batchId]={ error:errMsg(e) }; });
}
// on a case: the Books status of each monthly invoice its invoices are on
function loadCaseMonthlyStatus(c){
  var id=state.caseId;
  var go=function(){
    var ids={};
    (c.invoices||[]).forEach(function(inv){ var it=monthlyItemFor(inv.id); if(it){ var b=state.monthly.batchById[it.batchId]; if(b && b.masterId) ids[b.id]=1; } });
    var keys=Object.keys(ids);
    if(!keys.length){ if(state.caseId===id) renderCase(); return; }
    Promise.all(keys.map(loadBatchStatus)).then(function(){ if(state.caseId===id) renderCase(); });
  };
  if(state.monthly) go(); else loadMonthly().then(go);
  if(!state.feedback) loadFeedback().then(function(){ if(state.caseId===id) renderCase(); });
}
function batchPaid(b){ var s=state.batchStatus[b.id]; return s && s.booksStatus==="paid"; }
function batchBadge(b){
  var s=state.batchStatus[b.id];
  if(s && s.booksStatus==="paid") return '<span class="badge b-green"><i class="ti ti-check"></i>Paid</span>';
  if(s && s.booksStatus==="partially_paid") return '<span class="badge b-warn">Partly paid</span>';
  if(b.status==="Sent") return '<span class="badge b-status">Sent'+(b.masterNumber?" · "+esc(b.masterNumber):"")+'</span>';
  if(b.masterId) return '<span class="badge b-slate">In Books · '+esc(b.masterNumber)+' · not sent</span>';
  return '<span class="badge b-warn">Open</span>';
}
// case screen: where this P/H invoice stands on the monthly billing
function monthlyInvoiceControls(inv){
  if(MONTHLY_FOR.indexOf(inv.for)<0 || !state.monthly) return "";
  var it=monthlyItemFor(inv.id);
  if(it){
    var b=state.monthly.batchById[it.batchId]||{};
    var h='';
    if(batchPaid(b)){
      h+='<div class="alert ok"><i class="ti ti-circle-check"></i><div><b>Paid</b> — through the '+esc(monthName(b.month))+' monthly invoice '+esc(b.masterNumber)+' for '+esc(b.orgName)+'.</div></div>';
    } else {
      h+='<div class="alert info"><i class="ti ti-calendar-dollar"></i><div>On the <b>'+esc(monthName(b.month))+'</b> monthly invoice for <b>'+esc(b.orgName)+'</b> '+batchBadge(b)+
        ' <button class="btn sm" data-act="open-batch" data-batch="'+esc(b.id)+'"><i class="ti ti-external-link"></i>Open monthly invoice</button></div></div>';
    }
    if(b.masterId && Math.abs(num(it.amount)-num(inv.total))>0.005 && !batchPaid(b)){
      h+='<div class="alert warn"><i class="ti ti-arrows-diff"></i><div>The monthly invoice still carries '+esc(money(it.amount))+' for this case; the invoice is now '+esc(money(inv.total))+'. '+
        '<button class="btn sm" data-act="m-build" data-batch="'+esc(b.id)+'" data-send="false"><i class="ti ti-refresh"></i>Update monthly invoice</button></div></div>';
    }
    return h;
  }
  if(inv.locked) return "";
  return '<div class="alert info"><i class="ti ti-calendar-plus"></i><div>Not on a monthly invoice yet'+(inv.parentAccount?" (bills to "+esc(inv.parentAccount)+")":"")+'. Once this case\'s billing is right: '+
    '<button class="btn sm primary" data-act="m-add" data-inv="'+esc(inv.id)+'"><i class="ti ti-plus"></i>Add to monthly invoice</button></div></div>';
}
function addToMonthly(invId){
  var c=state.c, inv=null; (c.invoices||[]).forEach(function(i){ if(i.id===invId) inv=i; });
  openModal({
    title:"Add to monthly invoice", sub:inv?inv.subject:"",
    html:'<div class="mf"><label for="mMonth">Month</label><input type="month" id="mMonth" value="'+esc(state.billMonth||curMonth())+'"></div>'+
      '<div class="hint">It goes on the monthly invoice of '+esc((inv&&inv.parentAccount)||"its institution")+' for that month (created the first time). Only an invoice still in <b>Draft</b> in Books can be added — otherwise the balance would be counted twice.</div>',
    saveLabel:"Add",
    save:function(){
      var m=str($("mMonth").value);
      if(!/^\d{4}-\d{2}$/.test(m)){ modalError("Pick the month"); return; }
      call("mAdd",{ dealId:state.caseId, invoiceId:invId, billMonth:m }).then(function(){
        closeModal(); state.billMonth=m;
        loadMonthly().then(function(){ afterChange("Added to the "+monthName(m)+" monthly invoice"); });
      }).catch(function(e){ modalError(errMsg(e)); });
    }
  });
}
// after a line change: rebuild the monthly invoice line of that case (only when it is in Books)
function rebuildMonthlyFor(invId){
  return new Promise(function(resolve){
    var it=invId ? monthlyItemFor(invId) : null;
    var b=it && state.monthly.batchById[it.batchId];
    if(!b || !b.masterId){ resolve(""); return; }
    call("mBuild",{ batchId:b.id, send:"false" }).then(function(r){
      loadMonthly().then(function(){ loadBatchStatus(b.id); resolve((r&&r.message)||"Monthly invoice updated"); });
    }).catch(function(e){ resolve("Monthly invoice NOT updated: "+errMsg(e)); });
  });
}

// ----- R2 views dispatcher -----
function renderR2View(){
  if(state.view==="monthly"){ if(state.cover) renderCover(); else if(state.batchId) renderBatch(); else renderMonthly(); }
  else if(state.view==="codes") renderCodes();
  else if(state.view==="feedback") renderFeedback();
}
function r2Loading(title, msg){
  $("viewHeader").innerHTML='<div class="vh-row"><div class="view-title">'+esc(title)+'</div></div>';
  $("contentArea").innerHTML='<div class="list-pane"><div class="loading"><i class="ti ti-loader-2"></i>'+esc(msg)+'</div></div>';
}

// ----- Monthly invoices screen -----
function renderMonthly(){
  if(!state.billMonth) state.billMonth=curMonth();
  if(!state.monthly){ r2Loading("Monthly invoices","Loading monthly invoices…"); loadMonthly().then(renderList); return; }
  var m=state.billMonth;
  var batches=state.monthly.batches.filter(function(b){ return b.month===m; });
  $("viewHeader").innerHTML='<div class="vh-row"><div class="view-title">Monthly invoices</div><div class="view-sub">'+esc(monthName(m))+' · '+plural(batches.length,"institution")+'</div>'+
    '<div class="vh-actions"><span class="flabel">Month</span><input type="month" class="filter-date" id="billMonth" value="'+esc(m)+'"><button class="btn" data-act="m-refresh"><i class="ti ti-refresh"></i>Refresh</button></div></div>'+
    '<div class="view-sub">One monthly invoice per institution: check each case, add it here, then send the monthly invoice. Payment is applied to the monthly invoice in Books. Family invoices are never on it.</div>';
  var h='<div class="list-pane">';
  h+='<div class="day-group"><div class="day-label">Monthly invoices for '+esc(monthName(m))+'</div>';
  if(!batches.length) h+='<div class="list-empty" style="padding:14px">None yet — add cases below (or from a case\'s Billing column).</div>';
  else {
    h+='<div class="card-grid">';
    batches.sort(function(a,b){ return (a.payer+a.orgName).localeCompare(b.payer+b.orgName); });
    batches.forEach(function(b){
      var items=state.monthly.byBatch[b.id]||[], tot=0; items.forEach(function(i){ tot+=num(i.amount); });
      h+='<div class="tc" data-act="open-batch" data-batch="'+esc(b.id)+'"><div class="card-top"><span class="sdot" style="background:'+(b.status==="Sent"?"var(--blue)":"var(--amber)")+'"></span><span class="card-name">'+esc(b.orgName||"—")+'</span><span class="card-amt">'+esc(money(tot))+'</span></div>'+
        '<div class="card-line"><i class="ti ti-receipt"></i>'+esc(b.payer)+' · '+plural(items.length,"case")+'</div>'+
        '<div class="card-line"><i class="ti ti-user-dollar"></i>'+(b.customerName?esc("Books: "+b.customerName):'<span style="color:var(--amber)">Books customer not chosen</span>')+'</div>'+
        '<div class="card-bot">'+batchBadge(b)+'</div></div>';
    });
    h+='</div>';
  }
  h+='</div>';
  // ready to add: P/H invoices of open cases that are not on any monthly invoice
  var groups={}, order=[];
  state.cases.forEach(function(c){
    if(c.closed) return;
    (c.invoices||[]).forEach(function(inv){
      if(MONTHLY_FOR.indexOf(inv.for)<0) return;
      if(["Void","Cancelled","Paid","Partially Paid"].indexOf(inv.status)>=0) return;
      if(monthlyItemFor(inv.id)) return;
      var k=(inv.orgName||"No institution set")+" · "+inv.for;
      if(!groups[k]){ groups[k]=[]; order.push(k); }
      groups[k].push({ c:c, inv:inv });
    });
  });
  order.sort();
  h+='<div class="day-group"><div class="day-label">Not on a monthly invoice yet · '+order.reduce(function(n,k){ return n+groups[k].length; },0)+'</div>';
  if(!state.cases.length) h+='<div class="list-empty" style="padding:14px">Open a case list first (Police / Hospital) to see the cases ready to add.</div>';
  else if(!order.length) h+='<div class="list-empty" style="padding:14px">Every open Police / MNSJ / Hospital invoice is on a monthly invoice.</div>';
  order.forEach(function(k){
    h+='<div class="container"><div class="con-title"><i class="ti ti-building"></i>'+esc(k)+'</div>';
    groups[k].forEach(function(x){
      h+='<div class="frow"><span class="flbl"><a href="#" data-act="open-case" data-id="'+esc(x.c.id)+'" style="color:var(--plum);font-weight:500">'+esc(x.c.name)+'</a> <span style="font-size:10px">'+esc(x.inv.subject)+'</span>'+
        (x.inv.inBooks?'':' <span class="badge b-warn">not in Books</span>')+((x.c.warnings||[]).length?' <span class="badge b-warn">'+esc(x.c.warnings[0])+'</span>':'')+'</span>'+
        '<span class="fval">'+esc(money(x.inv.total))+' <button class="btn sm" data-act="m-add-quick" data-deal="'+esc(x.c.id)+'" data-inv="'+esc(x.inv.id)+'"><i class="ti ti-plus"></i>Add to '+esc(MONTHS[parseInt(m.substring(5),10)-1])+'</button></span></div>';
    });
    h+='</div>';
  });
  h+='</div></div>';
  $("contentArea").innerHTML=h;
}
function addQuick(dealId, invId){
  call("mAdd",{ dealId:dealId, invoiceId:invId, billMonth:state.billMonth }).then(function(){
    toast("Added to "+monthName(state.billMonth),"ok"); loadMonthly().then(renderList);
  }).catch(function(e){ toast(errMsg(e),"err"); });
}

// ----- one monthly invoice -----
function openBatch(id){
  state.view="monthly"; state.batchId=id; state.cover=null; state.caseId=""; state.c=null;
  var items=document.querySelectorAll(".nav-item");
  for(var i=0;i<items.length;i++){ items[i].classList.toggle("active", items[i].getAttribute("data-view")==="monthly"); }
  $("viewHeader").style.display="";
  renderList();
  loadBatchStatus(id).then(function(){ if(state.batchId===id && !state.cover) renderList(); });
}
function caseInvoiceTotal(invId){
  for(var i=0;i<state.cases.length;i++){ var inv=(state.cases[i].invoices||[]).filter(function(x){ return x.id===invId; })[0]; if(inv) return inv.total; }
  return null;
}
function renderBatch(){
  var b=state.monthly && state.monthly.batchById[state.batchId];
  if(!b){ state.batchId=""; renderMonthly(); return; }
  var items=state.monthly.byBatch[b.id]||[], s=state.batchStatus[b.id]||{};
  $("viewHeader").innerHTML='<div class="vh-row"><button class="btn" data-act="m-back"><i class="ti ti-arrow-left"></i>Monthly invoices</button><div class="view-title">'+esc(b.orgName)+'</div>'+
    '<div class="view-sub">'+esc(b.payer)+' · '+esc(monthName(b.month))+'</div>'+batchBadge(b)+'<div class="vh-actions"><button class="btn" data-act="open-batch" data-batch="'+esc(b.id)+'"><i class="ti ti-refresh"></i>Refresh</button></div></div>';
  var sent=b.status==="Sent", paid=batchPaid(b), sum=0, mism=0;
  var h='<div class="list-pane"><div class="case-grid"><div class="col">';
  // Books customer
  h+='<div class="container">'+'<div class="con-title"><i class="ti ti-user-dollar"></i>Bill to (Books customer)'+(sent?'':'<span class="ct-r"><button class="btn sm ghost" data-act="m-customer" data-batch="'+esc(b.id)+'"><i class="ti ti-pencil"></i>Choose</button></span>')+'</div>';
  h+=b.customerName ? fr("Books customer", b.customerName) : '<div class="alert warn"><i class="ti ti-alert-triangle"></i>Choose the Books customer this institution is billed as (asked once per institution).</div>';
  h+=fr("Institution (CRM)", b.orgName);
  h+='</div>';
  // Books status
  h+='<div class="container"><div class="con-title"><i class="ti ti-file-invoice"></i>Monthly invoice in Books</div>';
  if(!b.masterId) h+='<div class="hint">Not created in Books yet.</div>';
  else if(s.error) h+='<div class="alert err"><i class="ti ti-alert-circle"></i>'+esc(s.error)+'</div>';
  else if(!s.inBooks) h+='<div class="loading" style="padding:8px"><i class="ti ti-loader-2"></i>Reading Books…</div>';
  else {
    h+=fr("Number", s.number)+fr("Books status", s.booksStatus)+fr("Total", money(s.total))+fr("Paid", money(s.paid))+fr("Balance", money(s.balance))+fr("Date", fmtDate(s.date));
    if((s.payments||[]).length){
      h+='<div class="hint" style="margin-top:8px"><b>Payments</b></div>';
      s.payments.forEach(function(p){ h+=fr(fmtDate(p.date)+" · "+str(p.payment_mode||""), money(p.amount)); });
    }
    h+='<a class="btn sm ghost" style="margin-top:6px" href="'+esc(BOOKS+b.masterId)+'" target="_blank"><i class="ti ti-external-link"></i>Open in Books</a>';
  }
  if(paid) h+='<div class="alert ok" style="margin-top:8px"><i class="ti ti-circle-check"></i>Paid — every case below shows as paid in the app.</div>';
  h+='</div>';
  // actions
  h+='<div class="container"><div class="con-title"><i class="ti ti-player-play"></i>Actions</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
  if(!paid){
    h+='<button class="btn primary" data-act="m-build" data-batch="'+esc(b.id)+'" data-send="false"><i class="ti ti-cloud-upload"></i>'+(b.masterId?"Update monthly invoice in Books":"Create monthly invoice in Books")+'</button>';
    if(!sent) h+='<button class="btn green" data-act="m-send" data-batch="'+esc(b.id)+'"><i class="ti ti-send"></i>Mark as sent</button>';
  }
  h+='<button class="btn" data-act="m-cover" data-batch="'+esc(b.id)+'"><i class="ti ti-printer"></i>Cover sheet</button>';
  if(!paid) h+='<button class="btn ghost" style="color:var(--red)" data-act="m-delete" data-batch="'+esc(b.id)+'"><i class="ti ti-trash"></i>Delete (pre-launch clean-up)</button>';
  h+='</div><div class="hint">The monthly invoice has one line per case at the case invoice\'s current CRM total. "Mark as sent" marks it Sent in Books; from Books it goes to Xero like other invoices. After that no case can be added or taken off.</div></div>';
  h+='</div><div class="col">';
  // cases
  h+='<div class="bill"><div class="bill-hdr"><i class="ti ti-list-details" style="color:var(--plum)"></i><span class="bh-title">Cases on this monthly invoice</span><span class="bh-sub">'+plural(items.length,"case")+'</span></div><div class="bill-body">';
  h+='<table class="lines"><thead><tr><th>Case</th><th>Case invoice</th><th class="num">On monthly</th><th class="num">CRM now</th><th></th></tr></thead><tbody>';
  if(!items.length) h+='<tr><td colspan="5" style="color:var(--taupe)">No cases — add them from the Monthly invoices screen or a case.</td></tr>';
  items.forEach(function(it){
    var now=caseInvoiceTotal(it.crmInvoiceId), diff=now!==null && Math.abs(num(now)-num(it.amount))>0.005;
    if(diff) mism++;
    sum+=num(it.amount);
    h+='<tr><td><a href="#" data-act="open-case" data-id="'+esc(it.dealId)+'" style="color:var(--plum);font-weight:500">'+esc(it.name)+'</a>'+(paid?' <span class="badge b-green">Paid</span>':'')+'</td><td>'+esc(it.number)+'</td>'+
      '<td class="num">'+esc(money(it.amount))+'</td><td class="num">'+(now===null?'—':esc(money(now)))+(diff?' <span class="badge b-warn">changed</span>':'')+'</td>'+
      '<td class="num">'+(sent?'':'<button class="btn sm ghost" style="color:var(--red)" data-act="m-remove" data-item="'+esc(it.id)+'" title="Take this case off"><i class="ti ti-x"></i></button>')+'</td></tr>';
  });
  h+='<tr class="tot"><td colspan="2" class="num">Total</td><td class="num">'+esc(money(sum))+'</td><td colspan="2"></td></tr></tbody></table>';
  if(mism && !paid) h+='<div class="alert warn" style="margin-top:8px"><i class="ti ti-arrows-diff"></i>'+plural(mism,"case")+' changed since the monthly invoice was built — click "'+(b.masterId?"Update":"Create")+' monthly invoice in Books".</div>';
  h+='</div></div></div></div></div>';
  $("contentArea").innerHTML=h;
}
function monthlyBuild(batchId, send){
  toast(send==="true" ? "Sending…" : "Saving the monthly invoice in Books…");
  call("mBuild",{ batchId:batchId, send:send }).then(function(r){
    toast((r&&r.message)||"Saved","ok");
    loadMonthly().then(function(){ return loadBatchStatus(batchId); }).then(function(){
      if(state.caseId){ state.listDirty=true; loadCase(); } else renderList();
    });
  }).catch(function(e){ toast(errMsg(e),"err"); });
}
function monthlySend(batchId){
  var b=state.monthly.batchById[batchId];
  openModal({
    title:"Mark as sent", sub:b.orgName+" · "+monthName(b.month),
    html:'<div class="hint" style="font-size:12px;color:var(--mid)">The monthly invoice is saved with the current case totals and marked <b>Sent</b> in Books (from Books it goes on to Xero). After this no case can be added to or taken off it. Print the cover sheet to send with it.</div>',
    saveLabel:"Mark as sent",
    save:function(){ closeModal(); monthlyBuild(batchId,"true"); }
  });
}
function monthlyRemove(itemId){
  openModal({
    title:"Take this case off?", html:'<div class="hint" style="font-size:12px">The case goes back to "Not on a monthly invoice yet".</div>', saveLabel:"Take off",
    save:function(){
      call("mRemove",{ itemId:itemId }).then(function(r){ closeModal(); toast((r&&r.message)||"Removed","ok"); loadMonthly().then(renderList); }).catch(function(e){ modalError(errMsg(e)); });
    }
  });
}
function monthlyDelete(batchId){
  var b=state.monthly.batchById[batchId];
  openModal({
    title:"Delete monthly invoice (pre-launch clean-up)", sub:b.orgName+" · "+monthName(b.month),
    html:'<div class="alert warn"><i class="ti ti-alert-triangle"></i><div>Only for clearing test data before go-live. The monthly invoice is voided in Xero and deleted in Books, its cases are unlinked and go back to "Not on a monthly invoice yet". The case invoices themselves are kept.</div></div>'+
      '<div class="mf"><label for="delConfirm">Type DELETE to confirm</label><input id="delConfirm" autocomplete="off"></div>',
    saveLabel:"Delete",
    save:function(){
      if(str($("delConfirm").value).trim()!=="DELETE"){ modalError("Type DELETE to confirm"); return; }
      call("delMonth",{ batchId:batchId }).then(function(r){ closeModal(); toast((r&&r.message)||"Deleted","ok"); state.batchId=""; loadMonthly().then(renderList); }).catch(function(e){ modalError(errMsg(e)); });
    }
  });
}
function chooseCustomer(batchId){
  var b=state.monthly.batchById[batchId];
  openModal({
    title:"Books customer", sub:b.orgName,
    html:'<div class="psearch-row"><input id="custSearch" placeholder="Search Books customers…" value="'+esc(b.orgName)+'"><button class="btn sm" data-act="m-cust-search"><i class="ti ti-search"></i>Search</button></div><div class="presults" id="custResults"></div>'+
      '<div id="custPick" style="margin-top:10px"></div>'+
      '<div class="hint">Saved for '+esc(b.orgName)+' — every monthly invoice of this institution uses it.</div>',
    saveLabel:"Use this customer",
    onOpen:function(){ custSearch(); },
    save:function(){
      var p=state.modal.pick; if(!p){ modalError("Pick a customer from the list"); return; }
      call("orgMap",{ orgAccountId:b.orgId, orgName:b.orgName, customerId:p.id, customerName:p.name }).then(function(){ closeModal(); toast("Books customer saved","ok"); loadMonthly().then(renderList); }).catch(function(e){ modalError(errMsg(e)); });
    }
  });
}
// Pick = clearly marked: the row is highlighted, its button says Picked, and the name is shown
// above the Save button (the old faint row tint was easy to miss).
function custPick(el){
  try{
    if(!state.modal){ toast("The window was closed - click Choose again","err"); return; }
    state.modal.pick={ id:el.getAttribute("data-id"), name:el.getAttribute("data-name") };
    var rs=document.querySelectorAll("#custResults .pres");
    for(var i=0;i<rs.length;i++){
      rs[i].style.background=""; rs[i].style.boxShadow="";
      var bt=rs[i].querySelector('[data-act="m-cust-pick"]'); if(bt){ bt.innerHTML="Pick"; bt.classList.remove("primary"); }
    }
    var row=el.closest(".pres");
    if(row){ row.style.background="var(--plum-m)"; row.style.boxShadow="inset 3px 0 0 var(--plum)"; }
    el.innerHTML='<i class="ti ti-check"></i>Picked'; el.classList.add("primary");
    $("custPick").innerHTML='<div class="alert ok"><i class="ti ti-check"></i><div>Picked: <b>'+esc(state.modal.pick.name)+'</b> — click "Use this customer".</div></div>';
    $("modalErr").style.display="none";
  }catch(e){ toast("Pick failed: "+errMsg(e),"err"); }
}
function custSearch(){
  var q=str($("custSearch") && $("custSearch").value).trim(); if(q.length<2) return;
  if(state.modal) state.modal.pick=null;
  if($("custPick")) $("custPick").innerHTML="";
  $("custResults").innerHTML='<div class="loading" style="padding:8px"><i class="ti ti-loader-2"></i>Searching Books…</div>';
  call("customers",{ q:q }).then(function(r){
    var l=(r&&r.customers)||[];
    if(!l.length){ $("custResults").innerHTML='<div class="hint">No Books customer matches "'+esc(q)+'".'+(r&&r.message?" "+esc(r.message):"")+'</div>'; return; }
    $("custResults").innerHTML=l.map(function(cu){ return '<div class="pres"><div class="pr-name">'+esc(cu.contact_name)+'<div class="pr-sub">'+esc(cu.company_name||"")+'</div></div><button class="btn sm" data-act="m-cust-pick" data-id="'+esc(cu.contact_id)+'" data-name="'+esc(cu.contact_name)+'">Pick</button></div>'; }).join("");
  }).catch(function(e){ $("custResults").innerHTML='<div class="alert err">'+esc(errMsg(e))+'</div>'; });
}

// ----- cover sheet (modelled on the Analytics query tables) -----
// Police / MNSJ = "Query Table for  Government Invoicing Report" (feeds "Police Invoicing Report");
// Hospital = "Query Table for Hospital Invoicing Report" (Registration Number is not on the
// hospital report -- removed by request, ZP-TBD-44 item 15).
var COVER_COLS = {
  police:["Deal Name","Account Name","Pickup Date","Name of Deceased","Registration Number","Created Time","Decomposition Fee","Number of Days","Cost/Rate of Storage per Day","Kilometer Travelled","Rate per km","Autopsy Date/Time","Letter of No Interest Date","Total","Autopsy Location","Number of Times Autopsy Rescheduled"],
  hospital:["Deal Name","Account Name","Name of Deceased","Pickup Date","Hospital Release Issue Date","Created Time","Number of Days","Cost/Rate of Storage per Day","Pickup Cost","Total"]
};
var COVER_MONEY = { "Decomposition Fee":1,"Cost/Rate of Storage per Day":1,"Rate per km":1,"Total":1,"Pickup Cost":1 };
var COVER_NUM = { "Number of Days":1,"Kilometer Travelled":1,"Number of Times Autopsy Rescheduled":1 };
var DECOMP_FEE_ID = "6503357000002869270";
function fmtAn(iso, withTime){   // Analytics format: MMM dd, yyyy [hh:mm a]
  var d=dPart(iso); if(!d) return "";
  var p=d.split("-"), s=MONTHS[parseInt(p[1],10)-1]+" "+p[2]+", "+p[0];
  if(!withTime) return s;
  var t=tPart(iso); if(!t) return s;
  var hh=parseInt(t.substring(0,2),10), ap=hh>=12?"PM":"AM", h=hh%12; if(h===0) h=12;
  return s+" "+pad2(h)+":"+t.substring(3,5)+" "+ap;
}
function openCover(batchId){
  var b=state.monthly.batchById[batchId];
  var kind=b.payer==="Hospital" ? "hospital" : "police";
  state.cover={ batchId:batchId, kind:kind, loading:true, rows:[], error:"" };
  renderList();
  var items=(state.monthly.byBatch[batchId]||[]).slice();
  var acc={ invoices:[], deals:[], history:{}, salesOrders:[] };
  var chunks=[]; for(var i=0;i<items.length;i+=5) chunks.push(items.slice(i,i+5));
  var p=Promise.resolve();
  chunks.forEach(function(ch){
    p=p.then(function(){
      return call("cover",{ invoiceIdsJson:JSON.stringify(ch.map(function(x){ return x.crmInvoiceId; })), dealIdsJson:JSON.stringify(ch.map(function(x){ return x.dealId; })), wantSalesOrders:kind==="hospital"?"true":"false" })
        .then(function(r){ acc.invoices=acc.invoices.concat(r.invoices||[]); acc.deals=acc.deals.concat(r.deals||[]); acc.salesOrders=acc.salesOrders.concat(r.salesOrders||[]); Object.keys(r.stageHistory||{}).forEach(function(k){ acc.history[k]=r.stageHistory[k]; }); });
    });
  });
  p.then(function(){
    var pids={};
    acc.invoices.forEach(function(inv){ (inv.Invoiced_Items||[]).forEach(function(l){ var id=rowId(l.Product_Name); if(id) pids[id]=1; }); });
    acc.salesOrders.forEach(function(so){ (so.Ordered_Items||[]).forEach(function(l){ var id=rowId(l.Product_Name); if(id) pids[id]=1; }); });
    return call("prodInfo",{ productIdsJson:JSON.stringify(Object.keys(pids)) });
  }).then(function(r){
    var cat={}; ((r&&r.products)||[]).forEach(function(pp){ cat[str(pp.id)]=str(pp.Product_Category); });
    var invBy={}, dealBy={}, soBy={};
    acc.invoices.forEach(function(x){ invBy[str(x.id)]=x; });
    acc.deals.forEach(function(x){ dealBy[str(x.id)]=x; });
    acc.salesOrders.forEach(function(x){ var d=rowId(x.Deal_Name); (soBy[d]=soBy[d]||[]).push(x); });
    state.cover.rows=items.map(function(it){ return coverRow(kind, invBy[it.crmInvoiceId]||{}, dealBy[it.dealId]||{}, acc.history[it.dealId]||[], soBy[it.dealId]||[], cat); });
    state.cover.loading=false;
    if(state.cover && state.cover.batchId===batchId) renderList();
  }).catch(function(e){ if(state.cover){ state.cover.loading=false; state.cover.error=errMsg(e); renderList(); } });
}
function lineAmt(l){ var t=num(l.Total); if(t) return t; return num(l.Quantity)*num(l.List_Price); }
function coverRow(kind, inv, deal, hist, sos, cat){
  var lines=inv.Invoiced_Items||[];
  var sumIf=function(test, f){ var s=0; lines.forEach(function(l){ if(test(l)) s+=f(l); }); return s; };
  var isCat=function(c){ return function(l){ return cat[rowId(l.Product_Name)]===c; }; };
  var isTrip=function(l){ var c=cat[rowId(l.Product_Name)]; return c==="Pickup" || c==="Trip"; };
  var row={
    "Deal Name":str(deal.Deal_Name), "Account Name":lk(inv.Parent_Account).name, "Name of Deceased":str(deal.Name_of_Deceased),
    "Registration Number":str(deal.Registration_Number), "Pickup Date":fmtAn(deal.Initial_Trip_Completed_At,true), "Created Time":fmtAn(inv.Created_Time,true),
    "Number of Days":sumIf(isCat("Storage"),function(l){ return num(l.Quantity); }),
    "Cost/Rate of Storage per Day":sumIf(isCat("Storage"),function(l){ return num(l.List_Price); }),
    "Total":sumIf(function(){ return true; },lineAmt)
  };
  if(kind==="police"){
    row["Decomposition Fee"]=sumIf(function(l){ return rowId(l.Product_Name)===DECOMP_FEE_ID; },function(l){ return num(l.Quantity)*num(l.List_Price); });
    row["Kilometer Travelled"]=sumIf(isTrip,function(l){ return num(l.Quantity); });
    row["Rate per km"]=sumIf(isTrip,function(l){ return num(l.List_Price); });
    row["Autopsy Date/Time"]=fmtAn(deal.Autopsy_Date_Time,true);
    row["Letter of No Interest Date"]=fmtAn(deal.Letter_of_No_Interest_Date,false);
    row["Autopsy Location"]=str(deal.Autopsy_Location);
    row["Number of Times Autopsy Rescheduled"]=(hist||[]).filter(function(h){ return str(h.Stage)==="Autopsy Rescheduled"; }).length;
  } else {
    row["Hospital Release Issue Date"]=fmtAn(deal.Hospital_Release_Date,false);
    var pc=0; sos.forEach(function(so){ (so.Ordered_Items||[]).forEach(function(l){ if(cat[rowId(l.Product_Name)]==="Pickup") pc+=num(l.Quantity)*num(l.List_Price); }); });
    row["Pickup Cost"]=pc;
  }
  return row;
}
function coverCell(col, v){ if(COVER_MONEY[col]) return money(v); if(COVER_NUM[col]) return qtyTxt(v); return str(v); }
function renderCover(){
  var cv=state.cover, b=state.monthly.batchById[cv.batchId]||{};
  var title=cv.kind==="hospital" ? "Hospital Invoicing Report" : "Police Invoicing Report";
  $("viewHeader").innerHTML='<div class="vh-row no-print"><button class="btn" data-act="cover-back"><i class="ti ti-arrow-left"></i>Back</button><div class="view-title">Cover sheet</div><div class="view-sub">'+esc(b.orgName)+' · '+esc(monthName(b.month))+'</div>'+
    '<div class="vh-actions"><button class="btn" data-act="cover-xlsx"'+(cv.loading?" disabled":"")+'><i class="ti ti-file-spreadsheet"></i>Excel</button><button class="btn primary" data-act="cover-print"'+(cv.loading?" disabled":"")+'><i class="ti ti-printer"></i>Print</button></div></div>';
  if(cv.loading){ $("contentArea").innerHTML='<div class="list-pane"><div class="loading"><i class="ti ti-loader-2"></i>Building the cover sheet…</div></div>'; return; }
  if(cv.error){ $("contentArea").innerHTML='<div class="list-pane"><div class="alert err"><i class="ti ti-alert-circle"></i>'+esc(cv.error)+'</div></div>'; return; }
  var cols=COVER_COLS[cv.kind], tot=0;
  var h='<div class="list-pane cover-page" id="coverPage"><div class="cover-head"><div class="cover-org">Delapenha Funeral Home Ltd</div><div class="cover-title">'+esc(title)+'</div>'+
    '<div class="cover-meta">'+esc(b.orgName)+' · '+esc(monthName(b.month))+(b.masterNumber?' · Invoice '+esc(b.masterNumber):'')+'</div></div>';
  h+='<div class="table-wrap"><table class="rpt cover-tbl"><thead><tr>'+cols.map(function(c){ return '<th>'+esc(c)+'</th>'; }).join("")+'</tr></thead><tbody>';
  cv.rows.forEach(function(r){ tot+=num(r.Total); h+='<tr>'+cols.map(function(c){ return '<td'+(COVER_MONEY[c]||COVER_NUM[c]?' style="text-align:right"':'')+'>'+esc(coverCell(c,r[c]))+'</td>'; }).join("")+'</tr>'; });
  h+='<tr class="grp">'+cols.map(function(c,i){ if(i===0) return '<td>Total · '+plural(cv.rows.length,"case")+'</td>'; if(c==="Total") return '<td style="text-align:right">'+esc(money(tot))+'</td>'; return '<td></td>'; }).join("")+'</tr>';
  h+='</tbody></table></div></div>';
  $("contentArea").innerHTML=h;
}
function coverXlsx(){
  var cv=state.cover, b=state.monthly.batchById[cv.batchId]||{};
  if(typeof ExcelJS==="undefined"){ toast("Excel export is not available","err"); return; }
  var cols=COVER_COLS[cv.kind], wb=new ExcelJS.Workbook(), ws=wb.addWorksheet("Cover sheet");
  var title=cv.kind==="hospital" ? "Hospital Invoicing Report" : "Police Invoicing Report";
  ws.addRow(["Delapenha Funeral Home Ltd"]).font={bold:true,size:14};
  ws.addRow([title]).font={bold:true,size:12};
  ws.addRow([b.orgName+" · "+monthName(b.month)+(b.masterNumber?" · Invoice "+b.masterNumber:"")]);
  ws.addRow([]);
  var hr=ws.addRow(cols); hr.font={bold:true,color:{argb:"FFFFFFFF"}};
  hr.eachCell(function(cell){ cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF5C2D6E"}}; cell.alignment={wrapText:true,vertical:"top"}; });
  var tot=0;
  cv.rows.forEach(function(r){ tot+=num(r.Total); ws.addRow(cols.map(function(c){ return (COVER_MONEY[c]||COVER_NUM[c]) ? num(r[c]) : str(r[c]); })); });
  var tr=ws.addRow(cols.map(function(c,i){ if(i===0) return "Total ("+cv.rows.length+")"; if(c==="Total") return tot; return ""; })); tr.font={bold:true};
  cols.forEach(function(c,i){ var col=ws.getColumn(i+1); col.width=Math.max(12,Math.min(30,c.length+4)); if(COVER_MONEY[c]) col.numFmt="#,##0.00"; });
  ws.pageSetup={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0};
  wb.xlsx.writeBuffer().then(function(buf){ download((b.orgName||"Cover")+" "+b.month+" "+title+".xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); });
}

// ----- billing codes -----
// fb = the product the CRM falls back to when nothing is linked to the scenario
var POLICE_SCEN = [
  {cat:"Pickup", label:"Initial police pickup (billed per KM)", fb:"6503357000002869122"},
  {cat:"Storage", label:"Storage per day (IFSL and MNSJ, also when the LONI date is entered)", fb:"6503357000002869275"},
  {cat:"Decompose Storage", label:"Decomposed storage per day (IFSL and MNSJ)", fb:"6503357000019249225"},
  {cat:"Decomp Fee", label:"Decomposition fee (one-time)", fb:"6503357000002869270"},
  {cat:"Autopsy Trip", label:"Autopsy trip (billed per KM)"},
  {cat:"Reschedule Trip", label:"Reschedule trip (family or officer did not show)", fb:"6503357000004300032"},
  {cat:"X-ray Trip", label:"X-ray trip", fb:"6503357000004300032"},
  {cat:"Transfer Trip", label:"Transfer to another funeral home", fb:"6503357000004300027"},
  {cat:"Storage - Family", label:"Family storage (delayed Letter of No Interest)", fb:"6503357000002869275"}
];
var HOSP_SCEN = [
  {cat:"Pickup", label:"Pickup / reschedule trip", fb:"6503357000003769464"},
  {cat:"Storage", label:"Storage per day (hospital)", fb:"6503357000078744158"},
  {cat:"Storage - Family", label:"Family storage", fb:"6503357000019249158"},
  {cat:"Decompose", label:"Decomposition fee"},
  {cat:"Autopsy Trip", label:"Autopsy trip", fb:"6503357000004300032"},
  {cat:"PME Fee", label:"PME fee"},
  {cat:"PME Transport Fee", label:"PME transport fee"},
  {cat:"Transfer Trip", label:"Transfer to another funeral home", fbText:"the police Transfer trip product"}
];
function loadCodes(){ return call("codes").then(function(r){ state.codes=r||{}; return r; }); }
function codeCell(prods, s){
  if(!prods.length){
    var fbP = s && s.fb && state.codes && (state.codes.fixed||[]).filter(function(p){ return str(p.id)===s.fb; })[0];
    if(fbP) return '<span class="badge b-warn">Not linked</span> the CRM falls back to <b>'+esc(fbP.Product_Name)+'</b> '+esc(money(fbP.Unit_Price));
    if(s && s.fbText) return '<span class="badge b-warn">Not linked</span> the CRM uses '+esc(s.fbText);
    return '<span class="badge b-red">No product set — this scenario bills nothing</span>';
  }
  var h=prods.map(function(p){ return '<b>'+esc(p.Product_Name)+'</b> '+esc(money(p.Unit_Price))+(p.Product_Code?' <span style="color:var(--muted)">'+esc(p.Product_Code)+'</span>':'')+(p.Product_Active===false?' <span class="badge b-warn">inactive</span>':''); }).join("<br>");
  if(prods.length>1) h+='<br><span class="badge b-warn">'+prods.length+' products match — the CRM takes the first one</span>';
  return h;
}
function renderCodes(){
  $("viewHeader").innerHTML='<div class="vh-row"><div class="view-title">Billing codes</div><div class="view-sub">The product each billing scenario bills from now on</div><div class="vh-actions"><button class="btn" data-act="codes-refresh"><i class="ti ti-refresh"></i>Refresh</button></div></div>'+
    '<div class="view-sub">To fix one invoice only, use <b>Edit lines</b> on the case. Change it here to fix the scenario for every case from now on.</div>';
  if(!state.codes){ $("contentArea").innerHTML='<div class="list-pane"><div class="loading"><i class="ti ti-loader-2"></i>Loading billing codes…</div></div>'; loadCodes().then(renderList).catch(function(e){ $("contentArea").innerHTML='<div class="list-pane"><div class="alert err">'+esc(errMsg(e))+'</div></div>'; }); return; }
  var cd=state.codes, h='<div class="list-pane">';
  h+='<div class="container"><div class="con-title"><i class="ti ti-shield"></i>Police (products under the police parent product)</div><table class="lines"><thead><tr><th>Scenario</th><th>Billed with</th><th></th></tr></thead><tbody>';
  POLICE_SCEN.forEach(function(s){
    var prods=(cd.police||[]).filter(function(p){ return str(p.Product_Category)===s.cat; });
    h+='<tr><td><span class="p-name">'+esc(s.label)+'</span><span class="p-sub">Category: '+esc(s.cat)+'</span></td><td>'+codeCell(prods, s)+'</td>'+
      '<td class="num"><button class="btn sm" data-act="code-change" data-scope="police" data-cat="'+esc(s.cat)+'" data-label="'+esc(s.label)+'"><i class="ti ti-pencil"></i>Change</button></td></tr>';
  });
  h+='</tbody></table></div>';
  // hospitals
  var hosp={}, horder=[];
  (cd.hospital||[]).forEach(function(p){ var id=rowId(p.Product_of_This_Hospital); if(!id) return; if(!hosp[id]){ hosp[id]={ name:str(p["Product_of_This_Hospital.Account_Name"])||id, prods:[] }; horder.push(id); } hosp[id].prods.push(p); });
  horder.sort(function(a,b){ return hosp[a].name.localeCompare(hosp[b].name); });
  horder.forEach(function(id){
    h+='<div class="container"><div class="con-title"><i class="ti ti-building-hospital"></i>'+esc(hosp[id].name)+'</div><table class="lines"><thead><tr><th>Scenario</th><th>Billed with</th><th></th></tr></thead><tbody>';
    HOSP_SCEN.forEach(function(s){
      var prods=hosp[id].prods.filter(function(p){ return str(p.Product_Category)===s.cat; });
      h+='<tr><td><span class="p-name">'+esc(s.label)+'</span><span class="p-sub">Category: '+esc(s.cat)+'</span></td><td>'+codeCell(prods, s)+'</td>'+
        '<td class="num"><button class="btn sm" data-act="code-change" data-scope="'+esc(id)+'" data-cat="'+esc(s.cat)+'" data-label="'+esc(hosp[id].name+" — "+s.label)+'"><i class="ti ti-pencil"></i>Change</button></td></tr>';
    });
    h+='</tbody></table></div>';
  });
  h+='<div class="hint" style="margin:4px 2px 12px">A product bills one scenario only. "Not linked" means the CRM uses its built-in fallback product until you pick one here.</div>';
  h+='</div>';
  $("contentArea").innerHTML=h;
}
function changeCode(scope, cat, label){
  openModal({
    title:"Billing code — "+label, wide:true,
    html:'<div class="psearch-row"><input id="codeSearch" placeholder="Search by product name, code or parent product…"><button class="btn sm" data-act="code-search"><i class="ti ti-search"></i>Search</button></div>'+
      '<div class="presults" id="codeResults" style="max-height:300px"></div><div id="codePick" style="margin-top:10px"></div>',
    note:'From now on every new '+esc(label)+' line uses the product you pick. The product used until now is unlinked from this scenario (old invoices keep it).',
    saveLabel:"Use for this scenario",
    onOpen:function(){ state.modal.scope=scope; state.modal.cat=cat; setTimeout(function(){ $("codeSearch").focus(); },50); },
    save:function(){
      var p=state.modal.pick; if(!p){ modalError("Pick a product from the search results"); return; }
      call("setCode",{ scope:scope, category:cat, productId:p.id }).then(function(){ closeModal(); toast("Billing code changed","ok"); loadCodes().then(renderList); }).catch(function(e){ modalError(errMsg(e)); });
    }
  });
}
function codeSearch(){
  var q=str($("codeSearch") && $("codeSearch").value).trim();
  if(q.length<2){ $("codeResults").innerHTML='<div class="hint">Type at least 2 letters.</div>'; return; }
  $("codeResults").innerHTML='<div class="loading" style="padding:8px"><i class="ti ti-loader-2"></i>Searching…</div>';
  call("search",{ q:q }).then(function(r){
    var l=(r&&r.products)||[];
    l.forEach(cacheProduct);
    if(r && r.message) toast(r.message,"err");
    if(!l.length){ $("codeResults").innerHTML='<div class="hint">'+(r&&r.message?esc(r.message):'No active product matches "'+esc(q)+'".')+'</div>'; return; }
    $("codeResults").innerHTML='<table class="lines"><thead><tr><th>Product</th><th>Parent product</th><th>Category</th><th class="num">Price</th><th></th></tr></thead><tbody>'+l.map(function(p){
      return '<tr><td>'+esc(p.Product_Name)+(p.Product_Code?' <span class="p-sub">'+esc(p.Product_Code)+'</span>':'')+'</td><td>'+esc(p["Parent_Product.Product_Name"]||"")+'</td><td>'+esc(p.Product_Category||"")+'</td><td class="num">'+esc(money(p.Unit_Price))+'</td>'+
        '<td class="num"><button class="btn sm" data-act="code-pick" data-id="'+esc(p.id)+'">Pick</button></td></tr>';
    }).join("")+'</tbody></table>';
  }).catch(function(e){ $("codeResults").innerHTML='<div class="alert err">'+esc(errMsg(e))+'</div>'; });
}

// ----- feedback -----
function loadFeedback(){
  return call("fbList").then(function(r){
    r=r||{};
    state.feedback=idList(r).map(function(id,i){ return { id:str(id), dealId:str(list(r,"dealIds")[i]), name:str(list(r,"names")[i]), text:str(list(r,"texts")[i]), status:str(list(r,"statuses")[i])||"Open",
      by:str(list(r,"createdBy")[i]), at:str(list(r,"createdAt")[i]), doneBy:str(list(r,"doneBy")[i]), doneAt:str(list(r,"doneAt")[i]) }; });
    state.feedback.sort(function(a,b){ return a.at<b.at?1:(a.at>b.at?-1:0); });
    if($("bFeedback")) $("bFeedback").textContent=state.feedback.filter(function(f){ return f.status==="Open"; }).length;
    return state.feedback;
  }).catch(function(e){ if(!state.feedback) state.feedback=[]; return state.feedback; });
}
function caseFeedbackBlock(c){
  var mine=(state.feedback||[]).filter(function(f){ return f.dealId===state.caseId; });
  var h='<div class="container tint">'+conTitle("ti-message-report","Something wrong? Feedback for the daily review","");
  h+='<textarea class="note-in" id="fbIn" placeholder="A quantity, date or anything else that is wrong and is not a billing code (billing codes: fix on the invoice with Edit lines, or under Billing codes)."></textarea>';
  h+='<div style="text-align:right;margin:6px 0 4px"><button class="btn sm primary" data-act="fb-add"><i class="ti ti-send"></i>Send feedback</button></div>';
  mine.forEach(function(f){
    h+='<div class="log-item"><div class="li-top"><span class="badge '+(f.status==="Open"?"b-warn":"b-green")+'">'+esc(f.status)+'</span><span>'+esc(fmtDT(f.at))+'</span><span>'+esc(f.by)+'</span></div><div class="li-det">'+esc(f.text)+'</div></div>';
  });
  return h+'</div>';
}
function fbAdd(){
  var v=str($("fbIn") && $("fbIn").value).trim();
  if(!v){ toast("Type the feedback first","err"); return; }
  var c=state.c, name=c && c.deal ? (c.deal.Name_of_Deceased||c.deal.Deal_Name) : "";
  call("fbAdd",{ dealId:state.caseId, caseName:name, feedback:v }).then(function(){ loadFeedback().then(function(){ afterChange("Feedback sent"); }); }).catch(function(e){ toast(errMsg(e),"err"); });
}
function renderFeedback(){
  if(!state.feedback){ r2Loading("Feedback","Loading feedback…"); loadFeedback().then(renderList); return; }
  var f=state.fbFilter, l=state.feedback.filter(function(x){ return f==="All" || x.status===f; });
  $("viewHeader").innerHTML='<div class="vh-row"><div class="view-title">Feedback</div><div class="view-sub">'+plural(l.length,"item")+'</div>'+
    '<div class="vh-actions"><button class="btn" data-act="fb-refresh"><i class="ti ti-refresh"></i>Refresh</button><button class="btn primary" data-act="fb-export"'+(l.length?"":" disabled")+'><i class="ti ti-download"></i>Export '+esc(f==="All"?"all":f.toLowerCase())+' for Claude Code</button></div></div>'+
    '<div class="filters">'+["Open","Done","All"].map(function(x){ return '<button class="filter-pill'+(f===x?" active":"")+'" data-act="fb-filter" data-v="'+x+'">'+x+'</button>'; }).join("")+'</div>';
  var h='<div class="list-pane">';
  if(!l.length) h+='<div class="list-empty">No feedback here.</div>';
  l.forEach(function(x){
    h+='<div class="container"><div class="con-title" style="text-transform:none;letter-spacing:0;font-size:12px"><a href="#" data-act="open-case" data-id="'+esc(x.dealId)+'" style="color:var(--plum)">'+esc(x.name||x.dealId)+'</a>'+
      '<span class="badge '+(x.status==="Open"?"b-warn":"b-green")+'">'+esc(x.status)+'</span><span class="ct-r"><button class="btn sm" data-act="fb-set" data-id="'+esc(x.id)+'" data-st="'+(x.status==="Open"?"Done":"Open")+'">'+(x.status==="Open"?'<i class="ti ti-check"></i>Mark done':'<i class="ti ti-arrow-back-up"></i>Reopen')+'</button></span></div>'+
      '<div class="li-det" style="font-size:12px;white-space:pre-wrap">'+esc(x.text)+'</div><div class="hint">'+esc(x.by)+' · '+esc(fmtDT(x.at))+(x.status==="Done"?' · done by '+esc(x.doneBy)+' '+esc(fmtDT(x.doneAt)):"")+'</div></div>';
  });
  $("contentArea").innerHTML=h+'</div>';
}
function fbSet(id, st){
  call("fbSet",{ feedbackId:id, feedbackStatus:st }).then(function(){ loadFeedback().then(renderList); }).catch(function(e){ toast(errMsg(e),"err"); });
}
// Markdown export: each feedback item with the full case and invoice data, ready to hand to Claude Code
function mdLines(lines){
  if(!(lines||[]).length) return "  (no lines)\n";
  return "  | Product | Category | Qty | Price | Discount | Amount |\n  |---|---|---|---|---|---|\n"+lines.map(function(l){ return "  | "+[l.productName,l.category||"",qtyTxt(l.qty),money(l.price),money(l.discount),money(lineAmount(l))].join(" | ")+" |"; }).join("\n")+"\n";
}
function caseMarkdown(c){
  var d=c.deal||{}, t="";
  t+="- Deal: "+state._exportDeal+" ("+CRM+"Potentials/"+state._exportDeal+")\n";
  t+="- Type: "+c.kind+(c.isDropoff?" (drop-off)":"")+" · started as "+(d.Initial_Pipeline||d.Pipeline)+" · now "+d.Pipeline+" · stage "+d.Stage+"\n";
  t+="- "+(c.kind==="police"?"Police account: "+lk(d.Police_Account).name:"Hospital: "+lk(d.Selected_Hospital).name)+" · Registration # "+(d.Registration_Number||"—")+" · Condition "+(d.Condition||"—")+"\n";
  t+="- Pickup completed "+(d.Initial_Trip_Completed_At||"—")+" · LONI "+(d.Letter_of_No_Interest_Date||"—")+" · family got LONI "+(d.Receiving_Letter_of_No_Interest_Date||"—")+" · release "+(d.Hospital_Release_Date||"—")+" · family got release "+(d.Receiving_Release_Date||"—")+"\n";
  t+="- Autopsy required "+(d.Autopsy_Required||"—")+" · at "+(d.Autopsy_Date_Time||"—")+" · completed "+(d.Autopsy_Completed_Date_Time||"—")+" · location "+(lk(d.Autopsy_Locations).name||d.Autopsy_Location||"—")+" · X-ray "+(d.X_Ray_Required||"—")+"\n";
  t+="\n**Trips**\n"+(c.trips||[]).map(function(x){ return "- "+x.type+" · "+x.status+" · "+x.name+" · KM "+(x.km||"blank")+(x.fixedKm?" (fixed "+x.fixedKm+")":"")+" · id "+x.id; }).join("\n")+"\n";
  t+="\n**Driver outcomes (Operations)**\n"+((c.operations||[]).filter(function(o){ return o.outcome||o.reason; }).map(function(o){ return "- "+o.name+": "+o.outcome+" / "+o.reason; }).join("\n")||"- none")+"\n";
  t+="\n**Sales Orders**\n";
  (c.salesOrders||[]).forEach(function(so){ t+="- "+so.type+" · "+so.status+" · total "+money(so.total)+" · id "+so.id+"\n"+mdLines(so.lines); });
  t+="\n**Invoices**\n";
  (c.invoices||[]).forEach(function(inv){
    var b=inv.books||{}, it=monthlyItemFor(inv.id);
    t+="- "+inv.for+" · "+inv.subject+" · CRM "+inv.status+" "+money(inv.total)+" · Books "+(b.ok?(b.number+" "+b.status+" "+money(b.total)+" balance "+money(b.balance)):(b.error||"not read"))+" · CRM id "+inv.id+(inv.booksId?" · Books id "+inv.booksId:"")+(it?" · on monthly invoice "+((state.monthly.batchById[it.batchId]||{}).masterNumber||"(not in Books yet)"):"")+"\n"+mdLines(inv.lines);
  });
  t+="\n**History (app)**\n"+((c.log||[]).slice(0,15).map(function(l){ return "- "+l.at+" "+l.by+" — "+l.action+": "+l.detail; }).join("\n")||"- none")+"\n";
  return t;
}
function fbExport(){
  var f=state.fbFilter, items=state.feedback.filter(function(x){ return f==="All" || x.status===f; });
  if(!items.length) return;
  toast("Building the export ("+plural(items.length,"item")+")…");
  var deals={}, order=[]; items.forEach(function(x){ if(!deals[x.dealId]){ deals[x.dealId]=null; order.push(x.dealId); } });
  var p=(state.monthly?Promise.resolve():loadMonthly());
  order.forEach(function(id){ p=p.then(function(){ return call("get",{ dealId:id }).then(function(r){ deals[id]=r; }).catch(function(e){ deals[id]={ error:errMsg(e) }; }); }); });
  p.then(function(){
    var md="# P/H Billing feedback — "+todayKey()+"\n\n"+plural(items.length,"item")+" ("+f+"). Source: Police & Hospital Billing app (ZP-TBD-105). Each item has the feedback, then the full case and its Sales Orders / invoices as the app showed them at export time.\n\n";
    items.forEach(function(x,i){
      md+="## "+(i+1)+". "+(x.name||x.dealId)+" — "+x.status+"\n\n> "+x.text.replace(/\n/g,"\n> ")+"\n\n— "+x.by+", "+x.at+"\n\n";
      var c=deals[x.dealId];
      if(!c || c.error){ md+="(case could not be loaded: "+((c&&c.error)||"")+")\n\n"; return; }
      state._exportDeal=x.dealId; md+=caseMarkdown(c)+"\n";
    });
    download("PH_Billing_feedback_"+todayKey()+".md", md, "text/markdown");
    toast("Export downloaded","ok");
  });
}

// ----- pre-launch delete of a case invoice -----
function deleteInvoice(invId){
  var c=state.c, inv=null; (c.invoices||[]).forEach(function(i){ if(i.id===invId) inv=i; });
  if(!inv) return;
  openModal({
    title:"Delete invoice (pre-launch clean-up)", sub:inv.subject,
    html:'<div class="alert warn"><i class="ti ti-alert-triangle"></i><div>Only for clearing test invoices before go-live. The invoice is voided in Xero (if it went there), deleted in Books and deleted in the CRM. The Sales Order is kept. Not possible once a payment is recorded.</div></div>'+
      '<div class="mf"><label for="delConfirm">Type DELETE to confirm</label><input id="delConfirm" autocomplete="off"></div>',
    saveLabel:"Delete",
    save:function(){
      if(str($("delConfirm").value).trim()!=="DELETE"){ modalError("Type DELETE to confirm"); return; }
      call("delInv",{ dealId:state.caseId, invoiceId:invId }).then(function(r){ closeModal(); afterChange((r&&r.message)||"Deleted"); }).catch(function(e){ modalError(errMsg(e)); });
    }
  });
}

// ===== 8. EVENTS =====
document.addEventListener("click", function(ev){
  var el=ev.target.closest("[data-act],.nav-item"); if(!el) return;
  if(el.classList.contains("nav-item")){ setView(el.getAttribute("data-view")); return; }
  if(el.tagName==="A" && el.getAttribute("href")==="#") ev.preventDefault();
  var act=el.getAttribute("data-act");
  // round 2
  if(act==="m-add"){ addToMonthly(el.getAttribute("data-inv")); return; }
  if(act==="m-add-quick"){ addQuick(el.getAttribute("data-deal"), el.getAttribute("data-inv")); return; }
  if(act==="open-batch"){ openBatch(el.getAttribute("data-batch")); return; }
  if(act==="m-back"){ state.batchId=""; renderList(); return; }
  if(act==="m-refresh"){ state.monthly=null; loadCases(); renderList(); return; }
  if(act==="m-build"){ monthlyBuild(el.getAttribute("data-batch"), el.getAttribute("data-send")||"false"); return; }
  if(act==="m-send"){ monthlySend(el.getAttribute("data-batch")); return; }
  if(act==="m-remove"){ monthlyRemove(el.getAttribute("data-item")); return; }
  if(act==="m-delete"){ monthlyDelete(el.getAttribute("data-batch")); return; }
  if(act==="m-customer"){ chooseCustomer(el.getAttribute("data-batch")); return; }
  if(act==="m-cust-search"){ custSearch(); return; }
  if(act==="m-cust-pick"){ custPick(el); return; }
  if(act==="m-cover"){ openCover(el.getAttribute("data-batch")); return; }
  if(act==="cover-back"){ state.cover=null; renderList(); return; }
  if(act==="cover-print"){ window.print(); return; }
  if(act==="cover-xlsx"){ coverXlsx(); return; }
  if(act==="del-inv"){ deleteInvoice(el.getAttribute("data-inv")); return; }
  if(act==="fb-add"){ fbAdd(); return; }
  if(act==="fb-set"){ fbSet(el.getAttribute("data-id"), el.getAttribute("data-st")); return; }
  if(act==="fb-filter"){ state.fbFilter=el.getAttribute("data-v"); renderList(); return; }
  if(act==="fb-refresh"){ state.feedback=null; renderList(); return; }
  if(act==="fb-export"){ fbExport(); return; }
  if(act==="codes-refresh"){ state.codes=null; renderList(); return; }
  if(act==="code-change"){ changeCode(el.getAttribute("data-scope"), el.getAttribute("data-cat"), el.getAttribute("data-label")); return; }
  if(act==="code-search"){ codeSearch(); return; }
  if(act==="code-pick"){ var pp=state.productCache[el.getAttribute("data-id")]||{}; state.modal.pick={ id:el.getAttribute("data-id") };
    $("codePick").innerHTML='<div class="alert ok"><i class="ti ti-check"></i><div>Picked: <b>'+esc(pp.name||"")+'</b> '+esc(pp.unitPrice!==undefined?money(pp.unitPrice):"")+' — click "Use for this scenario".</div></div>'; return; }
  if(act==="open-case") openCase(el.getAttribute("data-id"));
  else if(act==="back") closeCase();
  else if(act==="refresh") loadCases();
  else if(act==="reload-case"){ state.listDirty=true; loadCase(); toast("Refreshing…"); }
  else if(act==="sub"){ state.sub=el.getAttribute("data-v"); renderList(); }
  else if(act==="edit-section") editSection(el.getAttribute("data-k"));
  else if(act==="edit-km") editKm(el.getAttribute("data-trip"));
  else if(act==="edit-outcome") editOutcome(el.getAttribute("data-ops"));
  else if(act==="edit-lines") editLines(el.getAttribute("data-target"), el.getAttribute("data-id"));
  else if(act==="resync") resync(el.getAttribute("data-inv"));
  else if(act==="close-billing") setClosed(true);
  else if(act==="reopen") setClosed(false);
  else if(act==="add-note") addNote();
  else if(act==="ed-add") edAdd("");
  else if(act==="ed-add-product") edAdd(el.getAttribute("data-pid"));
  else if(act==="ed-remove") edRemove(parseInt(el.getAttribute("data-i"),10));
  else if(act==="ed-search") edSearch();
});
document.addEventListener("input", function(ev){
  var t=ev.target;
  if(t.id==="caseSearch"){ state.q=t.value; var pos=t.selectionStart; renderList(); var s=$("caseSearch"); if(s){ s.focus(); try{ s.setSelectionRange(pos,pos); }catch(e){} } return; }
  if(t.getAttribute && t.getAttribute("data-ed") && t.getAttribute("data-ed")!=="product") edInput(t);
});
document.addEventListener("change", function(ev){
  var t=ev.target;
  if(t.id==="fromDate"){ state.fromDate=t.value||DEFAULT_FROM; loadCases(); return; }
  if(t.id==="billMonth"){ state.billMonth=t.value||curMonth(); renderList(); return; }
  if(t.getAttribute && t.getAttribute("data-ed")==="product") edInput(t);
});
document.addEventListener("keydown", function(ev){
  if(ev.target && ev.target.id==="pSearch" && ev.key==="Enter"){ ev.preventDefault(); edSearch(); }
  if(ev.target && ev.target.id==="custSearch" && ev.key==="Enter"){ ev.preventDefault(); custSearch(); }
  if(ev.target && ev.target.id==="codeSearch" && ev.key==="Enter"){ ev.preventDefault(); codeSearch(); }
  if(ev.key==="Escape" && state.modal) closeModal();
});
$("modalCancel").addEventListener("click", closeModal);
$("modalSave").addEventListener("click", saveModal);
$("hamburgerBtn").addEventListener("click", function(){ $("app").classList.toggle("sidebar-open"); });
$("sidebarOverlay").addEventListener("click", function(){ $("app").classList.remove("sidebar-open"); });

// ===== 9. INIT =====
function init(){
  var j=jamNow();
  $("todayLbl").textContent=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][j.getUTCDay()]+", "+MONTHS[j.getUTCMonth()]+" "+j.getUTCDate()+", "+j.getUTCFullYear();
  renderList();
  var start=function(){
    state.sdkReady=true;
    getLoginEmail().then(function(em){
      state.loginEmail=em;
      var ini=str(em).split("@")[0].replace(/[^a-zA-Z]/g," ").trim().split(/\s+/).map(function(p){ return p.charAt(0).toUpperCase(); }).join("").substring(0,2);
      $("avatar").textContent=ini||"··"; $("avatar").title=em;
    });
    loadCases();
    loadMonthly();     // monthly invoices (for the case screen + sidebar count)
    loadFeedback();    // open feedback count
  };
  try{
    if(window.ZOHO && ZOHO.CREATOR && typeof ZOHO.CREATOR.init==="function"){
      var p=ZOHO.CREATOR.init();
      if(p && typeof p.then==="function") p.then(start, start); else start();
    } else if(window.ZOHO && ZOHO.CREATOR){ start(); }
    else { $("contentArea").innerHTML='<div class="list-pane"><div class="list-empty">Open this page inside the Zoho Creator portal.</div></div>'; }
  }catch(e){ start(); }
}
init();

})();
