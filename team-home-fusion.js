(() => {
  "use strict";
  // Accueil fusionne : les sources restent celles d'Esprit d'equipe.
  const ROOT = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/";
  const SESSION = "stip_session_v1";
  const TTL = 120000;
  const weeks = new Map(), days = new Map(), assistants = new Map(), activities = new Map(), chiefsCache = new Map();
  let owner = "";
  let activeHost = null;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateObj = (v) => new Date(String(v).slice(0,10) + "T12:00:00");
  const iso = (d) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
  function monday(day) { const d=dateObj(day); d.setDate(d.getDate()-((d.getDay()+6)%7)); return iso(d); }
  function addDay(day, n) { const d=dateObj(day); d.setDate(d.getDate()+n); return iso(d); }
  function name(a) { return window.STIPName?.format?.(a) || [a?.prenom,a?.nom].filter(Boolean).join(" ") || "Agent"; }
  function base(code) { return window.STIPShiftRegistry?.baseCode?.(code) || String(code||"").toUpperCase().replace(/\d+$/,""); }
  function definition(code) { return window.STIPShiftRegistry?.resolve?.(code) || null; }
  function shiftLabel(code) { const d=definition(code)||definition(base(code)); return d?.label || base(code) || "Sans poste"; }
  function shiftTime(code, row={}) {
    const direct=String(row?.horaire||row?.horaires||row?.shift_time||"").trim();
    if(direct) return direct;
    const from=String(row?.start_time||"").slice(0,5), to=String(row?.end_time||"").slice(0,5);
    if(from||to) return [from,to].filter(Boolean).join("–");
    return window.STIPShiftRegistry?.time?.(code,{role:row?.agents?.role||row?.role||"",team:row?.equipe||row?.agents?.type_planning||""}) || "";
  }
  function range(value) {
    const matches=String(value||"").match(/\d{1,2}(?::|h)\d{2}/g)||[];
    if(matches.length<2) return null;
    const number=(s)=>{const x=s.replace("h",":").split(":").map(Number);return x[0]*60+x[1];};
    const start=number(matches[0]);let end=number(matches[1]); if(end<=start) end+=1440;
    return [start,end];
  }
  async function post(fn,body) {
    const token=localStorage.getItem(SESSION)||"";
    if(!token)throw Error("Session expirée");
    if(owner!==token){owner=token; weeks.clear();days.clear();assistants.clear();activities.clear();chiefsCache.clear();}
    const response=await fetch(ROOT+fn,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","X-STIP-Session":token},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data?.error)throw Error(data?.error||"Service indisponible");
    return data;
  }
  function remember(map,key,loader) {
    let item=map.get(key);
    if(item && Date.now()-item.at<TTL)return Promise.resolve(item.data);
    if(item?.promise)return item.promise;
    if(!item)item={data:null,at:0,promise:null};
    item.promise=loader().then((data)=>{item.data=data;item.at=Date.now();return data;})
      .catch((err)=>{ if(item.data)return item.data;throw err; })
      .finally(()=>{item.promise=null;});
    map.set(key,item);
    return item.promise;
  }
  function cached(map,key) { return map.get(key)?.data || null; }
  function getWeek(start) {return remember(weeks,start,()=>post("stip-data",{action:"spirit_week",start_date:start,end_date:addDay(start,6)}));}
  function getStaff(day) {return remember(days,day,()=>post("stip-staffing",{action:"day",date:day}));}
  function getAssistant(start){return remember(assistants,start,()=>post("stip-assistant",{action:"feed",start_date:start,end_date:addDay(start,6)}));}
  function getActivity(day){return remember(activities,day,()=>post("stip-cadre",{action:"dashboard",date:day}));}
  function getChiefs(){return remember(chiefsCache,"duty",()=>post("stip-data",{action:"duty_chiefs"}));}
  const staffRows=(x)=>Array.isArray(x?.rows)?x.rows:(Array.isArray(x?.shifts)?x.shifts:[]);
  function staffFor(staff,code) {
    return staffRows(staff).find(x=>base(x.shift_code||x.shift||x.code)===code)||null;
  }
  function gap(row) {
    if(row?.gap!=null&&Number.isFinite(Number(row.gap)))return Number(row.gap);
    if(row?.planned_count==null||row?.target_count==null)return null;
    return Number(row.planned_count)-Number(row.target_count);
  }
  function isChef(x){return /chef/i.test(String(x?.agents?.role||""))||String(x?.equipe||"").toLowerCase()==="chefs"||String(x?.agents?.type_planning||"").toLowerCase()==="chefs";}
  function agentHtml(x) {
    const a=x.agents||{},ghe=String(a.ghe||"").replace(/^GHE\s*/i,"");
    const key=String(a.source_key||"");
    const role=isChef(x)?"Chef d'équipe":String(a.role||"Brancardier");
    const quotite=Number(a.quotite);
    const badges=[base(x.code)!==String(x.code||"").toUpperCase()? "⏱" : "",quotite>0&&quotite<100?"◐ "+quotite+"%":""].filter(Boolean).join(" ");
    return '<button class="thf-agent" type="button" data-thf-agent="'+esc(key)+'" '+(key?"":"disabled")+'><span class="thf-agent-ghe">GHE '+esc(ghe||"—")+'</span><span><strong>'+esc(name(a))+'</strong><small>'+esc(role)+' '+esc(badges)+'</small></span><span aria-hidden="true">›</span></button>';
  }
  function sortPeople(x,y){const nr=z=>Number(String(z.agents?.ghe||"").match(/\d+/)?.[0]||99999);return nr(x)-nr(y)||name(x.agents).localeCompare(name(y.agents),"fr");}

  // Le même contrôle contact que la carte Chef présent, coloré selon le shift.
  // La zone nom ouvre la fiche agent ; le combiné ouvre le choix d'appel existant.
  function chiefContactHtml(item){
    const a=item.agents||{},key=String(a.source_key||""),label=name(a);
    const phone=String(a.telephone||"").replace(/\D/g,"");
    const code=String(item.code||""),time=shiftTime(code,{
      ...item,agents:{...a,role:"chef",type_planning:"chefs"}
    });
    const hours=[shiftLabel(code),time||"Horaires non renseignés"].join(" · ");
    return '<div class="thf-chief-contact '+shiftClass(code)+'">'+
      '<button type="button" class="thf-chief-identity" data-thf-agent="'+esc(key)+'" '+
      (key?'':'disabled ')+'aria-label="Voir la fiche de '+esc(label)+'">'+
      '<strong>'+esc(label)+'</strong><small>'+esc(hours)+'</small></button>'+
      '<button type="button" class="thf-chief-phone" '+(phone?
         'data-thf-chief-call="'+esc(phone)+'" data-thf-chief-name="'+esc(label)+'"':
         'disabled title="Numéro de téléphone indisponible"')+
      ' aria-label="'+esc(phone?'Appeler '+label:'Numéro indisponible pour '+label)+'">'+
      '<span aria-hidden="true">☎</span></button>'+
      '</div>';
  }
  // Same data definitions and colors as the Esprit d'équipe engine.
  function shiftClass(code){const k=base(code).toLowerCase();return /^(m|j|j4|s|n)$/.test(k)?"shift-"+k:"shift-other";}
  function peopleGroups(rows){
    const groups=new Map();
    for(const item of rows){
      const code=String(item.code||""),working=Boolean(window.STIPShiftRegistry?.isWorking?.(code));
      let label=String(window.STIPShiftRegistry?.displayName?.(code)||shiftLabel(code)||"Non renseigné").trim();
      const normalized=label.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
      if(/malad/.test(normalized))label="Maladie";
      else if(/\brtt\b/.test(normalized))label="RTT";
      else if(/conge pay/.test(normalized))label="Congé payé";
      else if(/^rh$|^repos$/.test(normalized))label="Repos";
      const key=working?"work:"+base(code):"status:"+label.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
      if(!groups.has(key))groups.set(key,{label,code,working,items:[]});
      groups.get(key).items.push(item);
    }
    return [...groups.values()].sort((a,b)=>Number(b.working)-Number(a.working)||
      (a.working?Number(definition(a.code)?.sort_order||999)-Number(definition(b.code)?.sort_order||999):0)||
      a.label.localeCompare(b.label,"fr"));
  }
  function peopleGroupHtml(group){
    const label=group.label,working=group.working;
    const lowered=label.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const icon=working?"":/malad/.test(lowered)?"🩺":/rtt/.test(lowered)?"🕒":
      /conge/.test(lowered)?"🏖️":/repos/.test(lowered)?"🛋️":/formation/.test(lowered)?"🎓":
      /csn/.test(lowered)?"📋":window.STIPShiftRegistry?.icon?.(group.code)||"📅";
    const time=working?shiftTime(group.code):"";
    return '<section class="thf-person-group '+(working?shiftClass(group.code):"shift-absence")+'">'+
      '<div class="stip-section-separator thf-person-group-heading" role="heading" aria-level="3"><span>'+
      (icon?'<i aria-hidden="true">'+esc(icon)+'</i>':"")+esc(label)+
      (time?'<small>'+esc(time)+'</small>':"")+
      '<b>'+group.items.length+'</b></span></div>'+
      '<div class="thf-person-group-body">'+group.items.slice().sort(sortPeople).map(agentHtml).join("")+'</div></section>';
  }
  function shiftHtml(code,rows,staff){
    const rec=staffFor(staff,code),target=rec?.target_count,planned=rec?.planned_count,delta=gap(rec);
    const signal=window.STIPFieldIntel?.shiftStatus?.(staff,code)||null;
    const level=signal?.level||(delta==null?"unknown":delta<0?"warning":delta>0?"opportunity":"ok");
    const symbol=level==="critical"?"🛑":level==="warning"?"⚠️":level==="opportunity"?"+":level==="ok"?"✓":"○";
    const coworkers=rows.filter(x=>!isChef(x)).sort(sortPeople);
    return '<div class="thf-staff-row '+shiftClass(code)+'">'+
      '<div class="thf-staff-reference">'+
      (target==null?'<span class="thf-hcl-reference is-empty">HCL —</span>':
      '<span class="thf-hcl-reference"><small>HCL</small><b>'+esc(target)+'</b></span>')+
      '<span class="thf-staff-indicator status-'+esc(level)+'" aria-label="État de l’effectif">'+symbol+'</span></div>'+
      '<details class="thf-shift '+shiftClass(code)+' status-'+esc(level)+'"><summary>'+
      '<span class="thf-shift-copy"><strong>'+esc(shiftLabel(code))+'</strong>'+
      '<small>'+esc(shiftTime(code))+'</small></span>'+
      '<span class="thf-shift-count">'+esc(planned==null?"—":planned)+'</span>'+
      '<span class="thf-shift-arrow" aria-hidden="true">⌄</span></summary>'+
      '<div class="thf-shift-detail">'+
      (delta==null?'<p>Effectif HCL non renseigné.</p>':
      '<p>Écart à la cible HCL : <strong>'+(delta>0?"+":"")+esc(delta)+'</strong></p>')+
      (coworkers.length?coworkers.map(agentHtml).join(""):
      '<p>Aucun agent à afficher.</p>')+'</div></details></div>';
  }
  function appointments(data,day) {
    const items=[];
    const add=(icon,title,detail)=>{if(title&&!items.some(x=>x.title===title&&x.detail===detail))items.push({icon,title,detail});};
    for(const x of data?.agenda_items||[])if(String(x.event_date||"").slice(0,10)===day)
      add(x.icon||"📌",x.title||"Rendez-vous",[x.start_time,x.end_time,x.place||x.location].filter(Boolean).join(" · "));
    for(const x of data?.personal_formations||[])if(String(x.date_debut||"").slice(0,10)<=day&&String(x.date_fin||x.date_debut||"").slice(0,10)>=day)
      add("🎓",x.intitule||"Formation",[x.horaire,x.lieu].filter(Boolean).join(" · "));
    for(const x of data?.personal_stagiaires||[])if(String(x.date_debut||"").slice(0,10)<=day&&String(x.date_fin||x.date_debut||"").slice(0,10)>=day)
      add("👶","Stagiaire",[x.horaires,x.lieu].filter(Boolean).join(" · "));
    return items;
  }
  function notes(assistant,activity,staff,day){
    const out=[], seen=new Set();
    const add=(icon,title,detail,level)=>{
      const key=(title+"|"+detail).toLowerCase();if(!title||seen.has(key))return;seen.add(key);
      out.push({icon,title,detail,level:level||"info"});
    };
    for(const x of activity?.day?.alerts||[])add(Number(x.severity)>=4?"🛑":"⚠️",x.title||"Alerte",x.body||x.note||x.description||"","warning");
    for(const x of activity?.day?.events?.formations||[])add("🎓",x.title||"Formation",[x.horaire,x.lieu].filter(Boolean).join(" · "));
    for(const x of activity?.day?.events?.stagiaires||[])add("👶",x.name||"Stagiaire",[x.horaires,x.referent].filter(Boolean).join(" · "));
    for(const x of assistant?.items||[]){
      if(String(x.date||"").slice(0,10)!==day)continue;
      const family=String(x.source_family||"");
      // Ne pas montrer le vocabulaire de supervision interne aux agents.
      if(["staffing","compound"].includes(family)||x.context?.shift_code||x.context?.shift)continue;
      const info=window.STIPFieldIntel?.terrainItem?.(x);
      add(family==="formation"?"🎓":family==="trainee"?"👶":"ℹ",info?.headline||x.title||"Information",info?.detail||x.body||"",Number(x.severity)>=4?"critical":Number(x.severity)>=2?"warning":"info");
    }
    const missing=staffRows(staff).filter(x=>gap(x)!=null&&gap(x)<0);
    if(missing.length)add("⚠️","Effectif inférieur à la cible HCL","Créneaux concernés : "+missing.map(x=>shiftLabel(base(x.shift_code||x.shift||x.code))).join(", "),"warning");
    return out;
  }
  function noteButtons(items) {
    return items.map((x,i)=>'<button class="thf-note status-'+esc(x.level||"info")+'" type="button" data-thf-note="'+i+'"><span>'+esc(x.icon||"ℹ")+'</span><strong>'+esc(x.title)+'</strong><span aria-hidden="true">›</span></button>').join("");
  }
  // L'accueil ne déroule jamais le personnel : uniquement une synthèse compacte.
  // Les listes et les effectifs détaillés sont montés sur demande, dans un dialogue.

  // Une carte par jour : informations prioritaires au premier coup d'oeil.
  // Les listes restent dans les popups, pas dans les deux colonnes.
  function chiefForDay(day,myTime,working,team){
    const listed=Array.isArray(team?.planning)?
      team.planning.filter(x=>String(x.date||"").slice(0,10)===day&&isChef(x)):[];
    const fallback=Array.isArray(cached(chiefsCache,"duty")?.items)?
      cached(chiefsCache,"duty").items.filter(x=>String(x.date||"").slice(0,10)===day):[];
    // Seuls les shifts effectivement travaillés : les codes RH, F0, CP, maladie,
    // formation et toute absence ne désignent jamais un chef en poste.
    const all=listed.length?listed:fallback;
    const registry=window.STIPShiftRegistry;
    const workingChief=x=>{
      const def=registry?.resolveFor?.(x.code,{team:"chefs"})||definition(x.code);
      return Boolean(def?.is_working)&&Boolean(
        range(shiftTime(x.code,{...x,agents:{...x.agents,role:"chef",type_planning:"chefs"}}))
      );
    };
    const seen=new Set();
    return all.filter(x=>{
      if(!workingChief(x))return false;
      const key=[x.agents?.source_key||name(x.agents),base(x.code)].join("|");
      if(seen.has(key))return false;seen.add(key);return true;
    }).sort((a,b)=>String(shiftTime(a.code,{...a,agents:{...a.agents,role:"chef",type_planning:"chefs"}}))
       .localeCompare(String(shiftTime(b.code,{...b,agents:{...b.agents,role:"chef",type_planning:"chefs"}}))));
  }
  function paint(host,opts){
    if(!host?.isConnected)return;
    const day=String(opts.day||"").slice(0,10),start=monday(day);
    const row=(opts.personal||[]).find(x=>String(x.date||"").slice(0,10)===day);
    const myCode=String(row?.code||row?.source_value||"").trim();
    const working=Boolean(definition(myCode)?.is_working);
    const myTime=working?shiftTime(myCode,row):"";
    const myBase=base(myCode),myInterval=range(myTime),perm=opts.permissions||{};
    const team=perm.planning_team?cached(weeks,start):null;
    const staff=perm.planning_team?cached(days,day):null;
    const assistant=perm.assistant_enabled?cached(assistants,start):null;
    const activity=perm.activity?cached(activities,day):null;
    const loaded=Array.isArray(team?.planning);
    const agents=loaded?team.planning.filter(x=>String(x.date||"").slice(0,10)===day):[];
    const visible=agents.filter(x=>!isChef(x)&&
      (!opts.sourceKey||String(x.agents?.source_key||"")!==String(opts.sourceKey))&&
      (!opts.ghe||String(x.agents?.ghe||"").replace(/^GHE\s*/i,"")!==String(opts.ghe).replace(/^GHE\s*/i,"")));
    // Tous les shifts travaillés sont visibles, y compris la famille de l'utilisateur.
    const onDuty=visible.filter(x=>Boolean(definition(x.code)?.is_working));
    // "Même horaire" compare les heures effectives, pas seulement M/J/J4/S/N.
    const exact=working?onDuty.filter(x=>{
      const hours=range(shiftTime(x.code,x));
      return myInterval&&hours?
        hours[0]===myInterval[0]&&hours[1]===myInterval[1]:
        base(x.code)===myBase;
    }):[];
    const elsewhere=visible.filter(x=>!onDuty.includes(x));
    const chiefs=chiefForDay(day,myTime,working,team);
    const groups=new Map();
    for(const x of agents){const code=base(x.code);if(!definition(code)?.is_working)continue;
      if(!groups.has(code))groups.set(code,[]);groups.get(code).push(x);}
    for(const x of staffRows(staff)){const code=base(x.shift_code||x.shift||x.code);
      if(definition(code)?.is_working&&!groups.has(code))groups.set(code,[]);}
    const ord=x=>Number(definition(x)?.sort_order||999);
    const shifts=[...groups].sort((a,b)=>ord(a[0])-ord(b[0]))
      .map(([code,list])=>shiftHtml(code,list,staff)).join("");
    const infos=[...appointments(opts.boot,day),...notes(assistant,activity,staff,day)];
    const uniqueInfos=[],seen=new Set();
    for(const item of infos){const key=(item.title+"|"+(item.detail||"")).toLowerCase();
      if(!seen.has(key)){seen.add(key);uniqueInfos.push(item);}}
    host._thfAgents=[...agents,...chiefs.filter(x=>!agents.some(y=>y.agents?.source_key===x.agents?.source_key))];
    host._thfChiefs=chiefs;host._thfNotes=uniqueInfos;
    host._thfSets={exact:exact.sort(sortPeople),onDuty:onDuty.sort(sortPeople),
      elsewhere:elsewhere.sort(sortPeople)};
    host._thfShifts=shifts;
    const today=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Europe/Paris"}).format(new Date());
    const label=day===today?"Aujourd’hui":day===addDay(today,1)?"Demain":"Jour sélectionné";
    const dayLabel=dateObj(day).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
    const longDate=dateObj(day).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
    const rec=working?staffFor(staff,myBase):null;
    const planned=rec?.planned_count,target=rec?.target_count,delta=gap(rec);
    const hcl=planned!=null&&target!=null?planned+"/"+target:"—";
    const status=delta==null?"unknown":delta<0?"warning":delta>0?"opportunity":"ok";
    const badge=delta==null?"○":delta<0?"⚠":delta>0?"+":"✓";
    const chiefLabel=chiefs.length?chiefs.map(x=>name(x.agents)).join(", "):
      loaded?"Aucun chef en poste renseigné":"Chargement du planning chef…";
    const chiefDisplay=chiefs.length?chiefs.map(chiefContactHtml).join(""):
      '<span class="thf-chief-missing">'+esc(chiefLabel)+'</span>';
    const leisureEvents=window.STIPLeisure?.dayItems?.(day)||[];
    host._thfLeisureEvents=leisureEvents;
    // Une colonne est une fiche lisible ; chaque action est un bouton distinct,
    // jamais un énorme bouton englobant les autres fonctionnalités.
    host.innerHTML=
      '<article class="thf-day-card '+(working?shiftClass(myCode):"shift-absence")+'">'+
      '<button type="button" class="thf-day-trigger" data-thf-open="day" aria-label="Détails '+esc(label)+'">'+
      '<span class="thf-day-heading"><strong>'+esc(label)+'</strong><small>'+esc(dayLabel)+'</small></span>'+
      '<span class="thf-trigger-chevron" aria-hidden="true">›</span></button>'+
      '<div class="thf-day-body">'+
      '<div class="thf-day-post"><span class="thf-shift-content"><strong>'+
      esc(working?shiftLabel(myCode):myCode?shiftLabel(myCode):"Sans poste")+
      '</strong><small>'+esc(myTime||"Pas de service")+'</small></span>'+
      (perm.planning_team?'<button type="button" class="thf-shift-colleagues" data-thf-open="people" '+
        'aria-label="Voir les '+(loaded?exact.length:"…")+' collègues sur mon horaire '+esc(label)+'">'+
        '<span aria-hidden="true">👥</span><b>'+(loaded?exact.length:"…")+'</b></button>':"")+
      '</div>'+
      '<section class="thf-day-chief" aria-label="Chefs effectivement en service">'+
      '<div class="thf-section-label"><span aria-hidden="true">🎨</span> CHEFS EN POSTE</div>'+
      '<div class="thf-day-chief-person">'+chiefDisplay+'</div></section>'+
      (working&&myTime?
        '<div class="thf-day-weather"><div class="thf-section-label">🌤 MÉTÉO PENDANT MON POSTE</div>'+
        '<div class="thf-inline-weather hc-shift-weather" data-thf-weather hidden></div>'+
        '<small class="thf-weather-fallback">Prévisions indisponibles</small></div>':
        '')+
      '<div class="thf-day-numbers">'+
      (perm.planning_team?'<button type="button" data-thf-open="staff" class="status-'+esc(status)+
        '" aria-label="Voir les effectifs HCL '+esc(label)+'"><i>'+badge+'</i> <b>'+esc(hcl)+
        '</b><small>HCL</small></button>':"")+
      '</div>'+
      (leisureEvents.length?'<section class="thf-day-events" aria-label="Activités du jour">'+
        '<div class="thf-section-label">📅 APRÈS LE SERVICE</div>'+
        leisureEvents.slice(0,2).map(item=>
          '<button type="button" class="thf-day-event" data-ev3-preview="'+esc(item.id)+
          '" aria-label="'+esc(item.title)+' · '+esc(item.stateLabel||item.status||"")+'">'+
          '<span class="thf-event-icon" aria-hidden="true">'+esc(item.icon)+'</span>'+
          '<span class="thf-event-copy"><strong>'+esc(item.title)+'</strong>'+
          '<small>'+esc(item.time)+'</small>'+
          '<em class="'+esc(item.confirmed?"is-confirmed":"is-proposed")+'">'+
          esc(item.stateLabel||item.status||"Proposition")+'</em></span>'+
          '<span class="thf-event-chevron" aria-hidden="true">›</span></button>').join("")+
        (leisureEvents.length>2?'<button type="button" class="thf-extra-link" data-thf-open="day">+'+
          (leisureEvents.length-2)+' autres activités ›</button>':"")+'</section>':"")+
      (uniqueInfos.length?'<button type="button" class="thf-day-brief" data-thf-open="notes">📌 '+
        uniqueInfos.length+' info'+(uniqueInfos.length>1?"s":"")+' à retenir ›</button>':"")+
      '</div>'+
      '<button type="button" class="thf-day-more" data-thf-open="day">Voir les détails <span aria-hidden="true">›</span></button>'+
      '</article>';
    const weather=host.querySelector?.("[data-thf-weather]");
    if(weather&&window.STIPShiftWeather?.mount){
      const hours=String(myTime||"").match(/\d{1,2}(?:h|:)\d{2}/g)||[];
      if(hours.length>=2)window.STIPShiftWeather.mount(weather,{
        date:day,start:hours[0],end:hours[1],isWorking:working,compact:true
      }).catch?.(()=>{});
    }
    host._thfSummary={label,longDate,chefLabel:chiefLabel,myCode,myTime,working,hcl,status,badge,ownPost:working?shiftLabel(myCode):shiftLabel(myCode)};
  }
  function openDay(host){
    activeHost=host;
    const s=host._thfSummary;
    if(!s)return;
    const chiefs=host._thfChiefs||[];
    const chiefHTML=chiefs.length?
      chiefs.map(chiefContactHtml).join(""):'<p class="thf-empty">Aucune affectation de chef disponible dans le planning pour ce jour. Les données ne sont pas encore transmises.</p>';
    const weather=host.querySelector?.("[data-thf-weather]");
    const weatherText=weather&&!weather.hidden?String(weather.textContent||"").replace(/\s+/g," ").trim():"Prévision indisponible pour les horaires du service";
    const same=(host._thfSets?.exact||[]).length;
    const onDuty=(host._thfSets?.onDuty||[]).length;
    const info=(host._thfNotes||[]).length;
    showDialog('<small>MA JOURNÉE · ÉQUIPE</small><h2>'+esc(s.label)+' · '+esc(s.longDate)+'</h2>'+
      '<section class="thf-day-popup-shift '+(s.working?shiftClass(s.myCode):"shift-absence")+'"><strong>'+esc(s.ownPost)+'</strong>'+
      '<span>'+esc(s.myTime||"Aucun horaire de poste")+'</span></section>'+
      '<section class="thf-day-popup-group"><h3>🎨 Chefs en service ce jour</h3>'+chiefHTML+'</section>'+
      (s.working?'<section class="thf-day-popup-group"><h3>🌤 Météo pendant le poste</h3><p>'+esc(weatherText)+'</p></section>':"")+
      ((host._thfLeisureEvents||[]).length?'<section class="thf-day-popup-group"><h3>📅 Rendez-vous entre collègues</h3>'+
        host._thfLeisureEvents.map(item=>'<button type="button" class="thf-day-popup-event" data-ev3-preview="'+esc(item.id)+'">'+
          '<span aria-hidden="true">'+esc(item.icon)+'</span><strong>'+esc(item.title)+'</strong><small>'+esc(item.time)+'</small><b>›</b></button>').join("")+
        '</section>':"")+
      '<div class="thf-day-popup-actions">'+
      '<button type="button" data-thf-open="people">👥 Collègues · '+same+' même horaire, '+onDuty+' en service ›</button>'+
      '<button type="button" data-thf-open="staff">'+esc(s.badge)+' Effectifs HCL · '+esc(s.hcl)+' ›</button>'+
      (info?'<button type="button" data-thf-open="notes">📌 À retenir · '+info+' ›</button>':"")+
      '</div>');
  }
  function peoplePanel(host,kind){
    const rows=host?._thfSets?.[kind]||[],panel=document.getElementById("thfPopupResults");
    if(!panel)return;
    const groups=peopleGroups(rows);
    const empty={exact:"Aucun collègue avec les mêmes horaires.",
      onDuty:"Aucun collègue en service ce jour.",
      elsewhere:"Aucun autre agent à afficher."};
    panel.innerHTML=groups.length?groups.map(peopleGroupHtml).join(""):
      '<p class="thf-empty">'+esc(empty[kind]||"Aucun collègue à afficher.")+'</p>';
    document.querySelectorAll("#thfPopup [data-thf-people-tab]").forEach(button=>
      button.setAttribute("aria-pressed",String(button.dataset.thfPeopleTab===kind)));
    panel.scrollTop=0;
  }
  function openPeople(host) {
    activeHost=host;
    const sets=host._thfSets||{},numbers={
      exact:(sets.exact||[]).length,onDuty:(sets.onDuty||[]).length,
      elsewhere:(sets.elsewhere||[]).length
    };
    showDialog('<small>PLANNING ÉQUIPE</small><h2>Collègues du jour</h2>'+
      '<div class="thf-people-tabs" role="group" aria-label="Filtrer les collègues">'+
      '<button type="button" data-thf-people-tab="exact" aria-pressed="true">Même horaire <b>'+numbers.exact+'</b></button>'+
      '<button type="button" data-thf-people-tab="onDuty" aria-pressed="false">En service <b>'+numbers.onDuty+'</b></button>'+
      '<button type="button" data-thf-people-tab="elsewhere" aria-pressed="false">Autres <b>'+numbers.elsewhere+'</b></button>'+
      '</div><div class="thf-popup-scroll" id="thfPopupResults"></div>');
    peoplePanel(host,"exact");
  }
  function openStaff(host) {
    activeHost=host;
    showDialog('<small>EFFECTIFS · HCL</small><h2>Effectifs par horaire</h2>'+
      '<p class="thf-popup-intro">Appuie sur un horaire pour voir les agents et l’écart HCL.</p>'+
      '<div class="thf-popup-scroll">'+
      (host._thfShifts||'<p class="thf-empty">Aucune information disponible.</p>')+'</div>');
  }
  function openNotes(host) {
    activeHost=host;
    showDialog('<small>INFORMATIONS DU JOUR</small><h2>À retenir</h2>'+
      '<div class="thf-popup-scroll">'+noteButtons(host._thfNotes||[])+'</div>');
  }
  function openNote(host,index) {
    const note=host?._thfNotes?.[index];if(!note)return;
    showDialog('<small>INFORMATION DU JOUR</small><h2>'+esc(note.title)+'</h2><p>'+esc(note.detail||"Aucune précision supplémentaire.")+'</p>');
  }
  function showDialog(content){
    document.getElementById("thfPopup")?.remove();
    const node=document.createElement("dialog");node.id="thfPopup";node.className="thf-popup";
    node.innerHTML='<button type="button" data-thf-close aria-label="Fermer" class="thf-popup-close">×</button>'+content;
    document.body.appendChild(node);node.showModal?.();if(!node.open)node.setAttribute("open","");
    node.querySelector("[data-thf-close]")?.addEventListener("click",()=>node.close?.());
    node.addEventListener("close",()=>node.remove());
    node.addEventListener("click",(e)=>{if(e.target===node)node.close?.();});
  }
  function mount(opts){
    const host=document.getElementById(opts.hostId||"hcTeamFusion");
    if(!host)return;
    const day=String(opts.day||"").slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return;
    host._thfOptions=opts;host.dataset.thfDay=day;
    paint(host,opts);
    const start=monday(day),perm=opts.permissions||{};
    const requests=[];
    if(perm.planning_team){
      requests.push(getStaff(day));
      requests.push(getWeek(start).then(bundle=>{
        const hasDayChief=(bundle?.planning||[]).some(x=>String(x.date||"").slice(0,10)===day&&isChef(x));
        if(!hasDayChief)return getChiefs();
        return bundle;
      }));
    }
    if(perm.assistant_enabled)requests.push(getAssistant(start));
    if(perm.activity)requests.push(getActivity(day));
    for(const req of requests)Promise.resolve(req).then(()=>{
      if(host.isConnected&&host.dataset.thfDay===day)paint(host,opts);
    }).catch(()=>{if(host.isConnected&&host.dataset.thfDay===day)paint(host,opts);});
  }
  // Une fenêtre d'événement remplace la fenêtre du jour, sans deux modales empilées.
  document.addEventListener("click",event=>{
    if(event.target.closest?.("#thfPopup [data-ev3-preview]"))
      document.getElementById("thfPopup")?.close?.();
  },true);
  document.addEventListener("click",async(event)=>{
    const el=event.target.closest?.("[data-thf-agent],[data-thf-chief-call],[data-thf-note],[data-thf-refresh],[data-thf-team-subscribe],[data-thf-open],[data-thf-people-tab]");
    if(!el)return;
    const host=el.closest("#hcTeamFusion,#hcTomorrowFusion")||activeHost||document.getElementById("hcTeamFusion");
    if(el.hasAttribute("data-thf-team-subscribe")){
      if(!window.STIPCalendars?.quick)await window.STIPLoad?.script?.("calendar-subscriptions.js").catch(()=>{});
      window.STIPCalendars?.quick?.("team");return;
    }
    if(!host)return;
    if(el.hasAttribute("data-thf-chief-call")){
      event.preventDefault();
      event.stopPropagation();
      const phone=String(el.dataset.thfChiefCall||"");
      const label=String(el.dataset.thfChiefName||"Chef d’équipe");
      if(!phone)return;
      // La modale de jour serait dans la top layer, devant le choix d'appel.
      const dayPopup=document.getElementById("thfPopup");
      if(dayPopup?.open)dayPopup.close();
      if(!window.STIPDutyChiefs?.openCallChoice){
        try{await window.STIPLoad?.script?.("home-duty-chief.js");}
        catch(_){/* Le pop n'est disponible qu'une fois le module chargé. */}
      }
      if(window.STIPDutyChiefs?.openCallChoice)
        window.STIPDutyChiefs.openCallChoice(phone,label);
      else showDialog('<h2>Appel indisponible</h2><p>Réessaie après actualisation de la page.</p>');
      return;
    }
    if(el.hasAttribute("data-thf-people-tab")){peoplePanel(host,el.dataset.thfPeopleTab);return;}
    if(el.hasAttribute("data-thf-open")){
      const kind=el.dataset.thfOpen;
      if(kind==="day")openDay(host);
      if(kind==="people")openPeople(host);
      if(kind==="staff")openStaff(host);
      if(kind==="notes")openNotes(host);
      return;
    }
    if(el.hasAttribute("data-thf-refresh")){
      for(const map of [weeks,days,assistants,activities])map.clear();
      mount(host._thfOptions);return;
    }
    if(el.hasAttribute("data-thf-note"))return openNote(host,Number(el.dataset.thfNote));
    if(el.hasAttribute("data-thf-agent")){
      const row=(host._thfAgents||[]).find(x=>String(x.agents?.source_key||"")===el.dataset.thfAgent);
      if(!row)return;
      if(!window.STIPAgentAgenda?.open){
        const css=document.createElement("link");css.rel="stylesheet";css.href="agent-agenda-view.css";document.head.appendChild(css);
        await window.STIPLoad?.script?.("agent-agenda-view.js").catch(()=>{});
      }
      const oldPopup=document.getElementById("thfPopup");
      if(oldPopup){oldPopup.close?.();oldPopup.remove();}
      if(window.STIPAgentAgenda?.open)window.STIPAgentAgenda.open(el.dataset.thfAgent,row.agents);
      else showDialog('<h2>'+esc(name(row.agents))+'</h2><p>GHE '+esc(row.agents?.ghe||"")+'</p>');
    }
  });
  window.STIPTeamFusion={mount};
})();
