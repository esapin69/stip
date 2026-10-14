(()=>{'use strict';
const baseFetch=window.fetch.bind(window),active=new Map(),inflight=new Map();let hud=null,hideTimer=null,seq=0,contactsRequestedUntil=0;
const META={login:['auth','Connexion à STIP'],bootstrap:['planning','Préparation de STIP'],personal:['planning','Chargement du planning'],official:['team','Chargement du planning équipe'],spirit:['team','Chargement de l’équipe'],contacts:['contacts','Chargement des contacts'],directory:['contacts','Chargement de l’annuaire'],responsable_agents:['responsable','Chargement des brancardiers'],responsable_agent:['agent','Ouverture de la fiche'],agent_search_all:['agent','Recherche des brancardiers'],case_detail:['agent','Ouverture du dossier'],getEvaluation:['evaluation','Ouverture de l’évaluation']};
const pendingRefresh=new Map();
const VISIBLE=new Set(),SHOW_AFTER=420,DATA_HOST='yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data',CACHE_PREFIX='stip_read_cache_v2:';
const CACHE_TTL={bootstrap:300000,spirit:180000,official:180000,personal:180000,contacts:600000,directory:600000,spirit_week:180000};
function ensure(){if(hud)return hud;hud=document.createElement('div');hud.id='stipLoadHud';hud.className='stip-load-hud';hud.setAttribute('aria-live','polite');hud.innerHTML='<div class="stip-load-row"><span class="stip-load-icon" aria-hidden="true"></span><span class="stip-load-copy"><strong>Chargement…</strong><small>Lecture des données…</small></span></div><div class="stip-load-track"><div class="stip-load-bar"></div></div>';document.body.appendChild(hud);return hud}
function paint(task){if(!task?.shown)return;const h=ensure(),p=Math.max(4,Math.min(96,Math.round(task.progress)));h.dataset.kind=task.kind;h.querySelector('.stip-load-copy strong').textContent=task.label;h.querySelector('.stip-load-copy small').textContent=task.phase;h.querySelector('.stip-load-bar').style.width=p+'%';h.classList.add('show');h.classList.remove('done')}
function leader(){return [...active.values()].filter(x=>x.shown).sort((a,b)=>b.started-a.started)[0]||null}
function update(){const t=leader();if(t){paint(t);return}if(hud){hud.classList.add('done');clearTimeout(hideTimer);hideTimer=setTimeout(()=>hud?.classList.remove('show','done'),180)}}
function start(action){if(!VISIBLE.has(action))return null;const [kind,label]=META[action],id=++seq,t={id,action,kind,label,started:performance.now(),progress:10,phase:'Lecture des données…',shown:false,timer:null,showTimer:null};active.set(id,t);t.showTimer=setTimeout(()=>{if(!active.has(id))return;t.shown=true;paint(t);t.timer=setInterval(()=>{const ms=performance.now()-t.started;if(ms>2600)t.progress=Math.min(90,t.progress+2);else if(ms>1100)t.progress=Math.min(72,t.progress+4);else t.progress=Math.min(42,t.progress+5);paint(t)},220)},SHOW_AFTER);return t}
function done(t,ok=true){if(!t)return;clearTimeout(t.showTimer);clearInterval(t.timer);if(t.shown){t.progress=96;t.phase=ok?'Terminé':'Chargement impossible';paint(t)}active.delete(t.id);if(t.shown)setTimeout(update,ok?100:500);else update()}
function body(init){try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch{return null}}
function urlText(input){return typeof input==='string'?input:String(input?.url||'')}
function route(){return location.hash.replace(/^#\/?/,'')||'home'}
function sessionKey(){const t=localStorage.getItem('stip_session_v1')||'';let h=0;for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))>>>0;return h.toString(36)}
function cacheKey(action,b){const extra={...b};delete extra.action;return CACHE_PREFIX+sessionKey()+':'+action+':'+JSON.stringify(extra)}
function readCache(key,ttl){
  for(const store of [sessionStorage,localStorage]){
    try{
      const x=JSON.parse(store.getItem(key)||'null');
      if(!x||!Number.isFinite(Number(x.at))||Date.now()-Number(x.at)>ttl)continue;
      return x.data;
    }catch{}
  }
  return null;
}
function writeCache(key,data){
  const record=JSON.stringify({at:Date.now(),data});
  try{sessionStorage.setItem(key,record)}catch{}
  try{localStorage.setItem(key,record)}catch{}
}
function responseFrom(data){return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','X-STIP-Cache':'hit'}})}
async function readJsonResponse(r){try{return await r.clone().json()}catch{return null}}
window.fetch=async function(input,init){const b=body(init),action=String(b?.action||''),u=urlText(input),ttl=CACHE_TTL[action]||0,isData=ttl>0&&!!(localStorage.getItem('stip_session_v1')||'')&&u.includes(DATA_HOST)&&!window.STIPPreview?.active;
if(isData&&action==='contacts'&&!route().startsWith('contacts')&&Date.now()>contactsRequestedUntil){return Promise.reject(new DOMException('Chargement différé jusqu’à l’ouverture des contacts.','AbortError'))}
let key='';if(isData){
  key=cacheKey(action,b);
  // Never discard an earlier reading simply because it is old.
  const cached=readCache(key,Number.POSITIVE_INFINITY);
  if(cached!==null){
    if(readCache(key,ttl)===null&&!inflight.has(key)){
      const expectedToken=localStorage.getItem('stip_session_v1')||'';
      pendingRefresh.set(key,{input,init,action,params:b,expectedToken});
      const refresh=baseFetch(input,init).then(async response=>{
        if(!response.ok||localStorage.getItem('stip_session_v1')!==expectedToken)return;
        const data=await readJsonResponse(response);
        if(data===null||data?.error||window.STIPPreview?.active)return;
        writeCache(key,data);
        pendingRefresh.delete(key);
        if(JSON.stringify(cached)!==JSON.stringify(data)){
          window.dispatchEvent(new CustomEvent('stip:read-cache-updated',{detail:{action,data,params:b,at:Date.now()}}));
        }
      }).catch(()=>{}).finally(()=>inflight.delete(key));
      inflight.set(key,refresh);
    }
    return responseFrom(cached);
  }
  if(inflight.has(key)){
    const data=await inflight.get(key);
    return responseFrom(data);
  }
}
const t=start(action);const run=(async()=>{try{const r=await baseFetch(input,init);done(t,r.ok);if(isData&&r.ok){const data=await readJsonResponse(r);if(data!==null){writeCache(key,data);return{response:r,data}}}return{response:r,data:null}}catch(e){done(t,false);throw e}})();
if(!isData)return (await run).response;
const dataPromise=run.then(x=>x.data!==null?x.data:readJsonResponse(x.response)).finally(()=>inflight.delete(key));inflight.set(key,dataPromise);
const out=await run;return out.response};

// A short-lived, session-scoped handoff of two approved agent readings between documents.
// API responses remain private to the current tab, never in service-worker/HTTP caches.
const AGENT_WARM_PREFIX=CACHE_PREFIX+'agent-warm:',AGENT_WARM_TTL=90000,agentWarmInflight=new Map();
const AGENT_WARM={
  directory:{permission:'agent_directory',url:'https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-readonly',action:'directory'},
  dates:{permission:'agent_dates',url:'https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-dates',action:'list'}
};
function agentWarmSession(){
  const token=localStorage.getItem('stip_session_v1')||'';
  if(!token)return null;
  if(window.STIPSession)return window.STIPSession;
  try{
    const saved=JSON.parse(sessionStorage.getItem('stip_session_snapshot_v1')||'null');
    if(saved?.version===1&&saved.token===token.slice(-16)&&
       Date.now()-Number(saved.at||0)<120000)return saved.session||null;
  }catch{}
  return null;
}
function agentWarmOwner(session=agentWarmSession()){
  const agent=session?.agent||{};
  const id=String(agent.id||agent.source_key||agent.matricule||'').trim();
  return id?[session.role_key||'',id].join(':'):'';
}
function agentWarmKey(kind){const owner=agentWarmOwner();return owner?AGENT_WARM_PREFIX+sessionKey()+':'+encodeURIComponent(owner)+':'+kind:''}
function clearAgentWarm(kind=''){
  try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i)||'';
    if(key.startsWith(AGENT_WARM_PREFIX)&&(!kind||key.endsWith(':'+kind)))sessionStorage.removeItem(key);
  }}catch{}
  if(!kind)agentWarmInflight.clear();
}
function readAgentWarm(kind){
  const config=AGENT_WARM[kind],token=localStorage.getItem('stip_session_v1')||'';
  if(!config||!token||window.STIPPreview?.active)return null;
  const session=agentWarmSession();
  if(!session||session.permissions?.[config.permission]!==true||!agentWarmOwner(session))return null;
  const data=readCache(agentWarmKey(kind),AGENT_WARM_TTL);
  return Array.isArray(data?.items)?data:null;
}
function writeAgentWarm(kind,data,expectedToken=localStorage.getItem('stip_session_v1')||''){
  const key=agentWarmKey(kind);
  if(!AGENT_WARM[kind]||!key||!expectedToken||expectedToken!==localStorage.getItem('stip_session_v1')||!Array.isArray(data?.items))return false;
  writeCache(key,data);return true;
}
function warmAgentData(kind,session=window.STIPSession){
  const config=AGENT_WARM[kind],token=localStorage.getItem('stip_session_v1')||'';
  const conn=navigator.connection||{};
  if(!config||!token||!session?.agent||session?.permissions?.[config.permission]!==true||
     window.STIPPreview?.active||document.hidden||conn.saveData||/(?:^|-)2g$/.test(conn.effectiveType||''))return Promise.resolve(false);
  if(readAgentWarm(kind))return Promise.resolve(true);
  const key=agentWarmKey(kind);
  if(!key)return Promise.resolve(false);
  if(agentWarmInflight.has(key))return agentWarmInflight.get(key);
  const headers=kind==='directory'
    ?{'Content-Type':'application/json','X-STIP-Session':token}
    :{'Content-Type':'text/plain;charset=UTF-8'};
  const body=kind==='directory'
    ?{action:config.action}
    :{action:config.action,session_token:token};
  const request=baseFetch(config.url,{
    method:'POST',cache:'no-store',headers,body:JSON.stringify(body)
  }).then(async response=>{
    if(!response.ok)return false;
    const data=await response.json().catch(()=>null);
    if(data?.error||!Array.isArray(data?.items))return false;
    if(localStorage.getItem('stip_session_v1')!==token||window.STIPPreview?.active)return false;
    const current=agentWarmSession();
    if(current?.permissions?.[config.permission]!==true||agentWarmOwner(current)!==agentWarmOwner(session))return false;
    return writeAgentWarm(kind,data,token);
  }).catch(()=>false).finally(()=>agentWarmInflight.delete(key));
  agentWarmInflight.set(key,request);
  return request;
}
function clearReadCache(action=''){
  for(const store of [sessionStorage,localStorage]){
    try{for(let i=store.length-1;i>=0;i--){const key=store.key(i)||'';
      if(key.startsWith(CACHE_PREFIX)&&(!action||key.includes(':'+action+':')))store.removeItem(key);
    }}catch{}
  }
  if(!action)inflight.clear();
}
window.addEventListener('stip:session-ended',()=>{clearAgentWarm();clearReadCache();pendingRefresh.clear()});
window.addEventListener('online',()=>{
  for(const [key,item] of pendingRefresh){
    if(item.expectedToken!==localStorage.getItem('stip_session_v1')){pendingRefresh.delete(key);continue}
    if(!inflight.has(key)){
      // One read through the existing wrapper triggers the standard refresh path.
      window.fetch(item.input,item.init).catch(()=>{});
    }
  }
});
window.addEventListener('stip:session-refreshed',e=>{
  const permissions=e.detail?.permissions||{};
  for(const [kind,config] of Object.entries(AGENT_WARM)){
    if(permissions[config.permission]!==true)clearAgentWarm(kind);
  }
});

window.STIPReadCache={clear:clearReadCache,requestContacts(){contactsRequestedUntil=Date.now()+5000},agentWarm:{read:readAgentWarm,write:writeAgentWarm,warm:warmAgentData,clear:clearAgentWarm}};
window.STIPLoading={start:(label='Chargement',kind='generic')=>{const id=++seq,t={id,action:'manual',kind,label,started:performance.now(),progress:18,phase:'Lecture des données…',shown:true,timer:null,showTimer:null};active.set(id,t);paint(t);return()=>done(t,true)},active:()=>active.size};
})();
