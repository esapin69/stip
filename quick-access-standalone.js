(()=>{'use strict';
const SESSION='stip_session_v1',USAGE='stip_app_usage_v1';
if(!localStorage.getItem(SESSION))return;
const CURRENT=(document.body?.dataset?.stipApp||'places').trim();
const META={personal:{label:'Planning perso',href:'index.html?quick=personal'},team:{label:'Planning équipe',href:'index.html?quick=team'},change:{label:'Changement',href:'index.html?quick=change'},calendar:{label:'Mon agenda',href:'index.html?quick=calendar'},contacts:{label:'Contacts',href:'index.html?quick=contacts'},places:{label:'Visiter les lieux',href:'places-app.html'},responsable:{label:'Responsable',href:'responsable.html'},assistant:{label:'Assistant STIP',href:'assistant.html'},cadre:{label:'Espace Cadre',href:'cadre.html'},equipe:{label:'Équipe',href:'equipe.html'}};
function read(){try{return JSON.parse(localStorage.getItem(USAGE)||'{}')||{}}catch{return{}}}
function write(v){try{localStorage.setItem(USAGE,JSON.stringify(v))}catch{}}
function touch(key){if(!META[key])return;const now=Date.now(),u=read(),apps=u.apps||{},prev=Number(u.at||now),days=Math.max(0,(now-prev)/86400000),decay=Math.pow(.985,days);Object.keys(apps).forEach(k=>apps[k]=Math.max(0,Number(apps[k]||0)*decay));apps[key]=Number(apps[key]||0)+1;write({at:now,last:key,apps})}
function last(){const k=read().last||'';return META[k]?k:''}
if(META[CURRENT])touch(CURRENT);
const n=document.createElement('nav');n.id='stipQuickSwitch';n.className='stip-quick-switch';n.setAttribute('aria-label','Accès rapides STIP');const lst=CURRENT||last();n.innerHTML=`<a href="index.html?quick=public" aria-label="Accueil STIP"><span class="qs-icon">⌂</span></a><a href="index.html?quick=profile" aria-label="Ma fiche"><span class="qs-icon">◉</span></a><a ${lst&&META[lst]?`href="${META[lst].href}"`:'aria-disabled="true"'} aria-label="Accueil de la dernière application"><span class="qs-icon">↶</span></a>`;document.body.appendChild(n);document.body.classList.add('stip-quick-connected');
})();