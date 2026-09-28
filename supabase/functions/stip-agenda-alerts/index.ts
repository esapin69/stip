import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (!URL || !SERVICE) throw new Error("SUPABASE_ENV_MISSING");
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const PARIS = "Europe/Paris";
const HORIZON_DAYS = 35;
const EXPECTED_DAYS = 14;
const ADVANCE_MIN = 30 * 60;
const URGENT_MIN = 120;
const PUSH_URL = URL + "/functions/v1/stip-push";
const H = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const encoder = new TextEncoder();

function out(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: H });
}
function tx(v, max = 800) {
  return String(v == null ? "" : v).trim().slice(0, max);
}
function norm(v) {
  return tx(v, 500).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function hex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(v) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(v)));
}
function parts(d, withTime = true) {
  const opts = withTime
    ? { timeZone: PARIS, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { timeZone: PARIS, year: "numeric", month: "2-digit", day: "2-digit" };
  const p = new Intl.DateTimeFormat("en-CA", opts).formatToParts(d);
  const g = (k) => (p.find((x) => x.type === k) || {}).value || "";
  return { y: g("year"), m: g("month"), d: g("day"), h: g("hour"), n: g("minute") };
}
function localDate(d = new Date()) {
  const p = parts(d, false);
  return p.y + "-" + p.m + "-" + p.d;
}
function localTime(d) {
  const p = parts(d, true);
  return p.h + ":" + p.n;
}
function localDateTime(day, clock) {
  const ds = String(day).slice(0, 10).split("-").map(Number);
  const cs = String(clock).slice(0, 5).split(":").map(Number);
  let guess = Date.UTC(ds[0], ds[1] - 1, ds[2], cs[0], cs[1], 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const p = parts(new Date(guess), true);
    const represented = Date.UTC(Number(p.y), Number(p.m) - 1, Number(p.d), Number(p.h), Number(p.n));
    guess -= represented - Date.UTC(ds[0], ds[1] - 1, ds[2], cs[0], cs[1]);
  }
  return new Date(guess);
}
function addDays(day, n) {
  const d = String(day).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(d[0], d[1] - 1, d[2] + n, 12)).toISOString().slice(0, 10);
}
function daysBetween(a, b, cap = 45) {
  const out = [];
  let x = String(a).slice(0, 10);
  const end = String(b || a).slice(0, 10);
  for (let i = 0; i < cap && x <= end; i += 1) {
    out.push(x);
    x = addDays(x, 1);
  }
  return out;
}
function clocks(v) {
  const out = [];
  const re = /(?:^|\D)([01]?\d|2[0-3])(?:[:hH.])([0-5]\d)(?!\d)/g;
  for (const m of String(v || "").matchAll(re)) out.push(String(Number(m[1])).padStart(2, "0") + ":" + m[2]);
  return out;
}
function clockRange(v) {
  const c = clocks(v);
  return c.length >= 2 ? [c[0], c[c.length - 1]] : [null, null];
}
function interval(day, start, end, fallbackMinutes = 60) {
  if (!day || !start) return { startAt: null, endAt: null };
  const a = localDateTime(day, start);
  let b = end ? localDateTime(day, end) : new Date(a.getTime() + fallbackMinutes * 60000);
  if (b <= a) b = new Date(b.getTime() + 86400000);
  return { startAt: a, endAt: b };
}
function shiftCode(v) {
  const x = tx(v, 30).toUpperCase().replace(/\*+$/g, "");
  if (/^M\d*$/.test(x)) return "M";
  if (x === "J" || x === "J0464" || (/^J\d+$/.test(x) && !/^J4/.test(x))) return "J";
  if (x === "J4" || /^J4\d+$/.test(x)) return "J4";
  if (/^S\d*$/.test(x)) return "S";
  if (/^N\d*$/.test(x)) return "N";
  return x;
}
function person(a) {
  return [tx(a && a.prenom, 80), tx(a && a.nom, 120)].filter(Boolean).join(" ") || "Agent";
}
function kindOf(x) {
  const s = [x && x.source_type, x && x.event_kind, x && x.title, x && x.intitule].filter(Boolean).join(" ").toLowerCase();
  if (/mobi_lit_medical|visite|médical|medical/.test(s)) return "medical";
  if (/stagiaire|intern/.test(s)) return "intern";
  if (/formateur/.test(s)) return "trainer";
  if (/formation|training/.test(s)) return "training";
  if (/réunion|reunion|briefing|staff/.test(s)) return "meeting";
  if (/rendezvous|rendez-vous|rdv/.test(s)) return "appointment";
  if (/information/.test(s)) return "information";
  return "event";
}
function kindLabel(k) {
  return ({ medical: "Visite médicale", intern: "Référent stagiaire", trainer: "Formateur", training: "Formation", meeting: "Réunion", appointment: "Rendez-vous", information: "Information", event: "Événement" })[k] || "Événement";
}
function expectedKind(p) {
  const code = shiftCode(p && p.code);
  const s = (code + " " + tx(p && p.observation, 500) + " " + tx(p && p.source_value, 500)).toUpperCase();
  if (code === "FO" || /(^|\W)FO($|\W)|FORMATION/.test(s)) return "training";
  if (code === "VM" || /(^|\W)VM($|\W)|VISITE\s+M[EÉ]D/.test(s)) return "medical";
  if (code === "ST" || /(^|\W)ST($|\W)|STAGIAIRE/.test(s)) return "intern";
  return "";
}
function kindMatch(k, expected) {
  return expected === "training" ? k === "training" || k === "trainer" : k === expected;
}
function aliases(a) {
  const values = [a && a.source_key, a && a.prenom, a && a.nom, (a && a.prenom || "") + " " + (a && a.nom || ""), (a && a.nom || "") + " " + (a && a.prenom || "")].map(norm).filter(Boolean);
  const last = String(a && a.source_key || "").split("_").filter(Boolean).pop();
  if (last) values.push(norm(last));
  return new Set(values);
}
function resolveReferents(v, agents) {
  const parts = String(v || "").split(/\s*(?:\+|\/|;|&|\bet\b)\s*/i).map(norm).filter(Boolean);
  const result = [];
  for (const q of parts) {
    for (const a of agents) {
      if (aliases(a).has(q) && !result.some((x) => x.id === a.id)) result.push(a);
    }
  }
  return result;
}
async function authenticated(req) {
  if ((req.headers.get("authorization") || "") === "Bearer " + SERVICE) return true;
  const token = req.headers.get("x-stip-alert-token") || "";
  if (token.length < 40) return false;
  const hash = await sha256(token);
  const r = await db.from("stip_agenda_alert_tokens").select("active,expires_at").eq("token_hash", hash).maybeSingle();
  if (r.error) throw r.error;
  return Boolean(r.data && r.data.active && (!r.data.expires_at || new Date(r.data.expires_at) > new Date()));
}
async function planningRows(today, horizon) {
  const rows = [];
  for (let from = 0; from < 5000; from += 1000) {
    const r = await db.from("planning")
      .select("id,agent_id,agent_source_key,date,code,observation,source_value")
      .gte("date", today).lte("date", horizon).order("date").order("agent_source_key")
      .range(from, from + 999);
    if (r.error) throw r.error;
    rows.push(...(r.data || []));
    if ((r.data || []).length < 1000) break;
  }
  return { data: rows, error: null };
}
async function source(now) {
  const today = localDate(now);
  const horizon = addDays(today, HORIZON_DAYS);
  const fromUtc = new Date(now.getTime() - 86400000).toISOString();
  const toUtc = new Date(now.getTime() + (HORIZON_DAYS + 2) * 86400000).toISOString();
  const q = await Promise.all([
    db.from("formations").select("id,agent_source_key,intitule,date_debut,date_fin,lieu,statut,observation,horaire").gte("date_fin", fromUtc).lte("date_debut", toUtc).order("date_debut"),
    db.from("stip_agent_agenda_items").select("id,agent_id,source_type,source_ref,title,body,event_date,all_day,start_time,end_time,location,importance,status,event_kind").eq("status", "active").gte("event_date", today).lte("event_date", horizon).order("event_date").order("start_time"),
    db.from("stagiaires").select("id,nom,prenom,date_debut,date_fin,horaires,referent,observation").gte("date_fin", today).lte("date_debut", horizon).order("date_debut"),
    db.from("agents").select("id,source_key,nom,prenom,equipe,ghe,role,actif").eq("actif", true),
    planningRows(today, horizon),
    db.from("stip_shift_definitions").select("code,label,start_time,end_time,active").eq("active", true),
    db.from("stip_access_profiles").select("agent_id,role_key,active,permissions").eq("active", true).not("agent_id", "is", null),
  ]);
  for (const r of q) if (r.error) throw r.error;
  return { today, horizon, formations: q[0].data || [], agenda: q[1].data || [], interns: q[2].data || [], agents: q[3].data || [], planning: q[4].data || [], shifts: q[5].data || [], profiles: q[6].data || [] };
}
function buildEvents(d, now) {
  const byId = new Map(d.agents.map((a) => [String(a.id), a]));
  const byKey = new Map(d.agents.map((a) => [String(a.source_key), a]));
  const events = [], unresolved = [];
  for (const r of d.agenda) {
    const a = byId.get(String(r.agent_id));
    if (!a) continue;
    const k = kindOf(r), allDay = Boolean(r.all_day || !r.start_time);
    const iv = allDay ? { startAt: null, endAt: null } : interval(String(r.event_date), String(r.start_time).slice(0, 5), r.end_time ? String(r.end_time).slice(0, 5) : null, 60);
    const importance = tx(r.importance, 30).toLowerCase() || "normal";
    const blocking = !allDay || ["medical","training","trainer","meeting","appointment","intern"].includes(k) || importance === "important" || importance === "urgent";
    events.push({ sourceType: "agenda", sourceRef: r.id, subjectId: a.id, sourceKey: a.source_key, title: tx(r.title, 240) || kindLabel(k), location: tx(r.location, 240), detail: tx(r.body, 900), kind: k, importance, date: String(r.event_date).slice(0,10), allDay, blocking, reminder: !allDay || importance !== "normal", startAt: iv.startAt, endAt: iv.endAt });
  }
  for (const r of d.formations) {
    if (!r.date_debut || !r.agent_source_key || /annul|cancel|supprim|refus/.test(tx(r.statut,80).toLowerCase())) continue;
    const a = byKey.get(String(r.agent_source_key));
    if (!a) continue;
    const first = localDate(new Date(r.date_debut)), last = localDate(new Date(r.date_fin || r.date_debut));
    const cr = clockRange(r.horaire);
    for (const day of daysBetween(first, last)) {
      if (day < d.today || day > d.horizon) continue;
      const iv = cr[0] ? interval(day, cr[0], cr[1], 480) : (first === last ? { startAt: new Date(r.date_debut), endAt: new Date(r.date_fin || new Date(r.date_debut).getTime() + 8*3600000) } : { startAt:null,endAt:null });
      events.push({ sourceType:"formation", sourceRef:r.id, subjectId:a.id, sourceKey:a.source_key, title:tx(r.intitule,240)||"Formation", location:tx(r.lieu,240), detail:tx(r.observation,900), kind:"training", importance:"important", date:day, allDay:!iv.startAt, blocking:true, reminder:true, startAt:iv.startAt, endAt:iv.endAt });
    }
  }
  for (const r of d.interns) {
    const refs = resolveReferents(r.referent, d.agents), cr = clockRange(r.horaires);
    for (const day of daysBetween(r.date_debut, r.date_fin || r.date_debut)) {
      if (day < d.today || day > d.horizon) continue;
      if (!refs.length) {
        if (day <= addDays(d.today, EXPECTED_DAYS)) unresolved.push({ row:r, day, start:cr[0] });
        continue;
      }
      for (const a of refs) {
        const iv = cr[0] ? interval(day, cr[0], cr[1], 420) : { startAt:null,endAt:null };
        events.push({ sourceType:"intern", sourceRef:r.id, subjectId:a.id, sourceKey:a.source_key, title:"Référent stagiaire · " + ([tx(r.prenom,80),tx(r.nom,120)].filter(Boolean).join(" ")||"Stagiaire"), location:"", detail:tx(r.observation,900), kind:"intern", importance:"important", date:day, allDay:!iv.startAt, blocking:true, reminder:true, startAt:iv.startAt, endAt:iv.endAt });
      }
    }
  }
  const rank = { formation:4, intern:4, agenda:2 }, seen = new Map();
  for (const e of events) {
    const key = [e.subjectId,e.date,e.kind,norm(e.title),e.startAt?localTime(e.startAt):"all"].join("|");
    const old = seen.get(key);
    if (!old || (rank[e.sourceType]||1) > (rank[old.sourceType]||1)) seen.set(key,e);
  }
  return { events:Array.from(seen.values()).filter((e)=> e.startAt ? (e.endAt ? e.endAt > now : e.startAt > now) : e.date >= localDate(now)), unresolved, byId, byKey };
}
function context(d, built) {
  const planning = new Map(d.planning.map((p)=>[(p.agent_source_key||"")+"|"+String(p.date).slice(0,10),p]));
  const shifts = new Map(d.shifts.map((x)=>[String(x.code).toUpperCase(),x]));
  const profiles = new Map(), chiefs=[];
  for (const p of d.profiles) {
    profiles.set(String(p.agent_id),p);
    if (String(p.role_key||"").toLowerCase()==="chef_equipe") chiefs.push(p);
  }
  return Object.assign({},built,{planning,shifts,profiles,chiefs});
}
function workInterval(p, s, day) {
  if (!s || !s.start_time || !s.end_time) return null;
  let a=String(s.start_time).slice(0,5), b=String(s.end_time).slice(0,5);
  const override=clockRange(tx(p.source_value,300)+" "+tx(p.observation,500));
  if (override[0] && override[1]) { a=override[0]; b=override[1]; }
  const iv=interval(day,a,b,480);
  return { startAt:iv.startAt,endAt:iv.endAt,startClock:a,endClock:b };
}
function eventKey(e) {
  return [e.sourceType,e.sourceRef,e.date,e.subjectId||"unknown",e.startAt?e.startAt.toISOString():"all"].join(":");
}
function planningIssues(e,a,c) {
  const p=c.planning.get(a.source_key+"|"+e.date);
  if (!p) return [{code:"planning_missing",severity:"warning",reason:"aucun planning n’est renseigné le "+e.date}];
  const code=shiftCode(p.code), s=c.shifts.get(code), expected=expectedKind(p);
  if (expected && kindMatch(e.kind,expected) && (!s || !s.start_time)) return [];
  if (!s) return [{code:"planning_unknown",severity:"warning",reason:"le code planning "+(code||"—")+" n’est pas reconnu"}];
  if (!s.start_time || !s.end_time) {
    if (expected && kindMatch(e.kind,expected)) return [];
    return e.blocking ? [{code:"non_working_day",severity:"danger",reason:"l’événement est prévu alors que le planning indique "+(code||s.label||"repos/absence")}] : [];
  }
  if (!e.startAt || !e.endAt || !e.blocking) return [];
  const w=workInterval(p,s,e.date);
  if (!w) return [];
  const start=localTime(e.startAt), end=localTime(e.endAt), issues=[];
  if (e.endAt<=w.startAt || e.startAt>=w.endAt) return [{code:"outside_shift",severity:"danger",reason:kindLabel(e.kind)+" "+start+"–"+end+" entièrement hors du poste "+code+" "+w.startClock+"–"+w.endClock}];
  if (e.startAt<w.startAt) issues.push({code:"before_shift",severity:"danger",reason:kindLabel(e.kind)+" à "+start+", avant la prise de poste "+code+" à "+w.startClock});
  if (e.endAt>w.endAt) issues.push({code:"after_shift",severity:"danger",reason:kindLabel(e.kind)+" jusqu’à "+end+", après la fin du poste "+code+" à "+w.endClock});
  return issues;
}
function overlap(a,b) {
  return Boolean(a.startAt&&a.endAt&&b.startAt&&b.endAt&&a.blocking&&b.blocking&&a.startAt<b.endAt&&b.startAt<a.endAt);
}
function atOf(b) {
  return b.at || (b.event && b.event.startAt) || localDateTime(b.event.date,"08:00");
}
function buildProblems(d,c,now) {
  const bundles=[];
  for (const e of c.events) {
    const a=c.byId.get(String(e.subjectId));
    if (!a) continue;
    const issues=planningIssues(e,a,c);
    if (issues.length) bundles.push({ key:"event:"+eventKey(e)+":"+issues.map((x)=>x.code).sort().join("+"), sourceType:e.sourceType, sourceRef:e.sourceRef, subject:a, event:e, title:e.title, kind:e.kind, issues, conflict:true, severity:issues.some((x)=>x.severity==="danger")?"danger":"warning", at:e.startAt||localDateTime(e.date,"08:00") });
  }
  const groups=new Map();
  for (const e of c.events) {
    if (!e.subjectId || !e.startAt || !e.endAt || !e.blocking) continue;
    const key=e.subjectId+"|"+e.date;
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(e);
  }
  for (const list of groups.values()) {
    list.sort((a,b)=>a.startAt-b.startAt);
    for (let i=0;i<list.length;i+=1) for (let j=i+1;j<list.length;j+=1) {
      if (list[j].startAt>=list[i].endAt) break;
      if (!overlap(list[i],list[j])) continue;
      const a=c.byId.get(String(list[i].subjectId));
      if (!a) continue;
      const keys=[eventKey(list[i]),eventKey(list[j])].sort();
      bundles.push({ key:"overlap:"+keys.join("::"), sourceType:"event_pair", sourceRef:list[i].sourceRef, subject:a, event:list[i], other:list[j], title:"Deux événements se chevauchent", kind:"event", conflict:true, severity:"danger", at:list[i].startAt<list[j].startAt?list[i].startAt:list[j].startAt, issues:[{code:"event_overlap",severity:"danger",reason:"« "+list[i].title+" » "+localTime(list[i].startAt)+"–"+localTime(list[i].endAt)+" chevauche « "+list[j].title+" » "+localTime(list[j].startAt)+"–"+localTime(list[j].endAt)}] });
    }
  }
  const limit=addDays(d.today,EXPECTED_DAYS), eventKinds=new Map();
  for (const e of c.events) {
    const k=e.subjectId+"|"+e.date;
    if (!eventKinds.has(k)) eventKinds.set(k,new Set());
    eventKinds.get(k).add(e.kind);
  }
  for (const p of d.planning) {
    const day=String(p.date).slice(0,10), expected=expectedKind(p);
    if (!expected || day<d.today || day>limit) continue;
    const a=p.agent_id?c.byId.get(String(p.agent_id)):c.byKey.get(String(p.agent_source_key));
    if (!a) continue;
    const kinds=eventKinds.get(a.id+"|"+day)||new Set();
    if (Array.from(kinds).some((k)=>kindMatch(k,expected))) continue;
    const s=c.shifts.get(shiftCode(p.code)), at=s&&s.start_time?localDateTime(day,String(s.start_time).slice(0,5)):localDateTime(day,"08:00");
    bundles.push({ key:"planning:"+p.id+":missing:"+expected, sourceType:"planning", sourceRef:p.id, subject:a, event:{date:day,startAt:at,endAt:null,title:kindLabel(expected),location:"",kind:expected}, title:kindLabel(expected)+" indiquée au planning mais événement absent", kind:expected, conflict:true, severity:"warning", at, issues:[{code:"expected_event_missing",severity:"warning",reason:"le planning indique "+kindLabel(expected).toLowerCase()+" mais aucun événement correspondant n’est enregistré dans STIP"}] });
  }
  for (const u of c.unresolved) {
    const at=localDateTime(u.day,u.start||"08:00");
    bundles.push({ key:"intern:"+u.row.id+":"+u.day+":referent-unresolved:"+norm(u.row.referent), sourceType:"intern", sourceRef:u.row.id, subject:null, event:{date:u.day,startAt:at,endAt:null,title:"Stagiaire "+([tx(u.row.prenom,80),tx(u.row.nom,120)].filter(Boolean).join(" ")),location:"",kind:"intern",subjectHint:tx(u.row.referent,240)}, title:"Référent stagiaire introuvable", kind:"intern", conflict:true, severity:"warning", at, issues:[{code:"referent_unresolved",severity:"warning",reason:"le référent « "+(tx(u.row.referent,240)||"non renseigné")+" » ne correspond à aucun agent actif STIP"}] });
  }
  const unique=new Map();
  for (const b of bundles) if (!unique.has(b.key) && atOf(b)>new Date(now.getTime()-3600000)) unique.set(b.key,b);
  return Array.from(unique.values());
}
function family(a,c) {
  if (!a) return "";
  const p=c.profiles.get(String(a.id)), f=tx(p&&p.permissions&&p.permissions.communication_family,80);
  return f || (/brancard/i.test(tx(a.role,120))?"brancardage":"");
}
function chiefsFor(subject,c) {
  const f=family(subject,c), out=[];
  for (const p of c.chiefs) {
    const a=c.byId.get(String(p.agent_id));
    if (!a || (subject && String(a.id)===String(subject.id))) continue;
    const cf=tx(p&&p.permissions&&p.permissions.communication_family,80);
    if (f && cf && f!==cf) continue;
    out.push({id:a.id,kind:"chief",agent:a});
  }
  return out;
}
function stage(at,now) {
  const m=Math.floor((at.getTime()-now.getTime())/60000);
  return {stage:m<=URGENT_MIN?"urgent":m<=ADVANCE_MIN?"advance":"watch",minutes:m};
}
function recipients(b,st,c) {
  const out=[];
  if (b.subject && st!=="watch") out.push({id:b.subject.id,kind:"target",agent:b.subject});
  if (b.conflict) out.push(...chiefsFor(b.subject,c));
  return out.filter((x,i,a)=>a.findIndex((y)=>String(y.id)===String(x.id))===i);
}
function reminders(c,now,problemEventKeys) {
  const out=[];
  for (const e of c.events) {
    if (!e.subjectId || !e.reminder || problemEventKeys.has(eventKey(e))) continue;
    const a=c.byId.get(String(e.subjectId)); if(!a) continue;
    const at=e.startAt||localDateTime(e.date,"08:00"), m=Math.floor((at.getTime()-now.getTime())/60000);
    if (m<=0 || m>ADVANCE_MIN) continue;
    out.push({key:"reminder:"+eventKey(e),sourceType:e.sourceType,sourceRef:e.sourceRef,subject:a,event:e,title:e.title,kind:e.kind,issues:[],conflict:false,severity:"info",at});
  }
  return out;
}
function copyFor(b,r,st) {
  const at=atOf(b), time=localTime(at), day=localDate(at), place=b.event&&b.event.location?" · "+b.event.location:"";
  const reason=b.issues.map((x)=>x.reason).filter(Boolean).join(" ; ");
  const who=b.subject?person(b.subject):tx(b.event&&b.event.subjectHint,120)||"Équipe";
  if (!b.conflict) return {title:(st==="urgent"?"⚠️ ":"🔔 ")+kindLabel(b.kind)+(st==="urgent"?" bientôt":" à venir"),body:b.title+" · "+day+" à "+time+place+".",base:"/?quick=notifications"};
  if (r.kind==="chief") return {title:"🛑 "+kindLabel(b.kind)+" · "+who,body:b.title+" · "+day+" à "+time+place+"."+ (reason?" "+reason+".":""),base:"/responsable.html?tab=suivi"};
  return {title:"🛑 Incohérence · "+kindLabel(b.kind),body:b.title+" · "+day+" à "+time+place+"."+ (reason?" "+reason+".":""),base:"/?quick=notifications"};
}
async function pushAllowed(agentId) {
  const t=await db.from("stip_notification_types").select("push_enabled,default_user_enabled,active").eq("event_key","agenda_alert").maybeSingle();
  if (t.error) throw t.error;
  if (!t.data || !t.data.active || !t.data.push_enabled) return false;
  const p=await db.from("stip_notification_preferences").select("enabled").eq("agent_id",agentId).eq("event_key","agenda_alert").maybeSingle();
  if (p.error) throw p.error;
  return p.data ? Boolean(p.data.enabled) : Boolean(t.data.default_user_enabled);
}
async function push(agentId,payload) {
  if (!(await pushAllowed(agentId))) return 0;
  const r=await fetch(PUSH_URL,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+SERVICE},body:JSON.stringify({action:"send_internal",agent_id:agentId,payload})});
  const j=await r.json().catch(()=>({}));
  if (!r.ok || j.error) throw new Error(tx(j.error||("PUSH_"+r.status),300));
  return Number(j.sent||0);
}
async function existing(alertKey,recipientId) {
  const d=await db.from("stip_agenda_alert_deliveries").select("notification_id").eq("alert_key",alertKey).eq("recipient_agent_id",recipientId).not("notification_id","is",null).order("created_at",{ascending:true}).limit(1);
  if(d.error)throw d.error;
  const id=d.data&&d.data[0]&&d.data[0].notification_id;
  if(!id)return{id:null,exists:false,read:false};
  const n=await db.from("stip_notifications").select("id,read_at").eq("id",id).eq("agent_id",recipientId).maybeSingle();
  if(n.error)throw n.error;
  return n.data?{id:n.data.id,exists:true,read:Boolean(n.data.read_at)}:{id,exists:false,read:true};
}
async function stageRow(payload) {
  let q=await db.from("stip_agenda_alert_deliveries").select("*").eq("alert_key",payload.alert_key).eq("recipient_agent_id",payload.recipient_agent_id).eq("stage",payload.stage).maybeSingle();
  if(q.error)throw q.error;
  if(q.data?.status==="resolved"){
    const reopened=await db.from("stip_agenda_alert_deliveries").update({
      status:"pending",processed_at:null,claimed_at:null,notification_id:null,push_sent:false,event_at:payload.event_at
    }).eq("id",q.data.id).select("*").single();
    if(reopened.error)throw reopened.error;
    return reopened.data;
  }
  if(q.data)return q.data;
  const i=await db.from("stip_agenda_alert_deliveries").insert(payload).select("*").single();
  if(!i.error)return i.data;
  if(i.error.code!=="23505")throw i.error;
  q=await db.from("stip_agenda_alert_deliveries").select("*").eq("alert_key",payload.alert_key).eq("recipient_agent_id",payload.recipient_agent_id).eq("stage",payload.stage).single();
  if(q.error)throw q.error;
  return q.data;
}
async function deliver(b,r,st,dry) {
  const cp=copyFor(b,r,st), at=atOf(b);
  const meta={alert_key:b.key,recipient_kind:r.kind,severity:b.severity,conflict:b.conflict,issue_codes:b.issues.map((x)=>x.code),reasons:b.issues.map((x)=>x.reason),subject_agent_id:b.subject&&b.subject.id||null,subject_name:b.subject?person(b.subject):tx(b.event&&b.event.subjectHint,120),subject_source_key:b.subject&&b.subject.source_key||null,event_kind:b.kind,event_label:kindLabel(b.kind),event_title:b.title,event_at:at.toISOString(),event_end_at:b.event&&b.event.endAt?b.event.endAt.toISOString():null,event_time:localTime(at),event_date:localDate(at),location:b.event&&b.event.location||"",source_type:b.sourceType,source_ref:b.sourceRef,other_event_title:b.other&&b.other.title||null};
  if(dry)return{alert_key:b.key,recipient:r.id,recipient_kind:r.kind,stage:st,title:cp.title,body:cp.body,metadata:meta};
  const row=await stageRow({alert_key:b.key,recipient_agent_id:r.id,subject_agent_id:b.subject&&b.subject.id||null,source_type:b.sourceType,source_ref:b.sourceRef,event_at:at.toISOString(),stage:st,status:"pending"});
  if(row.processed_at)return{skipped:true,reason:"already_processed"};
  const claim=await db.rpc("stip_agenda_alert_claim",{p_id:row.id});
  if(claim.error)throw claim.error;
  if(!claim.data)return{skipped:true,reason:"claimed_elsewhere"};
  const ex=await existing(b.key,r.id);
  if(st==="urgent"&&ex.id&&ex.read){await db.from("stip_agenda_alert_deliveries").update({status:"acknowledged",processed_at:new Date().toISOString(),claimed_at:null}).eq("id",row.id);return{skipped:true,reason:"acknowledged"};}
  if(st==="urgent"&&ex.id&&!ex.exists){await db.from("stip_agenda_alert_deliveries").update({status:"dismissed",processed_at:new Date().toISOString(),claimed_at:null}).eq("id",row.id);return{skipped:true,reason:"dismissed"};}
  let noteId=ex.exists?ex.id:null;
  if(!noteId){
    const n=await db.from("stip_notifications").insert({agent_id:r.id,type:"agenda_alert",title:cp.title,body:cp.body,source_type:"agenda_alert",source_ref:b.sourceRef,metadata:meta}).select("id").single();
    if(n.error){
      if(n.error.code!=="23505")throw n.error;
      const q=await db.from("stip_notifications").select("id").eq("agent_id",r.id).eq("type","agenda_alert").contains("metadata",{alert_key:b.key}).limit(1).maybeSingle();
      if(q.error)throw q.error;
      if(!q.data?.id)throw n.error;
      noteId=q.data.id;
    }else noteId=n.data.id;
  }else{
    const u=await db.from("stip_notifications").update({title:cp.title,body:cp.body,metadata:meta}).eq("id",noteId); if(u.error)throw u.error;
  }
  let sent=0;
  const phonePush = st!=="watch" && (r.kind==="target" || st==="urgent");
  if(phonePush){
    const url=cp.base+(cp.base.includes("?")?"&":"?")+"alert_key="+encodeURIComponent(b.key);
    sent=await push(r.id,{event_key:"agenda_alert",title:cp.title,body:cp.body,url,tag:"stip-agenda-alert-"+b.key+"-"+r.id,urgency:"high"});
  }
  const u=await db.from("stip_agenda_alert_deliveries").update({notification_id:noteId,push_sent:sent>0,status:st==="watch"||sent===0?"cloche_only":"sent",processed_at:new Date().toISOString(),claimed_at:null}).eq("id",row.id);
  if(u.error)throw u.error;
  return{sent,notification_id:noteId};
}
async function reconcile(active,now,dry) {
  if(dry)return[];
  const q=await db.from("stip_notifications").select("id,metadata").eq("type","agenda_alert").eq("source_type","agenda_alert").limit(500);
  if(q.error)throw q.error;
  const done=[];
  for(const n of q.data||[]){
    const m=n.metadata||{};
    if(!m.conflict||!m.alert_key||active.has(String(m.alert_key)))continue;
    const at=new Date(m.event_at||0);
    if(Number.isNaN(at.getTime())||at<new Date(now.getTime()-86400000))continue;
    const del=await db.from("stip_notifications").delete().eq("id",n.id); if(del.error)throw del.error;
    await db.from("stip_agenda_alert_deliveries").update({status:"resolved",processed_at:new Date().toISOString()}).eq("alert_key",String(m.alert_key));
    done.push(String(m.alert_key));
  }
  return done;
}
async function scan(now,dry=false) {
  const d=await source(now), built=buildEvents(d,now), c=context(d,built), problems=buildProblems(d,c,now);
  const problemEvents=new Set();
  for(const b of problems){if(b.event&&b.event.sourceRef)problemEvents.add(eventKey(b.event));if(b.other&&b.other.sourceRef)problemEvents.add(eventKey(b.other));}
  const rem=reminders(c,now,problemEvents), active=new Set(problems.map((b)=>b.key)), deliveries=[];
  for(const b of problems.concat(rem)){
    const timing=stage(atOf(b),now);
    if(timing.minutes<=-60||timing.minutes>HORIZON_DAYS*1440)continue;
    if(!b.conflict&&timing.stage==="watch")continue;
    for(const r of recipients(b,timing.stage,c)){
      const x=await deliver(b,r,timing.stage,dry);
      deliveries.push(Object.assign({alert_key:b.key,source_type:b.sourceType,source_ref:b.sourceRef,subject:b.subject&&b.subject.id||null,minutes:timing.minutes,conflict:b.conflict,issues:b.issues.map((i)=>i.code)},x));
    }
  }
  return{ok:true,dry_run:dry,horizon_days:HORIZON_DAYS,source_counts:{agenda:d.agenda.length,formations:d.formations.length,stagiaires:d.interns.length,planning:d.planning.length},events:c.events.length,inconsistencies:problems.length,reminders:rem.length,unresolved_referents:c.unresolved.length,resolved:await reconcile(active,now,dry),deliveries};
}
Deno.serve(async(req)=>{
  if(req.method!=="POST")return out({error:"METHODE_NON_AUTORISEE"},405);
  try{
    if(!(await authenticated(req)))return out({error:"ACCES_REFUSE"},401);
    const b=await req.json().catch(()=>({})), action=tx(b.action,40)||"scan";
    if(!["scan","dry_run"].includes(action))return out({error:"ACTION_INVALIDE"},400);
    const when=action==="dry_run"&&b.now?new Date(b.now):new Date();
    if(Number.isNaN(when.getTime()))return out({error:"NOW_INVALIDE"},400);
    return out(await scan(when,action==="dry_run"));
  }catch(e){console.error(e);return out({error:e instanceof Error?e.message:String(e)},500);}
});
