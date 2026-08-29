(()=>{'use strict';
function trimHomePlanning(){
 const days=[...document.querySelectorAll('#homeView .hc-days .hc-day')];
 if(!days.length)return;
 const today=days.find(d=>d.classList.contains('today'));
 if(!today)return;
 const dow=[...today.classList].find(c=>/^d[1-7]$/.test(c));
 const n=Number(dow?.slice(1)||0);
 let first=today;
 if(n===7){const prev=today.previousElementSibling;if(prev?.classList.contains('hc-day')&&prev.classList.contains('d6'))first=prev}
 days.forEach(d=>{if(d===first)return;let p=d;while(p&&p!==first){if(p===d&&first.compareDocumentPosition(d)&Node.DOCUMENT_POSITION_FOLLOWING)break;p=p.nextElementSibling}if(d.compareDocumentPosition(first)&Node.DOCUMENT_POSITION_FOLLOWING)d.remove()});
 const wrap=document.querySelector('#homeView .hc-days');
 if(!wrap)return;
 let seen=false;
 [...wrap.children].forEach(el=>{if(el===first)seen=true;else if(!seen&&(el.classList.contains('hc-week-sep')||el.classList.contains('hc-month')))el.remove()});
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;trimHomePlanning()})}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
})();