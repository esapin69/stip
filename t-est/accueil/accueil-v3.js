(() => {
  'use strict';
  // Laboratoire T-est : aucune modification du site de production.
  const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data';
  const STORE='stip_session_v1', CACHE='t_est_daily_snapshot_v3';
  const DESTINATIONS={
    fauteuils:'/index.html?quick=communication&tab=fauteuils#/communication/fauteuils',
    dm:'/index.html?quick=communication&tab=dm#/communication/dm',
    loisirs:'/sorties-loisirs.html',
    personnel:'/index.html#/planning/personal'
  };
  const COLORS={
    M:['#087cff','#dcebff'],J:['#00b85a','#dcf8e8'],J4:['#ff9500','#fff0d6'],
    S:['#ffd500','#fff3a3'],N:['#000000','#eceff1']
  };
  const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
  const dialog=$('#accueilPop'), popTitle=$('#popTitre'), popBody=$('#popBody');
  let personal=[],definitions=[],agenda=[],formations=[],stagiaires=[],loading=false,error='';
  let asOf=0,account='',currentRequest=null,fetchEpoch=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const hex=x=>/^#[0-9a-f]{6}$/i.test(String(x||''))?String(x):'';
  function dayIso(delta=0){
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const v=t=>Number(p.find(x=>x.type===t)?.value||0);
    return new Date(Date.UTC(v('year'),v('month')-1,v('day')+delta,12)).toISOString().slice(0,10);
  }
  const shiftDay=iso=>new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'}).format(new Date(iso+'T12:00:00Z'));
  const readable=iso=>new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long'}).format(new Date(iso+'T12:00:00Z'));
  const covers=(d,begin,end)=>String(begin||'').slice(0,10)<=d && d<=String(end||begin||'').slice(0,10);
  function owner(){
    const session=window.STIPContinuity?.read?.() || {};
    const a=session.agent||{};
    return [a.id||a.source_key||a.matricule||[a.prenom,a.nom].filter(Boolean).join(' '),session.role_key||'']
      .map(v=>String(v||'').trim()).join('::');
  }
  async function tokenHash(token){
    if(!crypto?.subtle?.digest)return '';
    try{
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
      return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }catch{return ''}
  }
  function getRow(delta){
    const date=dayIso(delta);
    return personal.find(row=>String(row?.date||'').slice(0,10)===date)||null;
  }
  function baseCode(raw){
    const original=String(raw||'').trim().toUpperCase().replace(/[*★☆✱✳✶✷✸✹✺✻✼✽✾✿]+$/u,'');
    const fromRegistry=window.STIPShiftRegistry?.baseCode?.(original);
    if(fromRegistry&&fromRegistry!=='—')return fromRegistry;
    if(/^J4\d+$/.test(original))return 'J4';
    const match=original.match(/^(M|J|S|N)\d+$/);
    return match?match[1]:original;
  }
  function meta(row){
    if(!row)return null;
    const raw=String(row.code||row.source_value||'').trim();
    if(!raw)return null;
    const code=baseCode(raw),def=window.STIPShiftRegistry?.resolve?.(raw)
      ||definitions.find(x=>String(x.code||'').toUpperCase()===code);
    const tone=COLORS[code]||['#7d8996','#edf2f4'];
    const color=hex(def?.color_hex)||tone[0],soft=hex(def?.soft_color_hex)||tone[1];
    const label=window.STIPShiftRegistry?.displayName?.(raw)||String(def?.label||raw);
    const time=String(row.horaire||row.horaires||row.shift_time||'').trim()||
      [row.start_time,row.end_time].filter(Boolean).map(x=>String(x).slice(0,5)).join(' – ')||
      window.STIPShiftRegistry?.time?.(raw)||'';
    const note=String(row.observation||row.note||row.notes||row.commentaire||row.comment||'').trim();
    const serviceRaw=String(row.equipe||'').trim();
    const service=window.STIPShiftRegistry?.nightTeam
      ? window.STIPShiftRegistry.nightTeam(serviceRaw)
      : (/\bnuit\b/i.test(serviceRaw)?serviceRaw:'');
    return {raw,code,label,color,soft,time,note,service,icon:String(def?.icon||'')};
  }
  function setData(data, timestamp=Date.now()){
    if(!data)return;
    personal=Array.isArray(data.personal)?data.personal:[];
    definitions=Array.isArray(data.shift_definitions)?data.shift_definitions:[];
    agenda=Array.isArray(data.agenda_items)?data.agenda_items:[];
    formations=Array.isArray(data.personal_formations)?data.personal_formations:[];
    stagiaires=Array.isArray(data.personal_stagiaires)?data.personal_stagiaires:[];
    if(definitions.length)window.STIPShiftRegistry?.set?.(definitions);
    asOf=timestamp;
    drawCards();
    if(dialog.open&&dialog.dataset.day!==undefined)showDay(Number(dialog.dataset.day));
  }
  function drawCards(){
    $$('.accueil-carte[data-jour]').forEach(el=>{
      const shift=meta(getRow(Number(el.dataset.jour))),caption=el.querySelector('[data-shift]');
      el.style.removeProperty('--carte-shift');
      el.style.removeProperty('--carte-soft');
      el.removeAttribute('data-loaded');
      if(shift){
        el.style.setProperty('--carte-shift',shift.color);
        el.style.setProperty('--carte-soft',shift.soft);
        el.dataset.loaded='true';
        caption.textContent=shift.label+(shift.time?' · '+shift.time:'');
      }else caption.textContent='';
    });
  }
  function readSiteCache(){
    try{
      const c=JSON.parse(sessionStorage.getItem('stip_home_runtime_cache_v2')||'null');
      const who=owner();
      if(!c || c.version!==2 || !c.boot || !who || who==='::' || c.owner!==who || Date.now()-Number(c.at||0)>600000)return false;
      setData(c.boot,Number(c.at||Date.now()));
      return true;
    }catch{return false}
  }
  function readOwnCache(hash){
    if(!hash)return false;
    try{
      const c=JSON.parse(sessionStorage.getItem(CACHE)||'null');
      if(!c||c.hash!==hash||c.owner!==account||c.date!==dayIso()||Date.now()-c.at>3*3600000)return false;
      if(!asOf || c.at>asOf)setData(c.data,c.at);
      return true;
    }catch{return false}
  }
  function saveOwnCache(hash){
    if(!hash)return;
    try{
      sessionStorage.setItem(CACHE,JSON.stringify({
        hash,owner:account,date:dayIso(),at:asOf,
        data:{personal:personal.filter(x=>x.date>=dayIso(-1)&&x.date<=dayIso(7)),
          shift_definitions:definitions,agenda_items:agenda.filter(x=>x.event_date>=dayIso(-1)&&x.event_date<=dayIso(7)),
          personal_formations:formations.filter(x=>String(x.date_fin||'').slice(0,10)>=dayIso(-1)),
          personal_stagiaires:stagiaires.filter(x=>String(x.date_fin||'').slice(0,10)>=dayIso(-1))}
      }));
    }catch{}
  }
  function show(title,html,day){
    popTitle.textContent=title;
    popBody.innerHTML=html;
    if(day===undefined)delete dialog.dataset.day; else dialog.dataset.day=String(day);
    if(!dialog.open)dialog.showModal();
  }
  function dayEvents(iso){
    const all=[];
    for(const x of agenda){
      if(String(x.event_date||'').slice(0,10)!==iso)continue;
      const isMedical=/medical|mobi_lit|visite|private_appointment/i.test(String(x.source_type||''));
      all.push({title:isMedical?'Rendez-vous':String(x.title||'Événement'),
        icon:String(x.icon||'📅'),when:[x.start_time,x.end_time].filter(Boolean).map(t=>String(t).slice(0,5)).join(' – ')||
          (x.all_day?'Toute la journée':'Horaire non précisé'),
        where:isMedical?'':String(x.location||''),detail:isMedical?'':String(x.body||'')});
    }
    for(const x of formations)if(covers(iso,x.date_debut,x.date_fin||x.date_debut))
      all.push({title:'Formation : '+String(x.intitule||'Sans titre'),icon:'🎓',when:String(x.horaire||''),where:String(x.lieu||''),detail:''});
    for(const x of stagiaires)if(covers(iso,x.date_debut,x.date_fin||x.date_debut))
      all.push({title:'Stagiaire : '+[x.prenom,x.nom].filter(Boolean).join(' '),icon:'👤',
        when:String(x.horaires||''),where:'',detail:''});
    return all;
  }
  function showDay(delta){
    const iso=dayIso(delta),m=meta(getRow(delta)),events=dayEvents(iso),title=delta?'Demain':'Aujourd’hui';
    let html='<p class="pop-date">'+esc(shiftDay(iso))+'</p>';
    if(m){
      html+='<div class="pop-shift" style="--carte-shift:'+esc(m.color)+';--carte-soft:'+esc(m.soft)+'">'+
        '<strong>'+esc((m.icon?m.icon+' ':'')+m.label)+'</strong></div>';
      const rows=[['Horaires',m.time],...(m.service?[['Équipe',m.service]]:[]),['Observation',m.note]].filter(x=>x[1]);
      html+=rows.map(x=>'<div class="pop-ligne"><span>'+esc(x[0])+'</span><strong>'+esc(x[1])+'</strong></div>').join('');
    }else{
      const msg=error||(!asOf?'Chargement en cours. Tu peux déjà ouvrir ton planning complet.':
        !personal.length?'Aucun planning personnel accessible.':'Aucun shift renseigné pour cette date.');
      html+='<div class="pop-shift"><strong>'+esc(msg)+'</strong></div>';
    }
    html+='<h3 class="pop-events-title">Événements et rendez-vous</h3>';
    html+=events.length?events.map(e=>'<article class="pop-event"><strong>'+esc(e.icon)+' '+esc(e.title)+'</strong>'+
      '<small>'+esc([e.when,e.where].filter(Boolean).join(' · '))+'</small>'+
      (e.detail?'<small>'+esc(e.detail)+'</small>':'')+'</article>').join('')
      :'<p class="pop-info">'+(loading&&!asOf?'Recherche des informations du jour…':'Aucun événement personnel signalé.')+'</p>';
    html+='<footer class="pop-footer"><button type="button" class="pop-primary" data-open-planning>Voir mon planning complet ›</button></footer>';
    if(loading)html+='<p class="pop-live">Actualisation des données en cours…</p>';
    show(title,html,delta);
  }
  function channels(){
    show('Créer / ouvrir un canal','<div class="pop-choix">'+
      '<button type="button" data-canal="fauteuils"><span aria-hidden="true">♿</span><span><strong>Fauteuils</strong><small>Ouvrir le canal existant</small></span></button>'+
      '<button type="button" data-canal="dm"><span aria-hidden="true">✉️</span><span><strong>DM · privé / groupe</strong><small>Créer ou retrouver une conversation</small></span></button>'+
      '<button type="button" data-canal="loisirs"><span aria-hidden="true">🎉</span><span><strong>Événements · loisirs</strong><small>Voir ou créer une activité validée</small></span></button></div>');
  }
  function locationFor(bloc,vue){
    const next=new URL(window.location.href);
    next.searchParams.delete('conversation');
    if(!bloc){next.searchParams.delete('bloc');next.searchParams.delete('vue');}
    else{next.searchParams.set('bloc',bloc);next.searchParams.set('vue',vue);}
    return next.pathname+next.search+next.hash;
  }
  function navigate(bloc,vue){
    const next=locationFor(bloc,vue);
    if(next!==location.pathname+location.search+location.hash)history.pushState({tEst:true,bloc,vue},'',next);
    view();
    window.dispatchEvent(new CustomEvent('t-est:page-open'));
    window.scrollTo({top:0,behavior:'instant'});
  }
  function view(){
    const params=new URLSearchParams(location.search);
    const bloc=params.get('bloc')||'',vue=params.get('vue')||'';
    const communication=bloc==='communication'&&Object.hasOwn(DESTINATIONS,vue)&&vue!=='personnel';
    const planning=bloc==='planning'&&vue==='personnel';
    const detail=communication||planning;
    document.body.classList.toggle('accueil-mode-detail',detail);
    $('#tAccueilHome').hidden=detail;
    $('#tAccueilSousPage').hidden=!detail;
    if(!detail){
      $('#tAccueilSousPage').classList.remove('t-inner-scrolling');
      return;
    }
    $('#tModuleTitre').textContent=communication?'Communication':'Mon planning';
    $('[data-carousel-detail]').hidden=!communication;
    $('[data-planning-detail]').hidden=!planning;
    $('#tAccueilSousPage .canal-action').hidden=!communication;
    $$('#tAccueilSousPage [data-ouverture]').forEach(b=>b.setAttribute('aria-current',String(communication&&b.dataset.ouverture===vue)));
    const frame=$('#tModuleFrame'),destination=DESTINATIONS[vue],url=new URL(destination,location.origin);
    if(communication && vue==='dm' && params.get('conversation'))url.searchParams.set('conversation',params.get('conversation'));
    if(frame.dataset.source!==url.href){
      $('#tAccueilSousPage').classList.remove('t-inner-scrolling');
      frame.dataset.source=url.href;
      frame.src=url.href;
      frame.title=(communication?'Communication : ':'Planning : ')+(vue==='dm'?'DM · privé':vue==='loisirs'?'Événements':vue==='fauteuils'?'Fauteuils':'Personnel');
    }
    $('#tModuleStatut').textContent='';
  }
  async function refresh(token,hash){
    if(currentRequest)return currentRequest;
    const epoch=++fetchEpoch,ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),17000);
    loading=true;
    currentRequest=(async()=>{
      try{
        const res=await fetch(API,{method:'POST',cache:'no-store',
          headers:{'Content-Type':'application/json','X-STIP-Session':token},
          body:JSON.stringify({action:'bootstrap'}),signal:ctrl.signal});
        const data=await res.json().catch(()=>({}));
        if(!res.ok||data.error)throw Error('Planning indisponible : '+(data.error||res.status));
        if(epoch!==fetchEpoch||localStorage.getItem(STORE)!==token)return;
        setData(data);
        error='';
        saveOwnCache(hash);
      }catch(e){
        if(!asOf)error=e.name==='AbortError'?'Le serveur répond trop lentement. Réessaie plus tard.':
          String(e.message||'Planning indisponible.');
      }finally{
        loading=false;clearTimeout(timeout);currentRequest=null;
        if(dialog.open&&dialog.dataset.day!==undefined)showDay(Number(dialog.dataset.day));
      }
    })();
    return currentRequest;
  }
  async function initialize(){
    view();drawCards();
    const token=localStorage.getItem(STORE)||'';
    if(!token){error='Connecte-toi à GHE pour voir ton planning.';return;}
    account=owner();
    readSiteCache();
    const hash=await tokenHash(token);
    readOwnCache(hash);
    if(asOf&&Date.now()-asOf<120000)return; // Données fraîches : pas de requête lourde inutile.
    window.setTimeout(()=>{if(localStorage.getItem(STORE)===token)refresh(token,hash);},160);
  }
  $$('.accueil-carte[data-jour]').forEach(b=>b.addEventListener('click',()=>showDay(Number(b.dataset.jour))));
  $$('[data-ouverture]').forEach(b=>b.addEventListener('click',()=>navigate('communication',b.dataset.ouverture)));
  $$('[data-canaux-open]').forEach(b=>b.addEventListener('click',channels));
  $('[data-retour]').addEventListener('click',()=>navigate('',''));
  $('#fermerPop').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{delete dialog.dataset.day;});
  popBody.addEventListener('click',e=>{
    const channel=e.target.closest('[data-canal]');
    if(channel){dialog.close();navigate('communication',channel.dataset.canal);return;}
    if(e.target.closest('[data-open-planning]')){dialog.close();navigate('planning','personnel');}
  });
  // Le défilement des sous-pages s'effectue dans l'iframe.
  // Il doit aussi libérer le haut de la page d'accueil T-est : titre et carrousel.
  const detailShell=$('#tAccueilSousPage');
  let detachScroll=()=>{};
  const syncInnerScroll=e=>{
    if(detailShell.hidden)return;
    const doc=moduleFrame.contentDocument;
    if(!doc)return;
    const target=e?.target;
    const targetIsScrollable=target?.nodeType===1&&target.scrollHeight>target.clientHeight+16;
    const targetY=targetIsScrollable?Number(target.scrollTop||0):0;
    const documentY=Math.max(
      Number(moduleFrame.contentWindow?.scrollY||0),
      Number(doc.scrollingElement?.scrollTop||0),
      Number(doc.documentElement?.scrollTop||0)
    );
    detailShell.classList.toggle('t-inner-scrolling',Math.max(documentY,targetY)>12);
  };
  // T-est uniquement : les en-tetes defilent, les onglets internes restent visibles.
  const moduleFrame=$('#tModuleFrame');
  moduleFrame?.addEventListener('load',()=>{
    detachScroll();
    detailShell.classList.remove('t-inner-scrolling');
    try{
      const innerDoc=moduleFrame.contentDocument,innerWin=moduleFrame.contentWindow;
      if(innerDoc&&innerWin){
        const listener=e=>syncInnerScroll(e);
        innerDoc.addEventListener('scroll',listener,{capture:true,passive:true});
        innerWin.addEventListener('scroll',listener,{passive:true});
        detachScroll=()=>{
          innerDoc.removeEventListener('scroll',listener,true);
          innerWin.removeEventListener('scroll',listener);
        };
      }
    }catch{}

    try{
      const doc=moduleFrame.contentDocument;
      if(!doc||doc.getElementById('t-est-tabs-only'))return;
      const rules=doc.createElement('style');
      rules.id='t-est-tabs-only';
      rules.textContent=[
        '.ca-head,.ensemble-topbar,.ensemble-hero{position:static!important;top:auto!important;}',
        '.ca-app .ca-tabs,.ca-app.is-wheelchair-tab.is-chrome-compact .ca-tabs{',
        'position:sticky!important;top:0!important;z-index:40!important;',
        'opacity:1!important;max-height:none!important;overflow:visible!important;',
        'pointer-events:auto!important;}',
        '.ensemble-nav{position:sticky!important;top:0!important;z-index:40!important;}'
      ].join('');
      doc.head.appendChild(rules);
    }catch{}
  });
  window.addEventListener('popstate',view);
  window.addEventListener('pageshow',()=>{if(!document.hidden)drawCards();});
  initialize();
})();
