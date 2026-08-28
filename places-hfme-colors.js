(()=>{
'use strict';
const ELEVATORS={
  hfme_elev_orange:{key:'orange',label:'ORANGE',hex:'#d98a3a'},
  hfme_elev_rose:{key:'rose',label:'ROSE',hex:'#cf788c'},
  hfme_elev_blue:{key:'blue',label:'BLEU',hex:'#3c91ad'},
  hfme_elev_green:{key:'green',label:'VERT',hex:'#719b78'}
};
const ORDER=['orange','rose','blue','green'];
const rels=()=>Array.isArray(window.__STIP_PLACE_RELATIONS)?window.__STIP_PLACE_RELATIONS:[];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function currentPlaceId(){const m=location.hash.match(/^#\/?place\/(.+)$/);return m?decodeURIComponent(m[1]):''}
function elevatorInfo(id){return ELEVATORS[id]||null}
function accessesFor(placeId){
  if(placeId==='hfme')return Object.values(ELEVATORS);
  const own=elevatorInfo(placeId);if(own)return[own];
  const out=[],seen=new Set();
  for(const r of rels()){
    if(r.to_place_id!==placeId||r.relation_type!=='serves')continue;
    const info=elevatorInfo(r.from_place_id);if(info&&!seen.has(info.key)){seen.add(info.key);out.push(info)}
  }
  return out.sort((a,b)=>ORDER.indexOf(a.key)-ORDER.indexOf(b.key));
}
function badgeHtml(items){if(!items.length)return'';return `<div class="hfme-access-badges" aria-label="Ascenseurs HFME">${items.map(x=>`<span class="hfme-access-badge hfme-${x.key}" title="Ascenseur ${esc(x.label.toLowerCase())}">${esc(x.label)}</span>`).join('')}</div>`}
function accentValue(items){
  if(!items.length)return'';
  if(items.length===1)return items[0].hex;
  const step=100/items.length;return `linear-gradient(to bottom,${items.map((x,i)=>`${x.hex} ${i*step}% ${(i+1)*step}%`).join(',')})`;
}
function decorate(el,placeId){
  if(!el||el.dataset.hfmeColorDone==='1')return;
  const items=accessesFor(placeId);if(!items.length)return;
  el.dataset.hfmeColorDone='1';el.classList.add('hfme-colorized');
  const accent=accentValue(items);if(accent)el.style.setProperty('--hfme-accent',accent);
  const target=el.matches('.place-hero-card')?el.querySelector('.place-meta')||el:el.querySelector('.place-row-main')||el.querySelector('span:last-child')||el;
  if(target&&!target.querySelector('.hfme-access-badges'))target.insertAdjacentHTML('beforeend',badgeHtml(items));
  const own=elevatorInfo(placeId);if(own){const title=el.querySelector('h2,strong');if(title)title.classList.add('hfme-elevator-title')}
}
function legend(){
  const id=currentPlaceId();if(!(id==='hfme'||id.startsWith('hfme_')))return;
  const content=document.querySelector('#placesContent');if(!content||content.querySelector('.hfme-color-legend'))return;
  const hero=content.querySelector('.place-hero-card');if(!hero)return;
  const box=document.createElement('section');box.className='hfme-color-legend';box.innerHTML=`<header><h3>Code couleur HFME</h3><small>Couleur = ascenseur indiqué sur le panneau</small></header><div class="hfme-color-list">${badgeHtml(Object.values(ELEVATORS)).replace(/^<div class="hfme-access-badges"[^>]*>|<\/div>$/g,'')}</div>`;
  hero.after(box);
}
function run(){
  document.querySelectorAll('.place-row[data-place],.place-primary[data-place]').forEach(el=>decorate(el,el.dataset.place||''));
  const id=currentPlaceId(),hero=document.querySelector('#placesContent .place-hero-card');if(id&&hero)decorate(hero,id);
  legend();
}
window.addEventListener('stip:place-relations-ready',()=>setTimeout(run,20));window.addEventListener('hashchange',()=>setTimeout(run,80));
new MutationObserver(()=>requestAnimationFrame(run)).observe(document.documentElement,{subtree:true,childList:true});setTimeout(run,250);
})();
