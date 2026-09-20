import { normalize, type DialogContext } from "./core.ts";
import type { Agent, DialogResponse, SessionCtx } from "./types.ts";

function unique(items: Array<string | null | undefined>, limit = 4) {
  const seen = new Set<string>(), out: string[] = [];
  for (const item of items) {
    const value = String(item || "").trim();
    if (!value) continue;
    const key = normalize(value);
    if (!key || seen.has(key)) continue;
    seen.add(key); out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}
function personCards(r: DialogResponse) {
  return (r.cards || []).filter((x: any) => x?.type === "person" && x?.id);
}
function titleOf(card: any) {
  return String(card?.title || "cette personne").trim();
}
function dateScope(r: DialogResponse) {
  return (r.context as DialogContext | undefined)?.date_scope;
}
function singleDay(r: DialogResponse) {
  const d = dateScope(r); return !!d && d.start === d.end;
}
function canMessage(c: SessionCtx, card: any) {
  return c.permissions?.messages === true && card?.can_message === true && String(card.id) !== String(c.agent.id);
}
function offeredOptions(suggestions: string[]) {
  const out: string[] = [];
  for (const s of suggestions) {
    const n = normalize(s);
    if (/\b(planning|horaire|shift|poste)\b/.test(n)) out.push("planning");
    else if (/\b(coordonnees|numero|telephone|tel|mail|email)\b/.test(n)) out.push("coordonnees");
    else if (/\b(message|ecrire|contacter)\b/.test(n)) out.push("message");
  }
  return [...new Set(out)];
}

export function adaptSuggestions(r: DialogResponse, raw: string, c: SessionCtx): DialogResponse {
  const cards = personCards(r), one = cards.length === 1 ? cards[0] : null;
  const self = !!one && String(one.id) === String(c.agent.id);
  const name = one ? titleOf(one) : "";
  const dateRef = singleDay(r) ? " ce jour-là" : "";
  let next: string[] = [];

  if (r.kind === "person" && one) {
    next = [
      `Planning de ${name} ?`,
      `Coordonnées de ${name} ?`,
      canMessage(c, one) ? `Message à ${name}` : null,
    ].filter(Boolean) as string[];
  } else if (r.kind === "planning" && one) {
    if (self) {
      next = [
        `Avec qui je travaille${dateRef} ?`,
        `Qui commence avec moi${dateRef} ?`,
        `Je peux échanger${dateRef} ?`,
      ];
    } else {
      next = [
        `Avec qui travaille ${name}${dateRef} ?`,
        `Coordonnées de ${name} ?`,
        canMessage(c, one) ? `Message à ${name}` : null,
        "Et vendredi ?",
      ].filter(Boolean) as string[];
    }
  } else if (r.kind === "contact" && one) {
    next = [
      `Planning de ${name} ?`,
      canMessage(c, one) ? `Message à ${name}` : null,
      /\b(numero|telephone|tel)\b/.test(normalize(raw)) ? `E-mail de ${name} ?` : `Numéro de ${name} ?`,
    ].filter(Boolean) as string[];
  } else if (r.kind === "exchange") {
    if (cards.length === 2) {
      next = ["Les 2", `Planning de ${titleOf(cards[0])} ?`, `Planning de ${titleOf(cards[1])} ?`];
    } else if (cards.length === 1) {
      next = [
        `Planning de ${titleOf(cards[0])} ?`,
        canMessage(c, cards[0]) ? `Message à ${titleOf(cards[0])}` : null,
      ].filter(Boolean) as string[];
    } else if (cards.length > 2) {
      next = cards.slice(0, 3).map((x: any) => `Planning de ${titleOf(x)} ?`);
    }
  } else if (r.kind === "organization") {
    next = [
      `Qui est en J4${dateRef} ?`,
      `Qui est sur le terrain${dateRef} ?`,
      `Avec qui je travaille${dateRef} ?`,
    ];
  } else if (r.kind === "team") {
    const rawN = normalize(raw);
    if (/\bj4\b/.test(rawN)) next = [`Qui est sur le terrain${dateRef} ?`, `Avec qui je travaille${dateRef} ?`];
    else next = [`Qui est en J4${dateRef} ?`, `Qui commence avec moi${dateRef} ?`, `Je peux échanger${dateRef} ?`];
  } else if (r.kind === "message") {
    if (one) next = [`Planning de ${name} ?`, `Coordonnées de ${name} ?`];
    else if (cards.length === 2) next = ["Les 2", `Planning de ${titleOf(cards[0])} ?`, `Planning de ${titleOf(cards[1])} ?`];
    else if (!cards.length) next = ["Qui peut recevoir un message ?"];
  } else if (r.kind === "place") {
    const title = normalize(r.title || "");
    next = title.startsWith("itineraire") ? ["Afficher le lieu"] : ["Comment y aller ?", "Afficher le bâtiment"];
  } else if (r.kind === "selection" && cards.length) {
    next = [
      "Planning",
      "Coordonnées",
      cards.every((x: any) => canMessage(c, x)) ? "Message" : null,
    ].filter(Boolean) as string[];
  }

  const candidates = unique(next.length ? next : (r.suggestions || []), 6);
  const ctx = { ...(r.context || {}) } as DialogContext;
  const previous = Array.isArray(ctx.suggestion_history) ? ctx.suggestion_history.map(normalize).filter(Boolean) : [];
  const seen = new Set([...previous, normalize(raw)]);
  const suggestions = unique(candidates.filter((s) => !seen.has(normalize(s))), 4);
  const opts = offeredOptions(suggestions);
  ctx.offered_options = opts.length && opts.length === suggestions.length ? opts : [];
  ctx.suggestion_history = unique([
    ...previous,
    normalize(raw),
    ...suggestions.map(normalize),
  ], 16).map(normalize);
  return { ...r, suggestions, context: ctx };
}
