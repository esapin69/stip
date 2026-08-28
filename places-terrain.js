(()=>{
'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-places';
const STORE='stip_session_v1';
const content=document.querySelector('#placesContent');
if(!content)return;
let data=null,scheduled=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
function currentPlaceId(){const m=location.hash.match(/^#\/?place\/(.+)$/);return m?decodeURIComponent(m[1]):''}
function decorate(){
  scheduled=false;if(!data)return;
  content.querySelectorAll('[data-terrain-added]').forEach(x=>x.remove());
  const placeId=currentPlaceId();
  if(placeId){
    const relevant=(data.constraints||[]).filter(c=>Array.isArray(c.scope)&&c.scope.includes(placeId));
    if(relevant.length){
      const section=document.createElement('section');section.className='places-section terrain-section';section.dataset.terrainAdded='constraints';
      section.innerHTML=`<header class="places-section-head"><h2>À savoir sur ce lieu</h2><small>${relevant.length} règle${relevant.length>1?'s':''}</small></header><div class="terrain-constraints">${relevant.map(constraintCard).join('')}</div>`;
      const detail=content.querySelector('.place-detail');(detail||content).append(section);
    }
    return;
  }
  const fragments=data.route_fragments||[];
  if(fragments.length&&content.querySelector('.places-section,.places-visit-intro')){
    const section=document.createElement('section');section.className='places-section terrain-section';section.dataset.terrainAdded='fragments';
    section.innerHTML=`<header class="places-section-head"><h2>Parcours terrain</h2><small>${fragments.length} parcours vérifié${fragments.length>1?'s':''}</small></header><div class="terrain-list">${fragments.map(fragmentCard).join('')}</div>`;
    content.append(section);
  }
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(decorate)}
new MutationObserver(schedule).observe(content,{childList:true,subtree:true});
window.addEventListener('hashchange',schedule);
load().then(d=>{data=d;schedule()}).catch(e=>console.error('Terrain STIP',e));
})();