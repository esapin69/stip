(() => {
"use strict";
if (window.STIPEnsembleV3) return;
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure";
const escapeHTML=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const choices=[["⚽","Football"],["🥊","Boxe"],["🏋️","Musculation"],["🍽️","Restaurant"],["🎳","Bowling"],["🎬","Cinéma"],["🚶","Promenade"],["🎉","Sortie"]];
const dateISO=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const today=dateISO(new Date());
const fmt=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
const monthName=d=>d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
const byId=id=>document.getElementById(id);
const state={tab:new URLSearchParams(location.search).get("tab")==="trajets"?"trips":"agenda",events:[],people:[],calendar:[],trips:[],pref:null,icon:"",title:"",dates:new Set(),guests:new Set(),mode:"afterwork",visibility:"invite",month:new Date(new Date().getFullYear(),new Date().getMonth(),1),formKind:"activity",loaded:false,error:"",status:"",busy:false,details:null,editing:false};
const session=()=>{const s=localStorage.getItem("stip_session_v1");if(!s)throw Error("Connexion GHE requise.");return s;};
async function call(action,data={}){
 const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-stip-session":session()},body:JSON.stringify({action,...data})});
 const json=await r.json().catch(()=>({}));
 if(!r.ok||json.error)throw Error(typeof json.error==="string"?json.error:"Service indisponible");
 return json;
}
function message(t,error=false){state.status=t;state.error=error?t:"";const el=byId("ev3Feedback");if(el){el.textContent=t;el.classList.toggle("is-error",error)}}
function activeDates(e){return (e.visible_dates||e.dates||[]).filter(d=>d>=today)}
function concerned(e){return e.is_organizer||!!e.invitation_status||!!e.response}
function kindStatus(e){
 if(e.status==="cancelled")return ["closed","Annulé"];
 if(e.response?.declined)return ["declined","Décliné"];
 if(e.is_organizer)return ["mine","Organisé"];
 if(e.response?.selected_dates?.length)return ["confirmed","Confirmé"];
 return ["pending","À répondre"];
}
function meetingLink(e){
 const id=e.series_conversation_id;
 return id?"index.html?quick=communication&tab=dm&conversation="+encodeURIComponent(id)+"#/communication/dm":"";
}
function card(e){
 const [tone,label]=kindStatus(e),days=activeDates(e);
 return '<button type="button" class="ev3-card ev3-'+tone+'" data-ev3-open="'+escapeHTML(e.id)+'">'+
 '<span class="ev3-card-icon" aria-hidden="true">'+escapeHTML(e.icon||"📌")+'</span>'+
 '<span class="ev3-card-body"><strong>'+escapeHTML(e.title)+'</strong><small>'+escapeHTML(days.length?fmt(days[0])+(days.length>1?" · +"+(days.length-1)+" dates":""):"Aucune date à venir")+' · '+escapeHTML(e.schedule_mode==="afterwork"?"Fin du service":e.time_label||"Horaire à fixer")+'</small><small>'+escapeHTML(e.location||"Lieu à définir")+'</small></span>'+
 '<span class="ev3-chip">'+escapeHTML(label)+'</span><span aria-hidden="true">›</span></button>';
}
function chosenCards(){
 const events=state.events.filter(e=>concerned(e)&&activeDates(e).length&&e.status==="active");
 const pending=events.filter(e=>e.needs_response&&!e.is_organizer);
 const other=events.filter(e=>!pending.includes(e));
 const header='<div class="ev3-section-title"><h2>Mes rendez-vous</h2><small>'+events.length+' proposition'+(events.length>1?"s":"")+'</small></div>';
 return header+(pending.length?'<h3 class="ev3-small-title">Réponse attendue</h3><div class="ev3-stack">'+pending.map(card).join("")+'</div>':"")+
 (other.length?'<h3 class="ev3-small-title">À venir</h3><div class="ev3-stack">'+other.map(card).join("")+'</div>':"")+
 (!events.length?'<div class="ev3-empty"><span>📅</span><strong>Rien de prévu pour le moment.</strong><p>Les propositions envoyées ou reçues apparaîtront ici.</p></div>':"");
}
function tripStatus(t){
 const m={pending:"En attente",accepted:"Confirmé",declined:"Refusé",withdrawn:"Retiré"};
 return t.is_mine?"Mon trajet":m[t.my_status]||"Disponible";
}
function tripCard(t){
 const info=t.kind==="offer"?"Propose des places":"Cherche un conducteur";
 return '<article class="ev3-trip"><div class="ev3-trip-head"><span>🚗</span><strong>'+escapeHTML(info)+'</strong><small>'+escapeHTML(tripStatus(t))+'</small></div>'+
 '<p>'+escapeHTML(fmt(t.trip_date))+' · '+escapeHTML(String(t.departure_time||"").slice(0,5))+' · '+escapeHTML(t.direction==="to_work"?"Vers le travail":"Après le travail")+'</p>'+
 '<p>📍 '+escapeHTML(t.sector||"")+' · '+escapeHTML(t.organizer_name||"")+'</p>'+
 (t.note?'<p>'+escapeHTML(t.note)+'</p>':"")+
 '<div class="ev3-inline">'+
 (!t.is_mine&&!t.my_status&&t.status==="active"?'<button type="button" data-ev3-trip-act="carpool_apply" data-trip="'+escapeHTML(t.id)+'">Demander une place</button>':"")+
 (!t.is_mine&&["pending","accepted"].includes(t.my_status)?'<button type="button" data-ev3-trip-act="carpool_withdraw" data-trip="'+escapeHTML(t.id)+'">Me retirer</button>':"")+
 (t.is_mine&&t.status==="active"?'<button type="button" data-ev3-trip-act="carpool_cancel" data-trip="'+escapeHTML(t.id)+'">Annuler</button>':"")+'</div>'+
 (t.is_mine&&t.applicants?.some(a=>a.status==="pending")?'<div class="ev3-requests">'+t.applicants.filter(a=>a.status==="pending").map(a=>'<p>'+escapeHTML(a.name)+' <button type="button" data-ev3-trip-act="carpool_review" data-trip="'+escapeHTML(t.id)+'" data-peer="'+escapeHTML(a.agent_id)+'" data-decision="accepted">Accepter</button> <button type="button" data-ev3-trip-act="carpool_review" data-trip="'+escapeHTML(t.id)+'" data-peer="'+escapeHTML(a.agent_id)+'" data-decision="declined">Refuser</button></p>').join("")+'</div>':"")+'</article>';
}
function tripsHTML(){
 const p=state.pref||{opted_in:false,sector:"",has_car:false};
 return '<div class="ev3-section-title"><h2>Covoiturage</h2></div>'+
 (!p.opted_in?'<section class="ev3-panel"><p>Indique uniquement ton secteur, jamais ton adresse personnelle.</p><form id="ev3Prefs"><label>Mon secteur<input name="sector" required maxlength="80" placeholder="Lyon 8e, Bron…"></label><label class="ev3-inline"><input name="has_car" type="checkbox"> Je peux conduire</label><button type="submit" class="ev3-primary">Activer</button></form></section>':
 '<section class="ev3-trip-head"><small>Mon secteur : '+escapeHTML(p.sector||"")+'</small><button type="button" data-ev3-mode="carpool">＋ Proposer un trajet</button></section>'+
 '<div class="ev3-stack">'+(state.trips.length?state.trips.map(tripCard).join(""):'<div class="ev3-empty">Aucun trajet disponible.</div>')+'</div>');
}
function calendarHTML(){
 const first=state.month,year=first.getFullYear(),month=first.getMonth();
 const firstWeekday=(first.getDay()+6)%7,daysIn=new Date(year,month+1,0).getDate();
 const palette=new Map(state.calendar.map(x=>[x.date,x]));
 let body=["L","M","M","J","V","S","D"].map(s=>'<span class="ev3-weekday">'+s+'</span>').join("");
 for(let n=0;n<firstWeekday;n++)body+='<span></span>';
 for(let i=1;i<=daysIn;i++){
  const d=dateISO(new Date(year,month,i)),meta=palette.get(d),past=d<today,selected=state.dates.has(d);
  body+='<button type="button" '+(past?"disabled ":"")+'class="ev3-day'+(selected?" is-selected":"")+(meta?.is_working?" is-working":"")+'" data-ev3-day="'+d+'" aria-pressed="'+selected+'"><b>'+i+'</b><small>'+escapeHTML(meta?.icon||"")+'</small></button>';
 }
 return '<div class="ev3-month-nav"><button type="button" data-ev3-month="-1" aria-label="Mois précédent">‹</button><strong>'+escapeHTML(monthName(first))+'</strong><button type="button" data-ev3-month="1" aria-label="Mois suivant">›</button></div>'+
 '<div class="ev3-month-quick"><button type="button" data-ev3-all="1">✓ Tout le mois</button><button type="button" data-ev3-all="0">Tout décocher</button><small>'+state.dates.size+' jour'+(state.dates.size>1?"s":"")+'</small></div>'+
 '<div class="ev3-calendar">'+body+'</div>';
}
function peopleHTML(){
 return '<label class="ev3-search-label">Inviter des collègues <input id="ev3PeopleSearch" type="search" placeholder="Rechercher un collègue…" autocomplete="off"></label>'+
 '<div class="ev3-person-list" id="ev3PeopleList">'+peopleOptions("")+'</div><small id="ev3PeopleCount">'+state.guests.size+' sélectionné(s)</small>';
}
function peopleOptions(query){
 const q=query.trim().toLocaleLowerCase("fr");
 return state.people.filter(p=>p.name.toLocaleLowerCase("fr").includes(q)).map(p=>
 '<label class="ev3-person"><input type="checkbox" data-ev3-person="'+escapeHTML(p.id)+'" '+(state.guests.has(p.id)?"checked":"")+'><span>'+escapeHTML(p.name)+'</span></label>').join("")||'<p>Aucun collègue trouvé.</p>';
}
function formHTML(){
 if(state.formKind==="carpool"){
  const p=state.pref||{};
  return '<section class="ev3-panel"><h2>🚗 Proposer un trajet</h2><p>Un trajet, une date, un horaire.</p>'+
  '<form id="ev3CarForm"><div class="ev3-two"><label>Je souhaite<select name="kind"><option value="offer" '+(!p.has_car?"disabled":"")+' >Proposer des places</option><option value="request" '+(!p.has_car?"selected":"")+' >Chercher une place</option></select></label><label>Trajet<select name="direction"><option value="from_work">Retour du travail</option><option value="to_work">Aller au travail</option></select></label></div>'+
  '<div class="ev3-two"><label>Date<input name="date" type="date" required min="'+today+'"></label><label>Heure<input name="time" type="time" required></label></div><label>Places<select name="seats">'+[1,2,3,4,5,6].map(n=>'<option value="'+n+'">'+n+'</option>').join("")+'</select></label>'+
  '<label>Point de rendez-vous<input name="meeting_point" maxlength="200"></label><label>Précisions<textarea name="note" rows="2" maxlength="400"></textarea></label><button type="submit" class="ev3-primary">Proposer le trajet</button></form></section>';
 }
 const iconButtons=choices.map(([ic,title])=>'<button type="button" class="ev3-emoji '+(state.icon===ic?"is-selected":"")+'" data-ev3-icon="'+escapeHTML(ic)+'" aria-pressed="'+(state.icon===ic)+'" title="'+escapeHTML(title)+'">'+ic+'</button>').join("");
 return '<section class="ev3-panel"><div class="ev3-section-title"><h2>Proposer une activité</h2><button type="button" data-ev3-mode="carpool">🚗 Covoiturage ›</button></div>'+
 '<form id="ev3Compose">'+
 '<label class="ev3-form-title">1. Quelle activité ? <small>Icône obligatoire</small></label><div class="ev3-icons">'+iconButtons+'<button type="button" class="ev3-emoji ev3-custom" data-ev3-custom aria-label="Autre icône">＋</button></div>'+
 '<label>Nom ou précision <small>(facultatif)</small><input name="title" maxlength="120" placeholder="Ex. Foot à 5, resto…" value="'+escapeHTML(state.title)+'"></label>'+
 '<label class="ev3-form-title">2. Quand ?</label><div class="ev3-switch" role="group" aria-label="Choix de l’horaire">'+
 '<button type="button" class="'+(state.mode==="afterwork"?"is-active":"")+'" data-ev3-schedule="afterwork">🕔 À la fin du service</button>'+
 '<button type="button" class="'+(state.mode==="fixed"?"is-active":"")+'" data-ev3-schedule="fixed">🕒 Choisir une heure</button></div>'+
 (state.mode==="fixed"?'<label>Heure du rendez-vous<input name="time" type="time" required></label>':'<p class="ev3-hint">Chaque collègue verra uniquement les jours où sa fin de service correspond à la tienne.</p>')+
 '<label class="ev3-form-title">3. Les dates</label>'+calendarHTML()+
 '<label>Lieu <small>(facultatif)</small><input name="location" maxlength="240" placeholder="À définir ensemble"></label>'+
 '<label>Quelques précisions <small>(facultatif)</small><textarea name="description" maxlength="2000" rows="2"></textarea></label>'+
 '<label class="ev3-form-title">4. Avec qui ?</label>'+peopleHTML()+
 '<label class="ev3-inline ev3-open-team"><input type="checkbox" name="public" '+(state.visibility==="team"?"checked":"")+'> Ouvert à toute l’équipe</label>'+
 '<button type="submit" class="ev3-primary">Envoyer la proposition</button></form></section>';
}
function render(){
 const app=byId("ensembleV3");if(!app)return;
 app.innerHTML='<header class="ev3-header"><a href="index.html#/home" class="ev3-back" aria-label="Retour à GHE">‹ GHE</a><div><small>ENTRE COLLÈGUES</small><h1>Ensemble<span>.</span></h1></div><button type="button" data-ev3-refresh title="Actualiser" aria-label="Actualiser">↻</button></header>'+
 '<nav class="ev3-tabs" aria-label="Ensemble"><button type="button" class="'+(state.tab==="agenda"?"is-current":"")+'" data-ev3-tab="agenda">📅 Mes rendez-vous</button><button type="button" class="'+(state.tab==="create"?"is-current":"")+'" data-ev3-tab="create">＋ Proposer</button><button type="button" class="'+(state.tab==="trips"?"is-current":"")+'" data-ev3-tab="trips">🚗 Trajets</button></nav>'+
 '<p id="ev3Feedback" class="ev3-feedback '+(state.error?"is-error":"")+'" role="status">'+escapeHTML(state.status)+'</p>'+
 (!state.loaded?'<div class="ev3-empty">Chargement des propositions…</div>':
 state.tab==="agenda"?chosenCards():state.tab==="trips"?tripsHTML():formHTML())+
 '<dialog id="ev3Dialog" class="ev3-dialog" aria-label="Détails de l’activité"></dialog>';
 bind();
}
function bind(){
 document.querySelectorAll("[data-ev3-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.ev3Tab;state.status="";render()});
 byId("ensembleV3")?.querySelector("[data-ev3-refresh]")?.addEventListener("click",refresh);
 byId("ensembleV3")?.querySelectorAll("[data-ev3-open]").forEach(b=>b.onclick=()=>openEvent(b.dataset.ev3Open));
 byId("ensembleV3")?.querySelectorAll("[data-ev3-mode]").forEach(b=>b.onclick=()=>{state.formKind=b.dataset.ev3Mode;state.tab="create";render()});
 byId("ensembleV3")?.querySelectorAll("[data-ev3-icon]").forEach(b=>b.onclick=()=>{state.icon=b.dataset.ev3Icon;render();byId("ev3Compose")?.elements?.title?.focus()});
 byId("ensembleV3")?.querySelector("[data-ev3-custom]")?.addEventListener("click",()=>{const icon=window.prompt("Choisis une icône (emoji)","");if(icon?.trim()){state.icon=icon.trim().slice(0,12);render()}});
 byId("ensembleV3")?.querySelectorAll("[data-ev3-schedule]").forEach(b=>b.onclick=()=>{persistTitle();state.mode=b.dataset.ev3Schedule;render()});
 byId("ensembleV3")?.querySelectorAll("[data-ev3-month]").forEach(b=>b.onclick=()=>{persistTitle();state.month=new Date(state.month.getFullYear(),state.month.getMonth()+Number(b.dataset.ev3Month),1);render()});
 byId("ensembleV3")?.querySelectorAll("[data-ev3-all]").forEach(b=>b.onclick=()=>{persistTitle();const select=b.dataset.ev3All==="1";const y=state.month.getFullYear(),m=state.month.getMonth();for(let i=1;i<=new Date(y,m+1,0).getDate();i++){const d=dateISO(new Date(y,m,i));if(d<today)continue;if(select){if(state.dates.size<62)state.dates.add(d)}else state.dates.delete(d)}render()});
 byId("ensembleV3")?.querySelectorAll("[data-ev3-day]").forEach(b=>b.onclick=()=>{persistTitle();const d=b.dataset.ev3Day;if(state.dates.has(d))state.dates.delete(d);else if(state.dates.size<62)state.dates.add(d);else return message("62 dates maximum.",true);render()});
 const search=byId("ev3PeopleSearch");if(search)search.oninput=()=>{byId("ev3PeopleList").innerHTML=peopleOptions(search.value);bindPeople()};
 bindPeople();
 const f=byId("ev3Compose");if(f){f.elements.public.onchange=()=>state.visibility=f.elements.public.checked?"team":"invite";f.elements.title.oninput=()=>state.title=f.elements.title.value;f.onsubmit=submitActivity;}
 const pf=byId("ev3Prefs");if(pf)pf.onsubmit=async e=>{e.preventDefault();const b=pf.querySelector("button[type=submit]");b.disabled=true;try{const j=await call("carpool_preferences",{opted_in:true,sector:pf.elements.sector.value.trim(),has_car:pf.elements.has_car.checked});Object.assign(state,{pref:j.preference,trips:j.trips});message("Covoiturage activé.");render()}catch(err){message(err.message,true);b.disabled=false}};
 const cf=byId("ev3CarForm");if(cf)cf.onsubmit=submitTrip;
 byId("ensembleV3")?.querySelectorAll("[data-ev3-trip-act]").forEach(b=>b.onclick=async()=>{if(b.dataset.ev3TripAct==="carpool_cancel"&&!confirm("Annuler ce trajet ?"))return;b.disabled=true;try{const j=await call(b.dataset.ev3TripAct,{trip_id:b.dataset.trip,target_agent_id:b.dataset.peer,decision:b.dataset.decision});state.trips=j.trips||[];message("Trajet mis à jour.");render()}catch(err){message(err.message,true);b.disabled=false}});
}
function persistTitle(){const form=byId("ev3Compose");if(form)state.title=form.elements.title.value||""}
function bindPeople(){
 byId("ev3PeopleList")?.querySelectorAll("[data-ev3-person]").forEach(input=>input.onchange=()=>{
  if(input.checked)state.guests.add(input.dataset.ev3Person);else state.guests.delete(input.dataset.ev3Person);
  const counter=byId("ev3PeopleCount");if(counter)counter.textContent=state.guests.size+" sélectionné(s)";
 });
}
async function submitActivity(ev){
 ev.preventDefault();const f=ev.currentTarget;
 if(!state.icon)return message("Choisis obligatoirement une icône.",true);
 if(!state.dates.size)return message("Sélectionne au moins une date.",true);
 if(!state.guests.size&&state.visibility!=="team")return message("Sélectionne au moins un collègue.",true);
 const iconInfo=choices.find(v=>v[0]===state.icon);
 const title=(String(f.elements.title.value||"").trim()||iconInfo?.[1]||"Activité");
 const submit=f.querySelector('[type="submit"]');submit.disabled=true;
 try{
  const result=await call("create_ensemble",{icon:state.icon,title,dates:[...state.dates].sort(),schedule_mode:state.mode,
   time_label:state.mode==="afterwork"?"À la fin du service":f.elements.time?.value||"Horaire à définir",visibility:state.visibility,
   location:f.elements.location.value,description:f.elements.description.value,agent_ids:[...state.guests]});
  state.events=result.events||[];
  state.dates.clear();state.guests.clear();state.title="";state.icon="";state.tab="agenda";
  message("Proposition créée et invitations envoyées.");render();
 }catch(err){message(err.message,true);submit.disabled=false}
}
async function submitTrip(ev){
 ev.preventDefault();const f=ev.currentTarget,submit=f.querySelector('[type="submit"]');submit.disabled=true;
 try{const j=await call("carpool_create",{kind:f.elements.kind.value,direction:f.elements.direction.value,date:f.elements.date.value,time:f.elements.time.value,seats:Number(f.elements.seats.value),meeting_point:f.elements.meeting_point.value,note:f.elements.note.value});
 state.trips=j.trips||[];state.tab="trips";message("Trajet proposé.");render()}
 catch(err){message(err.message,true);submit.disabled=false}
}
function dialog(){
 let el=byId("ev3Dialog");if(!el){el=document.createElement("dialog");el.id="ev3Dialog";el.className="ev3-dialog";document.body.appendChild(el)}
 return el;
}
function closeModal(){const d=byId("ev3Dialog");if(d?.open)d.close()}
function openEvent(id){
 const e=state.events.find(x=>x.id===id);if(!e)return;
 const ds=activeDates(e),choice=e.response?.selected_dates||[], [tone,status]=kindStatus(e);
 const d=dialog();
 d.innerHTML='<header class="ev3-modal-head"><span class="ev3-bigicon">'+escapeHTML(e.icon||"📌")+'</span><div><strong>'+escapeHTML(e.title)+'</strong><small class="ev3-status-text ev3-'+tone+'">'+escapeHTML(status)+'</small></div><button type="button" data-ev3-close aria-label="Fermer">×</button></header>'+
 '<div class="ev3-modal-body">'+
 (e.description?'<p>'+escapeHTML(e.description)+'</p>':"")+
 '<p>📍 '+escapeHTML(e.location||"Lieu à définir")+' · '+escapeHTML(e.schedule_mode==="afterwork"?"À la fin du service":e.time_label||"Horaire à fixer")+'</p>'+
 '<section class="ev3-modal-section"><strong>Dates proposées</strong><div class="ev3-respond-dates">'+ds.map(day=>
 '<label class="ev3-date-choice"><input type="checkbox" name="dates" value="'+escapeHTML(day)+'" '+(choice.includes(day)||e.is_organizer?"checked":"")+' '+(e.is_organizer?"disabled":"")+'><span>'+escapeHTML(fmt(day))+'</span></label>').join("")+'</div></section>'+
 (e.invited_colleagues?.length?'<section class="ev3-modal-section"><strong>Invitations</strong><p>'+e.invited_colleagues.map(p=>escapeHTML(p.name)+" · "+escapeHTML(p.status)).join(" · ")+'</p></section>':"")+
 (e.participants?.length?'<section class="ev3-modal-section"><strong>Participants</strong><p>'+e.participants.map(p=>escapeHTML(p.name)).join(", ")+'</p></section>':"")+
 '<div class="ev3-modal-actions">'+
 (!e.is_organizer&&e.status==="active"?'<button type="button" class="ev3-primary" data-ev3-answer="accept">Enregistrer mes dates</button><button type="button" data-ev3-answer="decline">Décliner</button>':"")+
 (meetingLink(e)?'<a class="ev3-modal-link" href="'+escapeHTML(meetingLink(e))+'">💬 Dialogue commun</a>':"")+
 (e.can_invite?'<button type="button" data-ev3-invite>＋ Inviter</button>':"")+
 (e.can_manage?'<button type="button" data-ev3-edit>✎ Modifier</button><button type="button" data-ev3-cancel>Annuler</button>':"")+'</div>'+
 '<p class="ev3-modal-error" role="status"></p></div>';
 d.querySelector("[data-ev3-close]").onclick=closeModal;
 d.querySelectorAll("[data-ev3-answer]").forEach(b=>b.onclick=async()=>{
  const decline=b.dataset.ev3Answer==="decline",selected=[...d.querySelectorAll('input[name="dates"]:checked')].map(x=>x.value);
  if(!decline&&!selected.length){d.querySelector(".ev3-modal-error").textContent="Sélectionne au moins une date.";return}
  b.disabled=true;try{const j=await call("respond",{event_id:e.id,revision:e.revision,selected_dates:decline?[]:selected,declined:decline});state.events=j.events||[];closeModal();message("Réponse enregistrée.");render()}catch(err){d.querySelector(".ev3-modal-error").textContent=err.message;b.disabled=false}
 });
 d.querySelector("[data-ev3-invite]")?.addEventListener("click",()=>openInvite(e));
 d.querySelector("[data-ev3-edit]")?.addEventListener("click",()=>openEditor(e));
 d.querySelector("[data-ev3-cancel]")?.addEventListener("click",async()=>{if(!confirm("Annuler cette proposition pour tous les collègues ?"))return;try{const j=await call("save",{id:e.id,revision:e.revision,title:e.title,description:e.description,location:e.location,time_label:e.time_label,dates:e.dates,status:"cancelled",icon:e.icon});state.events=j.events||[];closeModal();message("Proposition annulée.");render()}catch(err){d.querySelector(".ev3-modal-error").textContent=err.message}});
 if(!d.open)d.showModal();
}
function openInvite(e){
 const d=dialog();
 d.innerHTML='<header class="ev3-modal-head"><strong>＋ Inviter à '+escapeHTML(e.title)+'</strong><button data-ev3-close type="button">×</button></header>'+
 '<div class="ev3-modal-body"><input id="ev3InviteSearch" type="search" placeholder="Rechercher un collègue"><div id="ev3InviteList" class="ev3-person-list"></div>'+
 '<button type="button" class="ev3-primary" id="ev3SendInvites">Envoyer les invitations</button><p class="ev3-modal-error"></p></div>';
 const existing=new Set((e.invited_colleagues||[]).map(x=>x.id)),selected=new Set();
 const draw=()=>{const q=(byId("ev3InviteSearch")?.value||"").toLocaleLowerCase("fr");
 byId("ev3InviteList").innerHTML=state.people.filter(p=>!existing.has(p.id)&&p.name.toLocaleLowerCase("fr").includes(q)).map(p=>
 '<label class="ev3-person"><input type="checkbox" data-person="'+escapeHTML(p.id)+'" '+(selected.has(p.id)?"checked":"")+'>'+escapeHTML(p.name)+'</label>').join("")||"<p>Aucun autre collègue.</p>";
 byId("ev3InviteList").querySelectorAll("[data-person]").forEach(x=>x.onchange=()=>x.checked?selected.add(x.dataset.person):selected.delete(x.dataset.person));
 };
 draw();byId("ev3InviteSearch").oninput=draw;d.querySelector("[data-ev3-close]").onclick=closeModal;
 byId("ev3SendInvites").onclick=async()=>{if(!selected.size)return;try{const j=await call("invite",{event_id:e.id,agent_ids:[...selected]});state.events=j.events||[];closeModal();message("Invitations ajoutées.");render()}catch(err){d.querySelector(".ev3-modal-error").textContent=err.message}};
 if(!d.open)d.showModal();
}
function openEditor(e){
 const d=dialog();
 d.innerHTML='<header class="ev3-modal-head"><strong>Modifier la proposition</strong><button type="button" data-ev3-close>×</button></header>'+
 '<form id="ev3Edit" class="ev3-modal-body"><label>Titre<input name="title" maxlength="120" required value="'+escapeHTML(e.title)+'"></label><label>Icône<input name="icon" maxlength="16" required value="'+escapeHTML(e.icon||"📌")+'"></label>'+
 '<label>Lieu<input name="location" maxlength="240" value="'+escapeHTML(e.location||"")+'"></label><label>Horaire<input name="time" maxlength="240" value="'+escapeHTML(e.time_label||"")+'" '+(e.schedule_mode==="afterwork"?"readonly":"")+'></label>'+
 '<label>Précisions<textarea name="description" rows="3" maxlength="2000">'+escapeHTML(e.description||"")+'</textarea></label><p>Les dates et les horaires compatibles restent inchangés.</p><button type="submit" class="ev3-primary">Enregistrer</button><p class="ev3-modal-error"></p></form>';
 d.querySelector("[data-ev3-close]").onclick=closeModal;
 d.querySelector("form").onsubmit=async ev=>{ev.preventDefault();const f=ev.currentTarget;
 try{const j=await call("save",{id:e.id,revision:e.revision,title:f.elements.title.value,icon:f.elements.icon.value,description:f.elements.description.value,location:f.elements.location.value,time_label:f.elements.time.value,dates:e.dates,status:e.status});state.events=j.events||[];closeModal();message("Proposition modifiée.");render()}catch(err){d.querySelector(".ev3-modal-error").textContent=err.message}};
 if(!d.open)d.showModal();
}
async function refresh(){
 try{
  const [events,calendar,peers,trips]=await Promise.allSettled([call("list"),call("calendar"),call("colleagues"),call("carpool_home")]);
  if(events.status==="rejected")throw events.reason;
  state.events=events.value.events||[];
  if(calendar.status==="fulfilled")state.calendar=calendar.value.days||[];
  if(peers.status==="fulfilled")state.people=peers.value.colleagues||[];
  if(trips.status==="fulfilled"){state.trips=trips.value.trips||[];state.pref=trips.value.preference||null}
  state.loaded=true;state.error="";state.status="";render();
 }catch(err){state.loaded=true;state.error=err.message;state.status=err.message;render()}
}
window.STIPEnsembleV3={refresh,openEvent};
document.addEventListener("DOMContentLoaded",refresh,{once:true});
window.addEventListener("pageshow",e=>{if(e.persisted)refresh()});
})();