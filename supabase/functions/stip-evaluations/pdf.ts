import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
export const MODEL_VERSION='2026'
export const NOT_OBSERVED='Éléments insuffisants pour évaluer'
export const LEVELS=['Insuffisant','Médiocre','Passable','Assez bien','Bien','Très bien','Exceptionnel',NOT_OBSERVED] as const
export const CRITERIA=['Aptitude à travailler sans contrôle','Efficacité','Esprit pratique','Souci de perfectionnement',"Rapidité d'exécution",'Qualité du travail',"Sens de l'organisation",'Initiative','Caractère','Relation avec le personnel infirmier','Contact avec les autres agents du service','Contact avec l’encadrement','Disponibilité','Discrétion','Attitude envers les visiteurs','Utilisation du temps de travail','Attitude générale','Propreté dans la tenue','Régularité','Ponctualité / assiduité'] as const
export const OBS_KEYS=['Observations I — Aptitude au service','Observations II — Exécution du travail','Observations III — Travail en commun','Observations IV — Comportement envers les malades','Observations V — Tenue, ponctualité, assiduité','Observations générales'] as const
export function displayDateFr(s:string|null|undefined){if(!s)return '';const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);return m?`${m[3]}/${m[2]}/${m[1]}`:s}
export function safeName(v:string){return v.replace(/[\\/:*?\"<>|]/g,'-').replace(/\s+/g,' ').trim()}
function clean(v:string){return String(v||'').normalize('NFC').replace(/[–—]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...').replace(/\u00a0/g,' ').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[^\u0020-\u007E\u00A0-\u00FF\u0152\u0153\u0178]/g,'?')}
function top(page:any,font:any,value:string,x:number,t:number,size=9){if(value)page.drawText(clean(value),{x,y:page.getHeight()-t-size*.82,size,font,color:rgb(0,0,0)})}
function center(page:any,font:any,value:string,cx:number,t:number,size=9){const s=clean(value),w=font.widthOfTextAtSize(s,size);page.drawText(s,{x:cx-w/2,y:page.getHeight()-t-size*.35,size,font,color:rgb(0,0,0)})}
function wrap(font:any,value:string,size:number,maxWidth:number){const lines:string[]=[];for(const p of clean(value).split(/\r?\n/)){const words=p.split(/\s+/).filter(Boolean);if(!words.length){lines.push('');continue}let line='';for(const word of words){const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)<=maxWidth)line=next;else{if(line)lines.push(line);line=word}}if(line)lines.push(line)}return lines}
function fit(page:any,font:any,value:string,x:number,t:number,w:number,h:number){if(!value)return;for(let size=8.5;size>=6;size-=.5){const lh=size+1.6,lines=wrap(font,value,size,w);if(lines.length*lh<=h){lines.forEach((l,i)=>top(page,font,l,x,t+i*lh,size));return}}throw Error('OBSERVATION_TROP_LONGUE_POUR_PDF')}
async function drawSignature(pdf:any,page:any,font:any,bytes:Uint8Array|undefined,name:string,x:number,t:number,w=128,h=54){
  if(!bytes?.length)return
  const img=await pdf.embedPng(bytes)
  const maxW=w,maxH=h,scale=Math.min(maxW/img.width,maxH/img.height)
  const iw=img.width*scale,ih=img.height*scale
  top(page,font,name,x,t-15,7.5)
  page.drawImage(img,{x:x+(maxW-iw)/2,y:page.getHeight()-t-ih,width:iw,height:ih})
}
export async function makeOfficialPdf(template:Uint8Array,p:any,signatures:any={}){
  const pdf=await PDFDocument.load(template),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),pages=pdf.getPages()
  if(pages.length!==2)throw Error('MODELE_EVALUATION_INCOMPATIBLE')
  const a=pages[0],b=pages[1]
  top(a,bold,`${p.agent_nom||''} ${p.agent_prenom||''}`.trim(),66,143.2,9);top(a,bold,p.service||'',344,143.2,9)
  top(a,font,p.agent_matricule||'',95,161,9);top(a,font,displayDateFr(p.evaluation_date),330,161,9);top(a,font,p.grade||'',76,178.7,9);top(a,font,displayDateFr(p.signature_date||p.evaluation_date),338,178.7,9);top(a,font,displayDateFr(p.service_since),169,196.8,9)
  const xs=[266.45,296.2,326,355.75,385.45,415.2,445,506]
  const rows=[[a,282],[a,300.7],[a,319.3],[a,338],[a,436.6],[a,455.3],[a,473.9],[a,492.6],[a,591.2],[a,609.9],[a,628.5],[a,647.2],[b,120.7],[b,139.4],[b,158],[b,256.7],[b,275.3],[b,294],[b,312.6],[b,331.3]] as any[]
  CRITERIA.forEach((c,i)=>{const n=(LEVELS as readonly string[]).indexOf(p.criteria?.[c]||NOT_OBSERVED);if(n>=0)center(rows[i][0],bold,'X',xs[n],rows[i][1],9)})
  fit(a,font,p.observations?.[OBS_KEYS[0]]||'',113,355.2,350,20);fit(a,font,p.observations?.[OBS_KEYS[1]]||'',113,509.8,350,22);fit(a,font,p.observations?.[OBS_KEYS[2]]||'',113,664.4,350,20)
  fit(b,font,p.observations?.[OBS_KEYS[3]]||'',113,175.2,350,23);fit(b,font,p.observations?.[OBS_KEYS[4]]||'',113,348.4,350,23);fit(b,font,p.observations?.[OBS_KEYS[5]]||'',168,374,360,22)
  if(p.decision==='OUI')center(b,bold,'X',415.2,408,9);if(p.decision==='NON')center(b,bold,'X',458.8,408,9);top(b,font,displayDateFr(p.signature_date||p.evaluation_date),77,422.4,9)
  await drawSignature(pdf,b,font,signatures.agent,signatures.names?.agent||'',58,500,138,58)
  await drawSignature(pdf,b,font,signatures.responsable,signatures.names?.responsable||'',229,500,138,58)
  await drawSignature(pdf,b,font,signatures.direction,signatures.names?.direction||'',400,500,138,58)
  return new Uint8Array(await pdf.save({useObjectStreams:false}))
}
export async function sha256Bytes(bytes:Uint8Array){const h=await crypto.subtle.digest('SHA-256',bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));return[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
