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
 const perms=p.permissions||{};if(perms.leisure===false||!(perms.messages||perms.planning_team||perms.admin))throw Error('ACCES_EQUIPE_REQUIS')
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
async function list(c:any){
 const events=await checked(db.from('stip_leisure_events').select('*').eq('family',c.family).order('created_at',{ascending:false}).limit(200))||[]
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
   response:mine?{selected_dates:mine.selected_dates,declined:mine.declined,revision:mine.revision}:null,
   needs_response:active&&!!c.agent_id&&(!mine||mine.revision!==e.revision),
   participants:rs.filter((r:any)=>!r.declined).map((r:any)=>({agent_id:r.agent_id,name:text(r.agent?.prenom,80)||'Agent',photo:photos.get(r.agent_id)||'',selected_dates:r.selected_dates,confirmed:r.revision===e.revision})),
   response_count:rs.length,declined_count:rs.filter((r:any)=>r.declined).length}
 })}
}
function dates(v:unknown){if(!Array.isArray(v)||v.length>24||v.some(d=>typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d))throw Error('DATES_INVALIDES');return [...new Set(v)].sort()}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:C})
 if(req.method!=='POST')return J({error:'METHODE_INVALIDE'},405)
 try{
  const c=await context(req),b=await req.json()
  if(b.action==='list')return J(await list(c))
  if(!c.agent_id&&b.action!=='save')throw Error('ACCES_AGENT_REQUIS')
  if(b.action==='respond'){
   if(!uuid(b.event_id)||typeof b.declined!=='boolean'||!Number.isInteger(b.revision))throw Error('CHOIX_INVALIDE')
   await checked(db.rpc('stip_leisure_respond',{p_event:b.event_id,p_agent:c.agent_id,p_family:c.family,p_revision:b.revision,p_dates:dates(b.selected_dates),p_declined:b.declined}))
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

