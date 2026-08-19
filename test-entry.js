(() => {
  'use strict';
  const grid = document.getElementById('moduleGrid');
  const empty = document.getElementById('emptyPermissions');
  if (!grid) return;
  const ACCESS_API = 'https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access';
  const STORAGE = 'stip_session_v1';
  let checking = false;
  async function permissions() {
    const token = localStorage.getItem(STORAGE) || '';
    if (!token) return {};
    try {
      const r = await fetch(ACCESS_API, {method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token},body:JSON.stringify({action:'me'})});
      const j = await r.json().catch(() => ({}));
      return r.ok && !j.error ? (j.permissions || {}) : {};
    } catch { return {}; }
  }
  function addCard(selector, attrs, html, href) {
    if (grid.querySelector(selector)) return;
    const card = document.createElement('button'); card.type='button'; card.className='module-card';
    Object.entries(attrs).forEach(([key,value]) => card.dataset[key]=value);
    card.innerHTML=html; card.addEventListener('click',()=>{window.location.href=href});
    grid.appendChild(card); empty?.classList.add('hidden');
  }
  function removeNewArrivalsCard(){[...grid.querySelectorAll('.module-card')].forEach(card=>{if(card.querySelector('strong')?.textContent.trim()==='Nouveaux arrivants')card.remove()})}
  async function syncExtraCards(){
    if(checking)return; checking=true;
    try{
      removeNewArrivalsCard();
      const p=await permissions();
      const responsable=grid.querySelector('[data-stip-responsable]');
      if(p.responsable){addCard('[data-stip-responsable]',{stipResponsable:'1'},'<span class="num">08</span><strong>Responsable</strong><small>Évaluations et outils responsables.</small>','responsable.html')}else responsable?.remove();
      const test=grid.querySelector('[data-stip-test]');
      if(p.test){addCard('[data-stip-test]',{stipTest:'1'},'<span class="num">07 · LAB</span><strong>Test</strong><small>Explorer une nouvelle façon d’utiliser STIP.</small>','test.html')}else test?.remove();
    } finally {checking=false;}
  }
  new MutationObserver(syncExtraCards).observe(grid,{childList:true}); syncExtraCards();
})();