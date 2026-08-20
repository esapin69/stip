(() => {
  'use strict';
  const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data';
  const STORAGE='stip_session_v1';
  const clean=v=>String(v??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').trim();
  const digits=v=>String(v||'').replace(/\D/g,'');
  async function loadAll(){
    const token=localStorage.getItem(STORAGE)||'';
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify({action:'contacts'})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw new Error(j.error||`Erreur ${r.status}`);
    return {people:j.people||[],services:j.services||[]};
  }
  function personCard(p){
    const first=clean(p.prenom),last=clean(p.nom),name=clean([p.prenom,p.nom].filter(Boolean).join(' ')||p.alias||'Contact GHE');
    return ['BEGIN:VCARD','VERSION:3.0',`N:${last};${first};;;`,`FN:${name}`,p.role_metier?`TITLE:${clean(p.role_metier)}`:'',p.telephone?`TEL;TYPE=CELL:${digits(p.telephone)}`:'',p.email_pro?`EMAIL;TYPE=WORK:${clean(p.email_pro)}`:'',p.ghe?`ORG:GHE;${clean(p.ghe)}`:'',p.alias?`NOTE:${clean('Alias : '+p.alias)}`:'','END:VCARD'].filter(Boolean).join('\r\n');
  }
  function serviceCard(s){
    const name=clean(s.service||'Service GHE');
    const notes=[s.poste_interne?`Poste / DECT : ${s.poste_interne}`:'',s.remarque||''].filter(Boolean).join(' · ');
    return ['BEGIN:VCARD','VERSION:3.0',`N:${name};;;;`,`FN:${name}`,`ORG:GHE${s.site?';'+clean(s.site):''}`,s.telephone_externe?`TEL;TYPE=WORK,VOICE:${digits(s.telephone_externe)}`:'',s.email?`EMAIL;TYPE=WORK:${clean(s.email)}`:'',notes?`NOTE:${clean(notes)}`:'','END:VCARD'].filter(Boolean).join('\r\n');
  }
  function download(file){
    const url=URL.createObjectURL(file),a=document.createElement('a');
    a.href=url;a.download=file.name;a.style.display='none';document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},3000);
  }
  async function exportAll(button){
    const strong=button.querySelector('strong');
    const original='Partager tous les contacts';
    try{
      button.disabled=true;if(strong)strong.textContent='Préparation de tout l’annuaire…';
      const {people,services}=await loadAll();
      const cards=[...people.filter(p=>p.nom||p.prenom||p.telephone||p.email_pro).map(personCard),...services.filter(s=>s.service||s.telephone_externe||s.email||s.poste_interne).map(serviceCard)];
      if(!cards.length)throw new Error('Annuaire vide');
      const file=new File([cards.join('\r\n')+'\r\n'],'Annuaire-GHE-complet.vcf',{type:'text/vcard'});
      let shared=false;
      if(navigator.share){
        try{
          if(!navigator.canShare||navigator.canShare({files:[file]})){
            await navigator.share({files:[file],title:'Annuaire GHE complet'});shared=true;
          }
        }catch(e){if(e?.name==='AbortError')return;}
      }
      if(!shared){download(file);if(strong)strong.textContent='Fichier VCF téléchargé';}
    }catch(e){
      if(strong)strong.textContent='Téléchargement impossible';
      console.error('Export annuaire VCF',e);
    }finally{
      button.disabled=false;setTimeout(()=>{if(strong)strong.textContent=original},2200);
    }
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest('#shareAllContacts');if(!button)return;
    e.preventDefault();e.stopImmediatePropagation();exportAll(button);
  },true);
})();