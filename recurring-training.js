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
     if(el.checked){if(state.selected.size>=120){el.checked=false;return;}state.selected.add(el.dataset.trainingPerson);}
     else state.selected.delete(el.dataset.trainingPerson);
     $("#trainingRecCount").textContent=state.selected.size+" collègue(s) sélectionné(s)";
   });
  }
  function render(){
   const root=$("#trainingRecurringApp");if(!root)return;
   if(!state.open){root.innerHTML="";return;}
   const section=state.error?'<p class="training-error" role="alert">'+esc(state.error)+'</p>':'';
   const loading=state.busy&&!state.loaded;
   root.innerHTML='<section class="training-section stip-surface"><div class="training-head">'+
     '<span aria-hidden="true">🏋️</span><div><h2>Après mes fermetures</h2><p>Tu es disponible par défaut. Chaque invité choisit ses séances.</p></div></div>'+
     section+
     (loading?'<p role="status">Lecture de ton planning…</p>':
       !state.loaded?'<button class="ensemble-subtle" type="button" id="trainingRetry">Réessayer</button>':
       '<form id="trainingCreate" class="training-form" data-stip-form-mode="standard">'+
        '<div class="training-schedule"><strong>'+state.days.length+' dates possibles</strong><span>Selon ton planning · fermeture à 21 h</span></div>'+
        (state.days.length?'<div class="training-days">'+state.days.slice(0,4).map(date=>'<span>🟡 '+esc(label(date))+'</span>').join("")+
          (state.days.length>4?'<small>＋ '+(state.days.length-4)+' autres</small>':'')+'</div>':
          '<p class="training-error">Aucune fermeture prévue dans les 31 prochains jours. Réessaie après la mise à jour du planning.</p>')+
        '<label>Quelle activité ?<div class="training-shortcuts">'+
          '<button type="button" data-training-shortcut="Muscu">🏋️ Muscu</button>'+
          '<button type="button" data-training-shortcut="Boxe">🥊 Boxe</button>'+
          '<button type="button" data-training-shortcut="Foot">⚽ Foot</button>'+
          '<button type="button" data-training-shortcut="">✏️ Autre</button></div>'+
          '<input name="title" value="Muscu après la fermeture" maxlength="120" required aria-label="Titre de l’activité"></label>'+
        '<div class="training-pick"><label>Avec qui ?<input type="search" id="trainingRecSearch" placeholder="Chercher un collègue"></label>'+
        '<div class="training-select-tools"><button type="button" data-training-select-all>✓ Inviter tout le monde</button><button type="button" data-training-select-none>Tout retirer</button></div><div id="trainingRecPeople" class="training-people"></div><p id="trainingRecCount"></p></div>'+
        '<details class="training-options"><summary>Lieu, horaire et précisions</summary>'+
          '<label>Lieu (facultatif)<input name="location" maxlength="240" placeholder="Salle / adresse à fixer"></label>'+
          '<label>Heure de rendez-vous<input name="time_label" maxlength="240" value="21:20"></label>'+
          '<label>Un détail à préciser ?<textarea name="description" maxlength="2000" rows="2" placeholder="Chacun choisit les jours qui lui conviennent."></textarea></label>'+
        '</details>'+
        '<p id="trainingCreateStatus" role="status"></p>'+
        '<button type="submit" class="ensemble-primary" '+(!state.days.length?'disabled':'')+'>Inviter les collègues sélectionnés</button>'+
       '</form>')+
    '</section>';
   root.querySelector("#trainingRetry")?.addEventListener("click",()=>load());
   if(state.loaded){
    renderPeople();
    root.querySelector('[data-training-select-all]').onclick=()=>{
     state.colleagues.forEach(p=>state.selected.add(p.id));renderPeople();
    };
    root.querySelector('[data-training-select-none]').onclick=()=>{state.selected.clear();renderPeople()};
    $("#trainingRecSearch").value=state.filter;
    $("#trainingRecSearch").oninput=e=>{state.filter=e.target.value;renderPeople()};
    root.querySelectorAll("[data-training-shortcut]").forEach(button=>button.onclick=()=>{
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
      const data=new FormData(form);
      await call("recurring_create",{
       title:String(data.get("title")||"Muscu après la fermeture"),
       location:String(data.get("location")||""),
       time_label:String(data.get("time_label")||"21:20"),
       description:String(data.get("description")||""),
       agent_ids:[...state.selected]
      });
      state.open=false;state.error="";state.status="Invitation créée. Chaque collègue peut choisir ses dates.";
      state.selected.clear();state.loaded=false;render();
      await window.STIPLeisure?.refresh?.();
      window.STIPLeisure?.closeCreator?.();
      const area=$("#leisureStatus");if(area)area.textContent=state.status;
     }catch(err){status.textContent=String(err.message||err);button.disabled=false;}
    };
   }
  }
  async function open(){
   state.open=true;render();
   if(!state.loaded&&!state.busy)await load();
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
  window.STIPTrainingRecurring={refresh:load,open,close:()=>{state.open=false;render()}};
  document.addEventListener("DOMContentLoaded",render,{once:true});
})();
