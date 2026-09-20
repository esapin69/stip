export type DateScope = { start: string; end: string; label?: string; dates?: string[] };
export type DialogContext = {
  version?: number;
  subject_agent_ids?: string[];
  agent_id?: string;
  date_scope?: DateScope;
  date?: string;
  last_intent?: string;
  last_choice_ids?: string[];
  last_choice_kind?: "agent" | "option";
  offered_options?: string[];
  suggestion_history?: string[];
  place_id?: string;
};
export type Intent =
  | "selection"
  | "messaging_help"
  | "request_help"
  | "exchange"
  | "contact"
  | "place"
  | "organization"
  | "colleagues"
  | "on_duty"
  | "shift_roster"
  | "planning"
  | "person"
  | "help";

const MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
};
const DAYS: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

export function normalize(v: unknown) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9@+/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isoUTC(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d, 12)).toISOString().slice(0, 10);
}
function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}
export function addDays(iso: string, n: number) {
  const p = parts(iso);
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n, 12));
  return d.toISOString().slice(0, 10);
}
function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
}
function monthFromToken(token?: string) {
  return token ? MONTHS[normalize(token)] || 0 : 0;
}
function mondayOf(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  const dow = d.getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
}
function monthYear(month: number, baseIso: string, explicitYear?: number) {
  if (explicitYear) return explicitYear;
  const b = parts(baseIso);
  return month < b.m ? b.y + 1 : b.y;
}
function validIsoDate(y: number, m: number, d: number) {
  if (!y || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return isoUTC(y, m, d);
}
function scope(start: string, end = start, label?: string): DateScope {
  return { start, end, ...(label ? { label } : {}) };
}

export function parseDateScope(raw: string, baseIso: string, ctx?: DialogContext): DateScope | null {
  const q = normalize(raw);
  const contextScope = ctx?.date_scope || (ctx?.date ? scope(ctx.date) : null);
  const base = parts(baseIso);

  if (contextScope && /\b(ce jour la|ce jour|ce meme jour|ce meme jour la)\b/.test(q)) return contextScope;

  let m = q.match(/\bdu\s+(\d{1,2})\s+(?:au|a)\s+(\d{1,2})\s+([a-z]+)(?:\s+(20\d{2}))?\b/);
  if (m) {
    const month = monthFromToken(m[3]);
    const year = monthYear(month, baseIso, m[4] ? Number(m[4]) : undefined);
    const start = validIsoDate(year, month, Number(m[1]));
    const end = validIsoDate(year, month, Number(m[2]));
    if (start && end && end >= start) return scope(start, end, `du ${m[1]} au ${m[2]} ${m[3]}`);
  }

  m = q.match(/\bderniere\s+semaine\s+(?:de|du)\s+([a-z]+)(?:\s+(20\d{2}))?\b/);
  if (m) {
    const month = monthFromToken(m[1]);
    const year = monthYear(month, baseIso, m[2] ? Number(m[2]) : undefined);
    if (month) {
      const last = isoUTC(year, month, daysInMonth(year, month));
      const mon = mondayOf(last);
      const monthStart = isoUTC(year, month, 1);
      return scope(mon < monthStart ? monthStart : mon, last, `dernière semaine de ${m[1]}`);
    }
  }

  m = q.match(/\bfin\s+([a-z]+)(?:\s+(20\d{2}))?\b/);
  if (m) {
    const month = monthFromToken(m[1]);
    const year = monthYear(month, baseIso, m[2] ? Number(m[2]) : undefined);
    if (month) {
      const lastDay = daysInMonth(year, month);
      return scope(isoUTC(year, month, Math.max(1, lastDay - 6)), isoUTC(year, month, lastDay), `fin ${m[1]}`);
    }
  }

  if (/\bsemaine\s+prochaine\b/.test(q)) {
    const start = addDays(mondayOf(baseIso), 7);
    return scope(start, addDays(start, 6), "semaine prochaine");
  }
  if (/\bcette\s+semaine\b/.test(q)) {
    const start = mondayOf(baseIso);
    return scope(start, addDays(start, 6), "cette semaine");
  }

  m = q.match(/\bsemaine\s+(?:du|de)\s+(\d{1,2})(?:\s+([a-z]+))?(?:\s+(20\d{2}))?\b/);
  if (m) {
    const month = m[2] ? monthFromToken(m[2]) : base.m;
    const year = monthYear(month, baseIso, m[3] ? Number(m[3]) : undefined);
    const d = validIsoDate(year, month, Number(m[1]));
    if (d) {
      const start = mondayOf(d);
      return scope(start, addDays(start, 6), `semaine du ${m[1]}${m[2] ? " " + m[2] : ""}`);
    }
  }

  m = q.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](20\d{2}|\d{2}))?\b/);
  if (m) {
    let year = m[3] ? Number(m[3]) : base.y;
    if (year < 100) year += 2000;
    const d = validIsoDate(year, Number(m[2]), Number(m[1]));
    if (d) return scope(d, d);
  }

  m = q.match(/\b(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(20\d{2}))?\b/);
  if (m) {
    const month = monthFromToken(m[2]);
    const year = monthYear(month, baseIso, m[3] ? Number(m[3]) : undefined);
    const d = validIsoDate(year, month, Number(m[1]));
    if (d) return scope(d, d);
  }

  if (/\baujourd\s+hui\b/.test(q)) return scope(baseIso);
  if (/\bapres\s+demain\b/.test(q)) return scope(addDays(baseIso, 2));
  if (/\bdemain\b/.test(q)) return scope(addDays(baseIso, 1));
  if (/\bhier\b/.test(q)) return scope(addDays(baseIso, -1));
  m = q.match(/\bdans\s+(\d{1,2})\s+jours?\b/);
  if (m) return scope(addDays(baseIso, Math.min(60, Number(m[1]))));

  for (const [name, dow] of Object.entries(DAYS)) {
    if (!new RegExp(`\\b${name}\\b`).test(q)) continue;
    const followUp = /^et\b/.test(q) && contextScope;
    const anchor = followUp ? contextScope!.start : baseIso;
    const d = new Date(anchor + "T12:00:00Z");
    let delta = (dow - d.getUTCDay() + 7) % 7;
    if (delta === 0 && !/\bce\s+/.test(q)) delta = 7;
    return scope(addDays(anchor, delta));
  }

  return contextScope || null;
}

export function extractShift(raw: string) {
  const q = normalize(raw).toUpperCase();
  const m = q.match(/(?:^|\s)(J4|M|J|S|N|RH)(?=$|\s)/);
  if (m) return m[1];
  if (/\bMATIN\b/.test(q)) return "M";
  if (/\bJOURNEE\b/.test(q)) return "J";
  if (/\bSOIR\b/.test(q)) return "S";
  if (/\bNUIT\b/.test(q)) return "N";
  if (/\bREPOS\b/.test(q)) return "RH";
  return null;
}

export function selectionCount(raw: string) {
  const q = normalize(raw);
  if (/^(?:les deux|tous les deux|tous deux)$/.test(q) || /^les\s+2$/.test(q)) return 2;
  if (/^(?:les trois|tous les trois|tous trois)$/.test(q) || /^les\s+3$/.test(q)) return 3;
  return null;
}

export function hasContextualPersonRef(raw: string) {
  const q = normalize(raw);
  return /\b(il|elle|lui|eux|elles|son|sa|ses|leur|leurs)\b/.test(q);
}

export function classifyIntent(raw: string): Intent {
  const q = normalize(raw);
  if (selectionCount(raw)) return "selection";
  if (/\b(chat|messagerie|systeme de chat|systeme de message|messages? stip|discuter ici|ecrire a quelqu un|envoyer un message)\b/.test(q)) return "messaging_help";
  if (/\b(conge|conges|poser (?:un |des )?conges?|demande de conge|absence|demander (?:un )?repos|poser (?:un )?repos)\b/.test(q)) return "request_help";
  if (/\b(echange|echanger|permuter|permutation|changer mon shift|changer mon horaire|changer mon planning)\b/.test(q)) return "exchange";
  if (/\b(numero|telephone|tel|mail|email|e mail|coordonnees?|adresse professionnelle)\b/.test(q)) return "contact";
  if (/\b(ou est|ou se trouve|comment aller|comment y aller|batiment|ascenseur|irm|imagerie|service|lieu|etage)\b/.test(q)) return "place";
  if (/\b(combien|effectif|besoin|organisation|couverture|reference hcl)\b/.test(q)) return "organization";
  if (/\b(avec qui|qui travaille avec|qui commence avec|qui finit avec|qui croise|qui est avec|qui sont avec|qui avec moi|je suis avec)\b/.test(q)) return "colleagues";
  if (/\b(sur le terrain|qui travaille(?:\s+(?:aujourd hui|demain|apres demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche))?|qui est present|qui est presente|qui sont presents|qui sont presentes)\b/.test(q)) return "on_duty";
  if (/\bqui\b/.test(q) && extractShift(raw)) return "shift_roster";
  if (/\b(horaire|planning|shift|poste|travaille|travail|quand|je suis de quoi|je suis quoi|je fais quoi)\b/.test(q) || /\b(aujourd hui|demain|apres demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/.test(q)) return "planning";
  if (/\b(qui est|trouve|recherche|chercher)\b/.test(q)) return "person";
  return "help";
}

export function isSelfPlanning(raw: string) {
  const q = normalize(raw);
  return /\b(je|moi|mon|ma|mes)\b/.test(q) && /\b(horaire|planning|shift|poste|travaille|travail|quoi|fais|suis)\b/.test(q);
}

export function offeredOptionIntent(raw: string, options: string[] = []) {
  const q = normalize(raw);
  const matches = options.filter((x) => {
    const n = normalize(x);
    if (n === "planning") return /\b(planning|horaire|shift|poste)\b/.test(q);
    if (n === "coordonnees") return /\b(coordonnees|numero|telephone|tel|mail|email)\b/.test(q);
    if (n === "message") return /\b(message|ecrire|contacter)\b/.test(q);
    return q === n;
  });
  return matches.length === 1 ? matches[0] : null;
}
