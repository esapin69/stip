(()=>{'use strict';
const API='https://stip-ten.vercel.app/api/stip-access',KEY='stip_access_request_tracking_v1',d=document.getElementById('accessRequestDialog'),openers=[...document.querySelectorAll('[data-open-access-request]')],close=document.getElementById('requestAccessClose'),form=document.getElementById('accessRequestForm'),msg=document.getElementById('accessRequestMessage'),loginView=document.getElementById('loginView');let autoConnecting=false,requestHistoryId='',restoringHistory=false,closingHistory=false;
function requestFields(){const canonical=window.STIPFormUX?.fields?.(form);return [...(canonical||form?.querySelectorAll?.('[data-stip-keyboard-focus]')||[])].filter(field=>!field.disabled&&!field.readOnly&&!field.closest('[hidden]'))}
function requestState(state=history.state){return state?.stipAccessRequest||null}
function requestMarker(view,index,depth){return{id:requestHistoryId,view,index,depth}}
function showOverview(){
  if(!d||!form)return;
  form.dataset.stipOverview='1';
  window.STIPFormUX?.release?.();
  try{document.activeElement?.blur?.()}catch{}
  d.scrollTop=0;
  requestAnimationFrame(()=>{
    try{close?.focus({preventScroll:true})}catch{close?.focus?.()}
    requestAnimationFrame(()=>d.scrollTo?.({top:0,behavior:'auto'}))
  })
}
function restoreStep(index){
  const field=requestFields()[Number(index)];
  if(!field){showOverview();return}
  delete form.dataset.stipOverview;
  requestAnimationFrame(()=>{
    if(window.STIPFormUX?.transferFocus?.(field))return;
    try{field.focus({preventScroll:true})}catch{field.focus?.()}
  })
}
function pushOverviewState(){
  requestHistoryId='access-'+Date.now();
  history.pushState({...history.state,stipAccessRequest:requestMarker('overview',-1,1)},'',location.href)
}
function pushStepState(field){
  if(restoringHistory||!d?.open)return;
  const fields=requestFields(),index=fields.indexOf(field);
  if(index<0)return;
  const current=requestState();
  if(current?.id===requestHistoryId&&current.view==='step'&&Number(current.index)===index)return;

  let depth=current?.id===requestHistoryId?Math.max(1,Number(current.depth)||1):1;
  let start=index;
  if(current?.id===requestHistoryId&&current.view==='overview')start=0;
  else if(current?.id===requestHistoryId&&current.view==='step'&&Number(current.index)<index)start=Number(current.index)+1;

  for(let i=start;i<=index;i++){
    depth+=1;
    history.pushState({...history.state,stipAccessRequest:requestMarker('step',i,depth)},'',location.href)
  }
}
function openRequest(options={}){
  if(!d||!form)return;
  window.STIPFormUX?.normalizeAutofill?.(form);
  window.STIPFormUX?.release?.();
  try{document.activeElement?.blur?.()}catch{}

  const state=options.state||null;
  if(state){
    restoringHistory=true;
    requestHistoryId=state.id||('access-'+Date.now());
    if(state.view==='overview')form.dataset.stipOverview='1';
    else delete form.dataset.stipOverview;
    if(!d.open)d.showModal();
    if(state.view==='step')restoreStep(state.index);
    else showOverview();
    setTimeout(()=>restoringHistory=false,100);
    return
  }

  pushOverviewState();
  form.dataset.stipOverview='1';
  if(!d.open)d.showModal();
  showOverview()
}
function closeRequest(collapseHistory=true){
  if(!d)return;
  const state=requestState(),depth=state?.id===requestHistoryId?Math.max(0,Number(state.depth)||0):0;
  window.STIPFormUX?.release?.();
  try{document.activeElement?.blur?.()}catch{}
  delete form?.dataset?.stipOverview;
  if(d.open)d.close();
  if(collapseHistory&&depth>0){
    closingHistory=true;
    history.go(-depth);
    setTimeout(()=>{closingHistory=false;requestHistoryId=''},350)
  }else requestHistoryId=''
}
openers.forEach(button=>button.addEventListener('click',e=>{e.preventDefault();openRequest()}));
close?.addEventListener('click',()=>closeRequest(true));
d?.addEventListener('click',e=>{if(e.target===d)closeRequest(true)});
d?.addEventListener('cancel',e=>{e.preventDefault();closeRequest(true)});
d?.addEventListener('close',()=>{window.STIPFormUX?.release?.();if(form)delete form.dataset.stipOverview});
form?.addEventListener('pointerdown',e=>{if(e.target.closest?.('[data-stip-keyboard-focus]'))delete form.dataset.stipOverview},true);
form?.addEventListener('focusin',e=>{const field=e.target.closest?.('[data-stip-keyboard-focus]');if(field)pushStepState(field)});
window.addEventListener('stip:form-overview',e=>{if(e.detail?.form!==form||!d?.open)return;form.dataset.stipOverview='1'});
window.addEventListener('stip:form-previous-request',e=>{
  if(e.detail?.form!==form||!d?.open)return;
  e.preventDefault();
  const state=requestState();
  if(state?.id!==requestHistoryId||state.view!=='step'){showOverview();return}
  const depth=Math.max(0,Number(state.depth)||0),index=Number(state.index);
  if(depth>2){history.back();return}
  if(index>0){
    restoringHistory=true;
    history.replaceState({...history.state,stipAccessRequest:requestMarker('step',index-1,2)},'',location.href);
    restoreStep(index-1);
    setTimeout(()=>restoringHistory=false,100);
    return
  }
  history.back()
});
window.addEventListener('popstate',e=>{
  if(closingHistory){closingHistory=false;requestHistoryId='';return}
  const state=requestState(e.state);
  if(!state){
    if(d?.open){
      restoringHistory=true;
      window.STIPFormUX?.release?.();
      d.close();
      setTimeout(()=>restoringHistory=false,0)
    }
    requestHistoryId='';
    return
  }
  restoringHistory=true;
  requestHistoryId=state.id||requestHistoryId;
  if(state.view==='overview')form.dataset.stipOverview='1';
  else delete form.dataset.stipOverview;
  if(!d?.open)d.showModal();
  if(state.view==='step')restoreStep(state.index);
  else showOverview();
  setTimeout(()=>restoringHistory=false,100)
});
async function post(body){const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw Error(j.error||'Envoi impossible.');return j}
function tracking(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
function clearTracking(){localStorage.removeItem(KEY);document.getElementById('accessRequestStatus')?.remove()}
function connectWithCode(code){const i=document.getElementById('accessCode'),f=document.getElementById('loginForm');if(!i||!f||!code)return;i.value=code;i.dispatchEvent(new Event('input',{bubbles:true}));autoConnecting=true;f.requestSubmit()}
function notice(j){const host=document.getElementById('accessRequestStatusHost')||document.querySelector('.public-home');if(!host)return;let n=document.getElementById('accessRequestStatus');if(!n){n=document.createElement('section');n.id='accessRequestStatus';n.className='request-access-status';host.prepend(n)}const t=tracking(),note=String(j.decision_note||'').trim();if(j.status==='approved'){const code=String(j.code||'');n.className='request-access-status approved';n.innerHTML=`<div class="request-status-head"><span>✓ ACCÈS VALIDÉ</span><strong>Votre espace STIP est prêt</strong></div>${note?`<p class="request-status-message">${escapeHtml(note)}</p>`:''}<div class="request-status-reminder"><small>VOTRE CODE</small><strong>${escapeHtml(code)}</strong></div><button type="button" class="request-status-use" id="requestStatusUse">Se connecter maintenant <b>→</b></button>`;n.querySelector('#requestStatusUse').onclick=()=>connectWithCode(code)}else if(j.status==='rejected'){n.className='request-access-status rejected';n.innerHTML=`<div class="request-status-head"><span>DEMANDE TRAITÉE</span><strong>Accès non ouvert</strong></div><p class="request-status-message">${escapeHtml(note||'Votre demande n’a pas été acceptée.')}</p><button type="button" class="request-status-dismiss" id="requestStatusDismiss">Fermer ce suivi</button>`;n.querySelector('#requestStatusDismiss').onclick=()=>clearTracking()}else if(j.needs_code){n.className='request-access-status pending';n.innerHTML=`<div class="request-status-head"><span>DEMANDE À COMPLÉTER</span><strong>Choisissez votre code personnel</strong></div><p>Votre demande est conservée. Il manque seulement votre code à 6 chiffres.</p><div class="request-status-code"><input id="requestStatusNewCode" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="••••••" autocomplete="new-password"><button type="button" id="requestStatusSaveCode">Valider</button></div><p id="requestStatusCodeMessage"></p>`;const input=n.querySelector('#requestStatusNewCode'),save=n.querySelector('#requestStatusSaveCode'),message=n.querySelector('#requestStatusCodeMessage');input.oninput=()=>input.value=input.value.replace(/\D/g,'').slice(0,6);save.onclick=async()=>{const code=input.value.trim();if(!/^\d{6}$/.test(code)){message.textContent='Entrez exactement 6 chiffres.';return}save.disabled=true;message.textContent='Enregistrement…';try{await post({action:'set_code',...t,requested_code:code});notice({status:'pending',needs_code:false})}catch(e){message.textContent=e.message||'Impossible d’enregistrer ce code.';save.disabled=false}}}else{n.className='request-access-status pending';n.innerHTML=`<div class="request-status-head"><span>DEMANDE ENVOYÉE</span><strong>STIP suit votre demande</strong></div><p>Vous pouvez quitter cette page. La réponse réapparaîtra ici sur ce navigateur.</p>`}if(t?.request_id)n.dataset.requestId=t.request_id}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
async function check(){const t=tracking();if(!t?.request_id||!t?.tracking_token)return;try{notice(await post({action:'status',...t}))}catch{}}
form?.addEventListener('submit',async e=>{e.preventDefault();const submit=form.querySelector('.request-submit'),fd=new FormData(form),body=Object.fromEntries(fd.entries());body.requested_code=String(body.requested_code||'').replace(/\D/g,'').slice(0,6);if(!body.first_name?.trim()||!body.last_name?.trim()){msg.textContent='Nom et prénom requis.';msg.className='message error';return}if(!/^\d{6}$/.test(body.requested_code)){msg.textContent='Choisissez un code personnel de 6 chiffres.';msg.className='message error';return}msg.textContent='Envoi…';msg.className='message';if(submit)submit.disabled=true;try{const j=await post({action:'submit',...body});localStorage.setItem(KEY,JSON.stringify({request_id:j.request_id,tracking_token:j.tracking_token,created_at:Date.now()}));form.reset();msg.textContent='Demande transmise.';msg.className='message success';notice({status:'pending',needs_code:false});setTimeout(()=>closeRequest(true),500)}catch(err){msg.textContent=err.message||'Envoi impossible.';msg.className='message error'}finally{if(submit)submit.disabled=false}});
const requested=document.getElementById('requestedAccessCode');requested?.addEventListener('input',()=>{requested.value=requested.value.replace(/\D/g,'').slice(0,6)});
window.addEventListener('stip:login-success',()=>{if(autoConnecting){autoConnecting=false;clearTracking()}});
if(loginView)new MutationObserver(()=>{if(autoConnecting&&loginView.classList.contains('hidden')){autoConnecting=false;clearTracking()}}).observe(loginView,{attributes:true,attributeFilter:['class']});
check();window.addEventListener('pageshow',check);window.addEventListener('focus',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});setInterval(check,300000)
})();