(() => {
  "use strict";
  // Historique des sélections réelles sur l'accueil unique, pas un chemin de dossiers.
  const MAX=7, STORE="t_est_page_history_inline_v2";
  const bar=document.getElementById("tEstHistoryBar"),list=document.getElementById("tEstHistorySteps");
  const scroller=document.getElementById("tEstHistoryScroll");
  const home=bar?.querySelector("[data-history-home]");
  if(!bar||!list||!scroller||!home)return;
  let steps=[],currentKey="";
  function key(block,id){return block+":"+id}
  function read(){
    try{
      const s=JSON.parse(sessionStorage.getItem(STORE)||"null");
      if(!s||Date.now()-s.at>8*3600000)return;
      steps=(Array.isArray(s.steps)?s.steps:[]).filter(x=>
        x&&typeof x.id==="string"&&typeof x.label==="string"&&(
          (x.block==="planning"&&x.id==="personal")||
          (x.block==="communication"&&(x.id==="fauteuils"||x.id==="dm"||
            /^thread:[a-f0-9-]{36}$/i.test(x.id)))||
          (x.block==="ensemble"&&["activities","trips","invitations"].includes(x.id))
        )
      ).slice(-MAX);
    }catch{}
  }
  function save(){
    try{sessionStorage.setItem(STORE,JSON.stringify({at:Date.now(),steps}))}catch{}
  }
  function paint(){
    list.replaceChildren();
    home.setAttribute("aria-current",currentKey?"false":"page");
    steps.forEach((s,index)=>{
      const li=document.createElement("li"),arrow=document.createElement("span"),b=document.createElement("button");
      arrow.className="t-history-chevron";arrow.textContent="›";arrow.setAttribute("aria-hidden","true");
      b.className="t-history-step";b.type="button";b.textContent=s.label;b.title=s.label;
      if(key(s.block,s.id)===currentKey)b.setAttribute("aria-current","page");
      b.addEventListener("click",()=>{
        steps=steps.slice(0,index+1);save();
        if(s.block==="ensemble")window.TEstEnsemble?.open(s.id,{forceOpen:true});
        else window.TEstDashboard?.open(s.block,s.id,{forceOpen:true});
        paint();
      });
      li.append(arrow,b);list.append(li);
    });
    requestAnimationFrame(()=>{scroller.scrollLeft=scroller.scrollWidth});
  }
  function record({block,id,open,label}){
    if(!open){if(currentKey===key(block,id))currentKey="";paint();return;}
    currentKey=key(block,id);
    const last=steps.at(-1);
    if(last&&key(last.block,last.id)===currentKey)last.label=label||last.label;
    else{
      const previous=steps.findIndex(s=>key(s.block,s.id)===currentKey);
      if(previous>=0)steps=steps.slice(0,previous+1);
      else steps=[...steps,{block,id,label:label||"Page"}].slice(-MAX);
    }
    save();paint();
  }
  home.addEventListener("click",()=>{
    steps=[];currentKey="";save();
    window.TEstDashboard?.reset();
    paint();
  });
  window.addEventListener("t-est:section-state",e=>{
    const detail=e.detail||{};
    // Les pop-ups sélectionnent une carte sans devenir une page de l'historique.
    if(detail.kind==="pop"){
      if(detail.open){currentKey="";paint()}
      return;
    }
    record(detail);
  });
  window.addEventListener("t-est:section-reset",()=>{currentKey="";paint()});
  read();
  const state=window.TEstDashboard?.current?.()||{};
  for(const [block,id] of Object.entries(state))if(id)record({block,id,open:true,label:steps.find(s=>s.block===block&&s.id===id)?.label||id});
  const ensemble=window.TEstEnsemble?.current?.();
  if(ensemble)record({block:"ensemble",id:ensemble,open:true,label:({activities:"Activités",trips:"Trajets",invitations:"Invitations"})[ensemble]||"Ensemble"});
  paint();
})();
