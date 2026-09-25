(()=>{"use strict";
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-cleanup-control",STORE="stip_session_v1",$=id=>document.getElementById(id),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let data=null,filter="decision",modifyCase=null;
const token=()=>localStorage.getItem(STORE)||"";
async function call(action,body={}){const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"content-type":"application/json","x-stip-session":token()},body:JSON.stringify({action,...body})}),j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw Error(j.error||"Contrôle indisponible.");return j}
async function handoff(id){return call("gpt_handoff",{case_id:id})}
const arr=v=>Array.isArray(v)?v:v==null||v===""?[]:[v],num=v=>new Intl.NumberFormat("fr-FR").format(Number(v||0)),human=k=>String(k||"").replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase());
function val(k,v){const n=Number(v);if(/bytes|size/i.test(k)&&Number.isFinite(n)){const u=["o","Ko","Mo","Go","To"];let x=n,i=0;while(x>=1024&&i<u.length-1){x/=1024;i++}return(i&&x<10?x.toFixed(1):Math.round(x))+" "+u[i]}return Number.isFinite(n)&&typeof v!=="string"?num(v):String(v??"—")}
function status(v){return({open:"À décider",validated:"Validé",modify_requested:"À modifier",refused:"Refusé",delete_approved:"Suppression validée",executing:"Exécution",done:"Terminé",execution_failed:"Échec",superseded:"Remplacé"})[v]||v}
function source(k){return data?.sources?.find(x=>x.source_key===k)?.label||k||"Source"}
function current(){const all=data?.cases||[];if(filter==="decision")return all.filter(x=>x.status==="open");if(filter==="execution")return all.filter(x=>["validated","modify_requested","delete_approved","executing","execution_failed"].includes(x.status));if(filter==="done")return all.filter(x=>["done","refused","superseded"].includes(x.status));return all}
function items(v){const list=arr(v);if(!list.length)return'<p class="ctrl-empty">Aucun élément supplémentaire.</p>';return'<ul class="ctrl-list">'+list.map(x=>typeof x==="string"?"<li>"+esc(x)+"</li>":"<li><b>"+esc(x.label||x.type||x.kind||"Preuve")+"</b> · "+esc(x.value||x.path||x.url||x.ref||x.name||JSON.stringify(x))+"</li>").join("")+"</ul>"}
function card(c){const metrics=Object.entries(c.metrics||{});return`<details class="ctrl-case" data-id="${esc(c.id)}"><summary><div><div class="ctrl-meta"><span>${esc(source(c.source_key))}</span><span>${esc(status(c.status))}</span><span>Preuve ${esc(c.evidence_score||0)}/100</span></div><h3>${esc(c.title)}</h3><p>${esc(c.question)}</p></div><i></i></summary><div class="ctrl-body"><div class="ctrl-core"><article><b>CONTEXTE</b><p>${esc(c.context_text||"Aucun contexte supplémentaire.")}</p></article><article><b>FACTUEL</b><p>${esc(arr(c.facts)[0]||"Voir les faits détaillés.")}</p></article><article><b>OBJECTIF</b><p>${esc(c.proposed_action||"Décider à partir des preuves.")}</p></article></div><section><h4>MESURABLE</h4><div class="ctrl-metrics">${metrics.length?metrics.map(([k,v])=>`<div><strong>${esc(val(k,v))}</strong><small>${esc(human(k))}</small></div>`).join(""):'<div><strong>—</strong><small>Aucune mesure</small></div>'}</div></section><section><h4>FAITS</h4>${items(c.facts)}</section><section><h4>PREUVES</h4>${items(c.evidence)}</section><section><h4>INCERTITUDES</h4>${items(c.uncertainties)}</section><section><h4>ACTION PROPOSÉE</h4><div class="ctrl-proposal">${esc(c.proposed_action||"Aucune action proposée.")}</div></section><section><h4>PLAN SI VALIDÉ</h4>${items(c.proposed_plan)}</section><div class="ctrl-gpt"><div><strong>Faire vérifier par GPT</strong><small>Dossier temporaire supprimé automatiquement.</small></div><button type="button" data-gpt>Continuer dans GPT</button></div>${c.status==="open"?'<div class="ctrl-actions"><button type="button" data-decision="validate">Valider</button><button type="button" data-decision="modify">Modifier</button><button type="button" data-decision="refuse">Refuser</button><button type="button" class="danger" data-decision="delete">Supprimer</button></div>':""}<p class="ctrl-msg"></p></div></details>`}
function render(){const cases=data?.cases||[],decision=cases.filter(x=>x.status==="open").length,execution=cases.filter(x=>["validated","modify_requested","delete_approved","executing","execution_failed"].includes(x.status)).length,done=cases.filter(x=>["done","refused","superseded"].includes(x.status)).length;$("ctrlStats").innerHTML=[["À décider",decision],["En cours",execution],["Traités",done],["Sources",data?.sources?.length||0]].map(([l,n])=>'<div class="ctrl-stat"><strong>'+num(n)+'</strong><span>'+l+'</span></div>').join("");$("ctrlDecisionCount").textContent=decision;$("ctrlExecutionCount").textContent=execution;$("ctrlDoneCount").textContent=done;$("ctrlAllCount").textContent=cases.length;$("ctrlUpdated").textContent="Lecture : "+new Date(data.generated_at).toLocaleString("fr-FR");const list=current();$("ctrlCaseCount").textContent=list.length;$("ctrlListTitle").textContent=filter==="decision"?"À décider":filter==="execution"?"En cours":filter==="done"?"Traités":"Tous les dossiers";$("ctrlCases").innerHTML=list.length?list.map(card).join(""):'<p class="ctrl-empty">Aucun dossier dans cette vue.</p>';$("ctrlSources").innerHTML=(data.sources||[]).map(s=>'<div class="ctrl-source"><div><b>'+esc(s.label)+'</b><small>'+esc(s.source_type)+' · '+esc(s.locator||"—")+'</small></div><span>'+esc(s.last_status||s.mode||"prêt")+'</span></div>').join("");bind()}
function bind(){document.querySelectorAll(".ctrl-case").forEach(el=>{const c=data.cases.find(x=>x.id===el.dataset.id),msg=el.querySelector(".ctrl-msg");el.querySelector("[data-gpt]")?.addEventListener("click",()=>openGpt(c,msg));el.querySelectorAll("[data-decision]").forEach(b=>b.addEventListener("click",()=>decide(c,b.dataset.decision,msg)))})}
async function load(){try{data=await call("overview");render()}catch(e){$("ctrlCases").innerHTML='<p class="ctrl-empty">'+esc(e.message)+'</p>'}}
function openChatGptTarget(webUrl){
  const ua=navigator.userAgent||"";
  if(/Android/i.test(ua)){
    const target=webUrl.replace(/^https:\/\//,"");
    const intent="intent://"+target+"#Intent;scheme=https;package=com.openai.chatgpt;S.browser_fallback_url="+encodeURIComponent(webUrl)+";end";
    location.href=intent;
    return;
  }
  location.href=webUrl;
}
async function openGpt(c,msg){
  msg.textContent="Préparation du dossier…";
  msg.classList.remove("error");
  try{
    const h=await handoff(c.id);
    const instruction=[
      "Tu es mon contre-expert pour une décision technique STIP.",
      "Ouvre et lis intégralement le dossier temporaire ci-dessous.",
      "Suis sa séquence de contre-vérification et utilise mes connecteurs GitHub, Supabase, Vercel et Google Drive si nécessaire.",
      "Ne modifie, ne supprime et ne déploie rien pendant cette vérification.",
      "À la fin, rends uniquement le bloc de décision demandé, prêt à recoller dans STIP.",
      "",
      "DOSSIER TEMPORAIRE : "+h.handoff_url
    ].join("\n");
    const url="https://chatgpt.com/?q="+encodeURIComponent(instruction);
    msg.textContent="Ouverture de ChatGPT…";
    openChatGptTarget(url);
  }catch(e){
    msg.textContent=e.message||"Impossible d’ouvrir GPT.";
    msg.classList.add("error");
  }
}
async function decide(c,d,msg){if(d==="modify"){modifyCase=c;$("ctrlModifyText").value="";$("ctrlModifyDialog").showModal();return}if(d==="delete"&&!confirm("SUPPRESSION DEMANDÉE\n\n"+c.title+"\n\nConfirmer la décision du patron ?"))return;msg.textContent="Enregistrement…";try{await call("decision",{case_id:c.id,decision:d,note:""});await load()}catch(e){msg.textContent=e.message;msg.classList.add("error")}}
$("ctrlBack").onclick=()=>history.length>1?history.back():location.assign("access-manage.html");$("ctrlRefresh").onclick=load;$("ctrlScan").onclick=async()=>{const b=$("ctrlScan"),old=b.textContent;b.disabled=true;b.textContent="Demande envoyée…";try{await call("request_scan",{scope:[]});await load();b.textContent="Contrôle demandé"}catch(e){b.textContent=e.message}finally{setTimeout(()=>{b.disabled=false;b.textContent=old},1800)}};$("ctrlFilters").onclick=e=>{const b=e.target.closest("[data-filter]");if(!b)return;filter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("active",x===b));render()};$("ctrlModifyCancel").onclick=()=>$("ctrlModifyDialog").close();$("ctrlModifySend").onclick=async()=>{const note=$("ctrlModifyText").value.trim();if(!modifyCase||!note){$("ctrlModifyMsg").textContent="Ajoute une consigne.";return}try{await call("decision",{case_id:modifyCase.id,decision:"modify",note});$("ctrlModifyDialog").close();modifyCase=null;await load()}catch(e){$("ctrlModifyMsg").textContent=e.message}};
load();
})();