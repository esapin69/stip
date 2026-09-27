(()=>{'use strict';
function load(tag,attrs){const el=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>el[k]=v);document.head.appendChild(el);return el}
load('link',{rel:'stylesheet',href:'/t-est/regles-communes/form-engine-v2.css?v=20260927-stepflow2'});
const legacy=load('script',{src:'/public-access-request-legacy.js?v=20260927-pin-contract1',async:false});
legacy.addEventListener('load',()=>load('script',{src:'/t-est/regles-communes/form-engine-v2.js?v=20260927-stepflow2',async:false}),{once:true});
})();