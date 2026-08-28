(()=>{
'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-places';
const STORE='stip_session_v1';
const content=document.querySelector('#placesContent');
if(!content)return;
let data=null,scheduled=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function currentPlaceId(){const m=location.hash.match(/^#\/?place\/(.+)$/);return m?decodeURIComponent(m[1]):''}
async function load(){
  const token=localStorage.getItem(STORE)||'';
  const headers={'Content-Type':'application/json'};
  let action='bootstrap_public';
  if(token){headers['X-STIP-Session']=token;action='bootstrap'}
  let r=await fetch(API,{method:'POST',cache:'no-store',headers,body:JSON.stringify({action})});
  if(r.status===401&&token){
    localStorage.removeItem(STORE);
    r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bootstrap_public'})});
  }
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.error)throw new Error(j.error||`Erreur ${r.status}`);
  return j;
}
function stopRow(s,byId){
  const target=s.linked_place_id?byId.get(s.linked_place_id):null;
  const note=s.note?`<p>${esc(s.note)}</p>`:'';
  if(!s.is_served){
    return `<div class="place-row elevator-stop-row elevator-stop-no"><div class="place-row-main"><strong>${esc(s.stop_label)}</strong><p>Ne dessert pas ce niveau.</p>${note}</div></div>`;
  }
  if(target){
    const targetText=target.display_name&&target.display_name!==s.stop_label?`<p>${esc(target.display_name)}</p>`:'';
    return `<button class="place-row elevator-stop-row" type="button" data-place="${esc(target.id)}"><div class="place-row-main"><strong>${esc(s.stop_label)}</strong>${targetText}${note}</div><span class="place-next">›</span></button>`;
  }
  return `<div class="place-row elevator-stop-row"><div class="place-row-main"><strong>${esc(s.stop_label)}</strong><p>Arrêt relevé · correspondance interne à compléter.</p>${note}</div></div>`;
}
function removeDuplicatedFloorRelations(stops){
  const linked=new Set(stops.map(s=>s.linked_place_id).filter(Boolean));
  if(!linked.size)return;
  for(const sec of content.querySelectorAll('.places-section')){
    const h=sec.querySelector('h2');
    if(!h||!/à proximité|ce que tu croises/i.test(h.textContent||''))continue;
    sec.querySelectorAll('.place-row[data-place]').forEach(row=>{if(linked.has(row.dataset.place))row.remove()});
    if(!sec.querySelector('.place-row[data-place]'))sec.remove();
  }
}
function decorate(){
  scheduled=false;
  const id=currentPlaceId();
  const old=content.querySelector('[data-elevator-stops]');
  if(!data||!id){old?.remove();return}
  const byId=new Map((data.places||[]).map(p=>[p.id,p]));
  const p=byId.get(id);
  if(!p||!['elevator','elevator_group'].includes(p.place_type)){old?.remove();return}
  const stops=(data.elevator_stops||[]).filter(s=>s.elevator_id===id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.stop_label).localeCompare(String(b.stop_label),'fr'));
  const childElevators=(data.places||[]).filter(x=>x.parent_id===id&&['elevator','elevator_group'].includes(x.place_type));
  const signature=`${id}:${stops.map(s=>`${s.stop_label}:${s.is_served}:${s.linked_place_id||''}`).join('|')}`;
  if(old?.dataset.signature===signature){removeDuplicatedFloorRelations(stops);return}
  old?.remove();
  const detail=content.querySelector('.place-detail');
  if(!detail)return;
  if(!stops.length&&childElevators.length)return;
  const section=document.createElement('section');
  section.className='places-section elevator-stops-section';
  section.dataset.elevatorStops='1';section.dataset.signature=signature;
  if(stops.length){
    const served=stops.filter(s=>s.is_served);
    const complete=stops.every(s=>s.coverage_status==='complete_observed');
    const small=complete?`${served.length} arrêt${served.length>1?'s':''} relevé${served.length>1?'s':''}`:`${served.length} arrêt${served.length>1?'s':''} connu${served.length>1?'s':''} · liste partielle`;
    section.innerHTML=`<header class="places-section-head"><h2>Étages desservis</h2><small>${esc(small)}</small></header><div class="places-list">${stops.map(s=>stopRow(s,byId)).join('')}</div>`;
  }else{
    section.innerHTML='<header class="places-section-head"><h2>Étages desservis</h2><small>À compléter</small></header><div class="place-empty">La desserte exacte de cet ascenseur n’est pas encore suffisamment documentée.</div>';
  }
  const first=detail.querySelector('.places-section');
  if(first)first.before(section);else detail.append(section);
  removeDuplicatedFloorRelations(stops);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate)}
new MutationObserver(schedule).observe(content,{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);
load().then(d=>{data=d;schedule()}).catch(e=>console.error('Ascenseurs STIP',e));
})();
