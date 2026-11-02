// Peer-confirmed, already-completed shift exchanges. Never routes through the cadre email workflow.
// All writes use the privileged STIP edge session; the browser cannot address the table directly.
type Db = any;
type Ctx = {agent: any; profile: {permissions: Record<string, boolean>}};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const WORK=new Set(['M','J','J4','S','N']);
const REST=new Set(['R','RH']);
const day=(n:number)=>{const d=new Date();d.setUTCHours(12,0,0,0);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const today=()=>day(0);
const name=(a:any)=>[a?.prenom,a?.nom].filter(Boolean).join(' ').trim();
const team=(a:any)=>String(a?.type_planning||a?.equipe||'jour').toLowerCase()==='nuit'?'nuit':'jour';
const chief=(a:any)=>/chef|cadre|responsable/i.test([a?.role,a?.type_planning,a?.equipe].join(' '));
const norm=(a:any)=>String(a??'').trim().toUpperCase();
const access=(c:Ctx)=>c.profile?.permissions?.planning_personal===true && !chief(c.agent);
function id(v:any){const x=String(v||'');if(!UUID.test(x))throw Error('AGENT_INVALIDE');return x}
function dates(raw:any,from:string,to:string){
  if(!Array.isArray(raw)||!raw.length||raw.length>93)throw Error('CHOISIR_1_A_93_JOURS');
  const a=raw.map(String);
  if(a.some(d=>!DATE.test(d)||Number.isNaN(Date.parse(d+'T12:00:00Z'))||d<from||d>to))throw Error('DATE_HORS_PERIODE');
  if(new Set(a).size!==a.length)throw Error('DATES_DUPLIQUEES');
  return a.sort();
}
async function directory(db:Db,c:Ctx){
  const {data:ps,error:pe}=await db.from('stip_access_profiles').select('agent_id,active').eq('active',true);
  if(pe)throw pe;
  const ids=[...new Set((ps||[]).map((p:any)=>p.agent_id).filter(Boolean))];
  if(!ids.length)return [];
  const {data,error}=await db.from('agents').select('id,nom,prenom,actif,equipe,type_planning,ghe,role').in('id',ids);
  if(error)throw error;
  return (data||[]).filter((a:any)=>a.actif&&!chief(a)&&a.id!==c.agent.id&&team(a)===team(c.agent))
    .map((a:any)=>({id:a.id,nom:a.nom,prenom:a.prenom,ghe:a.ghe}))
    .sort((a:any,b:any)=>name(a).localeCompare(name(b),'fr'));
}
async function ensureTarget(db:Db,c:Ctx,raw:any){
  const agentId=id(raw);
  if(agentId===c.agent.id)throw Error('ECHANGE_AVEC_SOI_MEME');
  const dir=await directory(db,c);
  if(!dir.some((a:any)=>a.id===agentId))throw Error('COLLEGUE_NON_AUTORISE');
  return dir.find((a:any)=>a.id===agentId);
}
async function readDays(db:Db,c:Ctx,targetId:string,from:string,to:string){
  const {data,error}=await db.from('planning').select('agent_id,date,code')
    .in('agent_id',[c.agent.id,targetId]).gte('date',from).lte('date',to).order('date').limit(1000);
  if(error)throw error;
  return data||[];
}
async function notify(db:Db,agentId:string,title:string,body:string,ref:string,kind='action_required'){
  const {error}=await db.from('stip_notifications').insert({
    agent_id:agentId,type:kind,title,body,
    source_type:'stip_peer_exchange',source_ref:ref,
    metadata:{target_url:'https://stip.esapin.com/#/home',section:'peer_exchange',peer_exchange_id:ref}
  });
  if(error)console.error('Peer exchange notification could not be written',error.message);
}
async function list(db:Db,c:Ctx){
  const {data,error}=await db.from('stip_peer_exchanges').select('*')
    .or('requester_agent_id.eq.'+c.agent.id+',target_agent_id.eq.'+c.agent.id)
    .order('created_at',{ascending:false}).limit(80);
  if(error)throw error;
  const ids=[...new Set((data||[]).flatMap((x:any)=>[x.requester_agent_id,x.target_agent_id]))];
  const {data:agents,error:ae}=ids.length?await db.from('agents').select('id,nom,prenom').in('id',ids):{data:[],error:null};
  if(ae)throw ae;
  const names=new Map((agents||[]).map((a:any)=>[a.id,name(a)]));
  return {items:(data||[]).map((x:any)=>({...x,requester_name:names.get(x.requester_agent_id),target_name:names.get(x.target_agent_id)}))};
}
async function create(db:Db,c:Ctx,b:any){
  if(!access(c))throw Error('ACCES_ECHANGE_REFUSE');
  const target=await ensureTarget(db,c,b.target_agent_id);
  const from=day(-90),to=day(370);
  const mode=b.mode==='cross'?'cross':'same';
  const mine=dates(b.my_dates,from,to);
  const theirs=mode==='same'?mine:dates(b.their_dates,from,to);
  if(mine.length!==theirs.length)throw Error('MEME_NOMBRE_DE_JOURS_REQUIS');
  if(mode==='cross'&&mine.some((d:string)=>theirs.includes(d)))throw Error('JOURS_CROISES_DOIVENT_ETRE_DISTINCTS');
  const rawMapping=Array.isArray(b.mapping)?b.mapping:null;
  let pairedDates=theirs;
  if(mode==='cross'&&rawMapping){
    if(rawMapping.length!==mine.length)throw Error('CORRESPONDANCE_JOURS_INCOMPLETE');
    const mapping=new Map<string,string>();
    for(const item of rawMapping){
      const m=String(item?.my_date||''),t=String(item?.their_date||'');
      if(!mine.includes(m)||!theirs.includes(t)||mapping.has(m))throw Error('CORRESPONDANCE_JOURS_INVALIDE');
      mapping.set(m,t);
    }
    pairedDates=mine.map(m=>mapping.get(m)!);
    if(new Set(pairedDates).size!==theirs.length)throw Error('CORRESPONDANCE_JOURS_DUPLIQUEE');
  }
  const all=[...new Set([...mine,...theirs])].sort();
  const rows=await readDays(db,c,target.id,all[0],all[all.length-1]);
  const map=new Map(rows.map((r:any)=>[r.agent_id+'|'+r.date,norm(r.code)]));
  const pairs=[];
  let changed=0;
  for(let i=0;i<mine.length;i++){
    const m=mine[i],t=pairedDates[i];
    const am=map.get(c.agent.id+'|'+m),bt=map.get(target.id+'|'+t),
      ax=map.get(c.agent.id+'|'+t),bm=map.get(target.id+'|'+m);
    if(!am||!bt||!ax||!bm)throw Error('PLANNING_DATE_MANQUANTE');
    if(mode==='cross'&&(!WORK.has(am)||!WORK.has(bt)||!REST.has(ax)||!REST.has(bm)))throw Error('JOURS_CROISES_INCOMPATIBLES');
    if(am!==bm||bt!==ax)changed++;
    pairs.push({my_date:m,their_date:t,my_code:am,their_code:bt,my_other_code:ax,their_other_code:bm});
  }
  if(!changed)throw Error('AUCUN_CHANGEMENT');
  // Avoid multiple pending proposals for the same people/dates.
  const existing=(await list(db,c)).items.filter((x:any)=>x.status==='pending');
  for(const old of existing){
    const busy=new Set((old.pairs||[]).flatMap((p:any)=>[p.my_date,p.their_date]));
    if(all.some(d=>busy.has(d)))throw Error('AUTRE_ECHANGE_EN_ATTENTE_SUR_CES_JOURS');
  }
  const {data,error}=await db.from('stip_peer_exchanges').insert({
    requester_agent_id:c.agent.id,target_agent_id:target.id,pairs,status:'pending'
  }).select('*').single();
  if(error)throw error;
  await notify(db,target.id,'Échange de planning à confirmer',
    name(c.agent)+' indique avoir échangé '+pairs.length+' jour(s) avec toi. Confirme ou refuse depuis GHE.',data.id);
  return {item:data};
}
async function decide(db:Db,c:Ctx,b:any){
  const exchangeId=id(b.id),decision=String(b.decision||'');
  if(!['accept','refuse'].includes(decision))throw Error('DECISION_INVALIDE');
  const {data:existing,error}=await db.from('stip_peer_exchanges').select('id,target_agent_id,requester_agent_id,status')
    .eq('id',exchangeId).maybeSingle();
  if(error)throw error;
  if(!existing||existing.target_agent_id!==c.agent.id)throw Error('ECHANGE_NON_AUTORISE');
  const {data,error:de}=await db.rpc('stip_peer_exchange_decide',{
    p_exchange_id:exchangeId,p_target_agent_id:c.agent.id,p_accept:decision==='accept'
  });
  if(de)throw de;
  await db.from('stip_notifications').delete().eq('agent_id',c.agent.id)
    .eq('source_type','stip_peer_exchange').eq('source_ref',exchangeId);
  await notify(db,existing.requester_agent_id,decision==='accept'?'Échange appliqué aux deux plannings':'Échange refusé',
    decision==='accept'?'Ton collègue a confirmé. Les plannings GHE et les abonnements calendrier reprendront les nouveaux shifts.':'Le collègue a refusé la modification proposée.',exchangeId,'info');
  return {result:data};
}
async function cancel(db:Db,c:Ctx,b:any){
  const exchangeId=id(b.id);
  const {data,error}=await db.from('stip_peer_exchanges').update({
    status:'cancelled',responded_at:new Date().toISOString()
  }).eq('id',exchangeId).eq('requester_agent_id',c.agent.id).eq('status','pending').select('id,target_agent_id').maybeSingle();
  if(error)throw error;
  if(!data)throw Error('ANNULATION_NON_AUTORISEE');
  await db.from('stip_notifications').delete().eq('source_type','stip_peer_exchange').eq('source_ref',exchangeId);
  await notify(db,data.target_agent_id,'Proposition d’échange annulée',
    'La proposition précédente a été annulée par ton collègue.',exchangeId,'info');
  return {ok:true};
}
export async function peerAction(db:Db,c:Ctx,action:string,b:any){
  if(!c?.agent?.id||!c?.profile?.active)throw Error('SESSION_STIP_REQUISE');
  if(action==='peer_inbox')return list(db,c);
  if(action==='peer_directory')return {agents:await directory(db,c),allowed:access(c)};
  if(action==='peer_days'){
    const target=await ensureTarget(db,c,b.target_agent_id);
    const from=day(-90),to=day(370),rows=await readDays(db,c,target.id,from,to);
    return {from,to,mine:rows.filter((x:any)=>x.agent_id===c.agent.id),theirs:rows.filter((x:any)=>x.agent_id===target.id)};
  }
  if(action==='peer_create')return create(db,c,b);
  if(action==='peer_decide')return decide(db,c,b);
  if(action==='peer_cancel')return cancel(db,c,b);
  throw Error('ACTION_INVALIDE');
}
