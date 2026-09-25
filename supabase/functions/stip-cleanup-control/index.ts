import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-stip-session",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function J(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
function hex(a: ArrayBuffer) {
  return [...new Uint8Array(a)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
async function requireStipAdmin(req: Request) {
  const token = req.headers.get("x-stip-session") || "";
  if (!token) throw new Error("Session STIP requise.");
  const { data: session, error: sessionError } = await db
    .from("stip_access_sessions")
    .select("profile_id,expires_at,revoked_at")
    .eq("token_hash", await sha(token))
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session || session.revoked_at || new Date(session.expires_at) <= new Date()) {
    throw new Error("Session STIP expirée.");
  }
  const { data: profile, error: profileError } = await db
    .from("stip_access_profiles")
    .select("id,role_key,permissions,active,agents(prenom,nom,ghe)")
    .eq("id", session.profile_id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.active || !(profile.role_key === "admin" || profile.permissions?.admin === true)) {
    throw new Error("Contrôle réservé à l’administrateur STIP.");
  }
  const agent = Array.isArray(profile.agents) ? profile.agents[0] : profile.agents;
  const label = [agent?.prenom, agent?.nom].filter(Boolean).join(" ").trim() || "Admin STIP";
  return { profile, actor: label + " · STIP" };
}

async function overview() {
  const [
    { data: settings, error: settingsError },
    { data: sources, error: sourcesError },
    { data: cases, error: casesError },
    { data: runs, error: runsError }
  ] = await Promise.all([
    db.from("admin_cleanup_settings").select("config,updated_at").eq("singleton", true).maybeSingle(),
    db.from("admin_cleanup_sources").select("*").order("label"),
    db.from("admin_cleanup_cases").select("*").order("last_changed_at", { ascending: false }).limit(250),
    db.from("admin_cleanup_scan_runs").select("*").order("started_at", { ascending: false }).limit(20)
  ]);
  if (settingsError) throw settingsError;
  if (sourcesError) throw sourcesError;
  if (casesError) throw casesError;
  if (runsError) throw runsError;
  const rows = cases || [];
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;
  return {
    settings: settings || { config: {} },
    sources: sources || [],
    cases: rows,
    runs: runs || [],
    counts,
    generated_at: new Date().toISOString()
  };
}

async function requestScan(actor: string, body: any) {
  const scope = Array.isArray(body.scope) ? body.scope.map(String).slice(0, 50) : [];
  const { data, error } = await db.from("admin_cleanup_scan_runs").insert({
    trigger_kind: "manual_request",
    status: "running",
    scope,
    summary: { requested_by: actor, requested_at: new Date().toISOString(), waiting_for_worker: true }
  }).select("*").single();
  if (error) throw error;
  return data;
}

async function updateSettings(patch: any) {
  const allowed: Record<string, { min: number, max: number }> = {
    github_large_code_bytes: { min: 20000, max: 5000000 },
    github_layer_marker_count: { min: 1, max: 100 },
    github_important_count: { min: 1, max: 500 },
    storage_large_bytes: { min: 1048576, max: 10737418240 },
    storage_unreferenced_days: { min: 1, max: 3650 },
    db_dormant_min_days: { min: 7, max: 3650 },
    vercel_stale_days: { min: 1, max: 3650 },
    drive_large_bytes: { min: 1048576, max: 10737418240 },
    drive_stale_days: { min: 7, max: 3650 },
    scan_frequency_hours: { min: 1, max: 168 }
  };
  const { data: current, error } = await db.from("admin_cleanup_settings")
    .select("config").eq("singleton", true).single();
  if (error) throw error;
  const next = { ...(current?.config || {}) };
  for (const [key, rule] of Object.entries(allowed)) {
    if (patch?.[key] === undefined) continue;
    const value = Number(patch[key]);
    if (!Number.isFinite(value) || value < rule.min || value > rule.max) {
      throw new Error("Valeur invalide pour " + key + ".");
    }
    next[key] = Math.round(value);
  }
  next.auto_execute_after_patron_approval = true;
  next.never_delete_without_patron_decision = true;
  const { data, error: saveError } = await db.from("admin_cleanup_settings")
    .update({ config: next, updated_at: new Date().toISOString() })
    .eq("singleton", true).select("*").single();
  if (saveError) throw saveError;
  return data;
}

async function localStorageDelete(caseRow: any) {
  const action = caseRow?.executable_action || {};
  if (action.provider !== "supabase_storage" || action.action !== "delete_objects") return null;
  const bucket = String(action.bucket || "");
  const paths = Array.isArray(action.paths) ? action.paths.map(String).filter(Boolean) : [];
  if (!bucket || !paths.length) throw new Error("Plan Storage incomplet.");
  let deleted = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await db.storage.from(bucket).remove(batch);
    if (error) throw error;
    deleted += batch.length;
  }
  return { provider: "supabase_storage", bucket, deleted, paths };
}

async function decide(actor: string, body: any) {
  const id = String(body.case_id || "");
  const decision = String(body.decision || "").toLowerCase();
  if (!id || !["validate", "modify", "refuse", "delete"].includes(decision)) {
    throw new Error("Décision invalide.");
  }
  const { data: row, error } = await db.from("admin_cleanup_cases").select("*").eq("id", id).single();
  if (error) throw error;
  const now = new Date().toISOString();
  const note = String(body.note || "").trim().slice(0, 12000);
  let status = "open";
  let executionStatus: string | null = null;
  if (decision === "refuse") status = "refused";
  if (decision === "modify") { status = "modify_requested"; executionStatus = "queued_external"; }
  if (decision === "validate") { status = "validated"; executionStatus = "approved"; }
  if (decision === "delete") { status = "delete_approved"; executionStatus = "approved"; }

  const { data: updated, error: updateError } = await db.from("admin_cleanup_cases").update({
    status,
    decision_kind: decision,
    decision_note: note || null,
    decision_at: now,
    decision_by: actor,
    execution_status: executionStatus
  }).eq("id", id).select("*").single();
  if (updateError) throw updateError;

  await db.from("admin_cleanup_case_events").insert({
    case_id: id,
    event_type: "patron_decision",
    actor,
    note: note || null,
    payload: { decision, evidence_hash: row.evidence_hash }
  });

  if (decision === "refuse" || decision === "modify") return updated;

  const local = await localStorageDelete(updated).catch(async (e) => {
    await db.from("admin_cleanup_cases").update({
      status: "execution_failed",
      execution_status: "failed",
      execution_log: [{ at: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }]
    }).eq("id", id);
    throw e;
  });

  if (local) {
    const result = { ...local, completed_at: new Date().toISOString() };
    const { data: done, error: doneError } = await db.from("admin_cleanup_cases").update({
      status: "done",
      execution_status: "completed",
      result,
      execution_log: [{ at: new Date().toISOString(), action: "delete_objects", result }]
    }).eq("id", id).select("*").single();
    if (doneError) throw doneError;
    await db.from("admin_cleanup_case_events").insert({
      case_id: id, event_type: "execution_completed", actor: "stip-cleanup-control", payload: result
    });
    return done;
  }

  const { data: queued, error: queueError } = await db.from("admin_cleanup_cases").update({
    execution_status: "queued_external"
  }).eq("id", id).select("*").single();
  if (queueError) throw queueError;
  return queued;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return J({ error: "Méthode non autorisée." }, 405);
  try {
    const admin = await requireStipAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "overview");
    if (action === "overview") return J({ ok: true, ...(await overview()) });
    if (action === "request_scan") return J({ ok: true, run: await requestScan(admin.actor, body) });
    if (action === "settings") return J({ ok: true, settings: await updateSettings(body.patch || {}) });
    if (action === "decision") return J({ ok: true, case: await decide(admin.actor, body) });
    return J({ error: "Action inconnue." }, 400);
  } catch (e) {
    console.error(e);
    return J({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});