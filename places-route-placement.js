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
const HOSPITAL_PHOTOS={
  hfme:'images/hospitals/hfme.jpg',
  pw:'images/hospitals/neuro.jpg',
  hlp:'images/hospitals/cardio.jpg',
  lp:'images/hospitals/cardio.jpg'
};
function injectVisitTheme(){
  if(document.getElementById('places-blue-photo-theme'))return;
  const s=document.createElement('style');
  s.id='places-blue-photo-theme';
  s.textContent=`
    :root{--accent:#234f70;--accent2:#1b4565;--primary:#173f5d;--primary-dark:#0c304b;--arrow:#173f5d}
    .eyebrow,.group-title{color:#234f70!important}.eyebrow:before{background:#234f70!important}
    .search-box{border-color:#173f5d!important}.search-icon,.search-clear,.search-floor-label,.floor-link,.nav-btn{background:#173f5d!important}
    .home-code{background:#234f70!important;box-shadow:0 4px 10px rgba(23,63,93,.22)!important}
    .map-direction:before{color:#315f80!important}.map-anchor:after,.axis-hospitals:before,.between-zone:before{background:#7394aa!important}
    .between-label{background:#edf2f6!important;color:#173f5d!important}
    .search-brace:before,.floor-body:before{border-color:#7394aa!important}
    a.destination.primary[href="#/place/hfme"]{background:linear-gradient(90deg,rgba(10,38,61,.78) 0%,rgba(10,38,61,.48) 48%,rgba(10,38,61,.10) 100%),url("images/hospitals/hfme.jpg") center 48%/cover no-repeat!important}
    a.destination.primary[href="#/place/pw"]{background:linear-gradient(90deg,rgba(10,38,61,.80) 0%,rgba(10,38,61,.48) 52%,rgba(10,38,61,.10) 100%),url("images/hospitals/neuro.jpg") center/cover no-repeat!important}
    a.destination.primary[href="#/place/hlp"]{background:linear-gradient(90deg,rgba(10,38,61,.80) 0%,rgba(10,38,61,.48) 52%,rgba(10,38,61,.10) 100%),url("images/hospitals/cardio.jpg") center/cover no-repeat!important}
    a.destination.primary[href="#/place/hfme"] .destination-arrow,a.destination.primary[href="#/place/pw"] .destination-arrow,a.destination.primary[href="#/place/hlp"] .destination-arrow{background:rgba(7,31,50,.72)!important;backdrop-filter:none!important}
    .detail-hero.hospital-photo-hero{position:relative;min-height:250px;padding:26px 22px;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;background-position:center!important;background-size:cover!important;background-repeat:no-repeat!important;text-shadow:0 2px 9px rgba(0,0,0,.42)}
    .detail-hero.hospital-photo-hero .detail-type,.detail-hero.hospital-photo-hero .detail-meta{color:#e6eef4!important}
    .detail-hero.hospital-photo-hero p{color:#f2f6f8!important}.detail-hero.hospital-photo-hero .detail-official{color:#fff!important}
    .detail-hero.hospital-photo-hfme{background-image:linear-gradient(0deg,rgba(7,30,49,.84) 0%,rgba(7,30,49,.42) 54%,rgba(7,30,49,.10) 100%),url("images/hospitals/hfme.jpg")!important}
    .detail-hero.hospital-photo-pw{background-image:linear-gradient(0deg,rgba(7,30,49,.84) 0%,rgba(7,30,49,.42) 54%,rgba(7,30,49,.10) 100%),url("images/hospitals/neuro.jpg")!important}
    .detail-hero.hospital-photo-hlp{background-image:linear-gradient(0deg,rgba(7,30,49,.84) 0%,rgba(7,30,49,.42) 54%,rgba(7,30,49,.10) 100%),url("images/hospitals/cardio.jpg")!important}
  `;
  document.head.appendChild(s);
}
function applyHospitalVisual(){
  const id=currentPlaceId(),hero=document.querySelector('#detailView .detail-hero');
  if(!hero)return;
  hero.classList.remove('hospital-photo-hero','hospital-photo-hfme','hospital-photo-pw','hospital-photo-hlp');
  if(id==='hfme')hero.classList.add('hospital-photo-hero','hospital-photo-hfme');
  else if(id==='pw')hero.classList.add('hospital-photo-hero','hospital-photo-pw');
  else if(id==='hlp'||id==='lp')hero.classList.add('hospital-photo-hero','hospital-photo-hlp');
}
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
  injectVisitTheme();
  addMissingCodes();
  applyHospitalVisual();
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
