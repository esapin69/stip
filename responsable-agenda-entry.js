(()=>{'use strict';
function wire(){const b=document.querySelector('[data-resp-agenda]');if(!b)return;b.addEventListener('click',()=>location.href='responsable.html?tab=agenda')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();