(()=>{
'use strict';
const KEY='stip_entry_next_v1',TOKEN='stip_session_v1';
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
function go(){
  const n=pending();
  if(!n||!localStorage.getItem(TOKEN)||sameTarget(n))return false;
  consume();location.replace(n);return true
}
remember();
window.addEventListener('stip:session-ready',()=>go(),{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go,{once:true});else go();
window.STIPEntry={remember,pending,consume,go};
})();