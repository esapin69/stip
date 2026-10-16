(() => {
  "use strict";
  const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages";
  const BUILDINGS=[
    ["hfme","HFME","Femme · Mère · Enfant"],
    ["neuro","Neuro","Pierre Wertheimer"],
    ["cardio","Cardio","Louis Pradel"],
    ["a4","POP (A4)","Bâtiment POP"],
    ["b14","Médecine nucléaire","B14"],
    ["ghe","Autres / non précisé","Signalements généraux"]
  ];
  const $=(s,root=document)=>root.querySelector(s);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const DEFAULT_RULES={wheelchair_buildings:BUILDINGS.map(x=>x[0]),wheelchair_work_only:false,team_chat_work_only:false};
  let settings=null,loading=false;
  async function post(action,body={}){
    const session=localStorage.getItem("stip_session_v1")||"";
    if(!session)throw Error("Connectez-vous pour régler les notifications.");
    const response=await fetch(API,{method:"POST",cache:"no-store",
      headers:{"content-type":"application/json","x-stip-session":session},
      body:JSON.stringify({action,...body})});
    const value=await response.json().catch(()=>({}));
    if(!response.ok||value.error)throw Error(value.error||"Connexion indisponible.");
    return value;
  }
  function dialog(id,title){
    let existing=document.getElementById(id);
    if(existing)return existing;
    const el=document.createElement("dialog");
    el.id=id;el.className="ghe-top-dialog";
    el.setAttribute("aria-label",title);
    el.innerHTML='<section class="ghe-top-dialog-frame">'+
      '<header class="ghe-top-dialog-head"><div><small>GHE · COMMUNICATION</small><h2>'+esc(title)+'</h2></div>'+
      '<button type="button" class="ghe-top-dialog-close" data-close aria-label="Fermer la fenêtre">×</button></header>'+
      '<div class="ghe-top-dialog-body" data-content></div></section>';
    document.body.appendChild(el);
    el.addEventListener("click",ev=>{if(ev.target===el)el.close()});
    el.querySelector("[data-close]").onclick=()=>el.close();
    return el;
  }
  async function openWheelchairs(){
    if(!window.STIPAccess?.has?.("messages")){
      return;
    }
    const popup=dialog("gheTopWheelchairDialog","Chat fauteuils");
    const content=$("[data-content]",popup);
    if(!popup.open)popup.showModal();
    content.innerHTML='<p class="ghe-top-dialog-loading" role="status">Connexion au chat fauteuils…</p>';
    const closing=()=>{
      window.STIPTeamChat?.unmountFull?.();
      content.replaceChildren();
    };
    popup.addEventListener("close",closing,{once:true});
    try{
      const runtime=window.STIPTeamChat?.mount?window.STIPTeamChat:await window.STIPLoad?.tableau?.();
      if(!popup.open)return;
      const chat=window.STIPTeamChat?.mount?window.STIPTeamChat:runtime;
      if(typeof chat?.mount!=="function")throw Error("Le chat fauteuils est indisponible.");
      content.innerHTML='<div class="ghe-wheelchair-chat-host" data-chat></div>';
      chat.mount($("[data-chat]",content),{mode:"wheelchair"});
    }catch(error){
      if(popup.open)content.innerHTML='<div class="ghe-top-dialog-problem" role="alert">'+
        '<strong>Impossible de charger les fauteuils</strong><p>'+esc(error?.message||"Réessayez dans un instant.")+'</p>'+
        '<button type="button" data-retry>Réessayer</button></div>';
      $("[data-retry]",content)?.addEventListener("click",openWheelchairs);
    }
  }
  function message(msg,type="info"){
    const status=$("#gheNotificationStatus");if(!status)return;
    status.textContent=msg;status.dataset.status=type;
  }
  function settingsMarkup(){
    const types=settings?.items||[],rules=settings?.rules||DEFAULT_RULES;
    const access=settings?.wheelchair_access!==false;
    const checked=(v)=>v?' checked':'';
    const disabled=(v)=>v?' disabled':'';
    const type=(key)=>types.find(x=>x.event_key===key)||{enabled:false,push_enabled:false};
    const choice=(key,title,subtitle)=>{const p=type(key);
      return '<label class="ghe-notif-choice">'+
        '<span><strong>'+esc(title)+'</strong><small>'+esc(subtitle)+'</small></span>'+
        '<input type="checkbox" data-type="'+esc(key)+'"'+checked(!!p.enabled)+disabled(p.push_enabled===false)+' aria-label="'+esc(title)+'">'+
        '<i aria-hidden="true"></i></label>'};
    return '<div class="ghe-notif-hero"><div class="ghe-notif-hero-icon">⚙️</div><div>'+
        '<strong>Mes notifications, mes règles</strong><p>Les alertes sont personnelles et suivent votre planning GHE.</p>'+
      '</div></div>'+
      '<section class="ghe-notif-section"><div class="ghe-notif-section-title"><span class="ghe-notif-mini-icon">🔔</span><div><strong>Messages et alertes</strong><small>Activez ce que vous souhaitez recevoir</small></div></div>'+
        (access?choice("wheelchair_received","Signalements fauteuils","Nouveaux fauteuils trouvés, recherchés ou manquants"):"")+
        choice("team_chat_received","Chat d’équipe","Messages écrits dans le chat commun")+
        '</section>'+
      (access?'<section class="ghe-notif-section"><div class="ghe-notif-section-title"><span class="ghe-notif-mini-icon">🦽</span><div><strong>Fauteuils qui me concernent</strong><small>Cochez les bâtiments souhaités</small></div></div>'+
        '<div class="ghe-notif-buildings">'+BUILDINGS.map(([key,label,sub])=>
          '<label class="ghe-notif-building"><input type="checkbox" data-building="'+esc(key)+'"'+checked(rules.wheelchair_buildings?.includes(key))+'>'+
          '<span><strong>'+esc(label)+'</strong><small>'+esc(sub)+'</small></span></label>').join("")+
        '</div></section>':"")+
      '<section class="ghe-notif-section"><div class="ghe-notif-section-title"><span class="ghe-notif-mini-icon">◷</span><div><strong>Uniquement quand je travaille</strong><small>Contrôle automatique avec les shifts du planning</small></div></div>'+
        (access?'<label class="ghe-notif-choice"><span><strong>Fauteuils</strong><small>Silence en repos, congé et hors service</small></span><input type="checkbox" data-rule="wheelchair_work_only"'+checked(rules.wheelchair_work_only)+'><i aria-hidden="true"></i></label>':"")+
        '<label class="ghe-notif-choice"><span><strong>Chat d’équipe</strong><small>Recevoir les messages pendant mon service</small></span><input type="checkbox" data-rule="team_chat_work_only"'+checked(rules.team_chat_work_only)+'><i aria-hidden="true"></i></label>'+
        '<p class="ghe-notif-explain">Si le planning ne permet pas de confirmer une heure de service, aucune alerte limitée au travail n’est envoyée. Les messages restent consultables dans le chat.</p></section>'+
      '<section class="ghe-notif-device"><span class="ghe-notif-device-dot'+(settings?.pushState==="on"?" is-on":"")+'"></span>'+
        '<div><strong>'+ (settings?.pushState==="on"?"Notifications du téléphone actives":settings?.pushState==="denied"?"Notifications bloquées sur cet appareil":settings?.pushState==="unsupported"?"Notifications non prises en charge":"Notifications du téléphone non activées")+'</strong>'+
        '<small>'+ (settings?.pushState==="on"?"Les préférences ci-dessus sont enregistrées sur votre compte.":"Pour recevoir les alertes sur cet appareil, autorisez-les dans le navigateur.")+'</small></div>'+
        (settings?.pushState==="off"?'<button type="button" data-enable-push>Activer</button>':"")+'</section>'+
      '<p id="gheNotificationStatus" class="ghe-notif-status" role="status" aria-live="polite"></p>';
  }
  function rerender(){
    const popup=$("#gheTopNotificationDialog");if(!popup?.open)return;
    $("[data-content]",popup).innerHTML=settingsMarkup();
    bindSettings(popup);
  }
  async function saveRule(patch,button){
    if(loading)return;
    loading=true;
    const content=$("#gheTopNotificationDialog [data-content]");
    content?.querySelectorAll("input").forEach(x=>x.disabled=true);
    message("Enregistrement…");
    try{
      const response=await post("notification_rules_set",{rules:patch});
      settings.rules=response.rules;
      rerender();
      message("Préférences enregistrées","ok");
    }catch(e){
      rerender();
      message(e?.message||"Enregistrement impossible","error");
    }finally{loading=false}
  }
  async function saveType(key,enabled,button){
    if(loading)return;
    loading=true;
    $("#gheTopNotificationDialog [data-content]")?.querySelectorAll("input").forEach(x=>x.disabled=true);
    message("Enregistrement…");
    try{
      const result=await window.STIPCommunication?.setNotificationPreference?.(key,enabled,button);
      if(!result)throw Error("Activation non confirmée sur cet appareil.");
      const state=await window.STIPCommunication.notificationSettings();
      settings={...settings,...state};
      rerender();
      message("Préférences enregistrées","ok");
    }catch(e){
      rerender();
      message(e?.message||"Enregistrement impossible","error");
    }finally{loading=false}
  }
  function bindSettings(popup){
    popup.querySelectorAll("[data-building]").forEach(node=>node.addEventListener("change",()=>{
      const buildings=[...popup.querySelectorAll("[data-building]:checked")].map(x=>x.dataset.building);
      saveRule({wheelchair_buildings:buildings},node);
    }));
    popup.querySelectorAll("[data-rule]").forEach(node=>node.addEventListener("change",()=>{
      saveRule({[node.dataset.rule]:node.checked},node);
    }));
    popup.querySelectorAll("[data-type]").forEach(node=>node.addEventListener("change",()=>{
      saveType(node.dataset.type,node.checked,node);
    }));
    popup.querySelector("[data-enable-push]")?.addEventListener("click",async node=>{
      const button=node.currentTarget;
      button.disabled=true;
      try{
        const result=await window.STIPCommunication?.enablePush?.(button);
        settings={...settings,...await window.STIPCommunication.notificationSettings()};
        rerender();
        message(result?"Notifications activées":"Autorisation non accordée",result?"ok":"error");
      }catch(e){rerender();message(e?.message||"Activation impossible","error")}
    });
  }
  async function openSettings(){
    const popup=dialog("gheTopNotificationDialog","Réglages des notifications");
    const content=$("[data-content]",popup);
    if(!popup.open)popup.showModal();
    content.innerHTML='<p class="ghe-top-dialog-loading" role="status">Chargement de vos préférences…</p>';
    try{
      const [available,rules]=await Promise.all([
        window.STIPCommunication?.notificationSettings?.(),
        post("notification_rules_get")
      ]);
      if(!popup.open)return;
      if(!available)throw Error("Les notifications ne sont pas disponibles pour cet accès.");
      settings={...available,...rules,rules:rules.rules||DEFAULT_RULES};
      rerender();
    }catch(e){
      if(popup.open)content.innerHTML='<div class="ghe-top-dialog-problem"><strong>Réglages indisponibles</strong><p>'+
        esc(e?.message||"Vérifiez votre connexion.")+'</p><button type="button" data-retry>Réessayer</button></div>';
      $("[data-retry]",content)?.addEventListener("click",openSettings);
    }
  }
  window.GHENotificationControls={openWheelchairs,openSettings};
})();