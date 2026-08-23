(()=>{'use strict';
const p=new URLSearchParams(location.search),agentId=p.get('view_agent');if(!agentId||p.get('readonly')!=='1')return;
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-readonly',STORE='stip_session_v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showError(m){const root=document.querySelector('#homeView .hs-home')||document.body;root.innerHTML=`<div class="ro-error" style="padding:30px;text-align:center;color:#153a4a"><b>Impossible d’ouvrir le STIP de cet agent</b><p>${esc(m||'Erreur')}</p><a style="display:inline-block;margin-top:12px;color:#0b8fa7" href="responsable.html">Retour Responsable</a></div>`}
async function issueAndRedirect(){try{const session=localStorage.getItem(STORE)||'';if(!session)throw Error('Session STIP requise.');const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-STIP-Session':session},body:JSON.stringify({action:'issue_grant',agent_id:agentId})}),j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw Error(j.error||`Erreur ${r.status}`);if(!j.grant)throw Error('Laissez-passer indisponible.');location.replace(`agent-readonly.html#g=${encodeURIComponent(j.grant)}`)}catch(e){showError(e instanceof Error?e.message:String(e))}}
// Compatibilité : tout ancien lien index.html?view_agent=... est immédiatement converti
// vers la vue isolée. On ne charge plus le compte du visiteur comme identité d'affichage.
if(window.STIPSession){issueAndRedirect();return}
window.addEventListener('stip:session-ready',issueAndRedirect,{once:true});
setTimeout(()=>{if(!window.STIPSession)issueAndRedirect()},350);
})();