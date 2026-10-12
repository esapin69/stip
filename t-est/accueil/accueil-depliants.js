(() => {
  "use strict";
  // Une page verticale. Chaque bloc conserve le DOM de chaque carte repliée.
  // Aucune iframe n'est rechargée au second clic : fils, saisies, scrolls sont préservés.
  const DEST={
    fauteuils:"/index.html?quick=communication&tab=fauteuils#/communication/fauteuils",
    dm:"/index.html?quick=communication&tab=dm#/communication/dm",
    personnel:"/index.html#/planning/personal"
  };
  const VALID_GROUP=/^[a-f0-9-]{36}$/i;
  const regions={
    planning:document.querySelector('[data-expanded="planning"]'),
    communication:document.querySelector('[data-expanded="communication"]')
  };
  const blocs={
    planning:document.querySelector('[data-block="planning"]'),
    communication:document.querySelector('[data-block="communication"]')
  };
  if(!regions.planning||!regions.communication)return;
  const active={planning:null,communication:null};
  const cached={planning:new Map(),communication:new Map()};
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const label=(block,id)=>{
    if(block==="planning")return ({"day:0":"Aujourd’hui","day:1":"Demain","day:7":"Cette semaine",personal:"Mon planning"})[id]||"Planning";
    if(id==="fauteuils")return "Fauteuils";
    if(id==="dm")return "DM privé";
    if(id.startsWith("group:")){
      const card=[...document.querySelectorAll("[data-conversation-id]")].find(el=>"group:"+el.dataset.conversationId===id);
      return card?.querySelector(".com-libelle")?.textContent?.trim()||"Canal collectif";
    }
    return "Communication";
  };
  function route(){
    const p=new URLSearchParams(location.search),bloc=p.get("bloc"),vue=p.get("vue"),conversation=p.get("conversation");
    if(bloc==="planning"){
      const id={"aujourdhui":"day:0","demain":"day:1","semaine":"day:7","personnel":"personal"}[vue];
      if(id)return {block:"planning",id};
    }
    if(bloc==="communication"){
      if(vue==="dm"&&conversation&&VALID_GROUP.test(conversation))return {block:"communication",id:"group:"+conversation};
      if(["fauteuils","dm"].includes(vue))return {block:"communication",id:vue};
    }
    return null;
  }
  function toURL(next){
    const u=new URL(location.href);
    for(const k of ["bloc","vue","conversation"])u.searchParams.delete(k);
    if(next?.block==="planning"){
      u.searchParams.set("bloc","planning");
      u.searchParams.set("vue",({"day:0":"aujourdhui","day:1":"demain","day:7":"semaine",personal:"personnel"})[next.id]||"aujourdhui");
    }else if(next?.block==="communication"){
      u.searchParams.set("bloc","communication");
      u.searchParams.set("vue",next.id==="fauteuils"?"fauteuils":"dm");
      if(next.id.startsWith("group:"))u.searchParams.set("conversation",next.id.slice(6));
    }
    return u.pathname+u.search+u.hash;
  }
  function scrollToBlock(block){
    const el=blocs[block];
    if(!el)return;
    requestAnimationFrame(()=>{
      const band=document.getElementById("tEstHistoryBar")?.getBoundingClientRect().height||54;
      const y=window.scrollY+el.getBoundingClientRect().top-band-10;
      window.scrollTo({top:Math.max(0,y),behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
    });
  }
  function updateButtons(block){
    blocs[block].querySelectorAll("[data-jour],[data-ouverture],[data-conversation-id]").forEach(el=>{
      let id=null;
      if(el.hasAttribute("data-jour"))id="day:"+el.dataset.jour;
      else if(el.hasAttribute("data-conversation-id"))id="group:"+el.dataset.conversationId;
      else if(el.hasAttribute("data-ouverture"))id=el.dataset.ouverture;
      const selected=id===active[block];
      el.setAttribute("aria-expanded",String(selected));
      el.setAttribute("aria-current",String(selected));
    });
  }
  function styleFrame(frame,block){
    try{
      const doc=frame.contentDocument;
      if(!doc||doc.getElementById("t-inline-ghe-style"))return;
      const style=doc.createElement("style");
      style.id="t-inline-ghe-style";
      style.textContent=[
        "html,body{margin:0!important;background:#fff!important}",
        ".ca-head,.ca-tabs{display:none!important}",
        ".ca-app{min-height:0!important}",
        ".ch-inline-inbox{min-height:0!important}",
        ".ch-inbox-footer{position:sticky!important;bottom:0!important}",
        ".ca-body{min-width:0}"
      ].join("");
      doc.head.append(style);
    }catch{}
  }
  function trackFrame(frame,block,slot){
    const status=slot.querySelector(".t-inline-wait");
    let observer=null,changes=null;
    function size(){
      if(slot.hidden)return;
      try{
        const doc=frame.contentDocument;
        if(!doc)return;
        const body=doc.body,html=doc.documentElement;
        const main=doc.querySelector(".ca-app,.app-shell,#app,main");
        const height=Math.min(13000,Math.max(
          540,
          Math.ceil(main?.scrollHeight||0),
          Math.ceil(body?.scrollHeight||0),
          Math.ceil(html?.scrollHeight||0)
        )+8);
        if(Math.abs(frame.getBoundingClientRect().height-height)>4)frame.style.height=height+"px";
      }catch{}
    }
    frame.addEventListener("load",()=>{
      styleFrame(frame,block);
      if(status)status.hidden=true;
      try{
        const doc=frame.contentDocument;
        const target=doc.querySelector(".ca-app")||doc.body;
        if(typeof ResizeObserver!=="undefined"){
          observer?.disconnect();observer=new ResizeObserver(()=>requestAnimationFrame(size));
          observer.observe(target);
        }
        changes?.disconnect();
        changes=new MutationObserver(()=>requestAnimationFrame(size));
        changes.observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden","class","style"]});
      }catch{}
      requestAnimationFrame(size);
    });
    slot.updateSize=size;
    window.addEventListener("resize",size,{passive:true});
  }
  function createSlot(block,id){
    const slot=document.createElement("section");
    slot.className="t-inline-content";
    slot.dataset.inlineKey=id;
    slot.setAttribute("aria-label",label(block,id));
    if(block==="planning"&&id!=="personal"){
      slot.innerHTML='<div class="t-inline-planning">'+(window.TEstAccueilPlanning?.htmlFor?.(Number(id.split(":")[1]))||"")+'</div>';
    }else{
      const url=id==="personal"?DEST.personnel:id==="fauteuils"?DEST.fauteuils:DEST.dm;
      const parsed=new URL(url,location.origin);
      if(id.startsWith("group:"))parsed.searchParams.set("conversation",id.slice(6));
      slot.innerHTML='<p class="t-inline-wait" role="status">Chargement de '+esc(label(block,id))+'…</p>';
      const frame=document.createElement("iframe");
      frame.className="t-inline-iframe";
      frame.title=label(block,id);
      frame.setAttribute("loading","eager");
      slot.append(frame);
      trackFrame(frame,block,slot);
      frame.src=parsed.href;
    }
    regions[block].append(slot);
    cached[block].set(id,slot);
    return slot;
  }
  function select(block,id,{forceOpen=false,push=true,scroll=true}={}){
    if(!regions[block]||!id)return;
    if(block==="planning"&&!["day:0","day:1","day:7","personal"].includes(id))return;
    if(block==="communication"&&!["fauteuils","dm"].includes(id)&&!(id.startsWith("group:")&&VALID_GROUP.test(id.slice(6))))return;
    const wasOpen=active[block]===id;
    const open=forceOpen||!wasOpen;
    active[block]=open?id:null;
    for(const [name,slot] of cached[block])slot.hidden=name!==active[block];
    if(open){
      const slot=cached[block].get(id)||createSlot(block,id);
      slot.hidden=false;
      slot.updateSize?.();
    }
    regions[block].hidden=!open;
    updateButtons(block);
    if(push){
      const next=toURL(open?{block,id}:null);
      if(next!==location.pathname+location.search+location.hash)history.pushState({tEstInline:true}, "", next);
    }
    dispatchEvent(new CustomEvent("t-est:section-state",{detail:{block,id,open,label:label(block,id)}}));
    if(open&&scroll)scrollToBlock(block);
  }
  function restoreURL(){
    const next=route();
    if(next)select(next.block,next.id,{forceOpen:true,push:false,scroll:false});
    else{
      for(const block of ["planning","communication"]){
        active[block]=null;regions[block].hidden=true;
        for(const slot of cached[block].values())slot.hidden=true;
        updateButtons(block);
      }
    }
  }
  // Exposé aux boutons de création et au fil d'historique.
  window.TEstDashboard={
    toggle:select,
    open:(block,id,options={})=>select(block,id,{...options,forceOpen:true}),
    reset:()=>{
      for(const block of ["planning","communication"]){
        active[block]=null;regions[block].hidden=true;
        for(const slot of cached[block].values())slot.hidden=true;
        updateButtons(block);
      }
      const next=toURL(null);
      if(next!==location.pathname+location.search+location.hash)history.pushState({tEstInline:true},"",next);
      dispatchEvent(new CustomEvent("t-est:section-reset"));
      window.scrollTo({top:0,behavior:"smooth"});
    },
    current:()=>({...active})
  };
  document.addEventListener("click",e=>{
    const day=e.target.closest('[data-block="planning"] [data-jour]');
    if(day){select("planning","day:"+day.dataset.jour);return;}
    const conv=e.target.closest('[data-block="communication"] [data-conversation-id]');
    if(conv){select("communication","group:"+conv.dataset.conversationId);return;}
    const module=e.target.closest('[data-block="communication"] [data-ouverture]');
    if(module){select("communication",module.dataset.ouverture);return;}
    if(e.target.closest('[data-open-planning]')){select("planning","personal",{forceOpen:true});}
  });
  window.addEventListener("popstate",restoreURL);
  window.addEventListener("t-est:planning-updated",()=>{
    for(const [key,slot] of cached.planning){
      if(!key.startsWith("day:"))continue;
      const content=slot.querySelector(".t-inline-planning");
      if(content)content.innerHTML=window.TEstAccueilPlanning?.htmlFor?.(Number(key.split(":")[1]))||"";
    }
  });
  window.addEventListener("t-est:channels-redrawn",()=>updateButtons("communication"));
  restoreURL();
})();
