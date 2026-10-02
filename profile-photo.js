(()=>{"use strict";
let raf=0;
const avatarNodes=()=>document.querySelectorAll(".hc-id-card .hc-avatar");
const currentAgent=()=>{
  const session=window.STIPSession?.agent||{},boot=window.STIPBootCache?.agent||{};
  return {
    ...boot,
    ...session,
    source_key:session.source_key||boot.source_key||"",
    profile_photo_url:session.profile_photo_url||boot.profile_photo_url||"",
    avatar_url:session.avatar_url||boot.avatar_url||"",
    avatar_signed_url:session.avatar_signed_url||boot.avatar_signed_url||""
  };
};
const photoCandidates=()=>{
  const agent=currentAgent(),media=window.STIPBootCache?.media||{};
  return [...new Set([
    agent.profile_photo_url,
    agent.avatar_url,
    media?.avatars?.[agent.source_key],
    agent.avatar_signed_url
  ].map(v=>String(v||"").trim()).filter(Boolean))];
};
const current=()=>photoCandidates()[0]||"";
function paint(){
  const url=current();
  avatarNodes().forEach(a=>{
    if(!a.dataset.profileFallbackHtml)a.dataset.profileFallbackHtml=a.innerHTML;
    if(url){
      let img=a.querySelector("img");
      if(!img){a.innerHTML='<img alt="">';img=a.querySelector("img")}
      const candidates=photoCandidates();
      if(img){
        img.onerror=()=>{
          const failed=img.getAttribute("src")||"";
          const failedUrls=String(img.dataset.failedUrls||"").split("|").filter(Boolean);
          const next=candidates.find(candidate=>candidate!==failed&&!failedUrls.includes(candidate));
          img.dataset.failedUrls=[...failedUrls,failed].filter(Boolean).join("|");
          if(next){img.src=next;return}
          a.innerHTML=a.dataset.profileFallbackHtml||a.dataset.avatarFallback||"ST";
          delete a.dataset.profileApplied;
        };
        if(img.getAttribute("src")!==url)img.src=url;
      }
      a.dataset.profileApplied="1";
    }else if(a.dataset.profileApplied==="1"){
      a.innerHTML=a.dataset.profileFallbackHtml||"";
      delete a.dataset.profileApplied;
    }
    a.classList.add("profile-photo-interactive");
    a.setAttribute("role","button");
    a.tabIndex=0;
    a.setAttribute("aria-label","Ouvrir les actions de mon profil");
    a.setAttribute("aria-haspopup","dialog");
    a.title="Mon profil";
  });
}
function openAccount(){location.href="mon-compte.html"}
function openPhoto(){location.href="mon-compte.html#photo"}
function openNotifications(){
  const trigger=document.querySelector('[data-home-mode="notifications"]');
  if(trigger){trigger.click();return}
  try{sessionStorage.setItem("stip_home_mode_once","notifications")}catch{}
  location.href="index.html?quick=notifications";
}
function notificationIcon(eventKey){
  return eventKey==="dm_received"?"✉":eventKey==="team_chat_received"?"💬":eventKey==="wheelchair_received"?"♿":"🔔";
}
function openSettings(){
  const menu=window.STIPPersonActions;
  if(!menu?.open){openAccount();return}
  menu.open({
    agent:currentAgent(),
    contextLabel:"PARAMÈTRES",
    subtitle:"Réglages de mon compte",
    actions:[
      {icon:"🔔",label:"Notifications",detail:"Choisir les alertes que je reçois",onSelect:openNotificationSettings}
    ]
  });
}
async function openNotificationSettings(){
  const menu=window.STIPPersonActions,engine=window.STIPCommunication;
  if(!menu?.open||!engine?.notificationSettings){openAccount();return}
  menu.open({
    agent:currentAgent(),
    contextLabel:"NOTIFICATIONS",
    subtitle:"Chargement des réglages…",
    actions:[{icon:"…",label:"Chargement…",detail:"Récupération de vos préférences",disabled:true}]
  });
  try{
    const settings=await engine.notificationSettings(),
      items=Array.isArray(settings?.items)?settings.items:[],
      actions=items.map(item=>{
        const enabled=item.enabled!==false,locked=item.push_enabled===false;
        return{
          icon:notificationIcon(String(item.event_key||"")),
          label:item.label||"Notification",
          detail:locked?"Désactivée par l’administrateur":enabled?"Activée":"Désactivée",
          toggle:true,
          checked:enabled,
          disabled:locked,
          closeOnSelect:false,
          onSelect:async()=>{
            await engine.setNotificationPreference(String(item.event_key||""),!enabled);
            await openNotificationSettings();
          }
        };
      });
    actions.push({
      icon:"👁",
      label:"Aperçu des messages",
      detail:"Afficher le nom et le message dans la notification",
      toggle:true,
      checked:settings?.notification_preview!==false,
      closeOnSelect:false,
      onSelect:async()=>{
        await engine.setNotificationPreview(settings?.notification_preview===false);
        await openNotificationSettings();
      }
    });
    menu.open({
      agent:currentAgent(),
      contextLabel:"NOTIFICATIONS",
      subtitle:"Cochez ou décochez ce que vous voulez recevoir",
      actions
    });
  }catch(error){
    menu.open({
      agent:currentAgent(),
      contextLabel:"NOTIFICATIONS",
      subtitle:"Réglages indisponibles",
      actions:[{icon:"↻",label:"Réessayer",detail:error?.message||"Impossible de charger les notifications",onSelect:openNotificationSettings}]
    });
  }
}
function logout(){
  const button=document.getElementById("logoutBtn");
  if(button){button.click();return}
  window.STIPContinuity?.clear?.({clearToken:true});
  try{localStorage.removeItem("stip_session_v1")}catch{}
  location.replace("index.html");
}
function openProfileMenu(){
  const menu=window.STIPPersonActions;
  if(!menu?.open){openAccount();return}
  menu.open({
    agent:currentAgent(),
    contextLabel:"MON PROFIL",
    subtitle:"Compte et notifications",
    actions:[
      {icon:"✎",label:"Modifier l’image",detail:"Changer ou gérer ma photo",primary:true,onSelect:openPhoto},
      {icon:"🔔",label:"Voir les notifications",detail:"Ouvrir les éléments à traiter",onSelect:openNotifications},
      {icon:"👤",label:"Ouvrir mon profil",detail:"Accéder à Mon compte",onSelect:openAccount},
      {icon:"⚙",label:"Paramètres",detail:"Notifications",onSelect:openSettings},
      {icon:"⏻",label:"Déconnexion",detail:"Quitter cette session",danger:true,onSelect:logout}
    ]
  });
}
document.addEventListener("click",e=>{const a=e.target.closest?.(".hc-id-card .hc-avatar,.hc-id-card .stip-person-card-ghe");if(!a)return;e.preventDefault();openProfileMenu()},true);
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target?.matches?.(".hc-id-card .hc-avatar")){e.preventDefault();openProfileMenu()}});
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;paint()})}
["stip:session-ready","stip:boot-updated","stip:route"].forEach(e=>window.addEventListener(e,schedule));
window.addEventListener("pageshow",schedule);
const st=document.createElement("style");
st.textContent=".hc-id-card .hc-avatar.profile-photo-interactive{cursor:pointer;position:relative;-webkit-tap-highlight-color:transparent}.hc-id-card .hc-avatar.profile-photo-interactive:active,.hc-id-card .stip-person-card-ghe:active{transform:scale(.985)}";
document.head.appendChild(st);
schedule();
})();