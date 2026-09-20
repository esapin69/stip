(()=>{"use strict";
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access",STORE="stip_session_v1";
let input=null,busy=false,viewer=null,viewerUrl="",raf=0;

const allowed=()=>window.STIPSession?.permissions?.profile_photo===true;
const current=()=>window.STIPSession?.agent?.profile_photo_url||window.STIPBootCache?.agent?.profile_photo_url||"";
const avatarNodes=()=>document.querySelectorAll(".hc-id-card .hc-avatar");

function setCurrent(url){
  url=String(url||"");
  if(window.STIPSession?.agent)window.STIPSession.agent.profile_photo_url=url||null;
  if(window.STIPBootCache?.agent)window.STIPBootCache.agent.profile_photo_url=url||null;
}

async function call(action,body={}){
  const r=await fetch(API,{
    method:"POST",
    cache:"no-store",
    headers:{"Content-Type":"application/json","X-STIP-Session":localStorage.getItem(STORE)||""},
    body:JSON.stringify({action,...body})
  }),j=await r.json().catch(()=>({}));
  if(!r.ok||j.error)throw Error(j.error||("Erreur "+r.status));
  return j;
}

function ensureInput(){
  if(input)return input;
  input=document.createElement("input");
  input.type="file";
  input.accept="image/*";
  input.hidden=true;
  input.addEventListener("change",async()=>{
    const f=input.files?.[0];
    input.value="";
    if(!f||busy)return;
    busy=true;
    setViewerBusy(true);
    try{
      const base64=await compress(f);
      const r=await call("profile_photo_set",{base64});
      setCurrent(r.profile_photo_url||"");
      paint();
      if(viewer?.classList.contains("open")){
        const a=avatarNodes()[0],img=a?.querySelector("img");
        if(img)showViewerImage(img.currentSrc||img.src);
      }
      toast("Photo mise à jour");
    }catch(e){
      toast(e.message||"Impossible de modifier la photo",true);
    }finally{
      busy=false;
      setViewerBusy(false);
    }
  });
  document.body.appendChild(input);
  return input;
}

async function loadImage(file){
  if("createImageBitmap" in window){
    const bmp=await createImageBitmap(file);
    return {source:bmp,width:bmp.width,height:bmp.height,close:()=>bmp.close?.()};
  }
  return await new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>resolve({source:img,width:img.naturalWidth,height:img.naturalHeight,close:()=>URL.revokeObjectURL(url)});
    img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("Lecture impossible."));};
    img.src=url;
  });
}

async function canvasBlob(canvas,quality){
  return await new Promise((resolve,reject)=>canvas.toBlob(
    b=>b?resolve(b):reject(Error("Conversion impossible.")),
    "image/webp",
    quality
  ));
}

async function compress(file){
  if(!file.type.startsWith("image/"))throw Error("Choisis une image.");
  const decoded=await loadImage(file);
  try{
    const side=Math.min(decoded.width,decoded.height),
      sx=(decoded.width-side)/2,
      sy=(decoded.height-side)/2,
      canvas=document.createElement("canvas");
    canvas.width=canvas.height=720;
    const ctx=canvas.getContext("2d",{alpha:false});
    if(!ctx)throw Error("Conversion impossible.");
    ctx.drawImage(decoded.source,sx,sy,side,side,0,0,720,720);
    let blob=null;
    for(const q of [.82,.72,.62,.52]){
      blob=await canvasBlob(canvas,q);
      if(blob.size<=350000)break;
    }
    if(!blob||blob.size>350000)throw Error("Photo trop volumineuse.");
    return await new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(String(r.result).split(",")[1]||"");
      r.onerror=()=>reject(Error("Lecture impossible."));
      r.readAsDataURL(blob);
    });
  }finally{
    decoded.close?.();
  }
}

function ensureViewer(){
  if(viewer)return viewer;
  viewer=document.createElement("section");
  viewer.id="profilePhotoViewer";
  viewer.setAttribute("aria-hidden","true");
  viewer.innerHTML=
    '<header class="ppv-head">'+
      '<button class="ppv-close" type="button" aria-label="Fermer">‹</button>'+
      '<strong>Photo de profil</strong>'+
      '<span></span>'+
    '</header>'+
    '<div class="ppv-stage"><img alt="Photo de profil"></div>'+
    '<div class="ppv-actions" role="toolbar" aria-label="Options de la photo">'+
      '<button id="ppvSave" type="button"><b>↓</b><span>Enregistrer</span></button>'+
      '<button id="ppvChange" type="button"><b>✎</b><span>Changer</span></button>'+
      '<button id="ppvDelete" class="danger" type="button"><b>⌫</b><span>Supprimer</span></button>'+
    '</div>';
  document.body.appendChild(viewer);
  viewer.querySelector(".ppv-close")?.addEventListener("click",closeViewer);
  viewer.querySelector("#ppvSave")?.addEventListener("click",saveViewerImage);
  viewer.querySelector("#ppvChange")?.addEventListener("click",choose);
  viewer.querySelector("#ppvDelete")?.addEventListener("click",removePhoto);
  viewer.addEventListener("click",e=>{
    if(e.target===viewer||e.target?.classList?.contains("ppv-stage"))closeViewer();
  });
  return viewer;
}

function showViewerImage(url){
  const v=ensureViewer(),img=v.querySelector(".ppv-stage img");
  viewerUrl=String(url||"");
  if(img&&viewerUrl)img.src=viewerUrl;
  const save=v.querySelector("#ppvSave"),change=v.querySelector("#ppvChange"),del=v.querySelector("#ppvDelete");
  if(save)save.hidden=!viewerUrl;
  if(change)change.hidden=!allowed();
  if(del)del.hidden=!(allowed()&&current());
}

function openViewer(url){
  if(!url){
    if(allowed())choose();
    return;
  }
  const v=ensureViewer();
  showViewerImage(url);
  v.classList.add("open");
  v.setAttribute("aria-hidden","false");
  document.documentElement.classList.add("ppv-lock");
  setTimeout(()=>v.querySelector(".ppv-close")?.focus(),0);
}

function closeViewer(){
  if(!viewer)return;
  viewer.classList.remove("open");
  viewer.setAttribute("aria-hidden","true");
  document.documentElement.classList.remove("ppv-lock");
}

function setViewerBusy(on){
  if(!viewer)return;
  viewer.classList.toggle("busy",!!on);
  viewer.querySelectorAll("button").forEach(b=>b.disabled=!!on);
}

function slugName(){
  const a=window.STIPSession?.agent||window.STIPBootCache?.agent||{};
  const n=[a.prenom,a.nom].filter(Boolean).join("-").trim().toLowerCase();
  return (n||"stip").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"");
}

function extFor(blob,url){
  const t=String(blob?.type||"").toLowerCase();
  if(t.includes("png"))return"png";
  if(t.includes("jpeg")||t.includes("jpg"))return"jpg";
  if(t.includes("gif"))return"gif";
  if(t.includes("webp"))return"webp";
  const m=String(url||"").split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  return m?m[1].toLowerCase():"webp";
}

async function saveViewerImage(){
  if(!viewerUrl||busy)return;
  busy=true;
  setViewerBusy(true);
  try{
    const r=await fetch(viewerUrl,{cache:"no-store",mode:"cors"});
    if(!r.ok)throw Error("Téléchargement impossible.");
    const blob=await r.blob(),ext=extFor(blob,viewerUrl),name="photo-profil-"+slugName()+"."+ext,
      objectUrl=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=objectUrl;
    a.download=name;
    a.rel="noopener";
    a.style.display="none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),5000);
    toast("Image enregistrée");
  }catch(e){
    toast(e.message||"Impossible d’enregistrer l’image",true);
  }finally{
    busy=false;
    setViewerBusy(false);
  }
}

async function removePhoto(){
  if(!allowed()||!current()||busy)return;
  if(!confirm("Supprimer ta photo de profil ?"))return;
  busy=true;
  setViewerBusy(true);
  try{
    await call("profile_photo_delete");
    setCurrent("");
    paint();
    closeViewer();
    toast("Photo supprimée");
  }catch(e){
    toast(e.message||"Impossible de supprimer la photo",true);
  }finally{
    busy=false;
    setViewerBusy(false);
  }
}

function paint(){
  const url=current(),canEdit=allowed();
  avatarNodes().forEach(a=>{
    if(!a.dataset.profileFallbackHtml)a.dataset.profileFallbackHtml=a.innerHTML;
    if(url){
      let img=a.querySelector("img");
      if(!img){a.innerHTML='<img alt="">';img=a.querySelector("img");}
      if(img&&img.getAttribute("src")!==url)img.src=url;
      a.dataset.profileApplied="1";
    }else if(a.dataset.profileApplied==="1"){
      a.innerHTML=a.dataset.profileFallbackHtml||"";
      delete a.dataset.profileApplied;
    }
    const hasImage=!!a.querySelector("img"),interactive=hasImage||canEdit;
    a.classList.toggle("profile-photo-interactive",interactive);
    a.classList.toggle("profile-photo-editable",canEdit);
    a.setAttribute("role",interactive?"button":"img");
    a.tabIndex=interactive?0:-1;
    a.setAttribute("aria-label",hasImage?"Ouvrir la photo de profil":"Ajouter une photo de profil");
    a.title=hasImage?"Ouvrir la photo de profil":(canEdit?"Ajouter une photo":"");
  });
}

function choose(){
  if(!allowed()||busy)return;
  ensureInput().click();
}

function toast(t,err=false){
  let x=document.querySelector("#profilePhotoToast");
  if(!x){x=document.createElement("div");x.id="profilePhotoToast";document.body.appendChild(x);}
  x.textContent=t;
  x.className=err?"error show":"show";
  clearTimeout(x._t);
  x._t=setTimeout(()=>x.className="",2000);
}

document.addEventListener("click",e=>{
  const a=e.target.closest?.(".hc-id-card .hc-avatar");
  if(!a)return;
  const img=a.querySelector("img");
  if(img){
    e.preventDefault();
    openViewer(img.currentSrc||img.src);
  }else if(allowed()){
    e.preventDefault();
    choose();
  }
},true);

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&viewer?.classList.contains("open")){e.preventDefault();closeViewer();return;}
  if((e.key==="Enter"||e.key===" ")&&e.target?.matches?.(".hc-id-card .hc-avatar")){
    e.preventDefault();
    const img=e.target.querySelector("img");
    if(img)openViewer(img.currentSrc||img.src);else choose();
  }
});

function schedule(){
  if(raf)return;
  raf=requestAnimationFrame(()=>{raf=0;paint();});
}
["stip:session-ready","stip:boot-updated","stip:route"].forEach(e=>window.addEventListener(e,schedule));
window.addEventListener("pageshow",schedule);

const st=document.createElement("style");
st.textContent=
  ".hc-id-card .hc-avatar.profile-photo-interactive{cursor:pointer;position:relative;-webkit-tap-highlight-color:transparent}"+
  ".hc-id-card .hc-avatar.profile-photo-interactive:active{transform:scale(.985)}"+
  ".hc-id-card .hc-avatar.profile-photo-editable:after{content:'↗';position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#fff;border:1px solid #d7e5e8;color:#176075;font-size:12px;font-weight:950;box-shadow:0 2px 8px rgba(0,0,0,.12)}"+
  "html.ppv-lock,html.ppv-lock body{overflow:hidden!important;overscroll-behavior:none}"+
  "#profilePhotoViewer{position:fixed;inset:0;z-index:7000;display:none;grid-template-rows:auto minmax(0,1fr) auto;background:rgba(3,10,14,.98);color:#fff;isolation:isolate}"+
  "#profilePhotoViewer.open{display:grid}"+
  "#profilePhotoViewer .ppv-head{min-height:64px;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;display:grid;grid-template-columns:46px 1fr 46px;align-items:center;background:linear-gradient(180deg,rgba(0,0,0,.45),transparent);z-index:2}"+
  "#profilePhotoViewer .ppv-head strong{text-align:center;font:850 1rem/1.1 system-ui,-apple-system,sans-serif;letter-spacing:.01em}"+
  "#profilePhotoViewer .ppv-close{width:42px;height:42px;border:0;border-radius:50%;background:rgba(255,255,255,.1);color:#fff;font:500 2rem/1 system-ui;display:grid;place-items:center;padding:0 0 4px;cursor:pointer}"+
  "#profilePhotoViewer .ppv-stage{min-height:0;display:grid;place-items:center;padding:8px 0 12px;overflow:hidden}"+
  "#profilePhotoViewer .ppv-stage img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;user-select:none;-webkit-user-drag:none;touch-action:pinch-zoom}"+
  "#profilePhotoViewer .ppv-actions{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:8px;padding:10px 12px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(0deg,rgba(0,0,0,.72),rgba(0,0,0,.28));z-index:2}"+
  "#profilePhotoViewer .ppv-actions button{min-height:58px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(255,255,255,.09);color:#fff;display:grid;grid-template-columns:auto auto;justify-content:center;align-items:center;gap:8px;padding:8px 10px;font:800 .82rem/1 system-ui,-apple-system,sans-serif;cursor:pointer}"+
  "#profilePhotoViewer .ppv-actions button b{font-size:1.2rem;line-height:1}"+
  "#profilePhotoViewer .ppv-actions button.danger{color:#ff9da4;border-color:rgba(255,105,118,.22)}"+
  "#profilePhotoViewer .ppv-actions button[hidden]{display:none!important}"+
  "#profilePhotoViewer.busy .ppv-stage:after{content:'';position:absolute;width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.2);border-top-color:#fff;animation:ppvspin .75s linear infinite}"+
  "@keyframes ppvspin{to{transform:rotate(360deg)}}"+
  "#profilePhotoToast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(10px);z-index:7200;max-width:86vw;padding:10px 13px;border-radius:12px;background:#153f4e;color:#fff;font-size:.74rem;font-weight:800;opacity:0;pointer-events:none;transition:.18s}"+
  "#profilePhotoToast.show{opacity:1;transform:translateX(-50%) translateY(0)}"+
  "#profilePhotoToast.error{background:#7a2e35}"+
  "@media(max-width:420px){#profilePhotoViewer .ppv-actions{gap:6px;padding-left:8px;padding-right:8px}#profilePhotoViewer .ppv-actions button{min-height:54px;border-radius:14px;font-size:.76rem;padding:7px 6px;gap:6px}}";
document.head.appendChild(st);
schedule();
})();