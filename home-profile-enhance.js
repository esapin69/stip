(()=>{'use strict';
const $=s=>document.querySelector(s);
function toast(text){let t=document.querySelector('.cp-copy-toast');if(!t){t=document.createElement('div');t.className='cp-copy-toast';document.body.appendChild(t)}t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),1500)}
async function copy(value,label){try{await navigator.clipboard.writeText(value);toast(`${label} copié`)}catch{const ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast(`${label} copié`)}}
function cap(v){v=String(v||'').trim().toLowerCase();return v?v[0].toUpperCase()+v.slice(1):v}
function enhanceHeader(){const head=$('#homeView .cp-head'),b=window.STIPBootCache||{},a=b.agent||{};if(!head)return;const h1=head.querySelector('h1'),p=head.querySelector('p');const name=window.STIPName?.format?.(a)||[a.prenom,a.nom].filter(Boolean).join(' ')||'';const team=String(a.type_planning||a.equipe||'').trim();if(h1&&name)h1.textContent=name;if(p)p.textContent=team?`Équipe ${cap(team)}`:'Mon espace personnel'}
function makeCopyable(x,type){if(!x||x.dataset.copyReady==='1')return;const label=x.querySelector('b')?.textContent.trim()||type,value=x.textContent.replace(label,'').trim();x.tabIndex=0;x.setAttribute('role','button');x.title=`Copier ${label.toLowerCase()}`;x.dataset.copyValue=value;x.dataset.copyReady='1';x.addEventListener('click',()=>copy(value,type));x.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();copy(value,type)}})}
function enhanceProfile(){const p=$('#homeView .cp-profile');if(!p)return;const main=p.querySelector('.cp-profile-main'),details=p.querySelector('.cp-profile-details');if(!details)return;const spans=[...details.querySelectorAll('span')];const ghe=spans.find(x=>x.querySelector('b')?.textContent.trim().toUpperCase()==='GHE');const tel=spans.find(x=>x.querySelector('b')?.textContent.trim().toUpperCase().includes('TÉL'));const mail=spans.find(x=>x.querySelector('b')?.textContent.trim().toUpperCase().includes('MAIL'));
 if(main)main.style.display='none';
 if(ghe){ghe.classList.add('cp-profile-ghe');makeCopyable(ghe,'GHE')}
 if(tel){tel.classList.add('cp-profile-phone');makeCopyable(tel,'Numéro')}
 if(mail){mail.classList.add('cp-profile-email');makeCopyable(mail,'E-mail')}
 const bell=$('#homeView #cpBell');if(bell&&bell.parentElement!==p){bell.classList.add('cp-profile-bell');p.appendChild(bell)}
 p.dataset.enhanced='1'}
function enhance(){enhanceHeader();enhanceProfile()}
let raf=0;function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})}window.addEventListener('stip:boot-updated',schedule);const root=document.getElementById('homeView');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
const st=document.createElement('style');st.textContent=`
#homeView .cp-head{grid-template-columns:minmax(0,1fr) auto!important;align-items:start!important}
#homeView .cp-head h1{font-size:2.05rem!important;line-height:1.02!important;letter-spacing:-.035em!important;margin-top:5px!important;max-width:100%!important}
#homeView .cp-head p{font-size:.86rem!important;font-weight:750!important;color:#6f848c!important;margin-top:7px!important}
#homeView .cp-head>.cp-bell{display:none!important}
#homeView .cp-profile{position:relative!important;display:grid!important;grid-template-columns:96px minmax(0,1fr)!important;min-height:148px!important;padding:10px 13px 10px 10px!important;align-items:stretch!important;overflow:visible!important}
#homeView .cp-profile-avatar{width:92px!important;height:132px!important;border-radius:22px!important;align-self:center!important;overflow:hidden!important;background:transparent!important;display:grid!important;place-items:end center!important}
#homeView .cp-profile-avatar img{width:100%!important;height:100%!important;object-fit:contain!important;object-position:center bottom!important;transform:none!important}
#homeView .cp-profile-details{grid-column:2!important;display:grid!important;grid-template-columns:minmax(92px,.78fr) minmax(124px,1.22fr)!important;grid-template-rows:auto auto!important;gap:8px!important;align-content:end!important;padding-top:34px!important;margin:0!important;min-width:0!important}
#homeView .cp-profile-details span{box-sizing:border-box!important;min-height:50px!important;padding:8px 10px!important;border-radius:13px!important;background:#eef5f7!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-start!important;gap:2px!important;cursor:pointer!important;min-width:0!important}
#homeView .cp-profile-details span b{display:block!important;font-size:.52rem!important;line-height:1!important;text-transform:uppercase!important;letter-spacing:.06em!important;color:#7b9099!important}
#homeView .cp-profile-details .cp-profile-ghe,#homeView .cp-profile-details .cp-profile-phone{font-size:.96rem!important;line-height:1.05!important;font-weight:950!important;color:#153a4a!important;white-space:nowrap!important}
#homeView .cp-profile-details .cp-profile-email{grid-column:1/-1!important;min-height:40px!important;font-size:.66rem!important;line-height:1.15!important;font-weight:850!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
#homeView .cp-profile-details span:active{transform:scale(.98)}
#homeView .cp-profile-bell{position:absolute!important;right:13px!important;top:11px!important;width:48px!important;height:48px!important;display:grid!important;place-items:center!important;border-radius:15px!important;z-index:3!important;margin:0!important}
#homeView .cp-profile-bell>span{position:absolute!important;right:-5px!important;top:-5px!important}
.cp-copy-toast{position:fixed;z-index:99999;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translate(-50%,16px);padding:9px 13px;border-radius:999px;background:#153a4a;color:#fff;font-size:.72rem;font-weight:850;box-shadow:0 8px 24px rgba(0,0,0,.18);opacity:0;pointer-events:none;transition:.18s}.cp-copy-toast.show{opacity:1;transform:translate(-50%,0)}
@media(max-width:370px){#homeView .cp-profile{grid-template-columns:84px minmax(0,1fr)!important;padding-left:8px!important}.cp-profile-avatar{width:80px!important;height:126px!important}.cp-profile-details{grid-template-columns:minmax(78px,.72fr) minmax(110px,1.28fr)!important;gap:6px!important}.cp-profile-details .cp-profile-ghe,.cp-profile-details .cp-profile-phone{font-size:.85rem!important}.cp-profile-details .cp-profile-email{font-size:.6rem!important}.cp-profile-bell{width:44px!important;height:44px!important}}
`;document.head.appendChild(st);schedule();
})();