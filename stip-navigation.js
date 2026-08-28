(()=>{
'use strict';
function familyFallback(){
  const p=location.pathname.toLowerCase();
  if(p.includes('cadre-'))return 'cadre.html';
  if(p.includes('responsable-'))return 'responsable.html';
  return 'index.html';
}
function canBack(){return history.length>1}
function back(fallback=familyFallback()){
  if(canBack()){history.back();return true}
  location.assign(fallback);return false
}
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-stip-back],#backBtn,#placesBack');
  if(!b)return;
  if(b.id==='placesBack'){
    const q=document.querySelector('#placesSearch');
    if(q?.value)return;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  back(b.dataset?.backFallback||familyFallback());
},true);
window.STIPNav={back,canBack};
})();