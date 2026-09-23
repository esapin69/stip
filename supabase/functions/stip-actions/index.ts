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
    const created=new Date(n.created_at||0).getTime();
    if(!n.action_id&&(!created||created<cutoff))continue;
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
function agendaPayload(b:any){const display_mode=text(b.display_mode,20)==='day_note'?'day_note':'event',event_date=text(b.event_date,10),title=text(b.title,180),body=text(b.body,1800),all_day=display_mode==='day_note'?true:Boolean(b.all_day),start_time=all_day?null:text(b.start_time,8)||null,end_time=all_day?null:text(b.end_time,8)||null,location=text(b.location,240)||null,importance=['normal','important','urgent'].includes(text(b.importance,20))?text(b.importance,20):'normal',event_kind=['rendezvous','formation','reunion','information','autre'].includes(text(b.event_kind,30))?text(b.event_kind,30):'autre',defaults:any={rendezvous:'📅',formation:'🎓',reunion:'👥',information:'ℹ️',autre:'📌'},icon=text(b.icon,24)||defaults[event_kind]||'📌';if(!/^\d{4}-\d{2}-\d{2}$/.test(event_date)||!title)throw Error('AGENDA_CHAMPS_MANQUANTS');if(display_mode==='event'&&!all_day&&(!/^\d{2}:\d{2}/.test(start_time||'')||!/^\d{2}:\d{2}/.test(end_time||'')))throw Error('AGENDA_HORAIRE_REQUIS');return{display_mode,event_date,title,body,all_day,start_time,end_time,location,importance,event_kind,icon}}
async function insertAgenda(c:any,target:string,p:any,sourceType='manual',sourceRef:string|null=null,creatorId:string|null=null){await ensureTarget(target);const q=await db.from('stip_agent_agenda_items').insert({agent_id:target,created_by_agent_id:creatorId||c.agent.id,source_type:sourceType,source_ref:sourceRef,...p,status:'active'}).select('*').single();if(q.error)throw q.error;return q.data}
async function agendaDirect(c:any,b:any){const requested=text(b.target_agent_id,80),target=requested||String(c.agent.id||'');if(!target)throw Error('AGENT_REQUIS');const self=String(target)===String(c.agent.id);if(!self&&!canManage(c))throw Error('ACCES_RESPONSABLE_REQUIS');if(self&&!canManage(c)&&!c.profile.permissions?.planning_personal)throw Error('ACCES_PLANNING_REQUIS');return insertAgenda(c,target,agendaPayload(b),self?'manual_self':'manual_direct',null)}
async function agendaPropose(c:any,b:any){requireResp(c);const target=text(b.target_agent_id,80);if(!target)throw Error('AGENT_REQUIS');const p=agendaPayload(b),when=p.all_day?p.event_date:`${p.event_date} · ${p.start_time}`;return createAction(c,{target_agent_id:target,title:`📅 ${p.title}`,body:[when,p.location].filter(Boolean).join(' · '),kind:'agenda_proposal',source_type:'manual_agenda_proposal',priority:p.importance==='urgent'?90:p.importance==='important'?70:50,metadata:{agenda:p}})}
async function acceptAgenda(c:any,b:any){const a=await actionDetail(c,text(b.action_id,80));if(a.kind!=='agenda_proposal')throw Error('ACTION_INVALIDE');const p=a.metadata?.agenda?agendaPayload(a.metadata.agenda):null;if(!p)throw Error('AGENDA_INVALIDE');const item=await insertAgenda(c,c.agent.id,p,'accepted_proposal',a.id,a.requester_agent_id||null);const now=new Date().toISOString();const u=await db.from('stip_action_requests').update({status:'done',completed_at:now,updated_at:now}).eq('id',a.id).eq('target_agent_id',c.agent.id).eq('status','pending');if(u.error)throw u.error;await db.from('stip_notifications').delete().eq('agent_id',c.agent.id).eq('action_id',a.id);return item}
async function declineAgenda(c:any,b:any){const id=text(b.action_id,80),q=await db.from('stip_action_requests').select('id,kind,status').eq('id',id).eq('target_agent_id',c.agent.id).maybeSingle();if(q.error)throw q.error;if(!q.data||q.data.status!=='pending'||q.data.kind!=='agenda_proposal')throw Error('ACTION_INVALIDE');const now=new Date().toISOString(),u=await db.from('stip_action_requests').update({status:'cancelled',cancelled_at:now,updated_at:now}).eq('id',id);if(u.error)throw u.error;await db.from('stip_notifications').delete().eq('agent_id',c.agent.id).eq('action_id',id);return{ok:true}}
async function dismissNotification(c:any,b:any){const id=text(b.notification_id,80);if(!id)throw Error('NOTIFICATION_REQUISE');const q=await db.from('stip_notifications').delete().eq('id',id).eq('agent_id',c.agent.id).select('id').maybeSingle();if(q.error)throw q.error;if(!q.data)throw Error('NOTIFICATION_INTROUVABLE');return{ok:true}}

function parisStamp(d=new Date()){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d),g=(k:string)=>p.find(x=>x.type===k)?.value||'';return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`}
function parisDateOf(v:any){const d=new Date(v||Date.now());if(Number.isNaN(d.getTime()))return text(v,10).slice(0,10);const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),g=(k:string)=>p.find(x=>x.type===k)?.value||'';return `${g('year')}-${g('month')}-${g('day')}`}
function parisTimeOf(v:any){const d=new Date(v||'');if(Number.isNaN(d.getTime()))return'';const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d),g=(k:string)=>p.find(x=>x.type===k)?.value||'';return `${g('hour')}:${g('minute')}`}
function lastClock(v:any){const s=String(v||''),out:string[]=[];for(const m of s.matchAll(/(?:^|\D)([01]?\d|2[0-3])(?:[:hH.])([0-5]\d)(?!\d)/g))out.push(`${String(+m[1]).padStart(2,'0')}:${m[2]}`);return out.at(-1)||''}
function localPlus(date:string,clock:string,minutes=60){const safe=/^\d{2}:\d{2}$/.test(clock)?clock:'18:00',d=new Date(`${date}T${safe}:00Z`);d.setUTCMinutes(d.getUTCMinutes()+minutes);return d.toISOString().slice(0,16)}
const refNorm=(v:any)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('fr-FR').replace(/[^A-Z0-9]+/g,' ').trim()
function referentMatches(v:any,a:any){const q=refNorm(v);if(!q)return false;const vals=[a?.source_key,a?.prenom,a?.nom,[a?.prenom,a?.nom].filter(Boolean).join(' '),[a?.nom,a?.prenom].filter(Boolean).join(' ')].map(refNorm);const parts=String(a?.source_key||'').split('_').filter(Boolean);if(parts.length)vals.push(refNorm(parts.at(-1)));return String(v||'').split(/\s*(?:\+|\/|;|&|\bet\b)\s*/i).map(refNorm).filter(Boolean).some((x:string)=>vals.includes(x))}
async function eventFeedbackList(c:any){const q=await db.from('stip_event_feedback').select('event_key,attendance,rating,follow_up,custom_answer,submitted_at').eq('agent_id',c.agent.id).order('submitted_at',{ascending:false}).limit(200);if(q.error)throw q.error;return q.data||[]}
async function feedbackEvent(c:any,eventKey:string){
  const m=eventKey.match(/^(agenda|formation|stagiaire):([0-9a-f-]{36})$/i);if(!m)throw Error('EVENEMENT_RETOUR_INVALIDE');
  const kind=m[1].toLowerCase(),id=m[2];
  if(kind==='agenda'){
    const q=await db.from('stip_agent_agenda_items').select('id,title,event_date,start_time,end_time,all_day,location,event_kind,source_type,feedback_enabled,feedback_question,status').eq('id',id).eq('agent_id',c.agent.id).maybeSingle();if(q.error)throw q.error;const x:any=q.data;if(!x||x.status!=='active')throw Error('EVENEMENT_INTROUVABLE');if(x.feedback_enabled===false)throw Error('RETOUR_NON_REQUIS');const date=String(x.event_date||'').slice(0,10),clock=x.all_day?'18:00':text(x.end_time,8).slice(0,5)||text(x.start_time,8).slice(0,5)||'18:00';return{key:eventKey,type:'agenda',title:text(x.title,180),date,endDate:date,time:x.all_day?'Toute la journée':[text(x.start_time,8).slice(0,5),text(x.end_time,8).slice(0,5)].filter(Boolean).join('–'),location:text(x.location,240),question:text(x.feedback_question,240),sensitive:x.source_type==='mobi_lit_medical'||/médical|medical/i.test(String(x.title||'')),due:localPlus(date,clock,60)}}
  if(kind==='formation'){
    const q=await db.from('formations').select('id,agent_source_key,intitule,date_debut,date_fin,lieu,horaire,statut').eq('id',id).eq('agent_source_key',c.agent.source_key).maybeSingle();if(q.error)throw q.error;const x:any=q.data;if(!x)throw Error('EVENEMENT_INTROUVABLE');const date=parisDateOf(x.date_debut),endDate=parisDateOf(x.date_fin||x.date_debut),fromTs=parisTimeOf(x.date_fin||'');const clock=lastClock(x.horaire)||(fromTs&&fromTs!=='00:00'?fromTs:'18:00');return{key:eventKey,type:'formation',title:text(x.intitule,180)||'Formation',date,endDate,time:text(x.horaire,120),location:text(x.lieu,240),question:'',due:localPlus(endDate,clock,60)}}
  const q=await db.from('stagiaires').select('id,nom,prenom,date_debut,date_fin,horaires,referent').eq('id',id).maybeSingle();if(q.error)throw q.error;const x:any=q.data;if(!x||!referentMatches(x.referent,c.agent))throw Error('EVENEMENT_INTROUVABLE');const date=String(x.date_debut||'').slice(0,10),endDate=String(x.date_fin||x.date_debut||'').slice(0,10),clock=lastClock(x.horaires)||'18:00';return{key:eventKey,type:'stagiaire',title:[text(x.prenom,80),text(x.nom,120)].filter(Boolean).join(' ')||'Stagiaire',date,endDate,time:text(x.horaires,120),location:'',question:'',due:localPlus(endDate,clock,60)}
}
async function submitEventFeedback(c:any,b:any){const eventKey=text(b.event_key,180),attendance=text(b.attendance,20),rating=attendance==='absent'?null:Number(b.rating),follow=typeof b.follow_up==='boolean'?b.follow_up:null,custom=text(b.custom_answer,20)||null,note=text(b.note,500)||null;if(!['absent','problem','ok'].includes(attendance))throw Error('RETOUR_PRESENCE_REQUISE');if(attendance!=='absent'&&(!Number.isInteger(rating)||rating<1||rating>5))throw Error('RETOUR_NOTE_REQUISE');if(follow===null)throw Error('RETOUR_SUIVI_REQUIS');const ev=await feedbackEvent(c,eventKey);if(parisStamp()<ev.due)throw Error('RETOUR_TROP_TOT');if(attendance!=='absent'&&ev.question&&!['yes','no'].includes(custom||''))throw Error('RETOUR_QUESTION_REQUISE');const payload={agent_id:c.agent.id,event_key:eventKey,event_type:ev.type,attendance,rating,follow_up:follow,custom_answer:custom,note:ev.sensitive?null:note,event_snapshot:{title:ev.title,date:ev.date,end_date:ev.endDate,time:ev.time,location:ev.location,type:ev.type},submitted_at:new Date().toISOString(),updated_at:new Date().toISOString()},q=await db.from('stip_event_feedback').upsert(payload,{onConflict:'agent_id,event_key'}).select('event_key,attendance,rating,follow_up,custom_answer,note,submitted_at').single();if(q.error)throw q.error;return q.data}

function validEmail(v:any){const s=text(v,320).toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:''}
function shiftBase(v:any){const c=text(v,24).toUpperCase().replace(/\*+$/,'');if(/^J4/.test(c))return'J4';if(/^M/.test(c))return'M';if(/^J/.test(c))return'J';if(/^S/.test(c))return'S';if(/^N/.test(c))return'N';return c}
function mailDate(v:any){const s=text(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s;return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(s+'T12:00:00+02:00'))}
function personName(a:any,f='Agent'){return [text(a?.prenom,80),text(a?.nom,120)].filter(Boolean).join(' ').trim()||f}
function mailDraft(c:any,ev:any,attendance:string){
  const date=mailDate(ev.endDate||ev.date),name=personName(c.agent),sensitive=!!ev.sensitive;
  let subject='',body='';
  if(sensitive){
    subject=`Suite administrative · ${date}`;
    if(attendance==='absent')body=`Bonjour,\n\nJe n’ai pas pu être présent au rendez-vous prévu le ${date}. Pouvez-vous m’indiquer la démarche à suivre pour régulariser la situation ou le reprogrammer si nécessaire ?\n\nMerci par avance pour votre retour.\n\nCordialement,\n${name}`;
    else if(attendance==='problem')body=`Bonjour,\n\nÀ la suite de mon rendez-vous du ${date}, une suite administrative est nécessaire. Pouvez-vous m’indiquer la prochaine démarche à effectuer ?\n\nMerci par avance pour votre retour.\n\nCordialement,\n${name}`;
    else body=`Bonjour,\n\nMon rendez-vous du ${date} s’est bien déroulé. Une suite administrative reste toutefois nécessaire. Pouvez-vous m’indiquer la prochaine étape à effectuer ?\n\nMerci par avance pour votre retour.\n\nCordialement,\n${name}`;
  }else{
    subject=`Suite · ${text(ev.title,120)||'Événement'} · ${date}`;
    if(attendance==='absent')body=`Bonjour,\n\nJe n’ai pas pu être présent à « ${text(ev.title,180)} » prévu le ${date}. Je souhaite savoir quelle démarche effectuer pour régulariser la situation ou reprogrammer si nécessaire.\n\nMerci par avance pour votre retour.\n\nCordialement,\n${name}`;
    else if(attendance==='problem')body=`Bonjour,\n\nÀ la suite de « ${text(ev.title,180)} » du ${date}, un point nécessite un suivi. Pouvez-vous m’indiquer la démarche à effectuer ou la personne à contacter pour finaliser la suite ?\n\nMerci par avance pour votre retour.\n\nCordialement,\n${name}`;
    else body=`Bonjour,\n\n« ${text(ev.title,180)} » du ${date} s’est bien déroulé. Une suite reste toutefois nécessaire. Pouvez-vous m’indiquer la prochaine étape à effectuer ?\n\nMerci par avance pour votre retour.\n\nCordialement,\n${name}`;
  }
  return{subject,body};
}
async function eventMailCandidates(c:any,ev:any){
  const current=await db.from('agents').select('id,source_key,nom,prenom,email,ghe,role').eq('id',c.agent.id).maybeSingle();if(current.error)throw current.error;
  let replyTo=validEmail(current.data?.email);
  if(!replyTo){
    const ownContact=await db.from('contacts_ghe').select('email_pro').eq('source_key',c.agent.source_key).eq('actif',true).maybeSingle();
    replyTo=validEmail(ownContact.data?.email_pro);
  }
  const byEmail=new Map<string,any>(),add=(x:any)=>{
    const email=validEmail(x.email);if(!email||email===replyTo)return;
    const old=byEmail.get(email);
    if(old){old.recommended=old.recommended||!!x.recommended;if(!old.reason.includes(x.reason))old.reason+=` · ${x.reason}`;return}
    byEmail.set(email,{email,name:text(x.name,180)||email,role:text(x.role,180),kind:text(x.kind,40),reason:text(x.reason,180),recommended:!!x.recommended});
  };
  const cq=await db.from('contacts_ghe').select('source_key,categorie,ghe,nom,prenom,email_pro,role_metier').eq('actif',true);if(cq.error)throw cq.error;
  for(const x of cq.data||[]){
    const role=text(x.role_metier,180),cat=text(x.categorie,80).toLowerCase();
    if(!(cat==='chef'||/cadre|responsable|chef/i.test(role)))continue;
    const sameGhe=!x.ghe||!c.agent.ghe||String(x.ghe)===String(c.agent.ghe);
    add({email:x.email_pro,name:personName(x,role||'Encadrement'),role:role||(/chef/.test(cat)?'Chef d’équipe':'Encadrement'),kind:'encadrement',reason:/cadre/i.test(role)?'Cadre':/responsable/i.test(role)?'Responsable':cat==='chef'?'Chef d’équipe':'Encadrement',recommended:sameGhe});
  }
  const aq=await db.from('agents').select('id,source_key,nom,prenom,email,ghe,role').eq('actif',true);if(aq.error)throw aq.error;
  for(const x of aq.data||[]){
    const role=text(x.role,180);
    if(!/cadre|responsable|chef/i.test(role))continue;
    const sameGhe=!x.ghe||!c.agent.ghe||String(x.ghe)===String(c.agent.ghe);
    add({email:x.email,name:personName(x),role,kind:'encadrement',reason:/cadre/i.test(role)?'Cadre':/responsable/i.test(role)?'Responsable':'Chef d’équipe',recommended:sameGhe});
  }
  if(!ev.sensitive){
    const date=text(ev.endDate||ev.date,10),selfPlan=await db.from('planning').select('code,equipe').eq('agent_id',c.agent.id).eq('date',date).maybeSingle();if(selfPlan.error)throw selfPlan.error;
    const base=shiftBase(selfPlan.data?.code),team=text(selfPlan.data?.equipe,80);
    if(base||team){
      const pq=await db.from('planning').select('code,equipe,agent_id,agents(id,source_key,nom,prenom,email,ghe,role)').eq('date',date);if(pq.error)throw pq.error;
      for(const row of pq.data||[]){
        const a:any=row.agents;if(!a||String(a.id)===String(c.agent.id))continue;
        const sameBase=base&&shiftBase(row.code)===base,sameTeam=team&&String(row.equipe||'')===team;
        if(!sameBase&&!sameTeam)continue;
        add({email:a.email,name:personName(a),role:text(a.role,180)||'Agent',kind:'shift',reason:sameBase?`Même shift ${base}`:'Même équipe',recommended:!!sameBase});
      }
    }
  }
  const order=(x:any)=>x.kind==='encadrement'?(x.recommended?0:1):(x.recommended?2:3);
  return{reply_to:replyTo,candidates:[...byEmail.values()].sort((a,b)=>order(a)-order(b)||a.name.localeCompare(b.name,'fr')).slice(0,24)};
}
async function eventMailContext(c:any,b:any){
  const eventKey=text(b.event_key,180),attendance=text(b.attendance,20);
  if(!['absent','problem','ok'].includes(attendance))throw Error('RETOUR_PRESENCE_REQUISE');
  const ev=await feedbackEvent(c,eventKey),recipients=await eventMailCandidates(c,ev),draft=mailDraft(c,ev,attendance);
  return{event:{event_key:eventKey,title:ev.title,date:ev.date,end_date:ev.endDate,sensitive:!!ev.sensitive},sender:{display_name:personName(c.agent),reply_to:recipients.reply_to||null,from:STIP_MAIL_FROM||null},direct_send:Boolean(RESEND_API_KEY&&STIP_MAIL_FROM),candidates:recipients.candidates,draft};
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
async function managerEventFeedback(c:any){requireResp(c);const q=await db.from('stip_event_feedback').select('id,event_key,event_type,attendance,rating,follow_up,custom_answer,note,event_snapshot,submitted_at,agent:agents!stip_event_feedback_agent_id_fkey(id,source_key,nom,prenom,equipe,ghe)').order('submitted_at',{ascending:false}).limit(160);if(q.error)throw q.error;return q.data||[]}
async function managerAgents(c:any){requireResp(c);const q=await db.from('agents').select('id,source_key,nom,prenom,equipe,type_planning,role,ghe,telephone').eq('actif',true).order('nom');if(q.error)throw q.error;return q.data||[]}
async function managerAgendaList(c:any){requireResp(c);const q=await db.from('stip_agent_agenda_items').select('*,agent:agents!stip_agent_agenda_items_agent_id_fkey(id,source_key,nom,prenom,equipe,ghe)').eq('created_by_agent_id',c.agent.id).eq('status','active').gte('event_date',parisDay(-1)).order('event_date').order('start_time').limit(120);if(q.error)throw q.error;return q.data||[]}
async function managerAgendaCancel(c:any,b:any){requireResp(c);const id=text(b.id,80),now=new Date().toISOString();const q=await db.from('stip_agent_agenda_items').update({status:'cancelled',updated_at:now}).eq('id',id).eq('created_by_agent_id',c.agent.id).eq('status','active').select('id').maybeSingle();if(q.error)throw q.error;if(!q.data)throw Error('ELEMENT_INTROUVABLE');return{ok:true}}
async function managerList(c:any){requireResp(c);const q=await db.from('stip_action_requests').select('*,target:agents!stip_action_requests_target_agent_id_fkey(id,nom,prenom,source_key,equipe,role)').eq('requester_agent_id',c.agent.id).eq('status','pending').order('updated_at',{ascending:false}).limit(60);if(q.error)throw q.error;return q.data||[]}
async function managerRemind(c:any,b:any){requireResp(c);const id=text(b.action_id,80),q=await db.from('stip_action_requests').select('*').eq('id',id).eq('requester_agent_id',c.agent.id).maybeSingle();if(q.error)throw q.error;if(!q.data||q.data.status!=='pending')throw Error('ACTION_NON_RELANCABLE');const now=new Date().toISOString(),count=Number(q.data.reminder_count||0)+1,u=await db.from('stip_action_requests').update({reminder_count:count,last_reminded_at:now,updated_at:now}).eq('id',id).select('*').single();if(u.error)throw u.error;await db.from('stip_notifications').insert({agent_id:q.data.target_agent_id,type:'action_reminder',title:'Rappel',body:q.data.title,action_id:id,source_type:q.data.source_type,source_ref:q.data.source_ref});return u.data}
async function managerCancel(c:any,b:any){requireResp(c);const id=text(b.action_id,80),q=await db.from('stip_action_requests').select('*').eq('id',id).eq('requester_agent_id',c.agent.id).maybeSingle();if(q.error)throw q.error;if(!q.data||q.data.status!=='pending')throw Error('ACTION_NON_ANNULABLE');const now=new Date().toISOString();if(q.data.source_type==='evaluation_signature'&&q.data.source_ref){const r=await db.from('stip_evaluation_signature_requests').update({status:'cancelled',cancelled_at:now,updated_at:now}).eq('id',q.data.source_ref).eq('status','pending').select('id').maybeSingle();if(r.error)throw r.error}else{const u=await db.from('stip_action_requests').update({status:'cancelled',cancelled_at:now,updated_at:now}).eq('id',id).eq('status','pending').select('id').maybeSingle();if(u.error)throw u.error}await db.from('stip_notifications').delete().eq('action_id',id);return{ok:true}}

Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req).h});try{const c=await ctx(req),b=await req.json().catch(()=>({})),a=text(b.action,80);if(a==='home')return json(req,{agent:c.agent,permissions:c.profile.permissions,actions:await listActions(c),notifications:await notifications(c),event_feedback:await eventFeedbackList(c)});if(a==='list')return json(req,{actions:await listActions(c)});if(a==='get')return json(req,{action:await actionDetail(c,text(b.action_id,80))});if(a==='submit_signature')return json(req,{ok:true,signature:await submitSignature(c,b)});if(a==='notifications')return json(req,{notifications:await notifications(c)});if(a==='dismiss_notification')return json(req,{ok:true,result:await dismissNotification(c,b)});if(a==='event_feedback_list')return json(req,{items:await eventFeedbackList(c)});if(a==='event_feedback_submit')return json(req,{ok:true,item:await submitEventFeedback(c,b)});if(a==='event_mail_context')return json(req,{ok:true,...await eventMailContext(c,b)});if(a==='event_mail_send')return json(req,{ok:true,result:await sendEventMail(c,b)});if(a==='accept_agenda')return json(req,{ok:true,item:await acceptAgenda(c,b)});if(a==='decline_agenda')return json(req,{ok:true,result:await declineAgenda(c,b)});if(a==='create')return json(req,{ok:true,action:await createAction(c,b)});if(a==='send_notification')return json(req,{ok:true,notification:await sendNotification(c,b)});if(a==='agenda_direct')return json(req,{ok:true,item:await agendaDirect(c,b)});if(a==='agenda_propose')return json(req,{ok:true,action:await agendaPropose(c,b)});if(a==='manager_agents')return json(req,{agents:await managerAgents(c)});if(a==='manager_agenda_list')return json(req,{items:await managerAgendaList(c)});if(a==='manager_agenda_cancel')return json(req,{ok:true,result:await managerAgendaCancel(c,b)});if(a==='manager_list')return json(req,{actions:await managerList(c)});if(a==='manager_remind')return json(req,{ok:true,action:await managerRemind(c,b)});if(a==='manager_cancel')return json(req,{ok:true,action:await managerCancel(c,b)});if(a==='manager_event_feedback')return json(req,{items:await managerEventFeedback(c)});return json(req,{error:'ACTION_INVALIDE'},400)}catch(e){const m=errText(e);return json(req,{error:m},/SESSION/.test(m)?401:/ACCES/.test(m)?403:400)}})
