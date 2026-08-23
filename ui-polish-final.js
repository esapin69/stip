(()=>{'use strict';
function normalizePlanningButtons(){
  const apps=document.querySelector('#planningView .ph-apps');
  if(!apps)return;
  const row=apps.querySelector('.ph-action-row');
  if(row){[...row.children].forEach(x=>apps.insertBefore(x,row));row.remove()}
  const print=apps.querySelector('[data-ph-print]');
  if(print)print.remove();
  apps.querySelectorAll('.ph-app').forEach((b,i)=>{
    b.classList.add('ph-app-tile');
    const icon=b.querySelector('.ph-icon');
    if(icon)icon.setAttribute('aria-hidden','true');
  });
}
function normalizeMonthCard(){const card=document.querySelector('#phContent .ph-month-card');if(card)card.classList.add('ph-a4-card')}
function run(){normalizePlanningButtons();normalizeMonthCard()}
const mo=new MutationObserver(()=>requestAnimationFrame(run));
mo.observe(document.body,{childList:true,subtree:true});
window.addEventListener('stip:planning-select',()=>setTimeout(run,0));
window.addEventListener('stip:boot-updated',()=>setTimeout(run,0));
setTimeout(run,50);
const s=document.createElement('style');s.textContent=`
#planningView .ph-apps,.rhub-apps{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px 10px!important;margin:0 10px 18px!important;align-items:start!important}
#planningView .ph-app.ph-app-tile,.rhub-app{min-height:0!important;padding:0 4px!important;border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;text-align:center!important;color:#0d4257!important}
#planningView .ph-app.ph-app-tile .ph-icon,.rhub-icon{width:68px!important;height:68px!important;flex:0 0 68px!important;border-radius:19px!important;display:grid!important;place-items:center!important;font-size:1.7rem!important;box-shadow:0 8px 18px rgba(13,66,87,.13)!important;border:1px solid rgba(255,255,255,.72)!important;transition:transform .16s ease,box-shadow .16s ease!important}
#planningView .ph-app.ph-app-tile:active .ph-icon{transform:scale(.95)!important}
#planningView .ph-app.ph-app-tile strong,.rhub-app strong{display:block!important;max-width:142px!important;margin:0 auto!important;font-size:.88rem!important;line-height:1.13!important;font-weight:900!important;color:#123f50!important;text-align:center!important;white-space:normal!important}
#planningView .ph-app.ph-app-tile.selected{background:transparent!important;border:0!important;box-shadow:none!important}
#planningView .ph-app.ph-app-tile.selected .ph-icon{box-shadow:0 0 0 3px #dff7fb,0 0 0 5px #72cbd9,0 10px 22px rgba(13,66,87,.15)!important}
#planningView .ph-icon.personal{background:linear-gradient(180deg,#fff 0 28%,#ff5b56 29% 100%)!important}
#planningView .ph-icon.spirit{background:linear-gradient(145deg,#aa8ef5,#6d54d8)!important}
#planningView .ph-icon.change{background:linear-gradient(145deg,#63d65f,#2da543)!important}
#planningView .ph-icon.cal{background:linear-gradient(145deg,#2695d9,#6257da)!important}
#planningView .ph-content{padding:0!important;overflow:hidden!important;border-radius:22px!important}
#planningView .ph-month-card.ph-a4-card{background:#fff!important;padding:8px!important;border-radius:22px!important;box-shadow:none!important}
#planningView .ph-month-hero{margin:0 0 8px!important;padding:6px 4px 9px!important;border:0!important;border-bottom:1px solid #e0e7ea!important;border-radius:0!important;background:#fff!important;box-shadow:none!important}
#planningView .phmh-person>img,#planningView .phmh-person>span{border-radius:10px!important}
#planningView .phmh-month img{object-position:center!important}
#planningView .ph-month-grid{gap:2px!important}
#planningView .ph-day-cell{border-radius:5px!important;background:#fff!important;box-shadow:0 1px 0 rgba(13,66,87,.03)!important}
#planningView .ph-day-cell.today{background:#eefbfd!important;box-shadow:inset 0 0 0 2px #0d4257,0 0 0 3px rgba(13,66,87,.08)!important}
@media(max-width:380px){#planningView .ph-apps,.rhub-apps{gap:12px 8px!important;margin-inline:6px!important}#planningView .ph-app.ph-app-tile .ph-icon,.rhub-icon{width:62px!important;height:62px!important;flex-basis:62px!important;border-radius:17px!important;font-size:1.55rem!important}#planningView .ph-app.ph-app-tile strong,.rhub-app strong{font-size:.82rem!important;max-width:128px!important}}
`;document.head.appendChild(s)
})();