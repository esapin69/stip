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
  return {role_key:role,access_level:accessLevel,visibility:vis,places,aliases,tags,relations,routes,route_steps:steps,route_fragments,constraints,elevator_stops,room_ranges,generated_at:new Date().toISOString()}
}


const EXPORT_PLACE_TYPES=new Set(['hospital','building','building_or_zone','service','unit','exam','block','helipad','entrance','elevator','elevator_group','walkway','landmark','room','staff_area','staff_room','reception','hall','operational_landmark','operational_point'])
const MAIN_BUILDINGS=[
  {code:'HLP',label:'CARDIO',subtitle:'Hôpital Louis Pradel'},
  {code:'PW',label:'NEURO',subtitle:'Hôpital Pierre Wertheimer'},
  {code:'HFME',label:'HFME',subtitle:'Hôpital Femme Mère Enfant'}
]
const ANNEX_CODES=['A1','A3','A4','B1','B13','B14','B16','CERMEP','IDÉE','MORTUAIRE','MPM','RADIO','GHE']

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
function xlsxResponse(snapshot:any){
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
    'Content-Disposition':'attachment; filename="Visite-des-lieux-GHE-'+exportDate()+'.xlsx"',
    'Cache-Control':'no-store'
  }})
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
async function pdfResponse(snapshot:any){
  const pdf=await PDFDocument.create()
  const regular=await pdf.embedFont(StandardFonts.Helvetica)
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold)
  const W=595.28,H=841.89,M=42,CONTENT=W-M*2
  const navy=rgb(0.035,0.30,0.42),ink=rgb(0.08,0.20,0.24),muted=rgb(0.38,0.49,0.52),soft=rgb(0.91,0.97,0.98),line=rgb(0.76,0.87,0.89)
  let page:any=null,y=0

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
    page.drawText(pdfSafe(subtitle),{x:M,y:H-95,size:10,font:bold,color:navy,maxWidth:CONTENT})
    page.drawLine({start:{x:M,y:H-111},end:{x:W-M,y:H-111},thickness:1.2,color:navy})
    page.drawRectangle({x:M,y:255,width:CONTENT,height:270,color:soft})
    const tw=bold.widthOfTextAtSize(pdfSafe(title),25)
    page.drawText(pdfSafe(title),{x:Math.max(M,M+(CONTENT-tw)/2),y:405,size:25,font:bold,color:navy,maxWidth:CONTENT})
    const subLines=wrapPdf(regular,detail,10,CONTENT-60)
    let yy=365
    for(const l of subLines){const lw=regular.widthOfTextAtSize(l,10);page.drawText(l,{x:M+(CONTENT-lw)/2,y:yy,size:10,font:regular,color:muted});yy-=15}
    footer(page,'Intercalaire')
    y=0
  }

  const aliasesBy=new Map<string,string[]>()
  for(const a of snapshot.aliases||[]){const arr=aliasesBy.get(String(a.place_id))||[];arr.push(String(a.alias||''));aliasesBy.set(String(a.place_id),arr)}
  const tagsBy=new Map<string,string[]>()
  for(const t of snapshot.tags||[]){const arr=tagsBy.get(String(t.place_id))||[];arr.push(String(t.tag||''));tagsBy.set(String(t.place_id),arr)}

  freshPage('VISITER LES LIEUX - GHE','Export opérationnel généré depuis la source canonique Supabase · '+exportDate())
  heading('REPÈRES BÂTIMENTS')
  const roots=(snapshot.places||[]).filter((p:any)=>['hospital','building','building_or_zone'].includes(p.place_type)&&p.id!=='ghe')
    .sort((a:any,b:any)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.display_name).localeCompare(String(b.display_name),'fr'))
  for(const p of roots){
    textBlock((p.building_code?p.building_code+' · ':'')+(p.display_name||p.official_name||p.id),9,bold,ink)
    if(p.summary)textBlock(p.summary,8,regular,muted,10,4)
  }

  const renderBuilding=(code:string,label:string,subtitle:string)=>{
    divider(label,subtitle,'Synthèse des destinations, niveaux, codes, contacts et repères disponibles dans STIP')
    freshPage(label+' · '+subtitle,'Données issues du référentiel Supabase au '+exportDate())
    const rows=(snapshot.places||[]).filter((p:any)=>String(p.building_code||'').toUpperCase()===code&&EXPORT_PLACE_TYPES.has(p.place_type)&&!['hospital','building','building_or_zone'].includes(p.place_type))
    const levels=[...new Set(rows.map((p:any)=>String(p.level||'')))].sort((a,b)=>levelRank(a)-levelRank(b)||a.localeCompare(b,'fr'))
    for(const lvl of levels){
      heading(levelLabel(lvl))
      const items=rows.filter((p:any)=>String(p.level||'')===lvl).sort((a:any,b:any)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.display_name).localeCompare(String(b.display_name),'fr'))
      for(const p of items){
        ensure(52,label+' · '+subtitle)
        textBlock((p.display_name||p.official_name||p.id)+(p.official_name&&p.official_name!==p.display_name?' · '+p.official_name:''),9,bold,ink,0,1)
        const facts=[p.summary,p.details].filter(Boolean)
        const als=(aliasesBy.get(String(p.id))||[]).filter(Boolean).slice(0,8)
        if(als.length)facts.push('Alias : '+als.join(' · '))
        const usefulTags=(tagsBy.get(String(p.id))||[]).map((x:string)=>x.replace(/^(internal|purpose|contact|phone|tel|telephone|shortcut|warning):/i,'').trim()).filter(Boolean).slice(0,10)
        if(usefulTags.length)facts.push(...usefulTags)
        for(const fact of facts)textBlock(fact,7.6,regular,muted,10,1)
        y-=4
      }
    }
  }

  for(const b of MAIN_BUILDINGS)renderBuilding(b.code,b.label,b.subtitle)

  divider('BÂTIMENTS ANNEXES','GHE · REPÈRES BÂTIMENTS','A1 · A3 · A4 · B1 · B13 · B14 · B16 · CERMEP · MPM · Radiothérapie · Mortuaire · autres repères')
  freshPage('BÂTIMENTS ANNEXES · GHE','Référentiel par bâtiment')
  for(const code of ANNEX_CODES){
    const items=(snapshot.places||[]).filter((p:any)=>String(p.building_code||'').toUpperCase()===code&&EXPORT_PLACE_TYPES.has(p.place_type))
    if(!items.length)continue
    heading(code)
    for(const p of items.sort((a:any,b:any)=>levelRank(a.level)-levelRank(b.level)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.display_name).localeCompare(String(b.display_name),'fr'))){
      const prefix=p.level?levelLabel(p.level)+' · ':''
      textBlock(prefix+(p.display_name||p.official_name||p.id),8.7,bold,ink)
      const facts=[p.summary,p.details].filter(Boolean)
      const als=(aliasesBy.get(String(p.id))||[]).filter(Boolean).slice(0,6)
      if(als.length)facts.push('Alias : '+als.join(' · '))
      const usefulTags=(tagsBy.get(String(p.id))||[]).map((x:string)=>x.replace(/^(internal|purpose|contact|phone|tel|telephone|shortcut|warning):/i,'').trim()).filter(Boolean).slice(0,8)
      if(usefulTags.length)facts.push(...usefulTags)
      for(const fact of facts)textBlock(fact,7.5,regular,muted,10,1)
      y-=3
    }
  }

  const bytes=await pdf.save()
  return new Response(bytes,{status:200,headers:{
    ...CORS,
    'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="Visite-des-lieux-GHE-'+exportDate()+'.pdf"',
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
    if(action==='export_xlsx'||action==='export_pdf'){
      if(session.app_level!=='pro')return json({error:'Export réservé à l’accès professionnel.'},403)
      const snapshot=await bootstrap(allowedVisibilities(session),session.role_key,session.app_level)
      return action==='export_xlsx'?xlsxResponse(snapshot):await pdfResponse(snapshot)
    }
    return json({error:'Action invalide.'},400)
  }catch(e){
    console.error(e)
    return json({error:e instanceof Error?e.message:String(e)},500)
  }
})
