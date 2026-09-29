(()=>{'use strict';

const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-planning-pdf';
const STORE='stip_session_v1';
const MONTHS=['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];

function currentMonth(){
  const strong=document.querySelector('.ph-month-card header strong');
  const small=document.querySelector('.ph-month-card header small');
  const label=String(strong?.textContent||'').trim().toUpperCase();
  const year=Number(String(small?.textContent||'').trim())||new Date().getFullYear();
  const idx=MONTHS.indexOf(label);
  return {year,month:idx>=0?idx+1:new Date().getMonth()+1};
}

function monthKey(){
  const m=currentMonth();
  return `${m.year}-${String(m.month).padStart(2,'0')}`;
}

function statusPage(win,message,error=false){
  if(!win||win.closed)return;
  win.document.open();
  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Planning STIP</title><style>
  *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif;background:#f3f8f9;color:#123b4b}
  main{min-height:100vh;display:grid;place-items:center;padding:28px}
  section{width:min(440px,100%);padding:28px;border:1px solid #d6e7ea;border-radius:22px;background:#fff;box-shadow:0 14px 34px #123b4b14;text-align:center}
  b{display:block;font-size:1rem;color:${error?'#a83c3c':'#0d4257'}}small{display:block;margin-top:8px;color:#71858d;line-height:1.45}
  </style></head><body><main><section><b>${String(message||'')}</b><small>${error?'Le planning n\'a pas été modifié.':'Le PDF reprend le modèle cadre et les changements officiels enregistrés dans STIP.'}</small></section></main></body></html>`);
  win.document.close();
}

async function openOfficialPdf(){
  const popup=window.open('','_blank');
  if(!popup){
    alert("Autorise l'ouverture du PDF du planning.");
    return;
  }
  statusPage(popup,'Génération du planning…');
  try{
    const token=localStorage.getItem(STORE)||'';
    if(!token)throw Error('Session STIP requise.');
    const r=await fetch(API,{
      method:'POST',
      headers:{'Content-Type':'application/json','X-STIP-Session':token},
      body:JSON.stringify({month:monthKey()})
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.error||!j.url)throw Error(j.error||`Erreur ${r.status}`);
    popup.location.replace(j.url);
  }catch(e){
    statusPage(popup,e?.message||'Impossible de générer le planning.',true);
  }
}

document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-ph-print]');
  if(!b)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  openOfficialPdf();
},true);

window.STIPPlanningPdf={open:openOfficialPdf,month:monthKey};
})();