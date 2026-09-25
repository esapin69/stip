(()=>{
'use strict';
const KEY='stip_entry_next_v1',ROUTE_KEY='stip_route_v1',TOKEN='stip_session_v1';
function safe(v){
  v=String(v||'').trim();
  if(!v||!v.startsWith('/')||v.startsWith('//')||/^[a-z]+:/i.test(v))return'';
  try{const u=new URL(v,location.origin);if(u.origin!==location.origin)return'';return u.pathname+u.search+u.hash}catch{return''}
}
function pending(){return safe(sessionStorage.getItem(KEY)||'')}
function remember(){
  const q=new URLSearchParams(location.search),n=safe(q.get('next'));
  if(n)sessionStorage.setItem(KEY,n);
  return n
}
function consume(){const n=pending();if(n)sessionStorage.removeItem(KEY);return n}
function sameTarget(n){try{const u=new URL(n,location.origin);return u.pathname===location.pathname&&u.search===location.search&&u.hash===location.hash}catch{return false}}
function isReload(){try{return performance.getEntriesByType('navigation')[0]?.type==='reload'}catch{return false}}
function cleanRoute(v){return String(v||'').replace(/^#\/?/,'').replace(/^\/+|\/+$/g,'')||'home'}
function validRoute(r){
  r=cleanRoute(r);
  return ['home','apps','notifications','team','responsable','fauteuils'].includes(r)||
    r==='planning'||r.startsWith('planning/')||
    r==='contacts'||r.startsWith('contacts/');
}
function saveRoute(r){try{r=cleanRoute(r);if(validRoute(r))sessionStorage.setItem(ROUTE_KEY,r);else sessionStorage.removeItem(ROUTE_KEY)}catch{}}
function sanitizeCurrentHash(){
  if(!location.hash)return false;
  const r=cleanRoute(location.hash);
  if(validRoute(r))return false;
  try{sessionStorage.removeItem(ROUTE_KEY)}catch{}
  history.replaceState({...(history.state||{}),stip:true,route:'home',panel:false},'',location.pathname+location.search+'#/home');
  return true;
}
function restoreRoute(){
  if(!isReload()||!localStorage.getItem(TOKEN)||location.hash)return false;
  let r='';try{r=cleanRoute(sessionStorage.getItem(ROUTE_KEY)||'')}catch{}
  if(!r||r==='home'||!validRoute(r)){try{sessionStorage.removeItem(ROUTE_KEY)}catch{}return false}
  history.replaceState({...(history.state||{}),stip:true,route:r,panel:false},'',location.pathname+location.search+'#/'+r);
  return true
}
function forceExplicitEntry(){
  const file=location.pathname.split('/').pop()||'';
  if(!localStorage.getItem(TOKEN)||!(!file||file==='index.html'))return false;
  const u=new URL(location.href);
  if(u.searchParams.has('quick')||u.hash)return false;
  u.searchParams.set('quick','public');
  history.replaceState(history.state,'',u.pathname+u.search);
  return true
}
function go(){
  const n=pending();
  if(!n||!localStorage.getItem(TOKEN)||sameTarget(n))return false;
  consume();location.replace(n);return true
}
function nextWeekdayLabel(target){
  const now=new Date(),day=now.getDay(),delta=((target-day+7)%7)||7,d=new Date(now);
  d.setDate(now.getDate()+delta);
  return new Intl.DateTimeFormat('fr-FR',{weekday:'long'}).format(d);
}
function canSuggestion(key){
  try{return window.STIPAccess?.has?.(key)!==false}catch{return true}
}
function contextualDialogSuggestions(){
  const now=new Date(),hour=now.getHours(),friday=nextWeekdayLabel(5),tuesday=nextWeekdayLabel(2),items=[];
  if(canSuggestion('planning_personal'))items.push(hour>=17?'Avec qui je travaille demain ?':'Avec qui je travaille aujourd’hui ?');
  if(canSuggestion('change_app'))items.push(`Trouve-moi un échange possible ${tuesday}`);
  if(canSuggestion('planning_personal'))items.push('Quand sont mes prochains congés ?');
  if(canSuggestion('planning_team'))items.push(`Qui est en S ${friday} ?`);
  if(canSuggestion('places'))items.push('Où est l’IRM ?');
  if(canSuggestion('contacts'))items.push('Trouve les coordonnées d’un collègue');
  return [...new Set(items)].slice(0,5)
}
function upgradeDialogWelcome(root=document){
  root.querySelectorAll?.('.ch-bot-welcome:not([data-stip-smart-suggestions])').forEach(card=>{
    const box=card.querySelector('.ch-suggestions');if(!box)return;
    const items=contextualDialogSuggestions();if(!items.length)return;
    box.innerHTML=items.map(text=>'<button type="button">'+text.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))+'</button>').join('');
    card.dataset.stipSmartSuggestions='1';
  })
}
remember();
sanitizeCurrentHash();
restoreRoute();
forceExplicitEntry();
window.addEventListener('stip:route',e=>saveRoute(e.detail?.route||''));
window.addEventListener('stip:session-ended',()=>{try{sessionStorage.removeItem(ROUTE_KEY)}catch{}});
window.addEventListener('stip:login-success',()=>go(),{once:true});
const dialogSuggestionObserver=new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)upgradeDialogWelcome(node.matches?.('.ch-bot-welcome')?node:node);
});
if(document.documentElement)dialogSuggestionObserver.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>upgradeDialogWelcome(),{once:true});else upgradeDialogWelcome();
window.STIPEntry={remember,pending,consume,go,saveRoute,restoreRoute};
})();
