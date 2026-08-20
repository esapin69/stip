(() => {
  'use strict';

  function startOfCurrentWeekISO(){
    const now=new Date();
    now.setHours(12,0,0,0);
    const day=now.getDay()||7;
    now.setDate(now.getDate()-day+1);
    const y=now.getFullYear();
    const m=String(now.getMonth()+1).padStart(2,'0');
    const d=String(now.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  function apply(){
    const title=document.getElementById('planningDetailTitle')?.textContent?.trim();
    if(title!=='Mes prochains jours') return;

    const cutoff=startOfCurrentWeekISO();
    const cutoffMonth=cutoff.slice(0,7);
    const workspace=document.getElementById('planningWorkspace');
    if(!workspace) return;

    workspace.querySelectorAll('.day-row').forEach(row=>{
      const date=row.querySelector('.day-date small')?.textContent?.trim()||'';
      if(/^\d{4}-\d{2}-\d{2}$/.test(date) && date<cutoff) row.remove();
    });

    workspace.querySelectorAll('[data-month]').forEach(btn=>{
      const month=btn.getAttribute('data-month')||'';
      if(month && month<cutoffMonth) btn.remove();
    });

    const monthContent=workspace.querySelector('#monthContent');
    if(monthContent && !monthContent.querySelector('.day-row') && !monthContent.querySelector('.empty')){
      monthContent.innerHTML='<div class="empty">Aucun jour à afficher avant la semaine en cours.</div>';
    }
  }

  const observer=new MutationObserver(()=>requestAnimationFrame(apply));
  observer.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('click',()=>setTimeout(apply,0),true);
  document.addEventListener('DOMContentLoaded',apply);
})();