(()=>{
'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-places';
const STORE='stip_session_v1';
const content=document.querySelector('#placesContent');
if(!content)return;
let data=null,scheduled=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const evidenceLabel=v=>v==='official_current'?'Confirmé HCL':v==='terrain_validated'?'Terrain validé':v==='inferred'?'Déduit avec prudence':v==='confirmed_old'?'Source ancienne':'À confirmer';
const visibilityLabel=v=>v==='restricted'?'Accès restreint':v==='internal_stip'?'Info STIP':'Public';
const DEST_TYPES=new Set(['service','unit','exam','block']);
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
function chip(text,cls=''){return `<span class="terrain-chip ${cls}">${esc(text)}</span>`}
function constraintCard(c){return `<article class="terrain-constraint ${esc(c.visibility)}"><div>${chip(visibilityLabel(c.visibility),c.visibility)}${chip(evidenceLabel(c.evidence_status),'evidence')}</div><p>${esc(c.rule)}</p></article>`}
function routeState(){const h=location.hash.replace(/^#\/?/,'');if(h==='visit')return{kind:'visit',id:''};const m=h.match(/^(place|route)\/(.+)$/);return m?{kind:m[1],id:decodeURIComponent(m[2])}:{kind:'home',id:''}}
function currentPlaceId(){const r=routeState();return r.kind==='place'?r.id:''}
function mapById(){return new Map((data?.places||[]).map(p=>[p.id,p]))}
function isRouteCue(p){return !!p&&(['landmark','walkway'].includes(p.place_type)||(data?.tags||[]).some(t=>t.place_id===p.id&&t.tag==='navigation:landmark_only'))}
function siblingExams(p){if(!p?.parent_id)return[];return (data?.places||[]).filter(x=>x.parent_id===p.parent_id&&x.place_type==='exam').sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.display_name).localeCompare(String(b.display_name),'fr'))}
function examRow(p){return `<button class="place-row exam-choice-row" type="button" data-place="${esc(p.id)}"><div class="place-row-main"><span class="exam-choice-label">EXAMEN</span><strong>${esc(p.display_name)}</strong>${p.summary?`<p>${esc(p.summary)}</p>`:''}</div><span class="place-next">›</span></button>`}
function enhanceExamSemantics(){
  const id=currentPlaceId();if(!id||!data)return;
  const map=mapById(),p=map.get(id),hero=content.querySelector('.place-hero-card');if(!p||!hero)return;
  const kicker=hero.querySelector('.place-kicker');
  if(p.place_type==='exam'&&kicker)kicker.textContent='EXAMEN';
  if(p.place_type==='reception'&&kicker)kicker.textContent='ACCUEIL / REPÈRE';
  const exams=siblingExams(p);
  if(p.place_type!=='reception'||!exams.length||content.querySelector('[data-exam-choices]'))return;
  const sec=document.createElement('section');sec.className='places-section exam-choice-section';sec.dataset.examChoices='1';
  sec.innerHTML=`<header class="places-section-head"><h2>Examens de ce secteur</h2><small>${exams.length} examen${exams.length>1?'s':''}</small></header><div class="places-list">${exams.map(examRow).join('')}</div>`;
  hero.insertAdjacentElement('afterend',sec);
}
function directionHead(text=''){
  const m=String(text).trim().match(/^(à gauche|a gauche|sur la gauche|à droite|a droite|sur la droite|tout droit|en face)\b/i);
  if(!m)return'';
  const n=norm(m[1]);
  if(n.includes('gauche'))return'← À gauche';
  if(n.includes('droite'))return'À droite →';
  return'↑ Tout droit';
}
function cleanListItem(v){
  let s=String(v||'').trim().replace(/^[·•,;\-–—\s]+|[·•,;\-–—\s]+$/g,'');
  s=s.replace(/^(secteur\s+des?\s+examens?|secteur\s+de\s+|examens?\s+)/i,'').trim();
  return s?s.charAt(0).toUpperCase()+s.slice(1):'';
}
function splitList(text=''){return [...new Set(String(text).split(/\s*(?:\/|·|;|•)\s*/).map(cleanListItem).filter(Boolean))]}
function structuredForRelation(r){
  const d=String(r.direction||'');
  const dash=d.split(/\s+[—–-]\s+/);
  const tail=dash.length>1?dash.slice(1).join(' — '):'';
  for(const source of [tail,r.label,d]){
    if(!source)continue;
    const items=splitList(source);
    if(items.length>=2&&items.every(x=>x.length<=55))return{items,dir:directionHead(d)};
  }
  return null;
}
function enhanceRelationLists(){
  const from=currentPlaceId();if(!from||!data)return;
  for(const row of content.querySelectorAll('.place-row[data-place]')){
    if(row.querySelector('[data-smart-list]'))continue;
    const to=row.dataset.place||'';if(!to)continue;
    const candidates=(data.relations||[]).filter(r=>r.from_place_id===from&&r.to_place_id===to&&(r.label||r.direction)).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
    let relation=null,info=null;
    for(const r of candidates){const x=structuredForRelation(r);if(x){relation=r;info=x;break}}
    if(!relation||!info)continue;
    const main=row.querySelector('.place-row-main');if(!main)continue;
    for(const p of main.querySelectorAll(':scope > p')){
      const t=norm(p.textContent);
      if((relation.label&&t.includes(norm(relation.label)))||(relation.direction&&t.includes(norm(relation.direction))))p.remove();
    }
    const box=document.createElement('div');box.className='place-structured-info';box.dataset.smartList='1';
    if(info.dir){const dir=document.createElement('span');dir.className='place-structured-direction';dir.textContent=info.dir;box.append(dir)}
    const ul=document.createElement('ul');ul.className='place-smart-list';
    for(const item of info.items){const li=document.createElement('li');li.textContent=item;ul.append(li)}
    box.append(ul);main.append(box);
  }
}
function enhanceGenericLists(){
  for(const p of content.querySelectorAll('.place-row-main > p:not([data-list-checked])')){
    if(p.closest('[data-campus-services]'))continue;
    p.dataset.listChecked='1';
    if(p.closest('.place-row')?.querySelector('[data-smart-list]'))continue;
    const text=String(p.textContent||'').trim();
    if(text.length<50)continue;
    const items=splitList(text);
    if(items.length<3||items.some(x=>x.length>45))continue;
    const box=document.createElement('div');box.className='place-structured-info';box.dataset.smartList='1';
    const ul=document.createElement('ul');ul.className='place-smart-list';
    for(const item of items){const li=document.createElement('li');li.textContent=item;ul.append(li)}
    box.append(ul);p.replaceWith(box);
  }
}
function enhanceRouteCueRows(){
  if(!data)return;
  const map=mapById();
  for(const row of content.querySelectorAll('.place-row[data-place]')){
    const p=map.get(row.dataset.place||'');
    if(!isRouteCue(p))continue;
    row.classList.add('route-cue-row');
    row.setAttribute('aria-label',`Repère de trajet : ${p.display_name}`);
    const main=row.querySelector('.place-row-main');
    if(main&&!main.querySelector('.route-cue-label')){
      const tag=document.createElement('span');tag.className='route-cue-label';tag.textContent=p.place_type==='walkway'?'LIAISON / CHEMIN':'REPÈRE VISUEL';main.prepend(tag);
    }
  }
}
function routeTarget(id,map){
  const allowed=new Set(['route_next','route_branch','connects_to','accesses','exit_near','arrives_near']);
  return (data?.relations||[]).filter(r=>r.from_place_id===id&&allowed.has(r.relation_type)&&map.has(r.to_place_id)).sort((a,b)=>{const score=t=>t==='route_next'?100:t==='route_branch'?90:t==='connects_to'?80:t==='accesses'?70:60;return score(b.relation_type)-score(a.relation_type)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0)})[0]||null;
}
function enhanceLandmark(){
  const id=currentPlaceId();if(!id||!data)return;
  const map=mapById(),p=map.get(id),hero=content.querySelector('.place-hero-card');
  if(!p||!hero||!isRouteCue(p))return;
  const r=routeTarget(id,map),target=r?map.get(r.to_place_id):null;if(!target)return;
  const signature=`${id}:${target.id}`;if(hero.dataset.landmarkGuide===signature)return;hero.dataset.landmarkGuide=signature;
  const kicker=hero.querySelector('.place-kicker'),h2=hero.querySelector('h2');
  if(kicker)kicker.textContent='VISITE · VERS';
  if(h2)h2.textContent=target.display_name;
  const subtitle=document.createElement('div');subtitle.className='landmark-route-subtitle';subtitle.innerHTML=`<span>${p.place_type==='walkway'?'LIAISON / CHEMIN':'REPÈRE VISUEL'}</span><strong>${esc(p.display_name)}</strong>`;h2?.insertAdjacentElement('afterend',subtitle);
  const paragraphs=[...hero.querySelectorAll(':scope > p')];
  if(paragraphs[0])paragraphs[0].textContent=`${p.display_name} sert à te repérer sur le chemin vers ${target.display_name}.`;
  paragraphs.slice(1).forEach(x=>x.remove());
  if(r.direction){const callout=document.createElement('div');callout.className='landmark-route-instruction';callout.innerHTML=`<b>À faire</b><span>${esc(r.direction)}</span>`;hero.append(callout)}
}
function campusDestinationChildren(rootId){
  const places=data?.places||[],byParent=new Map(),out=[],seen=new Set();
  for(const p of places){if(!p.parent_id)continue;const a=byParent.get(p.parent_id)||[];a.push(p);byParent.set(p.parent_id,a)}
  function walk(id,depth=0){if(depth>8)return;for(const p of byParent.get(id)||[]){if(seen.has(p.id))continue;seen.add(p.id);if(DEST_TYPES.has(p.place_type))out.push(p);else walk(p.id,depth+1)}}
  walk(rootId);
  return out.sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.display_name).localeCompare(String(b.display_name),'fr'));
}
function campusButton(p){const level=p.level?`<small>${esc(p.level==='RDC'?'RDC':`${p.level}e étage`)}</small>`:'';return `<button type="button" class="visit-campus-service" data-place="${esc(p.id)}"><span><strong>${esc(p.display_name)}</strong>${level}</span><b>›</b></button>`}
function enhanceCampusSection(){
  if(!data||routeState().kind!=='visit')return;
  const section=[...content.querySelectorAll('.places-section')].find(s=>/bâtiments et repères du campus/i.test(s.querySelector('h2')?.textContent||''));
  if(!section||section.dataset.campusServices==='1')return;
  const map=mapById(),ids=['a1','a4','a3','b14','radiotherapy','cermep','mortuary','petit_monde'].filter(id=>map.has(id));
  section.dataset.campusServices='1';
  const head=section.querySelector('.places-section-head h2');if(head)head.textContent='Autres lieux du GHE';
  const small=section.querySelector('.places-section-head small');if(small)small.textContent='Un lieu, puis ses services';
  const wrap=document.createElement('div');wrap.className='visit-campus-groups';wrap.dataset.campusServices='1';
  for(const id of ids){const place=map.get(id),services=campusDestinationChildren(id);const card=document.createElement('section');card.className='visit-campus-card';card.innerHTML=`<header><strong>${esc(place.display_name)}</strong>${place.place_type==='landmark'?'<small>Repère uniquement</small>':''}</header>${services.length?`<div class="visit-campus-services">${services.map(campusButton).join('')}</div>`:`<p class="visit-campus-no-service">${place.place_type==='landmark'?'Repère de positionnement, non cliquable.':'Services à détailler dans le référentiel.'}</p>`}`;wrap.append(card)}
  const old=section.querySelector('.places-list');if(old)old.replaceWith(wrap);else section.append(wrap);
}
function enhanceReadability(){enhanceCampusSection();enhanceExamSemantics();enhanceLandmark();enhanceRouteCueRows();enhanceRelationLists();enhanceGenericLists()}
function decorate(){
  scheduled=false;if(!data)return;
  const state=routeState();
  if(state.kind==='place'){
    const relevant=(data.constraints||[]).filter(c=>Array.isArray(c.scope)&&c.scope.includes(state.id));
    const signature=`constraints:${state.id}:${relevant.map(x=>x.id).join(',')}`;
    if(content.querySelector(`[data-terrain-added="constraints"][data-signature="${CSS.escape(signature)}"]`)){enhanceReadability();return}
    content.querySelectorAll('[data-terrain-added]').forEach(x=>x.remove());
    if(relevant.length){const section=document.createElement('section');section.className='places-section terrain-section';section.dataset.terrainAdded='constraints';section.dataset.signature=signature;section.innerHTML=`<header class="places-section-head"><h2>À savoir sur ce lieu</h2><small>${relevant.length} règle${relevant.length>1?'s':''}</small></header><div class="terrain-constraints">${relevant.map(constraintCard).join('')}</div>`;const detail=content.querySelector('.place-detail');(detail||content).append(section)}
    enhanceReadability();return;
  }
  content.querySelectorAll('[data-terrain-added="fragments"]').forEach(x=>x.remove());
  enhanceReadability();
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate)}
new MutationObserver(schedule).observe(content,{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);
window.addEventListener('stip:place-data-ready',schedule);
window.addEventListener('stip:place-relations-ready',schedule);
load().then(d=>{data=d;schedule()}).catch(e=>console.error('Terrain STIP',e));
})();