(() => {
'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data',STORAGE='stip_session_v1';
const esc=v=>String(v??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').trim();
const digits=v=>String(v||'').replace(/\D/g,'');
async function loadAll(){const token=localStorage.getItem(STORAGE)||'';const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify({action:'contacts'})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||`Erreur ${r.status}`);return{people:j.people||[],services:j.services||[]}}
function ghe(v){const s=String(v||'').trim(),m=s.match(/\d+/);return m?m[0]:s.replace(/^GHE\s*/i,'').trim()}
function personName(p){return ['Ghe',ghe(p.ghe),String(p.prenom||'').trim().toUpperCase(),String(p.nom||'').trim().toLowerCase()].filter(Boolean).join(' • ')}
function personCard(p){const label=esc(personName(p)||p.alias||'Contact GHE');return ['BEGIN:VCARD','VERSION:3.0',`N:${label};;;;`,`FN:${label}`,`SORT-STRING:${label}`,p.role_metier?`TITLE:${esc(p.role_metier)}`:'',p.telephone?`TEL;TYPE=CELL:${digits(p.telephone)}`:'',p.email_pro?`EMAIL;TYPE=WORK:${esc(p.email_pro)}`:'',p.ghe?`ORG:GHE;${esc(p.ghe)}`:'','END:VCARD'].filter(Boolean).join('\r\n')}
function serviceCard(s){const label=esc(['Ghe',ghe(s.site),String(s.service||'Service').trim()].filter(Boolean).join(' • '));const note=[s.poste_interne?`Poste / DECT : ${s.poste_interne}`:'',s.remarque||''].filter(Boolean).join(' · ');return ['BEGIN:VCARD','VERSION:3.0',`N:${label};;;;`,`FN:${label}`,`SORT-STRING:${label}`,s.telephone_externe?`TEL;TYPE=WORK:${digits(s.telephone_externe)}`:'',s.email?`EMAIL;TYPE=WORK:${esc(s.email)}`:'',note?`NOTE:${esc(note)}`:'','END:VCARD'].filter(Boolean).join('\r\n')}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},10000)}
async function nativeShare(content,name){
  if(!navigator.share)return false;
  const candidates=[
    new File([content],name,{type:'text/vcard'}),
    new File([content],name,{type:'text/x-vcard'}),
    new File([content],name,{type:'application/octet-stream'})
  ];
  for(const file of candidates){
    try{
      if(navigator.canShare&&!navigator.canShare({files:[file]}))continue;
      await navigator.share({title:'Annuaire GHE',text:'Contacts GHE',files:[file]});
      return true;
    }catch(e){
      if(e?.name==='AbortError')throw e;
    }
  }
  return false;
}
async function run(button){const strong=button.querySelector('strong'),original='Partager tous les contacts';try{button.disabled=true;if(strong)strong.textContent='Préparation du partage…';const {people,services}=await loadAll();const cards=[...people.filter(p=>p.nom||p.prenom||p.telephone||p.email_pro).map(personCard),...services.filter(s=>s.service||s.telephone_externe||s.email||s.poste_interne).map(serviceCard)];if(!cards.length)throw Error('Annuaire vide');const name='Annuaire-GHE-complet.vcf',content=cards.join('\r\n')+'\r\n';const shared=await nativeShare(content,name);if(shared){if(strong)strong.textContent='Choisis Messages';return}const blob=new Blob([content],{type:'text/vcard'});download(blob,name);if(strong)strong.textContent='Android refuse le partage — fichier téléchargé'}catch(e){if(e?.name!=='AbortError'&&strong)strong.textContent='Partage impossible';console.error(e)}finally{button.disabled=false;setTimeout(()=>{if(strong)strong.textContent=original},3500)}}
document.addEventListener('click',e=>{const b=e.target.closest('#shareAllContacts');if(!b)return;e.preventDefault();e.stopImmediatePropagation();run(b)},true);
})();