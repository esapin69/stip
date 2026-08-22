(()=>{'use strict';
const API='https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data';
const STORE='stip_session_v1';
const MONTHS=['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET','AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];
const DAYS=['LUN','MAR','MER','JEU','VEN','SAM','DIM'];
const FALLBACK={M:'#1688d3',J:'#20a765',J4:'#f2763e',S:'#dea72d',N:'#6e55d8',RH:'#748594',RTT:'#748594',RTTA:'#748594',RC:'#748594',CA:'#748594',RF:'#748594',AA:'#748594',MA:'#748594',RTA:'#748594',SYR:'#748594'};
const $=s=>document.querySelector(s);
let items=[],shiftAssets={},activeKey='',dragStart=0,dragDelta=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function call(action){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','X-STIP-Session':localStorage.getItem(STORE)||''},body:JSON.stringify({action})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw Error(j.error||`Erreur ${r.status}`);return j}
function keyFromDate(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function toDate(k){const[y,m]=k.split('-').map(Number);return new Date(y,m-1,1)}
function addMonth(k,n){const d=toDate(k);d.setMonth(d.getMonth()+n);return keyFromDate(d)}
function initialMonth(){const cur=keyFromDate(new Date()),keys=[...new Set(items.map(x=>String(x.date||'').slice(0,7)).filter(Boolean))].sort();return keys.includes(cur)?cur:(keys.find(x=>x>cur)||keys.at(-1)||cur)}
function asset(code){const k=String(code||'').trim().toUpperCase();return shiftAssets[k]||shiftAssets[`${k}.PNG`]||shiftAssets[`${k}.JPG`]||shiftAssets[`${k}.JPEG`]||''}
function shiftVisual(code){if(!code)return'';const u=asset(code);if(u)return`<img class="shift-img" src="${esc(u)}" alt="${esc(code)}">`;return`<span class="shift-fallback" style="--shift:${FALLBACK[code]||'#277b86'}">${esc(code)}</span>`}
function renderMonths(){const track=$('#monthTrack');track.innerHTML='';for(let i=-2;i<=2;i++){const k=addMonth(activeKey,i),d=toDate(k),el=document.createElement('div');el.className='month-card'+(i===0?' active':'');el.dataset.key=k;el.innerHTML=`<span class="month-name">${MONTHS[d.getMonth()]}</span>`;track.appendChild(el)}track.style.transform='translateX(-75%)';$('#yearLabel').textContent=toDate(activeKey).getFullYear()}
function renderCalendar(){const[y,m]=activeKey.split('-').map(Number),by=new Map(items.filter(x=>String(x.date||'').startsWith(activeKey)).map(x=>[x.date,x])),first=new Date(y,m-1,1),days=new Date(y,m,0).getDate(),pad=(first.getDay()+6)%7,today=new Date().toISOString().slice(0,10);let html=`<div class="weekday-row">${DAYS.map((d,i)=>`<div class="weekday ${i>4?'weekend':''}">${d}</div>`).join('')}</div><div class="days-grid">`;html+='<div class="blank"></div>'.repeat(pad);for(let i=1;i<=days;i++){const dk=`${activeKey}-${String(i).padStart(2,'0')}`,it=by.get(dk),code=String(it?.code||it?.source_value||'').trim().toUpperCase(),dow=new Date(`${dk}T12:00:00`).getDay(),weekend=dow===0||dow===6;html+=`<div class="day ${weekend?'weekend':''} ${dk===today?'today':''}"><b>${i}</b><div class="shift-slot">${shiftVisual(code)}</div></div>`}html+='</div>';$('#calendar').innerHTML=html}
function render(){renderMonths();renderCalendar()}
function setMonth(n){activeKey=addMonth(activeKey,n);render()}
function setAvatar(agent){const img=$('#avatar'),fb=$('#avatarFallback');const url=agent?.avatar_url||agent?.avatar||agent?.photo_url||agent?.photo||'';const initials=((agent?.prenom||'S')[0]+(agent?.nom||'T')[0]).toUpperCase();fb.textContent=initials;if(url){img.src=url;img.onload=()=>{img.style.display='block';fb.style.display='none'};img.onerror=()=>{img.style.display='none';fb.style.display='grid'}}}
function bindSwipe(){const w=$('#monthWindow');w.addEventListener('pointerdown',e=>{dragStart=e.clientX;dragDelta=0;w.setPointerCapture?.(e.pointerId)});w.addEventListener('pointermove',e=>{if(!dragStart)return;dragDelta=e.clientX-dragStart});w.addEventListener('pointerup',()=>{if(Math.abs(dragDelta)>38)setMonth(dragDelta<0?1:-1);dragStart=0;dragDelta=0});w.addEventListener('pointercancel',()=>{dragStart=0;dragDelta=0})}
async function init(){try{const d=await call('bootstrap');items=d.personal||d.items||[];shiftAssets=d.media?.shifts||{};setAvatar(d.agent||{});activeKey=initialMonth();render();$('#state').textContent='Données STIP réelles';}catch(e){activeKey=keyFromDate(new Date());render();$('#state').textContent=e.message||'Session STIP requise'}bindSwipe();$('#prevMonth').onclick=()=>setMonth(-1);$('#nextMonth').onclick=()=>setMonth(1)}
init();
})();