(()=>{'use strict';
function permissions(){return window.STIPBootCache?.permissions||window.STIPSession?.permissions||{}}
function apply(){const ok=!!permissions().responsable;document.documentElement.classList.toggle('stip-calendar-no-responsable',!ok)}
window.addEventListener('stip:session-ready',apply);window.addEventListener('stip:boot-updated',apply);window.addEventListener('stip:session-ended',()=>document.documentElement.classList.add('stip-calendar-no-responsable'));apply();
const st=document.createElement('style');st.textContent=`.stip-calendar-no-responsable .cal-choice.formations,.stip-calendar-no-responsable .cal-choice.stagiaires{display:none!important}`;document.head.appendChild(st);
})();