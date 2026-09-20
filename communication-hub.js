(() => {
  "use strict";
  const MSG_API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages";
  const DIALOG_API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-dialog";
  const STORE="stip_session_v1";
  let home=null,float=null,dialog=null,thread=null,threadTimer=null,homeTimer=null,dialogContext={},dialogHistory=[];
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const can=k=>window.STIPAccess?.has?.(k) ?? !!({...window.STIPSession?.permissions,...window.STIPBootCache?.permissions}[k]);
  async function post(url,action,body={}){
    const r=await fetch(url,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-stip-session":localStorage.getItem(STORE)||""},body:JSON.stringify({action,...body})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw Error(typeof j.error==="string"?j.error:"Service indisponible.");
    return j;
  }
  const msg=(a,b)=>post(MSG_API,a,b),ask=(text,context)=>post(DIALOG_API,"answer",{text,context});
  function name(a={}){return a.nickname||[a.prenom,a.nom].filter(Boolean).join(" ").trim()||"Agent"}
  function avatar(a={},cls="ch-avatar"){const src=a.profile_photo_url||a.avatar_url||a.avatar||"",ini=[a.prenom?.[0],a.nom?.[0]].filter(Boolean).join("").toUpperCase()||String(name(a)).slice(0,2).toUpperCase();return '<span class="'+cls+'">'+(src?'<img src="'+esc(src)+'" alt="">':esc(ini))+'</span>'}
  function currentMode(){return document.querySelector('#homeView [data-home-mode-current]')?.dataset.homeModeCurrent||""}
  function setUnread(n){window.STIPMessagesUnread=Number(n)||0;window.dispatchEvent(new CustomEvent("stip:messages-unread",{detail:{count:window.STIPMessagesUnread}}))}
  function conversationTitle(c){if(c.kind==="direct")return name(c.others?.[0]);return c.title||c.others?.slice(0,3).map(name).join(", ")||"Conversation"}
  function bubbleAgent(a){return '<button class="ch-person-bubble" type="button" data-agent="'+esc(a.id)+'">'+avatar(a)+'<strong>'+esc(name(a))+'</strong><small>'+esc(a.prenom&&a.nickname?a.prenom:(a.ghe?"GHE "+a.ghe:""))+'</small></button>'}
  function renderHost(){
    const host=document.getElementById("hcCommunicationHub");if(!host)return;
    const dialogOk=can("dialog"),messagesOk=can("messages");
    const recent=home?.conversations||[],suggestions=home?.suggestions||[];
    host.innerHTML='<section class="ch-hub">'+
      '<header class="ch-hub-head"><div><span class="stip-kicker">COMMUNICATION</span><h2>Cloche STIP</h2><p>Rechercher dans STIP ou échanger avec les professionnels connectés au site.</p></div>'+(messagesOk&&home?.me?'<button type="button" class="ch-profile-btn" data-msg-profile>'+avatar(home.me,"ch-mini-avatar")+'<span>'+esc(name(home.me))+'</span></button>':"")+'</header>'+
      (dialogOk?'<button class="ch-ask-entry" type="button" data-dialog-open><span>⌕</span><div><strong>Demander à STIP</strong><small>Horaire, collègue, contact, lieu, effectif…</small></div><b>›</b></button>':"")+
      (messagesOk?'<section class="ch-messages"><div class="ch-section-head"><div><span class="stip-kicker">MESSAGES</span><h3>Professionnels STIP</h3></div><button type="button" data-new-message>＋ Nouveau</button></div>'+
        (home?'<div class="ch-bubbles">'+suggestions.slice(0,12).map(bubbleAgent).join("")+'</div>':'<div class="ch-loading">Chargement des messages…</div>')+
        (recent.length?'<div class="ch-recent">'+recent.slice(0,8).map(c=>'<button type="button" class="ch-conversation" data-conv="'+esc(c.id)+'">'+(c.others?.[0]?avatar(c.others[0],"ch-thread-avatar"):'<span class="ch-thread-avatar">ST</span>')+'<div><strong>'+esc(conversationTitle(c))+'</strong><small>'+esc(c.last_message?.body||"Conversation prête")+'</small></div>'+(c.unread?'<b>'+c.unread+'</b>':"")+'</button>').join("")+'</div>':'<p class="ch-empty">Aucune conversation pour l’instant. Choisis une personne ci-dessus.</p>')+
      '</section>':"")+
    '</section>';
    host.querySelector("[data-dialog-open]")?.addEventListener("click",openDialog);
    host.querySelector("[data-new-message]")?.addEventListener("click",()=>recipientSheet(false));
    host.querySelector("[data-msg-profile]")?.addEventListener("click",profileSheet);
    host.querySelectorAll("[data-agent]").forEach(b=>b.addEventListener("click",()=>openDirect(b.dataset.agent)));
    host.querySelectorAll("[data-conv]").forEach(b=>b.addEventListener("click",()=>openThread(b.dataset.conv)));
  }
  async function loadHome(force=false){
    if(!can("messages")){home=null;setUnread(0);renderHost();return}
    try{home=await msg("home");setUnread(home.unread);renderHost()}catch(e){const host=document.getElementById("hcCommunicationHub");if(host)host.innerHTML='<div class="ch-error">'+esc(e.message)+'</div>'}
  }
  function floatSync(){
    const show=currentMode()==="notifications"&&can("dialog");
    if(!show){float?.remove();float=null;return}
    if(!float){float=document.createElement("button");float.type="button";float.className="ch-float";float.setAttribute("aria-label","Demander à STIP");float.innerHTML='<span>⌕</span><b>STIP</b>';float.addEventListener("click",openDialog);document.body.appendChild(float)}
  }
  function dialogShell(){
    if(dialog)return dialog;
    dialog=document.createElement("section");dialog.className="ch-dialog";dialog.hidden=true;dialog.innerHTML='<header><button type="button" data-close>‹</button><div><small>DEMANDER À STIP</small><strong>Recherche intelligente</strong></div><span></span></header><main class="ch-dialog-body" data-dialog-body></main><form class="ch-dialog-form"><input name="q" autocomplete="off" placeholder="Écris comme tu parlerais…" maxlength="220"><button type="submit">↑</button></form>';
    document.body.appendChild(dialog);
    dialog.querySelector("[data-close]").addEventListener("click",closeDialog);
    dialog.querySelector("form").addEventListener("submit",e=>{e.preventDefault();const input=e.currentTarget.elements.q,q=String(input.value||"").trim();if(!q)return;input.value="";submitAsk(q)});
    return dialog
  }
  function openDialog(){if(!can("dialog"))return;const d=dialogShell();d.hidden=false;document.documentElement.classList.add("ch-lock");if(!dialogHistory.length){dialogHistory.push({side:"bot",html:'<article class="ch-bot-welcome"><strong>Demande-moi ce que STIP sait vraiment.</strong><p>Planning, collègues, coordonnées, lieux ou organisation. Je cherche dans les données, pas dans une boule de cristal.</p><div class="ch-suggestions"><button>Je suis avec qui demain ?</button><button>Qui est en J4 demain ?</button><button>Mon horaire demain ?</button></div></article>'});renderDialog()}setTimeout(()=>d.querySelector('input')?.focus(),30)}
  function closeDialog(){if(dialog)dialog.hidden=true;document.documentElement.classList.remove("ch-lock")}
  function renderDialog(){
    const body=dialog?.querySelector("[data-dialog-body]");if(!body)return;
    body.innerHTML=dialogHistory.map(x=>'<div class="ch-msg '+x.side+'">'+x.html+'</div>').join("");
    body.querySelectorAll(".ch-suggestions button").forEach(b=>b.addEventListener("click",()=>submitAsk(b.textContent)));
    body.querySelectorAll("[data-dialog-action]").forEach(b=>b.addEventListener("click",()=>runDialogAction(JSON.parse(decodeURIComponent(b.dataset.dialogAction)))));
    body.querySelectorAll("[data-choice-agent]").forEach(b=>b.addEventListener("click",()=>{dialogContext={...dialogContext,agent_id:b.dataset.choiceAgent};dialogHistory.push({side:"bot",html:'<article class="ch-answer"><strong>'+esc(b.dataset.choiceName)+'</strong><p>D’accord, je garde cette personne. Planning, coordonnées ou message ?</p></article>'});renderDialog()}));
    body.scrollTop=body.scrollHeight
  }
  function actionButton(a){return '<button type="button" data-dialog-action="'+encodeURIComponent(JSON.stringify(a))+'">'+esc(a.label||"Ouvrir")+'</button>'}
  function cardHtml(c,choice=false){
    if(c.type==="metric")return '<article class="ch-result metric"><b>'+esc(c.title)+'</b><strong>'+esc(c.subtitle)+'</strong><small>'+esc(c.detail)+'</small></article>';
    if(c.type==="place")return '<article class="ch-result"><span class="ch-result-icon">⌖</span><div><strong>'+esc(c.title)+'</strong><small>'+esc(c.subtitle)+'</small><p>'+esc(c.detail||"")+'</p></div></article>';
    return '<button type="button" class="ch-result person" '+(choice?'data-choice-agent="'+esc(c.id)+'" data-choice-name="'+esc(c.title)+'"':"")+'>'+(c.avatar?'<span class="ch-result-avatar"><img src="'+esc(c.avatar)+'" alt=""></span>':'<span class="ch-result-avatar">'+esc(String(c.title||"ST").slice(0,2).toUpperCase())+'</span>')+'<div><strong>'+esc(c.title)+'</strong><small>'+esc(c.subtitle||"")+'</small>'+(c.detail?'<p>'+esc(c.detail)+'</p>':"")+'</div>'+(c.badge?'<b>'+esc(c.badge)+'</b>':"")+'</button>'
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
  async function runDialogAction(a){
    if(a.type==="call")return location.href="tel:"+a.value;
    if(a.type==="mail")return location.href="mailto:"+a.value;
    if(a.type==="copy"){try{await navigator.clipboard.writeText(a.value)}catch{}return}
    if(a.type==="open"&&a.url)return location.href=a.url;
    if(a.type==="message"&&a.agent_id){closeDialog();return openDirect(a.agent_id)}
    if(a.type==="compare"&&a.source_key){try{sessionStorage.setItem("stip_compare_prefill_v1",JSON.stringify({source_keys:[a.source_key],created_at:Date.now()}))}catch{}return location.href="planning-compare-app.html"}
  }
  async function openDirect(agentId){
    try{const r=await msg("direct",{agent_id:agentId});await loadHome(true);openThread(r.conversation.id)}catch(e){alert(e.message)}
  }
  function threadShell(){
    if(thread)return thread;
    thread=document.createElement("section");thread.className="ch-thread";thread.hidden=true;thread.innerHTML='<header><button type="button" data-close>‹</button><div data-thread-head></div><span></span></header><main data-thread-body></main><form><textarea name="body" rows="1" maxlength="2000" placeholder="Message…"></textarea><button type="submit">↑</button></form>';
    document.body.appendChild(thread);
    thread.querySelector("[data-close]").addEventListener("click",closeThread);
    thread.querySelector("form").addEventListener("submit",async e=>{e.preventDefault();const input=e.currentTarget.elements.body,body=String(input.value||"").trim(),id=thread.dataset.conversation;if(!body||!id)return;input.value="";try{await msg("send",{conversation_id:id,body});await renderThread(id)}catch(err){alert(err.message)}});
    return thread
  }
  async function openThread(id){closeDialog();const t=threadShell();t.hidden=false;t.dataset.conversation=id;document.documentElement.classList.add("ch-lock");await renderThread(id);clearInterval(threadTimer);threadTimer=setInterval(()=>{if(thread&&!thread.hidden&&thread.dataset.conversation)renderThread(thread.dataset.conversation,true)},5000)}
  function closeThread(){if(thread)thread.hidden=true;clearInterval(threadTimer);threadTimer=null;document.documentElement.classList.remove("ch-lock");loadHome(true)}
  async function renderThread(id,quiet=false){
    try{const r=await msg("thread",{conversation_id:id}),me=window.STIPSession?.agent?.id||window.STIPBootCache?.agent?.id,other=r.members?.find(m=>String(m.agent_id)!==String(me))?.agent,title=r.conversation.kind==="direct"?name(other):r.conversation.title||"Conversation",head=thread.querySelector("[data-thread-head]"),body=thread.querySelector("[data-thread-body]");head.innerHTML=(other?avatar(other,"ch-mini-avatar"):"")+'<div><strong>'+esc(title)+'</strong><small>'+esc(r.conversation.kind==="direct"?"Message privé":"Groupe STIP")+'</small></div>';body.innerHTML=(r.messages||[]).map(m=>'<article class="ch-bubble '+(String(m.sender_agent_id)===String(me)?"mine":"theirs")+'">'+(String(m.sender_agent_id)!==String(me)?'<small>'+esc(name(m.sender))+'</small>':"")+'<p>'+esc(m.body)+'</p><time>'+new Date(m.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})+'</time></article>').join("")||'<p class="ch-empty">Pas encore de message. À toi de jouer.</p>';if(!quiet||body.scrollHeight-body.scrollTop-body.clientHeight<100)body.scrollTop=body.scrollHeight;loadHome(true)}
    catch(e){if(!quiet)thread.querySelector("[data-thread-body]").innerHTML='<p class="ch-error">'+esc(e.message)+'</p>'}
  }
  async function recipientSheet(group=false){
    const wrap=document.createElement("div");wrap.className="ch-sheet-wrap";wrap.innerHTML='<section class="ch-sheet"><header><div><small>NOUVEAU MESSAGE</small><h3>Choisir un professionnel</h3></div><button type="button" data-close>×</button></header><label class="ch-search"><span>⌕</span><input type="search" placeholder="Nom, prénom ou pseudo…"></label><div class="ch-picker" data-picker><p class="ch-empty">Chargement…</p></div><button class="ch-group-create" type="button" data-group hidden>Créer le groupe</button></section>';document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector("[data-close]").onclick=close;wrap.addEventListener("click",e=>{if(e.target===wrap)close()});let selected=new Set(),all=[];
    const paint=()=>{const q=String(wrap.querySelector("input").value||"").toLowerCase(),rows=all.filter(a=>!q||name(a).toLowerCase().includes(q)||String(a.prenom||"").toLowerCase().includes(q)||String(a.nom||"").toLowerCase().includes(q));wrap.querySelector("[data-picker]").innerHTML='<div class="ch-picker-grid">'+rows.map(a=>'<button type="button" data-pick="'+esc(a.id)+'" class="'+(selected.has(String(a.id))?"on":"")+'">'+avatar(a)+'<strong>'+esc(name(a))+'</strong><small>'+esc(a.prenom&&a.nickname?a.prenom:(a.ghe?"GHE "+a.ghe:""))+'</small></button>').join("")+'</div>';wrap.querySelectorAll("[data-pick]").forEach(b=>b.onclick=async()=>{const id=String(b.dataset.pick);if(!group){close();return openDirect(id)}selected.has(id)?selected.delete(id):selected.add(id);paint();wrap.querySelector("[data-group]").hidden=!selected.size})};
    wrap.querySelector("input").addEventListener("input",paint);
    try{const r=await msg("agents");all=r.items||[];paint()}catch(e){wrap.querySelector("[data-picker]").innerHTML='<p class="ch-error">'+esc(e.message)+'</p>'}
    const toggle=document.createElement("button");toggle.type="button";toggle.className="ch-mode-toggle";toggle.textContent="Sélection multiple";wrap.querySelector("header").appendChild(toggle);toggle.onclick=()=>{group=!group;selected.clear();toggle.textContent=group?"Message individuel":"Sélection multiple";paint()};
    wrap.querySelector("[data-group]").onclick=async()=>{if(!selected.size)return;try{const r=await msg("group",{agent_ids:[...selected],title:"Groupe STIP"});close();openThread(r.conversation.id)}catch(e){alert(e.message)}}
  }
  function profileSheet(){
    if(!home?.me)return;const wrap=document.createElement("div");wrap.className="ch-sheet-wrap";wrap.innerHTML='<section class="ch-sheet"><header><div><small>MON IDENTITÉ MESSAGES</small><h3>Pseudo</h3></div><button type="button" data-close>×</button></header><form class="ch-profile-form"><label>Pseudo visible<input name="nickname" maxlength="32" value="'+esc(home.me.nickname||"")+'" placeholder="'+esc(home.me.prenom||"Prénom")+'"></label><label class="ch-check"><input type="checkbox" name="preview" '+(home.me.notification_preview!==false?"checked":"")+'> Afficher le nom et le message dans les futures notifications téléphone</label><button type="submit">Enregistrer</button></form></section>';document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector("[data-close]").onclick=close;wrap.querySelector("form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await msg("profile_set",{nickname:f.get("nickname"),notification_preview:f.get("preview")==="on"});close();loadHome(true)}catch(err){alert(err.message)}}
  }
  function onRender(){floatSync();if(currentMode()==="notifications"){renderHost();loadHome();clearInterval(homeTimer);homeTimer=setInterval(()=>{if(currentMode()==="notifications"&&!document.hidden)loadHome(true)},20000)}else{clearInterval(homeTimer);homeTimer=null}}
  ["stip:home-rendered","stip:permissions-live","stip:session-ready"].forEach(e=>window.addEventListener(e,()=>setTimeout(onRender,0)));
  window.addEventListener("stip:session-ended",()=>{home=null;setUnread(0);float?.remove();float=null;closeDialog();closeThread()});
  setTimeout(onRender,300);
  window.STIPCommunication={openDialog,openDirect,openThread,refresh:()=>loadHome(true)};
})();