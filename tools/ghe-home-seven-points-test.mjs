import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
const file=p=>readFileSync(p,"utf8");
const home=file("home-shell.js"),css=file("ghe-premium-safe-flip.css");
const card=file("team-home-fusion.js"),weatherCss=file("team-home-fusion.css");
const icon=file("ghe-notification-controls.js"),iconCss=file("ghe-notification-controls.css");
const wx=file("shift-weather-mini.js"),index=file("index.html");
const loader=file("stip-loader.js"),worker=file("stip-sw.js");
// En direct : seuls les shifts occupés à l'instant sont rendus.
// Une ligne Chef n'existe que pour un chef effectivement planifié maintenant.
const chiefScript=file("home-duty-chief.js");
assert.match(home,/liveCurrentlyWorking\(item,now\)/);
assert.match(home,/window\.STIPDutyChiefs\?\.liveSnapshot\?\.\(\)/);
assert.match(chiefScript,/liveSnapshot\(\)/);
assert.match(chiefScript,/stip:duty-chiefs-updated/);
assert.match(home,/isLiveChief\(item\)\?fallbackChiefs:rows/);
assert.match(home,/groups=waiting\?\[\]:premiumShiftGroups\(roster\.rows\)/);
assert.match(home,/data-premium-roster="/);
assert.match(home,/document\.createElement\("dialog"\)/);
assert.match(home,/document\.body\.appendChild\(dialog\)/);
assert.match(home,/if\(typeof dialog\.showModal==="function"\)dialog\.showModal/);
assert.match(home,/const rosterButton=event\.target\.closest\("\[data-premium-roster\]"\)/);
assert.match(home,/Math\.max\(270,box\(front\),box\(back\)\)/);
assert.doesNotMatch(home.slice(home.indexOf("function premiumBackMarkup()"),home.indexOf("function premiumPersonMarkup(")),/<details|items\.map\(premiumPersonMarkup\)/);
assert.match(css,/button\.ghe-premium-now-group/);
assert.match(css,/\.ghe-premium-now-group\.shift-chief/);
assert.match(css,/\.ghe-premium-now-groups\{[\s\S]*?overflow:visible!important/);
assert.match(css,/dialog\.ghe-premium-now-dialog::backdrop/);
assert.match(css,/\.ghe-premium-now-modal-content\{[\s\S]*?overflow-y:auto/);
const mockRow=(code,id)=>({code,agents:{source_key:id,prenom:id,nom:"Test"}});
const onlyActive=[mockRow("J","J1"),mockRow("J","J2"),mockRow("S","S1")];
function markupFor(rows,chiefs=[],options={}){
  const live=home.slice(home.indexOf("  function premiumBackMarkup(){"),home.indexOf("  function premiumPersonMarkup("));
  assert(live.startsWith("  function premiumBackMarkup(){"),"Markup function not isolated");
  return vm.runInNewContext(live+"\npremiumBackMarkup();",{
    liveRoster:()=>({rows,chiefs,permitted:true,loaded:true,...options}),
    has:()=>true,
    premiumShiftGroups:items=>{
      const grouped=new Map();
      for(const item of items){if(!grouped.has(item.code))grouped.set(item.code,[]);grouped.get(item.code).push(item);}
      return [...grouped].sort((a,b)=>({M:0,J:1,J4:2,S:3,N:4}[a[0]]??9)-({M:0,J:1,J4:2,S:3,N:4}[b[0]]??9));
    },
    liveShiftClass:code=>"shift-"+code.toLowerCase(),
    premiumShiftName:code=>({M:"Matin",J:"Journée",J4:"J4",S:"Soir",N:"Nuit"})[code]||code,
    liveWorkInterval:item=>({label:item.code==="J"?"08h30–16h20":"13h30–21h00"}),
    esc:s=>String(s)
  });
}
const withChief=markupFor(onlyActive,[mockRow("J","C1")]);
assert.equal((withChief.match(/data-premium-roster="/g)||[]).length,3,"Two active shifts plus one chief");
assert.match(withChief,/data-premium-roster="J"/);
assert.match(withChief,/data-premium-roster="S"/);
assert.match(withChief,/data-premium-roster="chiefs"/);
assert.doesNotMatch(withChief,/data-premium-roster="N"/,"Night not shown before its real start");
assert.doesNotMatch(withChief,/data-premium-roster="M"/,"Finished mornings not shown");
assert.match(withChief,/strong>3<\/strong>/,"Only non-chief agents in total");
const noChief=markupFor(onlyActive);
assert.doesNotMatch(noChief,/data-premium-roster="chiefs"/,"Chief line hidden if none active");
assert.equal((noChief.match(/data-premium-roster="/g)||[]).length,2);
assert.doesNotMatch(noChief,/<details/,"No expanding content within the fixed card");
assert.match(home,/ghe-top-aux-actions/);
assert.match(iconCss,/\.ghe-home-bell\{[\s\S]*?margin-left:clamp/);
assert.match(home,/requestAnimationFrame\(\(\)=>\{/);
assert.match(home,/data-ghe-drawer-action/);
assert.match(home,/window\.STIPFavorites\.open\(\)/);
assert.match(home,/window\.STIPRouter\.set\("communication\/fauteuils"\)/);
const stageClose=card.indexOf("      '</div></div>'+");
const shift=card.indexOf('(!restMode?\'<div class="thf-day-post');
assert(stageClose>=0 && shift>stageClose,"Shift belongs after weather stage");
assert.match(card,/class="thf-day-card thf-weather-sky/);
assert.match(wx,/card\.dataset\.sky=values\.sky/);
assert.match(weatherCss,/Whole-card weather atmosphere/);
assert.match(icon,/data-open-full-chat/);
assert.match(icon,/chat\.mount\(/);
assert.match(icon,/notification_rules_set/);
assert.match(icon,/\[data-building\]/);
assert.match(icon,/\[data-rule\]/);
const v=index.match(/name="stip-ui-build" content="([^"]+)"/)?.[1];
assert(v);
for(const p of ["home-shell.js","team-home-fusion.js","team-home-fusion.css","shift-weather-mini.js","ghe-notification-controls.js","ghe-notification-controls.css","ghe-premium-safe-flip.css","stip-loader.js","stip-sw.js"])
  assert(index.includes(p+"?v="+v),p+" cache not synchronized");
assert(loader.includes('V = "'+v+'"') && worker.includes('STIP_SW_BUILD="'+v+'"'));

const actionStart=home.indexOf("  const doAction=action=>{");
const actionEnd=home.indexOf('  trigger.addEventListener("click"',actionStart);
assert(actionStart>=0&&actionEnd>actionStart);
const actionSource=home.slice(actionStart,actionEnd);
const events=[], frames=[];
const context={
  close:()=>events.push("close"),
  requestAnimationFrame:callback=>frames.push(callback),
  has:()=>true,
  window:{
    STIPFavorites:{open:()=>events.push("apps")},
    STIPRouter:{set:route=>events.push(route)},
    GHENotificationControls:{openWheelchairs:()=>events.push("chair-popup")}
  },
  openWidget:kind=>events.push("widget:"+kind),
  openNotifications:()=>events.push("bell"),
  openHeaderDirectorySearch:()=>events.push("directory"),
  openApp:kind=>events.push("app:"+kind),
  location:{href:""}
};
const action=vm.runInNewContext(actionSource+"\nthis.doAction=doAction;doAction;",context);
for(const [key,expected] of [
  ["apps","apps"],["recent","bell"],["places","app:places"],
  ["communication","app:communication"],["wheelchairs","communication/fauteuils"],
  ["planning","app:personal"],["agents","directory"],["future","widget:future"]]){
  events.length=0;
  action(key);
  assert.deepEqual(events,["close"],key+" must close drawer first");
  assert.equal(frames.length,1,key+" must schedule one navigation");
  frames.shift()();
  assert.equal(events.at(-1),expected,key+" did not open its destination");
}

console.log("GHE 7 accueil behavior / cache invariants OK");
