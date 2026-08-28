(()=>{
'use strict';
const content=document.querySelector('#placesContent');
if(!content)return;
const ARRIVAL='stip_places_arrival_v1';
const REL_SCORE={route_next:120,route_branch:118,exit_near:116,arrives_near:114,near:110,adjacent:108,accesses:104,connects_to:100,serves:94,signposted_to:84,passes_near:78};
let data=null,scheduled=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function currentPlaceId(){const m=location.hash.match(/^#\/?place\/(.+)$/);return m?decodeURIComponent(m[1]):''}
function floorRank(v){const s=String(v??'').trim().toUpperCase();if(/^-[0-9]+$/.test(s))return-100+Number(s);if(s==='RDJ'||s==='RJ')return-20;if(s==='RDC'||s==='RC')return-10;if(s==='TM')return-5;const n=Number(s.replace(/[^0-9-]/g,''));return Number.isFinite(n)?n:999}
function maps(){const byId=new Map((data?.places||[]).map(p=>[p.id,p])),byParent=new Map(),tags=new Map();for(const p of data?.places||[]){if(!p.parent_id)continue;const a=byParent.get(p.parent_id)||[];a.push(p);byParent.set(p.parent_id,a)}for(const t of data?.tags||[]){const s=tags.get(t.place_id)||new Set();s.add(t.tag);tags.set(t.place_id,s)}return{byId,byParent,tags}}
function usage(id,tags){if(tags.get(id)?.has('elevator:professional'))return'professional';if(tags.get(id)?.has('elevator:visitor_reference'))return'visitor_reference';return'unknown'}
function ancestors(p,byId){const out=[];let cur=p,guard=0;while(cur&&guard++<12){out.push(cur);cur=cur.parent_id?byId.get(cur.parent_id):null}return out}
function currentLevel(p,byId){return ancestors(p,byId).find(x=>x.place_type==='level')||null}
function hospitalFor(p,byId){return ancestors(p,byId).find(x=>['hospital','building'].includes(x.place_type))||null}
function levelsFor(p){if(!p?.building_code)return[];const seen=new Set(),out=[];for(const x of data?.places||[]){if(x.place_type!=='level'||x.building_code!==p.building_code)continue;const key=String(x.level||x.display_name||x.id);if(seen.has(key))continue;seen.add(key);out.push(x)}return out.sort((a,b)=>floorRank(a.level)-floorRank(b.level)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0))}
function effectiveStops(elevator,byId,byParent){const ids=[elevator.id];const {tags}=maps();if(elevator.place_type==='elevator_group')for(const c of byParent.get(elevator.id)||[])if(['elevator','elevator_group'].includes(c.place_type)&&usage(c.id,tags)==='professional')ids.push(c.id);const merged=new Map();for(const s of data?.elevator_stops||[]){if(!ids.includes(s.elevator_id)||!s.is_served)continue;const old=merged.get(s.stop_label);if(!old||(!old.linked_place_id&&s.linked_place_id))merged.set(s.stop_label,s)}return[...merged.values()].sort((a,b)=>(Number(a.sort_order)||floorRank(a.stop_label))-(Number(b.sort_order)||floorRank(b.stop_label)))}
function arrival(){try{return JSON.parse(sessionStorage.getItem(ARRIVAL)||'null')}catch{return null}}
function candidateFor(p,byId,byParent,tags){
  if(!p)return null;
  const chain=ancestors(p,byId),chainIds=new Set(chain.map(x=>x.id)),level=currentLevel(p,byId),cands=new Map();
  const add=(e,score)=>{if(!e||usage(e.id,tags)!=='professional'||e.building_code!==p.building_code)return;const old=cands.get(e.id);if(!old||score>old.score)cands.set(e.id,{p:e,score})};
  if(usage(p.id,tags)==='professional')add(p,180);
  const a=arrival();if(a?.elevatorId){const e=byId.get(a.elevatorId);if(e&&(!level||a.levelId===level.id))add(e,170)}
  for(const r of data?.relations||[]){const rs=REL_SCORE[r.relation_type]||0;if(!rs)continue;let e=null,exact=false;
    if(chainIds.has(r.to_place_id)&&usage(r.from_place_id,tags)==='professional'){e=byId.get(r.from_place_id);exact=r.to_place_id===p.id}
    else if(chainIds.has(r.from_place_id)&&usage(r.to_place_id,tags)==='professional'){e=byId.get(r.to_place_id);exact=r.from_place_id===p.id}
    if(e)add(e,rs+(exact?30:4));
  }
  for(const s of data?.elevator_stops||[]){if(!s.is_served||usage(s.elevator_id,tags)!=='professional')continue;const e=byId.get(s.elevator_id);if(!e||e.building_code!==p.building_code)continue;if(s.linked_place_id===p.id)add(e,125);else if(level&&s.linked_place_id===level.id)add(e,78)}
  if(!cands.size){const pros=[...byId.values()].filter(x=>usage(x.id,tags)==='professional'&&x.building_code===p.building_code);if(pros.length===1)add(pros[0],45)}
  const list=[...cands.values()].sort((a,b)=>b.score-a.score||String(a.p.display_name).localeCompare(String(b.p.display_name),'fr'));
  if(!list.length)return null;if(list[1]&&list[0].score===list[1].score&&list[0].score<100)return null;return list[0].p;
}
function setMode(p){const hospital=['hospital','building'].includes(p?.place_type),level=p?.place_type==='level';content.classList.toggle('floor-hospital-mode',hospital);content.classList.toggle('floor-level-mode',level);for(const sec of content.querySelectorAll('.floor-route-noise'))sec.classList.remove('floor-route-noise');if(level){for(const sec of content.querySelectorAll('.places-section')){const h=sec.querySelector('h2');if(h&&/^comment y aller$/i.test((h.textContent||'').trim()))sec.classList.add('floor-route-noise')}}}
function clearRail(){content.querySelector('[data-floor-quick-rail]')?.remove();content.classList.remove('floor-hospital-mode','floor-level-mode')}
function genericButtons(levels,active){return levels.map(l=>`<button type="button" data-place="${esc(l.id)}" class="floor-quick-btn${active?.id===l.id?' active':''}" aria-label="Ouvrir ${esc(l.display_name)}" title="${esc(l.display_name)}">${esc(l.level||l.display_name)}</button>`).join('')}
function elevatorButtons(stops,active){return stops.map(s=>{const target=s.linked_place_id||'',isActive=!!active&&target===active.id,disabled=!target;return `<button type="button" ${target?`data-place="${esc(target)}"`:''} class="floor-quick-btn${isActive?' active':''}${disabled?' disabled':''}" ${disabled?'disabled':''} aria-label="${esc(s.stop_label)}" title="${esc(s.stop_label)}">${esc(s.stop_label)}</button>`}).join('')}
function render(){scheduled=false;if(!data)return;const id=currentPlaceId();if(!id){clearRail();return}const {byId,byParent,tags}=maps(),p=byId.get(id);if(!p){clearRail();return}setMode(p);const active=currentLevel(p,byId),isDestination=!['hospital','building','level'].includes(p.place_type),elevator=isDestination?candidateFor(p,byId,byParent,tags):null;let buttons='',marker='↕',label='Accès rapide aux étages',signature='';
  if(elevator){const stops=effectiveStops(elevator,byId,byParent);marker='PRO';label=`${elevator.display_name} — étages desservis`;if(stops.length){buttons=elevatorButtons(stops,active);signature=`e:${elevator.id}:${active?.id||''}:${stops.map(s=>`${s.stop_label}:${s.linked_place_id||''}`).join('|')}`}else if(active){buttons=genericButtons([active],active);signature=`e:${elevator.id}:${active.id}:unknown`}}
  if(!buttons){const levels=levelsFor(p);if(levels.length<2){content.querySelector('[data-floor-quick-rail]')?.remove();return}buttons=genericButtons(levels,active);signature=`g:${p.building_code}:${active?.id||''}:${levels.map(x=>x.id).join('|')}`}
  const old=content.querySelector('[data-floor-quick-rail]');if(old?.dataset.signature===signature)return;old?.remove();const rail=document.createElement('nav');rail.className=`floor-quick-rail${elevator?' elevator-context':''}`;rail.dataset.floorQuickRail='1';rail.dataset.signature=signature;rail.setAttribute('aria-label',label);rail.title=label;rail.innerHTML=`<span class="floor-quick-mark" aria-hidden="true">${esc(marker)}</span>${buttons}`;content.appendChild(rail)}
content.addEventListener('click',e=>{
  const b=e.target.closest?.('.floor-quick-btn.active[data-place]');if(!b||!data)return;
  const {byId}=maps(),p=byId.get(currentPlaceId());if(!p||p.place_type!=='level'||b.dataset.place!==p.id)return;
  const hospital=hospitalFor(p,byId);if(!hospital)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();sessionStorage.removeItem(ARRIVAL);location.hash=`#/place/${encodeURIComponent(hospital.id)}`;
},true);
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(render)}
function use(d){data=d||window.__STIP_PLACE_DATA||data;schedule()}
window.addEventListener('stip:place-data-ready',()=>use(window.__STIP_PLACE_DATA));window.addEventListener('stip:place-relations-ready',schedule);window.addEventListener('hashchange',()=>setTimeout(schedule,40));new MutationObserver(schedule).observe(content,{childList:true,subtree:true});setTimeout(()=>use(window.__STIP_PLACE_DATA),250);
})();
