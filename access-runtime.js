(()=>{'use strict';
const p=()=>window.STIPSession?.permissions||window.STIPBootCache?.permissions||{},depth=k=>window.STIPSession?.depths?.[k]||window.STIPBootCache?.depths?.[k]||'none',role=()=>window.STIPSession?.role_key||window.STIPBootCache?.role_key||'';
function isAdmin(){return role()==='admin'}
function explicit(k){if(isAdmin())return true;const x=p();return Object.prototype.hasOwnProperty.call(x,k)?!!x[k]:null}
function allow(primary,...fallbacks){if(isAdmin())return true;const v=explicit(primary);if(v!==null)return v;for(const k of fallbacks){const f=explicit(k);if(f!==null)return f}return false}
const APP_POLICY={
 personal:()=>allow('planning_personal','planning'),
 team:()=>allow('planning_team','planning'),
 change:()=>allow('planning_personal','planning'),
 calendar:()=>allow('calendar_subscribe','planning_personal','planning'),
 contacts:()=>allow('contacts','equipe_contacts'),
 responsable:()=>allow('responsable'),
 newagent:()=>allow('nouveaux_arrivants'),
 upload:()=>allow('file_upload'),
 admin:()=>allow('admin'),
 equipe:()=>allow('equipe')
};
function canApp(k){return isAdmin()||(APP_POLICY[k]?.()??false)}
function guardRoute(){const r=window.STIPRouter?.get?.()||'';let ok=true;if(r==='planning/personal')ok=canApp('personal');else if(r==='planning/calendar')ok=canApp('calendar');else if(r==='planning/team'||r==='planning/spirit')ok=canApp('team');else if(r==='planning/change')ok=canApp('change');else if(r.startsWith('contacts'))ok=canApp('contacts');if(!ok)window.STIPRouter?.set?.('home',{replace:true})}
function ensureEquipe(){const box=document.querySelector('#homeView .hc-apps');if(!box)return;let b=box.querySelector('[data-app="equipe"]');if(!canApp('equipe')){b?.remove();return}if(!b){b=document.createElement('button');b.className='hc-app team';b.dataset.app='equipe';b.innerHTML='<span><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.4-7 6-7s6 3 6 7M16 6.5a2.5 2.5 0 0 1 0 5M17 14c2.5.6 4 2.7 4 5"/></svg></span><strong>Équipe</strong>';box.prepend(b)}b.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();location.href='equipe.html'}}
function applyHomePolicy(){const box=document.querySelector('#homeView .hc-apps');if(!box)return;for(const b of box.querySelectorAll('[data-app]')){const k=b.dataset.app;if(k in APP_POLICY)b.style.display=canApp(k)?'':'none'}ensureEquipe()}
function tuneDock(){for(const b of document.querySelectorAll('#stipContextDock [data-root-action]')){const a=b.dataset.rootAction;let ok=true;if(a==='calendar'||a==='personalcal')ok=canApp('calendar');if(a==='teamcal')ok=canApp('team')&&allow('calendar_subscribe','planning_team','planning');if(a==='contact-share')ok=allow('contact_export','contacts','equipe_contacts');b.style.display=ok?'':'none'}}
function run(){guardRoute();applyHomePolicy();tuneDock();document.documentElement.dataset.stipRole=role();document.documentElement.dataset.equipeDepth=isAdmin()?'admin':depth('equipe');document.documentElement.dataset.contactsDepth=isAdmin()?'admin':depth('contacts')}
new MutationObserver(()=>requestAnimationFrame(run)).observe(document.body,{childList:true,subtree:true});['stip:session-ready','stip:boot-updated','stip:route','stip:lazy-ready'].forEach(e=>window.addEventListener(e,()=>requestAnimationFrame(run)));window.STIPAccess={has:k=>allow(k),allow,app:canApp,depth:k=>isAdmin()?'admin':depth(k),can:k=>allow(k),isAdmin};run()})();