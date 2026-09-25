(()=>{"use strict";
let raf=0;
const avatarNodes=()=>document.querySelectorAll(".hc-id-card .hc-avatar");
const current=()=>window.STIPSession?.agent?.profile_photo_url||window.STIPBootCache?.agent?.profile_photo_url||"";
const currentAgent=()=>{
  const session=window.STIPSession?.agent||{},boot=window.STIPBootCache?.agent||{};
  return {...boot,...session,profile_photo_url:session.profile_photo_url||boot.profile_photo_url||""};
};
function paint(){
  const url=current();
  avatarNodes().forEach(a=>{
    if(!a.dataset.profileFallbackHtml)a.dataset.profileFallbackHtml=a.innerHTML;
    if(url){
      let img=a.querySelector("img");
      if(!img){a.innerHTML='<img alt="">';img=a.querySelector("img")}
      if(img&&img.getAttribute("src")!==url)img.src=url;
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
      {icon:"⏻",label:"Déconnexion",detail:"Quitter cette session",danger:true,onSelect:logout}
    ]
  });
}
document.addEventListener("click",e=>{const a=e.target.closest?.(".hc-id-card .hc-avatar");if(!a)return;e.preventDefault();openProfileMenu()},true);
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target?.matches?.(".hc-id-card .hc-avatar")){e.preventDefault();openProfileMenu()}});
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;paint()})}
["stip:session-ready","stip:boot-updated","stip:route"].forEach(e=>window.addEventListener(e,schedule));
window.addEventListener("pageshow",schedule);
const st=document.createElement("style");
st.textContent=".hc-id-card .hc-avatar.profile-photo-interactive{cursor:pointer;position:relative;-webkit-tap-highlight-color:transparent}.hc-id-card .hc-avatar.profile-photo-interactive:active{transform:scale(.985)}.hc-id-card .hc-avatar.profile-photo-interactive:after{content:'⋯';position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#fff;border:1px solid #d7e5e8;color:#176075;font-size:15px;line-height:1;font-weight:950;box-shadow:0 2px 8px rgba(0,0,0,.12)}";
document.head.appendChild(st);
schedule();
})();