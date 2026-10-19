(() => {
"use strict";
if (window.STIPEnsembleV3) return;
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure";
const escapeHTML=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const choices=[["⚽","Football"],["🥊","Boxe"],["🏋️","Musculation"],["🍽️","Restaurant"],["🎳","Bowling"],["🎬","Cinéma"],["🚶","Promenade"],["🎉","Sortie"]];
const iconCatalog=[
 ...choices.map(([icon,label])=>({icon,label,group:icon==="🍽️"?"repas":icon==="🎉"?"sorties":icon==="🎬"?"loisirs":"sport"})),
 ...[
 ["🏀","Basket","sport"],["🏐","Volley","sport"],["🏸","Badminton","sport"],["🏓","Ping-pong","sport"],
 ["🎾","Tennis","sport"],["🚴","Vélo","sport"],["🏊","Natation","sport"],["🏃","Course","sport"],
 ["🧘","Yoga","sport"],["🥾","Randonnée","sport"],["🥋","Arts martiaux","sport"],["💃","Danse","sport"],
 ["☕","Café","repas"],["🍕","Pizza","repas"],["🍔","Burger","repas"],["🍣","Sushi","repas"],
 ["🍰","Dessert","repas"],["🧺","Pique-nique","repas"],["🥐","Petit-déjeuner","repas"],["🥗","Repas","repas"],
 ["🏖️","Plage","sorties"],["🌳","Parc","sorties"],["🌇","Coucher de soleil","sorties"],
 ["🚗","Balade","sorties"],["🛍️","Shopping","sorties"],["🚌","Excursion","sorties"],
 ["🎤","Karaoké","loisirs"],["🎵","Musique","loisirs"],["🎮","Jeux vidéo","loisirs"],
 ["🎲","Jeux de société","loisirs"],["🎯","Fléchettes","loisirs"],["🎨","Création","loisirs"],
 ["📷","Photo","loisirs"],["🎭","Spectacle","loisirs"],["🎸","Concert","loisirs"],
 ["🎁","Surprise","autres"],["🎂","Anniversaire","autres"],["❤️","Entraide","autres"],
 ["🐶","Animaux","autres"],["🌟","Projet","autres"],["🤝","Rencontre","autres"]
 ].map(([icon,label,group])=>({icon,label,group}))
];
const iconGroups=[["all","Toutes"],["sport","Sport"],["repas","Repas"],["sorties","Sorties"],["loisirs","Loisirs"],["autres","Autres"]];
const isCatalogIcon=icon=>iconCatalog.some(item=>item.icon===icon);
const iconLabel=icon=>iconCatalog.find(item=>item.icon===icon)?.label||"";
const dateISO=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const today=dateISO(new Date());
const validClock=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||""));
const fmt=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
const monthName=d=>d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
const byId=id=>document.getElementById(id);
const normalizedName=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr").trim();
const personMarkup=p=>'<span class="ev3-person-label">'+escapeHTML(p.name)+(p.can_invite===false?'<small class="ev3-person-restricted">Collègue indisponible</small>':p.access_ready===false?'<small class="ev3-person-access">Invitation possible · compte GHE à activer</small>':"")+'</span>';
const entryParams=new URLSearchParams(location.search);
const entryTab=entryParams.get("tab");
const entrySchedule=entryParams.get("schedule")==="fixed"?"fixed":"afterwork";
const entryGuestId=String(entryParams.get("with")||"").trim();
const entryCarpoolChoice=entryParams.get("choice");
let guestEntryResolved=false;
let carpoolEntryResolved=false;
const state={tab:entryTab==="create"?"create":entryTab==="trajets"||entryTab==="trips"?"trips":entryTab==="dispos"||entryTab==="availability"?"availability":entryTab==="invitations"||entryTab==="invites"?"invitations":"agenda",availabilitySelected:new Set(),availabilityMatches:new Map(),availabilityQuery:"",availabilityBusy:false,availabilityError:"",availabilityResultsReady:false,events:[],people:[],peopleError:"",calendar:[],trips:[],pref:null,icon:"",title:"",dates:new Set(),guests:new Set(),mode:entrySchedule,visibility:"invite",month:new Date(new Date().getFullYear(),new Date().getMonth(),1),formKind:"activity",iconPickerOpen:false,iconCategory:"all",iconQuery:"",time:"",place:"",details:"",loaded:false,calendarLoaded:false,peopleLoaded:false,tripLoaded:false,tripError:"",calendarError:"",eventsError:"",previewEnds:new Map(),error:"",status:"",busy:false,details:null,editing:false,form:{time:"",location:"",description:""},calendarPreviewReady:false,deepLinkOpened:false,agendaFilter:"all"};
let deepLinked=false;
let refreshSequence=0;
let pendingVisualRefresh=false;
function renderWhenIdle(){
 if(byId("ev3Dialog")?.open){pendingVisualRefresh=true;return}
 // Live data revalidation must never replace the form, its scroll position
 // or the native Android/iOS keyboard while someone is making a proposal.
 const composer=byId("ev3Compose");
 if(state.tab==="create"&&composer){
  const dates=byId("ev3DatePicker");
  if(dates){
   const next=calendarHTML();
   if(dates.innerHTML!==next)dates.innerHTML=next;
  }
  const people=byId("ev3PeopleList"),search=byId("ev3PeopleSearch");
  if(people){
   const next=state.peopleLoaded?peopleOptions(search?.value||""):
     '<p class="ev3-inline-status">Chargement de la liste des collègues…</p>';
   if(people.innerHTML!==next){people.innerHTML=next;bindPeople();}
  }
  if(search)search.disabled=!state.peopleLoaded;
  const total=byId("ev3PeopleAvailableCount");
  if(total)total.textContent=state.peopleLoaded?
   state.people.filter(p=>p.can_invite!==false).length+" disponibles":"Chargement…";
  const submit=composer.querySelector('[type="submit"]');
  if(submit)submit.disabled=!state.calendarLoaded||!state.peopleLoaded;
  updateComposerProgress();pendingVisualRefresh=false;return;
 }
 const active=document.activeElement;
 // Keep the original mobile input and keyboard in place while data arrive.
 if(active?.closest?.("#ev3Compose, #ev3CarForm, #ev3Prefs, #ev3Edit, .ev3-availability-picker") && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)){
  pendingVisualRefresh=true;
  const submit=byId("ev3Compose")?.querySelector('[type="submit"]');
  if(submit)submit.disabled=!state.calendarLoaded||!state.peopleLoaded;
  return;
 }
 pendingVisualRefresh=false;
 render();
}
document.addEventListener("focusout",()=>{
 if(!pendingVisualRefresh)return;
 setTimeout(()=>{if(pendingVisualRefresh)renderWhenIdle()},280);
});

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
function message(t,error=false){state.status=t;state.error=error?t:"";const el=byId("ev3Feedback");if(el){el.textContent=t;el.classList.toggle("is-error",error)}const hint=byId("ev3ComposeFeedback");if(hint){hint.textContent=t;hint.classList.toggle("is-error",error)}}
function activeDates(e){return (e.visible_dates||e.dates||[]).filter(d=>d>=today)}
function concerned(e){return e.is_organizer||!!e.invitation_status||!!e.response}
function displayDates(e){const compatible=activeDates(e);return compatible.length?compatible:(e.invitation_status?(e.dates||[]).filter(d=>d>=today):[])}
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
 const [tone,label]=kindStatus(e),days=displayDates(e),time=e.schedule_mode==="afterwork"?(!activeDates(e).length&&e.invitation_status?"Aucune fin de service compatible":e.visible_end_times?.[days[0]]||"Fin du service"):e.time_label||"Horaire à fixer";
 return '<button type="button" class="ev3-card ev3-'+tone+'" data-ev3-open="'+escapeHTML(e.id)+'">'+
 '<span class="ev3-card-icon" aria-hidden="true">'+escapeHTML(e.icon||"📌")+'</span>'+
 '<span class="ev3-card-body"><strong>'+escapeHTML(e.title)+'</strong><small>'+escapeHTML(days.length?fmt(days[0])+(days.length>1?" · +"+(days.length-1)+" dates":""):"Aucune date à venir")+' · '+escapeHTML(time)+'</small><small>'+escapeHTML(e.location||"Lieu à définir")+(e.participants?.length?" · "+e.participants.length+" intéressé(s)":"")+'</small></span>'+
 '<span class="ev3-chip">'+escapeHTML(label)+'</span><span aria-hidden="true">›</span></button>';
}
function chosenCards(){
 const upcoming=state.events.filter(e=>e.status==="active"&&displayDates(e).length).sort((a,b)=>
  displayDates(a)[0].localeCompare(displayDates(b)[0])||String(a.title).localeCompare(String(b.title),"fr"));
 const awaiting=upcoming.filter(e=>e.needs_response&&!e.is_organizer);
 const mine=upcoming.filter(e=>concerned(e)&&!awaiting.includes(e)&&!e.response?.declined);
 const publicEvents=upcoming.filter(e=>e.visibility==="team"&&!concerned(e));
 if(state.tab==="invitations"||state.agendaFilter==="invitations"){
  const invited=upcoming.filter(e=>!!e.invitation_status||(e.is_organizer&&(e.invited_colleagues||[]).length>0));
  return '<div class="ev3-section-title"><h2>Mes invitations</h2><small>'+invited.length+' proposition'+(invited.length>1?"s":"")+'</small></div>'+
    (awaiting.length?'<h3 class="ev3-small-title">À répondre</h3><div class="ev3-stack">'+awaiting.map(card).join("")+'</div>':"")+
    (invited.filter(e=>!awaiting.includes(e)).length?'<h3 class="ev3-small-title">En cours</h3><div class="ev3-stack">'+invited.filter(e=>!awaiting.includes(e)).map(card).join("")+'</div>':"")+
    (!invited.length?'<div class="ev3-quiet-empty"><strong>Aucune invitation à traiter.</strong><span>Les nouvelles invitations apparaîtront ici.</span></div>':"");
 }
 return '<div class="ev3-community-summary"><div><small>LE COIN DES COLLÈGUES</small><strong>Des idées pour se retrouver</strong><span>Une proposition suffit. Chacun choisit ses dates, invite et discute dans la même fiche.</span></div>'+
  '<button type="button" data-ev3-tab="availability">Qui finit avec moi ? <span aria-hidden="true">›</span></button></div>'+
  (awaiting.length?'<h3 class="ev3-small-title">À répondre · '+awaiting.length+'</h3><div class="ev3-stack">'+awaiting.map(card).join("")+'</div>':"")+
  '<div class="ev3-section-title"><h2>Les propositions</h2><small>'+upcoming.length+' à venir</small></div>'+
  (mine.length?'<h3 class="ev3-small-title">Mes sorties & rendez-vous</h3><div class="ev3-stack">'+mine.map(card).join("")+'</div>':"")+
  (publicEvents.length?'<h3 class="ev3-small-title">Ouvertes à l’équipe</h3><div class="ev3-stack">'+publicEvents.map(card).join("")+'</div>':"")+
  (!mine.length&&!publicEvents.length&&!awaiting.length?'<div class="ev3-quiet-empty"><strong>Aucune proposition à venir.</strong><span>Lance une activité ou compare les créneaux de tes collègues.</span><button type="button" data-ev3-tab="create">＋ Proposer</button></div>':"");
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
function availabilityPeopleHTML(){
 const query=normalizedName(state.availabilityQuery);
 const entries=state.people.filter(p=>p.can_invite!==false&&normalizedName(p.name).includes(query));
 return entries.slice(0,32).map(p=>'<label class="ev3-availability-person"><input type="checkbox" data-ev3-availability-person="'+escapeHTML(p.id)+'" '+(state.availabilitySelected.has(p.id)?"checked":"")+' '+(!state.availabilitySelected.has(p.id)&&state.availabilitySelected.size>=3?"disabled":"")+'>'+
  '<span>'+escapeHTML(p.name)+'</span>'+(state.availabilitySelected.has(p.id)?'<b>✓</b>':'')+'</label>').join("")||
  '<p class="ev3-inline-status">Aucun collègue pour cette recherche.</p>';
}
function availabilityHTML(){
 const selected=[...state.availabilitySelected];
 const people=new Map(state.people.map(p=>[p.id,p.name]));
 const byDate=new Map();
 if(state.availabilityResultsReady)for(const [id,days] of state.availabilityMatches){
  for(const d of days){
   const row=byDate.get(d.date)||[];
   row.push({...d,agent_id:id,name:people.get(id)||"Collègue"});
   byDate.set(d.date,row);
  }
 }
 const dates=[...byDate].sort(([a,ap],[b,bp])=>bp.length-ap.length||a.localeCompare(b)).slice(0,18);
 return '<section class="ev3-availability"><div class="ev3-section-title"><h2>Qui finit en même temps que moi ?</h2></div>'+
  '<p class="ev3-availability-note">Compare les fins de service sur les 31 prochains jours. Ce sont des <strong>créneaux possibles</strong>, pas une confirmation de disponibilité pour sortir.</p>'+
  (!state.peopleLoaded?loadingHTML("Chargement des collègues…"):state.peopleError?
    '<div class="ev3-quiet-empty is-error">'+escapeHTML(state.peopleError)+'</div>':
    '<div class="ev3-availability-picker"><label for="ev3AvailabilitySearch">Choisir jusqu’à 3 collègues</label><input id="ev3AvailabilitySearch" type="search" autocomplete="off" placeholder="Prénom ou nom…" value="'+escapeHTML(state.availabilityQuery)+'">'+
    '<div id="ev3AvailabilityPeople" class="ev3-availability-people">'+availabilityPeopleHTML()+'</div>'+
    '<div class="ev3-availability-controls"><small>'+selected.length+'/3 sélectionnés</small><button type="button" class="ev3-primary" data-ev3-compare '+(!selected.length||state.availabilityBusy?"disabled":"")+'>'+ (state.availabilityBusy?"Recherche…":"Voir les créneaux compatibles")+'</button></div></div>')+
  (state.availabilityError?'<p class="ev3-inline-status is-error" role="status">'+escapeHTML(state.availabilityError)+'</p>':"")+
  (state.availabilityResultsReady?'<div class="ev3-availability-results"><div class="ev3-section-title"><h2>Créneaux à proposer</h2><small>'+dates.length+' date'+(dates.length>1?"s":"")+'</small></div>'+
    (dates.length?dates.map(([day,rows])=>'<article class="ev3-slot-result"><div class="ev3-slot-result-main"><strong>'+escapeHTML(fmt(day))+'</strong><small>'+rows.length+' collègue'+(rows.length>1?"s":"")+' avec une fin de service proche</small><span>'+rows.map(r=>escapeHTML(r.name)).join(" · ")+'</span></div>'+
     '<button type="button" data-ev3-plan-day="'+escapeHTML(day)+'">Proposer <span aria-hidden="true">›</span></button></article>').join(""):'<div class="ev3-quiet-empty"><strong>Aucun créneau commun repéré.</strong><span>Tu peux toujours proposer une activité à une heure libre.</span><button type="button" data-ev3-tab="create">Proposer quand même</button></div>')+
   '</div>':"")+
  '<p class="ev3-availability-privacy">🔒 Les horaires individuels ne sont pas publiés sur cette page. Chaque personne confirme sa participation à une proposition.</p></section>';
}
function tripsHTML(){
 if(!state.tripLoaded)return '<div class="ev3-section-title"><h2>Trajets entre collègues</h2></div>'+loadingHTML("Recherche des trajets…");
 if(state.tripError)return '<div class="ev3-section-title"><h2>Trajets entre collègues</h2></div><div class="ev3-quiet-empty is-error"><strong>Trajets momentanément indisponibles.</strong><span>'+escapeHTML(state.tripError)+'</span><button type="button" data-ev3-refresh>Réessayer</button></div>';
 const p=state.pref||{opted_in:false,sector:"",has_car:false};
 return '<div class="ev3-section-title"><h2>Trajets entre collègues</h2></div>'+
  (!p.opted_in?'<section class="ev3-panel ev3-panel-compact"><p class="ev3-intro">Partage uniquement ton secteur, jamais ton adresse personnelle.</p><form id="ev3Prefs"><label>Mon secteur<input name="sector" required maxlength="80" placeholder="Lyon 8e, Bron…"></label><label class="ev3-inline"><input name="has_car" type="checkbox"> Je peux conduire</label><button type="submit" class="ev3-primary">Activer le covoiturage</button></form></section>':
  '<section class="ev3-trip-toolbar"><span>📍 '+escapeHTML(p.sector||"Secteur à définir")+'</span><button type="button" data-ev3-mode="carpool">＋ Proposer un trajet</button></section>'+
  (state.trips.length?'<div class="ev3-stack">'+state.trips.map(tripCard).join("")+'</div>':'<div class="ev3-quiet-empty"><strong>Aucun trajet proposé.</strong><span>Tu peux proposer le premier, ou revenir plus tard.</span></div>'));
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
  const disabled=past||(state.mode==="afterwork"&&(!state.calendarLoaded||!!state.calendarError))||ineligible;
  body+='<button type="button" '+(disabled?"disabled ":"")+'class="ev3-day'+(selected?" is-selected":"")+(meta?.is_working?" is-working":"")+'" data-ev3-day="'+d+'" aria-pressed="'+selected+'" title="'+escapeHTML(ineligible?"Pas de fin de service vérifiée pour ce jour":meta?.label||"Date libre")+'"><b>'+i+'</b><small>'+escapeHTML(meta?.icon||"")+'</small></button>';
 }
 return (state.calendarError?'<p class="ev3-inline-status is-error">'+escapeHTML(state.calendarError)+'</p>':!state.calendarLoaded?'<p class="ev3-inline-status">Vérification de tes disponibilités…</p>':"")+'<div class="ev3-month-nav"><button type="button" data-ev3-month="-1" aria-label="Mois précédent">‹</button><strong>'+escapeHTML(monthName(first))+'</strong><button type="button" data-ev3-month="1" aria-label="Mois suivant">›</button></div>'+
 '<div class="ev3-month-quick"><button type="button" data-ev3-all="1" '+(state.mode==="afterwork"&&(!state.calendarLoaded||state.calendarError)?'disabled':'')+'>✓ Tout le mois</button><button type="button" data-ev3-all="0">Tout décocher</button><small id="ev3SelectedDateCount">'+state.dates.size+' jour'+(state.dates.size>1?"s":"")+'</small></div>'+
 '<div class="ev3-calendar">'+body+'</div>';
}
function peopleHTML(){
 const unactivated=state.people.filter(p=>p.can_invite!==false&&p.access_ready===false).length;
 return '<label class="ev3-search-label">Inviter des collègues <small id="ev3PeopleAvailableCount">'+(state.peopleLoaded?state.people.filter(p=>p.can_invite!==false).length+" disponibles":"Chargement…")+'</small><input id="ev3PeopleSearch" type="search" placeholder="Nom ou prénom…" autocomplete="off" '+(!state.peopleLoaded?'disabled':'')+'></label>'+
 (state.peopleError?'<p class="ev3-error">'+escapeHTML(state.peopleError)+'</p>':"")+
 '<div class="ev3-person-list" id="ev3PeopleList">'+(state.peopleLoaded?peopleOptions(""):'<p class="ev3-inline-status">Chargement de la liste des collègues…</p>')+'</div><small id="ev3PeopleCount">'+state.guests.size+' sélectionné(s)</small>'+
 (unactivated?'<p class="ev3-directory-hint">Tu peux inviter ces collègues même si leur compte GHE n’est pas encore activé. Leur invitation est conservée et sera disponible après connexion.</p>':"");
}
function peopleOptions(query){
 const q=normalizedName(query);
 const matches=state.people.filter(p=>normalizedName(p.name).includes(q));
 return matches.map(p=>
  '<label class="ev3-person'+(p.can_invite===false?' is-restricted':'')+'"><input type="checkbox" data-ev3-person="'+escapeHTML(p.id)+'" '+(state.guests.has(p.id)?"checked":"")+' '+(p.can_invite===false?'disabled aria-label="Invitation indisponible"':'')+'>'+personMarkup(p)+'</label>').join("")||
 (state.peopleError?'<p>Annuaire indisponible : actualise la page.</p>':'<p>Aucun collègue correspondant à cette recherche.</p>');
}
function iconResultsHTML(){
 const group=state.iconCategory,query=normalizedName(state.iconQuery);
 const found=iconCatalog.filter(x=>(group==="all"||x.group===group)&&normalizedName(x.label).includes(query));
 return found.length?found.map(x=>'<button type="button" class="ev3-emoji ev3-picker-emoji'+(x.icon===state.icon?' is-selected':'')+'" data-ev3-icon="'+escapeHTML(x.icon)+'" aria-label="'+escapeHTML(x.label)+'" title="'+escapeHTML(x.label)+'" aria-pressed="'+(x.icon===state.icon)+'">'+x.icon+'<small>'+escapeHTML(x.label)+'</small></button>').join(""):'<p class="ev3-icon-empty">Aucune icône correspondante. Essaie un autre mot.</p>';
}
function iconPickerHTML(){
 return '<section class="ev3-icon-picker" id="ev3IconPicker" '+(!state.iconPickerOpen?'hidden ':'')+'aria-label="Choisir une icône">'+
 '<div class="ev3-picker-heading"><strong>Choisir une icône</strong><button type="button" data-ev3-picker-close aria-label="Fermer les icônes">×</button></div>'+
 '<div class="ev3-picker-categories" role="group" aria-label="Catégories">'+iconGroups.map(([key,name])=>'<button type="button" class="'+(state.iconCategory===key?'is-active':'')+'" data-ev3-icon-group="'+key+'" aria-pressed="'+(state.iconCategory===key)+'">'+name+'</button>').join("")+'</div>'+
 '<label class="ev3-icon-search">Rechercher dans les icônes<input id="ev3IconSearch" type="search" autocomplete="off" placeholder="Ex. danse, café, vélo…" value="'+escapeHTML(state.iconQuery)+'"></label>'+
 '<div class="ev3-icon-results" id="ev3IconResults">'+iconResultsHTML()+'</div></section>';
}
function scheduleDetailsHTML(){
 return state.mode==="fixed"?'<label>Heure du rendez-vous<input name="time" type="time" required value="'+escapeHTML(state.time)+'"></label>':
 '<p class="ev3-hint">Les dates disponibles suivent les fins de service de ton planning.</p>';
}
function composerProgressHTML(){
 return '<div class="ev3-composer-progress" id="ev3ComposerProgress" aria-live="polite"></div>'+
 '<p class="ev3-compose-feedback" id="ev3ComposeFeedback" aria-live="polite" role="status"></p>';
}
function updateComposerProgress(){
 const node=byId("ev3ComposerProgress");if(!node)return;
 const ico=state.icon?escapeHTML(state.icon)+' '+escapeHTML(iconLabel(state.icon)):'Icône à choisir';
 node.innerHTML='<span>'+ico+'</span><span>'+state.dates.size+' date'+(state.dates.size>1?'s':'')+'</span>'+
 '<span>'+((state.visibility==="team")?'Toute l’équipe':state.guests.size+' invité'+(state.guests.size>1?'s':''))+'</span>';
}
function refreshIconSelection(){
 const selected=byId("ev3ChosenIcon");
 if(selected){selected.hidden=!state.icon;selected.textContent=state.icon?'Icône retenue : '+state.icon+' '+iconLabel(state.icon):'';}
 document.querySelectorAll('#ev3Compose [data-ev3-icon]').forEach(button=>{
  const active=button.dataset.ev3Icon===state.icon;
  button.classList.toggle("is-selected",active);button.setAttribute("aria-pressed",String(active));
 });
 updateComposerProgress();
}
function showIconPicker(open){
 state.iconPickerOpen=Boolean(open);
 const picker=byId("ev3IconPicker");
 if(picker)picker.hidden=!state.iconPickerOpen;
 const trigger=byId("ev3IconPickerToggle");
 trigger?.setAttribute("aria-expanded",String(state.iconPickerOpen));
}
function updateIconResults(){
 const results=byId("ev3IconResults");
 if(results)results.innerHTML=iconResultsHTML();
 document.querySelectorAll('#ev3IconPicker [data-ev3-icon-group]').forEach(button=>{
  const active=button.dataset.ev3IconGroup===state.iconCategory;
  button.classList.toggle("is-active",active);button.setAttribute("aria-pressed",String(active));
 });
}
function refreshDatePicker(){
 const el=byId("ev3DatePicker");
 if(el)el.innerHTML=calendarHTML();
 updateComposerProgress();
}
function setActivitySchedule(next){
 if(next!=="fixed"&&next!=="afterwork")return;
 const f=byId("ev3Compose");
 state.time=f?.elements.time?.value||state.time;
 state.mode=next;
 if(next==="afterwork"){
  const days=new Map(state.calendar.map(x=>[x.date,x]));
  for(const date of state.dates){const meta=days.get(date);if(state.calendarPreviewReady?!validClock(meta?.end):meta?.is_working===false)state.dates.delete(date);}
 }
 document.querySelectorAll('#ev3Compose [data-ev3-schedule]').forEach(button=>{
  const active=button.dataset.ev3Schedule===next;
  button.classList.toggle("is-active",active);button.setAttribute("aria-pressed",String(active));
 });
 const details=byId("ev3ScheduleDetails");
 if(details)details.innerHTML=scheduleDetailsHTML();
 const time=details?.querySelector('[name="time"]');
 if(time)time.addEventListener("input",()=>state.time=time.value);
 refreshDatePicker();
}
function formHTML(){
 if(state.formKind==="carpool"){
  const p=state.pref||{};
  return '<section class="ev3-panel"><h2>🚗 Proposer un trajet</h2><p>Un trajet, une date, un horaire.</p>'+
  '<button type="button" class="ev3-return-activity" data-ev3-mode="activity">← Proposer une activité à la place</button><form id="ev3CarForm"><div class="ev3-two"><label>Je souhaite<select name="kind"><option value="offer" '+(!p.has_car?"disabled":"")+' >Proposer des places</option><option value="request" '+(!p.has_car?"selected":"")+' >Chercher une place</option></select></label><label>Trajet<select name="direction"><option value="from_work">Retour du travail</option><option value="to_work">Aller au travail</option></select></label></div>'+
  '<div class="ev3-two"><label>Date<input name="date" type="date" required min="'+today+'"></label><label>Heure<input name="time" type="time" required></label></div><label>Places<select name="seats">'+[1,2,3,4,5,6].map(n=>'<option value="'+n+'">'+n+'</option>').join("")+'</select></label>'+
  '<label>Point de rendez-vous<input name="meeting_point" maxlength="200"></label><label>Précisions<textarea name="note" rows="2" maxlength="400"></textarea></label><button type="submit" class="ev3-primary">Proposer le trajet</button></form></section>';
 }
 const iconButtons=choices.map(([ic,title])=>'<button type="button" class="ev3-emoji '+(state.icon===ic?"is-selected":"")+'" data-ev3-icon="'+escapeHTML(ic)+'" aria-label="'+escapeHTML(title)+'" aria-pressed="'+(state.icon===ic)+'" title="'+escapeHTML(title)+'">'+ic+'</button>').join("");
 return '<section class="ev3-panel ev3-activity-create"><div class="ev3-section-title"><h2>Proposer une activité</h2><small>Quelques choix, et c’est prêt.</small></div>'+
 '<form id="ev3Compose">'+
 '<div class="ev3-form-step"><label class="ev3-form-title">1. Ton activité <small>Un pictogramme pour reconnaître la proposition</small></label>'+
 '<div class="ev3-icons">'+iconButtons+'<button type="button" class="ev3-emoji ev3-custom" id="ev3IconPickerToggle" data-ev3-custom aria-label="Voir toutes les icônes" aria-expanded="'+state.iconPickerOpen+'" aria-controls="ev3IconPicker">＋</button></div>'+
 '<p class="ev3-icon-chosen" id="ev3ChosenIcon" '+(!state.icon?'hidden':'')+'>'+ (state.icon?'Icône retenue : '+escapeHTML(state.icon)+' '+escapeHTML(iconLabel(state.icon)):'')+'</p>'+
 iconPickerHTML()+
 '<label>Nom de l’activité <small>(obligatoire)</small><input name="title" required maxlength="120" placeholder="Ex. Foot à 5, muscu après le travail…" value="'+escapeHTML(state.title)+'"></label></div>'+
 '<div class="ev3-form-step"><label class="ev3-form-title">2. Quand ?</label><div class="ev3-switch" role="group" aria-label="Choix de l’horaire">'+
 '<button type="button" class="'+(state.mode==="afterwork"?"is-active":"")+'" data-ev3-schedule="afterwork" aria-pressed="'+(state.mode==="afterwork")+'">🕔 À la fin du service</button>'+
 '<button type="button" class="'+(state.mode==="fixed"?"is-active":"")+'" data-ev3-schedule="fixed" aria-pressed="'+(state.mode==="fixed")+'">🕒 Heure précise</button></div>'+
 '<div id="ev3ScheduleDetails">'+scheduleDetailsHTML()+'</div></div>'+
 '<div class="ev3-form-step"><label class="ev3-form-title">3. Les dates</label><div id="ev3DatePicker">'+calendarHTML()+'</div></div>'+
 '<div class="ev3-form-step ev3-form-optional"><label>Lieu <small>(facultatif)</small><input name="location" maxlength="240" placeholder="À définir ensemble" value="'+escapeHTML(state.place)+'"></label>'+
 '<label>Quelques précisions <small>(facultatif)</small><textarea name="description" maxlength="2000" rows="2">'+escapeHTML(state.details)+'</textarea></label></div>'+
 '<div class="ev3-form-step"><label class="ev3-form-title">4. Avec qui ?</label>'+peopleHTML()+
 '<label class="ev3-inline ev3-open-team"><input type="checkbox" name="public" '+(state.visibility==="team"?"checked":"")+'> Ouvert à toute l’équipe</label></div>'+
 '<div class="ev3-compose-footer">'+composerProgressHTML()+
 '<button type="submit" class="ev3-primary" '+(!state.calendarLoaded||!state.peopleLoaded?'disabled aria-label="Chargement des disponibilités et des collègues"':'')+'>Envoyer la proposition →</button></div></form></section>';
}
function loadingHTML(label="Chargement des rendez-vous…"){
 return '<section class="ev3-loading" role="status" aria-live="polite"><span class="ev3-loading-caption">'+escapeHTML(label)+'</span>'+
  '<div class="ev3-loading-card"><i></i><span><b></b><small></small></span></div>'+
  '<div class="ev3-loading-card"><i></i><span><b></b><small></small></span></div></section>';
}
function render(){
 const app=byId("ensembleV3");if(!app)return;
 const pending=state.events.filter(e=>e.needs_response&&e.status==="active").length;
 app.innerHTML='<header class="ev3-header"><a href="index.html#/home" class="ev3-back" aria-label="Retour à GHE">‹ GHE</a><div><small>ENTRE COLLÈGUES · GHE</small><h1>On se retrouve</h1></div><button type="button" data-ev3-refresh title="Actualiser" aria-label="Actualiser">↻</button></header>'+
 '<div class="ev3-header-actions">'+(state.tab!=="create"?'<button type="button" class="ev3-primary" data-ev3-tab="create"><span aria-hidden="true">＋</span> Proposer une activité</button>':'<button type="button" data-ev3-tab="agenda">← Voir les propositions</button>')+'</div>'+
 '<nav class="ev3-tabs ev3-community-tabs" aria-label="On se retrouve"><button type="button" class="'+(state.tab==="agenda"?"is-current":"")+'" data-ev3-tab="agenda" aria-current="'+(state.tab==="agenda"?"page":"false")+'">🎉 Sorties</button><button type="button" class="'+(state.tab==="availability"?"is-current":"")+'" data-ev3-tab="availability" aria-current="'+(state.tab==="availability"?"page":"false")+'">📅 Dispos</button><button type="button" class="'+(state.tab==="invitations"?"is-current":"")+'" data-ev3-tab="invitations" aria-current="'+(state.tab==="invitations"?"page":"false")+'">✉️ Invitations'+(pending?'<span class="ev3-tab-count">'+pending+'</span>':'')+'</button><button type="button" class="'+(state.tab==="trips"?"is-current":"")+'" data-ev3-tab="trips" aria-current="'+(state.tab==="trips"?"page":"false")+'">🚗 Trajets</button></nav>'+
 '<p id="ev3Feedback" class="ev3-feedback '+(state.error?"is-error":"")+'" role="status">'+escapeHTML(state.status)+'</p>'+
 (state.tab==="create"?formHTML():state.tab==="trips"?tripsHTML():state.tab==="availability"?availabilityHTML():!state.loaded?loadingHTML():
  state.eventsError?'<div class="ev3-quiet-empty is-error"><strong>Rendez-vous momentanément indisponibles.</strong><span>'+escapeHTML(state.eventsError)+'</span><button type="button" data-ev3-refresh>Réessayer</button></div>':chosenCards())+
 '<dialog id="ev3Dialog" class="ev3-dialog" aria-label="Détails de l’activité"></dialog>';
 bind();
}
function bind(){
 document.querySelectorAll("[data-ev3-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.ev3Tab;if(state.tab==="create")state.formKind="activity";state.agendaFilter="all";state.status="";render()});
 bindAvailability();
 byId("ensembleV3")?.querySelectorAll("[data-ev3-refresh]").forEach(b=>b.addEventListener("click",refresh));
 byId("ensembleV3")?.querySelectorAll("[data-ev3-open]").forEach(b=>b.onclick=()=>openEvent(b.dataset.ev3Open));
 byId("ensembleV3")?.querySelectorAll("[data-ev3-mode]").forEach(b=>b.onclick=()=>{if(b.dataset.ev3Mode==="carpool"&&!state.pref?.opted_in){state.tab="trips";message("Active le covoiturage en indiquant ton secteur.");render();return}state.formKind=b.dataset.ev3Mode;state.tab="create";render()});
 // One delegated handler: choosing icons and dates never rebuilds the whole page
 // (which used to move the viewport and close the Android keyboard).
 const creator=byId("ev3Compose");
 if(creator){
  creator.addEventListener("click",event=>{
   const icon=event.target.closest("[data-ev3-icon]");
   if(icon){
    const selected=icon.dataset.ev3Icon;
    if(!isCatalogIcon(selected))return;
    state.icon=selected;showIconPicker(false);refreshIconSelection();return;
   }
   if(event.target.closest("[data-ev3-custom]")){
    showIconPicker(!state.iconPickerOpen);return;
   }
   if(event.target.closest("[data-ev3-picker-close]")){showIconPicker(false);return;}
   const group=event.target.closest("[data-ev3-icon-group]");
   if(group){state.iconCategory=group.dataset.ev3IconGroup;updateIconResults();return;}
   const schedule=event.target.closest("[data-ev3-schedule]");
   if(schedule){setActivitySchedule(schedule.dataset.ev3Schedule);return;}
   const month=event.target.closest("[data-ev3-month]");
   if(month){state.month=new Date(state.month.getFullYear(),state.month.getMonth()+Number(month.dataset.ev3Month),1);refreshDatePicker();return;}
   const all=event.target.closest("[data-ev3-all]");
   if(all){
    const select=all.dataset.ev3All==="1",y=state.month.getFullYear(),m=state.month.getMonth();
    for(let day=1;day<=new Date(y,m+1,0).getDate();day++){
     const d=dateISO(new Date(y,m,day));if(d<today)continue;
     const meta=state.calendar.find(x=>x.date===d);
     if(select&&state.mode==="afterwork"&&(state.calendarPreviewReady?!validClock(meta?.end):meta?.is_working===false))continue;
     if(select){if(state.dates.size<62)state.dates.add(d)}else state.dates.delete(d);
    }
    refreshDatePicker();return;
   }
   const day=event.target.closest("[data-ev3-day]");
   if(day){
    const date=day.dataset.ev3Day;
    if(state.dates.has(date))state.dates.delete(date);
    else if(state.dates.size<62)state.dates.add(date);
    else {message("62 dates maximum.",true);return;}
    const selected=state.dates.has(date);
    day.classList.toggle("is-selected",selected);
    day.setAttribute("aria-pressed",String(selected));
    const count=byId("ev3SelectedDateCount");
    if(count)count.textContent=state.dates.size+" jour"+(state.dates.size>1?"s":"");
    updateComposerProgress();
   }
  });
  const iconSearch=byId("ev3IconSearch");
  if(iconSearch)iconSearch.oninput=()=>{state.iconQuery=iconSearch.value;updateIconResults();};
 }
 updateComposerProgress();
 const search=byId("ev3PeopleSearch");if(search)search.oninput=()=>{byId("ev3PeopleList").innerHTML=peopleOptions(search.value);bindPeople()};
 bindPeople();
 const f=byId("ev3Compose");if(f){f.elements.public.onchange=()=>{state.visibility=f.elements.public.checked?"team":"invite";updateComposerProgress();};f.elements.title.oninput=()=>state.title=f.elements.title.value;if(f.elements.location)f.elements.location.oninput=()=>state.place=f.elements.location.value;if(f.elements.description)f.elements.description.oninput=()=>state.details=f.elements.description.value;if(f.elements.time)f.elements.time.oninput=()=>state.time=f.elements.time.value;f.onsubmit=submitActivity;}
 const pf=byId("ev3Prefs");if(pf)pf.onsubmit=async e=>{e.preventDefault();const b=pf.querySelector("button[type=submit]");b.disabled=true;try{const j=await call("carpool_preferences",{opted_in:true,sector:pf.elements.sector.value.trim(),has_car:pf.elements.has_car.checked});Object.assign(state,{pref:j.preference,trips:j.trips});message("Covoiturage activé.");render()}catch(err){message(err.message,true);b.disabled=false}};
 const cf=byId("ev3CarForm");if(cf)cf.onsubmit=submitTrip;
 byId("ensembleV3")?.querySelectorAll("[data-ev3-trip-act]").forEach(b=>b.onclick=async()=>{if(b.dataset.ev3TripAct==="carpool_cancel"&&!confirm("Annuler ce trajet ?"))return;b.disabled=true;try{const j=await call(b.dataset.ev3TripAct,{trip_id:b.dataset.trip,target_agent_id:b.dataset.peer,decision:b.dataset.decision});state.trips=j.trips||[];message("Trajet mis à jour.");render()}catch(err){message(err.message,true);b.disabled=false}});
}
function bindAvailabilityPeople(){
 byId("ev3AvailabilityPeople")?.querySelectorAll("[data-ev3-availability-person]").forEach(input=>input.onchange=()=>{
  if(input.checked&&state.availabilitySelected.size<3)state.availabilitySelected.add(input.dataset.ev3AvailabilityPerson);
  else state.availabilitySelected.delete(input.dataset.ev3AvailabilityPerson);
  state.availabilityMatches.clear();state.availabilityResultsReady=false;state.availabilityError="";
  render();
 });
}
function bindAvailability(){
 const search=byId("ev3AvailabilitySearch");
 if(search)search.oninput=()=>{state.availabilityQuery=search.value;const list=byId("ev3AvailabilityPeople");if(list){list.innerHTML=availabilityPeopleHTML();bindAvailabilityPeople()}};
 bindAvailabilityPeople();
 const compare=byId("ensembleV3")?.querySelector("[data-ev3-compare]");
 if(compare)compare.onclick=async()=>{
  if(state.availabilityBusy||!state.availabilitySelected.size)return;
  const ids=[...state.availabilitySelected];
  state.availabilityBusy=true;state.availabilityResultsReady=false;state.availabilityError="";render();
  const replies=await Promise.allSettled(ids.map(id=>call("matches",{target_agent_id:id})));
  state.availabilityBusy=false;state.availabilityMatches.clear();
  let errors=0;
  replies.forEach((reply,i)=>{if(reply.status==="fulfilled")state.availabilityMatches.set(ids[i],reply.value.days||[]);else errors++});
  state.availabilityResultsReady=true;
  if(errors)state.availabilityError=errors+" comparaison(s) indisponible(s). Actualise pour réessayer.";
  render();
 };
 byId("ensembleV3")?.querySelectorAll("[data-ev3-plan-day]").forEach(button=>button.onclick=()=>{
  const date=button.dataset.ev3PlanDay;
  const names=[...state.availabilityMatches].flatMap(([id,days])=>days.filter(d=>d.date===date).map(day=>({...day,id})));
  if(!names.length)return;
  state.guests=new Set(names.map(d=>d.id));
  state.dates=new Set([date]);
  const [year,month]=date.split("-").map(Number);
  state.month=new Date(year,month-1,1);
  state.mode=names.every(d=>d.my_end===d.peer_end)?"afterwork":"fixed";
  state.time="";state.formKind="activity";state.tab="create";state.agendaFilter="all";state.status="";render();
 });
}
function persistTitle(){const f=byId("ev3Compose");if(!f)return;state.title=f.elements.title.value||"";state.time=f.elements.time?.value||"";state.place=f.elements.location?.value||"";state.details=f.elements.description?.value||""}
function bindPeople(){
 byId("ev3PeopleList")?.querySelectorAll("[data-ev3-person]").forEach(input=>input.onchange=()=>{
  if(input.checked)state.guests.add(input.dataset.ev3Person);else state.guests.delete(input.dataset.ev3Person);
  const counter=byId("ev3PeopleCount");if(counter)counter.textContent=state.guests.size+" sélectionné(s)";updateComposerProgress();
 });
}
async function submitActivity(ev){
 ev.preventDefault();const f=ev.currentTarget;
 if(!isCatalogIcon(state.icon))return message("Choisis une icône dans la liste.",true);
 if(!state.dates.size)return message("Sélectionne au moins une date.",true);
 if(!state.guests.size&&state.visibility!=="team")return message("Sélectionne au moins un collègue.",true);
 const title=String(f.elements.title.value||"").trim();
 if(!title){f.elements.title.focus();return message("Donne un titre à cette activité pour identifier clairement sa discussion.",true)}
 const submit=f.querySelector('[type="submit"]');submit.disabled=true;
 try{
  const result=await call("create_ensemble",{icon:state.icon,title,dates:[...state.dates].sort(),schedule_mode:state.mode,
   time_label:state.mode==="afterwork"?"À la fin du service":f.elements.time?.value||"Horaire à définir",visibility:state.visibility,
   location:f.elements.location.value,description:f.elements.description.value,agent_ids:[...state.guests]});
  state.events=result.events||[];
  state.dates.clear();state.guests.clear();state.title="";state.icon="";state.time="";state.place="";state.details="";state.iconPickerOpen=false;state.iconCategory="all";state.iconQuery="";state.tab="agenda";
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
 d.addEventListener("close",()=>{if(pendingVisualRefresh)renderWhenIdle()},{once:true});
}
function closeModal(){
 const inline=byId("ev3InlineEvent");
 if(inline){
  inline.remove();
  const url=new URL(location.href);
  url.searchParams.delete("event");
  history.replaceState(history.state,"",url.pathname+url.search+url.hash);
 }
 const d=byId("ev3Dialog");if(d?.open)d.close();
}
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
function openEvent(id,{inline=false}={}){
 const event=state.events.find(x=>x.id===id);if(!event)return;
 if(!inline)byId("ev3InlineEvent")?.remove();
 const ds=activeDates(event),allDays=(event.dates||[]).filter(day=>day>=today),choice=event.response?.selected_dates||[];
 const [tone,status]=kindStatus(event),isOrganizer=!!event.is_organizer;
 const dialogEl=inline?document.createElement("section"):dialog(id);
 if(inline){
  byId("ev3InlineEvent")?.remove();
  dialogEl.id="ev3InlineEvent";
  dialogEl.className="ev3-dialog ev3-inline-detail";
  byId("ensembleV3")?.insertAdjacentElement("beforebegin",dialogEl);
 }
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
 if(inline)requestAnimationFrame(()=>dialogEl.scrollIntoView({block:"start",behavior:"instant"}));
 else showActivityDialog(dialogEl);
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
 '<section class="ev3-modal-section"><strong>Ajouter des collègues</strong><input id="ev3InviteSearch" type="search" placeholder="Rechercher un collègue" autocomplete="off"><div id="ev3InviteList" class="ev3-person-list"></div><p class="ev3-directory-hint">Tous les collègues éligibles peuvent être invités, sans activation préalable de l’application Sorties &amp; trajets.</p></section>'+
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
 const sequence=++refreshSequence;
 const current=()=>sequence===refreshSequence;
 const renderCurrent=()=>{if(current())renderWhenIdle()};
 const jobs=[
  call("list").then(j=>{
   if(!current())return;
   state.events=j.events||[];
   state.loaded=true;state.eventsError="";state.error="";state.status="";
   renderCurrent();
   const id=new URLSearchParams(location.search).get("event");
   if(id&&!deepLinked&&state.events.some(e=>e.id===id)){
    deepLinked=true;openEvent(id,{inline:true});
   }
  }).catch(err=>{
   if(!current())return;
   state.loaded=true;state.eventsError=err.message;state.error=err.message;state.status=err.message;renderCurrent();
  }),
  call("calendar").then(j=>{
   if(!current())return;
   state.calendar=(j.days||[]).map(day=>({...day,end:state.previewEnds.get(day.date)||day.end||null}));
   state.calendarLoaded=true;state.calendarError="";renderCurrent();
  }).catch(()=>{
   if(!current())return;
   state.calendarLoaded=false;state.calendarError="Planning indisponible. Actualise pour choisir tes dates.";renderCurrent();
  }),
  call("colleagues").then(j=>{
   if(!current())return;
   state.people=j.colleagues||[];state.peopleLoaded=true;state.peopleError="";
   if(entryGuestId&&!guestEntryResolved){
    guestEntryResolved=true;
    const guest=state.people.find(p=>String(p.id)===entryGuestId&&p.can_invite!==false);
    if(guest)state.guests.add(guest.id);
    else state.status="Choisis le collègue à inviter dans la liste.";
   }
   renderCurrent();
  }).catch(()=>{
   if(!current())return;
   state.peopleLoaded=false;state.peopleError="Annuaire indisponible. Actualise pour inviter des collègues.";renderCurrent();
  }),
  call("carpool_home").then(j=>{
   if(!current())return;
   state.trips=j.trips||[];state.pref=j.preference||null;state.tripError="";state.tripLoaded=true;
   if(entryCarpoolChoice==="driver"&&!carpoolEntryResolved){
    carpoolEntryResolved=true;
    if(state.pref?.opted_in){state.formKind="carpool";state.tab="create";}
    else {state.tab="trips";state.status="Active le covoiturage pour proposer un trajet."}
   }
   renderCurrent();
  }).catch(()=>{
   if(!current())return;
   state.tripLoaded=true;state.tripError="Impossible de charger les trajets. Actualise la page.";renderCurrent();
  }),
  call("calendar_preview",{start:today,days:123}).then(j=>{
   if(!current())return;
   state.previewEnds=new Map((j.shifts||[]).map(x=>[x.date,x.end]));
   state.calendarPreviewReady=true;
   state.calendar=state.calendar.map(x=>({...x,end:state.previewEnds.get(x.date)||null}));
   if(state.mode==="afterwork"&&state.calendarLoaded){
    const byDate=new Map(state.calendar.map(x=>[x.date,x]));
    for(const day of state.dates)if(!validClock(byDate.get(day)?.end))state.dates.delete(day);
   }
   renderCurrent();
  }).catch(()=>{
   if(!current())return;
   state.calendarPreviewReady=false;renderCurrent();
  })
 ];
 await Promise.allSettled(jobs);
}
function setView(view){state.agendaFilter=view==="invitations"?"invitations":"all";state.tab=view==="trips"?"trips":view==="availability"?"availability":view==="invitations"?"invitations":"agenda";state.status="";render()}
function openCreator(){state.formKind="activity";state.agendaFilter="all";state.tab="create";render()}
window.STIPEnsembleV3={refresh,openEvent,setView,openCreator};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{render();void refresh()},{once:true});
else{render();void refresh()}
window.addEventListener("pageshow",e=>{if(e.persisted)refresh()});
})();