import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL=Deno.env.get("SUPABASE_URL")!,SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(URL,SERVICE,{auth:{persistSession:false}});
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-stip-session","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const J=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
const enc=new TextEncoder();
const hex=(a:ArrayBuffer)=>[...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,"0")).join("");
async function sha(s:string){return hex(await crypto.subtle.digest("SHA-256",enc.encode(s)))}
function nick(a:any,p:any){return String(p?.nickname||a?.prenom||a?.nom||"Agent").trim()}
function display(a:any){return [a?.prenom,a?.nom].filter(Boolean).join(" ").trim()||"Agent"}
function teamOf(a:any){const t=String(a?.type_planning||a?.equipe||"jour").toLowerCase();return t==="nuit"?"nuit":t.includes("chef")?"chefs":"jour"}
async function ctx(req:Request){
  const t=req.headers.get("x-stip-session")||"";if(!t)throw Error("Session STIP requise.");
  const{data:s,error:se}=await db.from("stip_access_sessions").select("profile_id,expires_at,revoked_at").eq("token_hash",await sha(t)).maybeSingle();
  if(se)throw se;if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())throw Error("Session expirée.");
  const{data:p,error:pe}=await db.from("stip_access_profiles").select("agent_id,active,permissions,agents(id,source_key,prenom,nom,ghe,equipe,type_planning,profile_photo_url,avatar_url)").eq("id",s.profile_id).maybeSingle();
  if(pe)throw pe;if(!p?.active||!p.agent_id||!p.agents)throw Error("Accès agent requis.");
  if(!p.permissions?.messages)throw Error("Messages non autorisés.");
  return{profile:p,agent:p.agents as any}
}
async function messageProfile(id:string){
  const{data}=await db.from("stip_message_profiles").select("nickname,notification_preview").eq("agent_id",id).maybeSingle();
  return data||{nickname:null,notification_preview:true}
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
  return conv
}
async function thread(ctx:any,id:string){
  if(!await isMember(id,String(ctx.agent.id)))throw Error("Conversation non autorisée.");
  const{data:conv,error:ce}=await db.from("stip_conversations").select("id,kind,title,created_by_agent_id,created_at,last_message_at").eq("id",id).maybeSingle();if(ce)throw ce;if(!conv)throw Error("Conversation introuvable.");
  const{data:members,error:me}=await db.from("stip_conversation_members").select("agent_id,last_read_at,agents(id,prenom,nom,ghe,profile_photo_url,avatar_url)").eq("conversation_id",id);if(me)throw me;
  const mids=(members||[]).map((x:any)=>x.agent_id);const{data:profiles}=mids.length?await db.from("stip_message_profiles").select("agent_id,nickname").in("agent_id",mids):{data:[] as any[]};
  const by=new Map((profiles||[]).map((p:any)=>[String(p.agent_id),p]));
  const{data:messages,error}=await db.from("stip_messages").select("id,body,payload,created_at,sender_agent_id,sender:agents!stip_messages_sender_agent_id_fkey(id,prenom,nom,ghe,profile_photo_url,avatar_url)").eq("conversation_id",id).is("deleted_at",null).order("created_at").limit(300);if(error)throw error;
  await db.from("stip_conversation_members").update({last_read_at:new Date().toISOString()}).eq("conversation_id",id).eq("agent_id",ctx.agent.id);
  return{conversation:conv,members:(members||[]).map((m:any)=>({...m,agent:{...m.agents,nickname:nick(m.agents,by.get(String(m.agent_id)))}})),messages:(messages||[]).map((m:any)=>({...m,sender:{...m.sender,nickname:nick(m.sender,by.get(String(m.sender_agent_id)))}}))}
}
async function send(ctx:any,body:any){
  const id=String(body.conversation_id||"");if(!await isMember(id,String(ctx.agent.id)))throw Error("Conversation non autorisée.");
  const text=String(body.body||"").trim().slice(0,2000);if(!text)throw Error("Message vide.");
  const payload=body.payload&&typeof body.payload==="object"?body.payload:{};
  const{data,error}=await db.from("stip_messages").insert({conversation_id:id,sender_agent_id:ctx.agent.id,body:text,payload}).select("id,created_at").single();if(error)throw error;
  await db.from("stip_conversations").update({last_message_at:data.created_at,updated_at:data.created_at}).eq("id",id);
  await db.from("stip_conversation_members").update({last_read_at:data.created_at}).eq("conversation_id",id).eq("agent_id",ctx.agent.id);
  try{
    const {data:members}=await db.from("stip_conversation_members").select("agent_id").eq("conversation_id",id).neq("agent_id",ctx.agent.id);
    const senderProfile=await messageProfile(String(ctx.agent.id)),senderName=nick(ctx.agent,senderProfile);
    await Promise.allSettled((members||[]).map(async(m:any)=>{
      const targetProfile=await messageProfile(String(m.agent_id)),preview=targetProfile.notification_preview!==false;
      await fetch(URL+"/functions/v1/stip-push",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+SERVICE},body:JSON.stringify({action:"send_internal",agent_id:m.agent_id,payload:{title:preview?senderName:"STIP",body:preview?text.slice(0,140):"Nouveau message",url:"/?quick=notifications&conversation="+encodeURIComponent(id),tag:"stip-message-"+id}})});
    }))
  }catch(e){console.error("push",e)}
  return{ok:true,...data}
}
async function home(ctx:any){
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
      const{data:last}=await db.from("stip_messages").select("id,body,created_at,sender_agent_id").eq("conversation_id",c.id).is("deleted_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
      const lastRead=read.get(String(c.id));
      const{count}=await db.from("stip_messages").select("id",{count:"exact",head:true}).eq("conversation_id",c.id).is("deleted_at",null).neq("sender_agent_id",ctx.agent.id).gt("created_at",lastRead||"1970-01-01T00:00:00Z");
      conversations.push({...c,others:others.map((m:any)=>({...m.agents,nickname:nick(m.agents,pb.get(String(m.agent_id)))})),last_message:last||null,unread:count||0})
    }
  }
  const suggestions=(await agents(ctx,"")).slice(0,18);
  const profile=await messageProfile(String(ctx.agent.id));
  return{me:{...ctx.agent,nickname:nick(ctx.agent,profile),notification_preview:profile.notification_preview!==false},conversations,suggestions,unread:conversations.reduce((n,c)=>n+Number(c.unread||0),0)}
}
async function profileSet(ctx:any,body:any){
  const nickname=String(body.nickname||"").trim().slice(0,32)||null;
  const preview=body.notification_preview!==false;
  const{error}=await db.from("stip_message_profiles").upsert({agent_id:ctx.agent.id,nickname,notification_preview:preview,updated_at:new Date().toISOString()},{onConflict:"agent_id"});if(error)throw error;
  return{ok:true,nickname:nickname||ctx.agent.prenom||ctx.agent.nom,notification_preview:preview}
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  if(req.method!=="POST")return J({error:"Méthode non autorisée."},405);
  try{
    const c=await ctx(req),b=await req.json().catch(()=>({})),a=String(b.action||"home");
    if(a==="home")return J(await home(c));
    if(a==="agents")return J({items:await agents(c,String(b.q||""))});
    if(a==="on_duty")return J({items:await onDuty(c)});
    if(a==="direct")return J({conversation:await direct(c,String(b.agent_id||""))});
    if(a==="group")return J({conversation:await group(c,b)});
    if(a==="thread")return J(await thread(c,String(b.conversation_id||"")));
    if(a==="send")return J(await send(c,b));
    if(a==="profile_set")return J(await profileSet(c,b));
    return J({error:"Action inconnue."},400)
  }catch(e){console.error(e);const m=e instanceof Error?e.message:String(e);return J({error:m},/Session|autorisé|accès/i.test(m)?403:400)}
});