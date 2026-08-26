(()=>{
'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-places';
const STORE='stip_session_v1';
let routes=new Map(),loading=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateFr=v=>{if(!v)return'';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('fr-FR').format(d)};
async function load(){
  if(routes.size)return routes;
  if(loading)return loading;
  loading=(async()=>{
    const token=localStorage.getItem(STORE)||'';
    if(!token)return routes;
    const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify({action:'bootstrap'})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)return routes;
    routes=new Map((j.routes||[]).map(x=>[x.id,x]));
    return routes;
  })().finally(()=>{loading=null});
  return loading;
}
function block(r){
  const source=[r.source_kind,r.source_date?dateFr(r.source_date):'',r.source_ref].filter(Boolean).join(' · ');
  return `<aside class="route-documentation" data-route-doc="${esc(r.id)}"><span class="route-doc-kicker">PROCÉDURE ADAPTÉE AU CIRCUIT</span><strong>${esc(r.source_kind||'Documentation opérationnelle')}</strong>${r.notes?`<p>${esc(r.notes)}</p>`:''}${source?`<small>Source · ${esc(source)}</small>`:''}</aside>`;
}
async function enhance(){
  await load();
  document.querySelectorAll('.route-card button[data-route]').forEach(btn=>{
    const id=btn.dataset.route,r=routes.get(id),card=btn.closest('.route-card');
    if(!r||!card||!r.notes)return;
    const expanded=!!card.querySelector('.route-steps');
    const old=card.querySelector('[data-route-doc]');
    if(!expanded){old?.remove();return}
    if(!old)card.insertAdjacentHTML('beforeend',block(r));
  });
}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance().catch(console.error)})}
new MutationObserver(queue).observe(document.getElementById('placesContent')||document.body,{childList:true,subtree:true});
queue();
})();
