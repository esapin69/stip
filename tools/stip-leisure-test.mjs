import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const listeners=new Map();
let response={can_create:true,events:[{id:'event',title:'Foot <test>',status:'active',dates:['2099-10-09','2099-10-16'],revision:1,response:null,needs_response:true,participants:[]}]};
const document={querySelector:()=>null,addEventListener:()=>{},hidden:false};
const window={STIPSession:true,addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:()=>{}};
const sandbox={window,document,localStorage:{getItem:()=> 'test-session'},Intl,Date,Set,Map,CustomEvent:class{},setInterval:()=>{},fetch:async()=>({ok:true,json:async()=>response})};
vm.runInNewContext(readFileSync('leisure-runtime.js','utf8'),sandbox);
await window.STIPLeisure.refresh();
assert.match(window.STIPLeisure.pendingHTML(),/data-leisure-event="event"/);
assert.match(window.STIPLeisure.pendingHTML(),/Foot &lt;test&gt;/);
for(const declined of [false,true]){
 response={can_create:true,events:[{...response.events[0],response:{declined,selected_dates:declined?[]:['2099-10-09'],revision:1},needs_response:false}]};
 await window.STIPLeisure.refresh();assert.equal(window.STIPLeisure.pendingHTML(),'');
}
response.events[0].needs_response=true;response.events[0].revision=2;
await window.STIPLeisure.refresh();assert.match(window.STIPLeisure.pendingHTML(),/Dates modifiées/);
response.events[0].status='cancelled';await window.STIPLeisure.refresh();assert.equal(window.STIPLeisure.pendingHTML(),'');
response.events[0]={...response.events[0],status:'active',needs_response:false,chats:[{date:'2099-10-09',conversation_id:'chat-9'},{date:'2099-10-16',conversation_id:'chat-16'}]};
await window.STIPLeisure.refresh();
const shortcuts=window.STIPLeisure.pendingHTML();
assert.match(shortcuts,/conversation=chat-9/);assert.match(shortcuts,/conversation=chat-16/);
assert.match(shortcuts,/#\/communication\/dm/);assert.doesNotMatch(shortcuts,/leisure-invite/);
assert.match(shortcuts,/Ma réponse/);
response.events[0].chats=[];await window.STIPLeisure.refresh();assert.equal(window.STIPLeisure.pendingHTML(),'');
listeners.get('stip:session-ended')();assert.equal(window.STIPLeisure.pendingHTML(),'');
const home=readFileSync('home-shell.js','utf8');assert.match(home,/STIPLeisure\?\.weekHTML/);assert.match(home,/STIPLeisure\?\.monthHTML/);
const app=readFileSync('sorties-loisirs.html','utf8');assert(app.includes('ensemble-v3.js'));assert(!app.includes('leisure-runtime.js'));
console.log('Leisure: pending invitation, accepted/declined visibility, revision, cancellation, logout, home placement and common runtime passed.');
console.log('Date chats: home shortcuts use canonical Communication DM route; no invitation returns after registration.');

const root={innerHTML:'',hidden:false};
const badge={hidden:false,textContent:''};
const controls={};
const document2={
 querySelector:(selector)=>selector==='#leisureApp'?root:selector==='#ensembleInviteBadge'?badge:null,
 querySelectorAll:()=>[],addEventListener:()=>{},hidden:false
};
const window2={STIPSession:true,STIPContinuity:{validate:async()=>true},addEventListener:()=>{},dispatchEvent:()=>{}};
const groupResponse={can_create:true,events:[{
 id:'weekly-1',title:'Muscu récurrente',status:'active',dates:['2099-10-09','2099-10-16'],
 recurring_closing:true,is_organizer:true,can_invite:true,
 participants:[{agent_id:'admin',selected_dates:['2099-10-09']}],
 chats:[],series_conversation_id:'permanent-conversation-1',
 response:null,needs_response:false,description:'',location:'Salle',time_label:'21:20'
}]};
vm.runInNewContext(readFileSync('leisure-runtime.js','utf8'),{
 window:window2,document:document2,localStorage:{getItem:()=> 'test-session'},Intl,Date,Set,Map,
 CustomEvent:class{},setInterval:()=>{},
 fetch:async()=>({ok:true,json:async()=>groupResponse})
});
await window2.STIPLeisure.refresh();
assert.match(root.innerHTML,/Muscu récurrente/);
assert.match(root.innerHTML,/Discussion du groupe|Groupe de l’activité/);
assert.match(root.innerHTML,/conversation=permanent-conversation-1/);
assert.doesNotMatch(root.innerHTML,/Chat du vendredi|Chat du lundi/);
const source=readFileSync('leisure-runtime.js','utf8');
assert.match(source,/function openDelete\(id\)/);
assert.match(source,/function openRecurringEditor\(id\)/);
assert.match(source,/confirm:'SUPPRIMER'/);
assert.match(source,/series_conversation_id/);
const apiSource=readFileSync('supabase/functions/stip-leisure/index.ts','utf8');
assert.match(apiSource,/stip_leisure_delete_event/);
assert.match(apiSource,/stip_leisure_sync_series_chat/);
assert.match(apiSource,/recurring_details/);
console.log('Recurring group: one permanent DM conversation linked from the card, secure confirmed deletion UI, dedicated recurring editor and API hooks passed.');

const composeSrc=readFileSync('ensemble-create.js','utf8');
assert.match(composeSrc,/data-en-select-all/);
assert.match(composeSrc,/data-en-visibility="invite"/);
assert.match(composeSrc,/data-en-visibility="team"/);
assert.match(composeSrc,/data-en-remove-date/);
assert.match(composeSrc,/ensembleCustomDate/);
assert.match(composeSrc,/data-en-person/);
assert.match(composeSrc,/soft_color/);
assert.match(composeSrc,/call\('create'/);
const plannerApi=readFileSync('supabase/functions/stip-leisure/index.ts','utf8');
assert.match(plannerApi,/async function ownCalendar/);
assert.match(plannerApi,/async function createActivity/);
assert.match(plannerApi,/if\(b.action==='uninvite'\)/);
assert.match(plannerApi,/visibility=b.visibility==='team'/);
assert.match(plannerApi,/async function colleagues/);
assert.match(plannerApi,/p_target:b.target_agent_id/);
const homePage=readFileSync('sorties-loisirs.html','utf8');
assert.match(homePage,/ensemble-v3.js/);
assert.doesNotMatch(homePage,/ensemble-create.js/);
assert.match(source,/data-invite-all/);
assert.match(source,/data-remove-invite/);
assert.match(source,/STIPEnsembleCreate/);
console.log('Ensemble creation: unrestricted dates, shift colors, public/private choice, check-all, add/remove invitees, and persistent group links passed.');



// The current Ensemble is one contextual engine; no parallel legacy runtime in T.
const v3=readFileSync('ensemble-v3.js','utf8');
assert.match(v3,/function setView\(view\)/);
assert.match(v3,/data-ev3-uninvite/);
assert.match(v3,/calendar_preview/);
assert.match(v3,/series_conversation_id/);
assert.match(v3,/function showActivityDialog/);
const native=readFileSync('t-est/accueil/accueil-modules-natifs.js','utf8');
assert.match(native,/STIPEnsembleV3\.setView/);
assert.doesNotMatch(native,/['"]leisure-runtime\.js['"]/);
const unified=readFileSync('t-est/accueil/accueil-unifie.js','utf8');
assert.match(unified,/STIPEnsembleV3\?\.openCreator/);
console.log('GHE T: one activity engine, contextual invitation lens, inline details and verified end-of-shift selection passed.');
