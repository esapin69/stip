(()=>{'use strict';
const back=document.getElementById('placesBack');
if(!back)return;
back.addEventListener('click',e=>{
  const search=document.getElementById('placesSearch');
  if(search?.value)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if(history.length>1){history.back();return}
  if(location.hash){location.hash='';return}
  location.assign('index.html');
},true);
})();