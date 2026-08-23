(()=>{'use strict';
const s=document.createElement('style');
s.textContent=`
.rhub-apps{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px 10px!important;margin:0 10px 18px!important;align-items:start!important}
.rhub-app{min-height:0!important;padding:0 4px!important;border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;text-align:center!important;color:#0d4257!important}
.rhub-icon{width:68px!important;height:68px!important;flex:0 0 68px!important;border-radius:19px!important;display:grid!important;place-items:center!important;font-size:1.7rem!important;box-shadow:0 8px 18px rgba(13,66,87,.13)!important;border:1px solid rgba(255,255,255,.72)!important}
.rhub-app strong{display:block!important;max-width:142px!important;margin:0 auto!important;font-size:.88rem!important;line-height:1.13!important;font-weight:900!important;color:#123f50!important;text-align:center!important;white-space:normal!important}
@media(max-width:380px){.rhub-apps{gap:12px 8px!important;margin-inline:6px!important}.rhub-icon{width:62px!important;height:62px!important;flex-basis:62px!important;border-radius:17px!important;font-size:1.55rem!important}.rhub-app strong{font-size:.82rem!important;max-width:128px!important}}
`;
document.head.appendChild(s);
})();