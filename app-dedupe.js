(()=>{'use strict';
const CONTAINERS='.hc-apps,.cadre-apps,.resp-apps';
function normUrl(raw){try{const u=new URL(raw,location.href);u.hash='';u.search='';return `${u.origin}${u.pathname.replace(/\/+$/,'')||'/'}`.toLowerCase()}catch{return String(raw||'').trim().toLowerCase()}}
function target(el){if(el.matches('a[href]'))return `url:${normUrl(el.getAttribute('href'))}`;if(el.dataset.app)return `app:${el.dataset.app}`;if(el.dataset.openPanel)return `panel:${el.dataset.openPanel}`;if(el.dataset.respSelect)return `resp:select:${el.dataset.respSelect}`;if(el.hasAttribute('data-resp-agents'))return `resp:agents:${el.getAttribute('data-resp-agents')||'default'}`;if(el.hasAttribute('data-resp-agenda'))return 'resp:agenda';if(el.hasAttribute('data-resp-official'))return 'resp:official';return''}
function dedupe(box){const seen=new Set();for(const el of [...box.children]){if(!el.matches('a,button'))continue;const k=target(el);if(!k)continue;if(seen.has(k)){el.remove();continue}seen.add(k)}}
function run(){document.querySelectorAll(CONTAINERS).forEach(dedupe)}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;run()})}
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});['DOMContentLoaded','stip:session-ready','stip:boot-updated','stip:lazy-ready','stip:route'].forEach(e=>window.addEventListener(e,queue));run();
window.STIPAppDedupe={run};
})();