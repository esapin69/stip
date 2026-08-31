(()=>{
'use strict';
const icon='<img src="images/icone_app/visiter-les-lieux.webp?v=20260831-icons3" alt="" aria-hidden="true">';
const target='places-app.html?v=20260831-access-depth1';
function session(){return window.STIPSession||window.STIPBootCache||{}}
function level(){const d=session().depths||{};if(Object.prototype.hasOwnProperty.call(d,'places'))return String(d.places||'none').toLowerCase();return 'basic'}
function permission(){const p=session().permissions||{};if(Object.prototype.hasOwnProperty.call(p,'places_enabled'))return !!p.places_enabled;if(Object.prototype.hasOwnProperty.call(p,'places'))return !!p.places;if(Object.prototype.hasOwnProperty.call(p,'visiter_les_lieux'))return !!p.visiter_les_lieux;return null}
function allowed(){const r=String(session().role_key||'').toLowerCase();if(r==='admin')return true;const p=permission();if(p===false)return false;if(p===true)return level()!=='none';return level()!=='none'}
function open(e){e?.preventDefault?.();e?.stopPropagation?.();if(!allowed())return;location.href=target}
function injectHome(){
  if(!window.STIPSession&&!window.STIPBootCache)return;
  const box=document.querySelector('#homeView .hc-apps');
  const existing=box?.querySelector('[data-stip-places]');
  if(!allowed()){existing?.remove();document.querySelector('#homeView [data-stip-places-fallback]')?.remove();return}
  if(box&&!existing){
    const b=document.createElement('button');b.type='button';b.className='hc-app places';b.dataset.stipPlaces='1';b.setAttribute('aria-label','Visiter les lieux');b.innerHTML=`<span>${icon}</span><strong>Visiter les lieux</strong>`;b.onclick=open;box.appendChild(b)
  }
  const grid=document.querySelector('#moduleGrid');
  if(grid&&!document.querySelector('#homeView [data-stip-places-fallback]')&&!box){
    const b=document.createElement('button');b.type='button';b.className='module-card';b.dataset.stipPlacesFallback='1';b.innerHTML='<strong>Visiter les lieux</strong>';b.onclick=open;grid.appendChild(b)
  }
}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;injectHome()})}
['stip:session-ready','stip:boot-updated','stip:route'].forEach(n=>window.addEventListener(n,queue));window.addEventListener('pageshow',queue);
document.addEventListener('pointerdown',e=>{if(e.target.closest?.('[data-stip-places]')&&allowed()){const l=document.createElement('link');l.rel='prefetch';l.href=target;document.head.appendChild(l)}},{passive:true,capture:true});
queue();
})();
