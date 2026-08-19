(()=>{
'use strict';
document.addEventListener('click',e=>{
  const target=e.target instanceof Element?e.target:null;if(!target)return;
  const main=target.closest('[data-planning="print"]');
  const test=target.closest('.app[data-key="print"]');
  if(!main&&!test)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  location.href='print.html';
},true);
})();
