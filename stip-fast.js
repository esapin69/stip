(()=>{'use strict';
/* STIPFast v1 — cache de lectures + déduplication réseau, sans jamais mettre en cache les écritures. */
const nativeFetch=window.fetch.bind(window),PREFIX='stip_fast_v1:',inflight=new Map();
const TTL={me:30000,bootstrap:30000,home:20000,contacts:300000,spirit:30000,directory:60000,boot:30000,team:30000,manager_list:20000,responsable_list:20000};
const SAFE=new Set(Object.keys(TTL));
function hash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h)^s.charCodeAt(i);return(h>>>0).toString(36)}
function sessionKey(){try{return localStorage.getItem('stip_session_v1')||''}catch{return''}}
function parse(init){if(!init||String(init.method||'GET').toUpperCase()!=='POST')return null;try{const b=typeof init.body==='string'?JSON.parse(init.body):null,a=String(b?.action||'');if(!SAFE.has(a))return null;return{action:a,body:b}}catch{return null}}
function key(url,action,body){return PREFIX+hash(sessionKey()+'|'+String(url)+'|'+action+'|'+JSON.stringify(body||{}))}
function cached(k,ttl){try{const raw=sessionStorage.getItem(k);if(!raw)return null;const v=JSON.parse(raw);if(!v?.at||Date.now()-v.at>ttl){sessionStorage.removeItem(k);return null}return v}catch{return null}}
function response(v){return new Response(v.text,{status:v.status||200,statusText:v.statusText||'OK',headers:v.headers||{'Content-Type':'application/json'}})}
async function network(input,init,k){const r=await nativeFetch(input,init);if(k&&r.ok){try{const c=r.clone(),text=await c.text(),headers={};c.headers.forEach((v,n)=>headers[n]=v);sessionStorage.setItem(k,JSON.stringify({at:Date.now(),status:c.status,statusText:c.statusText,headers,text}))}catch{}}return r}
window.fetch=function(input,init){const p=parse(init),url=typeof input==='string'?input:input?.url||String(input);if(!p)return nativeFetch(input,init);const ttl=TTL[p.action]||0,k=key(url,p.action,p.body),hit=cached(k,ttl);if(hit)return Promise.resolve(response(hit));if(inflight.has(k))return inflight.get(k).then(r=>r.clone());const q=network(input,init,k).finally(()=>inflight.delete(k));inflight.set(k,q);return q.then(r=>r.clone())};
function clear(){try{Object.keys(sessionStorage).filter(k=>k.startsWith(PREFIX)).forEach(k=>sessionStorage.removeItem(k))}catch{}}
window.STIPFast={clear,stats(){try{return Object.keys(sessionStorage).filter(k=>k.startsWith(PREFIX)).length}catch{return 0}}};
window.addEventListener('storage',e=>{if(e.key==='stip_session_v1')clear()});
/* Prépare les lectures Responsable pendant que l'utilisateur regarde déjà l'accueil. */
let warmed=false;function warmResponsable(detail){if(warmed||!detail?.permissions?.responsable||!sessionKey())return;warmed=true;const headers={'Content-Type':'application/json','X-STIP-Session':sessionKey()},jobs=[['https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions','manager_list'],['https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-change','responsable_list']];const run=()=>jobs.forEach(([url,action])=>window.fetch(url,{method:'POST',headers,body:JSON.stringify({action})}).catch(()=>{}));'requestIdleCallback'in window?requestIdleCallback(run,{timeout:1200}):setTimeout(run,500)}
window.addEventListener('stip:boot-updated',e=>warmResponsable(e.detail));
/* Le bouton Mon agenda ouvrait le même parcours que Planning perso : on garde un seul accès. */
function dedupeAgenda(root=document){root.querySelectorAll?.('.hc-app[data-app="calendar"]').forEach(n=>n.remove())}
/* Les images métier hors premier écran sont décodées sans bloquer le rendu. */
function tune(root=document){root.querySelectorAll?.('img').forEach(img=>{try{img.decoding='async';if(img.matches('.ph-shift-img,.hc-day img,.ra-avatar img,.ro-week img'))img.loading='lazy'}catch{}});dedupeAgenda(root)}
new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.tagName==='IMG')tune(n.parentElement||document);else tune(n)}}))).observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>tune());else tune();
})();
