(()=>{
'use strict';
function currentPlaceId(){
  const m=location.hash.match(/#\/place\/([^/?#]+)/);
  return m?decodeURIComponent(m[1]):'';
}
const LABELS={
  self_ghe:'SELF',
  radiotherapy:'RT',
  cermep:'CER',
  idee:'IDÉE'
};
function addMissingCodes(){
  document.querySelectorAll('[data-place]').forEach(card=>{
    const id=card.getAttribute('data-place');
    const label=LABELS[id];
    if(!label)return;
    const line=card.querySelector('.home-titleline');
    if(line&&!line.querySelector('.home-code')){
      const code=document.createElement('span');
      code.className='home-code';
      code.textContent=label;
      line.prepend(code);
    }
  });
}
function tidy(){
  addMissingCodes();
  if(currentPlaceId()!=='hlp')return;
  document.querySelectorAll('.route-card').forEach(card=>{
    const title=card.querySelector('h3')?.textContent?.trim()||'';
    if(/h[ée]listation/i.test(title))card.remove();
  });
  document.querySelectorAll('.places-section').forEach(sec=>{
    if(sec.querySelector('h2')?.textContent?.trim()==='Comment y aller'&&!sec.querySelector('.route-card'))sec.remove();
  });
}
let queued=false;
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;tidy()})}
new MutationObserver(queue).observe(document.getElementById('placesContent')||document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',queue);
queue();
})();
