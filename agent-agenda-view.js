(() => {
  "use strict";
  const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-planning",
        ACTIONS="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions",
        CALENDAR="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-calendar",
        GOOGLE_ADD_URL="https://calendar.google.com/calendar/u/0/r/settings/addbyurl",
        STORE="stip_session_v1";
  let overlay=null,state=null;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function css(){
    if(document.querySelector('link[data-agent-agenda-css]'))return;
    const l=document.createElement("link");l.rel="stylesheet";l.href="agent-agenda-view.css?v=20260921-agenda-events2";l.dataset.agentAgendaCss="1";document.head.appendChild(l);
  }
  function token(){return localStorage.getItem(STORE)||""}
  async function post(url,body){
    const r=await fetch(url,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","X-STIP-Session":token()},body:JSON.stringify(body)}),
          j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw Error(j.error||`Erreur ${r.status}`);
    return j;
  }
  function iso(d){return d.toISOString().slice(0,10)}
  function dobj(v){return new Date(String(v).slice(0,10)+"T12:00:00")}
  function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
  function add(v,n){const d=dobj(v);d.setDate(d.getDate()+n);return iso(d)}
  function monday(v){const d=dobj(v),x=d.getDay()||7;d.setDate(d.getDate()-x+1);return iso(d)}
  function monthKey(v){return String(v||today()).slice(0,7)}
  function firstMondayInMonth(k){
    const d=dobj(k+"-01"),day=d.getDay()||7;
    if(day!==1)d.setDate(d.getDate()+(8-day)%7);
    return iso(d);
  }
  function fmtMonth(k){return dobj(k+"-01").toLocaleDateString("fr-FR",{month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase())}
  function shortDay(v){return dobj(v).toLocaleDateString("fr-FR",{weekday:"short"}).replace(".","").toUpperCase()}
  function fullDay(v){return dobj(v).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase())}
  function person(a={}){return window.STIPName?.format?.(a)||[a.prenom,a.nom].filter(Boolean).join(" ").trim()||a.nom||"Agent"}
  function phoneHref(v){const d=String(v||"").replace(/\D/g,"");if(!d)return"";return d.startsWith("33")?`tel:+${d}`:`tel:${d}`}
  const META={
    M:{label:"Matin",time:"06h50–14h40",icon:"●",family:"m"},
    J:{label:"Journée",time:"08h30–16h20",icon:"●",family:"j"},
    J4:{label:"J4",time:"10h10–18h00",icon:"●",family:"j4"},
    S:{label:"Soir",time:"13h30–21h00",icon:"●",family:"s"},
    N:{label:"Nuit",time:"21h00–06h50",icon:"●",family:"n"},
    RH:{label:"Repos",time:"",icon:"🏝️",family:"rh"},
    CA:{label:"Congé",time:"",icon:"🌴",family:"off"},
    RTT:{label:"RTT",time:"",icon:"⏱️",family:"off"},
    RTTA:{label:"RTTA",time:"",icon:"⏱️",family:"off"},
    RTA:{label:"RTA",time:"",icon:"⏱️",family:"off"},
    RC:{label:"Récupération",time:"",icon:"↻",family:"off"},
    FO:{label:"Formation",time:"",icon:"🎓",family:"off"},
    SYR:{label:"Activité syndicale",time:"",icon:"🤝",family:"off"},
    MA:{label:"Absence",time:"",icon:"•",family:"off"},
    AM:{label:"Absence",time:"",icon:"•",family:"off"},
    AA:{label:"Absence autorisée",time:"",icon:"•",family:"off"},
    ABS:{label:"Absence",time:"",icon:"•",family:"off"}
  };
  const SPECIAL={
    M0130:{base:"M",time:"3h45 · horaire adapté"},
    M0131:{base:"M",time:"7h30 · horaire adapté"},
    M0177:{base:"M",time:"7h30 · horaire adapté"},
    J0464:{base:"J",time:"08h30–16h20"},
    S0113:{base:"S",time:"13h30–21h00"}
  };
  function shiftInfo(raw){
    const src=String(raw||"").trim().toUpperCase(),star=src.includes("*"),clean=src.replace(/\*/g,"");
    if(SPECIAL[clean]){const s=SPECIAL[clean],m=META[s.base];return{...m,base:s.base,raw:src,time:s.time,adapted:true,star}}
    if(META[clean])return{...META[clean],base:clean,raw:src,star};
    let base="";
    if(/^M\d+$/.test(clean))base="M";
    else if(/^J4\d+$/.test(clean))base="J4";
    else if(/^J\d+$/.test(clean))base="J";
    else if(/^S\d+$/.test(clean))base="S";
    else if(/^N\d+$/.test(clean))base="N";
    if(base)return{...META[base],base,raw:src,time:"Horaire adapté",adapted:true,star};
    return{label:clean||"—",time:"",icon:"•",family:"other",base:clean||"",raw:src,star};
  }
  function expandRange(start,end,fn,max=370){let d=String(start||"").slice(0,10),e=String(end||start||"").slice(0,10),n=0;while(d&&d<=e&&n++<max){fn(d);d=add(d,1)}}
  function events(data){
    const out=[];
    for(const x of data.agenda_items||[]){
      const sourceType=String(x.source_type||""),medical=/medical|mobi_lit|visite/i.test(sourceType),privateAppointment=sourceType==="private_appointment",
        labels={rendezvous:"Rendez-vous",formation:"Formation",reunion:"Réunion",information:"Information",autre:"Événement"},
        kind=medical||privateAppointment?"Rendez-vous":labels[String(x.event_kind||"")]||"Événement",
        icon=medical?"🩺":privateAppointment?"📅":(String(x.icon||"").trim()||(x.importance==="urgent"?"⚠️":x.importance==="important"?"❗":"📌"));
      out.push({date:String(x.event_date||"").slice(0,10),icon,kind,title:x.title||"Événement",time:x.all_day?"Toute la journée":[String(x.start_time||"").slice(0,5),String(x.end_time||"").slice(0,5)].filter(Boolean).join("–"),detail:x.body||"",location:x.location||""});
    }
    for(const x of data.personal_formations||[])expandRange(x.date_debut,x.date_fin||x.date_debut,d=>out.push({date:d,icon:"🎓",kind:"Formation",title:x.intitule||"Formation",time:x.horaire||"",detail:"",location:x.lieu||""}),40);
    for(const x of data.personal_stagiaires||[])expandRange(x.date_debut,x.date_fin||x.date_debut,d=>out.push({date:d,icon:"👶",kind:"Stagiaire",title:[x.prenom,x.nom].filter(Boolean).join(" ")||"Stagiaire",time:x.horaires||"",detail:x.observation||"",location:""}));
    const seen=new Set();
    return out.filter(x=>x.date&&(!seen.has([x.date,x.kind,x.title,x.time].join("|"))&&(seen.add([x.date,x.kind,x.title,x.time].join("|")),true))).sort((a,b)=>a.date.localeCompare(b.date)||String(a.time).localeCompare(String(b.time)));
  }
  function byDate(items){const m=new Map();for(const x of items||[])m.set(String(x.date||"").slice(0,10),x);return m}
  function eventMap(items){const m=new Map();for(const x of items){if(!m.has(x.date))m.set(x.date,[]);m.get(x.date).push(x)}return m}
  function monthBounds(data){
    const vals=[...(data.items||[]).map(x=>x.date),...events(data).map(x=>x.date)].filter(Boolean).sort();
    const cur=monthKey(today());
    return{min:vals.length?monthKey(vals[0]):cur,max:vals.length?monthKey(vals.at(-1)):cur};
  }
  function shiftToken(row,compact=false){
    const i=shiftInfo(row?.code||row?.source_value||"");
    if(!row)return compact?"":"—";
    if(i.family==="rh")return "🏝️";
    if(i.family==="off"||i.family==="other")return i.icon;
    return compact?`<span class="aav-dot aav-${i.family}"></span>`:`<span class="aav-dot aav-${i.family}"></span><b>${esc(i.base)}</b>`;
  }
  function monthHtml(){
    const k=state.month,[y,m]=k.split("-").map(Number),first=new Date(y,m-1,1,12),last=new Date(y,m,0,12),lead=(first.getDay()+6)%7,
          plan=byDate(state.data.items),emap=eventMap(state.events),cells=[];
    for(let i=0;i<lead;i++)cells.push('<span class="aav-cal-empty"></span>');
    for(let d=1;d<=last.getDate();d++){
      const day=`${k}-${String(d).padStart(2,"0")}`,row=plan.get(day),ev=emap.get(day)||[],info=shiftInfo(row?.code||row?.source_value||""),
            cls=[day===today()?"today":"",day===state.selected?"selected":"",row?`shift-${info.family}`:"",ev.length?"has-event":""].filter(Boolean).join(" ");
      cells.push(`<button type="button" class="aav-cal-day ${cls}" data-aav-day="${day}"><b>${d}</b><span class="aav-cal-shift">${row?shiftToken(row,true):""}</span><small>${ev.slice(0,2).map(x=>x.icon).join("")}</small></button>`);
    }
    const prev=state.month>state.bounds.min,next=state.month<state.bounds.max;
    return `<section class="aav-month"><header><button type="button" data-aav-month="-1" ${prev?"":"disabled"}>‹</button><strong>${esc(fmtMonth(k))}</strong><button type="button" data-aav-month="1" ${next?"":"disabled"}>›</button></header><div class="aav-weekheads"><span>LU</span><span>MA</span><span>ME</span><span>JE</span><span>VE</span><span>SA</span><span>DI</span></div><div class="aav-calendar">${cells.join("")}</div></section>`;
  }
  function quotity(){
    const q=Number(state?.data?.agent?.quotite);
    return Number.isInteger(q)&&q>=1&&q<100?q:0;
  }
  function weekHtml(){
    const start=monday(state.selected),plan=byDate(state.data.items),emap=eventMap(state.events),cards=[];
    for(let i=0;i<7;i++){
      const day=add(start,i),row=plan.get(day),ev=emap.get(day)||[],info=shiftInfo(row?.code||row?.source_value||"");
      cards.push(`<button type="button" class="aav-week-day ${row?`shift-${info.family}`:""} ${day===state.selected?"selected":""}" data-aav-day="${day}"><small>${shortDay(day)}</small><b>${dobj(day).getDate()}</b><span class="aav-week-events">${ev.slice(0,2).map(x=>x.icon).join("")}</span><div class="aav-week-shift">${row?shiftToken(row,false):'<em>—</em>'}</div>${row&&info.time?`<em>${esc(info.time)}</em>`:""}${row&&info.adapted?'<i title="Horaire adapté">⏱</i>':""}${row&&quotity()?`<span class="aav-part-badge" title="Temps partiel">◐ ${quotity()}%</span>`:""}</button>`);
    }
    return `<section class="aav-week"><div class="aav-week-icons">${state.events.filter(x=>x.date>=start&&x.date<=add(start,6)).slice(0,5).map(x=>`<span>${x.icon}</span>`).join("")}</div><div class="aav-week-grid">${cards.join("")}</div></section>`;
  }
  function eventHtml(){
    const start=monday(state.selected),end=add(start,6),rows=state.events.filter(x=>x.date>=start&&x.date<=end);
    if(!rows.length)return '<section class="aav-events aav-events-empty"><span>Aucun événement cette semaine.</span></section>';
    return `<section class="aav-events aav-events-home-style"><div class="aav-event-list">${rows.map(x=>{
      const d=dobj(x.date),dateLabel=d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}).replace(".","");
      return `<article class="aav-event-row ${x.date===state.selected?"is-selected-day":""}"><span class="aav-event-icon">${esc(x.icon||"•")}</span><div class="aav-event-copy"><strong>${esc(x.title)}</strong><span class="aav-event-when"><b>${esc(dateLabel)}</b>${x.time?`<b>${esc(x.time)}</b>`:""}${x.location?`<em>${esc(x.location)}</em>`:""}</span>${x.detail?`<small>${esc(x.detail)}</small>`:""}</div></article>`;
    }).join("")}</div></section>`;
  }
  function legendHtml(){
    const start=monday(state.selected),end=add(start,6),
      plan=(state.data.items||[]).filter(r=>String(r.date||"")>=start&&String(r.date||"")<=end),
      visibleEvents=state.events.filter(x=>x.date>=start&&x.date<=end),
      seen=new Map();
    for(const r of plan){const i=shiftInfo(r.code||r.source_value);const key=i.base||i.label;if(!seen.has(key))seen.set(key,i)}
    const items=[...seen.values()].map(i=>`<span>${i.family==="rh"||i.family==="off"||i.family==="other"?i.icon:`<i class="aav-dot aav-${i.family}"></i>`}<b>${esc(i.label)}</b>${i.time?`<small>· ${esc(i.time)}</small>`:""}</span>`);
    if(plan.some(r=>shiftInfo(r.code||r.source_value).adapted))items.push('<span>⏱ <b>Horaire adapté</b></span>');
    if(quotity())items.push(`<span>◐ <b>Temps partiel</b><small>· ${quotity()}%</small></span>`);
    const kinds=new Map();for(const x of visibleEvents)if(!kinds.has(x.kind))kinds.set(x.kind,x.icon);
    for(const [k,icon] of kinds)items.push(`<span>${icon} <b>${esc(k)}</b></span>`);
    return `<section class="aav-legend"><h3>LÉGENDE</h3><div>${items.join("")||'<span><b>Aucun repère cette semaine</b></span>'}</div></section>`;
  }
  function contactHtml(){
    const c=state.data.contact||state.data.agent||{},tel=phoneHref(c.telephone),mail=c.email_pro||c.email||"";
    if(!tel&&!mail)return"";
    return `<div class="aav-contact">${tel?`<a href="${esc(tel)}">☎ ${esc(c.telephone)}</a>`:""}${mail?`<button type="button" data-aav-copy="${esc(mail)}">✉ ${esc(mail)}</button>`:""}</div>`;
  }
  function isAndroid(){return /Android/i.test(navigator.userAgent||"")}
  async function clipboard(v){try{await navigator.clipboard.writeText(v);return true}catch{return false}}
  function subscribeHtml(){
    const v=state.data.viewer||{};
    if(!v.can_subscribe_target&&!v.can_subscribe_team)return"";
    return `<section class="aav-subscribe">
      ${v.can_subscribe_target?`<button type="button" class="aav-subscribe-main" data-aav-subscribe="agent"><span>📅</span><div><strong>S’abonner à ce planning</strong><small>Reste synchronisé si le planning change</small></div><b>›</b></button>`:""}
      ${v.can_subscribe_team?`<button type="button" class="aav-subscribe-team" data-aav-subscribe="team"><span>👥</span><div><strong>Esprit d’équipe</strong><small>S’abonner aussi au planning de l’équipe</small></div><b>›</b></button>`:""}
      <div class="aav-subscribe-status" aria-live="polite"></div>
    </section>`;
  }
  function manualCalendarUrl(url,status){
    status.innerHTML=`<div class="aav-subscribe-done"><strong>Adresse prête</strong><input readonly value="${esc(url)}"><small>Copie cette adresse dans « Ajouter à partir de l’URL » de ton calendrier.</small></div>`;
    status.querySelector("input")?.select?.();
  }
  async function subscribe(kind,status,button){
    if(!status||!button)return;
    const old=button.innerHTML;
    button.disabled=true;
    button.classList.add("is-loading");
    status.innerHTML='<small class="aav-subscribe-working">Préparation de l’abonnement…</small>';
    try{
      const body=kind==="agent"?{kind:"agent",source_key:state.sourceKey}:{kind:"team"};
      const feed=await post(CALENDAR,body);
      if(isAndroid()){
        const ok=await clipboard(feed.https_url);
        if(!ok){
          manualCalendarUrl(feed.https_url,status);
          button.disabled=false;
          button.classList.remove("is-loading");
          button.innerHTML=old;
          return;
        }
        status.innerHTML=`<div class="aav-subscribe-done"><strong>✓ Adresse d’abonnement copiée</strong><a href="${GOOGLE_ADD_URL}" target="_blank" rel="noopener">Ouvrir Google Agenda</a><small>Dans Chrome, utilise « Version pour ordinateur » si nécessaire, puis Autres agendas → + → À partir de l’URL.</small></div>`;
      }else{
        status.innerHTML='<small class="aav-subscribe-working">Ouverture du calendrier…</small>';
        location.href=feed.webcal_url;
        setTimeout(()=>{button.disabled=false;button.classList.remove("is-loading");button.innerHTML=old},1200);
        return;
      }
    }catch(err){
      status.innerHTML=`<div class="aav-subscribe-error">${esc(err?.message||"Abonnement indisponible.")}</div>`;
    }
    button.disabled=false;
    button.classList.remove("is-loading");
    button.innerHTML=old;
  }
  function addForm(){
    const viewer=state.data.viewer||{};
    if(!viewer.can_manage&&!viewer.is_self)return"";
    const submitLabel=viewer.is_self?"Ajouter à mon agenda":"Ajouter à son agenda";
    return `<section class="aav-manage"><button type="button" class="aav-add" data-aav-add><span>＋</span><strong>Ajouter un événement</strong><small>${viewer.is_self?"À mon planning":"À ce planning"}</small><em>›</em></button><form class="aav-form" data-aav-form hidden><div class="aav-form-grid"><label class="aav-wide">Titre<input name="title" maxlength="180" required placeholder="Ex. Réunion d’équipe"></label><label>Date<input name="event_date" type="date" value="${esc(state.selected)}" required></label><label>Type<select name="event_kind"><option value="rendezvous">Rendez-vous</option><option value="formation">Formation</option><option value="reunion">Réunion</option><option value="information">Information</option><option value="autre" selected>Autre</option></select></label><label>Début<input name="start_time" type="time" value="09:00"></label><label>Fin<input name="end_time" type="time" value="10:00"></label><label class="aav-wide aav-icon-field">Icône <small>Facultatif · une icône est proposée automatiquement</small><div><input name="icon" maxlength="24" inputmode="text" value="📌" aria-label="Icône de l’événement"><button type="button" data-aav-clear-icon>Auto</button></div></label><label class="aav-all"><input name="all_day" type="checkbox"> Toute la journée</label><label class="aav-wide">Lieu<input name="location" maxlength="240"></label><label class="aav-wide">Information<textarea name="body" maxlength="1800" rows="3"></textarea></label></div><div class="aav-form-actions"><button type="button" data-aav-cancel>Annuler</button><button type="submit">${submitLabel}</button></div><p data-aav-form-status></p></form></section>`;
  }
  function render(){
    if(!overlay||!state)return;
    const c=state.data.contact||state.data.agent||{},ghe=String(c.ghe||state.data.agent?.ghe||"").replace(/^GHE\s*/i,"");
    overlay.querySelector(".aav-title").textContent=person(c);
    overlay.querySelector(".aav-sub").textContent=[ghe?`GHE ${ghe}`:"",state.data.agent?.role||c.role_metier||"",quotity()?`◐ ${quotity()} %`:""].filter(Boolean).join(" · ");
    overlay.querySelector(".aav-body").innerHTML=`${subscribeHtml()}${contactHtml()}${monthHtml()}${weekHtml()}${eventHtml()}${addForm()}${legendHtml()}`;
    wireBody();
  }
  function moveMonth(step){
    const [y,m]=state.month.split("-").map(Number),d=new Date(y,m-1+Number(step),1,12),k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if(k<state.bounds.min||k>state.bounds.max)return;
    state.month=k;
    const todayKey=today();
    state.selected=todayKey.startsWith(k)?todayKey:firstMondayInMonth(k);
    render();
  }
  async function reload(){
    const data=await post(API,{source_key:state.sourceKey});state.data=data;state.events=events(data);state.bounds=monthBounds(data);render();
  }
  function wireBody(){
    const body=overlay.querySelector(".aav-body");
    body.querySelectorAll("[data-aav-day]").forEach(b=>b.onclick=()=>{state.selected=b.dataset.aavDay;state.month=monthKey(state.selected);render()});
    body.querySelectorAll("[data-aav-month]").forEach(b=>b.onclick=()=>moveMonth(b.dataset.aavMonth));
    body.querySelector("[data-aav-copy]")?.addEventListener("click",async e=>{try{await navigator.clipboard.writeText(e.currentTarget.dataset.aavCopy||"")}catch{}});
    body.querySelectorAll("[data-aav-subscribe]").forEach(btn=>btn.addEventListener("click",()=>subscribe(btn.dataset.aavSubscribe,body.querySelector(".aav-subscribe-status"),btn)));
    const addBtn=body.querySelector("[data-aav-add]"),form=body.querySelector("[data-aav-form]");
    if(addBtn&&form)addBtn.onclick=()=>{addBtn.hidden=true;form.hidden=false};
    body.querySelector("[data-aav-cancel]")?.addEventListener("click",()=>render());
    if(form){
      const defaults={rendezvous:"📅",formation:"🎓",reunion:"👥",information:"ℹ️",autre:"📌"},
        kind=form.elements.event_kind,icon=form.elements.icon;
      kind?.addEventListener("change",()=>{if(icon&&!icon.dataset.custom)icon.value=defaults[kind.value]||"📌"});
      icon?.addEventListener("input",()=>{icon.dataset.custom=icon.value.trim()?"1":""});
      form.querySelector("[data-aav-clear-icon]")?.addEventListener("click",()=>{if(icon){icon.dataset.custom="";icon.value=defaults[kind?.value]||"📌"}});
    }
    form?.addEventListener("submit",async e=>{
      e.preventDefault();const fd=new FormData(form),status=form.querySelector("[data-aav-form-status]"),all=fd.get("all_day")==="on";
      status.textContent="Ajout…";
      try{
        await post(ACTIONS,{action:"agenda_direct",target_agent_id:state.data.agent?.id,title:String(fd.get("title")||"").trim(),body:String(fd.get("body")||"").trim(),event_date:String(fd.get("event_date")||""),display_mode:"event",event_kind:String(fd.get("event_kind")||"autre"),icon:String(fd.get("icon")||"").trim(),all_day:all,start_time:all?null:String(fd.get("start_time")||""),end_time:all?null:String(fd.get("end_time")||""),location:String(fd.get("location")||"").trim(),importance:"normal"});
        status.textContent="Événement ajouté ✓";await reload();
      }catch(err){status.textContent=err.message||"Impossible d’ajouter l’événement."}
    });
  }
  function close(){overlay?.remove();overlay=null;state=null;document.body.classList.remove("aav-open")}
  async function open(sourceKey,fallback={}){
    if(!sourceKey)return;css();close();
    overlay=document.createElement("div");overlay.className="aav-overlay";overlay.innerHTML=`<button class="aav-backdrop" type="button" aria-label="Fermer"></button><section class="aav-panel" role="dialog" aria-modal="true"><header class="aav-head"><button type="button" data-aav-close aria-label="Fermer">‹</button><div><small>AGENDA AGENT</small><strong class="aav-title">${esc(person(fallback))}</strong><span class="aav-sub"></span></div><button type="button" data-aav-refresh aria-label="Actualiser">↻</button></header><main class="aav-body"><div class="aav-loading">Chargement de l’agenda…</div></main></section>`;
    document.body.appendChild(overlay);document.body.classList.add("aav-open");
    overlay.querySelector(".aav-backdrop").onclick=close;overlay.querySelector("[data-aav-close]").onclick=close;overlay.querySelector("[data-aav-refresh]").onclick=()=>reload().catch(()=>{});
    try{
      const data=await post(API,{source_key:sourceKey});
      state={sourceKey,data,events:events(data),selected:today(),month:monthKey(today()),bounds:monthBounds(data)};
      render();
    }catch(err){
      overlay.querySelector(".aav-body").innerHTML=`<div class="aav-error"><strong>Planning indisponible</strong><span>${esc(err.message||"Erreur")}</span></div>`;
    }
  }
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&overlay)close()});
  css();
  window.STIPAgentAgenda={open,close,reload:()=>reload()};
})();