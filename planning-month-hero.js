(()=>{'use strict';
const MONTHS=['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];
const SLUGS=['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
const BASE='https://yzsrmuxghlengnkyphxj.supabase.co/storage/v1/object/public/stip-public-assets/planning/months/';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false;
function monthImg(i){return`${BASE}${SLUGS[(i+12)%12]}.png`}
function enhance(){
  if(busy)return;
  const card=document.querySelector('#phContent .ph-month-card');
  if(!card)return;
  const oldHero=card.querySelector(':scope>.ph-month-hero');
  const header=card.querySelector(':scope>header');
  if(oldHero&&!header)return;
  const source=header||oldHero;
  if(!source||!header)return;
  const label=header.querySelector('strong')?.textContent?.trim().toUpperCase()||'';
  const year=header.querySelector('small')?.textContent?.trim()||'';
  const idx=MONTHS.indexOf(label);
  if(idx<0)return;
  const boot=window.STIPBootCache||{},a=boot.agent||window.STIPSession?.agent||{},avatars=boot.media?.avatars||{};
  const avatar=avatars[a.source_key]||avatars[a.id]||a.avatar_signed_url||a.avatar_url||'';
  busy=true;
  oldHero?.remove();
  const hero=document.createElement('section');
  hero.className='ph-month-hero';
  hero.innerHTML=`
    <div class="phmh-person">
      <div class="phmh-year">${esc(year)}</div>
      <div class="phmh-avatar">${avatar?`<img src="${esc(avatar)}" alt="">`:`<span>${esc((a.prenom?.[0]||'')+(a.nom?.[0]||''))}</span>`}</div>
    </div>
    <div class="phmh-carousel" aria-label="Changer de mois">
      <button class="phmh-side prev" type="button" data-phmh-side="-1" aria-label="Mois précédent"><img src="${monthImg(idx-1)}" alt="${esc(MONTHS[(idx+11)%12])}"></button>
      <div class="phmh-center"><img src="${monthImg(idx)}" alt="${esc(label)}"></div>
      <button class="phmh-side next" type="button" data-phmh-side="1" aria-label="Mois suivant"><img src="${monthImg(idx+1)}" alt="${esc(MONTHS[(idx+1)%12])}"></button>
      <button class="phmh-hidden-nav" type="button" data-month-nav="-1" tabindex="-1" aria-hidden="true"></button>
      <button class="phmh-hidden-nav" type="button" data-month-nav="1" tabindex="-1" aria-hidden="true"></button>
    </div>`;
  header.replaceWith(hero);
  const carousel=hero.querySelector('.phmh-carousel');
  let startX=0,startY=0,tracking=false;
  carousel.addEventListener('touchstart',e=>{const t=e.touches?.[0];if(!t)return;startX=t.clientX;startY=t.clientY;tracking=true},{passive:true});
  carousel.addEventListener('touchend',e=>{if(!tracking)return;tracking=false;const t=e.changedTouches?.[0];if(!t)return;const dx=t.clientX-startX,dy=t.clientY-startY;if(Math.abs(dx)<34||Math.abs(dx)<=Math.abs(dy))return;hero.querySelector(`[data-month-nav="${dx<0?1:-1}"]`)?.click()},{passive:true});
  hero.querySelectorAll('[data-phmh-side]').forEach(b=>b.addEventListener('click',()=>hero.querySelector(`[data-month-nav="${b.dataset.phmhSide}"]`)?.click()));
  busy=false;
}
function schedule(){setTimeout(enhance,0);requestAnimationFrame(()=>requestAnimationFrame(enhance))}
const obs=new MutationObserver(()=>schedule());
function watch(){const c=document.querySelector('#phContent');if(c)obs.observe(c,{childList:true,subtree:false});schedule()}
window.addEventListener('stip:planning-select',e=>{if(e.detail?.kind==='personal')watch()});
window.addEventListener('stip:boot-updated',schedule);
document.addEventListener('click',e=>{if(e.target.closest?.('[data-month-nav]'))setTimeout(schedule,20)});
setTimeout(watch,80);
const s=document.createElement('style');s.textContent=`
.ph-month-card{background:#fff;border-radius:20px;overflow:hidden}.ph-month-card>.ph-month-hero{display:grid!important;grid-template-columns:82px minmax(0,1fr)!important;gap:9px!important;align-items:stretch!important;margin:0 0 10px!important;padding:7px 8px!important;border:0!important;background:linear-gradient(135deg,#fbfdfe,#f1f7f8)!important;box-shadow:none!important}.phmh-person{display:grid!important;grid-template-rows:18px 1fr!important;min-width:0!important}.phmh-year{display:flex!important;align-items:center!important;justify-content:center!important;color:#83959d!important;font-size:.66rem!important;font-weight:900!important;letter-spacing:.08em!important}.phmh-avatar{height:82px!important;border-radius:18px!important;overflow:hidden!important;background:#e8f1f3!important;border:1px solid #d8e5e8!important;display:grid!important;place-items:center!important}.phmh-avatar img{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:center top!important}.phmh-avatar span{font-size:1.2rem!important;font-weight:950!important;color:#3c6573!important}.phmh-carousel{position:relative!important;display:grid!important;grid-template-columns:25% 50% 25%!important;align-items:center!important;height:100px!important;min-width:0!important;overflow:hidden!important;border-radius:18px!important;background:#f7fafb!important;border:1px solid #e1eaed!important;touch-action:pan-y!important}.phmh-side,.phmh-center{height:100%!important;min-width:0!important;overflow:hidden!important;border:0!important;padding:0!important;background:transparent!important}.phmh-side{position:relative!important;opacity:.34!important;filter:saturate(.65)!important}.phmh-side img,.phmh-center img{display:block!important;height:100%!important;max-width:none!important;object-fit:contain!important}.phmh-center{display:flex!important;align-items:center!important;justify-content:center!important}.phmh-center img{width:100%!important}.phmh-side img{width:200%!important}.phmh-side.prev img{transform:translateX(-50%)!important}.phmh-side.next img{transform:none!important}.phmh-hidden-nav{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important}.phmh-carousel::before,.phmh-carousel::after{content:""!important;position:absolute!important;z-index:2!important;top:18%!important;bottom:18%!important;width:1px!important;background:#e3eaec!important;pointer-events:none!important}.phmh-carousel::before{left:25%!important}.phmh-carousel::after{right:25%!important}
.ph-month-card>.ph-month-grid{margin-top:0!important;gap:4px!important}.ph-month-card>.ph-month-grid .ph-day-head{padding:7px 0 6px!important;font-size:.56rem!important;letter-spacing:-.02em!important;border-bottom-width:3px!important}.ph-month-card>.ph-month-grid .ph-empty{min-height:68px!important}.ph-month-card>.ph-month-grid .ph-day-cell{min-height:84px!important;padding:5px 2px 3px!important;border:1px solid #e1eaed!important;border-radius:9px!important;background:linear-gradient(180deg,#fff,#f9fcfd)!important;box-shadow:0 2px 7px rgba(13,66,87,.035)!important}.ph-month-card>.ph-month-grid .ph-day-cell>b{margin-left:3px!important;font-size:1rem!important}.ph-month-card>.ph-month-grid .ph-shift-img{max-height:62px!important;filter:drop-shadow(0 2px 3px rgba(0,0,0,.08))!important}.ph-month-card>.ph-month-grid .ph-day-cell.today{background:#e9f8fb!important;outline:0!important;box-shadow:inset 0 0 0 3px #0d4257,0 4px 10px rgba(13,66,87,.10)!important}
@media(max-width:430px){.ph-month-card>.ph-month-hero{grid-template-columns:76px minmax(0,1fr)!important;gap:7px!important;padding:6px!important}.phmh-person{grid-template-rows:17px 1fr!important}.phmh-year{font-size:.62rem!important}.phmh-avatar{height:78px!important;border-radius:17px!important}.phmh-carousel{height:95px!important;border-radius:17px!important}.ph-month-card>.ph-month-grid{gap:3px!important}.ph-month-card>.ph-month-grid .ph-day-cell{min-height:78px!important;border-radius:7px!important}.ph-month-card>.ph-month-grid .ph-shift-img{max-height:57px!important}}
@media(max-width:370px){.ph-month-card>.ph-month-hero{grid-template-columns:70px minmax(0,1fr)!important;gap:6px!important;padding:5px!important}.phmh-avatar{height:73px!important}.phmh-carousel{height:90px!important}.ph-month-card>.ph-month-grid .ph-day-head{font-size:.48rem!important}.ph-month-card>.ph-month-grid .ph-day-cell{min-height:70px!important}.ph-month-card>.ph-month-grid .ph-shift-img{max-height:51px!important}}
`;document.head.appendChild(s)})();