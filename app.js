(() => {
'use strict';
const ACCESS_API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access';
const STORAGE='stip_session_v1';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const loginView=$('#loginView'),appView=$('#appView'),loginForm=$('#loginForm'),accessCode=$('#accessCode'),loginMessage=$('#loginMessage'),logoutBtn=$('#logoutBtn'),welcomeText=$('#welcomeText'),heroName=$('#heroName'),moduleGrid=$('#moduleGrid'),emptyPermissions=$('#emptyPermissions');
let session=null;
const modules=[
 {key:'planning',num:'01',title:'Planning',small:'Officiel · perso · équipe · changements',route:'planning'},
 {key:'equipe_contacts',num:'02',title:'Équipe & contacts',small:'Agents · services · numéros utiles',route:'contacts'},
 {key:'procedures',num:'03',title:'Procédures',small:'Consignes et fiches pratiques',route:'generic/procedures'},
 {key:'reperes',num:'04',title:'Repères',small:'Sites · secteurs · informations terrain',route:'generic/reperes'},
 {key:'nouveaux_arrivants',num:'05',title:'Nouveaux arrivants',small:'Les essentiels pour démarrer',route:'generic/nouveaux'},
 {key:'outils_equipe',num:'06',title:'Outils équipe',small:'Accès rapides et services utiles',route:'generic/outils'}
];
function token(){return localStorage.getItem(STORAGE)||''}
function setHash(route,replace=false){const h=route?'#/'+route:'#/home';if(location.hash===h)return;history[replace?'replaceState':'pushState'](null,'',h)}
function route(){return location.hash.replace(/^#\/?/,'')||'home'}
function showOnly(id){$$('.view').forEach(v=>v.classList.add('hidden'));document.getElementById(id)?.classList.remove('hidden');window.scrollTo({top:0,behavior:'auto'})}
function msg(t='',kind=''){loginMessage.textContent=t;loginMessage.className=`message ${kind}`.trim()}
async function access(action,body={}){const headers={'Content-Type':'application/json'};if(token())headers['X-STIP-Session']=token();const r=await fetch(ACCESS_API,{method:'POST',headers,body:JSON.stringify({action,...body})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||`Erreur ${r.status}`);return j}
function personName(a){return String(a?.prenom||a?.nom||'Agent').replace(/_/g,' ').trim()}
function showLogin(text=''){appView.classList.add('hidden');loginView.classList.remove('hidden');if(text)msg(text,'error');else msg('');setTimeout(()=>accessCode?.focus(),40)}
function generic(title,html=''){const body=$('#genericBody');$('#genericTitle').textContent=title;$('#genericKicker').textContent='STIP';body.className=html?'workspace':'empty';body.innerHTML=html||'Ce module sera alimenté depuis Admin GHE.';showOnly('genericView')}
function planningHeader(kind){const names={personal:['MON PLANNING','Mes prochains jours'],spirit:['MON ÉQUIPE','Qui travaille ?'],change:['RECHERCHE RAPIDE','Trouver un horaire'],finder:['RECHERCHE RAPIDE','Trouver un horaire']};const n=names[kind]||['MES HORAIRES','Planning'];$('#planningDetailKicker').textContent=n[0];$('#planningDetailTitle').textContent=n[1];showOnly('planningDetailView')}
function restoreRoute(){if(!session)return;const r=route();if(r==='home'){showOnly('homeView');return}if(r==='planning'){showOnly('planningView');return}if(r==='contacts'){if(window.STIPContacts?.open)window.STIPContacts.open({fromRoute:true});else setTimeout(restoreRoute,50);return}if(r.startsWith('planning/')){const kind=r.split('/')[1];planningHeader(kind);if(kind==='personal'){window.STIPPlanning?.openPersonal?.();return}const btn=document.querySelector(`[data-planning="${kind}"]`);if(btn){btn.click();return}return}if(r==='generic/procedures'){generic('Procédures');return}if(r==='generic/reperes'){generic('Repères');return}if(r==='generic/nouveaux'){generic('Nouveaux arrivants','<div class="info-box"><strong>Ton parcours d’intégration est déjà prêt.</strong><br>Retrouve les repères, les attendus, les contacts et les étapes de suivi au même endroit.</div><div class="sub-actions"><a class="action-box" href="https://nouvel-agent.esapin.com/" target="_blank" rel="noopener noreferrer">Ouvrir mon parcours d’intégration</a><a class="action-box secondary" href="https://nouvel-agent.esapin.com/suivi.html" target="_blank" rel="noopener noreferrer">Accéder directement à mon suivi</a></div>');return}if(r==='generic/outils'){generic('Outils équipe');return}setHash('home',true);showOnly('homeView')}
function openModule(m){if(m.route==='planning'){setHash('planning');showOnly('planningView');return}if(m.route==='contacts'){setHash('contacts');restoreRoute();return}setHash(m.route);restoreRoute()}
function renderSession(d){session=d;loginView.classList.add('hidden');appView.classList.remove('hidden');const a=d.agent||{};welcomeText.textContent=personName(a);heroName.textContent=personName(a);moduleGrid.innerHTML='';const allowed=modules.filter(m=>d.permissions?.[m.key]);emptyPermissions.classList.toggle('hidden',allowed.length>0);for(const m of allowed){const b=document.createElement('button');b.className=`module-card${m.key==='planning'?' primary':''}`;b.dataset.route=m.route;b.innerHTML=`<span class="num">${m.num}</span><strong>${m.title}</strong><small>${m.small}</small>`;b.addEventListener('click',()=>openModule(m));moduleGrid.appendChild(b)}setTimeout(restoreRoute,0)}
loginForm?.addEventListener('submit',async e=>{e.preventDefault();const code=String(accessCode.value||'').replace(/\D/g,'').slice(0,6);if(code.length!==6){msg('Entre les 6 chiffres.','error');return}msg('Connexion…');try{const d=await access('login',{code});localStorage.setItem(STORAGE,d.session_token);renderSession(d);msg('')}catch(err){msg(err.message||'Connexion impossible.','error')}});
logoutBtn?.addEventListener('click',async()=>{try{await access('logout')}catch{}localStorage.removeItem(STORAGE);history.replaceState(null,'',location.pathname+'#/home');session=null;showLogin()});
$('#homeBtn')?.addEventListener('click',()=>{setHash('home');showOnly('homeView')});
$$('[data-home]').forEach(b=>b.addEventListener('click',()=>{setHash('home');showOnly('homeView')}));
$('#planningBack')?.addEventListener('click',e=>{e.preventDefault();setHash('planning');document.getElementById('planningWorkspace').innerHTML='';showOnly('planningView')});
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-planning]');if(!b)return;const kind=b.dataset.planning;if(kind==='print')return;setHash(`planning/${kind}`);planningHeader(kind)},true);
window.addEventListener('popstate',restoreRoute);window.addEventListener('hashchange',restoreRoute);
window.STIPRouter={set:setHash,restore:restoreRoute,show:showOnly,get:route};
(async()=>{if(!token()){showLogin();return}try{const d=await access('me');renderSession(d)}catch{localStorage.removeItem(STORAGE);showLogin('Reconnecte-toi.')}})();
})();