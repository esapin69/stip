(()=>{
'use strict';
const KEY='stip_entry_next_v1',ROUTE_KEY='stip_route_v1',TOKEN='stip_session_v1';
function safe(v){
  v=String(v||'').trim();
  if(!v||!v.startsWith('/')||v.startsWith('//')||/^[a-z]+:/i.test(v))return'';
  try{const u=new URL(v,location.origin);if(u.origin!==location.origin)return'';return u.pathname+u.search+u.hash}catch{return''}
}
function pending(){return safe(sessionStorage.getItem(KEY)||'')}
function remember(){const q=new URLSearchParams(location.search),n=safe(q.get('next'));if(n)sessionStorage.setItem(KEY,n);return n}
function consume(){const n=pending();if(n)sessionStorage.removeItem(KEY);return n}
function sameTarget(n){try{const u=new URL(n,location.origin);return u.pathname===location.pathname&&u.search===location.search&&u.hash===location.hash}catch{return false}}
function isReload(){try{return performance.getEntriesByType('navigation')[0]?.type==='reload'}catch{return false}}
function cleanRoute(v){return String(v||'').replace(/^#\/?/,'').replace(/^\/+|\/+$/g,'')||'home'}
function validRoute(r){r=cleanRoute(r);return ['home','apps','notifications','fauteuils'].includes(r)||r==='planning'||r.startsWith('planning/')||r==='contacts'||r.startsWith('contacts/')}
function saveRoute(r){try{r=cleanRoute(r);if(validRoute(r))sessionStorage.setItem(ROUTE_KEY,r);else sessionStorage.removeItem(ROUTE_KEY)}catch{}}
function migrateLegacyStandaloneHash(){if(!location.hash||!localStorage.getItem(TOKEN))return false;const r=cleanRoute(location.hash);if(r==='team'){location.replace('esprit-equipe.html?entry=legacy-hash');return true}if(r==='responsable'){location.replace('responsable.html?entry=legacy-hash');return true}return false}
function sanitizeCurrentHash(){if(!location.hash)return false;const r=cleanRoute(location.hash);if(validRoute(r))return false;try{sessionStorage.removeItem(ROUTE_KEY)}catch{}history.replaceState({...(history.state||{}),stip:true,route:'home',panel:false},'',location.pathname+location.search+'#/home');return true}
function restoreRoute(){if(!isReload()||!localStorage.getItem(TOKEN)||location.hash)return false;let r='';try{r=cleanRoute(sessionStorage.getItem(ROUTE_KEY)||'')}catch{}if(!r||r==='home'||!validRoute(r)){try{sessionStorage.removeItem(ROUTE_KEY)}catch{}return false}history.replaceState({...(history.state||{}),stip:true,route:r,panel:false},'',location.pathname+location.search+'#/'+r);return true}
function forceExplicitEntry(){const file=location.pathname.split('/').pop()||'';if(!localStorage.getItem(TOKEN)||!(!file||file==='index.html'))return false;const u=new URL(location.href);if(u.searchParams.has('quick')||u.hash)return false;u.searchParams.set('quick','public');history.replaceState(history.state,'',u.pathname+u.search);return true}
function go(){const n=pending();if(!n||!localStorage.getItem(TOKEN)||sameTarget(n))return false;consume();location.replace(n);return true}
function canSuggestion(key){try{return window.STIPAccess?.has?.(key)!==false}catch{return true}}
function intentSuggestions(){
  const items=[];
  if(canSuggestion('planning_personal'))items.push(['Avec qui je travaille ?','Avec qui je travaille ?']);
  if(canSuggestion('change_app'))items.push(['Trouver un échange','Je veux trouver un échange']);
  if(canSuggestion('planning_personal'))items.push(['Mes prochains congés','Quand sont mes prochains congés ?']);
  if(canSuggestion('planning_team'))items.push(['Voir l’équipe présente','Qui travaille ce jour-là ?']);
  if(canSuggestion('places'))items.push(['Trouver un lieu','Je cherche un lieu']);
  if(canSuggestion('contacts'))items.push(['Trouver un collègue','Je cherche un collègue']);
  return items.slice(0,5)
}
function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function submitSuggestion(button){
  const prompt=String(button.dataset.stipPrompt||button.textContent||'').trim();if(!prompt)return;
  const dialog=button.closest('.ch-dialog'),form=dialog?.querySelector('.ch-dialog-form'),input=form?.querySelector('input[name="q"]');
  if(!form||!input)return;
  input.value=prompt;
  if(typeof form.requestSubmit==='function')form.requestSubmit();else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
}
function upgradeDialogWelcome(root=document){
  const cards=[];
  if(root.matches?.('.ch-bot-welcome'))cards.push(root);
  root.querySelectorAll?.('.ch-bot-welcome:not([data-stip-intent-suggestions])').forEach(card=>cards.push(card));
  [...new Set(cards)].forEach(card=>{
    if(card.dataset.stipIntentSuggestions==='1')return;
    const box=card.querySelector('.ch-suggestions');if(!box)return;
    const items=intentSuggestions();if(!items.length)return;
    box.innerHTML=items.map(([label,prompt])=>'<button type="button" data-stip-intent="1" data-stip-prompt="'+esc(prompt)+'">'+esc(label)+'</button>').join('');
    box.querySelectorAll('[data-stip-intent]').forEach(button=>button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();submitSuggestion(button)}));
    card.dataset.stipIntentSuggestions='1';
  })
}
remember();if(migrateLegacyStandaloneHash())return;sanitizeCurrentHash();restoreRoute();forceExplicitEntry();
window.addEventListener('stip:route',e=>saveRoute(e.detail?.route||''));
window.addEventListener('stip:session-ended',()=>{try{sessionStorage.removeItem(ROUTE_KEY)}catch{}});
window.addEventListener('stip:login-success',()=>go(),{once:true});
const dialogSuggestionObserver=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)upgradeDialogWelcome(node)});
if(document.documentElement)dialogSuggestionObserver.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>upgradeDialogWelcome(),{once:true});else upgradeDialogWelcome();
window.STIPEntry={remember,pending,consume,go,saveRoute,restoreRoute};
})();
