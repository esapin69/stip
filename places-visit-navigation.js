(()=>{
'use strict';
const q=s=>document.querySelector(s);
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function visitHash(){return /^#\/?visit$/.test(location.hash)}
function visitMode(){return sessionStorage.getItem('stip_places_visit_mode')==='1'||visitHash()}
function markVisit(){if(visitHash())sessionStorage.setItem('stip_places_visit_mode','1')}
function clearVisit(){if(!location.hash.includes('place/'))sessionStorage.removeItem('stip_places_visit_mode')}
function getRows(){return [...document.querySelectorAll('#placesContent .place-row[data-place]')]}
function classify(row){const meta=norm(row.textContent),id=row.dataset.place||'';if(/ascenseur/.test(meta)||/elev|asc_/.test(id))return'elevator';if(/étage|niveau|rez-de-|rez de |rdc|rdj/.test(meta)||/_(rdc|rdj|l\d+|tm)$/.test(id))return'level';return'other'}
function floorRank(row){const t=norm(row.textContent);if(/sous-sol|niveau\s*-\s*\d/.test(t)){const m=t.match(/-\s*(\d+)/);return-100+(m?+m[1]:0)}if(/rez-de-jardin|rez de jardin|rdj|\brj\b/.test(t))return-20;if(/rez-de-chaussée|rez de chaussee|\brdc\b/.test(t))return-10;if(/\btm\b/.test(t))return-5;const m=t.match(/(?:niveau|étage|etage)\s*(\d+)|\b(\d+)(?:er|e|ème|eme)\b/);return m?+(m[1]||m[2]):999}
function title(text,small){const s=document.createElement('section');s.className='places-section visit-nav-section';s.innerHTML=`<header class="places-section-head"><h2>${text}</h2><small>${small}</small></header><div class="places-list"></div>`;return s}
function currentContext(){
  const hero=q('#placesContent .place-hero-card');
  return{hero,kicker:norm(hero?.querySelector('.place-kicker')?.textContent),name:norm(hero?.querySelector('h2')?.textContent)};
}
function childTitle(kicker,name){
  if(kicker==='ascenseurs')return'Choisir un ascenseur';
  if(kicker==='niveau')return'Explorer cet étage';
  if(kicker==='service')return'Dans ce service';
  if(kicker==='unité'||kicker==='unite')return'Dans cette unité';
  if(kicker==='bloc')return'Dans ce bloc';
  if(kicker==='salle')return'Dans cette salle';
  if(kicker==='hélis­tation'||kicker==='hélistation'||kicker==='helistation')return'Autour de l’hélistation';
  if(name.includes('hall'))return'Autour du hall';
  return'Dans ce lieu';
}
function enhanceContextHeadings(){
  if(!visitMode())return;
  const content=q('#placesContent');if(!content)return;
  const {kicker,name}=currentContext();
  for(const sec of content.querySelectorAll('.places-section')){
    const h=sec.querySelector('h2');if(!h)continue;
    const t=norm(h.textContent);
    if(t==='continuer la visite'||t==='dans ce lieu')h.textContent=childTitle(kicker,name);
    else if(t.includes('à proximité')||t.includes('relié à')||t.includes('ce que tu croises'))h.textContent=name.includes('hall')?'Autour du hall':'À proximité';
  }
}
function enhanceHospital(){
  if(!visitMode())return;const content=q('#placesContent');if(!content||content.querySelector('.visit-nav-section'))return;const hero=content.querySelector('.place-hero-card');if(!hero)return;const kicker=norm(hero.querySelector('.place-kicker')?.textContent);if(!kicker.includes('hôpital')&&!kicker.includes('hopital'))return;
  const rows=getRows(),levels=rows.filter(r=>classify(r)==='level').sort((a,b)=>floorRank(a)-floorRank(b)),elevators=rows.filter(r=>classify(r)==='elevator'),others=rows.filter(r=>classify(r)==='other');
  const old=[...content.querySelectorAll('.places-section')].find(s=>s.querySelector('.place-row[data-place]')&&/continuer la visite|dans ce lieu/i.test(s.textContent));if(!old)return;
  const anchor=old;
  if(elevators.length){const sec=title('Ascenseurs',`${elevators.length} repère${elevators.length>1?'s':''} vertical${elevators.length>1?'aux':''}`);elevators.forEach(r=>sec.querySelector('.places-list').appendChild(r));anchor.before(sec)}
  if(levels.length){const sec=title('Étages',`${levels.length} niveau${levels.length>1?'x':''} · du plus bas au plus haut`);levels.forEach(r=>sec.querySelector('.places-list').appendChild(r));anchor.before(sec)}
  if(others.length){const sec=title('Autres lieux',`${others.length} repère${others.length>1?'s':''}`);others.forEach(r=>sec.querySelector('.places-list').appendChild(r));anchor.before(sec)}
  old.remove();
}
function enhanceElevator(){
  if(!visitMode())return;const content=q('#placesContent');if(!content)return;const {kicker,name}=currentContext();if(!kicker.includes('ascenseur')&&!name.includes('ascenseur'))return;content.classList.add('visit-elevator-view');
  for(const s of content.querySelectorAll('.places-section')){const h=s.querySelector('h2');if(h&&(/à proximité|relié|ce que tu croises/i.test(h.textContent)))h.textContent='À proximité'}
}
function enhanceIncompleteLevel(){
  if(!visitMode())return;const content=q('#placesContent'),hero=content?.querySelector('.place-hero-card');if(!hero)return;const kicker=norm(hero.querySelector('.place-kicker')?.textContent);if(kicker!=='niveau')return;
  for(const empty of content.querySelectorAll('.place-empty')){
    if(empty.dataset.visitIncompleteDone)return;
    if(/pas encore de détail supplémentaire/i.test(empty.textContent||'')){
      empty.dataset.visitIncompleteDone='1';
      empty.innerHTML='<strong>À compléter</strong><br>Aucune information terrain supplémentaire n’est encore documentée pour ce niveau.';
    }
  }
}
function run(){markVisit();enhanceHospital();enhanceContextHeadings();enhanceElevator();enhanceIncompleteLevel()}
window.addEventListener('hashchange',()=>setTimeout(run,80));
document.addEventListener('click',e=>{if(e.target.closest('[data-nav-visit]'))sessionStorage.setItem('stip_places_visit_mode','1');if(e.target.closest('#placesHome'))clearVisit();setTimeout(run,120)});
new MutationObserver(()=>requestAnimationFrame(run)).observe(document.documentElement,{subtree:true,childList:true});setTimeout(run,200);
})();
