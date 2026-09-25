(() => {
  "use strict";
  const CLIENT_VERSION="20260925-stipia-universal1";
  const MSG_API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages";
  const DIALOG_API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-dialog";
  const PUSH_API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-push";
  const VAPID_PUBLIC="BGCXc9jLIjbzcsWqgH7PJDIIiI278kJmjpg3qHkjlutQ0mQFeX685llxQMiWXv8tK3li6BxMjgcDf8Nf_dUPFzI";
  const STORE="stip_session_v1";
  let home=null,dialog=null,thread=null,threadTimer=null,homeTimer=null,pushState="idle",exchangeQuickOpened=false,dialogContext={},dialogHistory=[];
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const can=k=>window.STIPAccess?.has?.(k) ?? !!({...window.STIPSession?.permissions,...window.STIPBootCache?.permissions}[k]);
  async function post(url,action,body={}){
    const r=await fetch(url,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-stip-session":localStorage.getItem(STORE)||""},body:JSON.stringify({action,...body})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw Error(typeof j.error==="string"?j.error:"Service indisponible.");
    return j;
  }
  const msg=(a,b)=>post(MSG_API,a,b),ask=(text,context)=>post(DIALOG_API,"answer",{text,context}),push=(a,b)=>post(PUSH_API,a,b);
  let viewportBaseHeight=0,viewportSyncTimer=0;
  function syncVisualViewport(forceBase=false){
    const vv=window.visualViewport,
      docH=Math.round(document.documentElement.clientHeight||0),
      innerH=Math.round(window.innerHeight||0),
      visualH=Math.round(vv?.height||innerH||docH||0),
      visualTop=Math.max(0,Math.round(vv?.offsetTop||0)),
      keyboardOpen=document.documentElement.classList.contains("ch-keyboard-open");
    if(forceBase||!keyboardOpen)
      viewportBaseHeight=Math.max(viewportBaseHeight,docH,innerH,visualH+visualTop);
    const base=Math.max(viewportBaseHeight,visualH+visualTop),
      keyboardInset=keyboardOpen?Math.max(0,base-visualH-visualTop):0,
      layoutVisibleH=Math.max(1,innerH-visualTop),
      layoutLooksKeyboardResized=keyboardOpen&&base>0&&innerH<base-80,
      visualGap=layoutVisibleH-visualH,
      panelH=layoutLooksKeyboardResized&&visualGap>0&&visualGap<180?layoutVisibleH:visualH;
    document.documentElement.style.setProperty("--ch-keyboard-inset",keyboardInset+"px");
    document.documentElement.style.setProperty("--ch-viewport-top",visualTop+"px");
    document.documentElement.style.setProperty("--ch-viewport-height",Math.max(1,panelH)+"px");
    document.documentElement.classList.toggle("ch-visual-viewport",!!vv);
  }
  function keepActiveComposerVisible(){
    const active=document.activeElement;
    if(!active?.matches?.("input,textarea"))return;
    const panel=active.closest?.(".ch-dialog,.ch-thread");
    if(!panel||panel.hidden)return;
    const body=panel.querySelector(".ch-dialog-body,[data-thread-body]");
    requestAnimationFrame(()=>{
      if(body)body.scrollTop=body.scrollHeight;
      try{active.scrollIntoView({block:"nearest",inline:"nearest",behavior:"auto"})}catch{}
    });
  }
  function queueViewportSync(){
    clearTimeout(viewportSyncTimer);
    syncVisualViewport();
    keepActiveComposerVisible();
    viewportSyncTimer=setTimeout(()=>{syncVisualViewport();keepActiveComposerVisible()},80);
    setTimeout(()=>{syncVisualViewport();keepActiveComposerVisible()},220);
    setTimeout(()=>{syncVisualViewport();keepActiveComposerVisible()},420);
  }
  function bindKeyboardTracking(root){
    root.addEventListener("focusin",(e)=>{
      if(!e.target.matches("input,textarea"))return;
      syncVisualViewport(true);
      document.documentElement.classList.add("ch-keyboard-open");
      queueViewportSync();
      setTimeout(keepActiveComposerVisible,40);
    });
    root.addEventListener("focusout",(e)=>{
      if(!e.target.matches("input,textarea"))return;
      setTimeout(()=>{
        const active=document.activeElement;
        if(root.contains(active)&&active?.matches("input,textarea"))return;
        document.documentElement.classList.remove("ch-keyboard-open");
        syncVisualViewport(true);
      },120);
    });
  }
  function name(a={}){return a.nickname||[a.prenom,a.nom].filter(Boolean).join(" ").trim()||"Agent"}
  function avatar(a={},cls="ch-avatar"){const ini=[a.prenom?.[0],a.nom?.[0]].filter(Boolean).join("").toUpperCase()||String(name(a)).slice(0,2).toUpperCase(),signed=window.STIPBootCache?.media?.avatars?.[a.source_key]||"",src=a.profile_photo_url||signed||a.avatar_signed_url||a.avatar||a.avatar_url||"";return '<span class="'+cls+'" data-avatar-fallback="'+esc(ini)+'">'+(src?'<img src="'+esc(src)+'" alt="" loading="lazy">':esc(ini))+'</span>'}
  function currentMode(){return document.querySelector('#homeView [data-home-mode-current]')?.dataset.homeModeCurrent||""}
  function isTrainee(){return String(window.STIPSession?.role_key||"")==="stagiaire"}
  function setUnread(n){const next=Number(n)||0,prev=Number(window.STIPMessagesUnread||0);window.STIPMessagesUnread=next;if(next!==prev)window.dispatchEvent(new CustomEvent("stip:messages-unread",{detail:{count:next}}))}
  function vapidBytes(v){const pad="=".repeat((4-v.length%4)%4),raw=atob((v+pad).replace(/-/g,"+").replace(/_/g,"/")),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
  function pushText(){if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))return"Notifications téléphone indisponibles";if(Notification.permission==="denied")return"Notifications bloquées par le téléphone";if(pushState==="on")return"Notifications téléphone activées";return"Activer les notifications téléphone"}
  async function refreshPushState(){if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){pushState="unsupported";return}try{const reg=await navigator.serviceWorker.getRegistration(),sub=await reg?.pushManager.getSubscription();pushState=Notification.permission==="granted"&&sub?"on":Notification.permission==="denied"?"denied":"off"}catch{pushState="off"}}
  async function enablePush(button){if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))return;if(Notification.permission==="denied"){pushState="denied";renderHost();return}button.disabled=true;button.textContent="Activation…";try{const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();if(permission!=="granted"){pushState=permission==="denied"?"denied":"off";renderHost();return}const reg=await navigator.serviceWorker.register("./stip-sw.js?v=20260920-1"),sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(VAPID_PUBLIC)}),json=sub.toJSON();await push("subscribe",{subscription:{endpoint:json.endpoint,keys:json.keys}});pushState="on";renderHost();await push("test")}catch(e){pushState="off";button.disabled=false;button.textContent="Réessayer les notifications";alert(e.message||"Activation impossible.")}}
  function conversationTitle(c){if(c.kind==="direct")return name(c.others?.[0]);return c.title||c.others?.slice(0,3).map(name).join(", ")||"Conversation"}
  document.addEventListener("error",e=>{const img=e.target;if(!(img instanceof HTMLImageElement))return;const host=img.closest?.(".ch-avatar,.ch-thread-avatar,.ch-mini-avatar,.ch-result-avatar");if(!host)return;host.textContent=host.dataset.avatarFallback||"ST"},true);
  function bubbleAgent(a){return '<button class="ch-person-bubble" type="button" data-agent="'+esc(a.id)+'">'+avatar(a)+'<strong>'+esc(name(a))+'</strong><small>'+esc(a.prenom&&a.nickname?a.prenom:(a.ghe?"GHE "+a.ghe:""))+'</small></button>'}
  function renderHost(){
    const host=document.getElementById("hcCommunicationHub");if(!host)return;
    const messagesOk=can("messages"),trainee=isTrainee();
    const recent=home?.conversations||[],unread=recent.filter(c=>Number(c.unread||0)>0),traineeNotes=home?.trainee_messages||[],unreadCount=trainee?Number(home?.unread||0):unread.reduce((n,c)=>n+Number(c.unread||0),0);
    host.innerHTML='<section class="ch-hub ch-hub-compact">'+
      '<header class="ch-hub-head"><div><span class="stip-kicker">COMMUNICATION</span><h2>Cloche STIP</h2><p>'+(unreadCount?unreadCount+' message'+(unreadCount>1?'s':'')+' non lu'+(unreadCount>1?'s':'')+'.':(trainee?'Les informations qui te sont adressées apparaissent ici.':'Tout ce qui demande votre attention, sans bruit.'))+'</p></div></header>'+
      (!trainee&&messagesOk?'<button type="button" class="ch-exchange-entry" data-exchanges-open><span aria-hidden="true">↔</span><div><strong>Échanges</strong><small>Messages et conversations entre comptes</small></div><b>›</b></button>':"")+
      (trainee?'<div class="ch-trainee-inbox">'+(traineeNotes.length?traineeNotes.slice(0,20).map(n=>'<article class="ch-trainee-note'+(!n.read_at?' is-unread':'')+'">'+avatar(n.sender||{},"ch-thread-avatar")+'<div><strong>'+esc(name(n.sender||{})||"STIP")+'</strong><p>'+esc(n.body||"")+'</p><time>'+new Date(n.created_at).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})+'</time></div></article>').join(""):'<p class="ch-empty">Aucune information pour toi pour le moment.</p>')+'</div>':"")+
      (!trainee&&unread.length?'<div class="ch-recent ch-unread-only">'+unread.slice(0,5).map(c=>'<button type="button" class="ch-conversation" data-conv="'+esc(c.id)+'">'+(c.others?.[0]?avatar(c.others[0],"ch-thread-avatar"):'<span class="ch-thread-avatar">ST</span>')+'<div><strong>'+esc(conversationTitle(c))+'</strong><small>'+esc(c.last_message?.body||"Nouveau message")+'</small></div><b>'+Number(c.unread||0)+'</b></button>').join("")+'</div>':"")+
    '</section>';
    host.querySelector("[data-exchanges-open]")?.addEventListener("click",exchangeSheet);
    host.querySelectorAll("[data-conv]").forEach(b=>b.addEventListener("click",()=>openThread(b.dataset.conv)));
  }
  async function loadHome(force=false){
    if(!can("messages")){home=null;setUnread(0);renderHost();return}
    try{
      home=await msg("home");setUnread(home.unread);if(!isTrainee())await refreshPushState();renderHost();
      if(currentMode()==="notifications"){
        if(isTrainee()&&Number(home?.unread||0)>0){msg("trainee_read").then(()=>{home.unread=0;(home.trainee_messages||[]).forEach(x=>x.read_at=x.read_at||new Date().toISOString());setUnread(0);renderHost()}).catch(()=>{})}
        let pending="",openExchange=false;
        try{
          pending=sessionStorage.getItem("stip_message_open_v1")||"";
          if(pending)sessionStorage.removeItem("stip_message_open_v1");
          const quick=new URLSearchParams(location.search).get("quick")||"";
          if(quick==="exchange"&&!exchangeQuickOpened){
            exchangeQuickOpened=true;openExchange=true;
          }
        }catch{}
        if(pending)setTimeout(()=>openThread(pending),20);
        else if(openExchange)setTimeout(exchangeSheet,30);
      }
    }catch(e){const host=document.getElementById("hcCommunicationHub");if(host)host.innerHTML='<div class="ch-error">'+esc(e.message)+'</div>'}
  }
  function dialogWelcome(){return {side:"bot",html:'<article class="ch-bot-welcome"><strong>Demande-moi ce que STIP sait vraiment.</strong><p>Planning, collègues, coordonnées, lieux ou organisation. Je cherche dans les données, pas dans une boule de cristal.</p><div class="ch-suggestions"><button>Mon horaire demain ?</button><button>Qui est avec moi vendredi ?</button><button>Où est l’IRM ?</button><button>Je peux échanger demain ?</button><button>Je veux poser un congé</button></div></article>'}}
  function dialogShell(){
    if(dialog)return dialog;
    dialog=document.createElement("section");dialog.className="ch-dialog";dialog.hidden=true;dialog.innerHTML='<header><button type="button" data-close>‹</button><div><small>STIP IA</small><strong>Demande simplement</strong></div><button type="button" data-dialog-reset title="Réinitialiser le dialogue" aria-label="Réinitialiser le dialogue"><span aria-hidden="true">↻</span><b>Reset</b></button></header><main class="ch-dialog-body" data-dialog-body></main><form class="ch-dialog-form"><input name="q" autocomplete="off" placeholder="Écris comme tu parlerais…" maxlength="220"><button type="submit">↑</button></form>';
    document.body.appendChild(dialog);
    bindKeyboardTracking(dialog);
    dialog.querySelector("[data-close]").addEventListener("click",closeDialog);
    dialog.querySelector("[data-dialog-reset]").addEventListener("click",resetDialog);
    dialog.querySelector("form").addEventListener("submit",e=>{e.preventDefault();const input=e.currentTarget.elements.q,q=String(input.value||"").trim();if(!q)return;input.value="";submitAsk(q)});
    return dialog
  }
  function openDialog(){if(!can("dialog"))return;const d=dialogShell();syncVisualViewport();d.hidden=false;document.documentElement.classList.add("ch-lock");if(!dialogHistory.length){dialogHistory.push(dialogWelcome());renderDialog()}setTimeout(()=>{syncVisualViewport();const input=d.querySelector('input');try{input?.focus({preventScroll:true})}catch{input?.focus()}setTimeout(syncVisualViewport,80)},30)}
  function closeDialog(){if(dialog)dialog.hidden=true;document.documentElement.classList.remove("ch-lock","ch-keyboard-open");syncVisualViewport(true)}
  function resetDialog(){const ok=window.confirm("Êtes-vous sûr de vouloir réinitialiser cette conversation ?\n\nL’historique et le contexte de ce dialogue seront définitivement perdus.");if(!ok)return;dialogContext={};dialogHistory=[dialogWelcome()];const input=dialog?.querySelector('input[name="q"]');if(input)input.value="";renderDialog();}
  function renderDialog(){
    const body=dialog?.querySelector("[data-dialog-body]");if(!body)return;
    body.innerHTML=dialogHistory.map(x=>'<div class="ch-msg '+x.side+'">'+x.html+'</div>').join("");
    body.querySelectorAll(".ch-suggestions button").forEach(b=>b.addEventListener("click",()=>submitAsk(String(b.textContent||""))));
    body.querySelectorAll("[data-dialog-action]").forEach(b=>b.addEventListener("click",()=>runDialogAction(JSON.parse(decodeURIComponent(b.dataset.dialogAction)))));
    body.querySelectorAll(".ch-result-avatar img").forEach(img=>img.addEventListener("error",()=>{const host=img.parentElement;if(host)host.textContent=host.dataset.avatarFallback||"ST"},{once:true}));
    body.querySelectorAll("[data-choice-agent]").forEach(b=>b.addEventListener("click",()=>{
      const id=String(b.dataset.choiceAgent||""),label=String(b.dataset.choiceName||"Cette personne"),me=String(window.STIPSession?.agent?.id||window.STIPBootCache?.agent?.id||""),
        options=["Planning","Coordonnées"],canMessage=b.dataset.choiceMessage==="1"&&id&&id!==me;
      if(canMessage)options.push("Message");
      dialogContext={...dialogContext,version:2,subject_agent_ids:[id],agent_id:id,last_choice_ids:[],last_choice_kind:"agent",offered_options:options};
      dialogHistory.push({side:"bot",html:'<article class="ch-answer"><strong>'+esc(label)+'</strong><p>D’accord, je garde cette personne. Que veux-tu regarder ?</p><div class="ch-suggestions">'+options.map(x=>'<button type="button">'+esc(x)+'</button>').join("")+'</div></article>'});
      renderDialog()
    }));
    body.scrollTop=body.scrollHeight
  }
  function actionButton(a){return '<button type="button" data-dialog-action="'+encodeURIComponent(JSON.stringify(a))+'">'+esc(a.label||"Ouvrir")+'</button>'}
  function cardHtml(c,choice=false){
    if(c.type==="metric")return '<article class="ch-result metric"><b>'+esc(c.title)+'</b><strong>'+esc(c.subtitle)+'</strong><small>'+esc(c.detail)+'</small></article>';
    if(c.type==="place")return '<article class="ch-result"><span class="ch-result-icon">⌖</span><div><strong>'+esc(c.title)+'</strong><small>'+esc(c.subtitle)+'</small><p>'+esc(c.detail||"")+'</p></div></article>';
    const initials=String(c.title||"ST").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"ST",
      choiceData=choice?'data-choice-agent="'+esc(c.id)+'" data-choice-name="'+esc(c.title)+'" data-choice-message="'+(c.can_message?"1":"0")+'"':"",
      avatar=c.avatar?'<span class="ch-result-avatar" data-avatar-fallback="'+esc(initials)+'"><img src="'+esc(c.avatar)+'" alt=""></span>':'<span class="ch-result-avatar">'+esc(initials)+'</span>';
    return '<button type="button" class="ch-result person" '+choiceData+'>'+avatar+'<div><strong>'+esc(c.title)+'</strong><small>'+esc(c.subtitle||"")+'</small>'+(c.detail?'<p>'+esc(c.detail)+'</p>':"")+'</div>'+(c.badge?'<b>'+esc(c.badge)+'</b>':"")+'</button>'
  }
  function answerHtml(r){
    const choice=r.kind==="choice";
    return '<article class="ch-answer '+esc(r.kind||"")+'"><small>'+esc(r.title||"STIP")+'</small><p>'+esc(r.text||"")+'</p>'+(r.cards?.length?'<div class="ch-results">'+r.cards.map(c=>cardHtml(c,choice)).join("")+'</div>':"")+(r.actions?.length?'<div class="ch-answer-actions">'+r.actions.map(actionButton).join("")+'</div>':"")+(r.suggestions?.length?'<div class="ch-suggestions">'+r.suggestions.map(s=>'<button type="button">'+esc(s)+'</button>').join("")+'</div>':"")+'</article>'
  }
  async function submitAsk(q){
    openDialog();dialogHistory.push({side:"me",html:'<p>'+esc(q)+'</p>'});dialogHistory.push({side:"bot",html:'<article class="ch-thinking">Je regarde…</article>'});renderDialog();
    try{const r=await ask(q,dialogContext);dialogHistory.pop();dialogContext={...dialogContext,...(r.context||{})};dialogHistory.push({side:"bot",html:answerHtml(r)})}
    catch(e){dialogHistory.pop();dialogHistory.push({side:"bot",html:'<article class="ch-answer error"><strong>Ça coince côté données.</strong><p>'+esc(e.message||"Réessaie.")+'</p></article>'})}
    renderDialog()
  }
  async function runDialogApp(app){
    closeDialog();
    if(app==="planning_personal")return window.STIPHubs?.planning?.("personal");
    if(app==="planning_team")return window.STIPRouter?.set?.("team");
    if(app==="change_app")return window.STIPHubs?.planning?.("change");
    if(app==="calendar_subscribe"){
      try{if(!window.STIPCalendars?.quick)await window.STIPLoad?.script?.("calendar-subscriptions.js");return window.STIPCalendars?.quick?.("personal")}catch{return}
    }
    if(app==="agent_dates")return location.href="agent-dates.html";
    if(app==="contacts")return window.STIPHubs?.contacts?.();
    if(app==="responsable")return window.STIPRouter?.set?.("responsable");
    if(app==="notes")return window.STIPTomorrowUI?.open?.();
    if(app==="nouveaux_arrivants")return location.href="https://esapin69.github.io/Ghe-interne/";
    if(app==="file_upload")return location.href="https://admin.esapin.com/depot.html";
    if(app==="activity")return location.href="esprit-equipe.html";
    if(app==="admin")return location.href="https://admin.esapin.com/";
    if(app==="places")return location.href="places-app.html";
    if(app==="access_manage")return location.href="access-manage.html";
    if(app==="messages")return recipientSheet(false);
    if(app==="tomorrow")return window.STIPTomorrowUI?.open?.();
    if(app==="agent_directory")return location.href="agent-directory.html";
    if(app==="profile_photo")return location.href="mon-compte.html";
  }
  async function runDialogAction(a){
    if(a.type==="call")return location.href="tel:"+a.value;
    if(a.type==="mail")return location.href="mailto:"+a.value;
    if(a.type==="copy"){try{await navigator.clipboard.writeText(a.value)}catch{}return}
    if(a.type==="open"&&a.url)return location.href=a.url;
    if(a.type==="app"&&a.app)return runDialogApp(a.app);
    if(a.type==="reset_dialog")return resetDialog();
    if(a.type==="new_message"){closeDialog();return recipientSheet(false)}
    if(a.type==="message"&&a.agent_id){closeDialog();return openDirect(a.agent_id)}
    if(a.type==="group_message"&&Array.isArray(a.agent_ids)&&a.agent_ids.length){
      try{const r=await msg("group",{agent_ids:a.agent_ids,title:"Groupe STIP"});closeDialog();await loadHome(true);return openThread(r.conversation.id)}
      catch(e){alert(e.message||"Conversation impossible.");return}
    }
    if(a.type==="compare"&&a.source_key){try{sessionStorage.setItem("stip_compare_prefill_v1",JSON.stringify({source_keys:[a.source_key],created_at:Date.now()}))}catch{}return location.href="planning-compare-app.html"}
  }
  async function openDirect(agentId){
    try{const r=await msg("direct",{agent_id:agentId});await loadHome(true);openThread(r.conversation.id)}catch(e){alert(e.message)}
  }
  function threadShell(){
    if(thread)return thread;
    thread=document.createElement("section");thread.className="ch-thread";thread.hidden=true;thread.innerHTML='<header><button type="button" data-close>‹</button><div data-thread-head></div><span></span></header><main data-thread-body></main><form><textarea name="body" rows="1" maxlength="2000" placeholder="Message…"></textarea><button type="submit">↑</button></form>';
    document.body.appendChild(thread);
    bindKeyboardTracking(thread);
    thread.querySelector("[data-close]").addEventListener("click",closeThread);
    thread.querySelector("form").addEventListener("submit",async e=>{e.preventDefault();const input=e.currentTarget.elements.body,body=String(input.value||"").trim(),id=thread.dataset.conversation;if(!body||!id)return;input.value="";try{await msg("send",{conversation_id:id,body});await renderThread(id)}catch(err){alert(err.message)}});
    return thread
  }
  async function openThread(id){closeDialog();const t=threadShell();syncVisualViewport();t.hidden=false;t.dataset.conversation=id;document.documentElement.classList.add("ch-lock");await renderThread(id);clearInterval(threadTimer);threadTimer=setInterval(()=>{if(thread&&!thread.hidden&&thread.dataset.conversation)renderThread(thread.dataset.conversation,true)},5000)}
  function closeThread(){if(thread)thread.hidden=true;clearInterval(threadTimer);threadTimer=null;document.documentElement.classList.remove("ch-lock","ch-keyboard-open");syncVisualViewport(true);loadHome(true)}
  async function renderThread(id,quiet=false){
    try{const r=await msg("thread",{conversation_id:id}),me=window.STIPSession?.agent?.id||window.STIPBootCache?.agent?.id,other=r.members?.find(m=>String(m.agent_id)!==String(me))?.agent,title=r.conversation.kind==="direct"?name(other):r.conversation.title||"Conversation",head=thread.querySelector("[data-thread-head]"),body=thread.querySelector("[data-thread-body]");head.innerHTML=(other?avatar(other,"ch-mini-avatar"):"")+'<div><strong>'+esc(title)+'</strong><small>'+esc(r.conversation.kind==="direct"?"Message privé":"Groupe STIP")+'</small></div>';const operational=r.broadcast?'<section class="ch-operational '+esc(r.broadcast.status)+'"><small>INFO TERRAIN</small><strong>'+esc(r.broadcast.title||"Information équipe")+'</strong><p>'+esc(r.broadcast.body||"")+'</p><div class="ch-operational-meta">'+(r.broadcast.location_text?'<span>⌖ '+esc(r.broadcast.location_text)+'</span>':"")+(r.broadcast.quantity!=null?'<span><b>'+esc(r.broadcast.quantity)+'</b> disponible'+(Number(r.broadcast.quantity)>1?"s":"")+'</span>':"")+'<span>'+(r.broadcast.status==="resolved"?"Terminé":"Mis à jour "+new Date(r.broadcast.updated_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}))+'</span></div>'+(r.broadcast.status!=="resolved"?'<div class="ch-operational-actions"><button type="button" data-broadcast-action="confirm">Toujours là</button><button type="button" data-broadcast-action="less">Il en reste moins</button><button type="button" data-broadcast-action="resolved">Plus rien</button></div>':'<div class="ch-operational-done">✓ Information clôturée</div>')+'</section>':"";body.innerHTML=operational+((r.messages||[]).map(m=>'<article class="ch-bubble '+(String(m.sender_agent_id)===String(me)?"mine":"theirs")+'">'+(String(m.sender_agent_id)!==String(me)?'<small>'+esc(name(m.sender))+'</small>':"")+'<p>'+esc(m.body)+'</p><time>'+new Date(m.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})+'</time></article>').join("")||'<p class="ch-empty">Pas encore de message. À toi de jouer.</p>');body.querySelectorAll("[data-broadcast-action]").forEach(b=>b.addEventListener("click",async()=>{let quantity=null;if(b.dataset.broadcastAction==="less"){const v=prompt("Il en reste combien ?",String(r.broadcast.quantity??""));if(v===null)return;quantity=Math.max(0,Number(v)||0)}b.disabled=true;try{await msg("broadcast_update",{conversation_id:id,update:b.dataset.broadcastAction,quantity});await renderThread(id)}catch(err){b.disabled=false;alert(err.message)}}));if(!quiet||body.scrollHeight-body.scrollTop-body.clientHeight<100)body.scrollTop=body.scrollHeight;loadHome(true)}
    catch(e){if(!quiet)thread.querySelector("[data-thread-body]").innerHTML='<p class="ch-error">'+esc(e.message)+'</p>'}
  }
  function exchangeSheet(){
    document.querySelector(".ch-sheet-wrap[data-exchange-sheet]")?.remove();
    const wrap=document.createElement("div");wrap.className="ch-sheet-wrap";wrap.dataset.exchangeSheet="1";
    const recent=home?.conversations||[];
    wrap.innerHTML='<section class="ch-sheet ch-exchange-sheet"><header><div><small>COMMUNICATION STIP</small><h3>Échanges</h3></div><button type="button" data-close>×</button></header>'+
      '<div class="ch-exchange-actions"><button type="button" data-new-message><span>＋</span><strong>Nouveau message</strong></button><button type="button" data-broadcast><span>↗</span><strong>Diffuser</strong></button><button type="button" data-trainee-message><span>👶</span><strong>Informer un stagiaire</strong></button></div>'+
      (recent.length?'<div class="ch-exchange-recent"><small>CONVERSATIONS</small><div class="ch-recent">'+recent.slice(0,20).map(c=>'<button type="button" class="ch-conversation" data-conv="'+esc(c.id)+'">'+(c.others?.[0]?avatar(c.others[0],"ch-thread-avatar"):'<span class="ch-thread-avatar">ST</span>')+'<div><strong>'+esc(conversationTitle(c))+'</strong><small>'+esc(c.last_message?.body||"Conversation prête")+'</small></div>'+(c.unread?'<b>'+c.unread+'</b>':"")+'</button>').join("")+'</div></div>':'<p class="ch-empty">Aucune conversation pour l’instant.</p>')+
      '<div class="ch-exchange-settings"><button type="button" data-push-enable>'+esc(pushText())+'</button>'+(home?.me?'<button type="button" data-msg-profile>Réglages messages</button>':"")+'</div></section>';
    document.body.appendChild(wrap);
    const close=()=>wrap.remove();
    wrap.querySelector("[data-close]").onclick=close;
    wrap.addEventListener("click",e=>{if(e.target===wrap)close()});
    wrap.querySelector("[data-new-message]")?.addEventListener("click",()=>{close();recipientSheet(false)});
    wrap.querySelector("[data-broadcast]")?.addEventListener("click",()=>{close();broadcastSheet()});
    wrap.querySelector("[data-trainee-message]")?.addEventListener("click",()=>{close();traineeRecipientSheet()});
    wrap.querySelector("[data-push-enable]")?.addEventListener("click",e=>enablePush(e.currentTarget));
    wrap.querySelector("[data-msg-profile]")?.addEventListener("click",()=>{close();profileSheet()});
    wrap.querySelectorAll("[data-conv]").forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.conv;close();openThread(id)}));
  }
  async function traineeRecipientSheet(){
    const wrap=document.createElement("div");wrap.className="ch-sheet-wrap";
    wrap.innerHTML='<section class="ch-sheet"><header><div><small>STAGIAIRE</small><h3>Envoyer une information</h3></div><button type="button" data-close>×</button></header><label class="ch-search"><span>⌕</span><input type="search" placeholder="Prénom ou nom du stagiaire…"></label><div class="ch-picker" data-picker><p class="ch-empty">Chargement…</p></div><form class="ch-profile-form" data-trainee-form hidden><div data-trainee-target></div><label>Information<textarea name="body" rows="4" maxlength="2000" required placeholder="Écris l’information à lui transmettre…"></textarea></label><button type="submit">Envoyer dans sa Cloche</button><p class="ch-form-status" role="status"></p></form></section>';
    document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector("[data-close]").onclick=close;wrap.addEventListener("click",e=>{if(e.target===wrap)close()});
    let all=[],selected=null;const input=wrap.querySelector("input"),picker=wrap.querySelector("[data-picker]"),form=wrap.querySelector("[data-trainee-form]"),target=wrap.querySelector("[data-trainee-target]");
    const paint=()=>{const q=String(input.value||"").toLowerCase(),rows=all.filter(a=>!q||name(a).toLowerCase().includes(q));picker.innerHTML='<div class="ch-picker-grid">'+rows.map(a=>'<button type="button" data-trainee-pick="'+esc(a.trainee_key)+'">'+avatar(a)+'<strong>'+esc(name(a))+'</strong><small>'+esc([a.first_date,a.last_date].filter(Boolean).join(" → "))+'</small></button>').join("")+'</div>';picker.querySelectorAll("[data-trainee-pick]").forEach(b=>b.onclick=()=>{selected=all.find(a=>String(a.trainee_key)===String(b.dataset.traineePick));if(!selected)return;target.innerHTML='<div class="ch-exchange-entry">'+avatar(selected)+'<div><strong>'+esc(name(selected))+'</strong><small>Information ciblée · Cloche STIP</small></div></div>';form.hidden=false;form.querySelector("textarea")?.focus()})};
    input.addEventListener("input",paint);
    try{const r=await msg("trainees");all=r.items||[];paint()}catch(e){picker.innerHTML='<p class="ch-error">'+esc(e.message||"Stagiaires indisponibles.")+'</p>'}
    form.onsubmit=async e=>{e.preventDefault();if(!selected)return;const body=String(new FormData(form).get("body")||"").trim(),status=form.querySelector(".ch-form-status"),button=form.querySelector('button[type="submit"]');if(!body)return;button.disabled=true;status.textContent="Envoi…";try{await msg("trainee_send",{trainee_key:selected.trainee_key,body});status.textContent="Information envoyée.";setTimeout(close,350)}catch(err){status.textContent=err.message||"Envoi impossible.";button.disabled=false}}
  }
  async function recipientSheet(group=false){
    const wrap=document.createElement("div");wrap.className="ch-sheet-wrap";wrap.innerHTML='<section class="ch-sheet"><header><div><small>NOUVEAU MESSAGE</small><h3>Choisir un professionnel</h3></div><button type="button" data-close>×</button></header><label class="ch-search"><span>⌕</span><input type="search" placeholder="Nom, prénom ou pseudo…"></label><div class="ch-picker" data-picker><p class="ch-empty">Chargement…</p></div><button class="ch-group-create" type="button" data-group hidden>Créer le groupe</button></section>';document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector("[data-close]").onclick=close;wrap.addEventListener("click",e=>{if(e.target===wrap)close()});let selected=new Set(),all=[];
    const paint=()=>{const q=String(wrap.querySelector("input").value||"").toLowerCase(),rows=all.filter(a=>!q||name(a).toLowerCase().includes(q)||String(a.prenom||"").toLowerCase().includes(q)||String(a.nom||"").toLowerCase().includes(q));wrap.querySelector("[data-picker]").innerHTML='<div class="ch-picker-grid">'+rows.map(a=>'<button type="button" data-pick="'+esc(a.id)+'" class="'+(selected.has(String(a.id))?"on":"")+'">'+avatar(a)+'<strong>'+esc(name(a))+'</strong><small>'+esc(a.prenom&&a.nickname?a.prenom:(a.ghe?"GHE "+a.ghe:""))+'</small></button>').join("")+'</div>';wrap.querySelectorAll("[data-pick]").forEach(b=>b.onclick=async()=>{const id=String(b.dataset.pick);if(!group){close();return openDirect(id)}selected.has(id)?selected.delete(id):selected.add(id);paint();wrap.querySelector("[data-group]").hidden=!selected.size})};
    wrap.querySelector("input").addEventListener("input",paint);
    try{const r=await msg("agents");all=r.items||[];paint()}catch(e){wrap.querySelector("[data-picker]").innerHTML='<p class="ch-error">'+esc(e.message)+'</p>'}
    const toggle=document.createElement("button");toggle.type="button";toggle.className="ch-mode-toggle";toggle.textContent="Sélection multiple";wrap.querySelector("header").appendChild(toggle);toggle.onclick=()=>{group=!group;selected.clear();toggle.textContent=group?"Message individuel":"Sélection multiple";paint()};
    wrap.querySelector("[data-group]").onclick=async()=>{if(!selected.size)return;try{const r=await msg("group",{agent_ids:[...selected],title:"Groupe STIP"});close();openThread(r.conversation.id)}catch(e){alert(e.message)}}
  }
  async function broadcastSheet(){
    const wrap=document.createElement("div");wrap.className="ch-sheet-wrap";wrap.innerHTML='<section class="ch-sheet"><header><div><small>DIFFUSION ÉQUIPE</small><h3>Informer les bonnes personnes</h3></div><button type="button" data-close>×</button></header><p class="ch-empty" data-state>Je regarde qui est réellement sur le terrain selon le planning…</p></section>';document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector("[data-close]").onclick=close;wrap.addEventListener("click",e=>{if(e.target===wrap)close()});
    try{const [duty,allr]=await Promise.all([msg("on_duty"),msg("agents")]),all=allr.items||[],on=duty.items||[],selected=new Set(on.map(a=>String(a.id)));wrap.querySelector(".ch-sheet").innerHTML='<header><div><small>DIFFUSION ÉQUIPE</small><h3>Informer les bonnes personnes</h3></div><button type="button" data-close>×</button></header><button type="button" class="ch-audience-chip on" data-duty>Sur le terrain maintenant · '+on.length+'</button><p class="ch-audience-note">Sélection calculée avec les horaires STIP. Tu peux enlever ou ajouter quelqu’un avant l’envoi.</p><label class="ch-search"><span>⌕</span><input type="search" placeholder="Ajouter ou retirer un professionnel…"></label><div class="ch-picker" data-picker></div><form class="ch-broadcast-form"><label>Titre facultatif<input name="title" maxlength="80" placeholder="Ex. Info terrain"></label><label>Information<textarea name="body" rows="4" maxlength="2000" required placeholder="Ex. 5 fauteuils sont disponibles derrière…"></textarea></label><div class="ch-broadcast-grid"><label>Lieu facultatif<input name="location" maxlength="200" placeholder="Ex. Neuro · RDJ"></label><label>Quantité facultative<input name="quantity" type="number" min="0" inputmode="numeric" placeholder="5"></label></div><div class="ch-broadcast-count" data-count></div><button type="submit">Diffuser maintenant</button></form><p class="ch-form-status" role="status"></p>';
      wrap.querySelector("[data-close]").onclick=close;const input=wrap.querySelector('.ch-search input'),picker=wrap.querySelector("[data-picker]"),count=wrap.querySelector("[data-count]");
      const paint=()=>{const q=String(input.value||"").toLowerCase(),rows=all.filter(a=>!q||name(a).toLowerCase().includes(q)||String(a.prenom||"").toLowerCase().includes(q)||String(a.nom||"").toLowerCase().includes(q));picker.innerHTML='<div class="ch-picker-grid">'+rows.map(a=>'<button type="button" data-pick="'+esc(a.id)+'" class="'+(selected.has(String(a.id))?"on":"")+'">'+avatar(a)+'<strong>'+esc(name(a))+'</strong><small>'+esc((a.ghe?"GHE "+a.ghe:"")+(a.shift?" · "+a.shift:""))+'</small></button>').join("")+'</div>';count.textContent=selected.size+' destinataire'+(selected.size>1?"s":"");picker.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{const id=String(b.dataset.pick);selected.has(id)?selected.delete(id):selected.add(id);paint()})};
      input.addEventListener("input",paint);wrap.querySelector("[data-duty]").onclick=()=>{selected.clear();on.forEach(a=>selected.add(String(a.id)));paint()};paint();
      wrap.querySelector("form").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),status=wrap.querySelector(".ch-form-status"),button=e.currentTarget.querySelector('[type="submit"]');if(!selected.size){status.textContent="Choisis au moins une personne.";return}button.disabled=true;status.textContent="Diffusion…";try{const r=await msg("group",{kind:"broadcast",agent_ids:[...selected],title:fd.get("title")||"Info équipe",body:fd.get("body"),payload:{type:"operational_info",location:fd.get("location"),quantity:fd.get("quantity")}});close();await loadHome(true);openThread(r.conversation.id)}catch(err){status.textContent=err.message||"Envoi impossible.";button.disabled=false}}
    }catch(e){wrap.querySelector("[data-state]").textContent=e.message||"Sélection indisponible."}
  }
  function profileSheet(){
    if(!home?.me)return;const wrap=document.createElement("div");wrap.className="ch-sheet-wrap";wrap.innerHTML='<section class="ch-sheet"><header><div><small>MON IDENTITÉ MESSAGES</small><h3>Pseudo</h3></div><button type="button" data-close>×</button></header><form class="ch-profile-form"><label>Pseudo visible<input name="nickname" maxlength="32" value="'+esc(home.me.nickname||"")+'" placeholder="'+esc(home.me.prenom||"Prénom")+'"></label><label class="ch-check"><input type="checkbox" name="preview" '+(home.me.notification_preview!==false?"checked":"")+'> Afficher le nom et le message dans les futures notifications téléphone</label><button type="submit">Enregistrer</button></form></section>';document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector("[data-close]").onclick=close;wrap.querySelector("form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await msg("profile_set",{nickname:f.get("nickname"),notification_preview:f.get("preview")==="on"});close();loadHome(true)}catch(err){alert(err.message)}}
  }
  function onRender(){if(currentMode()==="notifications"){renderHost();loadHome();clearInterval(homeTimer);homeTimer=setInterval(()=>{if(currentMode()==="notifications"&&!document.hidden)loadHome(true)},20000)}else{clearInterval(homeTimer);homeTimer=null}}
  ["stip:home-rendered","stip:permissions-live","stip:session-ready"].forEach(e=>window.addEventListener(e,()=>setTimeout(onRender,0)));
  window.addEventListener("stip:session-ended",()=>{home=null;setUnread(0);closeDialog();closeThread()});
  syncVisualViewport(true);
  window.addEventListener("resize",queueViewportSync,{passive:true});
  window.visualViewport?.addEventListener("resize",queueViewportSync,{passive:true});
  window.visualViewport?.addEventListener("scroll",queueViewportSync,{passive:true});
  setTimeout(onRender,300);
  window.STIPCommunication={version:CLIENT_VERSION,openDialog,openDirect,openThread,openExchanges:exchangeSheet,refresh:()=>loadHome(true)};
})();