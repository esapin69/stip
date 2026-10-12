(() => {
  "use strict";
  if (window.STIPTrainingRecurring) return;
  const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure";
  const $=q=>document.querySelector(q),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const label=date=>new Date(date+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
  const state={open:false,loaded:false,busy:false,days:[],colleagues:[],selected:new Set(),filter:"",status:"",error:""};
  async function call(action,payload={}){
    const token=localStorage.getItem("stip_session_v1");if(!token)throw Error("Connexion GHE requise.");
    const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","X-STIP-Session":token},body:JSON.stringify({action,...payload})});
    const json=await r.json().catch(()=>({}));if(!r.ok||json.error)throw Error(json.error||"Impossible de charger.");
    return json;
  }
  function renderPeople(){
   const area=$("#trainingRecPeople");if(!area)return;
   const term=state.filter.toLocaleLowerCase("fr"),visible=state.colleagues.filter(x=>x.name.toLocaleLowerCase("fr").includes(term));
   area.innerHTML=visible.map(person=>'<label class="training-person"><input type="checkbox" data-training-person="'+esc(person.id)+'" '+(state.selected.has(person.id)?'checked':'')+'><span>'+esc(person.name)+'</span></label>').join("")||"<p>Aucun collègue trouvé.</p>";
   $("#trainingRecCount").textContent=state.selected.size+" collègue(s) sélectionné(s)";
   area.querySelectorAll("[data-training-person]").forEach(el=>el.onchange=()=>{
     if(el.checked){if(state.selected.size>=24){el.checked=false;return;}state.selected.add(el.dataset.trainingPerson);}
     else state.selected.delete(el.dataset.trainingPerson);
     $("#trainingRecCount").textContent=state.selected.size+" collègue(s) sélectionné(s)";
   });
  }
  function render(){
   const root=$("#trainingRecurringApp");if(!root)return;
   const existing=(window.STIPLeisureRecurringExisting||[]);
   root.innerHTML='<section class="training-section stip-surface"><div class="training-head"><span aria-hidden="true">🔁</span><div><h2>Une activité à chaque fermeture</h2><p>Muscu, boxe, foot… Tu es partant par défaut après tes services du soir. Tes collègues choisissent librement les dates où ils te rejoignent.</p></div></div>'+
     '<button type="button" class="stip-btn" id="trainingOpen">'+(state.open?"Masquer la préparation":"Créer mon invitation permanente")+'</button>'+
     (state.open?'<div class="training-content">'+(state.error?'<p class="training-error" role="alert">'+esc(state.error)+'</p>':'')+
       (!state.loaded?'<p>Recherche de tes prochaines fermetures…</p>':
       '<form id="trainingCreate" class="training-form" data-stip-form-mode="standard"><p class="training-brief"><strong>'+state.days.length+' journées finissant à 21 h</strong> détectées sur les 31 prochains jours. Tu seras disponible par défaut à chacune. Tu pourras ensuite te retirer d’une date depuis la fiche.</p>'+
       '<div class="training-days">'+state.days.map(date=>'<span>✓ '+esc(label(date))+'</span>').join("")+'</div>'+
       '<label>Activité<div class="training-shortcuts"><button type="button" data-training-shortcut="Muscu">💪 Muscu</button><button type="button" data-training-shortcut="Boxe">🥊 Boxe</button><button type="button" data-training-shortcut="Foot">⚽ Foot</button><button type="button" data-training-shortcut="">✏️ Autre</button></div><input name="title" value="Muscu après la fermeture" maxlength="120" required></label>'+
       '<label>Lieu (facultatif)<input name="location" maxlength="240" placeholder="Salle ou adresse à fixer"></label>'+
       '<label>Rendez-vous habituel<input name="time_label" maxlength="240" value="21:20" placeholder="Après la fermeture"></label>'+
       '<label>Précisions (facultatif)<textarea name="description" maxlength="2000" rows="2" placeholder="Chacun s’inscrit aux jours qui lui conviennent."></textarea></label>'+
       '<div class="training-pick"><label>Qui veux-tu inviter ?<input type="search" id="trainingRecSearch" placeholder="Rechercher un collègue"></label>'+
       '<div id="trainingRecPeople" class="training-people"></div><p id="trainingRecCount"></p></div>'+
       '<p id="trainingCreateStatus" role="status"></p><button type="submit" class="stip-btn" '+(!state.days.length?'disabled':'')+'>Envoyer une seule invitation récurrente</button></form>')+
       '</div>':'')+'</section>';
   $("#trainingOpen").onclick=async()=>{state.open=!state.open;render();if(state.open&&!state.loaded&&!state.busy)await load()};
   if(state.open&&state.loaded){
    renderPeople();
    $("#trainingRecSearch").value=state.filter;
    $("#trainingRecSearch").oninput=e=>{state.filter=e.target.value;renderPeople()};
    document.querySelectorAll("[data-training-shortcut]").forEach(button=>button.onclick=()=>{
     const title=$("#trainingCreate").elements.title;
     title.value=button.dataset.trainingShortcut?button.dataset.trainingShortcut+" après la fermeture":"";
     title.focus();
    });
    $("#trainingCreate").onsubmit=async e=>{
     e.preventDefault();
     const form=e.currentTarget,status=$("#trainingCreateStatus"),button=form.querySelector('[type="submit"]');
     if(!state.selected.size){status.textContent="Choisis au moins un collègue.";return;}
     button.disabled=true;status.textContent="Enregistrement…";
     try{
      await call("recurring_create",{
       title:form.elements.title.value,
       location:form.elements.location.value,
       time_label:form.elements.time_label.value,
       description:form.elements.description.value,
       agent_ids:[...state.selected]
      });
      state.open=false;state.error="";state.status="Entraînement récurrent créé. Les collègues invités choisiront leurs jours.";
      await window.STIPLeisure?.refresh?.();
      render();
      const statusArea=$("#leisureStatus");if(statusArea)statusArea.textContent=state.status;
     }catch(err){status.textContent=String(err.message||err);button.disabled=false;}
    };
   }
  }
  async function load(){
   if(state.busy)return;state.busy=true;
   try{
    const value=await call("recurring_preview");
    state.days=value.dates||[];state.colleagues=value.colleagues||[];
    state.loaded=true;state.error="";
   }catch(e){state.error=String(e.message||e);state.loaded=false}
   finally{state.busy=false;render()}
  }
  window.STIPTrainingRecurring={refresh:load};
  document.addEventListener("DOMContentLoaded",render,{once:true});
})();
