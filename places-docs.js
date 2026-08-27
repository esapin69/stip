(()=>{
'use strict';
const STACK_KEY='stip_places_waypoint_stack_v1';
const PROCEDURES={
  route_b14_cermep:{
    provenance:'Procédure STIP validée · 27/07/2026',
    guideUrl:'https://drive.google.com/drive/folders/1hNPM7Jy7LdbyTlYA5Uk72ukvXItgbPG3',
    guideLabel:'Ouvrir les documents officiels CERMEP',
    destination:{placeId:'cermep',label:'CERMEP'},
    sourceAliases:{'Source · Procedure_acces_CERMEP_visuel_plus_utile_v2':'Source · Procédure STIP CERMEP · 27/07/2026'},
    steps:{
      1:'Accès STIP recommandé : entrer par B14 et rejoindre le hall principal. Éviter le passage routier extérieur pour le brancardage.',
      5:'Sonner et attendre l’ouverture par un personnel habilité. Ne jamais forcer la porte. Sans réponse, contacter le CERMEP ou la sécurité.',
      6:'Continuer dans le couloir technique, franchir la porte verte et refermer les portes sécurisées après passage.'
    },
    waypoints:{
      1:{placeId:'b14',label:'B14 · Médecine nucléaire',cta:'Je ne connais pas B14'}
    }
  }
};
function readStack(){try{return JSON.parse(sessionStorage.getItem(STACK_KEY)||'[]')}catch{return[]}}
function writeStack(v){sessionStorage.setItem(STACK_KEY,JSON.stringify(v))}
function currentPlaceId(){const m=location.hash.match(/#\/place\/([^/?#]+)/);return m?decodeURIComponent(m[1]):''}
function adaptSources(){
  const aliases=Object.values(PROCEDURES).flatMap(p=>Object.entries(p.sourceAliases||{}));
  document.querySelectorAll('.place-hero-card .place-chip').forEach(chip=>{
    const hit=aliases.find(([from])=>chip.textContent.trim()===from);
    if(hit)chip.textContent=hit[1];
  });
}
function pushWaypoint(routeId,wp){
  const cfg=PROCEDURES[routeId];if(!cfg)return;
  const stack=readStack();
  stack.push({routeId,destinationPlaceId:cfg.destination?.placeId||'',destinationLabel:cfg.destination?.label||'destination',waypointPlaceId:wp.placeId,waypointLabel:wp.label,resumeHash:location.hash||`#/place/${encodeURIComponent(cfg.destination?.placeId||'')}`});
  writeStack(stack);
  location.hash=`#/place/${encodeURIComponent(wp.placeId)}`;
}
function addWaypoint(row,routeId,wp){
  if(row.querySelector('[data-waypoint]'))return;
  const host=row.querySelector('span');if(!host)return;
  host.insertAdjacentHTML('beforeend',`<button type="button" class="route-waypoint" data-waypoint data-route-id="${routeId}" data-waypoint-id="${wp.placeId}"><span>${wp.label}</span><small>${wp.cta||'Voir ce repère'}</small></button>`);
}
function adaptRoute(card,routeId){
  const cfg=PROCEDURES[routeId];if(!cfg)return;
  const steps=card.querySelector('.route-steps');
  const old=card.querySelector('.route-documentation');old?.remove();
  if(!steps)return;
  steps.querySelectorAll('.route-step').forEach(row=>{
    const n=Number(row.querySelector('b')?.textContent||0),text=cfg.steps?.[n];
    if(text){const span=row.querySelector('span');if(span&&span.firstChild)span.firstChild.textContent=text;else if(span)span.textContent=text;}
    const wp=cfg.waypoints?.[n];if(wp)addWaypoint(row,routeId,wp);
  });
  if(cfg.guideUrl&&!card.querySelector('[data-route-guide]'))steps.insertAdjacentHTML('afterend',`<a class="route-guide-link" data-route-guide href="${cfg.guideUrl}" target="_blank" rel="noopener noreferrer">${cfg.guideLabel||'Ouvrir le guide'}</a>`);
  if(cfg.provenance&&!card.querySelector('[data-route-provenance]')){const guide=card.querySelector('[data-route-guide]');(guide||steps).insertAdjacentHTML('afterend',`<div class="route-provenance" data-route-provenance>${cfg.provenance}</div>`);}
}
function renderWaypointContext(){
  const stack=readStack();if(!stack.length)return;
  const ctx=stack[stack.length-1],placeId=currentPlaceId();
  document.querySelectorAll('[data-waypoint-context]').forEach(x=>x.remove());
  if(placeId!==ctx.waypointPlaceId)return;
  const hero=document.querySelector('.place-hero-card');if(!hero)return;
  hero.insertAdjacentHTML('afterend',`<section class="waypoint-context" data-waypoint-context><span>ÉTAPE PRÉALABLE</span><strong>Rejoins ${ctx.waypointLabel}</strong><p>Tu es toujours en route vers <b>${ctx.destinationLabel}</b>. Utilise ici les informations et liaisons de ce repère. Une fois arrivé, reprends ton trajet initial sans perdre ta destination.</p><div><button type="button" data-waypoint-resume>Je suis arrivé · reprendre ${ctx.destinationLabel}</button><button type="button" data-waypoint-cancel>Annuler ce détour</button></div></section>`);
}
function enhance(){adaptSources();document.querySelectorAll('.route-card button[data-route]').forEach(btn=>adaptRoute(btn.closest('.route-card'),btn.dataset.route));renderWaypointContext();}
document.addEventListener('click',e=>{
  const w=e.target.closest?.('[data-waypoint]');
  if(w){e.preventDefault();e.stopPropagation();const cfg=PROCEDURES[w.dataset.routeId],wp=Object.values(cfg?.waypoints||{}).find(x=>x.placeId===w.dataset.waypointId);if(wp)pushWaypoint(w.dataset.routeId,wp);return}
  if(e.target.closest?.('[data-waypoint-resume]')){const stack=readStack(),ctx=stack.pop();writeStack(stack);location.hash=ctx?.resumeHash||'';return}
  if(e.target.closest?.('[data-waypoint-cancel]')){const stack=readStack();stack.pop();writeStack(stack);history.back();}
});
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}
new MutationObserver(queue).observe(document.getElementById('placesContent')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',queue);
queue();
})();
