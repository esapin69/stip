(()=>{'use strict';
const role=()=>window.STIPSession?.role_key||window.STIPBootCache?.role_key||document.documentElement.dataset.stipRole||'';
function isAdmin(){return role()==='admin'}
function icon(){return '<svg viewBox="0 0 24 24"><path d="M4 16l4-5 4 3 5-7 3 2"/><path d="M4 20h16"/></svg>'}
function ensure(){if(!isAdmin())return;const box=document.querySelector('#homeView .hc-apps');if(!box)return;if(!box.querySelector('[data-app="activity"]')){const b=document.createElement('button');b.className='hc-app activity';b.dataset.app='activity';b.innerHTML=`<span>${icon()}</span><strong>Activité</strong>`;b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.href='cadre-activite.html'});const admin=box.querySelector('[data-app="admin"]');if(admin)box.insertBefore(b,admin);else box.appendChild(b)}
}
const st=document.createElement('style');st.textContent='.hc-app.activity>span{background:#ff5a61!important}.hc-app.activity svg{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}';document.head.appendChild(st);
new MutationObserver(()=>requestAnimationFrame(ensure)).observe(document.body,{childList:true,subtree:true});['stip:session-ready','stip:boot-updated','stip:lazy-ready'].forEach(e=>window.addEventListener(e,()=>requestAnimationFrame(ensure)));ensure();
})();