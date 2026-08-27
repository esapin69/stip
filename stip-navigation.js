(()=>{
'use strict';
if(window.STIPNav?.version)return;
const path=()=>location.pathname.toLowerCase();
const SAME_ORIGIN=()=>{try{return !document.referrer||new URL(document.referrer).origin===location.origin}catch{return true}};
function fallback(){const p=path();if(p.includes('cadre-'))return'cadre.html';if(p.includes('responsable-'))return'responsable.html';if(p.endsWith('places.html'))return'/';return'/'}
function canBack(){return history.length>1&&SAME_ORIGIN()}
function back(to=fallback()){if(canBack()){history.back();return true}location.href=to;return false}
function mergeState(extra={}){return{...(history.state||{}),stipNav:true,...extra}}
function push(extra={}){history.pushState(mergeState(extra),'',location.href)}
function replace(extra={}){history.replaceState(mergeState(extra),'',location.href)}

// Connaître les lieux : chaque trajet, lieu et niveau doit rester dans l'historique réel.
document.addEventListener('click',e=>{
  if(!path().endsWith('places.html'))return;
  const route=e.target.closest?.('[data-route]');if(!route)return;
  const id=String(route.dataset.route||'').trim();if(!id)return;
  const target=`#/route/${encodeURIComponent(id)}`;if(location.hash===target)return;
  e.preventDefault();e.stopImmediatePropagation();location.hash=target;
},true);

// Responsable : les changements d'onglet sont de vraies étapes de navigation.
if(path().endsWith('responsable.html')){
  if(!history.state?.respMode)replace({respMode:'tracking'});
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-resp-select]');if(!b)return;
    const mode=String(b.dataset.respSelect||'tracking');
    if(history.state?.respMode!==mode)push({respMode:mode});
  },true);
}

// Panneaux/modales : Retour doit d'abord les fermer au lieu de quitter l'application.
const OVERLAYS=[
  {sel:'#respPanel',open:el=>el.classList.contains('open'),close:el=>{el.classList.remove('open');el.setAttribute('aria-hidden','true')}},
  {sel:'#finalPanel',open:el=>!el.hidden,close:el=>{el.hidden=true;document.body.classList.remove('ev-modal-open')}}
];
let overlaySync=false;
function observeOverlay(def){const el=document.querySelector(def.sel);if(!el||el.dataset.stipHistoryBound)return;el.dataset.stipHistoryBound='1';let was=def.open(el);new MutationObserver(()=>{const now=def.open(el);if(now&&!was&&!overlaySync&&!history.state?.stipOverlay)push({stipOverlay:def.sel});was=now}).observe(el,{attributes:true,attributeFilter:['class','hidden','aria-hidden']})}
function bindOverlays(){OVERLAYS.forEach(observeOverlay)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindOverlays);else bindOverlays();
new MutationObserver(bindOverlays).observe(document.documentElement,{childList:true,subtree:true});

// Règle commune pour tous les boutons Retour explicites.
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-stip-back],#backBtn,#placesBack');if(!b)return;
  if(b.id==='placesBack'){const q=document.querySelector('#placesSearch');if(q&&q.value)return}
  e.preventDefault();e.stopImmediatePropagation();back(b.dataset?.backFallback||fallback());
},true);
document.addEventListener('click',e=>{
  const b=e.target.closest?.('#respPanelBack,#finalClose');if(!b||!history.state?.stipOverlay)return;
  e.preventDefault();e.stopImmediatePropagation();history.back();
},true);

window.addEventListener('popstate',e=>{
  overlaySync=true;
  for(const def of OVERLAYS){const el=document.querySelector(def.sel);if(el&&def.open(el)&&e.state?.stipOverlay!==def.sel)def.close(el)}
  overlaySync=false;
  if(path().endsWith('responsable.html')&&e.state?.respMode){const b=document.querySelector(`[data-resp-select="${CSS.escape(e.state.respMode)}"]`);if(b&&!b.classList.contains('selected'))b.click()}
});
window.STIPNav={version:2,back,canBack,push,replace};
})();
