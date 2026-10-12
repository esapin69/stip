(() => {
  "use strict";
  // Historique de navigation du brouillon T-est, distinct d'un chemin de dossiers.
  // Les pop-ups ne sont pas des pages et ne créent aucune étape.
  const MAX_STEPS=7;
  const STORAGE="t_est_page_history_v1";
  const bar=document.getElementById("tEstHistoryBar");
  const list=document.getElementById("tEstHistorySteps");
  const scroller=document.getElementById("tEstHistoryScroll");
  const home=bar?.querySelector("[data-history-home]");
  if(!bar||!list||!scroller||!home)return;
  let steps=[];
  function route(){
    const url=new URL(location.href),bloc=url.searchParams.get("bloc")||"",vue=url.searchParams.get("vue")||"";
    const conv=url.searchParams.get("conversation")||"";
    if(bloc==="communication"&&["fauteuils","dm","loisirs"].includes(vue))
      return {key:"communication:"+vue+(vue==="dm"&&conv?":"+conv:""),bloc,vue,conv};
    if(bloc==="planning"&&vue==="personnel")
      return {key:"planning:personnel",bloc,vue,conv:""};
    if(bloc==="ensemble"&&["activities","trips","invitations"].includes(vue))
      return {key:"ensemble:"+vue,bloc,vue,conv:""};
    return {key:"home",bloc:"",vue:"",conv:""};
  }
  function titleOf(r){
    if(r.key==="home")return "Accueil";
    if(r.conv){
      const node=[...document.querySelectorAll("[data-conversation-id]")]
        .find(el=>el.dataset.conversationId===r.conv);
      return node?.querySelector(".com-libelle")?.textContent?.trim()||"Canal collectif";
    }
    return {
      fauteuils:"Fauteuils",dm:"DM privé",personnel:"Mon planning",
      activities:"Activités",trips:"Trajets",invitations:"Invitations"
    }[r.vue]||"Page";
  }
  function pathOf(r){
    const url=new URL(location.href);
    url.searchParams.delete("bloc");
    url.searchParams.delete("vue");
    url.searchParams.delete("conversation");
    if(r.key!=="home"){
      url.searchParams.set("bloc",r.bloc);
      url.searchParams.set("vue",r.vue);
      if(r.conv)url.searchParams.set("conversation",r.conv);
    }
    return url.pathname+url.search+url.hash;
  }
  function save(){
    try{sessionStorage.setItem(STORAGE,JSON.stringify({date:Date.now(),steps}))}catch{}
  }
  function restore(){
    try{
      const state=JSON.parse(sessionStorage.getItem(STORAGE)||"null");
      if(!state||Date.now()-state.date>8*3600*1000)return;
      steps=(Array.isArray(state.steps)?state.steps:[])
        .filter(s=>s&&/^(communication:(fauteuils|dm)(:[a-f0-9-]{36})?|planning:personnel|ensemble:(activities|trips|invitations))$/.test(String(s.key||"")))
        .slice(-MAX_STEPS);
    }catch{steps=[]}
  }
  function render(){
    const active=route();
    home.setAttribute("aria-current",active.key==="home"?"page":"false");
    list.replaceChildren();
    steps.forEach((step,index)=>{
      const item=document.createElement("li");
      const arrow=document.createElement("span");
      arrow.className="t-history-chevron";
      arrow.textContent="›";
      arrow.setAttribute("aria-hidden","true");
      const button=document.createElement("button");
      button.type="button";
      button.className="t-history-step";
      button.textContent=step.title||"Page";
      button.title=step.title||"Page";
      if(step.key===active.key)button.setAttribute("aria-current","page");
      button.addEventListener("click",()=>visitIndex(index));
      item.append(arrow,button);
      list.append(item);
    });
    requestAnimationFrame(()=>{
      const current=list.querySelector('[aria-current="page"]');
      if(!current){scroller.scrollLeft=scroller.scrollWidth;return;}
      const windowRect=scroller.getBoundingClientRect(),buttonRect=current.getBoundingClientRect();
      if(buttonRect.right>windowRect.right-9)
        scroller.scrollLeft+=buttonRect.right-windowRect.right+12;
      if(buttonRect.left<windowRect.left+9)
        scroller.scrollLeft-=windowRect.left-buttonRect.left+12;
    });
  }
  function pushRoute(next){
    const nextUrl=pathOf(next);
    const current=location.pathname+location.search+location.hash;
    if(nextUrl!==current){
      history.pushState({tEst:true,bloc:next.bloc,vue:next.vue}, "",nextUrl);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
    window.scrollTo({top:0,behavior:"instant"});
  }
  function visitIndex(index){
    const entry=steps[index];
    if(!entry)return;
    steps=steps.slice(0,index+1);
    save();
    pushRoute(entry);
    render();
  }
  function homeClick(){
    steps=[];save();
    pushRoute({key:"home",bloc:"",vue:"",conv:""});
    render();
  }
  function record(){
    const page=route();
    if(page.key==="home"){
      if(steps.length){steps=[];save()}
      render();
      return;
    }
    const title=titleOf(page);
    const last=steps.at(-1);
    if(last?.key===page.key){
      if(last.title!==title){last.title=title;save()}
    }else{
      const prior=steps.findIndex(e=>e.key===page.key);
      if(prior>=0)steps=steps.slice(0,prior+1);
      else steps=[...steps,{key:page.key,bloc:page.bloc,vue:page.vue,conv:page.conv,title}].slice(-MAX_STEPS);
      const tail=steps.at(-1);
      if(tail)tail.title=title;
      save();
    }
    render();
  }
  home.addEventListener("click",homeClick);
  window.addEventListener("popstate",record);
  window.addEventListener("t-est:page-open",record);
  // Les cartes de canaux peuvent être hydratées après le chargement de la bande.
  const communication=document.querySelector('[data-carousel="communication"]');
  if(communication){
    let queued=false;
    new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        const active=route();
        if(active.conv&&steps.at(-1)?.key===active.key)record();
      });
    }).observe(communication,{childList:true,subtree:true});
  }
  restore();
  record();
})();
