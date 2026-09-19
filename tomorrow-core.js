(()=>{"use strict";
const STORE="stip_tomorrow_v1",TZ="Europe/Paris",REST=new Set(["RH","RTT","RTTA","RTA","RC","RF","CA","OFF","REPOS","-","—"]);
const SHIFT={M:["Matin","06:50–14:40"],J:["Journée","08:30–16:20"],J4:["Journée décalée","10:10–18:00"],S:["Soir","13:30–21:00"],N:["Nuit","21:00–06:50"]};
const pad=n=>String(n).padStart(2,"0"),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function iso(d=new Date()){const p=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d),m=Object.fromEntries(p.map(x=>[x.type,x.value]));return m.year+"-"+m.month+"-"+m.day}
function dateObj(v){return new Date(String(v).slice(0,10)+"T12:00:00")}
function add(v,n){const d=dateObj(v);d.setDate(d.getDate()+n);return iso(d)}
function tomorrow(){return add(iso(),1)}
function fullDate(v){return dateObj(v).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase())}
function shortDate(v){return dateObj(v).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}).replace(/\./g,"")}\nfunction relation(day=tomorrow()){const base=tomorrow(),a=dateObj(base),b=dateObj(day),diff=Math.round((b-a)/86400000);if(diff===0)return{key:"tomorrow",label:"Demain",offset:0};if(diff===1)return{key:"after-tomorrow",label:"Après-demain",offset:1};return{key:"future",label:fullDate(day),offset:diff}}\nfunction futureDays(count=8,start=tomorrow()){const n=Math.max(1,Math.min(31,Number(count)||8));return Array.from({length:n},(_,i)=>add(start,i))}
function canon(v){const s=String(v||"").trim().toUpperCase().replace(/\*/g,"");if(/^M\d*$/.test(s))return"M";if(s==="J0464"||s==="J"||(/^J\d+$/.test(s)&&!/^J4/.test(s)))return"J";if(s==="J4"||/^J4\d+$/.test(s))return"J4";if(/^S\d*$/.test(s))return"S";if(/^N\d*$/.test(s))return"N";return s||"—"}
function shiftTime(code,row={}){const direct=String(row.horaire||row.horaires||row.shift_time||"").trim();if(direct)return direct;const a=String(row.start_time||"").slice(0,5),b=String(row.end_time||"").slice(0,5);if(a||b)return[a,b].filter(Boolean).join("–");return SHIFT[code]?.[1]||""}
function shiftFor(day=tomorrow()){const b=window.STIPBootCache||{},row=(b.personal||[]).find(x=>String(x.date||"").slice(0,10)===day)||null,code=canon(row?.code||row?.source_value||"");return{row,code,label:SHIFT[code]?.[0]||(REST.has(code)?"Repos":code==="—"?"Horaire non renseigné":code),time:shiftTime(code,row||{}),rest:REST.has(code)}}
function place(x={}){return String(x.lieu||x.location||x.place||x.room||x.service||"").trim()}
function done(x={}){const s=String(x.status||x.statut||"").toLowerCase();return!!(x.completed_at||x.cancelled_at||x.resolved_at||["done","termine","terminé","cancelled","annule","annulé","resolved","refused","refusé"].includes(s))}
function eventType(x={}){const s=[x.kind,x.category,x.type,x.source_type].filter(Boolean).join(" ").toLowerCase();if(/stagiaire/.test(s))return"Stagiaire";if(/formation/.test(s))return"Formation";if(/mobi_lit_medical|médical|medical|visite/.test(s))return"Visite médicale";if(/réunion|reunion|meeting/.test(s))return"Réunion";return String(x.kind||x.category||x.type||"Événement")}
function events(day=tomorrow()){const b=window.STIPBootCache||{},out=[];
(b.agenda_items||[]).filter(x=>!done(x)&&String(x.event_date||"").slice(0,10)===day).forEach(x=>{const a=String(x.start_time||"").slice(0,5),z=String(x.end_time||"").slice(0,5),t=x.all_day?"Toute la journée":[a,z].filter(Boolean).join("–");out.push({id:"agenda:"+(x.id||x.event_date),kind:"agenda",type:eventType(x),title:x.title||"Événement",time:t,start:a,end:z,place:place(x),importance:x.importance||"",icon:x.source_type==="mobi_lit_medical"?"🩺":x.importance==="urgent"?"⚠️":"📌",source:x})});
(b.personal_formations||[]).filter(x=>!done(x)&&String(x.date_debut||"").slice(0,10)<=day&&String(x.date_fin||x.date_debut||"").slice(0,10)>=day).forEach(x=>out.push({id:"formation:"+(x.id||x.source_key||day),kind:"formation",type:"Formation",title:x.intitule||"Formation",time:String(x.horaire||"").trim(),start:"",end:"",place:place(x),icon:"🎓",source:x}));
(b.personal_stagiaires||[]).filter(x=>!done(x)&&String(x.date_debut||"").slice(0,10)<=day&&String(x.date_fin||x.date_debut||"").slice(0,10)>=day).forEach(x=>out.push({id:"stagiaire:"+(x.id||x.source_key||day),kind:"stagiaire",type:"Stagiaire",title:[x.prenom,x.nom].filter(Boolean).join(" ")||"Stagiaire",time:String(x.horaires||"").trim(),start:"",end:"",place:place(x),icon:"👶",source:x}));
return out.sort((a,b)=>String(a.start||"99:99").localeCompare(String(b.start||"99:99"))||a.title.localeCompare(b.title,"fr"))}
function scope(){const a=window.STIPBootCache?.agent||window.STIPSession?.agent||{};return String(a.source_key||a.id||"device")}
function load(){try{const x=JSON.parse(localStorage.getItem(STORE)||"{}");return x&&typeof x==="object"?x:{}}catch{return{}}}
function save(x){try{localStorage.setItem(STORE,JSON.stringify(x))}catch{}window.dispatchEvent(new CustomEvent("stip:tomorrow-updated"))}
function tasks(day=tomorrow()){const x=load(),rows=x[scope()]?.[day];return Array.isArray(rows)?rows.slice().sort((a,b)=>Number(a.order||0)-Number(b.order||0)):[]}
function write(day,rows){const x=load(),s=scope();x[s]=x[s]||{};x[s][day]=rows.map((r,i)=>({...r,order:i}));save(x);return x[s][day]}
function upsert(day,item){const rows=tasks(day),id=item.id||("td-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)),i=rows.findIndex(x=>x.id===id),next={id,title:String(item.title||"").trim(),time:String(item.time||"").trim(),note:String(item.note||"").trim(),done:!!item.done,order:i>=0?rows[i].order:rows.length,createdAt:item.createdAt||new Date().toISOString()};if(i>=0)rows[i]=next;else rows.push(next);write(day,rows);return next}
function remove(day,id){write(day,tasks(day).filter(x=>x.id!==id))}
function toggle(day,id){write(day,tasks(day).map(x=>x.id===id?{...x,done:!x.done}:x))}
function reorder(day,ids){const m=new Map(tasks(day).map(x=>[x.id,x]));write(day,ids.map(id=>m.get(id)).filter(Boolean))}
function moveNext(day,id){const rows=tasks(day),item=rows.find(x=>x.id===id);if(!item)return;remove(day,id);upsert(add(day,1),{...item,id:"td-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),done:false})}
function mins(t){const m=String(t||"").match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null}
function range(t){const p=String(t||"").match(/(\d{1,2}):?(\d{2})?\s*[–-]\s*(\d{1,2}):?(\d{2})?/);return p?[Number(p[1])*60+Number(p[2]||0),Number(p[3])*60+Number(p[4]||0)]:null}
function insights(day=tomorrow()){const sh=shiftFor(day),ev=events(day),ts=tasks(day),out=[],sr=range(sh.time);
if(sh.rest)out.push({icon:"◷",title:"Journée sans poste détecté",text:ev.length||ts.length?"Tu as tout de même des éléments prévus pour cette journée.":"Aucun rendez-vous ni tâche personnelle n’est détecté.",level:"info"});
else if(sh.code!=="—")out.push({icon:"↗",title:sh.label+" · "+(sh.time||"horaire à confirmer"),text:"Ton planning est déjà identifié pour cette journée.",level:"info"});
else out.push({icon:"?",title:"Horaire à vérifier",text:"Aucun poste n’est renseigné dans le planning pour cette journée.",level:"warning"});
const timed=ev.map(x=>({x,m:mins(x.start||String(x.time).slice(0,5))})).filter(x=>x.m!=null).sort((a,b)=>a.m-b.m);
for(let i=1;i<timed.length;i++){if(timed[i].m-timed[i-1].m<30){out.push({icon:"⚠",title:"Enchaînement serré",text:timed[i-1].x.title+" puis "+timed[i].x.title+" à moins de 30 min d’intervalle.",level:"warning"});break}}
if(sr){const inside=timed.filter(e=>e.m>=sr[0]&&e.m<=sr[1]);if(inside.length)out.push({icon:"◎",title:inside.length+" élément"+(inside.length>1?"s":"")+" pendant le service",text:inside.slice(0,2).map(e=>e.x.title).join(" · "),level:"info"});const before=timed.find(e=>e.m<sr[0]&&sr[0]-e.m<=45);if(before)out.push({icon:"!",title:"Avant la prise de poste",text:before.x.title+" est prévu peu avant ton horaire de travail.",level:"warning"})}
const urgent=ev.filter(x=>String(x.importance).toLowerCase()==="urgent");if(urgent.length)out.push({icon:"⚠",title:"Priorité signalée",text:urgent.map(x=>x.title).join(" · "),level:"warning"});
if(ev.some(x=>x.kind==="formation"))out.push({icon:"🎓",title:"Formation prévue",text:"Vérifie le lieu et l’horaire avant le départ.",level:"info"});
if(ev.some(x=>x.type==="Visite médicale"))out.push({icon:"🩺",title:"Visite médicale prévue",text:"Vérifie l’heure, le lieu et les documents nécessaires.",level:"info"});
const open=ts.filter(x=>!x.done).length;if(open)out.push({icon:"✓",title:open+" chose"+(open>1?"s":"")+" à faire",text:"Tes ajouts personnels sont regroupés ici et peuvent être réordonnés.",level:"info"});
return out.slice(0,5)}
function snapshot(day=tomorrow()){return{day,shift:shiftFor(day),events:events(day),tasks:tasks(day),insights:insights(day),fullDate:fullDate(day),shortDate:shortDate(day),relation:relation(day)}}
window.STIPTomorrow={iso,tomorrow,add,dateObj,fullDate,shortDate,relation,futureDays,canon,esc,shiftFor,events,tasks,write,upsert,remove,toggle,reorder,moveNext,insights,snapshot};
window.dispatchEvent(new CustomEvent("stip:tomorrow-ready"));
})();