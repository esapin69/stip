(() => {
  "use strict";

  if (window.__STIPWorkspaceLoaded) return;
  window.__STIPWorkspaceLoaded = true;

  const STORE = "stip_recent_work_v1";
  const MAX_AGE = 12 * 60 * 60 * 1000;
  const MAX_ITEMS = 8;
  const SHOW_ITEMS = 3;
  const TECH_PARAMS = new Set(["embed", "return", "v", "__stip_build", "_"]);

  const PAGE_META = {
    "agent-directory.html": ["Équipe", "👥"], "agent-dates.html": ["Date des agents", "📅"],
    "agent-date-detail.html": ["Date des agents", "📅"], "planning-compare-app.html": ["Comparer les plannings", "▦"],
    "places-app.html": ["Visiter les lieux", "⌖"], "places.html": ["Visiter les lieux", "⌖"],
    "assistant.html": ["Assistant STIP", "✦"], "cadre-activite.html": ["Activité", "⌁"],
    "cadre-documents.html": ["Documents", "▤"], "cadre.html": ["Espace Cadre", "◇"],
    "access-manage.html": ["Accès", "🔐"], "responsable.html": ["Responsable", "◆"],
    "responsable-agenda.html": ["Agenda équipe", "▦"], "responsable-demandes.html": ["Demandes", "↗"],
    "responsable-evaluations.html": ["Évaluation", "✓"], "agent-readonly.html": ["Fiche agent", "👤"],
  };
  const ROUTE_META = {team:["Esprit d’équipe","👥"],responsable:["Responsable","◆"],fauteuils:["Fauteuils","♿"],"planning/personal":["Planning perso","📅"],"planning/change":["Changement","⇄"],"planning/calendar":["Calendrier","▦"],contacts:["Contacts","☎"]};
  const NON_WORK_ROUTES = new Set(["","home","apps","notifications"]);
  const NON_WORK_PAGES = new Set(["","index.html","mon-compte.html","print.html","rejoindre-equipe.html","nouvel-arrivant-pro.html"]);
  const embedded = window.self !== window.top;
  function safeJson(raw,fallback){try{return JSON.parse(raw)??fallback}catch{return fallback}}
  function load(){let items=[];try{items=safeJson(sessionStorage.getItem(STORE)||"[]",[])}catch{}const now=Date.now();items=Array.isArray(items)?items.filter(item=>item&&item.id&&item.url&&now-Number(item.at||0)<=MAX_AGE):[];return items.slice(0,MAX_ITEMS)}
  function save(items){try{sessionStorage.setItem(STORE,JSON.stringify(items.slice(0,MAX_ITEMS)))}catch{}}
  function cleanParams(search=location.search){const input=new URLSearchParams(search||""),output=new URLSearchParams();[...input.entries()].filter(([key])=>!TECH_PARAMS.has(key)).sort(([a],[b])=>a.localeCompare(b)).forEach(([key,value])=>output.append(key,value));const text=output.toString();return text?"?"+text:""}
  function baseName(){return location.pathname.split("/").pop()||""}
  function selectedDetail(){const selected=document.querySelector('[data-resp-tab][aria-selected="true"] .stip-filter-copy strong')||document.querySelector('[role="tab"][aria-selected="true"] strong')||document.querySelector('.stip-filter-choice.active .stip-filter-copy strong');const text=String(selected?.textContent||"").trim();if(text&&!/^tout$/i.test(text))return text;const agent=document.querySelector("[data-agent-name]")||document.querySelector("[data-agent-title]")||document.querySelector(".agent-name");const agentText=String(agent?.textContent||"").trim();if(agentText&&!/chargement/i.test(agentText))return agentText;return ""}
  function pageMeta(){const page=baseName(),meta=PAGE_META[page];if(!meta||NON_WORK_PAGES.has(page))return null;let[label,icon]=meta;const detail=selectedDetail();if(page==="responsable.html"){const tab=new URLSearchParams(location.search).get("tab")||detail||"",map={dates:"Dates",suivi:"Suivi",equipe:"Équipe",agenda:"Agenda"};return{id:"route:responsable",label,detail:map[tab]||detail,icon,url:"responsable.html"+cleanParams(location.search)+location.hash}}if(page==="esprit-equipe.html")return{id:"route:team",label:"Esprit d’équipe",detail,icon:"👥",url:"index.html#/team"};return{id:"page:"+page,label,detail,icon,url:page+cleanParams(location.search)+location.hash}}
  function routeMeta(route){route=String(route||"").replace(/^\/+|\/+$/g,"");if(NON_WORK_ROUTES.has(route))return null;let key=route;if(route.startsWith("contacts"))key="contacts";if(route.startsWith("planning/personal"))key="planning/personal";if(route.startsWith("planning/change"))key="planning/change";if(route.startsWith("planning/calendar"))key="planning/calendar";const meta=ROUTE_META[key];if(!meta)return null;return{id:"route:"+key,label:meta[0],detail:"",icon:meta[1],url:"index.html#/"+route}}
  function currentWork(){const route=window.STIPRouter?.get?.()||(baseName()==="index.html"||!baseName()?location.hash.replace(/^#\/?/,"")||"home":"");return routeMeta(route)||pageMeta()}
  function sameCurrent(item){const current=currentWork();return!!current&&current.id===item.id}
  function touch(work=currentWork()){if(!work?.id||!work?.url)return null;const now=Date.now(),previous=load(),existing=previous.find(item=>item.id===work.id),item={...existing,...work,at:now},next=[item,...previous.filter(x=>x.id!==item.id)];save(next);renderLauncher();window.dispatchEvent(new CustomEvent("stip:workspace-updated",{detail:item}));if(embedded){try{window.top.STIPWorkspace?.render?.()}catch{}}return item}
  function allRecent(){return load().filter(item=>!sameCurrent(item))}
  function recent(){return allRecent().slice(0,SHOW_ITEMS)}
  function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char])}
  function ensureCss(){if(document.querySelector('link[data-stip-workspace-css]'))return;const link=document.createElement("link");link.rel="stylesheet";link.href="stip-workspace.css?v=20260925-workspace3";link.dataset.stipWorkspaceCss="1";document.head.appendChild(link)}
  function closeLauncher(){const host=document.getElementById("stipWorkspaceLauncher");if(!host)return;host.classList.remove("open");host.querySelector(".stip-workspace-toggle")?.setAttribute("aria-expanded","false")}
  function openItem(item){if(!item?.url)return;try{window.STIPNav?.save?.({workspaceExit:true})}catch{}location.assign(item.url)}

  function itemMarkup(item,index,compact=false){
    const detail=item.detail?'<small>'+escapeHtml(item.detail)+'</small>':'<small>Reprendre là où vous étiez</small>';
    return '<button type="button" class="stip-workspace-item'+(compact?' is-compact':'')+'" data-stip-workspace-index="'+index+'"><span class="stip-workspace-icon" aria-hidden="true">'+escapeHtml(item.icon||"↩")+'</span><span class="stip-workspace-copy"><strong>'+escapeHtml(item.label)+'</strong>'+detail+'</span><span class="stip-workspace-arrow" aria-hidden="true">'+(compact?'›':'Reprendre')+'</span></button>';
  }
  function renderLauncher(){
    if(embedded)return;
    ensureCss();
    const allItems=allRecent(),items=allItems.slice(0,SHOW_ITEMS),more=allItems.slice(SHOW_ITEMS);
    let host=document.getElementById("stipWorkspaceLauncher");
    if(!items.length){host?.remove();return}
    if(!host){
      host=document.createElement("aside");
      host.id="stipWorkspaceLauncher";
      host.className="stip-workspace-launcher";
      host.setAttribute("aria-label","Travaux récents");
      document.body.appendChild(host);
    }
    const wasOpen=host.classList.contains("open"),
      moreWasOpen=!!host.querySelector(".stip-workspace-more[open]"),
      moreBlock=more.length?'<details class="stip-workspace-more"'+(moreWasOpen?' open':'')+'><summary><span>Autres reprises</span><b>'+more.length+'</b><i aria-hidden="true">⌄</i></summary><div class="stip-workspace-more-list">'+more.map((item,index)=>itemMarkup(item,index+SHOW_ITEMS,true)).join("")+'</div></details>':'';
    host.innerHTML='<button class="stip-workspace-toggle" type="button" aria-expanded="'+wasOpen+'" aria-label="Reprendre un travail récent"><span aria-hidden="true">↩</span><b>'+items.length+'</b></button><section class="stip-workspace-panel" aria-label="Reprendre"><header><span class="stip-workspace-heading-icon" aria-hidden="true">↩</span><div><small>CONTINUITÉ</small><strong>Reprendre</strong><p>Revenez exactement à votre dernier contexte.</p></div></header><div class="stip-workspace-list">'+items.map((item,index)=>itemMarkup(item,index,false)).join("")+'</div>'+moreBlock+'</section>';
    host.classList.toggle("open",wasOpen);
    host.querySelector(".stip-workspace-toggle")?.addEventListener("click",()=>{
      const next=!host.classList.contains("open");
      host.classList.toggle("open",next);
      host.querySelector(".stip-workspace-toggle")?.setAttribute("aria-expanded",String(next));
    });
    host.querySelectorAll("[data-stip-workspace-index]").forEach(button=>button.addEventListener("click",()=>openItem(allItems[Number(button.dataset.stipWorkspaceIndex||0)])));
  }
  function refreshCurrent(){const work=currentWork();if(work)touch(work);else renderLauncher()}
  window.STIPWorkspace={close:closeLauncher,current:currentWork,recent,render:renderLauncher,touch};
  window.addEventListener("stip:route",event=>{const work=routeMeta(event?.detail?.route||"");if(work)touch(work);else renderLauncher()});
  document.addEventListener("click",event=>{const host=document.getElementById("stipWorkspaceLauncher");if(!host?.classList.contains("open")||host.contains(event.target))return;closeLauncher()},true);
  addEventListener("pagehide",()=>{const work=currentWork();if(work)touch({...work,detail:selectedDetail()||work.detail})});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refreshCurrent,{once:true});else refreshCurrent();
})();
