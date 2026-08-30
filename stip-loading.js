(()=>{'use strict';
const baseFetch=window.fetch.bind(window),active=new Map(),inflight=new Map();let hud=null,hideTimer=null,seq=0,contactsRequestedUntil=0;
const META={login:['auth','Connexion à STIP'],bootstrap:['planning','Préparation de STIP'],personal:['planning','Chargement du planning'],official:['team','Chargement du planning équipe'],spirit:['team','Chargement de l’équipe'],contacts:['contacts','Chargement des contacts'],directory:['contacts','Chargement de l’annuaire'],responsable_agents:['responsable','Chargement des brancardiers'],responsable_agent:['agent','Ouverture de la fiche'],agent_search_all:['agent','Recherche des brancardiers'],case_detail:['agent','Ouverture du dossier'],getEvaluation:['evaluation','Ouverture de l’évaluation']};
const VISIBLE=new Set(Object.keys(META)),SHOW_AFTER=420,DATA_HOST='yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data',CACHE_PREFIX='stip_read_cache_v2:';
const CACHE_TTL={bootstrap:300000,spirit:180000,official:180000,personal:180000,contacts:600000,directory:600000};
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
function readCache(key,ttl){try{const x=JSON.parse(sessionStorage.getItem(key)||'null');if(!x||Date.now()-Number(x.at||0)>ttl){sessionStorage.removeItem(key);return null}return x.data}catch{return null}}
function writeCache(key,data){try{sessionStorage.setItem(key,JSON.stringify({at:Date.now(),data}))}catch{}}
function responseFrom(data){return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','X-STIP-Cache':'hit'}})}
async function readJsonResponse(r){try{return await r.clone().json()}catch{return null}}
window.fetch=async function(input,init){const b=body(init),action=String(b?.action||''),u=urlText(input),ttl=CACHE_TTL[action]||0,isData=ttl>0&&u.includes(DATA_HOST);
if(isData&&action==='contacts'&&!route().startsWith('contacts')&&Date.now()>contactsRequestedUntil){return Promise.reject(new DOMException('Chargement différé jusqu’à l’ouverture des contacts.','AbortError'))}
let key='';if(isData){key=cacheKey(action,b);const cached=readCache(key,ttl);if(cached!==null)return responseFrom(cached);if(inflight.has(key)){const data=await inflight.get(key);return responseFrom(data)}}
const t=start(action);const run=(async()=>{try{const r=await baseFetch(input,init);done(t,r.ok);if(isData&&r.ok){const data=await readJsonResponse(r);if(data!==null){writeCache(key,data);return{response:r,data}}}return{response:r,data:null}}catch(e){done(t,false);throw e}})();
if(!isData)return (await run).response;
const dataPromise=run.then(x=>x.data!==null?x.data:readJsonResponse(x.response)).finally(()=>inflight.delete(key));inflight.set(key,dataPromise);
const out=await run;return out.response};
window.STIPReadCache={clear(action=''){try{const prefix=CACHE_PREFIX+sessionKey()+':'+action;for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i)||'';if(k.startsWith(prefix))sessionStorage.removeItem(k)}}catch{}},requestContacts(){contactsRequestedUntil=Date.now()+5000}};
window.STIPLoading={start:(label='Chargement',kind='generic')=>{const id=++seq,t={id,action:'manual',kind,label,started:performance.now(),progress:18,phase:'Lecture des données…',shown:true,timer:null,showTimer:null};active.set(id,t);paint(t);return()=>done(t,true)},active:()=>active.size};
})();
