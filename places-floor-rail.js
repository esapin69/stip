(()=>{
'use strict';
const content=document.querySelector('#placesContent');
if(!content)return;
let data=null,scheduled=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function currentPlaceId(){const m=location.hash.match(/^#\/?place\/(.+)$/);return m?decodeURIComponent(m[1]):''}
function floorRank(v){const s=String(v??'').trim().toUpperCase();if(/^-[0-9]+$/.test(s))return-100+Number(s);if(s==='RDJ'||s==='RJ')return-20;if(s==='RDC')return-10;if(s==='TM')return-5;const n=Number(s.replace(/[^0-9-]/g,''));return Number.isFinite(n)?n:999}
function maps(){return{byId:new Map((data?.places||[]).map(p=>[p.id,p]))}}
function currentLevel(p,byId){let cur=p,guard=0;while(cur&&guard++<12){if(cur.place_type==='level')return cur;cur=cur.parent_id?byId.get(cur.parent_id):null}return null}
function levelsFor(p){if(!p?.building_code)return[];const seen=new Set(),out=[];for(const x of data?.places||[]){if(x.place_type!=='level'||x.building_code!==p.building_code)continue;const key=String(x.level||x.display_name||x.id);if(seen.has(key))continue;seen.add(key);out.push(x)}return out.sort((a,b)=>floorRank(a.level)-floorRank(b.level)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0))}
function setMode(p){
  const hospital=['hospital','building'].includes(p?.place_type);
  const level=p?.place_type==='level';
  content.classList.toggle('floor-hospital-mode',hospital);
  content.classList.toggle('floor-level-mode',level);
  for(const sec of content.querySelectorAll('.floor-route-noise'))sec.classList.remove('floor-route-noise');
  if(level){for(const sec of content.querySelectorAll('.places-section')){const h=sec.querySelector('h2');if(h&&/^comment y aller$/i.test((h.textContent||'').trim()))sec.classList.add('floor-route-noise')}}
}
function clearRail(){content.querySelector('[data-floor-quick-rail]')?.remove();content.classList.remove('floor-hospital-mode','floor-level-mode')}
function render(){
  scheduled=false;if(!data)return;
  const id=currentPlaceId();if(!id){clearRail();return}
  const {byId}=maps(),p=byId.get(id);if(!p){clearRail();return}
  setMode(p);
  const levels=levelsFor(p);if(levels.length<2){content.querySelector('[data-floor-quick-rail]')?.remove();return}
  const active=currentLevel(p,byId),signature=[p.building_code,active?.id||'',...levels.map(x=>x.id)].join('|');
  const old=content.querySelector('[data-floor-quick-rail]');if(old?.dataset.signature===signature)return;old?.remove();
  const rail=document.createElement('nav');rail.className='floor-quick-rail';rail.dataset.floorQuickRail='1';rail.dataset.signature=signature;rail.setAttribute('aria-label','Accès rapide aux étages');
  rail.innerHTML=`<span class="floor-quick-mark" aria-hidden="true">↕</span>${levels.map(l=>`<button type="button" data-place="${esc(l.id)}" class="floor-quick-btn${active?.id===l.id?' active':''}" aria-label="Ouvrir ${esc(l.display_name)}" title="${esc(l.display_name)}">${esc(l.level||l.display_name)}</button>`).join('')}`;
  content.appendChild(rail);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(render)}
function use(d){data=d||window.__STIP_PLACE_DATA||data;schedule()}
window.addEventListener('stip:place-data-ready',()=>use(window.__STIP_PLACE_DATA));
window.addEventListener('hashchange',()=>setTimeout(schedule,40));
new MutationObserver(schedule).observe(content,{childList:true,subtree:true});
setTimeout(()=>use(window.__STIP_PLACE_DATA),250);
})();
