# Widget JS/CSS changes -- Trip Manager (app/widget.html)

Not a `.ds` file -- edited directly in the local repo
(`d:\Office\Andrea_Projects\DFH\widgets\tripManagerApp\app\widget.html`), per the project's
Creator-.ds-only guideline rule. This file documents what changed, for reference.

## CSS (kept, harmless, but not what actually fixed it)

```css
#content-analytics .dtbl-wrap{overflow-x:auto;overflow-y:visible;background:var(--white);border:1px solid var(--bt);border-radius:8px;margin-bottom:8px;}
#content-analytics table{border-collapse:separate;border-spacing:0;width:100%;font-size:11.5px;}
#content-analytics th{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--plum);font-weight:500;background:var(--plum-p);position:sticky;top:0;z-index:3;}
```

`overflow-y:visible` fixes a real CSS-spec quirk (setting only `overflow-x` implicitly computes
`overflow-y:auto` too, which breaks `position:sticky`'s containing block). `border-collapse:
separate` fixes a known sticky-vs-collapsed-borders browser bug. Both are correct fixes and
worth keeping, but neither was sufficient on their own in this widget's runtime -- see
metadata.md. The actual fix is the JS below.

## JS -- module-level state (near the other Burial Schedule module vars)

```js
var ALL=[], BURIAL=[], DSHEETS=[], DSHEET_DETAIL=null, loaded=false, loading=false;
var bFrozen=null; // JS-driven frozen header for Burial Schedule (native position:sticky is unreliable in this runtime)
```

## JS -- `renderBurial()`, call site (end of function, after the existing horizontal-scroll sync)

```js
    h+='</tbody></table></div>';C().innerHTML=h;
    // synced top scrollbar so you can scroll the wide table right without going to the bottom
    var bt=document.getElementById("an-btop"),bw=document.getElementById("an-bwrap"),bs=document.getElementById("an-bspacer");
    if(bt&&bw&&bs){
      bs.style.width=bw.scrollWidth+"px";
      if(bw.scrollWidth<=bw.clientWidth){bt.style.display="none";}
      var lock=false;
      bt.onscroll=function(){if(lock)return;lock=true;bw.scrollLeft=bt.scrollLeft;lock=false;};
      bw.onscroll=function(){if(lock)return;lock=true;bt.scrollLeft=bw.scrollLeft;lock=false;};
    }
    setupFrozenHead(bw);
  }
```

## JS -- new functions (`teardownFrozenHead` / `setupFrozenHead`)

```js
  // JS-driven frozen header row for a .dtbl-wrap table -- position:sticky on <th> is not
  // reliably honored in this widget's runtime, so pin a live pixel-measured clone instead.
  function teardownFrozenHead(){
    if(!bFrozen)return;
    var anBody=document.getElementById("an-body");
    if(anBody)anBody.removeEventListener("scroll",bFrozen.update);
    window.removeEventListener("resize",bFrozen.update);
    if(bFrozen.wrapEl)bFrozen.wrapEl.remove();
    bFrozen=null;
  }
  function setupFrozenHead(wrap){
    teardownFrozenHead();
    if(!wrap)return;
    var table=wrap.querySelector("table"),thead=table&&table.querySelector("thead");
    var anBody=document.getElementById("an-body");
    if(!table||!thead||!anBody)return;
    var frozenWrap=document.createElement("div");
    frozenWrap.className="an-frozenhead-wrap";
    frozenWrap.style.cssText="position:fixed;overflow:hidden;z-index:50;display:none;pointer-events:none;background:var(--plum-p);border-top-left-radius:8px;border-top-right-radius:8px;box-shadow:0 2px 6px rgba(30,20,35,.12);";
    var frozenTable=document.createElement("table");
    frozenTable.style.cssText="table-layout:fixed;border-collapse:separate;border-spacing:0;margin:0;";
    frozenTable.appendChild(thead.cloneNode(true));
    frozenWrap.appendChild(frozenTable);
    // append inside #content-analytics (not document.body) so the #content-analytics th/table
    // scoped CSS rules actually apply to the clone -- position:fixed still escapes the
    // scroll/overflow clipping and renders relative to the viewport since no ancestor here
    // has a transform.
    var host=document.getElementById("content-analytics")||document.body;
    host.appendChild(frozenWrap);
    function update(){
      var wrapRect=wrap.getBoundingClientRect();
      var theadRect=thead.getBoundingClientRect();
      var tableRect=table.getBoundingClientRect();
      var anRect=anBody.getBoundingClientRect();
      var show=theadRect.bottom<anRect.top&&tableRect.bottom>anRect.top;
      if(!show){frozenWrap.style.display="none";return;}
      frozenWrap.style.display="block";
      frozenWrap.style.left=wrapRect.left+"px";
      frozenWrap.style.top=anRect.top+"px";
      frozenWrap.style.width=wrapRect.width+"px";
      frozenTable.style.width=tableRect.width+"px";
      frozenTable.style.transform="translateX(-"+wrap.scrollLeft+"px)";
      var liveThs=thead.querySelectorAll("th"),cloneThs=frozenTable.querySelectorAll("th");
      liveThs.forEach(function(th,i){if(cloneThs[i])cloneThs[i].style.width=th.getBoundingClientRect().width+"px";});
    }
    bFrozen={wrapEl:frozenWrap,update:update};
    anBody.addEventListener("scroll",update);
    wrap.addEventListener("scroll",update);
    window.addEventListener("resize",update);
    update();
  }
```

## JS -- cleanup hooks (so the fixed clone can't get left floating over other screens)

In the central analytics `render()` dispatcher, torn down whenever navigating away from Burial
Schedule:

```js
  function render(){
    if(state.view!=="burial")teardownFrozenHead();
    var isSheets=(state.view==="driversheets"||state.view==="driversheet-detail");
    ...
```

And on the Analytics panel's close ("X") button:

```js
    n.addEventListener("click",function(){teardownFrozenHead();var p=document.getElementById("content-analytics");if(p)p.style.display="none";});
```
