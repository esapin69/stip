import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
const URL=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,db=createClient(URL,SERVICE,{auth:{persistSession:false}}),enc=new TextEncoder()
const H={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,x-stip-session','Access-Control-Allow-Methods':'POST,OPTIONS'},J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H})
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,'0')).join('');async function sha(s:string){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
function teamOf(a:any){const t=String(a?.type_planning||a?.equipe||'jour').toLowerCase();return t==='nuit'?'nuit':'jour'}
async function session(req:Request){const t=req.headers.get('x-stip-session')||'';if(!t)return null;const{data:s}=await db.from('stip_access_sessions').select('profile_id,expires_at,revoked_at').eq('token_hash',await sha(t)).maybeSingle();if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())return null;const{data:p}=await db.from('stip_access_profiles').select('agent_id,active,role_key,permissions').eq('id',s.profile_id).maybeSingle();if(!p?.active)return null;const{data:a}=await db.from('agents').select('id,source_key,nom,prenom,equipe,type_planning,role').eq('id',p.agent_id).maybeSingle();if(!a)return null;return{profile:p,agent:a,team:teamOf(a)}}
function audience(role:string){if(role==='cadre')return'cadre';if(['chef_equipe','responsable','admin'].includes(role))return'responsable';return'agent'}
function rowFor(r:any,aud:string){return{reference_id:r.reference_id,date:r.reference_date,equipe:r.equipe,metric:r.metric,shift_code:r.shift_code,target_count:r.target_count,planned_count:r.planned_count,gap:r.gap,severity:r.severity,status:r.status,suggested_from_shift:r.suggested_from_shift,suggested_from_surplus:r.suggested_from_surplus,message:r.guidance?.[aud]||null,guidance:r.guidance,source:{file:r.source_file_name,sheet:r.source_sheet,row:r.source_row,label:r.source_label}}}
function fixedShift(x:any){const s=String(x||'').trim().toUpperCase();if(/^J4\*?$/.test(s))return'J4';if(/^M\*?$/.test(s))return'M';if(/^J\*?$/.test(s))return'J';if(/^S\*?$/.test(s))return'S';if(/^N\*?$/.test(s))return'N';return null}
function specialWorkCode(x:any){const s=String(x||'').trim().toUpperCase();if(!s||fixedShift(s))return null;return /^(?:M|J|S|N)\d/.test(s)?s:null}
function maxIso(rows:any[],key:string){return rows.map(x=>x?.[key]).filter(Boolean).map(String).sort().at(-1)||null}
function overview(rows:any[],plan:any[]){
 const shifts=rows.filter((r:any)=>r.metric==='shift');
 const total=rows.find((r:any)=>r.metric==='total');
 const middle=rows.find((r:any)=>r.metric==='middle_combined');
 const unknown=rows.filter((r:any)=>r.status==='unknown'||r.planned_count===null||r.planned_count===undefined);
 const knownShifts=shifts.filter((r:any)=>r.planned_count!==null&&r.planned_count!==undefined);
 const shiftSumComplete=shifts.length>0&&knownShifts.length===shifts.length;
 const primary=total
   ? {planned:total.planned_count,target:total.target_count,gap:total.gap,basis:'weekend_total'}
   : {planned:shiftSumComplete?knownShifts.reduce((n:number,r:any)=>n+Number(r.planned_count),0):null,
      target:shifts.length?shifts.reduce((n:number,r:any)=>n+Number(r.target_count||0),0):null,
      gap:shiftSumComplete?knownShifts.reduce((n:number,r:any)=>n+Number(r.gap||0),0):null,
      basis:'shift_sum'};
 const below=rows.filter((r:any)=>r.status==='below_reference');
 const critical=below.filter((r:any)=>Number(r.severity)>=4);
 const important=below.filter((r:any)=>Number(r.severity)===3);
 const attention=below.filter((r:any)=>Number(r.severity)===2);
 const specialMap=new Map<string,number>();
 for(const p of plan){const c=specialWorkCode(p.code);if(c)specialMap.set(c,(specialMap.get(c)||0)+1)}
 const special=[...specialMap].map(([code,count])=>({code,count})).sort((a,b)=>a.code.localeCompare(b.code,'fr'));
 const worst=[...below].sort((a:any,b:any)=>Number(b.severity)-Number(a.severity)||Number(a.gap)-Number(b.gap))[0]||null;
 let state='ok',headline='Effectif prévu conforme aux cibles HCL.';
 if(critical.length){state='critical';headline=`🚨 ${critical.length} écart${critical.length>1?'s':''} critique${critical.length>1?'s':''} entre le prévu et la cible HCL.`}
 else if(important.length){state='warning';headline=`⚠️ ${important.length} écart${important.length>1?'s':''} important${important.length>1?'s':''} à anticiper.`}
 else if(attention.length){state='attention';headline=`⚠️ ${attention.length} créneau${attention.length>1?'x':''} sous la cible HCL.`}
 else if(unknown.length){state='unknown';headline='Cible HCL connue, mais effectif prévu incomplet dans le tableau source.'}
 const guide=below.slice()
   .sort((a:any,b:any)=>Number(b.severity)-Number(a.severity)||Number(a.gap)-Number(b.gap))
   .map((r:any)=>{
     const sev=Number(r.severity||0);
     const action=sev>=4?'decision_immediate':sev>=3?'prepare_exchange_or_reinforcement':'anticipate';
     const donor=r.metric==='shift'&&r.suggested_from_shift?{
       shift_code:r.suggested_from_shift,
       surplus_before:Number(r.suggested_from_surplus||0),
       surplus_after_one_move:Math.max(0,Number(r.suggested_from_surplus||0)-1),
       safeguard:'Le créneau donneur doit rester au moins à sa cible HCL après tout échange.'
     }:null;
     return{
       level:sev>=4?'critical':sev>=3?'warning':'attention',
       action,
       shift_code:r.shift_code,
       metric:r.metric,
       planned_count:r.planned_count,
       target_count:r.target_count,
       gap:r.gap,
       text:r.message||r.guidance?.responsable||'Écart entre l’effectif prévu et la cible HCL.',
       donor
     }
   });
 return{
   state,headline,
   planned:primary.planned,target:primary.target,gap:primary.gap,basis:primary.basis,
   data_complete:unknown.length===0,unknown_count:unknown.length,
   worst:worst?{shift_code:worst.shift_code,metric:worst.metric,planned_count:worst.planned_count,target_count:worst.target_count,gap:worst.gap,severity:worst.severity}:null,
   critical_count:critical.length,warning_count:important.length,attention_count:attention.length,below_count:below.length,
   middle:middle?{planned_count:middle.planned_count,target_count:middle.target_count,gap:middle.gap,status:middle.status,severity:middle.severity}:null,
   special_schedules:special,special_count:special.reduce((n,x)=>n+x.count,0),
   source_truth:{
     target:'Cible HCL lue dans le libellé entre parenthèses, ou règle week-end du tableau.',
     planned:'Effectif prévu lu dans la cellule du jour du bloc Cumul par Horaire.',
     forbidden_inference:'Ne jamais remplacer l’effectif prévu par un comptage des lignes agents.'
   },
   guide
 }}
async function day(ctx:any,date:string,team?:string){const eq=team||ctx.team;const [advice,plan,refs]=await Promise.all([db.from('stip_staffing_advice').select('*').eq('reference_date',date).eq('equipe',eq).order('severity',{ascending:false}).order('shift_code',{ascending:true}),db.from('planning').select('code,imported_at,agent_id').eq('date',date).eq('equipe',eq),db.from('stip_staffing_references').select('imported_at,source_file_name').eq('reference_date',date).eq('equipe',eq).eq('active',true)]);if(advice.error)throw advice.error;if(plan.error)throw plan.error;if(refs.error)throw refs.error;const aud=audience(String(ctx.profile.role_key||'')),rows=(advice.data||[]).map((r:any)=>rowFor(r,aud)),shifts=rows.filter((r:any)=>r.metric==='shift'),below=rows.filter((r:any)=>r.status==='below_reference'),above=rows.filter((r:any)=>r.status==='above_reference'),view=overview(rows,plan.data||[]);return{date,equipe:eq,audience:aud,available:rows.length>0,summary:{below:below.length,at_reference:rows.filter((r:any)=>r.status==='at_reference').length,above:above.length,worst_severity:rows.reduce((m:number,r:any)=>Math.max(m,Number(r.severity||0)),0),...view},freshness:{planning_imported_at:maxIso(plan.data||[],'imported_at'),reference_imported_at:maxIso(refs.data||[],'imported_at'),reference_file:(refs.data||[]).map((x:any)=>x.source_file_name).filter(Boolean).sort().at(-1)||null},rows,shifts,recommendations:view.guide}}
async function requestImpact(ctx:any,date:string,desired:string|null){
 const d=await day(ctx,date);
 const {data:me,error}=await db.from('planning').select('code').eq('agent_id',ctx.agent.id).eq('date',date).eq('equipe',ctx.team).maybeSingle();
 if(error)throw error;
 const current=fixedShift(me?.code),dest=fixedShift(desired);
 const srcRow=d.shifts.find((x:any)=>x.shift_code===current),dstRow=d.shifts.find((x:any)=>x.shift_code===dest);
 const srcKnown=srcRow&&srcRow.planned_count!==null&&srcRow.planned_count!==undefined;
 const dstKnown=dstRow&&dstRow.planned_count!==null&&dstRow.planned_count!==undefined;
 const afterSrc=srcKnown&&current&&dest&&current!==dest?Number(srcRow.planned_count)-1:(srcKnown?Number(srcRow.planned_count):null);
 const afterDst=dstKnown&&current&&dest&&current!==dest?Number(dstRow.planned_count)+1:(dstKnown?Number(dstRow.planned_count):null);
 let level='neutral',message='Aucune cible HCL exploitable pour cette date.';
 if(d.available&&!current&&me?.code){
   message=`L’horaire ${String(me.code)} est spécifique. STIP ne le force pas artificiellement dans M/J/J4/S.`;
 }else if(d.available&&current&&dest&&current!==dest&&(!srcKnown||!dstKnown)){
   level='unknown';
   message='Simulation bloquée : l’effectif prévu du tableau source est incomplet pour au moins un des deux créneaux.';
 }else if(d.available&&current&&dest&&current!==dest){
   const srcGap=afterSrc===null?null:afterSrc-Number(srcRow.target_count);
   const dstGap=afterDst===null?null:afterDst-Number(dstRow.target_count);
   if(srcGap!==null&&srcGap<0){
     level=srcGap<=-3?'risk':'watch';
     message=`Ce changement ferait passer ${current} à ${afterSrc} prévu(s) pour une cible HCL de ${srcRow.target_count}. Il fragilise le créneau donneur.`;
   }else if(dstGap!==null&&dstGap<0){
     level='watch';
     message=`Le changement améliore ${dest}, mais le prévu resterait à ${afterDst} pour une cible HCL de ${dstRow.target_count}.`;
   }else{
     level='favorable';
     message='Selon le tableau Cumul par Horaire, ce changement maintient les deux créneaux au moins à leur cible HCL.';
   }
 }
 return{
   ...d,current_shift:current,raw_current_code:me?.code||null,desired_shift:dest,
   impact:{
     level,message,
     source:srcRow?{before:srcRow.planned_count,after:afterSrc,target:srcRow.target_count,gap_after:afterSrc===null?null:afterSrc-srcRow.target_count}:null,
     destination:dstRow?{before:dstRow.planned_count,after:afterDst,target:dstRow.target_count,gap_after:afterDst===null?null:afterDst-dstRow.target_count}:null,
     advisory_only:true,
     safeguard:'Une piste d’échange n’est jamais une décision automatique : contraintes individuelles et terrain restent à valider.'
   }
 }}
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:H});if(req.method!=='POST')return J({error:'Méthode non autorisée'},405);try{const ctx=await session(req);if(!ctx)return J({error:'Session expirée'},401);const b=await req.json().catch(()=>({})),action=String(b.action||'day'),date=String(b.date||new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}).format(new Date()));if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return J({error:'Date invalide'},400);if(action==='day')return J(await day(ctx,date,b.equipe?String(b.equipe):undefined));if(action==='request_impact')return J(await requestImpact(ctx,date,b.desired_code?String(b.desired_code):null));return J({error:'Action inconnue'},400)}catch(e){console.error(e);return J({error:e instanceof Error?e.message:String(e)},500)}})
