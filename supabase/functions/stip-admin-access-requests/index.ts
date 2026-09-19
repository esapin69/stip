import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const URL = Deno.env.get("SUPABASE_URL")!,
  SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  db = createClient(URL, SERVICE, { auth: { persistSession: false } });
const C = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,x-stip-session",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  },
  J = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), {
      status: s,
      headers: {
        ...C,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
const hex = (a: ArrayBuffer) =>
  [...new Uint8Array(a)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256(s: string) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  );
}
async function adminCtx(req: Request) {
  const token = req.headers.get("x-stip-session") || "";
  if (!token) throw Error("Session STIP requise.");
  const { data: s } = await db
    .from("stip_access_sessions")
    .select("profile_id,expires_at,revoked_at")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (!s || s.revoked_at || new Date(s.expires_at) <= new Date())
    throw Error("Session expirée.");
  const { data: p } = await db
    .from("stip_access_profiles")
    .select("id,agent_id,active,role_key,permissions")
    .eq("id", s.profile_id)
    .maybeSingle();
  if (!p || !p.active || !(p.role_key === "admin" || p.permissions?.admin))
    throw Error("Accès Admin requis.");
  return p;
}
async function catalog() {
  const { data, error } = await db
    .from("stip_app_catalog")
    .select("app_key,level_mode")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return data || [];
}
async function rolePresets() {
  const { data, error } = await db
    .from("stip_access_role_presets")
    .select("role_key,label,permissions")
    .order("label");
  if (error) throw error;
  return data || [];
}
async function permissionsForRole(role: string) {
  const [apps, presets] = await Promise.all([catalog(), rolePresets()]),
    preset = presets.find((x: any) => x.role_key === role);
  if (!preset) throw Error("Type d’accès invalide.");
  const raw = preset.permissions || {},
    levels = raw.__levels || {},
    out: any = {},
    kept: any = {};
  for (const app of apps) {
    out[app.app_key] = !!raw[app.app_key];
    if (!out[app.app_key]) continue;
    if (app.level_mode === "pro_only") kept[app.app_key] = "pro";
    else if (app.level_mode === "visitor_pro")
      kept[app.app_key] =
        String(levels[app.app_key] || "visitor").toLowerCase() === "pro"
          ? "pro"
          : "visitor";
  }
  out.__levels = kept;
  return out;
}
const clean = (v: any, n = 1200) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
const norm = (v: any) =>
  clean(v, 300)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
function keys(v: any) {
  return norm(v).split(" ").filter(Boolean).sort().join(" ");
}
function samePerson(r: any, a: any) {
  const wanted = keys(`${r.first_name || ""} ${r.last_name || ""}`),
    actual = keys(`${a.prenom || ""} ${a.nom || ""}`),
    source = keys(String(a.source_key || "").replace(/_/g, " "));
  return !!wanted && (wanted === actual || wanted === source);
}
async function matchingAgent(r: any) {
  const { data, error } = await db
    .from("agents")
    .select("id,nom,prenom,source_key,equipe,type_planning,role,actif")
    .eq("actif", true);
  if (error) throw error;
  const matches = (data || []).filter((a: any) => samePerson(r, a));
  return matches.length === 1 ? matches[0] : null;
}
function expectedScopes(agent: any, role = "") {
  const s = norm(
    `${agent?.type_planning || ""} ${agent?.equipe || ""} ${agent?.role || ""} ${role}`,
  );
  if (/chef/.test(s)) return ["chefs"];
  if (/nuit/.test(s)) return ["nuit"];
  if (/jour/.test(s)) return ["jour"];
  return ["jour", "nuit", "chefs"];
}
async function evidenceForAgent(agent: any, role = "") {
  if (!agent)
    return {
      kind: "unlinked",
      label: "Aucune personne reliée",
      checkable: true,
      planning_match: false,
      note: "Aucune correspondance fiable dans les agents STIP.",
    };
  const knownRole = role || agent.role || "";
  if (["cadre", "responsable", "admin"].includes(String(knownRole)))
    return {
      kind: String(knownRole),
      label: String(knownRole),
      checkable: true,
      planning_match: true,
      note: "Accès de fonction non dépendant du planning agent.",
    };
  const scopes = expectedScopes(agent, knownRole),
    future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const { data: batches } = await db
    .from("admin_import_batches")
    .select("id,scope,file_name,min_date,max_date,committed_at")
    .eq("kind", "planning")
    .eq("status", "committed")
    .in("scope", scopes)
    .gte("max_date", future)
    .order("max_date", { ascending: false });
  if (!(batches || []).length)
    return {
      kind: "planning_stale",
      label: "Source planning à actualiser",
      checkable: false,
      planning_match: false,
      note: "Aucun fichier de planning assez récent pour conclure sans risque.",
    };
  const ids = (batches || []).map((b: any) => b.id);
  const { data: rows } = await db
    .from("planning")
    .select("date,source_sheet,sync_batch_id")
    .eq("agent_id", agent.id)
    .in("sync_batch_id", ids)
    .order("date", { ascending: false })
    .limit(1);
  if (!(rows || []).length)
    return {
      kind: "missing_current_planning",
      label: "Absent du planning de référence",
      checkable: true,
      planning_match: false,
      note: "La source planning est actuelle mais cette personne n’y est pas retrouvée.",
      fresh_sources: (batches || []).map((b: any) => ({
        scope: b.scope,
        file_name: b.file_name,
        max_date: b.max_date,
      })),
    };
  const row = rows![0],
    batch = (batches || []).find((b: any) => b.id === row.sync_batch_id);
  return {
    kind: batch?.scope === "chefs" ? "chef_planning" : "planning",
    label: batch?.scope === "chefs" ? "Planning chefs" : "Planning agent",
    checkable: true,
    planning_match: true,
    note: "Présence retrouvée dans un planning de référence actuel.",
    source_file: batch?.file_name || null,
    source_sheet: row.source_sheet || null,
    last_date: row.date,
    scope: batch?.scope || null,
  };
}
async function classifyRequest(r: any) {
  const agent = await matchingAgent(r),
    evidence = await evidenceForAgent(agent);
  return {
    agent,
    evidence,
    recommended_role: agent
      ? evidence.kind === "chef_planning"
        ? "chef_equipe"
        : "brancardier"
      : "visiteur",
  };
}
async function list() {
  const [{ data, error }, roles] = await Promise.all([
    db
      .from("stip_public_access_requests")
      .select(
        "id,first_name,last_name,status,created_at,reviewed_at,decision_note,requested_access,reason,metadata",
      )
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: true })
      .limit(150),
    rolePresets(),
  ]);
  if (error) throw error;
  const items = [];
  for (const r of data || []) {
    const c = await classifyRequest(r),
      resolved =
        r.status === "approved" &&
        r.metadata?.subject_kind === "agent" &&
        c.evidence?.planning_match;
    if (r.status === "pending" || !resolved)
      items.push({
        ...r,
        comment: r.reason || r.metadata?.comment || "",
        requested_code: r.metadata?.requested_code || "",
        matched_agent: c.agent,
        evidence: c.evidence,
        recommended_role: c.recommended_role,
        unresolved: r.status === "approved" && !resolved,
      });
  }
  const { data: profiles, error: pe } = await db
    .from("stip_access_profiles")
    .select(
      "id,agent_id,role_key,active,agents(id,nom,prenom,source_key,equipe,type_planning,role,actif)",
    )
    .eq("active", true)
    .in("role_key", ["brancardier", "chef_equipe"]);
  if (pe) throw pe;
  const security_items = [];
  for (const profile of profiles || []) {
    const agent = Array.isArray(profile.agents)
      ? profile.agents[0]
      : profile.agents;
    if (!agent) continue;
    const evidence = await evidenceForAgent(agent, profile.role_key);
    if (evidence.checkable && !evidence.planning_match)
      security_items.push({
        profile_id: profile.id,
        agent,
        evidence,
        role_key: profile.role_key,
      });
  }
  return {
    items,
    security_items,
    roles: roles.map((r: any) => ({ key: r.role_key, label: r.label })),
  };
}
async function reject(id: string, p: any, note: string) {
  const { error } = await db
    .from("stip_public_access_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: p.agent_id,
      decision_note: clean(note, 800) || "Accès non ouvert.",
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw error;
  return { ok: true };
}
async function grant(id: string, role: string, p: any, note: string) {
  const permissions = await permissionsForRole(role),
    { data: r } = await db
      .from("stip_public_access_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
  if (!r || r.status !== "pending")
    throw Error("Demande déjà traitée ou introuvable.");
  const code = String(r.metadata?.requested_code || "");
  if (!/^\d{6}$/.test(code))
    throw Error("Le code demandé est manquant ou invalide.");
  const c = await classifyRequest(r),
    agent = c.agent,
    evidence = c.evidence;
  if (
    agent &&
    ["brancardier", "chef_equipe"].includes(role) &&
    evidence.checkable &&
    !evidence.planning_match
  )
    throw Error(
      "Accès opérationnel bloqué : personne absente du planning actuel.",
    );
  if (!agent && ["brancardier", "chef_equipe", "admin"].includes(role))
    throw Error("Cet accès exige une personne reliée à une source réelle.");
  let profile: any, subject: any;
  if (agent) {
    const { data, error } = await db.rpc("stip_set_access", {
      p_agent_id: agent.id,
      p_code: code,
      p_permissions: permissions,
      p_active: true,
      p_updated_by: null,
    });
    if (error) throw error;
    profile = data;
    await db
      .from("stip_access_profiles")
      .update({
        role_key: role,
        permission_overrides: {},
        permissions,
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("agent_id", agent.id);
    subject = { kind: "agent", id: agent.id };
  } else {
    const { data: identity, error: ie } = await db
      .from("stip_access_identities")
      .upsert(
        {
          first_name: r.first_name,
          last_name: r.last_name,
          identity_kind: "external",
          source_request_id: r.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source_request_id" },
      )
      .select("id")
      .single();
    if (ie) throw ie;
    const { data, error } = await db.rpc("stip_set_identity_access", {
      p_identity_id: identity.id,
      p_code: code,
      p_permissions: permissions,
      p_active: true,
      p_updated_by: null,
    });
    if (error) throw error;
    profile = data;
    subject = { kind: "external", id: identity.id };
  }
  const profileId = profile?.id || profile?.profile_id || null,
    meta = {
      ...(r.metadata || {}),
      profile_id: profileId,
      granted_code: code,
      subject_kind: subject.kind,
      subject_id: subject.id,
    };
  await db
    .from("stip_public_access_requests")
    .update({
      status: "approved",
      requested_access: role,
      reviewed_at: new Date().toISOString(),
      reviewed_by: p.agent_id,
      decision_note: clean(note, 800) || "Votre accès STIP est prêt.",
      metadata: meta,
    })
    .eq("id", id);
  return {
    ok: true,
    unresolved: subject.kind !== "agent" || !evidence.planning_match,
  };
}
async function revokeProfile(profileId: string) {
  const { data: profile, error } = await db
    .from("stip_access_profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw Error("Profil introuvable.");
  const now = new Date().toISOString();
  const [{ error: se }, { error: pe }] = await Promise.all([
    db
      .from("stip_access_sessions")
      .update({ revoked_at: now })
      .eq("profile_id", profileId)
      .is("revoked_at", null),
    db
      .from("stip_access_profiles")
      .update({ active: false, updated_at: now })
      .eq("id", profileId),
  ]);
  if (se) throw se;
  if (pe) throw pe;
  return { ok: true };
}
async function link(id: string, agentId: string, p: any) {
  const { data: r, error } = await db
    .from("stip_public_access_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!r || r.status !== "approved")
    throw Error("Demande approuvée introuvable.");
  const { data: agent, error: ae } = await db
    .from("agents")
    .select("id,actif")
    .eq("id", agentId)
    .eq("actif", true)
    .maybeSingle();
  if (ae) throw ae;
  if (!agent) throw Error("Agent actif introuvable.");
  const oldProfileId = String(r.metadata?.profile_id || ""),
    role = String(r.requested_access || "visiteur"),
    permissions = await permissionsForRole(role),
    code = String(r.metadata?.granted_code || r.metadata?.requested_code || "");
  if (!/^\d{6}$/.test(code)) throw Error("Code approuvé introuvable.");
  const { data: profile, error: re } = await db.rpc("stip_set_access", {
    p_agent_id: agent.id,
    p_code: code,
    p_permissions: permissions,
    p_active: true,
    p_updated_by: p.agent_id,
  });
  if (re) throw re;
  const newProfileId = profile?.id || profile?.profile_id || null;
  await db
    .from("stip_access_profiles")
    .update({
      role_key: role,
      permission_overrides: {},
      permissions,
      active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("agent_id", agent.id);
  if (oldProfileId && oldProfileId !== newProfileId)
    await revokeProfile(oldProfileId);
  const metadata = {
    ...(r.metadata || {}),
    profile_id: newProfileId,
    subject_kind: "agent",
    subject_id: agent.id,
    linked_at: new Date().toISOString(),
    linked_by: p.agent_id,
    previous_profile_id: oldProfileId || null,
  };
  const { error: ue } = await db
    .from("stip_public_access_requests")
    .update({ metadata })
    .eq("id", id);
  if (ue) throw ue;
  return { ok: true };
}
async function deleteTrace(id: string, p: any) {
  const { data: r, error } = await db
    .from("stip_public_access_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!r) throw Error("Demande introuvable.");
  const profileId = String(r.metadata?.profile_id || "");
  if (profileId) await revokeProfile(profileId);
  const metadata = {
    ...(r.metadata || {}),
    deleted_at: new Date().toISOString(),
    deleted_by: p.agent_id,
    previous_profile_id: profileId || null,
  };
  delete metadata.granted_code;
  delete metadata.requested_code;
  const { error: ue } = await db
    .from("stip_public_access_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: p.agent_id,
      decision_note: "Accès révoqué — trace d’audit conservée.",
      metadata,
    })
    .eq("id", id);
  if (ue) throw ue;
  return { ok: true };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: C });
  try {
    const p = await adminCtx(req),
      b = await req.json(),
      a = String(b.action || "");
    if (a === "list") return J(await list());
    if (a === "reject")
      return J(
        await reject(
          String(b.request_id || ""),
          p,
          String(b.decision_note || ""),
        ),
      );
    if (a === "grant")
      return J(
        await grant(
          String(b.request_id || ""),
          String(b.role_key || "visiteur"),
          p,
          String(b.decision_note || ""),
        ),
      );
    if (a === "link")
      return J(
        await link(String(b.request_id || ""), String(b.agent_id || ""), p),
      );
    if (a === "delete_trace")
      return J(await deleteTrace(String(b.request_id || ""), p));
    if (a === "revoke_profile")
      return J(await revokeProfile(String(b.profile_id || "")));
    return J({ error: "Action invalide." }, 400);
  } catch (e) {
    return J({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
