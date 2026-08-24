(()=>{'use strict';
const loaded=new Map(),V='20260824-permission5';
function load(src){if(loaded.has(src))return loaded.get(src);const p=new Promise((ok,ko)=>{const s=document.createElement('script');s.src=`${src}?v=${V}`;s.async=false;s.onload=()=>ok(src);s.onerror=()=>{loaded.delete(src);ko(new Error(`Chargement impossible: ${src}`))};document.body.appendChild(s)});loaded.set(src,p);return p}
async function seq(list){for(const x of list)await load(x)}
const coreHome=['home-intelligence.js','home-retain-dashboard.js','notifications-live.js','permission-visibility.js'];
const personal=['planning-home.js','planning-compare-inline.js','planning-month-hero.js','planning-print-reference.js','agent-week-view.js','planning-agenda-extras.js','calendar-subscriptions.js','calendar-responsable-gate.js','change-permission-gate.js','day-workflow.js','day-workflow-leave.js','day-workflow-home-bridge.js','signature-success-ui.js'];
const team=['planning-home.js','planning-hub-enhance.js','calendar-subscriptions.js','calendar-responsable-gate.js'];
const change=['planning-home.js','change-workflow.js','change-permission-gate.js'];
let busyRoute='';
async function ensureRoute(r){r=String(r||'');if(!r)return;if(r.startsWith('contacts')){await seq(['section-hubs.js']);window.STIPHubs?.contactsRoute?.(r);return}if(!r.startsWith('planning'))return;const kind=r.includes('/team')||r.includes('/spirit')?'team':r.includes('/change')?'change':'personal';const key=`${r}|${kind}`;if(busyRoute===key)return;busyRoute=key;try{await seq(kind==='team'?team:kind==='change'?change:personal);window.dispatchEvent(new CustomEvent('stip:lazy-ready',{detail:{route:r,kind}}))}finally{busyRoute=''}}
window.STIPLoad={script:load,route:ensureRoute};
window.STIPHubs=window.STIPHubs||{planning(kind='personal'){const map={personal:'personal',spirit:'team',team:'team',change:'change',calendar:'personal'};window.STIPRouter?.set?.(`planning/${map[kind]||'personal'}`)},contacts(kind='directory'){window.STIPRouter?.set?.(`contacts/${kind}`)}};
window.addEventListener('stip:route',e=>ensureRoute(e.detail?.route||'').catch(console.error));
function idle(){seq(coreHome).catch(console.error);if(new URLSearchParams(location.search).has('view_agent'))load('readonly-view-as.js').catch(console.error)}
if('requestIdleCallback'in window)requestIdleCallback(idle,{timeout:1800});else setTimeout(idle,700);
document.addEventListener('pointerdown',e=>{const b=e.target.closest?.('[data-app]');if(!b)return;const k=b.dataset.app;if(k==='responsable'){const l=document.createElement('link');l.rel='prefetch';l.href='/responsable.html';document.head.appendChild(l);return}if(k==='contacts')seq(['section-hubs.js']).catch(()=>{});if(k==='personal')seq(['planning-home.js','planning-compare-inline.js','planning-month-hero.js','change-permission-gate.js']).catch(()=>{});if(k==='team')seq(['planning-home.js','planning-hub-enhance.js']).catch(()=>{});if(k==='change')seq(['planning-home.js','change-workflow.js','change-permission-gate.js']).catch(()=>{})},{passive:true,capture:true});
setTimeout(()=>ensureRoute(window.STIPRouter?.get?.()||'').catch(console.error),0);
})();