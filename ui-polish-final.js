(()=>{'use strict';
function normalizePlanningButtons(){const apps=document.querySelector('#planningView .ph-apps');if(!apps)return;const row=apps.querySelector('.ph-action-row');if(row){[...row.children].forEach(x=>apps.insertBefore(x,row));row.remove()}const print=apps.querySelector('[data-ph-print]');if(print&&!print.classList.contains('ph-app')){print.className='ph-app ph-app-print-tile';print.innerHTML='<span class="ph-icon print">🖨️</span><strong>Imprimer</strong>'}const cal=apps.querySelector('[data-cal-subscriptions]');if(cal&&!cal.classList.contains('ph-app'))cal.classList.add('ph-app');}
function normalizeMonthCard(){const card=document.querySelector('#phContent .ph-month-card');if(!card)return;card.classList.add('ph-a4-card')}
function run(){normalizePlanningButtons();normalizeMonthCard()}
const mo=new MutationObserver(()=>requestAnimationFrame(run));mo.observe(document.body,{childList:true,subtree:true});window.addEventListener('stip:planning-select',()=>setTimeout(run,0));window.addEventListener('stip:boot-updated',()=>setTimeout(run,0));setTimeout(run,50);
const s=document.createElement('style');s.textContent=`
#planningView .ph-apps,.rhub-apps{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
#planningView .ph-app,.rhub-app{min-height:64px!important;padding:8px 10px!important;border-radius:16px!important;gap:10px!important}
#planningView .ph-icon,.rhub-icon{width:40px!important;height:40px!important;flex:0 0 40px!important;border-radius:11px!important}
#planningView .ph-app strong,.rhub-app strong{font-size:.82rem!important;line-height:1.15!important}
#planningView .ph-app-print-tile{grid-column:1/-1!important;justify-content:flex-start!important;font-size:inherit!important}
#planningView .ph-icon.print{background:linear-gradient(145deg,#8996a3,#5d6873)!important;font-size:1.05rem!important}
#planningView .ph-content{padding:0!important;overflow:hidden!important;border-radius:22px!important}
#planningView .ph-month-card.ph-a4-card{background:#fff!important;padding:8px!important;border-radius:22px!important;box-shadow:none!important}
#planningView .ph-month-hero{margin:0 0 8px!important;padding:6px 4px 9px!important;border:0!important;border-bottom:1px solid #e0e7ea!important;border-radius:0!important;background:#fff!important;box-shadow:none!important}
#planningView .phmh-person>img,#planningView .phmh-person>span{border-radius:10px!important}
#planningView .phmh-month img{object-position:center!important}
#planningView .ph-month-grid{gap:2px!important}
#planningView .ph-day-cell{border-radius:5px!important;background:#fff!important;box-shadow:0 1px 0 rgba(13,66,87,.03)!important}
#planningView .ph-day-cell.today{background:#eefbfd!important;box-shadow:inset 0 0 0 2px #0d4257,0 0 0 3px rgba(13,66,87,.08)!important}
@media(max-width:380px){#planningView .ph-apps,.rhub-apps{gap:8px!important}#planningView .ph-app,.rhub-app{min-height:60px!important;padding:7px 8px!important}#planningView .ph-icon,.rhub-icon{width:38px!important;height:38px!important;flex-basis:38px!important}}
`;document.head.appendChild(s)
})();