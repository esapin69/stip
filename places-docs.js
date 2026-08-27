(()=>{
'use strict';
const STACK_KEY='stip_places_waypoint_stack_v2';
const CERMEP_DOCS_URL='https://drive.google.com/drive/folders/1hNPM7Jy7LdbyTlYA5Uk72ukvXItgbPG3';
const SOURCE_LINKS=[
  {test:/cermep|procedure_acces_cermep/i,url:CERMEP_DOCS_URL,label:'Ouvrir les documents officiels CERMEP'}
];
const WAYPOINTS=[
  {test:/\bB14\b/i,placeId:'b14',label:'B14',detail:'Médecine nucléaire'}
];
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function readStack(){try{return JSON.parse(sessionStorage.getItem(STACK_KEY)||'[]')}catch{return[]}}
function writeStack(v){sessionStorage.setItem(STACK_KEY,JSON.stringify(v))}
function currentPlaceId(){const m=location.hash.match(/#\/place\/([^/?#]+)/);return m?decodeURIComponent(m[1]):''}
function currentPlaceLabel(){return document.querySelector('.place-hero-card h2')?.textContent?.trim()||'destination'}
function currentRouteLabel(card){return card?.querySelector('h3')?.textContent?.trim()||''}
function cleanSourceRef(v){return String(v||'').replace(/^Source\s*·\s*/i,'').trim()}
function sourceKind(){
  const chips=[...document.querySelectorAll('.place-hero-card .place-chip')].map(x=>x.textContent.trim());
  if(chips.includes('Confirmé HCL'))return{label:'Source officielle HCL',cls:'official'};
  if(chips.includes('Terrain validé'))return{label:'Source terrain validée',cls:'terrain'};
  if(chips.includes('Source ancienne'))return{label:'Source ancienne',cls:'old'};
  if(chips.includes('À confirmer'))return{label:'Source à confirmer',cls:'confirm'};
  return{label:'Source',cls:''};
}
function externalFor(ref,context=''){
  const raw=cleanSourceRef(ref);
  if(/^https?:\/\//i.test(raw))return{url:raw,label:'Ouvrir la source'};
  return SOURCE_LINKS.find(x=>x.test.test(`${raw} ${context}`))||null;
}
function ensureSourceDrawer(){
  if(document.getElementById('placesSourceDrawer'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="source-drawer" id="placesSourceDrawer" hidden><button class="source-drawer-backdrop" type="button" data-source-close aria-label="Fermer"></button><section class="source-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="sourceDrawerTitle"><div class="source-drawer-handle"></div><header><div><span id="sourceDrawerKind">SOURCE</span><h2 id="sourceDrawerTitle">Source</h2></div><button type="button" data-source-close aria-label="Fermer">×</button></header><div id="sourceDrawerBody"></div></section></div>`);
}
function openSource({ref,label,kind,summary,url,urlLabel,date}){
  ensureSourceDrawer();
  const drawer=document.getElementById('placesSourceDrawer');
  drawer.querySelector('#sourceDrawerKind').textContent=kind?.label||'Source';
  drawer.querySelector('#sourceDrawerTitle').textContent=label||cleanSourceRef(ref)||'Source';
  const body=drawer.querySelector('#sourceDrawerBody');
  body.innerHTML=`${date?`<div class="source-drawer-date">${esc(date)}</div>`:''}${summary?`<div class="source-confirms"><span>CE QUE CETTE SOURCE APPUIE</span><p>${esc(summary)}</p></div>`:''}<div class="source-reference"><span>RÉFÉRENCE</span><p>${esc(cleanSourceRef(ref)||label||'Référence non renseignée')}</p></div>${url?`<a class="source-open-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(urlLabel||'Ouvrir la source')} <b>↗</b></a>`:'<p class="source-no-link">Référence conservée dans STIP · aucun lien externe renseigné.</p>'}`;
  drawer.hidden=false;document.documentElement.classList.add('source-drawer-open');
}
function closeSource(){const d=document.getElementById('placesSourceDrawer');if(d)d.hidden=true;document.documentElement.classList.remove('source-drawer-open')}
function enhancePlaceSource(){
  const hero=document.querySelector('.place-hero-card');if(!hero)return;
  const metas=[...hero.querySelectorAll('.place-meta')];
  const sourceMeta=metas.find(m=>/^Source\s*·/i.test(m.textContent.trim()));if(!sourceMeta)return;
  if(sourceMeta.dataset.sourceEnhanced)return;sourceMeta.dataset.sourceEnhanced='1';
  const ref=sourceMeta.textContent.trim(),kind=sourceKind(),summary=[...hero.querySelectorAll(':scope>p')].map(x=>x.textContent.trim()).filter(Boolean)[0]||'';
  const external=externalFor(ref,`${currentPlaceLabel()} ${location.hash}`);
  sourceMeta.className='place-source-entry';
  sourceMeta.innerHTML=`<button type="button" class="place-source-button" data-source-open data-source-ref="${esc(ref)}" data-source-summary="${esc(summary)}" data-source-kind="${esc(kind.label)}" data-source-kind-class="${esc(kind.cls)}" ${external?`data-source-url="${esc(external.url)}" data-source-url-label="${esc(external.label)}"`:''}><span class="source-dot ${esc(kind.cls)}"></span><span><small>${esc(kind.label)}</small><strong>Voir la source</strong></span><b>›</b></button>`;
}
function enhanceHomeModes(){
  const visit=document.querySelector('.places-visit-entry');if(!visit||document.querySelector('.places-mode-switch'))return;
  visit.insertAdjacentHTML('beforebegin',`<section class="places-mode-switch"><button type="button" data-focus-search><span class="mode-icon">⌕</span><span><small>RECHERCHER</small><strong>Trouver un lieu</strong><em>Nom, unité, étage, examen ou repère.</em></span></button><button type="button" data-nav-visit><span class="mode-icon">↗</span><span><small>EXPLORER</small><strong>Visiter les lieux</strong><em>Avancer hôpital par hôpital.</em></span></button></section>`);
  visit.remove();
}
function enhanceHospitals(){
  document.querySelectorAll('.places-primary-grid .place-primary').forEach(card=>{
    if(card.dataset.hospitalEnhanced)return;
    const icon=card.querySelector('.place-icon')?.textContent?.trim();
    const labels={CAR:'CARDIO',NEU:'NEURO',HFME:'MÈRE · ENFANT'};
    if(!labels[icon])return;
    card.dataset.hospitalEnhanced='1';card.classList.add('hospital-primary');
    card.querySelector(':scope>span:last-child')?.insertAdjacentHTML('afterbegin',`<em class="hospital-domain">${labels[icon]}</em>`);
  });
}
function enhanceAccessLevel(){
  const internal=document.querySelector('.place-internal');if(!internal||internal.dataset.accessEnhanced)return;
  internal.dataset.accessEnhanced='1';
  const restricted=[...document.querySelectorAll('.place-chip')].some(x=>/restreint/i.test(x.textContent));
  internal.innerHTML=`<span>NIVEAU D’INFORMATION</span><strong>${restricted?'Accès restreint':'STIP terrain'}</strong><p>Les informations affichées dépendent de ton niveau d’accès.</p>`;
}
function enhanceRouteOverview(card){
  const steps=card.querySelector('.route-steps');if(!steps||card.querySelector('[data-route-overview]'))return;
  const title=currentRouteLabel(card),count=steps.querySelectorAll('.route-step').length;
  const arrows=title.split('→').map(x=>x.trim()).filter(Boolean);
  const from=arrows.length>1?arrows[0]:null,to=arrows.length>1?arrows[arrows.length-1]:null;
  steps.insertAdjacentHTML('beforebegin',`<div class="route-overview" data-route-overview>${from?`<span>${esc(from)}</span><i>→</i>`:''}<strong>${count} étape${count>1?'s':''}</strong>${to?`<i>→</i><span>${esc(to)}</span>`:''}</div>`);
}
function waypointForRow(row){const text=row.querySelector(':scope>span')?.textContent||'';return WAYPOINTS.find(x=>x.test.test(text))||null}
function addWaypoint(row,wp){
  if(row.querySelector('[data-waypoint]'))return;
  const host=row.querySelector(':scope>span');if(!host)return;
  host.insertAdjacentHTML('beforeend',` <button type="button" class="route-waypoint" data-waypoint data-waypoint-id="${esc(wp.placeId)}" data-waypoint-label="${esc(wp.label)}"><span>${esc(wp.label)}</span><small>me guider</small></button>`);
}
function pushWaypoint(wp){
  const destinationLabel=currentPlaceLabel(),destinationPlaceId=currentPlaceId(),stack=readStack();
  stack.push({destinationPlaceId,destinationLabel,waypointPlaceId:wp.placeId,waypointLabel:wp.label,resumeHash:location.hash});writeStack(stack);
  location.hash=`#/place/${encodeURIComponent(wp.placeId)}`;
}
function renderJourneyBar(){
  document.querySelectorAll('[data-journey-bar]').forEach(x=>x.remove());
  const stack=readStack();if(!stack.length)return;
  const ctx=stack[0],hero=document.querySelector('.places-hero');if(!hero)return;
  hero.insertAdjacentHTML('beforebegin',`<aside class="journey-bar" data-journey-bar><span>DESTINATION FINALE</span><strong>${esc(ctx.destinationLabel)}</strong><button type="button" data-waypoint-return>Reprendre</button></aside>`);
}
function renderWaypointContext(){
  document.querySelectorAll('[data-waypoint-context]').forEach(x=>x.remove());
  const stack=readStack();if(!stack.length)return;
  const ctx=stack[stack.length-1];if(currentPlaceId()!==ctx.waypointPlaceId)return;
  const hero=document.querySelector('.place-hero-card');if(!hero)return;
  hero.insertAdjacentHTML('afterend',`<section class="waypoint-context" data-waypoint-context><span>REPÈRE INTERMÉDIAIRE</span><strong>${esc(ctx.waypointLabel)}</strong><p>Tu es toujours en route vers <b>${esc(ctx.destinationLabel)}</b>. Consulte ce repère, puis reprends automatiquement ton trajet.</p><div><button type="button" data-waypoint-resume>Je suis arrivé · reprendre ${esc(ctx.destinationLabel)}</button><button type="button" data-waypoint-cancel>Annuler ce détour</button></div></section>`);
}
function enhanceCermepGuide(card){
  if(!card.querySelector('.route-steps')||card.querySelector('[data-route-guide]'))return;
  const context=`${currentRouteLabel(card)} ${currentPlaceLabel()}`;
  if(!/cermep/i.test(context))return;
  const steps=card.querySelector('.route-steps');
  const overview=card.querySelector('[data-route-overview]');
  (overview||steps).insertAdjacentHTML('afterend',`<div class="route-source-actions"><button type="button" data-source-open data-source-ref="Procédure STIP CERMEP · 27/07/2026" data-source-summary="Itinéraire opérationnel rattaché au trajet affiché." data-source-kind="Document officiel interne" data-source-kind-class="internal" data-source-url="${CERMEP_DOCS_URL}" data-source-url-label="Ouvrir les documents officiels CERMEP"><span>Document officiel</span><strong>Voir la procédure CERMEP</strong><b>›</b></button></div>`);
}
function enhanceRoutes(){
  document.querySelectorAll('.route-card').forEach(card=>{
    enhanceRouteOverview(card);
    card.querySelectorAll('.route-step').forEach(row=>{const wp=waypointForRow(row);if(wp)addWaypoint(row,wp)});
    enhanceCermepGuide(card);
  });
}
function enhanceVisitDetail(){
  const detail=document.querySelector('.place-detail');if(!detail)return;
  const inVisit=[...detail.querySelectorAll('.place-breadcrumbs button')].some(x=>x.textContent.trim()==='Visite');
  if(!inVisit)return;detail.classList.add('visit-detail-mode');
  detail.querySelectorAll('.places-section').forEach(sec=>{if(sec.querySelector('h2')?.textContent.trim()==='Continuer la visite'){sec.classList.add('visit-continue');sec.querySelector('.places-list')?.classList.add('visit-continue-list')}});
}
function enhance(){enhanceHomeModes();enhanceHospitals();enhancePlaceSource();enhanceAccessLevel();enhanceRoutes();enhanceVisitDetail();renderJourneyBar();renderWaypointContext()}
document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-focus-search]')){document.querySelector('#placesSearch')?.focus();document.querySelector('.places-search-wrap')?.scrollIntoView({behavior:'smooth',block:'center'});return}
  const src=e.target.closest?.('[data-source-open]');if(src){e.preventDefault();e.stopPropagation();openSource({ref:src.dataset.sourceRef,label:src.querySelector('strong')?.textContent,kind:{label:src.dataset.sourceKind||'Source',cls:src.dataset.sourceKindClass||''},summary:src.dataset.sourceSummary||'',url:src.dataset.sourceUrl||'',urlLabel:src.dataset.sourceUrlLabel||''});return}
  if(e.target.closest?.('[data-source-close]')){closeSource();return}
  const w=e.target.closest?.('[data-waypoint]');if(w){e.preventDefault();e.stopPropagation();pushWaypoint({placeId:w.dataset.waypointId,label:w.dataset.waypointLabel||'Repère'});return}
  if(e.target.closest?.('[data-waypoint-resume],[data-waypoint-return]')){const stack=readStack(),ctx=stack.pop();writeStack(stack);location.hash=ctx?.resumeHash||'';return}
  if(e.target.closest?.('[data-waypoint-cancel]')){const stack=readStack();stack.pop();writeStack(stack);history.back();return}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSource()});
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}
new MutationObserver(queue).observe(document.getElementById('placesContent')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',queue);
queue();
})();
