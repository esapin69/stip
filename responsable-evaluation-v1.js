(()=>{'use strict';
const $=s=>document.querySelector(s),form=$('#evalForm'),status=$('#formStatus'),saveBtn=$('#saveBtn'),lastSaved=$('#lastSaved'),finalPanel=$('#finalPanel'),finalStatus=$('#finalStatus');
const P=new URLSearchParams(location.search),AGENT=P.get('agent')||'',CASE=P.get('case')||'',NOT='Éléments insuffisants pour évaluer';
const LEVELS=['Insuffisant','Médiocre','Passable','Assez bien','Bien','Très bien','Exceptionnel',NOT];
const GROUPS=[['I – Aptitude au service',['Aptitude à travailler sans contrôle','Efficacité','Esprit pratique','Souci de perfectionnement']],['II – Exécution du travail',["Rapidité d'exécution",'Qualité du travail',"Sens de l'organisation",'Initiative']],['III – Travail en commun',['Caractère','Relation avec le personnel infirmier','Contact avec les autres agents du service','Contact avec l’encadrement']],['IV – Comportement envers les malades',['Disponibilité','Discrétion','Attitude envers les visiteurs']],['V – Tenue, ponctualité, assiduité',['Utilisation du temps de travail','Attitude générale','Propreté dans la tenue','Régularité','Ponctualité / assiduité']]];
const OBS_KEYS=['Observations I — Aptitude au service','Observations II — Exécution du travail','Observations III — Travail en commun','Observations IV — Comportement envers les malades','Observations V — Tenue, ponctualité, assiduité','Observations générales'];
let state={live:null,previous:null,history:[],agent:null,signatureRequest:{statut:'AUCUNE'},remoteLink:'',compare:false,pads:{}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const target=()=>AGENT?{agent_id:AGENT}:{case_id:CASE};

function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}).format(new Date())}
function fr(v){if(!v)return'—';const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v)}
function msg(t,k=''){status.textContent=t||'';status.className='ev-status'+(k?' '+k:'')}
function friendly(e){
  const m=String(e?.message||e||'Erreur');
  if(m.includes('EVALUATION_INCOMPLETE'))return'Renseigne le grade, le service, la date et la conclusion Oui/Non.';
  if(m.includes('EVALUATION_VIDE'))return'L’évaluation est encore vide.';
  if(m.includes('SIGNATURE_RESPONSABLE_REQUISE'))return'La signature du responsable est obligatoire avant l’extraction.';
  if(m.includes('SIGNATURE_AGENT_EN_ATTENTE'))return'La signature de l’agent est encore en attente.';
  if(m.includes('EVALUATION_VERROUILLEE_SIGNATURE_AGENT'))return'L’évaluation est verrouillée par une demande de signature agent. Annule la demande pour la modifier.';
  if(m.includes('EVALUATION_VERROUILLEE_FINALISATION'))return'Une extraction est déjà en cours pour cette évaluation.';
  if(m.includes('SIGNATURE_AGENT_DEJA_RECUE'))return'La signature de l’agent est déjà reçue. Annule-la avant de créer une nouvelle demande.';
  return m;
}

function renderCriteria(){
  const root=$('#criteriaSections');
  root.innerHTML=GROUPS.map((g,gi)=>`<section class="ev-card"><div class="ev-section-title"><div><span class="ev-kicker">SECTION ${gi+1}</span><h2>${esc(g[0])}</h2></div><small>Non observé par défaut</small></div>${g[1].map((c,ci)=>`<div class="ev-criterion"><strong>${esc(c)}</strong><div class="ev-levels">${LEVELS.map((l,i)=>`<label><input type="radio" name="crit_${gi}_${ci}" value="${esc(l)}" ${i===LEVELS.length-1?'checked':''}><span data-criterion="${esc(c)}" data-level="${esc(l)}">${l===NOT?'Non observé':esc(l)}</span></label>`).join('')}</div></div>`).join('')}<label class="ev-observation">Observations<textarea name="observations_${gi+1}" rows="3" maxlength="180" placeholder="Faits observés, exemples ou commentaire (180 caractères max.)"></textarea></label><button type="button" class="ev-inspire" data-inspire="${gi}">Besoin d’inspiration ?</button><div class="ev-suggestions" data-suggestions="${gi}" hidden></div></section>`).join('');
  root.querySelectorAll('[data-inspire]').forEach(b=>b.onclick=()=>showGroupSuggestions(Number(b.dataset.inspire)));
}

function criteria(){
  const o={};
  GROUPS.forEach((g,gi)=>g[1].forEach((c,ci)=>o[c]=form.querySelector(`[name="crit_${gi}_${ci}"]:checked`)?.value||NOT));
  return o;
}
function observations(){
  return{
    [OBS_KEYS[0]]:form.observations_1.value,
    [OBS_KEYS[1]]:form.observations_2.value,
    [OBS_KEYS[2]]:form.observations_3.value,
    [OBS_KEYS[3]]:form.observations_4.value,
    [OBS_KEYS[4]]:form.observations_5.value,
    [OBS_KEYS[5]]:form.observations_generales.value
  };
}
function payload(withSignatures=false){
  const p={...target(),grade:form.grade.value,service:form.service.value,evaluation_date:form.date_evaluation.value,signature_date:form.lyon_le.value,decision:form.garder_agent.value||'',criteria:criteria(),observations:observations()};
  if(withSignatures)p.signatures=signaturePayload();
  return p;
}
function meaningful(){return Object.values(criteria()).some(v=>v!==NOT)||Object.values(observations()).some(v=>String(v||'').trim())}

function tone(level){if(['Exceptionnel','Très bien'].includes(level))return'point fort';if(['Bien','Assez bien'].includes(level))return'satisfaisant';if(level==='Passable')return'à consolider';if(['Médiocre','Insuffisant'].includes(level))return'à améliorer';return'non observé'}
function sentence(c,l){if(l===NOT)return`${c} : non observé sur la période.`;const t=tone(l);if(t==='point fort')return`${c} constitue un point fort dans les situations observées.`;if(t==='satisfaisant')return`${c} est satisfaisant dans les situations observées.`;if(t==='à consolider')return`${c} reste à consolider.`;return`${c} nécessite une amélioration.`}
function groupText(gi){
  const cr=criteria(),items=GROUPS[gi][1].map(c=>[c,cr[c]]),obs=items.filter(x=>x[1]!==NOT),no=items.filter(x=>x[1]===NOT);
  if(!obs.length)return'Les éléments de cette section n’ont pas été suffisamment observés pour permettre une appréciation.';
  const strong=obs.filter(x=>['Exceptionnel','Très bien','Bien'].includes(x[1])),weak=obs.filter(x=>['Passable','Médiocre','Insuffisant'].includes(x[1]));
  let parts=[];
  if(strong.length)parts.push(strong.slice(0,2).map(x=>sentence(x[0],x[1])).join(' '));
  if(weak.length)parts.push(weak.slice(0,2).map(x=>sentence(x[0],x[1])).join(' '));
  if(no.length&&obs.length<items.length)parts.push(`${no.length} critère${no.length>1?'s':''} non observé${no.length>1?'s':''}.`);
  return parts.join(' ').slice(0,180);
}
function showGroupSuggestions(gi){
  const box=document.querySelector(`[data-suggestions="${gi}"]`),txt=groupText(gi),short=txt.replace(/ dans les situations observées/g,'');
  box.hidden=false;
  box.innerHTML=`<button type="button">${esc(txt)}</button>${short!==txt?`<button type="button">${esc(short.slice(0,180))}</button>`:''}`;
  box.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{form.elements[`observations_${gi+1}`].value=(i?short:txt).slice(0,180);box.hidden=true});
}
function globalText(){
  const cr=criteria(),vals=Object.entries(cr).filter(([,v])=>v!==NOT),good=vals.filter(([,v])=>['Exceptionnel','Très bien','Bien'].includes(v)),mid=vals.filter(([,v])=>['Assez bien','Passable'].includes(v)),weak=vals.filter(([,v])=>['Médiocre','Insuffisant'].includes(v));
  let p=[];
  if(good.length)p.push(`L’évaluation met en évidence des points positifs, notamment ${good.slice(0,3).map(x=>x[0].toLowerCase()).join(', ')}.`);
  if(mid.length)p.push(`${mid.slice(0,2).map(x=>x[0]).join(' et ')} ${mid.length>1?'restent':'reste'} à consolider.`);
  if(weak.length)p.push(`Une vigilance est nécessaire concernant ${weak.slice(0,2).map(x=>x[0].toLowerCase()).join(' et ')}.`);
  if(!p.length)p.push('Les éléments renseignés ne permettent pas encore de dégager une synthèse suffisamment représentative.');
  return p.join(' ').slice(0,300);
}

function clearForm(){
  form.reset();
  form.service.value='PAM CARDIO';
  form.evaluateur.value=GHEAuth.user?.display_name||GHEBase.displayName(GHEAuth.user)||'';
  form.date_evaluation.value=today();
  form.lyon_le.value=today();
  GROUPS.forEach((g,gi)=>g[1].forEach((_,ci)=>{const x=[...form.querySelectorAll(`[name="crit_${gi}_${ci}"]`)].find(n=>n.value===NOT);if(x)x.checked=true}));
  clearPads();
  lastSaved.textContent='';
}
function fill(l){
  if(!l){clearForm();return}
  form.grade.value=l.grade||'';
  form.service.value=l.service||'PAM CARDIO';
  form.date_evaluation.value=l.evaluation_date||today();
  form.evaluateur.value=l.evaluator_name||GHEAuth.user?.display_name||'';
  form.lyon_le.value=l.signature_date||l.evaluation_date||today();
  if(l.decision){const r=form.querySelector(`[name="garder_agent"][value="${CSS.escape(l.decision)}"]`);if(r)r.checked=true}
  GROUPS.forEach((g,gi)=>g[1].forEach((c,ci)=>{const v=l.criteria?.[c]||NOT,x=[...form.querySelectorAll(`[name="crit_${gi}_${ci}"]`)].find(n=>n.value===v);if(x)x.checked=true}));
  for(let i=1;i<=5;i++)form.elements[`observations_${i}`].value=l.observations?.[OBS_KEYS[i-1]]||'';
  form.observations_generales.value=l.observations?.[OBS_KEYS[5]]||'';
  lastSaved.textContent=l.updated_at?`Dernier enregistrement : ${new Date(l.updated_at).toLocaleString('fr-FR')}`:'';
}

function renderHistory(){
  const card=$('#historyCard'),list=$('#historyList'),rows=state.history||[];
  card.hidden=!rows.length;
  if(!rows.length)return;
  $('#historyCount').textContent=`${rows.length} version${rows.length>1?'s':''}`;
  list.innerHTML=rows.map((h,i)=>`<article class="ev-history-row"><button type="button" class="ev-history-open" data-history="${i}"><span><strong>Version ${h.version||rows.length-i}</strong><small>${fr(h.evaluation_date)} · ${esc(h.evaluator_name||'Responsable')}</small></span><span>›</span></button><div class="ev-history-detail" data-history-detail="${i}" hidden></div></article>`).join('');
  list.querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>toggleHistory(Number(b.dataset.history)));
}
function toggleHistory(i){
  const h=state.history[i],box=document.querySelector(`[data-history-detail="${i}"]`);
  if(!h||!box)return;
  const opening=box.hidden;
  document.querySelectorAll('[data-history-detail]').forEach(x=>x.hidden=true);
  if(!opening)return;
  box.hidden=false;
  box.innerHTML=`<div class="ev-prev-meta">${esc(h.grade||'')} · ${esc(h.service||'')} · ${fr(h.evaluation_date)}</div>${GROUPS.flatMap(g=>g[1]).map(c=>`<div class="ev-prev-row"><span>${esc(c)}</span><strong>${esc(h.criteria?.[c]===NOT?'Non observé':h.criteria?.[c]||'Non observé')}</strong></div>`).join('')}<div class="ev-history-actions">${h.has_pdf?`<button type="button" class="ev-link-btn" data-official-pdf>Afficher le PDF officiel</button>`:''}</div>`;
  box.querySelector('[data-official-pdf]')?.addEventListener('click',()=>openOfficialPdf(h));
}
function renderCompare(){
  const p=state.previous,card=$('#compareCard');
  card.hidden=!p;
  if(!p){clearPreviousMarkers();return}
  $('#compareMeta').textContent=`Version ${p.version||1} · clôturée le ${new Date(p.closed_at).toLocaleDateString('fr-FR')} · ${p.evaluator_name||'Responsable'}`;
  paintCompareButton();
}
function clearPreviousMarkers(){document.querySelectorAll('.previous-choice').forEach(x=>x.classList.remove('previous-choice'));state.compare=false;paintCompareButton()}
function showPreviousMarkers(){
  document.querySelectorAll('.previous-choice').forEach(x=>x.classList.remove('previous-choice'));
  if(!state.previous)return;
  document.querySelectorAll('[data-criterion][data-level]').forEach(span=>{if(state.previous.criteria?.[span.dataset.criterion]===span.dataset.level)span.classList.add('previous-choice')});
  state.compare=true;
  paintCompareButton();
}
function paintCompareButton(){const b=$('#comparePrevious');if(!b)return;b.textContent=state.compare?'Masquer les anciens choix':'Afficher les anciens choix sur la grille';b.classList.toggle('active',state.compare)}

async function openOfficialPdf(h){
  const opened=window.open('about:blank','_blank');
  if(opened)opened.document.write('<title>Préparation…</title><p style="font-family:system-ui;padding:24px">Ouverture du PDF officiel…</p>');
  try{
    const r=await GHEBase.eva('official_pdf_link',{...target(),history_id:h.history_id||'',version:h.version||0});
    if(opened)opened.location.href=r.view_url;else window.open(r.view_url,'_blank','noopener');
  }catch(e){if(opened)opened.close();msg(friendly(e),'error')}
}
function pdfBlob(base64){
  const bin=atob(String(base64||'')),a=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);
  return new Blob([a],{type:'application/pdf'});
}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function showFinalDelivery(base64,name){
  document.querySelector('.ev-delivery')?.remove();
  const blob=pdfBlob(base64),box=document.createElement('div');box.className='ev-delivery';
  box.innerHTML=`<strong>PDF officiel prêt</strong><div class="ev-delivery-actions"><button type="button" class="ev-link-btn" data-delivery="view">Afficher</button><button type="button" class="ev-link-btn" data-delivery="download">Télécharger</button><button type="button" class="ev-link-btn" data-delivery="share">Partager</button></div>`;
  box.querySelector('[data-delivery="view"]').onclick=()=>{const url=URL.createObjectURL(blob);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),120000)};
  box.querySelector('[data-delivery="download"]').onclick=()=>downloadBlob(blob,name);
  box.querySelector('[data-delivery="share"]').onclick=async()=>{
    const file=new File([blob],name,{type:'application/pdf'});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({files:[file],title:'Évaluation officielle STIP'});
    else downloadBlob(blob,name);
  };
  status.after(box);
}

function setupPads(){
  document.querySelectorAll('.ev-signature-pad').forEach(box=>{
    const name=box.dataset.signature,canvas=box.querySelector('canvas'),ctx=canvas.getContext('2d'),pad={canvas,ctx,signed:false,drawing:false};
    state.pads[name]=pad;
    pad.resize=()=>{
      const rect=canvas.getBoundingClientRect();if(!rect.width)return;
      const ratio=Math.max(1,window.devicePixelRatio||1),height=rect.height||140,snapshot=pad.signed?canvas.toDataURL('image/png'):'';
      canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(height*ratio);
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#17232d';
      if(snapshot){const im=new Image();im.onload=()=>ctx.drawImage(im,0,0,rect.width,height);im.src=snapshot}
    };
    const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
    canvas.addEventListener('pointerdown',e=>{if(name==='agent'&&['EN_ATTENTE','SIGNE'].includes(state.signatureRequest?.statut))return;e.preventDefault();pad.drawing=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y)});
    canvas.addEventListener('pointermove',e=>{if(!pad.drawing)return;e.preventDefault();const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();pad.signed=true});
    canvas.addEventListener('pointerup',()=>pad.drawing=false);
    canvas.addEventListener('pointercancel',()=>pad.drawing=false);
    box.querySelector('.ev-signature-clear').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);pad.signed=false};
    requestAnimationFrame(pad.resize);
  });
  window.addEventListener('resize',()=>Object.values(state.pads).forEach(p=>p.resize()));
}
function clearPads(){Object.values(state.pads).forEach(p=>{p.ctx.clearRect(0,0,p.canvas.width,p.canvas.height);p.signed=false})}
function signaturePayload(){return Object.fromEntries(Object.entries(state.pads).filter(([,p])=>p.signed).map(([k,p])=>[k,p.canvas.toDataURL('image/png')]))}
function setSignatureNames(){
  const agentName=state.agent?(window.STIPName?.format?.(state.agent)||GHEBase.displayName(state.agent)):'';
  document.querySelector('[data-signature-person="agent"]').textContent=agentName?`Nom : ${agentName}`:'Nom : —';
  document.querySelector('[data-signature-person="responsable"]').textContent=`Nom : ${GHEAuth.user?.display_name||GHEBase.displayName(GHEAuth.user)||'—'}`;
  document.querySelector('[data-signature-person="direction"]').textContent='Nom : —';
}

function remoteText(r){
  const s=r?.statut||'AUCUNE';
  if(s==='EN_ATTENTE')return`En attente de la signature de l’agent${r.expire_le?' · lien valable jusqu’au '+new Date(r.expire_le).toLocaleString('fr-FR'):''}.`;
  if(s==='SIGNE')return`Signature reçue${r.signe_le?' le '+new Date(r.signe_le).toLocaleString('fr-FR'):''}. Elle sera intégrée au PDF officiel.`;
  if(s==='FINALISE')return'Signature agent intégrée à la dernière version officielle.';
  if(s==='EXPIRE')return'Le lien de signature a expiré.';
  if(s==='ANNULE')return'La demande a été annulée.';
  return'Aucune demande active.';
}
function applyRemote(){
  const r=state.signatureRequest||{statut:'AUCUNE'},s=r.statut||'AUCUNE',locked=['EN_ATTENTE','SIGNE'].includes(s);
  form.classList.toggle('remote-locked',locked);
  $('#remoteStatus').textContent=remoteText(r);
  $('#remoteStatus').className='ev-remote-status '+(s==='SIGNE'?'signed':s==='EN_ATTENTE'?'wait':'');
  $('#remoteRequest').hidden=s==='SIGNE'||s==='FINALISE';
  $('#remoteRequest').textContent=s==='EN_ATTENTE'?'Générer un nouveau lien':'Demander la signature par SMS';
  $('#remoteSms').hidden=!state.remoteLink;
  $('#remoteCopy').hidden=!state.remoteLink;
  $('#remoteRefresh').hidden=!['EN_ATTENTE','SIGNE'].includes(s);
  $('#remoteCancel').hidden=!['EN_ATTENTE','SIGNE'].includes(s);
  saveBtn.disabled=locked;
  $('#finalizeOpen').disabled=s==='EN_ATTENTE';
  document.querySelector('[data-signature="agent"]').classList.toggle('remote-agent',locked);
}
function configureSms(link){
  const phone=String(state.agent?.telephone||'').replace(/[^+0-9]/g,''),name=String(state.agent?.prenom||'').trim(),a=$('#remoteSms');
  const body=`Bonjour${name?' '+name:''}, peux-tu relire et signer ton évaluation via ce lien sécurisé : ${link}`;
  const sep=/iPad|iPhone|iPod/i.test(navigator.userAgent)?'&':'?';
  a.href=phone?`sms:${encodeURIComponent(phone)}${sep}body=${encodeURIComponent(body)}`:`sms:${sep}body=${encodeURIComponent(body)}`;
  a.hidden=false;
}
async function requestRemote(){
  const b=$('#remoteRequest');b.disabled=true;
  try{
    await save(true);
    const r=await GHEBase.eva('signature_request',target());
    state.signatureRequest=r.request||{statut:'EN_ATTENTE'};
    state.remoteLink=r.request?.signature_url||'';
    if(state.remoteLink)configureSms(state.remoteLink);
    applyRemote();
    msg('Lien sécurisé créé. L’évaluation est maintenant verrouillée pour l’agent.','ok');
  }catch(e){msg(friendly(e),'error')}
  finally{b.disabled=false}
}
async function refreshRemote(){
  try{const r=await GHEBase.eva('signature_status',target());state.signatureRequest=r.request||{statut:'AUCUNE'};applyRemote()}
  catch(e){msg(friendly(e),'error')}
}
async function cancelRemote(){
  if(!confirm('Annuler la demande de signature ? L’évaluation redeviendra modifiable.'))return;
  try{const r=await GHEBase.eva('signature_cancel',target());state.signatureRequest=r.request||{statut:'ANNULE'};state.remoteLink='';applyRemote();msg('Demande annulée.','ok')}
  catch(e){msg(friendly(e),'error')}
}

async function refresh(){
  const r=await GHEBase.eva('state',target());
  state.live=r.live||null;state.previous=r.previous||null;state.history=r.history||[];state.signatureRequest=r.signature_request||{statut:'AUCUNE'};
  fill(state.live);renderHistory();renderCompare();applyRemote();
  $('#evalState').textContent=state.live?'Évaluation ouverte':'Nouvelle évaluation';
  return r;
}
async function save(silent=false){
  saveBtn.disabled=true;
  try{
    const r=await GHEBase.eva('save_live',payload(false));
    state.live=r.live;fill(r.live);
    if(!silent)msg('Enregistré dans Supabase. Aucun fichier Drive créé.','ok');
    return r.live;
  }finally{applyRemote()}
}
function validateFinal(){
  if(!form.grade.value||!form.service.value||!form.date_evaluation.value||!form.garder_agent.value){msg('Complète le grade, le service, la date et la conclusion Oui/Non.','error');return false}
  if(!meaningful()){msg('Renseigne au moins un critère ou une observation.','error');return false}
  if(!state.pads.responsable?.signed){msg('La signature du responsable est obligatoire avant l’extraction.','error');document.querySelector('[data-signature="responsable"]')?.scrollIntoView({behavior:'smooth',block:'center'});return false}
  return true;
}
async function openFinal(){
  if(!validateFinal())return;
  try{
    msg('Enregistrement et contrôle…');
    await save(true);
    const r=await GHEBase.eva('prepare_finalize',target()),s=r.summary;
    $('#finalSummary').innerHTML=`<div><strong>${s.observed}</strong><span>critères observés</span></div><div><strong>${s.not_observed}</strong><span>non observés</span></div><div><strong>${s.total}</strong><span>au total</span></div>`;
    $('#confirmFinal').checked=false;
    finalPanel.hidden=false;document.body.classList.add('ev-modal-open');finalStatus.textContent='';
    msg('Évaluation prête à être extraite.','ok');
  }catch(e){msg(friendly(e),'error')}
}
function closeFinal(){finalPanel.hidden=true;document.body.classList.remove('ev-modal-open')}
async function finalize(){
  const b=$('#finalPrint');
  if(!$('#confirmFinal').checked){finalStatus.textContent='Confirme la relecture avant l’extraction.';return}
  if(!validateFinal()){closeFinal();return}
  b.disabled=true;finalStatus.textContent='Génération et archivage sécurisé du PDF…';
  try{
    const r=await GHEBase.eva('finalize',payload(true)),delivery=r.delivery||{},closed=r.closed||{};
    const base64=r.pdf_base64||'',name=delivery.name||closed.pdf_name||'Evaluation-officielle.pdf';
    closeFinal();state.remoteLink='';clearForm();await refresh();
    msg(`Version ${closed.version||''} figée dans STIP.`,'ok');
    if(base64)showFinalDelivery(base64,name);
  }catch(e){finalStatus.textContent=friendly(e)}
  finally{b.disabled=false}
}

async function boot(){
  renderCriteria();setupPads();
  $('[data-inspire-global]').onclick=()=>{const box=$('[data-global-suggestions]'),txt=globalText();box.hidden=false;box.innerHTML=`<button type="button">${esc(txt)}</button>`;box.querySelector('button').onclick=()=>{form.observations_generales.value=txt;box.hidden=true}};
  $('#comparePrevious').onclick=()=>state.compare?clearPreviousMarkers():showPreviousMarkers();
  $('#remoteRequest').onclick=requestRemote;
  $('#remoteRefresh').onclick=refreshRemote;
  $('#remoteCancel').onclick=cancelRemote;
  $('#remoteCopy').onclick=async()=>{if(state.remoteLink){await navigator.clipboard.writeText(state.remoteLink);$('#remoteStatus').textContent='Lien copié.'}};
  try{
    await GHEAuth.ready;
    state.agent=await AgentContext.load();
    setSignatureNames();clearForm();await refresh();
    msg(state.live?'Évaluation ouverte reprise automatiquement.':'Nouvelle évaluation prête.','ok');
  }catch(e){msg(friendly(e),'error')}
}
form.addEventListener('submit',async e=>{e.preventDefault();try{msg('Enregistrement…');await save()}catch(err){msg(friendly(err),'error')}});
$('#finalizeOpen').onclick=openFinal;
$('#finalClose').onclick=closeFinal;
$('#finalPrint').onclick=finalize;
finalPanel.addEventListener('click',e=>{if(e.target===finalPanel)closeFinal()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&['EN_ATTENTE','SIGNE'].includes(state.signatureRequest?.statut))refreshRemote()});
boot();
})();