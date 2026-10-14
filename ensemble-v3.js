(() => {
"use strict";
if (window.STIPEnsembleV3) return;
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure";
const escapeHTML=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const choices=[["⚽","Football"],["🥊","Boxe"],["🏋️","Musculation"],["🍽️","Restaurant"],["🎳","Bowling"],["🎬","Cinéma"],["🚶","Promenade"],["🎉","Sortie"]];
const dateISO=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const today=dateISO(new Date());
const validClock=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||""));
const fmt=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
const monthName=d=>d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
const byId=id=>document.getElementById(id);
const normalizedName=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr").trim();
const personMarkup=p=>'<span class="ev3-person-label">'+escapeHTML(p.name)+(p.can_invite===false?'<small class="ev3-person-restricted">Accès aux sorties désactivé · invitation impossible</small>':p.access_ready===false?'<small class="ev3-person-access">Accès à activer</small>':"")+'</span>';
const entryTab=new URLSearchParams(location.search).get("tab");
const state={tab:entryTab==="create"?"create":entryTab==="trajets"||entryTab==="trips"?"trips":"agenda",events:[],people:[],peopleError:"",calendar:[],trips:[],pref:null,icon:"",title:"",dates:new Set(),guests:new Set(),mode:"afterwork",visibility:"invite",month:new Date(new Date().getFullYear(),new Date().getMonth(),1),formKind:"activity",customOpen:false,time:"",place:"",details:"",loaded:false,error:"",status:"",busy:false,details:null,editing:false,form:{time:"",location:"",description:""},calendarPreviewReady:false,deepLinkOpened:false,agendaFilter:"all"};
let deepLinked=false;
const session=()=>{const s=localStorage.getItem("stip_session_v1");if(!s)throw Error("Connexion GHE requise.");return s;};
async function call(action,data={}){
 const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-stip-session":session()},body:JSON.stringify({action,...data})});
 const json=await r.json().catch(()=>({}));
 if(!r.ok||json.error){
  const codes={ICONE_REQUISE:"Choisis une icône.",DATES_INVALIDES:"Vérifie les dates sélectionnées.",CHOISIS_UN_COLLEGUE:"Choisis au moins un collègue.",AUCUNE_FIN_DE_SERVICE_SUR_CES_DATES:"Aucune fin de service disponible sur les dates choisies.",AUCUN_HORAIRE_COMMUN_AVEC_LES_COLLEGUES:"Aucune date avec une fin de service commune aux collègues sélectionnés.",HORAIRE_INCOMPATIBLE:"Une de ces dates ne correspond pas à ta fin de service.",DATES_MODIFIEES:"Cette proposition vient d’être modifiée. Actualise-la.",SESSION_EXPIREE:"Ta session a expiré. Reconnecte-toi."};
  throw Error(codes[json.error]|| (typeof json.error==="string"?json.error:"Service indisponible"));
 }
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
 if(e.visibility==="team"&&!e.invitation_status)return ["available","Disponible"];
 return ["pending","À répondre"];
}
function meetingLink(e){
 const id=e.series_conversation_id;
 return id?"index.html?quick=communication&tab=dm&conversation="+encodeURIComponent(id)+"#/communication/dm":"";
}
function card(e){
 const [tone,label]=kindStatus(e),days=activeDates(e),time=e.schedule_mode==="afterwork"?(e.visible_end_times?.[days[0]]||"Fin du service"):e.time_label||"Horaire à fixer";
 return '<button type="button" class="ev3-card ev3-'+tone+'" data-ev3-open="'+escapeHTML(e.id)+'">'+
 '<span class="ev3-card-icon" aria-hidden="true">'+escapeHTML(e.icon||"📌")+'</span>'+
 '<span class="ev3-card-body"><strong>'+escapeHTML(e.title)+'</strong><small>'+escapeHTML(days.length?fmt(days[0])+(days.length>1?" · +"+(days.length-1)+" dates":""):"Aucune date à venir")+' · '+escapeHTML(time)+'</small><small>'+escapeHTML(e.location||"Lieu à définir")+'</small></span>'+
 '<span class="ev3-chip">'+escapeHTML(label)+'</span><span aria-hidden="true">›</span></button>';
}
function chosenCards(){
 const events=state.events.filter(e=>concerned(e)&&(e.dates||[]).some(d=>d>=today)&&e.status==="active");
 if(state.agendaFilter==="invitations"){
  const invited=events.filter(e=>!!e.invitation_status||(e.is_organizer&&(e.invited_colleagues||[]).length>0));
  return '<div class="ev3-section-title"><h2>Invitations</h2><small>'+invited.length+' activité'+(invited.length>1?"s":"")+'</small></div>'+
   (invited.length?'<div class="ev3-stack">'+invited.map(card).join("")+"</div>":'<div class="ev3-empty"><strong>Aucune invitation en cours.</strong><p>Les invitations reçues et envoyées apparaîtront ici.</p></div>');
 }
 const pending=events.filter(e=>e.needs_response&&!e.is_organizer);
 const other=events.filter(e=>!pending.includes(e)&&!e.response?.declined);
 const header='<div class="ev3-section-title"><h2>Mes rendez-vous</h2><small>'+events.length+' proposition'+(events.length>1?"s":"")+'</small></div>';
 return header+(pending.length?'<h3 class="ev3-small-title">Réponse attendue</h3><div class="ev3-stack">'+pending.map(card).join("")+'</div>':"")+
 (other.length?'<h3 class="ev3-small-title">À venir</h3><div class="ev3-stack">'+other.map(card).join("")+'</div>':"")+
 (!events.length?'<div class="ev3-empty"><span>📅</span><strong>Aucun rendez-vous personnel à venir.</strong><p>Les propositions envoyées et reçues apparaîtront ici.</p></div>':"")+
 (state.events.some(e=>e.visibility==="team"&&!concerned(e)&&activeDates(e).length&&e.status==="active")?'<h3 class="ev3-small-title">Ouvert à l’équipe</h3><div class="ev3-stack">'+state.events.filter(e=>e.visibility==="team"&&!concerned(e)&&activeDates(e).length&&e.status==="active").map(card).join("")+"</div>":"");
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
  const ineligible=state.mode==="afterwork"&&(state.calendarPreviewReady?!validClock(meta?.end):meta?.is_working===false);
  const disabled=past||ineligible;
  body+='<button type="button" '+(disabled?"disabled ":"")+'class="ev3-day'+(selected?" is-selected":"")+(meta?.is_working?" is-working":"")+'" data-ev3-day="'+d+'" aria-pressed="'+selected+'" title="'+escapeHTML(ineligible?"Pas de fin de service vérifiée pour ce jour":meta?.label||"Date libre")+'"><b>'+i+'</b><small>'+escapeHTML(meta?.icon||"")+'</small></button>';
 }
 return '<div class="ev3-month-nav"><button type="button" data-ev3-month="-1" aria-label="Mois précédent">‹</button><strong>'+escapeHTML(monthName(first))+'</strong><button type="button" data-ev3-month="1" aria-label="Mois suivant">›</button></div>'+
 '<div class="ev3-month-quick"><button type="button" data-ev3-all="1">✓ Tout le mois</button><button type="button" data-ev3-all="0">Tout décocher</button><small>'+state.dates.size+' jour'+(state.dates.size>1?"s":"")+'</small></div>'+
 '<div class="ev3-calendar">'+body+'</div>';
}
function peopleHTML(){
 const unactivated=state.people.filter(p=>p.can_invite!==false&&p.access_ready===false).length;
 const restricted=state.people.filter(p=>p.can_invite===false).length;
 return '<label class="ev3-search-label">Inviter des collègues <small>'+state.people.filter(p=>p.can_invite!==false).length+' collègues invitables</small><input id="ev3PeopleSearch" type="search" placeholder="Nom ou prénom…" autocomplete="off"></label>'+
 (state.peopleError?'<p class="ev3-error">'+escapeHTML(state.peopleError)+'</p>':"")+
 '<div class="ev3-person-list" id="ev3PeopleList">'+peopleOptions("")+'</div><small id="ev3PeopleCount">'+state.guests.size+' sélectionné(s)</small>'+
 (unactivated?'<p class="ev3-directory-hint">« Accès à activer » : tu peux inviter ce collègue. Il retrouvera l’invitation lorsqu’il aura accès aux sorties.</p>':"")+
 (restricted?'<p class="ev3-directory-hint">« Accès aux sorties désactivé » : ce collègue est dans l’annuaire, mais un administrateur doit réactiver son accès avant une nouvelle invitation.</p>':"");
}
function peopleOptions(query){
 const q=normalizedName(query);
 const matches=state.people.filter(p=>normalizedName(p.name).includes(q));
 return matches.map(p=>
  '<label class="ev3-person'+(p.can_invite===false?' is-restricted':'')+'"><input type="checkbox" data-ev3-person="'+escapeHTML(p.id)+'" '+(state.guests.has(p.id)?"checked":"")+' '+(p.can_invite===false?'disabled aria-label="Invitation indisponible"':'')+'>'+personMarkup(p)+'</label>').join("")||
 (state.peopleError?'<p>Annuaire indisponible : actualise la page.</p>':'<p>Aucun collègue correspondant à cette recherche.</p>');
}
function formHTML(){
 if(state.formKind==="carpool"){
  const p=state.pref||{};
  return '<section class="ev3-panel"><h2>🚗 Proposer un trajet</h2><p>Un trajet, une date, un horaire.</p>'+
  '<button type="button" class="ev3-return-activity" data-ev3-mode="activity">← Proposer une activité à la place</button><form id="ev3CarForm"><div class="ev3-two"><label>Je souhaite<select name="kind"><option value="offer" '+(!p.has_car?"disabled":"")+' >Proposer des places</option><option value="request" '+(!p.has_car?"selected":"")+' >Chercher une place</option></select></label><label>Trajet<select name="direction"><option value="from_work">Retour du travail</option><option value="to_work">Aller au travail</option></select></label></div>'+
  '<div class="ev3-two"><label>Date<input name="date" type="date" required min="'+today+'"></label><label>Heure<input name="time" type="time" required></label></div><label>Places<select name="seats">'+[1,2,3,4,5,6].map(n=>'<option value="'+n+'">'+n+'</option>').join("")+'</select></label>'+
  '<label>Point de rendez-vous<input name="meeting_point" maxlength="200"></label><label>Précisions<textarea name="note" rows="2" maxlength="400"></textarea></label><button type="submit" class="ev3-primary">Proposer le trajet</button></form></section>';
 }
 const iconButtons=choices.map(([ic,title])=>'<button type="button" class="ev3-emoji '+(state.icon===ic?"is-selected":"")+'" data-ev3-icon="'+escapeHTML(ic)+'" aria-pressed="'+(state.icon===ic)+'" title="'+escapeHTML(title)+'">'+ic+'</button>').join("");
 return '<section class="ev3-panel"><div class="ev3-section-title"><h2>Proposer une activité</h2><button type="button" data-ev3-mode="carpool">🚗 Covoiturage ›</button></div>'+
 '<form id="ev3Compose">'+
 '<label class="ev3-form-title">1. Quelle activité ? <small>Icône obligatoire</small></label><div class="ev3-icons">'+iconButtons+'<button type="button" class="ev3-emoji ev3-custom" data-ev3-custom aria-label="Autre icône">＋</button></div>'+
 (state.customOpen?'<label>Autre icône <input id="ev3OtherIcon" type="text" maxlength="16" autocomplete="off" placeholder="Choisir un emoji" value="'+escapeHTML(state.icon)+'"></label>':"")+
 '<label>Nom de l’activité <small>(obligatoire)</small><input name="title" required maxlength="120" placeholder="Ex. Foot à 5, muscu après le travail…" value="'+escapeHTML(state.title)+'"></label>'+
 '<label class="ev3-form-title">2. Quand ?</label><div class="ev3-switch" role="group" aria-label="Choix de l’horaire">'+
 '<button type="button" class="'+(state.mode==="afterwork"?"is-active":"")+'" data-ev3-schedule="afterwork">🕔 À la fin du service</button>'+
 '<button type="button" class="'+(state.mode==="fixed"?"is-active":"")+'" data-ev3-schedule="fixed">🕒 Choisir une heure</button></div>'+
 (state.mode==="fixed"?'<label>Heure du rendez-vous<input name="time" type="time" required value="'+escapeHTML(state.time)+'"></label>':'<p class="ev3-hint">Chaque invité verra ses propres jours compatibles avec sa fin de service. Les réponses et présences seront visibles date par date.</p>')+
 '<label class="ev3-form-title">3. Les dates</label>'+calendarHTML()+
 '<label>Lieu <small>(facultatif)</small><input name="location" maxlength="240" placeholder="À définir ensemble" value="'+escapeHTML(state.place)+'"></label>'+
 '<label>Quelques précisions <small>(facultatif)</small><textarea name="description" maxlength="2000" rows="2">'+escapeHTML(state.details)+'</textarea></label>'+
 '<label class="ev3-form-title">4. Avec qui ?</label>'+peopleHTML()+
 '<label class="ev3-inline ev3-open-team"><input type="checkbox" name="public" '+(state.visibility==="team"?"checked":"")+'> Ouvert à toute l’équipe</label>'+
 '<button type="submit" class="ev3-primary">Envoyer la proposition</button></form></section>';
}
function render(){
 const app=byId("ensembleV3");if(!app)return;
 app.innerHTML='<header class="ev3-header"><a href="index.html#/home" class="ev3-back" aria-label="Retour à GHE">‹ GHE</a><div><small>ENTRE COLLÈGUES</small><h1>Sorties <span>&amp;</span> trajets</h1></div><button type="button" data-ev3-refresh title="Actualiser" aria-label="Actualiser">↻</button></header>'+
 '<nav class="ev3-tabs" aria-label="Sorties et trajets"><button type="button" class="'+(state.tab==="agenda"?"is-current":"")+'" data-ev3-tab="agenda">📅 Mes rendez-vous</button><button type="button" class="'+(state.tab==="create"?"is-current":"")+'" data-ev3-tab="create">＋ Proposer</button><button type="button" class="'+(state.tab==="trips"?"is-current":"")+'" data-ev3-tab="trips">🚗 Trajets</button></nav>'+
 '<p id="ev3Feedback" class="ev3-feedback '+(state.error?"is-error":"")+'" role="status">'+escapeHTML(state.status)+'</p>'+
 (!state.loaded?'<div class="ev3-empty">Chargement des propositions…</div>':
 state.tab==="agenda"?chosenCards():state.tab==="trips"?tripsHTML():formHTML())+
 '<dialog id="ev3Dialog" class="ev3-dialog" aria-label="Détails de l’activité"></dialog>';
 bind();
}
function bind(){
 document.querySelectorAll("[data-ev3-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.ev3Tab;state.agendaFilter="all";state.status="";render()});
 byId("ensembleV3")?.querySelector("[data-ev3-refresh]")?.addEventListener("click",refresh);
 byId("ensembleV3")?.querySelectorAll("[data-ev3-open]").forEach(b=>b.onclick=()=>openEvent(b.dataset.ev3Open));
 byId("ensembleV3")?.querySelectorAll("[data-ev3-mode]").forEach(b=>b.onclick=()=>{if(b.dataset.ev3Mode==="carpool"&&!state.pref?.opted_in){state.tab="trips";message("Active le covoiturage en indiquant ton secteur.");render();return}state.formKind=b.dataset.ev3Mode;state.tab="create";render()});
 byId("ensembleV3")?.querySelectorAll("[data-ev3-icon]").forEach(b=>b.onclick=()=>{persistTitle();state.icon=b.dataset.ev3Icon;state.customOpen=false;render()});
 byId("ensembleV3")?.querySelector("[data-ev3-custom]")?.addEventListener("click",()=>{persistTitle();state.customOpen=!state.customOpen;render();byId("ev3OtherIcon")?.focus()});
 const other=byId("ev3OtherIcon");if(other)other.oninput=()=>{state.icon=other.value.trim().slice(0,16)};
 byId("ensembleV3")?.querySelectorAll("[data-ev3-schedule]").forEach(b=>b.onclick=()=>{persistTitle();state.mode=b.dataset.ev3Schedule;if(state.mode==="afterwork"){const days=new Map(state.calendar.map(x=>[x.date,x]));for(const date of state.dates){const meta=days.get(date);if(state.calendarPreviewReady?!validClock(meta?.end):meta?.is_working===false)state.dates.delete(date)}}render()});
 byId("ensembleV3")?.querySelectorAll("[data-ev3-month]").forEach(b=>b.onclick=()=>{persistTitle();state.month=new Date(state.month.getFullYear(),state.month.getMonth()+Number(b.dataset.ev3Month),1);render()});
 byId("ensembleV3")?.querySelectorAll("[data-ev3-all]").forEach(b=>b.onclick=()=>{persistTitle();const select=b.dataset.ev3All==="1";const y=state.month.getFullYear(),m=state.month.getMonth();for(let i=1;i<=new Date(y,m+1,0).getDate();i++){const d=dateISO(new Date(y,m,i));if(d<today)continue;const meta=state.calendar.find(x=>x.date===d);if(select&&state.mode==="afterwork"&&(state.calendarPreviewReady?!validClock(meta?.end):meta?.is_working===false))continue;if(select){if(state.dates.size<62)state.dates.add(d)}else state.dates.delete(d)}render()});
 byId("ensembleV3")?.querySelectorAll("[data-ev3-day]").forEach(b=>b.onclick=()=>{persistTitle();const d=b.dataset.ev3Day;if(state.dates.has(d))state.dates.delete(d);else if(state.dates.size<62)state.dates.add(d);else return message("62 dates maximum.",true);render()});
 const search=byId("ev3PeopleSearch");if(search)search.oninput=()=>{byId("ev3PeopleList").innerHTML=peopleOptions(search.value);bindPeople()};
 bindPeople();
 const f=byId("ev3Compose");if(f){f.elements.public.onchange=()=>state.visibility=f.elements.public.checked?"team":"invite";f.elements.title.oninput=()=>state.title=f.elements.title.value;if(f.elements.location)f.elements.location.oninput=()=>state.place=f.elements.location.value;if(f.elements.description)f.elements.description.oninput=()=>state.details=f.elements.description.value;if(f.elements.time)f.elements.time.oninput=()=>state.time=f.elements.time.value;f.onsubmit=submitActivity;}
 const pf=byId("ev3Prefs");if(pf)pf.onsubmit=async e=>{e.preventDefault();const b=pf.querySelector("button[type=submit]");b.disabled=true;try{const j=await call("carpool_preferences",{opted_in:true,sector:pf.elements.sector.value.trim(),has_car:pf.elements.has_car.checked});Object.assign(state,{pref:j.preference,trips:j.trips});message("Covoiturage activé.");render()}catch(err){message(err.message,true);b.disabled=false}};
 const cf=byId("ev3CarForm");if(cf)cf.onsubmit=submitTrip;
 byId("ensembleV3")?.querySelectorAll("[data-ev3-trip-act]").forEach(b=>b.onclick=async()=>{if(b.dataset.ev3TripAct==="carpool_cancel"&&!confirm("Annuler ce trajet ?"))return;b.disabled=true;try{const j=await call(b.dataset.ev3TripAct,{trip_id:b.dataset.trip,target_agent_id:b.dataset.peer,decision:b.dataset.decision});state.trips=j.trips||[];message("Trajet mis à jour.");render()}catch(err){message(err.message,true);b.disabled=false}});
}
function persistTitle(){const f=byId("ev3Compose");if(!f)return;state.title=f.elements.title.value||"";state.time=f.elements.time?.value||"";state.place=f.elements.location?.value||"";state.details=f.elements.description?.value||""}
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
 const title=String(f.elements.title.value||"").trim();
 if(!title){f.elements.title.focus();return message("Donne un titre à cette activité pour identifier clairement sa discussion.",true)}
 const submit=f.querySelector('[type="submit"]');submit.disabled=true;
 try{
  const result=await call("create_ensemble",{icon:state.icon,title,dates:[...state.dates].sort(),schedule_mode:state.mode,
   time_label:state.mode==="afterwork"?"À la fin du service":f.elements.time?.value||"Horaire à définir",visibility:state.visibility,
   location:f.elements.location.value,description:f.elements.description.value,agent_ids:[...state.guests]});
  state.events=result.events||[];
  state.dates.clear();state.guests.clear();state.title="";state.icon="";state.time="";state.place="";state.details="";state.customOpen=false;state.tab="agenda";
  message("Proposition créée et invitations envoyées.");render();
 }catch(err){message(err.message,true);submit.disabled=false}
}
async function submitTrip(ev){
 ev.preventDefault();const f=ev.currentTarget,submit=f.querySelector('[type="submit"]');submit.disabled=true;
 try{const j=await call("carpool_create",{kind:f.elements.kind.value,direction:f.elements.direction.value,date:f.elements.date.value,time:f.elements.time.value,seats:Number(f.elements.seats.value),meeting_point:f.elements.meeting_point.value,note:f.elements.note.value});
 state.trips=j.trips||[];state.tab="trips";message("Trajet proposé.");render()}
 catch(err){message(err.message,true);submit.disabled=false}
}
function dialog(anchorId){
 let el=byId("ev3Dialog");
 if(!el){el=document.createElement("dialog");el.id="ev3Dialog";el.className="ev3-dialog";document.body.appendChild(el)}
 if(document.documentElement.hasAttribute("data-t-est")&&anchorId){
  const anchor=[...document.querySelectorAll("[data-ev3-open]")].find(x=>x.dataset.ev3Open===anchorId);
  if(anchor)anchor.insertAdjacentElement("afterend",el);
 }
 return el;
}
function showActivityDialog(d){
 if(d.open)return;
 if(document.documentElement.hasAttribute("data-t-est")){
  d.show();
  requestAnimationFrame(()=>d.scrollIntoView({block:"nearest",behavior:"smooth"}));
 }else d.showModal();
}
function closeModal(){const d=byId("ev3Dialog");if(d?.open)d.close()}
function rosterDateHTML(event,day){
 const roster=Array.isArray(event.date_roster?.[day])?event.date_roster[day]:[];
 const num=st=>roster.filter(p=>p.state===st).length;
 const confirmed=num("accepted")+num("organizer"),pending=num("pending"),refused=num("declined");
 const values=[
  ["organizer","Organisateur"],["accepted","Présent"],["pending","En attente"],
  ["declined","A refusé"],["not_selected","Ne vient pas ce jour"],
  ["incompatible","Horaires différents"],["unavailable","Indisponible"]
 ];
 return '<details class="ev3-date-roster"><summary>'+
  '<span class="ev3-roster-qty is-confirmed">✓ '+confirmed+'</span>'+
  '<span class="ev3-roster-qty is-waiting">◷ '+pending+'</span>'+
  (refused?'<span class="ev3-roster-qty is-refused">✕ '+refused+'</span>':"")+
  '<b>Qui vient ? ›</b></summary><div class="ev3-roster-groups">'+
  values.map(([state,label])=>{
   const people=roster.filter(p=>p.state===state);
   return people.length?'<section class="ev3-roster-group ev3-roster-'+state+'">'+
    '<div class="ev3-roster-heading"><span>'+escapeHTML(label)+' · '+people.length+'</span></div>'+
    '<div class="ev3-roster-names">'+people.map(p=>'<span>'+escapeHTML(p.name)+'</span>').join("")+'</div></section>':"";
  }).join("")+'</div></details>';
}
function openEvent(id){
 const event=state.events.find(x=>x.id===id);if(!event)return;
 const ds=activeDates(event),allDays=(event.dates||[]).filter(day=>day>=today),choice=event.response?.selected_dates||[];
 const [tone,status]=kindStatus(event),isOrganizer=!!event.is_organizer;
 const dialogEl=dialog(id);
 dialogEl.innerHTML='<header class="ev3-modal-head"><span class="ev3-bigicon">'+escapeHTML(event.icon||"📌")+
 '</span><div><strong>'+escapeHTML(event.title)+'</strong><small class="ev3-status-text ev3-'+tone+'">'+escapeHTML(status)+
 '</small></div><button type="button" data-ev3-close aria-label="Fermer">×</button></header>'+
 '<div class="ev3-modal-body">'+
 (event.description?'<p>'+escapeHTML(event.description)+'</p>':"")+
 '<p>📍 '+escapeHTML(event.location||"Lieu à définir")+' · '+
 escapeHTML(event.schedule_mode==="afterwork"?"À la fin du service":event.time_label||"Horaire à fixer")+'</p>'+
 '<section class="ev3-modal-section"><strong>Dates proposées · présences et réponses</strong>'+
 '<p class="ev3-dates-help">Les jours compatibles avec tes horaires peuvent être sélectionnés. Les invités disposent chacun de leurs propres dates compatibles.</p>'+
 '<div class="ev3-respond-dates ev3-respond-dates-advanced">'+allDays.map(day=>{
   const compatible=ds.includes(day)&&!(event.organizer_unavailable_dates||[]).includes(day);
   return '<div class="ev3-date-choice-card '+(compatible?"is-compatible":"is-incompatible")+'">'+
   '<label class="ev3-date-choice"><input type="checkbox" name="dates" value="'+escapeHTML(day)+'" '+
   ((choice.includes(day)||isOrganizer)&&compatible?"checked ":"")+
   ((isOrganizer||!compatible)?"disabled ":"")+
   '><span><strong>'+escapeHTML(fmt(day))+'</strong><small>'+
   (compatible?(event.schedule_mode==='afterwork'?escapeHTML(event.visible_end_times?.[day]||"Fin du service"):"Horaire compatible"):
   "Pas d’horaire compatible")+
   '</small></span></label>'+rosterDateHTML(event,day)+'</div>';
 }).join("")+'</div></section>'+
 '<div class="ev3-modal-actions">'+
 (!isOrganizer&&event.status==="active"?'<button type="button" class="ev3-primary" data-ev3-answer="accept">Valider mes dates</button>'+
 '<button type="button" data-ev3-answer="decline">Je ne participe pas</button>':"")+
 (meetingLink(event)?'<a class="ev3-modal-link" href="'+escapeHTML(meetingLink(event))+'">💬 Discussion</a>':"")+
 (event.can_invite?'<button type="button" data-ev3-invite>＋ Inviter</button>':"")+
 (event.can_manage?'<button type="button" data-ev3-edit>✎ Modifier</button>'+
 '<button type="button" data-ev3-cancel>Annuler</button>':"")+'</div>'+
 '<p class="ev3-modal-error" role="status"></p></div>';
 dialogEl.querySelector("[data-ev3-close]").onclick=closeModal;
 dialogEl.querySelectorAll("[data-ev3-answer]").forEach(button=>button.onclick=async()=>{
  const decline=button.dataset.ev3Answer==="decline",
   selected=[...dialogEl.querySelectorAll('input[name="dates"]:checked')].map(x=>x.value);
  if(!decline&&!selected.length){
   dialogEl.querySelector(".ev3-modal-error").textContent="Sélectionne au moins une date ou indique que tu ne participes pas.";return;
  }
  button.disabled=true;
  try{
   const updated=await call("respond",{event_id:event.id,revision:event.revision,
    selected_dates:decline?[]:selected,declined:decline});
   state.events=updated.events||[];
   closeModal();
   message(decline?"Refus enregistré. L'invitation ne nécessite plus de réponse.":"Réponse enregistrée.");
   render();
  }catch(err){
   dialogEl.querySelector(".ev3-modal-error").textContent=err.message;
   button.disabled=false;
  }
 });
 dialogEl.querySelector("[data-ev3-invite]")?.addEventListener("click",()=>openInvite(event));
 dialogEl.querySelector("[data-ev3-edit]")?.addEventListener("click",()=>openEditor(event));
 dialogEl.querySelector("[data-ev3-cancel]")?.addEventListener("click",async()=>{
  if(!confirm("Annuler cette proposition pour tous les collègues ?"))return;
  try{
   const updated=await call("save",{id:event.id,revision:event.revision,title:event.title,
    description:event.description,location:event.location,time_label:event.time_label,dates:event.dates,
    status:"cancelled",icon:event.icon});
   state.events=updated.events||[];closeModal();message("Proposition annulée.");render();
  }catch(err){dialogEl.querySelector(".ev3-modal-error").textContent=err.message}
 });
 showActivityDialog(dialogEl);
}
function openInvite(e,notice=""){
 const event=state.events.find(x=>x.id===e.id)||e;
 if(!event.can_invite)return openEvent(event.id);
 const d=dialog(),invited=event.invited_colleagues||[];
 const invitedIds=new Set(invited.map(x=>x.id)),selected=new Set();
 const statusName=s=>s==="accepted"?"Participe":s==="declined"?"Décliné":"En attente";
 d.innerHTML='<header class="ev3-modal-head"><button type="button" data-ev3-back aria-label="Revenir à l’activité">‹</button><strong>Invitations · '+escapeHTML(event.title)+'</strong><button type="button" data-ev3-close aria-label="Fermer">×</button></header>'+
 '<div class="ev3-modal-body"><section class="ev3-modal-section"><strong>Déjà invités · '+invited.length+'</strong>'+
 (invited.length?'<div class="ev3-invited-list">'+invited.map(person=>
 '<div class="ev3-invited-person"><span><b>'+escapeHTML(person.name)+'</b><small>'+escapeHTML(statusName(person.status))+'</small></span>'+
 '<button type="button" data-ev3-uninvite="'+escapeHTML(person.id)+'" data-name="'+escapeHTML(person.name)+'" aria-label="Retirer '+escapeHTML(person.name)+'">Retirer</button></div>').join("")+'</div>':
 '<p>Personne n’a encore été invité.</p>')+'</section>'+
 '<section class="ev3-modal-section"><strong>Ajouter des collègues</strong><input id="ev3InviteSearch" type="search" placeholder="Rechercher un collègue" autocomplete="off"><div id="ev3InviteList" class="ev3-person-list"></div><p class="ev3-directory-hint">Les collègues dont l’accès aux sorties est désactivé restent visibles mais ne peuvent pas recevoir de nouvelle invitation.</p></section>'+
 '<button type="button" class="ev3-primary" id="ev3SendInvites">Envoyer les invitations</button>'+
 '<p class="ev3-modal-error" role="status">'+escapeHTML(notice)+'</p></div>';
 const error=d.querySelector(".ev3-modal-error");
 const draw=()=>{
  const q=normalizedName(byId("ev3InviteSearch")?.value||"");
  byId("ev3InviteList").innerHTML=state.people.filter(p=>!invitedIds.has(p.id)&&normalizedName(p.name).includes(q)).map(p=>
   '<label class="ev3-person'+(p.can_invite===false?' is-restricted':'')+'"><input type="checkbox" data-person="'+escapeHTML(p.id)+'" '+(selected.has(p.id)?"checked":"")+' '+(p.can_invite===false?'disabled aria-label="Invitation indisponible"':'')+'>'+personMarkup(p)+'</label>').join("")||"<p>Aucun autre collègue.</p>";
  byId("ev3InviteList").querySelectorAll("[data-person]").forEach(input=>input.onchange=()=>{
   if(input.checked)selected.add(input.dataset.person);else selected.delete(input.dataset.person);
  });
 };
 draw();byId("ev3InviteSearch").oninput=draw;
 d.querySelector("[data-ev3-close]").onclick=closeModal;
 d.querySelector("[data-ev3-back]").onclick=()=>openEvent(event.id);
 d.querySelectorAll("[data-ev3-uninvite]").forEach(button=>button.onclick=async()=>{
  if(!confirm("Retirer "+button.dataset.name+" de l’activité ? Cette personne perdra aussi son accès au groupe lié."))return;
  button.disabled=true;error.textContent="Mise à jour des participants…";
  try{
   const j=await call("uninvite",{event_id:event.id,target_agent_id:button.dataset.ev3Uninvite});
   state.events=j.events||[];openInvite(state.events.find(x=>x.id===event.id)||event,"Invitation retirée.");
  }catch(err){error.textContent=err.message;button.disabled=false}
 });
 byId("ev3SendInvites").onclick=async()=>{
  if(!selected.size){error.textContent="Sélectionne un collègue pouvant recevoir une invitation. Les accès désactivés doivent être réactivés par un administrateur.";return}
  const send=byId("ev3SendInvites");send.disabled=true;error.textContent="Envoi des invitations…";
  try{
   const j=await call("invite",{event_id:event.id,agent_ids:[...selected]});
   state.events=j.events||[];openInvite(state.events.find(x=>x.id===event.id)||event,
    j.added?"Invitations envoyées.":"Ces collègues étaient déjà invités.");
  }catch(err){error.textContent=err.message;send.disabled=false}
 };
 showActivityDialog(d);
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
 showActivityDialog(d);
}
async function refresh(){
 try{
  const [events,calendar,peers,trips,preview]=await Promise.allSettled([call("list"),call("calendar"),call("colleagues"),call("carpool_home"),call("calendar_preview",{start:today,days:123})]);
  if(events.status==="rejected")throw events.reason;
  state.events=events.value.events||[];
  if(calendar.status==="fulfilled")state.calendar=calendar.value.days||[];
  state.calendarPreviewReady=preview.status==="fulfilled";
  if(state.calendarPreviewReady){const ends=new Map((preview.value.shifts||[]).map(x=>[x.date,x.end]));state.calendar=state.calendar.map(x=>({...x,end:ends.get(x.date)||null}));}
  if(peers.status==="fulfilled"){
   state.people=peers.value.colleagues||[];
   state.peopleError="";
  }else{
   state.peopleError="Impossible de charger l’annuaire. Appuie sur ↻ pour réessayer.";
  }
  if(trips.status==="fulfilled"){state.trips=trips.value.trips||[];state.pref=trips.value.preference||null}
  state.loaded=true;state.error="";state.status="";render();
  const id=new URLSearchParams(location.search).get("event");if(id&&!deepLinked&&state.events.some(e=>e.id===id)){deepLinked=true;openEvent(id)}
 }catch(err){state.loaded=true;state.error=err.message;state.status=err.message;render()}
}
function setView(view){state.agendaFilter=view==="invitations"?"invitations":"all";state.tab=view==="trips"?"trips":"agenda";state.status="";render()}
function openCreator(){state.formKind="activity";state.agendaFilter="all";state.tab="create";render()}
window.STIPEnsembleV3={refresh,openEvent,setView,openCreator};
document.addEventListener("DOMContentLoaded",refresh,{once:true});
window.addEventListener("pageshow",e=>{if(e.persisted)refresh()});
})();