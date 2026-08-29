(()=>{
'use strict';
/* Garde-fou transversal : aucun rafraîchissement de fond ne doit reconstruire une app ouverte. */
function currentRoute(){return String(window.STIPRouter?.get?.()||location.hash.replace(/^#\/?/,'')||'home')}
function patchRouter(){
  const r=window.STIPRouter;if(!r||r.__stabilityGuard)return false;
  const nativeSet=r.set?.bind(r);
  if(nativeSet)r.set=(next,opt={})=>{
    const target=String(next||'home').replace(/^\/+|\/+$/g,'')||'home';
    if(currentRoute()===target)return; // même route = aucune reconstruction, aucun retour en haut
    nativeSet(target,opt);
  };
  r.__stabilityGuard=true;
  return true;
}
if(!patchRouter()){
  const t=setInterval(()=>{if(patchRouter())clearInterval(t)},25);
  setTimeout(()=>clearInterval(t),3000);
}
/* Bloque uniquement les mises à jour de fond de l'accueil lorsqu'une autre app est ouverte.
   Les données restent rechargées à la prochaine ouverture explicite, sans bouger la page actuelle. */
window.addEventListener('stip:boot-updated',e=>{
  const r=currentRoute();
  if(r!=='home'&&r!=='')e.stopImmediatePropagation();
},true);
/* Empêche le navigateur de déplacer la page lors d'un focus programmatique non demandé. */
document.addEventListener('focusin',e=>{
  if(!e.isTrusted&&currentRoute().startsWith('planning/')){
    try{e.target?.blur?.()}catch{}
  }
},true);
})();