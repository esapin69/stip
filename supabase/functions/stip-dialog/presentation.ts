import { normalize, type DateScope, type DialogContext } from "./core.ts";
import type { Action, Agent, Card, SessionCtx } from "./types.ts";

export function gheLabel(v: unknown) {
  const s = String(v || "").trim();
  return !s ? "" : /^GHE\b/i.test(s) ? s : `GHE ${s}`;
}
export function personCard(a: Agent, extra: Record<string, unknown> = {}): Card {
  return {
    id: a.id,
    type: "person",
    title: a.nickname || a.prenom || a.nom || "Agent",
    subtitle: [a.nickname && a.prenom ? a.prenom : null, a.nom, gheLabel(a.ghe)].filter(Boolean).join(" · "),
    avatar: a.profile_photo_url || a.avatar_url || "",
    source_key: a.source_key || "",
    can_message: !!a.can_message,
    ...extra,
  };
}
export function personActions(c: SessionCtx, a: Agent, labelPrefix = ""): Action[] {
  const self = String(a.id) === String(c.agent.id);
  if (self) return [];
  const actions: Action[] = [];
  if (a.source_key) actions.push({
    type: "compare", agent_id: a.id, source_key: a.source_key,
    label: labelPrefix ? `${labelPrefix} · Comparer` : "Comparer avec moi",
  });
  if (c.permissions?.messages === true && a.can_message) actions.push({
    type: "message", agent_id: a.id,
    label: labelPrefix ? `${labelPrefix} · Message` : "Message",
  });
  return actions;
}
export function baseContext(old: DialogContext, patch: Record<string, unknown> = {}) {
  return { version: 2, ...old, ...patch };
}
export function contextSubjects(ctx: DialogContext) {
  if (Array.isArray(ctx.subject_agent_ids) && ctx.subject_agent_ids.length) return ctx.subject_agent_ids.map(String);
  return ctx.agent_id ? [String(ctx.agent_id)] : [];
}
export function findAgents(all: Agent[], ids: string[]) {
  const set = new Set(ids.map(String));
  return all.filter((a) => set.has(String(a.id)));
}
export function optionSuggestions(a: Agent | null, c: SessionCtx) {
  const out = ["Planning", "Coordonnées"];
  if (a && String(a.id) !== String(c.agent.id) && c.permissions?.messages === true && a.can_message) out.push("Message");
  return out;
}
export function choiceResponse(c: SessionCtx, old: DialogContext, rows: Agent[], dateScope: DateScope) {
  return {
    kind: "choice", title: "J’en ai plusieurs", text: "Choisis la bonne personne et je garde le contexte.",
    cards: rows.map((a) => personCard(a)), actions: [],
    context: baseContext(old, {
      date_scope: dateScope,
      last_choice_ids: rows.map((a) => a.id),
      last_choice_kind: "agent",
      offered_options: [],
    }),
  };
}
export function personResponse(c: SessionCtx, old: DialogContext, a: Agent, dateScope: DateScope) {
  const options = optionSuggestions(a, c);
  return {
    kind: "person", title: a.nickname || a.prenom || a.nom || "Agent", text: "Je l’ai trouvé. Que veux-tu regarder ?",
    cards: [personCard(a)], actions: personActions(c, a), suggestions: options,
    context: baseContext(old, {
      subject_agent_ids: [a.id], agent_id: a.id, date_scope: dateScope,
      last_choice_ids: [], last_choice_kind: "agent", offered_options: options.map((x) => normalize(x)),
    }),
  };
}
