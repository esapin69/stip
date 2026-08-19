(() => {
'use strict';
const PDF_API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-pdf';
const STORAGE='stip_session_v1';

async function openLivePdf(month){
  const token=localStorage.getItem(STORAGE)||'';
  if(!token){alert('Reconnecte-toi à STIP avant de générer le PDF.');location.href='index.html';return;}
  const label=document.getElementById('printNow');
  const old=label?.textContent;
  if(label) label.textContent='Création du PDF…';
  try{
    const r=await fetch(PDF_API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify({month})});
    if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||`Erreur ${r.status}`)}
    const blob=await r.blob();
    const url=URL.createObjectURL(blob);
    const w=window.open(url,'_blank','noopener');
    if(!w) location.href=url;
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){alert(e?.message||String(e))}
  finally{if(label&&old)label.textContent=old}
}

document.addEventListener('click',e=>{
  const t=e.target instanceof Element?e.target.closest('#printNow'):null;
  if(!t)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const now=new Date();
  openLivePdf(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
},true);
})();
