import { normalize, type DialogContext, type Intent } from "./core.ts";
import { semanticClassify, type AppTarget, type SemanticResult } from "./semantic.ts";

export type SemanticSource = "rules" | "openai" | "rules_fallback";
export type HybridSemanticResult = SemanticResult & {
  source: SemanticSource;
  model?: string;
  latency_ms?: number;
};

const INTENTS: Intent[] = [
  "selection",
  "messaging_help",
  "request_help",
  "exchange",
  "contact",
  "place",
  "organization",
  "colleagues",
  "on_duty",
  "shift_roster",
  "planning",
  "person",
  "leave_lookup",
  "app_navigation",
  "help",
];

const APPS: AppTarget[] = [
  "profile_photo",
  "planning_personal",
  "planning_team",
  "change_app",
  "calendar_subscribe",
  "agent_dates",
  "contacts",
  "responsable",
  "notes",
  "nouveaux_arrivants",
  "file_upload",
  "activity",
  "admin",
  "places",
  "access_manage",
  "messages",
  "tomorrow",
  "agent_directory",
];

const ROUTE_TOOL_NAME = "route_stip_request";
const RULE_CONFIDENCE_CUTOFF = 0.94;
const MODEL_CONFIDENCE_FLOOR = 0.58;
const DEFAULT_MODEL = "gpt-6-luna";
const OPENAI_URL = "https://api.openai.com/v1/responses";

function cleanApp(value: unknown): AppTarget | undefined {
  const app = String(value || "");
  return APPS.includes(app as AppTarget) ? app as AppTarget : undefined;
}

export function validateModelRoute(value: unknown): SemanticResult | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const intent = String(raw.intent || "") as Intent;
  if (!INTENTS.includes(intent)) return null;
  const confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  const app = cleanApp(raw.app);
  if (intent === "app_navigation" && !app) return null;
  return {
    intent,
    confidence,
    ...(app ? { app } : {}),
    ...(typeof raw.reason === "string" && raw.reason.trim() ? { reason: raw.reason.trim().slice(0, 120) } : {}),
  };
}

export function extractRouteFromResponse(value: unknown): SemanticResult | null {
  if (!value || typeof value !== "object") return null;
  const output = Array.isArray((value as any).output) ? (value as any).output : [];
  const call = output.find((item: any) =>
    item?.type === "function_call" &&
    item?.name === ROUTE_TOOL_NAME &&
    typeof item?.arguments === "string"
  );
  if (!call) return null;
  try {
    return validateModelRoute(JSON.parse(call.arguments));
  } catch {
    return null;
  }
}

export function shouldUseOpenAI(rule: SemanticResult, raw: string) {
  const q = normalize(raw);
  if (!q || q.length < 2) return false;
  if (rule.intent === "selection") return false;
  return rule.confidence < RULE_CONFIDENCE_CUTOFF;
}

function safeContext(old: DialogContext) {
  return {
    previous_intent: String(old.last_intent || "") || null,
    has_subject_context: Array.isArray(old.subject_agent_ids) && old.subject_agent_ids.length > 0,
    has_date_context: !!old.date_scope,
    has_place_context: !!old.place_id,
    offered_options: Array.isArray(old.offered_options) ? old.offered_options.slice(0, 4) : [],
  };
}

async function routeWithOpenAI(raw: string, old: DialogContext, rule: SemanticResult) {
  const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!apiKey) return null;

  const model = Deno.env.get("STIP_AI_MODEL")?.trim() || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  const started = performance.now();

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 180,
        parallel_tool_calls: false,
        input: [
          {
            role: "system",
            content: [
              "Tu es uniquement le routeur sémantique de STIP IA, un portail hospitalier de logistique.",
              "Tu ne réponds jamais à l'utilisateur et tu n'inventes jamais de donnée métier.",
              "Choisis exactement une intention STIP parmi celles du schéma de l'outil.",
              "Ne décide jamais d'un droit, d'une personne, d'une date ou d'une donnée absente.",
              "Une demande de congé ou d'absence se classe request_help.",
              "Une demande d'échange ou de modification d'horaire se classe exchange.",
              "Une ouverture explicite d'application peut se classer app_navigation avec l'app correspondante.",
              "En cas d'ambiguïté réelle, utilise help.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              message: raw,
              rule_candidate: rule,
              context: safeContext(old),
            }),
          },
        ],
        tools: [
          {
            type: "function",
            name: ROUTE_TOOL_NAME,
            description: "Route la demande vers une intention STIP sans exécuter d'action.",
            strict: true,
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                intent: { type: "string", enum: INTENTS },
                app: { type: "string", enum: ["", ...APPS] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reason: { type: "string", maxLength: 120 },
              },
              required: ["intent", "app", "confidence", "reason"],
            },
          },
        ],
        tool_choice: { type: "function", name: ROUTE_TOOL_NAME },
      }),
    });

    const latency = Math.round(performance.now() - started);
    if (!response.ok) {
      console.warn(JSON.stringify({
        event: "stip_dialog_semantic",
        source: "rules_fallback",
        provider_status: response.status,
        model,
        latency_ms: latency,
      }));
      return null;
    }

    const data = await response.json();
    const route = extractRouteFromResponse(data);
    if (!route) {
      console.warn(JSON.stringify({
        event: "stip_dialog_semantic",
        source: "rules_fallback",
        reason: "invalid_model_route",
        model,
        latency_ms: latency,
      }));
      return null;
    }

    return { route, model, latency };
  } catch (error) {
    console.warn(JSON.stringify({
      event: "stip_dialog_semantic",
      source: "rules_fallback",
      reason: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "provider_error",
      model,
      latency_ms: Math.round(performance.now() - started),
    }));
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function semanticRoute(raw: string, old: DialogContext = {}): Promise<HybridSemanticResult> {
  const rule = semanticClassify(raw, old);

  if (!shouldUseOpenAI(rule, raw)) {
    return { ...rule, source: "rules" };
  }

  const modelResult = await routeWithOpenAI(raw, old, rule);
  if (!modelResult) return { ...rule, source: "rules_fallback" };

  const candidate = modelResult.route;
  if (candidate.confidence < MODEL_CONFIDENCE_FLOOR) {
    return { ...rule, source: "rules_fallback", model: modelResult.model, latency_ms: modelResult.latency };
  }

  if (candidate.intent === "help" && rule.intent !== "help" && rule.confidence >= candidate.confidence) {
    return { ...rule, source: "rules_fallback", model: modelResult.model, latency_ms: modelResult.latency };
  }

  console.info(JSON.stringify({
    event: "stip_dialog_semantic",
    source: "openai",
    intent: candidate.intent,
    model: modelResult.model,
    confidence: candidate.confidence,
    latency_ms: modelResult.latency,
  }));

  return {
    ...candidate,
    source: "openai",
    model: modelResult.model,
    latency_ms: modelResult.latency,
  };
}
