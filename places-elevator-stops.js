(()=>{
'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-places';
const STORE='stip_session_v1';
const ARRIVAL='stip_places_arrival_v1';
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
function maps(){
  const byId=new Map((data?.places||[]).map(p=>[p.id,p]));
  const byParent=new Map();
  for(const p of data?.places||[]){if(!p.parent_id)continue;const a=byParent.get(p.parent_id)||[];a.push(p);byParent.set(p.parent_id,a)}
  for(const a of byParent.values())a.sort((x,y)=>(Number(x.sort_order)||0)-(Number(y.sort_order)||0)||String(x.display_name).localeCompare(String(y.display_name),'fr'));
  return{byId,byParent};
}
function effectiveStops(id,byId,byParent){
  const p=byId.get(id),ids=[id];
  if(p?.place_type==='elevator_group')for(const c of byParent.get(id)||[])if(['elevator','elevator_group'].includes(c.place_type))ids.push(c.id);
  const raw=(data?.elevator_stops||[]).filter(s=>ids.includes(s.elevator_id));
  const merged=new Map();
  for(const source of raw){
    const s={...source};
    if(source.elevator_id!==id){const n=byId.get(source.elevator_id)?.display_name;if(n)s.note=[`Via ${n}.`,s.note].filter(Boolean).join(' ')}
    const old=merged.get(s.stop_label);
    if(!old||(!old.is_served&&s.is_served))merged.set(s.stop_label,s);
    else if(old&&s.note&&!String(old.note||'').includes(s.note))old.note=[old.note,s.note].filter(Boolean).join(' ');
  }
  const stops=[...merged.values()].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.stop_label).localeCompare(String(b.stop_label),'fr'));
  return{stops,complete:raw.length>0&&raw.every(s=>s.coverage_status==='complete_observed')};
}
function floorPreview(target,byParent){
  if(!target)return'';
  const children=(byParent.get(target.id)||[]).filter(p=>!['level','elevator','elevator_group'].includes(p.place_type));
  if(children.length){const names=children.slice(0,4).map(p=>p.display_name);return `En sortant : ${names.join(' · ')}${children.length>4?' · …':''}`}
  return target.summary?`À cet étage : ${target.summary}`:'';
}
function stopRow(s,byId,byParent,elevator){
  const target=s.linked_place_id?byId.get(s.linked_place_id):null;
  const note=s.note?`<p>${esc(s.note)}</p>`:'';
  if(!s.is_served)return `<div class="place-row elevator-stop-row elevator-stop-no"><div class="place-row-main"><strong>${esc(s.stop_label)}</strong><p>Ne dessert pas ce niveau.</p>${note}</div></div>`;
  if(target){
    const targetText=target.display_name&&target.display_name!==s.stop_label?`<p>${esc(target.display_name)}</p>`:'';
    const preview=floorPreview(target,byParent);
    return `<button class="place-row elevator-stop-row" type="button" data-place="${esc(target.id)}" data-arrival-elevator="${esc(elevator.id)}" data-arrival-name="${esc(elevator.display_name)}" data-arrival-level="${esc(target.id)}"><div class="place-row-main"><strong>${esc(s.stop_label)}</strong>${targetText}${preview?`<p>${esc(preview)}</p>`:''}${note}</div><span class="place-next">›</span></button>`;
  }
  return `<div class="place-row elevator-stop-row"><div class="place-row-main"><strong>${esc(s.stop_label)}</strong><p>Arrêt relevé · correspondance interne à compléter.</p>${note}</div></div>`;
}
function summaryFor(id,byId,byParent){
  const {stops,complete}=effectiveStops(id,byId,byParent),served=stops.filter(s=>s.is_served),labels=served.map(s=>s.stop_label);
  if(!stops.length)return'Desserte à compléter';
  const base=`${served.length} arrêt${served.length>1?'s':''} connu${served.length>1?'s':''}`;
  const levels=labels.length?` · ${labels.slice(0,6).join(', ')}${labels.length>6?', …':''}`:'';
  return `${base}${levels}${complete?' · liste relevée complète':' · liste partielle'}`;
}
function decorateElevatorRows(byId,byParent){
  for(const row of content.querySelectorAll('.place-row[data-place]')){
    const p=byId.get(row.dataset.place);if(!p||!['elevator','elevator_group'].includes(p.place_type))continue;
    const main=row.querySelector('.place-row-main');if(!main)continue;
    const text=summaryFor(p.id,byId,byParent);
    let meta=main.querySelector('[data-elevator-row-meta]');
    if(!meta){meta=document.createElement('p');meta.dataset.elevatorRowMeta='1';main.append(meta)}
    if(meta.textContent!==text)meta.textContent=text;
  }
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
  scheduled=false;if(!data)return;
  const {byId,byParent}=maps();
  decorateElevatorRows(byId,byParent);
  const id=currentPlaceId(),old=content.querySelector('[data-elevator-stops]');
  if(!id){old?.remove();return}
  const p=byId.get(id);
  if(!p||!['elevator','elevator_group'].includes(p.place_type)){old?.remove();return}
  const {stops,complete}=effectiveStops(id,byId,byParent);
  const signature=`${id}:${stops.map(s=>`${s.stop_label}:${s.is_served}:${s.linked_place_id||''}:${s.note||''}`).join('|')}`;
  if(old?.dataset.signature===signature){removeDuplicatedFloorRelations(stops);return}
  old?.remove();
  const detail=content.querySelector('.place-detail');if(!detail)return;
  const section=document.createElement('section');section.className='places-section elevator-stops-section';section.dataset.elevatorStops='1';section.dataset.signature=signature;
  if(stops.length){
    const served=stops.filter(s=>s.is_served);
    const small=complete?`${served.length} arrêt${served.length>1?'s':''} relevé${served.length>1?'s':''}`:`${served.length} arrêt${served.length>1?'s':''} connu${served.length>1?'s':''} · liste partielle`;
    section.innerHTML=`<header class="places-section-head"><h2>Étages desservis</h2><small>${esc(small)}</small></header><div class="places-list">${stops.map(s=>stopRow(s,byId,byParent,p)).join('')}</div>`;
  }else section.innerHTML='<header class="places-section-head"><h2>Étages desservis</h2><small>À compléter</small></header><div class="place-empty"><strong>À compléter</strong><br>La desserte exacte de cet ascenseur n’est pas encore suffisamment documentée.</div>';
  const first=detail.querySelector('.places-section');if(first)first.before(section);else detail.append(section);
  removeDuplicatedFloorRelations(stops);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate)}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-arrival-elevator]');
  if(b){sessionStorage.setItem(ARRIVAL,JSON.stringify({elevatorId:b.dataset.arrivalElevator,elevatorName:b.dataset.arrivalName||'',levelId:b.dataset.arrivalLevel||b.dataset.place,at:Date.now()}));return}
  const p=e.target.closest('[data-place]');if(p&&/(?:_l\d+|_rdc|_rdj|_tm)$/.test(p.dataset.place||''))sessionStorage.removeItem(ARRIVAL);
  if(e.target.closest('[data-nav-home],[data-nav-visit],#placesHome'))sessionStorage.removeItem(ARRIVAL);
},true);
new MutationObserver(schedule).observe(content,{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);
load().then(d=>{data=d;schedule()}).catch(e=>console.error('Ascenseurs STIP',e));
})();
