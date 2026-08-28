(()=>{
'use strict';
const TYPES=new Set(['elevator','elevator_group']);
const LEVEL='level';
const q=s=>document.querySelector(s);
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function hospitalId(){const m=location.hash.match(/^#\/?place\/(.+)$/);return m?decodeURIComponent(m[1]):''}
function visitMode(){return sessionStorage.getItem('stip_places_visit_mode')==='1'||location.hash==='#visit'}
function markVisit(){if(location.hash==='#visit')sessionStorage.setItem('stip_places_visit_mode','1')}
function clearVisit(){if(!location.hash.includes('place/'))sessionStorage.removeItem('stip_places_visit_mode')}
function getRows(){return [...document.querySelectorAll('#placesContent .place-row[data-place]')]}
function classify(row){const meta=norm(row.textContent);const id=row.dataset.place||'';if(/ascenseur/.test(meta)||/elev|asc_/.test(id))return'elevator';if(/étage|niveau|rez-de-|rez de |rdc|rdj/.test(meta)||/_(rdc|rdj|l\d+|tm)$/.test(id))return'level';return'other'}
function floorRank(row){const t=norm(row.textContent);if(/sous-sol|niveau\s*-\s*\d/.test(t)){const m=t.match(/-\s*(\d+)/);return-100+(m?+m[1]:0)}if(/rez-de-jardin|rez de jardin|rdj|\brj\b/.test(t))return-20;if(/rez-de-chaussée|rez de chaussee|\brdc\b/.test(t))return-10;if(/\btm\b/.test(t))return-5;const m=t.match(/(?:niveau|étage|etage)\s*(\d+)|\b(\d+)(?:er|e|ème|eme)\b/);return m?+(m[1]||m[2]):999}
function title(text,small){const s=document.createElement('section');s.className='places-section visit-nav-section';s.innerHTML=`<header class="places-section-head"><h2>${text}</h2><small>${small}</small></header><div class="places-list"></div>`;return s}
function enhanceHospital(){if(!visitMode())return;const content=q('#placesContent');if(!content||content.querySelector('.visit-nav-section'))return;const hero=content.querySelector('.place-hero-card');if(!hero)return;const kicker=norm(hero.querySelector('.place-kicker')?.textContent);if(!kicker.includes('hôpital')&&!kicker.includes('hopital'))return;
 const rows=getRows(),levels=rows.filter(r=>classify(r)==='level').sort((a,b)=>floorRank(a)-floorRank(b)),elevators=rows.filter(r=>classify(r)==='elevator'),others=rows.filter(r=>classify(r)==='other');
 const old=[...content.querySelectorAll('.places-section')].find(s=>s.querySelector('.place-row[data-place]')&&/continuer la visite/i.test(s.textContent));if(!old)return;
 const anchor=old; if(levels.length){const sec=title('Par étage',`${levels.length} niveau${levels.length>1?'x':''} · du plus bas au plus haut`);levels.forEach(r=>sec.querySelector('.places-list').appendChild(r));anchor.before(sec)}
 if(elevators.length){const sec=title('Par ascenseur',`${elevators.length} repère${elevators.length>1?'s':''} vertical${elevators.length>1?'aux':''}`);elevators.forEach(r=>sec.querySelector('.places-list').appendChild(r));anchor.before(sec)}
 if(others.length){const sec=title('Autres lieux',`${others.length} repère${others.length>1?'s':''}`);others.forEach(r=>sec.querySelector('.places-list').appendChild(r));anchor.before(sec)}
 old.remove();
 const p=hero.querySelector('p');if(p&&!hero.querySelector('.visit-nav-help')){const h=document.createElement('p');h.className='place-details-note visit-nav-help';h.textContent='Choisis un étage pour voir rapidement ce qu’il contient, ou un ascenseur pour suivre le bâtiment verticalement.';hero.appendChild(h)}
}
function enhanceElevator(){if(!visitMode())return;const content=q('#placesContent');if(!content)return;const hero=content.querySelector('.place-hero-card');if(!hero)return;const k=norm(hero.querySelector('.place-kicker')?.textContent),name=norm(hero.querySelector('h2')?.textContent);if(!k.includes('ascenseur')&&!name.includes('ascenseur'))return;content.classList.add('visit-elevator-view');const sections=[...content.querySelectorAll('.places-section')];for(const s of sections){const h=s.querySelector('h2');if(h&&/à proximité|relié/i.test(h.textContent))h.textContent='Ce que tu croises / à proximité'}
}
function run(){markVisit();enhanceHospital();enhanceElevator()}
window.addEventListener('hashchange',()=>setTimeout(run,80));document.addEventListener('click',e=>{if(e.target.closest('[data-nav-visit]'))sessionStorage.setItem('stip_places_visit_mode','1');if(e.target.closest('#placesHome'))clearVisit();setTimeout(run,120)});new MutationObserver(()=>requestAnimationFrame(run)).observe(document.documentElement,{subtree:true,childList:true});setTimeout(run,200);
})();
