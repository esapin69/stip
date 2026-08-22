(()=>{'use strict';
function ensure(){
  const card=document.querySelector('#homeView .cp-profile');
  if(!card)return;
  if(card.querySelector('[data-profile-logout]'))return;
  const btn=document.createElement('button');
  btn.type='button';
  btn.dataset.profileLogout='1';
  btn.className='cp-profile-logout';
  btn.textContent='Déconnexion';
  btn.setAttribute('aria-label','Se déconnecter de STIP');
  btn.addEventListener('click',()=>document.getElementById('logoutBtn')?.click());
  card.appendChild(btn);
}
new MutationObserver(ensure).observe(document.body,{childList:true,subtree:true});
window.addEventListener('stip:session-ready',()=>setTimeout(ensure,20));
window.addEventListener('stip:boot-updated',()=>setTimeout(ensure,20));
setTimeout(ensure,100);
const st=document.createElement('style');
st.textContent=`.cp-profile{position:relative}.cp-profile-logout{grid-column:1/-1;justify-self:end;border:0;background:#edf3f5;color:#315866;border-radius:11px;padding:8px 11px;font:inherit;font-size:.72rem;font-weight:850;cursor:pointer}.cp-profile-logout:active{transform:translateY(1px)}`;
document.head.appendChild(st);
})();