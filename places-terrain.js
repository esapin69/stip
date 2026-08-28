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
function fragmentCard(f){
  const steps=Array.isArray(f.steps)?f.steps:[];
  const restricted=Array.isArray(f.restricted_substeps)?f.restricted_substeps:[];
  const operational=Array.isArray(f.operational_notes)?f.operational_notes:[];
  return `<details class="terrain-card"><summary><span><strong>${esc(f.label)}</strong><small>${chip(visibilityLabel(f.visibility),f.visibility)}${chip(evidenceLabel(f.evidence_status),'evidence')}</small></span><b>＋</b></summary><div class="terrain-card-body">${steps.length?`<ol>${steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}${f.notes?`<p>${esc(f.notes)}</p>`:''}${operational.map(n=>`<p class="terrain-operational">${esc(n)}</p>`).join('')}${restricted.map(n=>`<p class="terrain-restricted">${esc(n)}</p>`).join('')}</div></details>`;
}
function constraintCard(c){return `<article class="terrain-constraint ${esc(c.visibility)}"><div>${chip(visibilityLabel(c.visibility),c.visibility)}${chip(evidenceLabel(c.evidence_status),'evidence')}</div><p>${esc(c.rule)}</p></article>`}
function routeState(){const h=location.hash.replace(/^#\/?/,'');if(h==='visit')return{kind:'visit',id:''};const m=h.match(/^(place|route)\/(.+)$/);return m?{kind:m[1],id:decodeURIComponent(m[2])}:{kind:'home',id:''}}
function currentPlaceId(){const r=routeState();return r.kind==='place'?r.id:''}
function mapById(){return new Map((data?.places||[]).map(p=>[p.id,p]))}
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
function splitList(text=''){
  return [...new Set(String(text).split(/\s*(?:\/|·|;|•)\s*/).map(cleanListItem).filter(Boolean))];
}
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
function enhanceLandmark(){
  const id=currentPlaceId();if(!id||!data)return;
  const map=mapById(),p=map.get(id),hero=content.querySelector('.place-hero-card');
  if(!p||!hero||p.place_type!=='landmark')return;
  const landmarkOnly=(data.tags||[]).some(t=>t.place_id===id&&t.tag==='navigation:landmark_only');
  if(!landmarkOnly)return;
  const routes=(data.relations||[]).filter(r=>r.from_place_id===id&&r.relation_type==='route_next'&&map.has(r.to_place_id)).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
  const r=routes[0],target=r?map.get(r.to_place_id):null;if(!target)return;
  const signature=`${id}:${target.id}`;if(hero.dataset.landmarkGuide===signature)return;hero.dataset.landmarkGuide=signature;
  const kicker=hero.querySelector('.place-kicker'),h2=hero.querySelector('h2');
  if(kicker)kicker.textContent='VISITE · VERS';
  if(h2)h2.textContent=target.display_name;
  const subtitle=document.createElement('div');subtitle.className='landmark-route-subtitle';subtitle.innerHTML=`<span>REPÈRE VISUEL</span><strong>${esc(p.display_name)}</strong>`;h2?.insertAdjacentElement('afterend',subtitle);
  const paragraphs=[...hero.querySelectorAll(':scope > p')];
  if(paragraphs[0])paragraphs[0].textContent=`${p.display_name} sert à te repérer sur le chemin vers ${target.display_name}.`;
  paragraphs.slice(1).forEach(x=>x.remove());
  if(r.direction){const callout=document.createElement('div');callout.className='landmark-route-instruction';callout.innerHTML=`<b>À faire</b><span>${esc(r.direction)}</span>`;hero.append(callout)}
}
function enhanceReadability(){enhanceLandmark();enhanceRelationLists();enhanceGenericLists()}
function decorate(){
  scheduled=false;if(!data)return;
  const state=routeState();
  if(state.kind==='place'){
    const relevant=(data.constraints||[]).filter(c=>Array.isArray(c.scope)&&c.scope.includes(state.id));
    const signature=`constraints:${state.id}:${relevant.map(x=>x.id).join(',')}`;
    if(content.querySelector(`[data-terrain-added="constraints"][data-signature="${CSS.escape(signature)}"]`)){enhanceReadability();return}
    content.querySelectorAll('[data-terrain-added]').forEach(x=>x.remove());
    if(relevant.length){
      const section=document.createElement('section');section.className='places-section terrain-section';section.dataset.terrainAdded='constraints';section.dataset.signature=signature;
      section.innerHTML=`<header class="places-section-head"><h2>À savoir sur ce lieu</h2><small>${relevant.length} règle${relevant.length>1?'s':''}</small></header><div class="terrain-constraints">${relevant.map(constraintCard).join('')}</div>`;
      const detail=content.querySelector('.place-detail');(detail||content).append(section);
    }
    enhanceReadability();return;
  }
  if(state.kind!=='home'&&state.kind!=='visit'){content.querySelectorAll('[data-terrain-added]').forEach(x=>x.remove());enhanceReadability();return}
  const fragments=data.route_fragments||[];
  const signature=`fragments:${state.kind}:${fragments.map(x=>x.id).join(',')}`;
  if(content.querySelector(`[data-terrain-added="fragments"][data-signature="${CSS.escape(signature)}"]`)){enhanceReadability();return}
  content.querySelectorAll('[data-terrain-added]').forEach(x=>x.remove());
  if(fragments.length&&content.querySelector('.places-section,.places-visit-intro')){
    const section=document.createElement('section');section.className='places-section terrain-section';section.dataset.terrainAdded='fragments';section.dataset.signature=signature;
    section.innerHTML=`<header class="places-section-head"><h2>Parcours terrain</h2><small>${fragments.length} parcours vérifié${fragments.length>1?'s':''}</small></header><div class="terrain-list">${fragments.map(fragmentCard).join('')}</div>`;
    content.append(section);
  }
  enhanceReadability();
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate)}
new MutationObserver(schedule).observe(content,{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);
window.addEventListener('stip:place-data-ready',schedule);
window.addEventListener('stip:place-relations-ready',schedule);
load().then(d=>{data=d;schedule()}).catch(e=>console.error('Terrain STIP',e));
})();