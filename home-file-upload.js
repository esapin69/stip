(()=>{'use strict';
const KEY='file_upload';
const TARGET='https://admin-ghe.esapin.com/depot.html';
const ICON='<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v5h14v-5"/></svg>';
function allowed(){return !!window.STIPBootCache?.permissions?.[KEY]}
function inject(){
  const grid=document.querySelector('#homeView .cp-door-grid');
  if(!grid)return;
  const current=grid.querySelector('[data-cp-module="file_upload"]');
  if(!allowed()){current?.remove();return}
  if(current)return;
  const button=document.createElement('button');
  button.type='button';
  button.className='cp-tool cp-door cp-file_upload';
  button.dataset.cpModule=KEY;
  button.innerHTML=`<span class="cp-tool-icon">${ICON}</span><span class="cp-tool-copy"><strong>Importer des fichiers dans Supabase</strong><small>Fichiers et dossiers</small></span><b>›</b>`;
  button.addEventListener('click',()=>{location.href=TARGET});
  const admin=grid.querySelector('[data-cp-module="admin"]');
  grid.insertBefore(button,admin||null);
}
window.addEventListener('stip:boot-updated',inject);
const start=()=>{
  inject();
  const root=document.getElementById('homeView');
  if(root)new MutationObserver(inject).observe(root,{childList:true,subtree:true});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
