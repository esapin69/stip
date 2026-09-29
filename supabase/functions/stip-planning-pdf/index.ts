import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const URL=Deno.env.get('SUPABASE_URL')!, SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, db=createClient(URL,SERVICE)
const BUCKET='planning-pdf', ROOT='creation-du-planning-en-pdf', VERSION='SUPABASE_PDF_V2_TRANSFORMED'
const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-stip-session','Access-Control-Allow-Methods':'POST,OPTIONS'}
const J=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...C,'Content-Type':'application/json','Cache-Control':'no-store'}})
const mm=(v:number)=>v*72/25.4
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,'0')).join('')
async function sha256(s:string){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))}
const clean=(s:string)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')
const safe=(s:string)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'agent'

async function sessionAgent(req:Request){
  const token=req.headers.get('x-stip-session')||''; if(!token)throw Error('Session STIP requise.')
  const h=await sha256(token)
  const {data:s,error:e}=await db.from('stip_access_sessions').select('profile_id,expires_at,revoked_at').eq('token_hash',h).maybeSingle(); if(e)throw e
  if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())throw Error('Session expirée.')
  const {data:p,error:pe}=await db.from('stip_access_profiles').select('active,permissions,agent_id,agents(id,source_key,nom,prenom,equipe,type_planning,role)').eq('id',s.profile_id).maybeSingle(); if(pe)throw pe
  if(!p?.active)throw Error('Accès désactivé.'); if(!p.permissions?.planning)throw Error('Accès Planning non autorisé.')
  return p.agents
}
function splitName(a:any,c:any){
  if(c?.prenom||c?.nom)return{prenom:String(c?.prenom||'').trim(),nom:String(c?.nom||'').trim()}
  if(a?.prenom)return{prenom:String(a.prenom).trim(),nom:String(a.nom||'').trim()}
  const parts=String(a?.source_key||'').split('_').filter(Boolean);if(parts.length>=2){const first=parts.pop()!;return{prenom:first.toUpperCase(),nom:parts.join(' ').toUpperCase()}}
  const full=String(a?.nom||a?.source_key||'AGENT').trim();return{prenom:full,nom:''}
}
const MONTHS=['','JANVIER','FEVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOUT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DECEMBRE']
const SHIFT_CODES=['RTTA','RTT','RTA','SYR','ABS','RH','RF','RC','CA','AA','MA','DA','J4','M','J','S','N'].sort((a,b)=>b.length-a.length)
function shiftCode(v:any){let t=String(v||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');if(t==='RTTA')return'RTTA';if(t==='RTA')return'RTA';for(const c of SHIFT_CODES)if(t===c)return c;for(const c of SHIFT_CODES)if(t.includes(c))return c;return t}
function weeksInMonth(y:number,m:number){const days=new Date(Date.UTC(y,m,0)).getUTCDate();const first=new Date(Date.UTC(y,m-1,1)).getUTCDay();return Math.ceil((((first+6)%7)+days)/7)}
function color(h:string){h=h.replace('#','');return rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255)}
function contain(img:any,x:number,y:number,w:number,h:number){const s=Math.min(w/img.width,h/img.height);const iw=img.width*s,ih=img.height*s;return{x:x+(w-iw)/2,y:y+(h-ih)/2,width:iw,height:ih}}

async function loadImage(pdf:PDFDocument,a:any,width:number,height:number){
  const {data,error}=await db.storage.from(a.storage_bucket||BUCKET).download(a.storage_path,{transform:{width,height,resize:'contain',quality:80,format:'origin'}})
  if(error||!data)throw Error(`Asset indisponible: ${a.label||a.asset_key}`)
  const bytes=new Uint8Array(await data.arrayBuffer()),mt=String(data.type||a.mime_type||'').toLowerCase()
  if(mt.includes('jpeg')||mt.includes('jpg'))return await pdf.embedJpg(bytes)
  return await pdf.embedPng(bytes)
}

async function render(agent:any,month:string){
  if(!/^\d{4}-\d{2}$/.test(month))throw Error('Mois invalide.')
  const [year,mon]=month.split('-').map(Number);if(mon<1||mon>12)throw Error('Mois invalide.')
  const start=`${year}-${String(mon).padStart(2,'0')}-01`,end=new Date(Date.UTC(year,mon,0)).toISOString().slice(0,10)
  const [{data:rows,error:re},{data:assets,error:ae},{data:contact,error:ce}]=await Promise.all([
    db.from('planning').select('date,code,observation,equipe,source_value').eq('agent_id',agent.id).gte('date',start).lte('date',end).order('date'),
    db.from('planning_pdf_assets').select('asset_type,asset_key,label,agent_source_key,storage_bucket,storage_path,mime_type,checksum_sha256,active').eq('active',true),
    db.from('contacts_ghe').select('nom,prenom,source_key').eq('source_key',agent.source_key).eq('actif',true).maybeSingle()
  ]);if(re)throw re;if(ae)throw ae;if(ce)console.warn(ce);if(!rows?.length)throw Error('Aucune donnée de planning pour ce mois.')
  const {data:changes,error:he}=await db.from('stip_planning_change_history')
    .select('change_date,base_code,previous_code,new_code,scenario,change_kind,applied_at,request_id,effective')
    .eq('agent_id',agent.id).eq('effective',true).gte('change_date',start).lte('change_date',end)
    .order('applied_at',{ascending:true});
  if(he)throw he
  const mmKey=String(mon).padStart(2,'0'),template=assets?.find((a:any)=>a.asset_type==='template'&&a.asset_key==='CALENDAR_TEMPLATE'),monthAsset=assets?.find((a:any)=>a.asset_type==='month'&&a.asset_key===mmKey),avatar=assets?.find((a:any)=>a.asset_type==='avatar'&&a.agent_source_key===agent.source_key)||assets?.find((a:any)=>a.asset_type==='fallback'&&a.asset_key==='DEFAULT_AVATAR')
  if(!template)throw Error('Template PDF manquant dans Supabase.');if(!monthAsset)throw Error('Visuel du mois manquant dans Supabase.')
  const relevant=(assets||[]).filter((a:any)=>a.asset_type==='template'||(a.asset_type==='month'&&a.asset_key===mmKey)||a.asset_type==='shift'||(a.asset_type==='avatar'&&a.agent_source_key===agent.source_key)||(a.asset_type==='fallback'&&a.asset_key==='DEFAULT_AVATAR'))
  const fingerprint=await sha256(JSON.stringify({version:VERSION+'-EXCHANGE_HISTORY_V1',agent:agent.source_key,month,rows,changes:changes||[],assets:relevant.map((a:any)=>[a.asset_type,a.asset_key,a.checksum_sha256]).sort()}))
  const path=`${ROOT}/pdfs/${safe(agent.source_key)}/${year}/${mmKey}.pdf`
  const {data:existing}=await db.from('pdf_plannings').select('id,fingerprint,storage_path').eq('agent_id',agent.id).eq('annee',year).eq('mois',mon).maybeSingle()
  if(existing?.fingerprint===fingerprint&&existing.storage_path===path){const {data:sg,error:se}=await db.storage.from(BUCKET).createSignedUrl(path,900);if(!se&&sg?.signedUrl)return{generated:false,url:sg.signedUrl,path,fingerprint}}

  const pdf=await PDFDocument.create(),pageW=mm(297),pageH=mm(210),page=pdf.addPage([pageW,pageH])
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold),boldItalic=await pdf.embedFont(StandardFonts.HelveticaBoldOblique)
  const tpl=await loadImage(pdf,template,1400,990);page.drawImage(tpl,{x:0,y:0,width:pageW,height:pageH})
  if(avatar){const im=await loadImage(pdf,avatar,520,340),box={x:mm(9),y:pageH-mm(55),w:mm(82),h:mm(54)};page.drawImage(im,contain(im,box.x,box.y,box.w,box.h))}
  const mi=await loadImage(pdf,monthAsset,850,340);{const box={x:pageW-mm(143),y:pageH-mm(55),w:mm(139),h:mm(55)};page.drawImage(mi,contain(mi,box.x,box.y,box.w,box.h))}
  const names=splitName(agent,contact),prenom=String(names.prenom||'').toUpperCase(),nom=String(names.nom||'').toUpperCase(),fs=prenom.length>12?27:prenom.length>10?31:prenom.length>8?36:44
  page.drawText(prenom,{x:mm(88),y:pageH-mm(9)-fs,size:fs,font:bold,color:color('#10266f')});page.drawRectangle({x:mm(88),y:pageH-mm(36),width:mm(62),height:mm(1.6),color:color('#2d64d6')})
  if(nom){const ns=nom.length>12?13:nom.length>10?15:17;page.drawText(nom,{x:mm(109),y:pageH-mm(36)-ns,size:ns,font:boldItalic,color:rgb(.07,.07,.07)})}
  const weeks=weeksInMonth(year,mon),gridH=weeks===5?133:129,gap=.7,colW=(289-6*gap)/7,rowH=(gridH-(weeks-1)*gap)/weeks,first=new Date(Date.UTC(year,mon-1,1)).getUTCDay(),off=(first+6)%7,days=new Date(Date.UTC(year,mon,0)).getUTCDate(),byDay=new Map<number,any>()
  for(const r of rows||[])byDay.set(Number(String(r.date).slice(8,10)),r)
  const shiftMap=new Map<string,any>();for(const a of assets||[])if(a.asset_type==='shift')shiftMap.set(String(a.asset_key).toUpperCase(),a)
  const imgCache=new Map<string,any>()
  const changesByDay=new Map<number,any[]>()
  for(const ch of changes||[]){
    const day=Number(String(ch.change_date||'').slice(8,10))
    const arr=changesByDay.get(day)||[];arr.push(ch);changesByDay.set(day,arr)
  }
  async function drawShiftVisual(code:string,left:number,top:number,rowH:number,mode:'single'|'base'|'effective'){
    if(!code)return
    const a=shiftMap.get(code)
    let w=weeks===5?26:23,h=weeks===5?24:21
    if(['RH','RTT','RTTA','RTA','RF','RC'].includes(code)){w=weeks===5?30:26;h=weeks===5?25:22}
    else if(['CA','ABS','AA','MA','DA','SYR'].includes(code)){w=weeks===5?25:22;h=weeks===5?23:20}
    let frac=.55
    if(mode==='base'){
      frac=weeks===5?.40:.38
      w*=weeks===5?.78:.73
      h*=weeks===5?.58:.50
    }else if(mode==='effective'){
      frac=weeks===5?.78:.77
      w*=weeks===5?.72:.68
      h*=weeks===5?.40:.36
    }
    const cx=mm(left+colW/2),cy=pageH-mm(top+rowH*frac)
    if(a){
      let im=imgCache.get(a.storage_path)
      if(!im){im=await loadImage(pdf,a,240,210);imgCache.set(a.storage_path,im)}
      const box={x:cx-mm(w)/2,y:cy-mm(h)/2,w:mm(w),h:mm(h)}
      page.drawImage(im,contain(im,box.x,box.y,box.w,box.h))
    }else{
      const size=mode==='single'?16:(mode==='base'?10:9)
      const tw=bold.widthOfTextAtSize(code,size)
      page.drawText(code,{x:cx-tw/2,y:cy-size/2,size,font:bold,color:rgb(.07,.07,.07)})
    }
  }
  for(let i=0;i<weeks*7;i++){
    const d=i-off+1;if(d<1||d>days)continue;const col=i%7,row=Math.floor(i/7),left=4+col*(colW+gap),top=69+row*(rowH+gap),dow=new Date(Date.UTC(year,mon-1,d)).getUTCDay(),dfs=weeks===5?17:14
    page.drawText(String(d),{x:mm(left+2.7),y:pageH-mm(top+1)-dfs,size:dfs,font:bold,color:(dow===0||dow===6)?color('#c02222'):rgb(.07,.07,.07)})
    const r=byDay.get(d);if(!r)continue
    const dayChanges=(changesByDay.get(d)||[]).sort((a:any,b:any)=>String(a.applied_at).localeCompare(String(b.applied_at)))
    const currentCode=shiftCode(r.code||r.source_value)
    const baseCode=dayChanges.length?shiftCode(dayChanges[0].previous_code||dayChanges[0].base_code||currentCode):currentCode
    const changed=dayChanges.length>0&&baseCode&&currentCode&&baseCode!==currentCode
    if(changed){
      await drawShiftVisual(baseCode,left,top,rowH,'base')
      await drawShiftVisual(currentCode,left,top,rowH,'effective')
    }else{
      await drawShiftVisual(currentCode,left,top,rowH,'single')
    }
  }
  const bytes=await pdf.save();const {error:ue}=await db.storage.from(BUCKET).upload(path,bytes,{contentType:'application/pdf',upsert:true,cacheControl:'0'});if(ue)throw ue
  const base=[clean(prenom||agent.source_key),clean(nom),MONTHS[mon],String(year)].filter(Boolean).join('_'),fileName=`${base}.pdf`
  const dbrow={source_key:`${year}|${mmKey}|${agent.source_key}`,chemin:path,nom:fileName,drive_id:null,url:null,type_mime:'application/pdf',extension:'pdf',modified_at:new Date().toISOString(),statut:'OK',updated_at:new Date().toISOString(),agent_id:agent.id,agent_source_key:agent.source_key,annee:year,mois:mon,storage_bucket:BUCKET,storage_path:path,fingerprint,generated_at:new Date().toISOString()}
  const {error:ie}=await db.from('pdf_plannings').upsert(dbrow,{onConflict:'source_key'});if(ie)throw ie
  const {data:sg,error:se}=await db.storage.from(BUCKET).createSignedUrl(path,900);if(se||!sg?.signedUrl)throw se||Error('Lien PDF indisponible.')
  return{generated:true,url:sg.signedUrl,path,fingerprint,file_name:fileName,size:bytes.length}
}
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:C});if(req.method!=='POST')return J({error:'Méthode non autorisée.'},405);try{const b=await req.json().catch(()=>({}));const agent=await sessionAgent(req);const month=String(b.month||new Date().toISOString().slice(0,7));return J({ok:true,month,...await render(agent,month),expires_in:900})}catch(e){console.error(e);return J({error:e instanceof Error?e.message:String(e)},400)}})