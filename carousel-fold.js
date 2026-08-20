(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const SPECS=[
 {root:'.ph-shell',head:'.ph-head',carousel:'.ph-carousel',dots:'.ph-dots'},
 {root:'.rhub-shell',head:'.rhub-head',carousel:'.rhub-carousel',dots:'.rhub-dots'},
 {root:'.resp-home',head:'.resp-head',carousel:'.resp-carousel',dots:'.resp-dots'}
];
function installOne(root,spec){if(!root||root.dataset.foldReady==='1')return;const head=$(spec.head,root),car=$(spec.carousel,root);if(!head||!car)return;root.dataset.foldReady='1';root.classList.add('stip-fold-root');const b=document.createElement('button');b.type='button';b.className='stip-fold-toggle';b.setAttribute('aria-label','Replier le carrousel');b.setAttribute('aria-expanded','true');b.innerHTML='<span aria-hidden="true">⌃</span>';head.appendChild(b);b.addEventListener('click',()=>{const collapsed=root.classList.toggle('stip-carousel-collapsed');const open=!collapsed;b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'Replier le carrousel':'Déplier le carrousel');b.querySelector('span').textContent=open?'⌃':'⌄'});
}
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
@media(max-width:600px){
 .hs-apps,.ph-apps,.rhub-apps,.resp-apps{grid-template-columns:repeat(3,minmax(0,1fr))!important;column-gap:12px!important;row-gap:18px!important}
 .hs-icon,.ph-icon,.rhub-icon,.resp-icon{width:72px!important;height:72px!important;min-width:72px!important;min-height:72px!important;border-radius:18px!important}
 .hs-label,.ph-app strong,.rhub-app strong,.resp-label{font-size:.68rem!important;max-width:96px!important;line-height:1.15!important;text-align:center!important}
 .hs-app,.ph-app,.rhub-app,.resp-app{min-width:0!important}
}
@media(max-width:360px){
 .hs-icon,.ph-icon,.rhub-icon,.resp-icon{width:66px!important;height:66px!important;min-width:66px!important;min-height:66px!important}
 .hs-apps,.ph-apps,.rhub-apps,.resp-apps{column-gap:6px!important}
}
`;
document.head.appendChild(s);
})();