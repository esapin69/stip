(() => {
'use strict';

const DATA_API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data';
const CAL_API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-calendar';
const STORAGE='stip_session_v1';
const PLANNING_SITE='https://planning.esapin.com';
const SHIFT_ORDER=['M','J','J4','S','N','RH'];
const SHIFT={
  M:{label:'Matin',time:'06:50–14:40',tone:'m'},
  J:{label:'Journée',time:'08:30–16:20',tone:'j'},
  J4:{label:'J4',time:'10:10–18:00',tone:'j4'},
  S:{label:'Soir',time:'13:30–21:00',tone:'s'},
  N:{label:'Nuit',time:'21:00–06:50',tone:'n'},
  RH:{label:'Repos',time:'',tone:'rh'}
};
const token=()=>localStorage.getItem(STORAGE)||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const fmtLong=d=>new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
const fmtShort=d=>new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
const personName=a=>[a?.prenom,a?.nom].filter(Boolean).join(' ').trim()||String(a?.nom||a?.source_key||'Agent').replace(/_/g,' ');

async function callData(action,body={}){
  const r=await fetch(DATA_API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token()},body:JSON.stringify({action,...body})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.error) throw new Error(j.error||`Erreur ${r.status}`);
  return j;
}
async function callCalendar(kind){
  const r=await fetch(CAL_API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token()},body:JSON.stringify({kind})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.error) throw new Error(j.error||'Calendrier indisponible');
  return j;
}
function root(){return document.getElementById('planningWorkspace')}
function openWorkspace(title,sub=''){
  const el=root(); if(!el)return null;
  el.classList.remove('hidden');
  el.innerHTML=`<div class="pu-shell"><header class="pu-head"><p>PLANNING GHE</p><h2>${esc(title)}</h2>${sub?`<span>${esc(sub)}</span>`:''}</header><div id="puBody"><div class="pu-loading">Chargement…</div></div></div>`;
  el.scrollIntoView({behavior:'smooth',block:'start'});
  return document.getElementById('puBody');
}
function medal(code){
  const c=String(code||'—').toUpperCase();
  return `<span class="pu-medal pu-${esc((SHIFT[c]?.tone||'neutral'))}">${esc(c)}</span>`;
}

async function openOfficialDrive(){
  const body=openWorkspace('Planning officiel','Ouverture de la source officielle Drive.');
  try{
    const r=await callData('official');
    const team=String(r.team||'').toLowerCase();
    let type='jour';
    if(team.includes('nuit')) type='nuit';
    else if(team.includes('chef')) type='chef';
    location.href=`${PLANNING_SITE}/mois.html?type=${type}`;
  }catch(e){
    if(body) body.innerHTML=`<div class="pu-error">${esc(e.message)}</div><a class="pu-primary-link" href="${PLANNING_SITE}/mois.html?type=jour">Ouvrir le planning officiel</a>`;
  }
}

async function subscribePersonal(platform){
  try{
    const r=await callCalendar('personal');
    if(platform==='ios'){location.href=r.webcal_url;return;}
    const el=document.getElementById('puCalendarHelp');
    if(el){el.innerHTML=`<strong>Google Agenda / Android</strong><span>Copie ce lien permanent dans Google Agenda → Autres agendas → À partir de l’URL.</span><input id="puCalendarUrl" readonly value="${esc(r.https_url||'')}"><button id="puCopyCalendar" type="button">Copier le lien</button>`;document.getElementById('puCopyCalendar').onclick=async()=>{await navigator.clipboard.writeText(r.https_url||'');document.getElementById('puCopyCalendar').textContent='Lien copié';}}
  }catch(e){alert(e.message)}
}
async function openPersonal(prepPrint=false){
  const body=openWorkspace(prepPrint?'Planning individuel · impression':'Planning individuel','Présentation identique au planning GHE, alimentée par STIP.');
  try{
    const [p,b]=await Promise.all([callData('personal'),callData('bootstrap')]);
    const items=p.items||b.personal||[];
    const contact=p.agent||b.agent||{};
    const media=p.media||b.media||{};
    const visual=window.STIPPlanningVisual?.render;
    body.innerHTML=`<div class="pu-actions">${prepPrint?'<button id="puPrint" type="button">Imprimer / PDF</button>':'<button id="puIos" type="button"> Apple</button><button id="puAndroid" class="secondary" type="button">Android / Google Agenda</button>'}</div><div id="puCalendarHelp" class="pu-calendar-help"></div><div id="puPersonalVisual">${visual?visual({contact,items,media}):'<div class="pu-error">Affichage planning indisponible.</div>'}</div>`;
    if(prepPrint){document.getElementById('puPrint').onclick=()=>window.print();}
    else{document.getElementById('puIos').onclick=()=>subscribePersonal('ios');document.getElementById('puAndroid').onclick=()=>subscribePersonal('android');}
  }catch(e){body.innerHTML=`<div class="pu-error">${esc(e.message)}</div>`}
}

let changeState={date:'',current:'',desired:'',candidate:null,personal:[],spirit:null,agents:[],history:[]};
function normalizeCode(c){const x=String(c||'').toUpperCase();return ['RTT','RTTA','RTA','RC','RF','CA','AA','MA','SYR'].includes(x)?'RH':x;}
function desiredFor(current){if(current==='N')return ['N'];return ['M','J','J4','S','RH'].filter(x=>x!==current)}
function rowsOn(date){return (changeState.spirit?.planning||[]).filter(x=>x.date===date)}
function candidateRows(code){
  const wanted=normalizeCode(code);
  return rowsOn(changeState.date).filter(x=>normalizeCode(x.code)===wanted);
}
function resolveAgent(row){
  const a=row.agents||{};
  const source=a.source_key||row.agent_source_key||'';
  const full=changeState.agents.find(x=>x.id===a.id||x.source_key===source)||a;
  return full;
}
function renderDays(){
  const future=changeState.personal.filter(x=>x.date>=today()).slice(0,100);
  if(!future.length)return '<div class="pu-empty">Aucun jour futur dans ton planning.</div>';
  return `<div class="pu-day-grid">${future.map(x=>{const c=normalizeCode(x.code),s=SHIFT[c]||{label:c,time:'',tone:'neutral'};return `<button class="pu-day ${x.date===changeState.date?'selected':''}" type="button" data-pu-date="${esc(x.date)}"><span class="pu-day-date"><strong>${esc(fmtShort(x.date))}</strong><small>${esc(x.date)}</small></span>${medal(c)}<span class="pu-day-shift"><strong>${esc(s.label)}</strong><small>${esc(s.time)}</small></span></button>`}).join('')}</div>`;
}
function renderDesired(){
  if(!changeState.date)return '';
  return `<section class="pu-step"><p class="pu-step-kicker">2 · CHOISIS L’HORAIRE SOUHAITÉ</p><div class="pu-current"><span>Ton horaire actuel</span>${medal(changeState.current)}<strong>${esc(SHIFT[changeState.current]?.label||changeState.current)}</strong><small>${esc(SHIFT[changeState.current]?.time||'')}</small></div><div class="pu-shift-grid">${desiredFor(changeState.current).map(code=>{const list=candidateRows(code),s=SHIFT[code];return `<button type="button" class="pu-shift-choice ${changeState.desired===code?'selected':''}" data-pu-shift="${code}">${medal(code)}<strong>${esc(s.label)}</strong><small>${esc(s.time)}</small><span>${list.length} collègue${list.length>1?'s':''}</span></button>`}).join('')}</div></section>`;
}
function renderCandidates(){
  if(!changeState.desired)return '';
  const rows=candidateRows(changeState.desired);
  const unique=[];const seen=new Set();
  for(const row of rows){const a=resolveAgent(row),key=a.id||a.source_key||personName(a);if(!key||seen.has(key))continue;seen.add(key);unique.push(a)}
  return `<section class="pu-step"><p class="pu-step-kicker">3 · CHOISIS UN COLLÈGUE</p><p class="pu-help">Les collègues correspondant à <strong>${esc(SHIFT[changeState.desired]?.label||changeState.desired)}</strong> sont affichés directement. Plus besoin de chercher dans toute l’équipe.</p><div class="pu-candidates">${unique.length?unique.map(a=>{const id=a.id||'',key=a.source_key||'',selected=changeState.candidate&&(changeState.candidate.id===id||changeState.candidate.source_key===key);return `<button type="button" class="pu-candidate ${selected?'selected':''}" data-pu-agent="${esc(id)}" data-pu-source="${esc(key)}"><span class="pu-avatar">${esc((personName(a).split(/\s+/).map(x=>x[0]).join('').slice(0,2)||'GHE').toUpperCase())}</span><span><strong>${esc(personName(a))}</strong><small>${esc(a.ghe?`GHE ${a.ghe}`:'')}</small></span><span class="pu-check">✓</span></button>`}).join(''):'<div class="pu-empty">Aucun collègue affiché sur cet horaire. Tu peux quand même envoyer une demande sans collègue précis.</div>'}</div><button id="puNoCandidate" class="pu-secondary-btn" type="button">Continuer sans collègue précis</button></section>`;
}
function renderSubmit(){
  if(!changeState.desired)return '';
  return `<section class="pu-step pu-submit"><p class="pu-step-kicker">4 · ENVOYER</p><label>Précision facultative<textarea id="puMessage" placeholder="Ajoute seulement ce qui est utile"></textarea></label><button id="puSendChange" class="pu-send" type="button">Envoyer la demande</button><p id="puChangeMsg"></p></section>`;
}
function renderHistory(){
  const rows=changeState.history||[];
  return `<details class="pu-history"><summary>Mes dernières demandes</summary>${rows.length?rows.slice(0,8).map(x=>`<div><strong>${esc(x.date_from||'Sans date')} · ${esc(x.desired_code||x.request_type||'Demande')}</strong><span>${esc(x.status||'')}</span></div>`).join(''):'<p>Aucune demande envoyée.</p>'}</details>`;
}
function renderChange(){
  const body=document.getElementById('puBody'); if(!body)return;
  body.innerHTML=`<section class="pu-step"><p class="pu-step-kicker">1 · CHOISIS TON JOUR</p>${renderDays()}</section>${renderDesired()}${renderCandidates()}${renderSubmit()}${renderHistory()}`;
  body.querySelectorAll('[data-pu-date]').forEach(b=>b.onclick=()=>{const row=changeState.personal.find(x=>x.date===b.dataset.puDate);changeState.date=b.dataset.puDate;changeState.current=normalizeCode(row?.code);changeState.desired='';changeState.candidate=null;renderChange();setTimeout(()=>document.querySelector('.pu-current')?.scrollIntoView({behavior:'smooth',block:'center'}),30)});
  body.querySelectorAll('[data-pu-shift]').forEach(b=>b.onclick=()=>{changeState.desired=b.dataset.puShift;changeState.candidate=null;renderChange();setTimeout(()=>document.querySelector('.pu-candidates')?.scrollIntoView({behavior:'smooth',block:'center'}),30)});
  body.querySelectorAll('[data-pu-agent]').forEach(b=>b.onclick=()=>{changeState.candidate=changeState.agents.find(a=>String(a.id)===String(b.dataset.puAgent)||a.source_key===b.dataset.puSource)||null;renderChange();setTimeout(()=>document.querySelector('.pu-submit')?.scrollIntoView({behavior:'smooth',block:'center'}),30)});
  const no=document.getElementById('puNoCandidate');if(no)no.onclick=()=>{changeState.candidate=null;document.querySelector('.pu-submit')?.scrollIntoView({behavior:'smooth',block:'center'})};
  const send=document.getElementById('puSendChange');if(send)send.onclick=submitChange;
}
async function submitChange(){
  const btn=document.getElementById('puSendChange'),msg=document.getElementById('puChangeMsg');
  if(!changeState.date||!changeState.desired)return;
  btn.disabled=true;msg.textContent='Envoi…';
  try{
    await callData('change_submit',{request_type:changeState.candidate?'exchange':'change',date_from:changeState.date,requester_code:changeState.current,desired_code:changeState.desired,target_agent_id:changeState.candidate?.id||null,message:document.getElementById('puMessage')?.value||''});
    msg.className='pu-success';msg.textContent='Demande enregistrée dans STIP.';btn.textContent='Demande envoyée';
  }catch(e){btn.disabled=false;msg.className='pu-error-text';msg.textContent=e.message}
}
async function openChange(){
  const body=openWorkspace('Demande de changement','Jour → horaire → collègue. Tout est visible sans recherche inutile.');
  try{
    const [b,s,a,h]=await Promise.all([callData('bootstrap'),callData('spirit'),callData('agents'),callData('change_history')]);
    changeState={date:'',current:'',desired:'',candidate:null,personal:b.personal||[],spirit:s,agents:a.items||[],history:h.items||[]};
    renderChange();
  }catch(e){body.innerHTML=`<div class="pu-error">${esc(e.message)}</div>`}
}

function capture(e){
  const b=e.target.closest('[data-planning]'); if(!b)return;
  const k=b.dataset.planning;
  if(!['official','personal','print','change'].includes(k))return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  if(k==='official')openOfficialDrive();
  if(k==='personal')openPersonal(false);
  if(k==='print')openPersonal(true);
  if(k==='change')openChange();
}
document.addEventListener('click',capture,true);

const style=document.createElement('style');
style.textContent=`
.pu-shell{--navy:#07163f;--paper:#fffaf0;--cream:#fff7df;--gold:#e1b840;color:var(--navy);background:repeating-linear-gradient(-6deg,rgba(7,22,63,.028) 0 1px,transparent 1px 12px),linear-gradient(180deg,#fffaf0,#fff1bf);border:3px solid var(--navy);border-radius:28px;padding:14px;box-shadow:0 9px 0 rgba(7,22,63,.12)}
.pu-head{padding:4px 4px 10px;text-align:center}.pu-head p,.pu-step-kicker{margin:0 0 5px;font-size:.74rem;font-weight:1000;letter-spacing:.13em;color:#8b6718}.pu-head h2{margin:0;font-size:clamp(1.8rem,6vw,3rem);line-height:.95;text-transform:uppercase}.pu-head span{display:block;margin-top:6px;color:#667085;font-weight:800}.pu-loading,.pu-error,.pu-empty{padding:18px;border:2px dashed #c8b66f;border-radius:18px;background:rgba(255,255,255,.7);text-align:center;font-weight:850}.pu-error{border-color:#ef9a9a;color:#991b1b}.pu-primary-link{display:block;margin-top:12px;padding:14px;border-radius:18px;background:var(--navy);color:#fff;text-align:center;font-weight:950;text-decoration:none}.pu-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.pu-actions button,.pu-secondary-btn{min-height:50px;border:3px solid var(--navy);border-radius:18px;background:var(--navy);color:#fff;font-weight:950}.pu-actions .secondary,.pu-secondary-btn{background:#fff;color:var(--navy)}.pu-calendar-help{display:grid;gap:8px;margin-bottom:12px}.pu-calendar-help:empty{display:none}.pu-calendar-help input{width:100%;padding:10px;border:2px solid var(--navy);border-radius:12px}.pu-calendar-help button{padding:10px;border:0;border-radius:12px;background:var(--navy);color:#fff;font-weight:900}.pu-step{margin:12px 0;padding:13px;border:3px solid var(--navy);border-radius:23px;background:rgba(255,250,240,.93)}.pu-day-grid{display:grid;gap:9px}.pu-day{display:grid;grid-template-columns:minmax(0,1fr) 64px minmax(105px,1fr);align-items:center;gap:10px;width:100%;padding:8px 10px;border:3px solid var(--navy);border-radius:19px;background:#fff;color:var(--navy);text-align:left}.pu-day.selected{border-color:#18864b;background:#ecfdf3;box-shadow:0 0 0 4px rgba(24,134,75,.12)}.pu-day-date{display:grid}.pu-day-date strong{text-transform:uppercase;font-size:1.02rem}.pu-day-date small{color:#7b8190}.pu-day-shift{display:grid}.pu-day-shift strong{font-size:1rem}.pu-day-shift small{color:#687086}.pu-medal{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;border:4px solid rgba(7,22,63,.72);box-shadow:inset 0 0 0 4px rgba(255,255,255,.3),0 5px 0 rgba(7,22,63,.13);font-size:1.45rem;font-weight:1000;color:#fff}.pu-m{background:linear-gradient(145deg,#63a7ff,#1f6df2 56%,#1744b7)}.pu-j{background:linear-gradient(145deg,#79dc55,#36a52e 56%,#187826)}.pu-j4{background:linear-gradient(145deg,#ffb257,#ff7613 56%,#c84b00)}.pu-s{background:linear-gradient(145deg,#ffe45e,#f7bf00 56%,#c98b00);color:var(--navy)}.pu-n{background:linear-gradient(145deg,#6553c6,#24115f)}.pu-rh{background:linear-gradient(145deg,#cbd5e1,#8491a5 56%,#586579)}.pu-neutral{background:#7b8798}.pu-current{display:grid;grid-template-columns:auto 66px 1fr;align-items:center;gap:10px;margin-bottom:12px;padding:10px;border:3px solid var(--navy);border-radius:19px;background:#fff}.pu-current>span{grid-column:1/-1;font-size:.8rem;font-weight:900;color:#667085}.pu-current>strong{font-size:1.12rem}.pu-current>small{grid-column:3;color:#687086}.pu-shift-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.pu-shift-choice{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;min-height:154px;padding:10px;border:4px solid var(--navy);border-radius:22px;background:#fffaf0;color:var(--navy);box-shadow:0 5px 0 rgba(7,22,63,.13)}.pu-shift-choice.selected{background:#fff2bf;box-shadow:0 5px 0 rgba(7,22,63,.18),0 0 0 4px rgba(225,184,64,.32)}.pu-shift-choice strong{font-size:1.1rem}.pu-shift-choice small{color:#687086}.pu-shift-choice>span:last-child{margin-top:auto;padding:4px 8px;border-radius:999px;background:#eef2f6;font-size:.76rem;font-weight:900}.pu-help{margin:0 0 10px;color:#667085;font-weight:750;line-height:1.35}.pu-candidates{display:grid;gap:8px}.pu-candidate{display:grid;grid-template-columns:46px 1fr 28px;align-items:center;gap:10px;width:100%;padding:9px;border:3px solid var(--navy);border-radius:18px;background:#fff;color:var(--navy);text-align:left}.pu-candidate.selected{border-color:#18864b;background:#ecfdf3}.pu-avatar{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#eef3f7;font-size:.8rem;font-weight:1000}.pu-candidate span:nth-child(2){display:grid}.pu-candidate small{color:#687086}.pu-check{opacity:0;width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:#18864b;color:#fff}.pu-candidate.selected .pu-check{opacity:1}.pu-secondary-btn{width:100%;margin-top:9px}.pu-submit label{display:grid;gap:6px;font-weight:900}.pu-submit textarea{min-height:84px;width:100%;padding:11px;border:3px solid var(--navy);border-radius:16px;font:inherit}.pu-send{width:100%;min-height:56px;margin-top:10px;border:3px solid var(--navy);border-radius:18px;background:var(--navy);color:#fff;font-size:1rem;font-weight:1000}.pu-send:disabled{opacity:.55}.pu-success{padding:10px;border-radius:12px;background:#ecfdf3;color:#166534;font-weight:900}.pu-error-text{color:#991b1b;font-weight:900}.pu-history{margin-top:12px;padding:10px;border:2px solid rgba(7,22,63,.25);border-radius:16px;background:rgba(255,255,255,.5)}.pu-history summary{cursor:pointer;font-weight:950}.pu-history div{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid rgba(7,22,63,.1)}.pu-history span{color:#687086}
/* Esprit d'équipe : même langage visuel que Planning GHE, plus compact et lisible */
.ste-shell{background:repeating-linear-gradient(-6deg,rgba(7,22,63,.028) 0 1px,transparent 1px 12px),linear-gradient(180deg,#fffaf0,#fff1bf)!important;border:3px solid #07163f!important;border-radius:28px!important;padding:12px!important}.ste-hero{max-height:210px}.ste-hero img{height:210px!important}.ste-week{position:sticky;top:6px;z-index:8;background:rgba(255,250,240,.97)!important;backdrop-filter:blur(8px)}.ste-stats{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.ste-stat{min-height:64px!important;border:3px solid #07163f!important;border-radius:18px!important}.ste-shift-card{border:3px solid #07163f!important;border-radius:22px!important;box-shadow:0 6px 0 rgba(7,22,63,.12)!important}.ste-agent-row{border-radius:14px!important}.ste-section-title{text-align:center!important;letter-spacing:.06em!important}.ste-calendar{border:3px solid #07163f!important;border-radius:22px!important}
@media(max-width:560px){.pu-shell{padding:9px}.pu-step{padding:10px}.pu-day{grid-template-columns:minmax(0,1fr) 56px minmax(90px,1fr);gap:7px;padding:7px}.pu-medal{width:52px;height:52px;font-size:1.25rem}.pu-day-date strong{font-size:.9rem}.pu-day-shift strong{font-size:.92rem}.pu-shift-choice{min-height:142px;padding:8px}.pu-current{grid-template-columns:auto 58px 1fr}.pu-actions{grid-template-columns:1fr}.ste-hero{display:none!important}.ste-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media print{body *{visibility:hidden!important}#planningWorkspace,#planningWorkspace *{visibility:visible!important}#planningWorkspace{position:absolute!important;inset:0!important}.topbar,.planning-menu,.pu-actions{display:none!important}.pu-shell{border:0!important;box-shadow:none!important;background:#fff!important}}
`;
document.head.appendChild(style);
})();