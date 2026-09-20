import {
  addDays,
  classifyIntent,
  extractShift,
  hasContextualPersonRef,
  isSelfPlanning,
  normalize,
  offeredOptionIntent,
  parseDateScope,
  selectionCount,
  type DateScope,
  type DialogContext,
  type Intent,
} from "./core.ts";
import { resolvePeople } from "./people.ts";
import { exchangeAnswer, colleaguesAnswer, onDutyRoster, organizationAnswer, planningAnswer, shiftRoster } from "./handlers-planning.ts";
import { contactAnswer, messagingHelp, placeAnswer } from "./handlers-lookup.ts";
import { baseContext, choiceResponse, contextSubjects, findAgents, personCard, personResponse } from "./presentation.ts";
import { directory, shiftDefinitions, todayParis } from "./runtime.ts";
import type { Agent, SessionCtx } from "./types.ts";

function defaultScope(intent: Intent): DateScope {
  const base = todayParis();
  if (["planning", "colleagues", "on_duty", "shift_roster", "organization"].includes(intent)) {
    const d = addDays(base, 1);
    return { start: d, end: d };
  }
  return { start: base, end: base };
}

async function selectionAnswer(c: SessionCtx, old: DialogContext, raw: string, all: Agent[], ds: DateScope, defs: Awaited<ReturnType<typeof shiftDefinitions>>) {
  const count = selectionCount(raw) || 0;
  const ids = Array.isArray(old.last_choice_ids) ? old.last_choice_ids.map(String) : [];
  if (old.last_choice_kind === "agent" && ids.length === count && count > 0) {
    const rows = findAgents(all, ids);
    const options = ["Planning", "Coordonnées", ...(c.permissions?.messages === true && rows.every((a) => a.can_message && String(a.id) !== String(c.agent.id)) ? ["Message"] : [])];
    return {
      kind: "selection", title: `${rows.length} personnes sélectionnées`, text: "Je garde ces personnes pour la suite.",
      cards: rows.map((a) => personCard(a)), actions: [], suggestions: options,
      context: baseContext(old, {
        subject_agent_ids: rows.map((a) => a.id), agent_id: rows[0]?.id, date_scope: ds,
        offered_options: options.map(normalize), last_choice_ids: [], last_choice_kind: "agent",
      }),
    };
  }
  if (old.last_choice_kind === "agent" && ids.length > count && count > 0) return {
    kind: "help", title: "Lesquels ?",
    text: `J’ai ${ids.length} personnes possibles. “Les ${count}” ne suffit pas pour savoir lesquelles tu veux.`,
    cards: findAgents(all, ids).map((a) => personCard(a)), actions: [], context: baseContext(old, { date_scope: ds }),
  };
  const opts = (old.offered_options || []).map(normalize);
  if (count === 2 && opts.length === 2) {
    const subjects = findAgents(all, contextSubjects(old));
    if (subjects.length && opts.includes("planning") && opts.includes("coordonnees")) {
      const [planning, contact] = await Promise.all([
        planningAnswer(c, old, subjects, ds, defs),
        contactAnswer(c, old, subjects, "coordonnées", ds),
      ]);
      const cards = [...(planning.cards || []), ...(contact.cards || [])].filter((card: any, i, rows) => {
        const key = `${card.type || ""}:${card.id || ""}:${card.title || ""}:${card.subtitle || ""}:${card.detail || ""}`;
        return rows.findIndex((x: any) => `${x.type || ""}:${x.id || ""}:${x.title || ""}:${x.subtitle || ""}:${x.detail || ""}` === key) === i;
      });
      const actions = [...(planning.actions || []), ...(contact.actions || [])].filter((action: any, i, rows) => {
        const key = JSON.stringify(action);
        return rows.findIndex((x: any) => JSON.stringify(x) === key) === i;
      });
      return {
        kind: "combined", title: "Planning + coordonnées",
        text: `${planning.text} ${contact.text}`.trim(), cards, actions,
        suggestions: c.permissions?.messages === true && subjects.every((a) => a.can_message && String(a.id) !== String(c.agent.id)) ? ["Message"] : [],
        context: baseContext(old, { subject_agent_ids: subjects.map((a) => a.id), agent_id: subjects[0]?.id, date_scope: ds, last_intent: "combined", offered_options: [] }),
      };
    }
  }
  if (opts.length > count && count > 0) return {
    kind: "help", title: "Lesquels ?",
    text: `J’ai ${opts.length} options actives : ${opts.join(", ")}. Dis-moi lesquelles tu veux, je ne choisis pas à ta place.`,
    cards: [], actions: [], context: baseContext(old, { date_scope: ds }),
  };
  return {
    kind: "help", title: "Je veux être sûr",
    text: "Je n’ai pas exactement ce nombre d’éléments actifs à sélectionner. Précise les personnes ou l’action voulue.",
    cards: [], actions: [], context: baseContext(old, { date_scope: ds }),
  };
}

export async function answer(c: SessionCtx, body: any) {
  const raw = String(body.text || "").trim();
  if (!raw) throw Error("Écris quelque chose.");
  const old: DialogContext = body.context && typeof body.context === "object" ? body.context : {};
  const all = await directory();
  const defs = await shiftDefinitions();

  let intent: Intent = classifyIntent(raw);
  const option = offeredOptionIntent(raw, old.offered_options || []);
  if (option === "planning") intent = "planning";
  if (option === "coordonnees") intent = "contact";
  if (option === "message") intent = "messaging_help";
  if ((intent === "help" || intent === "planning") && old.last_intent === "exchange" && extractShift(raw)) intent = "exchange";

  const parsedScope = parseDateScope(raw, todayParis(), old);
  if (intent === "exchange" && !parsedScope) return {
    kind: "exchange", title: "Échange de planning",
    text: "Pour quel jour ou quelle période veux-tu chercher un échange ?",
    cards: [], actions: [], suggestions: ["Demain", "Cette semaine", "Semaine prochaine"],
    context: baseContext(old, { last_intent: "exchange", offered_options: [] }),
  };
  const ds = parsedScope || defaultScope(intent);

  if (intent === "selection") return selectionAnswer(c, old, raw, all, ds, defs);

  const contextIds = contextSubjects(old);
  const allowContext = hasContextualPersonRef(raw) || !!option || ["contact", "colleagues"].includes(intent);
  const resolved = resolvePeople(raw, all, contextIds, allowContext);
  const explicitSubjects = resolved.candidates;

  if (intent === "messaging_help") {
    const contextualMessage = !!option || hasContextualPersonRef(raw);
    const subjects = explicitSubjects.length ? explicitSubjects : (contextualMessage ? findAgents(all, contextIds) : []);
    return messagingHelp(c, old, ds, subjects, all, raw);
  }
  if (intent === "exchange") return exchangeAnswer(c, old, ds, extractShift(raw), all, defs);
  if (intent === "place") {
    const p = await placeAnswer(c, old, raw, ds);
    if (p) return p;
    return {
      kind: "help", title: "Lieu non trouvé", text: "Je n’ai pas trouvé de lieu suffisamment fiable avec cette formulation.",
      cards: [], actions: [], context: baseContext(old, { date_scope: ds, last_intent: "place" }), suggestions: ["Où est l’IRM ?", "Où est l’ascenseur bleu ?"],
    };
  }
  if (intent === "on_duty") return onDutyRoster(c, old, ds, all, defs);
  if (intent === "organization" && !extractShift(raw)) return organizationAnswer(c, old, ds);
  if (intent === "shift_roster" || (intent === "organization" && extractShift(raw))) return shiftRoster(c, old, ds, extractShift(raw)!, all, defs);

  if (intent === "colleagues") {
    const subject = explicitSubjects[0] || findAgents(all, contextIds)[0] || c.agent;
    return colleaguesAnswer(c, old, subject, ds, defs, all, raw);
  }
  if (intent === "contact") {
    const subjects = explicitSubjects.length ? explicitSubjects : findAgents(all, contextIds);
    if (subjects.length > 1 && resolved.mode === "explicit" && !contextIds.length) return choiceResponse(c, old, subjects, ds);
    if (!subjects.length) return { kind: "help", title: "De qui ?", text: "Donne-moi le nom de la personne dont tu veux les coordonnées.", cards: [], actions: [], context: baseContext(old, { date_scope: ds, last_intent: "contact" }) };
    return contactAnswer(c, old, subjects, raw, ds);
  }
  if (intent === "planning") {
    if (isSelfPlanning(raw) && resolved.mode !== "explicit") return planningAnswer(c, old, [c.agent], ds, defs);
    const subjects = explicitSubjects.length ? explicitSubjects : findAgents(all, contextIds);
    if (subjects.length > 1 && resolved.mode === "explicit" && !contextIds.length) return choiceResponse(c, old, subjects, ds);
    if (subjects.length) return planningAnswer(c, old, subjects, ds, defs);
    if (/\b(je|moi|mon|ma|mes)\b/.test(normalize(raw))) return planningAnswer(c, old, [c.agent], ds, defs);
  }

  if (resolved.mode === "explicit") {
    if (explicitSubjects.length > 1) return choiceResponse(c, old, explicitSubjects, ds);
    if (explicitSubjects.length === 1) return personResponse(c, old, explicitSubjects[0], ds);
  }
  return {
    kind: "help", title: "Je cherche dans STIP",
    text: "Je n’ai pas assez d’éléments fiables pour répondre sans deviner. Tu peux demander un planning, une personne, des coordonnées, un lieu, un effectif, un échange ou la messagerie.",
    cards: [], actions: [], context: baseContext(old, { date_scope: ds, last_intent: "help" }),
    suggestions: ["Mon horaire demain ?", "Qui est en J4 demain ?", "Y a-t-il une messagerie ici ?", "Où est l’IRM ?"],
  };
}
