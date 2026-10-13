(() => {
  'use strict';
  // T-est: les fonctions métier sont montées directement dans le DOM de l'accueil.
  // Aucun module ne charge l'ancienne page complète (pas d'iframe, pas de HTML extrait).
  const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages';
  const TOKEN_KEY='stip_session_v1';
  const loadingScripts=new Map(),loadedStyles=new Set();
  const STYLES=['leisure-runtime.css','afterwork-site.css','recurring-training.css',
    'carpool-runtime.css','ensemble-shell.css','ensemble-create.css'];
  const SCRIPTS=['recurring-training.js','afterwork-site.js','carpool-runtime.js',
    'ensemble-create.js','leisure-runtime.js'];
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uuid=/^[a-f0-9-]{36}$/i;
  const threadCache=new Map();
  const token=()=>localStorage.getItem(TOKEN_KEY)||'';
  async function post(action,fields={}){
    if(!token())throw Error('Connecte-toi à GHE pour utiliser ce service.');
    const used=token();
    const response=await fetch(API,{
      method:'POST',cache:'no-store',
      headers:{'Content-Type':'application/json','X-STIP-Session':used},
      body:JSON.stringify({action,...fields})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.error)throw Error(String(data.error||'Service momentanément indisponible.'));
    if(token()!==used)throw Error('La session a changé.');
    return data;
  }
  function includeStyle(href){
    if(loadedStyles.has(href))return;
    const node=document.createElement('link');
    node.rel='stylesheet';node.href='/'+href;
    document.head.append(node);loadedStyles.add(href);
  }
  function includeScript(name){
    if(loadingScripts.has(name))return loadingScripts.get(name);
    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='/'+name;script.async=false;
      script.onload=resolve;
      script.onerror=()=>reject(Error('Le module '+name+' ne peut pas être chargé.'));
      document.head.append(script);
    });
    loadingScripts.set(name,promise);
    return promise;
  }
  function status(host,message){
    host.innerHTML='<p class="t-native-status" role="status">'+esc(message)+'</p>';
  }
  function mountPlanning(host){
    if(host.dataset.nativeReady==='planning')return;
    function paint(){
      if(!host.isConnected)return;
      host.innerHTML=window.TEstAccueilPlanning?.weekHTML?.()||
        '<p class="t-native-status">Récupération de ton planning en cours…</p>';
    }
    paint();
    const onUpdate=()=>paint();
    window.addEventListener('t-est:planning-updated',onUpdate);
    host.dataset.nativeReady='planning';
  }
  async function mountWheelchairs(host){
    if(host.dataset.nativeReady==='wheelchairs')return;
    status(host,'Chargement du module Fauteuils…');
    includeStyle('team-chat.css');
    if(!window.STIPTableau?.mount)await includeScript('team-chat.js');
    if(!host.isConnected)return;
    if(!window.STIPTableau?.mount)throw Error('Moteur Fauteuils indisponible.');
    // L’enveloppe permet d'utiliser le vrai module métier sans ses anciens onglets.
    host.replaceChildren();
    const shell=document.createElement('section');
    shell.setAttribute('data-communication-app','');
    const content=document.createElement('div');
    shell.append(content);host.append(shell);
    window.STIPTableau.mount(content,{mode:'wheelchair'});
    host.dataset.nativeReady='wheelchairs';
  }
  function leisureMarkup(){
    return '<section class="ensemble-page stip-page t-native-leisure">'+
      '<nav class="t-native-leisure-tabs" role="tablist" aria-label="Navigation interne Ensemble" hidden>'+
      ['activities','trips','invitations'].map(k=>
        '<button type="button" data-ensemble-tab="'+k+'" aria-selected="'+(k==='activities'?'true':'false')+'">'+k+'</button>').join('')+
      '</nav>'+
      '<p id="leisureStatus" class="ensemble-status" role="status"></p>'+
      '<section id="ensembleCreator" class="ensemble-creator" hidden>'+
        '<div class="ensemble-creator-top"><h2>Proposer une activité</h2><button type="button" data-ensemble-close aria-label="Fermer">×</button></div>'+
        '<div class="ensemble-ways" role="group">'+
          '<button type="button" data-ensemble-option="matched"><strong>Avec des collègues</strong></button>'+
          '<button type="button" data-ensemble-option="afterwork"><strong>Après le travail</strong></button>'+
          '<button type="button" data-ensemble-option="date"><strong>Une sortie</strong></button>'+
        '</div>'+
        '<section id="ensembleAfterworkEvents" hidden></section>'+
        '<section id="trainingRecurringApp" hidden></section>'+
        '<section id="ensembleCreatePanel" hidden></section>'+
        '<section id="ensembleAfterworkCreate" hidden></section>'+
      '</section>'+
      '<section id="leisureApp" aria-live="polite" role="tabpanel"></section>'+
      '<section id="carpoolApp" role="tabpanel" hidden></section>'+
      '</section>';
  }
  let leisureHost=null,leisurePromise=null;
  async function mountLeisure(host,tab){
    if(!leisureHost){
      leisureHost=host;
      host.innerHTML=leisureMarkup();
    }else if(leisureHost!==host){
      // Déplacer le même DOM conserve l'état des formulaires en cours.
      while(leisureHost.firstChild)host.append(leisureHost.firstChild);
      leisureHost=host;
    }
    if(!leisurePromise){
      leisurePromise=(async()=>{
        for(const css of STYLES)includeStyle(css);
        for(const script of SCRIPTS)await includeScript(script);
        if(!window.STIPLeisure?.setTab)throw Error('Le moteur Ensemble ne répond pas.');
        await window.STIPLeisure.refresh?.();
      })().catch(error=>{leisurePromise=null;throw error});
    }
    await leisurePromise;
    window.STIPLeisure.setTab(tab);
    await window.STIPCarpool?.refresh?.();
    host.dataset.nativeReady='leisure';
    window.dispatchEvent(new CustomEvent('t-est:leisure-ready'));
  }
  const me=()=>String(window.STIPContinuity?.read?.()?.agent?.id||
    window.STIPBootCache?.agent?.id||'');
  const threadTitle=(data,id)=>data.conversation?.title||
    window.TEstChats?.label?.(id)||
    data.members?.filter(m=>String(m.agent_id)!==me()).map(m=>
      [m.agent?.prenom,m.agent?.nom].filter(Boolean).join(' ')).join(', ')||
    'Discussion';
  const timeStamp=value=>{
    const d=new Date(value||'');
    return Number.isFinite(d.getTime())?d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'';
  };
  async function threadLoad(host,id,{force=false}={}){
    if(!uuid.test(id))throw Error('Conversation invalide.');
    const cached=threadCache.get(id);
    const messages=host.querySelector('[data-t-native-messages]');
    if(cached&&!force&&Date.now()-cached.at<30000){
      if(messages)renderThreadMessages(messages,cached.data.messages||[]);
      return;
    }
    const data=await post('thread',{conversation_id:id});
    threadCache.set(id,{at:Date.now(),data});
    if(host.dataset.threadId!==id||!host.isConnected)return;
    const title=host.querySelector('[data-thread-title]');
    if(title)title.textContent=threadTitle(data,id);
    if(messages)renderThreadMessages(messages,data.messages||[]);
  }
  function renderThreadMessages(host,messages){
    const previous=host.scrollHeight-host.scrollTop-host.clientHeight;
    const atBottom=previous<100;
    const self=me();
    host.innerHTML=messages.length?messages.map(m=>{
      const own=self&&String(m.sender_agent_id)===self;
      const name=String(m.sender?.nickname||[m.sender?.prenom,m.sender?.nom].filter(Boolean).join(' ')||'Agent');
      const attachments=Array.isArray(m.payload?.attachments)?m.payload.attachments:[];
      const fileLinks=attachments.filter(x=>/^https:\/\//i.test(String(x.url||''))).map(a=>
        '<a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">📎 '+esc(a.name||'Pièce jointe')+'</a>').join('');
      return '<article class="t-native-bubble '+(own?'mine':'theirs')+'">'+
        (!own?'<strong>'+esc(name)+'</strong>':'')+
        '<p>'+esc(m.body||'')+'</p>'+fileLinks+
        '<time>'+esc(timeStamp(m.created_at))+'</time></article>';
    }).join(''):'<p class="t-native-status">Pas encore de message dans cette discussion.</p>';
    if(atBottom)host.scrollTop=host.scrollHeight;
  }
  async function mountThread(host,id){
    if(!uuid.test(id))throw Error('Identifiant de conversation invalide.');
    if(host.dataset.nativeReady!=='thread'){
      host.innerHTML='<section class="t-native-thread">'+
        '<header class="t-native-thread-top"><strong data-thread-title>Discussion</strong>'+
        '<button type="button" data-back-to-dm>‹ Discussions</button></header>'+
        '<div data-t-native-messages class="t-native-thread-messages" aria-live="polite"></div>'+
        '<form data-t-native-compose class="t-native-compose"><textarea name="body" rows="2" maxlength="2000" placeholder="Écrire un message…" required></textarea>'+
        '<button type="submit">Envoyer ↑</button></form><p data-thread-feedback role="status"></p></section>';
      host.querySelector('[data-back-to-dm]').addEventListener('click',()=>{
        window.TEstDashboard?.open('communication','dm-picker',{forceOpen:true});
      });
      host.querySelector('form').addEventListener('submit',async e=>{
        e.preventDefault();
        const form=e.currentTarget,textarea=form.elements.body,body=textarea.value.trim(),submit=form.querySelector('[type=submit]');
        if(!body||submit.disabled)return;
        submit.disabled=true;
        const feedback=host.querySelector('[data-thread-feedback]');
        try{
          await post('send',{conversation_id:id,body});
          textarea.value='';feedback.textContent='';
          await threadLoad(host,id,{force:true});
        }catch(err){feedback.textContent=String(err.message||'Envoi impossible.')}
        finally{submit.disabled=false;}
      });
      host.dataset.nativeReady='thread';
    }
    host.dataset.threadId=id;
    await threadLoad(host,id,{force:true});
  }
  async function mountDM(host){
    if(host.dataset.nativeReady==='dm')return;
    status(host,'Chargement des messages…');
    const data=await post('home');
    if(!host.isConnected)return;
    const items=(data.conversations||[]).filter(c=>['direct','group'].includes(c.kind));
    host.innerHTML='<section class="t-native-inbox"><h3>Mes discussions</h3>'+
      '<button type="button" class="t-native-new-dm" data-native-new-dm>＋ Nouveau message privé</button>'+
      '<div data-native-dm-directory hidden></div>'+
      (items.length?items.map(c=>{
        const label=String(c.kind==='group'?c.title||
          'Groupe':(c.others||[]).map(p=>p.nickname||[p.prenom,p.nom].filter(Boolean).join(' ')).join(', ')||'Message privé');
        return '<button type="button" data-open-conv="'+esc(c.id)+'"><span>'+(c.kind==='group'?'💬':'✉️')+'</span><strong>'+esc(label)+'</strong>'+
          (Number(c.unread||0)?'<b>'+Math.min(99,Number(c.unread))+'</b>':'')+'</button>';
      }).join(''):'<p>Aucune conversation pour le moment.</p>')+'</section>';
    host.querySelectorAll('[data-open-conv]').forEach(btn=>btn.addEventListener('click',()=>{
      window.TEstDashboard?.open('communication','thread:'+btn.dataset.openConv,{forceOpen:true});
    }));
    const directory=host.querySelector('[data-native-dm-directory]');
    host.querySelector('[data-native-new-dm]')?.addEventListener('click',async()=>{
      directory.hidden=!directory.hidden;
      if(directory.hidden)return;
      directory.innerHTML='<p class="t-native-status">Chargement des collègues…</p>';
      try{
        const result=await post('agents');
        const people=(Array.isArray(result.items)?result.items:[]).filter(x=>x.id);
        directory.innerHTML='<input type="search" aria-label="Rechercher un collègue" placeholder="Rechercher un collègue…" class="t-native-agent-search">'+
          '<div data-native-agent-list></div><p data-native-agent-feedback role="status"></p>';
        const input=directory.querySelector('input');
        const list=directory.querySelector('[data-native-agent-list]');
        const feedback=directory.querySelector('[data-native-agent-feedback]');
        const render=()=>{
          const query=input.value.trim().toLocaleLowerCase('fr');
          const found=people.filter(x=>[x.prenom,x.nom,x.nickname,x.ghe].filter(Boolean)
            .join(' ').toLocaleLowerCase('fr').includes(query)).slice(0,30);
          list.replaceChildren();
          if(!found.length){list.textContent='Aucun collègue trouvé.';return;}
          for(const person of found){
            const button=document.createElement('button');
            button.type='button';
            button.textContent=[person.prenom,person.nom].filter(Boolean).join(' ')||person.nickname||'Collègue';
            button.addEventListener('click',async()=>{
              button.disabled=true;feedback.textContent='Ouverture de la discussion…';
              try{
                const response=await post('direct',{agent_id:String(person.id)});
                const id=String(response.conversation?.id||'');
                if(!uuid.test(id))throw Error('Conversation non trouvée.');
                window.TEstDashboard?.open('communication','thread:'+id,{forceOpen:true});
              }catch(e){feedback.textContent=String(e.message||'Impossible de créer le DM.');button.disabled=false;}
            });
            list.append(button);
          }
        };
        input.addEventListener('input',render);
        render();
      }catch(e){directory.textContent=String(e.message||'Annuaire indisponible.');}
    });
    host.dataset.nativeReady='dm';
  }
  const modules={
    personal:mountPlanning,
    fauteuils:mountWheelchairs,
    dm:mountDM
  };
  async function mount(host,id){
    try{
      if(!host?.isConnected)return;
      if(id.startsWith('thread:'))return await mountThread(host,id.slice(7));
      if(['activities','trips','invitations'].includes(id))return await mountLeisure(host,id);
      if(!modules[id])throw Error('Module non reconnu.');
      return await modules[id](host);
    }catch(error){
      if(host?.isConnected){
        status(host,String(error?.message||'Module indisponible.'));
        host.dataset.nativeReady='error';
      }
    }
  }
  window.TEstNativeModules={mount};
})();
