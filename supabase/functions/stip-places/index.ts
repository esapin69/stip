import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as XLSX from 'npm:xlsx@0.18.5'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, content-type, x-stip-session, apikey',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json','Cache-Control':'no-store'}})
const URL=Deno.env.get('SUPABASE_URL')!
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db=createClient(URL,SERVICE,{auth:{persistSession:false}})

const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,'0')).join('')
async function sha256(s:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))}

function level(v:any){
  v=String(v||'').toLowerCase()
  if(['pro','admin','internal','internal_stip','restricted'].includes(v))return'pro'
  if(['visitor','visiteur','basic','public'].includes(v))return'visitor'
  return'visitor'
}

async function sessionFrom(req:Request){
  const token=req.headers.get('x-stip-session')||''
  if(!token)return null
  const hash=await sha256(token)
  const {data:s,error}=await db.from('stip_access_sessions').select('id,profile_id,expires_at,revoked_at').eq('token_hash',hash).maybeSingle()
  if(error)throw error
  if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())return null
  const {data:p,error:pe}=await db.from('stip_access_profiles').select('id,active,role_key,permission_overrides,permissions,agent_id').eq('id',s.profile_id).maybeSingle()
  if(pe)throw pe
  if(!p?.active)return null
  const permissions=(p.permissions&&typeof p.permissions==='object')?p.permissions:{}
  const overrides=(p.permission_overrides&&typeof p.permission_overrides==='object')?p.permission_overrides:{}
  const merged={...permissions,...overrides}
  const appAllowed=merged.places===true
  const appLevel=level(merged?.__levels?.places)
  return {session_id:s.id,profile_id:p.id,agent_id:p.agent_id,role_key:String(p.role_key||'visiteur'),app_allowed:appAllowed,app_level:appLevel}
}

function allowedVisibilities(session:any){
  if(session?.app_level!=='pro')return ['public']
  if(session?.role_key==='admin')return ['public','internal_stip','restricted']
  return ['public','internal_stip']
}

const patientTag=(raw:any)=>{
  const t=String(raw||'').trim().toLowerCase()
  return t.startsWith('transport:')||t.startsWith('patient_transport:')||t.startsWith('care:')||t.startsWith('prise_en_charge:')||t.startsWith('patient:')||t.startsWith('patient_')||t.includes('transport patient')||t.includes('prise en charge patient')
}
const privateTag=(raw:any)=>{
  const t=String(raw||'').trim().toLowerCase()
  return t.startsWith('internal:')||t.startsWith('particularity:')||t.startsWith('particularite:')||
    t.startsWith('contact:')||t.startsWith('phone:')||t.startsWith('tel:')||t.startsWith('telephone:')||t.startsWith('internal_email:')||t.startsWith('email_internal:')||
    t.startsWith('staff_elevator:')||t.startsWith('elevator_staff:')||t.startsWith('ascenseur_pro:')||
    t.startsWith('warning:')||t.startsWith('vigilance:')||t.startsWith('shortcut:')||t.startsWith('raccourci:')||t.startsWith('liaison_pro:')||
    t.startsWith('temporary:')||t.startsWith('temporaire:')||t.startsWith('internal_note:')||t.startsWith('note_terrain:')||patientTag(t)
}

async function bootstrap(vis:string[], role='public_share', accessLevel='visitor'){
  const [placesQ,relQ,routesQ,fragmentsQ,constraintsQ,stopsQ,roomRangesQ]=await Promise.all([
    db.from('stip_places').select('*').in('visibility',vis).order('sort_order').order('display_name'),
    db.from('stip_place_relations').select('*').in('visibility',vis).order('sort_order').order('id'),
    db.from('stip_place_routes').select('*').in('visibility',vis).order('sort_order').order('label'),
    db.from('stip_place_route_fragments').select('*').in('visibility',vis).order('id'),
    db.from('stip_place_constraints').select('*').in('visibility',vis).order('id'),
    db.from('stip_place_elevator_stops').select('*').in('visibility',vis).order('elevator_id').order('sort_order'),
    db.from('stip_place_room_ranges').select('*').in('visibility',vis).order('sort_order').order('room_from')
  ])
  for(const q of [placesQ,relQ,routesQ,fragmentsQ,constraintsQ,stopsQ,roomRangesQ]) if(q.error) throw q.error
  const places=placesQ.data||[]
  const ids=places.map((x:any)=>x.id)
  const routeIds=(routesQ.data||[]).map((x:any)=>x.id)
  let aliases:any[]=[];let tags:any[]=[];let steps:any[]=[]
  if(ids.length){
    const [a,t]=await Promise.all([
      db.from('stip_place_aliases').select('place_id,alias').in('place_id',ids),
      db.from('stip_place_tags').select('place_id,tag').in('place_id',ids)
    ])
    if(a.error)throw a.error;if(t.error)throw t.error
    aliases=a.data||[]
    const rawTags=t.data||[]
    tags=accessLevel==='visitor'?rawTags.filter((x:any)=>!privateTag(x.tag)):rawTags
  }
  if(routeIds.length){
    const q=await db.from('stip_place_route_steps').select('*').in('route_id',routeIds).in('visibility',vis).order('route_id').order('step_no')
    if(q.error)throw q.error
    steps=q.data||[]
  }
  const allowed=new Set(ids)
  const relations=(relQ.data||[]).filter((r:any)=>allowed.has(r.from_place_id)&&allowed.has(r.to_place_id))
  const routes=(routesQ.data||[]).filter((r:any)=>allowed.has(r.to_place_id)&&(!r.from_place_id||allowed.has(r.from_place_id)))
  const routeSet=new Set(routes.map((r:any)=>r.id))
  steps=steps.filter((s:any)=>routeSet.has(s.route_id)&&(!s.landmark_place_id||allowed.has(s.landmark_place_id)))
  const canRestricted=vis.includes('restricted')
  const route_fragments=(fragmentsQ.data||[]).map((f:any)=>canRestricted?f:{...f,restricted_substeps:[]})
  const constraints=(constraintsQ.data||[]).filter((c:any)=>{
    const scope=Array.isArray(c.scope)?c.scope:[]
    return scope.length===0||scope.some((id:string)=>allowed.has(id))
  })
  const elevator_stops=(stopsQ.data||[])
    .filter((s:any)=>allowed.has(s.elevator_id))
    .map((s:any)=>({...s,linked_place_id:s.linked_place_id&&allowed.has(s.linked_place_id)?s.linked_place_id:null}))
  const room_ranges=(roomRangesQ.data||[]).filter((r:any)=>!r.service_place_id||allowed.has(r.service_place_id))
  let dictionary_field_defs:any[]=[]
  if(accessLevel==='pro'){
    const defsQ=await db.from('stip_place_dictionary_field_defs')
      .select('field_key,group_key,label,description,sort_order,completion_kind,completion_config,export_when_empty,applies_to_types')
      .order('sort_order')
    if(defsQ.error)throw defsQ.error
    dictionary_field_defs=defsQ.data||[]
  }
  return {role_key:role,access_level:accessLevel,visibility:vis,places,aliases,tags,relations,routes,route_steps:steps,route_fragments,constraints,elevator_stops,room_ranges,dictionary_field_defs,generated_at:new Date().toISOString()}
}


const EXPORT_PLACE_TYPES=new Set(['hospital','building','building_or_zone','service','unit','exam','block','helipad','entrance','elevator','elevator_group','walkway','landmark','room','staff_area','staff_room','reception','hall','operational_landmark','operational_point'])
const MAIN_BUILDINGS=[
  {code:'HLP',label:'CARDIO',subtitle:'Hôpital Louis Pradel'},
  {code:'PW',label:'NEURO',subtitle:'Hôpital Pierre Wertheimer'},
  {code:'HFME',label:'HFME',subtitle:'Hôpital Femme Mère Enfant'}
]
const INTERCALARY_DETAIL:Record<string,string>={
  HLP:'Synthèse · dictionnaire · accès et repères terrain',
  PW:'Synthèse · dictionnaire · accès et repères transport',
  HFME:'Synthèse · dictionnaire · repères terrain'
}
const ANNEX_CODES=['A1','A3','A4','B1','B13','B14','B16','CERMEP','IDÉE','MORTUAIRE','MPM','RADIO','GHE']
const FIXED_TEMPLATE_BUCKET='ghe-media'
const FIXED_TEMPLATE_PATH='exports/visite-des-lieux/master.pdf'
const FIXED_TEMPLATE_PAGE_INDEX={overview:0,HLP:1,PW:4,HFME:9,annexes:13} as const
const FIXED_TEMPLATE_EXPECTED_PAGE_COUNT=16
async function loadFixedTemplatePdf(){
  const {data,error}=await db.storage.from(FIXED_TEMPLATE_BUCKET).download(FIXED_TEMPLATE_PATH)
  if(error||!data)throw new Error('Template PDF fixe indisponible.')
  const bytes=await data.arrayBuffer()
  const source=await PDFDocument.load(bytes)
  const count=source.getPageCount()
  if(count!==FIXED_TEMPLATE_EXPECTED_PAGE_COUNT){
    throw new Error('Template PDF fixe incompatible : '+count+' pages au lieu de '+FIXED_TEMPLATE_EXPECTED_PAGE_COUNT+'.')
  }
  return source
}
function exportDate(){return new Date().toISOString().slice(0,10)}
function exportCell(v:any){if(v===null||v===undefined)return'';if(typeof v==='object')return JSON.stringify(v);return v}
function appendSheet(book:any,name:string,rows:any[]){
  const normalized=(rows||[]).map((row:any)=>{
    const out:any={}
    for(const [k,v] of Object.entries(row||{}))out[k]=exportCell(v)
    return out
  })
  const ws=XLSX.utils.json_to_sheet(normalized.length?normalized:[{info:'Aucune donnée'}])
  XLSX.utils.book_append_sheet(book,ws,name.slice(0,31))
}

const DOMAIN_PLACE_TYPES:Record<string,Set<string>>={
  services:new Set(['service','unit','room','virtual_room','reception','staff_area','staff_room']),
  examens:new Set(['exam']),
  blocs:new Set(['block']),
  acces:new Set(['entrance','elevator','elevator_group','walkway','landmark','hall','helipad','operational_landmark','operational_point'])
}
function cleanScope(raw:any){
  const mode=['all','building','domain','custom'].includes(String(raw?.mode||''))?String(raw.mode):'all'
  const building_codes=Array.isArray(raw?.building_codes)?raw.building_codes.map((x:any)=>String(x||'').trim().toUpperCase()).filter(Boolean).slice(0,30):[]
  const domain=String(raw?.domain||'').trim().toLowerCase()
  const place_ids=Array.isArray(raw?.place_ids)?raw.place_ids.map((x:any)=>String(x||'').trim()).filter(Boolean).slice(0,250):[]
  return {mode,building_codes,domain,place_ids}
}
function scopeDisplayLabel(scope:any){
  if(scope.mode==='building'){
    const labels=scope.building_codes.map((code:string)=>MAIN_BUILDINGS.find(b=>b.code===code)?.label||code)
    return labels.length?labels.join(' + '):'Bâtiment'
  }
  if(scope.mode==='domain'){
    return ({services:'Services & unités',examens:'Examens',blocs:'Blocs',acces:'Accès & repères'} as Record<string,string>)[scope.domain]||'Domaine'
  }
  if(scope.mode==='custom')return'Sélection personnalisée'
  return'GHE complet'
}
function scopeFilePart(label:string){
  return pdfSafe(label).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,54)||'GHE'
}
function scopedSnapshot(snapshot:any,rawScope:any){
  const scope=cleanScope(rawScope)
  if(scope.mode==='all')return {snapshot,scope,label:scopeDisplayLabel(scope)}
  const places=snapshot.places||[]
  const byId=new Map<string,any>(places.map((p:any)=>[String(p.id),p]))
  const selected=new Set<string>()
  if(scope.mode==='building'){
    const codes=new Set(scope.building_codes)
    for(const p of places)if(codes.has(String(p.building_code||'').toUpperCase()))selected.add(String(p.id))
  }else if(scope.mode==='domain'){
    const types=DOMAIN_PLACE_TYPES[scope.domain]||new Set<string>()
    for(const p of places)if(types.has(String(p.place_type||'')))selected.add(String(p.id))
  }else if(scope.mode==='custom'){
    for(const id of scope.place_ids)if(byId.has(id))selected.add(id)
  }
  const addAncestors=(id:string)=>{
    let p=byId.get(id),guard=0
    while(p&&guard++<20){
      selected.add(String(p.id))
      const parent=String(p.parent_id||'')
      if(!parent||!byId.has(parent))break
      p=byId.get(parent)
    }
  }
  for(const id of [...selected])addAncestors(id)

  const routes=(snapshot.routes||[]).filter((r:any)=>selected.has(String(r.to_place_id||'')))
  for(const r of routes){
    const from=String(r.from_place_id||'')
    if(from&&byId.has(from))addAncestors(from)
  }
  const routeIds=new Set(routes.map((r:any)=>String(r.id)))
  const route_steps=(snapshot.route_steps||[]).filter((x:any)=>routeIds.has(String(x.route_id)))
  for(const step of route_steps){
    const landmark=String(step.landmark_place_id||'')
    if(landmark&&byId.has(landmark))addAncestors(landmark)
  }

  const filteredPlaces=places.filter((p:any)=>selected.has(String(p.id)))
  if(!filteredPlaces.length)throw new Error('Aucune destination ne correspond à cette sélection.')
  const ids=new Set(filteredPlaces.map((p:any)=>String(p.id)))
  const relations=(snapshot.relations||[]).filter((r:any)=>ids.has(String(r.from_place_id||''))&&ids.has(String(r.to_place_id||'')))
  const constraints=(snapshot.constraints||[]).filter((c:any)=>{
    const list=Array.isArray(c.scope)?c.scope.map((x:any)=>String(x)):[]
    return list.length===0||list.some((id:string)=>ids.has(id))
  })
  const elevator_stops=(snapshot.elevator_stops||[]).filter((x:any)=>ids.has(String(x.elevator_id||'')))
    .map((x:any)=>({...x,linked_place_id:x.linked_place_id&&ids.has(String(x.linked_place_id))?x.linked_place_id:null}))
  const room_ranges=(snapshot.room_ranges||[]).filter((x:any)=>!x.service_place_id||ids.has(String(x.service_place_id)))
  const filtered={
    ...snapshot,
    places:filteredPlaces,
    aliases:(snapshot.aliases||[]).filter((x:any)=>ids.has(String(x.place_id))),
    tags:(snapshot.tags||[]).filter((x:any)=>ids.has(String(x.place_id))),
    relations,
    routes,
    route_steps,
    constraints,
    elevator_stops,
    room_ranges
  }
  return {snapshot:filtered,scope,label:scopeDisplayLabel(scope)}
}

function xlsxResponse(snapshot:any,scopeLabel='GHE complet'){
  const book=XLSX.utils.book_new()
  appendSheet(book,'DESTINATIONS',snapshot.places)
  appendSheet(book,'ALIASES',snapshot.aliases)
  appendSheet(book,'TAGS',snapshot.tags)
  appendSheet(book,'RELATIONS',snapshot.relations)
  appendSheet(book,'ITINERAIRES',snapshot.routes)
  appendSheet(book,'ETAPES_ITINERAIRES',snapshot.route_steps)
  appendSheet(book,'FRAGMENTS_ITINERAIRES',snapshot.route_fragments)
  appendSheet(book,'ASCENSEURS',snapshot.elevator_stops)
  appendSheet(book,'CHAMBRES',snapshot.room_ranges)
  appendSheet(book,'CONTRAINTES',snapshot.constraints)
  appendSheet(book,'METADONNEES',[{
    generated_at:snapshot.generated_at,
    access_level:snapshot.access_level,
    visibility:(snapshot.visibility||[]).join(' | '),
    source:'Supabase STIP - référentiel Visiter les lieux'
  }])
  const bytes=XLSX.write(book,{bookType:'xlsx',type:'array',compression:true})
  return new Response(bytes,{status:200,headers:{
    ...CORS,
    'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition':'attachment; filename="Visite-des-lieux-'+scopeFilePart(scopeLabel)+'-'+exportDate()+'.xlsx"',
    'Cache-Control':'no-store'
  }})
}

function exportFactValue(v:any){
  const value=String(v??'').trim()
  if(!value)return''
  const n=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()
  if(/^(a completer|a confirmer|a preciser|non renseigne|information non renseignee|information en cours de preparation)[.!…]*$/.test(n))return''
  return value
}
function pdfSafe(v:any){
  return String(v??'')
    .replace(/Œ/g,'OE').replace(/œ/g,'oe')
    .replace(/[’‘]/g,"'").replace(/[“”]/g,'"')
    .replace(/[–—]/g,'-').replace(/→/g,'>').replace(/←/g,'<')
    .replace(/•/g,'-').replace(/…/g,'...')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g,' ')
    .replace(/\s+/g,' ').trim()
}
function levelRank(v:any){
  const s=String(v??'').trim().toUpperCase()
  if(s==='-2')return-20;if(s==='-1')return-10
  if(s==='RDJ'||s==='RJ')return-5
  if(s==='RDC'||s==='RC'||s==='0')return 0
  if(s==='TM')return 0.5
  const n=Number(s.replace(/[^0-9.-]/g,''))
  return Number.isFinite(n)?n:999
}
function levelLabel(v:any){
  const s=String(v??'').trim()
  if(!s)return'Autres repères'
  if(/^1(er)?$/i.test(s))return'1er'
  if(/^\d+$/.test(s))return s+'e'
  return s
}
function wrapPdf(font:any,text:string,size:number,maxWidth:number){
  const clean=pdfSafe(text)
  if(!clean)return[]
  const words=clean.split(' '),lines:string[]=[];let current=''
  for(const word of words){
    const next=current?current+' '+word:word
    if(font.widthOfTextAtSize(next,size)<=maxWidth)current=next
    else{
      if(current)lines.push(current)
      if(font.widthOfTextAtSize(word,size)<=maxWidth)current=word
      else{
        let part=''
        for(const ch of word){
          const test=part+ch
          if(font.widthOfTextAtSize(test,size)<=maxWidth)part=test
          else{if(part)lines.push(part);part=ch}
        }
        current=part
      }
    }
  }
  if(current)lines.push(current)
  return lines
}
async function pdfResponse(snapshot:any,scope:any,scopeLabel='GHE complet'){
  const pdf=await PDFDocument.create()
  const regular=await pdf.embedFont(StandardFonts.Helvetica)
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold)
  const W=595.28,H=841.89,M=42,CONTENT=W-M*2
  const navy=rgb(0.035,0.30,0.42),ink=rgb(0.08,0.20,0.24),muted=rgb(0.38,0.49,0.52),soft=rgb(0.91,0.97,0.98),line=rgb(0.76,0.87,0.89)
  const fixedTemplate=await loadFixedTemplatePdf()
  let page:any=null,y=0
  const appendFixedPage=async(index:number)=>{
    const [fixed]=await pdf.copyPages(fixedTemplate,[index])
    pdf.addPage(fixed)
    page=null
    y=0
  }

  const footer=(p:any,label='')=>{
    p.drawLine({start:{x:M,y:28},end:{x:W-M,y:28},thickness:.6,color:line})
    p.drawText(pdfSafe('STIP · GHE · Visiter les lieux'+(label?' · '+label:'')),{x:M,y:15,size:7,font:regular,color:muted})
  }
  const freshPage=(title:string,subtitle='')=>{
    page=pdf.addPage([W,H]);y=H-50
    page.drawText(pdfSafe(title),{x:M,y,size:20,font:bold,color:navy,maxWidth:CONTENT});y-=26
    if(subtitle){for(const l of wrapPdf(regular,subtitle,9,CONTENT)){page.drawText(l,{x:M,y,size:9,font:regular,color:muted});y-=12}}
    page.drawLine({start:{x:M,y:y-2},end:{x:W-M,y:y-2},thickness:1,color:line});y-=19
    footer(page)
    return page
  }
  const ensure=(need:number,title='Suite')=>{
    if(!page||y<45+need){freshPage(title)}
  }
  const textBlock=(text:string,size=8.5,font=regular,color=ink,indent=0,gap=2)=>{
    const lines=wrapPdf(font,text,size,CONTENT-indent)
    const need=lines.length*(size+3)+gap
    ensure(need+8)
    for(const l of lines){page.drawText(l,{x:M+indent,y,size,font,color});y-=size+3}
    y-=gap
  }
  const heading=(text:string)=>{
    ensure(30)
    page.drawRectangle({x:M,y:y-15,width:CONTENT,height:20,color:soft})
    page.drawText(pdfSafe(text),{x:M+8,y:y-9,size:10,font:bold,color:navy,maxWidth:CONTENT-16})
    y-=29
  }
  const divider=(title:string,subtitle:string,detail:string)=>{
    page=pdf.addPage([W,H])
    page.drawText('VISITER LES LIEUX',{x:M,y:H-72,size:23,font:bold,color:navy})
    page.drawText(pdfSafe(title+' · '+subtitle.toUpperCase()),{x:M,y:H-95,size:10,font:bold,color:navy,maxWidth:CONTENT})
    page.drawLine({start:{x:M,y:H-111},end:{x:W-M,y:H-111},thickness:1.2,color:navy})
    page.drawRectangle({x:M,y:255,width:CONTENT,height:270,color:soft})
    const titleSafe=pdfSafe(title),subSafe=pdfSafe(subtitle)
    const tw=bold.widthOfTextAtSize(titleSafe,22)
    page.drawText(titleSafe,{x:Math.max(M,M+(CONTENT-tw)/2),y:404,size:22,font:bold,color:navy,maxWidth:CONTENT})
    const sw=bold.widthOfTextAtSize(subSafe,15)
    page.drawText(subSafe,{x:Math.max(M,M+(CONTENT-sw)/2),y:365,size:15,font:bold,color:navy,maxWidth:CONTENT})
    const subLines=wrapPdf(bold,detail,11,CONTENT-70)
    let yy=322
    for(const l of subLines){const lw=bold.widthOfTextAtSize(l,11);page.drawText(l,{x:M+(CONTENT-lw)/2,y:yy,size:11,font:bold,color:navy});yy-=16}
    footer(page,'Intercalaire · '+title)
    y=0
  }

  const aliasesBy=new Map<string,string[]>()
  for(const a of snapshot.aliases||[]){const arr=aliasesBy.get(String(a.place_id))||[];arr.push(String(a.alias||''));aliasesBy.set(String(a.place_id),arr)}
  const tagsBy=new Map<string,string[]>()
  for(const t of snapshot.tags||[]){const arr=tagsBy.get(String(t.place_id))||[];arr.push(String(t.tag||''));tagsBy.set(String(t.place_id),arr)}

  if(scope?.mode==='all'){
    await appendFixedPage(FIXED_TEMPLATE_PAGE_INDEX.overview)
  }else{
    freshPage('VISITER LES LIEUX - '+scopeLabel,'Document fabriqué par STIP · pages fixes validées + dictionnaire Supabase · '+exportDate())
    heading('PÉRIMÈTRE')
    textBlock(scopeLabel,11,bold,ink)
  }

  const renderBuilding=async(code:string,label:string,subtitle:string)=>{
    const rows=(snapshot.places||[]).filter((p:any)=>String(p.building_code||'').toUpperCase()===code&&EXPORT_PLACE_TYPES.has(p.place_type)&&!['hospital','building','building_or_zone'].includes(p.place_type))
    if(!rows.length)return
    divider(label,subtitle,INTERCALARY_DETAIL[code]||'Synthèse · dictionnaire · repères terrain')
    const fixedIndex=code==='HLP'?FIXED_TEMPLATE_PAGE_INDEX.HLP:code==='PW'?FIXED_TEMPLATE_PAGE_INDEX.PW:FIXED_TEMPLATE_PAGE_INDEX.HFME
    await appendFixedPage(fixedIndex)
    freshPage(label+' · '+subtitle+' · DICTIONNAIRE','Données issues du référentiel Supabase au '+exportDate())
    const levels=[...new Set(rows.map((p:any)=>String(p.level||'')))].sort((a,b)=>levelRank(a)-levelRank(b)||a.localeCompare(b,'fr'))
    for(const lvl of levels){
      heading(levelLabel(lvl))
      const items=rows.filter((p:any)=>String(p.level||'')===lvl).sort((a:any,b:any)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.display_name).localeCompare(String(b.display_name),'fr'))
      for(const p of items){
        ensure(52,label+' · '+subtitle)
        textBlock((p.display_name||p.official_name||p.id)+(p.official_name&&p.official_name!==p.display_name?' · '+p.official_name:''),9,bold,ink,0,1)
        const facts=[p.summary,p.details].map(exportFactValue).filter(Boolean)
        const als=(aliasesBy.get(String(p.id))||[]).map(exportFactValue).filter(Boolean).slice(0,8)
        if(als.length)facts.push('Alias : '+als.join(' · '))
        const usefulTags=(tagsBy.get(String(p.id))||[]).map((x:string)=>exportFactValue(x.replace(/^(internal|purpose|contact|phone|tel|telephone|shortcut|warning):/i,'').trim())).filter(Boolean).slice(0,10)
        if(usefulTags.length)facts.push(...usefulTags)
        for(const fact of facts)textBlock(fact,7.6,regular,muted,10,1)
        y-=4
      }
    }
  }

  for(const b of MAIN_BUILDINGS)await renderBuilding(b.code,b.label,b.subtitle)

  const hasAnnex=(snapshot.places||[]).some((p:any)=>ANNEX_CODES.includes(String(p.building_code||'').toUpperCase())&&EXPORT_PLACE_TYPES.has(p.place_type))
  if(hasAnnex){
    await appendFixedPage(FIXED_TEMPLATE_PAGE_INDEX.annexes)
    freshPage('BÂTIMENTS ANNEXES · DICTIONNAIRE','Référentiel dynamique par bâtiment · '+exportDate())
  }
  for(const code of ANNEX_CODES){
    const items=(snapshot.places||[]).filter((p:any)=>String(p.building_code||'').toUpperCase()===code&&EXPORT_PLACE_TYPES.has(p.place_type))
    if(!items.length)continue
    heading(code)
    for(const p of items.sort((a:any,b:any)=>levelRank(a.level)-levelRank(b.level)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.display_name).localeCompare(String(b.display_name),'fr'))){
      const prefix=p.level?levelLabel(p.level)+' · ':''
      textBlock(prefix+(p.display_name||p.official_name||p.id),8.7,bold,ink)
      const facts=[p.summary,p.details].map(exportFactValue).filter(Boolean)
      const als=(aliasesBy.get(String(p.id))||[]).map(exportFactValue).filter(Boolean).slice(0,6)
      if(als.length)facts.push('Alias : '+als.join(' · '))
      const usefulTags=(tagsBy.get(String(p.id))||[]).map((x:string)=>exportFactValue(x.replace(/^(internal|purpose|contact|phone|tel|telephone|shortcut|warning):/i,'').trim())).filter(Boolean).slice(0,8)
      if(usefulTags.length)facts.push(...usefulTags)
      for(const fact of facts)textBlock(fact,7.5,regular,muted,10,1)
      y-=3
    }
  }

  const bytes=await pdf.save()
  return new Response(bytes,{status:200,headers:{
    ...CORS,
    'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="Visite-des-lieux-'+scopeFilePart(scopeLabel)+'-'+exportDate()+'.pdf"',
    'Cache-Control':'no-store'
  }})
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS})
  if(req.method!=='POST')return json({error:'Méthode non autorisée.'},405)
  try{
    const body=await req.json().catch(()=>({}))
    const action=String(body.action||'bootstrap')
    if(action==='bootstrap_public')return json(await bootstrap(['public'],'public_share','visitor'))
    const session=await sessionFrom(req)
    if(!session)return json({error:'Session STIP expirée.'},401)
    if(!session.app_allowed)return json({error:'Accès Visiter les lieux non autorisé.'},403)
    if(action==='bootstrap')return json(await bootstrap(allowedVisibilities(session),session.role_key,session.app_level))
    if(action==='export_pdf'){
      if(session.app_level!=='pro')return json({error:'Export réservé à l’accès professionnel.'},403)
      const fullSnapshot=await bootstrap(allowedVisibilities(session),session.role_key,session.app_level)
      const scoped=scopedSnapshot(fullSnapshot,body.scope)
      return await pdfResponse(scoped.snapshot,scoped.scope,scoped.label)
    }
    if(action==='export_xlsx'){
      if(session.app_level!=='pro')return json({error:'Export réservé à l’accès professionnel.'},403)
      const fullSnapshot=await bootstrap(allowedVisibilities(session),session.role_key,session.app_level)
      const scoped=scopedSnapshot(fullSnapshot,body.scope)
      return xlsxResponse(scoped.snapshot,scoped.label)
    }
    return json({error:'Action invalide.'},400)
  }catch(e){
    console.error(e)
    return json({error:e instanceof Error?e.message:String(e)},500)
  }
})
