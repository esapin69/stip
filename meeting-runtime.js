(() => {
  'use strict';
  if (window.STIPMeeting) return;
  const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-meeting-notes',STORE='stip_session_v1';
  const state={pending:[],followups:[],token:'',loading:null};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})};
  const kindLabel=k=>({info:'Info',idea:'Idée',decision:'Décision',action:'À faire',question:'Question',verify:'À vérifier',waiting:'En attente',test:'Test / retour',important:'Important'}[k]||'Suite');
  async function post(body){
    const token=localStorage.getItem(STORE)||'';if(!token)throw Error('SESSION');
    const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify(body)}),j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw Error(j.error||'ERREUR');
    return j;
  }
  function notify(){window.dispatchEvent(new CustomEvent('stip:meeting-home-updated'));}
  function reset(){state.pending=[];state.followups=[];state.token='';notify();}
  async function refresh(){
    const token=localStorage.getItem(STORE)||'';if(!token){reset();return}
    if(state.loading)return state.loading;
    state.loading=post({action:'list_home'}).then(j=>{state.pending=j.pending_invites||[];state.followups=j.followups||[];state.token=token;notify();}).catch(()=>{}).finally(()=>state.loading=null);
    return state.loading;
  }
  function pendingHTML(){
    if(state.token!==(localStorage.getItem(STORE)||''))return '';
    const invites=state.pending.length?`<section class="meeting-home-zone" aria-label="Invitations à des réunions"><div class="meeting-home-separator">INVITATIONS RÉUNION</div>${state.pending.map(x=>`<article class="meeting-home-card is-invite"><i>🗒</i><span><strong>${esc(x.title)}</strong><small>${esc(x.organizer_name)} · ${esc(fmt(x.meeting_at))}</small></span><span class="meeting-home-invite-actions"><button type="button" data-meeting-home-accept="${esc(x.meeting_id)}">Accepter</button><button type="button" class="secondary" data-meeting-home-decline="${esc(x.meeting_id)}">Refuser</button></span></article>`).join('')}</section>`:'';
    const followups=state.followups.length?`<section class="meeting-home-zone" aria-label="Suites de réunion"><div class="meeting-home-separator">SUITES DE RÉUNION</div>${state.followups.slice(0,6).map(x=>`<button type="button" class="meeting-home-card" data-meeting-home-open="${esc(x.meeting_id)}" data-meeting-home-item="${esc(x.id)}"><i>${['action','waiting','test'].includes(x.kind)?'✓':['question','verify'].includes(x.kind)?'?':'•'}</i><span><strong>${esc(x.topic||x.meeting_title)}</strong><small>${esc(kindLabel(x.kind))} · ${esc(x.body)}</small></span><b>›</b></button>`).join('')}</section>`:'';
    return invites+followups;
  }
  document.addEventListener('click',async event=>{
    const accept=event.target.closest?.('[data-meeting-home-accept]'),decline=event.target.closest?.('[data-meeting-home-decline]'),open=event.target.closest?.('[data-meeting-home-open]');
    try{
      if(accept){accept.disabled=true;const id=accept.dataset.meetingHomeAccept;await post({action:'respond_invite',meeting_id:id,decision:'accepted'});await refresh();location.href='meeting-notes.html?meeting='+encodeURIComponent(id);return}
      if(decline){decline.disabled=true;await post({action:'respond_invite',meeting_id:decline.dataset.meetingHomeDecline,decision:'declined'});await refresh();return}
      if(open){location.href='meeting-notes.html?meeting='+encodeURIComponent(open.dataset.meetingHomeOpen)+(open.dataset.meetingHomeItem?'&item='+encodeURIComponent(open.dataset.meetingHomeItem):'');}
    }catch{await refresh();}
  });
  ['stip:session-ready','stip:boot-updated'].forEach(name=>window.addEventListener(name,refresh));
  window.addEventListener('stip:session-ended',reset);
  window.addEventListener('stip:meeting-refresh',refresh);
  window.STIPMeeting={pendingHTML,refresh};
  if(localStorage.getItem(STORE))setTimeout(refresh,0);
})();
