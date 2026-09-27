(()=>{'use strict';
const loginForm=document.getElementById('loginForm'),submit=loginForm?.querySelector('.t-login-submit'),label=submit?.querySelector('span'),defaultLabel=label?.textContent||'Continuer';
function busy(on){if(!submit)return;submit.classList.toggle('stip-submit-loading',!!on);submit.setAttribute('aria-busy',on?'true':'false');if(label)label.textContent=on?'Vérification…':defaultLabel}
loginForm?.addEventListener('submit',()=>{const code=String(document.getElementById('accessCode')?.value||'').replace(/\D/g,'').slice(0,6);if(code.length===6)busy(true)},true);
if(submit)new MutationObserver(()=>{if(!submit.disabled)busy(false)}).observe(submit,{attributes:true,attributeFilter:['disabled']});
window.addEventListener('stip:login-success',()=>busy(false));
})();