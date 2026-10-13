(() => {
  "use strict";
  // T-est : un carrousel Communication + Ensemble, une seule sélection globale.
  // Pop sous le bloc (aucune boîte modale). Aucun gestionnaire de geste tactile.
  const $=s=>document.querySelector(s);
  const blocks={planning:$('[data-block="planning"]'),communication:$('[data-block="communication"]')};
  const regions={planning:$('[data-expanded="planning"]'),communication:$('[data-expanded="communication"]')};
  const pop=$('#accueilPop'),popTitle=$('#popTitre'),popBody=$('#popBody');
  if(!blocks.planning||!blocks.communication||!regions.planning||!regions.communication||!pop)return;
  const leisure=new Set(['activities','trips','invitations']);
  const threadKey=/^thread:[a-f0-9-]{36}$/i;
  const tabs={
    fauteuils:{title:'Fauteuils',url:'/index.html?quick=communication&tab=fauteuils#/communication/fauteuils'},
    personal:{title:'Mon planning',url:'/index.html#/planning/personal'},
    dm:{title:'Messages privés',url:'/index.html?quick=communication&tab=dm#/communication/dm'}
  };
  const pageSlots=new Map();
  let selected=null,selectedKind=null,leisureFrame=null,leisureTab=null,leisureLoaded=false;
  let popKey='',priorPopNodes=new Map();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isPop=id=>id==='day:0'||id==='day:1'||id==='dm-picker'||id==='create';
  const blockFor=id=>id.startsWith('day:')||id==='personal'?'planning':'communication';
  const pageLabel=id=>({
    'day:0':'Aujourd’hui','day:1':'Demain','dm-picker':'DM · privé',
    'create':'Créer / ouvrir',fauteuils:'Fauteuils',personal:'Mon planning',
    activities:'Activités',trips:'Trajets',invitations:'Invitations',dm:'Messages privés'
  })[id]||(id.startsWith('thread:')?(window.TEstChats?.label?.(id.slice(7))||'Discussion'):'Page');
  function visibleKey(){return selected?selected.block+':'+selected.id:''}
  function scrollLine(block){
    const line=blocks[block]?.querySelector('.t-carousel');
    if(!line)return;
    // Ce déplacement est déclenché par un clic, jamais par swipe ou scroll tactile.
    requestAnimationFrame(()=>{
      const band=$('#tEstHistoryBar')?.getBoundingClientRect().height||54;
      const target=window.scrollY+line.getBoundingClientRect().top-band-8;
      window.scrollTo({top:Math.max(0,target),behavior:'instant'});
    });
  }
  function updateButtons(){
    document.querySelectorAll('[data-block="planning"] [data-jour], [data-block="communication"] [data-ouverture], [data-block="communication"] [data-ensemble-view], [data-unified-create]')
      .forEach(el=>{
        const id=el.dataset.jour!==undefined?'day:'+el.dataset.jour:
          el.dataset.ouverture==='dm'?'dm-picker':
          el.dataset.ouverture||el.dataset.ensembleView||(el.hasAttribute('data-unified-create')?'create':'');
        const active=!!id&&selected?.id===id&&selected.block===blockFor(id);
        el.setAttribute('aria-expanded',String(active));
        el.setAttribute('aria-current',active?'true':'false');
      });
  }
  function rememberPop(){
    if(!popKey)return;
    const fragment=document.createDocumentFragment();
    while(popBody.firstChild)fragment.append(popBody.firstChild);
    priorPopNodes.set(popKey,fragment);
  }
  function restorePop(id){
    if(popKey!==id){
      rememberPop();
      popBody.replaceChildren();
      const fragment=priorPopNodes.get(id);
      if(fragment)popBody.append(fragment);
      popKey=id;
    }
    const ready=popBody.childNodes.length>0;
    popTitle.textContent=pageLabel(id);
    if(id==='dm-picker'){
      if(!ready)window.TEstChats?.openPicker?.();
    }else if(id.startsWith('day:')){
      popBody.innerHTML=window.TEstAccueilPlanning?.htmlFor?.(Number(id.slice(4)))||
        '<p class="pop-info">Chargement du planning…</p>';
    }else if(id==='create'&&!ready){
      popTitle.textContent='Créer / ouvrir';
      popBody.innerHTML='<div class="pop-choix">'+
        '<button type="button" data-action="new-dm"><span>✉️</span><span><strong>Nouveau message privé</strong><small>Choisir un collègue</small></span></button>'+
        '<button type="button" data-action="new-group"><span>💬</span><span><strong>Nouveau groupe</strong><small>Inviter des collègues</small></span></button>'+
        '<button type="button" data-action="activity"><span>🏋️</span><span><strong>Proposer une activité</strong><small>Sport, sortie ou loisir</small></span></button></div>';
    }
  }
  function hideAll(){
    pop.hidden=true;
    for(const region of Object.values(regions))region.hidden=true;
    for(const slot of new Set(pageSlots.values()))slot.hidden=true;
  }
  function routeFor(id){
    const url=new URL(location.href);
    for(const key of ['bloc','vue','conversation'])url.searchParams.delete(key);
    if(!isPop(id)&&id){
      if(id==='personal'){url.searchParams.set('bloc','planning');url.searchParams.set('vue','personnel')}
      else if(leisure.has(id)){url.searchParams.set('bloc','ensemble');url.searchParams.set('vue',id)}
      else {
        url.searchParams.set('bloc','communication');
        url.searchParams.set('vue',id==='fauteuils'?'fauteuils':'dm');
        if(id.startsWith('thread:'))url.searchParams.set('conversation',id.slice(7));
      }
    }
    return url.pathname+url.search+url.hash;
  }
  function syncUrl(id,push){
    const target=routeFor(id),current=location.pathname+location.search+location.hash;
    if(target===current)return;
    if(push&&!isPop(id)&&id)history.pushState({tEstUnified:true},'',target);
    else history.replaceState({tEstUnified:true},'',target);
  }
  function emit(open,oldId){
    if(oldId&&oldId!==selected?.id)
      dispatchEvent(new CustomEvent('t-est:section-state',{detail:{
        block:blockFor(oldId),id:oldId,open:false,kind:isPop(oldId)?'pop':'page',label:pageLabel(oldId)
      }}));
    const id=selected?.id;
    if(id)dispatchEvent(new CustomEvent('t-est:section-state',{detail:{
      block:selected.block,id,open,kind:selectedKind,label:pageLabel(id)
    }}));
    if(!id)dispatchEvent(new CustomEvent('t-est:section-reset'));
  }
  function frameHeight(frame,{leisure=false}={}){
    const doc=frame.contentDocument;
    if(!doc)return;
    // Le viewport du chat ne doit pas faire croître son iframe en boucle.
    // Aucun listener tactile et aucune modification du swipe du site.
    const normal=Math.max(620,innerHeight-135);
    const content=leisure?doc.querySelector('.ensemble-page')?.scrollHeight:
      doc.querySelector('.ca-body')?.scrollHeight;
    const height=leisure?
      Math.min(13000,Math.max(320,Math.ceil(content||320)+18)):
      Math.min(11000,Math.max(normal,Math.ceil(content||0)+145));
    if(Math.abs(frame.getBoundingClientRect().height-height)>5)frame.style.height=height+'px';
  }
  function trackFrame(frame,{leisure=false}={}){
    frame.addEventListener('load',()=>{
      try{
        const doc=frame.contentDocument;
        if(!doc)return;
        if(!doc.getElementById('t-est-unified-inline-style')){
          const style=doc.createElement('style');
          style.id='t-est-unified-inline-style';
          style.textContent=leisure?
            'html,body{margin:0!important;overflow-x:hidden!important;background:#fff!important}' +
            '.ensemble-page{max-width:none!important;margin:0!important;padding:10px!important}' +
            '.ensemble-topbar,.ensemble-hero,.ensemble-nav,.ensemble-cta{display:none!important}':
            '.ca-head,.ca-tabs{display:none!important}.ca-app{min-height:0!important}';
          doc.head.append(style);
        }
        const target=(leisure?doc.querySelector('.ensemble-page'):doc.querySelector('.ca-app,.app-shell,#app,main'))||doc.body;
        if(typeof ResizeObserver!=='undefined'){
          const ro=new ResizeObserver(()=>requestAnimationFrame(()=>frameHeight(frame,{leisure})));
          ro.observe(target);
        }
      }catch{}
      if(leisure){leisureLoaded=true;setLeisureTab(leisureTab)}
      requestAnimationFrame(()=>frameHeight(frame,{leisure}));
    });
  }
  function setLeisureTab(id){
    if(!leisureLoaded||!leisure.has(id))return;
    try{
      const doc=leisureFrame.contentDocument;
      const button=doc?.querySelector('[data-ensemble-tab="'+id+'"]');
      if(button&&button.getAttribute('aria-selected')!=='true')button.click();
      requestAnimationFrame(()=>frameHeight(leisureFrame,{leisure:true}));
    }catch{}
  }
  function slotFor(id){
    const block=blockFor(id),key=block+':'+id,region=regions[block];
    if(leisure.has(id)){
      if(!leisureFrame){
        const container=document.createElement('section');
        container.className='t-inline-content';container.setAttribute('aria-label','Ensemble');
        leisureFrame=document.createElement('iframe');
        leisureFrame.title='Ensemble';leisureFrame.className='t-inline-iframe';
        leisureFrame.loading='eager';container.append(leisureFrame);
        trackFrame(leisureFrame,{leisure:true});
        region.append(container);
        pageSlots.set('communication:leisure',container);
        leisureFrame.src='/sorties-loisirs.html?ghe_embedded=ensemble';
      }
      leisureTab=id;
      setLeisureTab(id);
      return pageSlots.get('communication:leisure');
    }
    if(pageSlots.has(key))return pageSlots.get(key);
    const container=document.createElement('section');
    container.className='t-inline-content';
    container.setAttribute('aria-label',pageLabel(id));
    const loading=document.createElement('p');
    loading.className='t-inline-wait';loading.textContent='Chargement de '+pageLabel(id)+'…';
    container.append(loading);
    const iframe=document.createElement('iframe');
    iframe.className='t-inline-iframe';iframe.title=pageLabel(id);iframe.loading='eager';
    const url=new URL(id==='personal'?tabs.personal.url:id==='fauteuils'?tabs.fauteuils.url:tabs.dm.url,location.origin);
    if(id.startsWith('thread:'))url.searchParams.set('conversation',id.slice(7));
    iframe.addEventListener('load',()=>{loading.hidden=true});
    trackFrame(iframe);
    container.append(iframe);
    region.append(container);
    pageSlots.set(key,container);
    iframe.src=url.href;
    return container;
  }
  function select(id,{forceOpen=false,scroll=true,push=true}={}){
    if(!id||!(
      id==='personal'||id==='fauteuils'||id==='dm'||id==='dm-picker'||id==='create'||
      id==='day:0'||id==='day:1'||leisure.has(id)||threadKey.test(id)
    ))return;
    const block=blockFor(id);
    const previous=selected?.id||null;
    const opening=forceOpen||!(selected?.id===id);
    hideAll();
    if(!opening){
      selected=null;selectedKind=null;
      syncUrl(null,false);
      updateButtons();emit(false,previous);
      return;
    }
    selected={id,block};selectedKind=isPop(id)?'pop':'page';
    const region=regions[block];
    region.hidden=false;
    if(isPop(id)){
      region.append(pop);
      pop.hidden=false;
      restorePop(id);
    }else{
      pop.hidden=true;
      const slot=slotFor(id);
      slot.hidden=false;
      const frame=slot.querySelector('iframe');
      if(frame)requestAnimationFrame(()=>frameHeight(frame,{leisure:leisure.has(id)}));
    }
    syncUrl(id,push);
    updateButtons();
    emit(true,previous);
    if(scroll)scrollLine(block);
  }
  function close(){
    const last=selected?.id||null;
    selected=null;selectedKind=null;
    hideAll();syncUrl(null,false);updateButtons();emit(false,last);
  }
  function restoreFromLocation(){
    const qs=new URLSearchParams(location.search),bloc=qs.get('bloc'),view=qs.get('vue'),conv=qs.get('conversation');
    let id=null;
    if(bloc==='planning'&&view==='personnel')id='personal';
    if(bloc==='ensemble'&&leisure.has(view))id=view;
    if(bloc==='communication'){
      if(view==='fauteuils')id='fauteuils';
      else if(view==='dm')id=conv&&threadKey.test('thread:'+conv)?'thread:'+conv:'dm';
    }
    if(id)select(id,{forceOpen:true,push:false,scroll:false});
    else close();
  }
  window.TEstDashboard={
    open:(block,id,options={})=>select(id,{...options,forceOpen:true}),
    toggle:(block,id,options={})=>select(id,options),
    reset:()=>{close();window.scrollTo({top:0,behavior:'instant'})},
    current:()=>({planning:selected?.block==='planning'?selected.id:null,
      communication:selected?.block==='communication'?selected.id:null})
  };
  window.TEstEnsemble={open:(id,opts={})=>select(id,{...opts,forceOpen:true}),
    current:()=>selected&&leisure.has(selected.id)?selected.id:null};
  // Keep a picker a pop; selecting a conversation changes it to its real writing page.
  document.addEventListener('click',e=>{
    const day=e.target.closest('[data-block="planning"] [data-jour]');
    if(day){select('day:'+day.dataset.jour);return;}
    const module=e.target.closest('[data-block="communication"] [data-ouverture]');
    if(module){select(module.dataset.ouverture==='dm'?'dm-picker':module.dataset.ouverture);return;}
    const leisureButton=e.target.closest('[data-block="communication"] [data-ensemble-view]');
    if(leisureButton){select(leisureButton.dataset.ensembleView);return;}
    if(e.target.closest('[data-unified-create]')){select('create');return;}
    if(e.target.closest('#fermerPop')){close();return;}
    if(e.target.closest('[data-action="new-dm"]')){select('dm',{forceOpen:true});return;}
    if(e.target.closest('[data-action="new-group"]')){
      // Reuses the real group creation form supplied by the DM module.
      window.TEstChats?.newGroup?.();
      return;
    }
    if(e.target.closest('[data-action="activity"]')){
      select('activities',{forceOpen:true});
      const run=()=>{try{leisureFrame?.contentWindow?.STIPLeisure?.openCreator?.()}catch{}};
      if(leisureLoaded)run();else leisureFrame?.addEventListener('load',run,{once:true});
      return;
    }
    if(e.target.closest('[data-open-planning]')){select('personal',{forceOpen:true});return;}
  });
  addEventListener('popstate',restoreFromLocation);
  addEventListener('t-est:planning-updated',()=>{
    if(selected?.id?.startsWith('day:'))popBody.innerHTML=window.TEstAccueilPlanning?.htmlFor?.(Number(selected.id.slice(4)))||'';
  });
  // Initial route once. Pop panels are not listed in the navigation history.
  restoreFromLocation();
})();
