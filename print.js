(()=>{
'use strict';
const DATA_API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data';
const PDF_API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-pdf';
const STORAGE='stip_session_v1';
const monthImages={
 '01':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Janvier.jpeg',
 '02':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Fevrier.jpeg',
 '03':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Mars.jpeg',
 '04':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Avril.jpeg',
 '05':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Mai.jpeg',
 '06':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Juin.jpeg',
 '07':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Juillet.jpeg',
 '08':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Aout.jpeg',
 '09':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Septembre.jpeg',
 '10':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Octobre.jpeg',
 '11':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Novembre.jpeg',
 '12':'https://raw.githubusercontent.com/esapin69/planning/main/Image/Mois/Decembre.jpeg'
};
const months=document.getElementById('months'),status=document.getElementById('status'),subtitle=document.getElementById('subtitle');
function token(){return localStorage.getItem(STORAGE)||''}
function monthKey(date){return String(date||'').slice(0,7)}
function label(k){const [y,m]=k.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}
async function data(action,body={}){const r=await fetch(DATA_API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':token()},body:JSON.stringify({action,...body})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||`Erreur ${r.status}`);return j}
function visibleMonths(items){const available=[...new Set(items.map(x=>monthKey(x.date)).filter(Boolean))].sort();const now=new Date(),cur=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;const prev=new Date(now.getFullYear(),now.getMonth()-1,1),pk=`${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;const next=new Date(now.getFullYear(),now.getMonth()+1,1),nk=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;const wanted=[];if(now.getDate()<=4&&available.includes(pk))wanted.push(pk);if(available.includes(cur))wanted.push(cur);if(available.includes(nk))wanted.push(nk);if(!wanted.length){const future=available.filter(k=>k>=cur).slice(0,3);if(future.length)return future;return available.slice(-3)}return wanted}
function render(keys){months.innerHTML='';for(const k of keys){const m=k.slice(5,7),card=document.createElement('article');card.className='month-card';const img=document.createElement('img');img.src=monthImages[m];img.alt=`Planning ${label(k)}`;img.onerror=()=>{img.remove();const fb=document.createElement('div');fb.className='fallback-month';fb.textContent=label(k);card.prepend(fb)};const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`Créer le PDF ${label(k)}`);b.onclick=()=>createPdf(k,card);card.append(img,b);months.append(card)}}
async function createPdf(k,card){if(card.classList.contains('loading'))return;const session=token();if(!session){location.href='index.html';return}card.classList.add('loading');const w=window.open('','_blank');if(w){try{w.document.body.innerHTML='<p style="font-family:system-ui;padding:24px">Création du planning PDF…</p>'}catch{}}try{const r=await fetch(PDF_API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':session},body:JSON.stringify({month:k})});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||`Erreur ${r.status}`)}const blob=await r.blob(),url=URL.createObjectURL(blob);if(w)w.location.replace(url);else location.href=url;setTimeout(()=>URL.revokeObjectURL(url),120000)}catch(e){if(w)w.close();alert(e instanceof Error?e.message:String(e));card.classList.remove('loading')}}
(async()=>{if(!token()){location.href='index.html';return}try{const r=await data('personal'),items=r.items||[],keys=visibleMonths(items);subtitle.textContent=keys.length?'Sélectionne le mois à générer. Le PDF est créé avec les données actuelles.':'Aucun mois de planning disponible.';status.classList.add('hidden');if(keys.length)render(keys);else{status.textContent='Aucun mois disponible dans ton planning.';status.classList.remove('hidden')}}catch(e){status.textContent=e instanceof Error?e.message:String(e);status.className='status error'}})();
})();
