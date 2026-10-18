(() => {
 "use strict";
 if(window.GHEChoiceMaster)return;
 let modal=null,source=null,replay=false;
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const niceDate=s=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s||""))return "";
  const [y,m,d]=s.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(y,m-1,d,12));
 };
 function eligible(el){
  if(!el||el.disabled||el.closest("[inert],[aria-disabled='true'],#gheChoiceMasterDialog"))return false;
  // La maison est une exception explicite : aucun popup avant retour à l’accueil.
  if(el.closest("#gheSmartRail,#gheSmartDrawerPanel,#gheSmartGlobalSearch"))return false;
  if(el.closest("dialog:not(#gheSmartPendingDialog),[role='dialog'][aria-modal='true']"))return false;
  if(el.matches("#homeView button[data-app],#homeView button[data-home-mode]"))return true;
  if(!el.matches("a[href]")||el.hasAttribute("download")||el.target==="_blank")return false;
  const href=el.getAttribute("href")||"";
  if(!href||(href.startsWith("#")&&!href.startsWith("#/"))||/^(mailto:|tel:|sms:|javascript:|data:|blob:)/i.test(href))return false;
  try{return new URL(href,location.href).origin===location.origin;}catch{return false;}
 }
 function ensure(){
  if(modal?.isConnected)return modal;
  modal=document.getElementById("gheChoiceMasterDialog")||document.createElement("dialog");
  modal.id="gheChoiceMasterDialog";
  if(!modal.isConnected)document.body.appendChild(modal);
  modal.addEventListener("click",e=>{if(e.target===modal)modal.close();});
  modal.addEventListener("close",()=>source?.isConnected&&source.focus?.({preventScroll:true}));
  return modal;
 }
 const fact=(key,value)=>value?'<div class="ghe-choice-fact"><dt>'+esc(key)+'</dt><dd>'+esc(value)+'</dd></div>':"";
 function open(target){
  const d=ensure();
  if(d.open)d.close();
  source=target;
  const title=(target.querySelector(".ghe-smart-name")?.textContent?.trim()||
   target.querySelector("strong")?.textContent?.trim()||
   target.getAttribute("aria-label")?.trim()||target.textContent?.trim()||"Accéder").slice(0,130);
  const summary=target.querySelector(".ghe-smart-sub")?.textContent?.trim()||target.getAttribute("title")?.trim()||"";
  // Preserve the specific event icon in the master detail, not only its date.
  const iconHtml=target.querySelector(".ghe-smart-icon")?.innerHTML||"";
  const kind=target.dataset.choiceKind||target.dataset.smartEntryType||(target.dataset.app?"application":target.dataset.homeMode?"rubrique":"navigation");
  const status=kind==="cancelled"?"Annulé":kind==="event"?"Événement confirmé":kind==="professional"?"Rendez-vous prévu":kind==="pending"?"Réponse attendue":kind==="application"?"Application":kind==="rubrique"?"Rubrique GHE":kind==="shortcut"?"Raccourci":"À consulter";
  const facts=fact("Date",niceDate(target.dataset.choiceDate))+fact("Horaire",target.dataset.choiceTime)+fact("Lieu",target.dataset.choicePlace);
  const proceed=kind==="event"?"Voir l’événement":kind==="professional"?"Voir le rendez-vous":kind==="cancelled"?"Ouvrir l’agenda":kind==="application"?"Ouvrir l’application":kind==="rubrique"?"Afficher la rubrique":"Accéder";
  d.innerHTML='<section class="ghe-choice-frame"><header class="ghe-choice-header"><span class="ghe-choice-kicker">GHE · INFORMATION ET CHOIX</span>'+
   '<button type="button" data-choice-close class="ghe-choice-close" aria-label="Fermer">×</button></header>'+
   '<div class="ghe-choice-main"><div class="ghe-choice-identity">'+
   (iconHtml?'<span class="ghe-choice-icon" aria-hidden="true">'+iconHtml+'</span>':"")+
   '<h2 id="gheChoiceTitle">'+esc(title)+'</h2></div>'+
   '<span class="ghe-choice-status" data-kind="'+esc(kind)+'">'+esc(status)+'</span>'+
   (facts?'<dl class="ghe-choice-facts">'+facts+'</dl>':"")+
   (summary?'<p class="ghe-choice-summary">'+esc(summary)+'</p>':"")+'</div>'+
   '<footer class="ghe-choice-actions"><button type="button" data-choice-close>Fermer</button>'+
   '<button type="button" data-choice-go class="ghe-choice-primary">'+esc(proceed)+' →</button></footer></section>';
  d.setAttribute("aria-labelledby","gheChoiceTitle");d.showModal();
 }
 function continueClick(){
  const el=source;if(!el)return;
  modal?.close();
  // The master button continues through the same handler for every drawer source.
  // Never replay the original click: it could open another popup or navigate twice.
  if(el.closest("#gheSmartRail,#gheSmartRdvDialog,#gheSmartPendingDialog")&&el.matches("a[href]")){
   window.GHESmartDrawer?.setMode?.("compact");
   if(window.GHESmartDrawer?.openDestination?.(el))return;
   if(window.STIPNav?.go)window.STIPNav.go(el.href);
   else location.assign(el.href);
   return;
  }
  replay=true;
  try{el.click();}finally{replay=false;}
 }
 document.addEventListener("click",event=>{
  if(event.target.closest?.("#gheChoiceMasterDialog [data-choice-close]")){event.preventDefault();modal?.close();return;}
  if(event.target.closest?.("#gheChoiceMasterDialog [data-choice-go]")){event.preventDefault();continueClick();return;}
  if(replay||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  if(!document.body.classList.contains("ghe-smart-active"))return;
  const entry=event.target.closest?.("a[href],#homeView button[data-app],#homeView button[data-home-mode]");
  if(!eligible(entry))return;
  event.preventDefault();event.stopImmediatePropagation();open(entry);
 },true);
 window.GHEChoiceMaster={open};
})();
