(() => {
"use strict";
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure";
const STORE="stip_session_v1",root=document.getElementById("gheInvitationPage");
if(!root)return;
const host=document.getElementById("gheInvitationList"),status=document.getElementById("gheInvitationStatus");
const esc = v => String(v ?? "").replace(/[&<>\x22\x27]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\x22":"&quot;", "\x27":"&#39;" }[c]));
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const fmt=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
let events=[],busy=new Set(),epoch=0,loading=false,authToken="";
function selected(event,day){
 const row=(event.date_choices||[]).find(x=>x.date===day&&x.revision===event.revision);
 if(row)return row.decision;
 if(event.response?.revision===event.revision&&event.response.selected_dates?.includes(day))return "yes";
 if(event.response?.revision===event.revision&&event.response.declined)return "no";
 return "neutral";
}
function rows(){
 const now=today(),cutoff=new Date(now+"T12:00:00");
 cutoff.setDate(cutoff.getDate()-7);
 const minPast=cutoff.toISOString().slice(0,10);
 return events.filter(e=>e.invitation_status&&!e.is_organizer&&e.invitation_status!=="withdrawn")
 .flatMap(e=>{
  const active=e.status==="active"&&e.invitation_status!=="declined"?[...new Set(e.dates||[])].filter(date=>date>=now).map(date=>({event:e,date,cancelled:false})):[];
  const cancelled=(e.date_change_history||[]).flatMap(change=>{
   const days=change.kind==="cancelled"?change.old_dates||[]:(change.old_dates||[]).filter(date=>!(change.new_dates||[]).includes(date));
   return days.filter(date=>date>=minPast).map(date=>({event:e,date,cancelled:true,change}));
  });
  return [...active,...cancelled];
 })
 .sort((a,b)=>a.date.localeCompare(b.date)||Number(b.cancelled)-Number(a.cancelled)||a.event.title.localeCompare(b.event.title,"fr"));
}
function card(e,day,cancelled=false,change=null){
 if(cancelled)return '<article class="ghe-invite-card is-cancelled"><div class="ghe-invite-top"><span class="ghe-invite-emoji">🚫</span><div><h2>'+esc(e.title)+'</h2><p>'+esc(fmt(day))+'</p><strong>ANNULÉ · ANCIENNE DATE</strong><p>'+esc(change?.kind==="date"?"La date a changé. Ton ancienne confirmation n’est plus valable.":"L’événement est annulé.")+'</p></div></div><nav class="ghe-invite-links"><a href="sorties-loisirs.html?tab=agenda&event='+encodeURIComponent(e.id)+'">Voir les nouvelles informations</a></nav></article>';
 const choice=selected(e,day),roster=e.date_roster?.[day]||[],yes=roster.filter(p=>["organizer","accepted"].includes(p.state)).length;
 const waiting=roster.filter(p=>p.state==="pending").length,refused=roster.filter(p=>p.state==="declined").length;
 const disabled=busy.has(e.id+"|"+day),blocked=(e.visible_dates||e.dates||[]).includes(day)===false||e.organizer_unavailable_dates?.includes(day);
 const action=(type,label)=>'<button type="button" data-day-decision="'+type+'" data-event="'+esc(e.id)+'" data-day="'+esc(day)+
 '" data-selected="'+(choice===type?type:"")+'" '+(disabled||(blocked&&type==="yes")?'disabled':"")+' aria-pressed="'+(choice===type)+'">'+label+'</button>';
 const chatId=e.series_conversation_id;
 const chat=chatId?'<a href="index.html?quick=communication&tab=dm&conversation='+encodeURIComponent(chatId)+'#/communication/dm">💬 Discussion</a>':"";
 const statusText=choice==="yes"?"Confirmé":choice==="no"?"Refusé":"Sans réponse";
 return '<article class="ghe-invite-card" aria-label="'+esc(e.title+" "+fmt(day))+'">'+
 '<div class="ghe-invite-top"><span class="ghe-invite-emoji" aria-hidden="true">'+esc(e.icon||"📅")+'</span><div style="flex:1"><h2>'+esc(e.title)+'</h2><p>'+
 esc(fmt(day))+' · '+esc(e.time_label||"Horaire à préciser")+'<br>'+esc(e.location||"Lieu à confirmer")+
 '<br>Organisé par '+esc(e.organizer_name||"Organisateur")+'</p></div><span class="ghe-invite-status">'+esc(statusText)+'</span></div>'+
 '<div class="ghe-invite-pills"><span class="ghe-invite-pill">✓ '+yes+' présent'+(yes>1?"s":"")+'</span>'+
 '<span class="ghe-invite-pill">◷ '+waiting+' en attente</span>'+(e.is_organizer?'<span class="ghe-invite-pill">✕ '+refused+' refus</span>':"")+'</div>'+
 '<div class="ghe-invite-actions" role="group" aria-label="Ta réponse pour le '+esc(fmt(day))+'">'+
 action("neutral","◯ Indécis")+action("yes","✓ Oui")+action("no","✕ Non")+'</div>'+
 (blocked?'<p class="ghe-invite-error">Date non compatible avec tes horaires : confirmation indisponible.</p>':"")+
 '<p class="ghe-invite-error" role="alert" data-error="'+esc(e.id+"|"+day)+'"></p>'+
 '<nav class="ghe-invite-links" aria-label="Informations du groupe">'+
 '<button type="button" data-show-roster="'+esc(e.id)+'" data-day="'+esc(day)+'">👥 Participants</button>'+
 chat+'<a href="sorties-loisirs.html?tab=agenda&event='+encodeURIComponent(e.id)+'">ℹ Détails et organisation</a></nav></article>';
}
function render(){
 const list=rows(),countPending=list.filter(r=>!r.cancelled&&selected(r.event,r.date)==="neutral").length;
 status.textContent=countPending?countPending+" date"+(countPending>1?"s":"")+" en attente de réponse. Les autres choix restent enregistrés.":"Aucune réponse en attente.";
 if(!list.length){host.innerHTML='<p class="ghe-invite-empty">Aucune invitation à traiter pour le moment.<br>Les futures propositions apparaîtront ici automatiquement.</p>';return;}
 let month="";
 host.innerHTML=list.map(({event,date,cancelled,change})=>{
  const key=date.slice(0,7);
  const heading=key!==month?(month=key,'<h2 class="ghe-invite-month">'+new Date(date+"T12:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"})+'</h2>'):"";
  return heading+card(event,date,cancelled,change);
 }).join("");
}
async function call(action,payload={},token=authToken){
 const resp=await fetch(API,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-stip-session":token},body:JSON.stringify({action,...payload})});
 const data=await resp.json().catch(()=>({}));
 if(!resp.ok||data.error)throw Error(data.error==="DATES_MODIFIEES"?"La date a changé. Les anciennes réponses sont annulées : actualise la page.":data.error||"Enregistrement impossible.");
 return data;
}
async function load(){
 if(loading)return;
 const token=localStorage.getItem(STORE)||"";
 if(!token){status.textContent="Connexion GHE requise pour afficher tes invitations.";host.innerHTML='<p class="ghe-invite-empty"><a href="index.html">Se connecter à GHE</a></p>';return;}
 authToken=token;loading=true;
 try{const result=await call("list",{},token);if(localStorage.getItem(STORE)!==token)return;events=result.events||[];render();}
 catch(err){status.textContent="Impossible de récupérer les invitations : "+(err.message||"Service indisponible");host.innerHTML='<button type="button" data-retry>Réessayer</button>';}
 finally{loading=false}
}
async function decide(id,day,decision){
 const e=events.find(x=>x.id===id);if(!e)return;
 const key=id+"|"+day;if(busy.has(key)||selected(e,day)===decision)return;
 busy.add(key);
 const card=host.querySelector('[data-error="'+CSS.escape(key)+'"]');
 if(card)card.textContent="Enregistrement en cours…";
 host.querySelectorAll('[data-event="'+CSS.escape(id)+'"][data-day="'+CSS.escape(day)+'"]').forEach(el=>el.disabled=true);
 try{
  const next=await call("respond_day",{event_id:id,revision:e.revision,day,decision});
  if(localStorage.getItem(STORE)!==authToken)return;
  events=next.events||[];render();window.dispatchEvent(new Event("ghe:agenda-change"));
 }catch(err){
  if(card)card.textContent=err.message||"Réponse non enregistrée.";
  host.querySelectorAll('[data-event="'+CSS.escape(id)+'"][data-day="'+CSS.escape(day)+'"]').forEach(el=>el.disabled=false);
 }finally{busy.delete(key)}
}
function showRoster(id,day){
 const e=events.find(x=>x.id===id);if(!e)return;
 const persons=e.date_roster?.[day]||[];
 const dialog=document.createElement("dialog");dialog.className="ghe-invite-dialog";
 const visible=persons.filter(p=>e.is_organizer||p.state!=="declined");
 const labels={organizer:"Organisateur",accepted:"A accepté",pending:"En attente",declined:"A refusé",incompatible:"Non compatible",not_selected:"Pas inscrit",unavailable:"Indisponible"};
 dialog.innerHTML='<h2>👥 '+esc(e.title)+'</h2><p>'+esc(fmt(day))+'</p>'+
 (visible.map(p=>'<div class="ghe-invite-person"><strong>'+esc(p.name)+'</strong><small>'+esc(labels[p.state]||"À préciser")+'</small></div>').join("")||'<p>Pas de participants disponibles.</p>')+
 '<p><button type="button" data-close>Fermer</button></p>';
 dialog.querySelector("[data-close]").onclick=()=>dialog.close();
 dialog.addEventListener("close",()=>dialog.remove(),{once:true});
 document.body.appendChild(dialog);dialog.showModal();
}
host.addEventListener("click",ev=>{
 const b=ev.target.closest("button");if(!b)return;
 if(b.dataset.dayDecision)decide(b.dataset.event,b.dataset.day,b.dataset.dayDecision);
 if(b.dataset.showRoster)showRoster(b.dataset.showRoster,b.dataset.day);
 if(b.dataset.retry!==undefined)load();
});
window.addEventListener("pageshow",load);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")load()});
load();
})();
