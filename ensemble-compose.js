(() => {
 "use strict";
 if(window.STIPEnsembleCompose)return;
 const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure";
 const $=q=>document.querySelector(q);
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const dayLabel=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
 const monthLabel=d=>new Date(d+"-01T12:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
 const nextMonth=(value,offset)=>{const [y,m]=value.split("-").map(Number),d=new Date(Date.UTC(y,m-1+offset,1));return d.toISOString().slice(0,7)};
 const s={mode:"date",month:today().slice(0,7),selected:new Set(),people:[],checked:new Set(),shifts:new Map(),scope:"invite",search:"",loading:false,loaded:false,error:"",suggestions:[],suggestedFor:""};
 async function call(action,body={}){
  const token=localStorage.getItem("stip_session_v1");
  if(!token)throw Error("Connexion GHE requise.");
  const r=await fetch(API,{method:"POST",headers:{"content-type":"application/json","x-stip-session":token},cache:"no-store",
   body:JSON.stringify({action,...body})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.error)throw Error(data.error||"Le serveur ne répond pas.");return data;
 }
 function shiftBadge(date){
  const shift=s.shifts.get(date);
  if(!shift)return {className:"shift-unknown",icon:"○",label:"Planning à venir",small:"?"};
  const labels={
   morning:["shift-morning","☀","Matin"],day:["shift-day","◷","Journée"],
   evening:["shift-evening","☾","Soir"],night:["shift-night","☽","Nuit"],
   rest:["shift-rest","⌂","Repos"],absence:["shift-absence","—","Absence"],unknown:["shift-unknown","·","Planning"]
  };
  const [className,icon,label]=labels[shift.kind]||labels.unknown;
  return {className,icon,label:shift.label||label,small:shift.code||"?"};
 }
 function renderCalendar(){
  const parent=$("#ensembleCalendar");if(!parent)return;
  const [year,month]=s.month.split("-").map(Number),firstDay=new Date(Date.UTC(year,month-1,1));
  const total=new Date(Date.UTC(year,month,0)).getUTCDate(),pad=(firstDay.getUTCDay()+6)%7;
  const cells=Array.from({length:pad},()=>'<span class="ec-spacer" aria-hidden="true"></span>');
  for(let n=1;n<=total;n++){
   const date=s.month+"-"+String(n).padStart(2,"0"),shift=shiftBadge(date),picked=s.selected.has(date),past=date<today();
   cells.push('<button type="button" class="ec-day '+shift.className+(picked?' is-picked':'')+'" data-ec-day="'+date+
    '" '+(past?'disabled':'')+' aria-pressed="'+picked+'" title="'+esc(shift.label)+'">'+
    '<span class="ec-day-number">'+n+'</span><span class="ec-day-shift">'+esc(shift.icon+' '+shift.small)+'</span>'+
    '</button>');
  }
  parent.innerHTML='<div class="ec-month"><button type="button" aria-label="Mois précédent" data-month-prev>‹</button>'+
    '<strong>'+esc(monthLabel(s.month))+'</strong><button type="button" aria-label="Mois suivant" data-month-next>›</button></div>'+
    '<div class="ec-week">'+['L','M','M','J','V','S','D'].map(x=>'<span>'+x+'</span>').join('')+'</div>'+
    '<div class="ec-grid">'+cells.join('')+'</div>'+
    '<div class="ec-legend"><span class="shift-morning">☀ Matin</span><span class="shift-day">◷ Journée</span>'+
    '<span class="shift-evening">☾ Soir</span><span class="shift-rest">⌂ Repos</span><span class="shift-absence">— Absence</span></div>';
  parent.querySelector('[data-month-prev]').onclick=()=>changeMonth(-1);
  parent.querySelector('[data-month-next]').onclick=()=>changeMonth(1);
  parent.querySelectorAll("[data-ec-day]").forEach(el=>el.onclick=()=>toggleDate(el.dataset.ecDay));
  renderSelected();
 }
 function renderSelected(){
  const area=$("#ensembleSelectedDates");if(!area)return;
  const dates=[...s.selected].sort();
  area.innerHTML='<div class="ec-picked-head"><strong>'+dates.length+'/24 dates retenues</strong><span>Jours libres, travail ou repos : tu choisis.</span></div>'+
   (dates.length?'<div class="ec-picked">'+dates.map(d=>'<button type="button" data-ec-remove="'+d+'">'+esc(dayLabel(d))+' ×</button>').join('')+'</div>':'');
  area.querySelectorAll('[data-ec-remove]').forEach(el=>el.onclick=()=>toggleDate(el.dataset.ecRemove));
 }
 function toggleDate(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<today())return;
  if(s.selected.has(day))s.selected.delete(day);
  else if(s.selected.size<24)s.selected.add(day);
  else{$("#ensembleComposeError").textContent="Maximum 24 dates pour une proposition. Tu peux créer une autre activité pour les dates suivantes.";return;}
  $("#ensembleComposeError").textContent="";
  renderCalendar();
 }
 function renderPeople(){
  const area=$("#ensemblePeople");if(!area)return;
  const term=s.search.toLocaleLowerCase("fr");
  const visible=s.people.filter(p=>p.name.toLocaleLowerCase("fr").includes(term));
  area.innerHTML=visible.map(p=>'<label class="ec-person"><input type="checkbox" data-ec-person="'+esc(p.id)+
    '" '+(s.checked.has(p.id)?'checked':'')+'><span>'+esc(p.name)+'</span></label>').join('')||'<p>Aucun collègue trouvé.</p>';
  area.querySelectorAll('[data-ec-person]').forEach(el=>el.onchange=()=>{
   if(el.checked)s.checked.add(el.dataset.ecPerson);else s.checked.delete(el.dataset.ecPerson);
   countPeople();
  });
  countPeople();
 }
 function countPeople(){
  const c=$("#ensemblePeopleCount");if(c)c.textContent=s.checked.size+' collègue(s) sélectionné(s)';
 }
 function renderSuggestions(){
  const root=$("#ensembleSmartDates");if(!root)return;
  root.innerHTML=s.suggestions.length?
    '<strong>Suggestions compatibles · facultatives</strong><div class="ec-suggestions">'+
    s.suggestions.map(d=>'<button type="button" data-ec-suggestion="'+esc(d.date)+'">＋ '+esc(dayLabel(d.date))+
      '<small>'+esc(d.my_end+' / '+d.peer_end)+'</small></button>').join('')+'</div>'+
    '<p>Tu peux aussi sélectionner n’importe quel autre jour dans le calendrier.</p>':
    s.suggestedFor?'<p>Pas de fin de service commune détectée. Tu peux quand même proposer les dates que tu veux.</p>':'';
  root.querySelectorAll('[data-ec-suggestion]').forEach(el=>el.onclick=()=>toggleDate(el.dataset.ecSuggestion));
 }
 async function changeMonth(delta){
  s.month=nextMonth(s.month,delta);renderCalendar();
  await loadShifts();
 }
 async function loadShifts(){
  const month=s.month,result=await call("calendar",{start:month+"-01",days:35});
  (result.shifts||[]).forEach(d=>s.shifts.set(d.date,d));
  if(month===s.month)renderCalendar();
 }
 function render(){
  const root=$("#ensembleAfterworkCreate");if(!root)return;
  root.innerHTML='<section class="ec-compose">'+
   '<p class="ec-intro">'+(s.mode==="matched"?'Le planning aide à trouver un moment commun, mais aucune date ne t’est imposée.':
    'Sélectionne librement les jours que tu veux, même quand tu es de repos.')+'</p>'+
   '<form id="ensembleComposeForm"><div class="ec-activity"><strong>On fait quoi ?</strong>'+
    '<div class="ec-activities">'+[
     ['Muscu','🏋️'],['Boxe','🥊'],['Foot','⚽'],['Resto','🍽️'],['Cinéma','🎬'],['Autre','＋']
    ].map(([name,icon])=>'<button type="button" data-ec-activity="'+name+'">'+icon+' '+name+'</button>').join('')+
    '</div><input name="title" maxlength="120" required placeholder="Nom de l’activité"></div>'+
   '<div class="ec-dates"><div class="ec-heading"><strong>Quand ?</strong><span>Toutes les dates sont possibles</span></div>'+
    '<div id="ensembleCalendar"></div>'+
    '<label class="ec-anydate">Date précise, même très loin dans le futur <input type="date" id="ecAnyDate" aria-label="Ajouter une date libre"></label>'+
    '<div id="ensembleSelectedDates"></div></div>'+
   '<div class="ec-attendees"><strong>Qui peut participer ?</strong>'+
    '<div class="ec-scopes"><label><input type="radio" name="scope" value="invite" checked> 🔒 Sur invitation</label>'+
      '<label><input type="radio" name="scope" value="team"> 👥 Toute l’équipe</label></div>'+
    '<p class="ec-scope-info" id="ecScopeInfo">Seuls les collègues invités verront la proposition. Ils pourront rejoindre le groupe après avoir accepté.</p>'+
    '<label>Rechercher un collègue<input type="search" id="ecSearch" placeholder="Prénom ou nom"></label>'+
    '<div class="ec-pick-actions"><button type="button" id="ecSelectAll">✓ Inviter tous les collègues</button>'+
     '<button type="button" id="ecUnselectAll">Effacer la sélection</button></div>'+
    '<div id="ensemblePeople" class="ec-people"></div><div id="ensemblePeopleCount"></div>'+
    '<div class="ec-smart"><button type="button" id="ecFindMatches">✨ Voir les fins de service communes</button>'+
    '<div id="ensembleSmartDates"></div></div></div>'+
   '<details class="ec-details"><summary>Lieu, heure et précisions (facultatifs)</summary>'+
    '<label>Lieu ou adresse<input name="location" maxlength="240" placeholder="À fixer"></label>'+
    '<label>Heure de rendez-vous<input name="time_label" maxlength="240" placeholder="19:00 ou après le service"></label>'+
    '<label>Informations<textarea name="description" rows="2" maxlength="2000"></textarea></label></details>'+
   '<p id="ensembleComposeError" role="alert"></p>'+
   '<button class="ensemble-primary ec-submit" type="submit" id="ecSubmit">Créer et inviter</button>'+
   '</form></section>';
  root.querySelectorAll('[data-ec-activity]').forEach(el=>el.onclick=()=>{
   const t=root.querySelector('[name=title]');
   t.value=el.dataset.ecActivity==='Autre'?'':el.dataset.ecActivity;
   root.querySelectorAll('[data-ec-activity]').forEach(btn=>btn.classList.toggle('is-selected',btn===el));
   t.focus();
  });
  root.querySelector('[data-ec-activity="Muscu"]')?.click();
  root.querySelector('#ecAnyDate').onchange=e=>{if(e.target.value)toggleDate(e.target.value);e.target.value='';};
  root.querySelector('#ecSearch').oninput=e=>{s.search=e.target.value;renderPeople()};
  root.querySelector('#ecSelectAll').onclick=()=>{s.checked=new Set(s.people.map(p=>p.id));renderPeople()};
  root.querySelector('#ecUnselectAll').onclick=()=>{s.checked.clear();renderPeople()};
  root.querySelectorAll('[name=scope]').forEach(el=>el.onchange=()=>{
   s.scope=el.value;
   $("#ecScopeInfo").textContent=s.scope==='team'?
    "Tous les agents autorisés de cette équipe verront l’activité. Les cases cochées recevront aussi une notification personnelle.":
    "Seuls les collègues invités verront la proposition. Ils pourront rejoindre le groupe après avoir accepté.";
   $("#ecSubmit").textContent=s.scope==='team'?'Publier pour l’équipe':'Envoyer les invitations';
  });
  root.querySelector('#ecFindMatches').onclick=async()=>{
   const info=$("#ensembleSmartDates");
   if(s.checked.size!==1){info.textContent='Sélectionne un seul collègue pour comparer vos horaires. Tu peux ensuite inviter autant de personnes que tu veux.';return;}
   const target=[...s.checked][0];info.textContent='Recherche des créneaux communs…';
   try{const r=await call('matches',{target_agent_id:target});s.suggestions=r.days||[];s.suggestedFor=target;renderSuggestions();}
   catch(e){info.textContent=e.message}
  };
  root.querySelector('#ensembleComposeForm').onsubmit=async e=>{
   e.preventDefault();
   const form=e.currentTarget,error=$("#ensembleComposeError"),submit=$("#ecSubmit");
   if(!s.selected.size){error.textContent='Choisis au moins une date, qu’il s’agisse d’un jour de travail ou de repos.';return;}
   if(s.scope==='invite'&&!s.checked.size){error.textContent='Coche au moins un collègue ou ouvre la proposition à toute l’équipe.';return;}
   const count=s.checked.size;
   const confirmation=s.scope==='team'?
    'Publier cette activité pour toute l’équipe'+(count?' et envoyer '+count+' invitation(s) personnelle(s)':'')+' ?':
    'Envoyer une invitation à '+count+' collègue(s) ?';
   if(!confirm(confirmation))return;
   submit.disabled=true;error.textContent='Enregistrement en cours…';
   try{
    const data=new FormData(form);
    await call('create_activity',{title:String(data.get('title')||''),dates:[...s.selected].sort(),
     visibility:s.scope,agent_ids:[...s.checked],location:String(data.get('location')||''),
     time_label:String(data.get('time_label')||''),description:String(data.get('description')||'')});
    s.selected.clear();s.checked.clear();s.suggestions=[];
    await window.STIPLeisure?.refresh?.();
    window.STIPLeisure?.closeCreator?.();
    const st=$("#leisureStatus");if(st)st.textContent=s.scope==='team'?'Activité visible par l’équipe.':'Invitations envoyées aux collègues sélectionnés.';
   }catch(err){error.textContent=err.message;submit.disabled=false}
  };
  renderPeople();renderCalendar();renderSuggestions();
 }
 async function open(mode='date'){
  s.mode=mode;s.error='';s.scope='invite';s.search='';
  render();const error=$("#ensembleComposeError");error.textContent="Chargement du planning et des collègues…";
  try{
   const [a]=await Promise.all([call('colleagues'),loadShifts()]);
   s.people=a.colleagues||[];s.loaded=true;renderPeople();error.textContent='';
  }catch(e){error.textContent=e.message}
 }
 window.STIPEnsembleCompose={open};
})();