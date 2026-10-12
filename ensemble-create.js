(() => {
'use strict';
if(window.STIPEnsembleCreate)return;
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parse=d=>new Date(d+'T12:00:00');
const long=d=>parse(d).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
const today=iso(new Date());
const state={loaded:false,loading:false,open:false,month:new Date(new Date().getFullYear(),new Date().getMonth(),1),
 days:[],people:[],dates:new Set(),guests:new Set(),mode:'invite',scheduleMode:'free',query:'',title:'Muscu',place:'',time:'',details:'',error:'',notice:'',sending:false};
async function call(action,payload={}){
 const token=localStorage.getItem('stip_session_v1');if(!token)throw Error('Connexion GHE requise');
 const response=await fetch(API,{method:'POST',cache:'no-store',headers:{'content-type':'application/json','x-stip-session':token},body:JSON.stringify({action,...payload})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||result.error)throw Error(result.error||'Erreur de connexion');
 return result;
}
function mark(){return '<strong>'+state.dates.size+' date'+(state.dates.size>1?'s':'')+' sélectionnée'+(state.dates.size>1?'s':'')+'</strong>';}
function selectedDays(){
 const host=$('#ensembleSelectedDates');if(!host)return;
 host.innerHTML=mark()+
  '<div class="en-selected-days">'+[...state.dates].sort().map(d=>'<button type="button" data-en-remove-date="'+esc(d)+'" aria-label="Retirer '+esc(long(d))+'">✓ '+esc(long(d))+' <span>×</span></button>').join('')+'</div>';
 host.querySelectorAll('[data-en-remove-date]').forEach(el=>el.onclick=()=>{state.dates.delete(el.dataset.enRemoveDate);datesGrid();selectedDays()});
}
function datesGrid(){
 const host=$('#ensembleCalendarGrid');if(!host)return;
 const month=state.month,year=month.getFullYear(),m=month.getMonth(),start=(month.getDay()+6)%7;
 const daysIn=new Date(year,m+1,0).getDate(),available=new Map(state.days.map(d=>[d.date,d]));
 $('#ensembleMonthTitle').textContent=month.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
 let html=['L','M','M','J','V','S','D'].map(d=>'<span class="en-weekday">'+d+'</span>').join('');
 for(let n=0;n<start;n++)html+='<span class="en-calendar-blank"></span>';
 for(let n=1;n<=daysIn;n++){
  const date=iso(new Date(year,m,n)),meta=available.get(date),disabled=date<today;
  const shiftCode=meta?.code||'',symbol=meta?.icon||'·';
  const shiftLabel=meta?meta.label:'Planning non renseigné';
  const bg=/^#[0-9a-f]{6}$/i.test(meta?.soft_color||'')?meta.soft_color:'#eff3f4';
  const fg=/^#[0-9a-f]{6}$/i.test(meta?.color||'')?meta.color:'#98a5a9';
  html+='<button type="button" class="en-calendar-day'+(state.dates.has(date)?' is-selected':'')+
   (disabled?' is-past':'')+'" data-en-date="'+date+'" '+(disabled?'disabled':'')+
   ' title="'+esc(shiftLabel)+'" aria-pressed="'+state.dates.has(date)+'" style="--en-shift:'+fg+';--en-soft:'+bg+';">'+
   '<span class="en-num">'+n+'</span><span class="en-day-shift">'+esc(symbol)+' '+esc(shiftCode||'—')+'</span></button>';
 }
 host.innerHTML=html;
 host.querySelectorAll('[data-en-date]').forEach(el=>el.onclick=()=>{
  const date=el.dataset.enDate;if(state.dates.has(date))state.dates.delete(date);
  else if(state.dates.size<24)state.dates.add(date);
  else{state.error='24 dates maximum par proposition.';$('#ensembleComposeStatus').textContent=state.error;return;}
  datesGrid();selectedDays();
 });
}
function peopleGrid(){
 const host=$('#ensembleCreatePeople');if(!host)return;
 const term=state.query.toLocaleLowerCase('fr').trim();
 host.innerHTML=state.people.filter(p=>p.name.toLocaleLowerCase('fr').includes(term))
   .map(p=>'<label class="en-person"><input type="checkbox" data-en-person="'+esc(p.id)+'" '+(state.guests.has(p.id)?'checked':'')+'>'+
   '<span>'+esc(p.name)+'</span></label>').join('')||'<p>Aucun collègue trouvé.</p>';
 host.querySelectorAll('[data-en-person]').forEach(el=>el.onchange=()=>{
  if(el.checked)state.guests.add(el.dataset.enPerson);else state.guests.delete(el.dataset.enPerson);
  guestCount();
 });
 guestCount();
}
function guestCount(){
 const el=$('#ensembleGuestCount');if(el)el.textContent=state.guests.size+
  ' collègue'+(state.guests.size>1?'s':'')+' invité'+(state.guests.size>1?'s':'')+
  (state.mode==='team'?' · sortie visible par toute l’équipe':' · seuls ces collègues verront la sortie');
}
function modeDraw(){
 document.querySelectorAll('[data-en-visibility]').forEach(el=>{
  const yes=el.dataset.enVisibility===state.mode;el.classList.toggle('is-selected',yes);el.setAttribute('aria-pressed',yes?'true':'false');
 });
 guestCount();
}
function drawSchedule(){
 document.querySelectorAll('[data-en-schedule]').forEach(el=>{
  const selected=el.dataset.enSchedule===state.scheduleMode;
  el.classList.toggle('is-selected',selected);el.setAttribute('aria-pressed',selected?'true':'false');
 });
 const hint=$('#enScheduleHint');if(hint)hint.textContent=state.scheduleMode==='afterwork'?'Le rendez-vous est prévu après le service. Précise une heure seulement si elle est déjà connue.':'Choisis librement l’heure du rendez-vous, ou laisse-la à définir.';
 const label=$('#enTimeLabel');if(label)label.textContent=state.scheduleMode==='afterwork'?'Heure après le service (facultatif)':'Heure du rendez-vous (facultatif)';
 const time=$('#enTimeInput');if(time)time.placeholder=state.scheduleMode==='afterwork'?'Ex. 21:20, ou à convenir':'Ex. 18:30, ou à convenir';
}
function formValues(){
 const form=$('#ensembleFreeForm');if(!form)return;
 state.title=form.elements.title?.value||'';
 state.place=form.elements.location?.value||'';
 state.time=form.elements.time_label?.value||'';
 state.details=form.elements.description?.value||'';
}
function render(){
 const root=$('#ensembleCreatePanel');if(!root||!state.open)return;
 root.innerHTML='<section class="en-compose">'+
 '<form id="ensembleFreeForm"><div class="en-compose-row"><strong>1. Quelle activité ?</strong></div>'+
 '<div class="en-shortcuts"><button type="button" data-en-activity="Muscu">🏋️ Muscu</button>'+
 '<button type="button" data-en-activity="Boxe">🥊 Boxe</button><button type="button" data-en-activity="Foot">⚽ Foot</button>'+
 '<button type="button" data-en-activity="Restaurant">🍽️ Resto</button>'+
 '<button type="button" data-en-activity="Cinéma">🎬 Ciné</button><button type="button" data-en-activity="">＋ Autre</button></div>'+
 '<label class="en-field">Nom de l’activité<input required name="title" maxlength="120" value="'+esc(state.title)+'" placeholder="Muscu, repas, cinéma…"></label>'+
 '<div class="en-compose-row"><strong>2. Quand ?</strong><span>Choisis librement, même pendant tes repos</span></div>'+
 '<div class="en-calendar-head"><button type="button" data-en-month="-1" aria-label="Mois précédent">‹</button>'+
 '<strong id="ensembleMonthTitle"></strong><button type="button" data-en-month="1" aria-label="Mois suivant">›</button></div>'+
 '<div class="en-calendar" id="ensembleCalendarGrid"></div>'+
 '<div id="ensembleSelectedDates" class="en-selected"></div>'+
 '<div class="en-custom-date"><label>Autre date, même hors planning<input type="date" id="ensembleCustomDate" min="'+today+'"></label>'+
 '<button type="button" data-en-add-custom class="ensemble-subtle">＋ Ajouter</button></div>'+
 '<p class="en-legend"><span>🔵 Matin</span><span>🟢 Journée</span><span>🟡 Soir</span><span>🛋️ Repos</span><span>· Non renseigné</span></p>'+
 '<div class="en-compose-row"><strong>Horaire de l’activité</strong></div>'+ 
 '<div class="en-schedule-choice" role="group" aria-label="Moment de l’activité">'+
 '<button type="button" data-en-schedule="free"><span>🕒 Heure au choix</span><small>Jour et heure libres</small></button>'+
 '<button type="button" data-en-schedule="afterwork"><span>🕔 Après le travail</span><small>Après mon service</small></button></div>'+
 '<p id="enScheduleHint" class="en-hint"></p>'+
 '<label class="en-field"><span id="enTimeLabel">Heure du rendez-vous (facultatif)</span><input id="enTimeInput" name="time_label" maxlength="200" value="'+esc(state.time)+'" placeholder="Ex. 18:30"></label>'+
 '<div class="en-compose-row"><strong>3. Avec qui ?</strong></div>'+
 '<div class="en-visibility"><button type="button" data-en-visibility="invite">🔒 Sur invitation</button>'+
 '<button type="button" data-en-visibility="team">🌐 Ouvert à l’équipe</button></div>'+
 '<p class="en-hint">Sur invitation : seuls les invités et toi pouvez voir cette activité. Ouvert : tous les collègues autorisés peuvent la découvrir.</p>'+
 '<label class="en-field">Chercher un collègue<input type="search" id="ensemblePeopleSearch" placeholder="Prénom ou nom" value="'+esc(state.query)+'"></label>'+
 '<div class="en-people-actions"><button type="button" data-en-select-all>✓ Inviter tout le monde</button>'+
 '<button type="button" data-en-clear-all>Effacer la sélection</button></div>'+
 '<div id="ensembleCreatePeople" class="en-people"></div><p id="ensembleGuestCount" class="en-hint"></p>'+
 '<details class="en-extra"><summary>Lieu et précisions (facultatif)</summary>'+
 '<label class="en-field">Lieu<input name="location" maxlength="240" value="'+esc(state.place)+'" placeholder="Salle, adresse à préciser…"></label>'+

 '<label class="en-field">Précisions<textarea name="description" maxlength="2000" rows="2">'+esc(state.details)+'</textarea></label></details>'+
 '<p role="status" id="ensembleComposeStatus" class="en-compose-status">'+esc(state.error||state.notice)+'</p>'+
 '<button type="submit" class="ensemble-primary" id="ensembleCreateSend">'+
 'Valider la proposition et envoyer les invitations</button></form></section>';
 const form=$('#ensembleFreeForm');
 form.oninput=formValues;
 form.querySelectorAll('[data-en-activity]').forEach(el=>el.onclick=()=>{
  const field=form.elements.title;field.value=el.dataset.enActivity;state.title=field.value;field.focus();
 });
 root.querySelectorAll('[data-en-month]').forEach(el=>el.onclick=()=>{
  formValues();state.month=new Date(state.month.getFullYear(),state.month.getMonth()+Number(el.dataset.enMonth),1);
  datesGrid();
 });
 root.querySelectorAll('[data-en-visibility]').forEach(el=>el.onclick=()=>{state.mode=el.dataset.enVisibility;modeDraw()});
 root.querySelectorAll('[data-en-schedule]').forEach(el=>el.onclick=()=>{formValues();state.scheduleMode=el.dataset.enSchedule;drawSchedule()});
 root.querySelector('[data-en-select-all]').onclick=()=>{state.people.forEach(p=>state.guests.add(p.id));peopleGrid()};
 root.querySelector('[data-en-clear-all]').onclick=()=>{state.guests.clear();peopleGrid()};
 $('#ensemblePeopleSearch').oninput=e=>{state.query=e.target.value;peopleGrid()};
 root.querySelector('[data-en-add-custom]').onclick=()=>{
  const date=$('#ensembleCustomDate').value;if(!date||date<today)return;
  if(state.dates.size>=24&&!state.dates.has(date)){state.error='24 dates maximum.';$('#ensembleComposeStatus').textContent=state.error;return}
  state.dates.add(date);datesGrid();selectedDays();
 };
 form.onsubmit=submit;
 datesGrid();selectedDays();peopleGrid();modeDraw();drawSchedule();
}
async function submit(event){
 event.preventDefault();formValues();
 const status=$('#ensembleComposeStatus'),send=$('#ensembleCreateSend');
 if(!state.title.trim()){status.textContent='Donne un nom à l’activité.';return}
 if(!state.dates.size){status.textContent='Choisis au moins une date.';return}
 if(state.mode==='invite'&&!state.guests.size){status.textContent='Coche des collègues ou choisis « Ouvert à l’équipe ».';return}
 const count=state.guests.size;
 if(count>=10&&!confirm('Envoyer cette invitation à '+count+' collègues ?'))return;
 send.disabled=true;status.textContent='Création et invitations en cours…';
 try{
  const selectedTime=state.time.trim().replace(/^apr[eè]s (?:le travail|la fermeture|mon service)\s*[·:–-]?\s*/i,'');
  const timeLabel=state.scheduleMode==='afterwork'?'Après le travail · '+(selectedTime||'horaire à convenir'):state.time.trim();
  await call('create',{title:state.title,dates:[...state.dates].sort(),agent_ids:[...state.guests],
   visibility:state.mode,description:state.details,location:state.place,time_label:timeLabel});
  state.open=false;state.dates.clear();state.guests.clear();state.notice='';state.error='';
  $('#ensembleCreatePanel').innerHTML='';
  await window.STIPLeisure?.refresh?.();
  window.STIPLeisure?.closeCreator?.();
  const info=$('#leisureStatus');if(info)info.textContent='Activité créée. Les collègues invités pourront choisir leurs dates et ouvrir le groupe.';
 }catch(e){status.textContent=e.message||'Impossible de créer l’activité.';send.disabled=false}
}
async function open(options={}){
 if(options.scheduleMode==='afterwork'||options.scheduleMode==='free')state.scheduleMode=options.scheduleMode;
 state.open=true;
 if(!state.loaded){
  if(state.loading)return;state.loading=true;
  const root=$('#ensembleCreatePanel');if(root)root.innerHTML='<p role="status">Chargement de ton calendrier et des collègues…</p>';
  try{
   const result=await call('calendar');
   state.days=result.days||[];state.people=result.colleagues||[];state.loaded=true;
   state.error='';
  }catch(e){state.error=e.message||'Calendrier indisponible';state.loaded=true;}
  finally{state.loading=false}
 }
 render();
}
function close(){state.open=false;const root=$('#ensembleCreatePanel');if(root)root.innerHTML=''}
window.STIPEnsembleCreate={open,close};
})();