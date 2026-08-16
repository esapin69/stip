(() => {
  'use strict';
  const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access';
  const STORAGE='stip_session_v1';
  const loginView=document.getElementById('loginView');
  const appView=document.getElementById('appView');
  const loginForm=document.getElementById('loginForm');
  const accessCode=document.getElementById('accessCode');
  const loginMessage=document.getElementById('loginMessage');
  const logoutBtn=document.getElementById('logoutBtn');
  const welcomeText=document.getElementById('welcomeText');
  const moduleGrid=document.getElementById('moduleGrid');
  const emptyPermissions=document.getElementById('emptyPermissions');
  const modules=[
    {key:'planning',num:'01',title:'Planning',small:'Jour · Nuit · Chefs',target:'planning'},
    {key:'equipe_contacts',num:'02',title:'Équipe & contacts',small:'Agents · services · numéros utiles',target:'equipe'},
    {key:'procedures',num:'03',title:'Procédures',small:'Consignes et fiches pratiques',target:'procedures'},
    {key:'reperes',num:'04',title:'Repères',small:'Sites · secteurs · informations terrain',target:'reperes'},
    {key:'nouveaux_arrivants',num:'05',title:'Nouveaux arrivants',small:'Les essentiels pour démarrer',target:'arrivants'},
    {key:'outils_equipe',num:'06',title:'Outils équipe',small:'Accès rapides et services utiles',target:'outils'}
  ];
  function message(text='',kind=''){loginMessage.textContent=text;loginMessage.className=`message ${kind}`.trim()}
  async function api(action,body={},token=''){
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-STIP-Session':token}:{})},body:JSON.stringify({action,...body})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw new Error(j.error||`Erreur ${r.status}`);
    return j;
  }
  function currentToken(){return localStorage.getItem(STORAGE)||''}
  function showLogin(text=''){
    appView.classList.add('hidden');loginView.classList.remove('hidden');
    if(text)message(text,'error');else message('');
    setTimeout(()=>accessCode.focus(),50);
  }
  function renderSession(data){
    loginView.classList.add('hidden');appView.classList.remove('hidden');
    const agent=data.agent||{};
    const name=agent.nom||agent.prenom||'Agent';
    welcomeText.textContent=`Connecté : ${name}`;
    moduleGrid.innerHTML='';
    document.querySelectorAll('#appView .panel[id]').forEach(p=>p.classList.add('hidden'));
    const allowed=modules.filter(m=>data.permissions?.[m.key]);
    emptyPermissions.classList.toggle('hidden',allowed.length>0);
    for(const m of allowed){
      const a=document.createElement('a');a.className=`card${m.key==='planning'?' primary':''}`;a.href=`#${m.target}`;
      a.innerHTML=`<span class="num">${m.num}</span><strong>${m.title}</strong><small>${m.small}</small>`;
      a.addEventListener('click',()=>document.getElementById(m.target)?.classList.remove('hidden'));
      moduleGrid.appendChild(a);
    }
  }
  loginForm.addEventListener('submit',async e=>{
    e.preventDefault();const code=accessCode.value.replace(/\D/g,'').slice(0,6);accessCode.value=code;
    if(code.length!==6)return message('Le code doit contenir 6 chiffres.','error');
    message('Connexion…');
    try{const data=await api('login',{code});localStorage.setItem(STORAGE,data.session_token);accessCode.value='';message('');renderSession(data)}
    catch(err){message(err.message||'Connexion impossible.','error')}
  });
  accessCode.addEventListener('input',()=>{accessCode.value=accessCode.value.replace(/\D/g,'').slice(0,6)});
  logoutBtn.addEventListener('click',async()=>{const token=currentToken();try{if(token)await api('logout',{},token)}catch{}localStorage.removeItem(STORAGE);showLogin()});
  (async()=>{const token=currentToken();if(!token)return showLogin();try{renderSession(await api('me',{},token))}catch{localStorage.removeItem(STORAGE);showLogin('Session expirée. Entre de nouveau ton code.')}})();
})();
