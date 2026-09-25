const STIP_SW_BUILD="20260925-access-gateway1";
const STATIC_CACHE="stip-static-"+STIP_SW_BUILD;
const PAGE_CACHE="stip-pages-"+STIP_SW_BUILD;

self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>/^stip-(?:static|pages)-/.test(key)&&![STATIC_CACHE,PAGE_CACHE].includes(key)).map(key=>caches.delete(key)));await clients.claim()})())});
function cacheable(response){return !!response&&response.ok&&response.type!=="opaque"}
async function cacheFirst(request,cacheName){const cache=await caches.open(cacheName),cached=await cache.match(request);if(cached)return cached;const response=await fetch(request);if(cacheable(response))await cache.put(request,response.clone());return response}
async function staleWhileRevalidate(request,event,cacheName){const cache=await caches.open(cacheName),cached=await cache.match(request),network=fetch(request).then(async response=>{if(cacheable(response))await cache.put(request,response.clone());return response});if(cached){event.waitUntil(network.catch(()=>{}));return cached}return network}
async function networkFirst(request,cacheName){const cache=await caches.open(cacheName);try{const response=await fetch(request);if(cacheable(response))await cache.put(request,response.clone());return response}catch(error){const cached=await cache.match(request);if(cached)return cached;throw error}}
const SUPABASE_ORIGIN="https://yzsrmuxghlengnkyphxj.supabase.co";
async function proxySupabase(request){
  const upstream=new URL(request.url);
  const proxy=new URL("/api/supabase-proxy",self.location.origin);
  proxy.searchParams.set("path",upstream.pathname+upstream.search);
  const headers=new Headers(request.headers);
  const init={method:request.method,headers,redirect:"follow"};
  if(request.method!=="GET"&&request.method!=="HEAD"){
    init.body=await request.clone().arrayBuffer();
  }
  return fetch(proxy.href,init);
}
self.addEventListener("fetch",event=>{
  const request=event.request;
  const url=new URL(request.url);

  if(url.origin===SUPABASE_ORIGIN){
    event.respondWith(proxySupabase(request));
    return;
  }

  if(request.method!=="GET")return;
  if(url.origin!==self.location.origin)return;

  const path=url.pathname;
  const isIndex=path==="/"||/\/index\.html$/i.test(path);
  const isHtml=request.mode==="navigate"||/\.html?$/i.test(path);
  const isStatic=/\.(?:js|css|webmanifest|png|jpe?g|webp|svg|gif|ico|woff2?|ttf)$/i.test(path);

  if(request.cache==="no-store"||url.searchParams.has("__stip_probe")){
    event.respondWith(fetch(request));
    return;
  }

  if(request.cache==="reload"){
    event.respondWith(fetch(request).then(async response=>{
      const cache=await caches.open(isHtml?PAGE_CACHE:STATIC_CACHE);
      if(cacheable(response))await cache.put(request,response.clone());
      return response;
    }));
    return;
  }

  if(isIndex){
    event.respondWith(cacheFirst(request,PAGE_CACHE));
    return;
  }

  if(isHtml){
    event.respondWith(networkFirst(request,PAGE_CACHE));
    return;
  }

  if(isStatic){
    if(url.searchParams.has("v")||url.searchParams.has("__stip_build")){
      event.respondWith(cacheFirst(request,STATIC_CACHE));
    }else{
      event.respondWith(staleWhileRevalidate(request,event,STATIC_CACHE));
    }
  }
});

function notificationIcon(data){
  const key=String(data.event_key||data.kind||data.type||data.tag||"").toLowerCase();
  if(key.includes("dm")||key.includes("direct")||key.includes("message"))return "/images/notifications/dm.webp?v=20260925-1";
  if(key.includes("wheelchair")||key.includes("fauteuil"))return "/images/notifications/wheelchair.webp?v=20260925-1";
  return "/images/icone_app/home-bell.svg?v=20260920-nav1";
}
self.addEventListener("push",event=>{let data={};try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text?.()||""}}const title=data.title||"STIP",options={body:data.body||"Nouvelle information",icon:notificationIcon(data),badge:"/images/icone_app/home-bell.svg?v=20260920-nav1",tag:data.tag||"stip",renotify:true,data:{url:data.url||"/?quick=notifications"}};event.waitUntil(self.registration.showNotification(title,options))});
self.addEventListener("notificationclick",event=>{event.notification.close();const url=new URL(event.notification.data?.url||"/?quick=notifications",self.location.origin).href;event.waitUntil((async()=>{const list=await clients.matchAll({type:"window",includeUncontrolled:true});for(const client of list){try{if("navigate" in client)await client.navigate(url);await client.focus();return}catch{}}if(clients.openWindow)await clients.openWindow(url)})())});
