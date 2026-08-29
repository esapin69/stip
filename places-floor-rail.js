(()=>{
'use strict';
const content=document.querySelector('#placesContent');
if(!content)return;
const ARRIVAL='stip_places_arrival_v1';
const REL_SCORE={route_next:120,route_branch:118,exit_near:116,arrives_near:114,near:110,adjacent:108,accesses:104,connects_to:100,serves:94,signposted_to:84,passes_near:78};
let data=null,scheduled=false,opened=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function currentPlaceId(){const m=location.hash.match(/^#\/?place\/(.+)$/);return m?decodeURIComponent(m[1]):''}
function floorRank(v){const s=String(v??'').trim().toUpperCase();if(/^-[0-9]+$/.test(s))return-100+Number(s);if(s==='RDJ'||s==='RJ')return-20;if(s==='RDC'||s==='RC')return-10;if(s==='TM')return-5;const n=Number(s.replace(/[^0-9-]/g,''));return Number.isFinite(n)?n:999}
function maps(){const byId=new Map((data?.places||[]).map(p=>[p.id,p])),byParent=new Map(),tags=new Map();for(const p of data?.places||[]){if(!p.parent_id)continue;const a=byParent.get(p.parent_id)||[];a.push(p);byParent.set(p.parent_id,a)}for(const t of data?.tags||[]){const s=tags.get(t.place_id)||new Set();s.add(t.tag);tags.set(t.place_id,s)}return{byId,byParent,tags}}
function usage(id,tags){if(tags.get(id)?.has('elevator:professional'))return'professional';if(tags.get(id)?.has('elevator:visitor_reference'))return'visitor_reference';return'unknown'}
function ancestors(p,byId){const out=[];let cur=p,guard=0;while(cur&&guard++<12){out.push(cur);cur=cur.parent_id?byId.get(cur.parent_id):null}return out}
function currentLevel(p,byId){return ancestors(p,byId).find(x=>x.place_type==='level')||null}
function hospitalFor(p,byId){return ancestors(p,byId).find(x=>['hospital','building'].includes(x.place_type))||null}
function levelsFor(p){if(!p?.building_code)return[];const seen=new Set(),out=[];for(const x of data?.places||[]){if(x.place_type!=='level'||x.building_code!==p.building_code)continue;const key=String(x.level||x.display_name||x.id);if(seen.has(key))continue;seen.add(key);out.push(x)}return out.sort((a,b)=>floorRank(a.level)-floorRank(b.level)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0))}
function effectiveStops(elevator,byParent,tags){const ids=[elevator.id];if(elevator.place_type==='elevator_group')for(const c of byParent.get(elevator.id)||[])if(['elevator','elevator_group'].includes(c.place_type)&&usage(c.id,tags)==='professional')ids.push(c.id);const merged=new Map();for(const s of data?.elevator_stops||[]){if(!ids.includes(s.elevator_id)||!s.is_served)continue;const old=merged.get(s.stop_label);if(!old||(!old.linked_place_id&&s.linked_place_id))merged.set(s.stop_label,s)}return[...merged.values()].sort((a,b)=>(Number(a.sort_order)||floorRank(a.stop_label))-(Number(b.sort_order)||floorRank(b.stop_label)))}
function arrival(){try{return JSON.parse(sessionStorage.getItem(ARRIVAL)||'null')}catch{return null}}
function candidateFor(p,byId,byParent,tags){
  if(!p)return null;const chain=ancestors(p,byId),chainIds=new Set(chain.map(x=>x.id)),level=currentLevel(p,byId),cands=new Map();
  const add=(e,score)=>{if(!e||usage(e.id,tags)!=='professional'||e.building_code!==p.building_code)return;const old=cands.get(e.id);if(!old||score>old.score)cands.set(e.id,{p:e,score})};
  if(usage(p.id,tags)==='professional')add(p,180);
  const a=arrival();if(a?.elevatorId){const e=byId.get(a.elevatorId);if(e&&(!level||a.levelId===level.id))add(e,170)}
  for(const r of data?.relations||[]){const rs=REL_SCORE[r.relation_type]||0;if(!rs)continue;let e=null,exact=false;if(chainIds.has(r.to_place_id)&&usage(r.from_place_id,tags)==='professional'){e=byId.get(r.from_place_id);exact=r.to_place_id===p.id}else if(chainIds.has(r.from_place_id)&&usage(r.to_place_id,tags)==='professional'){e=byId.get(r.to_place_id);exact=r.from_place_id===p.id}if(e)add(e,rs+(exact?30:4))}
  for(const s of data?.elevator_stops||[]){if(!s.is_served||usage(s.elevator_id,tags)!=='professional')continue;const e=byId.get(s.elevator_id);if(!e||e.building_code!==p.building_code)continue;if(s.linked_place_id===p.id)add(e,125);else if(level&&s.linked_place_id===level.id)add(e,78)}
  if(!cands.size){const pros=[...byId.values()].filter(x=>usage(x.id,tags)==='professional'&&x.building_code===p.building_code);if(pros.length===1)add(pros[0],45)}
  const list=[...cands.values()].sort((a,b)=>b.score-a.score||String(a.p.display_name).localeCompare(String(b.p.display_name),'fr'));if(!list.length)return null;if(list[1]&&list[0].score===list[1].score&&list[0].score<100)return null;return list[0].p
}
function setMode(p){const hospital=['hospital','building'].includes(p?.place_type),level=p?.place_type==='level';content.classList.toggle('floor-hospital-mode',hospital);content.classList.toggle('floor-level-mode',level);for(const sec of content.querySelectorAll('.floor-route-noise'))sec.classList.remove('floor-route-noise');if(level){for(const sec of content.querySelectorAll('.places-section')){const h=sec.querySelector('h2');if(h&&/^comment y aller$/i.test((h.textContent||'').trim()))sec.classList.add('floor-route-noise')}}}
function clearRail(){content.querySelector('[data-floor-quick-rail]')?.remove();content.classList.remove('floor-hospital-mode','floor-level-mode')}
function floorButton(target,label,active,disabled=false){return `<button type="button" class="floor-panel-btn${active?' active':''}${disabled?' disabled':''}" ${disabled?'disabled':`data-floor-target="${esc(target)}"`} aria-label="Niveau ${esc(label)}">${esc(label)}</button>`}
function genericButtons(levels,active){return levels.map(l=>floorButton(l.id,l.level||l.display_name,active?.id===l.id)).join('')}
function elevatorButtons(stops,active){return stops.map(s=>floorButton(s.linked_place_id||'',s.stop_label,!!active&&s.linked_place_id===active.id,!s.linked_place_id)).join('')}
function compactFloor(active){return active?.level||active?.display_name||'↕'}
function shortElevatorName(name=''){return String(name).replace(/^Ascenseurs?\s+(professionnels?\s*)?[—–-]?\s*/i,'').trim()||'Ascenseur professionnel'}
function render(){
  scheduled=false;if(!data)return;const id=currentPlaceId();if(!id){clearRail();return}const {byId,byParent,tags}=maps(),p=byId.get(id);if(!p){clearRail();return}setMode(p);
  const active=currentLevel(p,byId),isDestination=!['hospital','building','level'].includes(p.place_type),elevator=isDestination?candidateFor(p,byId,byParent,tags):null;
  let buttons='',mode='levels',title='Étages',subtitle=p.building_code||'',signature='';
  if(elevator){const stops=effectiveStops(elevator,byParent,tags);if(stops.length){mode='elevator';title='Ascenseur pro le plus proche';subtitle=shortElevatorName(elevator.display_name);buttons=elevatorButtons(stops,active);signature=`e:${elevator.id}:${active?.id||''}:${stops.map(s=>`${s.stop_label}:${s.linked_place_id||''}`).join('|')}`}}
  if(!buttons){const levels=levelsFor(p);if(levels.length<2){clearRail();return}buttons=genericButtons(levels,active);signature=`g:${p.building_code}:${active?.id||''}:${levels.map(x=>x.id).join('|')}`}
  const old=content.querySelector('[data-floor-quick-rail]');const fullSig=`${signature}:${opened?'1':'0'}`;if(old?.dataset.signature===fullSig)return;old?.remove();
  const rail=document.createElement('aside');rail.className=`floor-quick-shell ${opened?'open':''} ${mode==='elevator'?'elevator-context':''}`;rail.dataset.floorQuickRail='1';rail.dataset.signature=fullSig;
  rail.innerHTML=`<button type="button" class="floor-quick-handle" data-floor-toggle aria-expanded="${opened?'true':'false'}" aria-label="${opened?'Fermer':'Ouvrir'} ${esc(title.toLowerCase())}"><span class="floor-handle-icon" aria-hidden="true">↕</span><small>${mode==='elevator'?'PRO':'ÉTAGES'}</small><strong>${esc(compactFloor(active))}</strong></button><section class="floor-quick-panel" aria-hidden="${opened?'false':'true'}"><header><div><small>${mode==='elevator'?'ACCÈS VERTICAL PROFESSIONNEL':'ACCÈS RAPIDE'}</small><strong>${esc(title)}</strong>${subtitle?`<span>${esc(subtitle)}</span>`:''}</div><button type="button" class="floor-panel-close" data-floor-toggle aria-label="Fermer">×</button></header><div class="floor-panel-grid">${buttons}</div>${mode==='elevator'?'<p>Arrêts documentés pour ce secteur.</p>':'<p>Choisis directement un étage.</p>'}</section>`;
  content.appendChild(rail)
}
content.addEventListener('click',e=>{
  const toggle=e.target.closest?.('[data-floor-toggle]');if(toggle){e.preventDefault();e.stopPropagation();opened=!opened;schedule();return}
  const b=e.target.closest?.('[data-floor-target]');if(!b||!data)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const target=b.dataset.floorTarget;if(!target)return;const {byId}=maps(),p=byId.get(currentPlaceId());if(!p)return;opened=false;
  if(p.place_type==='level'&&target===p.id){const hospital=hospitalFor(p,byId);if(hospital){sessionStorage.removeItem(ARRIVAL);location.hash=`#/place/${encodeURIComponent(hospital.id)}`;return}}
  location.hash=`#/place/${encodeURIComponent(target)}`
},true);
document.addEventListener('click',e=>{if(!opened)return;const shell=content.querySelector('[data-floor-quick-rail]');if(shell&&!shell.contains(e.target)){opened=false;schedule()}},true);
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(render)}
function use(d){data=d||window.__STIP_PLACE_DATA||data;schedule()}
window.addEventListener('stip:place-data-ready',()=>use(window.__STIP_PLACE_DATA));window.addEventListener('stip:place-relations-ready',schedule);window.addEventListener('hashchange',()=>{opened=false;setTimeout(schedule,40)});new MutationObserver(schedule).observe(content,{childList:true,subtree:true});setTimeout(()=>use(window.__STIP_PLACE_DATA),250);
})();
