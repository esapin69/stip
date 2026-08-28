(()=>{
'use strict';
const content=document.querySelector('#placesContent');
if(!content)return;
let data=null,scheduled=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function currentPlaceId(){const m=location.hash.match(/^#\/?place\/(.+)$/);return m?decodeURIComponent(m[1]):''}
function floorRank(p){
  const t=norm([p?.level,p?.display_name].filter(Boolean).join(' '));
  if(/(?:niveau\s*)?-\s*(\d+)/.test(t)){const m=t.match(/-\s*(\d+)/);return-100-(m?Number(m[1]):0)}
  if(/rez[- ]de[- ]jardin|\brdj\b|\brj\b/.test(t))return-20;
  if(/rez[- ]de[- ]chaussee|\brdc\b/.test(t))return-10;
  if(/\btm\b/.test(t))return-5;
  const m=t.match(/(?:niveau|etage)?\s*(\d+)|\b(\d+)(?:er|e|eme)\b/);return m?Number(m[1]||m[2]):999;
}
function parentIds(id){return id==='lp'||id==='hlp'?new Set(['lp','hlp']):new Set([id])}
function isDestination(p){return !!p&&!['campus','hospital','building','level','entrance','elevator','elevator_group','parking','walkway','landmark'].includes(p.place_type)}
function labelFor(p){return p?.place_type==='exam'?'Examen':p?.place_type==='unit'?'Unité':p?.place_type==='block'?'Bloc':p?.place_type==='reception'?'Accueil':p?.place_type==='staff_area'?'Zone STIP':'Service'}
function floorCard(level,places){
  const services=places.filter(p=>p.parent_id===level.id&&isDestination(p)).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.display_name).localeCompare(String(b.display_name),'fr'));
  return `<article class="visit-floor-card" data-floor-card="${esc(level.id)}"><button type="button" class="visit-floor-open" data-place="${esc(level.id)}"><span><strong>${esc(level.display_name)}</strong><small>${services.length?`${services.length} accès direct${services.length>1?'s':''}`:'Ouvrir cet étage'}</small></span><b>›</b></button>${services.length?`<div class="visit-floor-services">${services.map(p=>`<button type="button" class="visit-service-link" data-place="${esc(p.id)}"><span><small>${esc(labelFor(p))}</small><strong>${esc(p.display_name)}</strong></span><b>›</b></button>`).join('')}</div>`:''}</article>`;
}
function hospitalOverview(){
  if(!data)return;
  const id=currentPlaceId(),byId=new Map((data.places||[]).map(p=>[p.id,p])),hospital=byId.get(id);
  const old=content.querySelector('[data-fast-floor-overview]');
  if(!hospital||hospital.place_type!=='hospital'){old?.remove();return}
  const ids=parentIds(id),levels=(data.places||[]).filter(p=>p.place_type==='level'&&ids.has(p.parent_id)).sort((a,b)=>floorRank(a)-floorRank(b)||String(a.display_name).localeCompare(String(b.display_name),'fr'));
  if(!levels.length){old?.remove();return}
  const signature=levels.map(x=>x.id).join('|');if(old?.dataset.signature===signature)return;
  old?.remove();content.querySelectorAll('.visit-hfme-fallback').forEach(x=>x.remove());
  const section=document.createElement('section');section.className='places-section visit-hospital-levels-fast';section.dataset.fastFloorOverview='1';section.dataset.signature=signature;
  section.innerHTML=`<header class="places-section-head"><h2>Étages</h2><small>Touche directement le service recherché</small></header><div class="visit-floor-stack">${levels.map(l=>floorCard(l,data.places||[])).join('')}</div>`;
  const start=content.querySelector('.visit-hospital-start'),hero=content.querySelector('.place-hero-card');
  if(start)start.after(section);else if(hero)hero.after(section);else content.prepend(section);
}
function keepElevatorHigh(){
  const hero=content.querySelector('.place-hero-card'),lift=content.querySelector('[data-pro-elevator]');
  if(hero&&lift&&hero.nextElementSibling!==lift)hero.after(lift);
}
function run(){scheduled=false;hospitalOverview();keepElevatorHigh()}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(run)}
window.addEventListener('stip:place-data-ready',()=>{data=window.__STIP_PLACE_DATA||data;schedule()});
window.addEventListener('hashchange',()=>setTimeout(schedule,60));
new MutationObserver(schedule).observe(content,{childList:true,subtree:true});
if(window.__STIP_PLACE_DATA){data=window.__STIP_PLACE_DATA;schedule()}else setTimeout(()=>{data=window.__STIP_PLACE_DATA||data;schedule()},250);
})();
