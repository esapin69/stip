(() => {
"use strict";
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure", MSG="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages";
const root=()=>document.querySelector("#carpoolApp");
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
const iso=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const state={preference:{opted_in:false,sector:"",has_car:false},trips:[],shifts:[],loaded:false,message:"",error:"",busy:false};
async function post(action,payload={},url=API){
 const token=localStorage.getItem("stip_session_v1");if(!token)throw Error("Connexion GHE requise.");
 const r=await fetch(url,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","X-STIP-Session":token},body:JSON.stringify({action,...payload})});
 const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw Error(j.error||"Une erreur est survenue.");return j;
}
function update(d){state.loaded=true;state.preference=d.preference||state.preference;state.trips=d.trips||[];state.shifts=d.shifts||[];}
async function refresh(){if(state.busy)return;state.busy=true;
 try{update(await post("carpool_home"));state.error="";}catch(e){state.error=e.message;}
 finally{state.busy=false;render();}
}
function tripCard(t){
 const own=t.is_mine,apps=t.applicants||[],waiting=apps.filter(a=>a.status==="pending"),confirmed=apps.filter(a=>a.status==="accepted");
 const label=t.kind==="offer"?"Propose des places":"Cherche une voiture";
 const spots=t.kind==="offer"?"Places restantes : "+t.spots_left:t.spots_left?"Conducteur recherché":"Conducteur confirmé";
 const application=t.my_status?({"pending":"En attente","accepted":"Confirmé","declined":"Refusé","withdrawn":"Retiré"}[t.my_status]||t.my_status):"";
 const action=(name,title,attrs="")=>'<button type="button" class="stip-btn secondary" data-cp-action="'+name+'" data-cp-trip="'+esc(t.id)+'" '+attrs+'>'+title+'</button>';
 const chat=id=>'<button type="button" class="stip-btn secondary" data-cp-chat="'+esc(id)+'">Discuter</button>';
 return '<article class="cp-trip stip-surface"><div class="cp-triphead"><strong>'+esc(label)+'</strong>'+(t.same_sector?'<small>Même secteur</small>':'')+'</div>'+
 '<p>'+esc(fmt(t.trip_date))+' · '+esc(t.departure_time)+' · '+(t.direction==="to_work"?"Aller au travail":"Retour du travail")+'</p>'+
 '<p>📍 '+esc(t.sector)+' · '+esc(t.organizer_name)+'</p><p class="cp-muted">'+esc(spots)+(application?" · "+esc(application):"")+(t.status==="cancelled"?" · Annulé":"")+'</p>'+
 (t.meeting_point?'<p>Point de rendez-vous : '+esc(t.meeting_point)+'</p>':'')+
 (t.note?'<p>'+esc(t.note)+'</p>':'')+
 '<div class="cp-actions">'+
 (!own&&!t.my_status&&t.spots_left>0&&t.status==="active"?action("carpool_apply",t.kind==="offer"?"Demander une place":"Proposer de conduire"):'')+
 (!own&&["pending","accepted"].includes(t.my_status)?action("carpool_withdraw","Me retirer"):'')+
 (own&&t.status==="active"?action("carpool_cancel","Annuler le trajet"):'')+
 (!own&&t.my_status==="accepted"&&t.peer_agent_id&&t.can_message?chat(t.peer_agent_id):"")+'</div>'+
 (own&&waiting.length?'<div class="cp-applicants"><strong>Demandes reçues</strong>'+waiting.map(a=>'<div><span>'+esc(a.name)+'</span>'+action("carpool_review","Accepter",'data-cp-agent="'+esc(a.agent_id)+'" data-cp-decision="accepted"')+action("carpool_review","Décliner",'data-cp-agent="'+esc(a.agent_id)+'" data-cp-decision="declined"')+'</div>').join("")+'</div>':'')+
 (own&&confirmed.length?'<div class="cp-applicants"><strong>Confirmés</strong>'+confirmed.map(a=>'<div><span>'+esc(a.name)+'</span>'+(t.can_message?chat(a.agent_id):'')+'</div>').join("")+'</div>':'')+'</article>';
}
function render(){
 if(!root())return;
 const p=state.preference;
 root().innerHTML='<header class="cp-head"><h2>🚗 Covoiturage</h2><p>Proposer une voiture ou chercher une place, pour venir ou repartir après le service.</p></header>'+
 (state.error?'<p class="cp-error" role="alert">'+esc(state.error)+'</p>':'')+
 (state.message?'<p class="cp-success" role="status">'+esc(state.message)+'</p>':'')+
 (!state.loaded?'<p>Chargement…</p>': '<section class="cp-card stip-surface"><h3>Mes préférences</h3><p class="cp-muted">Participation volontaire. Indique seulement une commune ou un quartier, jamais ton adresse.</p>'+
 '<form id="cpPref" data-stip-form-mode="standard" class="cp-form"><label>Mon secteur<input name="sector" maxlength="80" required value="'+esc(p.sector)+'" placeholder="Bron, Vénissieux, Lyon 8e…"></label>'+
 '<label class="cp-check"><input type="checkbox" name="has_car" '+(p.has_car?'checked':'')+'> J’ai une voiture et je peux proposer des places</label>'+
 '<div class="cp-actions"><button type="submit" class="stip-btn">'+(p.opted_in?"Mettre à jour":"Activer le covoiturage")+'</button>'+
 (p.opted_in?'<button type="button" class="stip-btn secondary" id="cpDisable">Me retirer</button>':'')+'</div></form></section>'+
 (p.opted_in?'<section class="cp-card stip-surface"><h3>Nouveau trajet</h3><form id="cpCreate" class="cp-form" data-stip-form-mode="standard">'+
 '<label>Je souhaite<select name="kind"><option value="offer"'+(!p.has_car?' disabled':'')+'>Proposer des places</option><option value="request"'+(!p.has_car?' selected':'')+'>Chercher un conducteur</option></select></label>'+
 '<label>Direction<select name="direction"><option value="from_work">Rentrer après le travail</option><option value="to_work">Aller au travail</option></select></label>'+
 '<label>Date<input type="date" name="date" min="'+esc(iso())+'" required></label>'+
 (state.shifts.length?'<label>Utiliser mon planning<select id="cpShift"><option value="">Choisir une journée (facultatif)</option>'+state.shifts.map(s=>'<option value="'+esc(s.date)+'">'+esc(fmt(s.date))+' · '+esc(s.code)+'</option>').join("")+'</select></label>':'')+
 '<label>Heure prévue<input type="time" name="time" required></label>'+
 '<label>Places proposées<select name="seats">'+[1,2,3,4,5,6].map(n=>'<option value="'+n+'">'+n+' place(s)</option>').join("")+'</select></label>'+
 '<label>Point de rendez-vous <small>(privé avant confirmation)</small><input name="meeting_point" maxlength="200" placeholder="Lieu public, arrêt de bus…"></label>'+
 '<label>Précisions <small>(privées avant confirmation)</small><textarea name="note" rows="2" maxlength="400"></textarea></label>'+
 '<button class="stip-btn" type="submit">Publier</button></form></section>'+
 '<section class="cp-card stip-surface"><h3>Trajets proposés</h3><p class="cp-muted">Ton secteur apparaît en priorité. Les horaires doivent être confirmés entre collègues.</p>'+
 (state.trips.length?state.trips.map(tripCard).join(""):'<p class="cp-muted">Aucun trajet proposé pour le moment.</p>')+'</section>':''));
 bind();
}
function bind(){
 const prefs=document.querySelector("#cpPref");
 if(prefs)prefs.onsubmit=async e=>{
  e.preventDefault();try{const d=await post("carpool_preferences",{opted_in:true,sector:prefs.elements.sector.value.trim(),has_car:prefs.elements.has_car.checked});update(d);state.error="";state.message="Préférences enregistrées.";render();}
  catch(err){state.error=err.message;render();}
 };
 const disable=document.querySelector("#cpDisable");
 if(disable)disable.onclick=async()=>{
  if(!confirm("Quitter le covoiturage ? Tes annonces seront annulées."))return;
  try{update(await post("carpool_preferences",{opted_in:false,sector:"",has_car:false}));state.message="Participation désactivée.";render();}catch(e){state.error=e.message;render();}
 };
 const form=document.querySelector("#cpCreate");
 if(form){
  const shift=document.querySelector("#cpShift");
  if(shift)shift.onchange=()=>{
   const row=state.shifts.find(s=>s.date===shift.value);if(!row)return;
   form.elements.date.value=row.date;
   const shiftTime=form.elements.direction.value==="from_work"?row.end:row.start;
   if(shiftTime){const [h,m]=shiftTime.split(":").map(Number),offset=form.elements.direction.value==="from_work"?15:-20,mins=(h*60+m+offset+1440)%1440;
    form.elements.time.value=String(Math.floor(mins/60)).padStart(2,"0")+":"+String(mins%60).padStart(2,"0");}
  };
  form.onsubmit=async e=>{
   e.preventDefault();const send=form.querySelector('button[type="submit"]');send.disabled=true;
   try{const f=new FormData(form),data=await post("carpool_create",{
    kind:f.get("kind"),direction:f.get("direction"),date:f.get("date"),time:f.get("time"),
    seats:Number(f.get("seats")),meeting_point:f.get("meeting_point")||"",note:f.get("note")||""
   });update(data);state.message="Trajet publié.";state.error="";render();}
   catch(err){state.error=err.message;render();}finally{send.disabled=false;}
  };
 }
 root().querySelectorAll("[data-cp-action]").forEach(button=>button.onclick=async()=>{
  if(button.dataset.cpAction==="carpool_cancel"&&!confirm("Annuler le trajet ?"))return;
  button.disabled=true;
  try{update(await post(button.dataset.cpAction,{trip_id:button.dataset.cpTrip,target_agent_id:button.dataset.cpAgent,decision:button.dataset.cpDecision}));state.error="";state.message="Réponse enregistrée.";render();}
  catch(e){state.error=e.message;render();}finally{button.disabled=false;}
 });
 root().querySelectorAll("[data-cp-chat]").forEach(button=>button.onclick=async()=>{
  try{button.disabled=true;const res=await post("direct",{agent_id:button.dataset.cpChat},MSG);
   if(!res.conversation?.id)throw Error("Conversation indisponible.");
   location.href="index.html?quick=communication&tab=dm&conversation="+encodeURIComponent(res.conversation.id)+"#/communication/dm";
  }catch(e){state.error=e.message;render();}
 });
}
window.STIPCarpool={refresh};
document.addEventListener("DOMContentLoaded",()=>{if(root())refresh();},{once:true});
window.addEventListener("stip:session-ready",()=>{if(root())refresh();});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&root())refresh();});
})();