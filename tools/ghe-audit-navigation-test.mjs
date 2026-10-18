import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const invitations=read('ghe-invitations.js');
const decideSource=invitations.slice(invitations.indexOf('async function decide('),invitations.indexOf('\nfunction showRoster'));
async function invitationCase({failure=false,blocked=false,switchSession=false}={}){
 let token='session-a',resolve;
 const pending=new Promise(r=>resolve=r),busy=new Set(),renders=[],notifications=[];
 const event={id:'activity',revision:2,dates:['2099-01-02'],visible_dates:blocked?[]:['2099-01-02']};
 const buttons=[{disabled:false},{disabled:false},{disabled:false}],message={textContent:''};
 const context={events:[event],busy,authToken:token,STORE:'session',selected:()=> 'neutral',CSS:{escape:s=>s},
  localStorage:{getItem:()=>token},host:{querySelector:()=>message,querySelectorAll:()=>buttons},
  render:()=>{renders.push(busy.has('activity|2099-01-02'));buttons.forEach(b=>b.disabled=busy.size>0)},
  window:{dispatchEvent:event=>notifications.push(event)},Event:class{constructor(type){this.type=type}},
  call:async(_action,_payload,requestToken)=>{assert.equal(requestToken,'session-a');await pending;if(failure)throw Error('Connexion interrompue');return {events:[{...event,title:'saved'}]}}
 };
 const decide=vm.runInNewContext(decideSource+';decide;',context);
 const job=decide('activity','2099-01-02','yes');
 if(blocked){await job;assert.equal(busy.size,0);assert.equal(renders.length,0);return;}
 assert(buttons.every(b=>b.disabled),'lock the date while the request is pending');
 const duplicate=decide('activity','2099-01-02','yes');await duplicate;
 if(switchSession)token='session-b';
 resolve();await job;
 assert.equal(busy.size,0,'always release the pending lock');
 if(switchSession){assert.equal(context.events[0].title,undefined,'old result cannot overwrite a new session');assert.equal(renders.length,0);return;}
 assert.deepEqual(renders,[false],'render only after releasing the pending lock');
 assert(buttons.every(b=>!b.disabled),'buttons can be used after the response');
 assert.equal(notifications.length,failure?0:1,'publish updates only after successful save');
 if(failure)assert.equal(message.textContent,'Connexion interrompue');
}
await invitationCase();await invitationCase({failure:true});await invitationCase({blocked:true});await invitationCase({switchSession:true});
const rail=read('ghe-smart-drawer.js'),css=read('ghe-smart-drawer.css');
const applySearchSource=rail.slice(rail.indexOf('function applySearch(){'),rail.indexOf('\nfunction render(){'));
const search={value:'medecin'},status={},nodes=['Visite médicale','Muscu'].map(label=>({getAttribute:()=>label,hidden:false}));
const railNode={querySelector:s=>s==='.ghe-smart-search'?search:status,querySelectorAll:()=>nodes};
const applySearch=vm.runInNewContext(applySearchSource+';applySearch;',{rail:railNode});
applySearch();assert(nodes.every(node=>node.hidden));assert.equal(status.hidden,false,'no results are explained');
search.value='medicale';applySearch();assert.equal(nodes[0].hidden,false);assert.equal(nodes[1].hidden,true);
search.value='';applySearch();assert(nodes.every(node=>!node.hidden));assert.equal(status.hidden,true);
assert.match(css,/\.ghe-smart-link\[hidden\]\s*\{display:none!important/,'search hiding beats the link display rule');
assert.match(rail,/if\(!rail\.querySelector\("\.ghe-smart-navigation"\)\)rail\.innerHTML=markup/,'do not replace a live compact navigation');
assert.match(rail,/data-smart-nav-query/,'search input remains available in its dedicated dialog');
for(const event of ['stip:home-rendered','stip:event-feedback-synced','stip:event-feedback-completed','stip:permissions-live'])assert(rail.includes(event),'drawer updates from '+event);
assert.match(rail,/agent-dates\.html\?focus=/,'future date preserves its canonical identifier');
assert.match(rail,/feedback_key=/,'feedback preserves its canonical identifier');
assert.match(rail,/window\.STIPDrawerOpenEntry/,'same-page entries reuse the home engine');
assert.match(read('ghe-premium-safe-flip.css'),/body:not\(\.ghe-smart-active\).*\.ghe-shortcuts-hamburger\{/,'old hamburger cannot override the new drawer');
const snapshotSource=rail.slice(rail.indexOf('function homeDrawerSnapshot(){'),rail.indexOf('function groupedEntries(){'));
let saved={version:3,session:'stip_home_runtime_cache_v2:session-test',owner:'agent-a::admin',at:Date.now(),drawer:{groups:[{key:'upcoming',items:[{id:'meeting',kind:'future',date:'2099-01-02'}]}],actions:[{id:'action'}],entries:[{action:'apps'}]}};
const storage={getItem:()=>JSON.stringify(saved)};
const snapshotContext={window:{STIPContinuity:{read:()=>({agent:{id:'agent-a'},role_key:'admin'})}},store:()=> 'session-test',sessionStorage:storage,localStorage:storage,Date};
const snapshot=vm.runInNewContext(snapshotSource+';homeDrawerSnapshot;',snapshotContext);
assert.equal(snapshot().groups[0].items[0].id,'meeting','standalone pages keep the canonical professional snapshot');
saved.owner='other-agent::admin';assert.equal(snapshot(),null,'another account cannot reuse a drawer snapshot');
saved.owner='agent-a::admin';saved.session='other-session';assert.equal(snapshot(),null,'another session cannot reuse a drawer snapshot');
const home=read('home-shell.js');
assert.match(home,/data-premium-roster="all"/,'live total is actionable');
assert.match(home,/code==="all"\?roster\.people/,'all-agents action uses the exact counted population');
const assistant=read('supabase/functions/stip-assistant/index.ts');
const balance=stripTypeScriptTypes(assistant.slice(assistant.indexOf('function dayDiff('),assistant.indexOf('function summary(')));
const strategies=vm.runInNewContext(balance+';balanceStrategies;',{Intl,Date});
const row=(date,gap)=>({event_date:date,source_family:'compound',analysis_type:'daily_risk',context:{gap_total:gap}});
assert.equal(strategies([row('2026-10-14',1),row('2026-10-16',-1)],'2026-10-16').length,0,'a past surplus cannot solve today');
assert.equal(strategies([row('2026-10-14',-1),row('2026-10-16',1)],'2026-10-16').length,0,'a past deficit is not a current proposal');
assert.equal(strategies([row('2026-10-16',-1),row('2026-10-19',1)],'2026-10-16').length,1,'future compatible dates retain proposals');
assert.equal(strategies([row('2026-10-16',-1),row('2026-10-24',1)],'2026-10-16').length,0,'keep the seven-day window');
console.log('PASS — GHE audit: invitations, search, refresh, deep links, live roster and actionable balance dates.');
// A pending item's destination must wait for the overlay's history transition.
const destinationBranch=rail.slice(rail.indexOf(' if(destination){'),rail.indexOf('\n const trigger='));
const navigatePending=vm.runInNewContext('(event,destination,window,requestAnimationFrame,setMode,location,selectIcon)=>{'+destinationBranch+'}',{});
const sequence=[],href='/index.html?feedback_key=return-1#/home';
let afterClose;
const dialog={open:true,close:()=>sequence.push('unsafe-native-close')};
const destination={dataset:{smartEntryKind:'feedback',smartEntryId:'return-1'},href,closest:()=>dialog};
const event={preventDefault:()=>sequence.push('prevent-default')};
const windowMock={STIPOverlayNav:{close:(_dialog,callback)=>{sequence.push('close-history');afterClose=callback;return true}},STIPNav:{go:url=>sequence.push(url)}};
navigatePending(event,destination,windowMock,callback=>callback(),()=>{}, {},key=>sequence.push('select-icon:'+key));
assert.deepEqual(sequence,['select-icon:','prevent-default','close-history'],'do not race native close against document navigation');
afterClose();assert.equal(sequence.at(-1),href,'resume the exact destination after closing its history level');
