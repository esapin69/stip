(()=>{'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-public-access-request',
KEY='stip_access_request_tracking_v1',
PENDING='stip_page_upload_pending_v1',
d=document.getElementById('accessRequestDialog'),
openers=[...document.querySelectorAll('[data-open-access-request]')],
close=document.getElementById('requestAccessClose'),
form=document.getElementById('accessRequestForm'),
msg=document.getElementById('accessRequestMessage'),
loginView=document.getElementById('loginView'),
profileInputs=[...document.querySelectorAll('input[name="request_profile"]')],
shared=document.getElementById('requestSharedFields'),
external=document.getElementById('requestExternalFields'),
roleWrap=document.getElementById('requestRoleWrap'),
role=document.getElementById('accessRequestRole'),
workplace=document.getElementById('accessRequestWorkplace'),
planningInputs=[...document.querySelectorAll('[data-planning-input]')],
planningName=document.getElementById('accessRequestPlanningName'),
codeStep=document.getElementById('requestCodeStepNumber'),
submit=form?.querySelector('.request-submit');
let autoConnecting=false,requestHistoryId='',restoringHistory=false,closingHistory=false;

const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tracking=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}};
const pending=()=>{try{return JSON.parse(localStorage.getItem(PENDING)||'null')}catch{return null}};
const profile=()=>profileInputs.find(x=>x.checked)?.value||'';

function requestFields(){
  const canonical=window.STIPFormUX?.fields?.(form);
  return [...(canonical||form?.querySelectorAll?.('[data-stip-keyboard-focus]')||[])].filter(field=>!field.disabled&&!field.readOnly&&!field.closest('[hidden]'));
}
function requestState(state=history.state){return state?.stipAccessRequest||null}
function requestMarker(view,index,depth){return{id:requestHistoryId,view,index,depth}}
function showOverview(){
  window.STIPFormUX?.exit?.(form,{restore:false});
  requestAnimationFrame(()=>requestAnimationFrame(()=>d?.scrollTo?.({top:0,behavior:'auto'})));
}
function focusStep(index){
  const field=requestFields()[Number(index)];
  if(!field){showOverview();return}
  requestAnimationFrame(()=>{field.focus({preventScroll:true});window.STIPFormUX?.enter?.(form,field)});
}
function beginHistory(){
  requestHistoryId='access-'+Date.now();
  history.pushState({...history.state,stipAccessRequest:requestMarker('overview',-1,1)},'',location.href);
}
function recordField(field){
  const fields=requestFields(),index=fields.indexOf(field);
  if(index<0)return;
  const current=requestState();
  if(current?.id===requestHistoryId&&current.view==='step'&&Number(current.index)===index)return;
  let depth=current?.id===requestHistoryId?Math.max(1,Number(current.depth)||1):1,start=index;
  if(current?.id===requestHistoryId&&current.view==='overview')start=0;
  else if(current?.id===requestHistoryId&&current.view==='step'&&Number(current.index)<index)start=Number(current.index)+1;
  for(let i=start;i<=index;i++){depth++;history.pushState({...history.state,stipAccessRequest:requestMarker('step',i,depth)},'',location.href)}
}
function syncProfile(){
  const p=profile(),isExternal=p==='external';
  if(shared)shared.hidden=!p;
  if(external)external.hidden=!isExternal;
  if(roleWrap)roleWrap.hidden=!isExternal;
  if(role)role.required=isExternal;
  if(workplace)workplace.required=isExternal;
  if(codeStep)codeStep.textContent=isExternal?'5':'3';
  if(submit){
    submit.hidden=!p;
    const span=submit.querySelector('span');
    if(span)span.textContent=isExternal?'Envoyer ma demande et mon planning':'Demander un accès';
  }
}
function openRequest(options={}){
  if(!d)return;
  if(!d.open)d.showModal();
  d.dataset.requestOpen='1';
  if(options.profile){
    const match=profileInputs.find(x=>x.value===options.profile);
    if(match)match.checked=true;
    syncProfile();
  }
  const state=requestState();
  if(state?.stipAccessRequest){}
  if(state?.id){
    requestHistoryId=state.id;
  }else beginHistory();
  showOverview();
}
function closeRequest(collapseHistory=true){
  if(!d?.open)return;
  window.STIPFormUX?.exit?.(form,{restore:false});
  d.close();delete d.dataset.requestOpen;
  const state=requestState(),depth=state?.id===requestHistoryId?Math.max(0,Number(state.depth)||0):0;
  if(collapseHistory&&depth){
    closingHistory=true;
    history.go(-depth);
    setTimeout(()=>{closingHistory=false;requestHistoryId=''},350);
  }else requestHistoryId='';
}
openers.forEach(button=>button.addEventListener('click',e=>{e.preventDefault();openRequest({profile:button.dataset.requestProfile||''})}));
close?.addEventListener('click',()=>closeRequest(true));
d?.addEventListener('click',e=>{if(e.target===d)closeRequest(true)});
d?.addEventListener('cancel',e=>{e.preventDefault();closeRequest(true)});
form?.addEventListener('focusin',e=>{const field=e.target?.closest?.('[data-stip-keyboard-focus]');if(field&&d?.open&&!restoringHistory)recordField(field)});
window.addEventListener('stip:form-previous-request',e=>{
  if(e.detail?.form!==form)return;
  e.preventDefault?.();
  const state=requestState();
  if(state?.id!==requestHistoryId||state.view!=='step'){showOverview();return}
  const index=Number(state.index);
  if(index<=0){
    history.back();
  }else{
    restoringHistory=true;
    history.back();
    setTimeout(()=>{restoringHistory=false},120);
  }
});
window.addEventListener('popstate',e=>{
  if(closingHistory){closingHistory=false;requestHistoryId='';return}
  const state=requestState(e.state);
  if(!state){
    if(d?.open){restoringHistory=true;d.close();delete d.dataset.requestOpen;window.STIPFormUX?.exit?.(form,{restore:false});setTimeout(()=>{restoringHistory=false;requestHistoryId=''},80)}
    return;
  }
  requestHistoryId=state.id||requestHistoryId;
  if(!d?.open){restoringHistory=true;d.showModal();d.dataset.requestOpen='1'}
  restoringHistory=true;
  if(state.view==='overview')showOverview();else focusStep(state.index);
  setTimeout(()=>{restoringHistory=false},100);
});

async function post(body){
  const r=await fetch(API,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
  j=await r.json().catch(()=>({}));
  if(!r.ok||j.error)throw Error(j.error||'Envoi impossible.');
  return j;
}
function clearTracking(){localStorage.removeItem(KEY);document.getElementById('accessRequestStatus')?.remove()}
function connectWithCode(code){const i=document.getElementById('accessCode'),f=document.getElementById('loginForm');if(!i||!f||!code)return;i.value=code;i.dispatchEvent(new Event('input',{bubbles:true}));autoConnecting=true;f.requestSubmit()}
function notice(j){
  const host=document.getElementById('accessRequestStatusHost')||document.querySelector('.public-home');
  if(!host)return;
  let n=document.getElementById('accessRequestStatus');
  if(!n){n=document.createElement('section');n.id='accessRequestStatus';n.className='request-access-status';host.prepend(n)}
  const t=tracking(),note=String(j.decision_note||'').trim();
  if(j.status==='approved'){
    const code=String(j.code||'');n.className='request-access-status approved';
    n.innerHTML=`<div class="request-status-head"><span>✓ ACCÈS VALIDÉ</span><strong>Votre espace STIP est prêt</strong></div>${note?`<p class="request-status-message">${escapeHtml(note)}</p>`:''}<div class="request-status-reminder"><small>VOTRE CODE</small><strong>${escapeHtml(code)}</strong></div><button type="button" class="request-status-use" id="requestStatusUse">Se connecter maintenant <b>→</b></button>`;
    n.querySelector('#requestStatusUse').onclick=()=>connectWithCode(code);
  }else if(j.status==='rejected'){
    n.className='request-access-status rejected';
    n.innerHTML=`<div class="request-status-head"><span>DEMANDE TRAITÉE</span><strong>Accès non ouvert</strong></div><p class="request-status-message">${escapeHtml(note||'Votre demande n’a pas été acceptée.')}</p><button type="button" class="request-status-dismiss" id="requestStatusDismiss">Fermer ce suivi</button>`;
    n.querySelector('#requestStatusDismiss').onclick=()=>clearTracking();
  }else if(j.needs_code){
    n.className='request-access-status pending';
    n.innerHTML='<div class="request-status-head"><span>DEMANDE À COMPLÉTER</span><strong>Choisissez votre code personnel</strong></div><p>Votre demande est conservée. Il manque seulement votre code à 6 chiffres.</p><div class="request-status-code"><input id="requestStatusNewCode" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="••••••" autocomplete="new-password"><button type="button" id="requestStatusSaveCode">Valider</button></div><p id="requestStatusCodeMessage"></p>';
    const input=n.querySelector('#requestStatusNewCode'),save=n.querySelector('#requestStatusSaveCode'),message=n.querySelector('#requestStatusCodeMessage');
    input.oninput=()=>input.value=input.value.replace(/\D/g,'').slice(0,6);
    save.onclick=async()=>{const code=input.value.trim();if(!/^\d{6}$/.test(code)){message.textContent='Entrez exactement 6 chiffres.';return}save.disabled=true;message.textContent='Enregistrement…';try{await post({action:'set_code',...t,requested_code:code});notice({status:'pending',needs_code:false})}catch(e){message.textContent=e.message||'Impossible d’enregistrer ce code.';save.disabled=false}};
  }else{
    n.className='request-access-status pending';
    n.innerHTML='<div class="request-status-head"><span>DEMANDE ENVOYÉE</span><strong>STIP suit votre demande</strong></div><p>Vous pouvez quitter cette page. La réponse réapparaîtra ici sur ce navigateur.</p>';
  }
  if(t?.request_id)n.dataset.requestId=t.request_id;
}
async function check(){const t=tracking();if(!t?.request_id||!t?.tracking_token)return;try{notice(await post({action:'status',...t}))}catch{}}

function mimeFor(f){return f.type||({pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'}[f.name.toLowerCase().split('.').pop()]||'application/octet-stream')}
function fmt(n){n=Number(n||0);if(n<1024)return n+' o';if(n<1048576)return(n/1024).toFixed(1)+' Ko';return(n/1048576).toFixed(1)+' Mo'}
async function signedUpload(url,f){
  const body=new FormData(),type=mimeFor(f),payload=f.type?f:new File([f],f.name,{type});
  body.append('cacheControl','3600');body.append('',payload,payload.name);
  const r=await fetch(url,{method:'PUT',headers:{'x-upsert':'false'},body});
  if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.message||j.error||'Le planning n’a pas pu être envoyé.')}
}
const selectedPlanningFile=()=>planningInputs.find(input=>input.files?.[0])?.files?.[0]||null;
planningInputs.forEach(input=>input.addEventListener('change',()=>{
  const f=input.files?.[0]||null;
  if(f){
    planningInputs.forEach(other=>{if(other!==input)other.value=''});
    if(planningName)planningName.textContent=(input.dataset.planningSource||'Fichier choisi')+' · '+f.name+' · '+fmt(f.size);
  }else if(!selectedPlanningFile()&&planningName)planningName.textContent='';
}));
profileInputs.forEach(input=>input.addEventListener('change',()=>{syncProfile();msg.textContent='';msg.className='message'}));

form?.addEventListener('submit',async e=>{
  e.preventDefault();
  const p=profile(),fd=new FormData(form),first=String(fd.get('first_name')||'').trim(),last=String(fd.get('last_name')||'').trim(),code=String(fd.get('requested_code')||'').replace(/\D/g,'').slice(0,6);
  if(!p){msg.textContent='Choisissez votre situation.';msg.className='message error';return}
  if(!first||!last){msg.textContent='Nom et prénom requis.';msg.className='message error';return}
  if(!/^\d{6}$/.test(code)){msg.textContent='Choisissez un code personnel de 6 chiffres.';msg.className='message error';return}
  if(submit)submit.disabled=true;
  msg.textContent='Envoi…';msg.className='message';
  try{
    if(p==='stip'){
      const j=await post({action:'submit',first_name:first,last_name:last,requested_code:code,comment:'Profil déclaré : brancardier'});
      localStorage.setItem(KEY,JSON.stringify({request_id:j.request_id,tracking_token:j.tracking_token,created_at:Date.now()}));
    }else{
      const f=selectedPlanningFile(),professionalRole=String(fd.get('professional_role')||'').trim(),work=String(fd.get('workplace')||'').trim(),comment=String(fd.get('comment')||'').trim();
      if(!professionalRole){throw Error('Indiquez votre métier ou votre poste.')}
      if(!work){throw Error('Indiquez votre établissement ou votre entreprise.')}
      if(!f){throw Error('Ajoutez votre planning.')}
      if(f.size>15*1024*1024)throw Error('Le planning dépasse 15 Mo.');
      let saved=pending(),prep;
      if(saved?.request_id&&saved?.tracking_token){
        prep=await post({action:'resume_page',request_id:saved.request_id,tracking_token:saved.tracking_token,file_name:f.name,file_size:f.size,file_type:mimeFor(f)});
      }else{
        prep=await post({action:'prepare_page',first_name:first,last_name:last,professional_role:professionalRole,workplace:work,comment:['Profil déclaré : autre profil',comment].filter(Boolean).join('\n'),requested_code:code,file_name:f.name,file_size:f.size,file_type:mimeFor(f)});
        saved={request_id:prep.request_id,tracking_token:prep.tracking_token};
        localStorage.setItem(PENDING,JSON.stringify(saved));
        localStorage.setItem(KEY,JSON.stringify({...saved,created_at:Date.now()}));
      }
      msg.textContent='Envoi du planning…';
      await signedUpload(prep.signed_url,f);
      msg.textContent='Finalisation…';
      await post({action:'complete_page',request_id:saved.request_id,tracking_token:saved.tracking_token});
      localStorage.removeItem(PENDING);
    }
    form.reset();planningInputs.forEach(input=>input.value='');if(planningName)planningName.textContent='';syncProfile();
    msg.textContent='Demande transmise.';msg.className='message success';notice({status:'pending',needs_code:false});
    setTimeout(()=>closeRequest(true),500);
  }catch(err){
    msg.textContent=err?.message||'Envoi impossible.';msg.className='message error';
  }finally{if(submit)submit.disabled=false}
});
const requested=document.getElementById('requestedAccessCode');
requested?.addEventListener('input',()=>{requested.value=requested.value.replace(/\D/g,'').slice(0,6)});
syncProfile();check();
if(location.hash==='#demande-acces')setTimeout(()=>openRequest(),0);
})();