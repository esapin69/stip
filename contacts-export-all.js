(() => {
  'use strict';
  const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data';
  const STORAGE='stip_session_v1';
  const clean=v=>String(v??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').trim();
  const digits=v=>String(v||'').replace(/\D/g,'');
  const isAndroid=/Android/i.test(navigator.userAgent||'');
  async function loadAll(){
    const token=localStorage.getItem(STORAGE)||'';
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify({action:'contacts'})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw new Error(j.error||`Erreur ${r.status}`);
    return {people:j.people||[],services:j.services||[]};
  }
  function gheLabel(v){
    const raw=String(v||'').trim();
    const m=raw.match(/(\d+)/);
    return m?m[1]:raw.replace(/^GHE\s*/i,'').trim();
  }
  function displayName(p){
    const ghe=gheLabel(p.ghe);
    const first=String(p.prenom||'').trim().toUpperCase();
    const last=String(p.nom||'').trim().toLowerCase();
    const parts=[];
    if(ghe){parts.push('Ghe',ghe)}
    if(first)parts.push(first);
    if(last)parts.push(last);
    if(!first&&!last&&p.alias)parts.push(String(p.alias).trim());
    return parts.join(' • ');
  }
  function personCard(p){
    const name=clean(displayName(p)||'Contact GHE');
    return ['BEGIN:VCARD','VERSION:3.0',`N:${name};;;;`,`FN:${name}`,p.role_metier?`TITLE:${clean(p.role_metier)}`:'',p.telephone?`TEL;TYPE=CELL:${digits(p.telephone)}`:'',p.email_pro?`EMAIL;TYPE=WORK:${clean(p.email_pro)}`:'',p.ghe?`ORG:GHE;${clean(p.ghe)}`:'',p.alias?`NOTE:${clean('Alias : '+p.alias)}`:'','END:VCARD'].filter(Boolean).join('\r\n');
  }
  function serviceCard(s){
    const base=String(s.service||'Service GHE').trim();
    const site=gheLabel(s.site);
    const name=clean([site?'Ghe':'',site,base.toUpperCase()].filter(Boolean).join(' • '));
    const notes=[s.poste_interne?`Poste / DECT : ${s.poste_interne}`:'',s.remarque||''].filter(Boolean).join(' · ');
    return ['BEGIN:VCARD','VERSION:3.0',`N:${name};;;;`,`FN:${name}`,`ORG:GHE${s.site?';'+clean(s.site):''}`,s.telephone_externe?`TEL;TYPE=WORK,VOICE:${digits(s.telephone_externe)}`:'',s.email?`EMAIL;TYPE=WORK:${clean(s.email)}`:'',notes?`NOTE:${clean(notes)}`:'','END:VCARD'].filter(Boolean).join('\r\n');
  }
  function download(file){
    const url=URL.createObjectURL(file),a=document.createElement('a');
    a.href=url;a.download=file.name;a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},5000);
  }
  async function exportAll(button){
    const strong=button.querySelector('strong');
    const original='Partager tous les contacts';
    try{
      button.disabled=true;if(strong)strong.textContent='Préparation de tout l’annuaire…';
      const {people,services}=await loadAll();
      const cards=[...people.filter(p=>p.nom||p.prenom||p.telephone||p.email_pro).map(personCard),...services.filter(s=>s.service||s.telephone_externe||s.email||s.poste_interne).map(serviceCard)];
      if(!cards.length)throw new Error('Annuaire vide');
      const content=cards.join('\r\n')+'\r\n';
      const file=new File([content],'Annuaire-GHE-complet.vcf',{type:'text/vcard'});

      if(isAndroid){
        download(file);
        if(strong)strong.textContent='VCF téléchargé — ouvre-le dans Contacts';
        return;
      }

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
      button.disabled=false;setTimeout(()=>{if(strong)strong.textContent=original},3000);
    }
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest('#shareAllContacts');if(!button)return;
    e.preventDefault();e.stopImmediatePropagation();exportAll(button);
  },true);
})();