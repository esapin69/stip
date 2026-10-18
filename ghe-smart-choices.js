(() => {
"use strict";
if(window.GHESmartChoices)return;
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dlabel=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||"")?new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}):"";
let modal=null,view="hub",items=[];
const groupData=()=>window.STIPDrawerAppointments?.()?.groups||[];
const future=(key)=>groupData().find(g=>g.key===key)?.items||[];
const menu=()=>window.GHESmartDrawer?.entries?.()||[];
const row=(icon,name,description,key,count)=>({icon,name,description,key,count});
const card=(item,index)=>'<button type="button" class="ghe-choice-hub-item" data-ghe-choice-item="'+index+'">'+
 '<span class="ghe-choice-hub-icon" aria-hidden="true">'+esc(item.icon||"📅")+'</span>'+
 '<span class="ghe-choice-hub-copy"><strong>'+esc(item.name)+'</strong><small>'+esc(item.description||"")+'</small></span>'+
 (item.count>0?'<span class="ghe-choice-hub-count">'+item.count+'</span>':"")+'<span class="ghe-choice-hub-next" aria-hidden="true">›</span></button>';
function navigate(url){if(!url)return;location.assign(new URL(url,location.href).href);}
function choose(item){
 if(item.key==="hub"||item.key==="create"||item.key==="chat"||item.key==="carpool"||item.key==="past"||item.key==="proposals"||item.key==="activities"||item.key==="pending"){
  show(item.key);return;
 }
 if(modal?.open)modal.close();
 if(item.key==="feedback"){if(!window.STIPDrawerOpenEntry?.("feedback",item.id))navigate("index.html#/home");return;}
 if(item.key==="leisure"){
  try{if(typeof window.STIPLeisure?.openPreview==='function'){window.STIPLeisure.openPreview(item.id);return;}}catch{}
  navigate("sorties-loisirs.html?tab=invitations");return;
 }
 if(item.key==="business-action"){navigate(item.href);return;}
 const routes={
  createPerson:"agent-directory.html",activity:"sorties-loisirs.html?tab=create",
  driver:"sorties-loisirs.html?tab=trips&choice=driver",
  passenger:"sorties-loisirs.html?tab=trips&choice=passenger",
  messages:"index.html?quick=communication&tab=dm#/communication/dm",
  eventChats:"sorties-loisirs.html?tab=agenda",
  wheelchairs:"index.html?quick=communication&tab=fauteuils#/communication/fauteuils"
 };
 navigate(routes[item.key]||item.href||"");
}
function entriesFor(key){
 const pending=menu().find(x=>x.kind==="pending");
 const activities=menu().filter(x=>x.kind==="event");
 const feedback=future("feedback"),proposals=future("proposals");
 if(key==="hub")return [
  row("📋","Actions à traiter","Demandes à effectuer, triées par date","pending",pending?.count||0),
  row("📅","Rendez-vous passés","Retours professionnels à clôturer","past",feedback.length),
  row("📩","Propositions des collègues","Invitations et sorties à confirmer","proposals",proposals.length),
  row("🎉","Sorties et activités","Activités confirmées et conversations liées","activities",activities.length)
 ];
 if(key==="create")return [
  row("👤","Créer un événement pour quelqu’un","Choisir la personne puis son agenda","createPerson"),
  row("🎉","Proposer une activité","Créer une proposition et inviter les collègues","activity"),
  row("🚗","Proposer un covoiturage","Préciser si tu disposes d’une voiture","carpool")
 ];
 if(key==="carpool")return [
  row("🚙","J’ai ma voiture","Proposer un trajet et des places","driver"),
  row("🙋","Je n’ai pas la voiture","Consulter les trajets et demander une place","passenger")
 ];
 if(key==="chat")return [
  row("💬","Discussions collègues","Mes messages et conversations d’équipe","messages"),
  row("🎉","Discussions des événements","Chats liés aux activités","eventChats"),
  row("♿","Fauteuils","Messages et alertes fauteuils","wheelchairs")
 ];
 if(key==="past")return feedback.map(x=>({...row(x.icon||"📋",x.title,[dlabel(x.date),x.time,x.place].filter(Boolean).join(" · "),"feedback"),id:String(x.id||"")}));
 if(key==="proposals")return proposals.map(x=>({...row(x.icon||"🎉",x.title,[dlabel(x.date),x.time,x.place].filter(Boolean).join(" · "),"leisure"),id:String(x.id||"")}));
 if(key==="activities")return activities.map(x=>({...row(x.icon||"🎉",x.title,x.sub||dlabel(x.date),"business-action"),href:x.href}));
 if(key==="pending")return (pending?.items||[]).map(x=>({...row(x.icon||"📋",x.title,[dlabel(x.date),x.sub].filter(Boolean).join(" · "),"business-action"),href:x.href}));
 return [];
}
function ensure(){
 if(modal?.isConnected)return modal;
 modal=document.getElementById("gheSmartChoiceDialog")||document.createElement("dialog");
 modal.id="gheSmartChoiceDialog";
 if(!modal.isConnected)document.body.appendChild(modal);
 modal.addEventListener("click",event=>{
  if(event.target===modal||event.target.closest?.("[data-ghe-choice-close]")){modal.close();return;}
  if(event.target.closest?.("[data-ghe-choice-back]")){show("hub");return;}
  const target=event.target.closest?.("[data-ghe-choice-item]");
  if(!target)return;
  const item=items[Number(target.dataset.gheChoiceItem)];
  if(item)choose(item);
 });
 return modal;
}
function show(key="hub"){
 if(!document.body.classList.contains("ghe-smart-active"))return;
 view=key;items=entriesFor(key);
 const labels={hub:"À traiter et activités",create:"Créer ou proposer",carpool:"Covoiturage",chat:"Choisir une discussion",
  pending:"Actions à traiter",past:"Rendez-vous passés",proposals:"Invitations en attente",activities:"Sorties et activités"};
 const d=ensure();
 d.innerHTML='<section class="ghe-choice-hub-frame"><header><div><small>GHE · MES CHOIX</small><h2 id="gheSmartChoiceTitle">'+esc(labels[key]||"Mes choix")+'</h2></div>'+
  '<button type="button" data-ghe-choice-close aria-label="Fermer">×</button></header>'+
  '<div class="ghe-choice-hub-list">'+(items.length?items.map(card).join(""):'<p class="ghe-choice-hub-empty">Aucun élément pour le moment.</p>')+'</div>'+
  (["pending","past","proposals","activities","carpool"].includes(key)?'<footer><button type="button" data-ghe-choice-back>‹ Tous les choix</button></footer>':"")+'</section>';
 d.setAttribute("aria-labelledby","gheSmartChoiceTitle");
 if(!d.open)d.showModal();
}
document.addEventListener("click",event=>{
 const button=event.target.closest?.("#gheSmartRail [data-smart-hub-open],#gheSmartRail [data-smart-create-open],#gheSmartRail [data-smart-chat-open]");
 if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 show(button.hasAttribute("data-smart-hub-open")?"hub":button.hasAttribute("data-smart-create-open")?"create":"chat");
},true);
window.GHESmartChoices={show};
})();