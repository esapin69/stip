(() => {
"use strict";
if (window.GHESmartDrawer) return;
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure";
const STORE="stip_session_v1", STATE="ghe_smart_drawer_mode_v1";
const escapeHtml=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dlabel=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||""))return "";return new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});};
const dateMin=e=>(Array.isArray(e.dates)?e.dates:[]).filter(d=>d>=today()).sort()[0]||"9999-12-31";
const permitted=()=>Boolean(localStorage.getItem(STORE))&&(!document.getElementById("homeView")||getComputedStyle(document.getElementById("homeView")).display!=="none");
const isAdmin=()=>Boolean(window.STIPBootCache?.permissions?.admin===true || window.STIPSession?.permissions?.admin===true || window.STIPBootCache?.agent?.is_admin===true);
let events=[],running=null,updated=0,ready=false,mode="compact",rail=null,requestSeq=0,appointments=null;
try{const saved=localStorage.getItem(STATE);if(saved==="closed")mode="closed";}catch{}
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
 const expand=rail?.querySelector('[data-ctrl="expand"]');
 if(expand)expand.setAttribute("aria-label",mode==="expanded"?"Réduire le tiroir aux icônes":"Déployer les titres et sous-titres");
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
  const unanswered=!!event.invitation_status&&!event.is_organizer&&ds.some(d=>choose(d)==="neutral")&&event.invitation_status!=="declined";
  if(unanswered)needs.push({date:ds.find(d=>choose(d)==="neutral")||ds[0],id:event.id,title:event.title});
  const selected=event.is_organizer?ds:ds.filter(d=>choose(d)==="yes");
  for(const d of selected)rows.push({kind:"event",icon:event.icon||"📌",title:event.title||"Activité",date:d,
   sub:[dlabel(d),event.time_label||"",event.location||""].filter(Boolean).join(" · "),
   href:urlForEvent(event),event});
 }
 const source=window.STIPDrawerAppointments?.();
 if(source?.groups){
  for(const item of (source.groups.find(g=>g.key==="upcoming")?.items||[])){
   if(item.kind!=="future"||!item.date||item.date<now)continue;
   rows.push({kind:"professional",icon:/formation/i.test(item.title)?"🎓":/visite|médecin|médical/i.test(item.title)?"🏥":"📅",
    title:item.title,date:item.date,sub:[dlabel(item.date),item.time,item.place].filter(Boolean).join(" · "),href:route("home"),id:item.id});
  }
  for(const item of (source.groups.find(g=>g.key==="feedback")?.items||[])){
   rows.push({kind:"professional-action",icon:"📋",title:item.title||"Action professionnelle",
    date:item.date||now,sub:"Retour professionnel attendu · ouvrir les notifications GHE",
    href:route("notifications"),id:item.id});
  }
 }
 const unique=new Map();for(const r of rows)unique.set(r.kind+":"+(r.event?.id||r.id||r.title)+":"+r.date,r);
 const entries=[...unique.values()];
 if(needs.length){needs.sort((a,b)=>a.date.localeCompare(b.date));entries.push({kind:"pending",icon:"📥",title:"À traiter",
   date:needs[0].date,sub:needs.length+" action"+(needs.length>1?"s":"")+" en attente · "+dlabel(needs[0].date),
   href:route("agenda"),count:needs.length});}
 return entries.sort((a,b)=>a.date.localeCompare(b.date)||Number(b.kind==="pending")-Number(a.kind==="pending")||a.title.localeCompare(b.title,"fr"));
}
function link(entry){
 const icon=entry.kind==="pending"?"📥":entry.icon||"📅";
 const b=entry.count?'<span class="ghe-smart-badge">'+Math.min(entry.count,99)+'</span>':"";
 return '<a class="ghe-smart-link" href="'+escapeHtml(entry.href)+'" title="'+escapeHtml(entry.title+" — "+entry.sub)+
 '" aria-label="'+escapeHtml(entry.title+" : "+entry.sub)+'"><span class="ghe-smart-icon" aria-hidden="true">'+
 (entry.title==='Fauteuils'?'<img src="images/icone_app/home-access-wheelchairs.webp" alt="">':escapeHtml(icon))+b+'</span><span class="ghe-smart-labels"><strong class="ghe-smart-name">'+escapeHtml(entry.title)+
 '</strong><small class="ghe-smart-sub">'+escapeHtml(entry.sub)+'</small></span></a>';
}
function staticLink(icon,title,sub,key,iconImage=false){
 const symbol=iconImage?'<img src="images/icone_app/home-access-wheelchairs.webp" alt="">':escapeHtml(icon);
 return link({kind:"shortcut",icon:symbol,title,sub,href:route(key)});
}
function render(){
 if(!permitted()){document.body.classList.remove("ghe-smart-active");rail?.remove();rail=null;document.getElementById("gheSmartReopen")?.remove();return;}
 document.body.classList.add("ghe-smart-active");
 if(!rail){rail=document.createElement("aside");rail.id="gheSmartRail";rail.className="ghe-smart-rail";rail.setAttribute("aria-label","Tiroir de navigation GHE");document.body.appendChild(rail);}
 let entries=groupedEntries(),start=entries.map(link).join("")||'<p class="ghe-smart-hint">Aucun rendez-vous à venir</p>';
 const shortcuts=[["♿","Fauteuils","Chat des fauteuils","wheelchairs"],["💬","Communication","Messages et groupes","communication"],["🎉","On se retrouve","Créer une activité","leisure"],["🔔","Notifications","Messages importants","notifications"],["👥","Collègues","Annuaire des agents","colleagues"],["🧭","Visite des lieux","Services et étages","places"],["📱","Application GHE","Installation","app"]]
 .filter(x=>!(x[3]==="wheelchairs"&&window.STIPBootCache?.permissions?.messages===false));
 const admin=isAdmin()?[["🔐","Gérer les accès","Rôles et raccourcis","access"],["🧹","Contrôle du système","Inventaire et nettoyage","inventory"]]:[];
 rail.innerHTML='<header class="ghe-smart-head"><button type="button" class="ghe-smart-toggle" data-ctrl="close" aria-label="Fermer complètement le tiroir">×</button>'+
 '<span class="ghe-smart-expanded-label">Mon espace GHE</span><button type="button" class="ghe-smart-toggle" data-ctrl="expand" aria-label="Déployer les titres">☰</button></header>'+
 '<div class="ghe-smart-scroll"><nav aria-label="Rendez-vous chronologiques">'+start+'</nav>'+
 '<div class="ghe-smart-divider"><span>Raccourcis</span></div><nav aria-label="Raccourcis GHE">'+shortcuts.map(x=>staticLink(...x)).join("")+'</nav>'+
 (admin.length?'<div class="ghe-smart-divider"><span>Administration</span></div><nav aria-label="Administration">'+admin.map(x=>staticLink(...x)).join("")+'</nav>':"")+
 '</div><footer class="ghe-smart-foot"><input type="search" class="ghe-smart-search" aria-label="Chercher un raccourci ou un rendez-vous" placeholder="Rechercher dans le tiroir…">'+
 '<button type="button" class="ghe-smart-toggle" data-ctrl="close" aria-label="Fermer totalement le tiroir">×</button></footer>';
 let reopen=document.getElementById("gheSmartReopen");
 if(!reopen){reopen=document.createElement("button");reopen.id="gheSmartReopen";reopen.type="button";reopen.className="ghe-smart-reopen";reopen.textContent="☰";reopen.setAttribute("aria-label","Afficher les icônes du tiroir");document.body.appendChild(reopen);}
 setMode(mode);
}
async function refresh(force=false){
 if(!permitted())return;
 const current=store();if(!current)return;
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
  finally{running=null}
 })();
 return running;
}
document.addEventListener("click",event=>{
 const reopen=event.target.closest?.("#gheSmartReopen");
 if(reopen){event.preventDefault();setMode("compact");return;}
 const trigger=event.target.closest?.("[data-shortcuts-open]");
 if(trigger&&permitted()){
  event.preventDefault();event.stopImmediatePropagation();setMode(mode==="expanded"?"compact":"expanded");return;
 }
 const button=event.target.closest?.("#gheSmartRail [data-ctrl]");
 if(!button)return;
 const ctrl=button.dataset.ctrl;
 if(ctrl==="close")setMode("closed");
 if(ctrl==="expand")setMode(mode==="expanded"?"compact":"expanded");
 if(ctrl==="home")location.href=route("home");
},true);
document.addEventListener("input",event=>{
 if(!event.target.matches?.("#gheSmartRail .ghe-smart-search"))return;
 const q=event.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
 for(const el of rail.querySelectorAll(".ghe-smart-link")){
  const hay=(el.getAttribute("aria-label")||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  el.hidden=!!q&&!hay.includes(q);
 }
});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&mode==="expanded"){setMode("compact");event.stopPropagation();}});
window.addEventListener("stip:leisure-updated",()=>{if(permitted())render()});
window.addEventListener("stip:session-ready",()=>{render();refresh(true)});
window.addEventListener("stip:session-ended",()=>{events=[];ready=false;render()});
window.addEventListener("stip:boot-updated",()=>{render();refresh()});
window.addEventListener("pageshow",()=>{render();refresh()});
window.addEventListener("storage",event=>{if(event.key===STORE){events=[];ready=false;render();refresh(true)}});
window.addEventListener("ghe:agenda-change",()=>refresh(true));
window.GHESmartDrawer={refresh,events:()=>events,entries:groupedEntries,mode:()=>mode,setMode};
const start=()=>{render();refresh();setInterval(()=>{if(document.visibilityState==="visible")refresh()},90000)};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
