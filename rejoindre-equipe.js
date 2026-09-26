(()=>{"use strict";
const API="https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-public-access-request";
const TRACKING="stip_access_request_tracking_v1",PENDING="stip_page_upload_pending_v1";
const $=id=>document.getElementById(id),form=$("pageRequestForm"),file=$("planningFile"),fileName=$("fileName"),code=$("requestedCode"),toggle=$("toggleCode"),message=$("requestMessage"),submit=$("requestSubmit"),success=$("requestSuccess");
const fmt=n=>{n=Number(n||0);if(n<1024)return n+" o";if(n<1048576)return(n/1024).toFixed(1)+" Ko";return(n/1048576).toFixed(1)+" Mo"};
const pending=()=>{try{return JSON.parse(localStorage.getItem(PENDING)||"null")}catch{return null}};
const post=async body=>{const r=await fetch(API,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw Error(j.error||"Envoi impossible.");return j};
const mimeFor=f=>f.type||({pdf:"application/pdf",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp"}[f.name.toLowerCase().split(".").pop()]||"application/octet-stream");
file?.addEventListener("change",()=>{const f=file.files?.[0];fileName.textContent=f?f.name+" · "+fmt(f.size):""});
code?.addEventListener("input",()=>{code.value=code.value.replace(/\D/g,"").slice(0,6)});
toggle?.addEventListener("click",()=>{const show=code.type==="password";code.type=show?"text":"password";toggle.textContent=show?"Masquer":"Voir"});
async function signedUpload(url,f){
  const body=new FormData(),type=mimeFor(f),payload=f.type?f:new File([f],f.name,{type});
  body.append("cacheControl","3600");
  body.append("",payload,payload.name);
  const r=await fetch(url,{method:"PUT",headers:{"x-upsert":"false"},body});
  if(!r.ok){const j=await r.json().catch(()=>({}));throw Error(j.message||j.error||"Le planning n’a pas pu être envoyé.")}
}
if(pending())message.textContent="Un envoi précédent n’a pas été terminé. Rechoisissez le planning puis envoyez pour le reprendre.";
form?.addEventListener("submit",async e=>{
  e.preventDefault();
  const f=file.files?.[0];
  if(!f){message.textContent="Ajoutez votre planning.";message.className="message error";return}
  if(f.size>15*1024*1024){message.textContent="Le planning dépasse 15 Mo.";message.className="message error";return}
  if(!/^\d{6}$/.test(code.value)){message.textContent="Choisissez exactement 6 chiffres.";message.className="message error";return}
  submit.disabled=true;message.textContent="Préparation de l’envoi…";message.className="message";
  try{
    let p=pending(),prep;
    if(p?.request_id&&p?.tracking_token){
      prep=await post({action:"resume_page",request_id:p.request_id,tracking_token:p.tracking_token,file_name:f.name,file_size:f.size,file_type:mimeFor(f)});
    }else{
      const fd=new FormData(form);
      prep=await post({action:"prepare_page",first_name:String(fd.get("first_name")||""),last_name:String(fd.get("last_name")||""),professional_role:String(fd.get("professional_role")||""),workplace:String(fd.get("workplace")||""),comment:String(fd.get("comment")||""),requested_code:code.value,file_name:f.name,file_size:f.size,file_type:mimeFor(f)});
      p={request_id:prep.request_id,tracking_token:prep.tracking_token};
      localStorage.setItem(PENDING,JSON.stringify(p));
      localStorage.setItem(TRACKING,JSON.stringify({...p,created_at:Date.now()}));
    }
    message.textContent="Envoi du planning…";
    await signedUpload(prep.signed_url,f);
    message.textContent="Finalisation…";
    await post({action:"complete_page",request_id:p.request_id,tracking_token:p.tracking_token});
    localStorage.removeItem(PENDING);
    form.reset();fileName.textContent="";form.hidden=true;success.classList.add("show");
  }catch(err){
    message.textContent=err?.message||"Envoi impossible.";
    message.className="message error";
    submit.disabled=false;
  }
});
})();