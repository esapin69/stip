import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-stip-session",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

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
const J = async (x: unknown, s = 200) => new Response(JSON.stringify(stripLegacyAvatarPayload(x)), { status: s, headers: H });
const enc = new TextEncoder();
const hex = (a: ArrayBuffer) => [...new Uint8Array(a)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha(s: string) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}
function parisToday() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (k: string) => p.find((x) => x.type === k)?.value || "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
function validDate(v: unknown) {
  const s = String(v || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error("Date invalide.");
  return s;
}
function teamOf(a: any) {
  const t = String(a?.type_planning || a?.equipe || "jour").toLowerCase();
  return t === "nuit" ? "nuit" : t.includes("chef") ? "chefs" : "jour";
}
function canon(raw: unknown) {
  const s = String(raw || "").trim().toUpperCase().replace(/\*/g, "");
  if (/^M\d*$/.test(s)) return "M";
  if (s === "J0464" || s === "J" || (/^J\d+$/.test(s) && !/^J4/.test(s))) return "J";
  if (s === "J4" || /^J4\d+$/.test(s)) return "J4";
  if (/^S\d*$/.test(s)) return "S";
  if (/^N\d*$/.test(s)) return "N";
  return s || "—";
}
function accessLevel(p: any) {
  if (!p?.permissions?.tomorrow) return "none";
  const raw = String(p.permissions?.__levels?.tomorrow || "").toLowerCase();
  if (["pro", "admin", "internal", "restricted"].includes(raw)) return "pro";
  return "visitor";
}
async function ctx(req: Request) {
  const t = req.headers.get("x-stip-session") || "";
  if (!t) throw Error("Session STIP requise.");
  const { data: s, error: se } = await db
    .from("stip_access_sessions")
    .select("profile_id,expires_at,revoked_at")
    .eq("token_hash", await sha(t))
    .maybeSingle();
  if (se) throw se;
  if (!s || s.revoked_at || new Date(s.expires_at) <= new Date()) throw Error("Session expirée.");
  const { data: p, error: pe } = await db
    .from("stip_access_profiles")
    .select("id,agent_id,active,role_key,permissions,agents(id,source_key,nom,prenom,equipe,type_planning,ghe,avatar_url,profile_photo_url)")
    .eq("id", s.profile_id)
    .maybeSingle();
  if (pe) throw pe;
  if (!p?.active || !p.agent_id || !p.agents) throw Error("Accès agent requis.");
  const level = accessLevel(p);
  if (level === "none") throw Error("Pour demain n’est pas autorisé pour ce profil.");
  return { profile: p, agent: p.agents as any, level, team: teamOf(p.agents) };
}
function cleanNote(n: any) {
  return {
    id: n.id,
    target_date: n.target_date,
    title: n.title,
    body: n.body || "",
    time: n.note_time ? String(n.note_time).slice(0, 5) : "",
    kind: n.note_kind,
    status: n.status,
    sort_order: n.sort_order || 0,
    completed_at: n.completed_at,
    created_at: n.created_at,
    updated_at: n.updated_at,
    client_id: n.client_id || null,
    owner: n.owner || null,
    author: n.author || null,
  };
}
async function notesFor(ctx: any, date: string) {
  const q = await db
    .from("stip_tomorrow_notes")
    .select("id,target_date,title,body,note_time,note_kind,status,sort_order,completed_at,created_at,updated_at,client_id,author:agents!stip_tomorrow_notes_author_agent_id_fkey(id,prenom,nom,ghe,profile_photo_url,avatar_url)")
    .eq("owner_agent_id", ctx.agent.id)
    .eq("target_date", date)
    .neq("status", "archived")
    .order("sort_order")
    .order("created_at");
  if (q.error) throw q.error;
  return (q.data || []).map(cleanNote);
}
async function sentFor(ctx: any, date: string) {
  if (ctx.level !== "pro") return [];
  const q = await db
    .from("stip_tomorrow_notes")
    .select("id,target_date,title,body,note_time,note_kind,status,sort_order,completed_at,created_at,updated_at,client_id,owner:agents!stip_tomorrow_notes_owner_agent_id_fkey(id,prenom,nom,ghe,profile_photo_url,avatar_url)")
    .eq("author_agent_id", ctx.agent.id)
    .eq("target_date", date)
    .eq("note_kind", "assigned")
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (q.error) throw q.error;
  return (q.data || []).map(cleanNote);
}
async function organization(ctx: any, date: string) {
  if (ctx.level !== "pro") return null;
  let pq = db
    .from("planning")
    .select("agent_id,code,equipe,agents(id,source_key,prenom,nom,ghe,profile_photo_url,avatar_url)")
    .eq("date", date);
  pq = ctx.team === "chefs" ? pq.in("equipe", ["jour", "nuit", "chefs"]) : pq.eq("equipe", ctx.team);
  const [plan, advice] = await Promise.all([
    pq.order("code"),
    db.from("stip_staffing_advice")
      .select("metric,shift_code,target_count,planned_count,gap,severity,status,guidance")
      .eq("reference_date", date)
      .eq("equipe", ctx.team)
      .order("severity", { ascending: false }),
  ]);
  if (plan.error) throw plan.error;
  const rows = (plan.data || []).map((x: any) => ({ ...x, shift: canon(x.code) }));
  const work = new Set(["M", "J", "J4", "S", "N"]);
  const byShift: Record<string, any[]> = { M: [], J: [], J4: [], S: [], N: [] };
  const absences: Record<string, number> = {};
  for (const x of rows) {
    if (work.has(x.shift)) byShift[x.shift].push(x.agents);
    else absences[x.shift] = (absences[x.shift] || 0) + 1;
  }
  const adviceRows = (advice.data || []).map((r: any) => ({
    metric: r.metric,
    shift_code: r.shift_code,
    target_count: r.target_count,
    planned_count: r.planned_count,
    gap: r.gap,
    severity: r.severity,
    status: r.status,
    text: r.guidance?.responsable || r.guidance?.agent || null,
  }));
  return {
    team: ctx.team,
    total_working: Object.values(byShift).reduce((n, a) => n + a.length, 0),
    shifts: Object.fromEntries(Object.entries(byShift).map(([k, a]) => [k, { count: a.length, agents: a }])),
    absences,
    advice: adviceRows,
    source: "planning",
  };
}
async function day(ctx: any, date: string) {
  const [notes, sent, org] = await Promise.all([notesFor(ctx, date), sentFor(ctx, date), organization(ctx, date)]);
  return { date, level: ctx.level === "pro" ? "MAXI" : "MINI", notes, sent_notes: sent, organization: org };
}
async function agents(ctx: any, q = "") {
  if (ctx.level !== "pro") throw Error("Cette action nécessite le niveau MAXI.");
  const { data: profiles, error: pe } = await db
    .from("stip_access_profiles")
    .select("agent_id,permissions")
    .eq("active", true)
    .not("agent_id", "is", null);
  if (pe) throw pe;
  const ids = (profiles || []).filter((p: any) => p.permissions?.tomorrow).map((p: any) => p.agent_id);
  if (!ids.length) return [];
  const { data, error } = await db
    .from("agents")
    .select("id,source_key,prenom,nom,ghe,equipe,type_planning,profile_photo_url,avatar_url")
    .in("id", ids)
    .eq("actif", true)
    .order("prenom")
    .order("nom");
  if (error) throw error;
  const n = String(q || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return (data || []).filter((a: any) => !n || `${a.prenom || ""} ${a.nom || ""} ${a.ghe || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(n));
}
async function createNote(ctx: any, body: any) {
  const date = validDate(body.date);
  const target = String(body.target_agent_id || ctx.agent.id);
  if (target !== String(ctx.agent.id) && ctx.level !== "pro") throw Error("Cette action nécessite le niveau MAXI.");
  const title = String(body.title || "").trim().slice(0, 160);
  const noteBody = String(body.body || "").trim().slice(0, 1000);
  const time = String(body.time || "").trim();
  const personal = target === String(ctx.agent.id);
  const clientId = personal ? String(body.client_id || "").trim().slice(0, 120) || null : null;
  if (!title) throw Error("Titre requis.");
  if (time && !/^\d{2}:\d{2}$/.test(time)) throw Error("Heure invalide.");
  if (clientId) {
    const { data: existing, error: qe } = await db.from("stip_tomorrow_notes")
      .select("id")
      .eq("owner_agent_id", target)
      .eq("client_id", clientId)
      .maybeSingle();
    if (qe) throw qe;
    if (existing?.id) {
      const { error } = await db.from("stip_tomorrow_notes").update({
        target_date: date,
        title,
        body: noteBody || null,
        note_time: time || null,
        status: body.done ? "done" : "active",
        completed_at: body.done ? new Date().toISOString() : null,
        sort_order: Number(body.sort_order || 0),
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      if (error) throw error;
      return { ok: true, id: existing.id, migrated: true };
    }
  }
  const { data, error } = await db.from("stip_tomorrow_notes").insert({
    owner_agent_id: target,
    author_agent_id: ctx.agent.id,
    target_date: date,
    title,
    body: noteBody || null,
    note_time: time || null,
    note_kind: personal ? "personal" : "assigned",
    status: body.done ? "done" : "active",
    completed_at: body.done ? new Date().toISOString() : null,
    sort_order: Number(body.sort_order || 0),
    client_id: clientId,
  }).select("id").single();
  if (error) throw error;
  return { ok: true, id: data.id };
}
async function updateNote(ctx: any, body: any) {
  const id = String(body.id || "");
  const { data: note, error: qe } = await db.from("stip_tomorrow_notes").select("*").eq("id", id).maybeSingle();
  if (qe) throw qe;
  if (!note) throw Error("Note introuvable.");
  const authored = String(note.author_agent_id) === String(ctx.agent.id);
  const ownPersonal = note.note_kind === "personal" && String(note.owner_agent_id) === String(ctx.agent.id);
  if (!authored && !ownPersonal) throw Error("Modification non autorisée.");
  if (note.note_kind === "assigned" && ctx.level !== "pro") throw Error("Cette action nécessite le niveau MAXI.");
  const patch: any = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) {
    patch.title = String(body.title || "").trim().slice(0, 160);
    if (!patch.title) throw Error("Titre requis.");
  }
  if (body.body !== undefined) patch.body = String(body.body || "").trim().slice(0, 1000) || null;
  if (body.time !== undefined) {
    const t = String(body.time || "").trim();
    if (t && !/^\d{2}:\d{2}$/.test(t)) throw Error("Heure invalide.");
    patch.note_time = t || null;
  }
  if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order || 0);
  if (body.date !== undefined) patch.target_date = validDate(body.date);
  const { error } = await db.from("stip_tomorrow_notes").update(patch).eq("id", id);
  if (error) throw error;
  return { ok: true };
}
async function noteStatus(ctx: any, body: any) {
  const id = String(body.id || "");
  const status = String(body.status || "") === "done" ? "done" : "active";
  const { data: note } = await db.from("stip_tomorrow_notes").select("owner_agent_id").eq("id", id).maybeSingle();
  if (!note || String(note.owner_agent_id) !== String(ctx.agent.id)) throw Error("Action non autorisée.");
  const { error } = await db.from("stip_tomorrow_notes").update({
    status,
    completed_at: status === "done" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
  return { ok: true };
}
async function removeNote(ctx: any, body: any) {
  const id = String(body.id || "");
  const { data: note } = await db.from("stip_tomorrow_notes").select("author_agent_id,owner_agent_id,note_kind").eq("id", id).maybeSingle();
  if (!note) throw Error("Note introuvable.");
  const allowed = String(note.author_agent_id) === String(ctx.agent.id) || (note.note_kind === "personal" && String(note.owner_agent_id) === String(ctx.agent.id));
  if (!allowed) throw Error("Suppression non autorisée.");
  const { error } = await db.from("stip_tomorrow_notes").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  return { ok: true };
}

async function reorderNotes(ctx: any, body: any) {
  const date = validDate(body.date);
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  if (!ids.length) return { ok: true };
  const { data: rows, error: qe } = await db.from("stip_tomorrow_notes")
    .select("id,owner_agent_id,note_kind")
    .in("id", ids)
    .eq("target_date", date);
  if (qe) throw qe;
  const allowed = (rows || []).filter((n: any) => n.note_kind === "personal" && String(n.owner_agent_id) === String(ctx.agent.id));
  if (allowed.length !== ids.length) throw Error("Réorganisation non autorisée.");
  for (let i = 0; i < ids.length; i++) {
    const { error } = await db.from("stip_tomorrow_notes")
      .update({ sort_order: i, updated_at: new Date().toISOString() })
      .eq("id", ids[i]);
    if (error) throw error;
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return J({ error: "Méthode non autorisée." }, 405);
  try {
    const c = await ctx(req);
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "day");
    if (action === "day") return J(await day(c, validDate(b.date || parisToday())));
    if (action === "agents") return J({ items: await agents(c, String(b.q || "")), level: "MAXI" });
    if (action === "note_create") return J(await createNote(c, b));
    if (action === "note_update") return J(await updateNote(c, b));
    if (action === "note_status") return J(await noteStatus(c, b));
    if (action === "note_delete") return J(await removeNote(c, b));
    if (action === "note_reorder") return J(await reorderNotes(c, b));
    return J({ error: "Action inconnue." }, 400);
  } catch (e) {
    console.error(e);
    const m = e instanceof Error ? e.message : String(e);
    const status = /Session|autorisé|requise|MAXI/.test(m) ? 403 : 400;
    return J({ error: m }, status);
  }
});
