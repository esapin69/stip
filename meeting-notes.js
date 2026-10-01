(() => {
  "use strict";
  const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-meeting-notes";
  const STORE="stip_session_v1";
  const state={notes:[],tab:"active",query:"",editing:null,loading:false};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const token=()=>localStorage.getItem(STORE)||"";
  const status=(v)=>{const e=$("#meetingStatus");if(e)e.textContent=v||""};
  const short=(v,n=150)=>{v=String(v||"").trim().replace(/\s+/g," ");return v.length>n?v.slice(0,n-1)+"…":v};
  const localInput=(iso)=>{const d=iso?new Date(iso):new Date();if(Number.isNaN(d.getTime()))return "";const p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`};
  const displayDate=(iso)=>{const d=new Date(iso);return Number.isNaN(d.getTime())?"Date inconnue":new Intl.DateTimeFormat("fr-FR",{dateStyle:"medium",timeStyle:"short"}).format(d)};

  async function post(body){
    const t=token();if(!t)throw Error("Connecte-toi depuis l’accueil GHE.");
    const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","X-STIP-Session":t},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.error){
      const m={SESSION_STIP_REQUISE:"Session requise.",SESSION_EXPIREE:"Ta session a expiré.",ACCES_NOTES_REUNION_REQUIS:"Cette application n’est pas autorisée pour ce profil.",ACCES_AGENT_REQUIS:"Un profil agent est nécessaire.",TITRE_REQUIS:"Ajoute un titre.",DATE_REUNION_INVALIDE:"Vérifie la date et l’heure.",NOTE_INTROUVABLE:"Cette note n’existe plus."};
      throw Error(m[j.error]||"Impossible d’enregistrer pour le moment.");
    }
    return j;
  }

  function searchable(n){return [n.title,n.participants,n.notes,n.decisions,n.actions].join(" ").toLowerCase()}
  function filtered(){
    const q=state.query.trim().toLowerCase();
    return state.notes.filter(n=>n.status===state.tab&&(!q||searchable(n).includes(q)));
  }
  function counts(){
    const a=state.notes.filter(n=>n.status==="active").length,z=state.notes.filter(n=>n.status==="archived").length;
    $("[data-meeting-count-active]").textContent=String(a);$("[data-meeting-count-archived]").textContent=String(z);
  }
  function card(n){
    const preview=short(n.decisions||n.actions||n.notes||n.participants||"Aucun détail saisi.");
    return `<button type="button" class="meeting-card" data-meeting-id="${esc(n.id)}"><span><small>${esc(displayDate(n.meeting_at))}</small><strong>${esc(n.title)}</strong><p>${esc(preview)}</p></span><i aria-hidden="true">›</i></button>`;
  }
  function render(){
    counts();
    $$("[data-meeting-tab]").forEach(b=>b.classList.toggle("active",b.dataset.meetingTab===state.tab));
    const list=$("#meetingList"),items=filtered();
    list.innerHTML=items.length?items.map(card).join(""):`<div class="meeting-empty"><strong>${state.query?"Aucun résultat":"Aucune note ici"}</strong><span>${state.tab==="active"?"Crée une note au début ou pendant une réunion.":"Les notes archivées restent consultables et modifiables."}</span></div>`;
    $$("[data-meeting-id]",list).forEach(b=>b.addEventListener("click",()=>openEditor(b.dataset.meetingId)));
  }

  async function refresh(){
    if(state.loading)return;state.loading=true;status("Chargement…");
    try{const j=await post({action:"list"});state.notes=j.notes||[];status("");render()}
    catch(e){status(e.message||"Impossible de charger les notes.");state.notes=[];render()}
    finally{state.loading=false}
  }

  function closeEditor(){
    const d=$("#meetingEditor");if(!d)return;
    if(window.STIPOverlayNav?.close)window.STIPOverlayNav.close(d);else d.close();
    state.editing=null;
  }
  function openEditor(id=""){
    const d=$("#meetingEditor"),form=$("[data-meeting-form]",d);
    const n=id?state.notes.find(x=>x.id===id):null;state.editing=n||null;
    const field=(name)=>form.elements.namedItem(name);
    form.reset();field("title").value=n?.title||"";field("meeting_at").value=localInput(n?.meeting_at);field("participants").value=n?.participants||"";field("notes").value=n?.notes||"";field("decisions").value=n?.decisions||"";field("actions").value=n?.actions||"";
    $("[data-meeting-editor-title]",d).textContent=n?"Modifier la note":"Nouvelle note";
    const arch=$("[data-meeting-archive]",d);arch.hidden=!n;arch.textContent=n?.status==="archived"?"Restaurer":"Archiver";
    $("[data-meeting-form-status]",d).textContent="";
    if(!d.open)d.showModal();
  }

  async function save(event){
    event.preventDefault();
    const d=$("#meetingEditor"),form=$("[data-meeting-form]",d),msg=$("[data-meeting-form-status]",d),btn=form.querySelector('button[type="submit"]');
    const meetingAt=form.elements.namedItem("meeting_at");
    const when=meetingAt?.value?new Date(meetingAt.value):null;
    if(!when||Number.isNaN(when.getTime())){msg.textContent="Vérifie la date et l’heure.";return}
    btn.disabled=true;msg.textContent="Enregistrement…";
    try{
      const field=(name)=>form.elements.namedItem(name);
      const j=await post({action:"save",id:state.editing?.id||null,meeting_at:when.toISOString(),title:field("title").value,participants:field("participants").value,notes:field("notes").value,decisions:field("decisions").value,actions:field("actions").value});
      state.notes=j.notes||state.notes;closeEditor();status("Note enregistrée.");render();setTimeout(()=>status(""),1200);
    }catch(e){msg.textContent=e.message||"Impossible d’enregistrer."}
    finally{btn.disabled=false}
  }

  async function toggleArchive(){
    if(!state.editing)return;
    const d=$("#meetingEditor"),msg=$("[data-meeting-form-status]",d),b=$("[data-meeting-archive]",d),next=state.editing.status==="archived"?"active":"archived";
    b.disabled=true;msg.textContent=next==="archived"?"Archivage…":"Restauration…";
    try{
      const j=await post({action:"set_status",id:state.editing.id,status:next});state.notes=j.notes||state.notes;closeEditor();state.tab=next;render();status(next==="archived"?"Note archivée.":"Note restaurée.");setTimeout(()=>status(""),1200);
    }catch(e){msg.textContent=e.message||"Impossible de modifier la note."}
    finally{b.disabled=false}
  }

  document.addEventListener("DOMContentLoaded",()=>{
    $("[data-meeting-new]")?.addEventListener("click",()=>openEditor());
    $("[data-meeting-refresh]")?.addEventListener("click",refresh);
    $("[data-meeting-close]")?.addEventListener("click",closeEditor);
    $("[data-meeting-form]")?.addEventListener("submit",save);
    $("[data-meeting-archive]")?.addEventListener("click",toggleArchive);
    $("[data-meeting-search]")?.addEventListener("input",e=>{state.query=e.target.value;render()});
    $$("[data-meeting-tab]").forEach(b=>b.addEventListener("click",()=>{state.tab=b.dataset.meetingTab;render()}));
    $("#meetingEditor")?.addEventListener("cancel",e=>{e.preventDefault();closeEditor()});
    ["stip:session-ready","stip:boot-updated","stip:permissions-live"].forEach(e=>window.addEventListener(e,refresh));
    refresh();
  });
})();