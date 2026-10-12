(() => {
 "use strict";
 const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure";
 const initial=new URLSearchParams(location.search).get("with")||"";
 const state={agents:[],target:initial,days:[],day:"",loading:false,ready:false};
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const label=x=>new Date(x+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
 async function call(action,body={}){
  const token=localStorage.getItem("stip_session_v1");if(!token)throw Error("Connexion GHE requise.");
  const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-stip-session":token},body:JSON.stringify({action,...body})});
  const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw Error(j.error||"Erreur réseau.");return j;
 }
 const panelHTML=()=>'<section id="awPanel" class="aw-panel stip-surface"><h2>🏃 Après le travail</h2><p>Retrouve les prochaines fins de service compatibles et propose une activité.</p>'+
  '<form id="awForm" class="aw-form"><label>Collègue<select name="target" required id="awTarget"><option value="">Choisir un collègue</option></select></label>'+
  '<div id="awDays" aria-live="polite"></div>'+
  '<label>Activité<input name="title" maxlength="120" required placeholder="Musculation, boxe, restaurant…"></label>'+
  '<label>Lieu ou adresse<input name="location" maxlength="240" placeholder="À fixer"></label>'+
  '<label>Heure du rendez-vous<input name="time_label" maxlength="240" placeholder="Après le service"></label>'+
  '<label>Précisions<textarea name="description" maxlength="2000" rows="2"></textarea></label>'+
  '<p id="awStatus" role="status" aria-live="polite"></p><button class="stip-btn" type="submit" id="awSubmit">Envoyer l’invitation</button></form></section>';
 function show(){
  const host=document.getElementById("awDays");if(!host)return;
  if(!state.target){host.textContent="Choisis un collègue pour comparer vos horaires.";return;}
  if(state.loading){host.textContent="Recherche des horaires…";return;}
  if(!state.days.length){host.textContent="Aucune fin de service compatible sur les 31 prochains jours. Tu peux proposer une sortie ouverte ci-dessous.";return;}
  host.innerHTML='<strong>Dates compatibles (30 minutes maximum d’écart)</strong><div class="aw-slots">'+state.days.map(x=>
   '<button type="button" data-aw-day="'+esc(x.date)+'" class="aw-slot'+(state.day===x.date?' selected':'')+'">'+esc(label(x.date))+'<small>'+esc(x.my_end)+' / '+esc(x.peer_end)+'</small></button>').join("")+'</div>';
  host.querySelectorAll("[data-aw-day]").forEach(b=>b.onclick=()=>{state.day=b.dataset.awDay||"";const row=state.days.find(x=>x.date===state.day),field=document.querySelector('#awForm [name="time_label"]');if(row&&field&&!field.value.trim()){const [h,m]=(row.my_end>row.peer_end?row.my_end:row.peer_end).split(":").map(Number);const t=(h*60+m+20)%1440;field.value=String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0");}show();});
 }
 async function getDays(){
  const target=state.target;state.loading=true;state.days=[];state.day="";show();
  try{const r=await call("matches",{target_agent_id:target});if(target!==state.target)return;state.days=r.days||[];state.day=state.days[0]?.date||"";}
  catch(e){const el=document.getElementById("awStatus");if(el)el.textContent=e.message||"Erreur";}
  finally{if(target===state.target){state.loading=false;show();}}
 }
 async function load(){
  if(state.ready||state.loading)return;
  state.loading=true;show();
  try{const r=await call("colleagues");state.agents=r.colleagues||[];state.ready=true;
   const s=document.getElementById("awTarget");if(!s)return;
   s.innerHTML='<option value="">Choisir un collègue</option>'+state.agents.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("");
   if(!state.agents.some(x=>x.id===state.target))state.target="";s.value=state.target;
  }catch(e){const el=document.getElementById("awStatus");if(el)el.textContent=e.message||"Erreur";}
  finally{state.loading=false;show();if(state.target)await getDays();}
 }
 function bindPanel(){
  const form=document.getElementById("awForm");if(!form)return;
  const select=document.getElementById("awTarget");
  if(state.ready){select.innerHTML='<option value="">Choisir un collègue</option>'+state.agents.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("");select.value=state.target;}
  select.onchange=()=>{state.target=select.value;state.days=[];state.day="";if(state.target)getDays();else show();};
  form.onsubmit=async e=>{e.preventDefault();const message=document.getElementById("awStatus"),send=document.getElementById("awSubmit");if(!state.target||!state.day){message.textContent="Choisis un collègue et une date.";return;}
   send.disabled=true;message.textContent="Envoi…";
   try{await call("propose",{target_agent_id:state.target,date:state.day,title:form.elements.title.value,location:form.elements.location.value,time_label:form.elements.time_label.value,description:form.elements.description.value});
    await window.STIPLeisure?.refresh?.();const banner=document.getElementById("leisureStatus");if(banner)banner.textContent="Invitation enregistrée. Elle figure dans les sorties."; }
   catch(err){message.textContent=err.message||"Envoi impossible.";}finally{send.disabled=false;}
  };
  show();if(!state.ready)load();else if(state.target&&!state.days.length&&!state.loading)getDays();
 }
 window.STIPAfterwork={panelHTML,bindPanel};
})();