(()=>{'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-calendar',STORE='stip_session_v1';
let overlay=null;
function allowed(){return !!(window.STIPBootCache?.permissions?.calendriers||window.STIPSession?.permissions?.calendriers)}
async function feed(kind){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':localStorage.getItem(STORE)||''},body:JSON.stringify({kind})}),j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw Error(j.error||'Abonnement indisponible');return j}
function close(){overlay?.remove();overlay=null}
function choice(kind,icon,title,small,cls){return `<button class="cal-choice ${cls}" data-cal-kind="${kind}"><span>${icon}</span><div><strong>${title}</strong><small>${small}</small></div><b>›</b></button>`}
function modal(){
  close();
  overlay=document.createElement('div');overlay.className='cal-overlay';
  overlay.innerHTML=`<div class="cal-sheet"><div class="cal-grab"></div><header><div><small>STIP</small><h2>Calendriers</h2></div><button data-cal-close aria-label="Fermer">×</button></header><p class="cal-intro">Choisis les calendriers que tu veux ajouter à ton téléphone. Tu t’abonnes une seule fois : les changements sont ensuite récupérés automatiquement.</p><div class="cal-grid">${choice('personal','▦','Mon planning','Mes shifts et horaires personnels','personal')}${choice('team','👥','Esprit d’équipe','Présents et répartition de mon équipe','team')}${choice('formations','🎓','Formations','Formations prévues et informations utiles','formations')}${choice('stagiaires','🧑‍🎓','Stagiaires','Périodes, horaires et référents','stagiaires')}</div><div class="cal-status" aria-live="polite"></div><p class="cal-foot">La fréquence exacte de mise à jour dépend de l’application calendrier utilisée sur le téléphone.</p></div>`;
  document.body.appendChild(overlay);
  overlay.onclick=e=>{if(e.target===overlay||e.target.closest('[data-cal-close]')){close();return}const b=e.target.closest('[data-cal-kind]');if(b)subscribe(b.dataset.calKind,b)}
}
async function copyFallback(j,s){try{await navigator.clipboard.writeText(j.https_url);s.textContent='Lien d’abonnement copié.'}catch{s.innerHTML=`Lien prêt : <a href="${j.https_url}" target="_blank" rel="noopener">ouvrir</a>`}}
async function subscribe(kind,b){
  const s=overlay?.querySelector('.cal-status');b.disabled=true;if(s)s.textContent='Préparation de l’abonnement…';
  try{
    const j=await feed(kind);if(s)s.textContent='Ouverture du calendrier…';
    location.href=j.webcal_url;
    setTimeout(()=>{if(!s||!overlay)return;s.innerHTML='Si rien ne s’ouvre sur Android, <button class="cal-copy" type="button">copier le lien d’abonnement</button>.';s.querySelector('.cal-copy')?.addEventListener('click',()=>copyFallback(j,s))},1200)
  }catch(e){if(s)s.textContent=e.message||'Impossible de créer l’abonnement.'}finally{b.disabled=false}
}
function addHome(){
  const grid=document.querySelector('.cp-tools-grid.cp-door-grid');if(!grid)return;
  const old=grid.querySelector('[data-cal-hub]');
  if(!allowed()){old?.remove();return}
  if(old)return;
  const b=document.createElement('button');b.className='cp-tool cp-door cp-calendar';b.dataset.calHub='1';b.innerHTML='<span class="cp-tool-icon">▦</span><span class="cp-tool-copy"><strong>Calendriers</strong><small>Planning · Équipe · Formations · Stagiaires</small></span><b>›</b>';b.onclick=modal;grid.appendChild(b)
}
function removePlanningButtons(){document.querySelectorAll('#planningView [data-cal-hub],#planningView .cal-context').forEach(x=>x.remove())}
function scan(){addHome();removePlanningButtons()}
new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
window.addEventListener('stip:session-ready',()=>setTimeout(scan,20));
window.addEventListener('stip:boot-updated',()=>setTimeout(scan,20));
window.STIPCalendars={open:modal};
setTimeout(scan,100);
const st=document.createElement('style');st.textContent=`.cal-overlay{position:fixed;inset:0;z-index:9999;background:rgba(6,24,38,.42);display:flex;align-items:flex-end;justify-content:center;padding:12px}.cal-sheet{width:min(560px,100%);max-height:calc(100dvh - 24px);overflow:auto;background:#f8fcfd;border-radius:28px;padding:8px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -16px 50px rgba(0,0,0,.18);color:#103f50}.cal-grab{width:42px;height:5px;border-radius:99px;background:#c7d5da;margin:2px auto 12px}.cal-sheet header{display:flex;align-items:center;justify-content:space-between}.cal-sheet header small{font-weight:900;letter-spacing:.12em;color:#0798b5}.cal-sheet h2{margin:1px 0 0;font-size:1.7rem}.cal-sheet header button{border:0;background:#e8f0f2;width:38px;height:38px;border-radius:50%;font-size:1.5rem;color:#345b68}.cal-intro,.cal-foot{color:#607983;line-height:1.35}.cal-intro{margin-bottom:12px}.cal-foot{font-size:.75rem;margin-bottom:0}.cal-grid{display:grid;grid-template-columns:1fr;gap:8px}.cal-choice{width:100%;display:grid;grid-template-columns:48px 1fr 24px;align-items:center;gap:10px;text-align:left;border:1px solid #d9e7ea;background:#fff;border-radius:19px;padding:11px;color:#103f50}.cal-choice>span{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;color:#fff;font-size:1.2rem}.cal-choice.personal>span{background:#1688d3}.cal-choice.team>span{background:#6e55d8}.cal-choice.formations>span{background:#2d9d78}.cal-choice.stagiaires>span{background:#d98a2b}.cal-choice strong,.cal-choice small{display:block}.cal-choice strong{font-size:1rem}.cal-choice small{margin-top:3px;color:#70858d}.cal-choice>b{font-size:1.5rem}.cal-choice:disabled{opacity:.62}.cal-status{min-height:22px;margin-top:10px;text-align:center;font-size:.82rem;font-weight:800;color:#17708a}.cal-copy{border:0;background:none;text-decoration:underline;color:inherit;font:inherit}.cp-calendar .cp-tool-icon{background:linear-gradient(145deg,#1688d3,#6e55d8)!important;color:#fff!important;display:grid;place-items:center;font-size:1.25rem}@media(min-width:620px){.cal-grid{grid-template-columns:1fr 1fr}}`;document.head.appendChild(st)
})();