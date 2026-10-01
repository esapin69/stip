import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const U=Deno.env.get('SUPABASE_URL')||''
const K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const R=Deno.env.get('RESEND_API_KEY')||''
const F=Deno.env.get('STIP_CHANGE_FROM_EMAIL')||''
const db=createClient(U,K,{auth:{persistSession:false}})
const C={'Access-Control-Allow-Origin':'https://ghe.esapin.com','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type,x-stip-session','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}
const J=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...C,'Content-Type':'application/json','Cache-Control':'no-store'}})
const clean=(v:unknown,n=1000)=>String(v??'').trim().slice(0,n)
const uuid=(v:unknown)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v||''))
const KINDS=new Set(['info','idea','decision','action','question','verify','waiting','test','important'])
async function checked(q:any){const r=await q;if(r.error)throw r.error;return r.data}
const personName=(a:any)=>[a?.prenom,a?.nom].filter(Boolean).join(' ')||'Agent'
const emailOk=(v:unknown)=>/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(String(v||''))
const mailReady=()=>Boolean(R&&emailOk(F)&&!F.toLowerCase().endsWith('@resend.dev'))
const stamp=(v:unknown)=>{const d=new Date(String(v||''));if(Number.isNaN(d.getTime()))throw Error('DATE_REUNION_INVALIDE');return d.toISOString()}
function lanes(v:unknown){
  const raw=Array.isArray(v)?v:[]
  const out:any[]=[]
  for(const x of raw.slice(0,5)){
    const key=clean((x as any)?.key,40).replace(/[^a-z0-9_-]/gi,'')
    const label=clean((x as any)?.label,80)
    if(key&&label&&!out.some(y=>y.key===key))out.push({key,label})
  }
  if(out.length<2)return [{key:'a',label:'Moi'},{key:'b',label:'Interlocuteur'},{key:'suite',label:'Suite'}]
  return out
}
function base64Utf8(value:string){
  const bytes=new TextEncoder().encode(value)
  let binary=''
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000))
  return btoa(binary)
}

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
  const agent=await checked(db.from('agents').select('id,prenom,nom,email,actif,ghe,role,profile_photo_url,avatar_url').eq('id',p.agent_id).maybeSingle())
  if(!agent?.actif)throw Error('AGENT_INACTIF')
  return {...p,permissions:perms,agent,isAdmin:perms.admin===true}
}

async function meeting(id:string){
  if(!uuid(id))throw Error('REUNION_INVALIDE')
  const row=await checked(db.from('stip_meeting_notes').select('id,owner_agent_id,meeting_at,title,status,phase,lanes,finalized_at,final_mail_sent_at,created_at,updated_at').eq('id',id).maybeSingle())
  if(!row)throw Error('REUNION_INTROUVABLE')
  return row
}
async function acceptedRows(id:string){
  return await checked(db.from('stip_meeting_invites').select('meeting_id,agent_id,status,member_role,created_at,responded_at,updated_at,agent:agents(id,prenom,nom,ghe,role,profile_photo_url,avatar_url)').eq('meeting_id',id).order('created_at',{ascending:true}))||[]
}
async function acceptedIds(id:string){
  const rows=await checked(db.from('stip_meeting_invites').select('agent_id').eq('meeting_id',id).eq('status','accepted'))||[]
  return rows.map((x:any)=>String(x.agent_id))
}
async function access(c:any,m:any){
  if(String(m.owner_agent_id)===String(c.agent_id))return {role:'organizer',accepted:true}
  const row=await checked(db.from('stip_meeting_invites').select('status,member_role').eq('meeting_id',m.id).eq('agent_id',c.agent_id).maybeSingle())
  if(!row||row.status!=='accepted')throw Error('ACCES_REUNION_REFUSE')
  return {role:row.member_role||'invitee',accepted:true}
}
async function organizer(c:any,id:string){
  const m=await meeting(id)
  if(String(m.owner_agent_id)!==String(c.agent_id)&&!c.isAdmin)throw Error('ACCES_ORGANISATEUR_REQUIS')
  return m
}
async function candidateAllowed(agentId:string){
  if(!uuid(agentId))return false
  const rows=await checked(db.from('stip_access_profiles').select('active,permissions').eq('agent_id',agentId))||[]
  return rows.some((p:any)=>p.active&&(p.permissions?.meeting_notes===true||p.permissions?.admin===true))
}
function meetingSummary(m:any,role='invitee'){return {...m,access_role:role}}

async function list(c:any){
  const own=await checked(db.from('stip_meeting_notes').select('id,owner_agent_id,meeting_at,title,status,phase,lanes,finalized_at,created_at,updated_at').eq('owner_agent_id',c.agent_id).order('meeting_at',{ascending:false}).limit(150))||[]
  const mineInvites=await checked(db.from('stip_meeting_invites').select('meeting_id,status,member_role,created_at,updated_at').eq('agent_id',c.agent_id).in('status',['accepted','pending']).order('updated_at',{ascending:false}))||[]
  const acceptedMeetingIds=mineInvites.filter((x:any)=>x.status==='accepted').map((x:any)=>x.meeting_id).filter((id:string)=>!own.some((m:any)=>m.id===id))
  const acceptedMeetings=acceptedMeetingIds.length?await checked(db.from('stip_meeting_notes').select('id,owner_agent_id,meeting_at,title,status,phase,lanes,finalized_at,created_at,updated_at').in('id',acceptedMeetingIds).order('meeting_at',{ascending:false}))||[]:[]
  const pendingRows=mineInvites.filter((x:any)=>x.status==='pending')
  const pendingIds=pendingRows.map((x:any)=>x.meeting_id)
  const pendingMeetings=pendingIds.length?await checked(db.from('stip_meeting_notes').select('id,owner_agent_id,meeting_at,title,phase').in('id',pendingIds))||[]:[]
  const ownerIds=[...new Set([...own,...acceptedMeetings,...pendingMeetings].map((m:any)=>m.owner_agent_id).filter(Boolean))]
  const owners=ownerIds.length?await checked(db.from('agents').select('id,prenom,nom').in('id',ownerIds))||[]:[]
  const ownerMap=new Map(owners.map((x:any)=>[x.id,personName(x)]))
  return {
    meetings:[
      ...own.map((m:any)=>({...meetingSummary(m,'organizer'),organizer_name:ownerMap.get(m.owner_agent_id)||'Organisateur'})),
      ...acceptedMeetings.map((m:any)=>({...meetingSummary(m,'invitee'),organizer_name:ownerMap.get(m.owner_agent_id)||'Organisateur'}))
    ].sort((a:any,b:any)=>String(b.meeting_at).localeCompare(String(a.meeting_at))),
    pending_invites:pendingRows.map((r:any)=>{
      const m=pendingMeetings.find((x:any)=>x.id===r.meeting_id)
      return m?{meeting_id:m.id,title:m.title,meeting_at:m.meeting_at,organizer_name:ownerMap.get(m.owner_agent_id)||'Organisateur'}:null
    }).filter(Boolean)
  }
}

async function detail(c:any,id:string){
  const m=await meeting(id),a=await access(c,m)
  const members=await acceptedRows(id)
  let items:any[]=[]
  let myRecipients:any[]=[]
  if(a.role==='organizer'||c.isAdmin){
    items=await checked(db.from('stip_meeting_items').select('*').eq('meeting_id',id).order('created_at',{ascending:true}))||[]
    const itemIds=items.map((x:any)=>x.id)
    myRecipients=itemIds.length?await checked(db.from('stip_meeting_item_recipients').select('item_id,agent_id,status,response_text,updated_at').in('item_id',itemIds))||[]:[]
  }else{
    const rec=await checked(db.from('stip_meeting_item_recipients').select('item_id,agent_id,status,response_text,updated_at').eq('agent_id',c.agent_id))||[]
    const ids=rec.map((x:any)=>x.item_id)
    items=ids.length?await checked(db.from('stip_meeting_items').select('*').eq('meeting_id',id).eq('visibility','shared').in('id',ids).order('created_at',{ascending:true}))||[]:[]
    const visible=new Set(items.map((x:any)=>x.id))
    myRecipients=rec.filter((x:any)=>visible.has(x.item_id))
  }
  return {
    meeting:{...m,access_role:a.role,can_manage:a.role==='organizer'||c.isAdmin},
    members:members.map((x:any)=>({...x,agent_name:personName(x.agent)})),
    items,
    recipients:myRecipients
  }
}

async function candidates(c:any){
  const ps=await checked(db.from('stip_access_profiles').select('agent_id,active,permissions').eq('active',true).not('agent_id','is',null))||[]
  const ids=[...new Set(ps.filter((p:any)=>p.permissions?.meeting_notes===true||p.permissions?.admin===true).map((p:any)=>p.agent_id))]
  if(!ids.length)return {agents:[]}
  const agents=await checked(db.from('agents').select('id,prenom,nom,ghe,role,equipe,profile_photo_url,avatar_url,actif').in('id',ids).eq('actif',true).order('nom',{ascending:true}))||[]
  return {agents}
}

async function syncAudience(itemId:string,meetingId:string,mode:string,selected:unknown){
  await checked(db.from('stip_meeting_item_recipients').delete().eq('item_id',itemId))
  const accepted=await acceptedIds(meetingId)
  let audience=accepted
  if(mode==='selected'){
    const wanted=Array.isArray(selected)?[...new Set(selected.map(String).filter(uuid))]:[]
    audience=wanted.filter(id=>accepted.includes(id))
    if(audience.length!==wanted.length)throw Error('DESTINATAIRE_NON_AUTORISE')
    if(!audience.length)throw Error('DESTINATAIRE_REQUIS')
  }
  if(audience.length){
    await checked(db.from('stip_meeting_item_recipients').upsert(audience.map(agent_id=>({item_id:itemId,agent_id,status:'open',response_text:'',updated_at:new Date().toISOString()})),{onConflict:'item_id,agent_id'}))
  }
}

async function exportAndFinalize(c:any,id:string){
  const m=await organizer(c,id)
  if(m.phase==='finalized')return {ok:true,already_finalized:true,...await detail(c,id)}
  if(!mailReady())throw Error('EMAIL_NON_CONFIGURE')
  if(!emailOk(c.agent?.email))throw Error('EMAIL_ORGANISATEUR_MANQUANT')
  const items=await checked(db.from('stip_meeting_items').select('*').eq('meeting_id',id).order('created_at',{ascending:true}))||[]
  const members=(await acceptedRows(id)).filter((x:any)=>x.status==='accepted')
  const laneMap=new Map(lanes(m.lanes).map((x:any)=>[x.key,x.label]))
  const byTopic=new Map<string,any[]>()
  for(const item of items){
    const key=clean(item.topic,160)||'À classer'
    if(!byTopic.has(key))byTopic.set(key,[])
    byTopic.get(key)!.push(item)
  }
  const lines=[
    'GHE — Notes de réunion',
    '',
    'Titre : '+m.title,
    'Date : '+new Date(m.meeting_at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}),
    'Organisateur : '+personName(c.agent),
    'Participants ayant accepté : '+(members.map((x:any)=>personName(x.agent)).join(', ')||personName(c.agent)),
    '',
    'TABLEAU COMPLET'
  ]
  for(const [topic,rows] of byTopic){
    lines.push('',topic)
    for(const item of rows){
      lines.push('  ['+(laneMap.get(item.lane_key)||item.lane_key)+'] ['+String(item.kind).toUpperCase()+'] ['+(item.visibility==='shared'?'PARTAGÉ':'PRIVÉ')+'] '+item.body)
    }
  }
  if(!items.length)lines.push('Aucun élément saisi.')
  const payload=lines.join('\n')
  const mailKey='meeting-finalize-'+id
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+R,'Content-Type':'application/json','Idempotency-Key':mailKey},
    body:JSON.stringify({
      from:F,
      to:[String(c.agent.email).toLowerCase()],
      subject:'GHE · Notes de réunion · '+m.title,
      html:'<div style="font:15px Arial;color:#163747;max-width:640px"><h2>Notes de réunion · GHE</h2><p>Le fichier complet de la réunion est joint. Les suites partagées restent disponibles dans GHE uniquement pour les participants ayant accepté leur invitation.</p><p><b>'+m.title.replace(/[&<>]/g,'')+'</b></p></div>',
      attachments:[{filename:'notes-reunion-'+new Date(m.meeting_at).toISOString().slice(0,10)+'.txt',content:base64Utf8(payload)}]
    })
  })
  const mail=await response.json().catch(()=>({}))
  if(!response.ok||!mail.id)throw Error('EMAIL_ENVOI_REFUSE')
  await checked(db.from('stip_meeting_items').delete().eq('meeting_id',id).eq('visibility','private'))
  await checked(db.from('stip_meeting_notes').update({phase:'finalized',finalized_at:new Date().toISOString(),final_mail_sent_at:new Date().toISOString(),final_mail_provider_id:String(mail.id),updated_at:new Date().toISOString()}).eq('id',id))
  const shared=await checked(db.from('stip_meeting_items').select('id').eq('meeting_id',id).eq('visibility','shared'))||[]
  const recipients=shared.length?await checked(db.from('stip_meeting_item_recipients').select('agent_id').in('item_id',shared.map((x:any)=>x.id)))||[]:[]
  const targetIds=[...new Set(recipients.map((x:any)=>x.agent_id).filter((x:string)=>x!==c.agent_id))]
  if(targetIds.length){
    await checked(db.from('stip_notifications').insert(targetIds.map(agent_id=>({
      agent_id,type:'info',title:'Suite de réunion · '+m.title,
      body:'Des éléments de cette réunion sont disponibles sur ton accueil.',
      source_type:'meeting_notes',source_ref:id,
      metadata:{url:'meeting-notes.html?meeting='+id,section:'meeting_followup'}
    }))))
  }
  return {ok:true,mail_sent:true,...await detail(c,id)}
}

async function listHome(c:any){
  const pending=await checked(db.from('stip_meeting_invites').select('meeting_id,updated_at').eq('agent_id',c.agent_id).eq('status','pending').order('updated_at',{ascending:false}).limit(20))||[]
  const pendingIds=pending.map((x:any)=>x.meeting_id)
  const pendingMeetings=pendingIds.length?await checked(db.from('stip_meeting_notes').select('id,owner_agent_id,title,meeting_at,phase').in('id',pendingIds))||[]:[]
  const owners=[...new Set(pendingMeetings.map((x:any)=>x.owner_agent_id))]
  const ownerRows=owners.length?await checked(db.from('agents').select('id,prenom,nom').in('id',owners))||[]:[]
  const ownerMap=new Map(ownerRows.map((x:any)=>[x.id,personName(x)]))
  const rec=await checked(db.from('stip_meeting_item_recipients').select('item_id,status,response_text,updated_at').eq('agent_id',c.agent_id).eq('status','open').order('updated_at',{ascending:false}).limit(60))||[]
  const itemIds=rec.map((x:any)=>x.item_id)
  const items=itemIds.length?await checked(db.from('stip_meeting_items').select('id,meeting_id,topic,kind,body,lane_key,visibility').in('id',itemIds).eq('visibility','shared'))||[]:[]
  const meetingIds=[...new Set(items.map((x:any)=>x.meeting_id))]
  const finals=meetingIds.length?await checked(db.from('stip_meeting_notes').select('id,title,meeting_at,finalized_at,phase').in('id',meetingIds).eq('phase','finalized'))||[]:[]
  const finalMap=new Map(finals.map((x:any)=>[x.id,x]))
  const recMap=new Map(rec.map((x:any)=>[x.item_id,x]))
  return {
    pending_invites:pendingMeetings.map((m:any)=>({meeting_id:m.id,title:m.title,meeting_at:m.meeting_at,organizer_name:ownerMap.get(m.owner_agent_id)||'Organisateur'})),
    followups:items.map((i:any)=>{const m=finalMap.get(i.meeting_id);if(!m)return null;return {...i,meeting_title:m.title,meeting_at:m.meeting_at,finalized_at:m.finalized_at,recipient:recMap.get(i.id)}}).filter(Boolean).sort((a:any,b:any)=>String(b.finalized_at||'').localeCompare(String(a.finalized_at||''))).slice(0,30)
  }
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:C})
  if(req.method!=='POST')return J({error:'METHODE_INVALIDE'},405)
  try{
    const c=await context(req)
    const b=await req.json().catch(()=>({}))
    const action=String(b.action||'')
    if(action==='list')return J(await list(c))
    if(action==='list_home')return J(await listHome(c))
    if(action==='candidates')return J(await candidates(c))
    if(action==='detail')return J(await detail(c,String(b.meeting_id||'')))

    if(action==='create'){
      const title=clean(b.title,160);if(!title)throw Error('TITRE_REQUIS')
      const row=await checked(db.from('stip_meeting_notes').insert({
        owner_agent_id:c.agent_id,meeting_at:b.meeting_at?stamp(b.meeting_at):new Date().toISOString(),title,
        participants:'',notes:'',decisions:'',actions:'',status:'active',phase:'live',lanes:lanes(b.lanes),updated_at:new Date().toISOString()
      }).select('id').single())
      await checked(db.from('stip_meeting_invites').insert({meeting_id:row.id,agent_id:c.agent_id,status:'accepted',member_role:'organizer',invited_by_agent_id:c.agent_id,responded_at:new Date().toISOString(),updated_at:new Date().toISOString()}))
      return J({ok:true,...await detail(c,row.id)})
    }

    if(action==='update_meeting'){
      const m=await organizer(c,String(b.meeting_id||''));if(m.phase!=='live')throw Error('REUNION_FINALISEE')
      const title=clean(b.title,160);if(!title)throw Error('TITRE_REQUIS')
      const nextLanes=lanes(b.lanes)
      const used=await checked(db.from('stip_meeting_items').select('lane_key').eq('meeting_id',m.id))||[]
      const allowed=new Set(nextLanes.map((x:any)=>x.key))
      if(used.some((x:any)=>!allowed.has(x.lane_key)))throw Error('COLONNE_UTILISEE')
      await checked(db.from('stip_meeting_notes').update({title,meeting_at:stamp(b.meeting_at||m.meeting_at),lanes:nextLanes,updated_at:new Date().toISOString()}).eq('id',m.id))
      return J({ok:true,...await detail(c,m.id)})
    }

    if(action==='invite'){
      const m=await organizer(c,String(b.meeting_id||''));if(m.phase!=='live')throw Error('REUNION_FINALISEE')
      const agentId=String(b.agent_id||'');if(agentId===String(m.owner_agent_id))throw Error('DEJA_ORGANISATEUR')
      if(!await candidateAllowed(agentId))throw Error('INVITE_NON_AUTORISE')
      await checked(db.from('stip_meeting_invites').upsert({meeting_id:m.id,agent_id:agentId,status:'pending',member_role:'invitee',invited_by_agent_id:c.agent_id,responded_at:null,updated_at:new Date().toISOString()},{onConflict:'meeting_id,agent_id'}))
      await db.from('stip_notifications').insert({agent_id:agentId,type:'info',title:'Invitation à une réunion',body:m.title,source_type:'meeting_invite',source_ref:m.id,metadata:{url:'meeting-notes.html?meeting='+m.id,section:'meeting_invite'}})
      return J({ok:true,...await detail(c,m.id)})
    }

    if(action==='respond_invite'){
      const id=String(b.meeting_id||'');const decision=String(b.decision||'')
      if(!uuid(id)||!['accepted','declined'].includes(decision))throw Error('REPONSE_INVALIDE')
      const row=await checked(db.from('stip_meeting_invites').update({status:decision,responded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('meeting_id',id).eq('agent_id',c.agent_id).eq('status','pending').select('meeting_id').maybeSingle())
      if(!row)throw Error('INVITATION_INTROUVABLE')
      if(decision==='accepted'){
        const shared=await checked(db.from('stip_meeting_items').select('id').eq('meeting_id',id).eq('visibility','shared').eq('audience_mode','all'))||[]
        if(shared.length)await checked(db.from('stip_meeting_item_recipients').upsert(shared.map((x:any)=>({item_id:x.id,agent_id:c.agent_id,status:'open',response_text:'',updated_at:new Date().toISOString()})),{onConflict:'item_id,agent_id'}))
      }
      return J({ok:true,...await list(c)})
    }

    if(action==='save_item'){
      const m=await organizer(c,String(b.meeting_id||''));if(m.phase!=='live')throw Error('REUNION_FINALISEE')
      const body=clean(b.body,4000);if(!body)throw Error('TEXTE_REQUIS')
      const kind=clean(b.kind,30);if(!KINDS.has(kind))throw Error('TYPE_INVALIDE')
      const topic=clean(b.topic,160)||'À classer'
      const laneKey=clean(b.lane_key,40)
      if(!lanes(m.lanes).some((x:any)=>x.key===laneKey))throw Error('COLONNE_INVALIDE')
      const visibility=b.visibility==='shared'?'shared':'private'
      const audienceMode=b.audience_mode==='selected'?'selected':'all'
      let id=String(b.id||'')
      const payload={meeting_id:m.id,created_by_agent_id:c.agent_id,topic,lane_key:laneKey,kind,body,visibility,audience_mode:audienceMode,updated_at:new Date().toISOString()}
      if(id){
        if(!uuid(id))throw Error('ELEMENT_INVALIDE')
        const saved=await checked(db.from('stip_meeting_items').update(payload).eq('id',id).eq('meeting_id',m.id).select('id').maybeSingle())
        if(!saved)throw Error('ELEMENT_INTROUVABLE')
      }else{
        const saved=await checked(db.from('stip_meeting_items').insert(payload).select('id').single());id=saved.id
      }
      if(visibility==='shared')await syncAudience(id,m.id,audienceMode,b.audience_agent_ids)
      else await checked(db.from('stip_meeting_item_recipients').delete().eq('item_id',id))
      return J({ok:true,...await detail(c,m.id)})
    }

    if(action==='delete_item'){
      const m=await organizer(c,String(b.meeting_id||''));if(m.phase!=='live')throw Error('REUNION_FINALISEE')
      if(!uuid(b.id))throw Error('ELEMENT_INVALIDE')
      await checked(db.from('stip_meeting_items').delete().eq('id',String(b.id)).eq('meeting_id',m.id))
      return J({ok:true,...await detail(c,m.id)})
    }

    if(action==='finalize')return J(await exportAndFinalize(c,String(b.meeting_id||'')))

    if(action==='discard'){
      const m=await organizer(c,String(b.meeting_id||''));if(m.phase!=='live')throw Error('REUNION_FINALISEE')
      await checked(db.from('stip_meeting_notes').delete().eq('id',m.id))
      return J({ok:true,...await list(c)})
    }

    if(action==='followup_update'){
      const itemId=String(b.item_id||'');if(!uuid(itemId))throw Error('ELEMENT_INVALIDE')
      const status=['open','done','acknowledged'].includes(String(b.status||''))?String(b.status):'open'
      const rec=await checked(db.from('stip_meeting_item_recipients').update({status,response_text:clean(b.response_text,2000),updated_at:new Date().toISOString()}).eq('item_id',itemId).eq('agent_id',c.agent_id).select('item_id').maybeSingle())
      if(!rec)throw Error('SUIVI_INTROUVABLE')
      return J({ok:true,...await listHome(c)})
    }

    return J({error:'ACTION_INVALIDE'},400)
  }catch(e){
    const message=e instanceof Error?e.message:clean((e as any)?.message||e,500)
    const status=/SESSION/.test(message)?401:/ACCES|NON_AUTORISE/.test(message)?403:/INTROUVABLE/.test(message)?404:/FINALISEE|COLONNE_UTILISEE/.test(message)?409:/EMAIL_NON_CONFIGURE/.test(message)?503:400
    return J({error:message},status)
  }
})