(() => {
  'use strict';
  // DM est l'entrée unique des conversations directes et collectives.
  // Aucune conversation individuelle n'est ajoutée au carrousel Communication.
  const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages';
  const KEY='stip_session_v1', CACHE='t_est_communication_threads_v2';
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  let conversations=[],members=[],memberLoading=null,snapshotLoading=null,sessionSignature='',refreshAt=0;
  let lastError='';
  let pending=false;
  const VALID_GROUP_ID=/^[a-f0-9-]{36}$/i;
  function token(){return localStorage.getItem(KEY)||''}
  async function digest(v){
    if(!v||!crypto?.subtle)return '';
    const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));
    return [...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  function safeConversation(c){
    const id=String(c?.id||'').trim();
    if(!VALID_GROUP_ID.test(id)||!['group','direct'].includes(c?.kind))return null;
    const names=(Array.isArray(c.others)?c.others:[])
      .map(x=>String(x.nickname||[x.prenom,x.nom].filter(Boolean).join(' ')||'').trim())
      .filter(Boolean);
    const name=c.kind==='group'?String(c.title||'Groupe').trim().slice(0,80):
      (names.join(', ')||'Message privé');
    return {id,kind:c.kind,title:name,unread:Math.max(0,Number(c.unread||0)),
      last:String(c.last_message?.body||c.last||'').slice(0,100)};
  }
  function store(){
    if(!sessionSignature)return;
    try{sessionStorage.setItem(CACHE,JSON.stringify({signature:sessionSignature,conversations,at:Date.now()}))}catch{}
  }
  function hydrate(){
    if(!sessionSignature)return;
    try{
      const cached=JSON.parse(sessionStorage.getItem(CACHE)||'null');
      if(cached?.signature===sessionSignature&&Date.now()-cached.at<3600000){
        conversations=(Array.isArray(cached.conversations)?cached.conversations:[]).map(safeConversation).filter(Boolean);
        paintChoices();
      }
    }catch{}
  }
  function openConversation(id){
    const conv=conversations.find(x=>x.id===id);
    if(!conv)return;
    window.TEstDashboard?.open('communication','thread:'+id,{forceOpen:true});
  }
  function addOrRefresh(incoming){
    const clean=(Array.isArray(incoming)?incoming:[]).map(safeConversation).filter(Boolean);
    conversations=[...new Map(clean.map(x=>[x.id,x])).values()];
    lastError='';
    store();paintChoices();
  }
  window.TEstChats={
    label:id=>conversations.find(c=>c.id===id)?.title||'Discussion',
    openPicker:()=> {
      const dialog=document.getElementById('accueilPop');
      const title=document.getElementById('popTitre'),body=document.getElementById('popBody');
      if(!dialog||!title||!body)return;
      title.textContent='Choisir une discussion';
      body.innerHTML='<div data-channel-list class="pop-choix"></div>';
      if(!dialog.open)dialog.showModal();
      paintChoices();
      refreshGroups(true);
    },
    openThread:id=>openConversation(id)
  };
  async function post(action,body={},wait=12000){
    const value=token();
    if(!value)throw Error('Reconnecte-toi à GHE pour accéder à tes canaux.');
    const controller=new AbortController(),watch=setTimeout(()=>controller.abort(),wait);
    try{
      const result=await fetch(API,{method:'POST',cache:'no-store',signal:controller.signal,
        headers:{'Content-Type':'application/json','X-STIP-Session':value},
        body:JSON.stringify({action,...body})});
      const data=await result.json().catch(()=>({}));
      if(!result.ok||data.error)throw Error(String(data.error||'Le serveur des messages est indisponible.'));
      if(token()!==value)throw Error('La session a changé.');
      return data;
    }catch(e){
      if(e.name==='AbortError')throw Error('Chargement trop lent. Réessaie.');
      throw e;
    }finally{clearTimeout(watch)}
  }
  async function refreshGroups(force=false){
    if(snapshotLoading)return snapshotLoading;
    if(!token()) {lastError='Connecte-toi à GHE pour voir tes discussions.';paintChoices();return;}
    if(!force&&Date.now()-refreshAt<90000)return;
    refreshAt=Date.now();
    snapshotLoading=post('home',{},18000).then(data=>{
      addOrRefresh((data.conversations||[]).filter(c=>['direct','group'].includes(c.kind)));
    }).catch(err=>{lastError=String(err.message||'Discussions indisponibles.');paintChoices()})
      .finally(()=>{snapshotLoading=null});
    return snapshotLoading;
  }
  async function loadMembers(){
    if(members.length)return members;
    if(memberLoading)return memberLoading;
    memberLoading=post('agents',{},12000).then(data=>{
      members=(data.items||[]).filter(x=>x?.id).map(x=>({
        id:String(x.id),
        label:([x.prenom,x.nom].filter(Boolean).join(' ')||x.nickname||'Agent').trim()
      })).sort((a,b)=>a.label.localeCompare(b.label,'fr'));
      return members;
    }).finally(()=>{memberLoading=null});
    return memberLoading;
  }
  function paintChoices(){
    const list=$('#popBody')?.querySelector('[data-channel-list]');
    if(!list)return;
    const filter=(kind,heading)=>{
      const items=conversations.filter(c=>c.kind===kind);
      if(!items.length)return '';
      return '<h3 class="t-dm-picker-heading">'+heading+'</h3>'+items.map(c=>
        '<button type="button" data-existing-channel="'+esc(c.id)+'"><span aria-hidden="true">'+
        (kind==='direct'?'✉️':'💬')+'</span><span><strong>'+esc(c.title)+'</strong>'+
        '<small>'+esc(c.last||'Ouvrir la discussion et écrire')+'</small></span>'+
        (c.unread?'<b class="t-dm-count">'+Math.min(99,c.unread)+'</b>':'')+'</button>'
      ).join('');
    };
    list.innerHTML=filter('direct','Messages privés')+filter('group','Discussions de groupe')+
      (!conversations.length?'<p class="pop-info">'+esc(lastError||'Aucune discussion existante.')+'</p>':'')+
      '<button type="button" class="pop-primary pop-create-channel" data-new-dm>＋ Nouveau message privé</button>'+
      '<button type="button" class="pop-primary pop-create-channel" data-new-channel>＋ Créer un groupe</button>';
  }
  function buildChoice(){
    const list=$('#popBody')?.querySelector('[data-channel-list]');
    if(!list)return;
    paintChoices();refreshGroups(true);
  }
  function renderForm(message=''){
    const body=$('#popBody');
    $('#popTitre').textContent='Nouveau canal collectif';
    body.innerHTML='<form id="tNewChannelForm" class="t-channel-form" autocomplete="off">'+
      '<label>Nom du canal<input id="tNewChannelTitle" name="title" maxlength="80" placeholder="Ex. Équipe du soir" required></label>'+
      '<label>Inviter des collègues<input id="tChannelSearch" type="search" placeholder="Rechercher un collègue…"></label>'+
      '<div class="t-channel-people" id="tChannelPeople" aria-live="polite"><p class="pop-info">Chargement des collègues…</p></div>'+
      '<p class="pop-info" id="tChannelMessage" role="status">'+esc(message)+'</p>'+
      '<button class="pop-primary" type="submit">Créer ce canal</button></form>';
    const list=$('#tChannelPeople'),find=$('#tChannelSearch'),form=$('#tNewChannelForm');
    const selected=new Set();
    function paint(){
      const q=find.value.trim().toLocaleLowerCase('fr');
      const filtered=members.filter(x=>x.label.toLocaleLowerCase('fr').includes(q)).slice(0,50);
      list.innerHTML=filtered.length?filtered.map(x=>
        '<label class="t-channel-member"><input type="checkbox" value="'+esc(x.id)+'" '+(selected.has(x.id)?'checked':'')+'>'+
        '<span>'+esc(x.label)+'</span></label>').join(''):'<p class="pop-info">Aucun collègue trouvé.</p>';
      list.querySelectorAll('input').forEach(field=>field.addEventListener('change',()=>{
        if(field.checked)selected.add(field.value);else selected.delete(field.value);
      }));
    }
    find.addEventListener('input',paint);
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(pending)return;
      const title=String(form.elements.title.value||'').trim(),message=$('#tChannelMessage');
      if(!title||!selected.size){message.textContent='Donne un nom et sélectionne au moins un collègue.';return;}
      const send=form.querySelector('[type=submit]');
      pending=true;send.disabled=true;message.textContent='Création du canal…';
      try{
        const response=await post('group',{title,agent_ids:[...selected]});
        const id=String(response.conversation?.id||'');
        if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Le canal a été créé mais son identifiant est manquant.');
        const c={id,kind:'group',title,unread:0,last:''};
        conversations=[c,...conversations.filter(x=>x.id!==id)];store();paintChoices();
        $('#accueilPop').close();openConversation(id);
        refreshAt=0;
      }catch(err){message.textContent=err.message||'Création impossible.'}
      finally{pending=false;send.disabled=false;}
    });
    loadMembers().then(paint).catch(err=>list.innerHTML='<p class="pop-info">'+esc(err.message||'Liste indisponible.')+'</p>'+
      '<button class="pop-primary" type="button" data-retry-people>Réessayer</button>');
    body.addEventListener('click',async e=>{
      if(!e.target.closest('[data-retry-people]'))return;
      list.innerHTML='<p class="pop-info">Chargement des collègues…</p>';
      try{await loadMembers();paint()}catch(err){list.textContent=err.message||'Erreur';}
    },{once:true});
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-canaux-open]')){window.TEstChats.openPicker();return;}
    if(e.target.closest('[data-new-channel]')){renderForm();return;}
    if(e.target.closest('[data-new-dm]')){
      $('#accueilPop').close();
      window.TEstDashboard?.open('communication','dm',{forceOpen:true});
      return;
    }
    const existing=e.target.closest('[data-existing-channel]');
    if(existing){
      const id=existing.dataset.existingChannel;
      if(conversations.some(c=>c.id===id)){
        $('#accueilPop').close();
        openConversation(id);
      }
    }
  });
  window.addEventListener('pageshow',()=>{
    if(!document.hidden&&sessionSignature)refreshGroups();
  });
  async function init(){
    const value=token();
    if(!value)return;
    sessionSignature=await digest(value);
    hydrate();
    window.setTimeout(()=>refreshGroups(),1300);
  }
  init();
})();
