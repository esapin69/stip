import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type,x-stip-session','Access-Control-Allow-Methods':'POST,OPTIONS'}
const J=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...C,'Content-Type':'application/json','Cache-Control':'no-store'}})
const txt=(v:unknown,n=2000)=>String(v??'').trim().slice(0,n)
async function checked(q:any){const r=await q;if(r.error)throw r.error;return r.data}
async function context(req:Request){
 const raw=req.headers.get('x-stip-session')||'';if(!raw||raw.length>256)throw Error('SESSION_STIP_REQUISE')
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('')
 const s=await checked(db.from('stip_access_sessions').select('profile_id,expires_at,revoked_at').eq('token_hash',hash).maybeSingle())
 if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())throw Error('SESSION_EXPIREE')
 const p=await checked(db.from('stip_access_profiles').select('id,agent_id,active,permissions,role_key').eq('id',s.profile_id).maybeSingle())
 if(!p?.active)throw Error('ACCES_DESACTIVE')
 return {...p,isAdmin:p.permissions?.admin===true}
}
function options(e:any){
 const raw=Array.isArray(e?.world_state?.decision_options)?e.world_state.decision_options:[]
 return raw.slice(0,5).map((x:any,i:number)=>({key:txt(x?.key||('option_'+(i+1)),40),label:txt(x?.label||x?.text,120)})).filter((x:any)=>x.key&&x.label)
}
async function feed(c:any){
 const episodes=await checked(db.from('stip_nouveau_episodes').select('id,episode_no,title,hook,story_text,video_url,status,decision_prompt,canonical_outcome,published_at,created_at,world_state').in('status',['open','resolved']).order('episode_no',{ascending:false}).limit(20))||[]
 const ids=episodes.map((x:any)=>x.id)
 const votes=ids.length?await checked(db.from('stip_nouveau_choices').select('episode_id,agent_id,choice_key,choice_text').in('episode_id',ids))||[]:[]
 return {episodes:episodes.map((e:any)=>{const rows=votes.filter((v:any)=>v.episode_id===e.id),mine=rows.find((v:any)=>v.agent_id===c.agent_id),counts=rows.reduce((m:any,v:any)=>{m[v.choice_key]=(m[v.choice_key]||0)+1;return m},{});const {world_state,...safe}=e;return {...safe,decision_options:options(e),vote_count:rows.length,counts,my_choice:mine?{key:mine.choice_key,text:mine.choice_text}:null}})}
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:C})
 if(req.method!=='POST')return J({error:'METHODE_INVALIDE'},405)
 try{
  const c=await context(req),b=await req.json().catch(()=>({}))
  if(b.action==='feed')return J(await feed(c))
  if(!c.agent_id)throw Error('ACCES_AGENT_REQUIS')
  if(b.action==='vote'){
   const episode=txt(b.episode_id,60),key=txt(b.choice_key,40),choice=txt(b.choice_text,240)
   if(!/^[a-f0-9-]{36}$/i.test(episode)||!key)throw Error('CHOIX_INVALIDE')
   const open=await checked(db.from('stip_nouveau_episodes').select('id,status,world_state').eq('id',episode).maybeSingle())
   if(!open||open.status!=='open')throw Error('EPISODE_FERME')
   const allowed=options(open).map((x:any)=>x.key)
   if(key!=='libre'&&allowed.length&&!allowed.includes(key))throw Error('CHOIX_INVALIDE')
   await checked(db.from('stip_nouveau_choices').upsert({episode_id:episode,agent_id:c.agent_id,choice_key:key,choice_text:choice},{onConflict:'episode_id,agent_id'}))
   return J({ok:true,...await feed(c)})
  }
  if(b.action==='anecdote'){
   const allowed=['idee','probleme','temoignage','galere','positif','combine','incomprehensible','autre']
   const category=allowed.includes(b.category)?b.category:'autre',raw=txt(b.text,3000)
   if(raw.length<12)throw Error('ANECDOTE_TROP_COURTE')
   const row=await checked(db.from('stip_nouveau_anecdotes').insert({agent_id:c.agent_id,category,raw_text:raw,consent_future_episode:b.consent===true,notify_if_used:b.notify===true}).select('id').single())
   return J({ok:true,id:row.id})
  }
  return J({error:'ACTION_INVALIDE'},400)
 }catch(e){const m=e instanceof Error?e.message:txt((e as any)?.message||e,500);return J({error:m},/SESSION/.test(m)?401:/ACCES/.test(m)?403:/FERME/.test(m)?409:400)}
})