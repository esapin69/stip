import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-stip-session",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const J = (x: any, s = 200) =>
  new Response(JSON.stringify(x), {
    status: s,
    headers: {
      ...H,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const hex = (a: ArrayBuffer) =>
  [...new Uint8Array(a)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha(s: string) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  );
}

async function ctx(r: Request) {
  const t = r.headers.get("x-stip-session") || "";
  if (!t) throw Error("Session requise");
  const { data: s } = await db
    .from("stip_access_sessions")
    .select("profile_id,expires_at,revoked_at")
    .eq("token_hash", await sha(t))
    .maybeSingle();
  if (!s || s.revoked_at || new Date(s.expires_at) <= new Date())
    throw Error("Session expirée");
  const { data: p } = await db
    .from("stip_access_profiles")
    .select("id,agent_id,role_key,permissions,active")
    .eq("id", s.profile_id)
    .maybeSingle();
  if (!p?.active || !(p.role_key === "admin" || p.permissions?.access_manage))
    throw Error("Accès refusé");
  return p;
}

async function catalog() {
  const { data, error } = await db
    .from("stip_app_catalog")
    .select("app_key,label,help,route_key,level_mode,sort_order")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return (data || []).map((a: any) => ({
    ...a,
    key: a.app_key,
    levels: a.level_mode === "visitor_pro",
    pro_only: a.level_mode === "pro_only",
  }));
}
async function presets() {
  const { data, error } = await db
    .from("stip_access_role_presets")
    .select("role_key,label,permissions")
    .order("label");
  if (error) throw error;
  return data || [];
}
async function legacyModels() {
  const { data, error } = await db
    .from("stip_access_profile_models")
    .select("model_key,role_key,level_key,label,permissions")
    .order("role_key")
    .order("level_key");
  if (error) throw error;
  return data || [];
}

function normalizePermissions(raw: any = {}, levels: any = {}, apps: any[]) {
  const out: any = {};
  const normalizedLevels: any = {};
  for (const a of apps) {
    out[a.key] = !!raw[a.key];
    if (!out[a.key]) continue;
    if (a.pro_only) normalizedLevels[a.key] = "pro";
    else if (a.levels)
      normalizedLevels[a.key] =
        String(
          levels[a.key] || raw.__levels?.[a.key] || "visitor",
        ).toLowerCase() === "pro"
          ? "pro"
          : "visitor";
  }
  out.__levels = normalizedLevels;
  return out;
}

async function list(q = "") {
  const [{ data, error }, apps, rolePresets, models] = await Promise.all([
    db
      .from("stip_access_profiles")
      .select(
        "id,agent_id,identity_id,role_key,active,permissions,permission_overrides,access_model_key,agents(id,nom,prenom,ghe,equipe,type_planning)",
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    catalog(),
    presets(),
    legacyModels(),
  ]);
  if (error) throw error;
  const ids = (data || []).map((p: any) => p.id),
    vault: any = {};
  if (ids.length) {
    const { data: v } = await db
      .from("stip_access_code_vault")
      .select("profile_id,code")
      .in("profile_id", ids);
    for (const x of v || []) vault[x.profile_id] = x.code;
  }
  const n = q.trim().toLowerCase();
  return {
    apps,
    presets: rolePresets,
    models,
    legacy_models: models,
    people: (data || [])
      .filter(
        (p: any) =>
          !n ||
          `${p.agents?.prenom || ""} ${p.agents?.nom || ""} ${p.agents?.ghe || ""}`
            .toLowerCase()
            .includes(n),
      )
      .map((p: any) => ({ ...p, current_code: vault[p.id] || null })),
  };
}

async function save(b: any, me: any) {
  const id = String(b.profile_id || ""),
    role = String(b.role_key || "");
  const [{ data: p }, apps, rolePresets] = await Promise.all([
    db
      .from("stip_access_profiles")
      .select("permissions,role_key")
      .eq("id", id)
      .maybeSingle(),
    catalog(),
    presets(),
  ]);
  if (!p) throw Error("Profil introuvable");
  if (role && !rolePresets.some((x: any) => x.role_key === role))
    throw Error("Profil métier invalide");
  const next = normalizePermissions(b.permissions || {}, b.levels || {}, apps);
  const { error } = await db
    .from("stip_access_profiles")
    .update({
      permissions: next,
      permission_overrides: next,
      role_key: role || p.role_key,
      access_model_key: null,
      updated_by: me.agent_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  return { ok: true, permissions: next };
}

async function savePreset(b: any) {
  const role = String(
    b.role_key || String(b.model_key || "").replace(/_(minimum|maximum)$/, ""),
  );
  const [apps, rolePresets] = await Promise.all([catalog(), presets()]);
  if (!rolePresets.some((x: any) => x.role_key === role))
    throw Error("Profil métier invalide");
  const permissions = normalizePermissions(
    b.permissions || {},
    b.levels || {},
    apps,
  );
  permissions.notes =
    role === "admin" || role === "chef_equipe" ? permissions.notes : false;
  permissions.access_manage =
    role === "admin" ? permissions.access_manage : false;
  permissions.admin = role === "admin" ? permissions.admin : false;
  const { error } = await db
    .from("stip_access_role_presets")
    .update({ permissions, updated_at: new Date().toISOString() })
    .eq("role_key", role);
  if (error) throw error;
  return { ok: true, presets: await presets() };
}

async function setCode(b: any, me: any) {
  const id = String(b.profile_id || ""),
    code = String(b.code || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) throw Error("Le code doit contenir 6 chiffres");
  const { data: p } = await db
    .from("stip_access_profiles")
    .select("agent_id,identity_id,permissions,active")
    .eq("id", id)
    .maybeSingle();
  if (!p) throw Error("Profil introuvable");
  const r = p.agent_id
    ? await db.rpc("stip_set_access", {
        p_agent_id: p.agent_id,
        p_code: code,
        p_permissions: p.permissions || {},
        p_active: p.active !== false,
        p_updated_by: me.agent_id,
      })
    : await db.rpc("stip_set_identity_access", {
        p_identity_id: p.identity_id,
        p_code: code,
        p_permissions: p.permissions || {},
        p_active: p.active !== false,
        p_updated_by: me.agent_id,
      });
  if (r.error) throw r.error;
  await db
    .from("stip_access_code_vault")
    .upsert(
      {
        profile_id: id,
        code,
        updated_by: me.agent_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" },
    );
  return { ok: true, code };
}

async function findNew(b: any) {
  const q = String(b.q || "")
    .trim()
    .toLowerCase();
  if (q.length < 2) throw Error("Tape au moins 2 lettres");
  const { data: agents, error } = await db
    .from("agents")
    .select("id,nom,prenom,ghe,equipe,type_planning,actif")
    .eq("actif", true);
  if (error) throw error;
  const found = (agents || [])
    .filter((a: any) =>
      `${a.prenom || ""} ${a.nom || ""} ${a.ghe || ""}`
        .toLowerCase()
        .includes(q),
    )
    .slice(0, 30);
  const ids = found.map((x: any) => x.id);
  let profiles: any[] = [];
  if (ids.length) {
    const r = await db
      .from("stip_access_profiles")
      .select("agent_id")
      .in("agent_id", ids);
    profiles = r.data || [];
  }
  const have = new Set(profiles.map((x: any) => x.agent_id));
  return { candidates: found.filter((x: any) => !have.has(x.id)) };
}

async function createAccess(b: any, me: any) {
  const agent = String(b.agent_id || ""),
    code = String(b.code || "").replace(/\D/g, ""),
    role = String(
      b.role_key ||
        String(b.model_key || "brancardier").replace(/_(minimum|maximum)$/, ""),
    );
  if (!agent || !/^\d{6}$/.test(code))
    throw Error("Agent et code à 6 chiffres requis");
  const [apps, rolePresets] = await Promise.all([catalog(), presets()]);
  const preset = rolePresets.find((x: any) => x.role_key === role);
  if (!preset) throw Error("Profil métier invalide");
  const { data: a } = await db
    .from("agents")
    .select("id,nom,prenom")
    .eq("id", agent)
    .eq("actif", true)
    .maybeSingle();
  if (!a) throw Error("Agent introuvable");
  const perms = normalizePermissions(
    preset.permissions || {},
    preset.permissions?.__levels || {},
    apps,
  );
  perms.notes =
    role === "admin" || role === "chef_equipe" ? perms.notes : false;
  perms.access_manage = role === "admin" ? perms.access_manage : false;
  perms.admin = role === "admin" ? perms.admin : false;
  const r = await db.rpc("stip_set_access", {
    p_agent_id: agent,
    p_code: code,
    p_permissions: perms,
    p_active: true,
    p_updated_by: me.agent_id,
  });
  if (r.error) throw r.error;
  const { data: p } = await db
    .from("stip_access_profiles")
    .select("id")
    .eq("agent_id", agent)
    .maybeSingle();
  if (p) {
    await db
      .from("stip_access_profiles")
      .update({
        role_key: role,
        access_model_key: null,
        permissions: perms,
        permission_overrides: perms,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    await db
      .from("stip_access_code_vault")
      .upsert(
        {
          profile_id: p.id,
          code,
          updated_by: me.agent_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      );
  }
  return { ok: true, agent: a, permissions: perms };
}

Deno.serve(async (r) => {
  if (r.method === "OPTIONS") return new Response("ok", { headers: H });
  try {
    const me = await ctx(r),
      b = await r.json().catch(() => ({}));
    if (b.action === "list") return J(await list(String(b.q || "")));
    if (b.action === "save") return J(await save(b, me));
    if (b.action === "save_preset" || b.action === "save_model")
      return J(await savePreset(b));
    if (b.action === "set_code") return J(await setCode(b, me));
    if (b.action === "find_new") return J(await findNew(b));
    if (b.action === "create_access") return J(await createAccess(b, me));
    return J({ error: "Action invalide" }, 400);
  } catch (e) {
    return J({ error: e instanceof Error ? e.message : String(e) }, 403);
  }
});
