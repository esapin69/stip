(()=>{'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access';
const STORE='stip_session_v1';
const DEST='https://admin-ghe.esapin.com/depot.html';
let allowed=false,busy=false;
const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 14v5h14v-5"/></svg>';
async function read(){if(busy)return;busy=true;try{const token=localStorage.getItem(STORE)||'';if(!token){allowed=false;sync();return}const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify({action:'me'})}),j=await r.json().catch(()=>({}));allowed=!!(r.ok&&!j.error&&j.permissions?.file_upload);sync()}catch{allowed=false;sync()}finally{busy=false}}
function sync(){document.querySelectorAll('[data-cp-file-upload]').forEach(x=>{if(!allowed)x.remove()});if(!allowed)return;const grid=document.querySelector('.cp-tools-grid');if(!grid||grid.querySelector('[data-cp-file-upload]'))return;const b=document.createElement('button');b.className='cp-tool cp-file_upload';b.type='button';b.dataset.cpFileUpload='1';b.innerHTML=`<span class="cp-tool-icon">${icon}</span><span><strong>Déposer des fichiers</strong><small>Envoyer un fichier ou un dossier</small></span><b>›</b>`;b.onclick=()=>{location.href=DEST};grid.appendChild(b)}
new MutationObserver(()=>sync()).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('stip:session-ready',read);window.addEventListener('stip:session-ended',()=>{allowed=false;sync()});
if(localStorage.getItem(STORE))read();
})();