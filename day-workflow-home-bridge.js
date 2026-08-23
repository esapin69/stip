(()=>{'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-change',STORE='stip_session_v1';
const published={exchange:new Set(),retain:new Set(),timeline:new Set()};
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}).format(new Date())}
function fmt(d){try{return new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}catch{return String(d||'')}}
function typeLabel(x){return x.request_type==='exchange'?'Échange':x.request_type==='absence'?'Absence':x.request_type==='delay'?'Retard':'Changement'}
function statusLabel(x){if(x.status==='awaiting_colleague')return'En attente du collègue';if(x.status==='awaiting_responsible')return x.official_state==='mail_required'?'Action requise':x.official_state==='sent_waiting'?'En attente de réponse':'En attente du responsable';if(x.status==='completed')return x.acknowledged_at?'Classé':'Changement effectué';if(x.status==='refused'||x.status==='target_refused')return'Refusé';if(x.status==='cancelled')return'Annulé';return x.status||'En cours'}
function closed(x){return ['refused','target_refused','cancelled'].includes(String(x.status||''))||!!x.acknowledged_at}
async function call(){const token=localStorage.getItem(STORE)||'';if(!token)return[];const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify({action:'history'})});if(!r.ok)return[];const j=await r.json().catch(()=>({}));return j.items||[]}
function syncSet(kind,next){const api=kind==='exchange'?window.STIPExchange:kind==='retain'?window.STIPRetain:window.STIPTimeline;if(!api?.remove)return;for(const id of published[kind])if(!next.has(id))api.remove(id);published[kind]=next}
function publish(rows){if(!window.STIPExchange||!window.STIPRetain||!window.STIPTimeline)return;
 const ex=new Set(),rt=new Set(),tl=new Set();
 for(const x of rows){const id=String(x.id||'');if(!id)continue;const label=typeLabel(x),date=String(x.date_from||'').slice(0,10),status=statusLabel(x);
  if((x.request_type==='exchange'||x.request_type==='change'||x.scenario==='simple_change')&&!closed(x)){
   const k='dw-ex:'+id;ex.add(k);window.STIPExchange.publish({id:k,icon:'⇄',title:`${label}${date?' · '+fmt(date):''}`,lead:status,meta:[x.requester_code,x.context?.target_shift||x.desired_code].filter(Boolean).join(' → '),href:'change',priority:x.official_state==='mail_required'?85:60,source:'day-workflow'});
  }
  if(x.official_state==='mail_required'&&!x.acknowledged_at){const k='dw-action-mail:'+id;rt.add(k);window.STIPRetain.publish({id:k,icon:'✉️',title:`Envoyer la demande à ${x.routed_name||'la personne indiquée'}`,lead:date?`${label} du ${fmt(date)}`:label,meta:'Action requise',href:x.request_type==='exchange'?'change':'personal',priority:95,source:'day-workflow'});}
  if(x.status==='completed'&&!x.acknowledged_at){const k='dw-action-ok:'+id;rt.add(k);window.STIPRetain.publish({id:k,icon:'✓',title:'Changement effectué',lead:date?`Confirme la prise en compte du ${fmt(date)}`:'Confirme la prise en compte',meta:'Action requise',href:'personal',priority:100,source:'day-workflow'});}
  const a=x.context?.analysis||x.analysis;if(a?.level==='risk'&&!closed(x)){const k='dw-risk:'+id;rt.add(k);window.STIPRetain.publish({id:k,icon:'⚠️',title:'Couverture à surveiller',lead:a.message||'Cette démarche peut tendre l’effectif.',meta:date?fmt(date):'',href:'personal',priority:90,source:'day-workflow'});}
  if(x.status==='completed'&&date&&date>=today()&&(x.request_type==='exchange'||x.request_type==='change'||x.scenario==='simple_change')){const k='dw-date:'+id;tl.add(k);window.STIPTimeline.publish({id:k,date,icon:'⇄',type:'Planning',title:'Changement de planning prévu',meta:[x.requester_code,x.context?.target_shift||x.desired_code].filter(Boolean).join(' → '),href:'personal',priority:50,source:'day-workflow'});}
 }
 syncSet('exchange',ex);syncSet('retain',rt);syncSet('timeline',tl);
}
async function refresh(){try{publish(await call())}catch{}}
function removeLegacy(){document.querySelector('#dwHomeActions')?.remove()}
new MutationObserver(removeLegacy).observe(document.documentElement,{childList:true,subtree:true});
['stip:session-ready','stip:boot-updated'].forEach(e=>window.addEventListener(e,()=>setTimeout(refresh,120)));window.addEventListener('stip:route',e=>{removeLegacy();if(e.detail?.route==='home')setTimeout(refresh,80)});window.addEventListener('focus',()=>setTimeout(refresh,80));
setInterval(()=>{if(!document.hidden)refresh()},60000);setTimeout(()=>{removeLegacy();refresh()},350);
})();