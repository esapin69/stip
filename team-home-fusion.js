(() => {
  "use strict";
  // Accueil fusionne : les sources restent celles d'Esprit d'equipe.
  const ROOT = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/";
  const SESSION = "stip_session_v1";
  const TTL = 120000;
  const weeks = new Map(), days = new Map(), assistants = new Map(), activities = new Map();
  let owner = "";
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
  function overlap(a,b) {
    if(!a||!b)return false;
    return Math.max(0,Math.min(a[1],b[1])-Math.max(a[0],b[0]))>=60 ||
      Math.max(0,Math.min(a[1]+1440,b[1])-Math.max(a[0]+1440,b[0]))>=60 ||
      Math.max(0,Math.min(a[1],b[1]+1440)-Math.max(a[0],b[0]+1440))>=60;
  }
  async function post(fn,body) {
    const token=localStorage.getItem(SESSION)||"";
    if(!token)throw Error("Session expirée");
    if(owner!==token){owner=token; weeks.clear();days.clear();assistants.clear();activities.clear();}
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
  function shiftHtml(code, rows, staff) {
    const s=staffFor(staff,code),target=s?.target_count,planned=s?.planned_count,delta=gap(s),signal=window.STIPFieldIntel?.shiftStatus?.(staff,code)||null;
    const level=signal?.level||(delta==null?"unknown":delta<0?"warning":delta>0?"opportunity":"ok");
    const symbol=level==="critical"?"🛑":level==="warning"?"⚠️":level==="opportunity"?"+":level==="ok"?"✓":"○";
    const nonChief=rows.filter(x=>!isChef(x)).sort(sortPeople);
    return '<details class="thf-shift status-'+esc(level)+'"><summary><span class="thf-signal">'+symbol+'</span><strong>'+esc(shiftLabel(code))+'</strong><small>'+esc(shiftTime(code))+'</small><b>'+esc(planned==null?"—":planned)+(target==null?"":" / HCL "+esc(target))+'</b><span aria-hidden="true">⌄</span></summary><div class="thf-shift-detail">'+
      (delta==null?'<p>Effectif HCL non renseigné.</p>':'<p>Écart à la cible HCL : <strong>'+(delta>0?"+":"")+esc(delta)+'</strong></p>')+
      (nonChief.length?nonChief.map(agentHtml).join(""):'<p>Aucun agent à afficher.</p>')+'</div></details>';
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
  function paint(host,opts) {
    if(!host?.isConnected)return;
    const day=String(opts.day||"").slice(0,10),start=monday(day);
    const row=(opts.personal||[]).find(x=>String(x.date||"").slice(0,10)===day);
    const myCode=String(row?.code||row?.source_value||"").trim();
    const working=Boolean(definition(myCode)?.is_working);
    const myTime=working?shiftTime(myCode,row):"";
    const myBase=base(myCode), myInterval=range(myTime),perm=opts.permissions||{};
    const team=perm.planning_team?cached(weeks,start):null;
    const staff=perm.planning_team?cached(days,day):null;
    const assistant=perm.assistant_enabled?cached(assistants,start):null;
    const activity=perm.activity?cached(activities,day):null;
    const loaded=Array.isArray(team?.planning);
    const agents=loaded?team.planning.filter(x=>String(x.date||"").slice(0,10)===day):[];
    const visible=agents.filter(x=>!isChef(x)&&
      (!opts.sourceKey||String(x.agents?.source_key||"")!==String(opts.sourceKey)) &&
      (!opts.ghe||String(x.agents?.ghe||"").replace(/^GHE\s*/i,"")!==String(opts.ghe).replace(/^GHE\s*/i,"")));
    const exact=working?visible.filter(x=>base(x.code)===myBase):[];
    const adjacent=working?visible.filter(x=>base(x.code)!==myBase&&
      myInterval&&overlap(myInterval,range(shiftTime(x.code,x)))):[];
    const elsewhere=visible.filter(x=>!exact.includes(x)&&!adjacent.includes(x));
    const groups=new Map();
    for(const x of agents){
      const code=base(x.code);
      if(!definition(code)?.is_working)continue;
      if(!groups.has(code))groups.set(code,[]);
      groups.get(code).push(x);
    }
    for(const x of staffRows(staff)){
      const code=base(x.shift_code||x.shift||x.code);
      if(definition(code)?.is_working&&!groups.has(code))groups.set(code,[]);
    }
    const ord=x=>Number(definition(x)?.sort_order||999);
    const shifts=[...groups].sort((a,b)=>ord(a[0])-ord(b[0]))
      .map(([code,list])=>shiftHtml(code,list,staff)).join("");
    const infos=[...appointments(opts.boot,day),...notes(assistant,activity,staff,day)];
    const uniqueInfos=[];
    const seen=new Set();
    for(const item of infos){
      const key=(item.title+"|"+(item.detail||"")).toLowerCase();
      if(!seen.has(key)){seen.add(key);uniqueInfos.push(item);}
    }
    host._thfAgents=agents;
    host._thfNotes=uniqueInfos;
    host._thfSets={exact:exact.sort(sortPeople),adjacent:adjacent.sort(sortPeople),
      elsewhere:elsewhere.sort(sortPeople)};
    host._thfShifts=shifts;
    const nDate=dateObj(day).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
    const today=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Europe/Paris"}).format(new Date());
    const ownStaff=working?staffFor(staff,myBase):null;
    const ownTarget=ownStaff?.target_count,ownPlanned=ownStaff?.planned_count,ownGap=gap(ownStaff);
    const ownLevel=ownGap==null?"unknown":ownGap<0?"warning":ownGap>0?"opportunity":"ok";
    const symbol=ownGap==null?"○":ownGap<0?"⚠️":ownGap>0?"+":"✓";
    const ownHCL=ownPlanned!=null&&ownTarget!=null?String(ownPlanned)+" / HCL "+ownTarget:"Voir les effectifs";
    const ownLabel=working?shiftLabel(myCode):myCode?shiftLabel(myCode):"Aucun poste enregistré";
    const count=loaded?String(exact.length):"…";
    const more=loaded?(adjacent.length?adjacent.length+" créneaux chevauchants":"Autres horaires"):"Équipe du jour";
    host.innerHTML='<div class="thf-header"><div><small>MA JOURNÉE · ÉQUIPE</small><h2>'+
      (day===today?"Aujourd’hui":"Jour sélectionné")+'</h2><p>'+esc(nDate)+'</p></div>'+
      '<button type="button" data-thf-refresh aria-label="Actualiser">↻</button></div>'+
      '<div class="thf-my"><div><small>MON POSTE</small><strong>'+esc(ownLabel)+'</strong>'+
      (myTime?'<span>'+esc(myTime)+'</span>':"")+'</div>'+
      (perm.planning_team?'<div><small>MÊME POSTE</small><strong>'+esc(count)+'</strong><span>collègues</span></div>':"")+'</div>'+
      '<div class="thf-actions">'+
      (perm.planning_team?'<button type="button" data-thf-open="people"><span aria-hidden="true">👥</span><span><strong>Collègues</strong><small>'+esc(more)+'</small></span><b>›</b></button>':"")+
      (perm.planning_team?'<button type="button" data-thf-open="staff"><span class="thf-hcl-symbol status-'+esc(ownLevel)+'" aria-hidden="true">'+symbol+'</span><span><strong>Effectifs · HCL</strong><small>'+esc(working?ownLabel+" : "+ownHCL:ownHCL)+'</small></span><b>›</b></button>':"")+
      (uniqueInfos.length?'<button type="button" data-thf-open="notes"><span aria-hidden="true">📌</span><span><strong>À retenir</strong><small>'+uniqueInfos.length+' information'+(uniqueInfos.length>1?"s":"")+'</small></span><b>›</b></button>':"")+
      '</div>';
  }
  function peoplePanel(host,kind) {
    const sets=host?._thfSets||{},rows=sets[kind]||[];
    const panel=document.getElementById("thfPopupResults");
    if(!panel)return;
    panel.innerHTML=rows.length?rows.map(x=>
      (kind==="exact"?"":'<div class="thf-other-time"><small>'+esc(shiftLabel(x.code))+
        (shiftTime(x.code,x)?" · "+esc(shiftTime(x.code,x)):"")+'</small></div>')+
      agentHtml(x)).join(""):'<p class="thf-empty">Aucun collègue sur ce type de créneau.</p>';
    document.querySelectorAll("#thfPopup [data-thf-people-tab]").forEach(button=>
      button.setAttribute("aria-pressed",String(button.dataset.thfPeopleTab===kind)));
    panel.scrollTop=0;
  }
  function openPeople(host) {
    const sets=host._thfSets||{},numbers={
      exact:(sets.exact||[]).length,adjacent:(sets.adjacent||[]).length,
      elsewhere:(sets.elsewhere||[]).length
    };
    showDialog('<small>PLANNING ÉQUIPE</small><h2>Collègues du jour</h2>'+
      '<div class="thf-people-tabs" role="group" aria-label="Filtrer les collègues">'+
      '<button type="button" data-thf-people-tab="exact" aria-pressed="true">Même poste <b>'+numbers.exact+'</b></button>'+
      '<button type="button" data-thf-people-tab="adjacent" aria-pressed="false">Chevauchent <b>'+numbers.adjacent+'</b></button>'+
      '<button type="button" data-thf-people-tab="elsewhere" aria-pressed="false">Autres <b>'+numbers.elsewhere+'</b></button>'+
      '</div><div class="thf-popup-scroll" id="thfPopupResults"></div>');
    peoplePanel(host,"exact");
  }
  function openStaff(host) {
    showDialog('<small>EFFECTIFS · HCL</small><h2>Effectifs par horaire</h2>'+
      '<p class="thf-popup-intro">Appuie sur un horaire pour voir les agents et l’écart HCL.</p>'+
      '<div class="thf-popup-scroll">'+
      (host._thfShifts||'<p class="thf-empty">Aucune information disponible.</p>')+'</div>');
  }
  function openNotes(host) {
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
    const host=document.getElementById("hcTeamFusion");
    if(!host)return;
    const day=String(opts.day||"").slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return;
    host._thfOptions=opts;host.dataset.thfDay=day;
    paint(host,opts);
    const start=monday(day),perm=opts.permissions||{};
    const requests=[];
    if(perm.planning_team)requests.push(getWeek(start),getStaff(day));
    if(perm.assistant_enabled)requests.push(getAssistant(start));
    if(perm.activity)requests.push(getActivity(day));
    for(const req of requests)Promise.resolve(req).then(()=>{
      if(host.isConnected&&host.dataset.thfDay===day)paint(host,opts);
    }).catch(()=>{if(host.isConnected&&host.dataset.thfDay===day)paint(host,opts);});
  }
  document.addEventListener("click",async(event)=>{
    const el=event.target.closest?.("[data-thf-agent],[data-thf-note],[data-thf-refresh],[data-thf-team-subscribe],[data-thf-open],[data-thf-people-tab]");
    if(!el)return;
    const host=el.closest("#hcTeamFusion")||document.getElementById("hcTeamFusion");
    if(el.hasAttribute("data-thf-team-subscribe")){
      if(!window.STIPCalendars?.quick)await window.STIPLoad?.script?.("calendar-subscriptions.js").catch(()=>{});
      window.STIPCalendars?.quick?.("team");return;
    }
    if(!host)return;
    if(el.hasAttribute("data-thf-people-tab")){peoplePanel(host,el.dataset.thfPeopleTab);return;}
    if(el.hasAttribute("data-thf-open")){
      const kind=el.dataset.thfOpen;
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
