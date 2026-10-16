import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
const file=p=>readFileSync(p,"utf8");
const home=file("home-shell.js"),css=file("ghe-premium-safe-flip.css");
const card=file("team-home-fusion.js"),weatherCss=file("team-home-fusion.css");
const icon=file("ghe-notification-controls.js"),iconCss=file("ghe-notification-controls.css");
const wx=file("shift-weather-mini.js"),index=file("index.html");
const loader=file("stip-loader.js"),worker=file("stip-sw.js");
assert.match(home,/items\.slice\(0,2\)\.map\(personMarkup\)/);
assert.match(home,/ghe-premium-now-more/);
assert.match(css,/\.ghe-premium-now-more>summary/);
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
