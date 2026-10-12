(() => {
  'use strict';
  // Les nouveaux canaux correspondent à des conversations de groupe réelles.
  // Le carrousel gagne autant de cartes que de canaux auxquels l'agent participe.
  const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages';
  const KEY='stip_session_v1', CACHE='t_est_communication_groups_v1';
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  let groups=[],members=[],memberLoading=null,snapshotLoading=null,sessionSignature='',refreshAt=0;
  let pending=false;
  const VALID_GROUP_ID=/^[a-f0-9-]{36}$/i;
  function token(){return localStorage.getItem(KEY)||''}
  async function digest(v){
    if(!v||!crypto?.subtle)return '';
    const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));
    return [...new Uint8Array(b)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  function safeGroup(c){
    const id=String(c?.id||'').trim(),title=String(c?.title||'').trim().slice(0,80);
    return c?.kind==='group'&&/^[a-f0-9-]{36}$/i.test(id)?{id,title:title||'Canal collectif',kind:'group'}:null;
  }
  function store(){
    if(!sessionSignature)return;
    try{sessionStorage.setItem(CACHE,JSON.stringify({signature:sessionSignature,groups,at:Date.now()}))}catch{}
  }
  function hydrate(){
    if(!sessionSignature)return;
    try{
      const cached=JSON.parse(sessionStorage.getItem(CACHE)||'null');
      if(cached?.signature===sessionSignature&&Date.now()-cached.at<3600000){
        groups=(Array.isArray(cached.groups)?cached.groups:[]).map(safeGroup).filter(Boolean);
        draw();
      }
    }catch{}
  }
  function draw(){
    $$('[data-carousel="communication"]').forEach(nav=>{
      nav.querySelectorAll('[data-conversation-id]').forEach(node=>node.remove());
      for(const g of groups){
        const b=document.createElement('button');
        b.className='com-carte com-carte-canal';
        b.type='button';
        b.dataset.conversationId=g.id;
        b.title=g.title;
        b.innerHTML='<span class="com-icone" aria-hidden="true">💬</span><span class="com-libelle">'+esc(g.title)+'</span><span class="com-precisions">Canal collectif</span>';
        nav.append(b);
      }
    });
    currentSelection();
    window.dispatchEvent(new CustomEvent('t-est:channels-redrawn'));
  }
  function currentSelection(){
    const selected=window.TEstDashboard?.current?.().communication||'';
    $$('[data-conversation-id]').forEach(b=>b.setAttribute('aria-current',String('group:'+b.dataset.conversationId===selected)));
  }
  function openConversation(id){
    if(!VALID_GROUP_ID.test(String(id)))return;
    window.TEstDashboard?.open('communication','group:'+id,{forceOpen:true});
  }
  function addOrRefresh(incoming){
    const clean=(Array.isArray(incoming)?incoming:[]).map(safeGroup).filter(Boolean);
    groups=[...new Map(clean.map(x=>[x.id,x])).values()];
    draw();store();
    paintChoices();
  }
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
    if(!token())return;
    if(!force&&Date.now()-refreshAt<90000)return;
    refreshAt=Date.now();
    snapshotLoading=post('home',{},18000).then(data=>{
      addOrRefresh((data.conversations||[]).filter(c=>c.kind==='group'));
    }).catch(()=>{}).finally(()=>{snapshotLoading=null});
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
    const body=$('#popBody'),list=body?.querySelector('[data-channel-list]');
    if(!list)return;
    const cards=groups.map(g=>
      '<button type="button" data-existing-channel="'+esc(g.id)+'"><span aria-hidden="true">💬</span>'+
      '<span><strong>'+esc(g.title)+'</strong><small>Ouvrir le fil et écrire un message</small></span></button>'
    ).join('');
    list.innerHTML=(cards||'<p class="pop-info">Aucun canal collectif pour le moment.</p>')+
      '<button type="button" class="pop-primary pop-create-channel" data-new-channel>＋ Créer un canal collectif</button>';
  }
  function buildChoice(){
    const body=$('#popBody');
    if(!body?.querySelector('[data-channel-list]'))return;
    paintChoices();
    Promise.resolve(refreshGroups()).then(paintChoices);
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
        const c={id,kind:'group',title};
        groups=[c,...groups.filter(x=>x.id!==id)];draw();store();
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
    if(e.target.closest('[data-canaux-open]')){buildChoice();return;}
    if(e.target.closest('[data-new-channel]')){renderForm();return;}
    const existing=e.target.closest('[data-existing-channel]');
    if(existing){
      const id=existing.dataset.existingChannel;
      if(groups.some(g=>g.id===id)){
        $('#accueilPop').close();
        openConversation(id);
      }
    }
  });
  window.addEventListener('popstate',currentSelection);
  window.addEventListener('pageshow',()=>{
    currentSelection();
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
