(() => {
  "use strict";
  const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-change";
  const STORE="stip_session_v1";
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const work=new Set(["M","J","J4","S","N"]);
  const rest=new Set(["R","RH"]);
  const format=d=>new Date(d+"T12:00:00Z").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
  const sort=a=>[...a].sort();
  const dateNow=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  let people=[],mine=new Map(),theirs=new Map(),items=[],targetId="",mode="same",myDates=new Set(),theirDates=new Set();
  let month=new Date((dateNow()||new Date().toISOString().slice(0,10)).slice(0,7)+"-01T12:00:00Z");
  let side="mine",view="create",activeId="",message="",error=false,busy=false,noticeSeen="";
  const canUse=()=>!window.STIPPreview?.active && Boolean(window.STIPSession?.agent?.id || window.STIPSession?.agent?.source_key);
  async function call(action,body={}){
    const token=localStorage.getItem(STORE)||"";
    if(!token)throw Error("Connecte-toi à ton planning GHE.");
    const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","X-STIP-Session":token},body:JSON.stringify({action,...body})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw Error(j.error||"Service indisponible");
    return j;
  }
  const human={
    PLANNING_DATE_MANQUANTE:"Un jour n’existe pas dans le planning de l’un des collègues.",
    JOURS_CROISES_INCOMPATIBLES:"Pour échanger des dates différentes, le jour cédé doit être travaillé et le jour reçu doit être en repos (R ou RH) pour chacun.",
    PLANNING_MODIFIE_DEPUIS_PROPOSITION:"Un horaire a changé depuis la proposition. Il faut refaire la demande.",
    AUTRE_ECHANGE_EN_ATTENTE_SUR_CES_JOURS:"Un autre échange concernant ces dates attend encore une réponse.",
    JOURS_CHEVAUCHANTS:"Certains jours se recoupent. Sélectionne des dates distinctes.",
    MEME_NOMBRE_DE_JOURS_REQUIS:"Sélectionne le même nombre de jours pour chaque personne.",
    ACCES_ECHANGE_REFUSE:"Ce profil n’a pas le droit de déclarer un échange.",
    AUCUN_CHANGEMENT:"Les deux plannings sont déjà identiques sur cette sélection."
  };
  const friendly=e=>human[e?.message]||e?.message||"Erreur inconnue";
  function dialog(){
    let d=$("#ghePeerDialog");
    if(d)return d;
    d=document.createElement("dialog");d.id="ghePeerDialog";d.className="ghe-peer-dialog";
    d.setAttribute("aria-labelledby","ghePeerTitle");
    d.innerHTML='<section class="ghe-peer-frame"><header class="ghe-peer-header"><div><small>MON PLANNING · GHE</small><h2 id="ghePeerTitle">J’ai déjà échangé</h2></div><button type="button" data-peer-close aria-label="Fermer">×</button></header><div id="ghePeerContent" class="ghe-peer-content"></div></section>';
    document.body.appendChild(d);
    d.addEventListener("click",onClick);
    d.addEventListener("change",onChange);
    d.addEventListener("close",()=>{noticeSeen="";});
    return d;
  }
  const statusMessage=()=>message?'<p class="ghe-peer-message'+(error?' is-error':'')+'" role="status">'+esc(message)+'</p>':"";
  function showMessage(t,fail=false){message=t;error=fail;render();}
  function updateBadge(){
    const count=items.filter(x=>x.target_agent_id===window.STIPSession?.agent?.id && x.status==="pending").length;
    document.querySelectorAll("[data-peer-exchange-open]").forEach(b=>{
      const badge=b.querySelector(".ghe-peer-pending");
      if(badge)badge.remove();
      if(count){const span=document.createElement("em");span.className="ghe-peer-pending";span.textContent=String(count)+" à confirmer";b.appendChild(span);}
    });
  }
  async function syncList(){const r=await call("peer_inbox");items=r.items||[];updateBadge();return items;}
  function otherName(x){return x.requester_agent_id===window.STIPSession?.agent?.id?x.target_name:x.requester_name;}
  function statusName(s){return ({pending:"En attente",completed:"Appliqué",refused:"Refusé",cancelled:"Annulé"})[s]||s;}
  function pairSummary(x){
    const pairs=x.pairs||[];
    return pairs.slice(0,5).map(p=>{
      if(p.my_date===p.their_date)return '<div class="ghe-peer-pair"><b>'+esc(format(p.my_date))+'</b><span>'+esc(p.my_code)+' ↔ '+esc(p.their_code)+'</span></div>';
      return '<div class="ghe-peer-pair"><b>'+esc(format(p.my_date))+' ↔ '+esc(format(p.their_date))+'</b><span>'+esc(p.my_code)+' / '+esc(p.their_code)+'</span></div>';
    }).join("")+(pairs.length>5?'<small>Et '+(pairs.length-5)+' autre(s) paire(s)…</small>':"");
  }
  function inboxMarkup(){
    const own=window.STIPSession?.agent?.id;
    const pending=items.filter(x=>x.target_agent_id===own && x.status==="pending");
    const sent=items.filter(x=>x.requester_agent_id===own);
    const received=pending.map(x=>'<article class="ghe-peer-incoming"><strong>'+esc(x.requester_name||"Un collègue")+' déclare un échange avec toi</strong><small>'+x.pairs.length+' jour(s) · '+esc(format(x.pairs[0].my_date))+'</small>'+pairSummary(x)+'<p class="ghe-peer-notice">En acceptant, tu appliques la modification aux deux plannings STIP. Ce n’est pas une validation officielle de l’employeur.</p><div class="ghe-peer-buttons"><button type="button" data-peer-decide="accept" data-id="'+x.id+'">Oui, mettre nos plannings à jour</button><button type="button" class="secondary" data-peer-decide="refuse" data-id="'+x.id+'">Non, refuser</button></div></article>').join("");
    const history=sent.slice(0,20).map(x=>'<article class="ghe-peer-record"><div><strong>'+esc(x.target_name||"Collègue")+'</strong><small>'+x.pairs.length+' jour(s) · '+esc(format(x.pairs[0].my_date))+'</small></div><span>'+esc(statusName(x.status))+'</span>'+(x.status==="pending"?'<button class="secondary" data-peer-cancel="'+x.id+'">Annuler</button>':"")+'</article>').join("");
    return '<div class="ghe-peer-tabs"><button type="button" data-peer-view="create">Déclarer un échange</button><button class="active" type="button" data-peer-view="inbox">À confirmer'+(pending.length?' ('+pending.length+')':'')+'</button></div>'+
      statusMessage()+'<h3>Demandes reçues</h3>'+(received||'<p class="ghe-peer-empty">Aucune confirmation en attente.</p>')+
      '<h3>Mes échanges déclarés</h3>'+(history||'<p class="ghe-peer-empty">Aucune déclaration.</p>');
  }
  function pad(n){return String(n).padStart(2,"0");}
  function calendarMarkup(which){
    const first=new Date(month),year=first.getUTCFullYear(),m=first.getUTCMonth(),start=(first.getUTCDay()+6)%7;
    const chosen=which==="mine"?myDates:theirDates;
    let days='<div class="ghe-peer-weekdays">'+["L","M","M","J","V","S","D"].map(x=>'<b>'+x+'</b>').join("")+'</div><div class="ghe-peer-month-grid">';
    for(let i=0;i<start;i++)days+='<span aria-hidden="true"></span>';
    const end=new Date(Date.UTC(year,m+1,0,12)).getUTCDate();
    for(let day=1;day<=end;day++){
      const iso=year+'-'+pad(m+1)+'-'+pad(day),a=mine.get(iso),b=theirs.get(iso);
      const valid=!!a&&!!b&&(mode==="same"?a!==b:which==="mine"?work.has(a)&&rest.has(b):work.has(b)&&rest.has(a));
      days+='<button type="button" data-peer-date="'+iso+'" data-side="'+which+'" '+(valid?'':'disabled')+' class="'+(chosen.has(iso)?'selected':'')+'" title="'+esc(a||"—")+' / '+esc(b||"—")+'"><span>'+day+'</span><small>'+esc(which==="mine"?a||"—":b||"—")+'</small></button>';
    }
    return days+'</div>';
  }
  function currentPairs(){
    const a=sort(myDates),b=mode==="same"?a:sort(theirDates);
    if(a.length!==b.length)return [];
    return a.map((d,i)=>({my_date:d,their_date:b[i],my_code:mine.get(d),their_code:theirs.get(b[i]),my_other_code:mine.get(b[i]),their_other_code:theirs.get(d)}));
  }
  function reviewMarkup(){
    const p=currentPairs();
    if(!myDates.size)return '<p class="ghe-peer-empty">Sélectionne un ou plusieurs jours sur le calendrier.</p>';
    if(!p.length)return '<p class="ghe-peer-empty">Sélectionne autant de jours chez chaque personne.</p>';
    if(mode==="cross"&&p.some(x=>myDates.has(x.their_date)))return '<p class="ghe-peer-empty">Les dates de départ et d’arrivée doivent être distinctes.</p>';
    return '<div class="ghe-peer-preview">'+p.slice(0,6).map(x=>{
      if(mode==="same")return '<div>'+esc(format(x.my_date))+' : <b>Moi '+esc(x.my_code)+' → '+esc(x.their_code)+'</b> · Collègue '+esc(x.their_code)+' → '+esc(x.my_code)+'</div>';
      return '<div>'+esc(format(x.my_date))+' / '+esc(format(x.their_date))+' : <b>nous échangeons nos jours travaillés</b></div>';
    }).join("")+(p.length>6?'<small>+'+(p.length-6)+' autres échanges</small>':"")+'</div>';
  }
  function formMarkup(){
    const available=people.length,selected=people.find(x=>x.id===targetId);
    const valid=targetId&&myDates.size&&(mode==="same"||myDates.size===theirDates.size);
    return '<div class="ghe-peer-tabs"><button type="button" class="active" data-peer-view="create">Déclarer un échange</button><button type="button" data-peer-view="inbox">À confirmer'+(items.filter(x=>x.target_agent_id===window.STIPSession?.agent?.id&&x.status==="pending").length?' !':'')+'</button></div>'+
      statusMessage()+'<section class="ghe-peer-step"><h3><b>1</b> Avec qui as-tu échangé ?</h3><select id="ghePeerTarget"><option value="">Sélectionner un collègue…</option>'+people.map(p=>'<option value="'+p.id+'" '+(targetId===p.id?'selected':'')+'>'+esc([p.prenom,p.nom].filter(Boolean).join(' '))+'</option>').join("")+'</select>'+(available?'':'<p>Aucun collègue accessible dans cette équipe.</p>')+'</section>'+
      (selected?'<section class="ghe-peer-step"><h3><b>2</b> Quel type d’échange ?</h3><div class="ghe-peer-modes"><button type="button" data-peer-mode="same" class="'+(mode==="same"?'active':'')+'">Même(s) date(s)</button><button type="button" data-peer-mode="cross" class="'+(mode==="cross"?'active':'')+'">Dates différentes</button></div><p class="ghe-peer-hint">Un jour seul, plusieurs jours séparés ou une période complète.</p></section>'+
      '<section class="ghe-peer-step"><h3><b>3</b> Sélectionne les dates</h3><div class="ghe-peer-month-nav"><button type="button" data-peer-month="-1" aria-label="Mois précédent">‹</button><strong>'+esc(month.toLocaleDateString("fr-FR",{month:"long",year:"numeric",timeZone:"UTC"}))+'</strong><button type="button" data-peer-month="1" aria-label="Mois suivant">›</button></div>'+
      (mode==="cross"?'<div class="ghe-peer-side-tabs"><button type="button" data-peer-side="mine" class="'+(side==="mine"?'active':'')+'">Mes jours ('+myDates.size+')</button><button type="button" data-peer-side="theirs" class="'+(side==="theirs"?'active':'')+'">Jours de '+esc(selected.prenom||"l’autre")+' ('+theirDates.size+')</button></div>':'')+
      calendarMarkup(mode==="same"?"mine":side)+
      '<div class="ghe-peer-range"><label>Du <input type="date" id="ghePeerFrom"></label><label>Au <input type="date" id="ghePeerTo"></label><button type="button" data-peer-range>Ajouter la période</button></div>'+
      '<div class="ghe-peer-chips"><strong>Jours choisis :</strong> '+(sort(myDates).map(d=>'<button type="button" data-peer-remove="'+d+'" data-side="mine">'+esc(format(d))+' ×</button>').join("")||'Aucun')+'</div>'+
      (mode==="cross"?'<div class="ghe-peer-chips"><strong>Chez le collègue :</strong> '+(sort(theirDates).map(d=>'<button type="button" data-peer-remove="'+d+'" data-side="theirs">'+esc(format(d))+' ×</button>').join("")||'Aucun')+'</div>':'')+
      '</section><section class="ghe-peer-step"><h3><b>4</b> Vérifie l’échange</h3>'+reviewMarkup()+
      '<p class="ghe-peer-notice">Cette déclaration ne remplace pas une autorisation officielle. Le planning STIP ne changera qu’après confirmation du collègue.</p>'+
      '<button type="button" class="ghe-peer-submit" data-peer-create '+(valid?'':'disabled')+'>'+(busy?'Enregistrement…':'Envoyer au collègue pour confirmation')+'</button></section>':'') ;
  }
  function render(){const el=$("#ghePeerContent");if(!el)return;el.innerHTML=view==="inbox"?inboxMarkup():formMarkup();}
  async function chooseTarget(id){
    targetId=id;mine=new Map();theirs=new Map();myDates.clear();theirDates.clear();message="";
    if(!id){render();return;}
    try{
      busy=true;render();
      const d=await call("peer_days",{target_agent_id:id});
      if(id!==targetId)return;
      mine=new Map((d.mine||[]).map(x=>[x.date,String(x.code||"").toUpperCase()]));
      theirs=new Map((d.theirs||[]).map(x=>[x.date,String(x.code||"").toUpperCase()]));
      month=new Date(dateNow().slice(0,7)+"-01T12:00:00Z");
      render();
    }catch(e){showMessage(friendly(e),true);}finally{busy=false;}
  }
  async function open(to="create"){
    if(!canUse())return;
    view=to;message="";error=false;
    const d=dialog();
    if(!d.open)d.showModal();
    $("#ghePeerContent").innerHTML='<p class="ghe-peer-loading">Chargement des plannings…</p>';
    try{
      const [a]=await Promise.all([call("peer_directory"),syncList()]);
      people=a.agents||[];
      if(!a.allowed&&to==="create"){view="inbox";message="Tu peux répondre aux propositions reçues, mais pas déclarer un échange.";}
      render();
    }catch(e){showMessage(friendly(e),true);}
  }
  async function accept(id,decision){
    if(busy)return;
    busy=true;
    try{
      const r=await call("peer_decide",{id,decision});
      await syncList();
      if(decision==="accept"&&r.result?.status==="completed"){
        window.dispatchEvent(new CustomEvent("stip:peer-exchange-applied"));
        showMessage("Échange appliqué aux deux plannings GHE. Les calendriers abonnés se synchroniseront lors de leur prochain rafraîchissement.");
      }else showMessage("Échange refusé. Aucun planning n’a été modifié.");
    }catch(e){showMessage(friendly(e),true);}finally{busy=false;}
  }
  async function save(){
    if(busy||!targetId)return;
    busy=true;
    try{
      const b={target_agent_id:targetId,mode,my_dates:sort(myDates),their_dates:mode==="cross"?sort(theirDates):[]};
      const r=await call("peer_create",b);
      await syncList();view="inbox";
      showMessage("Proposition enregistrée. Ton collègue verra une fenêtre de confirmation en ouvrant GHE.");
      activeId=r.item?.id||"";
    }catch(e){showMessage(friendly(e),true);}finally{busy=false;}
  }
  function range(){
    const a=$("#ghePeerFrom")?.value,b=$("#ghePeerTo")?.value;
    if(!a||!b||b<a){showMessage("Choisis deux dates dans le bon ordre.",true);return;}
    const selected=mode==="same"||side==="mine"?myDates:theirDates;
    const start=new Date(a+"T12:00:00Z"),end=new Date(b+"T12:00:00Z");
    const count=Math.round((end-start)/86400000)+1;
    if(count>93||count<1){showMessage("La sélection doit contenir au maximum 93 jours.",true);return;}
    for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){
      const iso=d.toISOString().slice(0,10),x=mine.get(iso),y=theirs.get(iso);
      if(x&&y&&(mode==="same"?x!==y:side==="mine"?work.has(x)&&rest.has(y):work.has(y)&&rest.has(x)))selected.add(iso);
    }
    if(selected.size>93){showMessage("Maximum : 93 jours. Retire certaines dates.",true);return;}
    message="";render();
  }
  async function onClick(e){
    const b=e.target.closest("button");
    if(!b)return;
    if(b.hasAttribute("data-peer-close")){dialog().close();return;}
    if(b.dataset.peerView){view=b.dataset.peerView;message="";render();return;}
    if(b.dataset.peerMode){mode=b.dataset.peerMode;myDates.clear();theirDates.clear();side="mine";message="";render();return;}
    if(b.dataset.peerSide){side=b.dataset.peerSide;render();return;}
    if(b.dataset.peerMonth){
      month.setUTCMonth(month.getUTCMonth()+Number(b.dataset.peerMonth));
      render();return;
    }
    if(b.dataset.peerDate){
      const v=mode==="same"||b.dataset.side==="mine"?myDates:theirDates;
      v.has(b.dataset.peerDate)?v.delete(b.dataset.peerDate):v.add(b.dataset.peerDate);
      message="";render();return;
    }
    if(b.dataset.peerRemove){
      (b.dataset.side==="theirs"?theirDates:myDates).delete(b.dataset.peerRemove);render();return;
    }
    if(b.hasAttribute("data-peer-range")){range();return;}
    if(b.hasAttribute("data-peer-create")){await save();return;}
    if(b.dataset.peerDecide){await accept(b.dataset.id,b.dataset.peerDecide);return;}
    if(b.dataset.peerCancel){
      if(busy)return;
      busy=true;
      try{await call("peer_cancel",{id:b.dataset.peerCancel});await syncList();showMessage("Proposition annulée.");}
      catch(e){showMessage(friendly(e),true);}finally{busy=false;}
    }
  }
  function onChange(e){if(e.target.id==="ghePeerTarget")chooseTarget(e.target.value);}
  document.addEventListener("click",e=>{
    if(e.target.closest?.("[data-peer-exchange-open]")){e.preventDefault();open("create");}
  });
  async function startup(){
    if(!canUse()||!localStorage.getItem(STORE))return;
    try{
      await syncList();
      const own=window.STIPSession?.agent?.id;
      const pending=items.find(x=>x.target_agent_id===own&&x.status==="pending"&&sessionStorage.getItem("ghe_peer_prompt_seen_"+x.id)!=="1");
      if(pending&&(!document.querySelector("dialog[open]"))){
        sessionStorage.setItem("ghe_peer_prompt_seen_"+pending.id,"1");
        await open("inbox");
      }
    }catch(e){console.warn("Échanges GHE indisponibles",friendly(e));}
  }
  window.addEventListener("stip:session-ready",()=>setTimeout(startup,350));
  window.addEventListener("stip:session-refreshed",()=>setTimeout(startup,350));
  window.addEventListener("stip:home-rendered",updateBadge);
  window.addEventListener("stip:session-ended",()=>{items=[];people=[];mine.clear();theirs.clear();myDates.clear();theirDates.clear();dialog().close?.();});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{if(canUse())startup();});
  else if(canUse())setTimeout(startup,350);
  window.STIPPeerExchanges={open,refresh:startup};
})();
