(() => {
  'use strict';
  const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access';
  const STORAGE='stip_session_v1';
  const PLANNING_BASE='https://planning.esapin.com';
  const loginView=document.getElementById('loginView');
  const appView=document.getElementById('appView');
  const loginForm=document.getElementById('loginForm');
  const accessCode=document.getElementById('accessCode');
  const loginMessage=document.getElementById('loginMessage');
  const logoutBtn=document.getElementById('logoutBtn');
  const welcomeText=document.getElementById('welcomeText');
  const moduleGrid=document.getElementById('moduleGrid');
  const emptyPermissions=document.getElementById('emptyPermissions');
  const planningActions=document.getElementById('planningActions');
  const modules=[
    {key:'planning',num:'01',title:'Planning',small:'Officiel · personnel · impression · équipe',target:'planning'},
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
  function planningType(agent){
    const e=String(agent.equipe||agent.type_planning||'').toLowerCase();
    if(e.includes('nuit'))return'nuit';
    if(e.includes('chef'))return'chef';
    return'jour';
  }
  function agentKey(agent){
    return String(agent.source_key||agent.agent_key||'').trim().toUpperCase();
  }
  function renderPlanningActions(agent){
    if(!planningActions)return;
    const key=agentKey(agent);
    const type=planningType(agent);
    const encoded=encodeURIComponent(key);
    const actions=[
      {icon:'▦',title:'Planning officiel',small:'Voir le planning collectif de mon équipe',href:`${PLANNING_BASE}/mois.html?type=${type}`},
      {icon:'◎',title:'Planning perso',small:'Voir mon planning individuel',href:key?`${PLANNING_BASE}/apercu.html?type=agent&agent=${encoded}`:`${PLANNING_BASE}/`},
      {icon:'▣',title:'Imprimer mon planning',small:'Ouvrir la version prévue pour impression',href:key?`${PLANNING_BASE}/mois.html?type=agent&agent=${encoded}`:`${PLANNING_BASE}/`},
      {icon:'♟',title:'Esprit d’équipe',small:'Vue collective, formations et stagiaires',href:`${PLANNING_BASE}/esprit-equipe.html`}
    ];
    planningActions.innerHTML=actions.map(a=>`<a class="planning-link" href="${a.href}"><span class="icon">${a.icon}</span><span><strong>${a.title}</strong><small>${a.small}</small></span><span class="arrow">›</span></a>`).join('');
  }
  function renderSession(data){
    loginView.classList.add('hidden');appView.classList.remove('hidden');
    const agent=data.agent||{};
    const name=agent.prenom||agent.nom||'Agent';
    welcomeText.textContent=`Connecté : ${name}`;
    moduleGrid.innerHTML='';
    document.querySelectorAll('#appView .document-section[id]').forEach(p=>p.classList.add('hidden'));
    renderPlanningActions(agent);
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
  async function refreshSession(){const token=currentToken();if(!token)return;try{renderSession(await api('me',{},token))}catch{localStorage.removeItem(STORAGE);showLogin('Ton accès a été modifié ou ta session a expiré.')}}
  (async()=>{const token=currentToken();if(!token)return showLogin();try{renderSession(await api('me',{},token));setInterval(refreshSession,300000)}catch{localStorage.removeItem(STORAGE);showLogin('Session expirée. Entre de nouveau ton code.')}})();
})();
