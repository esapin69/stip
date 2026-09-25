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
  function move(model={},step=0,options={}){const s=normalize(model,options),direction=Math.sign(Number(step)||0);if(!direction)return{...s,today:undefined};const dow=dateObj(s.today).getDay()||7;let{weekOffset,weekPast,weekFull}=s;if(weekOffset===0&&direction<0&&!weekPast&&dow>1){weekPast=true;weekFull=false}else if(weekOffset===0&&direction>0&&weekPast){weekPast=false;weekFull=false}else{weekOffset+=direction;weekPast=false;weekFull=weekOffset!==0}const next={weekOffset,weekPast,weekFull,dayFocus:""},dates=visibleDates(next,{today:s.today}),dayFocus=options.keepSelection&&dates.includes(s.dayFocus)?s.dayFocus:(dates[0]||"");return{weekOffset,weekPast,weekFull,dayFocus}}
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
  const SWIPE_DRAG_START_PX=14;
  let swipeStart=null,suppressClickUntil=0,dispatchingSwipeClick=false;

  const reducedMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;

  function clearSwipeVisual(surface){
    if(!surface)return;
    surface.style.removeProperty("transform");
    surface.style.removeProperty("opacity");
    surface.style.removeProperty("transition");
    surface.style.removeProperty("will-change");
  }

  function nearestReplacement(selector,rect){
    const nodes=[...document.querySelectorAll(selector)].filter((node)=>{
      const r=node.getBoundingClientRect();
      return r.width>0&&r.height>0;
    });
    if(!nodes.length)return null;
    const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    return nodes.sort((a,b)=>{
      const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect(),
        ad=Math.hypot((ar.left+ar.width/2)-cx,(ar.top+ar.height/2)-cy),
        bd=Math.hypot((br.left+br.width/2)-cx,(br.top+br.height/2)-cy);
      return ad-bd;
    })[0];
  }

  function animateIncoming(selector,rect,direction){
    if(reducedMotion())return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const surface=nearestReplacement(selector,rect);
      if(!surface?.animate)return;
      clearSwipeVisual(surface);
      surface.animate([
        {transform:`translate3d(${direction*26}%,0,0)`,opacity:.35},
        {transform:"translate3d(0,0,0)",opacity:1}
      ],{duration:190,easing:"cubic-bezier(.2,.75,.25,1)"});
    }));
  }

  function commitSwipe(surface,button,direction,currentDx=0){
    const selector=surface.classList.contains("stip-week-line")?".stip-week-line":".stip-month-calendar",
      rect=surface.getBoundingClientRect(),
      finish=()=>{
        clearSwipeVisual(surface);
        dispatchingSwipeClick=true;
        try{button.click()}finally{dispatchingSwipeClick=false}
        animateIncoming(selector,rect,direction);
      };
    if(reducedMotion()||!surface.animate){finish();return}
    const width=Math.max(1,Number(surface.clientWidth)||1),
      fromPct=(currentDx/width)*100,
      toPct=-direction*38,
      anim=surface.animate([
        {transform:`translate3d(${fromPct}%,0,0)`,opacity:Math.max(.45,1-Math.min(.38,Math.abs(fromPct)/115))},
        {transform:`translate3d(${toPct}%,0,0)`,opacity:.28}
      ],{duration:135,easing:"cubic-bezier(.4,0,.7,.2)",fill:"forwards"});
    anim.finished.then(finish).catch(finish);
  }

  function resetSwipe(surface,currentDx=0){
    if(!surface)return;
    if(reducedMotion()||!surface.animate){clearSwipeVisual(surface);return}
    const anim=surface.animate([
      {transform:`translate3d(${currentDx}px,0,0)`,opacity:Math.max(.65,1-Math.min(.28,Math.abs(currentDx)/600))},
      {transform:"translate3d(0,0,0)",opacity:1}
    ],{duration:135,easing:"cubic-bezier(.2,.75,.25,1)"});
    anim.finished.finally(()=>clearSwipeVisual(surface));
  }

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

  function handleSwipe(surface,startX,startY,endX,endY,currentDx=endX-startX){
    if(!surface)return false;
    const dx=endX-startX,dy=endY-startY,ax=Math.abs(dx),ay=Math.abs(dy),
      width=Math.max(1,Number(surface.clientWidth)||1),
      threshold=Math.max(SWIPE_MIN_PX,Math.min(72,width*.14));
    if(ax<threshold||ax<=ay*1.25){resetSwipe(surface,currentDx);return false}
    const direction=dx<0?1:-1,
      button=periodButton(surface,direction);
    if(!button){resetSwipe(surface,currentDx);return false}
    suppressClickUntil=Date.now()+520;
    commitSwipe(surface,button,direction,currentDx);
    return true;
  }

  function installSwipeNavigation(){
    document.addEventListener("touchstart",(event)=>{
      if(event.touches.length!==1)return;
      const surface=event.target.closest?.(SWIPE_SURFACE);
      if(!surface)return;
      const touch=event.touches[0];
      swipeStart={surface,x:touch.clientX,y:touch.clientY,lastX:touch.clientX,lastY:touch.clientY,horizontal:false,vertical:false};
    },{passive:true,capture:true});
    document.addEventListener("touchmove",(event)=>{
      if(!swipeStart||event.touches.length!==1)return;
      const touch=event.touches[0],dx=touch.clientX-swipeStart.x,dy=touch.clientY-swipeStart.y,
        ax=Math.abs(dx),ay=Math.abs(dy);
      swipeStart.lastX=touch.clientX;
      swipeStart.lastY=touch.clientY;
      if(!swipeStart.horizontal&&!swipeStart.vertical){
        if(Math.max(ax,ay)<SWIPE_DRAG_START_PX)return;
        if(ax>=ay*1.35){
          swipeStart.horizontal=true;
          if(!reducedMotion()){
            swipeStart.surface.style.willChange="transform, opacity";
            swipeStart.surface.style.transition="none";
          }
        }else{
          swipeStart.vertical=true;
          clearSwipeVisual(swipeStart.surface);
          return;
        }
      }
      if(swipeStart.horizontal&&ay>ax*1.18){
        swipeStart.horizontal=false;
        swipeStart.vertical=true;
        clearSwipeVisual(swipeStart.surface);
        return;
      }
      if(!swipeStart.horizontal)return;
      if(reducedMotion())return;
      const width=Math.max(1,Number(swipeStart.surface.clientWidth)||1),
        limited=Math.max(-width*.62,Math.min(width*.62,dx)),
        fade=Math.max(.62,1-Math.abs(limited)/(width*1.55));
      swipeStart.surface.style.transform=`translate3d(${limited}px,0,0)`;
      swipeStart.surface.style.opacity=String(fade);
    },{passive:true,capture:true});
    document.addEventListener("touchend",(event)=>{
      if(!swipeStart||event.changedTouches.length!==1){swipeStart=null;return}
      const start=swipeStart;
      swipeStart=null;
      const touch=event.changedTouches[0],
        endX=Number.isFinite(touch.clientX)?touch.clientX:start.lastX,
        endY=Number.isFinite(touch.clientY)?touch.clientY:start.lastY,
        dx=endX-start.x;
      if(start.vertical){clearSwipeVisual(start.surface);return}
      if(start.horizontal)suppressClickUntil=Date.now()+260;
      handleSwipe(start.surface,start.x,start.y,endX,endY,dx);
    },{passive:true,capture:true});
    document.addEventListener("touchcancel",()=>{if(swipeStart)resetSwipe(swipeStart.surface,swipeStart.lastX-swipeStart.x);swipeStart=null},{passive:true,capture:true});
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
