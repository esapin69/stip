import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, apikey','Access-Control-Allow-Methods':'POST, OPTIONS'}
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,'Content-Type':'application/json','Cache-Control':'no-store'}})
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
const clean=(v:unknown,n=1000)=>String(v??'').trim().slice(0,n)
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,'0')).join('')
async function sha256(s:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))}
function token(){const a=new Uint8Array(24);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
function safe(s:string){return String(s||'planning').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,140)||'planning'}
const PAGE_MAX=15*1024*1024
const PAGE_EXT=new Set(['pdf','png','jpg','jpeg','webp'])
const PAGE_MIME=new Set(['application/pdf','image/png','image/jpeg','image/webp','application/octet-stream'])

async function trackedRow(id:string,secret:string){
  if(!id||!secret)throw Error('Suivi indisponible.')
  const {data:r,error}=await db.from('stip_public_access_requests').select('id,first_name,last_name,professional_role,status,metadata,reviewed_at,decision_note').eq('id',id).maybeSingle()
  if(error||!r)throw Error('Demande introuvable.')
  if(r.metadata?.tracking_hash!==await sha256(secret))throw Error('Suivi invalide.')
  return r
}
async function ensureCodeFree(code:string,requestId=''){
  const codeKey=await sha256(code)
  const {data:used}=await db.from('stip_access_profiles').select('id').eq('code_key',codeKey).maybeSingle()
  if(used)throw Error('Ce code est déjà utilisé. Choisissez-en un autre.')
  let q=db.from('stip_public_access_requests').select('id').eq('status','pending').contains('metadata',{requested_code:code})
  if(requestId)q=q.neq('id',requestId)
  const {data:pending}=await q.limit(1)
  if(pending?.length)throw Error('Ce code est déjà demandé. Choisissez-en un autre.')
}
function pageFileMeta(b:any){
  const name=clean(b.file_name,220),size=Number(b.file_size||0),type=clean(b.file_type,120).toLowerCase()||'application/octet-stream',ext=name.toLowerCase().split('.').pop()||''
  if(!name||size<=0)throw Error('Planning manquant.')
  if(size>PAGE_MAX)throw Error('Le planning dépasse 15 Mo.')
  if(!PAGE_EXT.has(ext)||!PAGE_MIME.has(type))throw Error('Format de planning non accepté. Utilisez une photo ou un PDF.')
  return{name,size,type}
}
async function rateLimit(req:Request){
  const ip=clean((req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'').split(',')[0],100)
  if(!ip)return ''
  const ipHash=await sha256(ip),since=new Date(Date.now()-3600000).toISOString()
  const {count,error}=await db.from('stip_public_access_requests').select('id',{count:'exact',head:true}).gte('created_at',since).contains('metadata',{ip_hash:ipHash})
  if(error)throw error
  if((count||0)>=4)throw Error('Trop de demandes récentes. Réessayez plus tard.')
  return ipHash
}
async function signedUpload(path:string){
  const {data,error}=await db.storage.from('planning-pdf').createSignedUploadUrl(path,{upsert:false})
  if(error||!data?.signedUrl)throw error||Error('Préparation du dépôt impossible.')
  return{signed_url:data.signedUrl,path:data.path,token:data.token}
}
async function preparePage(req:Request,b:any){
  const first_name=clean(b.first_name,80),last_name=clean(b.last_name,80),professional_role=clean(b.professional_role,120),workplace=clean(b.workplace,160),comment=clean(b.comment,800),requested_code=clean(b.requested_code,6).replace(/\D/g,''),file=pageFileMeta(b)
  if(!first_name||!last_name)throw Error('Nom et prénom requis.')
  if(!professional_role)throw Error('Indiquez votre métier ou votre poste.')
  if(!/^\d{6}$/.test(requested_code))throw Error('Choisissez un code personnel de 6 chiffres.')
  await ensureCodeFree(requested_code)
  const ip_hash=await rateLimit(req),tracking=token(),tracking_hash=await sha256(tracking)
  const reason=[`Métier : ${professional_role}`,workplace?`Établissement / entreprise : ${workplace}`:'',`Planning joint : ${file.name}`,comment?`Commentaire : ${comment}`:''].filter(Boolean).join('\n')
  const {data:r,error}=await db.from('stip_public_access_requests').insert({first_name,last_name,professional_role,reason,requested_access:'personalized_stip',metadata:{source:'public_personal_page',tracking_hash,requested_code,workplace:workplace||null,comment:comment||null,ip_hash:ip_hash||null,planning_state:'preparing',planning_original_name:file.name,planning_size_bytes:file.size,planning_mime_type:file.type}}).select('id,metadata').single()
  if(error)throw error
  const path=`public-page-requests/${r.id}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe(file.name)}`
  try{
    const upload=await signedUpload(path)
    const metadata={...r.metadata,planning_state:'awaiting_upload',planning_storage_bucket:'planning-pdf',planning_storage_path:path}
    const {error:ue}=await db.from('stip_public_access_requests').update({metadata}).eq('id',r.id)
    if(ue)throw ue
    return{ok:true,request_id:r.id,tracking_token:tracking,...upload}
  }catch(e){
    await db.from('stip_public_access_requests').delete().eq('id',r.id)
    throw e
  }
}
async function resumePage(b:any){
  const r=await trackedRow(clean(b.request_id,80),clean(b.tracking_token,100))
  if(r.status!=='pending'||r.metadata?.source!=='public_personal_page')throw Error('Cette demande ne peut plus être modifiée.')
  const file=pageFileMeta(b)
  const oldPath=clean(r.metadata?.planning_storage_path,500)
  if(oldPath)await db.storage.from('planning-pdf').remove([oldPath]).catch(()=>{})
  const path=`public-page-requests/${r.id}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe(file.name)}`
  const upload=await signedUpload(path)
  const metadata={...(r.metadata||{}),planning_state:'awaiting_upload',planning_storage_bucket:'planning-pdf',planning_storage_path:path,planning_original_name:file.name,planning_size_bytes:file.size,planning_mime_type:file.type}
  const {error}=await db.from('stip_public_access_requests').update({metadata}).eq('id',r.id).eq('status','pending')
  if(error)throw error
  return{ok:true,request_id:r.id,...upload}
}
async function completePage(b:any){
  const r=await trackedRow(clean(b.request_id,80),clean(b.tracking_token,100))
  if(r.status!=='pending')return{ok:true,status:r.status}
  if(r.metadata?.source!=='public_personal_page')throw Error('Demande incompatible.')
  if(r.metadata?.planning_upload_id)return{ok:true,status:'pending',upload_id:r.metadata.planning_upload_id}
  const path=clean(r.metadata?.planning_storage_path,500)
  if(!path)throw Error('Dépôt du planning introuvable.')
  const cut=path.lastIndexOf('/'),folder=cut>=0?path.slice(0,cut):'',name=cut>=0?path.slice(cut+1):path
  const {data:list,error:le}=await db.storage.from('planning-pdf').list(folder,{limit:20,search:name})
  if(le)throw le
  if(!(list||[]).some((x:any)=>x.name===name))throw Error('Le planning n’a pas encore été reçu.')
  const {data:existing}=await db.from('admin_upload_inbox').select('id').eq('storage_bucket','planning-pdf').eq('storage_path',path).maybeSingle()
  let uploadId=existing?.id||''
  if(!uploadId){
    const {data:row,error:ie}=await db.from('admin_upload_inbox').insert({uploader_agent_id:null,uploader_source_key:'public-page-request',uploader_name:[r.first_name,r.last_name].filter(Boolean).join(' '),original_name:clean(r.metadata?.planning_original_name,220)||name,mime_type:clean(r.metadata?.planning_mime_type,120)||null,size_bytes:Number(r.metadata?.planning_size_bytes||0),storage_bucket:'planning-pdf',storage_path:path,status:'pending',analysis:{source:'public_personal_page',request_id:r.id,professional_role:r.professional_role||null,workplace:r.metadata?.workplace||null},proposed_destination:'personal_planning_page',questions:[]}).select('id').single()
    if(ie)throw ie
    uploadId=row.id
  }
  const metadata={...(r.metadata||{}),planning_state:'received',planning_upload_id:uploadId,planning_received_at:new Date().toISOString()}
  const {error:ue}=await db.from('stip_public_access_requests').update({metadata}).eq('id',r.id).eq('status','pending')
  if(ue)throw ue
  return{ok:true,status:'pending',upload_id:uploadId}
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS})
  if(req.method!=='POST')return json({error:'Méthode non autorisée.'},405)
  try{
    const b=await req.json().catch(()=>({})),action=clean(b.action,30)||'submit'
    if(action==='status'){
      const r=await trackedRow(clean(b.request_id,80),clean(b.tracking_token,100))
      return json({ok:true,status:r.status,reviewed_at:r.reviewed_at,decision_note:r.decision_note||null,needs_code:r.status==='pending'&&!/^\d{6}$/.test(String(r.metadata?.requested_code||'')),code:r.status==='approved'?(r.metadata?.granted_code||r.metadata?.requested_code||null):null})
    }
    if(action==='set_code'){
      const id=clean(b.request_id,80),secret=clean(b.tracking_token,100),requested_code=clean(b.requested_code,6),r=await trackedRow(id,secret)
      if(r.status!=='pending')return json({error:'Cette demande a déjà été traitée.'},409)
      if(!/^\d{6}$/.test(requested_code))return json({error:'Choisissez un code personnel de 6 chiffres.'},400)
      await ensureCodeFree(requested_code,id)
      const metadata={...(r.metadata||{}),requested_code}
      const {error}=await db.from('stip_public_access_requests').update({metadata}).eq('id',id).eq('status','pending')
      if(error)throw error
      return json({ok:true,status:'pending',needs_code:false})
    }
    if(action==='prepare_page')return json(await preparePage(req,b),201)
    if(action==='resume_page')return json(await resumePage(b))
    if(action==='complete_page')return json(await completePage(b))

    const first_name=clean(b.first_name,80),last_name=clean(b.last_name,80),comment=clean(b.comment??b.reason,1200),requested_code=clean(b.requested_code,6)
    if(!first_name||!last_name)return json({error:'Nom et prénom requis.'},400)
    if(!/^\d{6}$/.test(requested_code))return json({error:'Choisissez un code personnel de 6 chiffres.'},400)
    await ensureCodeFree(requested_code)
    const tracking=token(),tracking_hash=await sha256(tracking)
    const {data,error}=await db.from('stip_public_access_requests').insert({first_name,last_name,professional_role:null,reason:comment||null,metadata:{source:'public_home',tracking_hash,requested_code,comment:comment||null}}).select('id').single()
    if(error)throw error
    return json({ok:true,message:'Demande transmise.',request_id:data.id,tracking_token:tracking})
  }catch(e){
    console.error(e)
    const message=e instanceof Error?e.message:'Impossible de transmettre la demande.'
    const status=/déjà/.test(message)?409:/Trop de demandes/.test(message)?429:/introuvable/.test(message)?404:/invalide|incompatible/.test(message)?403:/requis|planning|format|code personnel|dépasse/.test(message)?400:500
    return json({error:message},status)
  }
})