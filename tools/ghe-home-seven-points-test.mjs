import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
const file=p=>readFileSync(p,"utf8");
const home=file("home-shell.js"),css=file("ghe-premium-safe-flip.css");
const card=file("team-home-fusion.js"),weatherCss=file("team-home-fusion.css");
const icon=file("ghe-notification-controls.js"),iconCss=file("ghe-notification-controls.css");
const wx=file("shift-weather-mini.js"),index=file("index.html");
const loader=file("stip-loader.js"),worker=file("stip-sw.js");
assert(css.includes("transform:translateX(-clamp(92px,28vw,132px))!important;"),"En direct launcher must move further left");
assert(index.includes("ghe-premium-safe-flip.css?v=20261018-rest-pictograms1&rev=live-modal1-left-launch4"),"Refresh the left-shifted live button CSS cache");
// En direct : seuls les shifts occupés à l'instant sont rendus.
// Une ligne Chef n'existe que pour un chef effectivement planifié maintenant.
const chiefScript=file("home-duty-chief.js");
assert.match(home,/liveCurrentlyWorking\(item,now\)/);
assert.match(home,/window\.STIPDutyChiefs\?\.liveSnapshot\?\.\(\)/);
assert.match(chiefScript,/liveSnapshot\(\)/);
assert.match(chiefScript,/stip:duty-chiefs-updated/);
assert.match(chiefScript,/if \(window\.STIPDutyChiefs\) return;/);
assert.match(chiefScript,/stip:home-rendered".*fetchDuty\(\)/);
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
assert.match(css,/transform:translateX\(-clamp\(92px,28vw,132px\)\)!important/,"Live shortcut moves left");
assert.match(css,/\.ghe-premium-now-modal-content\{[\s\S]*?overflow-y:auto/);
const mockRow=(code,id)=>({code,agents:{source_key:id,prenom:id,nom:"Test"}});
const onlyActive=[mockRow("J","J1"),mockRow("J","J2"),mockRow("S","S1")];
function markupFor(rows,chiefs=[],options={}){
  const live=home.slice(home.indexOf("  function premiumBackMarkup(){"),home.indexOf("  function premiumPersonMarkup("));
  assert(live.startsWith("  function premiumBackMarkup(){"),"Markup function not isolated");
  return vm.runInNewContext(live+"\npremiumBackMarkup();",{
    liveRoster:()=>({rows,chiefs,people:[...rows,...chiefs],permitted:true,loaded:true,...options}),
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
assert.equal((withChief.match(/data-premium-roster="/g)||[]).length,4,"Total action plus two active shifts and one chief");
assert.match(withChief,/data-premium-roster="all"/,"Total headcount opens all agents");
assert.match(withChief,/data-premium-roster="J"/);
assert.match(withChief,/data-premium-roster="S"/);
assert.match(withChief,/data-premium-roster="chiefs"/);
assert.doesNotMatch(withChief,/Rechercher un agent|data-premium-agent-search/,"No search action in En direct");
assert.match(withChief,/Selon le planning · présence réelle non confirmée/,"Source caveat remains explicit");
assert.doesNotMatch(withChief,/data-premium-roster="N"/,"Night not shown before its real start");
assert.doesNotMatch(withChief,/data-premium-roster="M"/,"Finished mornings not shown");
assert.match(withChief,/strong>4<\/strong>/,"The total includes the three agents and one chief");
const noChief=markupFor(onlyActive);
assert.doesNotMatch(noChief,/data-premium-roster="chiefs"/,"Chief line hidden if none active");
assert.equal((noChief.match(/data-premium-roster="/g)||[]).length,3);
assert.doesNotMatch(noChief,/<details/,"No expanding content within the fixed card");
assert.doesNotMatch(home,/ghe-top-aux-actions/,"Header shortcuts moved into the rail");
assert.match(file("ghe-smart-drawer.js"),/data-smart-chat-open/,"Messages stay available from the rail");
assert.match(file("ghe-smart-drawer.js"),/data-smart-settings-open/,"Notification settings stay available from the rail");
assert.match(iconCss,/\.ghe-home-bell\{[\s\S]*?margin-left:clamp/);
assert.match(home,/requestAnimationFrame\(\(\)=>\{/);
assert.match(home,/data-ghe-drawer-action/);
assert.match(home,/window\.STIPFavorites\.open\(\)/);
assert.match(home,/window\.STIPRouter\.set\("communication\/fauteuils"\)/);
const stage=card.indexOf('class="thf-weather-stage thf-weather-sky"');
const shift=card.indexOf('\'<div class="thf-day-post ',stage);
const weatherBody=card.indexOf('class="thf-weather-body"',shift);
assert(stage>=0 && shift>stage && weatherBody>shift,"Shift actions occupy the illustrated area of the weather stage");
assert.match(card,/thf-rest-illustration/,"Original rest illustration must remain visible");
assert.match(card,/thf-rest-caption/,"Rest caption must remain under its illustration");
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
assert(index.includes("home-duty-chief.js?v="+v),"Chef source must load on GHE home");

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

/* Choice-first navigation: keep the current UI build and existing handlers intact. */
const master=file("ghe-choice-master.js"),smartDrawer=file("ghe-smart-drawer.js"),smartCss=file("ghe-smart-drawer.css");
new vm.Script(master,{filename:"ghe-choice-master.js"});
new vm.Script(smartDrawer,{filename:"ghe-smart-drawer.js"});
assert.match(master,/data-choice-go/);
assert.match(master,/replay=true/);
assert.match(master,/event\.stopImmediatePropagation\(\)/);
assert.match(master,/ghe-smart-active/);
assert.match(master,/new URL\(href,location\.href\)\.origin===location\.origin/);
assert.match(master,/#homeView button\[data-app\]/);
assert.match(smartDrawer,/ghe-smart-calendar-glyph/);
assert.match(smartDrawer,/entry\.date\.slice\(-2\)/);
assert.match(smartDrawer,/ghe-smart-top-divider/);
assert.match(smartCss,/\.ghe-smart-calendar-cap/);
assert.match(smartCss,/#gheSmartRail \.ghe-smart-head #gheSmartExpand/);
assert.match(smartCss,/dialog#gheChoiceMasterDialog::backdrop/);
assert.match(index,/ghe-choice-master\.js\?v=\d{8}-[a-z0-9-]+/);
assert(index.indexOf("ghe-choice-master.js?v=")<index.indexOf("ghe-smart-drawer.js?v="));


/* Compact dates are grouped; expanded view retains one original icon per event. */
const smartDates=file("ghe-smart-drawer.js"),smartDatesCss=file("ghe-smart-drawer.css"),choiceDates=file("ghe-choice-master.js");

/* The home agenda 360 has one vertical scroll owner: the document itself. */
assert.match(smartDatesCss, /#homeView \.ghe-agenda360\{[^}]*overflow:clip;[\s\S]*?touch-action:pan-y pinch-zoom\}/,
 "the 360 card must never consume a nested touch scroll");
assert.match(smartDatesCss, /#homeView \.ghe-agenda360 \.hc-feedback-list\{[^}]*max-height:none;[^}]*overflow:visible;[^}]*overscroll-behavior:auto;/,
 "all pending feedback items are laid out fully and the page owns scroll");
assert.doesNotMatch(smartDatesCss, /#homeView \.ghe-agenda360 \.hc-feedback-list\{[^}]*overflow-y:auto/,
 "no nested scroll on the feedback face");

const dateStart=smartDates.indexOf("function appointmentDays(entries){");
const dateEnd=smartDates.indexOf("function calendarIcon(date){",dateStart);
assert(dateStart>=0&&dateEnd>dateStart,"Date grouping function must exist");
const dateInputs=[
 {kind:"event",date:"2026-10-24",title:"Musculation"},
 {kind:"professional",date:"2026-10-19",title:"Échange"},
 {kind:"event",date:"2026-10-24",title:"Autre événement"},
 {kind:"pending",date:"2026-10-24",title:"À traiter"},
 {kind:"event",date:"2026-10-25",title:"Musculation"},
 {kind:"cancelled",date:"2026-10-19",title:"Ancienne date annulée"}
];
const grouped=vm.runInNewContext(smartDates.slice(dateStart,dateEnd)+"\nappointmentDays("+JSON.stringify(dateInputs)+");",{});
assert.deepEqual(JSON.parse(JSON.stringify(grouped.map(d=>[d.date,d.items.length]))),[
 ["2026-10-19",2],["2026-10-24",2],["2026-10-25",1]
]);
for(const phrase of ["appointmentDays(entries)","function openRdvDialog()","group.items.map(item=>{","function openAppointmentDay(date)","if(links.length===1)","ghe-smart-date-count","data-smart-day-pick","data-smart-rdv-open"])assert(smartDates.includes(phrase),phrase);
for(const phrase of [".ghe-smart-date-details{display:none!important",".ghe-smart-date-button{display:none!important","dialog#gheSmartDayDialog::backdrop"])assert(smartDatesCss.includes(phrase),phrase);
assert(choiceDates.includes('class="ghe-choice-icon"'),"Preserve event icon in detail popup");
const drawerAssetVersions=["ghe-smart-drawer.css","ghe-smart-drawer.js","ghe-choice-master.js"].map(name=>{
 const match=index.match(new RegExp(name.replace(".","\\.")+"\\?v=([0-9]{8}-[a-z0-9-]+)"));
 assert(match,"Cache version missing for "+name);return match[1];
});
assert.equal(new Set(drawerAssetVersions).size,1,"Choice popup and drawer must share one cache version");


/* Home "À clôturer": oldest visible event day first, same day earliest time first. */
const feedbackOrderSource=file("event-feedback.js");
const feedbackOrderStart=feedbackOrderSource.indexOf("  function passedEvents() {");
const feedbackOrderEnd=feedbackOrderSource.indexOf("  function pendingEvents() {", feedbackOrderStart);
assert(feedbackOrderStart>=0&&feedbackOrderEnd>feedbackOrderStart,
  "the canonical feedback date comparator must remain testable");
const feedbackOrderRows=[
  {eventKey:"old",date:"2026-10-03",endDate:"2026-10-03",due:"2026-10-29T10:00",title:"Ancien"},
  {eventKey:"recent-early",date:"2026-10-17",endDate:"2026-10-17",due:"2026-10-17T12:00",title:"Recent matin"},
  {eventKey:"recent-late",date:"2026-10-17",endDate:"2026-10-17",due:"2026-10-17T19:00",title:"Recent soir"},
  {eventKey:"middle",date:"2026-10-12",endDate:"2026-10-12",due:"2026-10-12T18:00",title:"Intermediaire"}
];
const feedbackOrdered=vm.runInNewContext(
  feedbackOrderSource.slice(feedbackOrderStart,feedbackOrderEnd)+"\npassedEvents();",
  {normalizeEvents:()=>feedbackOrderRows,parisStamp:()=>"2026-10-30T12:00"}
);
assert.deepEqual(Array.from(feedbackOrdered,item=>item.eventKey),
  ["old","middle","recent-early","recent-late"],
  "À clôturer must begin with oldest visible date, regardless of internal due timestamp");
assert.match(feedbackOrderSource,/const datedCards=pending\.map\(/,
  "date separators must inherit the same oldest-first pending order");

/* Propositions des collègues are appointment-side; only feedback activates À clôturer. */
const agenda360=home.slice(home.indexOf("function agenda360Markup()"),home.indexOf("function bindAgenda360("));
const feedbackFace=agenda360.slice(agenda360.indexOf('data-agenda360-face="front"'),agenda360.indexOf('data-agenda360-face="back"'));
const appointmentsFace=agenda360.slice(agenda360.indexOf('data-agenda360-face="back"'));
assert.doesNotMatch(feedbackFace,/data-agenda360-proposals/);
assert.match(appointmentsFace,/data-agenda360-proposals/);
assert.match(agenda360,/const hasOpen=feedback\.length>0;/);
assert.match(home,/const available=feedback;/);
assert.match(home,/GHESmartChoices\?\.show\?\.\("proposals"\)/);
assert.match(css,/transform:translateX\(-clamp\(92px,28vw,132px\)\)!important;/,
  "The top red En direct launcher must shift left without moving the bell or menu");
