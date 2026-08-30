(()=>{
'use strict';
const icon='<img src="images/icone_app/visiter-les-lieux.webp?v=20260831-icons3" alt="" aria-hidden="true">';
const target='places.html?v=20260831-room-fiche2&mode=pro';
function open(e){e?.preventDefault?.();e?.stopPropagation?.();location.href=target}
function injectHome(){
  if(!window.STIPSession&&!window.STIPBootCache)return;
  const box=document.querySelector('#homeView .hc-apps');
  if(box&&!box.querySelector('[data-stip-places]')){
    const b=document.createElement('button');b.type='button';b.className='hc-app places';b.dataset.stipPlaces='1';b.setAttribute('aria-label','Visiter les lieux');b.innerHTML=`<span>${icon}</span><strong>Visiter les lieux</strong>`;b.onclick=open;box.appendChild(b)
  }
  const grid=document.querySelector('#moduleGrid');
  if(grid&&!document.querySelector('#homeView [data-stip-places-fallback]')&&!box){
    const b=document.createElement('button');b.type='button';b.className='module-card';b.dataset.stipPlacesFallback='1';b.innerHTML='<strong>Visiter les lieux</strong>';b.onclick=open;grid.appendChild(b)
  }
}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;injectHome()})}
['stip:session-ready','stip:boot-updated','stip:route'].forEach(n=>window.addEventListener(n,queue));window.addEventListener('pageshow',queue);
document.addEventListener('pointerdown',e=>{if(e.target.closest?.('[data-stip-places]')){const l=document.createElement('link');l.rel='prefetch';l.href=target;document.head.appendChild(l)}},{passive:true,capture:true});
queue();
})();
