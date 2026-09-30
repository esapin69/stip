(()=>{
"use strict";
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-change";
const PREFIX="stip_ghe_leave_cart_v1_",KINDS=["CP","RTT","AUTRE"];
let agent="",items=[],selecting=false,open=false,sending=false,error="",root=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dayName=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"long"});
const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||""))&&Number.isFinite(Date.parse(d+"T12:00:00Z"))&&new Date(d+"T12:00:00Z").toISOString().slice(0,10)===d;
function storedState(id){
 const key=PREFIX+id;
 try{
  const persistent=localStorage.getItem(key);
  if(persistent)return {raw:persistent,source:"local"};
 }catch{}
 try{
  const session=sessionStorage.getItem(key);
  if(session)return {raw:session,source:"session"};
 }catch{}
 return {raw:"",source:""};
}
function save(){
 if(!agent)return;
 const key=PREFIX+agent,state=JSON.stringify({items,selecting,open});
 try{
  if(items.length)localStorage.setItem(key,state);else localStorage.removeItem(key);
  try{sessionStorage.removeItem(key)}catch{}
  return;
 }catch{}
 try{
  if(items.length)sessionStorage.setItem(key,state);else sessionStorage.removeItem(key);
 }catch{}
}
function load(){
 const id=String(window.STIPSession?.agent?.id||"");
 if(!id){agent="";items=[];selecting=false;open=false;return false}
 if(id===agent)return true;
 agent=id;items=[];selecting=false;open=false;
 try{
  const stored=storedState(id),state=JSON.parse(stored.raw||"null"),seen=new Set();
  items=(Array.isArray(state?.items)?state.items:[])
   .filter(x=>{if(!valid(x.date)||seen.has(x.date))return false;seen.add(x.date);return true})
   .slice(0,45).map(x=>({date:x.date,code:String(x.code||"").slice(0,24),
    kind:KINDS.includes(x.kind)?x.kind:"CP"})).sort((a,b)=>a.date.localeCompare(b.date));
  selecting=!!items.length&&state?.selecting!==false;
  open=!!items.length&&state?.open!==false;
  if(items.length&&stored.source==="session")save();
 }catch{}
 return true;
}
function visible(){
 const r=String(window.STIPRouter?.get?.()||"home");
 return r==="home"||r==="planning"||r.startsWith("planning/");
}
function ensure(){
 if(root?.isConnected)return root;
 root=document.createElement("aside");root.id="stipLeaveCart";root.className="lc-root";
 root.setAttribute("aria-label","Panier de congés");document.body.append(root);
 root.addEventListener("click",handleClick);root.addEventListener("change",handleChange);
 return root;
}
function toast(message,isError=false){
 let node=$("#lcToast");
 if(!node){node=document.createElement("div");node.id="lcToast";node.className="lc-toast";node.setAttribute("role","status");document.body.append(node)}
 node.textContent=message;node.classList.toggle("bad",isError);node.classList.add("visible");
 clearTimeout(node.timer);node.timer=setTimeout(()=>node.classList.remove("visible"),3600);
}
function row(x){
 return '<article class="lc-item"><div class="lc-date"><b>'+esc(dayName(x.date))+
  '</b><small>'+esc(x.code||"Planning à confirmer")+'</small></div>'+
  '<label>Type<select data-lc-kind="'+esc(x.date)+'" aria-label="Congé du '+esc(dayName(x.date))+'">'+
  KINDS.map(k=>'<option value="'+k+'"'+(k===x.kind?' selected':'')+'>'+(k==="AUTRE"?"Autre":k)+'</option>').join("")+
  '</select></label><button type="button" class="lc-remove" data-lc-remove="'+esc(x.date)+'" aria-label="Retirer ce jour">×</button></article>';
}
function markDays(){
 const chosen=new Set(items.map(x=>x.date));
 const nodes=document.querySelectorAll("#homeView [data-home-day],#homeView [data-cal-day],#planningView .ph-day-cell");
 nodes.forEach(node=>{
  const iso=String(node.dataset.homeDay||node.dataset.calDay||node.dataset.phDate||"").slice(0,10);
  node.classList.toggle("is-lc-selected",chosen.has(iso));
  if(chosen.has(iso))node.dataset.lcSelected="1";else delete node.dataset.lcSelected;
 });
}
function render(){
 if(!load()||!items.length||!visible()){markDays();if(root)root.hidden=true;return}
 markDays();
 const host=ensure();host.hidden=false;
 const n=items.length;
 host.innerHTML=(open?'<section class="lc-panel" aria-label="Demande en cours">'+
  '<header><div><small>DEMANDE EN COURS</small><h2>Mes congés <em>'+n+'</em></h2></div>'+
  '<button type="button" data-lc-close aria-label="Réduire">⌄</button></header>'+
  '<p class="lc-guide">Touche d’autres jours du planning pour compléter ta demande.</p>'+
  '<div class="lc-list">'+items.map(row).join("")+'</div>'+
  '<div class="lc-options"><button type="button" data-lc-mode>'+(selecting?"Pause sélection":"Reprendre la sélection")+
  '</button><button type="button" data-lc-clear>Supprimer la demande</button></div>'+
  (error?'<p class="lc-error" role="alert">'+esc(error)+'</p>':"")+
  '<footer><span>'+n+' jour'+(n>1?'s':'')+' sélectionné'+(n>1?'s':'')+'</span>'+
  '<button type="button" class="lc-send" data-lc-send'+(sending?' disabled':'')+'>'+
  (sending?"Transmission…":"Valider ma demande")+'</button></footer>'+
  '<small class="lc-legal">La demande ne modifie pas le planning : elle reste soumise à validation officielle.</small>'+
  '</section>':"")+
  '<button type="button" class="lc-pill" data-lc-toggle aria-expanded="'+(open?"true":"false")+'">'+
  '<span aria-hidden="true">🏝️</span><strong>Congés</strong><b>'+n+'</b>'+
  '<small>'+(selecting?"Sélection active":"Panier conservé")+'</small><span aria-hidden="true">'+(open?"⌄":"⌃")+'</span></button>';
}
function add(date,code=""){
 if(!load()||!valid(date))return false;
 if(window.STIPSession?.permissions?.day_leave===false){toast("Fonction non autorisée pour cet accès.",true);return false}
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 if(date<today){toast("Choisis une date à venir.",true);return false}
 const exists=items.find(x=>x.date===date),first=!items.length;
 if(!exists){
  if(items.length>=45){toast("45 jours maximum dans une demande.",true);return false}
  items.push({date,code:String(code||"").slice(0,24),kind:"CP"});
  items.sort((a,b)=>a.date.localeCompare(b.date));
 }
 selecting=true;
 if(!exists&&first)open=true;
 error="";save();render();
 if(!exists)toast("Jour ajouté. Touche les autres dates pour les sélectionner.");
 return true;
}
function remove(date){
 const previous=items.length;items=items.filter(x=>x.date!==date);
 if(items.length===previous)return false;
 if(!items.length){selecting=false;open=false;error=""}
 save();render();return true;
}
function toggle(date,code=""){return items.some(x=>x.date===date)?remove(date):add(date,code)}
async function submit(){
 if(sending||!load()||!items.length)return;
 const token=localStorage.getItem("stip_session_v1")||"";
 if(!token){error="Reconnecte-toi pour envoyer la demande.";render();return}
 sending=true;error="";render();
 try{
  const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","X-STIP-Session":token},
   body:JSON.stringify({action:"leave_cart_submit",days:items.map(x=>({date:x.date,kind:x.kind}))})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.error||!j.item?.id)throw Error(typeof j.error==="string"?j.error:"Réponse STIP invalide");
  items=[];selecting=false;open=false;error="";save();
  toast("Demande transmise dans STIP. En attente de traitement.");
  window.dispatchEvent(new CustomEvent("stip:leave-request-created",{detail:{id:j.item.id}}));
 }catch(e){
  error=e?.message==="DEMANDE_DEJA_EN_COURS"?"Certains jours font déjà partie d’une demande en cours.":
    String(e?.message||"Transmission impossible. Tes jours restent enregistrés.");
  toast(error,true);
 }finally{sending=false;render()}
}
function handleClick(event){
 const el=event.target.closest("button");if(!el||sending)return;
 if(el.hasAttribute("data-lc-toggle")){open=!open;save();render()}
 else if(el.hasAttribute("data-lc-close")){open=false;save();render()}
 else if(el.hasAttribute("data-lc-remove"))remove(el.dataset.lcRemove);
 else if(el.hasAttribute("data-lc-mode")){selecting=!selecting;save();render()}
 else if(el.hasAttribute("data-lc-clear")){
  if(window.confirm("Supprimer tous les jours du panier ?")){
   items=[];selecting=false;open=false;error="";save();render()
  }
 }else if(el.hasAttribute("data-lc-send"))void submit();
}
function handleChange(event){
 const select=event.target.closest("select[data-lc-kind]");if(!select)return;
 const item=items.find(x=>x.date===select.dataset.lcKind);
 if(item&&KINDS.includes(select.value)){item.kind=select.value;save();render()}
}
window.STIPLeaveCart={add,toggle,has:d=>(load(),items.some(x=>x.date===d)),
 isSelecting:()=>load()&&selecting&&items.length>0,open:()=>{open=true;save();render()},refresh:render};
window.addEventListener("stip:session-ready",render);
window.addEventListener("stip:session-ended",()=>{
 agent="";items=[];selecting=false;open=false;render()
});
window.addEventListener("stip:route",render);
window.addEventListener("stip:home-rendered",render);
function watchMonth(){
 const month=document.getElementById("planningView");
 if(!month||typeof MutationObserver!=="function")return;
 const watcher=new MutationObserver(()=>requestAnimationFrame(markDays));
 watcher.observe(month,{childList:true,subtree:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",watchMonth,{once:true});else watchMonth();
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render,{once:true});else render();
})();