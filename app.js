(() => {
'use strict';
const ACCESS_API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access',STORAGE='stip_session_v1',SCROLL_STORE='stip_scroll_v2',PREVIEW_STORE='stip_admin_preview_v1',$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const loginView=$('#loginView'),appView=$('#appView'),loginForm=$('#loginForm'),accessCode=$('#accessCode'),loginMessage=$('#loginMessage'),logoutBtn=$('#logoutBtn'),welcomeText=$('#welcomeText');let session=null,restoring=false,panelGuard=false;
try{history.scrollRestoration='manual'}catch{}
function token(){return localStorage.getItem(STORAGE)||''}
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
function restoreScroll(r=route()){const y=Number(readScrolls()[clean(r)]||0);requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'auto'})))}
function setRoute(next,opt={}){const target=clean(next);if(route()===target){restore();return}saveScroll();if(!opt.keepScroll){setScroll(target,0);window.scrollTo({top:0,left:0,behavior:'auto'})}const state={...(history.state||{}),stip:true,route:target,panel:false};if(opt.replace)history.replaceState(state,'',urlFor(target));else history.pushState(state,'',urlFor(target));restore()}
function back(fallback='home'){saveScroll();if(history.state?.panel){history.back();return}if(route()!=='home'&&history.length>1&&history.state?.stip){history.back();return}setRoute(fallback,{replace:true,keepScroll:true})}
function showOnly(id){$$('.view').forEach(v=>v.classList.add('hidden'));document.getElementById(id)?.classList.remove('hidden')}
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
function showLogin(text=''){window.STIPSession=null;window.dispatchEvent(new CustomEvent('stip:session-ended'));appView.classList.add('hidden');loginView.classList.remove('hidden');renderDock('home');msg(text,text?'error':'');setTimeout(()=>accessCode?.focus(),40)}
function showPublicWithSession(d){session=d;window.STIPSession=d;loginView.classList.remove('hidden');appView.classList.add('hidden');welcomeText.textContent=personName(d.agent||{});renderDock('home');window.dispatchEvent(new CustomEvent('stip:session-ready',{detail:d}))}
function closePanel(){const p=$('#hsPanel');if(!p)return;p.classList.remove('open');p.setAttribute('aria-hidden','true')}
function syncPanelHistory(){const p=$('#hsPanel');if(!p)return;const open=p.classList.contains('open');if(open&&!panelGuard&&!history.state?.panel){history.pushState({...(history.state||{}),stip:true,route:route(),panel:true},'',location.href)}panelGuard=false}
function restore(){if(!session||restoring)return;restoring=true;try{if(!history.state?.panel)closePanel();const r=route();if(r==='fauteuils'){showOnly('homeView');emitRoute(r);restoreScroll(r);return}if(r==='home'||r==='apps'||r==='notifications'||r==='team'||r==='responsable'){showOnly('homeView');emitRoute(r);restoreScroll(r);return}if(r==='planning'||r.startsWith('planning/')){showOnly('planningView');emitRoute(r);restoreScroll(r);return}if(r==='contacts'||r.startsWith('contacts/')){const hub=document.getElementById('rubricHubView');if(hub)showOnly('rubricHubView');else{showOnly('genericView');const g=$('#genericView');if(g)g.innerHTML='<div class="route-loading">Chargement de Contacts…</div>'}emitRoute(r);restoreScroll(r);return}setRoute('home',{replace:true,keepScroll:true})}finally{restoring=false}}
function isCadreFamily(d){return d?.role_key==='cadre'&&d?.permissions?.cadre_dashboard===true}
function renderSession(d){window.dispatchEvent(new CustomEvent('stip:login-success',{detail:d}));if(isCadreFamily(d)){window.STIPSession=d;location.replace('cadre.html');return}session=d;window.STIPSession=d;loginView.classList.add('hidden');appView.classList.remove('hidden');welcomeText.textContent=personName(d.agent||{});window.dispatchEvent(new CustomEvent('stip:session-ready',{detail:d}));if(!location.hash)history.replaceState({stip:true,route:'home',panel:false},'',urlFor('home'));restore()}
loginForm?.addEventListener('submit',async e=>{e.preventDefault();const code=String(accessCode.value||'').replace(/\D/g,'').slice(0,6);if(code.length!==6){msg('Entre les 6 chiffres.','error');return}const submit=loginForm.querySelector('button[type="submit"]');if(submit)submit.disabled=true;msg('Connexion…');try{let d=await access('login',{code});localStorage.setItem(STORAGE,d.session_token);d=await chooseTraineeSession(d);setScroll('home',0);history.replaceState({stip:true,route:'home',panel:false},'',urlFor('home'));renderSession(d);msg('')}catch(err){msg(err.message||'Connexion impossible.','error')}finally{if(submit)submit.disabled=false}});
const accessCodeToggle=$('#toggleAccessCode'),accessCodeMask=$('#accessCodeMask');
function updateAccessCodeMask(){
  if(!accessCode)return;
  const clean=String(accessCode.value||'').replace(/\D/g,'').slice(0,6);
  if(accessCodeMask)accessCodeMask.textContent=accessCode.type==='text'?'':'★'.repeat(clean.length);
  accessCode.classList.toggle('stip-code-revealed',accessCode.type==='text');
  accessCode.classList.toggle('stip-code-masked',accessCode.type!=='text'&&clean.length>0);
}
function sanitizeAccessCode(){
  if(!accessCode)return;
  const clean=String(accessCode.value||'').replace(/\D/g,'').slice(0,6);
  if(accessCode.value!==clean)accessCode.value=clean;
  updateAccessCodeMask();
}
function hideAccessCode(){
  if(!accessCode)return;
  accessCode.type='password';
  updateAccessCodeMask();
  accessCodeToggle?.setAttribute('aria-pressed','false');
  if(accessCodeToggle)accessCodeToggle.textContent='Voir';
}
function showAccessCode(){
  if(!accessCode)return;
  sanitizeAccessCode();
  accessCode.type='text';
  updateAccessCodeMask();
  accessCodeToggle?.setAttribute('aria-pressed','true');
  if(accessCodeToggle)accessCodeToggle.textContent='Relâcher';
}
accessCode?.addEventListener('input',sanitizeAccessCode);
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
window.addEventListener('pageshow',()=>{sanitizeAccessCode();hideAccessCode()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)hideAccessCode()});
sanitizeAccessCode();
hideAccessCode();
logoutBtn?.addEventListener('click',async()=>{try{await access('logout')}catch{}localStorage.removeItem(STORAGE);session=null;try{sessionStorage.removeItem(SCROLL_STORE)}catch{}history.replaceState({stip:true,route:'home',panel:false},'',urlFor('home'));showLogin()});
$('#homeBtn')?.addEventListener('click',()=>{setRoute('home');window.dispatchEvent(new CustomEvent('stip:home-root'))});document.addEventListener('click',e=>{const b=e.target.closest?.('#stipContextDock [data-root-action]');if(b)runDockAction(b.dataset.rootAction)});
window.addEventListener('popstate',e=>{panelGuard=true;restore();if(e.state?.panel)setTimeout(()=>{$('#hsPanel')?.classList.add('open');$('#hsPanel')?.setAttribute('aria-hidden','false')},0)});window.addEventListener('hashchange',restore);window.addEventListener('pagehide',()=>saveScroll(),{capture:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)saveScroll()});
const panel=$('#hsPanel');if(panel)new MutationObserver(syncPanelHistory).observe(panel,{attributes:true,attributeFilter:['class']});
$('#hsPanelBack')?.addEventListener('click',e=>{if(history.state?.panel){e.preventDefault();e.stopImmediatePropagation();back()}},true);
window.STIPRouter={set:setRoute,back,restore,show:showOnly,get:route,saveScroll,restoreScroll};
window.addEventListener('stip:trainee-change',async()=>{if(session?.role_key!=='stagiaire')return;try{const fresh=await chooseTraineeSession(session,{force:true});if(fresh!==session)renderSession(fresh)}catch(e){alert(e.message||'Sélection impossible.')}});
if(!location.hash)history.replaceState({stip:true,route:'home',panel:false},'',urlFor('home'));
(async()=>{if(!token()){showLogin();return}try{let d=await access('me'),params=new URLSearchParams(location.search),quick=params.get('quick')||'',preview=params.get('preview')==='1'?readPreview():null;if(preview&&previewAllowed(d)){window.STIPRealSession=d;window.STIPPreview={active:true};const pd=makePreviewSession(d,preview);renderSession(pd);installPreview(preview);return}if(params.get('preview')==='1')clearPreview();d=await chooseTraineeSession(d);if(quick==='public'){showPublicWithSession(d);return}renderSession(d)}catch(e){localStorage.removeItem(STORAGE);clearPreview();showLogin(e?.message||'Reconnecte-toi.')}})();
})();