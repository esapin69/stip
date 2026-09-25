(() => {
  "use strict";
  const DAY = 86400000;
  const valid = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
  const dateObj = (v) => new Date(String(v).slice(0, 10) + "T12:00:00");
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function todayIso() { return new Intl.DateTimeFormat("en-CA", { year:"numeric", month:"2-digit", day:"2-digit", timeZone:"Europe/Paris" }).format(new Date()); }
  function addDays(value,count){const d=dateObj(value);d.setDate(d.getDate()+Number(count||0));return iso(d)}
  function mondayIso(value){const d=dateObj(value),dow=d.getDay()||7;d.setDate(d.getDate()-(dow-1));return iso(d)}
  function range(start,count){return Array.from({length:Math.max(0,Number(count)||0)},(_,i)=>addDays(start,i))}
  function weekOffsetFor(value,today=todayIso()){const a=dateObj(mondayIso(today)),b=dateObj(mondayIso(value));return Math.round((b-a)/(7*DAY))}
  function normalize(model={},options={}){const today=valid(options.today)?options.today:todayIso();let weekOffset=Number(model.weekOffset);if(!Number.isFinite(weekOffset))weekOffset=0;const weekPast=weekOffset===0&&Boolean(model.weekPast),weekFull=weekOffset!==0?true:Boolean(model.weekFull),dayFocus=valid(model.dayFocus)?model.dayFocus:"";return{weekOffset,weekPast,weekFull,dayFocus,today}}
  function stateForDate(value,options={}){const today=valid(options.today)?options.today:todayIso(),target=valid(value)?String(value).slice(0,10):today,weekOffset=weekOffsetFor(target,today);return{weekOffset,weekPast:weekOffset===0&&target<today,weekFull:weekOffset!==0,dayFocus:options.select===false?"":target}}
  function move(model={},step=0,options={}){const s=normalize(model,options),direction=Math.sign(Number(step)||0);if(!direction)return{...s,today:undefined};const dow=dateObj(s.today).getDay()||7;let{weekOffset,weekPast,weekFull}=s;if(weekOffset===0&&direction<0&&!weekPast&&dow>1){weekPast=true;weekFull=false}else if(weekOffset===0&&direction>0&&weekPast){weekPast=false;weekFull=false}else{weekOffset+=direction;weekPast=false;weekFull=weekOffset!==0}return{weekOffset,weekPast,weekFull,dayFocus:options.keepSelection?s.dayFocus:""}}
  function fullDates(model={},options={}){const s=normalize(model,options),monday=addDays(mondayIso(s.today),s.weekOffset*7);return range(monday,7)}
  function visibleDates(model={},options={}){const s=normalize(model,options);if(s.weekOffset!==0)return fullDates(s,{today:s.today});const dow=dateObj(s.today).getDay()||7;if(s.weekPast&&dow>1)return range(mondayIso(s.today),dow-1);return range(s.today,8-dow)}
  function display(model={},options={}){const s=normalize(model,options),dates=visibleDates(s,{today:s.today});return{dates,nextMonday:"",visualDates:dates.slice(),slotCount:Math.max(1,dates.length),weekOffset:s.weekOffset,weekPast:s.weekPast,weekFull:s.weekFull,dayFocus:s.dayFocus}}
  function rangeLabel(dates=[]){const rows=dates.filter(valid);if(!rows.length)return"";const first=dateObj(rows[0]),last=dateObj(rows[rows.length-1]),sameMonth=first.getMonth()===last.getMonth()&&first.getFullYear()===last.getFullYear(),month=(d,short=false)=>d.toLocaleDateString("fr-FR",{month:short?"short":"long"}).replace(/\./g,"");if(sameMonth)return`${first.getDate()} → ${last.getDate()} ${month(last)}`;return`${first.getDate()} ${month(first,true)} → ${last.getDate()} ${month(last,true)}`}
  function weekNumber(value){const d=dateObj(value);d.setDate(d.getDate()+3-((d.getDay()+6)%7));const w1=new Date(d.getFullYear(),0,4,12);return 1+Math.round(((d-w1)/DAY-3+((w1.getDay()+6)%7))/7)}
  function separatorLabel(model={},options={}){const s=normalize(model,options);if(s.weekOffset===0)return s.weekPast?"DÉBUT DE SEMAINE":"CETTE SEMAINE";if(s.weekOffset===1)return"SEMAINE PROCHAINE";if(s.weekOffset===-1)return"SEMAINE PRÉCÉDENTE";const first=fullDates(s,{today:s.today})[0];return first?`SEMAINE ${weekNumber(first)}`:"SEMAINE"}

  function groupEventMarkers(root=document){
    const hosts=root.querySelectorAll?.(".stip-week-events, .rr-week-marks")||[];
    hosts.forEach((host)=>{
      const markers=[...host.querySelectorAll(":scope > .rr-marker[data-rr-filter]")],groups=new Map();
      markers.forEach((marker)=>{const key=`${marker.dataset.rrDate||""}|${marker.dataset.rrFilter||"other"}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(marker)});
      groups.forEach((rows)=>{
        const first=rows[0],previous=Math.max(1,Number(first.dataset.rrGroupCount)||1),count=Math.max(previous,rows.length);
        rows.slice(1).forEach((node)=>node.remove());
        first.dataset.rrGroupCount=String(count);
        let badge=first.querySelector(":scope > .rr-marker-count");
        if(count>1){if(!badge){badge=document.createElement("em");badge.className="rr-marker-count";badge.setAttribute("aria-hidden","true");first.appendChild(badge)}badge.textContent=`×${count}`;const base=String(first.title||"").split(" · ")[0].replace(/ ×\d+$/,"");first.title=`${base} ×${count}`}
        else if(badge)badge.remove();
      });
    });
  }
  let markerFrame=0;
  function scheduleMarkerGrouping(){cancelAnimationFrame(markerFrame);markerFrame=requestAnimationFrame(()=>groupEventMarkers(document))}

  const SWIPE_SURFACE=".stip-week-line, .stip-month-calendar";
  const SWIPE_MIN_PX=48;
  let swipeStart=null,suppressClickUntil=0,dispatchingSwipeClick=false;

  function periodNavFor(surface){
    if(!surface)return null;
    const isWeek=surface.classList.contains("stip-week-line"),
      selector=isWeek?".stip-week-master-nav":".stip-month-nav";
    if(!isWeek){
      const own=surface.querySelector(selector);
      if(own)return own;
    }
    let scope=surface.parentElement,depth=0;
    while(scope&&depth<6){
      const direct=[...scope.children].find((node)=>node.matches?.(selector));
      if(direct)return direct;
      scope=scope.parentElement;
      depth+=1;
    }
    return null;
  }

  function periodButton(surface,direction){
    const nav=periodNavFor(surface);
    if(!nav)return null;
    const buttons=[...nav.querySelectorAll(":scope > button")];
    const button=direction<0?buttons[0]:buttons[buttons.length-1];
    if(!button||button.disabled||button.getAttribute("aria-disabled")==="true")return null;
    return button;
  }

  function handleSwipe(surface,startX,startY,endX,endY){
    if(!surface)return false;
    const dx=endX-startX,dy=endY-startY,ax=Math.abs(dx),ay=Math.abs(dy),
      width=Math.max(1,Number(surface.clientWidth)||1),
      threshold=Math.max(SWIPE_MIN_PX,Math.min(72,width*.14));
    if(ax<threshold||ax<=ay*1.25)return false;
    const button=periodButton(surface,dx<0?1:-1);
    if(!button)return false;
    suppressClickUntil=Date.now()+450;
    dispatchingSwipeClick=true;
    try{button.click()}finally{dispatchingSwipeClick=false}
    return true;
  }

  function installSwipeNavigation(){
    document.addEventListener("touchstart",(event)=>{
      if(event.touches.length!==1)return;
      const surface=event.target.closest?.(SWIPE_SURFACE);
      if(!surface)return;
      const touch=event.touches[0];
      swipeStart={surface,x:touch.clientX,y:touch.clientY};
    },{passive:true,capture:true});
    document.addEventListener("touchend",(event)=>{
      if(!swipeStart||event.changedTouches.length!==1){swipeStart=null;return}
      const start=swipeStart;
      swipeStart=null;
      const touch=event.changedTouches[0];
      handleSwipe(start.surface,start.x,start.y,touch.clientX,touch.clientY);
    },{passive:true,capture:true});
    document.addEventListener("touchcancel",()=>{swipeStart=null},{passive:true,capture:true});
    document.addEventListener("click",(event)=>{
      if(dispatchingSwipeClick||Date.now()>=suppressClickUntil)return;
      if(event.target.closest?.(SWIPE_SURFACE)){
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },true);
  }
  if(typeof document!=="undefined"){
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{scheduleMarkerGrouping();installSwipeNavigation()},{once:true});else{scheduleMarkerGrouping();installSwipeNavigation()}
    new MutationObserver(scheduleMarkerGrouping).observe(document.documentElement,{childList:true,subtree:true});
  }

  window.STIPWeekEngine=Object.freeze({todayIso,addDays,mondayIso,weekOffsetFor,stateForDate,move,fullDates,visibleDates,display,rangeLabel,separatorLabel,weekNumber,groupEventMarkers,handleSwipe});
})();
