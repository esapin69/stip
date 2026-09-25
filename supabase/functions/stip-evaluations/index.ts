import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { CRITERIA,LEVELS,NOT_OBSERVED,OBS_KEYS,MODEL_VERSION,makeOfficialPdf,sha256Bytes,safeName,displayDateFr } from './pdf.ts'

const URL=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db=createClient(URL,SERVICE,{auth:{persistSession:false}})
const SIGNATURE_BUCKET='stip-pdf-assets'
const ORIGINS=new Set(['https://stip.esapin.com','https://esapin69.github.io'])
const text=(v:any,m=10000)=>String(v??'').trim().slice(0,m)
const uuid=(v:any)=>{const s=text(v,80);return/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)?s:''}
const date=(v:any)=>{const s=text(v,10);return/^\d{4}-\d{2}-\d{2}$/.test(s)?s:null}
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,'0')).join('')
async function shaText(v:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))}
function cors(req:Request){const o=req.headers.get('origin')||'',ok=!o||ORIGINS.has(o);return{ok,h:{'Access-Control-Allow-Origin':ok&&o?o:'https://stip.esapin.com','Access-Control-Allow-Headers':'content-type,x-stip-session','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}}}
async function json(req:Request,b:any,s=200){return new Response(JSON.stringify(b),{status:s,headers:{...cors(req).h,'Content-Type':'application/json','Cache-Control':'no-store'}})}

async function ctx(req:Request){
  const raw=req.headers.get('x-stip-session')||''
  if(!raw)throw Error('SESSION_STIP_REQUISE')
  const th=await shaText(raw)
  const sQ=await db.from('stip_access_sessions').select('id,profile_id,expires_at,revoked_at').eq('token_hash',th).maybeSingle()
  if(sQ.error)throw sQ.error
  const s=sQ.data
  if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())throw Error('SESSION_EXPIREE')
  const pQ=await db.from('stip_access_profiles').select('id,agent_id,active,permissions').eq('id',s.profile_id).maybeSingle()
  if(pQ.error)throw pQ.error
  const p=pQ.data
  if(!p?.active||!p.permissions?.responsable)throw Error('ACCES_RESPONSABLE_REQUIS')
  const aQ=await db.from('agents').select('id,source_key,nom,prenom,role,actif').eq('id',p.agent_id).maybeSingle()
  if(aQ.error)throw aQ.error
  const a=aQ.data
  if(!a?.actif)throw Error('AGENT_INACTIF')
  const mQ=await db.from('stip_onboarding_managers').select('agent_id,can_manage_all,can_evaluate,active').eq('agent_id',a.id).maybeSingle()
  if(mQ.error)throw mQ.error
  const m=mQ.data?.active?mQ.data:null
  if(!m?.can_evaluate)throw Error('ACCES_EVALUATION_REQUIS')
  await db.from('stip_access_sessions').update({last_seen_at:new Date().toISOString()}).eq('id',s.id)
  return{agent:a,manager:m}
}
async function resolveAgent(b:any){
  let agentId=uuid(b.agent_id),caseId=uuid(b.case_id)||null
  if(!agentId&&caseId){
    const q=await db.from('stip_onboarding_cases').select('agent_id').eq('id',caseId).maybeSingle()
    if(q.error)throw q.error
    agentId=q.data?.agent_id||''
  }
  if(!agentId)throw Error('AGENT_MANQUANT')
  const a=await db.from('agents').select('id,source_key,nom,prenom,role,actif').eq('id',agentId).maybeSingle()
  if(a.error)throw a.error
  if(!a.data?.actif)throw Error('AGENT_INTROUVABLE')
  return{agent:a.data,case_id:caseId}
}
function disp(a:any){return[a?.prenom,a?.nom].filter(Boolean).join(' ')||'Responsable'}
function normalizeCriteria(x:any){const src=x&&typeof x==='object'&&!Array.isArray(x)?x:{},out:any={};for(const c of CRITERIA){const v=text(src[c],120)||NOT_OBSERVED;if(!(LEVELS as readonly string[]).includes(v))throw Error('NIVEAU_INVALIDE');out[c]=v}return out}
function incomingObs(b:any){const o=b.observations&&typeof b.observations==='object'?b.observations:{},legacy=[b.observations_1,b.observations_2,b.observations_3,b.observations_4,b.observations_5,b.observations_generales],out:any={};OBS_KEYS.forEach((k,i)=>out[k]=text(o[k]??legacy[i],i===5?300:180));return out}
function currentObs(log:any[]){const out:any={};OBS_KEYS.forEach(k=>out[k]='');for(const e of Array.isArray(log)?log:[]){if(OBS_KEYS.includes(e?.key)&&typeof e?.text==='string')out[e.key]=e.text}return out}
function trimLog(log:any[]){const by:any={};for(const e of log){if(!OBS_KEYS.includes(e?.key))continue;(by[e.key]??=[]).push(e)}const out:any[]=[];for(const k of OBS_KEYS)out.push(...(by[k]||[]).slice(-4));return out.sort((a,b)=>String(a.at).localeCompare(String(b.at))).slice(-24)}
function pubLive(r:any){if(!r)return null;return{status:'OPEN',case_id:r.case_id,agent_id:r.agent_id,evaluator_name:r.evaluator_name||'',evaluation_date:r.evaluation_date,service:r.service||'',grade:r.grade||'',service_since:r.service_since,decision:r.decision||'',criteria:normalizeCriteria(r.criteria),observations:currentObs(r.observation_log||[]),observation_history:r.observation_log||[],signature_date:r.signature_date,updated_at:r.updated_at}}
function pubLast(r:any){if(!r)return null;return{status:'CLOSED',read_only:true,history_id:r.history_id||null,version:Number(r.version||1),agent_id:r.agent_id,closed_at:r.closed_at,evaluation_date:r.evaluation_date,evaluator_name:r.evaluator_name||'',service:r.service||'',grade:r.grade||'',service_since:r.service_since,decision:r.decision||'',criteria:normalizeCriteria(r.criteria),observations:currentObs(r.observations||[]),observation_history:r.observations||[],pdf_sha256:r.pdf_sha256||'',pdf_name:r.pdf_storage_name||r.drive_name||'',has_pdf:Boolean(r.pdf_storage_path||r.drive_url),legacy_drive_url:r.pdf_storage_path?'':(r.drive_url||'')}}
function signaturePublic(r:any){if(!r)return{statut:'AUCUNE'};return{id:r.id,statut:r.status,expire_le:r.expires_at,signe_le:r.signed_at,annule_le:r.cancelled_at,finalise_le:r.finalized_at}}
async function historyFor(agentId:string){
  const q=await db.from('stip_evaluation_history').select('*').eq('agent_id',agentId).order('version',{ascending:false})
  if(q.error)throw q.error
  return(q.data||[]).map(pubLast)
}
async function latestSignatureRequest(agentId:string){
  const q=await db.from('stip_evaluation_signature_requests').select('*').eq('agent_id',agentId).order('created_at',{ascending:false}).limit(1).maybeSingle()
  if(q.error)throw q.error
  let r=q.data
  if(r&&r.status==='EN_ATTENTE'&&new Date(r.expires_at)<=new Date()){
    await db.from('stip_evaluation_signature_requests').update({status:'EXPIRE',updated_at:new Date().toISOString()}).eq('id',r.id)
    r={...r,status:'EXPIRE'}
  }
  return r
}
async function state(b:any){
  const a=await resolveAgent(b)
  const l=await db.from('stip_evaluation_live').select('*').eq('agent_id',a.agent.id).maybeSingle();if(l.error)throw l.error
  const p=await db.from('stip_evaluation_last').select('*').eq('agent_id',a.agent.id).maybeSingle();if(p.error)throw p.error
  return{agent:{id:a.agent.id,nom:a.agent.nom,prenom:a.agent.prenom,role:a.agent.role},live:pubLive(l.data),previous:pubLast(p.data),history:await historyFor(a.agent.id),signature_request:signaturePublic(await latestSignatureRequest(a.agent.id))}
}
async function searchAgents(b:any){
  const q=text(b.query,80).toLocaleLowerCase('fr-FR')
  const r=await db.from('agents').select('id,source_key,nom,prenom,equipe,ghe,role,avatar_url,profile_photo_url,actif').eq('actif',true).order('nom').limit(300)
  if(r.error)throw r.error
  return(r.data||[]).filter((x:any)=>!q||[x.nom,x.prenom,x.source_key,x.equipe,x.ghe,x.role].filter(Boolean).join(' ').toLocaleLowerCase('fr-FR').includes(q)).slice(0,60)
}
async function catalog(){
  const l=await db.from('stip_evaluation_live').select('agent_id,updated_at').order('updated_at',{ascending:false});if(l.error)throw l.error
  const ids=[...new Set((l.data||[]).map((x:any)=>x.agent_id))]
  if(!ids.length)return[]
  const a=await db.from('agents').select('id,nom,prenom,role,avatar_url,profile_photo_url,actif').in('id',ids);if(a.error)throw a.error
  const m=new Map((a.data||[]).map((x:any)=>[x.id,x]))
  return(l.data||[]).map((x:any)=>({agent_id:x.agent_id,agent:m.get(x.agent_id)||null,updated_at:x.updated_at})).filter((x:any)=>x.agent?.actif!==false)
}
function evaluationCore(r:any,obs:any=currentObs(r?.observation_log||[])){
  const criteria=normalizeCriteria(r?.criteria)
  const orderedCriteria:any={};for(const c of CRITERIA)orderedCriteria[c]=criteria[c]
  const orderedObs:any={};for(const k of OBS_KEYS)orderedObs[k]=text(obs?.[k],k===OBS_KEYS[5]?300:180)
  return{agent_id:r?.agent_id||'',case_id:r?.case_id||null,evaluator_agent_id:r?.evaluator_agent_id||'',evaluator_name:r?.evaluator_name||'',evaluation_date:r?.evaluation_date||null,service:r?.service||'',grade:r?.grade||'',service_since:r?.service_since||null,decision:r?.decision||'',criteria:orderedCriteria,observations:orderedObs,signature_date:r?.signature_date||null,agent_nom:r?.agent_nom||'',agent_prenom:r?.agent_prenom||'',agent_matricule:r?.agent_matricule||'',model_version:r?.model_version||MODEL_VERSION}
}
async function contentHash(r:any,obs?:any){return shaText(JSON.stringify(evaluationCore(r,obs)))}
async function assertWritableAgainstRemote(agentId:string,candidate:any){
  const req=await latestSignatureRequest(agentId)
  if(!req||!['EN_ATTENTE','SIGNE'].includes(req.status))return
  const h=await contentHash(candidate)
  if(h!==req.content_hash)throw Error('EVALUATION_VERROUILLEE_SIGNATURE_AGENT')
}
async function saveLive(c:any,b:any){
  const a=await resolveAgent(b),oldQ=await db.from('stip_evaluation_live').select('*').eq('agent_id',a.agent.id).maybeSingle();if(oldQ.error)throw oldQ.error
  const old=oldQ.data,cr=normalizeCriteria(b.criteria??b.criteres),obs=incomingObs(b),log=Array.isArray(old?.observation_log)?[...old.observation_log]:[],cur=currentObs(log),now=new Date().toISOString()
  for(const k of OBS_KEYS){if(obs[k]!==cur[k]&&(obs[k]||cur[k]))log.push({at:now,by:c.agent.id,by_name:disp(c.agent),key:k,text:obs[k]})}
  const payload={criteria:cr,decision:['OUI','NON'].includes(text(b.decision??b.garder_agent).toUpperCase())?text(b.decision??b.garder_agent).toUpperCase():'',service:text(b.service,200),grade:text(b.grade,100),service_since:null,evaluation_date:date(b.evaluation_date??b.date_evaluation),observation_log:trimLog(log),evaluator_name:disp(c.agent),agent_nom:text(a.agent.nom,250),agent_prenom:text(a.agent.prenom,250),agent_matricule:text(b.agent_matricule,120),signature_date:date(b.signature_date??b.lyon_le),model_version:MODEL_VERSION}
  const caseId=a.case_id||old?.case_id||null
  const candidate={...(old||{}),...payload,agent_id:a.agent.id,case_id:caseId,evaluator_agent_id:c.agent.id}
  await assertWritableAgainstRemote(a.agent.id,candidate)
  const q=await db.rpc('stip_eval_live_upsert',{p_agent_id:a.agent.id,p_case_id:caseId,p_evaluator_agent_id:c.agent.id,p_payload:payload});if(q.error)throw q.error
  return pubLive(q.data)
}
function assertReady(r:any){
  const cr=normalizeCriteria(r.criteria),obs=currentObs(r.observation_log||[])
  if(!Object.values(cr).some(v=>v!==NOT_OBSERVED)&&!Object.values(obs).some(Boolean))throw Error('EVALUATION_VIDE')
  if(!r.grade||!r.service||!r.evaluation_date||!['OUI','NON'].includes(String(r.decision||'')))throw Error('EVALUATION_INCOMPLETE')
}
async function prepare(b:any){
  const s=await state(b)
  if(!s.live)throw Error('EVALUATION_VIDE')
  const raw=await db.from('stip_evaluation_live').select('*').eq('agent_id',s.live.agent_id).single();if(raw.error)throw raw.error
  assertReady(raw.data)
  const vals=Object.values(s.live.criteria),observed=vals.filter(v=>v!==NOT_OBSERVED).length
  return{...s,summary:{observed,not_observed:CRITERIA.length-observed,total:CRITERIA.length}}
}
function randomToken(){const a=new Uint8Array(48);crypto.getRandomValues(a);return btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function createSignatureRequest(c:any,b:any){
  const a=await resolveAgent(b)
  const q=await db.from('stip_evaluation_live').select('*').eq('agent_id',a.agent.id).maybeSingle();if(q.error)throw q.error
  if(!q.data)throw Error('EVALUATION_VIDE')
  assertReady(q.data)
  const current=await latestSignatureRequest(a.agent.id)
  if(current?.status==='SIGNE')throw Error('SIGNATURE_AGENT_DEJA_RECUE')
  if(current?.status==='EN_ATTENTE')await db.from('stip_evaluation_signature_requests').update({status:'ANNULE',cancelled_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',current.id)
  const token=randomToken(),tokenHash=await shaText(token),hash=await contentHash(q.data),expires=new Date(Date.now()+7*86400000).toISOString()
  const ins=await db.from('stip_evaluation_signature_requests').insert({agent_id:a.agent.id,case_id:q.data.case_id,requested_by_agent_id:c.agent.id,evaluator_agent_id:q.data.evaluator_agent_id,token_hash:tokenHash,content_hash:hash,status:'EN_ATTENTE',expires_at:expires}).select('*').single()
  if(ins.error)throw ins.error
  return{...signaturePublic(ins.data),signature_url:'https://stip.esapin.com/signature-agent.html#t='+encodeURIComponent(token)}
}
async function cancelSignatureRequest(c:any,b:any){
  const a=await resolveAgent(b),r=await latestSignatureRequest(a.agent.id)
  if(!r||['ANNULE','EXPIRE'].includes(r.status))return signaturePublic(r)
  if(r.status==='FINALISE')throw Error('EVALUATION_DEJA_OFFICIELLE')
  if(r.signature_path)await db.storage.from(r.signature_bucket||SIGNATURE_BUCKET).remove([r.signature_path])
  const q=await db.from('stip_evaluation_signature_requests').update({status:'ANNULE',cancelled_at:new Date().toISOString(),signature_path:null,signature_bucket:null,updated_at:new Date().toISOString()}).eq('id',r.id).select('*').single()
  if(q.error)throw q.error
  return signaturePublic(q.data)
}
function decodePngDataUrl(v:any){
  const s=text(v,400000)
  if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s))throw Error('SIGNATURE_INVALIDE')
  if(s.length>350000)throw Error('SIGNATURE_TROP_VOLUMINEUSE')
  const bin=atob(s.slice(s.indexOf(',')+1)),a=new Uint8Array(bin.length)
  for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i)
  if(a.length<100||a[0]!==137||a[1]!==80||a[2]!==78||a[3]!==71)throw Error('SIGNATURE_INVALIDE')
  return a
}
async function publicRequestByToken(token:any){
  const t=text(token,160)
  if(!/^[A-Za-z0-9_-]{40,120}$/.test(t))throw Error('LIEN_SIGNATURE_INVALIDE')
  const h=await shaText(t)
  const q=await db.from('stip_evaluation_signature_requests').select('*').eq('token_hash',h).maybeSingle();if(q.error)throw q.error
  let r=q.data
  if(!r)throw Error('LIEN_SIGNATURE_INVALIDE')
  if(r.status==='EN_ATTENTE'&&new Date(r.expires_at)<=new Date()){
    await db.from('stip_evaluation_signature_requests').update({status:'EXPIRE',updated_at:new Date().toISOString()}).eq('id',r.id)
    r={...r,status:'EXPIRE'}
  }
  if(!['EN_ATTENTE','SIGNE'].includes(r.status))throw Error('LIEN_SIGNATURE_INVALIDE')
  return r
}
async function publicGetSignature(b:any){
  const r=await publicRequestByToken(b.token)
  const q=await db.from('stip_evaluation_live').select('*').eq('agent_id',r.agent_id).maybeSingle();if(q.error)throw q.error
  if(!q.data)throw Error('EVALUATION_INTROUVABLE')
  if(await contentHash(q.data)!==r.content_hash)throw Error('EVALUATION_MODIFIEE_APRES_PARTAGE')
  return{request:signaturePublic(r),evaluation:evaluationCore(q.data)}
}
async function publicSubmitSignature(b:any){
  const r=await publicRequestByToken(b.token)
  if(r.status==='SIGNE')return{request:signaturePublic(r)}
  const q=await db.from('stip_evaluation_live').select('*').eq('agent_id',r.agent_id).maybeSingle();if(q.error)throw q.error
  if(!q.data||await contentHash(q.data)!==r.content_hash)throw Error('EVALUATION_MODIFIEE_APRES_PARTAGE')
  const png=decodePngDataUrl(b.signature),sha=await sha256Bytes(png),path=`temporary-signatures/evaluations/${r.agent_id}/${r.id}.png`
  const up=await db.storage.from(SIGNATURE_BUCKET).upload(path,png,{contentType:'image/png',upsert:true});if(up.error)throw up.error
  const u=await db.from('stip_evaluation_signature_requests').update({status:'SIGNE',signed_at:new Date().toISOString(),signature_bucket:SIGNATURE_BUCKET,signature_path:path,signature_sha256:sha,updated_at:new Date().toISOString()}).eq('id',r.id).select('*').single()
  if(u.error){await db.storage.from(SIGNATURE_BUCKET).remove([path]);throw u.error}
  return{request:signaturePublic(u.data)}
}
async function signatureBytesFromRequest(r:any,current:any){
  if(!r||r.status!=='SIGNE')return null
  if(await contentHash(current)!==r.content_hash)throw Error('EVALUATION_MODIFIEE_APRES_SIGNATURE_AGENT')
  if(!r.signature_path||!r.signature_sha256)throw Error('FICHIER_SIGNATURE_AGENT_MANQUANT')
  const d=await db.storage.from(r.signature_bucket||SIGNATURE_BUCKET).download(r.signature_path);if(d.error||!d.data)throw Error('FICHIER_SIGNATURE_AGENT_MANQUANT')
  const bytes=new Uint8Array(await d.data.arrayBuffer())
  if(await sha256Bytes(bytes)!==r.signature_sha256)throw Error('EMPREINTE_SIGNATURE_AGENT_INVALIDE')
  return bytes
}
async function templateBytes(){
  const q=await db.from('stip_official_document_templates').select('version,sha256,storage_bucket,storage_path').eq('document_key','evaluation_2026').eq('active',true).order('updated_at',{ascending:false}).limit(1).maybeSingle()
  if(q.error)throw q.error
  if(!q.data?.storage_bucket||!q.data?.storage_path)throw Error('MODELE_OFFICIEL_NON_REFERENCE')
  const r=await db.storage.from(q.data.storage_bucket).download(q.data.storage_path)
  if(r.error||!r.data)throw Error('MODELE_OFFICIEL_INDISPONIBLE')
  const a=new Uint8Array(await r.data.arrayBuffer())
  if(a.length<10000||String.fromCharCode(...a.slice(0,5))!=='%PDF-')throw Error('MODELE_OFFICIEL_INVALIDE')
  return{bytes:a,version:q.data.version||MODEL_VERSION}
}
function toB64(a:Uint8Array){let s='';for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode(...a.subarray(i,Math.min(i+0x8000,a.length)));return btoa(s)}
async function storeOfficialPdf(agentId:string,name:string,pdf:Uint8Array){
  const path=`official/evaluations/${agentId}/${crypto.randomUUID()}.pdf`
  const up=await db.storage.from(SIGNATURE_BUCKET).upload(path,pdf,{contentType:'application/pdf',upsert:false})
  if(up.error)throw Error('ENREGISTREMENT_PDF_SUPABASE_ECHOUE')
  return{bucket:SIGNATURE_BUCKET,path,name}
}
async function officialPdfLink(b:any){
  const a=await resolveAgent(b)
  let q:any=db.from('stip_evaluation_history').select('history_id,version,pdf_storage_bucket,pdf_storage_path,pdf_storage_name,drive_url,drive_name,pdf_sha256').eq('agent_id',a.agent.id)
  if(b.history_id)q=q.eq('history_id',text(b.history_id,80))
  else if(Number(b.version)>0)q=q.eq('version',Number(b.version))
  else q=q.order('version',{ascending:false}).limit(1)
  const r=await q.maybeSingle();if(r.error)throw r.error
  const d=r.data;if(!d)throw Error('PDF_OFFICIEL_INTROUVABLE')
  if(!d.pdf_storage_path){
    if(d.drive_url)return{legacy:true,view_url:d.drive_url,download_url:d.drive_url,name:d.drive_name||'Evaluation.pdf',sha256:d.pdf_sha256||''}
    throw Error('PDF_OFFICIEL_INTROUVABLE')
  }
  const bucket=d.pdf_storage_bucket||SIGNATURE_BUCKET,name=d.pdf_storage_name||'Evaluation.pdf'
  const view=await db.storage.from(bucket).createSignedUrl(d.pdf_storage_path,600)
  if(view.error||!view.data?.signedUrl)throw Error('LIEN_PDF_OFFICIEL_INDISPONIBLE')
  const down=await db.storage.from(bucket).createSignedUrl(d.pdf_storage_path,600,{download:name})
  if(down.error||!down.data?.signedUrl)throw Error('LIEN_PDF_OFFICIEL_INDISPONIBLE')
  return{legacy:false,view_url:view.data.signedUrl,download_url:down.data.signedUrl,name,sha256:d.pdf_sha256||''}
}
async function finalize(c:any,b:any){
  const a=await resolveAgent(b),lockToken=crypto.randomUUID()
  const reserve=await db.rpc('stip_eval_finalize_reserve',{p_agent_id:a.agent.id,p_token:lockToken});if(reserve.error)throw reserve.error
  let remote:any=null
  try{
    const q=await db.from('stip_evaluation_live').select('*').eq('agent_id',a.agent.id).maybeSingle();if(q.error)throw q.error
    const r=q.data;if(!r)throw Error('EVALUATION_VIDE')
    assertReady(r)
    remote=await latestSignatureRequest(a.agent.id)
    if(remote?.status==='EN_ATTENTE')throw Error('SIGNATURE_AGENT_EN_ATTENTE')
    const local=b.signatures&&typeof b.signatures==='object'?b.signatures:{}
    const responsable=local.responsable?decodePngDataUrl(local.responsable):null
    if(!responsable)throw Error('SIGNATURE_RESPONSABLE_REQUISE')
    const remoteAgent=remote?.status==='SIGNE'?await signatureBytesFromRequest(remote,r):null
    const localAgent=!remoteAgent&&local.agent?decodePngDataUrl(local.agent):null
    const direction=local.direction?decodePngDataUrl(local.direction):null
    const obs=currentObs(r.observation_log||[]),template=await templateBytes()
    const p={...r,criteria:normalizeCriteria(r.criteria),observations:obs,signature_date:r.signature_date||r.evaluation_date,model_version:template.version}
    const sigMeta={agent:remoteAgent?{mode:'distance',sha256:await sha256Bytes(remoteAgent)}:localAgent?{mode:'local',sha256:await sha256Bytes(localAgent)}:null,responsable:{mode:'local',sha256:await sha256Bytes(responsable)},direction:direction?{mode:'local',sha256:await sha256Bytes(direction)}:null}
    const pdf=await makeOfficialPdf(template.bytes,p,{agent:remoteAgent||localAgent,responsable,direction,names:{agent:`${r.agent_prenom||''} ${r.agent_nom||''}`.trim(),responsable:r.evaluator_name||disp(c.agent),direction:text(b.direction_name,160)}})
    const sha=await sha256Bytes(pdf),name=safeName(`${r.agent_nom||''} ${r.agent_prenom||''} - Evaluation ${displayDateFr(r.evaluation_date)}.pdf`)
    const stored=await storeOfficialPdf(a.agent.id,name,pdf)
    const close=await db.rpc('stip_eval_live_close',{p_agent_id:a.agent.id,p_closed_by:c.agent.id,p_pdf:{storage_bucket:stored.bucket,storage_path:stored.path,name:stored.name,sha256:sha,signatures:sigMeta}})
    if(close.error){await db.storage.from(stored.bucket).remove([stored.path]);throw close.error}
    if(remote&&['SIGNE','EN_ATTENTE'].includes(remote.status)){
      if(remote.signature_path)await db.storage.from(remote.signature_bucket||SIGNATURE_BUCKET).remove([remote.signature_path])
      await db.from('stip_evaluation_signature_requests').update({status:'FINALISE',finalized_at:new Date().toISOString(),signature_path:null,signature_bucket:null,updated_at:new Date().toISOString()}).eq('id',remote.id)
    }
    return{closed:pubLast(close.data),delivery:{storage:'supabase',name:stored.name,sha256:sha},pdf_base64:toB64(pdf),reset:true}
  }finally{
    try{await db.rpc('stip_eval_finalize_release',{p_agent_id:a.agent.id,p_token:lockToken})}catch(_){ }
  }
}

Deno.serve(async req=>{
  const c0=cors(req)
  if(!c0.ok)return json(req,{error:'ORIGINE_REFUSEE'},403)
  if(req.method==='OPTIONS')return new Response('ok',{headers:c0.h})
  if(req.method!=='POST')return json(req,{error:'METHODE_NON_AUTORISEE'},405)
  try{
    const b=await req.json().catch(()=>({})),act=text(b.action,80)
    if(act==='public_signature_get')return json(req,{ok:true,...await publicGetSignature(b)})
    if(act==='public_signature_submit')return json(req,{ok:true,...await publicSubmitSignature(b)})
    const c=await ctx(req)
    if(act==='catalog')return json(req,{ok:true,items:await catalog()})
    if(act==='search_agents')return json(req,{ok:true,items:await searchAgents(b)})
    if(['state','list','listEvaluations'].includes(act))return json(req,{ok:true,...await state(b)})
    if(act==='history'){const a=await resolveAgent(b);return json(req,{ok:true,history:await historyFor(a.agent.id)})}
    if(['save_live','saveEvaluationDraft'].includes(act))return json(req,{ok:true,live:await saveLive(c,b)})
    if(['prepare_finalize','prepareFinalize'].includes(act))return json(req,{ok:true,...await prepare(b)})
    if(act==='signature_request')return json(req,{ok:true,request:await createSignatureRequest(c,b)})
    if(act==='signature_status'){const a=await resolveAgent(b);return json(req,{ok:true,request:signaturePublic(await latestSignatureRequest(a.agent.id))})}
    if(act==='signature_cancel')return json(req,{ok:true,request:await cancelSignatureRequest(c,b)})
    if(act==='official_pdf_link')return json(req,{ok:true,...await officialPdfLink(b)})
    if(['finalize','finalizeEvaluation'].includes(act))return json(req,{ok:true,...await finalize(c,b)})
    return json(req,{error:'ACTION_INVALIDE'},400)
  }catch(e){
    console.error(e)
    const m=e instanceof Error?e.message:String(e)
    const s=/ACCES|ORIGINE/.test(m)?403:/SESSION/.test(m)?401:/ENREGISTREMENT_PDF_SUPABASE_ECHOUE/.test(m)?503:400
    return json(req,{error:m},s)
  }
})
