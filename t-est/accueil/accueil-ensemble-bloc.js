(() => {
  "use strict";
  // Les rubriques Ensemble gardent leur contenu original, intégré à l'accueil GHE.
  const block=document.querySelector('[data-block="ensemble"]');
  const region=document.getElementById("tEnsembleExpanded");
  const frame=document.getElementById("tEnsembleFrame");
  const cards=[...document.querySelectorAll("[data-ensemble-view]")];
  const valid=new Set(["activities","trips","invitations"]);
  if(!block||!region||!frame||!cards.length)return;
  let active=null,loaded=false,needsCreate=false;
  let currentHeight=0,ro=null,mo=null;
  function scrollBlock(){
    requestAnimationFrame(()=>{
      const band=document.getElementById("tEstHistoryBar")?.offsetHeight||54;
      const y=window.scrollY+block.getBoundingClientRect().top-band-10;
      window.scrollTo({top:Math.max(0,y),behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
    });
  }
  function updateButtons(){
    for(const b of cards){
      const isCurrent=b.dataset.ensembleView===active;
      b.setAttribute("aria-expanded",String(isCurrent));
      b.setAttribute("aria-current",String(isCurrent));
    }
  }
  function placeUrl(tab){
    const u=new URL(location.href);
    for(const key of ["bloc","vue","conversation"])u.searchParams.delete(key);
    if(tab){u.searchParams.set("bloc","ensemble");u.searchParams.set("vue",tab)}
    const path=u.pathname+u.search+u.hash;
    if(path!==location.pathname+location.search+location.hash)
      history.pushState({tEst:true}, "",path);
  }
  function skin(){
    try{
      const doc=frame.contentDocument;
      if(!doc||doc.getElementById("t-est-ensemble-in-block"))return;
      const style=doc.createElement("style");
      style.id="t-est-ensemble-in-block";
      style.textContent=[
        "html,body{margin:0!important;overflow-x:hidden!important;background:#fff!important}",
        ".ensemble-page{padding:8px 10px 18px!important;margin:0!important;max-width:none!important}",
        ".ensemble-topbar,.ensemble-hero,.ensemble-nav,.ensemble-cta{display:none!important}",
        ".ensemble-status:empty{display:none!important}"
      ].join("");
      doc.head.append(style);
    }catch{}
  }
  function measure(){
    if(region.hidden||!loaded)return;
    try{
      const doc=frame.contentDocument;
      if(!doc)return;
      const page=doc.querySelector(".ensemble-page")||doc.body;
      const measured=Math.min(14000,Math.max(340,Math.ceil(page.scrollHeight)+22));
      if(Math.abs(measured-currentHeight)>5){currentHeight=measured;frame.style.height=measured+"px"}
    }catch{}
  }
  function selectNative(tab){
    if(!loaded||!valid.has(tab))return;
    try{
      const d=frame.contentDocument,btn=d?.querySelector('[data-ensemble-tab="'+tab+'"]');
      if(btn)btn.click();
      if(needsCreate&&tab==="activities"){
        const api=frame.contentWindow?.STIPLeisure;
        if(api?.openCreator){needsCreate=false;api.openCreator();}
      }
      requestAnimationFrame(measure);
    }catch{}
  }
  function ensureFrame(){
    if(frame.dataset.started)return;
    frame.dataset.started="true";
    frame.src="/sorties-loisirs.html?ghe_embedded=ensemble";
  }
  function open(tab,{forceOpen=false,scroll=true,push=true,create=false}={}){
    if(!valid.has(tab))return;
    const opening=forceOpen||active!==tab;
    active=opening?tab:null;
    needsCreate=Boolean(create);
    region.hidden=!opening;
    updateButtons();
    if(push)placeUrl(active);
    dispatchEvent(new CustomEvent("t-est:section-state",{detail:{
      block:"ensemble",id:tab,open:opening,label:({activities:"Activités",trips:"Trajets",invitations:"Invitations"})[tab]
    }}));
    if(opening){ensureFrame();selectNative(tab);if(scroll)scrollBlock();}
  }
  frame.addEventListener("load",()=>{
    loaded=true;skin();
    try{
      const doc=frame.contentDocument,body=doc.querySelector(".ensemble-page")||doc.body;
      ro?.disconnect();mo?.disconnect();
      if(typeof ResizeObserver!=="undefined"){ro=new ResizeObserver(()=>requestAnimationFrame(measure));ro.observe(body);}
      mo=new MutationObserver(()=>requestAnimationFrame(measure));
      mo.observe(body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden","class","style"]});
    }catch{}
    selectNative(active||"activities");
    requestAnimationFrame(measure);
  });
  cards.forEach(button=>button.addEventListener("click",()=>open(button.dataset.ensembleView)));
  document.querySelector("[data-ensemble-create]")?.addEventListener("click",()=>open("activities",{forceOpen:true,create:true}));
  addEventListener("resize",measure,{passive:true});
  addEventListener("popstate",()=>{
    const p=new URLSearchParams(location.search);
    if(p.get("bloc")==="ensemble"&&valid.has(p.get("vue"))){
      const tab=p.get("vue");if(active!==tab)open(tab,{forceOpen:true,push:false,scroll:false});
    }else if(active){active=null;region.hidden=true;updateButtons();}
  });
  addEventListener("t-est:section-reset",()=>{active=null;region.hidden=true;updateButtons()});
  window.TEstEnsemble={open:(tab,options={})=>open(tab,{...options,forceOpen:true}),current:()=>active};
  const params=new URLSearchParams(location.search);
  if(params.get("bloc")==="ensemble"&&valid.has(params.get("vue")))
    open(params.get("vue"),{forceOpen:true,push:false,scroll:false});
})();
