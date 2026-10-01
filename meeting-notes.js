(() => {
  'use strict';
  const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-meeting-notes',STORE='stip_session_v1';
  const KINDS={info:['Info','Ce qui est simplement utile'],idea:['Idée','Une piste ou proposition'],decision:['Décision','Ce qui est réellement tranché'],action:['À faire','Qui doit agir ensuite'],question:['Question','Ce qui reste à éclaircir'],verify:['À vérifier','Source, date ou fait à confirmer'],waiting:['En attente','Une réponse doit revenir'],test:['Test / retour','Quelqu’un doit tester puis revenir'],important:['Important','À ne surtout pas perdre']};
  const state={meetings:[],pending:[],current:null,candidates:null,editingItem:null,followupItem:null};
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const token=()=>localStorage.getItem(STORE)||'';
  const fmt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'Date inconnue':d.toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})};
  const localInput=v=>{const d=v?new Date(v):new Date();if(Number.isNaN(d.getTime()))return '';const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`};
  const status=t=>{$('#meetingStatus').textContent=t||''};
  const wstatus=t=>{$('[data-meeting-workspace-status]').textContent=t||''};
  const errMap={SESSION_STIP_REQUISE:'Connecte-toi depuis l’accueil GHE.',SESSION_EXPIREE:'Ta session a expiré.',ACCES_NOTES_REUNION_REQUIS:'Cette application n’est pas autorisée pour ce profil.',ACCES_REUNION_REFUSE:'Tu dois accepter l’invitation avant d’ouvrir cette réunion.',ACCES_ORGANISATEUR_REQUIS:'Seul l’organisateur peut modifier cette réunion.',REUNION_FINALISEE:'Cette réunion est déjà finalisée.',EMAIL_NON_CONFIGURE:'L’envoi du fichier n’est pas configuré.',EMAIL_ORGANISATEUR_MANQUANT:'Aucune adresse e-mail valide n’est enregistrée sur ta fiche.',EMAIL_ENVOI_REFUSE:'Le fichier n’a pas été accepté par le service mail. Rien n’a été purgé.',COLONNE_UTILISEE:'Cette colonne contient déjà des notes. Déplace-les avant de la retirer.',INVITE_NON_AUTORISE:'Cette personne ne dispose pas de l’accès Notes de réunion.'};
  async function post(body){
    const t=token();if(!t)throw Error('Connecte-toi depuis l’accueil GHE.');
    const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-STIP-Session':t},body:JSON.stringify(body)}),j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw Error(errMap[j.error]||j.error||'Impossible de terminer cette action.');
    return j;
  }
  function closeDialog(d){if(!d)return;if(window.STIPOverlayNav?.close)window.STIPOverlayNav.close(d);else d.close();}
  function openDialog(d){if(!d.open)d.showModal();window.STIPOverlayNav?.track?.(d);}
  function meetingById(id){return state.meetings.find(x=>x.id===id)}
  function kindLabel(k){return KINDS[k]?.[0]||'Info'}
  function kindIcon(k){return ({info:'•',idea:'✦',decision:'✓',action:'→',question:'?',verify:'⌕',waiting:'…',test:'↻',important:'!'}[k]||'•')}
  function memberName(m){return m.agent_name||[m.agent?.prenom,m.agent?.nom].filter(Boolean).join(' ')||'Agent'}

  async function loadList(openRequested=true){
    status('Chargement…');
    try{
      const j=await post({action:'list'});state.meetings=j.meetings||[];state.pending=j.pending_invites||[];renderList();status('');
      const requested=new URLSearchParams(location.search).get('meeting');
      if(openRequested&&requested&&meetingById(requested))await openMeeting(requested,false);
    }catch(e){status(e.message);state.meetings=[];state.pending=[];renderList()}
  }
  function renderList(){
    const pending=$('#meetingPending');
    pending.innerHTML=state.pending.map(x=>`<article class="meeting-invite-card"><span><strong>${esc(x.title)}</strong><small>${esc(x.organizer_name)} · ${esc(fmt(x.meeting_at))}</small></span><span class="meeting-invite-actions"><button type="button" data-invite-accept="${esc(x.meeting_id)}">Accepter</button><button type="button" class="secondary" data-invite-decline="${esc(x.meeting_id)}">Refuser</button></span></article>`).join('');
    const list=$('#meetingList');
    list.innerHTML=state.meetings.length?state.meetings.map(m=>`<button type="button" class="meeting-card" data-open-meeting="${esc(m.id)}"><span><small>${m.phase==='finalized'?'FINALISÉE':m.access_role==='organizer'?'ORGANISATEUR':'PARTICIPANT'}</small><strong>${esc(m.title)}</strong><span>${esc(fmt(m.meeting_at))}${m.organizer_name?` · ${esc(m.organizer_name)}`:''}</span></span><i>›</i></button>`).join(''):'<div class="meeting-empty"><strong>Aucune réunion</strong><p>Crée un tableau quand une discussion mérite d’être structurée.</p></div>';
    $$('[data-open-meeting]',list).forEach(b=>b.onclick=()=>openMeeting(b.dataset.openMeeting));
    $$('[data-invite-accept]').forEach(b=>b.onclick=()=>respondInvite(b.dataset.inviteAccept,'accepted'));
    $$('[data-invite-decline]').forEach(b=>b.onclick=()=>respondInvite(b.dataset.inviteDecline,'declined'));
  }
  async function respondInvite(id,decision){
    status(decision==='accepted'?'Acceptation…':'Refus…');
    try{await post({action:'respond_invite',meeting_id:id,decision});await loadList(false);window.dispatchEvent(new CustomEvent('stip:meeting-refresh'));if(decision==='accepted')await openMeeting(id)}catch(e){status(e.message)}
  }
  async function openMeeting(id,push=true){
    wstatus('Chargement…');
    try{
      state.current=await post({action:'detail',meeting_id:id});
      $('#meetingListView').hidden=true;$('#meetingWorkspace').hidden=false;renderWorkspace();wstatus('');
      if(push)history.replaceState(null,'','meeting-notes.html?meeting='+encodeURIComponent(id));
      const focused=new URLSearchParams(location.search).get('item');if(focused)setTimeout(()=>document.querySelector(`[data-item-focus="${CSS.escape(focused)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),120);
    }catch(e){wstatus(e.message)}
  }
  function leaveMeeting(){state.current=null;$('#meetingWorkspace').hidden=true;$('#meetingListView').hidden=false;history.replaceState(null,'','meeting-notes.html');renderList();}
  function renderMembers(){
    const m=state.current.meeting,members=state.current.members||[];
    $('[data-meeting-members]').innerHTML=members.map(x=>`<span class="meeting-member ${esc(x.status)} ${x.member_role==='organizer'?'organizer':''}">${esc(memberName(x))}${x.status==='pending'?' · invitation en attente':x.status==='declined'?' · refusée':''}</span>`).join('')||'<span class="meeting-member organizer">Organisateur</span>';
    $('[data-meeting-invite]').hidden=!(m.can_manage&&m.phase==='live');
  }
  function recipientCount(item){return (state.current.recipients||[]).filter(r=>r.item_id===item.id).length}
  function participantRecipient(item){return (state.current.recipients||[]).find(r=>r.item_id===item.id)||null}
  function itemHTML(item,manage){
    const rec=participantRecipient(item),shared=item.visibility==='shared';
    const tag=shared?`<span class="privacy shared">Partagé${manage?` · ${recipientCount(item)} pers.`:''}</span>`:'<span class="privacy private">Privé</span>';
    const content=`<small><span>${esc(kindIcon(item.kind)+' '+kindLabel(item.kind))}</span>${tag}</small><p>${esc(item.body)}</p>`;
    if(manage)return `<button type="button" class="meeting-item" data-kind="${esc(item.kind)}" data-edit-item="${esc(item.id)}" data-item-focus="${esc(item.id)}">${content}</button>`;
    const actionable=['action','question','verify','waiting','test'].includes(item.kind);
    const action=rec?.status==='open'?`<button type="button" class="meeting-followup-action" data-followup-item="${esc(item.id)}">${actionable?'Ajouter mon retour / terminer':'Marquer comme vu'}</button>`:rec?`<button type="button" class="meeting-followup-action" disabled>${rec.status==='done'?'Terminé':'Vu'}</button>`:'';
    return `<article class="meeting-item" data-kind="${esc(item.kind)}" data-item-focus="${esc(item.id)}">${content}${action}</article>`;
  }
  function renderBoard(){
    const m=state.current.meeting,items=state.current.items||[],lanes=Array.isArray(m.lanes)?m.lanes:[],manage=m.can_manage&&m.phase==='live',root=$('#meetingBoard');
    if(!items.length){root.innerHTML=`<div class="meeting-board-empty"><strong>${m.phase==='finalized'?'Aucun élément partagé':'Le tableau est vide'}</strong><p>${manage?'Ajoute le premier sujet. Les raccourcis t’aideront à repérer décision, question, action, attente ou test.':'Aucune suite ne t’a été partagée pour cette réunion.'}</p></div>`;return}
    const topics=[];for(const x of items){if(!topics.includes(x.topic))topics.push(x.topic)}
    let html=`<div class="meeting-board-scroll"><div class="meeting-grid" style="--lane-count:${lanes.length}"><div class="meeting-grid-head"><div>SUJET</div>${lanes.map(l=>`<div>${esc(l.label)}</div>`).join('')}</div>`;
    for(const topic of topics){html+=`<div class="meeting-topic-label">${esc(topic)}</div>`;for(const lane of lanes){const cell=items.filter(x=>x.topic===topic&&x.lane_key===lane.key);html+=`<div class="meeting-cell"><div class="meeting-cell-items">${cell.map(x=>itemHTML(x,manage)).join('')}</div>${manage?`<button type="button" class="meeting-cell-add" data-add-topic="${esc(topic)}" data-add-lane="${esc(lane.key)}">＋ compléter</button>`:''}</div>`}}
    html+='</div></div>';root.innerHTML=html;
    $$('[data-edit-item]',root).forEach(b=>b.onclick=()=>openCompose('', '',b.dataset.editItem));
    $$('[data-add-topic]',root).forEach(b=>b.onclick=()=>openCompose(b.dataset.addTopic,b.dataset.addLane));
    $$('[data-followup-item]',root).forEach(b=>b.onclick=()=>openFollowup(b.dataset.followupItem));
  }
  function renderWorkspace(){
    const m=state.current.meeting;$('[data-meeting-title]').textContent=m.title;$('[data-meeting-date]').textContent=fmt(m.meeting_at);$('[data-meeting-phase]').textContent=m.phase==='finalized'?'RÉUNION FINALISÉE':m.can_manage?'ORGANISATEUR':'PARTICIPANT';
    $('[data-meeting-settings]').hidden=!(m.can_manage&&m.phase==='live');$('[data-meeting-add]').hidden=!(m.can_manage&&m.phase==='live');$('[data-meeting-final-actions]').hidden=!(m.can_manage&&m.phase==='live');
    $('[data-meeting-board-hint]').textContent=m.phase==='finalized'?'Les suites partagées restent vivantes jusqu’à leur traitement.':m.can_manage?'Chaque ajout se greffe au bon sujet.':'Tu vois uniquement les éléments explicitement partagés avec toi.';
    renderMembers();renderBoard();
    const old=$('.meeting-final-banner');if(old)old.remove();if(m.phase==='finalized')$('#meetingBoard').insertAdjacentHTML('beforebegin','<div class="meeting-final-banner">Le fichier complet a été envoyé à l’organisateur. Les notes privées ont été purgées ; seules les suites explicitement partagées restent ici.</div>');
  }
  function openCreate(){
    const d=$('#meetingCreate'),f=$('[data-meeting-create-form]',d);f.reset();f.elements.meeting_at.value=localInput();$('[data-dialog-status]',d).textContent='';openDialog(d);setTimeout(()=>f.elements.title.focus(),60);
  }
  async function createMeeting(event){
    event.preventDefault();const f=event.currentTarget,d=$('#meetingCreate'),msg=$('[data-dialog-status]',d),submit=f.querySelector('[type="submit"]');submit.disabled=true;msg.textContent='Création…';
    try{const j=await post({action:'create',title:f.elements.title.value,meeting_at:new Date(f.elements.meeting_at.value).toISOString(),lanes:[{key:'a',label:'Moi'},{key:'b',label:'Interlocuteur'},{key:'suite',label:'Suite'}]});closeDialog(d);state.current={meeting:j.meeting,members:j.members,items:j.items,recipients:j.recipients};await loadList(false);await openMeeting(j.meeting.id)}catch(e){msg.textContent=e.message}finally{submit.disabled=false}
  }
  function acceptedMembers(){return (state.current?.members||[]).filter(x=>x.status==='accepted')}
  function renderKinds(active='info'){$('[data-kind-choices]').innerHTML=Object.entries(KINDS).map(([k,[label,help]])=>`<button type="button" class="meeting-kind-choice${k===active?' active':''}" data-kind="${k}" title="${esc(help)}">${esc(label)}</button>`).join('');$$('[data-kind]').forEach(b=>b.onclick=()=>{$$('[data-kind]').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('[data-meeting-compose-form]').elements.kind.value=b.dataset.kind})}
  function audienceHTML(selected=[]){const set=new Set(selected.map(String));return acceptedMembers().map(x=>`<label class="meeting-audience-person"><input type="checkbox" name="audience_agent" value="${esc(x.agent_id)}" ${set.has(String(x.agent_id))?'checked':''}> ${esc(memberName(x))}</label>`).join('')||'<small>Aucun autre participant n’a encore accepté.</small>'}
  function syncAudienceUI(){const f=$('[data-meeting-compose-form]'),shared=f.elements.visibility.value==='shared',section=$('[data-meeting-audience]');section.hidden=!shared;if(!shared)return;const selected=f.elements.audience_mode.value==='selected';$('[data-audience-people]').hidden=!selected}
  function openCompose(topic='',lane='',itemId=''){
    const m=state.current.meeting;if(!(m.can_manage&&m.phase==='live'))return;const d=$('#meetingCompose'),f=$('[data-meeting-compose-form]',d),item=itemId?(state.current.items||[]).find(x=>x.id===itemId):null;state.editingItem=item||null;f.reset();
    f.elements.topic.value=item?.topic||topic||'';f.elements.lane_key.innerHTML=(m.lanes||[]).map(x=>`<option value="${esc(x.key)}">${esc(x.label)}</option>`).join('');f.elements.lane_key.value=item?.lane_key||lane||(m.lanes?.[0]?.key||'a');f.elements.body.value=item?.body||'';f.elements.kind.value=item?.kind||'info';f.elements.visibility.value=item?.visibility||'private';f.elements.audience_mode.value=item?.audience_mode||'all';renderKinds(f.elements.kind.value);
    const selected=item?(state.current.recipients||[]).filter(r=>r.item_id===item.id).map(r=>r.agent_id):[];$('[data-audience-people]').innerHTML=audienceHTML(selected);$('[data-delete-item]').hidden=!item;$('[data-compose-title]').textContent=item?'Modifier l’élément':'Ajouter au tableau';$('[data-dialog-status]',d).textContent='';syncAudienceUI();openDialog(d);setTimeout(()=>f.elements.body.focus(),50);
  }
  async function saveItem(event){
    event.preventDefault();const f=event.currentTarget,d=$('#meetingCompose'),msg=$('[data-dialog-status]',d),submit=f.querySelector('[type="submit"]');submit.disabled=true;msg.textContent='Enregistrement…';
    try{const selected=[...f.querySelectorAll('[name="audience_agent"]:checked')].map(x=>x.value);const j=await post({action:'save_item',meeting_id:state.current.meeting.id,id:state.editingItem?.id||null,topic:f.elements.topic.value,lane_key:f.elements.lane_key.value,kind:f.elements.kind.value,body:f.elements.body.value,visibility:f.elements.visibility.value,audience_mode:f.elements.audience_mode.value,audience_agent_ids:selected});state.current={meeting:j.meeting,members:j.members,items:j.items,recipients:j.recipients};closeDialog(d);renderWorkspace();wstatus('Tableau mis à jour.');setTimeout(()=>wstatus(''),1000)}catch(e){msg.textContent=e.message}finally{submit.disabled=false}
  }
  async function deleteItem(){if(!state.editingItem||!confirm('Supprimer cet élément du brouillon ?'))return;const d=$('#meetingCompose'),msg=$('[data-dialog-status]',d);msg.textContent='Suppression…';try{const j=await post({action:'delete_item',meeting_id:state.current.meeting.id,id:state.editingItem.id});state.current={meeting:j.meeting,members:j.members,items:j.items,recipients:j.recipients};closeDialog(d);renderWorkspace()}catch(e){msg.textContent=e.message}}
  async function invite(){
    try{if(!state.candidates){wstatus('Chargement des personnes…');state.candidates=(await post({action:'candidates'})).agents||[];wstatus('')}
      const existing=new Set((state.current.members||[]).map(x=>String(x.agent_id))),items=state.candidates.filter(x=>!existing.has(String(x.id)));
      window.STIPAgentSelector?.openPicker({title:'Inviter à la réunion',items,showStatus:false,showPhone:false,autoFocus:true,onSelect:async agent=>{wstatus('Invitation…');try{const j=await post({action:'invite',meeting_id:state.current.meeting.id,agent_id:agent.id});state.current={meeting:j.meeting,members:j.members,items:j.items,recipients:j.recipients};renderWorkspace();wstatus('Invitation envoyée.');setTimeout(()=>wstatus(''),1200)}catch(e){wstatus(e.message)}}});
    }catch(e){wstatus(e.message)}
  }
  function openSettings(){
    const d=$('#meetingSettings'),f=$('[data-meeting-settings-form]',d),m=state.current.meeting;f.elements.title.value=m.title;f.elements.meeting_at.value=localInput(m.meeting_at);renderLaneRows(m.lanes||[]);$('[data-dialog-status]',d).textContent='';openDialog(d);
  }
  function renderLaneRows(rows){const host=$('[data-lane-rows]');host.innerHTML=rows.map((x,i)=>`<div class="meeting-lane-row" data-lane-row><input type="hidden" name="lane_key" value="${esc(x.key)}"><input name="lane_label" maxlength="80" required value="${esc(x.label)}" aria-label="Nom de la colonne ${i+1}"><button type="button" data-remove-lane aria-label="Retirer cette colonne" ${rows.length<=2?'disabled':''}>×</button></div>`).join('');$$('[data-remove-lane]',host).forEach(b=>b.onclick=()=>{b.closest('[data-lane-row]').remove();refreshRemoveLaneButtons()})}
  function refreshRemoveLaneButtons(){const rows=$$('[data-lane-row]');rows.forEach(r=>r.querySelector('[data-remove-lane]').disabled=rows.length<=2)}
  function addLane(){const host=$('[data-lane-rows]'),rows=$$('[data-lane-row]',host);if(rows.length>=5)return;const key='lane_'+Date.now().toString(36);host.insertAdjacentHTML('beforeend',`<div class="meeting-lane-row" data-lane-row><input type="hidden" name="lane_key" value="${key}"><input name="lane_label" maxlength="80" required value="Nouvelle colonne" aria-label="Nom de la nouvelle colonne"><button type="button" data-remove-lane aria-label="Retirer cette colonne">×</button></div>`);const row=host.lastElementChild;row.querySelector('[data-remove-lane]').onclick=()=>{row.remove();refreshRemoveLaneButtons()};refreshRemoveLaneButtons()}
  async function saveSettings(event){
    event.preventDefault();const f=event.currentTarget,d=$('#meetingSettings'),msg=$('[data-dialog-status]',d),rows=$$('[data-lane-row]',f),lanes=rows.map(r=>({key:r.querySelector('[name="lane_key"]').value,label:r.querySelector('[name="lane_label"]').value}));msg.textContent='Enregistrement…';
    try{const j=await post({action:'update_meeting',meeting_id:state.current.meeting.id,title:f.elements.title.value,meeting_at:new Date(f.elements.meeting_at.value).toISOString(),lanes});state.current={meeting:j.meeting,members:j.members,items:j.items,recipients:j.recipients};closeDialog(d);renderWorkspace();await loadList(false)}catch(e){msg.textContent=e.message}
  }
  async function finalize(){
    const m=state.current.meeting;if(!confirm('Finaliser cette réunion ?\n\nLe fichier COMPLET sera envoyé à ton adresse e-mail. Seulement après confirmation de l’envoi, les notes privées seront purgées. Les éléments partagés resteront disponibles aux participants qui ont accepté leur invitation.'))return;
    wstatus('Création et envoi du fichier…');$('[data-meeting-finalize]').disabled=true;
    try{const j=await post({action:'finalize',meeting_id:m.id});state.current={meeting:j.meeting,members:j.members,items:j.items,recipients:j.recipients};renderWorkspace();wstatus('Fichier envoyé. Notes privées purgées. Les suites partagées restent actives.');window.dispatchEvent(new CustomEvent('stip:meeting-refresh'));await loadList(false)}catch(e){wstatus(e.message)}finally{$('[data-meeting-finalize]').disabled=false}
  }
  async function discard(){if(!confirm('Abandonner cette réunion ? Le brouillon et ses invitations seront supprimés définitivement.'))return;wstatus('Suppression…');try{await post({action:'discard',meeting_id:state.current.meeting.id});leaveMeeting();await loadList(false);window.dispatchEvent(new CustomEvent('stip:meeting-refresh'))}catch(e){wstatus(e.message)}}
  function openFollowup(itemId){
    const item=(state.current.items||[]).find(x=>x.id===itemId),rec=participantRecipient(item);if(!item||!rec)return;const simple=!['action','question','verify','waiting','test'].includes(item.kind);if(simple){updateFollowup(item,'acknowledged',rec.response_text||'');return}
    state.followupItem=item;const d=$('#meetingFollowup'),f=$('[data-followup-form]',d);$('[data-followup-title]').textContent=kindLabel(item.kind);$('[data-followup-body]').textContent=item.body;f.elements.response_text.value=rec.response_text||'';$('[data-dialog-status]',d).textContent='';openDialog(d);
  }
  async function updateFollowup(item,statusValue,response){wstatus('Mise à jour…');try{await post({action:'followup_update',item_id:item.id,status:statusValue,response_text:response});await openMeeting(state.current.meeting.id,false);window.dispatchEvent(new CustomEvent('stip:meeting-refresh'));wstatus(statusValue==='open'?'Toujours en attente.':'Suite mise à jour.')}catch(e){wstatus(e.message)}}
  async function submitFollowup(event){event.preventDefault();const f=event.currentTarget,d=$('#meetingFollowup');if(!state.followupItem)return;closeDialog(d);await updateFollowup(state.followupItem,'done',f.elements.response_text.value)}

  document.addEventListener('DOMContentLoaded',()=>{
    $('[data-meeting-new]').onclick=openCreate;$('[data-meeting-refresh]').onclick=()=>loadList(false);$('[data-meeting-back]').onclick=leaveMeeting;$('[data-meeting-add]').onclick=()=>openCompose();$('[data-meeting-invite]').onclick=invite;$('[data-meeting-settings]').onclick=openSettings;$('[data-meeting-finalize]').onclick=finalize;$('[data-meeting-discard]').onclick=discard;$('[data-add-lane]').onclick=addLane;$('[data-delete-item]').onclick=deleteItem;
    $('[data-meeting-create-form]').addEventListener('submit',createMeeting);$('[data-meeting-compose-form]').addEventListener('submit',saveItem);$('[data-meeting-settings-form]').addEventListener('submit',saveSettings);$('[data-followup-form]').addEventListener('submit',submitFollowup);$('[data-followup-open]').onclick=()=>{const d=$('#meetingFollowup'),f=$('[data-followup-form]',d),item=state.followupItem;closeDialog(d);if(item)updateFollowup(item,'open',f.elements.response_text.value)};
    $$('dialog [data-dialog-close]').forEach(b=>b.onclick=()=>closeDialog(b.closest('dialog')));$$('dialog').forEach(d=>d.addEventListener('cancel',e=>{e.preventDefault();closeDialog(d)}));
    $$('[name="visibility"]',$('#meetingCompose')).forEach(x=>x.addEventListener('change',syncAudienceUI));$$('[name="audience_mode"]',$('#meetingCompose')).forEach(x=>x.addEventListener('change',syncAudienceUI));
    ['stip:session-ready','stip:boot-updated','stip:permissions-live'].forEach(name=>window.addEventListener(name,()=>loadList(true)));
    loadList(true);
  });
})();
