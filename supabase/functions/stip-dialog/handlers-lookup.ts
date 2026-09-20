import { normalize, type DateScope, type DialogContext } from "./core.ts";
import { baseContext, personCard } from "./presentation.ts";
import { db } from "./runtime.ts";
import type { Action, Agent, Card, SessionCtx } from "./types.ts";

export async function contactAnswer(c: SessionCtx, old: DialogContext, subjects: Agent[], raw: string, ds: DateScope) {
  const q = normalize(raw), wantsPhone = /\b(numero|telephone|tel)\b/.test(q), wantsEmail = /\b(mail|email|e mail)\b/.test(q), wantsAddress = /\badresse\b/.test(q);
  const cards: Card[] = [], actions: Action[] = [], lines: string[] = [];
  for (const a of subjects) {
    const ph = a.telephone || null, em = c.level === "pro" ? a.email || null : null;
    const name = a.nickname || a.prenom || a.nom || "Agent";
    if (wantsAddress) lines.push(`${name} : aucune adresse professionnelle enregistrée dans STIP.`);
    else if (wantsPhone) lines.push(`${name} : ${ph || "numéro non renseigné"}.`);
    else if (wantsEmail) lines.push(`${name} : ${em || "e-mail non accessible ou non renseigné"}.`);
    else lines.push(`${name} : ${[ph ? `tél. ${ph}` : null, em ? `e-mail ${em}` : null].filter(Boolean).join(" · ") || "aucune coordonnée accessible"}.`);
    cards.push(personCard(a, { detail: [ph ? `Tél. ${ph}` : null, em ? `E-mail ${em}` : null].filter(Boolean).join(" · ") }));
    if (String(a.id) !== String(c.agent.id)) {
      if (ph && (!wantsEmail || wantsPhone)) actions.push({ type: "call", value: ph, label: subjects.length > 1 ? `${name} · Appeler` : "Appeler" }, { type: "copy", value: ph, label: subjects.length > 1 ? `${name} · Copier` : "Copier le numéro" });
      if (em && (!wantsPhone || wantsEmail)) actions.push({ type: "mail", value: em, label: subjects.length > 1 ? `${name} · Écrire` : "Écrire" });
      if (c.permissions?.messages === true && a.can_message) actions.push({ type: "message", agent_id: a.id, label: subjects.length > 1 ? `${name} · Message` : "Message" });
    }
  }
  return {
    kind: "contact", title: subjects.length === 1 ? (subjects[0].nickname || subjects[0].prenom || subjects[0].nom) : `${subjects.length} personnes`,
    text: lines.join(" "), cards, actions,
    context: baseContext(old, { subject_agent_ids: subjects.map((a) => a.id), agent_id: subjects[0]?.id, date_scope: ds, last_intent: "contact", offered_options: [] }),
    suggestions: subjects.length > 1 ? ["Leur planning ?", "Message"] : ["Son planning ?", "Message"],
  };
}

export async function placeAnswer(c: SessionCtx, old: DialogContext, raw: string, ds: DateScope) {
  const allowed = c.level === "pro" ? ["public", "internal_stip"] : ["public"];
  const { data: places, error } = await db.from("stip_places").select("id,display_name,official_name,campus,building_code,level,summary,details,visibility,evidence_status,sort_order").in("visibility", allowed).order("sort_order").limit(500);
  if (error) throw error;
  const currentPlace = old.place_id ? (places || []).find((p: any) => String(p.id) === String(old.place_id)) : null;
  const normalizedRaw = normalize(raw);
  const wantsRoute = !!currentPlace && /\b(comment y aller|y aller|itineraire|trajet|chemin|comment aller)\b/.test(normalizedRaw);
  const wantsCurrentPlace = !!currentPlace && /\b(afficher le batiment|afficher le lieu|afficher ce lieu|ce lieu|cet endroit|le batiment)\b/.test(normalizedRaw);
  if (wantsRoute) {
    const { data: routes, error: routeError } = await db.from("stip_place_routes")
      .select("id,from_place_id,to_place_id,label,mode,visibility,evidence_status,notes,sort_order")
      .eq("to_place_id", currentPlace.id).in("visibility", allowed).order("sort_order");
    if (routeError) throw routeError;
    const routeIds = (routes || []).map((r: any) => r.id);
    const { data: steps, error: stepError } = routeIds.length
      ? await db.from("stip_place_route_steps").select("route_id,step_no,instruction,visibility,evidence_status").in("route_id", routeIds).in("visibility", allowed).order("step_no")
      : { data: [] as any[], error: null };
    if (stepError) throw stepError;
    if ((routes || []).length) {
      const cards = (routes || []).map((route: any) => {
        const routeSteps = (steps || []).filter((x: any) => String(x.route_id) === String(route.id)).sort((a: any, b: any) => Number(a.step_no) - Number(b.step_no));
        return {
          type: "metric", title: route.label || "Itinéraire",
          subtitle: routeSteps.length ? `${routeSteps.length} étape${routeSteps.length > 1 ? "s" : ""}` : (route.mode || "Itinéraire"),
          detail: routeSteps.length ? routeSteps.map((x: any) => `${x.step_no}. ${x.instruction}`).join(" · ") : (route.notes || "Itinéraire enregistré dans STIP."),
        };
      });
      return {
        kind: "place", title: `Itinéraire · ${currentPlace.display_name || currentPlace.official_name}`,
        text: (routes || []).length === 1 ? "Voici l’itinéraire enregistré dans STIP." : `${(routes || []).length} itinéraires sont enregistrés pour ce lieu.`,
        cards, actions: [{ type: "open", url: `places-app.html?focus=${encodeURIComponent(currentPlace.id)}`, label: "Ouvrir la fiche du lieu" }],
        context: baseContext(old, { place_id: currentPlace.id, date_scope: ds, last_intent: "place" }),
      };
    }
    return {
      kind: "place", title: currentPlace.display_name || currentPlace.official_name,
      text: "Le lieu est connu, mais aucun itinéraire fiable n’est encore enregistré dans STIP.",
      cards: [{ type: "place", id: currentPlace.id, title: currentPlace.display_name || currentPlace.official_name, subtitle: [currentPlace.campus, currentPlace.building_code, currentPlace.level].filter(Boolean).join(" · "), detail: currentPlace.summary || "" }],
      actions: [{ type: "open", url: `places-app.html?focus=${encodeURIComponent(currentPlace.id)}`, label: "Voir le lieu" }],
      context: baseContext(old, { place_id: currentPlace.id, date_scope: ds, last_intent: "place" }),
    };
  }
  if (wantsCurrentPlace) return {
    kind: "place", title: currentPlace.display_name || currentPlace.official_name,
    text: [currentPlace.building_code, currentPlace.level, currentPlace.summary].filter(Boolean).join(" · ") || "Lieu retrouvé dans STIP.",
    cards: [{ type: "place", id: currentPlace.id, title: currentPlace.display_name || currentPlace.official_name, subtitle: [currentPlace.campus, currentPlace.building_code, currentPlace.level].filter(Boolean).join(" · "), detail: currentPlace.summary || currentPlace.details || "" }],
    actions: [{ type: "open", url: `places-app.html?focus=${encodeURIComponent(currentPlace.id)}`, label: "Voir le lieu" }],
    context: baseContext(old, { place_id: currentPlace.id, date_scope: ds, last_intent: "place" }), suggestions: ["Comment y aller ?"],
  };

  const ids = (places || []).map((p: any) => p.id);
  const [{ data: aliases }, { data: tags }] = await Promise.all([
    ids.length ? db.from("stip_place_aliases").select("place_id,alias").in("place_id", ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? db.from("stip_place_tags").select("place_id,tag").in("place_id", ids) : Promise.resolve({ data: [] as any[] }),
  ]);
  const byAlias = new Map<string, string[]>(), byTag = new Map<string, string[]>();
  for (const a of aliases || []) { const x = byAlias.get(String(a.place_id)) || []; x.push(normalize(a.alias)); byAlias.set(String(a.place_id), x); }
  for (const t of tags || []) { const x = byTag.get(String(t.place_id)) || []; x.push(normalize(t.tag)); byTag.set(String(t.place_id), x); }
  const q = normalize(raw).replace(/\b(ou|est|se|trouve|comment|aller|va|je|dois|le|la|les|un|une|au|aux|dans|service|batiment|etage)\b/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2) return null;
  const words = q.split(" ").filter((x) => x.length > 1);
  const scored = (places || []).map((p: any) => {
    const names = [normalize(p.display_name), normalize(p.official_name), ...(byAlias.get(String(p.id)) || [])].filter(Boolean);
    const tagsForPlace = byTag.get(String(p.id)) || [];
    let score = 0;
    for (const n of names) {
      if (q === n) score = Math.max(score, 120);
      else if ((` ${q} `).includes(` ${n} `) || (` ${n} `).includes(` ${q} `)) score = Math.max(score, 100);
      else score = Math.max(score, words.reduce((s, w) => s + (n.includes(w) ? 15 : 0), 0));
    }
    score += words.reduce((s, w) => s + (tagsForPlace.some((t) => t === w || t.includes(w)) ? 5 : 0), 0);
    return { p, score };
  }).filter((x: any) => x.score >= 20).sort((a: any, b: any) => b.score - a.score);
  if (!scored.length) return null;
  const top = scored[0].score;
  const close = scored.filter((x: any) => x.score === top || (top < 100 && x.score >= top - 5)).slice(0, 5).map((x: any) => x.p);
  if (close.length > 1) return {
    kind: "place", title: "Plusieurs lieux correspondent", text: "Je ne choisis pas au hasard. Voici les correspondances les plus proches.",
    cards: close.map((p: any) => ({ type: "place", id: p.id, title: p.display_name || p.official_name, subtitle: [p.campus, p.building_code, p.level].filter(Boolean).join(" · "), detail: p.summary || "" })),
    actions: close.map((p: any) => ({ type: "open", url: `places-app.html?focus=${encodeURIComponent(p.id)}`, label: `Voir ${p.display_name || p.official_name}` })),
    context: baseContext(old, { date_scope: ds, last_intent: "place" }),
  };
  const p = close[0];
  return {
    kind: "place", title: p.display_name || p.official_name, text: [p.building_code, p.level, p.summary].filter(Boolean).join(" · ") || "Lieu retrouvé dans STIP.",
    cards: [{ type: "place", id: p.id, title: p.display_name || p.official_name, subtitle: [p.campus, p.building_code, p.level].filter(Boolean).join(" · "), detail: p.summary || p.details || "" }],
    actions: [{ type: "open", url: `places-app.html?focus=${encodeURIComponent(p.id)}`, label: "Voir le lieu" }],
    context: baseContext(old, { place_id: p.id, date_scope: ds, last_intent: "place" }), suggestions: ["Comment y aller ?", "Afficher le bâtiment"],
  };
}

export async function messagingHelp(c: SessionCtx, old: DialogContext, ds: DateScope, subjects: Agent[] = [], all: Agent[] = [], raw = "") {
  const enabled = c.permissions?.messages === true;
  if (!enabled) return { kind: "help", title: "Messages STIP", text: "La messagerie STIP n’est pas activée pour cet accès.", cards: [], actions: [], context: baseContext(old, { date_scope: ds, last_intent: "messaging_help" }) };
  const q = normalize(raw);
  if (!subjects.length && /\b(qui|personnes?|professionnels?)\b/.test(q) && /\b(message|messages|messagerie|recevoir|ecrire)\b/.test(q)) {
    const eligible = all.filter((a) => String(a.id) !== String(c.agent.id) && a.can_message);
    return {
      kind: "message", title: "Professionnels joignables", text: `${eligible.length} professionnel${eligible.length > 1 ? "s" : ""} peut${eligible.length > 1 ? "vent" : ""} recevoir un message STIP actuellement.`,
      cards: eligible.slice(0, 30).map((a) => personCard(a)), actions: [{ type: "new_message", label: "Nouveau message" }],
      context: baseContext(old, { date_scope: ds, last_intent: "messaging_help", last_choice_ids: eligible.map((a) => a.id), last_choice_kind: "agent" }),
    };
  }
  if (subjects.length) {
    const eligible = subjects.filter((a) => String(a.id) !== String(c.agent.id) && a.can_message);
    if (!eligible.length) return {
      kind: "help", title: "Messages STIP",
      text: subjects.some((a) => String(a.id) === String(c.agent.id)) ? "Tu ne peux pas ouvrir une conversation avec toi-même." : "Cette personne n’a pas accès aux Messages STIP.",
      cards: subjects.map((a) => personCard(a)), actions: [], context: baseContext(old, { subject_agent_ids: subjects.map((a) => a.id), date_scope: ds, last_intent: "messaging_help" }),
    };
    const actions = eligible.length === 1 ? [{ type: "message", agent_id: eligible[0].id, label: "Message" }] : [{ type: "group_message", agent_ids: eligible.map((a) => a.id), label: `Écrire aux ${eligible.length}` }];
    return {
      kind: "message", title: "Messages STIP",
      text: eligible.length === 1 ? `Tu peux ouvrir une conversation avec ${eligible[0].nickname || eligible[0].prenom || eligible[0].nom}.` : `Tu peux ouvrir une conversation avec ces ${eligible.length} personnes.`,
      cards: eligible.map((a) => personCard(a)), actions,
      context: baseContext(old, { subject_agent_ids: eligible.map((a) => a.id), date_scope: ds, last_intent: "messaging_help" }),
    };
  }
  return {
    kind: "message", title: "Messages STIP", text: "Oui. STIP possède une messagerie entre les professionnels qui y ont accès. Tu peux choisir un destinataire sans quitter le portail.",
    cards: [], actions: [{ type: "new_message", label: "Nouveau message" }],
    context: baseContext(old, { date_scope: ds, last_intent: "messaging_help" }), suggestions: ["Qui peut recevoir un message ?"],
  };
}
