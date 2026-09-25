import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

const BASE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-stip-session",
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
  return [
    "# DOSSIER AUTONOME DE CONTRÔLE ET D'EXÉCUTION — STIP",
    "",
    "## Identité du dossier",
    `CASE_ID : ${c.id}`,
    "SUPABASE_PROJECT_ID : yzsrmuxghlengnkyphxj",
    "TABLE DOSSIERS : public.admin_cleanup_cases",
    "TABLE JOURNAL : public.admin_cleanup_case_events",
    "",
    "## Rôle",
    "Tu es le contre-expert technique et l'exécutant de ce dossier. Le patron ne doit pas avoir à savoir s'il faut VALIDER, MODIFIER ou REFUSER techniquement.",
    "Tu dois vérifier les faits avec les connecteurs disponibles dans le compte ChatGPT : GitHub, Supabase, Vercel et Google Drive.",
    "Tu prends toi-même la décision technique la mieux étayée et tu la consignes dans STIP.",
    "",
    "## Règle d'autonomie",
    "1. Vérifie d'abord les faits, dépendances et risques. Pendant cette phase, ne modifie rien.",
    "2. Si le dossier est un faux positif ou qu'aucune action n'est utile, ferme-le toi-même comme REFUSÉ avec le motif factuel.",
    "3. Si une amélioration est utile, sûre, réversible et testable, exécute-la toi-même avec les connecteurs, de préférence sur la branche de travail adaptée, puis teste et mets STIP à jour.",
    "4. Si la proposition doit être modifiée, choisis toi-même la meilleure variante, exécute-la si elle reste réversible et sûre, puis teste.",
    "5. Ne demande PAS au patron de choisir entre VALIDER / MODIFIER / REFUSER : c'est ton travail technique.",
    "6. Demande au patron une confirmation seulement pour une action réellement irréversible ou à fort impact : suppression définitive de données/fichiers/projets, perte d'historique, coût payant, changement de domaine critique ou autre conséquence métier importante.",
    "7. Dans ce cas, ne formule pas une question technique. Donne une phrase simple et mesurable, par exemple : « 3 projets de test sans domaine actif ni déploiement prêt peuvent être supprimés définitivement. Les supprimer ? »",
    "8. Si la preuve reste insuffisante, continue à chercher. Si elle ne peut pas être obtenue, n'invente rien : classe le dossier comme non concluant / à surveiller avec la preuve manquante.",
    "",
    "## Règle de publication",
    "Pour GitHub, privilégie les branches de travail et les lots. N'empile pas des micro-déploiements Vercel. Respecte la politique de publication du dépôt. Ne pousse vers la production qu'après tests et uniquement si le changement le nécessite.",
    "",
    "## Mise à jour STIP obligatoire",
    "Au début de ta prise en charge, journalise gpt_review_started dans public.admin_cleanup_case_events et indique execution_status='gpt_reviewing'.",
    "Quand tu as tranché techniquement, renseigne decision_kind, decision_note, decision_at et decision_by='GPT contre-expert'.",
    "Si tu exécutes : passe execution_status='gpt_executing', journalise les actions, puis vérifie les tests/régressions.",
    "Si tout est vérifié : status='done', execution_status='completed', renseigne result et execution_log.",
    "Si c'est un faux positif : status='refused', execution_status='completed' avec le motif.",
    "Si une confirmation irréversible du patron est nécessaire : laisse le dossier ouvert, mets execution_status='awaiting_patron_confirmation' et journalise exactement la conséquence à confirmer.",
    "En cas d'échec : status='execution_failed', execution_status='failed', avec la preuve et le rollback éventuel.",
    "",
    "## Source",
    `${source?.label || c.source_key || "Source"} — ${source?.locator || ""}`,
    "",
    "## Question initiale du moteur",
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
    "## Plan initial",
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
    "## Sortie attendue",
    "Ne rends pas un bloc à recopier dans STIP.",
    "Fais le travail et synchronise STIP toi-même.",
    "Dans la conversation, donne seulement : le verdict technique, ce que tu as vérifié, ce que tu as fait, le résultat des tests, et uniquement si nécessaire la confirmation irréversible simple à obtenir du patron."
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