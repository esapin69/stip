(() => {
"use strict";
if(window.STIPLeisure)return;
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure",STORE="stip_session_v1";
const e=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dateLabel=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
let events=[],owner="",busy=null,ready=false,lastFetch=0;

function visibleDates(x){return (x.visible_dates||x.dates||[]).filter(d=>d>=today())}
function concerned(x){return x.is_organizer||!!x.invitation_status||!!x.response}
function hasResponse(x){return !!x.response&&!x.response.declined&&Array.isArray(x.response.selected_dates)&&x.response.selected_dates.length>0}
function confirmedDates(x){
  const visible=visibleDates(x);
  if(x.is_organizer)return visible;
  if(!hasResponse(x)||x.response.revision!==x.revision)return [];
  return visible.filter(day=>x.response.selected_dates.includes(day));
}
function status(x){
 if(x.status==="cancelled")return ["closed","Annulé"];
 if(x.response?.declined)return ["declined","Décliné"];
 if(x.is_organizer)return ["mine","Proposé"];
 if(hasResponse(x))return ["confirmed","Confirmé"];
 return ["pending","À répondre"];
}
function iconFor(x){return String(x.icon||"📌")}
/* Une seule source de rendez-vous, réutilisée par semaine, jour et fenêtre. */
function dayItems(day){
 if(!ready||!/^\d{4}-\d{2}-\d{2}$/.test(String(day)))return [];
 return events.filter(x=>x.status==="active"&&concerned(x)&&confirmedDates(x).includes(day))
  .map(x=>{
   // L'organisateur a proposé plusieurs dates : cela ne signifie PAS qu'un collègue a accepté.
   const roster=Array.isArray(x.date_roster?.[day])?x.date_roster[day]:[];
   const attending=roster.filter(person=>person.state==="accepted").length;
   const proposed=Boolean(x.is_organizer)&&attending===0;
   const inviteeConfirmed=!x.is_organizer&&hasResponse(x)&&x.response.revision===x.revision;
   const confirmed=!proposed&&(attending>0||inviteeConfirmed);
   return {
    id:String(x.id),icon:iconFor(x),title:String(x.title||"Activité"),
    time:String(x.schedule_mode==="afterwork"?(x.visible_end_times?.[day]||x.time_label||"Après le service"):(x.time_label||"Horaire à fixer")),
    confirmed,
    stateLabel:proposed?"Proposé · réponses attendues":attending>0?attending+" participant"+(attending>1?"s":"")+" confirmé"+(attending>1?"s":""):"Participation confirmée",
    status:status(x)[1]
   };
  });
}

function cards(from,to){
 if(!ready||!from||!to)return "";
 const items=events.filter(x=>x.status==="active"&&concerned(x)&&confirmedDates(x).some(d=>d>=from&&d<=to))
 .sort((a,b)=>(confirmedDates(a).find(d=>d>=from&&d<=to)||"9999").localeCompare(confirmedDates(b).find(d=>d>=from&&d<=to)||"9999"));
 if(!items.length)return "";
 return '<section class="ev3-home-section" aria-label="Mes rendez-vous entre collègues"><div class="ev3-home-head"><strong>ENTRE COLLÈGUES · '+items.length+
 '</strong><a href="sorties-loisirs.html?tab=agenda">Tous mes rendez-vous ›</a></div><div class="ev3-home-items">'+items.slice(0,4).map(x=>{
  const [tone,indicator]=status(x),days=confirmedDates(x).filter(d=>d>=from&&d<=to);
  return '<button type="button" data-ev3-preview="'+e(x.id)+'" class="ev3-home-card ev3-'+tone+
  '"><span class="ev3-home-icon" aria-hidden="true">'+e(iconFor(x))+'</span><span class="ev3-home-copy"><strong>'+e(x.title)+
  '</strong><small>'+e(days.length?dateLabel(days[0])+(days.length>1?" · +"+(days.length-1)+" dates":""):"")+" · "+
  e(x.schedule_mode==="afterwork"?(x.visible_end_times?.[days[0]]||"Fin du service"):x.time_label||"Heure à fixer")+
  '</small></span><span class="ev3-home-state">'+e(indicator)+'</span><span aria-hidden="true">›</span></button>';
 }).join("")+'</div>'+(items.length>4?'<a class="ev3-home-more" href="sorties-loisirs.html?tab=agenda">Voir les '+(items.length-4)+' autres ›</a>':"")+'</section>';
}
function pendingHTML(){
 if(!ready)return "";
 const queue=events.filter(x=>x.status==="active"&&x.needs_response&&!x.is_organizer&&(x.dates||[]).some(d=>d>=today()));
 if(!queue.length)return "";
 return '<section class="ev3-to-answer" aria-label="Invitations à répondre"><div class="stip-section-separator ev3-to-answer-title"><span>À RÉPONDRE</span><b>'+queue.length+
 '</b></div><div class="ev3-to-answer-list">'+queue.map(x=>
 '<button type="button" class="ev3-to-answer-card" data-ev3-preview="'+e(x.id)+'"><span class="ev3-to-answer-icon">'+e(iconFor(x))+
 '</span><span><strong>'+e(x.title)+'</strong><small>'+((x.visible_dates||[]).some(d=>d>=today())?'Choisir mes dates':'Aucun horaire commun · répondre ou refuser')+
 '</small></span><b>›</b></button>').join("")+'</div></section>';
}
async function refresh(force=false){
 const token=localStorage.getItem(STORE)||"";
 if(!token){events=[];owner="";ready=false;return}
 if(owner!==token){events=[];owner=token;ready=false}
 if(busy)return busy;
 if(!force&&ready&&Date.now()-lastFetch<180000)return;
 busy=(async()=>{
  try{
   const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-stip-session":token},body:JSON.stringify({action:"list"})});
   if(!r.ok)return;
   const j=await r.json();
   if(j.error||localStorage.getItem(STORE)!==token)return;
   events=j.events||[];ready=true;lastFetch=Date.now();
   window.dispatchEvent(new Event("stip:leisure-updated"));
  }catch(err){console.warn("Ensemble calendar fetch",err)}finally{busy=null}
 })();return busy;
}
function firstLastOfMonth(key){
 if(!/^\d{4}-\d{2}$/.test(String(key)))return ["",""];
 const [y,m]=key.split("-").map(Number);if(m<1||m>12)return ["",""];
 const start=key+"-01",end=key+"-"+String(new Date(y,m,0).getDate()).padStart(2,"0");return [start,end];
}

const roleLabels={organizer:"Organisateur",accepted:"Présent",pending:"En attente",declined:"A refusé",
  not_selected:"Non inscrit",incompatible:"Horaires différents",unavailable:"Indisponible"};
const stateOrder=["organizer","accepted","pending","declined","not_selected","incompatible","unavailable"];
function datePeopleHTML(x,day){
 const rows=Array.isArray(x.date_roster?.[day])?x.date_roster[day]:[];
 const buckets=new Map();
 for(const person of rows){
  const key=roleLabels[person.state]?person.state:"pending";
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(person);
 }
 return stateOrder.filter(key=>buckets.has(key)).map(key=>
  '<div class="ev3-day-group ev3-'+key+'"><div class="stip-section-separator ev3-day-separator"><span>'+
  roleLabels[key]+' · '+buckets.get(key).length+'</span></div><div class="ev3-day-people">'+
  buckets.get(key).map(person=>'<span>'+e(person.name)+'</span>').join("")+'</div></div>').join("")||
  '<p>Aucune réponse enregistrée.</p>';
}
function dayCardHTML(x,day,selected,canAnswer){
 const roster=Array.isArray(x.date_roster?.[day])?x.date_roster[day]:[];
 const present=roster.filter(p=>p.state==="organizer"||p.state==="accepted").length;
 const waiting=roster.filter(p=>p.state==="pending").length;
 const refused=roster.filter(p=>p.state==="declined").length;
 const compatible=(x.visible_dates||x.dates||[]).includes(day);
 const blocked=(x.organizer_unavailable_dates||[]).includes(day);
 const allowed=compatible&&!blocked;
 const dateLabelFull=new Date(day+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"long"});
 return '<div class="ev3-day-card'+(allowed?"":" is-incompatible")+'">'+
 '<div class="ev3-day-top">'+
 (canAnswer?'<label class="ev3-day-checkbox"><input type="checkbox" data-ev3-day="'+e(day)+'" value="'+e(day)+'" '+
 (selected.has(day)&&allowed?'checked ':'')+(!allowed?'disabled ':'')+'><span>':'<span class="ev3-day-label">')+
 '<strong>'+e(dateLabelFull)+'</strong><small>'+(allowed?"Compatible avec tes horaires":"Horaires incompatibles ou indisponibles")+'</small></span>'+
 (canAnswer?'</label>':'')+
 '<div class="ev3-day-totals"><span title="Présents">✓ '+present+'</span><span title="Attendent une réponse">◷ '+waiting+'</span>'+
 (refused?'<span title="Ont refusé">✕ '+refused+'</span>':"")+'</div></div>'+
 '<details class="ev3-day-details"><summary>Qui vient ? Qui a répondu ? <span>⌄</span></summary>'+
 datePeopleHTML(x,day)+'</details></div>';
}
function getDialog(){
 let dialog=document.getElementById("ev3HomePreview");
 if(!dialog){dialog=document.createElement("dialog");dialog.id="ev3HomePreview";dialog.className="ev3-preview";
  document.body.appendChild(dialog);}
 return dialog;
}
async function answer(x,selected,declined,submit,error){
 if(!declined&&!selected.length){error.textContent="Sélectionne au moins une date ou refuse l'invitation.";return;}
 submit.disabled=true;
 error.textContent="Enregistrement…";
 const token=localStorage.getItem(STORE)||"";
 if(!token){error.textContent="Session expirée. Reconnecte-toi.";submit.disabled=false;return;}
 try{
  const resp=await fetch(API,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","X-STIP-Session":token},
   body:JSON.stringify({action:"respond",event_id:x.id,revision:Number(x.revision)||0,selected_dates:declined?[]:selected,declined})});
  const json=await resp.json().catch(()=>({}));
  if(!resp.ok||json.error)throw Error(json.error==="DATES_MODIFIEES"?"Les dates ont changé. Actualise la proposition.":json.error||"Enregistrement refusé.");
  events=json.events||[];owner=token;ready=true;lastFetch=Date.now();
  document.getElementById("ev3HomePreview")?.close();
  window.dispatchEvent(new Event("stip:leisure-updated"));
 }catch(ex){error.textContent=ex.message||"Impossible d'enregistrer.";submit.disabled=false;}
}
function openPreview(id){
 const x=events.find(item=>String(item.id)===String(id));if(!x)return go(id);
 const dialog=getDialog();
 const canAnswer=!!x.invitation_status&&!x.is_organizer&&x.status==="active";
 const selected=new Set((x.response?.selected_dates||[]).filter(d=>(x.visible_dates||x.dates||[]).includes(d)));
 const days=(x.dates||[]).filter(day=>day>=today());
 const dates=days.map(day=>dayCardHTML(x,day,selected,canAnswer)).join("");
 const chatId=x.series_conversation_id||x.chats?.[0]?.conversation_id||"";
 const chat=chatId?"index.html?quick=communication&tab=dm&conversation="+encodeURIComponent(chatId)+"#/communication/dm":"";
 dialog.innerHTML='<div class="ev3-dialog-head"><div><small>ACTIVITÉ · ENTRE COLLÈGUES</small><h2>'+e(iconFor(x))+' '+e(x.title)+
 '</h2><p>'+e(x.location||"Lieu à préciser")+' · '+e(x.time_label||"Horaires selon le service")+'</p></div>'+
 '<button type="button" data-ev3-close aria-label="Fermer">×</button></div>'+
 '<div class="ev3-dialog-scroll"><div class="ev3-date-intro">Dates proposées · réponses et présence par jour</div>'+
 (dates||'<p>Aucune date à venir pour cet événement.</p>')+
 '<p role="status" class="ev3-preview-error" data-ev3-error></p></div>'+
 '<div class="ev3-dialog-actions">'+
 (canAnswer?'<button type="button" class="ev3-dialog-submit" data-ev3-answer="accept">✓ Valider mes dates</button>'+
 '<button type="button" class="ev3-dialog-decline" data-ev3-answer="decline">✕ Je ne participe pas</button>':"")+
 (chat?'<a href="'+e(chat)+'" class="ev3-dialog-secondary">💬 Discussion</a>':"")+
 (x.can_invite?'<a class="ev3-dialog-secondary" href="sorties-loisirs.html?tab=agenda&event='+encodeURIComponent(id)+'">＋ Inviter / gérer les participants</a>':"")+
 '<a class="ev3-dialog-secondary" href="sorties-loisirs.html?tab=agenda&event='+encodeURIComponent(id)+'">Ouvrir toutes les options ›</a></div>';
 dialog.querySelector("[data-ev3-close]").onclick=()=>dialog.close();
 dialog.querySelectorAll("[data-ev3-answer]").forEach(button=>button.onclick=async()=>{
  const chosen=[...dialog.querySelectorAll("[data-ev3-day]:checked")].map(input=>input.value);
  await answer(x,chosen,button.dataset.ev3Answer==="decline",button,dialog.querySelector("[data-ev3-error]"));
 });
 if(!dialog.open)dialog.showModal();
}
document.addEventListener("click",event=>{
 const button=event.target.closest?.("[data-ev3-preview]");
 if(!button)return;
 event.preventDefault();
 openPreview(button.dataset.ev3Preview);
});
const go=(id="",tab="agenda")=>{location.href="sorties-loisirs.html?tab="+encodeURIComponent(tab)+(id?"&event="+encodeURIComponent(id):"")};
window.STIPLeisure={
 refresh,
 pendingHTML,
 dayItems,
 weekHTML:(start,end)=>cards(start,end),
 monthHTML:key=>{const [a,b]=firstLastOfMonth(key);return cards(a,b)},
 openEvent:id=>go(id),
 openPreview,
 openInvite:id=>go(id),
 openCreator:()=>go("","create"),
 closeCreator:()=>{},
 setTab:tab=>go("",tab==="trips"?"trips":"agenda")
};
window.addEventListener("stip:session-ready",()=>refresh(true));
window.addEventListener("stip:boot-updated",()=>refresh());
window.addEventListener("stip:session-ended",()=>{events=[];ready=false;owner="";window.dispatchEvent(new Event("stip:leisure-updated"))});
window.addEventListener("pageshow",()=>refresh());
if(document.readyState!=="loading")refresh();
else document.addEventListener("DOMContentLoaded",()=>refresh(),{once:true});
})();