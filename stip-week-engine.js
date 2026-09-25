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
  const SWIPE_MIN_PX=44;
  const SWIPE_DRAG_START_PX=10;
  let swipeStart=null,suppressClickUntil=0,dispatchingSwipeClick=false;

  const gesture=()=>window.STIPGesture||null;
  const reducedMotion=()=>gesture()?.reducedMotion?.()??window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
  const clamp=(value,min,max)=>gesture()?.clamp?.(value,min,max)??Math.max(min,Math.min(max,value));

  function clearSwipeVisual(surface){
    if(!surface)return;
    try{surface.getAnimations?.().forEach((animation)=>animation.cancel())}catch{}
    surface.classList.remove("stip-swipe-live");
    surface.style.removeProperty("transform");
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

  function datasetDates(surface){
    const rows=[];
    surface?.querySelectorAll?.("*").forEach((node)=>{
      for(const value of Object.values(node.dataset||{})){
        const raw=String(value||"").slice(0,10);
        if(valid(raw))rows.push(raw);
      }
    });
    return [...new Set(rows)].sort();
  }

  function monthKeyForSurface(surface){
    const direct=String(surface?.dataset?.calendarMonth||"").slice(0,7);
    if(/^\d{4}-\d{2}$/.test(direct))return direct;
    const dates=datasetDates(surface);
    if(dates[0])return dates[0].slice(0,7);
    const text=String(periodNavFor(surface)?.querySelector("strong")?.textContent||"")
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const names=["janvier","fevrier","mars","avril","mai","juin","juillet","aout","septembre","octobre","novembre","decembre"],
      month=names.findIndex((name)=>text.includes(name)),
      year=Number((text.match(/\b(20\d{2})\b/)||[])[1]);
    return month>=0&&year?`${year}-${String(month+1).padStart(2,"0")}`:"";
  }

  function adjacentMonth(surface,direction){
    const key=monthKeyForSurface(surface);
    if(!key)return{month:direction>0?"MOIS SUIVANT":"MOIS PRÉCÉDENT",year:""};
    const [year,month]=key.split("-").map(Number),
      d=new Date(year,month-1+direction,1,12),
      label=d.toLocaleDateString("fr-FR",{month:"long"}).replace(/^./,(x)=>x.toUpperCase());
    return{month:label.toLocaleUpperCase("fr-FR"),year:String(d.getFullYear())};
  }

  function adjacentWeekLabel(surface,direction){
    const dates=datasetDates(surface);
    if(!dates.length)return direction>0?"SEMAINE SUIVANTE":"SEMAINE PRÉCÉDENTE";
    let start,end;
    if(direction>0&&dates.length<7){
      start=addDays(dates.at(-1),1);
      end=addDays(start,6);
    }else if(direction<0&&dates.length<7){
      end=addDays(dates[0],-1);
      start=addDays(end,-6);
    }else{
      start=addDays(dates[0],direction*7);
      end=addDays(dates.at(-1),direction*7);
    }
    const a=dateObj(start),b=dateObj(end),
      month=(d)=>d.toLocaleDateString("fr-FR",{month:"long"}).replace(/^./,(x)=>x.toUpperCase());
    return a.getMonth()===b.getMonth()
      ? `${a.getDate()} → ${b.getDate()} ${month(b)}`
      : `${a.getDate()} ${month(a)} → ${b.getDate()} ${month(b)}`;
  }

  function cueContent(surface,direction,button){
    const isWeek=surface.classList.contains("stip-week-line");
    if(isWeek){
      const label=adjacentWeekLabel(surface,direction),
        arrow=direction>0?"→":"←";
      return `<div class="stip-swipe-week-label"><span>${arrow}</span><strong>${label}</strong></div>`;
    }
    const next=adjacentMonth(surface,direction);
    return `<div class="stip-swipe-month-word"><strong>${next.month}</strong><small>${next.year}</small></div>`;
  }

  function removeCue(start,immediate=false){
    const cue=start?.cue,host=start?.host;
    if(!cue){
      host?.classList.remove("stip-swipe-host-active");
      return;
    }
    start.cue=null;
    start.cueDirection=0;
    const done=()=>{
      cue.remove();
      host?.classList.remove("stip-swipe-host-active");
    };
    if(immediate||reducedMotion()||!cue.animate){done();return}
    const anim=cue.animate([{opacity:1},{opacity:0}],{duration:80,easing:"linear"});
    anim.finished.then(done).catch(done);
  }

  function ensureCue(start,direction){
    if(!start?.surface||!direction)return null;
    const button=periodButton(start.surface,direction);
    if(!button)return null;
    if(start.cue&&start.cueDirection===direction)return start.cue;
    start.cue?.remove();
    const host=start.surface.parentElement;
    if(!host)return null;
    host.classList.add("stip-swipe-host-active");
    const cue=document.createElement("div");
    cue.className=`stip-swipe-neighbor-cue ${start.surface.classList.contains("stip-week-line")?"is-week":"is-month"} ${direction>0?"is-next":"is-prev"}`;
    cue.setAttribute("aria-hidden","true");
    cue.innerHTML=cueContent(start.surface,direction,button);
    host.appendChild(cue);
    const rect=start.surface.getBoundingClientRect(),
      hostRect=host.getBoundingClientRect();
    cue.style.top=`${rect.top-hostRect.top+host.scrollTop}px`;
    cue.style.left=`${rect.left-hostRect.left+host.scrollLeft}px`;
    cue.style.width=`${rect.width}px`;
    cue.style.height=`${rect.height}px`;
    start.host=host;
    start.cue=cue;
    start.cueDirection=direction;
    return cue;
  }

  function applyDrag(start,rawDx){
    if(!start?.surface)return 0;
    const surface=start.surface,
      width=Math.max(1,Number(surface.clientWidth)||1),
      direction=rawDx<0?1:-1,
      button=periodButton(surface,direction),
      limit=button?width*.98:width*.18,
      dx=clamp(rawDx,-limit,limit);
    start.currentDx=dx;
    start.direction=direction;
    surface.classList.add("stip-swipe-live");
    surface.style.willChange="transform";
    surface.style.transition="none";
    surface.style.transform=`translate3d(${dx}px,0,0)`;
    const cue=button?ensureCue(start,direction):null;
    if(cue){
      cue.style.transition="none";
      cue.style.willChange="transform";
      cue.style.transform=`translate3d(${direction*width+dx}px,0,0)`;
    }else if(start.cue){
      removeCue(start,true);
    }
    return dx;
  }

  function resetSwipe(start){
    const surface=start?.surface;
    if(!surface)return;
    const dx=Number(start.currentDx||0),
      cue=start.cue,
      direction=start.cueDirection||start.direction||1,
      width=Math.max(1,Number(surface.clientWidth)||1);
    if(reducedMotion()||!surface.animate){
      clearSwipeVisual(surface);
      removeCue(start,true);
      return;
    }
    const a=surface.animate(
      [{transform:`translate3d(${dx}px,0,0)`},{transform:"translate3d(0,0,0)"}],
      {duration:170,easing:"cubic-bezier(.22,.78,.2,1)"}
    );
    if(cue?.animate){
      cue.animate(
        [{transform:`translate3d(${direction*width+dx}px,0,0)`},{transform:`translate3d(${direction*width}px,0,0)`}],
        {duration:170,easing:"cubic-bezier(.22,.78,.2,1)"}
      );
    }
    a.finished.finally(()=>{
      clearSwipeVisual(surface);
      removeCue(start,true);
    });
  }

  function revealReplacement(selector,rect,start){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const surface=nearestReplacement(selector,rect);
      if(surface){
        clearSwipeVisual(surface);
        if(!reducedMotion()&&surface.animate){
          surface.animate(
            [{transform:"translate3d(2.5%,0,0)"},{transform:"translate3d(0,0,0)"}],
            {duration:105,easing:"cubic-bezier(.2,.75,.25,1)"}
          );
        }
      }
      removeCue(start,false);
    }));
  }

  function commitSwipe(start,button,direction){
    const surface=start.surface,
      selector=surface.classList.contains("stip-week-line")?".stip-week-line":".stip-month-calendar",
      rect=surface.getBoundingClientRect(),
      width=Math.max(1,Number(surface.clientWidth)||1),
      dx=Number(start.currentDx||0),
      cue=ensureCue(start,direction),
      finish=()=>{
        clearSwipeVisual(surface);
        dispatchingSwipeClick=true;
        try{button.click()}finally{dispatchingSwipeClick=false}
        revealReplacement(selector,rect,start);
      };
    if(reducedMotion()||!surface.animate){finish();return}
    const duration=Math.max(105,Math.min(190,120+Math.round((1-Math.min(1,Math.abs(dx)/width))*55))),
      out=surface.animate(
        [{transform:`translate3d(${dx}px,0,0)`},{transform:`translate3d(${-direction*width}px,0,0)`}],
        {duration,easing:"cubic-bezier(.18,.82,.22,1)",fill:"forwards"}
      );
    if(cue?.animate){
      cue.animate(
        [{transform:`translate3d(${direction*width+dx}px,0,0)`},{transform:"translate3d(0,0,0)"}],
        {duration,easing:"cubic-bezier(.18,.82,.22,1)",fill:"forwards"}
      );
    }
    out.finished.then(finish).catch(finish);
  }

  function handleSwipe(surface,startX,startY,endX,endY,currentDx=endX-startX,velocityX=0,startState=null){
    if(!surface)return false;
    const dx=endX-startX,dy=endY-startY,
      width=Math.max(1,Number(surface.clientWidth)||1),
      shouldCommit=gesture()?.shouldCommit?.({
        dx,dy,width,velocityX,minDistance:SWIPE_MIN_PX,progress:.14,flickDistance:24,flickVelocity:.48,horizontalRatio:1.25
      })??(Math.abs(dx)>=Math.max(SWIPE_MIN_PX,Math.min(72,width*.14))&&Math.abs(dx)>Math.abs(dy)*1.25),
      start=startState||{surface,currentDx,direction:dx<0?1:-1};
    start.currentDx=currentDx;
    if(!shouldCommit){resetSwipe(start);return false}
    const direction=dx<0?1:-1,
      button=periodButton(surface,direction);
    if(!button){resetSwipe(start);return false}
    suppressClickUntil=Date.now()+520;
    commitSwipe(start,button,direction);
    return true;
  }

  function installSwipeNavigation(){
    document.addEventListener("touchstart",(event)=>{
      if(event.touches.length!==1)return;
      const surface=event.target.closest?.(SWIPE_SURFACE);
      if(!surface)return;
      const touch=event.touches[0],now=performance.now();
      swipeStart={
        surface,
        x:touch.clientX,
        y:touch.clientY,
        lastX:touch.clientX,
        lastY:touch.clientY,
        sampleX:touch.clientX,
        sampleT:now,
        velocityX:0,
        currentDx:0,
        axis:"",
        cue:null,
        cueDirection:0,
        host:null
      };
    },{passive:true,capture:true});

    document.addEventListener("touchmove",(event)=>{
      if(!swipeStart||event.touches.length!==1)return;
      const touch=event.touches[0],
        dx=touch.clientX-swipeStart.x,
        dy=touch.clientY-swipeStart.y,
        now=performance.now();
      swipeStart.lastX=touch.clientX;
      swipeStart.lastY=touch.clientY;

      if(!swipeStart.axis){
        const resolved=gesture()?.axis?.(dx,dy,{deadZone:SWIPE_DRAG_START_PX,horizontalRatio:1.35})
          ||(Math.max(Math.abs(dx),Math.abs(dy))<SWIPE_DRAG_START_PX?"":Math.abs(dx)>=Math.abs(dy)*1.35?"x":"y");
        if(!resolved)return;
        swipeStart.axis=resolved;
        if(resolved==="y"){
          clearSwipeVisual(swipeStart.surface);
          removeCue(swipeStart,true);
          return;
        }
      }
      if(swipeStart.axis!=="x")return;

      if(event.cancelable)event.preventDefault();
      const instant=gesture()?.velocity?.(swipeStart.sampleX,swipeStart.sampleT,touch.clientX,now)
        ??((touch.clientX-swipeStart.sampleX)/Math.max(1,now-swipeStart.sampleT));
      swipeStart.velocityX=swipeStart.velocityX*.55+instant*.45;
      swipeStart.sampleX=touch.clientX;
      swipeStart.sampleT=now;
      applyDrag(swipeStart,dx);
    },{passive:false,capture:true});

    document.addEventListener("touchend",(event)=>{
      if(!swipeStart||event.changedTouches.length!==1){
        if(swipeStart)removeCue(swipeStart,true);
        swipeStart=null;
        return;
      }
      const start=swipeStart;
      swipeStart=null;
      const touch=event.changedTouches[0],
        endX=Number.isFinite(touch.clientX)?touch.clientX:start.lastX,
        endY=Number.isFinite(touch.clientY)?touch.clientY:start.lastY,
        dx=endX-start.x,
        now=performance.now(),
        finalVelocity=gesture()?.velocity?.(start.sampleX,start.sampleT,endX,now)
          ??((endX-start.sampleX)/Math.max(1,now-start.sampleT)),
        velocityX=start.velocityX*.65+finalVelocity*.35;
      if(start.axis==="y"||!start.axis){
        clearSwipeVisual(start.surface);
        removeCue(start,true);
        return;
      }
      suppressClickUntil=Date.now()+280;
      handleSwipe(start.surface,start.x,start.y,endX,endY,start.currentDx||dx,velocityX,start);
    },{passive:true,capture:true});

    document.addEventListener("touchcancel",()=>{
      const start=swipeStart;
      swipeStart=null;
      if(start)resetSwipe(start);
    },{passive:true,capture:true});

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
