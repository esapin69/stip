import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type,x-stip-session','Access-Control-Allow-Methods':'POST,OPTIONS'}
const J=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...C,'Content-Type':'application/json','Cache-Control':'no-store'}})
const clean=(v:unknown,n=1000)=>String(v??'').trim().slice(0,n)
const uuid=(v:unknown)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||''))
async function checked(q:any){const r=await q;if(r.error)throw r.error;return r.data}

async function context(req:Request){
  const raw=req.headers.get('x-stip-session')||''
  if(!raw||raw.length>256)throw Error('SESSION_STIP_REQUISE')
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('')
  const s=await checked(db.from('stip_access_sessions').select('profile_id,expires_at,revoked_at').eq('token_hash',hash).maybeSingle())
  if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())throw Error('SESSION_EXPIREE')
  const p=await checked(db.from('stip_access_profiles').select('id,agent_id,active,permissions').eq('id',s.profile_id).maybeSingle())
  if(!p?.active)throw Error('ACCES_DESACTIVE')
  if(!p.agent_id)throw Error('ACCES_AGENT_REQUIS')
  const perms=p.permissions||{}
  if(perms.meeting_notes!==true&&perms.admin!==true)throw Error('ACCES_NOTES_REUNION_REQUIS')
  return p
}

async function list(c:any){
  const rows=await checked(
    db.from('stip_meeting_notes')
      .select('id,meeting_at,title,participants,notes,decisions,actions,status,created_at,updated_at')
      .eq('owner_agent_id',c.agent_id)
      .order('meeting_at',{ascending:false})
      .limit(300)
  )
  return {notes:rows||[]}
}

function meetingAt(v:unknown){
  const raw=String(v||'')
  const d=new Date(raw)
  if(!raw||Number.isNaN(d.getTime()))throw Error('DATE_REUNION_INVALIDE')
  return d.toISOString()
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:C})
  if(req.method!=='POST')return J({error:'METHODE_INVALIDE'},405)
  try{
    const c=await context(req)
    const b=await req.json()
    if(b.action==='list')return J(await list(c))

    if(b.action==='save'){
      if(b.id&&!uuid(b.id))throw Error('NOTE_INVALIDE')
      const payload={
        owner_agent_id:c.agent_id,
        meeting_at:meetingAt(b.meeting_at),
        title:clean(b.title,160),
        participants:clean(b.participants,1000),
        notes:clean(b.notes,20000),
        decisions:clean(b.decisions,10000),
        actions:clean(b.actions,10000),
        updated_at:new Date().toISOString()
      }
      if(!payload.title)throw Error('TITRE_REQUIS')
      let id=b.id||''
      if(id){
        const row=await checked(
          db.from('stip_meeting_notes')
            .update(payload)
            .eq('id',id)
            .eq('owner_agent_id',c.agent_id)
            .select('id')
            .maybeSingle()
        )
        if(!row)throw Error('NOTE_INTROUVABLE')
      }else{
        const row=await checked(db.from('stip_meeting_notes').insert(payload).select('id').single())
        id=row.id
      }
      return J({ok:true,id,...await list(c)})
    }

    if(b.action==='set_status'){
      if(!uuid(b.id)||!['active','archived'].includes(String(b.status||'')))throw Error('NOTE_INVALIDE')
      const row=await checked(
        db.from('stip_meeting_notes')
          .update({status:b.status,updated_at:new Date().toISOString()})
          .eq('id',b.id)
          .eq('owner_agent_id',c.agent_id)
          .select('id')
          .maybeSingle()
      )
      if(!row)throw Error('NOTE_INTROUVABLE')
      return J({ok:true,...await list(c)})
    }

    return J({error:'ACTION_INVALIDE'},400)
  }catch(e){
    const message=e instanceof Error?e.message:clean((e as any)?.message||e,500)
    return J({error:message},/SESSION/.test(message)?401:/ACCES/.test(message)?403:/INTROUVABLE/.test(message)?404:400)
  }
})
