(()=>{'use strict';
function ensure(){
  const head=document.querySelector('#homeView .cp-head');
  const bell=document.querySelector('#homeView #cpBell');
  if(!head||!bell)return;
  document.querySelector('#homeView .cp-profile [data-profile-logout]')?.remove();
  if(head.querySelector('[data-profile-logout]'))return;
  let actions=head.querySelector('.cp-head-actions');
  if(!actions){actions=document.createElement('div');actions.className='cp-head-actions';bell.before(actions);actions.appendChild(bell)}
  const btn=document.createElement('button');btn.type='button';btn.dataset.profileLogout='1';btn.className='cp-head-logout';btn.textContent='↪';btn.title='Déconnexion';btn.setAttribute('aria-label','Se déconnecter de STIP');btn.addEventListener('click',()=>document.getElementById('logoutBtn')?.click());actions.appendChild(btn);
}
new MutationObserver(ensure).observe(document.querySelector('#homeView')||document.body,{childList:true,subtree:true});window.addEventListener('stip:session-ready',()=>setTimeout(ensure,20));window.addEventListener('stip:boot-updated',()=>setTimeout(ensure,20));setTimeout(ensure,100);
const st=document.createElement('style');st.textContent=`.cp-head-actions{display:flex;align-items:center;gap:7px;flex:0 0 auto}.cp-head-logout{width:52px;height:52px;border:1px solid rgba(220,235,237,.8);border-radius:16px;background:#fff;color:#315866;display:grid;place-items:center;box-shadow:var(--cp-shadow);font-size:1.35rem;font-weight:900;padding:0}.cp-head-logout:active{transform:translateY(1px)}`;document.head.appendChild(st);
})();