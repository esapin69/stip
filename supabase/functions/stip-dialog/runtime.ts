import { createClient } from "npm:@supabase/supabase-js@2";
import type { Agent, SessionCtx, ShiftDef } from "./types.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const enc = new TextEncoder();
const hex = (a: ArrayBuffer) => [...new Uint8Array(a)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha(s: string) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }

export const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-stip-session",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
export const J = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: H });

export function todayParis() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const g = (k: string) => p.find((x) => x.type === k)?.value || "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
export function dayLabel(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}
export function shortDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  }).replace(/\./g, "");
}
export function teamOf(a: Agent) {
  const t = String(a?.type_planning || a?.equipe || "jour").toLowerCase();
  return t === "nuit" ? "nuit" : t.includes("chef") ? "chefs" : "jour";
}
export function isChief(a: Agent | null | undefined) {
  const s = `${a?.type_planning || ""} ${a?.equipe || ""} ${a?.role || ""}`.toLowerCase();
  return s.includes("chef") || s.includes("responsable") || s.includes("cadre");
}
function levelOf(p: any) {
  if (!p?.permissions?.dialog) return "none";
  return ["pro", "admin", "internal", "restricted"].includes(String(p.permissions?.__levels?.dialog || "").toLowerCase()) ? "pro" : "visitor";
}

export async function session(req: Request): Promise<SessionCtx> {
  const token = req.headers.get("x-stip-session") || "";
  if (!token) throw Error("Session STIP requise.");
  const { data: s, error: se } = await db.from("stip_access_sessions").select("profile_id,expires_at,revoked_at").eq("token_hash", await sha(token)).maybeSingle();
  if (se) throw se;
  if (!s || s.revoked_at || new Date(s.expires_at) <= new Date()) throw Error("Session expirée.");
  const { data: p, error } = await db.from("stip_access_profiles")
    .select("agent_id,active,permissions,agents(id,source_key,prenom,nom,ghe,equipe,type_planning,role,telephone,email,profile_photo_url,avatar_url)")
    .eq("id", s.profile_id).maybeSingle();
  if (error) throw error;
  if (!p?.active || !p.agent_id || !p.agents) throw Error("Accès agent requis.");
  const level = levelOf(p);
  if (level === "none") throw Error("Demander à STIP n’est pas autorisé.");
  return { agent: p.agents as Agent, level, team: teamOf(p.agents as Agent), permissions: p.permissions || {} };
}

export async function directory(): Promise<Agent[]> {
  const { data, error } = await db.from("agents")
    .select("id,source_key,prenom,nom,ghe,equipe,type_planning,role,telephone,email,profile_photo_url,avatar_url")
    .eq("actif", true);
  if (error) throw error;
  const ids = (data || []).map((x: any) => x.id);
  const [{ data: msgProfiles }, { data: access }] = await Promise.all([
    ids.length ? db.from("stip_message_profiles").select("agent_id,nickname").in("agent_id", ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from("stip_access_profiles").select("agent_id,active,permissions").in("agent_id", ids).eq("active", true) : Promise.resolve({ data: [] as any[] }),
  ]);
  const nick = new Map((msgProfiles || []).map((x: any) => [String(x.agent_id), x.nickname]));
  const messaging = new Set((access || []).filter((x: any) => x.permissions?.messages === true).map((x: any) => String(x.agent_id)));
  return (data || []).map((a: any) => ({ ...a, nickname: nick.get(String(a.id)) || null, can_message: messaging.has(String(a.id)) }));
}

export async function shiftDefinitions() {
  const fallback: Record<string, ShiftDef> = {
    M: { code: "M", label: "Matin", start_time: "06:50", end_time: "14:40" },
    J: { code: "J", label: "Journée", start_time: "08:30", end_time: "16:20" },
    J4: { code: "J4", label: "J4", start_time: "10:10", end_time: "18:00" },
    S: { code: "S", label: "Soir", start_time: "13:30", end_time: "21:00" },
    N: { code: "N", label: "Nuit", start_time: "21:00", end_time: "06:50" },
  };
  const { data, error } = await db.from("stip_shift_definitions").select("code,label,start_time,end_time").eq("active", true);
  if (error || !(data || []).length) return fallback;
  const out = { ...fallback };
  for (const row of data || []) {
    const code = String(row.code || "").toUpperCase();
    out[code] = { code, label: row.label || code, start_time: String(row.start_time || "").slice(0, 5), end_time: String(row.end_time || "").slice(0, 5) };
  }
  return out;
}
export function canon(v: unknown) {
  const s = String(v || "").trim().toUpperCase().replace(/\*/g, "");
  if (/^J4\d*$/.test(s)) return "J4";
  if (/^M\d*$/.test(s)) return "M";
  if (s === "J0464" || s === "J" || /^J\d+$/.test(s)) return "J";
  if (/^S\d*$/.test(s)) return "S";
  if (/^N\d*$/.test(s)) return "N";
  if (["R", "RH", "REPOS"].includes(s)) return "RH";
  return s || "—";
}
export function shiftText(code: string, defs: Record<string, ShiftDef>) {
  const d = defs[code];
  return d ? `${d.label} · ${d.start_time} → ${d.end_time}` : code;
}
function minutes(v: string) { const [h, m] = v.split(":").map(Number); return h * 60 + m; }
export function overlaps(a: string, b: string, defs: Record<string, ShiftDef>) {
  const A = defs[a], B = defs[b];
  if (!A || !B) return false;
  let as = minutes(A.start_time), ae = minutes(A.end_time), bs = minutes(B.start_time), be = minutes(B.end_time);
  if (ae <= as) ae += 1440;
  if (be <= bs) be += 1440;
  return Math.max(as, bs) < Math.min(ae, be);
}
export async function planningRows(agentIds: string[], start: string, end: string) {
  if (!agentIds.length) return [];
  const { data, error } = await db.from("planning").select("agent_id,date,code,equipe,observation").in("agent_id", agentIds).gte("date", start).lte("date", end).order("date");
  if (error) throw error;
  return data || [];
}
