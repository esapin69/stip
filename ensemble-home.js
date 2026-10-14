(() => {
"use strict";
if(window.STIPLeisure)return;
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-leisure",STORE="stip_session_v1";
const e=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dateLabel=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
let events=[],owner="",busy=null,ready=false,lastFetch=0;
function visibleDates(x){return (x.visible_dates||x.dates||[]).filter(d=>d>=today())}
function concerned(x){return x.is_organizer||!!x.invitation_status||!!x.response}
function status(x){
 if(x.status==="cancelled")return ["closed","Annulé"];
 if(x.response?.declined)return ["declined","Décliné"];
 if(x.is_organizer)return ["mine","Organisé"];
 if(x.response?.selected_dates?.length)return ["confirmed","Confirmé"];
 return ["pending","À répondre"];
}
function cards(from,to){
 if(!ready||!from||!to)return "";
 const items=events.filter(x=>x.status==="active"&&concerned(x)&&visibleDates(x).some(d=>d>=from&&d<=to)).sort((a,b)=>{
 const ad=visibleDates(a).find(d=>d>=from&&d<=to)||"9999",bd=visibleDates(b).find(d=>d>=from&&d<=to)||"9999";
 return ad.localeCompare(bd);
 });
 if(!items.length)return "";
 return '<section class="ev3-home-section" aria-label="Activités personnelles entre collègues"><div class="ev3-home-head"><strong>ENTRE COLLÈGUES · '+items.length+'</strong><a href="sorties-loisirs.html?tab=agenda">Tous mes rendez-vous ›</a></div><div class="ev3-home-items">'+items.slice(0,4).map(x=>{
  const [tone,indicator]=status(x),days=visibleDates(x).filter(d=>d>=from&&d<=to);
  return '<a href="sorties-loisirs.html?tab=agenda&event='+encodeURIComponent(x.id)+'" class="ev3-home-card ev3-'+tone+'"><span class="ev3-home-icon" aria-hidden="true">'+e(x.icon||"📌")+'</span><span class="ev3-home-copy"><strong>'+e(x.title)+'</strong><small>'+e(days.length?dateLabel(days[0])+(days.length>1?" · +"+(days.length-1)+" dates":""):"")+" · "+e(x.schedule_mode==="afterwork"?"Fin du service":x.time_label||"Heure à fixer")+'</small></span><span class="ev3-home-state">'+e(indicator)+'</span><span aria-hidden="true">›</span></a>';
 }).join("")+'</div>'+(items.length>4?'<a class="ev3-home-more" href="sorties-loisirs.html?tab=agenda">Voir les '+(items.length-4)+' autres ›</a>':"")+'</section>';
}
async function refresh(force=false){
 const token=localStorage.getItem(STORE)||"";
 if(!token){events=[];owner="";ready=false;return}
 if(owner!==token){events=[];owner=token;ready=false}
 if(busy)return busy;
 if(!force&&ready&&Date.now()-lastFetch<180000)return;
 busy=(async()=>{
  try{
   const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-stip-session":token},body:JSON.stringify({action:"list"})});
   if(!r.ok)return;
   const j=await r.json();
   if(j.error||localStorage.getItem(STORE)!==token)return;
   events=j.events||[];ready=true;lastFetch=Date.now();
   window.dispatchEvent(new Event("stip:leisure-updated"));
  }catch(err){console.warn("Ensemble calendar fetch",err)}finally{busy=null}
 })();return busy;
}
function firstLastOfMonth(key){
 if(!/^\d{4}-\d{2}$/.test(String(key)))return ["",""];
 const [y,m]=key.split("-").map(Number);if(m<1||m>12)return ["",""];
 const start=key+"-01",end=key+"-"+String(new Date(y,m,0).getDate()).padStart(2,"0");return [start,end];
}
const go=(id="",tab="agenda")=>{location.href="sorties-loisirs.html?tab="+encodeURIComponent(tab)+(id?"&event="+encodeURIComponent(id):"")};
window.STIPLeisure={
 refresh,
 pendingHTML:()=>"",
 weekHTML:(start,end)=>cards(start,end),
 monthHTML:key=>{const [a,b]=firstLastOfMonth(key);return cards(a,b)},
 openEvent:id=>go(id),
 openInvite:id=>go(id),
 openCreator:()=>go("","create"),
 closeCreator:()=>{},
 setTab:tab=>go("",tab==="trips"?"trips":"agenda")
};
window.addEventListener("stip:session-ready",()=>refresh(true));
window.addEventListener("stip:boot-updated",()=>refresh());
window.addEventListener("stip:session-ended",()=>{events=[];ready=false;owner="";window.dispatchEvent(new Event("stip:leisure-updated"))});
window.addEventListener("pageshow",()=>refresh());
if(document.readyState!=="loading")refresh();
else document.addEventListener("DOMContentLoaded",()=>refresh(),{once:true});
})();