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
  const pageSlots=new Map();
  let selected=null,selectedKind=null,leisureFrame=null,leisureTab=null,leisureLoaded=false;
  let popKey='',priorPopNodes=new Map(),priorPopTitles=new Map();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isPop=id=>id==='day:0'||id==='day:1'||id==='dm-picker'||id==='create';
  const blockFor=id=>id.startsWith('day:')||id==='personal'?'planning':'communication';
  const pageLabel=id=>({
    'day:0':'Aujourd’hui','day:1':'Demain','dm-picker':'DM · privé',
    'create':'Créer / ouvrir',fauteuils:'Fauteuils',personal:'Mon planning',
    activities:'Activités',trips:'Trajets',invitations:'Invitations',dm:'Messages privés'
  })[id]||(id.startsWith('thread:')?(window.TEstChats?.label?.(id.slice(7))||'Discussion'):'Page');
  function visibleKey(){return selected?selected.block+':'+selected.id:''}
  const scrollSpacer=document.createElement('div');
  scrollSpacer.setAttribute('aria-hidden','true');
  scrollSpacer.style.cssText='height:0;pointer-events:none';
  $('#tAccueilHome').append(scrollSpacer);
  function scrollLine(block){
    const line=blocks[block]?.querySelector('.t-carousel');
    if(!line)return;
    // Seulement après un clic. Les gestes de glissement restent entièrement natifs.
    requestAnimationFrame(()=>{
      const band=$('#tEstHistoryBar')?.getBoundingClientRect().height||54;
      const target=Math.max(0,window.scrollY+line.getBoundingClientRect().top-band-8);
      const maxScroll=Math.max(0,document.documentElement.scrollHeight-innerHeight);
      // Compléter uniquement le bas de page si le navigateur ne peut pas aligner la rangée.
      const missing=Math.max(0,target-maxScroll+12);
      if(missing>0)scrollSpacer.style.height=(Math.ceil(missing)+8)+'px';
      window.scrollTo({top:target,behavior:'instant'});
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
    priorPopTitles.set(popKey,popTitle.textContent);
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
    popTitle.textContent=priorPopTitles.get(id)||pageLabel(id);
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
  function slotFor(id){
    const key=blockFor(id)+':'+id,region=regions[blockFor(id)];
    if(pageSlots.has(key))return pageSlots.get(key);
    const container=document.createElement('section');
    container.className='t-inline-content';
    container.setAttribute('aria-label',pageLabel(id));
    container.innerHTML='<p class="t-native-status" role="status">Chargement de '+esc(pageLabel(id))+'…</p>';
    region.append(container);
    pageSlots.set(key,container);
    window.TEstNativeModules?.mount(container,id);
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
      // Un composant métier est monté une fois, pas une page complète.
      if(leisure.has(id))window.TEstNativeModules?.mount(slot,id);
    }
    syncUrl(id,push);
    updateButtons();
    emit(true,previous);
    if(scroll)scrollLine(block);
  }
  function close(){
    scrollSpacer.style.height="0px";
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
      const run=()=>{try{window.STIPLeisure?.openCreator?.()}catch{}};
      if(pageSlots.get('communication:activities')?.dataset.nativeReady==='leisure')run();
      else window.addEventListener('t-est:leisure-ready',run,{once:true});
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
