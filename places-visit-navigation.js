(()=>{
'use strict';
const q=s=>document.querySelector(s);
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const ARRIVAL='stip_places_arrival_v1';
function visitHash(){return /^#\/?visit$/.test(location.hash)}
function visitMode(){return sessionStorage.getItem('stip_places_visit_mode')==='1'||visitHash()}
function markVisit(){if(visitHash())sessionStorage.setItem('stip_places_visit_mode','1')}
function clearVisit(){if(!location.hash.includes('place/'))sessionStorage.removeItem('stip_places_visit_mode')}
function currentPlaceId(){const m=location.hash.match(/^#\/?place\/(.+)$/);return m?decodeURIComponent(m[1]):''}
function getRows(){return [...document.querySelectorAll('#placesContent .place-row[data-place]')]}
function classify(row){const meta=norm(row.textContent),id=row.dataset.place||'';if(/entree|entry/.test(id)||/^entrée\b/.test(norm(row.querySelector('strong')?.textContent)))return'entrance';if(/ascenseur/.test(meta)||/elev|asc_/.test(id))return'elevator';if(/étage|niveau|rez-de-|rez de |rdc|rdj/.test(meta)||/_(rdc|rdj|l\d+|tm)$/.test(id))return'level';return'other'}
function floorRank(row){const t=norm(row.textContent);if(/sous-sol|niveau\s*-\s*\d/.test(t)){const m=t.match(/-\s*(\d+)/);return-100+(m?+m[1]:0)}if(/rez-de-jardin|rez de jardin|rdj|\brj\b/.test(t))return-20;if(/rez-de-chaussée|rez de chaussee|\brdc\b/.test(t))return-10;if(/\btm\b/.test(t))return-5;const m=t.match(/(?:niveau|étage|etage)\s*(\d+)|\b(\d+)(?:er|e|ème|eme)\b/);return m?+(m[1]||m[2]):999}
function title(text,small,cls=''){const s=document.createElement('section');s.className=`places-section visit-nav-section ${cls}`.trim();s.innerHTML=`<header class="places-section-head"><h2>${text}</h2>${small?`<small>${small}</small>`:''}</header><div class="places-list"></div>`;return s}
function currentContext(){const hero=q('#placesContent .place-hero-card');return{hero,kicker:norm(hero?.querySelector('.place-kicker')?.textContent),name:norm(hero?.querySelector('h2')?.textContent)}}
function childTitle(kicker,name){if(kicker==='entrée'||kicker==='entree')return'Depuis cette entrée';if(kicker==='ascenseurs')return'Choisir un ascenseur';if(kicker==='niveau')return'Explorer cet étage';if(kicker==='service')return'Dans ce service';if(kicker==='unité'||kicker==='unite')return'Dans cette unité';if(kicker==='bloc')return'Dans ce bloc';if(kicker==='salle')return'Dans cette salle';if(kicker==='hélis­tation'||kicker==='hélistation'||kicker==='helistation')return'Autour de l’hélistation';if(name.includes('hall'))return'Autour du hall';return'Dans ce lieu'}
function hospitalKind(){const id=currentPlaceId();if(id==='pw')return'pw';if(id==='hfme')return'hfme';if(id==='hlp'||id==='lp')return'hlp';return''}
function enhanceHospital(){
  if(!visitMode())return;const content=q('#placesContent');if(!content||content.querySelector('.visit-hospital-start'))return;const hero=content.querySelector('.place-hero-card');if(!hero)return;const kicker=norm(hero.querySelector('.place-kicker')?.textContent);if(!kicker.includes('hôpital')&&!kicker.includes('hopital'))return;
  const rows=getRows(),entrances=rows.filter(r=>classify(r)==='entrance'),levels=rows.filter(r=>classify(r)==='level').sort((a,b)=>floorRank(a)-floorRank(b));
  const old=[...content.querySelectorAll('.places-section')].find(s=>s.querySelector('.place-row[data-place]')&&/continuer la visite|dans ce lieu/i.test(s.textContent));if(!old)return;
  const anchor=old,kind=hospitalKind();
  const start=title(entrances.length>1?'Choisir une entrée':'Entrée principale',entrances.length>1?`${entrances.length} points de départ`:'Point de départ de la visite','visit-hospital-start');
  if(entrances.length)entrances.forEach(r=>start.querySelector('.places-list').appendChild(r));
  else start.querySelector('.places-list').innerHTML='<div class="visit-missing"><strong>À compléter</strong><span>Le point d’entrée de cette visite n’est pas encore suffisamment documenté.</span></div>';
  anchor.before(start);
  if(kind==='hfme'&&levels.length){const sec=title('Étages déjà documentés','Parcours depuis l’entrée à compléter','visit-hfme-fallback');levels.forEach(r=>sec.querySelector('.places-list').appendChild(r));anchor.before(sec)}
  old.remove();
  if(!hero.querySelector('.visit-hospital-help')){const n=document.createElement('p');n.className='place-details-note visit-hospital-help';n.textContent=kind==='pw'?'Commence par l’entrée A ou B. Les deux zones sont reliées intérieurement.':kind==='hfme'?'Commence par l’entrée principale. Le hall intérieur reste à compléter avec les informations disponibles.':'Commence par l’entrée principale puis avance de repère en repère.';hero.appendChild(n)}
}
function enhanceContextHeadings(){if(!visitMode())return;const content=q('#placesContent');if(!content)return;const {kicker,name}=currentContext();for(const sec of content.querySelectorAll('.places-section')){if(sec.classList.contains('visit-nav-section'))continue;const h=sec.querySelector('h2');if(!h)continue;const t=norm(h.textContent);if(t==='continuer la visite'||t==='dans ce lieu')h.textContent=childTitle(kicker,name);else if(t.includes('à proximité')||t.includes('relié à')||t.includes('ce que tu croises'))h.textContent=name.includes('hall')?'Autour du hall':'À proximité'}}
function directionForRow(row){const ps=[...row.querySelectorAll('.place-row-main p')];const t=norm(ps.at(-1)?.textContent||'');if(/tout droit|en face|devant toi|devant/.test(t))return'straight';if(/à gauche|a gauche|tourner à gauche|tourner a gauche|sur la gauche/.test(t))return'left';if(/à droite|a droite|tourner à droite|tourner a droite|sur la droite/.test(t))return'right';return''}
function directionLabel(k){return k==='left'?'← À gauche':k==='straight'?'↑ Tout droit':'À droite →'}
function enhanceDirections(){
  if(!visitMode())return;const content=q('#placesContent');if(!content||content.querySelector('[data-visit-directions]'))return;
  const candidates=[...content.querySelectorAll('.places-section')].filter(sec=>{const h=sec.querySelector('h2');return h&&/à proximité|relié|autour du hall/i.test(h.textContent||'')});
  for(const sec of candidates){
    const buckets={left:[],straight:[],right:[]};for(const row of [...sec.querySelectorAll('.place-row[data-place]')]){const d=directionForRow(row);if(d)buckets[d].push(row)}
    const used=Object.values(buckets).flat();if(!used.length)continue;
    const wrap=document.createElement('section');wrap.className='places-section visit-direction-section';wrap.dataset.visitDirections='1';wrap.innerHTML='<header class="places-section-head"><h2>Depuis ici</h2><small>Repères directionnels connus</small></header><div class="visit-direction-grid"></div>';
    const grid=wrap.querySelector('.visit-direction-grid');
    for(const k of ['left','straight','right']){if(!buckets[k].length)continue;const col=document.createElement('div');col.className=`visit-direction-column visit-direction-${k}`;col.innerHTML=`<h3>${directionLabel(k)}</h3><div class="places-list"></div>`;buckets[k].forEach(r=>col.querySelector('.places-list').appendChild(r));grid.appendChild(col)}
    sec.before(wrap);if(!sec.querySelector('.place-row[data-place]'))sec.remove();break;
  }
}
function arrival(){try{return JSON.parse(sessionStorage.getItem(ARRIVAL)||'null')}catch{return null}}
function enhanceArrivalLevel(){
  if(!visitMode())return;const id=currentPlaceId(),a=arrival(),content=q('#placesContent'),hero=content?.querySelector('.place-hero-card');if(!hero)return;const kicker=norm(hero.querySelector('.place-kicker')?.textContent);if(kicker!=='niveau')return;
  content.querySelector('[data-visit-arrival]')?.remove();
  if(!a||a.levelId!==id)return;
  const b=document.createElement('div');b.className='visit-arrival';b.dataset.visitArrival='1';b.innerHTML=`<strong>Sortie d’ascenseur</strong><span>Tu arrives par ${a.elevatorName?String(a.elevatorName).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])):'l’ascenseur sélectionné'}.</span>`;hero.after(b);
  setTimeout(()=>{if(!content.querySelector('.visit-direction-section')&&!content.querySelector('[data-visit-arrival-missing]')){const m=document.createElement('div');m.className='visit-missing';m.dataset.visitArrivalMissing='1';m.innerHTML='<strong>À compléter</strong><span>Les directions gauche / tout droit / droite depuis cette sortie ne sont pas encore suffisamment relevées. Les lieux connus de l’étage restent affichés ci-dessous.</span>';b.after(m)}},0)
}
function enhanceDirectLevel(){
  if(!visitMode())return;const content=q('#placesContent'),hero=content?.querySelector('.place-hero-card');if(!hero||content.querySelector('[data-visit-arrival-choice]'))return;const kicker=norm(hero.querySelector('.place-kicker')?.textContent);if(kicker!=='niveau')return;const a=arrival();if(a&&a.levelId===currentPlaceId())return;
  const sec=[...content.querySelectorAll('.places-section')].find(s=>{const h=s.querySelector('h2');return h&&/à proximité|relié/i.test(h.textContent||'')});if(!sec)return;const elevators=[...sec.querySelectorAll('.place-row[data-place]')].filter(r=>classify(r)==='elevator');if(!elevators.length)return;
  const pick=title('D’où arrives-tu ?','Choisis un ascenseur connu pour orienter la sortie','visit-arrival-choice');pick.dataset.visitArrivalChoice='1';elevators.forEach(r=>pick.querySelector('.places-list').appendChild(r));sec.before(pick);if(!sec.querySelector('.place-row[data-place]'))sec.remove()
}
function enhanceIncomplete(){
  if(!visitMode())return;const content=q('#placesContent'),hero=content?.querySelector('.place-hero-card');if(!hero)return;const kicker=norm(hero.querySelector('.place-kicker')?.textContent),id=currentPlaceId();
  if(kicker==='niveau')for(const empty of content.querySelectorAll('.place-empty')){if(empty.dataset.visitIncompleteDone)return;if(/pas encore de détail supplémentaire/i.test(empty.textContent||'')){empty.dataset.visitIncompleteDone='1';empty.innerHTML='<strong>À compléter</strong><br>Aucune information terrain supplémentaire n’est encore documentée pour ce niveau.'}}
  if((kicker==='entrée'||kicker==='entree')&&!content.querySelector('.place-row[data-place]')&&!content.querySelector('[data-visit-entry-missing]')){const m=document.createElement('div');m.className='visit-missing';m.dataset.visitEntryMissing='1';m.innerHTML=`<strong>À compléter</strong><span>${id==='hfme_entry_main'?'Le hall et les directions juste après l’entrée principale HFME ne sont pas encore assez documentés. Les étages déjà connus restent accessibles depuis la fiche de l’hôpital.':'Le parcours immédiatement après cette entrée reste à compléter.'}</span>`;hero.after(m)}
}
function run(){markVisit();enhanceHospital();enhanceContextHeadings();enhanceDirections();enhanceArrivalLevel();enhanceDirectLevel();enhanceIncomplete()}
window.addEventListener('hashchange',()=>setTimeout(run,80));
document.addEventListener('click',e=>{if(e.target.closest('[data-nav-visit]'))sessionStorage.setItem('stip_places_visit_mode','1');if(e.target.closest('#placesHome')){clearVisit();sessionStorage.removeItem(ARRIVAL)}setTimeout(run,120)});
new MutationObserver(()=>requestAnimationFrame(run)).observe(document.documentElement,{subtree:true,childList:true});setTimeout(run,200);
})();
