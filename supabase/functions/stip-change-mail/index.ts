import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {createClient} from 'npm:@supabase/supabase-js@2'
const U=Deno.env.get('SUPABASE_URL')||'',K=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',R=Deno.env.get('RESEND_API_KEY')||'',F=Deno.env.get('STIP_CHANGE_FROM_EMAIL')||'';
const db=createClient(U,K,{auth:{persistSession:false}}),te=new TextEncoder(),origins=new Set(['https://stip.esapin.com','https://responsable.esapin.com','https://admin.esapin.com']);
const base=()=>U+'/functions/v1/stip-change-mail',e=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const hash=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const token=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
const ready=()=>Boolean(R&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(F)&&!F.toLowerCase().endsWith('@resend.dev'));
const js=(o:any,s=200,origin='')=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...(origins.has(origin)?{'access-control-allow-origin':origin,'vary':'Origin'}:{})}});
const name=(a:any)=>[a?.prenom,a?.nom].filter(Boolean).join(' ')||'Agent';
const title=(r:any)=>(r.scenario==='same_day_exchange'?'Échange':r.scenario==='simple_change'?'Changement':'Demande')+' de planning · '+(r.date_from||'date libre');
const page=(h:string,b:string,status=200)=>new Response('<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>'+e(h)+'</title><style>body{background:#f0f6f8;color:#153846;font:16px Arial;margin:0}main{max-width:610px;margin:32px auto;padding:23px;border-radius:18px;background:white}h1{font-size:27px}button{background:#0b6d7a;color:white;border:0;padding:13px 20px;border-radius:11px;font-size:17px}label{font-weight:bold;display:block;margin:16px 0 6px}textarea,select{width:100%;box-sizing:border-box;padding:12px;font:16px Arial;border:1px solid #bcd0d6;border-radius:10px}.note{color:#586f79;font-size:14px}</style><main><h1>'+e(h)+'</h1>'+b+'</main></html>',{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none';style-src 'unsafe-inline';form-action 'self';base-uri 'none';frame-ancestors 'none'"}});
async function session(req:Request){
 const raw=req.headers.get('x-stip-session')||'';if(!raw)throw Error('SESSION_REQUISE');
 const {data:s,error:se}=await db.from('stip_access_sessions').select('profile_id,expires_at,revoked_at').eq('token_hash',await hash(raw)).maybeSingle();
 if(se)throw se;if(!s||s.revoked_at||new Date(s.expires_at)<new Date())throw Error('SESSION_INVALIDE');
 const {data:p,error:pe}=await db.from('stip_access_profiles').select('agent_id,active').eq('id',s.profile_id).maybeSingle();
 if(pe)throw pe;if(!p?.active)throw Error('ACCES_REFUSE');
 const {data:a,error:ae}=await db.from('agents').select('id,prenom,nom,actif').eq('id',p.agent_id).maybeSingle();
 if(ae)throw ae;if(!a?.actif)throw Error('AGENT_INACTIF');return a;
}
async function selected(ids:any){
 if(!Array.isArray(ids))throw Error('DESTINATAIRES_INVALIDES');
 const all=[...new Set(ids.map(Number))].filter(x=>Number.isSafeInteger(x)&&x>0);
 if(!all.length||all.length>12)throw Error('DESTINATAIRES_INVALIDES');
 const {data,error}=await db.from('contacts_ghe').select('id,nom,prenom,email_pro,role_metier,actif').in('id',all);
 if(error)throw error;const map=new Map((data||[]).map((x:any)=>[x.id,x]));
 return all.map(id=>{const x:any=map.get(id),r=String(x?.role_metier||'').toLowerCase();
 if(!x?.actif||!x.email_pro||!/^\S+@\S+\.\S+$/.test(x.email_pro)||(!r.includes('cadre')&&!r.includes('chef')))throw Error('DESTINATAIRE_A_REVOIR');
 return{contact_id:id,name:name(x),email:String(x.email_pro).toLowerCase(),role:r.includes('cadre')?'cadre':'chef'};
 });
}
async function myRequest(id:string,agent:any){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('ID_INVALIDE');
 const {data,error}=await db.from('stip_change_requests').select('*').eq('id',id).eq('requester_agent_id',agent.id).maybeSingle();
 if(error)throw error;if(!data)throw Error('DEMANDE_INTRouvABLE');return data;
}
async function updateRecipients(id:string,agent:any,ids:any){
 const r=await myRequest(id,agent);
 if(!['awaiting_colleague','awaiting_responsible','submitted'].includes(r.status)||r.decided_at||r.official_state==='sent_waiting')throw Error('DESTINATAIRES_VERROUILLES');
 const {data:actions,error:ae}=await db.from('stip_change_mail_actions').select('state').eq('request_id',id);
 if(ae)throw ae;if((actions||[]).some((x:any)=>['sending','sent','advised','decided'].includes(x.state)))throw Error('EMAIL_DEJA_ENVOYE');
 const valid=await selected(ids),first=valid[0];
 const {data,error}=await db.from('stip_change_requests').update({routed_recipients:valid,routed_contact_id:first.contact_id,routed_name:first.name,routed_email:first.email,routed_at:new Date().toISOString(),routed_by_agent_id:agent.id,updated_at:new Date().toISOString()}).eq('id',id).select('id,routed_recipients').single();
 if(error)throw error;await db.from('stip_change_mail_actions').delete().eq('request_id',id).in('state',['prepared','failed']);return data;
}
async function send(id:string,agent:any){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('ID_INVALIDE');
 const {data:r,error:re}=await db.from('stip_change_requests').select('*').eq('id',id).maybeSingle();
 if(re)throw re;if(!r)throw Error('DEMANDE_INTROUVABLE');
 const targetCanSend=r.target_agent_id===agent.id&&r.context?.colleague_decision==='accept';
 if(r.requester_agent_id!==agent.id&&!targetCanSend)throw Error('ACCES_REFUSE');
 if(!['awaiting_responsible','submitted'].includes(r.status)||r.decided_at||r.context?.mail_decision)throw Error('DEMANDE_NON_ENVOYABLE');
 if(!ready())throw Error('EXPEDITEUR_NON_CONFIGURE');
 const stored=Array.isArray(r.routed_recipients)?r.routed_recipients:[];
 if(!stored.length)throw Error('DESTINATAIRE_REQUIS');
 const list=await selected(stored.map((x:any)=>x.contact_id));
 for(const x of list){if(stored.find((y:any)=>Number(y.contact_id)===x.contact_id)?.email?.toLowerCase()!==x.email)throw Error('DESTINATAIRE_A_RESELECTIONNER');}
 if(!list.some(x=>x.role==='cadre'))throw Error('SELECTIONNER_AU_MOINS_UN_CADRE');
 const {data:people}=await db.from('agents').select('id,prenom,nom').in('id',[r.requester_agent_id,r.target_agent_id].filter(Boolean));
 const requester=(people||[]).find((x:any)=>x.id===r.requester_agent_id),colleague=(people||[]).find((x:any)=>x.id===r.target_agent_id);
 const {data:olds,error:oe}=await db.from('stip_change_mail_actions').select('*').eq('request_id',id);
 if(oe)throw oe;const old=new Map((olds||[]).map((x:any)=>[x.contact_id,x]));
 const successes:string[]=[],failures:any[]=[];
 for(const x of list){
  const before:any=old.get(x.contact_id);
  if(before&&['advised','decided','superseded'].includes(before.state))continue;
  if(before?.state==='sent'&&new Date(before.expires_at)>new Date())continue;
  if(before?.state==='sending'&&Date.now()-new Date(before.updated_at).getTime()<300000)continue;
  const secret=token(),now=new Date().toISOString(),row={request_id:id,contact_id:x.contact_id,recipient_email:x.email,recipient_name:x.name,recipient_role:x.role,token_hash:await hash(secret),state:'sending',sent_at:null,provider_id:null,sent_error:null,expires_at:new Date(Date.now()+72*3600000).toISOString(),updated_at:now};
  let mailId:string;
  if(before){const q=await db.from('stip_change_mail_actions').update(row).eq('id',before.id).in('state',['prepared','failed','sending','sent']);if(q.error)throw q.error;mailId=before.id;}
  else{const q=await db.from('stip_change_mail_actions').insert(row).select('id').single();if(q.error)throw q.error;mailId=q.data.id;}
  const link=base()+'?t='+secret;
  const button=(label:string,v:string,color:string)=>'<a href="'+link+'&view='+v+'" style="display:inline-block;margin:5px;padding:12px;background:'+color+';color:white;text-decoration:none;border-radius:8px">'+label+'</a>';
  const choices=x.role==='cadre'?button('VALIDER','accept','#176a4b')+button('REFUSER','refuse','#a43838')+(r.scenario==='simple_change'?button('MODIFIER','modify','#2b5276'):''):button('AVIS FAVORABLE','chef_favorable','#176a4b')+button('AVIS DÉFAVORABLE','chef_defavorable','#a43838');
  const html='<div style="font:15px Arial;color:#163747;max-width:640px"><h2>STIP · '+e(title(r))+'</h2><p>Bonjour '+e(x.name)+',</p><p><b>Agent :</b> '+e(name(requester))+'</p>'+(colleague?'<p><b>Échange accepté par :</b> '+e(name(colleague))+'</p>':'')+'<p><b>Shift actuel :</b> '+e(r.requester_code||'—')+' &nbsp; <b>Demandé :</b> '+e(r.scenario==='same_day_exchange'?r.context?.target_shift:r.desired_code||r.message||'à étudier')+'</p>'+(r.message?'<p><b>Précision :</b> '+e(r.message)+'</p>':'')+choices+'<p style="font-size:12px;color:#72848c">Le lien ouvre une confirmation sans agir automatiquement. Valable 72 h ; ne pas transférer.</p></div>';
  try{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+R,'Content-Type':'application/json','Idempotency-Key':mailId+'-'+String(row.token_hash).slice(0,12)},body:JSON.stringify({from:F,to:[x.email],subject:'STIP · '+title(r),html})});
   const body=await response.json().catch(()=>({}));
   if(!response.ok||!body.id)throw Error('RESEND_'+response.status+':'+String(body.message||'envoi refusé').slice(0,90));
   const {error}=await db.from('stip_change_mail_actions').update({state:'sent',sent_at:new Date().toISOString(),provider_id:body.id,sent_error:null,updated_at:new Date().toISOString()}).eq('id',mailId);if(error)throw error;
   successes.push(x.name);
  }catch(err){const msg=err instanceof Error?err.message:'Envoi refusé';await db.from('stip_change_mail_actions').update({state:'failed',sent_error:msg.slice(0,240),updated_at:new Date().toISOString()}).eq('id',mailId);failures.push({recipient:x.name,reason:msg});}
 }
 const {data:all,error:ae}=await db.from('stip_change_mail_actions').select('recipient_role,state').eq('request_id',id);if(ae)throw ae;
 const awaiting=(all||[]).some((a:any)=>a.recipient_role==='cadre'&&a.state==='sent');
 if(awaiting)await db.from('stip_change_requests').update({official_state:'sent_waiting',updated_at:new Date().toISOString()}).eq('id',id).in('status',['awaiting_responsible','submitted']);
 if(successes.length){
  await db.from('stip_request_events').insert({request_id:id,event_type:'official_mail_provider_accepted',actor_agent_id:agent.id,actor_kind:'agent',actor_label:name(agent),from_status:r.status,to_status:r.status,detail:{accepted_by_provider:successes,failed:failures.map(x=>x.recipient)}});
  await db.from('stip_notifications').insert({agent_id:r.requester_agent_id,type:'info',title:title(r)+' · e-mail transmis',body:'Envoi accepté par le prestataire : '+successes.join(', '),source_type:'stip_change',source_ref:id,metadata:{section:'day_workflow',change_request_id:id}});
 }
 return{ok:failures.length===0,accepted_by_provider:successes,failures,awaiting_cadre:awaiting};
}
async function display(t:string,view:string){
 if(!/^[a-f0-9]{64}$/i.test(t))return page('Lien invalide','<p>Ce lien n’est pas valide.</p>',403);
 const {data:a}=await db.from('stip_change_mail_actions').select('*').eq('token_hash',await hash(t)).maybeSingle();
 if(!a||a.state!=='sent'||new Date(a.expires_at)<=new Date())return page('Lien indisponible','<p>Ce lien a déjà servi ou a expiré.</p>',410);
 const {data:r}=await db.from('stip_change_requests').select('*').eq('id',a.request_id).maybeSingle();
 if(!r||!['awaiting_responsible','submitted'].includes(r.status)||r.decided_at||r.context?.mail_decision)return page('Déjà traité','<p>Cette demande a déjà reçu une réponse.</p>',410);
 const opts=a.recipient_role==='cadre'?['accept','refuse',...(r.scenario==='simple_change'?['modify']:[])]:['chef_favorable','chef_defavorable'];
 if(!opts.includes(view))return page('Choix incorrect','<p>Utilise un des boutons du mail reçu.</p>',400);
 const labels:any={accept:'Valider la demande',refuse:'Refuser la demande',modify:'Modifier le shift',chef_favorable:'Avis favorable',chef_defavorable:'Avis défavorable'};
 let extra='';
 if(view==='modify'){
  const {data:codes}=await db.from('stip_shift_definitions').select('code,label').eq('active',true).order('sort_order');
  extra='<label>Nouveau shift</label><select name="new_code" required><option value="">Choisir</option>'+(codes||[]).map((c:any)=>'<option value="'+e(c.code)+'">'+e(c.code+' · '+c.label)+'</option>').join('')+'</select>';
 }
 const {data:agent}=await db.from('agents').select('nom,prenom').eq('id',r.requester_agent_id).maybeSingle();
 const info='<p><b>Agent :</b> '+e(name(agent))+' · '+e(title(r))+'</p><p><b>Shift :</b> '+e(r.requester_code||'—')+' → '+e(r.scenario==='same_day_exchange'?r.context?.target_shift:r.desired_code||r.message||'à étudier')+'</p>'+(a.recipient_role==='chef'?'<p class="note">Cet avis ne modifie pas le planning : le cadre décide.</p>':'');
 return page(labels[view],info+'<form method="post" action="'+base()+'"><input type="hidden" name="token" value="'+e(t)+'"><input type="hidden" name="action" value="'+e(view)+'">'+extra+'<label>Commentaire facultatif</label><textarea name="comment" maxlength="1000" rows="3"></textarea><p><button type="submit">Confirmer : '+e(labels[view])+'</button></p></form><p class="note">Seule cette confirmation enregistre ta réponse.</p>');
}
async function respond(fd:FormData){
 const t=String(fd.get('token')||''),a=String(fd.get('action')||''),code=String(fd.get('new_code')||'').slice(0,30),comment=String(fd.get('comment')||'').slice(0,1000);
 if(!/^[a-f0-9]{64}$/i.test(t))return page('Lien invalide','<p>Ce lien est invalide.</p>',403);
 const {data,error}=await db.rpc('stip_change_mail_decide',{p_token_hash:await hash(t),p_action:a,p_new_code:code,p_comment:comment});
 if(error)return page('Réponse non enregistrée','<p>'+e(error.message)+'</p><p>Le planning n’a pas été modifié.</p>',409);
 if(!data?.ok)return page('Déjà traité','<p>Cette demande a déjà été traitée.</p>',409);
 const {data:r}=await db.from('stip_change_requests').select('requester_agent_id,target_agent_id').eq('id',data.request_id).maybeSingle();
 if(r?.requester_agent_id){
  const outcome=data.outcome,ids=[r.requester_agent_id,...(outcome==='applied'&&r.target_agent_id?[r.target_agent_id]:[])];
  await db.from('stip_notifications').insert(ids.map((id:string)=>({agent_id:id,type:'info',title:'Décision planning : '+(outcome==='applied'?'modification appliquée':outcome==='refused'?'refusée':outcome==='advice_saved'?'avis chef reçu':'accord cadre, mise à jour manuelle requise'),body:outcome==='manual_followup_required'?'Cette demande complexe nécessite encore une application manuelle.':'Consulte le suivi de ta demande.',source_type:'stip_change',source_ref:data.request_id,metadata:{section:'day_workflow',change_request_id:data.request_id}})));
 }
 return page('Réponse enregistrée','<p>Ta réponse a bien été enregistrée.</p>'+(data.outcome==='manual_followup_required'?'<p>La mise à jour du planning reste manuelle pour ce type de demande.</p>':'')+'<p>Tu peux fermer cette page.</p>');
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',allowed=origins.has(origin);
 if(req.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:allowed?{'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type,x-stip-session','vary':'Origin'}:{}});
 try{
  if(req.method==='GET'){const u=new URL(req.url);return display(u.searchParams.get('t')||'',u.searchParams.get('view')||'');}
  if(req.method!=='POST')return js({error:'METHODE'},405,origin);
  const ct=req.headers.get('content-type')||'';
  if(ct.includes('application/x-www-form-urlencoded')||ct.includes('multipart/form-data')){if(Number(req.headers.get('content-length')||0)>6000)return page('Formulaire trop long','<p>Réduis le commentaire.</p>',413);return respond(await req.formData());}
  if(!allowed)return js({error:'ORIGINE_REFUSEE'},403);
  const b=await req.json().catch(()=>({}));
  if(b.action==='health')return js({ok:true,sending_configured:ready(),final_authority:'cadre_only',link_expiry_hours:72},200,origin);
  const who=await session(req);
  if(b.action==='update_recipients')return js({ok:true,item:await updateRecipients(String(b.id||''),who,b.recipient_ids)},200,origin);
  if(b.action==='send'){const result=await send(String(b.id||''),who);return js(result,result.ok?200:207,origin);}
  return js({error:'ACTION_INVALIDE'},400,origin);
 }catch(ex){const m=ex instanceof Error?ex.message:String(ex);return js({ok:false,error:m},m.includes('SESSION')?401:m.includes('ACCES')?403:m==='EXPEDITEUR_NON_CONFIGURE'?503:400,origin);}
});
