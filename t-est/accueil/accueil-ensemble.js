(() => {
  "use strict";
  // T-est seulement : une page métier devient le contenu d'un bloc sur l'accueil.
  // Le carrousel de l'accueil remplace les onglets internes, sans dupliquer leur UI.
  const VALID=new Set(["activities","trips","invitations"]);
  const panel=document.getElementById("tEnsemblePanel");
  const frame=document.getElementById("tEnsembleFrame");
  const status=document.getElementById("tEnsembleLoading");
  const buttons=[...document.querySelectorAll("[data-ensemble-view]")];
  if(!panel||!frame||!buttons.length)return;
  let loaded=false,active="",wantCreate=false,lastHeight=0;
  let resizeObserver=null,mutationObserver=null,detachResize=()=>{};
  function selected(){
    const q=new URLSearchParams(location.search);
    const bloc=q.get("bloc"),vue=q.get("vue");
    if(bloc==="ensemble"&&VALID.has(vue))return vue;
    if(bloc==="communication"&&vue==="loisirs")return "activities"; // ancien lien
    return "";
  }
  function updateCounts(){
    try{
      const doc=frame.contentDocument, badge=doc?.getElementById('ensembleInviteBadge');
      const button=buttons.find(x=>x.dataset.ensembleView==='invitations');
      if(!button||!badge)return;
      let indication=button.querySelector('[data-ensemble-count]');
      if(!indication){
        indication=document.createElement('span');
        indication.className='com-precisions';
        indication.dataset.ensembleCount='1';
        button.append(indication);
      }
      indication.textContent=!badge.hidden&&Number(badge.textContent)>0?badge.textContent.trim()+' en attente':'';
      indication.hidden=!indication.textContent;
    }catch{}
  }
  function setHeight(){
    updateCounts();
    try{
      const doc=frame.contentDocument;
      if(!doc)return;
      const page=doc.querySelector(".ensemble-page");
      const size=Math.min(12000,Math.max(290,Math.ceil(page?.scrollHeight||doc.body?.scrollHeight||340)+8));
      if(Math.abs(size-lastHeight)>3){lastHeight=size;frame.style.height=size+"px";}
    }catch{}
  }
  function skin(){
    const doc=frame.contentDocument;
    if(!doc||doc.getElementById("t-est-ensemble-inline"))return;
    const style=doc.createElement("style");
    style.id="t-est-ensemble-inline";
    style.textContent=[
      "html,body{margin:0!important;padding:0!important;overflow-x:hidden!important;background:transparent!important}",
      ".ensemble-page{max-width:none!important;margin:0!important;padding:6px 4px 24px!important}",
      ".ensemble-topbar,.ensemble-hero,.ensemble-nav,.ensemble-cta{display:none!important}",
      ".ensemble-status:empty{display:none!important}",
      ".ensemble-page .ensemble-cta{margin-top:8px!important}"
    ].join("");
    doc.head.append(style);
  }
  function activateNativeTab(tab){
    if(!loaded||!VALID.has(tab))return;
    try{
      const doc=frame.contentDocument;
      const btn=doc?.querySelector('[data-ensemble-tab="'+tab+'"]');
      if(btn){
        btn.click(); // appelle le moteur existant et son rendu ; onglets masqués
        status.hidden=true;
      }
      setHeight();
      if(wantCreate&&tab==="activities"&&frame.contentWindow?.STIPLeisure?.openCreator){
        wantCreate=false;
        frame.contentWindow.STIPLeisure.openCreator();
        requestAnimationFrame(setHeight);
      }
    }catch{
      status.hidden=false;status.textContent="Impossible d’afficher Ensemble ici.";
    }
  }
  function ensureLoaded(){
    if(frame.dataset.started)return;
    frame.dataset.started="1";
    frame.src="/sorties-loisirs.html?ghe_embedded=ensemble";
  }
  function synchronize(){
    const tab=selected();
    active=tab;
    buttons.forEach(b=>b.setAttribute("aria-current",String(b.dataset.ensembleView===tab&&!!tab)));
    panel.hidden=!tab;
    if(!tab)return;
    ensureLoaded();
    if(loaded)activateNativeTab(tab);
  }
  function navigate(tab,create=false){
    if(!VALID.has(tab))return;
    wantCreate=create;
    const url=new URL(location.href);
    url.searchParams.delete("conversation");
    url.searchParams.set("bloc","ensemble");
    url.searchParams.set("vue",tab);
    const target=url.pathname+url.search+url.hash;
    if(target!==location.pathname+location.search+location.hash){
      history.pushState({tEst:true,bloc:"ensemble",vue:tab},"",target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }else synchronize();
    if(create&&loaded)activateNativeTab(tab);
    // Garder le carrousel à portée, sans renvoyer vers une nouvelle page.
    document.getElementById("tEnsembleBloc")?.scrollIntoView({block:"start",behavior:"smooth"});
  }
  frame.addEventListener("load",()=>{
    loaded=true;
    skin();
    const doc=frame.contentDocument;
    if(!doc)return;
    // Même site : observation sans copie des données ni nouvelle API.
    const page=doc.querySelector(".ensemble-page")||doc.body;
    if(typeof ResizeObserver!=="undefined"){
      resizeObserver?.disconnect();
      resizeObserver=new ResizeObserver(()=>requestAnimationFrame(setHeight));
      resizeObserver.observe(page);
    }
    mutationObserver?.disconnect();
    mutationObserver=new MutationObserver(()=>requestAnimationFrame(setHeight));
    mutationObserver.observe(page,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden","class","style"]});
    frame.contentWindow?.addEventListener("resize",setHeight,{passive:true});
    setHeight();
    activateNativeTab(active||"activities");
  });
  buttons.forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.ensembleView)));
  document.querySelectorAll("[data-ensemble-create]").forEach(b=>
    b.addEventListener("click",()=>navigate("activities",true)));
  window.addEventListener("popstate",synchronize);
  synchronize();
})();
