(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const SPECS=[
 {root:'.ph-shell',head:'.ph-head',carousel:'.ph-carousel',dots:'.ph-dots'},
 {root:'.rhub-shell',head:'.rhub-head',carousel:'.rhub-carousel',dots:'.rhub-dots'},
 {root:'.resp-home',head:'.resp-head',carousel:'.resp-carousel',dots:'.resp-dots'}
];
function installOne(root,spec){if(!root||root.dataset.foldReady==='1')return;const head=$(spec.head,root),car=$(spec.carousel,root);if(!head||!car)return;root.dataset.foldReady='1';root.classList.add('stip-fold-root');const b=document.createElement('button');b.type='button';b.className='stip-fold-toggle';b.setAttribute('aria-label','Replier le carrousel');b.setAttribute('aria-expanded','true');b.innerHTML='<span aria-hidden="true">⌃</span>';head.appendChild(b);b.addEventListener('click',()=>{const collapsed=root.classList.toggle('stip-carousel-collapsed');const open=!collapsed;b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'Replier le carrousel':'Déplier le carrousel');b.querySelector('span').textContent=open?'⌃':'⌄'});}
function install(){for(const spec of SPECS)$$(spec.root).forEach(r=>installOne(r,spec))}
new MutationObserver(install).observe(document.documentElement,{subtree:true,childList:true});install();
const s=document.createElement('style');s.textContent=`
.stip-fold-root .ph-head,.stip-fold-root .rhub-head,.stip-fold-root.resp-home .resp-head{position:relative}
.stip-fold-toggle{margin-left:auto;flex:0 0 auto;width:38px;height:38px;border:0;border-radius:12px;background:#eef6f8;color:#164a5c;display:grid;place-items:center;font-size:1.15rem;font-weight:900;box-shadow:0 5px 14px rgba(18,72,88,.08)}
.stip-fold-root .ph-carousel,.stip-fold-root .rhub-carousel,.stip-fold-root.resp-home .resp-carousel{transition:max-height .22s ease,opacity .18s ease,margin .22s ease,padding .22s ease;max-height:900px;opacity:1}
.stip-fold-root .ph-dots,.stip-fold-root .rhub-dots,.stip-fold-root.resp-home .resp-dots{transition:max-height .18s ease,opacity .15s ease,padding .18s ease;max-height:60px;opacity:1}
.stip-carousel-collapsed .ph-carousel,.stip-carousel-collapsed .rhub-carousel,.stip-carousel-collapsed.resp-home .resp-carousel{max-height:0!important;opacity:0!important;overflow:hidden!important;padding-top:0!important;padding-bottom:0!important;margin-top:0!important;margin-bottom:0!important;pointer-events:none}
.stip-carousel-collapsed .ph-dots,.stip-carousel-collapsed .rhub-dots,.stip-carousel-collapsed.resp-home .resp-dots{max-height:0!important;opacity:0!important;padding-top:0!important;padding-bottom:0!important;overflow:hidden!important}
.ph-carousel button,.rhub-carousel button,.resp-carousel button,.ph-carousel select,.rhub-carousel input,.rhub-carousel a{pointer-events:auto!important}

/* Accueil : vraies icônes d'applications, 3 par ligne sur téléphone. */
@media(max-width:600px){
 .hs-apps{grid-template-columns:repeat(3,minmax(0,1fr))!important;column-gap:12px!important;row-gap:18px!important}
 .hs-icon{width:72px!important;height:72px!important;min-width:72px!important;min-height:72px!important;border-radius:18px!important}
 .hs-label{font-size:.68rem!important;max-width:96px!important;line-height:1.15!important;text-align:center!important}
 .hs-app{min-width:0!important}
}
@media(max-width:360px){.hs-icon{width:66px!important;height:66px!important;min-width:66px!important;min-height:66px!important}.hs-apps{column-gap:6px!important}}

/* Pages internes : accès rapides compacts, pas une deuxième page d'accueil. */
.ph-apps,.rhub-apps,.resp-apps{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin-top:10px!important;align-items:stretch!important}
.ph-app,.rhub-app,.resp-app{box-sizing:border-box!important;min-width:0!important;min-height:58px!important;padding:8px 10px!important;border:1px solid #d8e8ec!important;border-radius:16px!important;background:rgba(255,255,255,.94)!important;color:#123444!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;text-align:left!important;opacity:1!important;box-shadow:0 5px 14px rgba(18,72,88,.06)!important;transition:transform .12s ease,border-color .12s ease,background .12s ease,box-shadow .12s ease!important}
.ph-app:active,.rhub-app:active,.resp-app:active{transform:scale(.985)!important}
.ph-app.selected,.rhub-app.selected,.resp-app.selected{border-color:#7bc9d7!important;background:#f0fbfd!important;box-shadow:0 7px 18px rgba(7,152,181,.10)!important}
.ph-icon,.rhub-icon,.resp-icon{flex:0 0 40px!important;width:40px!important;height:40px!important;min-width:40px!important;min-height:40px!important;border-radius:11px!important;display:grid!important;place-items:center!important;box-shadow:none!important;outline:none!important}
.ph-app.selected .ph-icon,.rhub-app.selected .rhub-icon,.resp-app.selected .resp-icon{outline:none!important}
.ph-icon svg,.rhub-icon svg,.resp-icon svg{width:22px!important;height:22px!important}
.ph-app strong,.rhub-app strong,.resp-label{display:block!important;min-width:0!important;width:auto!important;max-width:none!important;margin:0!important;font-size:.72rem!important;font-weight:850!important;line-height:1.2!important;text-align:left!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;color:#123444!important}
@media(max-width:360px){
 .ph-apps,.rhub-apps,.resp-apps{gap:8px!important}
 .ph-app,.rhub-app,.resp-app{min-height:54px!important;padding:7px 8px!important;gap:8px!important}
 .ph-icon,.rhub-icon,.resp-icon{flex-basis:36px!important;width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important}
 .ph-app strong,.rhub-app strong,.resp-label{font-size:.66rem!important}
}
@media(min-width:700px){
 .ph-apps,.rhub-apps,.resp-apps{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important}
 .ph-app,.rhub-app,.resp-app{min-height:64px!important;padding:9px 12px!important}
 .ph-icon,.rhub-icon,.resp-icon{flex-basis:44px!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important}
 .ph-app strong,.rhub-app strong,.resp-label{font-size:.78rem!important}
}
@media(min-width:1050px){.ph-apps,.rhub-apps,.resp-apps{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
`;
document.head.appendChild(s);
})();