import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const rail=read("ghe-smart-drawer.js"),page=read("ghe-invitations.js"),shell=read("home-shell.js");
const api=read("supabase/functions/stip-leisure/index.ts");
const sql=read("supabase/migrations/20261016151500_ghe_smart_event_choices_and_date_alerts.sql");
const home=read("index.html"),leisure=read("sorties-loisirs.html");
for (const file of [home,leisure]) {
 assert.match(file,/ghe-smart-drawer\.css/,"styles deployed on main entrypoints");
 assert.match(file,/ghe-smart-drawer\.js/,"rail loaded on main entrypoints");
}
assert.match(rail,/\["closed","compact","expanded"\]/,"three positions");
assert.match(rail,/entries\.sort/,"chronological queue");
assert.match(rail,/ghe-agenda\.html/,"one dedicated page for pending work");
assert.match(rail,/series_conversation_id|ghe:agenda-change/,"refresh tied to canonical events");
assert.match(page,/data-day-decision/);
assert.match(page,/call\("respond_day"/,"response written through server");
assert.match(page,/data-show-roster/,"roster actionable");
assert.match(page,/series_conversation_id/,"one canonical group chat");
assert.match(shell,/STIPDrawerAppointments/,"existing professional dates retained");
assert.match(api,/b.action==='respond_day'/,"backend decision action");
assert.match(api,/stip_leisure_answer_day/,"server per-date RPC");
assert.match(sql,/stip_leisure_date_decisions/);
assert.match(sql,/stip_leisure_dates_changed_log/);
assert.match(sql,/old_responses/,"change history preserved");
assert.doesNotMatch(rail,/rail\.showModal\(/,"the rail itself must never become a dialog");
assert.match(rail,/data-smart-pending-open/,"only one shared pending action entry");
assert.match(rail,/function openPendingDialog\(/,"shared action opens a real popup");
assert.match(rail,/group\.items\.map/,"each pending item retains its event icon");
assert.match(rail,/STIPDrawerActionItems/,"professional actions share the same inbox");
assert.match(rail,/ghe-action-inbox\.svg/,"unique visual identity for action group");
assert.match(shell,/STIPDrawerActionItems/,"professional action source is wired");

assert.match(read("ghe-smart-drawer.js"),/date_change_history/,"rail exposes cancelled historical dates");
assert.match(read("ghe-invitations.js"),/is-cancelled/,"pending page shows cancelled original dates");
assert.match(api,/date_change_history/,"backend supplies changes and old dates");
const retention=read("supabase/migrations/20261016162000_ghe_ephemeral_chat_retention.sql");
assert.match(retention,/stip_purge_expired_leisure/,"event + seven-day retention task");
assert.match(retention,/stip_leisure_series_chat/,"preserve active canonical event chats");
assert.match(retention,/leisure_response_chat_sync/,"disable legacy per-day chat creation");
const decline=read("supabase/migrations/20261016163000_ghe_leave_declined_event_chat.sql");
assert.match(decline,/status <> 'declined'/,"declined participants leave the group");
const communication=read("COMMUNICATION_RULES.md");
assert.match(communication,/refus global.*retire/i,"shared communications contract excludes global refusals");
// Regression: an organizer's ten proposals are not ten confirmed events.
import vm from "node:vm";
const groupedSource=rail.slice(rail.indexOf("function groupedEntries(){"),rail.indexOf("function link(entry){"));
assert(groupedSource.startsWith("function groupedEntries(){"),"group source available");
const event={
 id:"muscu",title:"Muscu",icon:"🏋️",is_organizer:true,status:"active",
 dates:["2026-10-16","2026-10-19","2026-10-20"],date_roster:{
  "2026-10-16":[{state:"organizer",compatible:true}],
  "2026-10-19":[{state:"organizer",compatible:true}],
  "2026-10-20":[{state:"organizer",compatible:true}]
 }
};
const actions=[{id:"leave-1",title:"Demande de congés",type:"leave",date:"2026-10-23"}];
const context={
 events:[event],today:()=>"2026-10-16",dlabel:s=>s,
 window:{
  STIPDrawerAppointments:()=>({groups:[{key:"upcoming",items:[]},{key:"feedback",items:[]}]}),
  STIPDrawerActionItems:()=>actions
 },
 route:s=>"/"+s,urlForEvent:e=>"/leisure/"+e.id,encodeURIComponent
};
const entries=()=>vm.runInNewContext(groupedSource+";groupedEntries();",context);
let result=entries(),groups=result.filter(x=>x.kind==="pending");
assert.equal(result.filter(x=>x.kind==="event").length,0,"no date has accepted participants yet");
assert.equal(groups.length,1,"exactly one universal pending icon");
assert.equal(groups[0].count,4,"three Muscu dates and one professional action are grouped");
assert.equal(groups[0].date,"2026-10-16","group appears at the nearest pending date");
event.date_roster["2026-10-19"].push({state:"accepted",compatible:true});
result=entries();groups=result.filter(x=>x.kind==="pending");
assert.equal(result.filter(x=>x.kind==="event").length,1,"only the date with an actual confirmed participant appears");
assert.equal(result.find(x=>x.kind==="event").date,"2026-10-19");
assert.equal(groups.length,1,"other unconfirmed dates remain under one icon");
assert.equal(groups[0].count,3,"remaining two dates and professional action grouped");
assert.match(rail,/data-smart-pending-open/,"single action icon opens the shared popup");
assert.match(rail,/gheSmartExpand/,"one exterior bookmark-like chevron");
assert.doesNotMatch(rail,/data-ctrl="expand"/,"no second arrow inside the header");
assert.match(rail,/ghe-smart-close/,"expanded mode has one top-right close cross");
assert.match(rail,/setMode\(mode==="closed"\?"compact":"closed"\)/,"original hamburger opens the compact drawer");
assert.match(rail,/if\(reopen\)\{event.preventDefault\(\);setMode\("compact"\)/,"three bars reopen to icons");
assert.match(rail,/mode==="expanded"&&!document.getElementById/,"outside tap collapses to icons");
assert.match(rail,/ghe-smart-admin-tools/,"nonessential shortcuts are behind Admin");
assert.match(rail,/const destination=event.target.closest/,"destination collapses to icons");
const style=read("ghe-smart-drawer.css");
assert.match(style,/\.ghe-smart-expand-tab/,"one exterior arrow style");
assert.match(style,/\.ghe-smart-rail[^\n]*background:#fff/,"solid white drawer surface");
assert.match(style,/data-smart-drawer="closed"\] #homeView \[data-shortcuts-open\]/,"hamburger visible only when closed");
assert.match(read("ensemble-v3.js"),/deepLinked=true;openEvent\(id,\{inline:true\}\)/,"direct activity links render a single inline detail page");
assert.match(read("ensemble-v3.css"),/\.ev3-inline-detail/,"inline detail receives page layout");
console.log("GHE smart drawer contract passed.");
