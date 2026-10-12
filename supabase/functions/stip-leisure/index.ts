import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type,x-stip-session','Access-Control-Allow-Methods':'POST,OPTIONS'}
const J=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...C,'Content-Type':'application/json','Cache-Control':'no-store'}})
const text=(v:unknown,n=1000)=>String(v??'').trim().slice(0,n)
const uuid=(v:unknown)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||''))
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
async function checked(q:any){const r=await q;if(r.error)throw r.error;return r.data}
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
async function list(c:any){
 const events=await checked(db.from('stip_leisure_events').select('*').eq('family',c.family).order('created_at',{ascending:false}).limit(200))||[]

 const personalInvites=c.agent_id?await checked(db.from('stip_leisure_invites').select('event_id,status').eq('agent_id',c.agent_id))||[]:[];
 const invited=new Map(personalInvites.map((r:any)=>[r.event_id,r.status]));
 const visibleEvents=events.filter((e:any)=>e.visibility!=='invite'||e.organizer_agent_id===c.agent_id||invited.has(e.id));
 events.splice(0,events.length,...visibleEvents);
 const ids=events.map((e:any)=>e.id)
 const chats=ids.length&&c.permissions?.messages?await checked(db.from('stip_leisure_chats').select('event_id,event_date,conversation_id').in('event_id',ids)):[]
 const memberships=chats.length&&c.agent_id?await checked(db.from('stip_conversation_members').select('conversation_id').eq('agent_id',c.agent_id).in('conversation_id',chats.map((x:any)=>x.conversation_id))):[]
 const memberIds=new Set((memberships||[]).map((x:any)=>x.conversation_id))
 const responses=ids.length?await checked(db.from('stip_leisure_responses').select('event_id,agent_id,selected_dates,declined,revision,updated_at,agent:agents(id,prenom,nom,profile_photo_url,avatar_url)').in('event_id',ids)):[]
 const photos=new Map<string,string>();await Promise.all((responses||[]).map(async(r:any)=>{if(!photos.has(r.agent_id))photos.set(r.agent_id,await photo(r.agent?.profile_photo_url||r.agent?.avatar_url))}))
 return {can_create:!!c.agent_id,events:events.map((e:any)=>{
  const rs=(responses||[]).filter((r:any)=>r.event_id===e.id),mine=rs.find((r:any)=>r.agent_id===c.agent_id)||null
  const active=e.status==='active'&&e.dates.some((d:string)=>d>=today())
  return {...e,can_manage:c.isAdmin||!!c.agent_id&&c.agent_id===e.organizer_agent_id,
   chats:chats.filter((x:any)=>x.event_id===e.id&&memberIds.has(x.conversation_id)).map((x:any)=>({date:x.event_date,conversation_id:x.conversation_id})),
   invitation_status:invited.get(e.id)||null,
   response:mine?{selected_dates:mine.selected_dates,declined:mine.declined,revision:mine.revision}:null,
   needs_response:active&&!!c.agent_id&&(!mine||mine.revision!==e.revision),
   participants:rs.filter((r:any)=>!r.declined).map((r:any)=>({agent_id:r.agent_id,name:text(r.agent?.prenom,80)||'Agent',photo:photos.get(r.agent_id)||'',selected_dates:r.selected_dates,confirmed:r.revision===e.revision})),
   response_count:rs.length,declined_count:rs.filter((r:any)=>r.declined).length}
 })}
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

function dates(v:unknown){if(!Array.isArray(v)||v.length>24||v.some(d=>typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d))throw Error('DATES_INVALIDES');return [...new Set(v)].sort()}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:C})
 if(req.method!=='POST')return J({error:'METHODE_INVALIDE'},405)
 try{
  const c=await context(req),b=await req.json()

  if(String(b.action||'').startsWith('carpool_'))return J(await carpoolAction(c,b))
  if(b.action==='list')return J(await list(c))
  if(b.action==='colleagues')return J({colleagues:await colleagues(c)})
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
   const id=await checked(db.rpc('stip_afterwork_propose_many',{
    p_actor:c.agent_id,p_target:b.target_agent_id,p_family:c.family,p_days:proposed,
    p_title:title,p_description:text(b.description,2000),p_location:text(b.location,240),p_time:text(b.time_label,240)
   }));
   return J({ok:true,id,...await list(c)});
  }
  if(!c.agent_id&&b.action!=='save')throw Error('ACCES_AGENT_REQUIS')
  if(b.action==='respond'){
   if(!uuid(b.event_id)||typeof b.declined!=='boolean'||!Number.isInteger(b.revision))throw Error('CHOIX_INVALIDE')

   const ev=await checked(db.from('stip_leisure_events').select('id,visibility,organizer_agent_id').eq('id',b.event_id).eq('family',c.family).maybeSingle());
   if(!ev)throw Error('SORTIE_INTROUVABLE');
   if(ev.visibility==='invite'&&ev.organizer_agent_id!==c.agent_id){
    const invite=await checked(db.from('stip_leisure_invites').select('event_id').eq('event_id',b.event_id).eq('agent_id',c.agent_id).maybeSingle());
    if(!invite)throw Error('ACCES_INVITATION_REQUIS');
   }
   await checked(db.rpc('stip_leisure_respond',{p_event:b.event_id,p_agent:c.agent_id,p_family:c.family,p_revision:b.revision,p_dates:dates(b.selected_dates),p_declined:b.declined}))
   if(ev.visibility==='invite'&&ev.organizer_agent_id!==c.agent_id){
    await checked(db.from('stip_leisure_invites').update({status:b.declined?'declined':'accepted',responded_at:new Date().toISOString()}).eq('event_id',b.event_id).eq('agent_id',c.agent_id));
   }
   return J({ok:true,...await list(c)})
  }
  if(b.action==='save'){
   if(b.id&&!uuid(b.id))throw Error('SORTIE_INVALIDE')
   const title=text(b.title,120);if(!title)throw Error('TITRE_REQUIS')
   const id=await checked(db.rpc('stip_leisure_save',{p_id:b.id||null,p_actor:c.agent_id,p_admin:c.isAdmin,p_family:c.family,p_expected:Number(b.revision)||0,p_title:title,p_description:text(b.description,2000),p_location:text(b.location,240),p_time:text(b.time_label,240),p_dates:dates(b.dates),p_status:b.status==='cancelled'?'cancelled':'active'}))
   return J({ok:true,id,...await list(c)})
  }
  return J({error:'ACTION_INVALIDE'},400)
 }catch(e){const message=e instanceof Error?e.message:text((e as any)?.message||e,500);return J({error:message},/SESSION/.test(message)?401:/ACCES/.test(message)?403:/MODIFIEES/.test(message)?409:400)}
})

