const STIP_SW_BUILD="20260925-wheelchair-flow1";
const STATIC_CACHE="stip-static-"+STIP_SW_BUILD;
const PAGE_CACHE="stip-pages-"+STIP_SW_BUILD;

self.addEventListener("install",()=>self.skipWaiting());

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(
      keys
        .filter(key=>/^stip-(?:static|pages)-/.test(key)&&![STATIC_CACHE,PAGE_CACHE].includes(key))
        .map(key=>caches.delete(key))
    );
    await clients.claim();
  })());
});

function cacheable(response){
  return !!response&&response.ok&&response.type!=="opaque";
}

async function cacheFirst(request,cacheName){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(cacheable(response))await cache.put(request,response.clone());
  return response;
}

async function staleWhileRevalidate(request,event,cacheName){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request);
  const network=fetch(request)
    .then(async response=>{
      if(cacheable(response))await cache.put(request,response.clone());
      return response;
    });
  if(cached){
    event.waitUntil(network.catch(()=>{}));
    return cached;
  }
  return network;
}

async function networkFirst(request,cacheName){
  const cache=await caches.open(cacheName);
  try{
    const response=await fetch(request);
    if(cacheable(response))await cache.put(request,response.clone());
    return response;
  }catch(error){
    const cached=await cache.match(request);
    if(cached)return cached;
    throw error;
  }
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
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
    event.respondWith(
      fetch(request).then(async response=>{
        const cache=await caches.open(isHtml?PAGE_CACHE:STATIC_CACHE);
        if(cacheable(response))await cache.put(request,response.clone());
        return response;
      })
    );
    return;
  }

  if(isIndex){
    // index.html is an app shell. Its own self-heal probe checks the current
    // build just after paint, so returning to it can safely use the cached shell.
    event.respondWith(cacheFirst(request,PAGE_CACHE));
    return;
  }

  if(isHtml){
    event.respondWith(networkFirst(request,PAGE_CACHE));
    return;
  }

  if(isStatic){
    // Versioned assets are immutable for that URL: never redownload them on
    // every return. Unversioned assets stay stale-while-revalidate.
    if(url.searchParams.has("v")||url.searchParams.has("__stip_build"))
      event.respondWith(cacheFirst(request,STATIC_CACHE));
    else
      event.respondWith(staleWhileRevalidate(request,event,STATIC_CACHE));
  }
});

self.addEventListener("push",event=>{
  let data={};try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text?.()||""}}
  const title=data.title||"STIP",options={
    body:data.body||"Nouvelle information",
    icon:"images/icone_app/home-bell.svg?v=20260920-nav1",
    badge:"images/icone_app/home-bell.svg?v=20260920-nav1",
    tag:data.tag||"stip",
    renotify:true,
    data:{url:data.url||"/?quick=notifications"}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const url=new URL(event.notification.data?.url||"/?quick=notifications",self.location.origin).href;
  event.waitUntil((async()=>{
    const list=await clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of list){
      try{
        if("navigate" in client)await client.navigate(url);
        await client.focus();
        return;
      }catch{}
    }
    if(clients.openWindow)await clients.openWindow(url);
  })());
});
