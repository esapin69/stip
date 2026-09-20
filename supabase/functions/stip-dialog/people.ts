import { normalize } from "./core.ts";

export type AgentLike = {
  id: string;
  source_key?: string | null;
  prenom?: string | null;
  nom?: string | null;
  nickname?: string | null;
  [key: string]: unknown;
};

export type PersonResolution<T extends AgentLike = AgentLike> = {
  mode: "explicit" | "context" | "none";
  candidates: T[];
  score: number;
};

const RESERVED = new Set([
  "chat", "message", "messages", "messagerie", "systeme", "planning", "horaire", "shift",
  "demain", "aujourd", "hui", "apres", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
  "numero", "telephone", "mail", "email", "service", "batiment", "ascenseur", "irm", "imagerie", "effectif", "organisation",
  "echange", "echanger", "avec", "qui", "quoi", "moi", "mon", "ma", "mes", "son", "sa", "ses", "lui", "elle", "il",
  "les", "deux", "trois", "tous", "toutes", "dans", "pour", "une", "des", "est", "suis", "peux", "peut", "til", "ici",
]);

function phraseHit(q: string, alias: string) {
  return (` ${q} `).includes(` ${alias} `);
}

function aliases(a: AgentLike) {
  const first = normalize(a.prenom || "");
  const last = normalize(a.nom || "");
  const nick = normalize(a.nickname || "");
  const out: Array<{ value: string; score: number }> = [];
  if (nick.length >= 2) out.push({ value: nick, score: 120 });
  if (first && last) {
    out.push({ value: `${first} ${last}`, score: 115 });
    out.push({ value: `${last} ${first}`, score: 112 });
  }
  if (last.length >= 3) out.push({ value: last, score: 95 });
  if (first.length >= 3) out.push({ value: first, score: 85 });
  const source = normalize(a.source_key || "");
  if (source.length >= 4 && /[a-z]/.test(source)) out.push({ value: source, score: 70 });
  return out;
}

export function resolvePeople<T extends AgentLike>(raw: string, all: T[], contextIds: string[] = [], allowContext = false): PersonResolution<T> {
  const q = normalize(raw);
  const tokens = q.split(" ").filter(Boolean);
  const scored = all.map((a) => {
    let score = 0;
    for (const al of aliases(a)) {
      if (phraseHit(q, al.value)) score = Math.max(score, al.score);
      if (!al.value.includes(" ") && al.value.length >= 4) {
        for (const t of tokens) {
          if (t.length < 4 || RESERVED.has(t)) continue;
          if (al.value.startsWith(t) || t.startsWith(al.value)) score = Math.max(score, 55);
        }
      }
    }
    return { a, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);

  const top = scored[0]?.score || 0;
  if (top > 0) return { mode: "explicit", candidates: scored.filter((x) => x.score === top).map((x) => x.a).slice(0, 8), score: top };

  if (allowContext && contextIds.length) {
    const set = new Set(contextIds.map(String));
    const candidates = all.filter((a) => set.has(String(a.id)));
    if (candidates.length) return { mode: "context", candidates, score: 100 };
  }
  return { mode: "none", candidates: [], score: 0 };
}
