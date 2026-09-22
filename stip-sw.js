const STIP_SW_BUILD="20260922-fauteuils21";
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>/^stip/i.test(key)).map(key=>caches.delete(key)));
    await clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  const fresh =
    request.mode==="navigate" ||
    /\.(?:html?|js|css|webmanifest)$/i.test(url.pathname) ||
    url.pathname==="/";
  if(!fresh)return;
  event.respondWith(
    fetch(new Request(request,{cache:"no-store"}))
      .catch(()=>fetch(request))
  );
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
