(() => {
  "use strict";
  const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages";
  const STORE="stip_session_v1";
  const state={root:null,data:null,timer:null,loading:false,selection:false,selected:new Set(),pendingPhoto:null,lastSignature:""};
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const token=()=>localStorage.getItem(STORE)||"";
  async function api(action,body={}){
    const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-stip-session":token()},body:JSON.stringify({action,...body})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw Error(typeof j.error==="string"?j.error:"Service indisponible.");
    return j;
  }
  function fmtTime(v){
    try{return new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"}).format(new Date(v))}catch{return""}
  }
  function fmtDay(v){
    try{
      const d=new Date(v),today=new Date(),a=d.toLocaleDateString("fr-FR",{timeZone:"Europe/Paris"}),b=today.toLocaleDateString("fr-FR",{timeZone:"Europe/Paris"});
      if(a===b)return"Aujourd’hui";
      return new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"numeric",month:"short",timeZone:"Europe/Paris"}).format(d).replace(".","");
    }catch{return""}
  }
  function name(a={}){return a.nickname||[a.prenom,a.nom].filter(Boolean).join(" ").trim()||"Agent"}
  function avatar(a={}){
    const src=a.profile_photo_url||a.avatar_signed_url||a.avatar_url||"";
    const ini=((a.prenom?.[0]||"")+(a.nom?.[0]||"")).toUpperCase()||String(name(a)).slice(0,2).toUpperCase()||"ST";
    return '<span class="tc-avatar" data-avatar-fallback="'+esc(ini)+'">'+(src?'<img src="'+esc(src)+'" alt="" loading="lazy">':esc(ini))+"</span>";
  }
  function signature(d){
    return JSON.stringify((d?.messages||[]).map(m=>[m.id,m.created_at,m.body,m.payload?.photo_url||""]));
  }
  function shell(){
    return '<section class="tc-shell">'+
      '<header class="tc-head"><div><small>ÉQUIPE</small><h2>Chat équipe</h2></div><div class="tc-head-actions"><button type="button" data-refresh aria-label="Actualiser">↻</button><button type="button" data-select hidden>Sélectionner</button></div></header>'+
      '<main class="tc-feed" data-feed><p class="tc-loading">Chargement…</p></main>'+
      '<section class="tc-selection-bar" data-selection-bar hidden><button type="button" data-select-all>Tout sélectionner</button><strong data-selection-count>0</strong><button type="button" class="danger" data-delete-selected>Supprimer</button><button type="button" data-selection-close>Annuler</button></section>'+
      '<section class="tc-photo-preview" data-photo-preview hidden></section>'+
      '<form class="tc-composer" data-form>'+
        '<input type="file" accept="image/*" capture="environment" data-camera hidden>'+
        '<input type="file" accept="image/*" data-gallery hidden>'+
        '<button type="button" class="tc-media-btn" data-camera-open aria-label="Prendre une photo">📷</button>'+
        '<button type="button" class="tc-media-btn" data-gallery-open aria-label="Choisir une photo">▧</button>'+
        '<textarea name="body" rows="1" maxlength="2000" placeholder="Message…"></textarea>'+
        '<button type="submit" class="tc-send" aria-label="Envoyer">↑</button>'+
      '</form>'+
      '</section>';
  }
  function mount(root){
    if(!root)return;
    if(state.root!==root){
      stop();
      state.root=root;
      state.data=null;
      state.selection=false;
      state.selected.clear();
      state.pendingPhoto=null;
      root.innerHTML=shell();
      bind(root);
    }
    load(false);
    state.timer=setInterval(()=>{if(!state.root?.isConnected){stop();return}if(!document.hidden)load(true)},5000);
  }
  function stop(){if(state.timer)clearInterval(state.timer);state.timer=null}
  function bind(root){
    root.querySelector("[data-refresh]")?.addEventListener("click",()=>load(false));
    root.querySelector("[data-select]")?.addEventListener("click",()=>toggleSelection(true));
    root.querySelector("[data-selection-close]")?.addEventListener("click",()=>toggleSelection(false));
    root.querySelector("[data-select-all]")?.addEventListener("click",()=>{
      const ids=(state.data?.messages||[]).map(m=>String(m.id));
      const all=ids.length&&ids.every(id=>state.selected.has(id));
      state.selected.clear();if(!all)ids.forEach(id=>state.selected.add(id));
      renderMessages();
    });
    root.querySelector("[data-delete-selected]")?.addEventListener("click",deleteSelected);
    root.querySelector("[data-camera-open]")?.addEventListener("click",()=>root.querySelector("[data-camera]")?.click());
    root.querySelector("[data-gallery-open]")?.addEventListener("click",()=>root.querySelector("[data-gallery]")?.click());
    root.querySelector("[data-camera]")?.addEventListener("change",e=>pickPhoto(e.target.files?.[0]));
    root.querySelector("[data-gallery]")?.addEventListener("change",e=>pickPhoto(e.target.files?.[0]));
    root.querySelector("[data-form]")?.addEventListener("submit",send);
    root.querySelector("textarea")?.addEventListener("input",e=>autoGrow(e.currentTarget));
    root.addEventListener("click",e=>{
      const photo=e.target.closest?.("[data-photo-url]");
      if(photo)openPhoto(photo.dataset.photoUrl);
    });
    document.addEventListener("error",e=>{
      const img=e.target;if(!(img instanceof HTMLImageElement))return;
      const host=img.closest?.(".tc-avatar");if(host)host.textContent=host.dataset.avatarFallback||"ST";
    },true);
  }
  function autoGrow(el){el.style.height="auto";el.style.height=Math.min(110,Math.max(44,el.scrollHeight))+"px"}
  async function load(quiet=false){
    if(state.loading)return;
    state.loading=true;
    try{
      const d=await api("team_thread");
      state.data=d;
      const selectBtn=state.root?.querySelector("[data-select]");
      if(selectBtn)selectBtn.hidden=!d.admin;
      const sig=signature(d);
      if(!quiet||sig!==state.lastSignature){state.lastSignature=sig;renderMessages()}
    }catch(e){
      if(!quiet&&state.root)state.root.querySelector("[data-feed]").innerHTML='<p class="tc-error">'+esc(e.message)+"</p>";
    }finally{state.loading=false}
  }
  function renderMessages(){
    const feed=state.root?.querySelector("[data-feed]");if(!feed)return;
    const rows=state.data?.messages||[],me=String(state.data?.me?.id||"");
    if(!rows.length){feed.innerHTML='<div class="tc-empty"><span>💬</span><strong>Aucun message pour l’instant</strong><small>Le premier message de l’équipe apparaîtra ici.</small></div>';updateSelectionBar();return}
    let lastDay="";
    feed.innerHTML=rows.map(m=>{
      const day=fmtDay(m.created_at),mine=String(m.sender_agent_id)===me,photo=m.payload?.photo_url||"",id=String(m.id),checked=state.selected.has(id);
      const sep=day!==lastDay?'<div class="tc-day">'+esc(day)+"</div>":"";lastDay=day;
      return sep+'<article class="tc-message '+(mine?"mine":"theirs")+(checked?" selected":"")+'" data-message-id="'+esc(id)+'">'+
        (state.selection?'<label class="tc-check"><input type="checkbox" data-message-check="'+esc(id)+'" '+(checked?"checked":"")+"><span>✓</span></label>':"")+
        (!mine?avatar(m.sender):"")+
        '<div class="tc-bubble">'+(!mine?'<strong>'+esc(name(m.sender))+"</strong>":"")+
          (photo?'<button type="button" class="tc-photo" data-photo-url="'+esc(photo)+'"><img src="'+esc(photo)+'" alt="Photo envoyée"></button>':"")+
          (m.body?'<p>'+esc(m.body).replace(/\n/g,"<br>")+"</p>":"")+
          '<time>'+esc(fmtTime(m.created_at))+"</time></div></article>";
    }).join("");
    feed.querySelectorAll("[data-message-check]").forEach(input=>input.addEventListener("change",()=>{
      const id=String(input.dataset.messageCheck);input.checked?state.selected.add(id):state.selected.delete(id);renderMessages();
    }));
    updateSelectionBar();
    requestAnimationFrame(()=>{if(!state.selection)feed.scrollTop=feed.scrollHeight});
  }
  function toggleSelection(on){
    state.selection=!!on;state.selected.clear();renderMessages();
  }
  function updateSelectionBar(){
    const bar=state.root?.querySelector("[data-selection-bar]"),count=state.root?.querySelector("[data-selection-count]");
    if(!bar)return;bar.hidden=!state.selection;if(count)count.textContent=String(state.selected.size);
    const del=bar.querySelector("[data-delete-selected]");if(del)del.disabled=!state.selected.size;
  }
  function confirmDelete(count){
    return new Promise(resolve=>{
      const wrap=document.createElement("div");wrap.className="tc-confirm-wrap";
      wrap.innerHTML='<section class="tc-confirm"><div class="tc-confirm-icon">🗑️</div><h3>Supprimer définitivement ?</h3><p>'+count+' message'+(count>1?"s":"")+' seront supprimés.</p><div><button type="button" data-no><span>❌</span><strong>Annuler</strong></button><button type="button" class="danger" data-yes><span>✔️</span><strong>Confirmer</strong></button></div></section>';
      document.body.appendChild(wrap);
      const done=v=>{wrap.remove();resolve(v)};
      wrap.querySelector("[data-no]").onclick=()=>done(false);
      wrap.querySelector("[data-yes]").onclick=()=>done(true);
      wrap.addEventListener("click",e=>{if(e.target===wrap)done(false)});
    });
  }
  async function deleteSelected(){
    const ids=[...state.selected];if(!ids.length)return;
    if(!await confirmDelete(ids.length))return;
    const btn=state.root?.querySelector("[data-delete-selected]");if(btn)btn.disabled=true;
    try{await api("team_delete",{message_ids:ids});state.selected.clear();state.selection=false;await load(false)}
    catch(e){alert(e.message||"Suppression impossible.");if(btn)btn.disabled=false}
  }
  async function pickPhoto(file){
    if(!file)return;
    if(!/^image\/(jpeg|png|webp)$/i.test(file.type||"")){alert("Format d’image non pris en charge.");return}
    try{
      const p=await compress(file);
      state.pendingPhoto=p;
      renderPhotoPreview();
    }catch(e){alert(e.message||"Photo impossible à préparer.")}
    const inputs=state.root?.querySelectorAll('input[type="file"]')||[];inputs.forEach(i=>{i.value=""});
  }
  function renderPhotoPreview(){
    const box=state.root?.querySelector("[data-photo-preview]");if(!box)return;
    if(!state.pendingPhoto){box.hidden=true;box.innerHTML="";return}
    box.hidden=false;box.innerHTML='<img src="'+esc(state.pendingPhoto.preview)+'" alt=""><button type="button" aria-label="Retirer la photo">×</button>';
    box.querySelector("button").onclick=()=>{URL.revokeObjectURL(state.pendingPhoto.preview);state.pendingPhoto=null;renderPhotoPreview()};
  }
  async function compress(file){
    const bitmap=await new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(file),img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error("Image illisible."))};img.src=url;
    });
    const max=1600,ratio=Math.min(1,max/Math.max(bitmap.naturalWidth||bitmap.width,bitmap.naturalHeight||bitmap.height));
    const w=Math.max(1,Math.round((bitmap.naturalWidth||bitmap.width)*ratio)),h=Math.max(1,Math.round((bitmap.naturalHeight||bitmap.height)*ratio));
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;canvas.getContext("2d",{alpha:false}).drawImage(bitmap,0,0,w,h);
    let quality=.82,blob=null;
    for(let i=0;i<5;i++){
      blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",quality));
      if(blob&&blob.size<=2200000)break;
      quality-=.1;
    }
    if(!blob)throw Error("Compression impossible.");
    if(blob.size>2800000)throw Error("La photo reste trop lourde.");
    const data=await blob.arrayBuffer(),bytes=new Uint8Array(data);
    let binary="";const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
    return{mime:"image/jpeg",data:btoa(binary),width:w,height:h,preview:URL.createObjectURL(blob)};
  }
  async function send(e){
    e.preventDefault();
    const form=e.currentTarget,input=form.elements.body,body=String(input.value||"").trim(),photo=state.pendingPhoto;
    if(!body&&!photo)return;
    const button=form.querySelector("[type=submit]");button.disabled=true;
    try{
      let photo_path=null;
      if(photo){
        const up=await api("team_photo_upload",{mime:photo.mime,data:photo.data,width:photo.width,height:photo.height});
        photo_path=up.path;
      }
      await api("team_send",{body,photo_path});
      input.value="";autoGrow(input);
      if(photo){URL.revokeObjectURL(photo.preview);state.pendingPhoto=null;renderPhotoPreview()}
      await load(false);
    }catch(err){alert(err.message||"Envoi impossible.")}
    finally{button.disabled=false}
  }
  function openPhoto(url){
    if(!url)return;
    const wrap=document.createElement("div");wrap.className="tc-lightbox";wrap.innerHTML='<button type="button" aria-label="Fermer">×</button><img src="'+esc(url)+'" alt="Photo">';
    document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector("button").onclick=close;wrap.addEventListener("click",e=>{if(e.target===wrap)close()});
  }
  window.addEventListener("stip:session-ended",()=>{stop();state.data=null;state.root=null});
  window.STIPTeamChat={mount,refresh:()=>load(false),stop};
})();