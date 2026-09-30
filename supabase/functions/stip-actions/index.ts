import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const URL=Deno.env.get('SUPABASE_URL')!, SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, RESEND_API_KEY=Deno.env.get('RESEND_API_KEY')||'', STIP_MAIL_FROM=Deno.env.get('STIP_MAIL_FROM')||''
const db=createClient(URL,SERVICE,{auth:{persistSession:false}})
const ORIGINS=new Set(['https://stip.esapin.com','https://esapin69.github.io'])
const BUCKET='stip-onboarding-documents'
const text=(v:unknown,m=8000)=>String(v??'').trim().slice(0,m)
async function sha(v:string){const a=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function shaBytes(b:Uint8Array){const a=await crypto.subtle.digest('SHA-256',b);return[...new Uint8Array(a)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function errText(e:unknown){if(e instanceof Error)return e.message;if(e&&typeof e==='object'&&'message' in e)return String((e as any).message);try{return JSON.stringify(e)}catch{return String(e)}}
function parisToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),g=(k:string)=>parts.find(x=>x.type===k)?.value||'';return`${g('year')}-${g('month')}-${g('day')}`}
function parisDay(offset=0){const base=parisToday();if(!offset)return base;const d=new Date(base+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10)}
function cors(req:Request){const o=req.headers.get('origin')||'',ok=!o||ORIGINS.has(o);return{ok,h:{'Access-Control-Allow-Origin':ok&&o?o:'https://stip.esapin.com','Access-Control-Allow-Headers':'content-type,x-stip-session','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}}}
function json(req:Request,b:unknown,s=200){return new Response(JSON.stringify(b),{status:s,headers:{...cors(req).h,'Content-Type':'application/json','Cache-Control':'no-store'}})}
async function ctx(req:Request){const raw=req.headers.get('x-stip-session')||'';if(!raw)throw Error('SESSION_STIP_REQUISE');const th=await sha(raw),s=await db.from('stip_access_sessions').select('id,profile_id,expires_at,revoked_at').eq('token_hash',th).maybeSingle();if(s.error)throw s.error;if(!s.data||s.data.revoked_at||new Date(s.data.expires_at)<=new Date())throw Error('SESSION_EXPIREE');const p=await db.from('stip_access_profiles').select('id,agent_id,active,permissions').eq('id',s.data.profile_id).maybeSingle();if(p.error)throw p.error;if(!p.data?.active)throw Error('ACCES_DESACTIVE');const a=await db.from('agents').select('id,source_key,nom,prenom,equipe,ghe,role,actif').eq('id',p.data.agent_id).maybeSingle();if(a.error)throw a.error;if(!a.data?.actif)throw Error('AGENT_INACTIF');return{profile:p.data,agent:a.data}}
function canManage(c:any){return Boolean(c.profile.permissions?.responsable||c.profile.permissions?.admin)}
function requireResp(c:any){if(!canManage(c))throw Error('ACCES_RESPONSABLE_REQUIS')}
async function ensureTarget(id:string){const q=await db.from('agents').select('id,source_key,nom,prenom,equipe,ghe,telephone,role').eq('id',id).eq('actif',true).maybeSingle();if(q.error)throw q.error;if(!q.data)throw Error('AGENT_INTROUVABLE');return q.data}
async function notifications(c:any){
  const q=await db.from('stip_notifications').select('*').eq('agent_id',c.agent.id).order('created_at',{ascending:false}).limit(120);
  if(q.error)throw q.error;
  const cutoff=Date.now()-14*86400000,seen=new Set<string>(),out:any[]=[];
  for(const n of q.data||[]){
    const created=new Date(n.created_at||0).getTime(),alertAt=n.type==='agenda_alert'?new Date(n.metadata?.event_at||0).getTime():0;
    if(n.type==='agenda_alert'&&!n.metadata?.conflict&&alertAt&&alertAt<Date.now()-2*3600000)continue;
    if(!n.action_id&&(!created||created<cutoff)&&!(n.type==='agenda_alert'&&alertAt>Date.now()-86400000))continue;
    if(n.source_type==='stip_change'&&n.source_ref){
      const key=`stip_change:${n.source_ref}`;
      if(seen.has(key))continue;
      seen.add(key);
    }
    out.push(n);
    if(out.length>=80)break;
  }
  return out;
}
async function listActions(c:any){const q=await db.from('stip_action_requests').select('*').eq('target_agent_id',c.agent.id).eq('status','pending').order('priority',{ascending:false}).order('created_at',{ascending:false}).limit(40);if(q.error)throw q.error;return q.data||[]}
async function actionDetail(c:any,id:string){const q=await db.from('stip_action_requests').select('*').eq('id',id).eq('target_agent_id',c.agent.id).maybeSingle();if(q.error)throw q.error;if(!q.data||q.data.status!=='pending')throw Error('ACTION_INTROUVABLE');const a:any=q.data;if(!a.seen_at){const now=new Date().toISOString();await db.from('stip_action_requests').update({seen_at:now,updated_at:now}).eq('id',id).is('seen_at',null);a.seen_at=now;await db.from('stip_notifications').update({read_at:now}).eq('agent_id',c.agent.id).eq('action_id',id).is('read_at',null)}if(a.source_type==='evaluation_signature'&&a.source_ref){const r=await db.from('stip_evaluation_signature_requests').select('*').eq('id',a.source_ref).maybeSingle();if(r.error)throw r.error;const e=await db.from('stip_agent_evaluations').select('*').eq('id',r.data?.evaluation_id).maybeSingle();if(e.error)throw e.error;a.evaluation=e.data;a.signature_request=r.data}return a}
function png(v:unknown){const s=text(v,450000);if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s))throw Error('SIGNATURE_INVALIDE');const raw=atob(s.split(',')[1]),b=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)b[i]=raw.charCodeAt(i);return b}
async function submitSignature(c:any,b:any){const a=await actionDetail(c,text(b.action_id,80));if(a.kind!=='signature')throw Error('ACTION_NON_SIGNABLE');const req=await db.from('stip_evaluation_signature_requests').select('*').eq('id',a.source_ref).eq('agent_id',c.agent.id).maybeSingle();if(req.error)throw req.error;if(!req.data||req.data.status!=='pending')throw Error('DEMANDE_SIGNATURE_INVALIDE');const bytes=png(b.signature),path=`evaluations/actions/${req.data.evaluation_id}/signatures/agent-${req.data.id}.png`,blob=new Blob([bytes],{type:'image/png'}),up=await db.storage.from(BUCKET).upload(path,blob,{contentType:'image/png',upsert:true});if(up.error)throw Error(errText(up.error));const now=new Date().toISOString(),hash=await shaBytes(bytes);const u=await db.from('stip_evaluation_signature_requests').update({status:'signed',signed_at:now,storage_path:path,signature_hash:hash,updated_at:now}).eq('id',req.data.id).select('*').single();if(u.error){await db.storage.from(BUCKET).remove([path]).catch(()=>{});throw Error(errText(u.error))}return u.data}
async function createAction(c:any,b:any){requireResp(c);const target=text(b.target_agent_id,80),title=text(b.title,180),body=text(b.body,1500),kind=text(b.kind,40)||'request',sourceType=text(b.source_type,60)||'manual',sourceRef=text(b.source_ref,80)||null;if(!target||!title)throw Error('CHAMPS_MANQUANTS');await ensureTarget(target);const r=await db.from('stip_action_requests').insert({kind,target_agent_id:target,requester_agent_id:c.agent.id,source_type:sourceType,source_ref:sourceRef,title,body,priority:Number(b.priority||50),status:'pending',metadata:b.metadata||{}}).select('*').single();if(r.error)throw r.error;await db.from('stip_notifications').insert({agent_id:target,type:'action_required',title,body,action_id:r.data.id,source_type:sourceType,source_ref:sourceRef,metadata:b.metadata||{}});return r.data}
async function sendNotification(c:any,b:any){requireResp(c);const target=text(b.target_agent_id,80),title=text(b.title,180),body=text(b.body,1500);if(!target||!title)throw Error('CHAMPS_MANQUANTS');await ensureTarget(target);const r=await db.from('stip_notifications').insert({agent_id:target,type:'manager_message',title,body,source_type:'manual_message',metadata:{dismissible:true}}).select('*').single();if(r.error)throw r.error;return r.data}
function agendaPayload(b:any){const display_mode=text(b.display_mode,20)==='day_note'?'day_note':'event',event_date=text(b.event_date,10),title=text(b.title,180),body=text(b.body,1800),all_day=display_mode==='day_note'?true:Boolean(b.all_day),start_time=all_day?null:text(b.start_time,8)||null,end_time=all_day?null:text(b.end_time,8)||null,location=text(b.location,240)||null,importance=['normal','important','urgent'].includes(text(b.importance,20))?text(b.importance,20):'normal',event_kind=['rendezvous','formation','formateur','reunion','information','autre'].includes(text(b.event_kind,30))?text(b.event_kind,30):'autre',defaults:any={rendezvous:'📅',formation:'🎓',formateur:'🧑‍🏫',reunion:'👥',information:'ℹ️',autre:'📌'},icon=text(b.icon,24)||defaults[event_kind]||'📌';if(!/^\d{4}-\d{2}-\d{2}$/.test(event_date)||!title)throw Error('AGENDA_CHAMPS_MANQUANTS');if(display_mode==='event'&&!all_day&&(!/^\d{2}:\d{2}/.test(start_time||'')||!/^\d{2}:\d{2}/.test(end_time||'')))throw Error('AGENDA_HORAIRE_REQUIS');return{display_mode,event_date,title,body,all_day,start_time,end_time,location,importance,event_kind,icon}}
async function insertAgenda(c:any,target:string,p:any,sourceType='manual',sourceRef:string|null=null,creatorId:string|null=null){await ensureTarget(target);const q=await db.from('stip_agent_agenda_items').insert({agent_id:target,created_by_agent_id:creatorId||c.agent.id,source_type:sourceType,source_ref:sourceRef,...p,status:'active'}).select('*').single();if(q.error)throw q.error;return q.data}
async function agendaDirect(c:any,b:any){const requested=text(b.target_agent_id,80),target=requested||String(c.agent.id||'');if(!target)throw Error('AGENT_REQUIS');const self=String(target)===String(c.agent.id);if(!self&&!canManage(c))throw Error('ACCES_RESPONSABLE_REQUIS');if(self&&!canManage(c)&&!c.profile.permissions?.planning_personal)throw Error('ACCES_PLANNING_REQUIS');return insertAgenda(c,target,agendaPayload(b),self?'manual_self':'manual_direct',null)}
async function agendaPropose(c:any,b:any){requireResp(c);const target=text(b.target_agent_id,80);if(!target)throw Error('AGENT_REQUIS');const p=agendaPayload(b),when=p.all_day?p.event_date:`${p.event_date} · ${p.start_time}`;return createAction(c,{target_agent_id:target,title:`📅 ${p.title}`,body:[when,p.location].filter(Boolean).join(' · '),kind:'agenda_proposal',source_type:'manual_agenda_proposal',priority:p.importance==='urgent'?90:p.importance==='important'?70:50,metadata:{agenda:p}})}
async function acceptAgenda(c:any,b:any){const a=await actionDetail(c,text(b.action_id,80));if(a.kind!=='agenda_proposal')throw Error('ACTION_INVALIDE');const p=a.metadata?.agenda?agendaPayload(a.metadata.agenda):null;if(!p)throw Error('AGENDA_INVALIDE');const item=await insertAgenda(c,c.agent.id,p,'accepted_proposal',a.id,a.requester_agent_id||null);const now=new Date().toISOString();const u=await db.from('stip_action_requests').update({status:'done',completed_at:now,updated_at:now}).eq('id',a.id).eq('target_agent_id',c.agent.id).eq('status','pending');if(u.error)throw u.error;await db.from('stip_notifications').delete().eq('agent_id',c.agent.id).eq('action_id',a.id);return item}
async function declineAgenda(c:any,b:any){const id=text(b.action_id,80),q=await db.from('stip_action_requests').select('id,kind,status').eq('id',id).eq('target_agent_id',c.agent.id).maybeSingle();if(q.error)throw q.error;if(!q.data||q.data.status!=='pending'||q.data.kind!=='agenda_proposal')throw Error('ACTION_INVALIDE');const now=new Date().toISOString(),u=await db.from('stip_action_requests').update({status:'cancelled',cancelled_at:now,updated_at:now}).eq('id',id);if(u.error)throw u.error;await db.from('stip_notifications').delete().eq('agent_id',c.agent.id).eq('action_id',id);return{ok:true}}
async function readNotification(c:any,b:any){const id=text(b.notification_id,80);if(!id)throw Error('NOTIFICATION_REQUISE');const now=new Date().toISOString(),q=await db.from('stip_notifications').update({read_at:now}).eq('id',id).eq('agent_id',c.agent.id).is('read_at',null).select('id,read_at').maybeSingle();if(q.error)throw q.error;if(q.data)return{ok:true,read_at:q.data.read_at};const existing=await db.from('stip_notifications').select('id,read_at').eq('id',id).eq('agent_id',c.agent.id).maybeSingle();if(existing.error)throw existing.error;if(!existing.data)throw Error('NOTIFICATION_INTROUVABLE');return{ok:true,read_at:existing.data.read_at}}
async function dismissNotification(c:any,b:any){const id=text(b.notification_id,80);if(!id)throw Error('NOTIFICATION_REQUISE');const q=await db.from('stip_notifications').delete().eq('id',id).eq('agent_id',c.agent.id).select('id').maybeSingle();if(q.error)throw q.error;if(!q.data)throw Error('NOTIFICATION_INTROUVABLE');return{ok:true}}

function parisStamp(d=new Date()){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d),g=(k:string)=>p.find(x=>x.type===k)?.value||'';return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`}
function parisDateOf(v:any){const d=new Date(v||Date.now());if(Number.isNaN(d.getTime()))return text(v,10).slice(0,10);const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),g=(k:string)=>p.find(x=>x.type===k)?.value||'';return `${g('year')}-${g('month')}-${g('day')}`}
function parisTimeOf(v:any){const d=new Date(v||'');if(Number.isNaN(d.getTime()))return'';const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d),g=(k:string)=>p.find(x=>x.type===k)?.value||'';return `${g('hour')}:${g('minute')}`}
function lastClock(v:any){const s=String(v||''),out:string[]=[];for(const m of s.matchAll(/(?:^|\D)([01]?\d|2[0-3])(?:[:hH.])([0-5]\d)(?!\d)/g))out.push(`${String(+m[1]).padStart(2,'0')}:${m[2]}`);return out.at(-1)||''}
function localPlus(date:string,clock:string,minutes=60){const safe=/^\d{2}:\d{2}$/.test(clock)?clock:'18:00',d=new Date(`${date}T${safe}:00Z`);d.setUTCMinutes(d.getUTCMinutes()+minutes);return d.toISOString().slice(0,16)}
const refNorm=(v:any)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('fr-FR').replace(/[^A-Z0-9]+/g,' ').trim()
function referentMatches(v:any,a:any){const q=refNorm(v);if(!q)return false;const vals=[a?.source_key,a?.prenom,a?.nom,[a?.prenom,a?.nom].filter(Boolean).join(' '),[a?.nom,a?.prenom].filter(Boolean).join(' ')].map(refNorm);const parts=String(a?.source_key||'').split('_').filter(Boolean);if(parts.length)vals.push(refNorm(parts.at(-1)));return String(v||'').split(/\s*(?:\+|\/|;|&|\bet\b)\s*/i).map(refNorm).filter(Boolean).some((x:string)=>vals.includes(x))}
async function eventFeedbackList(c:any){const q=await db.from('stip_event_feedback').select('event_key,attendance,rating,reason_code,follow_up,custom_answer,submitted_at').eq('agent_id',c.agent.id).order('submitted_at',{ascending:false}).limit(200);if(q.error)throw q.error;return q.data||[]}
function feedbackKindOf(v:any){
  const s=[v?.source_type,v?.event_kind,v?.type,v?.title,v?.intitule].filter(Boolean).join(' ').toLowerCase();
  if(/mobi_lit_medical|visite|médical|medical/.test(s))return'medical';
  if(/formation|training/.test(s))return'training';
  if(/stagiaire|stage/.test(s))return'intern';
  if(/réunion|reunion|briefing|staff/.test(s))return'meeting';
  return'other';
}
function feedbackReasonCodes(kind:string){
  const map:Record<string,string[]>={
    medical:['cancelled','delay','location','convocation','organization','unavailable','other'],
    training:['schedule','location','organization','facilitator','information','cancelled','not_informed','unavailable','other'],
    intern:['schedule','organization','supervision','information','communication','trainee_absent','not_informed','not_found','other'],
    meeting:['schedule','organization','participants','information','communication','cancelled','not_informed','location','other'],
    other:['schedule','organization','information','communication','process','cancelled','not_informed','location','unavailable','other']
  };
  return map[kind]||map.other;
}
function feedbackReasonLabel(kind:string,code:string){
  const labels:Record<string,string>={
    cancelled:'Annulé',
    delay:'Retard important',
    location:'Lieu / adresse différent ou incorrect',
    convocation:'Convocation manquante',
    organization:'Organisation',
    unavailable:'Impossible à réaliser',
    schedule:'Horaires / date différents',
    facilitator:'Formateur / intervenant',
    information:'Information manquante',
    not_informed:'Information non reçue',
    supervision:'Encadrement différent',
    communication:'Communication',
    trainee_absent:'Stagiaire absent',
    not_found:'Stagiaire non vu / non trouvé',
    participants:'Participants',
    process:'Déroulement',
    other:'Autre'
  };
  return labels[code]||code||'';
}
function outcomeOfAttendance(v:string){return v==='ok'?'realized':v==='problem'?'different':v==='absent'?'not_realized':''}
async function feedbackEvent(c:any,eventKey:string){
  const m=eventKey.match(/^(agenda|formation|stagiaire):([0-9a-f-]{36})$/i);if(!m)throw Error('EVENEMENT_RETOUR_INVALIDE');
  const kind=m[1].toLowerCase(),id=m[2];
  if(kind==='agenda'){
    const q=await db.from('stip_agent_agenda_items').select('id,title,body,event_date,start_time,end_time,all_day,location,event_kind,source_type,source_ref,created_by_agent_id,feedback_enabled,feedback_question,status').eq('id',id).eq('agent_id',c.agent.id).maybeSingle();if(q.error)throw q.error;const x:any=q.data;if(!x||x.status!=='active')throw Error('EVENEMENT_INTROUVABLE');if(x.feedback_enabled===false)throw Error('RETOUR_NON_REQUIS');
    const date=String(x.event_date||'').slice(0,10),clock=x.all_day?'18:00':text(x.end_time,8).slice(0,5)||text(x.start_time,8).slice(0,5)||'18:00',feedbackKind=feedbackKindOf(x),sensitive=feedbackKind==='medical';
    return{key:eventKey,type:'agenda',title:text(x.title,180),date,endDate:date,time:x.all_day?'Toute la journée':[text(x.start_time,8).slice(0,5),text(x.end_time,8).slice(0,5)].filter(Boolean).join('–'),location:text(x.location,240),question:sensitive?'':text(x.feedback_question,240),sensitive,feedbackKind,due:localPlus(date,clock,60),createdByAgentId:x.created_by_agent_id||null,sourceType:text(x.source_type,80),sourceRef:x.source_ref||null,body:text(x.body,1000)}
  }
  if(kind==='formation'){
    const q=await db.from('formations').select('id,agent_source_key,intitule,date_debut,date_fin,lieu,horaire,statut,observation,source_file,source_sheet').eq('id',id).eq('agent_source_key',c.agent.source_key).maybeSingle();if(q.error)throw q.error;const x:any=q.data;if(!x)throw Error('EVENEMENT_INTROUVABLE');const date=parisDateOf(x.date_debut),endDate=parisDateOf(x.date_fin||x.date_debut),fromTs=parisTimeOf(x.date_fin||''),clock=lastClock(x.horaire)||(fromTs&&fromTs!=='00:00'?fromTs:'18:00');
    return{key:eventKey,type:'formation',title:text(x.intitule,180)||'Formation',date,endDate,time:text(x.horaire,120),location:text(x.lieu,240),question:'',sensitive:false,feedbackKind:'training',due:localPlus(endDate,clock,60),observation:text(x.observation,500),sourceFile:text(x.source_file,200),sourceSheet:text(x.source_sheet,120)}
  }
  const q=await db.from('stagiaires').select('id,nom,prenom,date_debut,date_fin,horaires,referent,observation,source_file,source_sheet').eq('id',id).maybeSingle();if(q.error)throw q.error;const x:any=q.data;if(!x||!referentMatches(x.referent,c.agent))throw Error('EVENEMENT_INTROUVABLE');const date=String(x.date_debut||'').slice(0,10),endDate=String(x.date_fin||x.date_debut||'').slice(0,10),clock=lastClock(x.horaires)||'18:00';
  return{key:eventKey,type:'stagiaire',title:[text(x.prenom,80),text(x.nom,120)].filter(Boolean).join(' ')||'Stagiaire',date,endDate,time:text(x.horaires,120),location:'',question:'',sensitive:false,feedbackKind:'intern',due:localPlus(endDate,clock,60),referent:text(x.referent,240),observation:text(x.observation,500),sourceFile:text(x.source_file,200),sourceSheet:text(x.source_sheet,120)}
}
async function submitEventFeedback(c:any,b:any){
  const eventKey=text(b.event_key,180),attendance=text(b.attendance,20),follow=typeof b.follow_up==='boolean'?b.follow_up:null,rawRating=Number(b.rating),incomingReason=text(b.reason_code,48)||null,rawCustom=text(b.custom_answer,20)||null,rawNote=text(b.note,500)||null;
  if(!['absent','problem','ok'].includes(attendance))throw Error('RETOUR_PRESENCE_REQUISE');
  if(follow===null)throw Error('RETOUR_SUIVI_REQUIS');
  const ev=await feedbackEvent(c,eventKey);if(parisStamp()<ev.due)throw Error('RETOUR_TROP_TOT');
  const allowed=feedbackReasonCodes(ev.feedbackKind);
  let rating:any=Number.isInteger(rawRating)&&rawRating>=1&&rawRating<=5?rawRating:null,
      reasonCode:string|null=null,
      custom:string|null=null,
      note:string|null=ev.sensitive?null:rawNote;
  if(attendance!=='ok'){
    if(!incomingReason||!allowed.includes(incomingReason))throw Error('RETOUR_MOTIF_REQUIS');
    reasonCode=incomingReason;
  }
  if(ev.question&&attendance!=='absent'){
    if(!['yes','no'].includes(rawCustom||''))throw Error('RETOUR_QUESTION_REQUISE');
    custom=rawCustom;
  }
  if(ev.sensitive){rating=null;custom=null;note=null}
  const outcome=outcomeOfAttendance(attendance);
  const payload={agent_id:c.agent.id,event_key:eventKey,event_type:ev.type,attendance,rating,reason_code:reasonCode,follow_up:follow,custom_answer:custom,note,event_snapshot:{title:ev.title,date:ev.date,end_date:ev.endDate,time:ev.time,location:ev.location,type:ev.type,feedback_kind:ev.feedbackKind,feedback_mode:'outcome',outcome},submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()},q=await db.from('stip_event_feedback').upsert(payload,{onConflict:'agent_id,event_key'}).select('event_key,attendance,rating,reason_code,follow_up,custom_answer,note,event_snapshot,submitted_at').single();if(q.error)throw q.error;return q.data
}

function validEmail(v:any){const s=text(v,320).toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:''}
function shiftBase(v:any){const c=text(v,24).toUpperCase().replace(/\*+$/,'');if(/^J4/.test(c))return'J4';if(/^M/.test(c))return'M';if(/^J/.test(c))return'J';if(/^S/.test(c))return'S';if(/^N/.test(c))return'N';return c}
function mailDate(v:any){const s=text(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s;return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(s+'T12:00:00+02:00'))}
function personName(a:any,f='Agent'){return [text(a?.prenom,80),text(a?.nom,120)].filter(Boolean).join(' ').trim()||f}
function compactNorm(v:any){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'')}
function feedbackSubject(ev:any,date:string){
  if(ev.sensitive)return `Suivi rendez-vous · ${date}`;
  if(ev.feedbackKind==='intern')return `Suivi accompagnement · ${text(ev.title,100)} · ${date}`;
  if(ev.feedbackKind==='training')return `Suivi formation · ${text(ev.title,100)} · ${date}`;
  if(ev.feedbackKind==='meeting')return `Suivi réunion · ${text(ev.title,100)} · ${date}`;
  return `Suivi · ${text(ev.title,110)||'Événement'} · ${date}`;
}
function feedbackOutcomeSentence(ev:any,attendance:string,date:string){
  const title=text(ev.title,180)||'cet événement';
  if(ev.sensitive){
    if(attendance==='ok')return `Le rendez-vous prévu le ${date} a été réalisé.`;
    if(attendance==='problem')return `Le rendez-vous prévu le ${date} a rencontré un problème d’organisation.`;
    return `Le rendez-vous prévu le ${date} n’a pas pu être réalisé.`;
  }
  if(ev.feedbackKind==='intern'){
    if(attendance==='ok')return `L’accompagnement de « ${title} » prévu le ${date} a été réalisé.`;
    if(attendance==='problem')return `L’accompagnement de « ${title} » prévu le ${date} s’est déroulé différemment de ce qui était prévu.`;
    return `L’accompagnement de « ${title} » prévu le ${date} n’a pas pu être réalisé.`;
  }
  if(ev.feedbackKind==='training'){
    if(attendance==='ok')return `La formation « ${title} » prévue le ${date} a été réalisée.`;
    if(attendance==='problem')return `La formation « ${title} » prévue le ${date} s’est déroulée différemment de ce qui était prévu.`;
    return `La formation « ${title} » prévue le ${date} n’a pas pu être réalisée.`;
  }
  if(ev.feedbackKind==='meeting'){
    if(attendance==='ok')return `La réunion « ${title} » prévue le ${date} a eu lieu.`;
    if(attendance==='problem')return `La réunion « ${title} » prévue le ${date} a eu lieu avec un imprévu.`;
    return `La réunion « ${title} » prévue le ${date} n’a pas pu avoir lieu.`;
  }
  if(attendance==='ok')return `« ${title} » prévu le ${date} a été réalisé.`;
  if(attendance==='problem')return `« ${title} » prévu le ${date} s’est déroulé différemment de ce qui était prévu.`;
  return `« ${title} » prévu le ${date} n’a pas pu être réalisé.`;
}
function mailDraft(c:any,ev:any,b:any){
  const attendance=text(b.attendance,20),date=mailDate(ev.endDate||ev.date),name=personName(c.agent),reason=feedbackReasonLabel(ev.feedbackKind,text(b.reason_code,48)),note=ev.sensitive?'':text(b.note,500);
  const lines=[feedbackOutcomeSentence(ev,attendance,date)];
  if(attendance!=='ok'&&reason)lines.push(`Motif indiqué : ${reason}.`);
  if(note)lines.push(`Précision : ${note}`);
  const ask=attendance==='absent'
    ? 'Pouvez-vous m’indiquer la suite à donner et, si nécessaire, s’il faut reprogrammer ?'
    : 'Pouvez-vous m’indiquer la suite à donner si une action reste nécessaire ?';
  return{subject:feedbackSubject(ev,date),body:`Bonjour,\n\n${lines.join('\n')}\n\n${ask}\n\nMerci par avance pour votre retour.\n\nCordialement,\n${name}`};
}
function personMatchesReferent(v:any,a:any){
  const q=refNorm(v);if(!q)return false;
  const vals=[a?.source_key,a?.prenom,a?.nom,[a?.prenom,a?.nom].filter(Boolean).join(' '),[a?.nom,a?.prenom].filter(Boolean).join(' ')].map(refNorm);
  const parts=String(a?.source_key||'').split('_').filter(Boolean);if(parts.length)vals.push(refNorm(parts.at(-1)));
  return vals.includes(q);
}
async function eventMailCandidates(c:any,ev:any){
  const current=await db.from('agents').select('id,source_key,nom,prenom,email,ghe,role').eq('id',c.agent.id).maybeSingle();if(current.error)throw current.error;
  let replyTo=validEmail(current.data?.email);
  if(!replyTo){
    const ownContact=await db.from('contacts_ghe').select('email_pro').eq('source_key',c.agent.source_key).eq('actif',true).maybeSingle();
    replyTo=validEmail(ownContact.data?.email_pro);
  }
  const cq=await db.from('contacts_ghe').select('source_key,categorie,ghe,nom,prenom,alias,email_pro,role_metier,equipe,ordre').eq('actif',true);if(cq.error)throw cq.error;
  const aq=await db.from('agents').select('id,source_key,nom,prenom,email,ghe,role,equipe').eq('actif',true);if(aq.error)throw aq.error;
  const contacts:any[]=cq.data||[],agents:any[]=aq.data||[];
  const byEmail=new Map<string,any>(),add=(x:any)=>{
    const email=validEmail(x.email);if(!email||email===replyTo)return;
    const candidate={email,name:text(x.name,180)||email,role:text(x.role,180),kind:text(x.kind,40),reason:text(x.reason,180),recommended:!!x.recommended,bucket:x.bucket==='cc'?'cc':'to',score:Number(x.score??50)};
    const old=byEmail.get(email);
    if(old){
      old.recommended=old.recommended||candidate.recommended;
      if(candidate.bucket==='to')old.bucket='to';
      old.score=Math.min(Number(old.score??50),candidate.score);
      if(candidate.reason&&!String(old.reason||'').includes(candidate.reason))old.reason=[old.reason,candidate.reason].filter(Boolean).join(' · ');
      return;
    }
    byEmail.set(email,candidate);
  };
  const addAgent=(a:any,meta:any)=>add({email:a?.email,name:personName(a),role:text(a?.role,180)||'Agent',...meta});
  const addContact=(x:any,meta:any)=>add({email:x?.email_pro,name:personName(x,text(x?.nom,180)||'Contact'),role:text(x?.role_metier,180)||text(x?.categorie,80),...meta});

  if(ev.createdByAgentId){
    const creator=agents.find((a:any)=>String(a.id)===String(ev.createdByAgentId)&&String(a.id)!==String(c.agent.id));
    if(creator)addAgent(creator,{kind:'linked',reason:'Lié à cet événement',recommended:true,bucket:'to',score:0});
  }

  if(ev.feedbackKind==='intern'&&ev.referent){
    const refs=String(ev.referent).split(/\s*(?:\+|\/|;|&|\bet\b)\s*/i).map((x:string)=>x.trim()).filter(Boolean);
    for(const ref of refs){
      for(const a of agents){
        if(String(a.id)===String(c.agent.id))continue;
        if(personMatchesReferent(ref,a))addAgent(a,{kind:'linked',reason:'Référent de cet accompagnement',recommended:true,bucket:'to',score:1});
      }
      for(const x of contacts){
        const vals=[x.source_key,x.prenom,x.nom,[x.prenom,x.nom].filter(Boolean).join(' '),[x.nom,x.prenom].filter(Boolean).join(' ')].map(refNorm);
        if(vals.includes(refNorm(ref)))addContact(x,{kind:'linked',reason:'Référent de cet accompagnement',recommended:true,bucket:'to',score:1});
      }
    }
  }

  const eventDomain=compactNorm([ev.title,ev.location,ev.observation,ev.sourceType].filter(Boolean).join(' '));
  for(const x of contacts){
    const email=validEmail(x.email_pro);if(!email)continue;
    const fields=[x.source_key,x.alias,x.nom,x.role_metier].map(compactNorm).filter((v:string)=>v.length>=5);
    const direct=eventDomain.length>=5&&fields.some((v:string)=>eventDomain.includes(v)||v.includes(eventDomain));
    const roleText=[x.nom,x.alias,x.role_metier,x.source_key].filter(Boolean).join(' ').toLowerCase();
    const thematic=
      (ev.feedbackKind==='training'&&/formateur|formation|mobilit/.test(roleText))||
      (ev.feedbackKind==='intern'&&/stag|ecole|formation|encadrement/.test(roleText));
    if(direct||thematic)addContact(x,{kind:'domain',reason:'Lié au domaine de cet événement',recommended:true,bucket:'to',score:direct?2:5});
  }

  for(const x of contacts){
    const role=text(x.role_metier,180),cat=text(x.categorie,80).toLowerCase(),sameGhe=!x.ghe||!c.agent.ghe||String(x.ghe)===String(c.agent.ghe);
    if(ev.sensitive&&cat==='administration'){
      addContact(x,{kind:'administrative',reason:'Contact administratif',recommended:true,bucket:'to',score:sameGhe?8:12});
      continue;
    }
    if(/cadre|responsable/i.test(role)){
      addContact(x,{kind:'encadrement',reason:/cadre/i.test(role)?'Cadre':'Responsable',recommended:sameGhe,bucket:'to',score:sameGhe?15:25});
    }else if(cat==='chef'||/chef/i.test(role)){
      addContact(x,{kind:'encadrement',reason:'Chef d’équipe',recommended:false,bucket:'cc',score:sameGhe?30:40});
    }
  }
  for(const a of agents){
    const role=text(a.role,180),sameGhe=!a.ghe||!c.agent.ghe||String(a.ghe)===String(c.agent.ghe);
    if(/cadre|responsable/i.test(role))addAgent(a,{kind:'encadrement',reason:/cadre/i.test(role)?'Cadre':'Responsable',recommended:sameGhe,bucket:'to',score:sameGhe?16:26});
    else if(/chef/i.test(role))addAgent(a,{kind:'encadrement',reason:'Chef d’équipe',recommended:false,bucket:'cc',score:sameGhe?31:41});
  }

  if(!ev.sensitive){
    const date=text(ev.endDate||ev.date,10),selfPlan=await db.from('planning').select('code,equipe').eq('agent_id',c.agent.id).eq('date',date).maybeSingle();if(selfPlan.error)throw selfPlan.error;
    const base=shiftBase(selfPlan.data?.code),team=text(selfPlan.data?.equipe,80);
    if(base||team){
      const pq=await db.from('planning').select('code,equipe,agent_id,agents(id,source_key,nom,prenom,email,ghe,role,equipe)').eq('date',date);if(pq.error)throw pq.error;
      for(const row of pq.data||[]){
        const a:any=row.agents;if(!a||String(a.id)===String(c.agent.id))continue;
        const sameBase=base&&shiftBase(row.code)===base,sameTeam=team&&String(row.equipe||'')===team;
        if(!sameBase&&!sameTeam)continue;
        addAgent(a,{kind:'colleague',reason:sameBase?`Même shift ${base}`:'Même équipe',recommended:false,bucket:'cc',score:sameBase?50:55});
      }
    }
  }
  return{reply_to:replyTo,candidates:[...byEmail.values()].sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name,'fr')).slice(0,24).map(({score,...x})=>x)};
}
async function eventMailContext(c:any,b:any){
  const eventKey=text(b.event_key,180),attendance=text(b.attendance,20);
  if(!['absent','problem','ok'].includes(attendance))throw Error('RETOUR_PRESENCE_REQUISE');
  const ev=await feedbackEvent(c,eventKey),recipients=await eventMailCandidates(c,ev),draft=mailDraft(c,ev,b);
  return{event:{event_key:eventKey,title:ev.title,date:ev.date,end_date:ev.endDate,sensitive:!!ev.sensitive,feedback_kind:ev.feedbackKind,outcome:outcomeOfAttendance(attendance)},sender:{display_name:personName(c.agent),reply_to:recipients.reply_to||null,from:STIP_MAIL_FROM||null},direct_send:Boolean(RESEND_API_KEY&&STIP_MAIL_FROM),candidates:recipients.candidates,draft};
}
async function sendEventMail(c:any,b:any){
  if(!RESEND_API_KEY||!STIP_MAIL_FROM)throw Error('ENVOI_MAIL_STIP_NON_CONFIGURE');
  const context=await eventMailContext(c,b),allowed=new Map((context.candidates||[]).map((x:any)=>[String(x.email).toLowerCase(),x]));
  const cleanList=(v:any)=>[...new Set((Array.isArray(v)?v:[]).map(validEmail).filter(Boolean))].filter(x=>allowed.has(x)).slice(0,12);
  const to=cleanList(b.to),cc=cleanList(b.cc).filter(x=>!to.includes(x));if(!to.length)throw Error('DESTINATAIRE_REQUIS');
  const subject=text(b.subject,180),body=text(b.body,5000);if(!subject||!body)throw Error('MAIL_INCOMPLET');
  const payload:any={from:STIP_MAIL_FROM,to,subject,text:body,headers:{'X-STIP-Event':text(b.event_key,180)}};
  if(cc.length)payload.cc=cc;
  if(context.sender.reply_to)payload.reply_to=context.sender.reply_to;
  const idem='stip-event-'+(await sha([String(c.agent.id),text(b.event_key,180),to.join(','),cc.join(','),subject,body].join('|'))).slice(0,48);
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':idem},body:JSON.stringify(payload)}),j=await r.json().catch(()=>({}));
  if(!r.ok||!j?.id)throw Error(`MAIL_PROVIDER_${r.status}`);
  const feedback=await submitEventFeedback(c,{...b,follow_up:true});
  return{ok:true,id:j.id,to,cc,from:STIP_MAIL_FROM,reply_to:context.sender.reply_to||null,feedback};
}
async function managerEventFeedback(c:any){requireResp(c);const q=await db.from('stip_event_feedback').select('id,event_key,event_type,attendance,rating,reason_code,follow_up,custom_answer,note,event_snapshot,submitted_at,agent:agents!stip_event_feedback_agent_id_fkey(id,source_key,nom,prenom,equipe,ghe)').order('submitted_at',{ascending:false}).limit(160);if(q.error)throw q.error;return q.data||[]}
async function managerAgents(c:any){requireResp(c);const q=await db.from('agents').select('id,source_key,nom,prenom,equipe,type_planning,role,ghe,telephone,avatar_url,profile_photo_url').eq('actif',true).order('nom');if(q.error)throw q.error;return q.data||[]}
async function managerAgendaList(c:any){requireResp(c);const q=await db.from('stip_agent_agenda_items').select('*,agent:agents!stip_agent_agenda_items_agent_id_fkey(id,source_key,nom,prenom,equipe,ghe)').eq('created_by_agent_id',c.agent.id).eq('status','active').gte('event_date',parisDay(-1)).order('event_date').order('start_time').limit(120);if(q.error)throw q.error;return q.data||[]}
async function managerAgendaCancel(c:any,b:any){requireResp(c);const id=text(b.id,80),now=new Date().toISOString();const q=await db.from('stip_agent_agenda_items').update({status:'cancelled',updated_at:now}).eq('id',id).eq('created_by_agent_id',c.agent.id).eq('status','active').select('id').maybeSingle();if(q.error)throw q.error;if(!q.data)throw Error('ELEMENT_INTROUVABLE');return{ok:true}}
async function managerList(c:any){requireResp(c);const q=await db.from('stip_action_requests').select('*,target:agents!stip_action_requests_target_agent_id_fkey(id,nom,prenom,source_key,equipe,role)').eq('requester_agent_id',c.agent.id).eq('status','pending').order('updated_at',{ascending:false}).limit(60);if(q.error)throw q.error;return q.data||[]}
async function managerRemind(c:any,b:any){requireResp(c);const id=text(b.action_id,80),q=await db.from('stip_action_requests').select('*').eq('id',id).eq('requester_agent_id',c.agent.id).maybeSingle();if(q.error)throw q.error;if(!q.data||q.data.status!=='pending')throw Error('ACTION_NON_RELANCABLE');const now=new Date().toISOString(),count=Number(q.data.reminder_count||0)+1,u=await db.from('stip_action_requests').update({reminder_count:count,last_reminded_at:now,updated_at:now}).eq('id',id).select('*').single();if(u.error)throw u.error;await db.from('stip_notifications').insert({agent_id:q.data.target_agent_id,type:'action_reminder',title:'Rappel',body:q.data.title,action_id:id,source_type:q.data.source_type,source_ref:q.data.source_ref});return u.data}
async function managerCancel(c:any,b:any){requireResp(c);const id=text(b.action_id,80),q=await db.from('stip_action_requests').select('*').eq('id',id).eq('requester_agent_id',c.agent.id).maybeSingle();if(q.error)throw q.error;if(!q.data||q.data.status!=='pending')throw Error('ACTION_NON_ANNULABLE');const now=new Date().toISOString();if(q.data.source_type==='evaluation_signature'&&q.data.source_ref){const r=await db.from('stip_evaluation_signature_requests').update({status:'cancelled',cancelled_at:now,updated_at:now}).eq('id',q.data.source_ref).eq('status','pending').select('id').maybeSingle();if(r.error)throw r.error}else{const u=await db.from('stip_action_requests').update({status:'cancelled',cancelled_at:now,updated_at:now}).eq('id',id).eq('status','pending').select('id').maybeSingle();if(u.error)throw u.error}await db.from('stip_notifications').delete().eq('action_id',id);return{ok:true}}

Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req).h});try{const c=await ctx(req),b=await req.json().catch(()=>({})),a=text(b.action,80);if(a==='home')return json(req,{agent:c.agent,permissions:c.profile.permissions,actions:await listActions(c),notifications:await notifications(c),event_feedback:await eventFeedbackList(c)});if(a==='list')return json(req,{actions:await listActions(c)});if(a==='get')return json(req,{action:await actionDetail(c,text(b.action_id,80))});if(a==='submit_signature')return json(req,{ok:true,signature:await submitSignature(c,b)});if(a==='notifications')return json(req,{notifications:await notifications(c)});if(a==='read_notification')return json(req,{ok:true,result:await readNotification(c,b)});if(a==='dismiss_notification')return json(req,{ok:true,result:await dismissNotification(c,b)});if(a==='event_feedback_list')return json(req,{items:await eventFeedbackList(c)});if(a==='event_feedback_submit')return json(req,{ok:true,item:await submitEventFeedback(c,b)});if(a==='event_mail_context')return json(req,{ok:true,...await eventMailContext(c,b)});if(a==='event_mail_send')return json(req,{ok:true,result:await sendEventMail(c,b)});if(a==='accept_agenda')return json(req,{ok:true,item:await acceptAgenda(c,b)});if(a==='decline_agenda')return json(req,{ok:true,result:await declineAgenda(c,b)});if(a==='create')return json(req,{ok:true,action:await createAction(c,b)});if(a==='send_notification')return json(req,{ok:true,notification:await sendNotification(c,b)});if(a==='agenda_direct')return json(req,{ok:true,item:await agendaDirect(c,b)});if(a==='agenda_propose')return json(req,{ok:true,action:await agendaPropose(c,b)});if(a==='manager_agents')return json(req,{agents:await managerAgents(c)});if(a==='manager_agenda_list')return json(req,{items:await managerAgendaList(c)});if(a==='manager_agenda_cancel')return json(req,{ok:true,result:await managerAgendaCancel(c,b)});if(a==='manager_list')return json(req,{actions:await managerList(c)});if(a==='manager_remind')return json(req,{ok:true,action:await managerRemind(c,b)});if(a==='manager_cancel')return json(req,{ok:true,action:await managerCancel(c,b)});if(a==='manager_event_feedback')return json(req,{items:await managerEventFeedback(c)});return json(req,{error:'ACTION_INVALIDE'},400)}catch(e){const m=errText(e);return json(req,{error:m},/SESSION/.test(m)?401:/ACCES/.test(m)?403:400)}})
