import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const BASE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Cache-Control": "no-store"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8" }
  });
}

function textResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "text/markdown; charset=utf-8" }
  });
}

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function scrub(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/sk-[A-Za-z0-9_-]{16,}/g, "[SECRET_MASQUÉ]")
      .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[JETON_MASQUÉ]");
  }
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrub(v)]));
  }
  return value;
}

async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("Connexion administrateur requise.");
  const client = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email) throw new Error("Session administrateur invalide.");
  const email = data.user.email.toLowerCase();
  const { data: row, error: e } = await db.from("admin_ghe_users")
    .select("email").eq("email", email).eq("active", true).maybeSingle();
  if (e) throw e;
  if (!row) throw new Error("Compte administrateur non autorisé.");
  return email;
}

function formatItem(x: any, i: number) {
  if (typeof x === "string") return `${i + 1}. ${x}`;
  const label = x?.label || x?.type || x?.kind || `Élément ${i + 1}`;
  const value = x?.value || x?.path || x?.url || x?.ref || x?.name || JSON.stringify(x);
  return `${i + 1}. ${label} : ${value}`;
}

function buildMarkdown(payload: any) {
  const c = payload.case;
  const source = payload.source;
  const facts = Array.isArray(c.facts) ? c.facts.map(formatItem).join("\n") : "Aucun fait structuré.";
  const metrics = Object.entries(c.metrics || {}).map(([k, v]) => `- ${k} : ${String(v)}`).join("\n") || "Aucune mesure.";
  const evidence = Array.isArray(c.evidence) ? c.evidence.map(formatItem).join("\n") : "Aucune preuve structurée.";
  const uncertainties = Array.isArray(c.uncertainties) ? c.uncertainties.map(formatItem).join("\n") : "Aucune incertitude déclarée.";
  const plan = Array.isArray(c.proposed_plan) ? c.proposed_plan.map(formatItem).join("\n") : "Aucun plan détaillé.";
  const prompts = Array.isArray(payload.prompts) ? payload.prompts : [];

  return [
    "# DOSSIER DE CONTRE-VÉRIFICATION — ADMIN eSapin",
    "",
    "## Consigne générale",
    "Tu travailles pour le patron du projet. Le moteur a préparé une proposition, mais tu dois chercher activement ce qui pourrait la contredire.",
    "Tu peux utiliser les connecteurs déjà disponibles dans le compte ChatGPT (GitHub, Supabase, Vercel, Google Drive) pour contre-vérifier les preuves si nécessaire.",
    "Ne modifie, ne supprime et ne déploie rien : ton rôle ici est uniquement de vérifier et de rendre une recommandation factuelle.",
    "",
    "## Source",
    `${source?.label || c.source_key || "Source"} — ${source?.locator || ""}`,
    "",
    "## Question au patron",
    c.question || c.title,
    "",
    "## Contexte",
    c.context_text || "Aucun contexte supplémentaire.",
    "",
    "## Faits observés",
    facts,
    "",
    "## Mesures",
    metrics,
    "",
    "## Preuves",
    evidence,
    "",
    "## Incertitudes",
    uncertainties,
    "",
    "## Action proposée par le moteur",
    c.proposed_action || "Aucune action proposée.",
    "",
    "## Plan prévu si le patron valide",
    plan,
    "",
    "## Niveau de preuve du moteur",
    `${c.evidence_score || 0}/100`,
    "",
    "## Séquence de contre-vérification",
    ...prompts.flatMap((p: any, i: number) => [
      `### ${p.title || `Étape ${i + 1}`}`,
      String(p.text || p),
      ""
    ]),
    "## Réponse finale obligatoire",
    "Rends à la fin un bloc court, directement copiable dans Admin eSapin :",
    "",
    "DÉCISION PROPOSÉE : VALIDER | MODIFIER | REFUSER | SUPPRIMER",
    "MOTIF FACTUEL : ...",
    "MODIFICATION DEMANDÉE : ...",
    "POINT À NE PAS CASSER : ...",
    "PREUVE MANQUANTE : ...",
    "NIVEAU DE CERTITUDE : .../100"
  ].join("\n");
}

const DEFAULT_PROMPTS = [
  {
    title: "1 · Vérifier les faits",
    text: "Contrôle uniquement ce qui est démontré. Sépare FAIT, DÉDUCTION et HYPOTHÈSE. Cherche les contradictions, chiffres incohérents et affirmations non prouvées."
  },
  {
    title: "2 · Chercher les dépendances cachées",
    text: "Cherche imports dynamiques, URL construites, service workers, crons, Edge Functions, Supabase, Storage, Vercel, Drive, routes rares, restaurations et dépendances indirectes."
  },
  {
    title: "3 · Simplifier l’architecture",
    text: "Si la suppression n’est pas la meilleure option, propose la fusion, le déplacement ou la réécriture minimale qui réduit réellement les couches sans recréer une nouvelle couche."
  },
  {
    title: "4 · Contrôler le risque",
    text: "Liste les conséquences concrètes, les moyens de retour arrière et les tests obligatoires. Distingue le réversible de l’irréversible."
  },
  {
    title: "5 · Rendre la décision",
    text: "À partir de tous les contrôles précédents, rends uniquement la réponse finale au format demandé. Ne choisis SUPPRIMER que si les dépendances ont été suffisamment écartées par des preuves."
  }
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: BASE_HEADERS });

  const u = new URL(req.url);

  if (req.method === "GET") {
    try {
      const token = u.searchParams.get("token") || "";
      if (token.length < 20) return textResponse("# Dossier invalide ou expiré.", 404);
      const tokenHash = await sha256(token);
      const { data: row, error } = await db.from("admin_cleanup_handoffs")
        .select("id,payload,expires_at,view_count")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw error;
      if (!row || new Date(row.expires_at) <= new Date()) return textResponse("# Dossier invalide ou expiré.", 404);

      await db.from("admin_cleanup_handoffs").update({
        view_count: Number(row.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString()
      }).eq("id", row.id);

      return textResponse(buildMarkdown(row.payload));
    } catch (e) {
      console.error(e);
      return textResponse("# Impossible de lire ce dossier.", 500);
    }
  }

  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  try {
    const email = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const caseId = String(body.case_id || "");
    if (!caseId) throw new Error("Dossier manquant.");

    const { data: c, error } = await db.from("admin_cleanup_cases").select("*").eq("id", caseId).single();
    if (error) throw error;
    const { data: source } = c.source_key
      ? await db.from("admin_cleanup_sources").select("source_key,label,source_type,locator").eq("source_key", c.source_key).maybeSingle()
      : { data: null };

    const prompts = Array.isArray(c.gpt_prompts) && c.gpt_prompts.length ? c.gpt_prompts : DEFAULT_PROMPTS;
    const safeCase = scrub({
      id: c.id,
      source_key: c.source_key,
      category: c.category,
      title: c.title,
      question: c.question,
      context_text: c.context_text,
      facts: c.facts,
      metrics: c.metrics,
      evidence: c.evidence,
      uncertainties: c.uncertainties,
      proposed_action: c.proposed_action,
      proposed_plan: c.proposed_plan,
      evidence_score: c.evidence_score,
      evidence_hash: c.evidence_hash
    });

    const token = randomToken();
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const payload = scrub({
      case: safeCase,
      source: source || null,
      prompts,
      generated_at: new Date().toISOString()
    });

    const { error: insertError } = await db.from("admin_cleanup_handoffs").insert({
      case_id: c.id,
      token_hash: tokenHash,
      payload,
      created_by: email,
      expires_at: expiresAt
    });
    if (insertError) throw insertError;

    await db.from("admin_cleanup_case_events").insert({
      case_id: c.id,
      event_type: "gpt_handoff_created",
      actor: email,
      payload: { expires_at: expiresAt }
    });

    const handoffUrl = `${URL}/functions/v1/admin-cleanup-handoff?token=${encodeURIComponent(token)}`;
    return json({ ok: true, handoff_url: handoffUrl, expires_at: expiresAt });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});