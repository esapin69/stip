(()=>{
'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-places';
const STORE='stip_session_v1';
const content=document.querySelector('#placesContent');
if(!content)return;
let data=null,byId=new Map(),relations=[],routes=[],steps=new Map(),tags=new Map(),scheduled=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function currentPlaceId(){const m=location.hash.match(/^#\/?place\/(.+)$/);return m?decodeURIComponent(m[1]):''}
function buildingName(p){return p?.building_code==='HLP'?'Louis Pradel':p?.building_code==='PW'?'Pierre Wertheimer':p?.building_code==='HFME'?'HFME':p?.building_code||''}
function whereLabel(p){return [buildingName(p),p?.level?`niveau ${p.level}`:''].filter(Boolean).join(' · ')||'GHE'}
function evidenceSuffix(v){return v==='confirmed_old'?' · ancien repère':v==='to_confirm'?' · à confirmer':''}
function placeButton(p,label=''){return `<button type="button" class="orient-place" data-place="${esc(p.id)}"><strong>${esc(p.display_name)}</strong>${label?`<span>${esc(label)}</span>`:''}</button>`}
function routePriority(t){return({route_next:100,route_branch:98,exit_near:96,arrives_near:94,signposted_to:90,opposite_side_landmark:86,connects_to:82,accesses:78,signposted_near:76,near:72,adjacent:70,passes_near:68,serves:60,located_in:45,visitor_reference:35,contains:20}[t]||40)}
function hasTag(id,tag){return tags.get(id)?.has(tag)||false}
function elevatorUsage(id){if(hasTag(id,'elevator:professional'))return'professional';if(hasTag(id,'elevator:visitor_reference'))return'visitor_reference';return'unknown'}
function relationAllowedForPath(r){if(r.relation_type==='visitor_reference')return false;const from=byId.get(r.from_place_id);if(from&&['elevator','elevator_group'].includes(from.place_type)&&r.relation_type==='serves'&&elevatorUsage(from.id)!=='professional')return false;return true}
function related(id){const out=[];for(const r of relations){if(r.from_place_id===id&&byId.has(r.to_place_id))out.push({r,p:byId.get(r.to_place_id),reverse:false});else if(r.to_place_id===id&&byId.has(r.from_place_id))out.push({r,p:byId.get(r.from_place_id),reverse:true})}return out}
function directionIsLocal(t){return['route_next','route_branch','exit_near','opposite_side_landmark','connects_to'].includes(t)}
function cue(x){
  const t=x.r.relation_type,d=x.r.direction?.trim();
  if(t==='visitor_reference')return 'Repère visiteurs uniquement'+evidenceSuffix(x.r.evidence_status);
  if(t==='serves'&&['elevator','elevator_group'].includes(x.p.place_type)&&elevatorUsage(x.p.id)!=='professional')return 'Ascenseur non recommandé · usage à confirmer'+evidenceSuffix(x.r.evidence_status);
  if(!x.reverse&&d&&directionIsLocal(t))return d+evidenceSuffix(x.r.evidence_status);
  if(t==='route_next')return (x.reverse?'Juste avant':'Juste après')+evidenceSuffix(x.r.evidence_status);
  if(t==='route_branch')return (x.reverse?'Branche depuis ce repère':'Branche depuis ici')+evidenceSuffix(x.r.evidence_status);
  if(t==='opposite_side_landmark')return 'En face / côté opposé'+evidenceSuffix(x.r.evidence_status);
  if(t==='adjacent')return 'Juste à côté'+evidenceSuffix(x.r.evidence_status);
  if(t==='near'||t==='signposted_near')return 'À proximité'+evidenceSuffix(x.r.evidence_status);
  if(t==='passes_near')return 'Sur le chemin'+evidenceSuffix(x.r.evidence_status);
  if(t==='signposted_to')return 'Signalé depuis ici'+evidenceSuffix(x.r.evidence_status);
  if(t==='connects_to')return 'Relié directement'+evidenceSuffix(x.r.evidence_status);
  if(t==='serves')return (x.reverse?'Desservi par':'Dessert')+evidenceSuffix(x.r.evidence_status);
  if(t==='exit_near')return 'À la sortie de l’ascenseur'+evidenceSuffix(x.r.evidence_status);
  if(t==='arrives_near')return (x.reverse?'Point d’arrivée':'Arrive près de')+evidenceSuffix(x.r.evidence_status);
  return (x.r.label||'Relié')+evidenceSuffix(x.r.evidence_status);
}
function elevatorArrivals(p){
  const out=[],seen=new Set();
  for(const r of relations){
    if(r.to_place_id!==p.id||r.relation_type!=='serves'||!byId.has(r.from_place_id))continue;
    const e=byId.get(r.from_place_id);if(!e||!['elevator','elevator_group'].includes(e.place_type)||elevatorUsage(e.id)!=='professional'||seen.has(e.id))continue;
    seen.add(e.id);out.push({r,p:e});
  }
  return out.sort((a,b)=>(Number(a.r.sort_order)||0)-(Number(b.r.sort_order)||0)||String(a.p.display_name).localeCompare(String(b.p.display_name),'fr'));
}
function bestIncoming(id,seen=new Set()){
  const list=relations.filter(r=>relationAllowedForPath(r)&&r.to_place_id===id&&byId.has(r.from_place_id)&&!seen.has(r.from_place_id));
  list.sort((a,b)=>routePriority(b.relation_type)-routePriority(a.relation_type)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
  return list[0]||null;
}
function buildChain(p){
  const chain=[p];let cur=p;const seen=new Set([p.id]);
  for(let i=0;i<6;i++){
    const r=bestIncoming(cur.id,seen);if(!r)break;
    const prev=byId.get(r.from_place_id);if(!prev)break;
    chain.unshift(prev);seen.add(prev.id);cur=prev;
    if(['entrance','hall','elevator','elevator_group','landmark','walkway'].includes(prev.place_type)&&chain.length>=4)break;
  }
  return chain;
}
function immediateArrival(p){
  const candidates=relations.filter(r=>relationAllowedForPath(r)&&r.to_place_id===p.id&&byId.has(r.from_place_id));
  candidates.sort((a,b)=>{const ad=(a.direction||a.label)?1:0,bd=(b.direction||b.label)?1:0;return bd-ad||routePriority(b.relation_type)-routePriority(a.relation_type)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0)});
  const r=candidates[0];if(!r)return null;return{r,from:byId.get(r.from_place_id)};
}
function routeHint(p){
  const found=routes.filter(r=>r.to_place_id===p.id).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0))[0];
  if(!found)return'';const ss=steps.get(found.id)||[];if(ss.length)return ss.slice(0,3).map(x=>x.instruction).join(' → ');return found.label||'';
}
function pathHtml(p){
  const hasSpatialIncoming=relations.some(r=>relationAllowedForPath(r)&&r.to_place_id===p.id&&byId.has(r.from_place_id)&&r.relation_type!=='serves'&&routePriority(r.relation_type)>60);
  const elevators=elevatorArrivals(p);
  if(!hasSpatialIncoming&&elevators.length){
    const names=elevators.map(x=>x.p.display_name).join(elevators.length>2?', ':elevators.length===2?' ou ':'');
    return `<span class="orient-text">Accès professionnel indiqué par ${esc(names)}. Le chemin précis après la sortie reste à compléter.</span>`;
  }
  const chain=buildChain(p);
  if(chain.length>1)return chain.map((x,i)=>`${i?'<span class="orient-arrow">→</span>':''}${placeButton(x)}`).join('');
  const hint=routeHint(p);if(hint)return `<span class="orient-text">${esc(hint)}</span>`;
  return '<span class="orient-missing">À compléter — chemin précis non documenté</span>';
}
function arrivalHtml(p){
  const elevators=elevatorArrivals(p);
  if(elevators.length){
    const buttons=elevators.map(x=>placeButton(x.p,x.r.label||'Accès professionnel indiqué')).join('');
    return `<div class="orient-near-grid">${buttons}</div><span class="orient-arrival-text">${elevators.length>1?'Plusieurs ascenseurs professionnels sont documentés ; aucun n’est choisi arbitrairement.':'Ascenseur professionnel documenté.'}</span>`;
  }
  const a=immediateArrival(p);
  if(a){const text=a.r.direction||a.r.label||'Repère relié';return `${placeButton(a.from)}<span class="orient-arrival-text">${esc(text)}${esc(evidenceSuffix(a.r.evidence_status))}</span>`}
  const parent=p.parent_id?byId.get(p.parent_id):null;
  if(parent)return `${placeButton(parent)}<span class="orient-arrival-text">Dans ce secteur — orientation fine à compléter</span>`;
  return '<span class="orient-missing">À compléter — aucun repère d’arrivée précis</span>';
}
function nearbyHtml(p){
  const items=related(p.id).filter(x=>x.r.relation_type!=='contains'&&x.r.relation_type!=='located_in');
  items.sort((a,b)=>{
    const sameA=a.p.building_code===p.building_code&&a.p.level===p.level?1:0,sameB=b.p.building_code===p.building_code&&b.p.level===p.level?1:0;
    return sameB-sameA||routePriority(b.r.relation_type)-routePriority(a.r.relation_type)||(Number(a.r.sort_order)||0)-(Number(b.r.sort_order)||0);
  });
  const unique=[],seen=new Set();for(const x of items){if(seen.has(x.p.id))continue;seen.add(x.p.id);unique.push(x);if(unique.length===4)break}
  if(!unique.length)return '<span class="orient-missing">À compléter — proximité non relevée</span>';
  return `<div class="orient-near-grid">${unique.map(x=>placeButton(x.p,cue(x))).join('')}</div>`;
}
function sectorLabel(p){const parent=p.parent_id?byId.get(p.parent_id):null;if(!parent)return'';if(parent.place_type==='level'||parent.place_type==='hospital')return'';return parent.display_name||''}
function card(p){
  const sector=sectorLabel(p);
  return `<section class="place-orientation" data-se-reperer="1" data-place-id="${esc(p.id)}"><header><div><small>SE REPÉRER</small><h3>${esc(whereLabel(p))}</h3>${sector?`<p>${esc(sector)}</p>`:''}</div><span class="orient-pin">⌖</span></header><div class="orient-line"><b>Depuis</b><div>${arrivalHtml(p)}</div></div><div class="orient-line orient-path-line"><b>Chemin</b><div class="orient-path">${pathHtml(p)}</div></div><div class="orient-line orient-near-line"><b>À proximité</b><div>${nearbyHtml(p)}</div></div></section>`;
}
function render(){
  scheduled=false;if(!data)return;const id=currentPlaceId(),hero=content.querySelector('.place-hero-card'),old=content.querySelector('[data-se-reperer]');
  if(!id||!hero){old?.remove();return}if(old?.dataset.placeId===id)return;old?.remove();const p=byId.get(id);if(!p)return;hero.insertAdjacentHTML('afterend',card(p));
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(render)}
async function load(){
  const token=localStorage.getItem(STORE)||'',headers={'Content-Type':'application/json'};let action='bootstrap_public';if(token){headers['X-STIP-Session']=token;action='bootstrap'}
  let r=await fetch(API,{method:'POST',cache:'no-store',headers,body:JSON.stringify({action})});
  if(r.status===401&&token){localStorage.removeItem(STORE);r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bootstrap_public'})})}
  const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||`Erreur ${r.status}`);
  data=j;byId=new Map((j.places||[]).map(p=>[p.id,p]));relations=j.relations||[];routes=j.routes||[];tags=new Map();for(const t of j.tags||[]){const s=tags.get(t.place_id)||new Set();s.add(t.tag);tags.set(t.place_id,s)}steps=new Map();for(const s of j.route_steps||[]){const a=steps.get(s.route_id)||[];a.push(s);steps.set(s.route_id,a)}for(const a of steps.values())a.sort((x,y)=>x.step_no-y.step_no);
  window.__STIP_PLACE_DATA=j;window.__STIP_PLACE_RELATIONS=relations;window.dispatchEvent(new CustomEvent('stip:place-data-ready'));window.dispatchEvent(new CustomEvent('stip:place-relations-ready'));schedule();
}
new MutationObserver(schedule).observe(content,{childList:true,subtree:true});window.addEventListener('hashchange',()=>setTimeout(schedule,60));
load().catch(e=>console.error('Se repérer STIP',e));
})();
