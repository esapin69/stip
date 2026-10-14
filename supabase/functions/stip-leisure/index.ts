import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type,x-stip-session','Access-Control-Allow-Methods':'POST,OPTIONS'}
const J=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...C,'Content-Type':'application/json','Cache-Control':'no-store'}})
const text=(v:unknown,n=1000)=>String(v??'').trim().slice(0,n)
const uuid=(v:unknown)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||''))
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
async function checked(q:any){const r=await q;if(r.error)throw r.error;return r.data}

async function notifyPhone(target:string,kind:'leisure_invite'|'leisure_response',eventId:string,title:string,summary:string){
 try{
  if(!uuid(target)||!uuid(eventId))return;
  const [type,pref,sub]=await Promise.all([
   checked(db.from('stip_notification_types').select('active,push_enabled,default_user_enabled').eq('event_key',kind).maybeSingle()),
   checked(db.from('stip_notification_preferences').select('enabled').eq('agent_id',target).eq('event_key',kind).maybeSingle()),
   checked(db.from('stip_push_subscriptions').select('id').eq('agent_id',target).eq('active',true).limit(1))
  ]);
  if(!type?.active||!type.push_enabled||(pref?.enabled??type.default_user_enabled)===false)return;
  if(!sub?.length){console.info('leisure push: no active device subscription',kind);return;}
  const URL=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const response=await fetch(URL+'/functions/v1/stip-push',{
   method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+SERVICE},
   body:JSON.stringify({action:'send_internal',agent_id:target,payload:{
    event_key:kind,title:text(title,90),body:text(summary,140),
    url:'/sorties-loisirs.html?event='+encodeURIComponent(eventId)+'#leisureApp',
    tag:'stip-'+kind+'-'+eventId
   }})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.error||!result.sent)console.warn('leisure push not delivered',kind,response.status,result.error||'0 device');
 }catch(error){console.error('leisure push failure',kind,error)}
}

async function context(req:Request){
 const raw=req.headers.get('x-stip-session')||'';if(!raw||raw.length>256)throw Error('SESSION_STIP_REQUISE')
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('')
 const s=await checked(db.from('stip_access_sessions').select('profile_id,expires_at,revoked_at').eq('token_hash',hash).maybeSingle())
 if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())throw Error('SESSION_EXPIREE')
 const p=await checked(db.from('stip_access_profiles').select('id,agent_id,active,permissions,role_key').eq('id',s.profile_id).maybeSingle())
 if(!p?.active)throw Error('ACCES_DESACTIVE')
 const perms=p.permissions||{};if(perms.leisure===false||!(perms.leisure===true||perms.messages||perms.planning_team||perms.admin))throw Error('ACCES_EQUIPE_REQUIS')
 const family=perms.communication_family==='hors_brancardage'?'hors_brancardage':'brancardage'
 return {...p,family,isAdmin:perms.admin===true}
}
async function photo(raw:unknown){
 const value=text(raw,2000),marker='/storage/v1/object/public/planning-pdf/'
 if(!value.includes(marker))return value
 const path=decodeURIComponent(value.split(marker)[1]?.split('?')[0]||'')
 if(!path)return ''
 const {data}=await db.storage.from('planning-pdf').createSignedUrl(path,3600)
 return data?.signedUrl||''
}

function shiftCode(raw:string){
 const cleaned=String(raw||'').trim().toUpperCase().replace(/\s+/g,'').replace(/[*★☆✱✳✶✷✸✹✺✻✼✽✾✿]+$/u,'');
 if(/^J4\d+$/.test(cleaned))return 'J4';
 if(/^[MJSN]\d+$/.test(cleaned))return cleaned[0];
 return cleaned;
}
const minutes=(s:string)=>{const [h,m]=s.split(':').map(Number);return h*60+m};
const plusDays=(date:string,count:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10)};
async function colleagues(c:any){
 if(!c.agent_id) return [];
 const profiles=await checked(db.from('stip_access_profiles').select('agent_id,active,permissions,agent:agents(id,prenom,nom)').eq('active',true).not('agent_id','is',null))||[];
 const seen=new Set<string>();
 return profiles.filter((p:any)=>{
  const family=p.permissions?.communication_family==='hors_brancardage'?'hors_brancardage':'brancardage';
  const ok=family===c.family && p.agent_id!==c.agent_id && p.permissions?.leisure!==false && !seen.has(p.agent_id);
  if(ok)seen.add(p.agent_id);return ok;
 }).map((p:any)=>({id:p.agent_id,name:[p.agent?.prenom,p.agent?.nom].filter(Boolean).join(' ').trim()||'Collègue'}))
 .sort((a:any,b:any)=>a.name.localeCompare(b.name,'fr'));
}
async function matches(c:any,target:string){
 if(!c.agent_id||!uuid(target)||target===c.agent_id)throw Error('COLLEGUE_INVALIDE');
 const colleaguesList=await colleagues(c);
 const peer=colleaguesList.find((p:any)=>p.id===target);
 if(!peer)throw Error('COLLEGUE_INDISPONIBLE');
 const from=today(),to=plusDays(from,31);
 const [myRows,otherRows,shiftDefs]=await Promise.all([
  checked(db.from('planning').select('date,code').eq('agent_id',c.agent_id).gte('date',from).lte('date',to)),
  checked(db.from('planning').select('date,code').eq('agent_id',target).gte('date',from).lte('date',to)),
  checked(db.from('stip_shift_registry').select('code,end_time,window_end,schedule_mode,is_working').eq('is_working',true))
 ]);
 const shifts=new Map((shiftDefs||[]).map((x:any)=>[x.code,x.schedule_mode==='flexible'?null:x.schedule_mode==='fixed'?x.window_end:x.end_time]));
 const resolveEnd=(raw:string)=>shifts.has(raw)?shifts.get(raw):shifts.get(shiftCode(raw));
 const other=new Map((otherRows||[]).map((x:any)=>[x.date,x.code]));
 const days:any[]=[];
 for(const row of myRows||[]){
  const myEnd=resolveEnd(row.code) as string|undefined;
  const hisEnd=resolveEnd(String(other.get(row.date)||'')) as string|undefined;
  if(!myEnd||!hisEnd)continue;
  const delta=Math.abs(minutes(myEnd)-minutes(hisEnd));
  if(delta>30)continue;
  days.push({date:row.date,my_end:myEnd.slice(0,5),peer_end:hisEnd.slice(0,5),minutes_apart:delta});
 }
 days.sort((a,b)=>a.date.localeCompare(b.date));
 return {colleague:peer,days:days.slice(0,12)};
}


async function ownCalendar(c:any){
 if(!c.agent_id)throw Error('ACCES_AGENT_REQUIS');
 const from=today(),to=plusDays(from,123);
 const [planning,registry]=await Promise.all([
  checked(db.from('planning').select('date,code').eq('agent_id',c.agent_id).gte('date',from).lte('date',to)),
  checked(db.from('stip_shift_registry').select('code,label,icon,color_hex,soft_color_hex,on_color_hex,is_working').eq('active',true))
 ]);
 const rules=new Map<string,any>((registry||[]).map((r:any)=>[r.code,r]));
 const own=new Map<string,string>((planning||[]).map((r:any)=>[r.date,r.code]));
 const days:any[]=[];
 for(let date=from;date<=to;date=plusDays(date,1)){
  const code=own.get(date)||'',shift=rules.get(code)||rules.get(shiftCode(code));
  days.push({date,code,icon:shift?.icon||'·',label:shift?.label||'Non renseigné',
    color:shift?.color_hex||'#839299',soft_color:shift?.soft_color_hex||'#f0f4f5',
    on_color:shift?.on_color_hex||'#fff',is_working:shift?.is_working??null});
 }
 return {days,colleagues:await colleagues(c),max_dates:62};
}
async function createActivity(c:any,b:any){
 if(!c.agent_id)throw Error('ACCES_AGENT_REQUIS');
 const title=text(b.title,120),selected=dates(b.dates);
 if(!title||selected.length<1||selected.length>24||selected.some((d:string)=>d<today()))throw Error('DATES_INVALIDES');
 const guests=Array.isArray(b.agent_ids)?[...new Set(b.agent_ids)]:[];
 if(guests.length>120||guests.some((id:any)=>!uuid(id)||id===c.agent_id))throw Error('COLLEGUES_INVALIDES');
 const accessible=new Set((await colleagues(c)).map((a:any)=>a.id));
 if(guests.some((id:any)=>!accessible.has(id)))throw Error('COLLEGUE_INDISPONIBLE');
 const visibility=b.visibility==='team'?'team':'invite';
 if(visibility==='invite'&&!guests.length)throw Error('CHOISIR_INVITES_OU_OUVRIR');
 const event=await checked(db.from('stip_leisure_events').insert({
  title,description:text(b.description,2000),location:text(b.location,240),time_label:text(b.time_label,240),
  dates:selected,family:c.family,organizer_agent_id:c.agent_id,visibility
 }).select('id').single());
 try{
  await checked(db.rpc('stip_leisure_sync_series_chat',{p_event:event.id}));
  if(guests.length){
   await checked(db.from('stip_leisure_invites').insert(guests.map((agent_id:any)=>({event_id:event.id,agent_id,invited_by:c.agent_id,status:'pending'}))));
   await checked(db.from('stip_notifications').insert(guests.map((agent_id:any)=>({
     agent_id,type:'leisure_invite',title:'Invitation à une activité',body:title,source_type:'stip_leisure_events',source_ref:event.id
   }))));
   await Promise.allSettled(guests.map((id:any)=>notifyPhone(id,'leisure_invite',event.id,'Invitation à une activité',title)));
  }
 }catch(error){
  try{await checked(db.rpc('stip_leisure_delete_event',{p_event:event.id,p_actor:c.agent_id,p_family:c.family}))}
  catch(cleanup){console.error('event cleanup failed',cleanup)}
  throw error;
 }
 return {ok:true,id:event.id,...await list(c)};
}

async function closingDates(actor:string,closeTime='21:00'){
 const from=today(),to=plusDays(from,31);
 const [rows,registry]=await Promise.all([
  checked(db.from('planning').select('date,code').eq('agent_id',actor).gte('date',from).lte('date',to)),
  checked(db.from('stip_shift_registry').select('code,end_time,window_end,schedule_mode,is_working').eq('is_working',true))
 ]);
 const rules=new Map((registry||[]).map((d:any)=>[d.code,d]));
 return (rows||[]).filter((r:any)=>{
  const d:any=rules.get(r.code)||rules.get(shiftCode(r.code));
  return !!d&&d.is_working&&['standard','fixed'].includes(d.schedule_mode)
   &&String(d.schedule_mode==='fixed'?d.window_end:d.end_time).slice(0,5)===closeTime;
 }).map((r:any)=>r.date).sort();
}
async function recurringCreate(c:any,b:any){
 if(!c.agent_id||!Array.isArray(b.agent_ids))throw Error('INVITATION_INVALIDE');
 const invited=[...new Set(b.agent_ids)];
 if(!invited.length||invited.length>100||invited.some((id:any)=>!uuid(id)||id===c.agent_id))throw Error('COLLEGUES_INVALIDES');
 const known=new Set((await colleagues(c)).map((x:any)=>x.id));
 if(invited.some((id:any)=>!known.has(id)))throw Error('COLLEGUE_INDISPONIBLE');
 const name=text(b.title,120)||'Muscu après la fermeture',location=text(b.location,240);
 const timeLabel=text(b.time_label,240)||'Après la fermeture · 21 h 20';
 const days=(await closingDates(c.agent_id)).slice(0,24);
 if(!days.length)throw Error('AUCUNE_FERMETURE_DANS_LE_PLANNING');
 const candidates=await checked(db.from('stip_leisure_events')
  .select('id').eq('organizer_agent_id',c.agent_id).eq('family',c.family)
  .eq('status','active').eq('visibility','invite').eq('title',name).order('created_at',{ascending:false}).limit(30))||[];
 const candidateIds=candidates.map((r:any)=>r.id);
 const repeats=candidateIds.length?await checked(db.from('stip_leisure_recurring').select('event_id').eq('active',true).in('event_id',candidateIds)):[];
 if(repeats?.length)throw Error('ENTRAINEMENT_RECURRENT_EXISTANT');
 const event=await checked(db.from('stip_leisure_events').insert({
  title:name,description:text(b.description,2000)||'Entraînement libre après mon service du soir. Chacun choisit ses dates.',
  location,time_label:timeLabel,dates:days,family:c.family,organizer_agent_id:c.agent_id,visibility:'invite'
 }).select('id').single());
 try{
  await checked(db.from('stip_leisure_recurring').insert({event_id:event.id,closing_time:'21:00'}));
  await checked(db.rpc('stip_leisure_refresh_recurring'));
  await checked(db.rpc('stip_leisure_sync_series_chat',{p_event:event.id}));
  await checked(db.from('stip_leisure_invites').insert(invited.map((agent_id:any)=>({
   event_id:event.id,agent_id,invited_by:c.agent_id,status:'pending'
  }))));
  await checked(db.from('stip_notifications').insert(invited.map((agent_id:any)=>({
   agent_id,type:'leisure_invite',title:'Invitation aux entraînements',
   body:name+' · tous mes jours de fermeture',source_type:'stip_leisure_events',source_ref:event.id
  }))));
  await Promise.allSettled(invited.map((agent_id:any)=>notifyPhone(agent_id,'leisure_invite',event.id,'Entraînements après le travail',name)));
 }catch(error){
  try{await checked(db.rpc('stip_leisure_delete_event',{p_event:event.id,p_actor:c.agent_id,p_family:c.family}));}
  catch(cleanup){console.error('recurring create rollback failed',cleanup)}
  throw error;
 }
 return {ok:true,id:event.id,...await list(c)};
}
async function recurringToggle(c:any,b:any){
 if(!c.agent_id||!uuid(b.event_id)||typeof b.date!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(b.date)||typeof b.available!=='boolean')throw Error('DISPONIBILITE_INVALIDE');
 const e=await checked(db.from('stip_leisure_events').select('id,dates,organizer_agent_id,status,family').eq('id',b.event_id).eq('family',c.family).maybeSingle());
 const r=await checked(db.from('stip_leisure_recurring').select('event_id,excluded_dates,active').eq('event_id',b.event_id).maybeSingle());
 if(!e||!r?.active||e.status!=='active'||e.organizer_agent_id!==c.agent_id||!e.dates.includes(b.date)||b.date<today())throw Error('ACCES_ORGANISATEUR_REQUIS');
 const affected=!b.available?await checked(db.from('stip_leisure_responses')
   .select('agent_id,selected_dates').eq('event_id',b.event_id).contains('selected_dates',[b.date])):[];
 const absent=new Set<string>(r.excluded_dates||[]);
 if(b.available)absent.delete(b.date);else absent.add(b.date);
 await checked(db.from('stip_leisure_recurring').update({excluded_dates:[...absent].sort()}).eq('event_id',b.event_id));
 await checked(db.rpc('stip_leisure_refresh_recurring'));
 if(!b.available&&affected?.length){
  await Promise.allSettled(affected.filter((x:any)=>x.agent_id!==c.agent_id)
   .map((x:any)=>notifyPhone(x.agent_id,'leisure_invite',b.event_id,
      'Séance annulée', 'L’organisateur est indisponible le '+b.date+'. Consulte les autres dates.')));
 }
 return {ok:true,...await list(c)};
}
async function recurringStop(c:any,b:any){
 if(!c.agent_id||!uuid(b.event_id))throw Error('SORTIE_INVALIDE');
 const e=await checked(db.from('stip_leisure_events').select('id,organizer_agent_id,family').eq('id',b.event_id).eq('family',c.family).maybeSingle());
 if(!e||e.organizer_agent_id!==c.agent_id)throw Error('ACCES_ORGANISATEUR_REQUIS');
 await checked(db.from('stip_leisure_recurring').update({active:false}).eq('event_id',e.id));
 await checked(db.from('stip_leisure_events').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',e.id));
 return {ok:true,...await list(c)};
}

async function endSchedules(agentIds:string[],from:string,to:string){
 const unique=[...new Set(agentIds.filter(Boolean))];const result=new Map<string,Map<string,string>>();
 if(!unique.length)return result;
 const [rows,defs]=await Promise.all([
  checked(db.from('planning').select('agent_id,date,code').in('agent_id',unique).gte('date',from).lte('date',to)),
  checked(db.from('stip_shift_registry').select('code,end_time,window_end,schedule_mode,is_working').eq('is_working',true))
 ]);
 const shifts=new Map((defs||[]).map((r:any)=>[r.code,r]));
 for(const row of rows||[]){
  const def:any=shifts.get(row.code)||shifts.get(shiftCode(row.code));
  if(!def||def.schedule_mode==='flexible')continue;
  const time=String((def.schedule_mode==='fixed'?def.window_end:def.end_time)||'').slice(0,5);
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))continue;
  if(!result.has(row.agent_id))result.set(row.agent_id,new Map());
  result.get(row.agent_id)!.set(row.date,time);
 }
 return result;
}
function compatibleDates(e:any,viewer:string,ends:Map<string,Map<string,string>>){
 if(e.schedule_mode!=='afterwork')return e.dates||[];
 const own=ends.get(e.organizer_agent_id)||new Map();
 const peer=ends.get(viewer)||new Map();
 return (e.dates||[]).filter((day:string)=>!!own.get(day) &&
  (e.organizer_agent_id===viewer||own.get(day)===peer.get(day)));
}
async function list(c:any){
 await checked(db.rpc('stip_leisure_refresh_recurring'));
 const events=await checked(db.from('stip_leisure_events').select('*').eq('family',c.family).order('created_at',{ascending:false}).limit(200))||[]

 const personalInvites=c.agent_id?await checked(db.from('stip_leisure_invites').select('event_id,status').eq('agent_id',c.agent_id))||[]:[];
 const invited=new Map(personalInvites.map((r:any)=>[r.event_id,r.status]));
 const visibleEvents=events.filter((e:any)=>e.visibility!=='invite'||e.organizer_agent_id===c.agent_id||invited.has(e.id));
 events.splice(0,events.length,...visibleEvents);
 const ids=events.map((e:any)=>e.id)
 const allInvitations=ids.length?await checked(db.from('stip_leisure_invites')
  .select('event_id,agent_id,status,agent:agents!stip_leisure_invites_agent_id_fkey(id,prenom,nom)').in('event_id',ids)):[] 
 const afterEvents=events.filter((e:any)=>e.schedule_mode==='afterwork'&&e.status==='active');
 const afterIds=new Set(afterEvents.map((e:any)=>e.id));
 // Dates compatibles calculées pour CHAQUE invité, pas seulement l'organisateur.
 const ends=afterEvents.length&&c.agent_id?await endSchedules(
  [c.agent_id,...afterEvents.map((e:any)=>e.organizer_agent_id),
   ...(allInvitations||[]).filter((x:any)=>afterIds.has(x.event_id)).map((x:any)=>x.agent_id)],
  today(),plusDays(today(),123)):new Map<string,Map<string,string>>();
 const recurring=ids.length?await checked(db.from('stip_leisure_recurring').select('event_id,active,excluded_dates,closing_time').in('event_id',ids)):[];
 const recurringById=new Map((recurring||[]).map((x:any)=>[x.event_id,x]));
 const seriesConversations=ids.length&&c.permissions?.messages?
  await checked(db.from('stip_leisure_series_chat').select('event_id,conversation_id').in('event_id',ids)):[];
 const seriesMemberships=seriesConversations.length&&c.agent_id?
  await checked(db.from('stip_conversation_members').select('conversation_id').eq('agent_id',c.agent_id)
   .in('conversation_id',seriesConversations.map((x:any)=>x.conversation_id))):[];
 const seriesMemberIds=new Set((seriesMemberships||[]).map((x:any)=>x.conversation_id));
 const chats=ids.length&&c.permissions?.messages?await checked(db.from('stip_leisure_chats').select('event_id,event_date,conversation_id').in('event_id',ids)):[]
 const memberships=chats.length&&c.agent_id?await checked(db.from('stip_conversation_members').select('conversation_id').eq('agent_id',c.agent_id).in('conversation_id',chats.map((x:any)=>x.conversation_id))):[]
 const memberIds=new Set((memberships||[]).map((x:any)=>x.conversation_id))
 const responses=ids.length?await checked(db.from('stip_leisure_responses').select('event_id,agent_id,selected_dates,declined,revision,updated_at,agent:agents!stip_leisure_responses_agent_id_fkey(id,prenom,nom,profile_photo_url,avatar_url)').in('event_id',ids)):[]
 const photos=new Map<string,string>();await Promise.all((responses||[]).map(async(r:any)=>{if(!photos.has(r.agent_id))photos.set(r.agent_id,await photo(r.agent?.profile_photo_url||r.agent?.avatar_url))}))
 const organizerIds=[...new Set(events.map((x:any)=>x.organizer_agent_id).filter(Boolean))];
 const organizerRows=organizerIds.length?await checked(db.from('agents').select('id,prenom,nom').in('id',organizerIds)):[];
 const organizerNames=new Map((organizerRows||[]).map((x:any)=>[x.id,[x.prenom,x.nom].filter(Boolean).join(' ')||'Organisateur']));
 const [viewerPlan,shiftPalette]=c.agent_id&&ids.length?await Promise.all([
  checked(db.from('planning').select('date,code').eq('agent_id',c.agent_id).gte('date',today()).lte('date',plusDays(today(),123))),
  checked(db.from('stip_shift_registry').select('code,label,icon,color_hex,soft_color_hex').eq('active',true))
 ]):[[],[]];
 const shiftMap=new Map((shiftPalette||[]).map((x:any)=>[x.code,x]));
 const viewerDays=new Map((viewerPlan||[]).map((x:any)=>{
  const d:any=shiftMap.get(x.code)||shiftMap.get(shiftCode(x.code||''))||{};
  return [x.date,{date:x.date,code:x.code||'',label:d.label||x.code||'Non renseigné',
    icon:d.icon||'·',color:d.color_hex||'#647988',soft_color:d.soft_color_hex||'#eef3f4'}];
 }));
 return {can_create:!!c.agent_id,events:events.map((e:any)=>{
  const visibleDates=compatibleDates(e,c.agent_id,ends);
  // Une personne invitée sans horaire commun doit pouvoir REFUSER, pas perdre l'invitation.
  if(e.schedule_mode==='afterwork'&&e.organizer_agent_id!==c.agent_id&&!visibleDates.some((d:string)=>d>=today())&&!invited.has(e.id))return null;
  const rs=(responses||[]).filter((r:any)=>r.event_id===e.id),mine=rs.find((r:any)=>r.agent_id===c.agent_id)||null
  const active=e.status==='active'&&(e.dates.some((d:string)=>d>=today())||!!recurringById.get(e.id)?.active)
  const rosterInvites=(allInvitations||[]).filter((x:any)=>x.event_id===e.id);
  const allById=new Map<string,any>();
  for(const invite of rosterInvites)allById.set(invite.agent_id,{
    agent_id:invite.agent_id,
    name:[invite.agent?.prenom,invite.agent?.nom].filter(Boolean).join(' ')||'Collègue',
    invite_status:invite.status
  });
  for(const response of rs)if(!allById.has(response.agent_id))allById.set(response.agent_id,{
    agent_id:response.agent_id,
    name:[response.agent?.prenom,response.agent?.nom].filter(Boolean).join(' ')||'Collègue',
    invite_status:'accepted'
  });
  // Ne pas divulguer les horaires individuels : exposer uniquement la compatibilité des dates.
  const endOfOrganizer=ends.get(e.organizer_agent_id)||new Map<string,string>();
  const dateRoster=Object.fromEntries((e.dates||[]).filter((day:string)=>day>=today()).map((day:string)=>{
    const roster:any[]=[];
    if(e.organizer_agent_id)roster.push({agent_id:e.organizer_agent_id,
      name:organizerNames.get(e.organizer_agent_id)||'Organisateur',
      state:(recurringById.get(e.id)?.excluded_dates||[]).includes(day)?'unavailable':'organizer',
      compatible:!(recurringById.get(e.id)?.excluded_dates||[]).includes(day)});
    for(const person of allById.values()){
      if(person.agent_id===e.organizer_agent_id)continue;
      const response=rs.find((r:any)=>r.agent_id===person.agent_id);
      const compatible=e.schedule_mode!=='afterwork'||Boolean(
        endOfOrganizer.get(day)&&endOfOrganizer.get(day)===ends.get(person.agent_id)?.get(day));
      const confirmed=!!response&&response.revision===e.revision;
      const status=confirmed&&response.declined?'declined':
        confirmed&&response.selected_dates?.includes(day)?'accepted':
        confirmed?'not_selected':
        person.invite_status==='declined'?'declined':
        compatible?'pending':'incompatible';
      roster.push({agent_id:person.agent_id,name:person.name,state:status,compatible});
    }
    return [day,roster];
  }));
  return {...e,date_roster:dateRoster,organizer_name:organizerNames.get(e.organizer_agent_id)||'Organisateur',visible_dates:visibleDates,visible_end_times:e.schedule_mode==='afterwork'?Object.fromEntries(visibleDates.map((day:string)=>[day,ends.get(c.agent_id)?.get(day)]).filter((row:any)=>!!row[1])):{},my_schedule:visibleDates.map((d:string)=>viewerDays.get(d)).filter(Boolean),recurring_closing:!!recurringById.get(e.id)?.active,
   organizer_unavailable_dates:recurringById.get(e.id)?.excluded_dates||[],
   closing_time:recurringById.get(e.id)?.closing_time||null,
   series_conversation_id:seriesConversations.find((x:any)=>x.event_id===e.id&&seriesMemberIds.has(x.conversation_id))?.conversation_id||null,
   is_organizer:e.organizer_agent_id===c.agent_id,can_manage:c.isAdmin||!!c.agent_id&&c.agent_id===e.organizer_agent_id,
   chats:chats.filter((x:any)=>x.event_id===e.id&&memberIds.has(x.conversation_id)).map((x:any)=>({date:x.event_date,conversation_id:x.conversation_id})),
   invitation_status:invited.get(e.id)||null,
   can_invite:e.organizer_agent_id===c.agent_id,
   invited_colleagues:(e.organizer_agent_id===c.agent_id||c.isAdmin&&e.visibility==='team')?(allInvitations||[]).filter((x:any)=>x.event_id===e.id).map((x:any)=>({id:x.agent_id,name:[x.agent?.prenom,x.agent?.nom].filter(Boolean).join(' ')||'Collègue',status:x.status})):[],
   response:mine?{selected_dates:mine.selected_dates,declined:mine.declined,revision:mine.revision}:null,
   needs_response:active&&(e.dates||[]).some((d:string)=>d>=today())&&!!c.agent_id&&c.agent_id!==e.organizer_agent_id&&invited.has(e.id)&&(!mine||mine.revision!==e.revision),
   participants:rs.filter((r:any)=>!r.declined).map((r:any)=>({agent_id:r.agent_id,name:text(r.agent?.prenom,80)||'Agent',photo:photos.get(r.agent_id)||'',selected_dates:r.selected_dates,confirmed:r.revision===e.revision})),
   response_count:rs.length,declined_count:rs.filter((r:any)=>r.declined).length}
 }).filter(Boolean)}
}

const normalizeSector=(v:unknown)=>text(v,80).toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
const validClock=(v:unknown)=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const carpoolToday=()=>today();
async function carpoolPreference(c:any){
 if(!c.agent_id)throw Error('ACCES_AGENT_REQUIS');
 const p=await checked(db.from('stip_carpool_preferences').select('opted_in,sector,has_car').eq('agent_id',c.agent_id).maybeSingle());
 return p||{opted_in:false,sector:'',has_car:false};
}
async function carpoolShifts(c:any){
 const from=carpoolToday(),to=plusDays(from,31);
 const [rows,defs]=await Promise.all([
  checked(db.from('planning').select('date,code').eq('agent_id',c.agent_id).gte('date',from).lte('date',to)),
  checked(db.from('stip_shift_registry').select('code,is_working,start_time,end_time,window_start,window_end,schedule_mode').eq('is_working',true))
 ]);
 const map=new Map((defs||[]).map((d:any)=>[d.code,d]));
 return (rows||[]).flatMap((r:any)=>{
  const d:any=map.get(r.code)||map.get(shiftCode(r.code));
  if(!d?.is_working)return [];
  const precise=d.schedule_mode!=='flexible';
  return [{date:r.date,code:r.code,mode:d.schedule_mode,start:precise?(d.schedule_mode==='fixed'?d.window_start:d.start_time)?.slice(0,5)||null:null,
    end:precise?(d.schedule_mode==='fixed'?d.window_end:d.end_time)?.slice(0,5)||null:null}];
 }).sort((a:any,b:any)=>a.date.localeCompare(b.date));
}

async function carpoolMatches(c:any,pref:any,shifts:any[]){
 if(!pref.opted_in||!pref.sector)return [];
 const all=await colleagues(c);
 if(!all.length)return [];
 const ps=await checked(db.from('stip_carpool_preferences').select('agent_id,sector,has_car').eq('opted_in',true))||[];
 const area=normalizeSector(pref.sector);
 const nearby=ps.filter((p:any)=>normalizeSector(p.sector)===area && all.some((a:any)=>a.id===p.agent_id)).slice(0,16);
 if(!nearby.length)return [];
 const ids=nearby.map((p:any)=>p.agent_id);
 const [rows,defs]=await Promise.all([
  checked(db.from('planning').select('agent_id,date,code').in('agent_id',ids).gte('date',carpoolToday()).lte('date',plusDays(carpoolToday(),31))),
  checked(db.from('stip_shift_registry').select('code,start_time,end_time,window_start,window_end,schedule_mode,is_working').eq('is_working',true))
 ]);
 const defsMap=new Map((defs||[]).map((d:any)=>[d.code,d]));
 const my=new Map(shifts.map((x:any)=>[x.date,x]));
 const potential=new Map<string,any[]>();
 for(const r of rows||[]){
  const own:any=my.get(r.date);
  const rule:any=defsMap.get(r.code)||defsMap.get(shiftCode(r.code));
  if(!own||!rule?.is_working||rule.schedule_mode==='flexible')continue;
  const start=(rule.schedule_mode==='fixed'?rule.window_start:rule.start_time)?.slice(0,5);
  const end=(rule.schedule_mode==='fixed'?rule.window_end:rule.end_time)?.slice(0,5);
  const together=!!((own.start&&start&&Math.abs(minutes(own.start)-minutes(start))<=30)
    ||(own.end&&end&&Math.abs(minutes(own.end)-minutes(end))<=30));
  if(!together)continue;
  const list=potential.get(r.agent_id)||[];
  if(!list.includes(r.date))list.push(r.date);
  potential.set(r.agent_id,list);
 }
 return nearby.map((p:any)=>({
  agent_id:p.agent_id,
  name:all.find((a:any)=>a.id===p.agent_id)?.name||'Collègue',
  has_car:p.has_car,can_message:!!c.permissions?.messages,common_dates:(potential.get(p.agent_id)||[]).sort().slice(0,3)
 })).sort((a:any,b:any)=>Number(b.common_dates.length>0)-Number(a.common_dates.length>0)||Number(b.has_car)-Number(a.has_car)||a.name.localeCompare(b.name,'fr')).slice(0,12);
}
async function carpoolHome(c:any){
 const pref=await carpoolPreference(c);
 if(!pref.opted_in)return {preference:pref,trips:[],shifts:[],matches:[]};
 const from=carpoolToday(),until=plusDays(from,31);
 const [trips,shifts]=await Promise.all([
  checked(db.from('stip_carpool_trips').select('*,organizer:agents!stip_carpool_trips_organizer_agent_id_fkey(id,prenom,nom)').eq('family',c.family).gte('trip_date',from).lte('trip_date',until).order('trip_date',{ascending:true}).limit(150)),
  carpoolShifts(c)
 ]);
 const ids=(trips||[]).map((t:any)=>t.id);
 const interests=ids.length?await checked(db.from('stip_carpool_interests').select('trip_id,agent_id,status,agent:agents!stip_carpool_interests_agent_id_fkey(prenom,nom)').in('trip_id',ids)):[];
 const matches=await carpoolMatches(c,pref,shifts);
 return {preference:pref,shifts,matches,trips:(trips||[]).filter((t:any)=>t.status==='active'||t.organizer_agent_id===c.agent_id).map((t:any)=>{
  const rs=(interests||[]).filter((r:any)=>r.trip_id===t.id);
  const mine=rs.find((r:any)=>r.agent_id===c.agent_id);
  const owner=t.organizer_agent_id===c.agent_id,confirmed=mine?.status==='accepted';
  const approved=rs.filter((r:any)=>r.status==='accepted');
  return {
   id:t.id,kind:t.kind,direction:t.direction,trip_date:t.trip_date,
   departure_time:String(t.departure_time||'').slice(0,5),sector:t.sector,seats:t.seats,
   status:t.status,organizer_agent_id:t.organizer_agent_id,
   organizer_name:[t.organizer?.prenom,t.organizer?.nom].filter(Boolean).join(' ')||'Collègue',
   is_mine:owner,my_status:mine?.status||null,
   accepted_count:approved.length,spots_left:Math.max(0,(t.kind==='offer'?t.seats:1)-approved.length),
   same_sector:normalizeSector(t.sector)===normalizeSector(pref.sector),
   meeting_point:owner||confirmed?t.meeting_point:'',
   note:owner||confirmed?t.note:'',
   applicants:owner?rs.filter((r:any)=>r.status!=='withdrawn').map((r:any)=>({
    agent_id:r.agent_id,name:[r.agent?.prenom,r.agent?.nom].filter(Boolean).join(' ')||'Collègue',status:r.status
   })):[],
   peer_agent_id:owner?(approved[0]?.agent_id||null):(confirmed?t.organizer_agent_id:null),
   can_message:!!c.permissions?.messages
  };
 }).sort((a:any,b:any)=>Number(b.is_mine)-Number(a.is_mine)||Number(b.same_sector)-Number(a.same_sector)||a.trip_date.localeCompare(b.trip_date))};
}
async function carpoolNotify(agent_id:string,kind:string,trip_id:string,detail:string){
 try{
  await checked(db.from('stip_notifications').insert({
   agent_id,type:kind,title:'Covoiturage GHE',body:detail,source_type:'stip_carpool_trips',source_ref:trip_id
  }));
 }catch(e){console.error('carpool notification',e)}
}
async function carpoolAction(c:any,b:any){
 if(!c.agent_id)throw Error('ACCES_AGENT_REQUIS');
 if(b.action==='carpool_home')return carpoolHome(c);
 if(b.action==='carpool_preferences'){
  const enabled=b.opted_in===true,has_car=b.has_car===true,sector=text(b.sector,80);
  if(enabled&&(sector.length<2||sector.length>80))throw Error('SECTEUR_REQUIS');
  await checked(db.from('stip_carpool_preferences').upsert({
   agent_id:c.agent_id,opted_in:enabled,has_car,sector:enabled?sector:'',updated_at:new Date().toISOString()
  },{onConflict:'agent_id'}));
  if(!enabled){
   await checked(db.from('stip_carpool_trips').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('organizer_agent_id',c.agent_id).eq('status','active'));
   await checked(db.from('stip_carpool_interests').update({status:'withdrawn',updated_at:new Date().toISOString()}).eq('agent_id',c.agent_id).in('status',['pending','accepted']));
  }
  return {ok:true,...await carpoolHome(c)};
 }
 const pref=await carpoolPreference(c);
 if(!pref.opted_in)throw Error('CARPOOL_OPTIN_REQUIS');
 if(b.action==='carpool_create'){
  const kind=b.kind,direction=b.direction,day=b.date,clock=b.time;
  if(!['offer','request'].includes(kind)||!['to_work','from_work'].includes(direction)
   ||typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<carpoolToday()||day>plusDays(carpoolToday(),31)
   ||!validClock(clock)||!Number.isInteger(b.seats)||b.seats<1||b.seats>6)throw Error('TRAJET_INVALIDE');
  if(kind==='offer'&&!pref.has_car)throw Error('CARPOOL_VOITURE_REQUISE');
  const points=text(b.meeting_point,200),note=text(b.note,400);
  const result=await checked(db.from('stip_carpool_trips').insert({
   organizer_agent_id:c.agent_id,family:c.family,kind,direction,trip_date:day,
   departure_time:clock,sector:pref.sector,seats:kind==='offer'?b.seats:1,
   meeting_point:points,note
  }).select('id').single());
  return {ok:true,id:result.id,...await carpoolHome(c)};
 }
 if(!uuid(b.trip_id))throw Error('TRAJET_INVALIDE');
 const trip=await checked(db.from('stip_carpool_trips').select('id,family,organizer_agent_id,kind,status').eq('id',b.trip_id).eq('family',c.family).maybeSingle());
 if(!trip)throw Error('CARPOOL_INTROUVABLE');
 if(b.action==='carpool_cancel'){
  if(trip.organizer_agent_id!==c.agent_id)throw Error('CARPOOL_NON_AUTORISE');
  await checked(db.from('stip_carpool_trips').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',trip.id));
  const responders=await checked(db.from('stip_carpool_interests').select('agent_id').eq('trip_id',trip.id).in('status',['pending','accepted']));
  await Promise.all((responders||[]).map((r:any)=>carpoolNotify(r.agent_id,'carpool_cancel',trip.id,'Un trajet auquel tu avais répondu a été annulé.')));
  return {ok:true,...await carpoolHome(c)};
 }
 if(b.action==='carpool_apply'||b.action==='carpool_withdraw'){
  const value=await checked(db.rpc('stip_carpool_decide',{p_trip:trip.id,p_actor:c.agent_id,p_family:c.family,p_action:b.action==='carpool_apply'?'apply':'withdraw'}));
  if(b.action==='carpool_apply')await carpoolNotify(trip.organizer_agent_id,'carpool_request',trip.id,'Un collègue souhaite organiser un trajet avec toi.');
  return {ok:true,status:value,...await carpoolHome(c)};
 }
 if(b.action==='carpool_review'){
  if(trip.organizer_agent_id!==c.agent_id||!uuid(b.target_agent_id)||!['accepted','declined'].includes(b.decision))throw Error('CARPOOL_NON_AUTORISE');
  const value=await checked(db.rpc('stip_carpool_review',{p_trip:trip.id,p_owner:c.agent_id,p_target:b.target_agent_id,p_family:c.family,p_decision:b.decision}));
  await carpoolNotify(b.target_agent_id,'carpool_response',trip.id,b.decision==='accepted'?'Ton covoiturage est confirmé.':'Le conducteur ne peut pas assurer ce trajet.');
  return {ok:true,status:value,...await carpoolHome(c)};
 }
 throw Error('ACTION_INVALIDE');
}

function dates(v:unknown){if(!Array.isArray(v)||v.length>62||v.some(d=>typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d))throw Error('DATES_INVALIDES');return [...new Set(v)].sort()}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:C})
 if(req.method!=='POST')return J({error:'METHODE_INVALIDE'},405)
 try{
  const c=await context(req),b=await req.json()

  if(String(b.action||'').startsWith('carpool_'))return J(await carpoolAction(c,b))
  if(b.action==='delete'){
   if(!c.agent_id||!uuid(b.event_id)||b.confirm!=='SUPPRIMER')throw Error('CONFIRMATION_SUPPRESSION_REQUISE');
   const deleted=await checked(db.rpc('stip_leisure_delete_event',{
    p_event:b.event_id,p_actor:c.agent_id,p_family:c.family
   }));
   if(!deleted)throw Error('SORTIE_INTROUVABLE');
   return J({ok:true,deleted:true,...await list(c)});
  }
  if(b.action==='recurring_details'){
   if(!c.agent_id||!uuid(b.event_id))throw Error('SORTIE_INVALIDE');
   const event=await checked(db.from('stip_leisure_events')
    .select('id,organizer_agent_id,family,title,revision,status').eq('id',b.event_id).eq('family',c.family).maybeSingle());
   if(!event||event.organizer_agent_id!==c.agent_id)throw Error('ACCES_ORGANISATEUR_REQUIS');
   const series=await checked(db.from('stip_leisure_recurring').select('event_id').eq('event_id',b.event_id).maybeSingle());
   if(!series)throw Error('SORTIE_INVALIDE');
   if(!Number.isInteger(b.revision)||event.revision!==b.revision)throw Error('DATES_MODIFIEES');
   const title=text(b.title,120);if(!title)throw Error('TITRE_REQUIS');
   await checked(db.from('stip_leisure_events').update({title,description:text(b.description,2000),
    location:text(b.location,240),time_label:text(b.time_label,240),updated_at:new Date().toISOString()}).eq('id',b.event_id));
   await checked(db.rpc('stip_leisure_sync_series_chat',{p_event:b.event_id}));
   return J({ok:true,id:b.event_id,...await list(c)});
  }
  if(b.action==='calendar_preview'){
   if(!c.agent_id)throw Error('ACCES_AGENT_REQUIS');
   const start=typeof b.start==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(b.start)?b.start:today();
   const end=plusDays(start,Math.max(0,Math.min(185,Number(b.days)||62)));
   const [mine,shifts]=await Promise.all([
    checked(db.from('planning').select('date,code').eq('agent_id',c.agent_id).gte('date',start).lte('date',end)),
    checked(db.from('stip_shift_registry').select('code,label,end_time,window_end,schedule_mode,is_working'))
   ]);
   const defs=new Map((shifts||[]).map((x:any)=>[x.code,x]));
   return J({start,end,shifts:(mine||[]).map((x:any)=>{
    const code=shiftCode(x.code||'');
    const d:any=defs.get(x.code)||defs.get(code)||{};
    const category=/^(R|RH|RF|OFF|REPOS|RTT|RC)$/.test(code)?'rest':
      d.is_working===false?'absence':
      code==='S'||String((d.schedule_mode==='fixed'?d.window_end:d.end_time)||'').startsWith('21:')?'evening':
      code==='M'?'morning':code==='N'?'night':d.is_working?'day':'unknown';
    return {date:x.date,code:x.code||'',label:d.label||code||'Non renseigné',kind:category,
      end:d.is_working?String(d.schedule_mode==='fixed'?d.window_end:d.end_time||'').slice(0,5):null};
   })});
  }
  if(b.action==='create_activity'||b.action==='create_ensemble'){
   const icon=text(b.icon,16);
   if(b.action==='create_ensemble'&&!icon)throw Error('ICONE_REQUISE');
   const scheduleMode=b.schedule_mode==='afterwork'?'afterwork':'fixed';
   if(!c.agent_id)throw Error('ACCES_AGENT_REQUIS');
   const requested=Array.isArray(b.agent_ids)?[...new Set(b.agent_ids)]:[];
   if(requested.length>100||requested.some((id:any)=>!uuid(id)||id===c.agent_id))throw Error('COLLEGUES_INVALIDES');
   const visibility=b.visibility==='team'?'team':'invite';
   if(visibility==='invite'&&!requested.length)throw Error('CHOISIS_UN_COLLEGUE');
   const allowed=new Set((await colleagues(c)).map((x:any)=>x.id));
   if(requested.some((id:any)=>!allowed.has(id)))throw Error('COLLEGUE_INDISPONIBLE');
   let ds=dates(b.dates);
   let alertTargets=requested;
   if(!ds.length||ds.some((d:string)=>d<today()))throw Error('DATES_INVALIDES');
   if(scheduleMode==='afterwork'){
    const ends=await endSchedules([c.agent_id],today(),plusDays(today(),123));
    ds=ds.filter((day:string)=>!!ends.get(c.agent_id)?.get(day));
    if(!ds.length)throw Error('AUCUNE_FIN_DE_SERVICE_SUR_CES_DATES');
    const allEnds=await endSchedules([c.agent_id,...requested],today(),plusDays(today(),123));
    alertTargets=requested.filter((peer:string)=>ds.some((day:string)=>
      !!allEnds.get(peer)?.get(day) && allEnds.get(peer)?.get(day)===allEnds.get(c.agent_id)?.get(day)));
   }
   if(scheduleMode==='afterwork'&&visibility==='invite'&&!alertTargets.length)throw Error('AUCUN_HORAIRE_COMMUN_AVEC_LES_COLLEGUES');
   const title=text(b.title,120);if(!title)throw Error('TITRE_REQUIS');
   const id=await checked(db.rpc('stip_leisure_save',{
    p_id:null,p_actor:c.agent_id,p_admin:c.isAdmin,p_family:c.family,p_expected:0,
    p_title:title,p_description:text(b.description,2000),p_location:text(b.location,240),
    p_time:text(b.time_label,240),p_dates:ds,p_status:'active'
   }));
   try{
    await checked(db.from('stip_leisure_events').update({
       visibility,icon:icon||'📌',schedule_mode:scheduleMode
     }).eq('id',id).eq('organizer_agent_id',c.agent_id));
    if(requested.length){
     await checked(db.from('stip_leisure_invites').insert(requested.map((agent_id:any)=>({
      event_id:id,agent_id,invited_by:c.agent_id,status:'pending'
     }))));
     if(alertTargets.length)await checked(db.from('stip_notifications').insert(alertTargets.map((agent_id:any)=>({
      agent_id,type:'leisure_invite',title:'Invitation à une activité',
      body:title,source_type:'stip_leisure_events',source_ref:id
     }))));
     await Promise.allSettled(alertTargets.map((agent_id:any)=>notifyPhone(agent_id,'leisure_invite',id,'Invitation à une activité',title)));
    }
    await checked(db.rpc('stip_leisure_sync_series_chat',{p_event:id}));
   }catch(err){
    try{await checked(db.rpc('stip_leisure_delete_event',{p_event:id,p_actor:c.agent_id,p_family:c.family}));}catch(e){console.error('activity cleanup',e)}
    throw err;
   }
   return J({ok:true,id,invited:requested.length,compatible_invited:alertTargets.length,visibility,...await list(c)});
  }
  if(b.action==='remove_invitee'){
   if(!c.agent_id||!uuid(b.event_id)||!uuid(b.agent_id)||b.agent_id===c.agent_id)throw Error('INVITATION_INVALIDE');
   const event=await checked(db.from('stip_leisure_events').select('id,organizer_agent_id,family,status')
    .eq('id',b.event_id).eq('family',c.family).maybeSingle());
   if(!event||event.organizer_agent_id!==c.agent_id)throw Error('ACCES_ORGANISATEUR_REQUIS');
   const existing=await checked(db.from('stip_leisure_invites').select('agent_id')
    .eq('event_id',event.id).eq('agent_id',b.agent_id).maybeSingle());
   if(!existing)throw Error('INVITATION_INTROUVABLE');
   await checked(db.from('stip_leisure_invites').delete().eq('event_id',event.id).eq('agent_id',b.agent_id));
   await checked(db.from('stip_leisure_responses').delete().eq('event_id',event.id).eq('agent_id',b.agent_id));
   // Revoke all legacy per-day chat memberships, too. Never delete other members' messages.
   const legacy=await checked(db.from('stip_leisure_chats').select('conversation_id').eq('event_id',event.id));
   if(legacy?.length)await checked(db.from('stip_conversation_members').delete().eq('agent_id',b.agent_id)
    .in('conversation_id',legacy.map((x:any)=>x.conversation_id)));
   await checked(db.rpc('stip_leisure_sync_series_chat',{p_event:event.id}));
   return J({ok:true,removed:1,...await list(c)});
  }

  if(b.action==='calendar')return J(await ownCalendar(c));
  if(b.action==='create')return J(await createActivity(c,b));
  if(b.action==='uninvite'){
   if(!c.agent_id||!uuid(b.event_id)||!uuid(b.target_agent_id))throw Error('INVITATION_INVALIDE');
   const removed=await checked(db.rpc('stip_leisure_remove_invitee',{p_event:b.event_id,p_actor:c.agent_id,
     p_target:b.target_agent_id,p_family:c.family}));
   if(!removed)throw Error('INVITATION_INTROUVABLE');
   return J({ok:true,removed:true,...await list(c)});
  }
  if(b.action==='recurring_preview')return J({dates:c.agent_id?await closingDates(c.agent_id):[],colleagues:await colleagues(c)})
  if(b.action==='recurring_create')return J(await recurringCreate(c,b))
  if(b.action==='recurring_toggle')return J(await recurringToggle(c,b))
  if(b.action==='recurring_stop')return J(await recurringStop(c,b))
  if(b.action==='list')return J(await list(c))
  if(b.action==='colleagues')return J({colleagues:await colleagues(c)})
  if(b.action==='invite'){
   if(!c.agent_id||!uuid(b.event_id)||!Array.isArray(b.agent_ids))throw Error('INVITATION_INVALIDE');
   const requested=[...new Set(b.agent_ids)];
   if(!requested.length||requested.length>100||requested.some((id:unknown)=>!uuid(id)||id===c.agent_id))throw Error('INVITATION_INVALIDE');
   const event=await checked(db.from('stip_leisure_events').select('id,title,status,family,organizer_agent_id,visibility,schedule_mode,dates').eq('id',b.event_id).eq('family',c.family).maybeSingle());
   if(!event||event.status!=='active'||event.organizer_agent_id!==c.agent_id)throw Error('ACCES_ORGANISATEUR_REQUIS');
   const allowed=new Set((await colleagues(c)).map((a:any)=>a.id));
   if(requested.some((id:unknown)=>!allowed.has(id)))throw Error('COLLEGUE_INDISPONIBLE');
   const inserted=await checked(db.from('stip_leisure_invites').upsert(
    requested.map((agent_id:any)=>({event_id:event.id,agent_id,invited_by:c.agent_id,status:'pending'})),
    {onConflict:'event_id,agent_id',ignoreDuplicates:true}
   ).select('agent_id'))||[];
   if(inserted.length){
    let notifying=inserted;
    if(event.schedule_mode==='afterwork'){
     const ends=await endSchedules([c.agent_id,...inserted.map((r:any)=>r.agent_id)],today(),plusDays(today(),123));
     notifying=inserted.filter((r:any)=>(event.dates||[]).some((day:string)=>
       !!ends.get(c.agent_id)?.get(day)&&ends.get(c.agent_id)?.get(day)===ends.get(r.agent_id)?.get(day)));
    }
    if(notifying.length)await checked(db.from('stip_notifications').insert(notifying.map((r:any)=>({
     agent_id:r.agent_id,type:'leisure_invite',title:'Invitation à une sortie',
     body:text(event.title,120),source_type:'stip_leisure_events',source_ref:event.id
    }))));
    await Promise.allSettled(notifying.map((r:any)=>notifyPhone(r.agent_id,'leisure_invite',event.id,'Invitation à une sortie',event.title)));
   }
   await checked(db.rpc('stip_leisure_sync_series_chat',{p_event:event.id}));
   return J({ok:true,added:inserted.length,...await list(c)});
  }

  if(b.action==='matches')return J(await matches(c,text(b.target_agent_id,80)))
  if(b.action==='propose'){
   if(!c.agent_id||!uuid(b.target_agent_id))throw Error('PROPOSITION_INVALIDE');
   const proposed=dates(Array.isArray(b.dates)?b.dates:[b.date]);
   if(proposed.length<1||proposed.length>12||proposed.some((day:string)=>day<today()||day>plusDays(today(),31)))
    throw Error('DATES_INVALIDES');
   const title=text(b.title,120);if(!title)throw Error('TITRE_REQUIS');
   const available=await matches(c,String(b.target_agent_id));
   const compatible=new Set(available.days.map((row:any)=>row.date));
   if(proposed.some((day:string)=>!compatible.has(day)))throw Error('HORAIRES_NON_COMPATIBLES');
   const candidates=await checked(db.from('stip_leisure_events')
    .select('id,title,dates,location,time_label')
    .eq('organizer_agent_id',c.agent_id).eq('family',c.family)
    .eq('visibility','invite').eq('status','active')
    .order('created_at',{ascending:false}).limit(60))||[];
   const identical=candidates.find((e:any)=>
     String(e.title).trim().toLocaleLowerCase('fr')===title.toLocaleLowerCase('fr')
     &&String(e.location||'').trim().toLocaleLowerCase('fr')===text(b.location,240).toLocaleLowerCase('fr')
     &&String(e.time_label||'').trim().toLocaleLowerCase('fr')===text(b.time_label,240).toLocaleLowerCase('fr')
     &&proposed.every((d:string)=>(e.dates||[]).includes(d))
   );
   if(identical){
    const already=await checked(db.from('stip_leisure_invites').select('agent_id').eq('event_id',identical.id).eq('agent_id',b.target_agent_id).maybeSingle());
    if(!already){
     await checked(db.from('stip_leisure_invites').insert({
      event_id:identical.id,agent_id:b.target_agent_id,invited_by:c.agent_id,status:'pending'
     }));
     await checked(db.from('stip_notifications').insert({
      agent_id:b.target_agent_id,type:'leisure_invite',title:'Invitation après le travail',body:text(title,120),
      source_type:'stip_leisure_events',source_ref:identical.id
     }));
     await notifyPhone(b.target_agent_id,'leisure_invite',identical.id,'Invitation après le travail',title);
    }
    return J({ok:true,id:identical.id,reused:true,...await list(c)});
   }
   const id=await checked(db.rpc('stip_afterwork_propose_many',{
    p_actor:c.agent_id,p_target:b.target_agent_id,p_family:c.family,p_days:proposed,
    p_title:title,p_description:text(b.description,2000),p_location:text(b.location,240),p_time:text(b.time_label,240)
   }));
   await checked(db.rpc('stip_leisure_sync_series_chat',{p_event:id}));
   await notifyPhone(b.target_agent_id,'leisure_invite',id,'Invitation après le travail',title);
   return J({ok:true,id,...await list(c)});
  }
  if(!c.agent_id&&b.action!=='save')throw Error('ACCES_AGENT_REQUIS')
  if(b.action==='respond'){
   if(!uuid(b.event_id)||typeof b.declined!=='boolean'||!Number.isInteger(b.revision))throw Error('CHOIX_INVALIDE')

   const ev=await checked(db.from('stip_leisure_events').select('id,title,visibility,organizer_agent_id,schedule_mode,dates').eq('id',b.event_id).eq('family',c.family).maybeSingle());
   if(!ev)throw Error('SORTIE_INTROUVABLE');
   if(ev.visibility==='invite'&&ev.organizer_agent_id!==c.agent_id){
    const invite=await checked(db.from('stip_leisure_invites').select('event_id').eq('event_id',b.event_id).eq('agent_id',c.agent_id).maybeSingle());
    if(!invite)throw Error('ACCES_INVITATION_REQUIS');
   }
   const series=await checked(db.from('stip_leisure_recurring').select('excluded_dates,active').eq('event_id',b.event_id).maybeSingle());
   if(series?.active){
    if(ev.organizer_agent_id===c.agent_id)throw Error('UTILISER_DISPONIBILITE_ORGANISATEUR');
    if(dates(b.selected_dates).some((day:string)=>(series.excluded_dates||[]).includes(day)))throw Error('ORGANISATEUR_INDISPONIBLE');
   }
   if(ev.schedule_mode==='afterwork'&&!b.declined){
    const ends=await endSchedules([c.agent_id,ev.organizer_agent_id],today(),plusDays(today(),123));
    const compatible=compatibleDates(ev,c.agent_id,ends);
    if(dates(b.selected_dates).some((day:string)=>!compatible.includes(day)))throw Error('HORAIRE_INCOMPATIBLE');
   }
   await checked(db.rpc('stip_leisure_respond',{p_event:b.event_id,p_agent:c.agent_id,p_family:c.family,p_revision:b.revision,p_dates:dates(b.selected_dates),p_declined:b.declined}))
   if(ev.visibility==='invite'&&ev.organizer_agent_id!==c.agent_id){
    await checked(db.from('stip_leisure_invites').update({status:b.declined?'declined':'accepted',responded_at:new Date().toISOString()}).eq('event_id',b.event_id).eq('agent_id',c.agent_id));
    if(ev.organizer_agent_id){
     await checked(db.from('stip_notifications').insert({
      agent_id:ev.organizer_agent_id,type:'leisure_response',title:'Réponse à une invitation',
      body:text(ev.title,120)+' : '+(b.declined?'invitation déclinée':'participation acceptée'),
      source_type:'stip_leisure_events',source_ref:ev.id
     }));
     await notifyPhone(ev.organizer_agent_id,'leisure_response',ev.id,'Réponse à une invitation',
       text(ev.title,120)+' : '+(b.declined?'invitation déclinée':'participation acceptée'));
    }
   }
   await checked(db.rpc('stip_leisure_sync_series_chat',{p_event:b.event_id}));
   return J({ok:true,...await list(c)})
  }
  if(b.action==='save'){
   if(b.id&&!uuid(b.id))throw Error('SORTIE_INVALIDE')
   if(b.id){
    const recurring=await checked(db.from('stip_leisure_recurring').select('event_id').eq('event_id',b.id).maybeSingle());
    if(recurring)throw Error('UTILISER_MODIFICATION_SERIE');
   }
   const title=text(b.title,120);if(!title)throw Error('TITRE_REQUIS')
   const id=await checked(db.rpc('stip_leisure_save',{p_id:b.id||null,p_actor:c.agent_id,p_admin:c.isAdmin,p_family:c.family,p_expected:Number(b.revision)||0,p_title:title,p_description:text(b.description,2000),p_location:text(b.location,240),p_time:text(b.time_label,240),p_dates:dates(b.dates),p_status:b.status==='cancelled'?'cancelled':'active'}))
   if(b.icon!==undefined)await checked(db.from('stip_leisure_events').update({icon:text(b.icon,16)||'📌'}).eq('id',id));
   await checked(db.rpc('stip_leisure_sync_series_chat',{p_event:id}));
   return J({ok:true,id,...await list(c)})
  }
  return J({error:'ACTION_INVALIDE'},400)
 }catch(e){const message=e instanceof Error?e.message:text((e as any)?.message||e,500);return J({error:message},/SESSION/.test(message)?401:/ACCES/.test(message)?403:/MODIFIEES/.test(message)?409:400)}
})

