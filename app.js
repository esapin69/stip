(() => {
'use strict';
const ACCESS_API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access',STORAGE='stip_session_v1',SCROLL_STORE='stip_scroll_v2',PREVIEW_STORE='stip_admin_preview_v1',STANDALONE_ENTRY=document.documentElement.dataset.stipEntryStandalone==='1',$=s=>document.querySelector(s),qsa=s=>[...document.querySelectorAll(s)];
const loginView=$('#loginView'),appView=$('#appView'),loginForm=$('#loginForm'),accessCode=$('#accessCode'),loginMessage=$('#loginMessage'),logoutBtn=$('#logoutBtn'),welcomeText=$('#welcomeText');let session=null,restoring=false,panelGuard=false,authEpoch=0,loginInFlight=false,lastAutoCode='',pendingScrollRestore=null;
try{history.scrollRestoration='manual'}catch{}
function token(){return localStorage.getItem(STORAGE)||''}
function clientId(){
  const key='stip_client_id_v1';
  let id='';
  try{id=localStorage.getItem(key)||''}catch{}
  if(!id){
    try{id=crypto.randomUUID?.()||''}catch{}
    if(!id)id='stip-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
    try{localStorage.setItem(key,id)}catch{}
  }
  return id;
}
function readPreview(){try{return JSON.parse(sessionStorage.getItem(PREVIEW_STORE)||'null')}catch{return null}}
function clearPreview(){try{sessionStorage.removeItem(PREVIEW_STORE)}catch{}}
function previewAllowed(d){return !!(d?.permissions?.admin||d?.permissions?.access_manage)}
function makePreviewSession(real,p){
  const permissions=JSON.parse(JSON.stringify(p?.permissions||{}));
  const agent={...(p?.agent||{})};
  return {...real,role_key:p?.role_key||'',agent,permissions,depths:{},preview_mode:true};
}
function installPreview(p){
  window.STIPPreview={active:true,profile_id:p?.profile_id||'',agent:p?.agent||{},permissions:p?.permissions||{}};
  document.body.classList.add('stip-preview-mode');
  let bar=document.getElementById('stipPreviewBar');
  if(!bar){
    bar=document.createElement('div');
    bar.id='stipPreviewBar';
    bar.innerHTML='<div><b id="stipPreviewName">Aperçu</b><span>Simulation des droits · aucune action possible</span></div><button id="stipPreviewExit" type="button">Quitter</button>';
    document.body.prepend(bar);
    const st=document.createElement('style');
    st.id='stipPreviewStyle';
    st.textContent='#stipPreviewBar{position:sticky;top:0;z-index:99999;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:#111827;color:#fff;border-bottom:2px solid #f59e0b;font:600 13px/1.2 system-ui,-apple-system,sans-serif}#stipPreviewBar div{display:grid;gap:2px}#stipPreviewBar b{font-size:14px}#stipPreviewBar span{font-size:11px;opacity:.78}#stipPreviewBar button{border:1px solid rgba(255,255,255,.3);border-radius:10px;background:#fff;color:#111827;padding:8px 11px;font-weight:800}.stip-preview-mode #logoutBtn{display:none!important}';
    document.head.appendChild(st);
  }
  const name=[p?.agent?.prenom,p?.agent?.nom].filter(Boolean).join(' ').trim()||'ce profil';
  const label=document.getElementById('stipPreviewName');if(label)label.textContent='Voir comme '+name;
  document.getElementById('stipPreviewExit').onclick=()=>{clearPreview();location.replace('access-manage.html')};
  document.addEventListener('click',e=>{
    if(!window.STIPPreview?.active)return;
    if(e.target.closest?.('#stipPreviewExit'))return;
    const action=e.target.closest?.('#homeView button,#homeView a,#stipContextDock button,#hsPanel button,#hsPanel a');
    if(action){e.preventDefault();e.stopImmediatePropagation()}
  },true);
}
function route(){return location.hash.replace(/^#\/?/,'')||'home'}
function clean(next){return String(next||'home').replace(/^\/+|\/+$/g,'')||'home'}
function urlFor(next){return location.pathname+location.search+'#/'+clean(next)}
function readScrolls(){try{return JSON.parse(sessionStorage.getItem(SCROLL_STORE)||'{}')||{}}catch{return{}}}
function saveScroll(r=route()){const m=readScrolls();m[clean(r)]=Math.max(0,Math.round(window.scrollY||0));try{sessionStorage.setItem(SCROLL_STORE,JSON.stringify(m))}catch{}}
function setScroll(r,y){const m=readScrolls();m[clean(r)]=Math.max(0,Number(y)||0);try{sessionStorage.setItem(SCROLL_STORE,JSON.stringify(m))}catch{}}
function applyPendingScrollRestore(){
  const pending=pendingScrollRestore;
  if(!pending)return true;
  if(Date.now()>pending.expires||clean(route())!==pending.route){pendingScrollRestore=null;return true}
  const root=document.scrollingElement||document.documentElement;
  const max=Math.max(0,Number(root?.scrollHeight||0)-Number(window.innerHeight||0));
  if(pending.y>max+2)return false;
  window.scrollTo({top:pending.y,left:0,behavior:'auto'});
  if(Math.abs((window.scrollY||0)-pending.y)<=3){pendingScrollRestore=null;return true}
  return false;
}
function restoreScroll(r=route()){
  const target=clean(r),y=Number(readScrolls()[target]||0);
  pendingScrollRestore={route:target,y,expires:Date.now()+5000};
  const attempt=()=>{if(applyPendingScrollRestore())return;if(pendingScrollRestore)setTimeout(attempt,140)};
  requestAnimationFrame(()=>requestAnimationFrame(attempt));
}
function setRoute(next,opt={}){const target=clean(next);if(route()===target){restore();return}saveScroll();if(!opt.keepScroll){setScroll(target,0);window.scrollTo({top:0,left:0,behavior:'auto'})}const state={...(history.state||{}),stip:true,route:target,panel:false};if(opt.replace)history.replaceState(state,'',urlFor(target));else history.pushState(state,'',urlFor(target));restore()}
function back(fallback='home'){saveScroll();if(history.state?.panel){history.back();return}if(route()!=='home'&&history.length>1&&history.state?.stip){history.back();return}setRoute(fallback,{replace:true,keepScroll:true})}
function showOnly(id){qsa('.view').forEach(v=>v.classList.add('hidden'));document.getElementById(id)?.classList.remove('hidden')}
function msg(t='',kind=''){loginMessage.textContent=t;loginMessage.className=`message ${kind}`.trim()}
function dockButton(action,icon,label){return`<button type="button" data-root-action="${action}" aria-label="${label}"><span>${icon}</span><small>${label}</small></button>`}
function dockActions(r){if(r==='home'||!r)return[];if(r==='planning/personal')return[];if(r==='planning/team'||r==='planning/spirit')return[['mail','✉','Envoyer équipe'],['calendar','▦','Agenda équipe']];if(r==='planning/change')return[['received','↓','Reçues'],['history','✓','Mes demandes']];if(r==='planning/calendar')return[['personalcal','♙','Mon agenda'],['teamcal','♟','Équipe']];if(r==='contacts/directory')return[['focus-search','⌕','Rechercher'],['contact-share','↥','Exporter']];if(r==='contacts/services')return[['focus-services','☎','Services']];if(r==='contacts/chiefs')return[['focus-chiefs','♟','Encadrement']];if(r==='contacts/share')return[['contact-share','↥','Exporter']];return[]}
function ensureDock(){let d=$('#stipContextDock');if(d)return d;d=document.createElement('nav');d.id='stipContextDock';d.className='stip-context-dock hidden';d.setAttribute('aria-label','Actions rapides');document.body.appendChild(d);return d}
function renderDock(r=route()){const d=ensureDock(),actions=dockActions(r);d.innerHTML=actions.map(x=>dockButton(...x)).join('');d.classList.toggle('hidden',!actions.length);document.body.classList.toggle('stip-has-dock',!!actions.length)}
function emitRoute(r){renderDock(r);window.dispatchEvent(new CustomEvent('stip:route',{detail:{route:r}}))}
function scrollToNode(sel){document.querySelector(sel)?.scrollIntoView({behavior:'smooth',block:'start'})}
function runDockAction(action){const r=route();if(action==='calendar'){window.STIPCalendars?.open?.(r.includes('/team')?'team':'personal');return}if(action==='personalcal'){window.STIPCalendars?.open?.('personal');return}if(action==='teamcal'){window.STIPCalendars?.open?.('team');return}if(action==='mail'){const team=r.includes('/team');location.href=`mailto:?subject=${encodeURIComponent(team?'Planning équipe STIP':'Mon planning STIP')}`;return}if(action==='received'){scrollToNode('.cw-inbox');return}if(action==='history'){scrollToNode('.cw-history');return}if(action==='focus-search'){const i=$('#rhubSearch');i?.focus();i?.scrollIntoView({behavior:'smooth',block:'center'});return}if(action==='focus-services'||action==='focus-chiefs'){scrollToNode('#rhubContent');return}if(action==='contact-share'){if(r!=='contacts/share'){setRoute('contacts/share');setTimeout(()=>$('#rhubExport')?.click(),250)}else $('#rhubExport')?.click()}}
async function access(action,body={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);try{const h={'Content-Type':'application/json'};if(token())h['X-STIP-Session']=token();const r=await fetch(ACCESS_API,{method:'POST',headers:h,body:JSON.stringify({action,...body}),signal:c.signal}),j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw Error(j.error||`Erreur ${r.status}`);return j}finally{clearTimeout(t)}}
function personName(a){return window.STIPName?.format?.(a)||String(a?.prenom||a?.nom||'Agent').trim()}
function traineeItems(items=[]){return items.map(x=>({...x,id:x.id||`stagiaire:${x.key}`,source_key:x.source_key||`stagiaire:${x.key}`,trainee_key:x.trainee_key||x.key,ghe:x.ghe||'Stage',role:'Stagiaire'}))}
async function chooseTraineeSession(d,{force=false}={}){
  if(d?.role_key!=='stagiaire')return d;
  if(d?.trainee_key&&!force)return d;
  const list=await access('trainee_list'),items=traineeItems(list.items||[]);
  if(!items.length)throw Error('Aucun stagiaire actif ou à venir n’est disponible.');
  if(!window.STIPAgentSelector?.mountPicker)throw Error('Sélecteur stagiaire indisponible.');
  return await new Promise((resolve,reject)=>{
    let done=false,overlay=null;
    const select=async item=>{
      if(done)return;done=true;
      try{const fresh=await access('trainee_select',{trainee_key:item.trainee_key||item.key});overlay?.remove();document.documentElement.classList.remove('sas-picker-open');resolve(fresh)}
      catch(e){done=false;alert(e.message||'Sélection impossible.')}
    };
    if(force&&window.STIPAgentSelector?.openPicker){
      const picker=window.STIPAgentSelector.openPicker({title:'Choisir le stagiaire',items,selectedId:d?.agent?.id||'',filter:'first',autoFocus:true,onSelect:select,onClose:()=>{if(!done)resolve(d)}});
      overlay=picker.element;return
    }
    overlay=document.createElement('div');overlay.id='stipTraineeSessionGate';overlay.className='sas-picker-overlay stip-trainee-session-gate';
    overlay.innerHTML='<section class="sas-picker-sheet" role="dialog" aria-modal="true" aria-label="Choisir le stagiaire"><header class="sas-picker-page-head"><span></span><div><small>ACCÈS STAGIAIRE</small><h2>Qui utilise STIP ?</h2></div><span></span></header><p class="stip-trainee-session-note">Choisis ton profil pour cette connexion. Ce choix reste propre à cet appareil et ne modifie pas le code commun.</p><div class="sas-picker-host"></div></section>';
    document.body.appendChild(overlay);document.documentElement.classList.add('sas-picker-open');
    window.STIPAgentSelector.mountPicker(overlay.querySelector('.sas-picker-host'),{items,selectedId:'',filter:'first',hideHeading:true,placeholder:'Ton prénom ou ton nom…',emptyText:'Aucun stagiaire disponible.',onSelect:select});
  })
}
function finishSessionResume(){document.documentElement.classList.remove('stip-session-resume')}
function cacheSession(d){if(!window.STIPPreview?.active)window.STIPContinuity?.write?.(d)}
function showLogin(text=''){finishSessionResume();window.STIPSession=null;window.dispatchEvent(new CustomEvent('stip:session-ended'));appView.classList.add('hidden');loginView.classList.remove('hidden');resetAccessCode();renderDock('home');msg(text,text?'error':'');setTimeout(()=>{if(accessCode&&!accessCode.closest('[hidden]'))accessCode.focus()},40)}
function showPublicWithSession(d){cacheSession(d);finishSessionResume();session=d;window.STIPSession=d;loginView.classList.remove('hidden');appView.classList.add('hidden');welcomeText.textContent=personName(d.agent||{});renderDock('home');window.dispatchEvent(new CustomEvent('stip:session-ready',{detail:d}))}
function closePanel(){const p=$('#hsPanel');if(!p)return;p.classList.remove('open');p.setAttribute('aria-hidden','true')}
function syncPanelHistory(){const p=$('#hsPanel');if(!p)return;const open=p.classList.contains('open');if(open&&!panelGuard&&!history.state?.panel){history.pushState({...(history.state||{}),stip:true,route:route(),panel:true},'',location.href)}panelGuard=false}
function restore(){if(!session||restoring)return;restoring=true;try{if(!history.state?.panel)closePanel();const r=route();if(r==='fauteuils'||r==='communication'||r.startsWith('communication/')){showOnly('homeView');emitRoute(r);restoreScroll(r);return}if(r==='team'){location.replace('esprit-equipe.html?entry=legacy-app-route');return}if(r==='responsable'){location.replace('responsable.html?entry=legacy-app-route');return}if(r==='home'||r==='apps'||r==='notifications'){showOnly('homeView');emitRoute(r);restoreScroll(r);return}if(r==='planning'||r.startsWith('planning/')){showOnly('planningView');emitRoute(r);restoreScroll(r);return}if(r==='contacts'||r.startsWith('contacts/')){const hub=document.getElementById('rubricHubView');if(hub)showOnly('rubricHubView');else{showOnly('genericView');const g=$('#genericView');if(g)g.innerHTML='<div class="route-loading">Chargement de Contacts…</div>'}emitRoute(r);restoreScroll(r);return}setRoute('home',{replace:true,keepScroll:true})}finally{restoring=false}}
function isCadreFamily(d){return d?.role_key==='cadre'&&d?.permissions?.cadre_dashboard===true}
function renderSession(d){cacheSession(d);finishSessionResume();session=d;window.STIPSession=d;accessCode?.blur();window.STIPFormUX?.release?.();if(isCadreFamily(d)){window.dispatchEvent(new CustomEvent('stip:login-success',{detail:d}));location.replace('cadre.html');return}loginView.classList.add('hidden');appView.classList.remove('hidden');welcomeText.textContent=personName(d.agent||{});if(!location.hash)history.replaceState({stip:true,route:'home',panel:false},'',urlFor('home'));window.dispatchEvent(new CustomEvent('stip:login-success',{detail:d}));window.dispatchEvent(new CustomEvent('stip:session-ready',{detail:d}));restore()}
loginForm?.addEventListener('submit',async e=>{e.preventDefault();if(loginInFlight)return;const code=String(accessCode.value||'').replace(/\D/g,'').slice(0,6);if(code.length!==6){msg('Entre les 6 chiffres.','error');return}const attempt=++authEpoch,submit=loginForm.querySelector('button[type="submit"]');loginInFlight=true;window.STIPAuthPending=true;if(submit)submit.disabled=true;msg('Connexion…');try{let d=await access('login',{code,client_id:clientId()});if(attempt!==authEpoch)return;localStorage.setItem(STORAGE,d.session_token);d=await chooseTraineeSession(d);if(attempt!==authEpoch)return;if(STANDALONE_ENTRY){const target=String(document.documentElement.dataset.stipEntrySuccess||'').trim();if(target){location.replace(target);return}}setScroll('home',0);history.replaceState({stip:true,route:'home',panel:false},'',urlFor('home'));renderSession(d);msg('')}catch(err){if(attempt!==authEpoch)return;lastAutoCode='';msg(err.message||'Connexion impossible.','error');try{accessCode?.focus({preventScroll:true})}catch{accessCode?.focus?.()}}finally{if(attempt===authEpoch){loginInFlight=false;window.STIPAuthPending=false;if(submit)submit.disabled=false}}});

const accessCodeToggle=$('#toggleAccessCode'),accessCodeMask=$('#accessCodeMask');
function accessCodeRevealed(){return accessCode?.dataset?.stipPinRevealed==='1'}
function updateAccessCodeMask(){
  if(!accessCode)return;
  const clean=String(accessCode.value||'').replace(/\D/g,'').slice(0,6);
  const revealed=accessCodeRevealed();
  accessCode.type='text';
  accessCode.dataset.stipPinField='1';
  if(accessCodeMask)accessCodeMask.textContent=revealed?'':'★'.repeat(clean.length);
  accessCode.classList.toggle('stip-code-revealed',revealed);
  accessCode.classList.toggle('stip-code-masked',!revealed&&clean.length>0);
  if(accessCodeToggle)accessCodeToggle.disabled=clean.length===0;
}
function sanitizeAccessCode(){
  if(!accessCode)return;
  const clean=String(accessCode.value||'').replace(/\D/g,'').slice(0,6);
  if(accessCode.value!==clean)accessCode.value=clean;
  updateAccessCodeMask();
}
function hideAccessCode(){
  if(!accessCode)return;
  delete accessCode.dataset.stipPinRevealed;
  accessCode.type='text';
  updateAccessCodeMask();
  accessCodeToggle?.setAttribute('aria-pressed','false');
  if(accessCodeToggle)accessCodeToggle.textContent='Voir';
}
function showAccessCode(){
  if(!accessCode)return;
  sanitizeAccessCode();
  const clean=String(accessCode.value||'').replace(/\D/g,'').slice(0,6);
  if(!clean)return;
  accessCode.type='text';
  accessCode.dataset.stipPinRevealed='1';
  updateAccessCodeMask();
  accessCodeToggle?.setAttribute('aria-pressed','true');
  if(accessCodeToggle)accessCodeToggle.textContent='Relâcher';
}
function resetAccessCode(){
  if(!accessCode)return;
  accessCode.value='';
  lastAutoCode='';
  accessCode.type='text';
  accessCode.dataset.stipPinField='1';
  delete accessCode.dataset.stipPinRevealed;
  accessCode.classList.remove('stip-code-revealed','stip-code-masked');
  if(accessCodeMask)accessCodeMask.textContent='';
  accessCodeToggle?.setAttribute('aria-pressed','false');
  if(accessCodeToggle){
    accessCodeToggle.textContent='Voir';
    accessCodeToggle.disabled=true;
  }
}
accessCode?.addEventListener('input',e=>{sanitizeAccessCode();const code=String(accessCode.value||'').replace(/\D/g,'').slice(0,6);if(code.length<6){lastAutoCode='';return}if(!e.isTrusted||loginInFlight||code===lastAutoCode)return;lastAutoCode=code;queueMicrotask(()=>{if(!loginInFlight&&String(accessCode.value||'').replace(/\D/g,'').slice(0,6)===code)loginForm?.requestSubmit()})});
accessCode?.addEventListener('change',sanitizeAccessCode);
accessCodeToggle?.setAttribute('aria-label','Maintenir pour afficher le code');
accessCodeToggle?.setAttribute('aria-pressed','false');
accessCodeToggle?.addEventListener('pointerdown',e=>{e.preventDefault();showAccessCode();try{accessCodeToggle.setPointerCapture(e.pointerId)}catch{}});
accessCodeToggle?.addEventListener('pointerup',hideAccessCode);
accessCodeToggle?.addEventListener('pointercancel',hideAccessCode);
accessCodeToggle?.addEventListener('pointerleave',hideAccessCode);
accessCodeToggle?.addEventListener('click',e=>{e.preventDefault();hideAccessCode()});
accessCodeToggle?.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();showAccessCode()}});
accessCodeToggle?.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();hideAccessCode()}});
window.addEventListener('blur',hideAccessCode);
window.addEventListener('pageshow',()=>{if(!loginView?.classList.contains('hidden'))resetAccessCode();else hideAccessCode()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)hideAccessCode()});
window.addEventListener('stip:intent-revealed',e=>{if(e.detail?.target?.id==='accessEntryFields')resetAccessCode()});
resetAccessCode();
logoutBtn?.addEventListener('click',async()=>{authEpoch++;loginInFlight=false;lastAutoCode='';window.STIPAuthPending=false;try{await access('logout')}catch{}window.STIPContinuity?.clear?.({clearToken:true});localStorage.removeItem(STORAGE);session=null;try{sessionStorage.removeItem(SCROLL_STORE)}catch{}history.replaceState({stip:true,route:'home',panel:false},'',urlFor('home'));showLogin()});
$('#homeBtn')?.addEventListener('click',()=>{setRoute('home');window.dispatchEvent(new CustomEvent('stip:home-root'))});document.addEventListener('click',e=>{const b=e.target.closest?.('#stipContextDock [data-root-action]');if(b)runDockAction(b.dataset.rootAction)});
window.addEventListener('popstate',e=>{panelGuard=true;restore();if(e.state?.panel)setTimeout(()=>{$('#hsPanel')?.classList.add('open');$('#hsPanel')?.setAttribute('aria-hidden','false')},0)});window.addEventListener('hashchange',restore);window.addEventListener('pagehide',()=>saveScroll(),{capture:true});window.addEventListener('beforeunload',()=>saveScroll(),{capture:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)saveScroll()});window.addEventListener('stip:home-rendered',()=>{if(!pendingScrollRestore)return;requestAnimationFrame(()=>requestAnimationFrame(applyPendingScrollRestore))});document.addEventListener('pointerdown',()=>{if(pendingScrollRestore)pendingScrollRestore=null},{capture:true});
const panel=$('#hsPanel');if(panel)new MutationObserver(syncPanelHistory).observe(panel,{attributes:true,attributeFilter:['class']});
$('#hsPanelBack')?.addEventListener('click',e=>{if(history.state?.panel){e.preventDefault();e.stopImmediatePropagation();back()}},true);
window.STIPRouter={set:setRoute,back,restore,show:showOnly,get:route,saveScroll,restoreScroll};
window.addEventListener('stip:trainee-change',async()=>{if(session?.role_key!=='stagiaire')return;try{const fresh=await chooseTraineeSession(session,{force:true});if(fresh!==session)renderSession(fresh)}catch(e){alert(e.message||'Sélection impossible.')}});
if(!location.hash)history.replaceState({stip:true,route:'home',panel:false},'',urlFor('home'));
if(!STANDALONE_ENTRY)(async()=>{const bootEpoch=authEpoch,bootToken=token();if(!bootToken){showLogin();return}const params=new URLSearchParams(location.search),quick=params.get('quick')||'',preview=params.get('preview')==='1'?readPreview():null,cached=window.STIPContinuity?.read?.()||null;let hydrated=false;
if(cached){try{let d=cached;if(preview&&previewAllowed(d)){window.STIPRealSession=d;window.STIPPreview={active:true};const pd=makePreviewSession(d,preview);renderSession(pd);installPreview(preview);hydrated=true}else{if(params.get('preview')==='1')clearPreview();d=await chooseTraineeSession(d);if(bootEpoch!==authEpoch||token()!==bootToken)return;if(quick==='public')showPublicWithSession(d);else renderSession(d);hydrated=true}}catch{}}
try{let d=window.STIPContinuity?.validate?await window.STIPContinuity.validate({force:true}):await access('me');if(bootEpoch!==authEpoch||token()!==bootToken)return;
if(preview){if(previewAllowed(d)){window.STIPRealSession=d;if(!window.STIPPreview?.active){window.STIPPreview={active:true};const pd=makePreviewSession(d,preview);renderSession(pd);installPreview(preview)}return}clearPreview()}
d=await chooseTraineeSession(d);if(bootEpoch!==authEpoch||token()!==bootToken)return;
if(!hydrated){if(quick==='public')showPublicWithSession(d);else renderSession(d);return}
if(isCadreFamily(d)){window.STIPSession=d;location.replace('cadre.html');return}
session=d;window.STIPSession=d;cacheSession(d);finishSessionResume();window.dispatchEvent(new CustomEvent('stip:session-refreshed',{detail:d}));window.dispatchEvent(new CustomEvent('stip:permissions-live',{detail:d.permissions||{}}))
}catch(e){if(bootEpoch!==authEpoch||token()!==bootToken||e?.stale){finishSessionResume();return}if(hydrated&&e?.status!==401&&e?.status!==403){finishSessionResume();return}window.STIPContinuity?.clear?.({clearToken:true});localStorage.removeItem(STORAGE);clearPreview();showLogin(e?.message||'Reconnecte-toi.')}})();
})();
