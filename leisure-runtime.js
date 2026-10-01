(() => {
 'use strict';
 if(window.STIPLeisure)return;
 const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure',STORE='stip_session_v1';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'long'});
 const state={events:[],can_create:false,token:'',loaded:false,inflight:null,error:''};
 const drafts=new Map();
 const find=id=>state.events.find(e=>e.id===id);
 const chatURL=id=>'index.html?quick=communication&tab=dm&conversation='+encodeURIComponent(id)+'#/communication/dm';
 function chatsHTML(e){return (e.chats||[]).map(c=>`<a class="stip-btn secondary" href="${esc(chatURL(c.conversation_id))}">Chat du ${esc(fmt(c.date))}</a>`).join('')}
 const active=e=>e.status==='active'&&e.dates.some(d=>d>=today());
 function reset(){state.events=[];state.loaded=false;state.can_create=false;state.error='Connecte-toi sur l’accueil pour ouvrir les sorties.';state.token='';drafts.clear();document.querySelector('#leisureDialog')?.close();notify()}
 function notify(){window.dispatchEvent(new CustomEvent('stip:leisure-updated'));renderApp()}
 async function post(body){
  const token=localStorage.getItem(STORE)||'';if(!token)throw Error('Connecte-toi pour répondre.');
  const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify(body)}),j=await r.json().catch(()=>({}));
  if(!r.ok||j.error){const messages={DATES_MODIFIEES:'Les dates ont changé. Ferme puis rouvre la proposition pour actualiser tes choix.',SORTIE_FERMEE:'Cette sortie est terminée ou annulée.',ACCES_ORGANISATEUR_REQUIS:'Seul l’organisateur peut modifier cette sortie.',CHOIX_INVALIDE:'Choisis au moins une date ou « Je ne participe pas ».',ACCES_AGENT_REQUIS:'Un profil agent est nécessaire pour s’inscrire.'};throw Error(messages[j.error]||'Impossible d’enregistrer. Réessaie dans un instant.')}
  if(token!==(localStorage.getItem(STORE)||''))throw Error('La session a changé.');
  state.events=j.events||[];state.can_create=!!j.can_create;state.loaded=true;state.token=token;state.error='';notify();return j;
 }
 async function refresh(){
  const token=localStorage.getItem(STORE)||'';if(!token){reset();return}
  if(state.token&&state.token!==token)reset();
  if(state.inflight)return state.inflight;
  state.inflight=post({action:'list'}).catch(e=>{state.error=e.message;renderApp()}).finally(()=>{state.inflight=null});return state.inflight;
 }
 function pendingHTML(){
  if(state.token!==(localStorage.getItem(STORE)||''))return '';
  const pending=state.events.filter(e=>e.needs_response&&active(e));
  const invitations=pending.length?`<section class="leisure-pending" aria-label="Sorties en attente de réponse">${pending.map(e=>`<button type="button" class="leisure-invite stip-surface stip-card-signature" data-stip-card-tone="active" data-leisure-event="${esc(e.id)}"><span aria-hidden="true">🎉</span><span><strong>${esc(e.title)}</strong><small>${e.response?'Dates modifiées · confirme tes choix':'Choisis tes dates ou indique que tu ne participes pas'}</small></span><b>Répondre ›</b></button>`).join('')}</section>`:'';
  const mine=state.events.filter(e=>active(e)&&(e.chats||[]).some(c=>c.date>=today()));
  return invitations+(mine.length?`<section class="leisure-home-chats" aria-label="Chats de mes sorties">${mine.map(e=>`<div><strong>${esc(e.title)}</strong><div class="leisure-actions">${chatsHTML({...e,chats:e.chats.filter(c=>c.date>=today())})}<button type="button" class="stip-btn secondary" data-leisure-event="${esc(e.id)}">Ma réponse</button></div></div>`).join('')}</section>`:'');
 }
 function participantsHTML(e,d){
  const ps=e.participants.filter(p=>p.selected_dates.includes(d));
  return `<div class="leisure-people">${ps.length?ps.map(p=>`<span class="leisure-person">${/^https:\/\//.test(p.photo)?`<img src="${esc(p.photo)}" alt="" loading="lazy">`:''}<span>${esc(p.name)}${p.confirmed?'':' · à reconfirmer'}</span></span>`).join(''):'<small>Aucun inscrit pour l’instant</small>'}</div>`;
 }
 function close(dialog,after){if(!window.STIPOverlayNav?.close?.(dialog,after)){dialog.close();after?.()}}
 function dialogShell(title){
  let dialog=document.querySelector('#leisureDialog');if(dialog?.open)return null;
  if(!dialog){dialog=document.createElement('dialog');dialog.id='leisureDialog';dialog.className='leisure-dialog';document.body.appendChild(dialog)}
  dialog.innerHTML=`<section class="leisure-dialog-surface stip-surface"><header class="leisure-dialog-head"><h2 id="leisureDialogTitle">${esc(title)}</h2><button type="button" class="stip-btn secondary" data-leisure-close aria-label="Fermer">×</button></header><div data-leisure-body></div></section>`;
  dialog.setAttribute('aria-labelledby','leisureDialogTitle');dialog.querySelector('[data-leisure-close]').onclick=()=>close(dialog);dialog.showModal();window.STIPOverlayNav?.track?.(dialog);return dialog;
 }
 async function openEvent(id){
  if(!state.loaded)await refresh();const e=find(id);if(!e)return;
  const dialog=dialogShell(e.title);if(!dialog)return;const body=dialog.querySelector('[data-leisure-body]');
  let saved=drafts.get(id);if(saved?.revision!==e.revision)saved=null;
  const chosen=new Set(saved?.dates||e.response?.selected_dates||[]),declined=saved? saved.declined:!!e.response?.declined,editable=active(e);
  body.innerHTML=`<p class="leisure-description">${esc(e.description)}</p><p><strong>Lieu :</strong> ${esc(e.location||'À fixer')}<br><strong>Horaire :</strong> ${esc(e.time_label||'À fixer')}</p>${!editable?`<p>${e.status==='cancelled'?'Sortie annulée':'Sortie terminée'}</p>`:''}<form data-stip-form-mode="standard" class="leisure-response"><fieldset><legend>${editable?'Quelles dates choisis-tu ? Plusieurs choix possibles.':'Dates et participants'}</legend>${e.dates.map(d=>`<section class="leisure-date"><label><input type="checkbox" name="dates" value="${esc(d)}" ${chosen.has(d)?'checked':''} ${!editable||d<today()?'disabled':''}><strong>${esc(fmt(d))}</strong><span>${e.participants.filter(p=>p.selected_dates.includes(d)).length} inscrit(s)</span></label>${participantsHTML(e,d)}${chatsHTML({...e,chats:(e.chats||[]).filter(c=>c.date===d)})}</section>`).join('')}</fieldset>${editable?`<label class="leisure-decline"><input type="checkbox" name="declined" ${declined?'checked':''}> Je ne participe pas</label><p role="status" aria-live="polite" data-leisure-error></p><footer class="leisure-actions"><button class="stip-btn" type="submit">Valider ma réponse</button><button class="stip-btn secondary" type="button" data-leisure-later>Plus tard</button></footer>`:''}</form><div class="leisure-actions"><a class="stip-btn secondary" href="sorties-loisirs.html">Voir toutes les sorties</a>${e.can_manage?'<button type="button" class="stip-btn secondary" data-leisure-edit>Gérer la sortie</button>':''}</div>`;
  const form=body.querySelector('form'),decline=form.elements.declined;
  function draft(){drafts.set(id,{revision:e.revision,dates:[...form.querySelectorAll('input[name="dates"]:checked')].map(x=>x.value),declined:!!decline?.checked})}
  form.addEventListener('change',event=>{if(event.target===decline&&decline.checked)form.querySelectorAll('[name="dates"]').forEach(x=>x.checked=false);else if(event.target.name==='dates'&&event.target.checked&&decline)decline.checked=false;draft()});
  body.querySelector('[data-leisure-later]')?.addEventListener('click',()=>close(dialog));
  body.querySelector('[data-leisure-edit]')?.addEventListener('click',()=>close(dialog,()=>openEditor(id)));
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(!editable)return;draft();const d=drafts.get(id),status=body.querySelector('[data-leisure-error]');
   if(!d.declined&&!d.dates.length){status.textContent='Choisis une date ou « Je ne participe pas ».';return}
   const submit=form.querySelector('[type="submit"]');submit.disabled=true;status.textContent='Enregistrement…';
   try{await post({action:'respond',event_id:id,revision:e.revision,selected_dates:d.dates,declined:d.declined});drafts.delete(id);close(dialog);const msg=document.querySelector('#leisureStatus');if(msg)msg.textContent=d.declined?'Réponse enregistrée. Tu peux la modifier ici.':'Réponse enregistrée. Les chats de tes dates sont disponibles ci-dessous.'}
   catch(error){status.textContent=error.message;refresh()}finally{submit.disabled=false}
  });
 }
 function openEditor(id=''){
  const e=id?find(id):null;if(e&&!e.can_manage||!e&&!state.can_create)return;
  const dialog=dialogShell(e?'Gérer la sortie':'Proposer une sortie');if(!dialog)return;
  const body=dialog.querySelector('[data-leisure-body]');
  body.innerHTML=`<form data-stip-form-mode="standard" class="leisure-editor"><label>Titre<input name="title" required maxlength="120" value="${esc(e?.title||'')}"></label><label>Informations<textarea name="description" maxlength="2000">${esc(e?.description||'')}</textarea></label><label>Lieu<input name="location" maxlength="240" value="${esc(e?.location||'')}"></label><label>Horaire<input name="time_label" maxlength="240" value="${esc(e?.time_label||'')}"></label><fieldset><legend>Dates proposées</legend><div data-leisure-dates></div><button type="button" class="stip-btn secondary" data-add-date>Ajouter une date</button></fieldset><p role="status" data-leisure-error></p><footer class="leisure-actions"><button type="submit" class="stip-btn">${e?'Enregistrer':'Créer la sortie'}</button>${e?`<button type="button" class="stip-btn secondary" data-cancel-event>${e.status==='cancelled'?'Rouvrir la sortie':'Annuler la sortie'}</button>`:''}</footer></form>`;
  const form=body.querySelector('form'),rows=body.querySelector('[data-leisure-dates]');
  function add(d=''){if(rows.children.length>=24)return;const row=document.createElement('div');row.className='leisure-date-editor';row.innerHTML=`<input type="date" name="date" aria-label="Date proposée" value="${esc(d)}" required><button type="button" class="stip-btn secondary" aria-label="Retirer cette date">×</button>`;row.querySelector('button').onclick=()=>row.remove();rows.appendChild(row)}
  (e?.dates||['']).forEach(add);body.querySelector('[data-add-date]').onclick=()=>add();
  async function save(status='active'){
   const error=body.querySelector('[data-leisure-error]'),buttons=[...form.querySelectorAll('button')];if(!form.reportValidity())return;
   const ds=[...rows.querySelectorAll('input')].map(x=>x.value);if(!ds.length){error.textContent='Ajoute au moins une date.';return}
   buttons.forEach(x=>x.disabled=true);error.textContent='Enregistrement…';
   try{await post({action:'save',id:e?.id,revision:e?.revision,title:form.elements.title.value,description:form.elements.description.value,location:form.elements.location.value,time_label:form.elements.time_label.value,dates:ds,status});close(dialog)}catch(err){error.textContent=err.message}finally{buttons.forEach(x=>x.disabled=false)}
  }
  form.addEventListener('submit',event=>{event.preventDefault();save(e?.status||'active')});body.querySelector('[data-cancel-event]')?.addEventListener('click',()=>{const target=e.status==='cancelled'?'active':'cancelled';if(confirm(target==='cancelled'?'Annuler cette sortie ? Les réponses seront conservées.':'Rouvrir cette sortie ?'))save(target)});
 }
 function renderApp(){
  const root=document.querySelector('#leisureApp');if(!root)return;
  if(!state.loaded){root.innerHTML=`<p role="status">${esc(state.error||'Chargement des sorties…')}</p>${!(localStorage.getItem(STORE)||'')?'<a class="stip-btn secondary" href="index.html#/home">Me connecter</a>':state.error?'<button type="button" class="stip-btn" data-leisure-refresh>Réessayer</button>':''}`;return}
  root.innerHTML=`${state.can_create?'<button type="button" class="stip-btn" data-leisure-create>Proposer une sortie</button>':''}<div class="leisure-grid">${state.events.map(e=>`<article class="leisure-card stip-surface stip-card-signature" data-stip-card-tone="${active(e)?'active':'neutral'}"><h2>${esc(e.title)}</h2><p>${esc(e.location||'Lieu à fixer')}</p><p>${esc(e.time_label||'Horaire à fixer')}</p><p>${e.status==='cancelled'?'Annulée':!active(e)?'Terminée':e.needs_response?'Ta réponse est attendue':e.response?.declined?'Tu ne participes pas':'Ta réponse est enregistrée'}</p><div class="leisure-date-summary">${e.dates.map(d=>`<span><strong>${esc(fmt(d))}</strong> · ${e.participants.filter(p=>p.selected_dates.includes(d)).length} inscrit(s)</span>`).join('')}</div><button type="button" class="stip-btn" data-leisure-event="${esc(e.id)}">${active(e)?e.response?'Voir / modifier ma réponse':'Choisir mes dates':'Voir les participants'}</button><div class="leisure-actions">${chatsHTML(e)}</div>${e.can_manage?`<button type="button" class="stip-btn secondary" data-leisure-manage="${esc(e.id)}">Gérer</button>`:''}</article>`).join('')||'<p>Aucune sortie proposée pour l’instant.</p>'}</div>`;
 }
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-leisure-event],[data-leisure-manage],[data-leisure-create],[data-leisure-refresh]');if(!b)return;if(b.hasAttribute('data-leisure-event'))openEvent(b.dataset.leisureEvent);else if(b.hasAttribute('data-leisure-manage'))openEditor(b.dataset.leisureManage);else if(b.hasAttribute('data-leisure-create'))openEditor();else refresh()});
 window.STIPLeisure={refresh,pendingHTML,openEvent};
 ['stip:session-ready','stip:boot-updated'].forEach(e=>window.addEventListener(e,refresh));
 ['stip:session-ended','stip:session-expired'].forEach(e=>window.addEventListener(e,reset));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 setInterval(()=>{if(!document.hidden)refresh()},300000);
 if(document.querySelector('#leisureApp')){window.STIPContinuity?.validate?.().then(()=>refresh()).catch(e=>{state.error='Connecte-toi sur l’accueil pour ouvrir les sorties.';renderApp()});renderApp()}
 else if(window.STIPSession)refresh();
})();
