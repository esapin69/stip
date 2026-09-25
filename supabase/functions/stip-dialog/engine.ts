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
import { exchangeAnswer, colleaguesAnswer, leaveLookupAnswer, onDutyRoster, organizationAnswer, planningAnswer, shiftRoster } from "./handlers-planning.ts";
import { contactAnswer, messagingHelp, placeAnswer } from "./handlers-lookup.ts";
import { baseContext, choiceResponse, contextSubjects, findAgents, personCard, personResponse } from "./presentation.ts";
import { directory, shiftDefinitions, todayParis } from "./runtime.ts";
import { semanticClassify, semanticText, type AppTarget } from "./semantic.ts";
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


const APP_META: Record<AppTarget,{label:string;permission?:string;pro?:boolean}> = {
  profile_photo:{label:"Modifier ma photo",permission:"profile_photo"},
  planning_personal:{label:"Mon planning",permission:"planning_personal"},
  planning_team:{label:"Planning équipe",permission:"planning_team"},
  change_app:{label:"Changement",permission:"change_app"},
  calendar_subscribe:{label:"Synchroniser mon calendrier",permission:"calendar_subscribe"},
  agent_dates:{label:"Date des agents",permission:"agent_dates"},
  contacts:{label:"Contacts",permission:"contacts"},
  responsable:{label:"Responsable",permission:"responsable",pro:true},
  notes:{label:"Prendre des notes",permission:"notes",pro:true},
  nouveaux_arrivants:{label:"Nouvel agent",permission:"nouveaux_arrivants"},
  file_upload:{label:"Importer",permission:"file_upload"},
  activity:{label:"Esprit d’équipe",permission:"activity"},
  admin:{label:"Administration",permission:"admin",pro:true},
  places:{label:"Visiter les lieux",permission:"places"},
  access_manage:{label:"Accès & sécurité",permission:"access_manage",pro:true},
  messages:{label:"Messages",permission:"messages"},
  tomorrow:{label:"Actions",permission:"tomorrow"},
  agent_directory:{label:"Équipe",permission:"agent_directory"},
};
function canOpenApp(c:SessionCtx, app:AppTarget){
  const meta=APP_META[app], p=c.permissions||{};
  if(app==="admin") return p.admin===true;
  if(app==="access_manage") return p.access_manage===true || p.admin===true;
  if(app==="responsable") return p.responsable===true || p.admin===true;
  if(meta.pro && c.level!=="pro") return false;
  return !meta.permission || p[meta.permission]===true || p.admin===true;
}
function appNavigationAnswer(c:SessionCtx, old:DialogContext, app:AppTarget){
  const meta=APP_META[app];
  if(!canOpenApp(c,app)) return {
    kind:"help",title:"Accès STIP",text:"Cette fonction n’est pas disponible avec ton accès actuel.",
    cards:[],actions:[],context:baseContext(old,{last_intent:"app_navigation",offered_options:[]})
  };
  return {
    kind:"navigation",title:meta.label,text:"Je peux t’y emmener directement.",
    cards:[],actions:[{type:"app",app,label:`Ouvrir · ${meta.label}`}],
    context:baseContext(old,{last_intent:"app_navigation",offered_options:[]})
  };
}

export async function answer(c: SessionCtx, body: any) {
  const raw = String(body.text || "").trim();
  if (!raw) throw Error("Écris quelque chose.");
  if (raw.length > 500) throw Error("Message trop long pour STIP IA.");
  const old: DialogContext = body.context && typeof body.context === "object" ? body.context : {};
  const command = normalize(raw);
  if (/^(reset|reinitialise|reinitialiser|reinitialisation)$/.test(command)) return {
    kind:"navigation",title:"Réinitialiser",text:"Je peux remettre cette conversation à zéro.",
    cards:[],actions:[{type:"reset_dialog",label:"Réinitialiser"}],context:baseContext(old,{last_intent:"help"})
  };
  if (/\b(oublie|efface|retire)\b.*\b(date|jour|periode)\b/.test(command)) return {
    kind:"context",title:"Date oubliée",text:"Je ne garde plus la date ou la période précédente.",
    cards:[],actions:[],context:baseContext(old,{date_scope:null,date:null}),suggestions:["Et maintenant ?"]
  };
  const semantic = semanticClassify(raw, old);
  let intent: Intent = semantic.intent !== "help" ? semantic.intent : classifyIntent(raw);
  const option = offeredOptionIntent(raw, old.offered_options || []);
  if (option === "planning") intent = "planning";
  if (option === "coordonnees") intent = "contact";
  if (option === "message") intent = "messaging_help";
  if ((intent === "help" || intent === "planning") && old.last_intent === "exchange" && extractShift(semanticText(raw))) intent = "exchange";
  if (intent === "help" && ["shift_roster", "organization"].includes(String(old.last_intent || "")) && extractShift(semanticText(raw))) intent = "shift_roster";
  if (intent === "help" && old.place_id && /\b(autour|repere|reperes|info|infos|information|informations|detail|details|fiche|alias|proche|relie|lie a)\b/.test(normalize(raw))) intent = "place";

  if (intent === "app_navigation" && semantic.app) return appNavigationAnswer(c, old, semantic.app);

  const semanticQForDate = semanticText(raw);
  const reuseDateContext =
    /^et\b/.test(semanticQForDate) ||
    hasContextualPersonRef(raw) ||
    !!option ||
    (intent === "colleagues" && !!old.date_scope) ||
    (intent === "exchange" && old.last_intent === "exchange") ||
    (intent === "shift_roster" && ["shift_roster","organization"].includes(String(old.last_intent||"")));
  const dateContext:DialogContext = reuseDateContext ? old : { ...old, date_scope: undefined, date: undefined };
  const parsedScope = parseDateScope(semanticQForDate, todayParis(), dateContext);
  if (intent === "exchange" && !parsedScope) return {
    kind: "exchange", title: "Échange de planning",
    text: "Pour quel jour ou quelle période veux-tu chercher un échange ?",
    cards: [], actions: [], suggestions: ["Demain", "Cette semaine", "Semaine prochaine"],
    context: baseContext(old, { last_intent: "exchange", offered_options: [] }),
  };
  const ds = parsedScope || defaultScope(intent);
  const [all, defs] = await Promise.all([directory(), shiftDefinitions()]);

  if (intent === "selection") return selectionAnswer(c, old, raw, all, ds, defs);

  const contextIds = contextSubjects(old);
  const allowContext = hasContextualPersonRef(raw) || !!option || ["contact", "colleagues"].includes(intent);
  const resolved = resolvePeople(raw, all, contextIds, allowContext);
  const explicitSubjects = resolved.candidates;
  const semanticQ = semanticText(raw);
  const compoundSubjects = explicitSubjects.length ? explicitSubjects : findAgents(all, contextIds);
  if (/\b(planning|horaire|travaille|travail)\b/.test(semanticQ) && /\b(numero|telephone|mail|email|coordonnees)\b/.test(semanticQ) && compoundSubjects.length) {
    const [planning, contact] = await Promise.all([
      planningAnswer(c, old, compoundSubjects, ds, defs),
      contactAnswer(c, old, compoundSubjects, raw, ds),
    ]);
    return {
      kind:"combined", title:"Planning + coordonnées", text:`${planning.text} ${contact.text}`.trim(),
      cards:[...(planning.cards||[]),...(contact.cards||[])], actions:[...(planning.actions||[]),...(contact.actions||[])],
      suggestions:c.permissions?.messages===true?["Message"]:[],
      context:baseContext(old,{subject_agent_ids:compoundSubjects.map(a=>a.id),agent_id:compoundSubjects[0]?.id,date_scope:ds,last_intent:"combined",offered_options:[]})
    };
  }

  if (intent === "leave_lookup") return leaveLookupAnswer(c, old, semanticText(raw), defs, all);

  if (intent === "request_help") {
    const requestText = normalize(raw), isAbsence = /\b(absence|absent|absente)\b/.test(requestText);
    return {
      kind: "redirect", title: isAbsence ? "Prévenir d’une absence" : "Demande de congé",
      text: isAbsence
        ? "STIP possède déjà le parcours “Prévenir d’une absence” avec contexte d’effectif et circuit responsable. Ouvre ton planning puis touche le jour concerné."
        : "STIP possède déjà un parcours dédié aux congés avec analyse des périodes et suivi de la demande. Ouvre ton planning, touche le premier jour concerné puis “Demander un congé”. Je ne recrée pas une demande parallèle ici.",
      cards: [], actions: canOpenApp(c,"planning_personal") ? [{ type: "app", app: "planning_personal", label: "Ouvrir mon planning" }] : [],
      context: baseContext(old, { date_scope: parsedScope || undefined, last_intent: "request_help", offered_options: [] }),
      suggestions: parsedScope ? ["Mon planning sur cette période ?"] : ["Mon planning cette semaine ?", "Mon planning semaine prochaine ?"],
    };
  }
    if (intent === "messaging_help") {
    const contextualMessage = !!option || hasContextualPersonRef(raw);
    const subjects = explicitSubjects.length ? explicitSubjects : (contextualMessage ? findAgents(all, contextIds) : []);
    return messagingHelp(c, old, ds, subjects, all, raw);
  }
  if (intent === "exchange") return exchangeAnswer(c, old, ds, extractShift(semanticText(raw)), all, defs);
  if (intent === "place") {
    const p = await placeAnswer(c, old, raw, ds);
    if (p) return p;
    return {
      kind: "help", title: "Lieu non trouvé", text: "Je n’ai pas trouvé de lieu suffisamment fiable avec cette formulation.",
      cards: [], actions: [], context: baseContext(old, { date_scope: ds, last_intent: "place" }), suggestions: ["Où est l’IRM ?", "Où est l’ascenseur bleu ?"],
    };
  }
  if (intent === "on_duty") return onDutyRoster(c, old, ds, all, defs);
  if (intent === "organization" && !extractShift(semanticText(raw))) return organizationAnswer(c, old, ds);
  if (intent === "shift_roster" || (intent === "organization" && extractShift(semanticText(raw)))) return shiftRoster(c, old, ds, extractShift(semanticText(raw))!, all, defs);

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
    if (/\b(je|moi|mon|ma|mes)\b/.test(normalize(raw)) || resolved.mode === "none") return planningAnswer(c, old, [c.agent], ds, defs);
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
