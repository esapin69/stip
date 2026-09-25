import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const URL=Deno.env.get('SUPABASE_URL')!, SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db=createClient(URL,SERVICE,{auth:{persistSession:false}})
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-stip-session','Access-Control-Allow-Methods':'POST,OPTIONS'}
const J=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...C,'Content-Type':'application/json','Cache-Control':'no-store'}})
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,'0')).join('')
async function sha(s:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))}
function text(v:unknown,m=1000){return String(v??'').trim().slice(0,m)}
function parisDate(v?:string|Date){const d=v instanceof Date?v:new Date(v||Date.now());const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),g=(k:string)=>p.find(x=>x.type===k)?.value||'';return `${g('year')}-${g('month')}-${g('day')}`}
function name(a:any){const p=text(a?.prenom,80),n=text(a?.nom,120);if(p)return [p.toLocaleUpperCase('fr-FR'),n.toLocaleLowerCase('fr-FR')].filter(Boolean).join(' ');return n||'Agent'}
async function ctx(req:Request){const raw=req.headers.get('x-stip-session')||'';if(!raw)throw Error('SESSION_STIP_REQUISE');const s=await db.from('stip_access_sessions').select('profile_id,expires_at,revoked_at').eq('token_hash',await sha(raw)).maybeSingle();if(s.error)throw s.error;if(!s.data||s.data.revoked_at||new Date(s.data.expires_at)<=new Date())throw Error('SESSION_EXPIREE');const p=await db.from('stip_access_profiles').select('id,agent_id,active,permissions').eq('id',s.data.profile_id).maybeSingle();if(p.error)throw p.error;if(!p.data?.active)throw Error('ACCES_DESACTIVE');if(!p.data.permissions?.agent_dates)throw Error('ACCES_DATE_AGENTS_REQUIS');return p.data}
async function list(c:any){
  const today=parisDate(),future=new Date();future.setUTCDate(future.getUTCDate()+370);const end=parisDate(future)
  const [agenda,formations,stagiaires]=await Promise.all([
    db.from('stip_agent_agenda_items').select('id,agent_id,created_by_agent_id,source_type,source_ref,display_mode,title,body,event_date,all_day,start_time,end_time,location,importance,status,event_kind,icon,agent:agents!stip_agent_agenda_items_agent_id_fkey(id,source_key,nom,prenom,equipe,ghe)').eq('status','active').gte('event_date',today).lte('event_date',end).order('event_date').order('start_time'),
    db.from('formations').select('id,source_key,agent_source_key,intitule,date_debut,date_fin,lieu,statut,observation,horaire').gte('date_fin',today+'T00:00:00Z').lte('date_debut',end+'T23:59:59Z').order('date_debut'),
    db.from('stagiaires').select('id,source_key,nom,prenom,date_debut,date_fin,horaires,referent,observation').gte('date_fin',today).lte('date_debut',end).order('date_debut')
  ])
  for(const q of [agenda,formations,stagiaires])if(q.error)throw q.error

  const keys=[...new Set((formations.data||[]).map((x:any)=>x.agent_source_key).filter(Boolean))]
  let agents:any[]=[]
  if(keys.length){const a=await db.from('agents').select('id,source_key,nom,prenom,equipe,ghe').in('source_key',keys);if(a.error)throw a.error;agents=a.data||[]}
  const byKey=new Map(agents.map((a:any)=>[a.source_key,a])),items:any[]=[]
  const cat=(x:any)=>{
    const s=[x?.source_type,x?.event_kind,x?.title].filter(Boolean).join(' ').toLocaleLowerCase('fr-FR')
    if(s.includes('mobi_lit_medical')||s.includes('visite')||s.includes('médical')||s.includes('medical'))return 'medical'
    if(s.includes('stagiaire')||s.includes('intern'))return 'intern'
    if(s.includes('formation')||s.includes('training'))return 'training'
    return 'other'
  }
  const labels:any={medical:'Visite médicale',intern:'Stagiaire',training:'Formation',other:'Événement'}
  const icons:any={medical:'🩺',intern:'👶',training:'🎓',other:'📌'}

  for(const x of agenda.data||[]){
    const category=cat(x),sourceKind=category==='medical'?'medical':'agenda',start=text(x.start_time,8).slice(0,5),finish=text(x.end_time,8).slice(0,5)
    items.push({
      id:`agenda:${x.id}`,source_id:x.id,source_kind:sourceKind,category,category_label:labels[category],date:String(x.event_date),end_date:String(x.event_date),
      person_name:name(x.agent),person_kind:'agent',agent_id:x.agent?.id||x.agent_id||null,agent_source_key:x.agent?.source_key||null,
      title:text(x.title)||labels[category],time:x.all_day?'Toute la journée':[start,finish].filter(Boolean).join('–'),
      location:text(x.location,240),detail:text(x.body,1500),icon:text(x.icon,16)||icons[category],
      cancellable:String(x.created_by_agent_id||'')===String(c.agent_id||''),
      meta:{importance:x.importance||'normal',event_kind:x.event_kind||'',display_mode:x.display_mode||'',source_type:x.source_type||'',created_by_me:String(x.created_by_agent_id||'')===String(c.agent_id||'')}
    })
  }
  for(const x of formations.data||[]){
    const a=byKey.get(x.agent_source_key)
    items.push({id:`training:${x.id}`,source_id:x.id,source_kind:'training',category:'training',category_label:'Formation',date:parisDate(x.date_debut),end_date:parisDate(x.date_fin||x.date_debut),person_name:name(a||{nom:x.agent_source_key}),person_kind:'agent',agent_id:a?.id||null,agent_source_key:x.agent_source_key||null,title:text(x.intitule)||'Formation',time:text(x.horaire,120),location:text(x.lieu,500),detail:text(x.observation,1500),icon:'🎓',cancellable:false,meta:{status:x.statut||''}})
  }
  for(const x of stagiaires.data||[]){
    items.push({id:`intern:${x.id}`,source_id:x.id,source_kind:'intern',category:'intern',category_label:'Stagiaire',date:String(x.date_debut||''),end_date:String(x.date_fin||x.date_debut||''),person_name:[text(x.prenom,80),text(x.nom,120)].filter(Boolean).join(' ')||'Stagiaire',person_kind:'stagiaire',agent_id:null,agent_source_key:null,title:'Stagiaire',time:text(x.horaires,120),location:'',detail:text(x.observation,1500),icon:'👶',cancellable:false,meta:{referent:text(x.referent,240)}})
  }

  const rank=(x:any)=>x.source_kind==='training'||x.source_kind==='intern'?3:x.source_kind==='medical'?2:1
  const deduped=new Map<string,any>()
  for(const x of items){
    const key=[x.category,x.date,x.end_date||x.date,x.agent_id||x.agent_source_key||x.person_name,x.title,x.time].map(v=>String(v||'').trim().toLocaleLowerCase('fr-FR')).join('|')
    const prev=deduped.get(key)
    if(!prev||rank(x)>rank(prev))deduped.set(key,x)
  }
  const result=[...deduped.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.time||'99:99').localeCompare(String(b.time||'99:99'))||String(a.person_name).localeCompare(String(b.person_name),'fr'))
  return {items:result,categories:[{key:'medical',label:'Visites'},{key:'intern',label:'Stagiaires'},{key:'training',label:'Formations'},{key:'other',label:'Événements'}],generated_at:new Date().toISOString(),range_end:end}
}

async function internDetail(sourceId:string){
  const one=await db.from('stagiaires').select('id,source_key,nom,prenom,date_debut,date_fin,horaires,referent,observation').eq('id',sourceId).maybeSingle()
  if(one.error)throw one.error
  if(!one.data)throw Error('STAGIAIRE_INTROUVABLE')
  const x:any=one.data, key=text(x.source_key,240), cut=key.lastIndexOf(':'), prefix=cut>0?key.slice(0,cut):''
  let q:any=db.from('stagiaires').select('id,source_key,nom,prenom,date_debut,date_fin,horaires,referent,observation').order('date_debut')
  q=prefix?q.like('source_key',prefix+':%'):q.eq('nom',x.nom).eq('prenom',x.prenom)
  const all=await q
  if(all.error)throw all.error
  return {kind:'intern',title:[text(x.prenom,80),text(x.nom,120)].filter(Boolean).join(' ')||'Stagiaire',selected_id:x.id,days:(all.data||[]).map((d:any)=>({id:d.id,date:String(d.date_debut||''),end_date:String(d.date_fin||d.date_debut||''),time:text(d.horaires,120),referent:text(d.referent,240),observation:text(d.observation,800)}))}
}
async function trainingDetail(sourceId:string){
  const one=await db.from('formations').select('id,agent_source_key,intitule,date_debut,date_fin,lieu,statut,observation,horaire').eq('id',sourceId).maybeSingle()
  if(one.error)throw one.error
  if(!one.data)throw Error('FORMATION_INTROUVABLE')
  const x:any=one.data
  let q:any=db.from('formations').select('id,agent_source_key,intitule,date_debut,date_fin,lieu,statut,observation,horaire').eq('intitule',x.intitule).eq('date_debut',x.date_debut)
  if(x.date_fin)q=q.eq('date_fin',x.date_fin)
  const all=await q.order('agent_source_key')
  if(all.error)throw all.error
  const keys=[...new Set((all.data||[]).map((r:any)=>r.agent_source_key).filter(Boolean))]
  let agents:any[]=[]
  if(keys.length){const a=await db.from('agents').select('id,source_key,nom,prenom,equipe,ghe').in('source_key',keys);if(a.error)throw a.error;agents=a.data||[]}
  const byKey=new Map(agents.map((a:any)=>[a.source_key,a]))
  return {kind:'training',title:text(x.intitule)||'Formation',selected_id:x.id,date:parisDate(x.date_debut),end_date:parisDate(x.date_fin||x.date_debut),time:text(x.horaire,120),location:text(x.lieu,500),status:text(x.statut,80),participants:(all.data||[]).map((r:any)=>({id:r.id,agent_source_key:r.agent_source_key,name:name(byKey.get(r.agent_source_key)||{nom:r.agent_source_key}),selected:r.id===x.id}))}
}
async function medicalDetail(sourceId:string){
  const one=await db.from('stip_agent_agenda_items').select('id,agent_id,source_type,title,body,event_date,start_time,end_time,location,importance,status,agent:agents!stip_agent_agenda_items_agent_id_fkey(id,source_key,nom,prenom,equipe,ghe)').eq('id',sourceId).eq('status','active').eq('source_type','mobi_lit_medical').maybeSingle()
  if(one.error)throw one.error
  if(!one.data)throw Error('VISITE_INTROUVABLE')
  const x:any=one.data
  const all=await db.from('stip_agent_agenda_items').select('id,agent_id,title,body,event_date,start_time,end_time,location,importance,agent:agents!stip_agent_agenda_items_agent_id_fkey(id,source_key,nom,prenom,equipe,ghe)').eq('status','active').eq('source_type','mobi_lit_medical').eq('event_date',x.event_date).order('start_time')
  if(all.error)throw all.error
  return {kind:'medical',title:'Visites médicales',selected_id:x.id,date:String(x.event_date),appointments:(all.data||[]).map((r:any)=>({id:r.id,name:name(r.agent),agent_id:r.agent?.id||r.agent_id||null,time:[text(r.start_time,8).slice(0,5),text(r.end_time,8).slice(0,5)].filter(Boolean).join('–'),title:text(r.title)||'Visite médicale',location:text(r.location,240),detail:text(r.body,800),selected:r.id===x.id}))}
}

async function agendaDetail(sourceId:string){
  const one=await db.from('stip_agent_agenda_items').select('id,agent_id,source_type,title,body,event_date,all_day,start_time,end_time,location,importance,status,event_kind,icon,agent:agents!stip_agent_agenda_items_agent_id_fkey(id,source_key,nom,prenom,equipe,ghe)').eq('id',sourceId).eq('status','active').maybeSingle()
  if(one.error)throw one.error
  if(!one.data)throw Error('EVENEMENT_INTROUVABLE')
  const x:any=one.data
  return {kind:'agenda',title:text(x.title)||'Événement',date:String(x.event_date),person_name:name(x.agent),agent_id:x.agent?.id||x.agent_id||null,time:x.all_day?'Toute la journée':[text(x.start_time,8).slice(0,5),text(x.end_time,8).slice(0,5)].filter(Boolean).join('–'),location:text(x.location,240),detail:text(x.body,1500),importance:text(x.importance,40),event_kind:text(x.event_kind,80),icon:text(x.icon,16)||'📌'}
}


Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:C});try{await ctx(req);const b=await req.json().catch(()=>({}));if(b.action==='list')return J(await list(c));if(b.action==='intern_detail')return J(await internDetail(text(b.source_id,80)));if(b.action==='training_detail')return J(await trainingDetail(text(b.source_id,80)));if(b.action==='medical_detail')return J(await medicalDetail(text(b.source_id,80)));if(b.action==='agenda_detail')return J(await agendaDetail(text(b.source_id,80)));return J({error:'ACTION_INVALIDE'},400)}catch(e){const m=e instanceof Error?e.message:String(e);return J({error:m},/SESSION/.test(m)?401:/ACCES/.test(m)?403:400)}})