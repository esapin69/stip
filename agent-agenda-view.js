(() => {
  "use strict";
  const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-planning",
        ACTIONS="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions",
        STORE="stip_session_v1";
  let overlay=null,state=null;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let cssLoader=null;
  function css(){
    const existing=document.querySelector('link[data-agent-agenda-css]');
    if(existing){
      if(existing.sheet)return Promise.resolve(existing);
      return new Promise(resolve=>{
        existing.addEventListener("load",()=>resolve(existing),{once:true});
        existing.addEventListener("error",()=>resolve(existing),{once:true});
      });
    }
    if(cssLoader)return cssLoader;
    cssLoader=new Promise(resolve=>{
      const l=document.createElement("link");
      l.rel="stylesheet";
      l.href="agent-agenda-view.css?v=20260924-legend3";
      l.dataset.agentAgendaCss="1";
      l.onload=()=>resolve(l);
      l.onerror=()=>resolve(l);
      document.head.appendChild(l);
    });
    return cssLoader;
  }
  function token(){return localStorage.getItem(STORE)||""}
  async function post(url,body){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const r=await fetch(url,{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json","X-STIP-Session":token()},body:JSON.stringify(body)}),
            j=await r.json().catch(()=>({}));
      if(!r.ok||j.error)throw Error(j.error||`Erreur ${r.status}`);
      return j;
    }catch(err){
      if(err?.name==="AbortError")throw Error("Le planning met trop de temps à répondre. Réessaie.");
      throw err;
    }finally{
      clearTimeout(timeout);
    }
  }
  function iso(d){return d.toISOString().slice(0,10)}
  function dobj(v){return new Date(String(v).slice(0,10)+"T12:00:00")}
  function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
  function add(v,n){const d=dobj(v);d.setDate(d.getDate()+n);return iso(d)}
  function monday(v){const d=dobj(v),x=d.getDay()||7;d.setDate(d.getDate()-x+1);return iso(d)}
  function monthKey(v){return String(v||today()).slice(0,7)}
  function agentWeekRangeLabel(v){
    const start=monday(v),end=add(start,6),a=dobj(start),b=dobj(end);
    const mon=d=>d.toLocaleDateString("fr-FR",{month:"short"}).replace(".","");
    return a.getMonth()===b.getMonth()? `${a.getDate()} → ${b.getDate()} ${mon(b)}` : `${a.getDate()} ${mon(a)} → ${b.getDate()} ${mon(b)}`;
  }
  function agentWeekRelativeLabel(v){
    const s=monday(v),cur=monday(today()),delta=Math.round((dobj(s)-dobj(cur))/604800000);
    if(delta===0)return"CETTE SEMAINE";
    if(delta===1)return"SEMAINE PROCHAINE";
    if(delta===-1)return"SEMAINE PRÉCÉDENTE";
    return"SEMAINE";
  }
  function firstMondayInMonth(k){
    const d=dobj(k+"-01"),day=d.getDay()||7;
    if(day!==1)d.setDate(d.getDate()+(8-day)%7);
    return iso(d);
  }
  function fmtMonth(k){return dobj(k+"-01").toLocaleDateString("fr-FR",{month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase())}
  function shortDay(v){return dobj(v).toLocaleDateString("fr-FR",{weekday:"short"}).replace(".","").toUpperCase()}
  function fullDay(v){return dobj(v).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).replace(/^./,c=>c.toUpperCase())}
  function person(a={}){return window.STIPName?.format?.(a)||[a.prenom,a.nom].filter(Boolean).join(" ").trim()||a.nom||"Agent"}
  function phoneDigits(v){return String(v||"").replace(/\D/g,"")}
  function phoneHref(v){const d=phoneDigits(v);if(!d)return"";return d.startsWith("33")?`tel:+${d}`:`tel:${d}`}
  function hiddenPhoneHref(v){let d=phoneDigits(v);if(!d)return"";if(d.startsWith("33"))d="0"+d.slice(2);return `tel:%2331%23${d}`}
  function syncShiftRegistry(data){
    if(data?.shift_definitions?.length) window.STIPShiftRegistry?.set?.(data.shift_definitions);
  }
  function shiftInfo(raw){
    const src=String(raw||"").trim().toUpperCase(),
      star=src.includes("*"),
      clean=src.replace(/\*+$/,""),
      registry=window.STIPShiftRegistry,
      def=registry?.resolve?.(clean),
      base=registry?.baseCode?.(clean)||clean||"";
    if(def){
      return{
        label:String(def.label||base||"—"),
        time:registry?.time?.(clean)||"",
        icon:String(def.icon||""),
        family:String(def.family||"other"),
        kind:String(def.kind||"other"),
        base,
        raw:src,
        star,
        adapted:String(def.schedule_mode||"standard")!=="standard"||Boolean(def.is_working&&clean!==base),
        isWorking:Boolean(def.is_working),
        color:String(def.color_hex||""),
        softColor:String(def.soft_color_hex||""),
        onColor:String(def.on_color_hex||""),
      };
    }
    return{
      label:clean||"—",
      time:"",
      icon:"•",
      family:"other",
      kind:"other",
      base:clean||"",
      raw:src,
      star,
      adapted:false,
      isWorking:false,
      color:"",
      softColor:"",
      onColor:"",
    };
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
    if(i.family==="rh")return compact?'<span class="stip-month-icon">🏝️</span>':"🏝️";
    if(i.family==="off"||i.family==="other")return compact?`<span class="stip-month-icon">${esc(i.icon)}</span>`:i.icon;
    return compact?`<span class="aav-dot aav-${i.family} stip-month-dot"></span>`:`<span class="aav-dot aav-${i.family}"></span><b>${esc(i.base)}</b>`;
  }
  function monthHtml(){
    const k=state.month,[y,m]=k.split("-").map(Number),first=new Date(y,m-1,1,12),last=new Date(y,m,0,12),lead=(first.getDay()+6)%7,
          plan=byDate(state.data.items),emap=eventMap(state.events),cells=[];
    for(let i=0;i<lead;i++)cells.push('<span class="aav-cal-empty"></span>');
    for(let d=1;d<=last.getDate();d++){
      const day=`${k}-${String(d).padStart(2,"0")}`,row=plan.get(day),ev=emap.get(day)||[],info=shiftInfo(row?.code||row?.source_value||""),weekend=[0,6].includes(dobj(day).getDay()),
            cls=[day===today()?"today is-today":"",day===state.selected?"selected is-selected":"",weekend?"is-weekend":"",row?`shift-${info.family}`:"",ev.length?"has-event":""].filter(Boolean).join(" ");
      cells.push(`<button type="button" class="aav-cal-day stip-month-day ${cls}" data-aav-day="${day}"><b class="stip-month-day-number">${d}</b><span class="aav-cal-shift stip-month-primary">${row?shiftToken(row,true):""}</span><small class="stip-month-events">${ev.slice(0,2).map(x=>x.icon).join("")}</small></button>`);
    }
    const prev=state.month>state.bounds.min,next=state.month<state.bounds.max;
    return `<section class="aav-month stip-month-calendar"><header><button type="button" data-aav-month="-1" ${prev?"":"disabled"}>‹</button><strong>${esc(fmtMonth(k))}</strong><button type="button" data-aav-month="1" ${next?"":"disabled"}>›</button></header><div class="aav-weekheads"><span>LU</span><span>MA</span><span>ME</span><span>JE</span><span>VE</span><span>SA</span><span>DI</span></div><div class="aav-calendar stip-month-grid">${cells.join("")}</div></section>`;
  }
  function quotity(){
    const q=Number(state?.data?.agent?.quotite);
    return Number.isInteger(q)&&q>=1&&q<100?q:0;
  }
  function weekHtml(){
    const start=monday(state.selected),plan=byDate(state.data.items),emap=eventMap(state.events),cards=[];
    for(let i=0;i<7;i++){
      const day=add(start,i),row=plan.get(day),ev=emap.get(day)||[],info=shiftInfo(row?.code||row?.source_value||""),d=dobj(day),
        dayName=d.toLocaleDateString("fr-FR",{weekday:"long"}).replace(".","").toUpperCase().slice(0,2),
        family=info.family||"other",base=info.base||"—",pending=!row,
        codeClass=info.isWorking?`code-${family}`:"",
        statusClass=pending?"pending":info.isWorking?"work":"rest",
        mainIcon=pending?"🚫":String(info.icon||"•"),
        eventHtml=ev.length
          ? `<span class="stip-week-events" aria-label="${ev.length} événement${ev.length>1?"s":""}">${ev.slice(0,2).map(x=>`<i class="stip-week-event" title="${esc(x.title||x.kind||"Événement")}">${esc(x.icon||"•")}</i>`).join("")}</span>`
          : '<span class="stip-week-events is-empty" aria-hidden="true"></span>',
        aria=[fullDay(day),info.label||base,ev.length?`${ev.length} événement${ev.length>1?"s":""}`:""].filter(Boolean).join(", ");
      cards.push(`<button type="button" class="stip-week-day ${statusClass} ${codeClass} ${day===state.selected?"selected":""} ${day===today()?"today":""}" data-aav-day="${day}" aria-pressed="${day===state.selected}" aria-label="${esc(aria)}"><span class="stip-week-day-head"><i>${esc(dayName)}</i><b>${d.getDate()}</b></span><span class="stip-week-day-body"><strong class="stip-week-code">${esc(base)}</strong><span class="stip-week-main"><span class="stip-week-main-icon" aria-hidden="true">${esc(mainIcon)}</span></span><span class="stip-week-divider ${ev.length?"":"is-empty"}" aria-hidden="true"></span>${eventHtml}</span>${info.adapted?'<span class="aav-adapted" title="Horaire adapté">⏱</span>':""}${quotity()?`<span class="aav-part-badge" title="Temps partiel">◐ ${quotity()}%</span>`:""}</button>`);
    }
    return `<section class="aav-week aav-week-home"><header class="aav-week-nav"><button type="button" data-aav-week-step="-1" aria-label="Semaine précédente">‹</button><div><small>${esc(agentWeekRelativeLabel(state.selected))}</small><strong>${esc(agentWeekRangeLabel(state.selected))}</strong></div><button type="button" data-aav-week-step="1" aria-label="Semaine suivante">›</button></header><div class="stip-week-line" style="--stip-week-columns:7">${cards.join("")}</div></section>`;
  }
  function eventHtml(){
    const start=monday(state.selected),end=add(start,6),rows=state.events.filter(x=>x.date>=start&&x.date<=end);
    if(!rows.length)return '<section class="aav-events aav-events-empty"><span>Aucun événement cette semaine.</span></section>';
    return `<section class="aav-events aav-events-home-style"><div class="aav-event-list">${rows.map(x=>{
      const d=dobj(x.date),dateLabel=d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}).replace(".","");
      return `<article class="aav-event-row ${x.date===state.selected?"is-selected-day":""}"><span class="aav-event-icon">${esc(x.icon||"•")}</span><div class="aav-event-copy"><strong>${esc(x.title)}</strong><span class="aav-event-when"><b>${esc(dateLabel)}</b>${x.time?`<b>${esc(x.time)}</b>`:""}${x.location?`<em>${esc(x.location)}</em>`:""}</span>${x.detail?`<small>${esc(x.detail)}</small>`:""}</div></article>`;
    }).join("")}</div></section>`;
  }
  function legendItem(iconHtml,label,meta=""){
    return `<button type="button" class="stip-legend-item" data-aav-legend-key="${esc(label)}" aria-pressed="false"><span class="stip-legend-icon" aria-hidden="true">${iconHtml}</span><span class="stip-legend-bullet" aria-hidden="true">•</span><b>${esc(label)}</b>${meta?`<small>${esc(meta)}</small>`:""}</button>`;
  }
  function legendHtml(){
    const start=monday(state.selected),end=add(start,6),
      pagePlan=(state.data.items||[]).filter(r=>{
        const d=String(r.date||"").slice(0,10);
        return d.startsWith(state.month)||(d>=start&&d<=end);
      }),
      pageEvents=state.events.filter(x=>String(x.date||"").startsWith(state.month)||(x.date>=start&&x.date<=end)),
      weekPlan=byDate((state.data.items||[]).filter(r=>String(r.date||"")>=start&&String(r.date||"")<=end)),
      hasPending=Array.from({length:7},(_,i)=>add(start,i)).some(day=>!weekPlan.has(day)),
      seen=new Map();
    for(const r of pagePlan){const i=shiftInfo(r.code||r.source_value);const key=i.base||i.label;if(!seen.has(key))seen.set(key,i)}
    const items=[...seen.values()].map(i=>legendItem(i.isWorking?`<i class="aav-dot aav-${esc(i.family)}"></i>`:esc(i.icon||"•"),i.label,i.time?`· ${i.time}`:""));
    if(hasPending)items.push(legendItem("🚫","Planning non renseigné"));
    if(pagePlan.some(r=>shiftInfo(r.code||r.source_value).adapted))items.push(legendItem("⏱","Horaire adapté"));
    if(quotity())items.push(legendItem("◐","Temps partiel",`· ${quotity()}%`));
    const kinds=new Map();
    for(const x of pageEvents){
      const icon=String(x.icon||"•").trim()||"•",kind=String(x.kind||"Événement").trim()||"Événement",key=icon+"|"+kind;
      if(!kinds.has(key))kinds.set(key,{icon,kind});
    }
    for(const {icon,kind} of kinds.values())items.push(legendItem(esc(icon),kind));
    const body=items.join("")||legendItem("•","Aucun repère sur la page");
    return `<section class="aav-legend stip-legend"><div class="stip-section-separator"><span>LÉGENDE</span></div><div class="stip-legend-surface"><div class="stip-legend-list">${body}</div></div></section>`;
  }
  function closeCallChoice(){document.getElementById("aavCallOverlay")?.remove()}
  function openCallChoice(phone,name){
    const normal=phoneHref(phone),hidden=hiddenPhoneHref(phone);
    if(!normal||!hidden)return;
    closeCallChoice();
    const o=document.createElement("div");
    o.id="aavCallOverlay";o.className="aav-call-overlay";
    o.innerHTML=`<button class="aav-call-backdrop" type="button" aria-label="Fermer"></button><section class="aav-call-sheet" role="dialog" aria-modal="true" aria-label="Choisir le type d’appel"><div class="aav-call-handle" aria-hidden="true"></div><small>APPELER</small><strong>${esc(name||"Agent")}</strong><div class="aav-call-actions"><a class="primary" href="${esc(normal)}"><span aria-hidden="true">☎</span><b>Appeler</b></a><a href="${esc(hidden)}"><span aria-hidden="true">◉</span><b>Appeler en inconnu</b></a></div><button class="aav-call-cancel" type="button">Annuler</button></section>`;
    document.body.appendChild(o);
    o.querySelector(".aav-call-backdrop").onclick=closeCallChoice;
    o.querySelector(".aav-call-cancel").onclick=closeCallChoice;
    o.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>setTimeout(closeCallChoice,250)));
  }
  function contactHtml(){
    const c=state.data.contact||state.data.agent||{},tel=phoneHref(c.telephone),mail=c.email_pro||c.email||"";
    if(!tel&&!mail)return"";
    return `<div class="aav-contact">${tel?`<a href="${esc(tel)}">☎ ${esc(c.telephone)}</a>`:""}${mail?`<button type="button" data-aav-copy="${esc(mail)}">✉ ${esc(mail)}</button>`:""}</div>`;
  }
  function calendarAccess(){
    const viewer=state?.data?.viewer||{};
    return Boolean(viewer.is_self||viewer.can_manage);
  }
  function calendarHtml(){
    if(!calendarAccess()||(!state?.data?.agent?.id&&!state?.sourceKey))return"";
    return `<section class="aav-calendar-option"><button type="button" class="aav-subscribe" data-aav-subscribe><span aria-hidden="true">📅</span><strong>S’abonner à ce planning</strong><small>Shifts et événements · mise à jour automatique</small><em aria-hidden="true">›</em></button><p data-aav-calendar-status aria-live="polite"></p></section>`;
  }
  let calendarLoader=null;
  function ensureCalendarTools(){
    if(window.STIPCalendars?.quickAgent)return Promise.resolve(window.STIPCalendars);
    if(calendarLoader)return calendarLoader;
    calendarLoader=new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      script.src="calendar-subscriptions.js?v=20260922-agentplanning1";
      script.async=false;
      script.onload=()=>window.STIPCalendars?.quickAgent?resolve(window.STIPCalendars):reject(Error("Outil calendrier indisponible."));
      script.onerror=()=>reject(Error("Chargement du calendrier impossible."));
      document.body.appendChild(script);
    }).catch(err=>{calendarLoader=null;throw err});
    return calendarLoader;
  }
  async function subscribeAgent(button,status){
    if(!button||!state)return;
    button.disabled=true;
    if(status)status.textContent="Préparation du calendrier…";
    try{
      const tools=await ensureCalendarTools(),
        c=state.data.contact||state.data.agent||{};
      await tools.quickAgent({
        agentId:state.data.agent?.id||"",
        sourceKey:state.sourceKey||state.data.agent?.source_key||"",
        name:person(c),
      });
      if(status)status.textContent="";
    }catch(err){
      if(status)status.textContent=err?.message||"Abonnement indisponible.";
    }finally{
      button.disabled=false;
    }
  }
  function addForm(){
    const viewer=state.data.viewer||{};
    if(!viewer.can_manage&&!viewer.is_self)return"";
    const submitLabel=viewer.is_self?"Ajouter à mon agenda":"Ajouter à son agenda";
    return `<section class="aav-manage"><button type="button" class="aav-add" data-aav-add><span>＋</span><strong>Ajouter un événement</strong><small>${viewer.is_self?"À mon planning":"À ce planning"}</small><em>›</em></button><form class="aav-form" data-aav-form hidden><div class="aav-form-grid"><label class="aav-wide">Titre<input name="title" maxlength="180" required placeholder="Ex. Réunion d’équipe"></label><label>Date<input name="event_date" type="date" value="${esc(state.selected)}" required></label><label>Type<select name="event_kind"><option value="rendezvous">Rendez-vous</option><option value="formation">Formation</option><option value="reunion">Réunion</option><option value="information">Information</option><option value="autre" selected>Autre</option></select></label><label>Début<input name="start_time" type="time" value="09:00"></label><label>Fin<input name="end_time" type="time" value="10:00"></label><label class="aav-wide aav-icon-field">Icône <small>Facultatif · une icône est proposée automatiquement</small><div><input name="icon" maxlength="24" inputmode="text" value="📌" aria-label="Icône de l’événement"><button type="button" data-aav-clear-icon>Auto</button></div></label><label class="aav-all"><input name="all_day" type="checkbox"> Toute la journée</label><label class="aav-wide">Lieu<input name="location" maxlength="240"></label><label class="aav-wide">Information<textarea name="body" maxlength="1800" rows="3"></textarea></label></div><div class="aav-form-actions"><button type="button" data-aav-cancel>Annuler</button><button type="submit">${submitLabel}</button></div><p data-aav-form-status></p></form></section>`;
  }
  function agendaSectionSeparator(label){
    return `<div class="aav-period-separator"><span>${esc(label)}</span></div>`;
  }

  function render(){
    if(!overlay||!state)return;
    const c=state.data.contact||state.data.agent||{},ghe=String(c.ghe||state.data.agent?.ghe||"").replace(/^GHE\s*/i,"");
    overlay.querySelector(".aav-title").textContent=person(c);
    overlay.querySelector(".aav-sub").textContent=[ghe?`GHE ${ghe}`:"",state.data.agent?.role||c.role_metier||"",quotity()?`◐ ${quotity()} %`:""].filter(Boolean).join(" · ");
    const call=overlay.querySelector("[data-aav-call]"),phone=c.telephone||state.data.agent?.telephone||"";
    if(call){
      call.hidden=!phone;
      call.dataset.aavCall=phoneDigits(phone);
      call.dataset.aavCallName=person(c);
      call.setAttribute("aria-label",phone?`Choisir comment appeler ${person(c)}`:"Appel indisponible");
    }
    overlay.querySelector(".aav-body").innerHTML=`${contactHtml()}${agendaSectionSeparator("SEMAINE")}${weekHtml()}${agendaSectionSeparator("MOIS")}${monthHtml()}${eventHtml()}${addForm()}${calendarHtml()}${legendHtml()}`;
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
    const data=await post(API,{source_key:state.sourceKey});syncShiftRegistry(data);state.data=data;state.events=events(data);state.bounds=monthBounds(data);render();
  }
  function wireBody(){
    const body=overlay.querySelector(".aav-body");
    body.querySelectorAll("[data-aav-day]").forEach(b=>b.onclick=()=>{state.selected=b.dataset.aavDay;state.month=monthKey(state.selected);render()});
    body.querySelectorAll("[data-aav-week-step]").forEach(b=>b.onclick=()=>{state.selected=add(monday(state.selected),Number(b.dataset.aavWeekStep||0)*7);state.month=monthKey(state.selected);render()});
    body.querySelectorAll("[data-aav-month]").forEach(b=>b.onclick=()=>moveMonth(b.dataset.aavMonth));
    body.querySelectorAll("[data-aav-legend-key]").forEach(b=>b.addEventListener("click",()=>{
      const next=b.getAttribute("aria-pressed")!=="true";
      body.querySelectorAll("[data-aav-legend-key]").forEach(x=>x.setAttribute("aria-pressed","false"));
      b.setAttribute("aria-pressed",next?"true":"false");
      b.dispatchEvent(new CustomEvent("stip:legend-select",{bubbles:true,detail:{key:b.dataset.aavLegendKey||"",selected:next}}));
    }));
    body.querySelector("[data-aav-copy]")?.addEventListener("click",async e=>{try{await navigator.clipboard.writeText(e.currentTarget.dataset.aavCopy||"")}catch{}});
    const subscribe=body.querySelector("[data-aav-subscribe]");
    subscribe?.addEventListener("click",()=>subscribeAgent(subscribe,body.querySelector("[data-aav-calendar-status]")));
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
  function close(){closeCallChoice();overlay?.remove();overlay=null;state=null;document.body.classList.remove("aav-open")}
  async function open(sourceKey,fallback={}){
    sourceKey=String(sourceKey||fallback?.source_key||"").trim();
    if(!sourceKey)return;
    await css();
    close();
    overlay=document.createElement("div");overlay.className="aav-overlay";overlay.innerHTML=`<button class="aav-backdrop" type="button" aria-label="Fermer"></button><section class="aav-panel" role="dialog" aria-modal="true"><header class="aav-head"><button type="button" data-aav-close aria-label="Fermer">‹</button><div class="aav-head-copy"><small>AGENDA AGENT</small><div class="aav-title-row"><strong class="aav-title">${esc(person(fallback))}</strong><button type="button" class="aav-title-call" data-aav-call hidden aria-label="Appeler">☎</button></div><span class="aav-sub"></span></div><button type="button" data-aav-refresh aria-label="Actualiser">↻</button></header><main class="aav-body"><div class="aav-loading"><strong>Chargement de l’agenda…</strong></div></main></section>`;
    document.body.appendChild(overlay);document.body.classList.add("aav-open");
    overlay.querySelector(".aav-backdrop").onclick=close;overlay.querySelector("[data-aav-close]").onclick=close;overlay.querySelector("[data-aav-refresh]").onclick=()=>reload().catch(()=>{});
    overlay.querySelector("[data-aav-call]").onclick=e=>openCallChoice(e.currentTarget.dataset.aavCall,e.currentTarget.dataset.aavCallName);
    try{
      const data=await post(API,{source_key:sourceKey});
      syncShiftRegistry(data);
      state={sourceKey,data,events:events(data),selected:today(),month:monthKey(today()),bounds:monthBounds(data)};
      render();
    }catch(err){
      overlay.querySelector(".aav-body").innerHTML=`<div class="aav-error"><strong>Planning indisponible</strong><span>${esc(err.message||"Erreur")}</span></div>`;
    }
  }
  document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(document.getElementById("aavCallOverlay"))return closeCallChoice();if(overlay)close()});
  css();
  window.STIPAgentAgenda={open,close,reload:()=>reload()};
})();