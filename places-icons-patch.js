(()=>{
'use strict';
const LABELS={
  self_ghe:'SELF',
  radiotherapy:'RT',
  cermep:'CER',
  idee:'IDÉE'
};
function patch(){
  document.querySelectorAll('[data-place]').forEach(el=>{
    const id=el.getAttribute('data-place');
    const label=LABELS[id];
    if(!label)return;
    const main=el.querySelector('.place-row-main');
    if(!main||main.querySelector('.place-inline-icon'))return;
    const strong=main.querySelector(':scope > strong');
    if(!strong)return;
    const badge=document.createElement('span');
    badge.className='place-inline-icon';
    badge.textContent=label;
    strong.before(badge);
  });
}
const obs=new MutationObserver(patch);
obs.observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('DOMContentLoaded',patch);
patch();
})();