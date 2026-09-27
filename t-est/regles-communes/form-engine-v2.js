(()=>{'use strict';
const d=document.getElementById('accessRequestDialog'),form=document.getElementById('accessRequestForm');
const loginForm=document.getElementById('loginForm'),submit=loginForm?.querySelector('.t-login-submit'),label=submit?.querySelector('span'),defaultLabel=label?.textContent||'Continuer';
function busy(on){if(!submit)return;submit.classList.toggle('stip-submit-loading',!!on);submit.setAttribute('aria-busy',on?'true':'false');if(label)label.textContent=on?'Vérification…':defaultLabel}
loginForm?.addEventListener('submit',()=>{const code=String(document.getElementById('accessCode')?.value||'').replace(/\D/g,'').slice(0,6);if(code.length===6)busy(true)},true);
if(submit)new MutationObserver(()=>{if(!submit.disabled)busy(false)}).observe(submit,{attributes:true,attributeFilter:['disabled']});
window.addEventListener('stip:login-success',()=>busy(false));

/* Override the old opener before its target-level listener: show the complete
   form first and only enter focused keyboard mode after an explicit field tap. */
document.addEventListener('pointerdown',e=>{const opener=e.target.closest?.('[data-open-access-request]');if(!opener||!d||!form)return;e.preventDefault();e.stopImmediatePropagation();document.activeElement?.blur?.();window.STIPFormUX?.resetIntents?.(d);if(!d.open)d.showModal();form.classList.remove('stip-keyboard-focus-mode');requestAnimationFrame(()=>{d.scrollTop=0;form.scrollTop=0})},true);

/* Physical keyboard / desktop: Enter advances through ordinary single-line
   fields; on the final field it submits. Textarea keeps its normal newline. */
form?.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.shiftKey||e.isComposing)return;const field=e.target.closest?.('[data-stip-keyboard-focus]');if(!field||field.tagName==='TEXTAREA')return;const fields=[...form.querySelectorAll('[data-stip-keyboard-focus]')].filter(x=>!x.disabled&&x.type!=='hidden');const i=fields.indexOf(field);if(i<0)return;e.preventDefault();if(!field.reportValidity())return;const next=fields[i+1];if(next){next.focus();return}form.requestSubmit?.(form.querySelector('[type="submit"]'))},true);
})();