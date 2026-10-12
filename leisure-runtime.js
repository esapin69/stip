(() => {
 'use strict';
 if(window.STIPLeisure)return;
 const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure',STORE='stip_session_v1';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'long'});
 const state={events:[],can_create:false,token:'',loaded:false,inflight:null,error:''};
 const view={tab:'activities',createMode:'',createOpen:false};
 let deepLinkOpened=false;
 const drafts=new Map();
 const find=id=>state.events.find(e=>e.id===id);
 const chatURL=id=>'index.html?quick=communication&tab=dm&conversation='+encodeURIComponent(id)+'#/communication/dm';
 function chatsHTML(e){
  if(e.series_conversation_id)return '<a class="stip-btn secondary" href="'+esc(chatURL(e.series_conversation_id))+'">💬 Groupe de l’activité</a>';
  return (e.chats||[]).map(c=>`<a class="stip-btn secondary" href="${esc(chatURL(c.conversation_id))}">Chat du ${esc(fmt(c.date))}</a>`).join('');
 }
 const iconFor=title=>{
  const t=String(title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/foot|soccer|futsal/.test(t))return '⚽';
  if(/box|combat|kickbox/.test(t))return '🥊';
  if(/muscu|fitness|salle|gym/.test(t))return '🏋️';
  if(/voitur|trajet|transport/.test(t))return '🚗';
  if(/resto|repas|diner|dejeuner/.test(t))return '🍽️';
  if(/cinema|cine|film/.test(t))return '🎬';
  if(/cafe|verre|boisson/.test(t))return '☕';
  if(/course|running|jogg|marche/.test(t))return '🏃';
  return '🎉';
 };
  const active=e=>e.status==='active'&&e.dates.some(d=>d>=today());
 function reset(){state.events=[];state.loaded=false;state.can_create=false;state.error='Connecte-toi sur l’accueil pour ouvrir les sorties.';state.token='';drafts.clear();document.querySelector('#leisureDialog')?.close();notify()}
 function notify(){window.dispatchEvent(new CustomEvent('stip:leisure-updated'));renderApp()}
 async function post(body){
  const token=localStorage.getItem(STORE)||'';if(!token)throw Error('Connecte-toi pour répondre.');
  const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify(body)}),j=await r.json().catch(()=>({}));
  if(!r.ok||j.error){if(/PGRST201|more than one relationship|multiple relationships/i.test(String(j.error||'')))throw Error('Le chargement des invités est momentanément bloqué. La correction serveur est en cours.');const messages={DATES_MODIFIEES:'Les dates ont changé. Ferme puis rouvre la proposition pour actualiser tes choix.',SORTIE_FERMEE:'Cette sortie est terminée ou annulée.',ACCES_ORGANISATEUR_REQUIS:'Seul l’organisateur peut modifier cette sortie.',CHOIX_INVALIDE:'Choisis au moins une date ou « Je ne participe pas ».',ACCES_AGENT_REQUIS:'Un profil agent est nécessaire pour s’inscrire.'};throw Error(messages[j.error]||'Impossible d’enregistrer. Réessaie dans un instant.')}
  if(token!==(localStorage.getItem(STORE)||''))throw Error('La session a changé.');
  state.events=j.events||[];state.can_create=!!j.can_create;state.loaded=true;state.token=token;state.error='';notify();return j;
 }
 async function refresh(){
  const token=localStorage.getItem(STORE)||'';if(!token){reset();return}
  if(state.token&&state.token!==token)reset();
  if(state.inflight)return state.inflight;
  state.inflight=post({action:'list'}).then(()=>{
   if(deepLinkOpened||!document.querySelector('#leisureApp'))return;
   const id=new URLSearchParams(location.search).get('event');
   if(id&&state.events.some(e=>e.id===id)){
    deepLinkOpened=true;setTimeout(()=>openEvent(id),100);
   }
  }).catch(e=>{state.error=e.message;renderApp()}).finally(()=>{state.inflight=null});return state.inflight;
 }
 function pendingHTML(){
  if(state.token!==(localStorage.getItem(STORE)||''))return '';
  const pending=state.events.filter(e=>e.needs_response&&active(e)&&!e.is_organizer);
  const invitations=pending.length?'<section class="leisure-pending" aria-label="Invitations à traiter">'+pending.map(e=>
   '<button type="button" class="leisure-invite stip-surface stip-card-signature" data-stip-card-tone="active" data-leisure-event="'+esc(e.id)+'"><span aria-hidden="true">'+iconFor(e.title)+'</span><span><strong>'+esc(e.title)+'</strong><small>'+esc(e.recurring_closing?'Tous tes jours de fermeture · Coche ceux qui te conviennent':e.dates.filter(d=>d>=today()).map(fmt).join(' · '))+(e.response?' · Dates modifiées · confirme tes choix':' · Réponse attendue')+'</small></span><b>Répondre ›</b></button>').join('')+'</section>':'';
  const groups=new Map();
  state.events.filter(e=>active(e)&&!e.recurring_closing).forEach(e=>{
   (e.chats||[]).filter(c=>c.date>=today()).forEach(chat=>{
    const key=e.title.trim().toLocaleLowerCase('fr')+'|'+chat.date;
    const current=groups.get(key)||{title:e.title,date:chat.date,items:[]};
    current.items.push({event:e,chat});groups.set(key,current);
   });
  });
  const cards=[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(group=>{
   const first=group.items[0],duplicated=group.items.length>1;
   const lines=group.items.map((item,index)=>
    '<div class="leisure-quick-line">'+(duplicated?'<small>Proposition '+(index+1)+' · '+esc(item.event.location||'Lieu à fixer')+' · '+esc(item.event.time_label||'Horaire à fixer')+'</small>':'')+
    '<a class="stip-btn secondary" href="'+esc(chatURL(item.chat.conversation_id))+'">💬 Discussion</a>'+
    '<button type="button" class="stip-btn secondary" data-leisure-event="'+esc(item.event.id)+'">Ma réponse</button>'+
    (item.event.can_invite?'<button type="button" class="stip-btn secondary" data-leisure-add-invite="'+esc(item.event.id)+'">＋ Inviter</button>':'')+
    (item.event.can_manage?'<button type="button" class="stip-btn secondary" data-leisure-manage="'+esc(item.event.id)+'">✏️ Modifier</button>':'')+
    '</div>').join('');
   return '<section class="leisure-home-card stip-surface"><div class="leisure-home-title"><span class="leisure-home-icon">'+iconFor(group.title)+'</span><div><strong>'+esc(group.title)+'</strong><small>'+esc(fmt(group.date))+(duplicated?' · '+group.items.length+' propositions':'')+'</small></div></div>'+
   (duplicated?'<details><summary>Gérer les '+group.items.length+' propositions</summary>'+lines+'</details>':lines)+'</section>';
  });
  const recurringCards=state.events.filter(e=>active(e)&&e.recurring_closing&&!e.needs_response).map(e=>
   '<section class="leisure-home-card stip-surface"><div class="leisure-home-title"><span class="leisure-home-icon">🏋️</span><div><strong>'+esc(e.title)+'</strong><small>À chaque fermeture · '+e.dates.filter(d=>d>=today()).length+' prochaines dates</small></div></div><div class="leisure-quick-line">'+
   '<button type="button" class="stip-btn secondary" data-leisure-event="'+esc(e.id)+'">'+(e.is_organizer?'Mes disponibilités':'Choisir mes dates')+'</button>'+
   (e.can_invite?'<button type="button" class="stip-btn secondary" data-leisure-add-invite="'+esc(e.id)+'">＋ Inviter</button>':'')+
   '</div></section>').join('');
  return invitations+(recurringCards?'<section class="leisure-home-chats">'+recurringCards+'</section>':'')+(cards.length?'<section class="leisure-home-chats" aria-label="Mes activités à venir">'+cards.join('')+'</section>':'');
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
  const series=!!e.recurring_closing,host=series&&e.is_organizer,unavailable=new Set(e.organizer_unavailable_dates||[]);
  body.innerHTML=`${e.series_conversation_id?'<p class="leisure-series-chat">'+chatsHTML(e)+'</p>':''}<p class="leisure-description">${esc(e.description)}</p><p><strong>Lieu :</strong> ${esc(e.location||'À fixer')}<br><strong>Horaire :</strong> ${esc(e.time_label||'À fixer')}</p>${!editable?`<p>${e.status==='cancelled'?'Sortie annulée':'Sortie terminée'}</p>`:''}<form data-stip-form-mode="standard" class="leisure-response"><fieldset><legend>${host?'Mes disponibilités · cochées par défaut':editable?'Quelles dates choisis-tu ? Plusieurs choix possibles.':'Dates et participants'}</legend>${e.dates.map(d=>`<section class="leisure-date"><label><input type="checkbox" name="dates" value="${esc(d)}" ${(host?!unavailable.has(d):chosen.has(d)&&!unavailable.has(d))?'checked':''} ${!editable||d<today()||(!host&&unavailable.has(d))?'disabled':''}><strong>${esc(fmt(d))}</strong><span>${unavailable.has(d)?'Organisateur indisponible':e.participants.filter(p=>p.selected_dates.includes(d)).length+' inscrit(s)'}</span></label>${participantsHTML(e,d)}${series?'':chatsHTML({...e,chats:(e.chats||[]).filter(c=>c.date===d)})}</section>`).join('')}</fieldset>${host?'<p class="leisure-organizer-note">Tu es disponible par défaut à chaque fermeture. Décoche seulement les jours où tu ne peux pas venir ; la modification est enregistrée immédiatement.</p>':''}${editable&&!host?`<label class="leisure-decline"><input type="checkbox" name="declined" ${declined?'checked':''}> Je ne participe pas</label><p role="status" aria-live="polite" data-leisure-error></p><footer class="leisure-actions"><button class="stip-btn" type="submit">Valider ma réponse</button><button class="stip-btn secondary" type="button" data-leisure-later>Plus tard</button></footer>`:''}</form><div class="leisure-actions"><a class="stip-btn secondary" href="sorties-loisirs.html">Voir toutes les sorties</a>${e.can_manage?'<button type="button" class="stip-btn secondary" data-leisure-edit>✏️ Modifier</button>':''}${e.can_invite?'<button type="button" class="stip-btn secondary" data-leisure-invite>＋ Inviter des collègues</button>':''}</div>`;
  const form=body.querySelector('form'),decline=form.elements.declined;
  function draft(){drafts.set(id,{revision:e.revision,dates:[...form.querySelectorAll('input[name="dates"]:checked')].map(x=>x.value),declined:!!decline?.checked})}
  form.addEventListener('change',async event=>{
   if(host&&event.target.name==='dates'){
    const field=event.target;field.disabled=true;
    try{await post({action:'recurring_toggle',event_id:id,date:field.value,available:field.checked});close(dialog,()=>openEvent(id))}
    catch(err){field.disabled=false;alert(err.message||'Modification impossible.');refresh()}
    return;
   }
   if(event.target===decline&&decline.checked)form.querySelectorAll('[name="dates"]').forEach(x=>x.checked=false);else if(event.target.name==='dates'&&event.target.checked&&decline)decline.checked=false;draft()});
  body.querySelector('[data-leisure-later]')?.addEventListener('click',()=>close(dialog));
  body.querySelector('[data-leisure-edit]')?.addEventListener('click',()=>close(dialog,()=>openEditor(id)));
  body.querySelector('[data-leisure-invite]')?.addEventListener('click',()=>close(dialog,()=>openInvite(id)));
  if(e.is_organizer){
   const deleteButton=document.createElement('button');
   deleteButton.type='button';deleteButton.className='stip-btn secondary leisure-delete-action';
   deleteButton.textContent='🗑️ Supprimer définitivement';
   body.querySelector('.leisure-actions:last-child')?.append(deleteButton);
   deleteButton.onclick=()=>close(dialog,()=>openDelete(id));
  }
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(!editable||host)return;draft();const d=drafts.get(id),status=body.querySelector('[data-leisure-error]');
   if(!d.declined&&!d.dates.length){status.textContent='Choisis une date ou « Je ne participe pas ».';return}
   const submit=form.querySelector('[type="submit"]');submit.disabled=true;status.textContent='Enregistrement…';
   try{await post({action:'respond',event_id:id,revision:e.revision,selected_dates:d.dates,declined:d.declined});drafts.delete(id);close(dialog);const msg=document.querySelector('#leisureStatus');if(msg)msg.textContent=d.declined?'Réponse enregistrée. Tu peux la modifier ici.':'Réponse enregistrée. Les chats de tes dates sont disponibles ci-dessous.'}
   catch(error){status.textContent=error.message;refresh()}finally{submit.disabled=false}
  });
 }
 async function openInvite(id){
  if(!state.loaded)await refresh();
  const e=find(id);if(!e||!e.can_invite)return;
  const dialog=dialogShell('Inviter des collègues · '+e.title);if(!dialog)return;
  const body=dialog.querySelector('[data-leisure-body]');
  const existing=new Set((e.invited_colleagues||[]).map(p=>p.id));
  body.innerHTML='<p class="leisure-invite-description">Ajoute des personnes à cette sortie sans la recréer. Chacune recevra une invitation pour les dates existantes.</p>'+
   '<form data-stip-form-mode="standard" class="leisure-invite-form"><label>Rechercher un collègue<input type="search" data-leisure-agent-search placeholder="Prénom ou nom" autocomplete="off"></label>'+
   '<div class="leisure-candidate-list" data-leisure-candidates aria-label="Collègues disponibles">Chargement des collègues…</div>'+
   '<p class="leisure-invite-count" data-leisure-count>0 collègue sélectionné</p>'+
   '<p role="status" data-leisure-invite-error></p><footer class="leisure-actions"><button class="stip-btn" type="submit">Envoyer les invitations</button><button class="stip-btn secondary" type="button" data-leisure-close-invite>Annuler</button></footer></form>';
  const form=body.querySelector('form'),list=body.querySelector('[data-leisure-candidates]'),search=body.querySelector('[data-leisure-agent-search]'),count=body.querySelector('[data-leisure-count]'),error=body.querySelector('[data-leisure-invite-error]');
  let people=[];
  function renderCandidates(){
   const needle=search.value.trim().toLocaleLowerCase('fr');
   const checked=new Set([...list.querySelectorAll('input:checked')].map(x=>x.value));
   list.innerHTML=people.map(p=>'<label class="leisure-candidate" data-name="'+esc(p.name.toLocaleLowerCase('fr'))+'"><input type="checkbox" value="'+esc(p.id)+'" '+(checked.has(p.id)?'checked':'')+'><span>'+esc(p.name)+'</span></label>').join('')||'<p>Tous les collègues éligibles sont déjà invités.</p>';
   list.querySelectorAll('[data-name]').forEach(row=>row.hidden=!!needle&&!row.dataset.name.includes(needle));
   count.textContent=checked.size+' collègue'+(checked.size>1?'s':'')+' sélectionné'+(checked.size>1?'s':'');
  }
  search.addEventListener('input',()=>{
   const needle=search.value.trim().toLocaleLowerCase('fr');
   list.querySelectorAll('[data-name]').forEach(row=>row.hidden=!!needle&&!row.dataset.name.includes(needle));
  });
  list.addEventListener('change',()=>{const n=list.querySelectorAll('input:checked').length;count.textContent=n+' collègue'+(n>1?'s':'')+' sélectionné'+(n>1?'s':'');});
  body.querySelector('[data-leisure-close-invite]').onclick=()=>close(dialog);
  try{
   const token=localStorage.getItem(STORE)||'';
   const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify({action:'colleagues'})});
   const json=await r.json();if(!r.ok||json.error)throw Error(json.error||'Annuaire indisponible');
   people=(json.colleagues||[]).filter(p=>!existing.has(p.id));renderCandidates();
  }catch(err){error.textContent='Annuaire inaccessible : '+err.message;list.textContent='';}
  form.onsubmit=async event=>{
   event.preventDefault();
   const ids=[...list.querySelectorAll('input:checked')].map(x=>x.value);
   if(!ids.length){error.textContent='Choisis au moins un collègue.';return;}
   const btn=form.querySelector('[type="submit"]');btn.disabled=true;error.textContent='Envoi…';
   try{
    const result=await post({action:'invite',event_id:e.id,agent_ids:ids});
    close(dialog);
    const status=document.querySelector('#leisureStatus');
    if(status)status.textContent=result.added+' nouvelle(s) invitation(s) envoyée(s) à '+e.title+'.';
   }catch(err){error.textContent=err.message;}
   finally{btn.disabled=false;}
  };
 }

 function openDelete(id){
  const e=find(id);if(!e?.is_organizer)return;
  const dialog=dialogShell('Supprimer · '+e.title);if(!dialog)return;
  const body=dialog.querySelector('[data-leisure-body]');
  body.innerHTML='<div class="leisure-danger"><strong>Suppression définitive</strong>'+
    '<p>Tu effaceras cette activité, ses invitations, ses participations et tous les messages de ses discussions. Cette opération est irréversible.</p></div>'+
    '<form class="leisure-delete-form"><label>Écris <strong>SUPPRIMER</strong> pour confirmer :'+
    '<input name="confirmation" required autocomplete="off" spellcheck="false" placeholder="SUPPRIMER"></label>'+
    '<p role="alert" data-delete-error></p>'+
    '<footer class="leisure-actions"><button type="button" class="stip-btn secondary" data-delete-cancel>Conserver</button>'+
    '<button type="submit" class="stip-btn leisure-delete-submit" disabled>Supprimer définitivement</button></footer></form>';
  const form=body.querySelector('form'),button=form.querySelector('[type="submit"]'),field=form.elements.confirmation;
  field.addEventListener('input',()=>{button.disabled=field.value.trim().toLocaleUpperCase('fr')!=='SUPPRIMER'});
  body.querySelector('[data-delete-cancel]').onclick=()=>close(dialog);
  form.onsubmit=async event=>{
   event.preventDefault();if(button.disabled)return;
   button.disabled=true;const error=body.querySelector('[data-delete-error]');
   error.textContent='Suppression en cours…';
   try{
    await post({action:'delete',event_id:id,confirm:'SUPPRIMER'});
    drafts.delete(id);close(dialog);
    const status=document.querySelector('#leisureStatus');if(status)status.textContent='Activité supprimée définitivement.';
   }catch(err){error.textContent=err.message;button.disabled=false}
  };
 }
 function openRecurringEditor(id){
  const e=find(id);if(!e?.is_organizer)return;
  const dialog=dialogShell('Gérer · '+e.title);if(!dialog)return;
  const body=dialog.querySelector('[data-leisure-body]');
  body.innerHTML='<form class="leisure-editor"><p class="leisure-recurring-notice">↻ Les séances suivent tes fermetures. Pour annuler une date seulement, utilise « Mes disponibilités ».</p>'+
   '<label>Titre<input name="title" required maxlength="120" value="'+esc(e.title)+'"></label>'+
   '<label>Informations<textarea name="description" maxlength="2000">'+esc(e.description)+'</textarea></label>'+
   '<label>Lieu<input name="location" maxlength="240" value="'+esc(e.location)+'"></label>'+
   '<label>Rendez-vous<input name="time_label" maxlength="240" value="'+esc(e.time_label)+'"></label>'+
   '<p role="alert" data-leisure-error></p>'+
   '<footer class="leisure-actions"><button type="submit" class="stip-btn">Enregistrer</button>'+
   '<button type="button" class="stip-btn secondary" data-invite-more>＋ Inviter</button>'+
   '<button type="button" class="stip-btn secondary" data-stop-series>Arrêter la série</button>'+
   '<button type="button" class="stip-btn secondary leisure-delete-action" data-delete-series>🗑️ Supprimer définitivement</button></footer></form>';
  const form=body.querySelector('form'),error=body.querySelector('[data-leisure-error]');
  form.onsubmit=async ev=>{
   ev.preventDefault();const submit=form.querySelector('[type="submit"]');submit.disabled=true;
   error.textContent='Enregistrement…';
   try{
    await post({action:'recurring_details',event_id:id,revision:e.revision,title:form.elements.title.value,
      description:form.elements.description.value,location:form.elements.location.value,
      time_label:form.elements.time_label.value});
    close(dialog);
   }catch(err){error.textContent=err.message;submit.disabled=false}
  };
  body.querySelector('[data-invite-more]').onclick=()=>close(dialog,()=>openInvite(id));
  body.querySelector('[data-delete-series]').onclick=()=>close(dialog,()=>openDelete(id));
  body.querySelector('[data-stop-series]').onclick=async()=>{
   if(!confirm('Arrêter les prochaines séances ? La discussion sera conservée.'))return;
   try{await post({action:'recurring_stop',event_id:id});close(dialog)}
   catch(err){error.textContent=err.message}
  };
 }
 function openEditor(id=''){
  if(id&&find(id)?.recurring_closing)return openRecurringEditor(id);
  const e=id?find(id):null;if(e&&!e.can_manage||!e&&!state.can_create)return;
  const dialog=dialogShell(e?'Gérer la sortie':'Proposer une sortie');if(!dialog)return;
  const body=dialog.querySelector('[data-leisure-body]');
  body.innerHTML=`<form data-stip-form-mode="standard" class="leisure-editor"><label>Titre<input name="title" required maxlength="120" value="${esc(e?.title||'')}"></label><label>Informations<textarea name="description" maxlength="2000">${esc(e?.description||'')}</textarea></label><label>Lieu<input name="location" maxlength="240" value="${esc(e?.location||'')}"></label><label>Horaire<input name="time_label" maxlength="240" value="${esc(e?.time_label||'')}"></label><fieldset><legend>Dates proposées</legend><div data-leisure-dates></div><button type="button" class="stip-btn secondary" data-add-date>Ajouter une date</button></fieldset><p role="status" data-leisure-error></p><footer class="leisure-actions"><button type="submit" class="stip-btn">${e?'Enregistrer':'Créer la sortie'}</button>${e?`<button type="button" class="stip-btn secondary" data-invite-event>＋ Inviter des collègues</button><button type="button" class="stip-btn secondary" data-cancel-event>${e.status==='cancelled'?'Rouvrir la sortie':'Annuler la sortie'}</button>`:''}</footer></form>`;
  const form=body.querySelector('form'),rows=body.querySelector('[data-leisure-dates]');
  function add(d=''){if(rows.children.length>=24)return;const row=document.createElement('div');row.className='leisure-date-editor';row.innerHTML=`<input type="date" name="date" aria-label="Date proposée" value="${esc(d)}" required><button type="button" class="stip-btn secondary" aria-label="Retirer cette date">×</button>`;row.querySelector('button').onclick=()=>row.remove();rows.appendChild(row)}
  (e?.dates||['']).forEach(add);body.querySelector('[data-add-date]').onclick=()=>add();
  async function save(status='active'){
   const error=body.querySelector('[data-leisure-error]'),buttons=[...form.querySelectorAll('button')];if(!form.reportValidity())return;
   const ds=[...rows.querySelectorAll('input')].map(x=>x.value);if(!ds.length){error.textContent='Ajoute au moins une date.';return}
   buttons.forEach(x=>x.disabled=true);error.textContent='Enregistrement…';
   try{await post({action:'save',id:e?.id,revision:e?.revision,title:form.elements.title.value,description:form.elements.description.value,location:form.elements.location.value,time_label:form.elements.time_label.value,dates:ds,status});close(dialog)}catch(err){error.textContent=err.message}finally{buttons.forEach(x=>x.disabled=false)}
  }
  form.addEventListener('submit',event=>{event.preventDefault();save(e?.status||'active')});
  body.querySelector('[data-invite-event]')?.addEventListener('click',()=>close(dialog,()=>openInvite(e.id)));
  if(e?.is_organizer){
   const deleteButton=document.createElement('button');
   deleteButton.type='button';deleteButton.className='stip-btn secondary leisure-delete-action';
   deleteButton.textContent='🗑️ Supprimer définitivement';
   body.querySelector('.leisure-editor footer')?.append(deleteButton);
   deleteButton.onclick=()=>close(dialog,()=>openDelete(e.id));
  }body.querySelector('[data-cancel-event]')?.addEventListener('click',()=>{const target=e.status==='cancelled'?'active':'cancelled';if(confirm(target==='cancelled'?'Annuler cette sortie ? Les réponses seront conservées.':'Rouvrir cette sortie ?'))save(target)});
 }

 function cardHTML(e){
  const upcoming=(e.dates||[]).filter(d=>d>=today()).sort();
  const when=upcoming.slice(0,3);
  const status=!active(e)?'Terminé':e.is_organizer?'J’organise':e.needs_response?'À répondre':e.response?.declined?'Décliné':'Partant';
  const role=e.is_organizer?'Organisateur':e.recurring_closing?'Séances récurrentes':'Sortie entre collègues';
  const unavailable=new Set(e.organizer_unavailable_dates||[]);
  const action=e.recurring_closing?(e.is_organizer?'Mes disponibilités':'Choisir mes dates'):e.is_organizer?'Gérer':'Mes dates';
  const dayHTML=when.map(d=>{
   const date=new Date(d+'T12:00:00');
   const weekday=date.toLocaleDateString('fr-FR',{weekday:'short'}).replace('.','');
   const day=date.getDate();
   const count=(e.participants||[]).filter(p=>(p.selected_dates||[]).includes(d)).length;
   return '<div class="ensemble-day'+(unavailable.has(d)?' is-unavailable':'')+'"><small>'+esc(weekday)+'</small><b>'+day+'</b><span>'+ (unavailable.has(d)?'Indisponible':count+' partant'+(count>1?'s':''))+'</span></div>';
  }).join('');
  const future=active(e);
  const firstChat=e.series_conversation_id?{conversation_id:e.series_conversation_id}:(e.chats||[]).find(c=>c.date>=today())||(e.chats||[])[0];
  return '<article class="ensemble-activity'+(future?'':' is-archived')+'">'+
    '<header class="ensemble-activity-head"><span class="ensemble-activity-icon" aria-hidden="true">'+iconFor(e.title)+'</span>'+
    '<div class="ensemble-activity-title"><h3>'+esc(e.title)+'</h3><small>'+esc(role)+'</small></div>'+
    (e.needs_response&&!e.is_organizer?'<span class="ensemble-statuschip is-pending">À répondre</span>':'')+
    (!future?'<span class="ensemble-statuschip is-closed">'+esc(e.status==='cancelled'?'Annulée':'Terminée')+'</span>':'')+
    '</header>'+
    '<div class="ensemble-activity-meta">'+esc([e.location||'',e.time_label||''].filter(Boolean).join(' · ')||'Lieu et horaire à préciser')+
    (e.recurring_closing?'<br>↻ Se renouvelle avec le planning':'')+'</div>'+
    (when.length?'<div class="ensemble-date-strip" aria-label="Prochaines dates">'+dayHTML+'</div>':
     '<p class="ensemble-no-dates">Aucune date à venir</p>')+
    '<div class="ensemble-card-actions"><button type="button" class="ensemble-primary" data-leisure-event="'+esc(e.id)+'">'+
     esc(future?action:'Voir les détails')+'</button>'+
    (e.can_invite&&future?'<button type="button" class="ensemble-subtle" data-leisure-add-invite="'+esc(e.id)+'">＋ Inviter</button>':
     firstChat?'<a class="ensemble-subtle" href="'+esc(chatURL(firstChat.conversation_id))+'">Discuter</a>':'')+
    '</div></article>';
 }
 function setView(tab){
  if(!['activities','trips','invitations'].includes(tab))tab='activities';
  view.tab=tab;
  const leisure=document.querySelector('#leisureApp'),carpool=document.querySelector('#carpoolApp'),creator=document.querySelector('#ensembleCreator');
  if(leisure)leisure.hidden=tab==='trips';
  if(carpool)carpool.hidden=tab!=='trips';
  if(creator)creator.hidden=tab!=='activities'||!view.createOpen;
  document.querySelectorAll('[data-ensemble-tab]').forEach(button=>{
   const selected=button.dataset.ensembleTab===tab;
   button.classList.toggle('is-active',selected);
   button.setAttribute('aria-selected',selected?'true':'false');
  });
 }
 function renderApp(){
  const root=document.querySelector('#leisureApp');if(!root)return;
  if(!state.loaded){
   root.innerHTML='<section class="ensemble-empty" role="status"><span aria-hidden="true">⏳</span><strong>Chargement des activités</strong>'+
     '<p>'+esc(state.error||'Récupération de tes sorties en cours…')+'</p>'+
     (state.error?'<button type="button" class="ensemble-subtle" data-leisure-refresh style="margin-top:14px">Réessayer</button>':'')+
     (!localStorage.getItem(STORE)?'<a class="ensemble-subtle" href="index.html#/home">Se connecter</a>':'')+
     '</section>';setView(view.tab);return;
  }
  const activities=state.events.filter(e=>active(e)).sort((a,b)=>(a.dates||[]).filter(d=>d>=today())[0]?.localeCompare((b.dates||[]).filter(d=>d>=today())[0]||'9999-12-31')||0);
  const archives=state.events.filter(e=>!active(e));
  const invitations=activities.filter(e=>e.needs_response&&!e.is_organizer);
  const badge=document.querySelector('#ensembleInviteBadge');if(badge){badge.hidden=!invitations.length;badge.textContent=invitations.length;}
  const stats=document.querySelector('#ensembleSummary');
  if(stats)stats.textContent=activities.length+' activité'+(activities.length>1?'s':'')+' en cours';
  const ct='<section class="ensemble-cta"><div><h3>Un moment à partager ?</h3><p>Propose une activité, on s’occupe des invitations.</p></div>'+
    (state.can_create?'<button type="button" class="ensemble-primary" data-ensemble-create>＋ Proposer</button>':'')+'</section>';
  const content=view.tab==='invitations'
    ?'<header class="ensemble-sectionhead"><div><h2>Mes invitations</h2><p>Les propositions qui attendent ta réponse</p></div><span class="ensemble-count">'+invitations.length+'</span></header>'+
      (invitations.length?'<div class="ensemble-cards">'+invitations.map(cardHTML).join('')+'</div>':
      '<div class="ensemble-empty"><span aria-hidden="true">✉️</span><strong>Tout est à jour</strong><p>Aucune invitation en attente pour le moment.</p></div>')
    :ct+'<header class="ensemble-sectionhead"><div><h2>Mes activités</h2><p>Choisis une date ou retrouve tes sorties.</p></div><span class="ensemble-count">'+activities.length+'</span></header>'+
     (activities.length?'<div class="ensemble-cards">'+activities.map(cardHTML).join('')+'</div>':
      '<div class="ensemble-empty"><span aria-hidden="true">🏋️</span><strong>On organise quelque chose ?</strong><p>Les propositions et entraînements apparaîtront ici.</p></div>')+
     (archives.length?'<details class="ensemble-more"><summary>Sorties passées et annulées · '+archives.length+'</summary><div class="ensemble-cards">'+archives.slice(0,20).map(cardHTML).join('')+'</div></details>':'');
  root.innerHTML=content;
  setView(view.tab);
 }
 function openCreator(mode=''){
  const parent=document.querySelector('#ensembleCreator');if(!parent)return;
  view.tab='activities';view.createOpen=true;view.createMode=mode;
  setView('activities');
  document.querySelectorAll('[data-ensemble-option]').forEach(el=>{
   const yes=el.dataset.ensembleOption===mode;el.classList.toggle('is-selected',yes);el.setAttribute('aria-pressed',yes?'true':'false');
  });
  const recur=document.querySelector('#trainingRecurringApp'),matched=document.querySelector('#ensembleAfterworkCreate');
  if(recur)recur.hidden=mode!=='recurring';
  if(matched)matched.hidden=mode!=='matched';
  if(mode==='recurring')window.STIPTrainingRecurring?.open?.();
  if(mode==='matched'&&matched){
   if(!matched.querySelector('#awPanel'))matched.innerHTML=window.STIPAfterwork?.panelHTML?.()||'<p>Le module de proposition est indisponible.</p>';
   window.STIPAfterwork?.bindPanel?.();
  }
  if(mode==='date'){view.createOpen=false;setView('activities');openEditor();return;}
  if(mode)parent.scrollIntoView({block:'start',behavior:'smooth'});
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-ensemble-tab],[data-ensemble-create],[data-ensemble-close],[data-ensemble-option],[data-leisure-event],[data-leisure-add-invite],[data-leisure-manage],[data-leisure-create],[data-leisure-refresh]');
  if(!b)return;
  if(b.hasAttribute('data-ensemble-tab')){setView(b.dataset.ensembleTab);renderApp();}
  else if(b.hasAttribute('data-ensemble-create'))openCreator();
  else if(b.hasAttribute('data-ensemble-close')){view.createOpen=false;setView('activities');}
  else if(b.hasAttribute('data-ensemble-option'))openCreator(b.dataset.ensembleOption);
  else if(b.hasAttribute('data-leisure-add-invite'))openInvite(b.dataset.leisureAddInvite);
  else if(b.hasAttribute('data-leisure-event'))openEvent(b.dataset.leisureEvent);
  else if(b.hasAttribute('data-leisure-manage'))openEditor(b.dataset.leisureManage);
  else if(b.hasAttribute('data-leisure-create'))openEditor();
  else refresh();
 });
 window.STIPLeisure={refresh,pendingHTML,openEvent,openInvite,openCreator,closeCreator:()=>{view.createOpen=false;setView('activities')},setTab:setView};
 ['stip:session-ready','stip:boot-updated'].forEach(e=>window.addEventListener(e,refresh));
 ['stip:session-ended','stip:session-expired'].forEach(e=>window.addEventListener(e,reset));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 setInterval(()=>{if(!document.hidden)refresh()},300000);
 if(document.querySelector('#leisureApp')){window.STIPContinuity?.validate?.().then(()=>refresh()).catch(e=>{state.error='Connecte-toi sur l’accueil pour ouvrir les sorties.';renderApp()});renderApp()}
 else if(window.STIPSession)refresh();
})();
