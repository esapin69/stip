import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const TRAINEE_DEFAULT_AVATAR = "https://drive.google.com/thumbnail?id=1OrU6Sl01mfmYYJgQxG40diKhsj_Yx0-Y&sz=w512";
const C = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-stip-session, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...C,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const URL = Deno.env.get("SUPABASE_URL")!,
  ANON = Deno.env.get("SUPABASE_ANON_KEY")!,
  SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const LABELS: any = {
  visiteur: "Visiteur",
  stagiaire: "Stagiaire",
  brancardier: "Brancardier",
  chef_equipe: "Chef d’équipe brancardier",
  responsable: "Responsable",
  cadre: "Cadre",
  admin: "Admin",
};
const FALLBACK: any = {
  visiteur: {},
  stagiaire: {
    planning_personal: true,
    messages: true,
    places: true,
    team_chat_mode: "write",
    trainee_session: true,
    __levels: { planning_personal: "visitor", places: "visitor" },
  },
  brancardier: {
    planning_personal: true,
    planning_team: true,
    change_app: true,
    calendar_subscribe: true,
    contacts: true,
    nouveaux_arrivants: true,
    activity: true,
    places: true,
    assistant_enabled: true,
    profile_photo: true,
  },
  chef_equipe: {
    planning_personal: true,
    planning_team: true,
    change_app: true,
    calendar_subscribe: true,
    contacts: true,
    responsable: true,
    nouveaux_arrivants: true,
    activity: true,
    places: true,
    assistant_enabled: true,
    profile_photo: true,
  },
  responsable: {
    contacts: true,
    responsable: true,
    nouveaux_arrivants: true,
    activity: true,
    places: true,
    assistant_enabled: true,
    profile_photo: true,
  },
  cadre: {
    contacts: true,
    responsable: true,
    nouveaux_arrivants: true,
    activity: true,
    places: true,
    assistant_enabled: true,
    profile_photo: true,
  },
  admin: {
    planning_personal: true,
    planning_team: true,
    change_app: true,
    calendar_subscribe: true,
    agent_dates: true,
    contacts: true,
    responsable: true,
    notes: true,
    nouveaux_arrivants: true,
    file_upload: true,
    activity: true,
    admin: true,
    places: true,
    assistant_enabled: true,
    access_manage: true,
    profile_photo: true,
  },
};
const DEFS = [
  ["planning_personal", "Planning perso"],
  ["planning_team", "Planning équipe"],
  ["agent_directory", "Agents"],
  ["change_app", "Changement"],
  ["calendar_subscribe", "Mon agenda"],
  ["agent_dates", "Date des agents"],
  ["contacts", "Contacts"],
  ["responsable", "Responsable"],
  ["notes", "Prendre des notes"],
  ["nouveaux_arrivants", "Nouvel agent"],
  ["file_upload", "Importer"],
  ["activity", "Activité"],
  ["admin", "Admin"],
  ["places", "Visiter les lieux"],
  ["assistant_enabled", "Assistant STIP"],
  ["access_manage", "Accès"],
  ["profile_photo", "Modifier sa photo"],
].map(([key, title]) => ({
  key,
  group: key === "profile_photo" ? "action" : "app",
  title,
  small: "",
}));
const PAGE_LABELS: Record<string, string> = {
  home: "Accueil",
  planning_personal: "Planning perso",
  tomorrow: "Pour demain",
  team: "Esprit d’équipe",
  activity: "Activité",
  agent_directory: "Équipe",
  planning_compare: "Comparer les plannings",
  change: "Changement",
  calendar: "Synchroniser mon calendrier",
  agent_dates: "Date des agents",
  contacts: "Contacts",
  responsable: "Responsable",
  notifications: "Notifications",
  messages: "Fauteuils",
  places: "Visiter les lieux",
  assistant: "Assistant STIP",
  access: "Accès",
  profile: "Mon compte",
};
const hex = (a: ArrayBuffer) =>
  [...new Uint8Array(a)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256(s: string) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  );
}
function randomToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function roleKey(v: any) {
  return LABELS[v] ? String(v) : "brancardier";
}
function authoritative(
  role: string,
  stored: any,
  over: any = {},
  preset: any = {},
) {
  const has =
    stored && typeof stored === "object" && Object.keys(stored).length > 0;
  const p: any = has
    ? { ...stored }
    : Object.keys(preset || {}).length
      ? { ...preset }
      : { ...(FALLBACK[roleKey(role)] || {}) };
  for (const [k, v] of Object.entries(over || {})) {
    if (typeof v === "boolean" && p[k] === undefined) p[k] = v;
  }
  if (p.planning === undefined)
    p.planning = !!(p.planning_personal || p.planning_team);
  if (p.equipe_contacts === undefined) p.equipe_contacts = !!p.contacts;
  if (p.calendriers === undefined) p.calendriers = !!p.calendar_subscribe;
  return p;
}
async function appCatalog() {
  const { data, error } = await admin
    .from("stip_app_catalog")
    .select("app_key,label,help,route_key,level_mode,sort_order")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return (data || []).map((a: any) => ({
    ...a,
    key: a.app_key,
    title: a.label,
    levels: a.level_mode === "visitor_pro",
    pro_only: a.level_mode === "pro_only",
  }));
}
async function rolePresets() {
  const { data, error } = await admin
    .from("stip_access_role_presets")
    .select("role_key,label,permissions")
    .order("role_key");
  if (error) throw error;
  return data || [];
}
function lv(v: any) {
  v = String(v || "").toLowerCase();
  if (v === "pro" || v === "admin" || v === "internal" || v === "restricted")
    return "pro";
  if (v === "visitor" || v === "visiteur" || v === "basic" || v === "public")
    return "basic";
  return "none";
}
function depthPayload(p: any, over: any = {}) {
  const l = p?.__levels || {},
    planning = [l.planning_personal, l.planning_team].map(lv);
  const d: any = {
    planning: planning.includes("pro")
      ? "pro"
      : planning.includes("basic")
        ? "basic"
        : "none",
    contacts: lv(l.contacts),
    responsable: lv(l.responsable),
    assistant: lv(l.assistant_enabled),
    activity: lv(l.activity),
    places: lv(l.places),
    change_app: lv(l.change_app),
    calendar_subscribe: lv(l.calendar_subscribe),
    nouveaux_arrivants: lv(l.nouveaux_arrivants),
    equipe: "none",
  };
  for (const [k, v] of Object.entries(over || {}))
    if (k.startsWith("depth_")) d[k.slice(6)] = lv(v);
  return d;
}
async function signedAvatarUrl(raw: any) {
  const value = String(raw || "");
  if (!value) return null;
  const marker = "/storage/v1/object/public/planning-pdf/";
  if (!value.includes(marker)) return value;
  const path = value.split(marker)[1]?.split("?")[0] || "";
  if (!path) return value;
  const { data, error } = await admin.storage
    .from("planning-pdf")
    .createSignedUrl(decodeURIComponent(path), 3600);
  return error || !data?.signedUrl ? value : data.signedUrl;
}
async function withSignedAvatar(a: any) {
  return a ? { ...a, avatar_url: await signedAvatarUrl(a.avatar_url) } : a;
}
function identityAgent(i: any) {
  return i
    ? {
        id: i.id,
        source_key: `access-identity:${i.id}`,
        nom: i.last_name,
        prenom: i.first_name,
        equipe: null,
        ghe: null,
        role: i.professional_role || i.identity_kind,
        avatar_url: TRAINEE_DEFAULT_AVATAR,
        profile_photo_url: TRAINEE_DEFAULT_AVATAR,
        identity_kind: i.identity_kind,
      }
    : null;
}
function parisDay(offset = 0) {
  const d = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function traineeKey(row: any) {
  const source = String(row?.source_key || "").trim();
  const match = source.match(/^stagiaire:([^:]+)(?::\d{4}-\d{2}-\d{2})?$/i);
  if (match?.[1]) return match[1];
  return [row?.nom, row?.prenom]
    .filter(Boolean)
    .join("_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function traineeAgent(item: any) {
  return item
    ? {
        id: `stagiaire:${item.key}`,
        source_key: `stagiaire:${item.key}`,
        nom: item.nom,
        prenom: item.prenom,
        equipe: "stage",
        type_planning: "stagiaire",
        ghe: null,
        role: "Stagiaire",
        avatar_url: null,
        profile_photo_url: null,
        identity_kind: "stagiaire",
        trainee_key: item.key,
      }
    : null;
}
async function traineeGroups() {
  const from = parisDay(-30), to = parisDay(180);
  const { data, error } = await admin
    .from("stagiaires")
    .select("id,source_key,nom,prenom,date_debut,date_fin,horaires,referent")
    .gte("date_fin", from)
    .lte("date_debut", to)
    .order("date_debut");
  if (error) throw error;
  const groups = new Map<string, any>();
  for (const row of data || []) {
    const key = traineeKey(row);
    if (!key) continue;
    const existing = groups.get(key) || {
      key,
      nom: row.nom,
      prenom: row.prenom,
      first_date: row.date_debut,
      last_date: row.date_fin || row.date_debut,
      days: 0,
    };
    existing.first_date =
      !existing.first_date || String(row.date_debut) < String(existing.first_date)
        ? row.date_debut
        : existing.first_date;
    existing.last_date =
      String(row.date_fin || row.date_debut) > String(existing.last_date || "")
        ? row.date_fin || row.date_debut
        : existing.last_date;
    existing.days += 1;
    groups.set(key, existing);
  }
  return [...groups.values()]
    .map((x) => ({
      ...x,
      id: `stagiaire:${x.key}`,
      source_key: `stagiaire:${x.key}`,
      role: "Stagiaire",
      ghe: "Stage",
      avatar_url: TRAINEE_DEFAULT_AVATAR,
      profile_photo_url: TRAINEE_DEFAULT_AVATAR,
      active_now:
        String(x.first_date || "") <= parisDay() &&
        String(x.last_date || "") >= parisDay(),
    }))
    .sort((a, b) =>
      Number(b.active_now) - Number(a.active_now) ||
      String(a.prenom || "").localeCompare(String(b.prenom || ""), "fr") ||
      String(a.nom || "").localeCompare(String(b.nom || ""), "fr")
    );
}
async function traineeByKey(key: string) {
  const clean = String(key || "").trim();
  if (!clean) return null;
  return (await traineeGroups()).find((x: any) => x.key === clean) || null;
}
async function profilePayload(id: string) {
  const { data, error } = await admin
    .from("stip_access_profiles")
    .select(
      "id,agent_id,identity_id,active,role_key,permission_overrides,permissions,updated_at,agents(id,source_key,nom,prenom,equipe,ghe,role,avatar_url,profile_photo_url),stip_access_identities(id,first_name,last_name,professional_role,identity_kind)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.active) return null;
  const role = roleKey(data.role_key),
    over = data.permission_overrides || {},
    presets = await rolePresets(),
    preset = presets.find((x: any) => x.role_key === role)?.permissions || {},
    permissions = authoritative(role, data.permissions, over, preset),
    agent = data.agents
      ? await withSignedAvatar(data.agents)
      : identityAgent(data.stip_access_identities),
    catalog = await appCatalog();
  return {
    profile_id: data.id,
    agent_id: data.agent_id,
    identity_id: data.identity_id,
    subject_kind: data.agent_id
      ? "agent"
      : data.stip_access_identities?.identity_kind || "external",
    role_key: role,
    role_label: LABELS[role],
    permissions,
    depths: depthPayload(permissions, over),
    overrides: over,
    modules: catalog,
    app_catalog: catalog,
    agent,
    updated_at: data.updated_at,
    trainee_selection_required: role === "stagiaire",
  };
}
async function sessionFrom(req: Request) {
  const token = req.headers.get("x-stip-session") || "";
  if (!token) return null;
  const hash = await sha256(token);
  const { data, error } = await admin
    .from("stip_access_sessions")
    .select("id,profile_id,expires_at,revoked_at,selected_stagiaire_key")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at || new Date(data.expires_at) <= new Date())
    return null;
  const p: any = await profilePayload(data.profile_id);
  if (!p) return null;
  let trainee: any = null;
  if (p.role_key === "stagiaire" && data.selected_stagiaire_key)
    trainee = await traineeByKey(String(data.selected_stagiaire_key));
  await admin
    .from("stip_access_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);
  return {
    session_id: data.id,
    ...p,
    ...(p.role_key === "stagiaire"
      ? {
          trainee_key: trainee?.key || null,
          trainee,
          agent: trainee ? traineeAgent(trainee) : p.agent,
          trainee_selection_required: !trainee,
        }
      : {}),
  };
}
async function traineeList(req: Request) {
  const s: any = await sessionFrom(req);
  if (!s) return J({ error: "Session expirée." }, 401);
  if (s.role_key !== "stagiaire")
    return J({ error: "Accès Stagiaire requis." }, 403);
  return J({ items: await traineeGroups(), selected_key: s.trainee_key || null });
}
async function traineeSelect(req: Request, body: any) {
  const token = req.headers.get("x-stip-session") || "";
  if (!token) return J({ error: "Session expirée." }, 401);
  const hash = await sha256(token);
  const { data: raw, error } = await admin
    .from("stip_access_sessions")
    .select("id,profile_id,expires_at,revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) throw error;
  if (!raw || raw.revoked_at || new Date(raw.expires_at) <= new Date())
    return J({ error: "Session expirée." }, 401);
  const profile: any = await profilePayload(raw.profile_id);
  if (!profile || profile.role_key !== "stagiaire")
    return J({ error: "Accès Stagiaire requis." }, 403);
  const key = String(body.trainee_key || "").trim();
  const trainee = await traineeByKey(key);
  if (!trainee) return J({ error: "Stagiaire introuvable." }, 404);
  const { error: updateError } = await admin
    .from("stip_access_sessions")
    .update({ selected_stagiaire_key: trainee.key, last_seen_at: new Date().toISOString() })
    .eq("id", raw.id);
  if (updateError) throw updateError;
  const fresh: any = await sessionFrom(req);
  return fresh ? J(fresh) : J({ error: "Session expirée." }, 401);
}
async function activitySessionFrom(req: Request) {
  const token = req.headers.get("x-stip-session") || "";
  if (!token) return null;
  const hash = await sha256(token);
  const { data: session, error } = await admin
    .from("stip_access_sessions")
    .select("id,profile_id,expires_at,revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) throw error;
  if (
    !session ||
    session.revoked_at ||
    new Date(session.expires_at) <= new Date()
  )
    return null;
  const { data: profile, error: pe } = await admin
    .from("stip_access_profiles")
    .select("id,active")
    .eq("id", session.profile_id)
    .maybeSingle();
  if (pe) throw pe;
  if (!profile?.active) return null;
  await admin
    .from("stip_access_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id);
  return { session_id: session.id, profile_id: session.profile_id };
}
async function trackActivity(req: Request, body: any) {
  const s = await activitySessionFrom(req);
  if (!s) return J({ error: "Session expirée." }, 401);
  const pageKey = String(body.page_key || "")
    .trim()
    .toLowerCase();
  if (!PAGE_LABELS[pageKey])
    return J({ error: "Module inconnu." }, 400);
  const { error } = await admin.from("stip_access_activity").insert({
    profile_id: s.profile_id,
    session_id: s.session_id,
    page_key: pageKey,
  });
  if (error) throw error;
  return J({ ok: true });
}
function ipOf(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for") ||
    "unknown"
  )
    .split(",")[0]
    .trim();
}
async function login(req: Request, code: string) {
  if (!/^\d{6}$/.test(code || "")) return J({ error: "Code invalide." }, 401);
  const ipHash = await sha256(ipOf(req)),
    ten = new Date(Date.now() - 600000).toISOString();
  await admin
    .from("stip_access_attempts")
    .delete()
    .lt("attempted_at", new Date(Date.now() - 86400000).toISOString());
  const { count } = await admin
    .from("stip_access_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("success", false)
    .gte("attempted_at", ten);
  if ((count || 0) >= 5)
    return J(
      { error: "Trop de tentatives. Réessaie dans quelques minutes." },
      429,
    );
  const { data, error } = await admin.rpc("stip_verify_code", { p_code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    await admin
      .from("stip_access_attempts")
      .insert({ ip_hash: ipHash, success: false });
    return J({ error: "Code inconnu ou désactivé." }, 401);
  }
  await admin
    .from("stip_access_attempts")
    .insert({ ip_hash: ipHash, success: true });
  const token = randomToken(),
    hash = await sha256(token),
    expires = new Date(Date.now() + 30 * 86400000).toISOString();
  const { error: se } = await admin
    .from("stip_access_sessions")
    .insert({
      profile_id: row.profile_id,
      token_hash: hash,
      expires_at: expires,
    });
  if (se) throw se;
  return J({
    session_token: token,
    expires_at: expires,
    ...(await profilePayload(row.profile_id)),
  });
}
async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer "))
    throw Error("Connexion administrateur requise.");
  const c = createClient(URL, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await c.auth.getUser();
  if (error || !data.user?.email)
    throw Error("Session administrateur invalide.");
  const { data: ok, error: e } = await admin
    .from("admin_ghe_users")
    .select("email")
    .eq("email", data.user.email.toLowerCase())
    .eq("active", true)
    .maybeSingle();
  if (e) throw e;
  if (!ok) throw Error("Compte administrateur non autorisé.");
  return data.user;
}
async function adminList() {
  const [aq, pq, vq, iq, presets, catalog] = await Promise.all([
    admin
      .from("agents")
      .select(
        "id,source_key,nom,prenom,equipe,ghe,role,actif,avatar_url,profile_photo_url",
      )
      .eq("actif", true)
      .order("nom"),
    admin
      .from("stip_access_profiles")
      .select(
        "id,agent_id,identity_id,active,role_key,permission_overrides,permissions,updated_at",
      ),
    admin.from("stip_access_code_vault").select("profile_id,code"),
    admin
      .from("stip_access_identities")
      .select("id,first_name,last_name,professional_role,identity_kind")
      .order("last_name"),
    rolePresets(),
    appCatalog(),
  ]);
  for (const q of [aq, pq, vq, iq]) if (q.error) throw q.error;
  const presetByRole = new Map(
      presets.map((x: any) => [x.role_key, x.permissions || {}]),
    ),
    byAgent = new Map(
      (pq.data || [])
        .filter((p: any) => p.agent_id)
        .map((p: any) => [p.agent_id, p]),
    ),
    byIdentity = new Map(
      (pq.data || [])
        .filter((p: any) => p.identity_id)
        .map((p: any) => [p.identity_id, p]),
    ),
    codes = new Map((vq.data || []).map((v: any) => [v.profile_id, v.code])),
    items: any[] = [];
  for (const a of aq.data || []) {
    const p: any = byAgent.get(a.id);
    if (!p) {
      items.push({ agent: await withSignedAvatar(a), access: null });
      continue;
    }
    const role = roleKey(p.role_key),
      permissions = authoritative(
        role,
        p.permissions,
        p.permission_overrides,
        presetByRole.get(role),
      );
    items.push({
      agent: await withSignedAvatar(a),
      access: {
        ...p,
        role_key: role,
        permissions,
        depths: depthPayload(permissions, p.permission_overrides),
        overrides: p.permission_overrides || {},
        display_code: codes.get(p.id) || null,
        subject_kind: "agent",
      },
    });
  }
  for (const i of iq.data || []) {
    const p: any = byIdentity.get(i.id);
    if (!p) continue;
    const role = roleKey(p.role_key),
      permissions = authoritative(
        role,
        p.permissions,
        p.permission_overrides,
        presetByRole.get(role),
      );
    items.push({
      agent: identityAgent(i),
      access: {
        ...p,
        role_key: role,
        permissions,
        depths: depthPayload(permissions, p.permission_overrides),
        overrides: p.permission_overrides || {},
        display_code: codes.get(p.id) || null,
        subject_kind: i.identity_kind,
      },
    });
  }
  return {
    items,
    permission_defs: catalog,
    app_catalog: catalog,
    role_defs: presets.map((x: any) => ({
      key: x.role_key,
      label: x.label || LABELS[x.role_key] || x.role_key,
      base_permissions: x.permissions || {},
      base_depths: depthPayload(x.permissions || {}),
    })),
  };
}
async function adminSave(body: any, user: any) {
  const agentId = String(body.agent_id || ""),
    identityId = String(body.identity_id || ""),
    profileIdInput = String(body.profile_id || ""),
    active = body.active !== false,
    role = roleKey(body.role_key),
    requested = body.permissions || {},
    levels = body.levels || body.depths || {},
    code = String(body.code || "")
      .replace(/\D/g, "")
      .slice(0, 6);
  if (!agentId && !identityId && !profileIdInput)
    throw Error("Profil manquant.");
  let existing: any = null;
  if (profileIdInput) {
    const r = await admin
      .from("stip_access_profiles")
      .select("id,agent_id,identity_id,permissions")
      .eq("id", profileIdInput)
      .maybeSingle();
    if (r.error) throw r.error;
    existing = r.data;
  } else if (agentId) {
    const r = await admin
      .from("stip_access_profiles")
      .select("id,agent_id,identity_id,permissions")
      .eq("agent_id", agentId)
      .maybeSingle();
    if (r.error) throw r.error;
    existing = r.data;
  } else {
    const r = await admin
      .from("stip_access_profiles")
      .select("id,agent_id,identity_id,permissions")
      .eq("identity_id", identityId)
      .maybeSingle();
    if (r.error) throw r.error;
    existing = r.data;
  }
  const merged: any = { ...(existing?.permissions || {}), ...requested };
  if (Object.keys(levels).length) {
    merged.__levels = { ...(merged.__levels || {}) };
    for (const [k, v] of Object.entries(levels))
      if (
        ["visitor", "visiteur", "basic", "pro"].includes(
          String(v).toLowerCase(),
        )
      )
        merged.__levels[k] =
          String(v).toLowerCase() === "basic"
            ? "visitor"
            : String(v).toLowerCase() === "visiteur"
              ? "visitor"
              : String(v).toLowerCase();
  }
  let profileId = existing?.id,
    subjectAgent = existing?.agent_id || agentId,
    subjectIdentity = existing?.identity_id || identityId;
  if (!existing) {
    if (!/^\d{6}$/.test(code)) throw Error("Choisis un code à 6 chiffres.");
    const r = subjectIdentity
      ? await admin.rpc("stip_set_identity_access", {
          p_identity_id: subjectIdentity,
          p_code: code,
          p_permissions: merged,
          p_active: active,
          p_updated_by: user.id,
        })
      : await admin.rpc("stip_set_access", {
          p_agent_id: subjectAgent,
          p_code: code,
          p_permissions: merged,
          p_active: active,
          p_updated_by: user.id,
        });
    if (r.error) throw r.error;
    profileId = r.data?.id || r.data?.profile_id;
  } else if (code) {
    const r = subjectIdentity
      ? await admin.rpc("stip_set_identity_access", {
          p_identity_id: subjectIdentity,
          p_code: code,
          p_permissions: merged,
          p_active: active,
          p_updated_by: user.id,
        })
      : await admin.rpc("stip_set_access", {
          p_agent_id: subjectAgent,
          p_code: code,
          p_permissions: merged,
          p_active: active,
          p_updated_by: user.id,
        });
    if (r.error) throw r.error;
    profileId = r.data?.id || r.data?.profile_id || profileId;
  }
  const { error: ue } = await admin
    .from("stip_access_profiles")
    .update({
      role_key: role,
      permissions: merged,
      permission_overrides: merged,
      active,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);
  if (ue) throw ue;
  return {
    ok: true,
    role_key: role,
    permissions: merged,
    depths: depthPayload(merged),
    code_changed: !!code,
  };
}
function decodeBase64(s: string) {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
async function setProfilePhoto(req: Request, body: any) {
  const s: any = await sessionFrom(req);
  if (!s) return J({ error: "Session expirée." }, 401);
  if (!s.agent_id) return J({ error: "Photo réservée aux agents STIP." }, 403);
  if (!s.permissions?.profile_photo)
    return J({ error: "Modification de la photo non autorisée." }, 403);
  const base64 = String(body.base64 || "").replace(
    /^data:image\/webp;base64,/,
    "",
  );
  if (!base64) throw Error("Photo manquante.");
  const bytes = decodeBase64(base64);
  if (bytes.length > 350000) throw Error("Photo trop volumineuse.");
  const path = `profile-photos/${s.agent_id}.webp`;
  const { error } = await admin.storage
    .from("stip-public-assets")
    .upload(path, bytes, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "300",
    });
  if (error) throw error;
  const { data } = admin.storage.from("stip-public-assets").getPublicUrl(path),
    url = `${data.publicUrl}?v=${Date.now()}`;
  const { error: ue } = await admin
    .from("agents")
    .update({ profile_photo_url: url, updated_at: new Date().toISOString() })
    .eq("id", s.agent_id);
  if (ue) throw ue;
  return J({ ok: true, profile_photo_url: url });
}
async function deleteProfilePhoto(req: Request) {
  const s: any = await sessionFrom(req);
  if (!s) return J({ error: "Session expirée." }, 401);
  if (!s.agent_id) return J({ error: "Photo réservée aux agents STIP." }, 403);
  if (!s.permissions?.profile_photo)
    return J({ error: "Modification de la photo non autorisée." }, 403);
  await admin.storage
    .from("stip-public-assets")
    .remove([`profile-photos/${s.agent_id}.webp`]);
  const { error } = await admin
    .from("agents")
    .update({ profile_photo_url: null, updated_at: new Date().toISOString() })
    .eq("id", s.agent_id);
  if (error) throw error;
  return J({ ok: true, profile_photo_url: null });
}
async function listRequests() {
  const { data, error } = await admin
    .from("stip_change_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: C });
  if (req.method !== "POST") return J({ error: "Méthode non autorisée." }, 405);
  try {
    const body = await req.json().catch(() => ({})),
      action = String(body.action || "");
    if (action === "login") return await login(req, String(body.code || ""));
    if (action === "me") {
      const s = await sessionFrom(req);
      return s ? J(s) : J({ error: "Session expirée." }, 401);
    }
    if (action === "trainee_list") return await traineeList(req);
    if (action === "trainee_select") return await traineeSelect(req, body);
    if (action === "activity") return await trackActivity(req, body);
    if (action === "logout") {
      const s = await sessionFrom(req);
      if (s)
        await admin
          .from("stip_access_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", s.session_id);
      return J({ ok: true });
    }
    if (action === "profile_photo_set") return await setProfilePhoto(req, body);
    if (action === "profile_photo_delete") return await deleteProfilePhoto(req);
    if (action === "responsable_list_requests") {
      const s: any = await sessionFrom(req);
      if (!s?.permissions?.responsable)
        return J({ error: "Accès Responsable non autorisé." }, 403);
      return J({ items: await listRequests() });
    }
    const user = await requireAdmin(req);
    if (action === "admin_list") return J(await adminList());
    if (action === "admin_save") return J(await adminSave(body, user));
    if (action === "admin_list_requests")
      return J({ items: await listRequests() });
    return J({ error: "Action invalide." }, 400);
  } catch (e) {
    console.error(e);
    return J({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
