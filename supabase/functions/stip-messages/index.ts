import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL=Deno.env.get("SUPABASE_URL")!,SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(URL,SERVICE,{auth:{persistSession:false}});
const TRAINEE_DEFAULT_AVATAR="https://raw.githubusercontent.com/esapin69/stip/0bd3aea4a363e2decfb1b41f20b4d349f157ebcd/images/stagiaire-default.png";
const TABLEAU_PREFIX="__stip_tableau_day__:",LEGACY_TEAM_KEY="__stip_team_chat_v1__",TEAM_BUCKET="stip-team-chat";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-stip-session","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};

const LEGACY_AVATAR_STORAGE="/storage/v1/";
function stripLegacyAvatarPayload(value:any){
  const walk=(v:any)=>{
    if(!v||typeof v!=="object")return;
    if(Array.isArray(v)){for(const x of v)walk(x);return}
    const legacy=(raw:any)=>{
      const url=String(raw||"");
      return url.includes(LEGACY_AVATAR_STORAGE)&&url.includes("/planning-pdf/");
    };
    if(legacy(v.avatar_url))v.avatar_url=null;
    if(legacy(v.avatar_signed_url))v.avatar_signed_url=null;
    for(const x of Object.values(v))walk(x);
  };
  walk(value);
  return value;
}
const J=async(x:unknown,s=200)=>new Response(JSON.stringify(stripLegacyAvatarPayload(x)),{status:s,headers:H});
function errMsg(e:any){
  if(e instanceof Error&&e.message)return e.message;
  if(e&&typeof e==="object"){
    const parts=[e.message,e.details,e.hint,e.code].map((x:any)=>String(x||"").trim()).filter(Boolean);
    if(parts.length)return [...new Set(parts)].join(" · ");
  }
  const s=String(e||"").trim();
  return s&&s!=="[object Object]"?s:"Erreur serveur.";
}
const enc=new TextEncoder();
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,"0")).join("");
async function sha(s:string){return hex(await crypto.subtle.digest("SHA-256",enc.encode(s)))}
function nick(a:any,p:any){return String(p?.nickname||a?.prenom||a?.nom||"Agent").trim()}
function display(a:any){return [a?.prenom,a?.nom].filter(Boolean).join(" ").trim()||"Agent"}
function teamOf(a:any){const t=String(a?.type_planning||a?.equipe||"jour").toLowerCase();return t==="stagiaire"||t==="stage"?"stage":t==="nuit"?"nuit":t.includes("chef")?"chefs":"jour"}
function safeTraineeKey(v:any){const key=String(v||"").trim();return /^[a-z0-9_-]{1,100}$/i.test(key)?key:""}
async function traineeActor(key:string){
  key=safeTraineeKey(key);if(!key)return null;
  const{data,error}=await db.from("stagiaires").select("nom,prenom,source_key,date_debut").like("source_key",`stagiaire:${key}:%`).order("date_debut").limit(1).maybeSingle();
  if(error)throw error;if(!data)return null;
  return{id:`stagiaire:${key}`,source_key:`stagiaire:${key}`,prenom:data.prenom,nom:data.nom,ghe:null,equipe:"stage",type_planning:"stagiaire",profile_photo_url:TRAINEE_DEFAULT_AVATAR,avatar_url:TRAINEE_DEFAULT_AVATAR,trainee_key:key,identity_kind:"stagiaire"}
}
function actorKey(ctx:any){return ctx?.is_trainee?`stagiaire:${ctx.trainee_key}`:String(ctx?.agent?.id||"")}
async function actorDisplayName(ctx:any){if(ctx?.is_trainee)return display(ctx.agent)||"Stagiaire";const profile=await messageProfile(String(ctx.agent.id));return nick(ctx.agent,profile)}
function senderOwnerKey(row:any){return row?.sender_stagiaire_key?`stagiaire:${row.sender_stagiaire_key}`:String(row?.sender_agent_id||"")}
async function ctx(req:Request){
  const t=req.headers.get("x-stip-session")||"";if(!t)throw Error("Session STIP requise.");
  const{data:s,error:se}=await db.from("stip_access_sessions").select("profile_id,expires_at,revoked_at,selected_stagiaire_key").eq("token_hash",await sha(t)).maybeSingle();
  if(se)throw se;if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())throw Error("Session expirée.");
  const{data:p,error:pe}=await db.from("stip_access_profiles").select("agent_id,active,permissions,role_key,preset_roles,agents(id,source_key,prenom,nom,ghe,equipe,type_planning,profile_photo_url,avatar_url)").eq("id",s.profile_id).maybeSingle();
  if(pe)throw pe;if(!p?.active)throw Error("Accès désactivé.");if(!p.permissions?.messages)throw Error("Messages non autorisés.");
  if(String(p.role_key||"")==="stagiaire"){
    const key=safeTraineeKey(s.selected_stagiaire_key),actor=await traineeActor(key);
    if(!actor)throw Error("Choisis le stagiaire de cette session.");
    return{profile:p,agent:actor,trainee_key:key,is_trainee:true}
  }
  if(!p.agent_id||!p.agents)throw Error("Accès agent requis.");
  return{profile:p,agent:p.agents as any,is_trainee:false}
}
async function messageProfile(id:string){
  const{data}=await db.from("stip_message_profiles").select("nickname,notification_preview").eq("agent_id",id).maybeSingle();
  return data||{nickname:null,notification_preview:true}
}
async function notificationType(eventKey:string){
  const{data,error}=await db.from("stip_notification_types")
    .select("event_key,label,description,push_enabled,default_user_enabled,active,sort_order")
    .eq("event_key",eventKey).eq("active",true).maybeSingle();
  if(error)throw error;
  return data||null
}
async function notificationPreference(agentId:string,eventKey:string){
  const type=await notificationType(eventKey);
  if(!type)return{event_key:eventKey,push_enabled:false,enabled:false,default_user_enabled:false};
  const{data,error}=await db.from("stip_notification_preferences")
    .select("enabled").eq("agent_id",agentId).eq("event_key",eventKey).maybeSingle();
  if(error)throw error;
  return{...type,enabled:data?.enabled??type.default_user_enabled}
}
async function notificationPreferences(ctx:any){
  if(ctx?.is_trainee)return{items:[]};
  const{data:types,error}=await db.from("stip_notification_types")
    .select("event_key,label,description,push_enabled,default_user_enabled,sort_order")
    .eq("active",true).order("sort_order");
  if(error)throw error;
  const keys=(types||[]).map((x:any)=>String(x.event_key));
  const{data:prefs,error:pe}=keys.length
    ?await db.from("stip_notification_preferences").select("event_key,enabled").eq("agent_id",ctx.agent.id).in("event_key",keys)
    :{data:[] as any[],error:null};
  if(pe)throw pe;
  const by=new Map((prefs||[]).map((x:any)=>[String(x.event_key),!!x.enabled]));
  return{items:(types||[]).map((x:any)=>({...x,enabled:by.has(String(x.event_key))?by.get(String(x.event_key)):x.default_user_enabled}))}
}
async function notificationSet(ctx:any,body:any){
  if(ctx?.is_trainee)throw Error("Accès non autorisé.");
  const eventKey=String(body.event_key||"").trim(),type=await notificationType(eventKey);
  if(!type)throw Error("Type de notification inconnu.");
  const enabled=body.enabled!==false;
  const{error}=await db.from("stip_notification_preferences").upsert({
    agent_id:ctx.agent.id,event_key:eventKey,enabled,updated_at:new Date().toISOString()
  },{onConflict:"agent_id,event_key"});
  if(error)throw error;
  return{ok:true,event_key:eventKey,enabled,push_enabled:type.push_enabled!==false}
}
async function dmStatus(ctx:any){
  if(ctx?.is_trainee)return{unread:0};
  const{data:member,error}=await db.from("stip_conversation_members")
    .select("conversation_id,last_read_at").eq("agent_id",ctx.agent.id);
  if(error)throw error;
  const ids=(member||[]).map((x:any)=>String(x.conversation_id));
  if(!ids.length)return{unread:0};
  const read=new Map((member||[]).map((x:any)=>[String(x.conversation_id),x.last_read_at]));
  const{data:convs,error:ce}=await db.from("stip_conversations")
    .select("id,kind").in("id",ids).in("kind",["direct","group"]);
  if(ce)throw ce;
  const counts=await Promise.all((convs||[]).map(async(c:any)=>{
    const{count,error:countError}=await db.from("stip_messages").select("id",{count:"exact",head:true})
      .eq("conversation_id",c.id).is("deleted_at",null).neq("sender_agent_id",ctx.agent.id)
      .gt("created_at",read.get(String(c.id))||"1970-01-01T00:00:00Z");
    if(countError)throw countError;
    return count||0
  }));
  return{unread:counts.reduce((n:number,x:number)=>n+Number(x||0),0)}
}
async function activeMessagingAgents(){
  const{data:p,error}=await db.from("stip_access_profiles").select("agent_id,permissions").eq("active",true).not("agent_id","is",null);
  if(error)throw error;return [...new Set((p||[]).filter((x:any)=>x.permissions?.messages).map((x:any)=>String(x.agent_id)))]
}
async function agents(ctx:any,q=""){
  const ids=await activeMessagingAgents();if(!ids.length)return[];
  const{data,error}=await db.from("agents").select("id,source_key,prenom,nom,ghe,equipe,type_planning,profile_photo_url,avatar_url").in("id",ids).eq("actif",true).order("prenom").order("nom");
  if(error)throw error;
  const{data:profiles}=await db.from("stip_message_profiles").select("agent_id,nickname").in("agent_id",ids);
  const by=new Map((profiles||[]).map((p:any)=>[String(p.agent_id),p]));
  const n=String(q||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  return(data||[]).filter((a:any)=>String(a.id)!==String(ctx.agent.id)).map((a:any)=>({...a,nickname:nick(a,by.get(String(a.id)))})).filter((a:any)=>!n||`${a.nickname} ${a.prenom||""} ${a.nom||""} ${a.ghe||""}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(n)).slice(0,80)
}
async function onDuty(ctx:any){
  const nowParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()),g=(k:string)=>nowParts.find(x=>x.type===k)?.value||"",today=g("year")+"-"+g("month")+"-"+g("day"),minute=Number(g("hour"))*60+Number(g("minute")),d=new Date(today+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-1);const yesterday=d.toISOString().slice(0,10),team=teamOf(ctx.agent),allowed=new Set(await activeMessagingAgents());
  let q=db.from("planning").select("date,agent_id,code,equipe,agents(id,source_key,prenom,nom,ghe,equipe,type_planning,profile_photo_url,avatar_url)").in("date",[today,yesterday]);
  q=team==="chefs"?q.in("equipe",["jour","nuit","chefs"]):q.eq("equipe",team);
  const{data,error}=await q;if(error)throw error;
  const ranges:any={M:[410,880],J:[510,980],J4:[610,1080],S:[810,1260]},items:any[]=[];
  for(const r of data||[]){if(!allowed.has(String(r.agent_id)))continue;const code=String(r.code||"").toUpperCase().replace(/\*/g,""),base=code==="J4"?"J4":/^(M|J|S|N)$/.test(code)?code:"";let active=false;if(base==="N")active=(r.date===today&&minute>=1260)||(r.date===yesterday&&minute<=410);else if(r.date===today&&ranges[base])active=minute>=ranges[base][0]&&minute<=ranges[base][1];if(active&&r.agents)items.push({...r.agents,nickname:null,shift:base})}
  const ids=items.map(x=>x.id),{data:profiles}=ids.length?await db.from("stip_message_profiles").select("agent_id,nickname").in("agent_id",ids):{data:[] as any[]},by=new Map((profiles||[]).map((p:any)=>[String(p.agent_id),p]));
  return items.map(a=>({...a,nickname:nick(a,by.get(String(a.id)))}))
}
async function isMember(conversationId:string,agentId:string){
  const{data,error}=await db.from("stip_conversation_members").select("conversation_id").eq("conversation_id",conversationId).eq("agent_id",agentId).maybeSingle();
  if(error)throw error;return!!data
}
function dmSafeName(value:any){
  return String(value||"photo")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/-+/g,"-")
    .replace(/^-+|-+$/g,"").slice(0,96)||"photo"
}
async function storeDmImage(ctx:any,conversationId:string,image:any){
  if(!image||typeof image!=="object")return null;
  const mime=String(image.mime||"").toLowerCase(),raw=String(image.data||"");
  if(!["image/jpeg","image/png","image/webp"].includes(mime))throw Error("Format d’image non pris en charge.");
  if(!raw||raw.length>4300000)throw Error("Photo trop lourde (3 Mo max).");
  let bytes:Uint8Array;
  try{
    const bin=atob(raw);bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i)
  }catch{throw Error("Photo invalide.")}
  if(bytes.byteLength<1||bytes.byteLength>3000000)throw Error("Photo trop lourde (3 Mo max).");
  const ext=mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg",
    original=dmSafeName(image.name||("photo."+ext)),
    path="dm/"+parisDayKey()+"/"+conversationId+"/"+String(ctx.agent.id)+"/"+crypto.randomUUID()+"."+ext;
  const up=await db.storage.from(TEAM_BUCKET).upload(path,bytes,{contentType:mime,upsert:false,cacheControl:"3600"});
  if(up.error)throw up.error;
  return{storage_path:path,mime_type:mime,file_name:original,size_bytes:bytes.byteLength}
}
async function signedDmAttachments(messages:any[]){
  const paths=[...new Set(messages.flatMap((message:any)=>
    (Array.isArray(message?.payload?.attachments)?message.payload.attachments:[])
      .map((item:any)=>String(item?.storage_path||""))
      .filter((path:string)=>path.startsWith("dm/"))
  ))];
  if(!paths.length)return messages;
  const{data,error}=await db.storage.from(TEAM_BUCKET).createSignedUrls(paths,1800);
  if(error||!data)return messages;
  const urls=new Map<string,string>();
  paths.forEach((path,i)=>{const url=(data as any[])?.[i]?.signedUrl;if(url)urls.set(path,url)});
  return messages.map((message:any)=>{
    const attachments=Array.isArray(message?.payload?.attachments)?message.payload.attachments:[];
    if(!attachments.length)return message;
    return{...message,payload:{...(message.payload||{}),attachments:attachments.map((item:any)=>{
      const path=String(item?.storage_path||"");
      return path&&urls.has(path)?{...item,url:urls.get(path)}:item
    })}}
  })
}
async function direct(ctx:any,target:string){
  if(!target||target===String(ctx.agent.id))throw Error("Destinataire invalide.");
  const allowed=await activeMessagingAgents();if(!allowed.includes(target))throw Error("Ce professionnel n’a pas accès aux Messages STIP.");
  const key=[String(ctx.agent.id),target].sort().join(":");
  let{data:conv,error}=await db.from("stip_conversations").select("id,kind,title,direct_key").eq("direct_key",key).maybeSingle();
  if(error)throw error;
  if(!conv){
    const r=await db.from("stip_conversations").insert({kind:"direct",direct_key:key,created_by_agent_id:ctx.agent.id}).select("id,kind,title,direct_key").single();
    if(r.error)throw r.error;conv=r.data;
    const m=await db.from("stip_conversation_members").insert([{conversation_id:conv.id,agent_id:ctx.agent.id,last_read_at:new Date().toISOString()},{conversation_id:conv.id,agent_id:target}]);
    if(m.error)throw m.error
  }
  return conv
}
async function group(ctx:any,body:any){
  const ids=[...new Set((Array.isArray(body.agent_ids)?body.agent_ids:[]).map(String).filter(Boolean))].filter(x=>x!==String(ctx.agent.id));
  if(!ids.length)throw Error("Choisis au moins un destinataire.");
  const allowed=await activeMessagingAgents();for(const id of ids)if(!allowed.includes(id))throw Error("Un destinataire n’a plus accès aux Messages STIP.");
  const title=String(body.title||"").trim().slice(0,80)||null;
  const kind=body.kind==="broadcast"?"broadcast":"group";
  const{data:conv,error}=await db.from("stip_conversations").insert({kind,title,created_by_agent_id:ctx.agent.id}).select("id,kind,title").single();
  if(error)throw error;
  const members=[ctx.agent.id,...ids].map((id:any)=>({conversation_id:conv.id,agent_id:id,last_read_at:String(id)===String(ctx.agent.id)?new Date().toISOString():null}));
  const r=await db.from("stip_conversation_members").insert(members);if(r.error)throw r.error;
  if(String(body.body||"").trim())await send(ctx,{conversation_id:conv.id,body:body.body,payload:body.payload||{}});
  if(kind==="broadcast"){
    const payload=body.payload&&typeof body.payload==="object"?body.payload:{},quantity=payload.quantity===""||payload.quantity==null?null:Math.max(0,Number(payload.quantity)||0);
    const br=await db.from("stip_operational_broadcasts").insert({conversation_id:conv.id,created_by_agent_id:ctx.agent.id,category:String(payload.category||"info").slice(0,40),title:title,body:String(body.body||"").trim().slice(0,2000),location_text:String(payload.location||"").trim().slice(0,200)||null,quantity,status:"active"});if(br.error)throw br.error
  }
  return conv
}
async function thread(ctx:any,id:string){
  if(!await isMember(id,String(ctx.agent.id)))throw Error("Conversation non autorisée.");
  const{data:conv,error:ce}=await db.from("stip_conversations").select("id,kind,title,created_by_agent_id,created_at,last_message_at").eq("id",id).maybeSingle();if(ce)throw ce;if(!conv)throw Error("Conversation introuvable.");
  const{data:members,error:me}=await db.from("stip_conversation_members").select("agent_id,last_read_at,agents(id,prenom,nom,ghe,profile_photo_url,avatar_url)").eq("conversation_id",id);if(me)throw me;
  const mids=(members||[]).map((x:any)=>x.agent_id);const{data:profiles}=mids.length?await db.from("stip_message_profiles").select("agent_id,nickname").in("agent_id",mids):{data:[] as any[]};
  const by=new Map((profiles||[]).map((p:any)=>[String(p.agent_id),p]));
  const{data:messages,error}=await db.from("stip_messages").select("id,body,payload,created_at,sender_agent_id,sender:agents!stip_messages_sender_agent_id_fkey(id,prenom,nom,ghe,profile_photo_url,avatar_url)").eq("conversation_id",id).is("deleted_at",null).order("created_at").limit(1000);if(error)throw error;
  const signedMessages=await signedDmAttachments(messages||[]);
  const {data:broadcast}=conv.kind==="broadcast"?await db.from("stip_operational_broadcasts").select("id,category,title,body,location_text,quantity,status,expires_at,updated_at,created_at").eq("conversation_id",id).maybeSingle():{data:null};
  await db.from("stip_conversation_members").update({last_read_at:new Date().toISOString()}).eq("conversation_id",id).eq("agent_id",ctx.agent.id);
  return{conversation:conv,broadcast:broadcast||null,members:(members||[]).map((m:any)=>({...m,agent:{...m.agents,nickname:nick(m.agents,by.get(String(m.agent_id)))}})),messages:signedMessages.map((m:any)=>({...m,sender:{...m.sender,nickname:nick(m.sender,by.get(String(m.sender_agent_id)))}}))}
}
async function send(ctx:any,body:any){
  const id=String(body.conversation_id||"");if(!await isMember(id,String(ctx.agent.id)))throw Error("Conversation non autorisée.");
  const{data:conversation,error:conversationError}=await db.from("stip_conversations").select("kind").eq("id",id).maybeSingle();
  if(conversationError)throw conversationError;if(!conversation)throw Error("Conversation introuvable.");
  const text=String(body.body||"").trim().slice(0,2000);
  let payload=body.payload&&typeof body.payload==="object"?body.payload:{},uploadedPath="";
  try{
    const attachment=await storeDmImage(ctx,id,body.image);
    if(attachment){
      uploadedPath=attachment.storage_path;
      const previous=Array.isArray(payload.attachments)?payload.attachments:[];
      payload={...payload,attachments:[...previous,attachment].slice(-4)}
    }
    if(!text&&!uploadedPath)throw Error("Message vide.");
    const{data,error}=await db.from("stip_messages").insert({conversation_id:id,sender_agent_id:ctx.agent.id,body:text,payload}).select("id,created_at").single();if(error)throw error;
    await db.from("stip_conversations").update({last_message_at:data.created_at,updated_at:data.created_at}).eq("id",id);
    await db.from("stip_conversation_members").update({last_read_at:data.created_at}).eq("conversation_id",id).eq("agent_id",ctx.agent.id);
    try{
      if(["direct","group"].includes(String(conversation.kind||""))){
        const eventType=await notificationType("dm_received");
        if(eventType?.push_enabled){
          const {data:members}=await db.from("stip_conversation_members").select("agent_id").eq("conversation_id",id).neq("agent_id",ctx.agent.id);
          const senderProfile=await messageProfile(String(ctx.agent.id)),senderName=nick(ctx.agent,senderProfile),pushText=text||"Photo";
          await Promise.allSettled((members||[]).map(async(m:any)=>{
            const targetState=await notificationPreference(String(m.agent_id),"dm_received");
            if(!targetState.enabled||!targetState.push_enabled)return;
            const targetProfile=await messageProfile(String(m.agent_id)),preview=targetProfile.notification_preview!==false;
            await fetch(URL+"/functions/v1/stip-push",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+SERVICE},body:JSON.stringify({action:"send_internal",agent_id:m.agent_id,payload:{title:preview?senderName:"STIP",body:preview?pushText.slice(0,140):"Nouveau DM",url:"/?quick=notifications&conversation="+encodeURIComponent(id),tag:"stip-dm-"+id}})});
          }))
        }
      }
    }catch(e){console.error("push",e)}
    return{ok:true,...data}
  }catch(e){
    if(uploadedPath)await db.storage.from(TEAM_BUCKET).remove([uploadedPath]).catch(()=>{});
    throw e
  }
}
async function broadcastUpdate(ctx:any,body:any){
  const id=String(body.conversation_id||"");if(!await isMember(id,String(ctx.agent.id)))throw Error("Conversation non autorisée.");
  const {data:row,error}=await db.from("stip_operational_broadcasts").select("id,status,quantity").eq("conversation_id",id).maybeSingle();if(error)throw error;if(!row)throw Error("Diffusion introuvable.");
  const action=String(body.update||"confirm"),patch:any={updated_at:new Date().toISOString()};
  if(action==="resolved"){patch.status="resolved";patch.quantity=0}
  else if(action==="less"){patch.status="active";patch.quantity=Math.max(0,Number(body.quantity)||0)}
  else patch.status="active";
  const u=await db.from("stip_operational_broadcasts").update(patch).eq("id",row.id);if(u.error)throw u.error;
  return{ok:true}
}
function traineeKeyFromSource(v:any){const m=String(v||"").match(/^stagiaire:([^:]+)(?::\d{4}-\d{2}-\d{2})?$/i);return m?.[1]||""}
async function traineeDirectory(){
  const today=parisDayKey(),edge=new Date(today+"T12:00:00Z");edge.setUTCDate(edge.getUTCDate()+180);const to=edge.toISOString().slice(0,10);
  const{data,error}=await db.from("stagiaires").select("source_key,nom,prenom,date_debut,date_fin").gte("date_fin",today).lte("date_debut",to).order("date_debut");
  if(error)throw error;const groups=new Map<string,any>();
  for(const row of data||[]){const key=traineeKeyFromSource(row.source_key);if(!key)continue;const x=groups.get(key)||{trainee_key:key,id:`stagiaire:${key}`,source_key:`stagiaire:${key}`,nom:row.nom,prenom:row.prenom,ghe:"Stage",role:"Stagiaire",profile_photo_url:TRAINEE_DEFAULT_AVATAR,avatar_url:TRAINEE_DEFAULT_AVATAR,first_date:row.date_debut,last_date:row.date_fin||row.date_debut};if(String(row.date_debut)<String(x.first_date))x.first_date=row.date_debut;if(String(row.date_fin||row.date_debut)>String(x.last_date))x.last_date=row.date_fin||row.date_debut;groups.set(key,x)}
  return[...groups.values()].sort((a,b)=>String(a.prenom||"").localeCompare(String(b.prenom||""),"fr")||String(a.nom||"").localeCompare(String(b.nom||""),"fr"))
}
async function traineeInbox(ctx:any,markRead=false){
  if(!ctx?.is_trainee)throw Error("Accès Stagiaire requis.");
  const key=safeTraineeKey(ctx.trainee_key);const{data,error}=await db.from("stip_trainee_messages").select("id,target_key,sender_agent_id,body,created_at,read_at").eq("target_key",key).order("created_at",{ascending:false}).limit(100);if(error)throw error;
  const ids=[...new Set((data||[]).map((x:any)=>String(x.sender_agent_id)).filter(Boolean))];
  const{data:senders}=ids.length?await db.from("agents").select("id,prenom,nom,ghe,profile_photo_url,avatar_url").in("id",ids):{data:[] as any[]};
  const by=new Map((senders||[]).map((x:any)=>[String(x.id),x]));
  const items=(data||[]).map((x:any)=>({...x,sender:by.get(String(x.sender_agent_id))||null}));
  if(markRead){const unread=items.filter((x:any)=>!x.read_at).map((x:any)=>x.id);if(unread.length){const u=await db.from("stip_trainee_messages").update({read_at:new Date().toISOString()}).in("id",unread).eq("target_key",key);if(u.error)throw u.error}}
  return items
}
async function traineeSend(ctx:any,body:any){
  if(ctx?.is_trainee||!ctx?.agent?.id)throw Error("Envoi réservé aux professionnels STIP.");
  const key=safeTraineeKey(body.trainee_key),text=String(body.body||"").trim().slice(0,2000);if(!key||!text)throw Error("Destinataire ou message manquant.");
  if(!(await traineeDirectory()).some((x:any)=>x.trainee_key===key))throw Error("Stagiaire introuvable.");
  const{data,error}=await db.from("stip_trainee_messages").insert({target_key:key,sender_agent_id:ctx.agent.id,body:text}).select("id,created_at").single();if(error)throw error;return{ok:true,...data}
}
async function home(ctx:any){
  if(ctx?.is_trainee){const messages=await traineeInbox(ctx,false);return{me:ctx.agent,conversations:[],suggestions:[],trainee_messages:messages,unread:messages.filter((x:any)=>!x.read_at).length}}
  const{data:member,error}=await db.from("stip_conversation_members").select("conversation_id,last_read_at").eq("agent_id",ctx.agent.id);if(error)throw error;
  const ids=(member||[]).map((x:any)=>x.conversation_id),read=new Map((member||[]).map((x:any)=>[String(x.conversation_id),x.last_read_at]));
  let conversations:any[]=[];
  if(ids.length){
    const{data:convs,error:ce}=await db.from("stip_conversations").select("id,kind,title,last_message_at,created_by_agent_id").in("id",ids).order("last_message_at",{ascending:false}).limit(30);if(ce)throw ce;
    for(const c of convs||[]){
      const{data:members}=await db.from("stip_conversation_members").select("agent_id,agents(id,prenom,nom,ghe,profile_photo_url,avatar_url)").eq("conversation_id",c.id);
      const others=(members||[]).filter((m:any)=>String(m.agent_id)!==String(ctx.agent.id));
      const otherIds=others.map((m:any)=>m.agent_id);
      const{data:profs}=otherIds.length?await db.from("stip_message_profiles").select("agent_id,nickname").in("agent_id",otherIds):{data:[] as any[]};
      const pb=new Map((profs||[]).map((p:any)=>[String(p.agent_id),p]));
      const{data:last}=await db.from("stip_messages").select("id,body,payload,created_at,sender_agent_id").eq("conversation_id",c.id).is("deleted_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
      const lastRead=read.get(String(c.id));
      const{count}=await db.from("stip_messages").select("id",{count:"exact",head:true}).eq("conversation_id",c.id).is("deleted_at",null).neq("sender_agent_id",ctx.agent.id).gt("created_at",lastRead||"1970-01-01T00:00:00Z");
      conversations.push({...c,others:others.map((m:any)=>({...m.agents,nickname:nick(m.agents,pb.get(String(m.agent_id)))})),last_message:last||null,unread:count||0})
    }
  }
  const suggestions=(await agents(ctx,"")).slice(0,18);
  const profile=await messageProfile(String(ctx.agent.id));
  const dmPush=await notificationPreference(String(ctx.agent.id),"dm_received");
  const dmUnread=conversations.filter((c:any)=>c.kind==="direct"||c.kind==="group").reduce((n:number,c:any)=>n+Number(c.unread||0),0);
  return{me:{...ctx.agent,nickname:nick(ctx.agent,profile),notification_preview:profile.notification_preview!==false,dm_push_enabled:!!dmPush.enabled,dm_push_available:!!dmPush.push_enabled},conversations,suggestions,unread:conversations.reduce((n,c)=>n+Number(c.unread||0),0),dm_unread:dmUnread}
}
async function profileSet(ctx:any,body:any){
  const nickname=String(body.nickname||"").trim().slice(0,32)||null;
  const preview=body.notification_preview!==false;
  const{error}=await db.from("stip_message_profiles").upsert({agent_id:ctx.agent.id,nickname,notification_preview:preview,updated_at:new Date().toISOString()},{onConflict:"agent_id"});if(error)throw error;
  return{ok:true,nickname:nickname||ctx.agent.prenom||ctx.agent.nom,notification_preview:preview}
}

function isAdmin(ctx:any){
  return !!(
    ctx?.profile?.permissions?.admin ||
    String(ctx?.profile?.role_key||"").toLowerCase()==="admin" ||
    (Array.isArray(ctx?.profile?.preset_roles)&&ctx.profile.preset_roles.some((x:any)=>String(x).toLowerCase()==="admin"))
  )
}
function teamAccessMode(ctx:any){
  const raw=String(ctx?.profile?.permissions?.team_chat_mode||"").toLowerCase();
  if(isAdmin(ctx)||raw==="admin")return "admin";
  if(raw==="read")return "read";
  return "write"
}
function requireTeamWrite(ctx:any){
  const mode=teamAccessMode(ctx);
  if(mode==="read")throw Error("Le Tableau STIP est en lecture seule pour cet accès.");
  return mode
}
function parisDayKey(value:Date|string|number=new Date()){
  const d=value instanceof Date?value:new Date(value);
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(d),get=(type:string)=>parts.find(x=>x.type===type)?.value||"";
  return get("year")+"-"+get("month")+"-"+get("day")
}
function tableauDayKey(){return TABLEAU_PREFIX+parisDayKey()}
async function teamConversation(ctx:any){
  const key=tableauDayKey();
  let{data:conv,error}=await db.from("stip_conversations")
    .select("id,kind,title,direct_key,created_by_agent_id,created_at,last_message_at")
    .eq("direct_key",key).maybeSingle();
  if(error)throw error;

  if(!conv){
    const legacy=await db.from("stip_conversations")
      .select("id,kind,title,direct_key,created_by_agent_id,created_at,last_message_at")
      .eq("direct_key",LEGACY_TEAM_KEY).maybeSingle();
    if(legacy.error)throw legacy.error;
    if(legacy.data){
      const moved=await db.from("stip_conversations")
        .update({direct_key:key,title:"Tableau STIP",updated_at:new Date().toISOString()})
        .eq("id",legacy.data.id)
        .select("id,kind,title,direct_key,created_by_agent_id,created_at,last_message_at")
        .single();
      if(moved.error)throw moved.error;
      conv=moved.data
    }
  }

  if(!conv){
    const created=await db.from("stip_conversations").insert({
      kind:"team_chat",
      direct_key:key,
      title:"Tableau STIP",
      created_by_agent_id:ctx.is_trainee?null:ctx.agent.id,
      created_by_stagiaire_key:ctx.is_trainee?ctx.trainee_key:null
    }).select("id,kind,title,direct_key,created_by_agent_id,created_at,last_message_at").single();
    if(created.error){
      const again=await db.from("stip_conversations")
        .select("id,kind,title,direct_key,created_by_agent_id,created_at,last_message_at")
        .eq("direct_key",key).maybeSingle();
      if(again.error||!again.data)throw created.error;
      conv=again.data
    }else conv=created.data
  }else if(String(conv.title||"")!=="Tableau STIP"){
    const updated=await db.from("stip_conversations")
      .update({title:"Tableau STIP",updated_at:new Date().toISOString()})
      .eq("id",conv.id)
      .select("id,kind,title,direct_key,created_by_agent_id,created_at,last_message_at")
      .single();
    if(updated.error)throw updated.error;
    conv=updated.data
  }
  return conv
}

async function removeTeamPhotos(paths:string[]){
  const clean=[...new Set(paths.map(x=>String(x||"").trim()).filter(Boolean))];
  if(!clean.length)return;
  const r=await db.storage.from(TEAM_BUCKET).remove(clean);
  if(r.error)throw r.error
}
async function listTableauRows(conversationId:string){
  const rows:any[]=[];
  for(let from=0;;from+=1000){
    const{data,error}=await db.from("stip_messages")
      .select("id,payload,created_at")
      .eq("conversation_id",conversationId)
      .order("created_at")
      .range(from,from+999);
    if(error)throw error;
    const batch=data||[];
    rows.push(...batch);
    if(batch.length<1000)break
  }
  return rows
}
async function removeTableauStorageTree(conversationId:string){
  const root=await db.storage.from(TEAM_BUCKET).list(conversationId,{limit:1000,offset:0});
  if(root.error)throw root.error;
  const paths:string[]=[];
  for(const folder of root.data||[]){
    const name=String((folder as any)?.name||"").trim();
    if(!name)continue;
    if((folder as any)?.id){
      paths.push(conversationId+"/"+name);
      continue
    }
    const listed=await db.storage.from(TEAM_BUCKET).list(conversationId+"/"+name,{limit:1000,offset:0});
    if(listed.error)throw listed.error;
    for(const file of listed.data||[]){
      if((file as any)?.id&&(file as any)?.name)paths.push(conversationId+"/"+name+"/"+String((file as any).name))
    }
  }
  if(paths.length)await removeTeamPhotos(paths)
}
async function purgeCurrentTableauRows(conversationId:string){
  const today=parisDayKey(),rows=await listTableauRows(conversationId),
    stale=rows.filter((row:any)=>parisDayKey(row.created_at)!==today);
  if(!stale.length)return 0;
  await removeTeamPhotos(stale.map((m:any)=>m?.payload?.photo_path).filter(Boolean));
  const ids=stale.map((m:any)=>m.id);
  for(let i=0;i<ids.length;i+=200){
    const del=await db.from("stip_messages").delete().in("id",ids.slice(i,i+200));
    if(del.error)throw del.error
  }
  return ids.length
}
async function purgePastStorageFolders(conversationId:string){
  const today=parisDayKey(),root=await db.storage.from(TEAM_BUCKET).list(conversationId,{limit:1000,offset:0});
  if(root.error)throw root.error;
  const paths:string[]=[];
  for(const folder of root.data||[]){
    const name=String((folder as any)?.name||"").trim();
    if(!name||name===today)continue;
    if((folder as any)?.id){paths.push(conversationId+"/"+name);continue}
    const listed=await db.storage.from(TEAM_BUCKET).list(conversationId+"/"+name,{limit:1000,offset:0});
    if(listed.error)throw listed.error;
    for(const file of listed.data||[]){
      if((file as any)?.id&&(file as any)?.name)paths.push(conversationId+"/"+name+"/"+String((file as any).name))
    }
  }
  if(paths.length)await removeTeamPhotos(paths)
}
async function purgePreviousTableauDays(currentConversationId:string){
  const{data:conversations,error}=await db.from("stip_conversations")
    .select("id,direct_key")
    .eq("kind","team_chat");
  if(error)throw error;
  const old=(conversations||[]).filter((x:any)=>String(x.id)!==String(currentConversationId));
  let deleted=0;
  for(const conversation of old){
    const rows=await listTableauRows(String(conversation.id));
    if(rows.length){
      await removeTeamPhotos(rows.map((m:any)=>m?.payload?.photo_path).filter(Boolean));
      const ids=rows.map((m:any)=>m.id);
      for(let i=0;i<ids.length;i+=200){
        const del=await db.from("stip_messages").delete().in("id",ids.slice(i,i+200));
        if(del.error)throw del.error
      }
      deleted+=ids.length
    }
    await removeTableauStorageTree(String(conversation.id));
    const gone=await db.from("stip_conversations").delete().eq("id",conversation.id);
    if(gone.error)throw gone.error
  }
  return deleted
}

async function signedTeamPhotos(messages:any[]){
  const paths=[...new Set(messages.map((m:any)=>String(m?.payload?.photo_path||"")).filter(Boolean))];
  if(!paths.length)return messages;
  const{data,error}=await db.storage.from(TEAM_BUCKET).createSignedUrls(paths,3600);
  if(error||!data)return messages;
  const urls=new Map<string,string>();
  paths.forEach((path,i)=>{const u=(data as any[])?.[i]?.signedUrl;if(u)urls.set(path,u)});
  return messages.map((m:any)=>{
    const path=String(m?.payload?.photo_path||"");
    return path&&urls.has(path)?{...m,payload:{...(m.payload||{}),photo_url:urls.get(path)}}:m
  })
}
async function teamThread(ctx:any){
  const conv=await teamConversation(ctx);
  await purgeCurrentTableauRows(String(conv.id));
  await purgePastStorageFolders(String(conv.id));
  await purgePreviousTableauDays(String(conv.id));
  const{data:messages,error}=await db.from("stip_messages")
    .select("id,body,payload,created_at,sender_agent_id,sender_stagiaire_key,sender:agents!stip_messages_sender_agent_id_fkey(id,source_key,prenom,nom,ghe,profile_photo_url,avatar_url)")
    .eq("conversation_id",conv.id)
    .order("created_at")
    .limit(300);
  if(error)throw error;
  const senderIds=[...new Set((messages||[]).map((m:any)=>String(m.sender_agent_id)).filter(Boolean))];
  const{data:profiles}=senderIds.length
    ?await db.from("stip_message_profiles").select("agent_id,nickname").in("agent_id",senderIds)
    :{data:[] as any[]};
  const by=new Map((profiles||[]).map((p:any)=>[String(p.agent_id),p]));
  const withNames=(messages||[]).map((m:any)=>{
    if(m.sender_agent_id)return{...m,sender:{...m.sender,nickname:nick(m.sender,by.get(String(m.sender_agent_id)))}};
    const actor=m?.payload?.actor||{},key=String(m.sender_stagiaire_key||actor.key||"");
    const sender={id:`stagiaire:${key}`,source_key:`stagiaire:${key}`,prenom:actor.prenom||"Stagiaire",nom:actor.nom||"",ghe:null,equipe:"stage",profile_photo_url:TRAINEE_DEFAULT_AVATAR,avatar_url:TRAINEE_DEFAULT_AVATAR,nickname:actor.prenom||"Stagiaire",identity_kind:"stagiaire"};
    return{...m,sender_agent_id:sender.id,sender}
  });
  const signed=await signedTeamPhotos(withNames);
  const meProfile=ctx.is_trainee?null:await messageProfile(String(ctx.agent.id));
  const accessMode=teamAccessMode(ctx);
  return{
    conversation:conv,
    day:parisDayKey(),
    me:{...ctx.agent,nickname:ctx.is_trainee?display(ctx.agent):nick(ctx.agent,meProfile)},
    access_mode:accessMode,
    can_write:accessMode!=="read",
    admin:accessMode==="admin",
    messages:signed
  }
}

async function storeTeamPhoto(conv:any,body:any){
  const mime=String(body?.mime||"").toLowerCase(),raw=String(body?.data||"");
  if(!["image/jpeg","image/png","image/webp"].includes(mime))throw Error("Format d’image non pris en charge.");
  if(!raw||raw.length>4000000)throw Error("Photo trop lourde.");
  let bytes:Uint8Array;
  try{
    const bin=atob(raw);bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i)
  }catch{throw Error("Photo invalide.")}
  if(bytes.byteLength>3000000)throw Error("Photo trop lourde.");
  const ext=mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg",
    day=parisDayKey(),
    path=String(conv.id)+"/"+day+"/"+crypto.randomUUID()+"."+ext;
  const up=await db.storage.from(TEAM_BUCKET).upload(path,bytes,{contentType:mime,upsert:false,cacheControl:"3600"});
  if(up.error)throw up.error;
  return path
}
async function teamPhotoUpload(ctx:any,body:any){
  requireTeamWrite(ctx);
  const conv=await teamConversation(ctx);
  await purgeCurrentTableauRows(String(conv.id));
  await purgePastStorageFolders(String(conv.id));
  await purgePreviousTableauDays(String(conv.id));
  const path=await storeTeamPhoto(conv,body);
  return{ok:true,path}
}
function inferWheelchairQuantity(text:string,raw:any=null){
  const explicitRaw=Number(raw);
  if(Number.isFinite(explicitRaw)&&explicitRaw>0)return Math.min(20,Math.max(1,Math.round(explicitRaw)));
  const source=String(text||"").trim();
  const explicit=source.match(/(?:^|[·,:;\s])(\d{1,2})\s*(?:fauteuils?|fauteuil|f\b)/i);
  if(explicit)return Math.min(20,Math.max(1,Number(explicit[1])||1));
  const parts=source.split("·").map(x=>x.trim()).filter(Boolean),tail=parts.at(-1)||"";
  const shorthand=tail.match(/^(\d{1,2})\s+(?:au\b|à\b|a\b)/i);
  return shorthand?Math.min(20,Math.max(1,Number(shorthand[1])||1)):1
}

async function teamSend(ctx:any,body:any){
  requireTeamWrite(ctx);
  const conv=await teamConversation(ctx);
  await purgeCurrentTableauRows(String(conv.id));
  await purgePastStorageFolders(String(conv.id));
  await purgePreviousTableauDays(String(conv.id));
  const text=String(body.body||"").trim().replace(/\s*·\s*$/,"").trim().slice(0,2000),
    legacyPhotoPath=String(body.photo_path||"").trim(),
    inlinePhoto=body.photo&&typeof body.photo==="object"?body.photo:null,
    replyTo=String(body.reply_to_id||"").trim(),
    wheelchair=body.wheelchair&&typeof body.wheelchair==="object"?body.wheelchair:null;
  if(!text&&!legacyPhotoPath&&!inlinePhoto)throw Error("Message vide.");
  if(legacyPhotoPath&&!legacyPhotoPath.startsWith(String(conv.id)+"/"))throw Error("Photo invalide.");

  if(replyTo){
    const parent=await db.from("stip_messages").select("id").eq("id",replyTo).eq("conversation_id",conv.id).maybeSingle();
    if(parent.error)throw parent.error;
    if(!parent.data)throw Error("Le message auquel vous répondez n’est plus disponible.")
  }

  let photoPath=legacyPhotoPath,createdPhoto="";
  if(inlinePhoto){
    photoPath=await storeTeamPhoto(conv,inlinePhoto);
    createdPhoto=photoPath
  }
  const payload:any={};
  if(ctx.is_trainee)payload.actor={kind:"stagiaire",key:ctx.trainee_key,prenom:ctx.agent.prenom||"",nom:ctx.agent.nom||""};
  if(photoPath)payload.photo_path=photoPath;
  if(replyTo)payload.reply_to_id=replyTo;
  if(wheelchair){
    const type=wheelchair.type==="search"?"search":"spot",
      quantity=type==="spot"?inferWheelchairQuantity(text,wheelchair.quantity):1,
      building=String(wheelchair.building||"").trim().slice(0,32),
      level=String(wheelchair.level||"").trim().slice(0,24),
      location=String(wheelchair.location||"").trim().slice(0,120),
      rawPersistence=String(wheelchair.persistence||"").trim().toLowerCase(),
      persistence=["fast","normal","sheltered"].includes(rawPersistence)?rawPersistence:"normal";
    if(type==="spot"&&wheelchairSpotLocationTooVague(location)){
      throw Error("Précise l’endroit pour que le fauteuil puisse être retrouvé.")
    }
    payload.wheelchair={
      type,
      status:"active",
      ...(building?{building}:{}),
      ...(level?{level}:{}),
      ...(location?{location}:{}),
      ...(type==="spot"?{quantity_total:quantity,quantity_remaining:quantity,takes:[],persistence}:{})
    }
  }
  const{data,error}=await db.from("stip_messages").insert({
    conversation_id:conv.id,
    sender_agent_id:ctx.is_trainee?null:ctx.agent.id,
    sender_stagiaire_key:ctx.is_trainee?ctx.trainee_key:null,
    body:text,
    payload
  }).select("id,created_at").single();
  if(error){
    if(createdPhoto){
      try{await removeTeamPhotos([createdPhoto])}catch(cleanupError){console.error("team photo rollback",cleanupError)}
    }
    throw error
  }
  await db.from("stip_conversations").update({last_message_at:data.created_at,updated_at:data.created_at}).eq("id",conv.id);
  return{ok:true,...data}
}

async function teamResolve(ctx:any,body:any){
  requireTeamWrite(ctx);
  const conv=await teamConversation(ctx);
  await purgeCurrentTableauRows(String(conv.id));
  await purgePastStorageFolders(String(conv.id));
  await purgePreviousTableauDays(String(conv.id));
  const messageId=String(body.message_id||"").trim();
  if(!messageId)throw Error("Signalement invalide.");
  const{data:row,error}=await db.from("stip_messages")
    .select("id,payload")
    .eq("id",messageId)
    .eq("conversation_id",conv.id)
    .maybeSingle();
  if(error)throw error;
  if(!row)throw Error("Ce signalement n’est plus disponible.");
  const wheelchair=row?.payload?.wheelchair;
  if(!wheelchair)throw Error("Ce message n’est pas un signalement de fauteuil.");
  if(wheelchair.status==="resolved")return{ok:true,already_resolved:true};
  const resolvedAt=new Date().toISOString(),
    resolvedBy=await actorDisplayName(ctx),
    resolvedById=actorKey(ctx),
    payload={
      ...(row.payload||{}),
      wheelchair:{
        ...wheelchair,
        status:"resolved",
        resolved_at:resolvedAt,
        resolved_by_agent_id:resolvedById,
        resolved_by_name:resolvedBy
      }
    };
  const update=await db.from("stip_messages").update({payload}).eq("id",messageId).eq("conversation_id",conv.id);
  if(update.error)throw update.error;
  return{ok:true,resolved_at:resolvedAt,resolved_by_name:resolvedBy}
}

async function teamTake(ctx:any,body:any){
  requireTeamWrite(ctx);
  const conv=await teamConversation(ctx);
  await purgeCurrentTableauRows(String(conv.id));
  await purgePastStorageFolders(String(conv.id));
  await purgePreviousTableauDays(String(conv.id));

  const messageId=String(body.message_id||"").trim();
  if(!messageId)throw Error("Signalement invalide.");

  const{data:row,error}=await db.from("stip_messages")
    .select("id,body,payload")
    .eq("id",messageId)
    .eq("conversation_id",conv.id)
    .maybeSingle();
  if(error)throw error;
  if(!row)throw Error("Ce signalement n’est plus disponible.");

  const wheelchair=row?.payload?.wheelchair;
  if(!wheelchair||wheelchair.type==="search")throw Error("Ce message n’est pas un fauteuil disponible.");
  if(wheelchair.status==="resolved")return{ok:true,already_resolved:true,remaining:0};

  const total=inferWheelchairQuantity(String(row.body||""),wheelchair.quantity_total),
    currentRaw=Number(wheelchair.quantity_remaining),
    remaining=Number.isFinite(currentRaw)?Math.min(total,Math.max(0,currentRaw)):total,
    requested=Math.max(1,Math.round(Number(body.quantity)||1)),
    taken=Math.min(remaining,requested);

  if(remaining<1)return{ok:true,already_resolved:true,remaining:0};

  const takenAt=new Date().toISOString(),
    takenBy=await actorDisplayName(ctx),
    takenById=actorKey(ctx),
    nextRemaining=Math.max(0,remaining-taken),
    takes=Array.isArray(wheelchair.takes)?wheelchair.takes.slice(-19):[],
    nextWheelchair={
      ...wheelchair,
      type:"spot",
      quantity_total:total,
      quantity_remaining:nextRemaining,
      takes:[...takes,{
        quantity:taken,
        taken_at:takenAt,
        taken_by_agent_id:takenById,
        taken_by_name:takenBy
      }],
      last_taken_at:takenAt,
      last_taken_by_agent_id:takenById,
      last_taken_by_name:takenBy,
      ...(nextRemaining===0?{
        status:"resolved",
        resolved_at:takenAt,
        resolved_by_agent_id:takenById,
        resolved_by_name:takenBy
      }:{status:"active"})
    },
    payload={...(row.payload||{}),wheelchair:nextWheelchair};

  const update=await db.from("stip_messages")
    .update({payload})
    .eq("id",messageId)
    .eq("conversation_id",conv.id);
  if(update.error)throw update.error;

  await db.from("stip_conversations")
    .update({updated_at:takenAt})
    .eq("id",conv.id);

  return{ok:true,taken,remaining:nextRemaining,total,taken_by_name:takenBy,taken_at:takenAt}
}


async function teamStillThere(ctx:any,body:any){
  requireTeamWrite(ctx);
  const conv=await teamConversation(ctx);
  await purgeCurrentTableauRows(String(conv.id));
  await purgePastStorageFolders(String(conv.id));
  await purgePreviousTableauDays(String(conv.id));

  const messageId=String(body.message_id||"").trim();
  if(!messageId)throw Error("Signalement invalide.");

  const{data:row,error}=await db.from("stip_messages")
    .select("id,payload")
    .eq("id",messageId)
    .eq("conversation_id",conv.id)
    .maybeSingle();
  if(error)throw error;
  if(!row)throw Error("Ce signalement n’est plus disponible.");

  const wheelchair=row?.payload?.wheelchair;
  if(!wheelchair||wheelchair.type==="search")throw Error("Ce message n’est pas un fauteuil disponible.");
  if(wheelchair.status==="resolved")return{ok:true,already_resolved:true};

  const seenAt=new Date().toISOString(),
    seenBy=await actorDisplayName(ctx),
    seenById=actorKey(ctx),
    sightings=Array.isArray(wheelchair.sightings)?wheelchair.sightings.slice(-29):[],
    nextWheelchair={
      ...wheelchair,
      sightings:[...sightings,{
        seen_at:seenAt,
        seen_by_agent_id:seenById,
        seen_by_name:seenBy
      }],
      last_seen_at:seenAt,
      last_seen_by_agent_id:seenById,
      last_seen_by_name:seenBy
    },
    payload={...(row.payload||{}),wheelchair:nextWheelchair};

  const update=await db.from("stip_messages")
    .update({payload})
    .eq("id",messageId)
    .eq("conversation_id",conv.id);
  if(update.error)throw update.error;

  await db.from("stip_conversations")
    .update({updated_at:seenAt})
    .eq("id",conv.id);

  return{ok:true,seen_at:seenAt,seen_by_name:seenBy}
}


function cleanReactionEmoji(value:any){
  const emoji=String(value||"").trim();
  if(!emoji||emoji.length>16)throw Error("Réaction invalide.");
  if(/[\r\n<>]/.test(emoji))throw Error("Réaction invalide.");
  return emoji
}

async function teamReact(ctx:any,body:any){
  requireTeamWrite(ctx);
  const conv=await teamConversation(ctx);
  await purgeCurrentTableauRows(String(conv.id));
  await purgePastStorageFolders(String(conv.id));
  await purgePreviousTableauDays(String(conv.id));

  const messageId=String(body.message_id||"").trim(),
    emoji=cleanReactionEmoji(body.emoji);
  if(!messageId)throw Error("Message invalide.");

  const{data:row,error}=await db.from("stip_messages")
    .select("id,payload")
    .eq("id",messageId)
    .eq("conversation_id",conv.id)
    .maybeSingle();
  if(error)throw error;
  if(!row)throw Error("Ce message n’est plus disponible.");

  const agentId=actorKey(ctx),
    reactedAt=new Date().toISOString(),
    reactedBy=await actorDisplayName(ctx),
    existing=Array.isArray(row?.payload?.reactions)?row.payload.reactions:[],
    mine=existing.find((reaction:any)=>String(reaction?.agent_id||"")===agentId),
    others=existing.filter((reaction:any)=>String(reaction?.agent_id||"")!==agentId),
    next=mine&&String(mine.emoji||"")===emoji
      ? others
      : [...others,{
          agent_id:agentId,
          agent_name:reactedBy,
          emoji,
          reacted_at:reactedAt
        }],
    payload={...(row.payload||{}),reactions:next.slice(-100)};

  const update=await db.from("stip_messages")
    .update({payload})
    .eq("id",messageId)
    .eq("conversation_id",conv.id);
  if(update.error)throw update.error;

  await db.from("stip_conversations")
    .update({updated_at:reactedAt})
    .eq("id",conv.id);

  return{ok:true,reactions:next}
}

async function teamDelete(ctx:any,body:any){
  const mode=requireTeamWrite(ctx),admin=mode==="admin";
  const conv=await teamConversation(ctx);
  await purgeCurrentTableauRows(String(conv.id));
  await purgePastStorageFolders(String(conv.id));
  await purgePreviousTableauDays(String(conv.id));
  const ids=[...new Set((Array.isArray(body.message_ids)?body.message_ids:[]).map(String).filter(Boolean))].slice(0,300);
  if(!ids.length)throw Error("Aucun message sélectionné.");
  const{data:rows,error}=await db.from("stip_messages")
    .select("id,payload,sender_agent_id,sender_stagiaire_key")
    .eq("conversation_id",conv.id)
    .in("id",ids);
  if(error)throw error;
  if(!rows?.length)return{ok:true,deleted:0};
  if(!admin&&rows.some((m:any)=>senderOwnerKey(m)!==actorKey(ctx)))
    throw Error("Suppression non autorisée.");
  await removeTeamPhotos(rows.map((m:any)=>m?.payload?.photo_path).filter(Boolean));
  const realIds=rows.map((m:any)=>m.id),
    del=await db.from("stip_messages").delete().in("id",realIds);
  if(del.error)throw del.error;
  const{data:last}=await db.from("stip_messages").select("created_at").eq("conversation_id",conv.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  const stamp=last?.created_at||new Date().toISOString();
  await db.from("stip_conversations").update({last_message_at:stamp,updated_at:new Date().toISOString()}).eq("id",conv.id);
  return{ok:true,deleted:realIds.length}
}


const WHEELCHAIR_BUILDINGS=[
  {key:"neuro",label:"Neuro",codes:["PW"],aliases:["neuro","pierre wertheimer","wertheimer","pw"]},
  {key:"cardio",label:"Cardio",codes:["HLP"],aliases:["cardio","louis pradel","pradel","hlp"]},
  {key:"hfme",label:"HFME",codes:["HFME"],aliases:["hfme","femme mere enfant","femme mère enfant","mere enfant","mère enfant"]},
  {key:"a4",label:"POP (A4)",codes:["A4"],aliases:["pop","a4","pop a4","batiment pop","bâtiment pop","batiment a4","bâtiment a4"]},
  {key:"b14",label:"Médecine nucléaire",codes:["B14"],aliases:["medecine nucleaire","médecine nucléaire","b14","tep","tep ct","tep-ct","imagerie nucleaire","imagerie nucléaire"]}
];
const WHEELCHAIR_PICKER_TYPES=new Set([
  "service","unit","exam","block","helipad","entrance","elevator","elevator_group",
  "hall","reception","staff_area","staff_room","landmark","operational_landmark",
  "operational_point","walkway","room","stairs"
]);
function wheelchairLevelRank(value:any){
  const s=String(value||"").trim().toUpperCase();
  if(s==="-2")return-20;if(s==="-1")return-10;
  if(s==="RDJ"||s==="RJ")return-5;
  if(s==="RDC"||s==="RC"||s==="0")return 0;
  if(s==="TM")return .5;
  const n=Number(s.replace(/[^0-9.-]/g,""));
  return Number.isFinite(n)?n:999
}
function wheelchairNorm(value:any){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()
}
function wheelchairSpotLocationTooVague(value:any){
  const parts=String(value||"").split("|").map(wheelchairNorm).filter(Boolean);
  if(!parts.length)return true;
  const generic=new Set(["ascenseur","ascenseurs","couloir","escalier","escaliers","hall","accueil","entree"]);
  return parts.every((part:string)=>generic.has(part)||/^tout le\b/.test(part)||/^tout l etage\b/.test(part))
}
async function wheelchairCatalog(){
  const{data,error}=await db.from("stip_places")
    .select("id,display_name,official_name,place_type,building_code,level,parent_id,summary,sort_order,visibility,evidence_status")
    .in("visibility",["public","internal_stip"])
    .order("sort_order")
    .order("display_name");
  if(error)throw error;
  const rows=data||[];
  const rowIds=rows.map((p:any)=>p.id);
  let aliasRows:any[]=[];
  if(rowIds.length){
    const aliasesQ=await db.from("stip_place_aliases").select("place_id,alias").in("place_id",rowIds);
    if(aliasesQ.error)throw aliasesQ.error;
    aliasRows=aliasesQ.data||[]
  }
  const aliasesBy=new Map<string,string[]>();
  for(const a of aliasRows){
    const id=String(a.place_id||""),list=aliasesBy.get(id)||[];
    if(a.alias)list.push(String(a.alias));
    aliasesBy.set(id,list)
  }

  const topByCode=new Map<string,any>();
  for(const p of rows){
    const code=String(p.building_code||"").toUpperCase();
    if(!code)continue;
    if(["hospital","building","building_or_zone"].includes(String(p.place_type||""))&&String(p.parent_id||"")==="ghe"&&!topByCode.has(code))topByCode.set(code,p)
  }

  const curatedByCode=new Map<string,any>();
  for(const spec of WHEELCHAIR_BUILDINGS)for(const code of spec.codes)curatedByCode.set(String(code).toUpperCase(),spec);

  const codeSet=[...new Set(rows.map((p:any)=>String(p.building_code||"").toUpperCase()).filter(Boolean))];
  const allBuildings=codeSet.map(code=>{
    const curated=curatedByCode.get(code),top=topByCode.get(code);
    return{
      key:curated?.key||wheelchairNorm(code).replace(/\s+/g,"-")||"ghe",
      label:curated?.label||String(top?.display_name||top?.official_name||code),
      codes:[code],
      aliases:[...new Set([
        ...(curated?.aliases||[]),
        code,
        top?.display_name||"",
        top?.official_name||""
      ].map((x:any)=>String(x||"").trim()).filter(Boolean))]
    }
  });
  if(rows.some((p:any)=>!String(p.building_code||"").trim()))allBuildings.push({key:"ghe",label:"GHE",codes:[],aliases:["ghe","groupement hospitalier est"]});

  const buildingByCode=new Map<string,any>();
  for(const b of allBuildings)for(const code of b.codes||[])buildingByCode.set(String(code).toUpperCase(),b);

  const buildings=WHEELCHAIR_BUILDINGS.map(spec=>{
    const scoped=rows.filter((p:any)=>spec.codes.includes(String(p.building_code||"").toUpperCase()));
    const levels=[...new Set(scoped.map((p:any)=>String(p.level||"").trim()).filter(Boolean))]
      .sort((a,b)=>wheelchairLevelRank(a)-wheelchairLevelRank(b)||a.localeCompare(b,"fr"));
    return{
      key:spec.key,
      label:spec.label,
      aliases:spec.aliases,
      codes:spec.codes,
      levels:levels.map(level=>{
        const seen=new Set<string>(),places:any[]=[];
        for(const p of scoped
          .filter((x:any)=>String(x.level||"").trim()===level&&WHEELCHAIR_PICKER_TYPES.has(String(x.place_type||"")))
          .sort((a:any,b:any)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.display_name||"").localeCompare(String(b.display_name||""),"fr"))){
          const label=String(p.display_name||p.official_name||"").trim();
          const key=wheelchairNorm(label);
          if(!label||!key||seen.has(key))continue;
          seen.add(key);
          places.push({id:p.id,label,type:p.place_type,summary:p.summary||"",evidence_status:p.evidence_status||"",aliases:aliasesBy.get(String(p.id))||[]})
        }
        return{level,places}
      })
    }
  });

  const targets:any[]=[];
  const seenTargets=new Set<string>();
  for(const p of rows){
    if(String(p.place_type||"")==="campus")continue;
    const code=String(p.building_code||"").toUpperCase();
    const building=buildingByCode.get(code)||allBuildings.find((b:any)=>b.key==="ghe")||{key:"ghe",label:"GHE",aliases:["ghe"]};
    const label=String(p.display_name||p.official_name||"").trim();
    if(!label)continue;
    const key=wheelchairNorm([building.key,p.level,label].join("|"));
    if(!key||seenTargets.has(key))continue;
    seenTargets.add(key);
    targets.push({
      id:p.id,
      building_key:building.key,
      building_label:building.label,
      building_aliases:building.aliases||[],
      level:String(p.level||"").trim(),
      location:String(p.place_type||"")==="level"?"":label,
      label:String(p.place_type||"")==="level"?[building.label,label].filter(Boolean).join(" · "):label,
      type:p.place_type,
      summary:p.summary||"",
      aliases:aliasesBy.get(String(p.id))||[],
      evidence_status:p.evidence_status||""
    })
  }
  return{source:"stip_places",generated_at:new Date().toISOString(),buildings,all_buildings:allBuildings,targets}
}


Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  if(req.method!=="POST")return J({error:"Méthode non autorisée."},405);
  try{
    const c=await ctx(req),b=await req.json().catch(()=>({})),a=String(b.action||"home");
    if(a==="home")return J(await home(c));
    if(a==="dm_status"){if(c.is_trainee)return J({unread:0});return J(await dmStatus(c))}
    if(a==="notification_preferences"){if(c.is_trainee)return J({items:[]});return J(await notificationPreferences(c))}
    if(a==="notification_set"){if(c.is_trainee)throw Error("Accès non autorisé.");return J(await notificationSet(c,b))}
    if(a==="trainees"){if(c.is_trainee)throw Error("Accès non autorisé.");return J({items:await traineeDirectory()})}
    if(a==="trainee_send")return J(await traineeSend(c,b));
    if(a==="trainee_read"){if(!c.is_trainee)throw Error("Accès Stagiaire requis.");return J({ok:true,items:await traineeInbox(c,true)})}
    if(a==="wheelchair_catalog")return J(await wheelchairCatalog());
    if(a==="agents"){if(c.is_trainee)throw Error("Accès non autorisé.");return J({items:await agents(c,String(b.q||""))})}
    if(a==="on_duty"){if(c.is_trainee)throw Error("Accès non autorisé.");return J({items:await onDuty(c)})}
    if(a==="direct"){if(c.is_trainee)throw Error("Accès non autorisé.");return J({conversation:await direct(c,String(b.agent_id||""))})}
    if(a==="group"){if(c.is_trainee)throw Error("Accès non autorisé.");return J({conversation:await group(c,b)})}
    if(a==="thread"){if(c.is_trainee)throw Error("Accès non autorisé.");return J(await thread(c,String(b.conversation_id||"")))}
    if(a==="send"){if(c.is_trainee)throw Error("Accès non autorisé.");return J(await send(c,b))}
    if(a==="broadcast_update"){if(c.is_trainee)throw Error("Accès non autorisé.");return J(await broadcastUpdate(c,b))}
    if(a==="profile_set"){if(c.is_trainee)throw Error("Accès non autorisé.");return J(await profileSet(c,b))}
    if(a==="team_thread")return J(await teamThread(c));
    if(a==="team_photo_upload")return J(await teamPhotoUpload(c,b));
    if(a==="team_send")return J(await teamSend(c,b));
    if(a==="team_resolve")return J(await teamResolve(c,b));
    if(a==="team_take")return J(await teamTake(c,b));
    if(a==="team_still_there")return J(await teamStillThere(c,b));
    if(a==="team_react")return J(await teamReact(c,b));
    if(a==="team_delete")return J(await teamDelete(c,b));
    return J({error:"Action inconnue."},400)
  }catch(e){console.error(e);const m=errMsg(e);return J({error:m},/Session|autorisé|accès/i.test(m)?403:400)}
});