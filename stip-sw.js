const STIP_SW_BUILD="20261018-month-blank-rest1";
const STATIC_CACHE="stip-static-"+STIP_SW_BUILD;
const PAGE_CACHE="stip-pages-"+STIP_SW_BUILD;

// Keep a navigable app shell available even when the phone next opens offline.
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(PAGE_CACHE);
    await Promise.allSettled(["/","/index.html"].map(async path=>{
      const request=new Request(path,{cache:"reload"});
      const response=await fetch(request);
      if(cacheable(response))await cache.put(path,response.clone());
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>/^stip-(?:static|pages)-/.test(key)&&![STATIC_CACHE,PAGE_CACHE].includes(key)).map(key=>caches.delete(key)));await clients.claim()})())});
function cacheable(response){return !!response&&response.ok&&response.type!=="opaque"}
async function cacheFirst(request,cacheName){const cache=await caches.open(cacheName),cached=await cache.match(request);if(cached)return cached;const response=await fetch(request);if(cacheable(response))await cache.put(request,response.clone());return response}
async function staleWhileRevalidate(request,event,cacheName){const cache=await caches.open(cacheName),cached=await cache.match(request),network=fetch(request).then(async response=>{if(cacheable(response))await cache.put(request,response.clone());return response});if(cached){event.waitUntil(network.catch(()=>{}));return cached}return network}
// Weather HTML and assets must never be served cache-first while online.
async function weatherNetworkFirst(request,cacheName){
  const cache=await caches.open(cacheName);
  try{
    const response=await fetch(request,{cache:"no-store"});
    if(cacheable(response))await cache.put(request,response.clone());
    return response;
  }catch(error){
    const cached=await cache.match(request);
    if(cached)return cached;
    throw error;
  }
}
async function networkFirst(request,cacheName){const cache=await caches.open(cacheName);try{const response=await fetch(request,{cache:"no-store"});if(cacheable(response))await cache.put(request,response.clone());return response}catch(error){const cached=await cache.match(request);if(cached)return cached;throw error}}
self.addEventListener("fetch",event=>{const request=event.request;if(request.method!=="GET")return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;const path=url.pathname,isIndex=path==="/"||/\/index\.html$/i.test(path),isHtml=request.mode==="navigate"||/\.html?$/i.test(path),isStatic=/\.(?:js|css|webmanifest|png|jpe?g|webp|svg|gif|ico|woff2?|ttf)$/i.test(path);if(request.cache==="no-store"||url.searchParams.has("__stip_probe")){event.respondWith(fetch(request));return}if(request.cache==="reload"){event.respondWith(fetch(request).then(async response=>{const cache=await caches.open(isHtml?PAGE_CACHE:STATIC_CACHE);if(cacheable(response))await cache.put(request,response.clone());return response}));return}if(path==="/meteo"||path.startsWith("/meteo/")){event.respondWith(weatherNetworkFirst(request,isHtml?PAGE_CACHE:STATIC_CACHE));return}if(isIndex){event.respondWith(networkFirst(request,PAGE_CACHE));return}if(path==="/le-nouveau.html"){event.respondWith(fetch(request,{cache:"no-store"}));return}if(isHtml){event.respondWith(networkFirst(request,PAGE_CACHE));return}if(isStatic){if(/\.(?:js|css)$/i.test(path)){event.respondWith(networkFirst(request,STATIC_CACHE));return}if(url.searchParams.has("v")||url.searchParams.has("__stip_build"))event.respondWith(cacheFirst(request,STATIC_CACHE));else event.respondWith(staleWhileRevalidate(request,event,STATIC_CACHE))}});

function notificationIcon(data){
  const key=String(data.event_key||data.kind||data.type||data.tag||"").toLowerCase();
  if(key.includes("agenda_alert")||key.includes("agenda-alert")||key.includes("incoherence"))return "/images/notifications/alert-danger.webp?v=20260928-alert1";
  if(key.includes("wheelchair")||key.includes("fauteuil"))return "/images/notifications/wheelchair.webp?v=20260925-1";
  if(key.includes("team_chat")||key.includes("chat-equipe")||key.includes("team-chat"))return "/images/notifications/chat.webp?v=20260927-communication5";
  if(key.includes("dm")||key.includes("direct")||key.includes("group"))return "/images/notifications/dm.webp?v=20260925-1";
  return "https://yzsrmuxghlengnkyphxj.supabase.co/storage/v1/object/public/stip-public-assets/branding/native/stip-icon-192.png";
}
self.addEventListener("push",event=>{let data={};try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text?.()||""}}const avatar=String(data.avatar_url||"").trim(),safeAvatar=/^https:\/\//i.test(avatar)?avatar:"",typeIcon=notificationIcon(data),title=data.title||"STIP",options={body:data.body||"Nouvelle information",icon:safeAvatar||typeIcon,badge:typeIcon,tag:data.tag||"stip",renotify:true,data:{url:data.url||"/?quick=notifications"}};event.waitUntil((async()=>{const list=await clients.matchAll({type:"window",includeUncontrolled:true});for(const client of list){try{client.postMessage({type:"stip:push",data})}catch{}}await self.registration.showNotification(title,options)})())});
self.addEventListener("notificationclick",event=>{event.notification.close();const url=new URL(event.notification.data?.url||"/?quick=notifications",self.location.origin).href;event.waitUntil((async()=>{const list=await clients.matchAll({type:"window",includeUncontrolled:true});for(const client of list){try{if("navigate" in client)await client.navigate(url);await client.focus();return}catch{}}if(clients.openWindow)await clients.openWindow(url)})())});


