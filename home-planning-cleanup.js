(()=>{'use strict';
function apply(){
  ['team','swap','print'].forEach(key=>{
    document.querySelectorAll(`#homeView [data-hs-app="${key}"]`).forEach(el=>{
      el.hidden=true;
      el.classList.add('hidden');
      el.setAttribute('aria-hidden','true');
    });
  });
}
new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
apply();
})();