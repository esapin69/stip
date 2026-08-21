(() => {
'use strict';
const ACCESS_API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access';
const STORAGE='stip_session_v1';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const loginView=$('#loginView'),appView=$('#appView'),loginForm=$('#loginForm'),accessCode=$('#accessCode'),loginMessage=$('#loginMessage'),logoutBtn=$('#logoutBtn'),welcomeText=$('#welcomeText'),heroName=$('#heroName'),moduleGrid=$('#moduleGrid'),emptyPermissions=$('#emptyPermissions');
let session=null,lastRestored='';
const modules=[
{key:'planning',num:'01',title:'Planning',small:'Officiel · perso · équipe · changements',route:'planning'},
{key:'equipe_contacts',num:'02',title:'Équipe & contacts',small:'Agents · services · numéros utiles',route:'contacts'},
{key:'procedures',num:'03',title:'Procédures',small:'Consignes et fiches pratiques',route:'generic/procedures'},
{key:'reperes',num:'04',title:'Repères',small:'Sites · secteurs · informations terrain',route:'generic/reperes'},
{key:'outils_equipe',num:'06',title:'Outils équipe',small:'Accès rapides et services utiles',route:'generic/outils'},
{key:'test',num:'07 · LAB',title:'Test',small:'Explorer une nouvelle façon d’utiliser STIP.',href:'test.html'},
{key:'responsable',num:'08',title:'Responsable',small:'Évaluations et outils responsables.',href:'responsable.html'}
];
function token(){return localStorage.getItem(STORAGE)||''}
function canonicalPath(){if(/\/index(?:\.html)?$/i.test(location.pathname)){history.replaceState(null,'','/'+location.search+location.hash)}}
function route(){return location.hash.replace(/^#\/?/,'')||'home'}
function setRoute(next,replace=false){const target='#/'+(next||'home');if(location.hash===target){restoreRoute(true);return}if(replace){history.replaceState(null,'',location.pathname+location.search+target);restoreRoute(true)}else{location.hash=target}}
function showOnly(id){$$('.view').forEach(v=>v.classList.add('hidden'));document.getElementById(id)?.classList.remove('hidden');window.scrollTo({top:0,behavior:'auto'})}
function msg(t='',kind=''){loginMessage.textContent=t;loginMessage.className=`message ${kind}`.trim()}
async function access(action,body={}){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);try{const headers={'Content-Type':'application/json'};if(token())headers['X-STIP-Session']=token();const r=await fetch(ACCESS_API,{method:'POST',headers,body:JSON.stringify({action,...body}),signal:controller.signal});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||`Erreur ${r.status}`);return j}catch(err){if(err?.name==='AbortError')throw new Error('Le serveur ne répond pas. Réessaie.');throw err}finally{clearTimeout(timeout)}}
function personName(a){return window.STIPName?.format?.(a)||String(a?.prenom||a?.nom||'Agent').trim()}
function showLogin(text=''){window.STIPSession=null;window.dispatchEvent(new CustomEvent('stip:session-ended'));appView.classList.add('hidden');loginView.classList.remove('hidden');if(text)msg(text,'error');else msg('');setTimeout(()=>accessCode?.focus(),40)}
function generic(title,html=''){const body=$('#genericBody');$('#genericTitle').textContent=title;$('#genericKicker').textContent='STIP';body.className=html?'workspace':'empty';body.innerHTML=html||'Ce module sera alimenté depuis Admin GHE.';showOnly('genericView')}
function planningHeader(kind){const names={personal:['MON PLANNING','Mes prochains jours'],spirit:['MON ÉQUIPE','Qui travaille ?'],change:['RECHERCHE RAPIDE','Trouver un horaire'],finder:['RECHERCHE RAPIDE','Trouver un horaire']};const n=names[kind]||['MES HORAIRES','Planning'];$('#planningDetailKicker').textContent=n[0];$('#planningDetailTitle').textContent=n[1];showOnly('planningDetailView')}
function replayModule(routeName){const b=[...moduleGrid.querySelectorAll('.module-card')].find(x=>x.dataset.route===routeName);if(!b)return false;b.dataset.replay='1';b.click();delete b.dataset.replay;return true}
function restoreRoute(force=false){if(!session)return;const r=route();if(!force&&lastRestored===r)return;lastRestored=r;if(r==='home'){showOnly('homeView');return}if(r==='planning'){showOnly('planningView');return}if(r==='contacts'){if(!replayModule('contacts'))setTimeout(()=>{lastRestored='';restoreRoute()},60);return}if(r.startsWith('planning/')){const kind=r.split('/')[1];planningHeader(kind);if(kind==='personal'){window.STIPPlanning?.openPersonal?.();return}const btn=document.querySelector(`[data-planning="${kind}"]`);if(btn){btn.click();return}return}if(r==='generic/procedures'){generic('Procédures');return}if(r==='generic/reperes'){generic('Repères');return}if(r==='generic/outils'){generic('Outils équipe');return}setRoute('home',true)}
function openModule(m){if(m.href){window.location.href=m.href;return}setRoute(m.route)}
function renderSession(d){session=d;window.STIPSession=d;loginView.classList.add('hidden');appView.classList.remove('hidden');const a=d.agent||{};welcomeText.textContent=personName(a);if(heroName)heroName.textContent=personName(a);moduleGrid.innerHTML='';const allowed=modules.filter(m=>d.permissions?.[m.key]);emptyPermissions.classList.toggle('hidden',allowed.length>0);for(const m of allowed){const b=document.createElement('button');b.className=`module-card${m.key==='planning'?' primary':''}`;if(m.route)b.dataset.route=m.route;b.innerHTML=`<span class="num">${m.num}</span><strong>${m.title}</strong><small>${m.small}</small>`;b.addEventListener('click',()=>{if(b.dataset.replay==='1')return;openModule(m)});moduleGrid.appendChild(b)}window.dispatchEvent(new CustomEvent('stip:session-ready',{detail:d}));lastRestored='';restoreRoute(true)}
loginForm?.addEventListener('submit',async e=>{e.preventDefault();const code=String(accessCode.value||'').replace(/\D/g,'').slice(0,6);if(code.length!==6){msg('Entre les 6 chiffres.','error');return}const submit=loginForm.querySelector('button[type="submit"]');if(submit)submit.disabled=true;msg('Connexion…');try{const d=await access('login',{code});localStorage.setItem(STORAGE,d.session_token);renderSession(d);msg('')}catch(err){msg(err.message||'Connexion impossible.','error')}finally{if(submit)submit.disabled=false}});
logoutBtn?.addEventListener('click',async()=>{try{await access('logout')}catch{}localStorage.removeItem(STORAGE);session=null;setRoute('home',true);showLogin()});
$('#homeBtn')?.addEventListener('click',()=>setRoute('home'));$$('[data-home]').forEach(b=>b.addEventListener('click',()=>setRoute('home')));
$('#planningBack')?.addEventListener('click',e=>{e.preventDefault();document.getElementById('planningWorkspace').innerHTML='';setRoute('planning')});
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-planning]');if(!b)return;const kind=b.dataset.planning;if(kind==='print')return;setRoute(`planning/${kind}`)},true);
window.addEventListener('hashchange',()=>restoreRoute());window.STIPRouter={set:setRoute,restore:()=>restoreRoute(true),show:showOnly,get:route};
canonicalPath();if(!location.hash)history.replaceState(null,'',location.pathname+location.search+'#/home');
(async()=>{if(!token()){showLogin();return}try{const d=await access('me');renderSession(d)}catch{localStorage.removeItem(STORAGE);showLogin('Reconnecte-toi.')}})();
})();