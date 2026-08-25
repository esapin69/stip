(()=>{
'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-places';
const STORE='stip_session_v1';
const $=s=>document.querySelector(s);
const content=$('#placesContent'),status=$('#placesStatus'),search=$('#placesSearch'),clear=$('#placesClear');
const state={data:null,byId:new Map(),children:new Map(),aliases:new Map(),tags:new Map(),relations:[],routes:[],steps:new Map(),index:new Map(),routeOpen:null};

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function token(){return localStorage.getItem(STORE)||''}
function typeLabel(t){return({campus:'Campus',hospital:'Hôpital',building:'Bâtiment',level:'Niveau',service:'Service',unit:'Unité',entrance:'Entrée',elevator:'Ascenseur',elevator_group:'Ascenseurs',walkway:'Liaison',landmark:'Repère',room:'Salle',block:'Bloc',helipad:'Hélistation',staff_area:'Zone STIP',parking:'Parking'}[t]||'Lieu')}
function evidenceLabel(v){return v==='official_current'?'Confirmé HCL':v==='terrain_validated'?'Terrain validé':v==='confirmed_old'?'Source ancienne':'À confirmer'}
function evidenceClass(v){return v==='official_current'?'official':v==='terrain_validated'?'terrain':'confirm'}
function locationLabel(p){return [p.building_code,p.level&&`niveau ${p.level}`].filter(Boolean).join(' · ')}
function sortPlaces(a,b){return (Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.display_name).localeCompare(String(b.display_name),'fr')}
function setStatus(text='',kind=''){status.textContent=text;status.className=`places-status ${kind}`.trim()}
function chip(text,cls=''){return text?`<span class="place-chip ${cls}">${esc(text)}</span>`:''}
function placeMeta(p){return `<div class="place-meta">${locationLabel(p)?chip(locationLabel(p)):''}${chip(evidenceLabel(p.evidence_status),evidenceClass(p.evidence_status))}${p.visibility!=='public'?chip('Info STIP','internal'):''}</div>`}
function iconFor(p){const s={hlp:'CAR',pw:'NEU',hfme:'HFME',a1:'A1',a4:'A4',a3:'A3',b14:'B14',radiotherapy:'RT',cermep:'CER',mortuary:'MOR'};return s[p.id]||String(p.building_code||p.level||typeLabel(p.place_type).slice(0,3)).toUpperCase().slice(0,4)}

async function call(){
  const t=token();
  if(!t){location.replace('/');return null}
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
  try{
    const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-STIP-Session':t},body:JSON.stringify({action:'bootstrap'}),signal:c.signal});
    const j=await r.json().catch(()=>({}));
    if(r.status===401){localStorage.removeItem(STORE);location.replace('/');return null}
    if(!r.ok||j.error)throw new Error(j.error||`Erreur ${r.status}`);
    return j;
  }finally{clearTimeout(timer)}
}

function build(d){
  state.data=d;state.byId.clear();state.children.clear();state.aliases.clear();state.tags.clear();state.steps.clear();state.index.clear();
  (d.places||[]).forEach(p=>state.byId.set(p.id,p));
  (d.places||[]).forEach(p=>{if(!p.parent_id)return;const x=state.children.get(p.parent_id)||[];x.push(p);state.children.set(p.parent_id,x)});
  for(const arr of state.children.values())arr.sort(sortPlaces);
  (d.aliases||[]).forEach(a=>{const x=state.aliases.get(a.place_id)||[];x.push(a.alias);state.aliases.set(a.place_id,x)});
  (d.tags||[]).forEach(a=>{const x=state.tags.get(a.place_id)||[];x.push(a.tag);state.tags.set(a.place_id,x)});
  state.relations=d.relations||[];state.routes=d.routes||[];
  (d.route_steps||[]).forEach(s=>{const x=state.steps.get(s.route_id)||[];x.push(s);state.steps.set(s.route_id,x)});
  for(const x of state.steps.values())x.sort((a,b)=>a.step_no-b.step_no);
  for(const p of d.places||[]){
    const aliases=state.aliases.get(p.id)||[],tags=state.tags.get(p.id)||[];
    const text=norm([p.display_name,p.official_name,p.building_code,p.level,p.summary,p.details,...aliases,...tags].filter(Boolean).join(' '));
    state.index.set(p.id,{text,aliases:aliases.map(norm),name:norm(p.display_name),official:norm(p.official_name),tags:tags.map(norm)});
  }
}

function score(p,q){
  const n=norm(q),i=state.index.get(p.id);if(!n||!i)return 0;
  const terms=n.split(' ').filter(Boolean);if(!terms.every(t=>i.text.includes(t)))return 0;
  let s=10;
  if(i.name===n)s+=100;if(i.official===n)s+=90;
  if(i.name.startsWith(n))s+=55;else if(i.name.includes(n))s+=28;
  for(const a of i.aliases){if(a===n)s+=95;else if(a.startsWith(n))s+=48;else if(a.includes(n))s+=22}
  if(String(p.id).includes(n))s+=10;
  if(norm(p.level)===n)s+=26;
  if(norm(p.building_code)===n)s+=42;
  if(i.tags.includes(n))s+=22;
  return s;
}
function find(q){return [...state.byId.values()].map(p=>({p,s:score(p,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||sortPlaces(a.p,b.p)).slice(0,30).map(x=>x.p)}

function row(p,extra=''){
  return `<button class="place-row" type="button" data-place="${esc(p.id)}"><div class="place-row-main"><strong>${esc(p.display_name)}</strong>${p.summary?`<p>${esc(p.summary)}</p>`:''}${placeMeta(p)}${extra}</div><span class="place-next">›</span></button>`
}
function primary(p){return `<button class="place-primary" type="button" data-place="${esc(p.id)}"><span class="place-icon">${esc(iconFor(p))}</span><span><strong>${esc(p.display_name)}</strong><small>${esc(p.summary||typeLabel(p.place_type))}</small></span></button>`}
function section(title,items,small=''){return `<section class="places-section"><header class="places-section-head"><h2>${esc(title)}</h2>${small?`<small>${esc(small)}</small>`:''}</header><div class="places-list">${items.join('')}</div></section>`}

function renderHome(){
  state.routeOpen=null;const roots=['hlp','pw','hfme'].map(id=>state.byId.get(id)).filter(Boolean);
  const anchors=['a1','a4','a3','b14','radiotherapy','cermep','mortuary','petit_monde'].map(id=>state.byId.get(id)).filter(Boolean);
  const parks=[...state.byId.values()].filter(p=>p.place_type==='parking').sort(sortPlaces);
  content.innerHTML=`<section class="places-section"><header class="places-section-head"><h2>Les 3 hôpitaux</h2><small>Commencer ici</small></header><div class="places-primary-grid">${roots.map(primary).join('')}</div></section>${section('Autres repères',anchors.map(p=>row(p)),`${anchors.length} lieux`)}${parks.length?section('Parkings',parks.map(p=>row(p)),`${parks.length} repères`):''}`;
  setStatus(`${state.byId.size} lieux disponibles · recherche par nom, numéro, acronyme ou repère`);
}

function renderSearch(q){
  const n=norm(q);clear.classList.toggle('show',!!q);
  if(!n){renderCurrent();return}
  if(n.length<2&&!/^\d+$/.test(n)){content.innerHTML='<div class="place-empty">Tape encore une lettre pour lancer la recherche.</div>';setStatus('Recherche…');return}
  const items=find(q);content.innerHTML=items.length?section('Résultats',items.map(p=>row(p)),`${items.length} résultat${items.length>1?'s':''}`):'<div class="place-empty">Aucun lieu trouvé. Essaie un numéro d’unité, un acronyme, un bâtiment ou un terme plus court.</div>';
  setStatus(items.length?`Recherche « ${q} »`:`Aucun résultat pour « ${q} »`);
}

function parentChain(p){const out=[];let cur=p,guard=0;while(cur&&guard++<12){out.unshift(cur);cur=cur.parent_id?state.byId.get(cur.parent_id):null}return out}
function breadcrumbs(p){const c=parentChain(p);return `<nav class="place-breadcrumbs" aria-label="Fil d’Ariane"><button type="button" data-nav-home>Accueil</button>${c.map((x,i)=>`<span>›</span><button type="button" data-place="${esc(x.id)}" ${i===c.length-1?'aria-current="page"':''}>${esc(x.display_name)}</button>`).join('')}</nav>`}
function relatedFor(id){
  const out=[];
  for(const r of state.relations){
    if(r.from_place_id===id&&state.byId.has(r.to_place_id))out.push({r,p:state.byId.get(r.to_place_id),reverse:false});
    else if(r.to_place_id===id&&state.byId.has(r.from_place_id))out.push({r,p:state.byId.get(r.from_place_id),reverse:true});
  }
  return out;
}
function relationExtra(x){const bits=[x.r.label,x.r.direction,x.r.transport_mode==='stretcher'?'Trajet brancard':null].filter(Boolean);return bits.length?`<p>${bits.map(esc).join(' · ')}</p>`:''}
function routesFor(id){return state.routes.filter(r=>r.to_place_id===id||r.from_place_id===id)}
function routeCard(r){
  const steps=state.steps.get(r.id)||[],open=state.routeOpen===r.id;
  const mode=r.mode==='stretcher'?'Trajet brancard':r.mode==='walking'?'À pied':r.mode;
  return `<article class="route-card"><button type="button" data-route="${esc(r.id)}"><h3>${esc(r.label)}</h3><p>${esc(mode)} · ${esc(evidenceLabel(r.evidence_status))} ${open?'· Masquer':'· Voir les étapes'}</p></button>${open?`<div class="route-steps">${steps.map(s=>`<div class="route-step"><b>${s.step_no}</b><span>${esc(s.instruction)}</span></div>`).join('')}</div>`:''}</article>`
}

function renderPlace(id){
  const p=state.byId.get(id);if(!p){location.hash='';return}
  const kids=(state.children.get(id)||[]).filter(x=>state.byId.has(x.id));
  const rel=relatedFor(id),routes=routesFor(id);
  const warn=p.evidence_status==='to_confirm'?'<div class="place-warning">Cette information reste à confirmer. Elle est conservée pour ne pas perdre la piste, mais ne doit pas être prise comme une certitude.</div>':'';
  const internal=p.visibility!=='public'?'<div class="place-internal">Information interne STIP. Cette donnée n’est pas destinée à une diffusion publique.</div>':'';
  content.innerHTML=`<div class="place-detail">${breadcrumbs(p)}<article class="place-hero-card"><span class="place-kicker">${esc(typeLabel(p.place_type))}</span><h2>${esc(p.display_name)}</h2>${placeMeta(p)}${p.summary?`<p>${esc(p.summary)}</p>`:''}${p.details?`<p class="place-details-note">${esc(p.details)}</p>`:''}${p.source_ref?`<div class="place-meta">${chip(`Source · ${p.source_ref}`)}</div>`:''}</article>${warn}${internal}${routes.length?`<section class="places-section"><header class="places-section-head"><h2>Comment y aller</h2><small>${routes.length} trajet${routes.length>1?'s':''}</small></header>${routes.map(routeCard).join('')}</section>`:''}${kids.length?section('Dans ce lieu',kids.map(x=>row(x)),`${kids.length} élément${kids.length>1?'s':''}`):''}${rel.length?section('À proximité / relié à',rel.map(x=>row(x.p,relationExtra(x))),`${rel.length} liaison${rel.length>1?'s':''}`):''}${!kids.length&&!rel.length&&!routes.length?'<div class="place-empty">Pas encore de détail supplémentaire pour ce lieu. Le référentiel pourra être enrichi sans modifier la page.</div>':''}</div>`;
  setStatus(locationLabel(p)||typeLabel(p.place_type));
  window.scrollTo({top:0,behavior:'auto'});
}
function renderRoute(id){const r=state.routes.find(x=>x.id===id);if(!r)return;state.routeOpen=state.routeOpen===id?null:id;const placeId=r.to_place_id||r.from_place_id;renderPlace(placeId)}

function routeState(){const h=location.hash.replace(/^#\/?/,'');const m=h.match(/^(place|route)\/(.+)$/);return m?{kind:m[1],id:decodeURIComponent(m[2])}:{kind:'home',id:''}}
function renderCurrent(){if(search.value){renderSearch(search.value);return}const r=routeState();if(r.kind==='place')return renderPlace(r.id);if(r.kind==='route')return renderRoute(r.id);renderHome()}
function goPlace(id){search.value='';clear.classList.remove('show');if(routeState().kind==='place'&&routeState().id===id){renderPlace(id);return}location.hash=`#/place/${encodeURIComponent(id)}`}
function goHome(){search.value='';clear.classList.remove('show');if(location.hash)location.hash='';else renderHome()}

content.addEventListener('click',e=>{const p=e.target.closest?.('[data-place]');if(p){goPlace(p.dataset.place);return}const r=e.target.closest?.('[data-route]');if(r){renderRoute(r.dataset.route);return}if(e.target.closest?.('[data-nav-home]'))goHome()});
search.addEventListener('input',()=>renderSearch(search.value.trim()));
search.addEventListener('search',()=>renderSearch(search.value.trim()));
clear.addEventListener('click',()=>{search.value='';clear.classList.remove('show');search.focus();renderCurrent()});
$('#placesHome').addEventListener('click',goHome);
$('#placesBack').addEventListener('click',()=>{if(search.value){search.value='';clear.classList.remove('show');renderCurrent();return}if(routeState().kind!=='home'&&history.length>1){history.back();return}location.href='/'});
window.addEventListener('hashchange',()=>{state.routeOpen=null;renderCurrent()});

(async()=>{
  content.innerHTML='<div class="places-loading"><i></i><i></i><i></i></div>';
  try{const d=await call();if(!d)return;build(d);renderCurrent()}catch(e){console.error(e);setStatus('Impossible de charger les lieux.','error');content.innerHTML=`<div class="place-empty">${esc(e?.message||'Erreur de chargement.')}<br><br><button class="stip-btn" type="button" onclick="location.reload()">Réessayer</button></div>`}
})();
})();
