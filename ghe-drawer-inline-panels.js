(() => {
"use strict";
if(window.GHEDrawerPanels)return;
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const drawer=()=>document.getElementById("gheSmartRail");
const mode=()=>window.GHESmartDrawer?.mode?.()||"closed";
const entries=()=>window.GHESmartDrawer?.entries?.()||[];
const dateLabel=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||"")?new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}):"";
const headings={pending:"À traiter",date:"Rendez-vous du jour",rdv:"Mes rendez-vous",create:"Créer ou proposer",
 chat:"Messages",settings:"Réglages",apps:"Applications",carpool:"Covoiturage",hub:"À traiter et activités",
 past:"Rendez-vous passés",proposals:"Propositions des collègues",activities:"Sorties et activités",detail:"Détails"};
let panel=null,key="",anchor=null,context=null,items=[],back="";
function datasetItems(){
 if(key==="pending")return (entries().find(x=>x.kind==="pending")?.items||[]).map(x=>({...x}));
 if(key==="date"||key==="rdv")return entries().filter(x=>x.kind!=="pending"&&(key!=="date"||x.date===context?.date));
 if(key==="settings")return [
  {icon:"🔔",title:"Notifications",sub:"Mes alertes et leurs règles",action:"notification-settings"},
  {icon:"👤",title:"Mon compte",sub:"Profil et préférences",href:"mon-compte.html"}
 ];
 if(key==="apps")return window.GHESmartDrawer?.applications?.()||[];
 if(key==="detail"){
  const target=context?.source;
  return target?[{title:target.querySelector(".ghe-smart-name")?.textContent?.trim()||"Ouvrir",
   sub:target.querySelector(".ghe-smart-sub")?.textContent?.trim()||"",
   iconHtml:target.querySelector(".ghe-smart-icon")?.innerHTML||"",
   href:target.getAttribute("href"),source:target,date:target.dataset.choiceDate,
   entryKind:target.dataset.smartEntryKind,id:target.dataset.smartEntryId,action:target.dataset.smartAction}]:[];
 }
 return (window.GHESmartChoices?.entriesFor?.(key)||[]).map(x=>({
  title:x.name,sub:x.description,icon:x.icon,date:x.date,choice:x
 }));
}
function ensure(){
 if(panel)return panel;
 panel=document.createElement("section");
 panel.id="gheSmartDrawerPanel";
 panel.className="ghe-global-search-panel ghe-smart-side-panel";
 panel.setAttribute("role","region");
 panel.setAttribute("aria-label","Contenu du tiroir GHE");
 panel.hidden=true;document.body.appendChild(panel);
 panel.addEventListener("click",event=>{
  if(event.target.closest("[data-side-close]")){event.preventDefault();close();return;}
  if(event.target.closest("[data-side-back]")){
   event.preventDefault();const target=back||"hub";back="";open(target,anchor,null,true);return;
  }
  const button=event.target.closest("[data-side-index]");
  if(!button)return;
  event.preventDefault();
  const item=items[Number(button.dataset.sideIndex)];if(!item)return;
  if(item.choice){
   const dest=item.choice.key;
   if(["hub","create","chat","carpool","past","proposals","activities","pending"].includes(dest)){
    back=key;open(dest,anchor,null,true);return;
   }
   close();window.GHESmartChoices?.choose?.(item.choice);return;
  }
  close();
  if(item.action==="notification-settings"){window.GHENotificationControls?.openSettings?.();return;}
  if(item.source&&window.GHESmartDrawer?.openDestination?.(item.source))return;
  if(item.entryKind&&window.STIPDrawerOpenEntry?.(item.entryKind,item.id))return;
  if(item.action&&window.STIPDrawerOpenAction?.(item.action))return;
  if(item.href){
   window.GHESmartDrawer?.setMode?.("compact");
   if(window.STIPNav?.go)window.STIPNav.go(item.href);
   else location.assign(new URL(item.href,location.href).href);
  }
 });
 return panel;
}
function paint(){
 const box=ensure();items=datasetItems();
 const title=key==="date"?dateLabel(context?.date):key==="detail"?(items[0]?.title||"Détails"):(headings[key]||"Mon espace GHE");
 let lastDate="";
 const rows=items.map((item,i)=>{
  const label=dateLabel(item.date);
  const sep=label&&item.date!==lastDate?'<div class="ghe-smart-side-date">'+esc(label)+'</div>':"";
  lastDate=item.date||"";
  const icon=item.iconHtml||(item.iconSrc?'<img src="'+esc(item.iconSrc)+'" alt="">':esc(item.icon||"📌"));
  return sep+'<button type="button" class="ghe-smart-side-row" data-side-index="'+i+'">'+
   '<span class="ghe-smart-side-icon" aria-hidden="true">'+icon+'</span>'+
   '<span class="ghe-smart-side-copy"><strong>'+esc(item.title||"Consulter")+'</strong>'+
   (item.sub?'<small>'+esc(item.sub)+'</small>':"")+'</span>'+
   '<span class="ghe-smart-side-chevron" aria-hidden="true">›</span></button>';
 }).join("");
 box.innerHTML='<header class="ghe-smart-side-head"><div><small>MON ESPACE GHE</small><h2>'+esc(title)+'</h2></div>'+
  '<button type="button" data-side-close aria-label="Fermer le panneau">×</button></header>'+
  '<div class="ghe-smart-side-content">'+(rows||'<p class="ghe-global-help">Aucun élément pour le moment.</p>')+'</div>'+
  (back?'<button type="button" class="ghe-smart-side-back" data-side-back>‹ Retour</button>':"");
}
function close(){
 key="";anchor=null;context=null;items=[];back="";
 if(panel)panel.hidden=true;
 if(anchor?.isConnected&&anchor.hasAttribute("aria-expanded"))anchor.setAttribute("aria-expanded","false");
 window.GHESmartDrawer?.selectIcon?.("");
 window.GHEGlobalSearch?.sync?.();
}
function open(next,source,details=null,nested=false){
 if(!drawer()||mode()==="closed")return;
 const same=key===next&&anchor===source&&(next!=="date"||context?.date===details?.date);
 if(same&&!nested){close();return;}
 key=next;anchor=source;context=details;
 if(anchor?.hasAttribute("aria-expanded"))anchor.setAttribute("aria-expanded","true");
 if(!nested)back="";
 window.GHESmartDrawer?.selectIcon?.(source?.dataset.smartActiveKey||next);
 paint();sync(true);
}
function sync(focus=false){
 if(!panel)return;
 const rail=drawer();
 if(!key||!rail||mode()==="closed"){panel.hidden=true;if(mode()==="closed"){key="";anchor=null;context=null;items=[];back="";}return;}
 let target=anchor?.isConnected?anchor:null;
 if(!target){
  const id=key==="date"?"date:"+(context?.date||""):key;
  target=[...rail.querySelectorAll("[data-smart-active-key]")].find(el=>el.dataset.smartActiveKey===id);
 }
 if(!target){panel.hidden=true;return;}
 const expanded=mode()==="expanded";
 if(expanded){if(panel.previousElementSibling!==target)target.after(panel);}
 else if(panel.parentElement!==document.body)document.body.appendChild(panel);
 panel.classList.toggle("is-expanded",expanded);panel.hidden=false;
 if(!expanded){
  const r=target.getBoundingClientRect();
  panel.style.top=Math.max(8,Math.min(innerHeight-155,r.top))+"px";
 }else panel.style.top="";
 const search=document.getElementById("gheSmartGlobalSearch");
 if(search)search.hidden=true;
 if(focus)panel.querySelector("[data-side-close]")?.focus({preventScroll:true});
}
function preserve(){if(panel?.parentElement!==document.body&&panel)document.body.appendChild(panel);}
const originalSearch=window.GHEGlobalSearch;
if(originalSearch){
 const oldToggle=originalSearch.toggle,oldSync=originalSearch.sync,oldPreserve=originalSearch.preserveBeforeRender;
 originalSearch.toggle=(...args)=>{if(key)close();return oldToggle(...args);};
 originalSearch.sync=(...args)=>{oldSync(...args);sync();};
 originalSearch.preserveBeforeRender=(...args)=>{preserve();return oldPreserve(...args);};
}
document.addEventListener("click",event=>{
 if(key&&mode()==="compact"&&!event.target.closest("#gheSmartRail,#gheSmartDrawerPanel"))close();
});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&key){event.preventDefault();event.stopImmediatePropagation();close();}});
window.addEventListener("resize",()=>sync());
for(const signal of ["ghe:smart-agenda-updated","stip:home-rendered","stip:event-feedback-synced","stip:permissions-live"]){
 window.addEventListener(signal,()=>{if(key){paint();sync();}});
}
window.addEventListener("stip:session-ended",()=>{close();panel?.remove();panel=null;});
window.GHEDrawerPanels={open,close,sync,preserve};
})();