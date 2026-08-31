(()=>{'use strict';
const p=()=>window.STIPSession?.permissions||window.STIPBootCache?.permissions||{},depth=k=>window.STIPSession?.depths?.[k]||window.STIPBootCache?.depths?.[k]||'none';
function explicit(k){const x=p();return Object.prototype.hasOwnProperty.call(x,k)?!!x[k]:false}
const APP_POLICY={
 personal:()=>explicit('planning_personal'),
 team:()=>explicit('planning_team'),
 change:()=>explicit('change_app'),
 calendar:()=>explicit('calendar_subscribe'),
 contacts:()=>explicit('contacts'),
 responsable:()=>explicit('responsable'),
 notes:()=>explicit('notes'),
 newagent:()=>explicit('nouveaux_arrivants'),
 upload:()=>explicit('file_upload'),
 activity:()=>explicit('activity'),
 admin:()=>explicit('admin'),
 places:()=>explicit('places'),
 assistant:()=>explicit('assistant_enabled'),
 access:()=>explicit('access_manage'),
 profile_photo:()=>explicit('profile_photo')
};
function canApp(k){return APP_POLICY[k]?.()??false}
function normalizeInfoLevel(v){v=String(v||'').toLowerCase();if(v==='pro'||v==='internal'||v==='internal_stip'||v==='restricted'||v==='admin')return'pro';if(v==='visitor'||v==='visiteur'||v==='public')return'visitor';return'none'}
function infoLevel(app=''){const lv=p().__levels?.[app];if(lv)return normalizeInfoLevel(lv);const n=normalizeInfoLevel(depth(app));return n!=='none'?n:'visitor'}
function canInfo(level='visitor',app=''){if(app&&!explicit(app))return false;const wanted=normalizeInfoLevel(level),current=infoLevel(app);return wanted==='visitor'?(current==='visitor'||current==='pro'):wanted==='pro'&&current==='pro'}
function applyInfoPolicy(root=document){for(const el of root.querySelectorAll('[data-stip-info],[data-access-level]')){const wanted=el.dataset.stipInfo||el.dataset.accessLevel||'visitor',app=el.dataset.stipApp||el.closest('[data-stip-app]')?.dataset.stipApp||'';el.hidden=!canInfo(wanted,app)}}
function guardRoute(){const r=window.STIPRouter?.get?.()||'';let ok=true;if(r==='planning/personal')ok=canApp('personal');else if(r==='planning/calendar')ok=canApp('calendar');else if(r==='planning/team'||r==='planning/spirit')ok=canApp('team');else if(r==='planning/change')ok=canApp('change');else if(r.startsWith('contacts'))ok=canApp('contacts');if(!ok)window.STIPRouter?.set?.('home',{replace:true})}
function guardStandalone(){const path=location.pathname.toLowerCase();const checks=[['/responsable.html','responsable'],['/assistant.html','assistant'],['/cadre-activite.html','activity'],['/places.html','places'],['/access-manage.html','access']];for(const [needle,key] of checks){if(path.endsWith(needle)&&!canApp(key)){location.replace('./');return false}}return true}
function applyHomePolicy(){const box=document.querySelector('#homeView .hc-apps');if(!box)return;for(const b of box.querySelectorAll('[data-app]')){const k=b.dataset.app;if(k==='equipe'){b.remove();continue}if(k in APP_POLICY)b.style.display=canApp(k)?'':'none'}let a=box.querySelector('[data-app="access"]');if(!a&&canApp('access')){a=document.createElement('button');a.className='hc-app access';a.dataset.app='access';a.innerHTML='<span>🔐</span><strong>Accès</strong>';box.append(a);a.onclick=e=>{e.preventDefault();location.href='access-manage.html'}}}
function tuneDock(){for(const b of document.querySelectorAll('#stipContextDock [data-root-action]')){const a=b.dataset.rootAction;let ok=true;if(a==='calendar'||a==='personalcal')ok=canApp('calendar');if(a==='teamcal')ok=canApp('team')&&explicit('calendar_subscribe');if(a==='contact-share')ok=canApp('contacts');b.style.display=ok?'':'none'}}
function run(){if(!guardStandalone())return;guardRoute();applyHomePolicy();tuneDock();applyInfoPolicy();document.documentElement.dataset.stipInfoLevel=infoLevel()}
let raf=0;function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;run()})}['stip:session-ready','stip:boot-updated','stip:route','stip:lazy-ready'].forEach(e=>window.addEventListener(e,schedule));window.addEventListener('pageshow',schedule);window.STIPAccess={has:k=>explicit(k),allow:k=>explicit(k),app:canApp,depth:k=>depth(k),can:k=>explicit(k),infoLevel,canInfo,applyInfoPolicy};schedule()})();