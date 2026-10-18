(() => {
"use strict";
if (window.GHESmartDrawer) return;
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure";
const STORE="stip_session_v1", STATE="ghe_smart_drawer_mode_v1";
const escapeHtml=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dlabel=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||""))return "";return new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});};
const permitted=()=>Boolean(localStorage.getItem(STORE))&&(!document.getElementById("homeView")||(!document.getElementById("homeView").closest("[hidden],.hidden")&&getComputedStyle(document.getElementById("homeView")).display!=="none"));
const permissions=()=>({...window.STIPContinuity?.read?.()?.permissions,...window.STIPBootCache?.permissions,...window.STIPSession?.permissions});
const isAdmin=()=>permissions().admin===true;
let events=[],running=null,updated=0,ready=false,mode="closed",rail=null,requestSeq=0,owner="";
try{const saved=localStorage.getItem(STATE);if(saved==="compact")mode="compact";}catch{}
const store=()=>localStorage.getItem(STORE)||"";
const urlForEvent=e=>"sorties-loisirs.html?tab=agenda&event="+encodeURIComponent(e.id);
const route=(name)=>{
 const routes={home:"index.html#/home",agenda:"ghe-agenda.html",leisure:"sorties-loisirs.html?tab=agenda",
   communication:"index.html?quick=communication&tab=dm#/communication/dm",
   wheelchairs:"index.html?quick=communication&tab=fauteuils#/communication/fauteuils",
   notifications:"index.html?quick=notifications#/home",applications:"index.html#/apps",
   colleagues:"agent-directory.html",places:"places.html",planning:"index.html?quick=personal#/home",
   access:"access-manage.html",inventory:"control.html",dudy:"le-nouveau.html",app:"application-mobile.html"};
 return routes[name]||routes.home;
};
function setMode(value){
 mode=["closed","compact","expanded"].includes(value)?value:"compact";
 try{localStorage.setItem(STATE,mode)}catch{}
 document.body.dataset.smartDrawer=mode;
 if(rail){rail.dataset.mode=mode;rail.setAttribute("aria-hidden",String(mode==="closed"));}
 const expand=document.getElementById("gheSmartExpand");
 if(expand){
  expand.setAttribute("aria-label",mode==="expanded"?"Replier tout le tiroir aux icônes":"Déployer tout le tiroir");
  expand.setAttribute("aria-expanded",String(mode==="expanded"));
  expand.textContent=mode==="expanded"?"‹":"›";
 }
 rail?.toggleAttribute("inert",mode==="closed");
 document.querySelectorAll("[data-shortcuts-open]").forEach(button=>{
  button.setAttribute("aria-controls","gheSmartRail");
  button.setAttribute("aria-haspopup","false");
  button.setAttribute("aria-expanded",String(mode!=="closed"));
  button.setAttribute("aria-label",mode==="closed"?"Ouvrir le tiroir en icônes":"Fermer le tiroir");
 });
 const reopen=document.getElementById("gheSmartReopen");
 if(reopen)reopen.setAttribute("aria-label","Ouvrir le tiroir en icônes");
}
function homeDrawerSnapshot(){
 // Consume the existing home cache; no second list of professional records.
 const session=window.STIPSession||window.STIPContinuity?.read?.();
 const current=store();if(!current||!session||window.STIPPreview?.active)return null;
 const agent=session.agent||{},owner=[agent.id||agent.source_key||agent.matricule||[agent.prenom,agent.nom].filter(Boolean).join(" "),session.role_key||""].map(x=>String(x||"").trim()).join("::");
 const key="stip_home_runtime_cache_v2:"+current.slice(-16);
 try{
  const cached=JSON.parse(sessionStorage.getItem(key)||localStorage.getItem(key)||"null");
  if(cached?.version!==3||cached.session!==key||cached.owner!==owner||!Number.isFinite(Number(cached.at))||Number(cached.at)>Date.now()+60000)return null;
  return cached.drawer||null;
 }catch{return null;}
}
function groupedEntries(){
 const rows=[],now=today(),needs=[];
 const dateCutoff=new Date(now+"T12:00:00");
 dateCutoff.setDate(dateCutoff.getDate()-7);
 const minHistorical=dateCutoff.toISOString().slice(0,10);
 for(const event of events){
  for(const change of (event.date_change_history||[])){
   const affected=change.kind==="cancelled"?change.old_dates||[]:(change.old_dates||[]).filter(day=>!(change.new_dates||[]).includes(day));
   for(const day of affected.filter(day=>day>=minHistorical)){
    rows.push({kind:"cancelled",icon:"🚫",title:event.title||"Événement annulé",date:day,
     sub:dlabel(day)+" · ANNULÉ · "+(change.kind==="date"?"Ancienne date, participation invalide":"Événement annulé"),
     href:"ghe-agenda.html",event});
   }
  }
  if(event.status!=="active")continue;
  const ds=[...new Set(event.dates||[])].filter(d=>d>=now).sort();
  if(!ds.length)continue;
  const choices=event.date_choices||[];
  const choose=d=>choices.find(x=>x.date===d&&x.revision===event.revision)?.decision || (event.response?.revision===event.revision&&event.response?.selected_dates?.includes(d)?"yes":"neutral");
  // Une date d'activité n'est un rendez-vous que si l'organisateur
  // ET au moins un invité sont réellement confirmés pour CETTE date.
  // Les dates proposées par l'organisateur ne doivent jamais inonder le rail.
  const confirmed=ds.filter(day=>{
   const roster=event.date_roster?.[day];
   if(!Array.isArray(roster))return false;
   return roster.some(p=>p.state==="organizer"&&p.compatible!==false)
    &&roster.some(p=>p.state==="accepted"&&p.compatible!==false);
  });
  const selected=event.is_organizer?confirmed:confirmed.filter(day=>choose(day)==="yes");
  for(const day of selected)rows.push({kind:"event",icon:event.icon||"📌",
   title:event.title||"Activité",date:day,
   sub:[dlabel(day),event.time_label||"",event.location||""].filter(Boolean).join(" · "),
   href:urlForEvent(event),event});

  // Même moteur pour toutes les activités : les propositions non confirmées
  // et les invitations sans réponse rejoignent la seule boîte « À traiter ».
  const pendingDays=event.is_organizer?
   ds.filter(day=>!confirmed.includes(day)&&!(event.organizer_unavailable_dates||[]).includes(day)):
   event.invitation_status&&event.invitation_status!=="declined"&&event.invitation_status!=="withdrawn"?
    ds.filter(day=>choose(day)==="neutral"):
    [];
  for(const day of pendingDays){
   const isOrganizer=!!event.is_organizer;
   needs.push({
    kind:"leisure",id:String(event.id)+":"+day,date:day,
    title:event.title||"Activité",icon:event.icon||"📅",
    sub:[isOrganizer?"En attente de participants":"Invitation à confirmer",
     event.time_label||"Horaire à préciser",event.location||""].filter(Boolean).join(" · "),
    href:isOrganizer?urlForEvent(event):
     "ghe-agenda.html?event="+encodeURIComponent(event.id)+"&date="+encodeURIComponent(day)
   });
  }
 }
 const source=window.STIPDrawerAppointments?.()||homeDrawerSnapshot();
 if(source?.groups){
  for(const item of (source.groups.find(g=>g.key==="upcoming")?.items||[])){
   if(item.kind!=="future"||!item.date||item.date<now)continue;
   rows.push({kind:"professional",icon:/formation/i.test(item.title)?"🎓":/visite|médecin|médical/i.test(item.title)?"🏥":"📅",
    title:item.title,date:item.date,time:item.time,place:item.place,sub:[dlabel(item.date),item.time,item.place].filter(Boolean).join(" · "),href:"agent-dates.html?focus="+encodeURIComponent(item.id),id:item.id,entryKind:"future"});
  }
  for(const item of (source.groups.find(g=>g.key==="feedback")?.items||[])){
   needs.push({kind:"professional-action",icon:"📋",id:item.id||item.title,
    title:item.title||"Retour professionnel attendu",date:item.date>=now?item.date:now,
    sub:[dlabel(item.date),"Retour à clôturer · action professionnelle"].filter(Boolean).join(" · "),href:"index.html?feedback_key="+encodeURIComponent(item.id)+"#/home",entryKind:"feedback"});
  }
 }
 // Les demandes métier (congés, signatures, accès, échanges de service)
 // rejoignent le MÊME bouton que les invitations personnelles.
 for(const action of (window.STIPDrawerActionItems?.()||homeDrawerSnapshot()?.actions||[])){
  const title=String(action.title||action.label||"Action professionnelle");
  const kind=String(action.type||action.category||"").toLowerCase();
  const icon=/cong|leave|absence|cp\b/.test(kind+" "+title.toLowerCase())?"🌴":
   /shift|échange|echange|planning/.test(kind+" "+title.toLowerCase())?"🔁":
   /sign/.test(kind+" "+title.toLowerCase())?"✍️":
   /évalu|evalu/.test(kind+" "+title.toLowerCase())?"🧾":
   /accès|acces|access/.test(kind+" "+title.toLowerCase())?"🔐":"📋";
  const date=String(action.event_date||action.due_date||action.date||"").slice(0,10);
  needs.push({kind:"professional-action",icon,id:String(action.id||title),
   title,date:/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=now?date:now,
   sub:String(action.body||action.description||"Action professionnelle en attente").slice(0,120),
   href:"index.html?quick=notifications&alert_key="+encodeURIComponent(action.id||"")+"#/home"});

 }
 const unique=new Map();for(const r of rows)unique.set(r.kind+":"+(r.event?.id||r.id||r.title)+":"+r.date,r);
 const entries=[...unique.values()];
 if(needs.length){
  // Un seul groupe, à la date de la première action attendue.
  // Les doublons provenant de plusieurs moteurs métier sont dédupliqués.
  const uniqueNeeds=new Map();
  for(const item of needs){
   const key=item.kind+":"+item.id;
   const previous=uniqueNeeds.get(key);
   if(!previous||item.date<previous.date)uniqueNeeds.set(key,item);
  }
  const items=[...uniqueNeeds.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,"fr"));
  entries.push({kind:"pending",icon:"📥",title:"À traiter",date:items[0].date,
   sub:items.length+" action"+(items.length>1?"s":"")+" en attente · "+dlabel(items[0].date),
   count:items.length,items});
 }
 return entries.sort((a,b)=>a.date.localeCompare(b.date)||Number(b.kind==="pending")-Number(a.kind==="pending")||a.title.localeCompare(b.title,"fr"));
}
// Compact rail: one real calendar date per day, not one pictogram per event.
function appointmentDays(entries){
 const dates=new Map();
 for(const entry of entries){
  if(entry.kind==="pending"||!/^\d{4}-\d{2}-\d{2}$/.test(entry.date||""))continue;
  if(!dates.has(entry.date))dates.set(entry.date,[]);
  dates.get(entry.date).push(entry);
 }
 return [...dates].sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>({date,items}));
}
function calendarIcon(date){
 return '<span class="ghe-smart-calendar-glyph" aria-hidden="true"><span class="ghe-smart-calendar-cap"></span><b>'+Number(date.slice(-2))+'</b></span>';
}
function calendarDayGroup(group){
 const count=group.items.length,label=dlabel(group.date);
 return '<section class="ghe-smart-date-group" data-smart-date-group="'+escapeHtml(group.date)+'">'+
  '<button type="button" class="ghe-smart-date-button" data-smart-date-open="'+escapeHtml(group.date)+'" aria-haspopup="dialog" aria-label="'+escapeHtml(label+" : "+count+" rendez-vous")+'">'+
  '<span class="ghe-smart-icon ghe-smart-date-icon">'+calendarIcon(group.date)+
  (count>1?'<span class="ghe-smart-date-count">×'+count+'</span>':"")+'</span>'+
  '<span class="ghe-smart-labels"><strong class="ghe-smart-name">'+escapeHtml(label)+'</strong><small class="ghe-smart-sub">'+count+' rendez-vous</small></span></button>'+
  '<div class="ghe-smart-date-details"><div class="ghe-smart-date-heading">'+calendarIcon(group.date)+
  '<span>'+escapeHtml(label)+'</span>'+(count>1?'<small>×'+count+'</small>':"")+'</div>'+
  group.items.map(link).join("")+'</div></section>';
}
function openAppointmentDay(date){
 const group=rail?.querySelector('.ghe-smart-date-group[data-smart-date-group="'+date+'"]');
 const links=[...(group?.querySelectorAll(".ghe-smart-date-details a.ghe-smart-link")||[])];
 if(!links.length)return;
 if(links.length===1){
  if(window.GHEChoiceMaster?.open)window.GHEChoiceMaster.open(links[0]);
  else openEntryDialog(links[0]);
  return;
 }
 let dialog=document.getElementById("gheSmartDayDialog");
 if(!dialog){
  dialog=document.createElement("dialog");dialog.id="gheSmartDayDialog";document.body.appendChild(dialog);
  dialog.addEventListener("click",event=>{
   if(event.target===dialog||event.target.closest?.("[data-smart-day-close]")){dialog.close();return;}
   const pick=event.target.closest?.("[data-smart-day-pick]");
   if(!pick)return;
   const target=dialog._links?.[Number(pick.dataset.smartDayPick)];
   if(!target)return;
   dialog.close();
   requestAnimationFrame(()=>window.GHEChoiceMaster?.open?window.GHEChoiceMaster.open(target):openEntryDialog(target));
  });
  dialog.addEventListener("close",()=>rail?.querySelector('.ghe-smart-date-button[data-smart-date-open="'+dialog._date+'"]')?.focus({preventScroll:true}));
 }
 if(dialog.open)dialog.close();
 dialog._date=date;dialog._links=links;
 const rows=links.map((link,index)=>{
  const name=link.querySelector(".ghe-smart-name")?.textContent?.trim()||"Rendez-vous";
  const detail=link.querySelector(".ghe-smart-sub")?.textContent?.trim()||"";
  const icon=link.querySelector(".ghe-smart-icon")?.innerHTML||"";
  return '<button type="button" class="ghe-smart-day-pick" data-smart-day-pick="'+index+'">'+
   '<span class="ghe-smart-day-item-icon">'+icon+'</span><span class="ghe-smart-day-item-text"><strong>'+escapeHtml(name)+'</strong>'+
   (detail?'<small>'+escapeHtml(detail)+'</small>':"")+'</span><span aria-hidden="true">›</span></button>';
 }).join("");
 dialog.innerHTML='<section class="ghe-smart-day-panel"><header class="ghe-smart-day-head">'+
  '<div><small>RENDEZ-VOUS DU JOUR</small><h2 id="gheSmartDayTitle">'+escapeHtml(dlabel(date))+' <span>×'+links.length+'</span></h2></div>'+
  '<button type="button" data-smart-day-close aria-label="Fermer">×</button></header>'+
  '<div class="ghe-smart-day-list">'+rows+'</div></section>';
 dialog.setAttribute("aria-labelledby","gheSmartDayTitle");dialog.showModal();
}
function link(entry){
 const isPending=entry.kind==="pending";
 const icon=entry.icon||"📅";
 const title=/^muscu$/i.test(entry.title||"")?"Séance de musculation":entry.title;
 const b=entry.count?'<span class="ghe-smart-badge">'+Math.min(entry.count,99)+'</span>':"";
 const tag=isPending?"button":"a";
 const attrs=isPending?'type="button" data-smart-pending-open aria-haspopup="dialog" aria-controls="gheSmartPendingDialog"':
  'href="'+escapeHtml(entry.href)+'"'+(entry.entryKind?' data-smart-entry-kind="'+escapeHtml(entry.entryKind)+'" data-smart-entry-id="'+escapeHtml(entry.id)+'"':'')+(entry.action?' data-smart-action="'+escapeHtml(entry.action)+'"':'')+
  (["event","professional","cancelled"].includes(entry.kind)?' data-smart-open-details="true" data-smart-entry-type="'+escapeHtml(entry.kind)+'" aria-haspopup="dialog"':'');
 const realDay=/^\d{4}-\d{2}-\d{2}$/.test(entry.date||"")?String(Number(entry.date.slice(-2))):"";
 const symbol=isPending?'<img src="images/icone_app/ghe-action-inbox.svg" alt="">':
  (entry.title==="Fauteuils"?'<img src="images/icone_app/home-access-wheelchairs.webp" alt="">':
  ((icon==="📅"||icon==="📆")?'<span class="ghe-smart-calendar-glyph" aria-hidden="true"><span class="ghe-smart-calendar-cap"></span><b>'+escapeHtml(realDay||"··")+'</b></span>':escapeHtml(icon)));
 const facts=' data-choice-kind="'+escapeHtml(entry.kind)+'"'+
  (entry.date?' data-choice-date="'+escapeHtml(entry.date)+'"':'')+
  (entry.time||entry.event?.time_label?' data-choice-time="'+escapeHtml(entry.time||entry.event.time_label)+'"':'')+
  (entry.place||entry.event?.location?' data-choice-place="'+escapeHtml(entry.place||entry.event.location)+'"':'');
 return '<'+tag+' class="ghe-smart-link'+(isPending?' ghe-smart-pending-trigger':'')+'" '+attrs+
 facts+' title="'+escapeHtml(title+" — "+entry.sub)+
 '" aria-label="'+escapeHtml(title+" : "+entry.sub)+'"><span class="ghe-smart-icon" aria-hidden="true">'+
 symbol+b+'</span><span class="ghe-smart-labels"><strong class="ghe-smart-name">'+escapeHtml(title)+
 '</strong><small class="ghe-smart-sub">'+escapeHtml(entry.sub)+'</small></span></'+tag+'>';
}

// Fenêtre maître locale : indépendante des pop-ups des pages métier.
function navigateDrawerDestination(destination){
 if(!destination)return;
 const kind=destination.dataset.smartEntryKind,id=destination.dataset.smartEntryId,action=destination.dataset.smartAction;
 const opened=kind?window.STIPDrawerOpenEntry?.(kind,id):action?window.STIPDrawerOpenAction?.(action):false;
 if(!opened){if(window.STIPNav?.go)window.STIPNav.go(destination.href);else location.assign(destination.href);}
}
function openEntryDialog(destination){
 let dialog=document.getElementById("gheSmartEntryDialog");
 if(!dialog){
  dialog=document.createElement("dialog");dialog.id="gheSmartEntryDialog";dialog.className="ghe-smart-detail-dialog";
  document.body.appendChild(dialog);
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener("close",()=>{if(dialog._source?.isConnected)dialog._source.focus({preventScroll:true});});
 }
 if(dialog.open)dialog.close();
 const title=destination.querySelector(".ghe-smart-name")?.textContent?.trim()||"Rendez-vous";
 const summary=destination.querySelector(".ghe-smart-sub")?.textContent?.trim()||"";
 const kind=destination.dataset.smartEntryType;
 const category=kind==="professional"?"Rendez-vous professionnel":kind==="cancelled"?"Événement annulé":"Événement";
 const actionLabel=kind==="professional"?"Voir le rendez-vous":kind==="cancelled"?"Ouvrir l’agenda":"Voir l’événement";
 dialog._source=destination;
 dialog.innerHTML='<div class="ghe-smart-detail-panel"><header class="ghe-smart-detail-head">'+
  '<span>'+escapeHtml(category)+'</span><button type="button" class="ghe-smart-detail-close" data-smart-details-close aria-label="Fermer la fenêtre">×</button></header>'+
  '<div class="ghe-smart-detail-copy"><h2 id="gheSmartEntryTitle">'+escapeHtml(title)+'</h2>'+
  (summary?'<p>'+escapeHtml(summary)+'</p>':'')+'</div>'+
  '<footer class="ghe-smart-detail-actions"><button type="button" data-smart-details-close>Fermer</button>'+
  '<button type="button" class="ghe-smart-detail-go" data-smart-details-go>'+escapeHtml(actionLabel)+' <span aria-hidden="true">→</span></button></footer></div>';
 dialog.setAttribute("aria-labelledby","gheSmartEntryTitle");
 dialog.showModal();
}
function openPendingDialog(){
 const group=groupedEntries().find(x=>x.kind==="pending");
 if(!group?.items?.length)return;
 let dialog=document.getElementById("gheSmartPendingDialog");
 if(!dialog){
  dialog=document.createElement("dialog");
  dialog.id="gheSmartPendingDialog";
  dialog.className="ghe-smart-pending-dialog";
  dialog.setAttribute("aria-labelledby","gheSmartPendingTitle");
  document.body.appendChild(dialog);
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener("close",()=>{rail?.querySelector("[data-smart-pending-open]")?.focus({preventScroll:true});});
 }
 const rows=group.items.map(item=>
  '<a class="ghe-smart-pending-item" href="'+escapeHtml(item.href)+'" data-choice-kind="pending" data-choice-date="'+escapeHtml(item.date)+'"'+(item.entryKind?' data-smart-entry-kind="'+escapeHtml(item.entryKind)+'" data-smart-entry-id="'+escapeHtml(item.id)+'"':'')+'>'+
   '<span class="ghe-smart-pending-item-icon" aria-hidden="true">'+escapeHtml(item.icon)+'</span>'+
   '<span class="ghe-smart-pending-item-copy"><strong>'+escapeHtml(item.title)+'</strong>'+
   '<small>'+escapeHtml(dlabel(item.date))+(item.sub?' · '+escapeHtml(item.sub):'')+'</small>'+
   '<em>'+escapeHtml(item.kind==="leisure"?"Réponse attendue":"Action à effectuer")+'</em></span>'+
   '<span class="ghe-smart-pending-chevron" aria-hidden="true">›</span></a>'
 ).join("");
 dialog.innerHTML='<div class="ghe-smart-pending-frame"><header class="ghe-smart-pending-head">'+
  '<div><small>GHE · ACTIONS EN ATTENTE</small><h2 id="gheSmartPendingTitle">À traiter <span>'+group.count+'</span></h2>'+
  '<p>Classées par date · tu peux répondre quand tu veux.</p></div>'+
  '<button type="button" data-smart-pending-close aria-label="Fermer la liste">×</button></header>'+
  '<div class="ghe-smart-pending-items">'+rows+'</div></div>';
 dialog.querySelector("[data-smart-pending-close]")?.addEventListener("click",()=>dialog.close());
 if(!dialog.open)dialog.showModal();
}
function staticLink(icon,title,sub,key,action=""){
 return link({kind:"shortcut",icon,title,sub,href:action?"index.html?drawer_action="+encodeURIComponent(action)+"#/home":route(key),action});
}
function applySearch(){
 if(!rail)return;
 const q=(rail.querySelector(".ghe-smart-search")?.value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
 let matches=0;
 for(const el of rail.querySelectorAll(".ghe-smart-scroll .ghe-smart-link")){
  const hay=(el.getAttribute("aria-label")||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  el.hidden=!!q&&!hay.includes(q);
  if(!el.hidden)matches++;
 }
 for(const group of rail.querySelectorAll(".ghe-smart-date-group")){
  const children=group.querySelectorAll?.(".ghe-smart-date-details .ghe-smart-link");
  if(children)group.hidden=!!q&&![...children].some(a=>!a.hidden);
 }
 const status=rail.querySelector("[data-smart-search-status]");
 if(status){status.hidden=!q||matches>0;status.textContent="Aucun raccourci ou rendez-vous trouvé.";}
}
function render(){
 if(!permitted()){document.body.classList.remove("ghe-smart-active");rail?.remove();rail=null;document.getElementById("gheSmartReopen")?.remove();document.getElementById("gheSmartExpand")?.remove();return;}
 document.body.classList.add("ghe-smart-active");
 if(!rail){rail=document.createElement("aside");rail.id="gheSmartRail";rail.className="ghe-smart-rail";rail.setAttribute("aria-label","Tiroir de navigation GHE");document.body.appendChild(rail);}
 // Actions séparées des rendez-vous, sans modifier les destinations.
 const entries=groupedEntries();
 const pending=entries.filter(entry=>entry.kind==="pending").map(link).join("");
 const appointments=appointmentDays(entries).map(calendarDayGroup).join("");
 const divider=appointments?'<div class="ghe-smart-divider ghe-smart-section-divider" role="separator" aria-label="Rendez-vous et événements"><span>Rendez-vous et événements</span></div>':"";
 const start=pending+divider+appointments||'<p class="ghe-smart-hint">Aucun rendez-vous à venir</p>';
 // Accueil épinglé au-dessus de la liste et visible en mode compact.
 const homeLink='<div class="ghe-smart-home-dock"><a class="ghe-smart-link ghe-smart-home" href="'+escapeHtml(route("home"))+'" data-choice-kind="shortcut" aria-label="Accueil — page principale">'+
  '<span class="ghe-smart-icon ghe-smart-home-icon" aria-hidden="true">🏠</span>'+
  '<span class="ghe-smart-labels"><strong class="ghe-smart-name">Accueil</strong><small class="ghe-smart-sub">Page principale</small></span></a></div>';
 const p=permissions();
 // Une seule destination publique non répétée dans les trois icônes de l'en-tête.
 const shortcuts=[["🎉","Sorties et activités","Proposer une activité · voir les invitations","leisure"]];
 // Outils de gestion repliés par défaut et exclusivement réservés à l'admin.
 const admin=isAdmin()?[
  ["👥","Collègues","Annuaire des agents","colleagues"],
  ["🧭","Visite des lieux","Services et étages","places"],
  ["📱","Application GHE","Installation","app"],
  ["🔐","Gérer les accès","Rôles et raccourcis","access"],
  ["🧹","Contrôle du système","Inventaire et nettoyage","inventory"]
 ]:[];
 if(isAdmin()){
  const extras=window.STIPDrawerEntries?.()||homeDrawerSnapshot()?.entries||[];
  for(const entry of extras.filter(x=>{
   if(["admin","t-door"].includes(x.action))return true;
   if(x.action==="planning")return p.planning_personal===true;
   if(x.action==="assistant")return p.dialog===true||p.assistant_enabled===true;
   return ["apps","dudy"].includes(x.action);
  }))admin.push([entry.icon,entry.title,entry.subtitle,"home",entry.action]);
 }
 const markup='<header class="ghe-smart-head">'+
 '<span class="ghe-smart-expanded-label">Mon espace GHE</span>'+
 '<button type="button" class="ghe-smart-toggle ghe-smart-close" data-ctrl="close" aria-label="Fermer complètement le tiroir">×</button></header>'+
 homeLink+
 '<div class="ghe-smart-expand-slot"><button type="button" id="gheSmartExpand" class="ghe-smart-expand-tab" aria-label="Déployer le tiroir">›</button></div>'+
 '<div class="ghe-smart-scroll"><nav aria-label="Actions et rendez-vous GHE">'+start+'</nav>'+
 (shortcuts.length?'<div class="ghe-smart-divider"><span>Loisirs entre collègues</span></div><nav aria-label="Raccourcis GHE">'+shortcuts.map(x=>staticLink(...x)).join("")+'</nav>':"")+
 (admin.length?'<details class="ghe-smart-admin-tools"><summary>Administration</summary><nav aria-label="Administration">'+admin.map(x=>staticLink(...x)).join("")+'</nav></details>':"")+
 '</div><footer class="ghe-smart-foot"><input type="search" class="ghe-smart-search" aria-label="Chercher un raccourci ou un rendez-vous" placeholder="Rechercher dans le tiroir…"><p class="ghe-smart-hint" data-smart-search-status role="status" hidden></p></footer>';
 // Keep the search input in place while background data refreshes.
 // Only the chronological lists change; focus and the native keyboard survive.
 if(!rail.querySelector(".ghe-smart-search"))rail.innerHTML=markup;
 else if(!rail.querySelector(".ghe-smart-home-dock")||!rail.querySelector(".ghe-smart-expand-slot"))rail.innerHTML=markup;
 else{
  const scroll=rail.querySelector(".ghe-smart-scroll"),previous=scroll.scrollTop,adminOpen=!!scroll.querySelector(".ghe-smart-admin-tools")?.open;
  const template=document.createElement("template");template.innerHTML=markup;
  const next=template.content.querySelector(".ghe-smart-scroll").innerHTML;
  if(scroll.innerHTML!==next){
   scroll.innerHTML=next;
   if(adminOpen)scroll.querySelector(".ghe-smart-admin-tools")?.setAttribute("open","");
  }
  scroll.scrollTop=previous;
 }
 applySearch();
 let reopen=document.getElementById("gheSmartReopen");
 if(!reopen){reopen=document.createElement("button");reopen.id="gheSmartReopen";reopen.type="button";reopen.className="ghe-smart-reopen";reopen.innerHTML='<span class="ghe-shortcuts-lines" aria-hidden="true"><i></i><i></i><i></i></span>';document.body.appendChild(reopen);}
 document.body.classList.toggle("ghe-smart-has-native-menu",!!document.querySelector("#homeView [data-shortcuts-open]"));
 // Expand control is inside the rail: no handle overlaps the page.
 document.querySelectorAll("body > #gheSmartExpand").forEach(b=>b.remove());
 setMode(mode);
}
async function refresh(force=false){
 if(!permitted())return;
 const current=store();if(!current)return;
 if(owner!==current){owner=current;events=[];updated=0;ready=false;requestSeq++;running=null;render();}
 if(running)return running;
 if(!force&&Date.now()-updated<90000&&ready)return;
 const serial=++requestSeq;
 running=(async()=>{
  try{
   const response=await fetch(API,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-stip-session":current},body:JSON.stringify({action:"list"})});
   const j=await response.json().catch(()=>({}));
   if(!response.ok||j.error||store()!==current||serial!==requestSeq)throw new Error(j.error||"Service indisponible");
   events=Array.isArray(j.events)?j.events:[];updated=Date.now();ready=true;render();
   window.dispatchEvent(new CustomEvent("ghe:smart-agenda-updated",{detail:{events}}));
  }catch(error){if(!ready)render();console.warn("Tiroir : actualisation",error.message||error)}
  finally{if(serial===requestSeq)running=null}
 })();
 return running;
}
document.addEventListener("click",event=>{
 const dateButton=event.target.closest?.("#gheSmartRail [data-smart-date-open]");
 if(dateButton){event.preventDefault();openAppointmentDay(dateButton.dataset.smartDateOpen);return;}
 const reopen=event.target.closest?.("#gheSmartReopen");
 if(reopen){event.preventDefault();setMode("compact");return;}
 const expand=event.target.closest?.("#gheSmartExpand");
 if(expand){event.preventDefault();setMode(mode==="expanded"?"compact":"expanded");return;}
 const detailDialog=document.getElementById("gheSmartEntryDialog");
 if(event.target.closest?.("#gheSmartEntryDialog [data-smart-details-close]")){
  event.preventDefault();detailDialog?.close();return;
 }
 if(event.target.closest?.("#gheSmartEntryDialog [data-smart-details-go]")){
  event.preventDefault();const dest=detailDialog?._source;detailDialog?.close();
  setMode("compact");requestAnimationFrame(()=>navigateDrawerDestination(dest));return;
 }
 const detailLink=event.target.closest?.("#gheSmartRail a[data-smart-open-details]");
 if(detailLink){event.preventDefault();openEntryDialog(detailLink);return;}
 // Tout changement de destination conserve uniquement la colonne d'icônes.
 const destination=event.target.closest?.("#gheSmartRail a.ghe-smart-link, #gheSmartPendingDialog a.ghe-smart-pending-item");
 if(destination){
  setMode("compact");
  const kind=destination.dataset.smartEntryKind,id=destination.dataset.smartEntryId;
  const action=destination.dataset.smartAction;
  const navigate=()=>{
   const opened=kind?window.STIPDrawerOpenEntry?.(kind,id):action?window.STIPDrawerOpenAction?.(action):false;
   if(!opened){if(window.STIPNav?.go)window.STIPNav.go(destination.href);else location.assign(destination.href);}
  };
  const dialog=destination.closest("#gheSmartPendingDialog");
  if(dialog?.open){
   event.preventDefault();
   // Close the history level first. An immediate dialog.close() followed by
   // an anchor navigation lets the delayed history.back() cancel that route.
   if(window.STIPOverlayNav?.close?.(dialog,navigate))return;
   dialog.close();
   requestAnimationFrame(navigate);
  }else if((kind&&window.STIPDrawerOpenEntry)||(action&&window.STIPDrawerOpenAction)){
   event.preventDefault();
   requestAnimationFrame(navigate);
  }
  return;
 }

 const trigger=event.target.closest?.("[data-shortcuts-open]");
 if(trigger&&permitted()){
  event.preventDefault();event.stopImmediatePropagation();setMode(mode==="closed"?"compact":"closed");return;
 }
 if(event.target.closest?.("#gheSmartRail [data-smart-pending-open]")){
  event.preventDefault();openPendingDialog();return;
 }
 const button=event.target.closest?.("#gheSmartRail [data-ctrl]");
 if(!button){
  if(detailDialog?.open)return;
  if(mode==="expanded"&&!document.getElementById("gheSmartPendingDialog")?.open&&!event.target.closest?.("#gheSmartRail, #gheSmartExpand")){
   setMode("compact");event.preventDefault();event.stopImmediatePropagation();
  }
  return;
 }
 const ctrl=button.dataset.ctrl;
 if(ctrl==="close")setMode("closed");
 if(ctrl==="home")location.href=route("home");
},true);
document.addEventListener("input",event=>{
 if(!event.target.matches?.("#gheSmartRail .ghe-smart-search"))return;
 applySearch();
});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&mode==="expanded"&&!document.getElementById("gheSmartEntryDialog")?.open){setMode("compact");event.stopPropagation();}});
for(const name of ["stip:leisure-updated","stip:home-rendered","stip:event-feedback-synced","stip:event-feedback-completed","stip:permissions-live","stip:session-snapshot"]){
 window.addEventListener(name,()=>{if(permitted())render()});
}
window.addEventListener("stip:session-ready",()=>{render();refresh(true)});
window.addEventListener("stip:session-ended",()=>{events=[];ready=false;owner="";updated=0;requestSeq++;running=null;document.getElementById("gheSmartPendingDialog")?.close();render()});
window.addEventListener("stip:boot-updated",()=>{render();refresh()});
window.addEventListener("pageshow",()=>{render();refresh()});
window.addEventListener("storage",event=>{if(event.key===STORE){events=[];ready=false;render();refresh(true)}});
window.addEventListener("ghe:agenda-change",()=>refresh(true));
window.GHESmartDrawer={refresh,events:()=>events,entries:groupedEntries,mode:()=>mode,setMode};
const start=()=>{render();refresh();window.STIPNav?.session?.().then(()=>render()).catch(()=>{});setInterval(()=>{if(document.visibilityState==="visible")refresh()},90000)};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
