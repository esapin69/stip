(()=>{
'use strict';
if(window.STIPNav?.version)return;
const SAME_ORIGIN=()=>{
  try{return !document.referrer||new URL(document.referrer).origin===location.origin}catch{return true}
};
function fallback(){
  const p=location.pathname.toLowerCase();
  if(p.includes('cadre-'))return 'cadre.html';
  if(p.includes('responsable-'))return 'responsable.html';
  if(p.endsWith('/places.html')||p.endsWith('places.html'))return '/';
  return '/';
}
function canBack(){return history.length>1&&SAME_ORIGIN()}
function back(to=fallback()){
  if(canBack()){history.back();return true}
  location.href=to;return false
}
document.addEventListener('click',e=>{
  if(!location.pathname.toLowerCase().endsWith('places.html'))return;
  const route=e.target.closest?.('[data-route]');
  if(!route)return;
  const id=String(route.dataset.route||'').trim();
  if(!id)return;
  const target=`#/route/${encodeURIComponent(id)}`;
  if(location.hash===target)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  location.hash=target;
},true);
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-stip-back],#backBtn,#placesBack');
  if(!b)return;
  if(b.id==='placesBack'){
    const q=document.querySelector('#placesSearch');
    if(q&&q.value)return;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  back(b.dataset?.backFallback||fallback());
},true);
window.STIPNav={version:1,back,canBack};
})();
