import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const activeHome=read("ensemble-home.js");
const activePage=read("ensemble-v3.js");
const publicPage=read("sorties-loisirs.html");
const today="2099-10-22";

let payload={events:[]},lastAction="";
const callbacks=new Map();
const document={
 readyState:"loading", hidden:false,
 addEventListener:(name,cb)=>callbacks.set(name,cb),
 getElementById:()=>null,
 querySelector:()=>null
};
const location={href:"https://ghe.esapin.com/index.html",search:""};
const window={
 addEventListener:()=>{},dispatchEvent:()=>{}
};
vm.runInNewContext(activeHome,{
 window,document,location,localStorage:{getItem:()=>"valid-session"},
 Date,Intl,Set,Map,Event:class{constructor(name){this.type=name}},console,
 fetch:async(_url,options)=>{
  lastAction=JSON.parse(options.body).action;
  return {ok:true,json:async()=>payload};
 }
});
assert.ok(window.STIPLeisure,"The homepage must expose the canonical leisure adapter");

const invite={
 id:"event-1",title:"Foot <test>",icon:"⚽",dates:[today],visible_dates:[today],
 invitation_status:"pending",needs_response:true,response:null,is_organizer:false,
 revision:3,schedule_mode:"fixed",time_label:"19:00",status:"active",
 location:"À définir",date_roster:{[today]:[
  {agent_id:"organizer",state:"organizer",compatible:true},
  {agent_id:"guest",state:"pending",compatible:true}
 ]}
};
payload={events:[invite]};
await window.STIPLeisure.refresh(true);
assert.equal(lastAction,"list","The homepage uses the existing stip-leisure list action");
assert.match(window.STIPLeisure.pendingHTML(),/Foot &lt;test&gt;/,"Output escapes event names");
assert.match(window.STIPLeisure.pendingHTML(),/data-ev3-preview="event-1"/);
assert.ok(window.STIPLeisure.notificationItems().some(x=>x.event_id==="event-1"));
assert.ok(window.STIPLeisure.drawerDates().some(x=>x.id==="event-1"&&x.confirmed===false),
 "An unanswered proposal is not shown as a confirmed outing");
assert.deepEqual(Array.from(window.STIPLeisure.dayItems(today)),[],
 "An unanswered event must not be added to the confirmed personal agenda");

invite.response={selected_dates:[today],declined:false,revision:3};
invite.needs_response=false;
invite.date_roster[today][1].state="accepted";
await window.STIPLeisure.refresh(true);
assert.equal(window.STIPLeisure.pendingHTML(),"","An accepted invitation disappears from the pending area");
assert.equal(window.STIPLeisure.dayItems(today).length,1,"Confirmed plans appear once in the shared agenda");
assert.ok(window.STIPLeisure.drawerDates().some(x=>x.confirmed===true));

invite.response={selected_dates:[],declined:true,revision:3};
await window.STIPLeisure.refresh(true);
assert.equal(window.STIPLeisure.pendingHTML(),"","Declined invitation is not pending");
assert.equal(window.STIPLeisure.dayItems(today).length,0,"Declined invitation is not a calendar event");

invite.status="cancelled";invite.needs_response=false;
await window.STIPLeisure.refresh(true);
assert.equal(window.STIPLeisure.drawerDates().length,0,"Cancelled outings are not future appointments");

window.STIPLeisure.setTab("invitations");
assert.match(location.href,/tab=invitations/,"The existing homepage adapter opens the single invitations page");
window.STIPLeisure.setTab("dispos");
assert.match(location.href,/tab=dispos/,"The single page handles availability requests");
window.STIPLeisure.openCreator();
assert.match(location.href,/tab=create/,"Creation routes to the same page");

assert.match(publicPage,/ensemble-v3.js/);
assert.doesNotMatch(publicPage,/leisure-runtime.js/);
assert.match(activePage,/function setView\(view\)/);
assert.match(activePage,/call\("matches",\{target_agent_id:id\}\)/,"Real shift compatibility remains server driven");
assert.match(activePage,/create_ensemble/,"The same existing backend creates events");
assert.match(activePage,/data-ev3-uninvite/,"Removing participants remains available");
assert.match(activePage,/series_conversation_id/,"Events remain attached to the canonical group conversation");
assert.match(activePage,/revision:e\.revision/,"Answers and changes keep optimistic locking");

const backend=read("supabase/functions/stip-leisure/index.ts");
for(const invariant of [
 "stip_leisure_sync_series_chat","stip_leisure_respond","stip_leisure_save",
 "stip_leisure_delete_event","notifyPhone","SESSION_STIP_REQUISE"
])assert.ok(backend.includes(invariant),"Missing backend invariant: "+invariant);
const quick=read("quick-access.js"),drawer=read("home-shell.js");
assert.match(quick,/leisure: \{ label: "On se retrouve"/);
assert.match(drawer,/title:"On se retrouve"/);
assert.match(drawer,/sorties-loisirs\.html/);
const main=read("index.html"),lab=read("t-est/accueil/accueil-modules-natifs.js");
assert.match(main,/ensemble-home.js/);
assert.match(lab,/STIPEnsembleV3\.setView/);
assert.ok(!existsSync(new URL("../leisure-runtime.js",import.meta.url)),
 "Obsolete second leisure engine must not remain in this repository");
assert.ok(!existsSync(new URL("../ensemble-create.js",import.meta.url)),
 "Obsolete second composer must not remain in this repository");
console.log("PASS — loisirs unifiés : événements, réponses, agenda, discussions, routage, source unique et moteur actif.");
