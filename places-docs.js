(()=>{
'use strict';
const PROCEDURES={
  route_b14_cermep:{
    provenance:'Procédure STIP validée · 27/07/2026',
    sourceAliases:{'Source · Procedure_acces_CERMEP_visuel_plus_utile_v2':'Source · Procédure STIP CERMEP · 27/07/2026'},
    steps:{
      1:'Accès STIP recommandé : entrer par B14 et rejoindre le hall principal. Éviter le passage routier extérieur pour le brancardage.',
      5:'Sonner et attendre l’ouverture par un personnel habilité. Ne jamais forcer la porte. Sans réponse, contacter le CERMEP ou la sécurité.',
      6:'Continuer dans le couloir technique, franchir la porte verte et refermer les portes sécurisées après passage.'
    }
  }
};
function adaptSources(){
  const aliases=Object.values(PROCEDURES).flatMap(p=>Object.entries(p.sourceAliases||{}));
  document.querySelectorAll('.place-hero-card .place-chip').forEach(chip=>{
    const hit=aliases.find(([from])=>chip.textContent.trim()===from);
    if(hit)chip.textContent=hit[1];
  });
}
function adaptRoute(card,routeId){
  const cfg=PROCEDURES[routeId];if(!cfg)return;
  const steps=card.querySelector('.route-steps');
  const old=card.querySelector('.route-documentation');old?.remove();
  if(!steps)return;
  steps.querySelectorAll('.route-step').forEach(row=>{
    const n=Number(row.querySelector('b')?.textContent||0),text=cfg.steps?.[n];
    if(text){const span=row.querySelector('span');if(span)span.textContent=text;}
  });
  if(cfg.provenance&&!card.querySelector('[data-route-provenance]')){
    steps.insertAdjacentHTML('afterend',`<div class="route-provenance" data-route-provenance>${cfg.provenance}</div>`);
  }
}
function enhance(){
  adaptSources();
  document.querySelectorAll('.route-card button[data-route]').forEach(btn=>adaptRoute(btn.closest('.route-card'),btn.dataset.route));
}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}
new MutationObserver(queue).observe(document.getElementById('placesContent')||document.body,{childList:true,subtree:true});
queue();
})();
