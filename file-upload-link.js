(()=>{'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access';
const STORE='stip_session_v1';
const DEST='https://admin-ghe.esapin.com/depot.html';
let allowed=false,busy=false;
async function read(){if(busy)return;busy=true;try{const token=localStorage.getItem(STORE)||'';if(!token){allowed=false;sync();return}const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify({action:'me'})}),j=await r.json().catch(()=>({}));allowed=!!(r.ok&&!j.error&&j.permissions?.file_upload);sync()}catch{allowed=false;sync()}finally{busy=false}}
function sync(){document.querySelectorAll('[data-file-upload-entry]').forEach(x=>{if(!allowed||document.querySelector('#rhubTitle')?.textContent?.trim()!=='Outils')x.remove()});if(!allowed)return;const title=document.querySelector('#rhubTitle')?.textContent?.trim();const apps=document.querySelector('#rhubApps');if(title!=='Outils'||!apps||apps.querySelector('[data-file-upload-entry]'))return;const b=document.createElement('button');b.type='button';b.className='rhub-app';b.dataset.fileUploadEntry='1';b.innerHTML='<span class="rhub-icon">↥</span><strong>Déposer des fichiers</strong>';b.onclick=()=>{location.href=DEST};apps.appendChild(b)}
new MutationObserver(sync).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
window.addEventListener('stip:session-ready',read);window.addEventListener('stip:session-ended',()=>{allowed=false;sync()});
if(localStorage.getItem(STORE))read();
})();