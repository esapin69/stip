(() => {
"use strict";
if(window.GHEGlobalSearch)return;
let opened=false,panel=null,loaded=false,loading=null,documents=[];
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const drawer=()=>document.getElementById("gheSmartRail");
const mode=()=>window.GHESmartDrawer?.mode?.()||"closed";
const entries=()=>window.GHESmartDrawer?.entries?.()||[];
const apps=()=>window.GHESmartDrawer?.applications?.()||[];
const permissions=()=>({...window.STIPSession?.permissions,...window.STIPContinuity?.read?.()?.permissions});
function sources(){
 const p=permissions(),admin=p.admin===true,found=new Set();
 const items=[
  {title:"Accueil GHE",sub:"Planning, équipe, météo, profil et actions",href:"index.html#/home"},
  {title:"Mes rendez-vous",sub:"Agenda, rendez-vous et dates",href:"ghe-agenda.html"},
  {title:"Événements et covoiturages",sub:"Invitations, loisirs et trajets",href:"sorties-loisirs.html?tab=agenda"},
  {title:"Mon compte",sub:"Compte, paramètres et préférences",href:"mon-compte.html"},
  ...(p.messages||admin?[{title:"Messages et fauteuils",sub:"Discussions et signalements",href:"index.html?quick=communication&tab=dm#/communication/dm"}]:[]),
  ...apps(),
  ...entries().map(item=>({title:item.title,sub:[item.sub,item.date].filter(Boolean).join(" · "),href:item.href||"ghe-agenda.html"})),
  ...(admin?[{title:"Administration",sub:"Gestion de mon espace",href:"access-manage.html"},
    {title:"Tableaux de bord",sub:"Outils et données de service",href:"control.html"}]:[])
 ];
 return items.filter(item=>{if(!item.href)return false;const key=item.href+"|"+item.title;if(found.has(key))return false;found.add(key);return true});
}
function livePage(){
 const root=document.querySelector("#homeView:not(.hidden) .hs-home")||document.querySelector("main");
 if(!root)return [];
 const body=String(root.innerText||root.textContent||"").replace(/\s+/g," ").trim().slice(0,32000);
 return body?[{title:"Contenu de cette page",sub:"Informations actuellement affichées",body,href:location.pathname+location.search+location.hash}]:[];
}
function display(){
 if(!panel||panel.hidden)return;
 const q=norm(panel.querySelector("input")?.value.trim()),out=panel.querySelector("[data-global-results]");
 if(!out)return;
 if(q.length<2){out.innerHTML='<p class="ghe-global-help">Chercher parmi les pages, rendez-vous, personnes, services et outils accessibles du site.</p>';return;}
 const matches=[],seen=new Set();
 for(const item of [...sources(),...livePage(),...documents]){
  const hay=norm([item.title,item.sub,item.body].join(" "));
  const position=hay.indexOf(q);
  if(position<0)continue;
  const key=item.href+"|"+item.title;
  if(seen.has(key))continue;seen.add(key);
  const content=String(item.body||"");
  const offset=norm(content).indexOf(q);
  const snippet=offset<0?item.sub:content.slice(Math.max(0,offset-55),offset+120).replace(/\s+/g," ");
  matches.push('<a class="ghe-global-result" href="'+esc(item.href)+'">'+
   '<strong>'+esc(item.title)+'</strong><small>'+esc(String(snippet||item.sub||"").slice(0,190))+'</small><b aria-hidden="true">›</b></a>');
  if(matches.length>=35)break;
 }
 out.innerHTML=(matches.length?matches.join(""):'<p class="ghe-global-help">Aucun résultat parmi les données indexées.</p>')+
 (loading?'<p class="ghe-global-help">Recherche dans les autres pages…</p>':"");
}
async function indexPages(){
 if(loaded||loading)return loading;
 const hrefs=[...new Set(sources().map(item=>item.href.split("#")[0].split("?")[0]).filter(x=>x.endsWith(".html")))].slice(0,26);
 let next=0;
 loading=(async()=>{
  await Promise.all(Array.from({length:Math.min(hrefs.length,3)},async()=>{
   while(next<hrefs.length){
    const href=hrefs[next++];
    try{
     const response=await fetch(new URL(href,location.href),{credentials:"same-origin",cache:"force-cache"});
     if(!response.ok||!response.headers.get("content-type")?.includes("text/html"))continue;
     const html=await response.text(),doc=new DOMParser().parseFromString(html,"text/html");
     doc.querySelectorAll("script,style,noscript,template,form,svg").forEach(node=>node.remove());
     const main=doc.querySelector("main")||doc.body;
     const body=String(main?.textContent||"").replace(/\s+/g," ").trim().slice(0,35000);
     documents.push({title:doc.title||href,sub:"Page du site GHE",body,href});
     display();
    }catch{/* Ne pas dévoiler ni indexer les pages non disponibles. */}
   }
  }));
  loaded=true;
 })().finally(()=>{loading=null;display()});
 return loading;
}
function ensure(){
 if(panel?.isConnected)return panel;
 panel=document.getElementById("gheSmartGlobalSearch")||document.createElement("section");
 panel.id="gheSmartGlobalSearch";panel.className="ghe-global-search-panel";
 panel.setAttribute("role","search");panel.setAttribute("aria-label","Recherche dans GHE");
 panel.innerHTML='<label for="gheGlobalSearchInput">Recherche dans tout le site</label>'+
  '<div class="ghe-global-field"><input id="gheGlobalSearchInput" type="search" placeholder="Service, collègue, rendez-vous…" autocomplete="off" aria-label="Rechercher dans GHE">'+
  '<button type="button" data-global-close aria-label="Fermer la recherche">×</button></div>'+
  '<div class="ghe-global-results" data-global-results role="region" aria-live="polite"></div>';
 if(!panel.isConnected)document.body.appendChild(panel);
 panel.querySelector("input").addEventListener("input",()=>{
  display();
  if(norm(panel.querySelector("input").value).trim().length>=2)void indexPages();
 });
 panel.querySelector("[data-global-close]").addEventListener("click",()=>{
  if(mode()==="expanded"){panel.querySelector("input").value="";display();panel.querySelector("input").blur();return;}
  opened=false;sync();
 });
 panel.addEventListener("click",event=>{
  if(!event.target.closest(".ghe-global-result"))return;
  opened=false;
  window.GHESmartDrawer?.setMode?.("compact");
  sync();
 });
 return panel;
}
function preserveBeforeRender(){
 const old=document.getElementById("gheSmartGlobalSearch");
 if(old&&old.parentElement!==document.body)document.body.appendChild(old);
}
function sync(focus=false){
 const rail=drawer(),state=mode(),trigger=rail?.querySelector("[data-smart-search-open]");
 if(!rail||!trigger||state==="closed"){
  if(panel)panel.hidden=true;return;
 }
 const box=ensure(),expanded=state==="expanded";
 if(expanded){
  if(box.previousElementSibling!==trigger)trigger.after(box);
 }else if(box.parentElement!==document.body)document.body.appendChild(box);
 box.classList.toggle("is-expanded",expanded);
 box.hidden=!expanded&&!opened;
 trigger.setAttribute("aria-expanded",String(!box.hidden));
 if(!expanded&&opened){
  const rect=trigger.getBoundingClientRect();
  box.style.top=Math.max(8,Math.min(window.innerHeight-145,rect.top))+"px";
 }else box.style.top="";
 if(!box.hidden){display();if(focus)box.querySelector("input")?.focus({preventScroll:true});}
}
function toggle(){
 if(mode()==="expanded"){opened=true;sync(true);return;}
 opened=!opened;sync(opened);
}
document.addEventListener("click",event=>{
 if(panel&&!panel.hidden&&mode()==="compact"&&opened&&!event.target.closest("#gheSmartGlobalSearch,#gheSmartRail [data-smart-search-open]")){
  opened=false;sync();
 }
},false);
window.addEventListener("resize",()=>sync());
window.addEventListener("stip:session-ended",()=>{documents=[];loaded=false;opened=false;if(panel){panel.remove();panel=null;}});
window.GHEGlobalSearch={toggle,sync,preserveBeforeRender};
const start=()=>sync();
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();