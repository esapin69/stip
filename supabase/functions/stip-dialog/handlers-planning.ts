import { normalize, type DateScope, type DialogContext } from "./core.ts";
import { baseContext, personActions, personCard } from "./presentation.ts";
import { canon, dayLabel, db, isChief, overlaps, planningRows, shiftText, shortDay, teamOf } from "./runtime.ts";
import type { Agent, SessionCtx, ShiftDef } from "./types.ts";

export async function planningAnswer(c: SessionCtx, old: DialogContext, subjects: Agent[], ds: DateScope, defs: Record<string, ShiftDef>) {
  if (!subjects.length) subjects = [c.agent];
  const selectedDates = Array.isArray(ds.dates) && ds.dates.length ? new Set(ds.dates) : null;
  const rawRows = await planningRows(subjects.map((a) => a.id), ds.start, ds.end);
  const rows = selectedDates ? rawRows.filter((r: any) => selectedDates.has(String(r.date))) : rawRows;
  const singleDay = ds.start === ds.end;
  if (subjects.length === 1 && singleDay) {
    const a = subjects[0], r = rows.find((x: any) => String(x.agent_id) === String(a.id));
    if (!r) return {
      kind: "planning", title: `${a.nickname || a.prenom || a.nom} · ${dayLabel(ds.start)}`,
      text: "Aucun horaire n’est renseigné pour cette journée.", cards: [personCard(a)], actions: personActions(c, a),
      context: baseContext(old, { subject_agent_ids: [a.id], agent_id: a.id, date_scope: ds, last_intent: "planning" }),
    };
    const code = canon(r.code), def = defs[code];
    return {
      kind: "planning", title: `${a.nickname || a.prenom || a.nom} · ${dayLabel(ds.start)}`,
      text: def ? `${code} · ${def.label} · ${def.start_time} → ${def.end_time}` : code === "RH" ? "RH · Repos" : code,
      cards: [personCard(a, { badge: code, detail: def ? `${def.start_time} → ${def.end_time}` : code === "RH" ? "Repos" : "" })],
      actions: personActions(c, a), suggestions: ["Et vendredi ?", "Qui travaille avec lui ?"],
      context: baseContext(old, { subject_agent_ids: [a.id], agent_id: a.id, date_scope: ds, last_intent: "planning" }),
    };
  }
  const by = new Map(subjects.map((a) => [String(a.id), a]));
  const cards = rows.map((r: any) => {
    const a = by.get(String(r.agent_id)) || ({ id: r.agent_id } as Agent), code = canon(r.code), def = defs[code];
    return { type: "metric", title: `${a.nickname || a.prenom || a.nom || "Agent"} · ${shortDay(r.date)}`, subtitle: code, detail: def ? `${def.start_time} → ${def.end_time}` : code === "RH" ? "Repos" : "" };
  });
  return {
    kind: "planning", title: ds.label || `${shortDay(ds.start)} → ${shortDay(ds.end)}`,
    text: rows.length ? `${rows.length} entrée${rows.length > 1 ? "s" : ""} de planning trouvée${rows.length > 1 ? "s" : ""}.` : "Aucun planning renseigné sur cette période.",
    cards, actions: subjects.flatMap((a) => personActions(c, a, a.nickname || a.prenom || a.nom || "Agent")),
    context: baseContext(old, { subject_agent_ids: subjects.map((a) => a.id), agent_id: subjects[0]?.id, date_scope: ds, last_intent: "planning", offered_options: [] }),
  };
}

export async function colleaguesAnswer(c: SessionCtx, old: DialogContext, subject: Agent, ds: DateScope, defs: Record<string, ShiftDef>, all: Agent[], raw = "") {
  const subjectRows = await planningRows([subject.id], ds.start, ds.end);
  if (!subjectRows.length) return {
    kind: "team", title: ds.label || dayLabel(ds.start), text: "Aucun horaire n’est renseigné pour cette personne sur cette période.", cards: [], actions: [],
    context: baseContext(old, { subject_agent_ids: [subject.id], agent_id: subject.id, date_scope: ds, last_intent: "colleagues" }),
  };
  const team = teamOf(subject);
  let q = db.from("planning").select("agent_id,date,code,equipe").gte("date", ds.start).lte("date", ds.end);
  q = team === "chefs" ? q.in("equipe", ["jour", "nuit", "chefs"]) : q.eq("equipe", team);
  const { data, error } = await q;
  if (error) throw error;
  const personBy = new Map(all.map((a) => [String(a.id), a]));
  const ownByDate = new Map<string, string>(subjectRows.map((r: any) => [String(r.date), canon(r.code)]));
  const wording = normalize(raw), mode = /\bcommence\b/.test(wording) ? "start" : /\b(finit|termine)\b/.test(wording) ? "end" : "overlap";
  const matches = (data || []).filter((r: any) => {
    if (String(r.agent_id) === String(subject.id) || !ownByDate.has(r.date)) return false;
    const own = ownByDate.get(r.date)!, other = canon(r.code), A = defs[own], B = defs[other];
    if (!A || !B) return false;
    if (mode === "start") return A.start_time === B.start_time;
    if (mode === "end") return A.end_time === B.end_time;
    return overlaps(own, other, defs);
  });
  if (ds.start === ds.end) return {
    kind: "team", title: `${shiftText(ownByDate.get(ds.start) || "", defs)} · ${dayLabel(ds.start)}`,
    text: mode === "start" ? `${matches.length} collègue${matches.length > 1 ? "s" : ""} commence${matches.length > 1 ? "nt" : ""} à la même heure.` : mode === "end" ? `${matches.length} collègue${matches.length > 1 ? "s" : ""} termine${matches.length > 1 ? "nt" : ""} à la même heure.` : `${matches.length} collègue${matches.length > 1 ? "s" : ""} croise${matches.length > 1 ? "nt" : ""} ce service.`,
    cards: matches.slice(0, 20).map((r: any) => personCard(personBy.get(String(r.agent_id)) || ({ id: r.agent_id } as Agent), { badge: canon(r.code), detail: defs[canon(r.code)] ? `${defs[canon(r.code)].start_time} → ${defs[canon(r.code)].end_time}` : "" })),
    actions: [], context: baseContext(old, { subject_agent_ids: [subject.id], agent_id: subject.id, date_scope: ds, last_intent: "colleagues" }),
    suggestions: ["Qui commence avec moi ?", "Combien on est en J4 ?"],
  };
  const agg = new Map<string, { a: Agent; days: string[]; codes: string[] }>();
  for (const r of matches as any[]) {
    const a = personBy.get(String(r.agent_id)); if (!a) continue;
    const x = agg.get(String(a.id)) || { a, days: [], codes: [] };
    x.days.push(r.date); x.codes.push(canon(r.code)); agg.set(String(a.id), x);
  }
  const list = [...agg.values()].sort((a, b) => b.days.length - a.days.length);
  return {
    kind: "team", title: ds.label || `${shortDay(ds.start)} → ${shortDay(ds.end)}`,
    text: mode === "start" ? `${list.length} collègue${list.length > 1 ? "s" : ""} partage${list.length > 1 ? "nt" : ""} au moins une heure de début avec ${subject.id === c.agent.id ? "toi" : "cette personne"} sur la période.` : mode === "end" ? `${list.length} collègue${list.length > 1 ? "s" : ""} partage${list.length > 1 ? "nt" : ""} au moins une heure de fin avec ${subject.id === c.agent.id ? "toi" : "cette personne"} sur la période.` : `${list.length} collègue${list.length > 1 ? "s" : ""} croise${list.length > 1 ? "nt" : ""} ${subject.id === c.agent.id ? "tes" : "ses"} horaires sur cette période.`,
    cards: list.slice(0, 20).map((x) => personCard(x.a, { detail: `${x.days.length} jour${x.days.length > 1 ? "s" : ""} en commun · ${x.days.slice(0, 4).map((d, i) => `${shortDay(d)} ${x.codes[i]}`).join(" · ")}` })),
    actions: [], context: baseContext(old, { subject_agent_ids: [subject.id], agent_id: subject.id, date_scope: ds, last_intent: "colleagues" }),
  };
}

export async function shiftRoster(c: SessionCtx, old: DialogContext, ds: DateScope, shift: string, all: Agent[], defs: Record<string, ShiftDef>) {
  let q = db.from("planning").select("agent_id,date,code,equipe").gte("date", ds.start).lte("date", ds.end);
  q = c.team === "chefs" ? q.in("equipe", ["jour", "nuit", "chefs"]) : q.eq("equipe", c.team);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []).filter((x: any) => canon(x.code) === shift);
  const by = new Map(all.map((a) => [String(a.id), a]));
  if (ds.start === ds.end) return {
    kind: "team", title: `${shift} · ${dayLabel(ds.start)}`, text: `${rows.length} agent${rows.length > 1 ? "s" : ""} prévu${rows.length > 1 ? "s" : ""} en ${shift}.`,
    cards: rows.slice(0, 24).map((r: any) => personCard(by.get(String(r.agent_id)) || ({ id: r.agent_id } as Agent), { badge: shift, detail: defs[shift] ? `${defs[shift].start_time} → ${defs[shift].end_time}` : "" })),
    actions: [], context: baseContext(old, { date_scope: ds, last_intent: "shift_roster" }), suggestions: ["Et en J4 ?", "Qui est avec moi ?"],
  };
  const agg = new Map<string, { a: Agent; days: string[] }>();
  for (const r of rows as any[]) {
    const a = by.get(String(r.agent_id)); if (!a) continue;
    const x = agg.get(String(a.id)) || { a, days: [] }; x.days.push(r.date); agg.set(String(a.id), x);
  }
  const list = [...agg.values()].sort((a, b) => b.days.length - a.days.length);
  return {
    kind: "team", title: `${shift} · ${ds.label || `${shortDay(ds.start)} → ${shortDay(ds.end)}`}`,
    text: `${list.length} agent${list.length > 1 ? "s" : ""} passe${list.length > 1 ? "nt" : ""} par le shift ${shift} sur la période.`,
    cards: list.slice(0, 24).map((x) => personCard(x.a, { badge: shift, detail: x.days.map(shortDay).join(" · ") })), actions: [],
    context: baseContext(old, { date_scope: ds, last_intent: "shift_roster" }),
  };
}

export async function onDutyRoster(c: SessionCtx, old: DialogContext, ds: DateScope, all: Agent[], defs: Record<string, ShiftDef>) {
  let q = db.from("planning").select("agent_id,date,code,equipe").gte("date", ds.start).lte("date", ds.end);
  q = c.team === "chefs" ? q.in("equipe", ["jour", "nuit", "chefs"]) : q.eq("equipe", c.team);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []).filter((x: any) => !!defs[canon(x.code)]);
  const by = new Map(all.map((a) => [String(a.id), a]));
  if (ds.start === ds.end) return {
    kind: "team", title: `Sur le terrain · ${dayLabel(ds.start)}`,
    text: `${rows.length} agent${rows.length > 1 ? "s" : ""} a${rows.length > 1 ? "uront" : "ura"} un shift de travail renseigné ce jour-là.`,
    cards: rows.slice(0, 30).map((r: any) => {
      const code = canon(r.code), def = defs[code];
      return personCard(by.get(String(r.agent_id)) || ({ id: r.agent_id } as Agent), { badge: code, detail: def ? `${def.start_time} → ${def.end_time}` : "" });
    }),
    actions: [], context: baseContext(old, { date_scope: ds, last_intent: "on_duty" }),
  };
  const agg = new Map<string, { a: Agent; entries: Array<{ date: string; code: string }> }>();
  for (const r of rows as any[]) {
    const a = by.get(String(r.agent_id)); if (!a) continue;
    const x = agg.get(String(a.id)) || { a, entries: [] };
    x.entries.push({ date: r.date, code: canon(r.code) }); agg.set(String(a.id), x);
  }
  const list = [...agg.values()].sort((a, b) => b.entries.length - a.entries.length);
  return {
    kind: "team", title: `Sur le terrain · ${ds.label || `${shortDay(ds.start)} → ${shortDay(ds.end)}`}`,
    text: `${list.length} agent${list.length > 1 ? "s" : ""} possède${list.length > 1 ? "nt" : ""} au moins un shift de travail sur la période.`,
    cards: list.slice(0, 30).map((x) => personCard(x.a, { detail: x.entries.slice(0, 5).map((e) => `${shortDay(e.date)} ${e.code}`).join(" · ") })),
    actions: [], context: baseContext(old, { date_scope: ds, last_intent: "on_duty" }),
  };
}

export async function organizationAnswer(c: SessionCtx, old: DialogContext, ds: DateScope) {
  if (c.level !== "pro") return { kind: "help", title: "Organisation", text: "Les chiffres d’organisation étendus ne sont pas disponibles avec cet accès.", cards: [], actions: [], context: baseContext(old, { date_scope: ds, last_intent: "organization" }) };
  if (ds.start !== ds.end) return {
    kind: "help", title: ds.label || "Période", text: "Pour les effectifs, donne-moi un jour précis afin de comparer les planifiés à la référence HCL datée.", cards: [], actions: [],
    context: baseContext(old, { date_scope: ds, last_intent: "organization" }), suggestions: [`Effectif le ${dayLabel(ds.start)} ?`],
  };
  const { data, error } = await db.from("stip_staffing_advice").select("metric,shift_code,target_count,planned_count,gap,severity,status,guidance").eq("reference_date", ds.start).eq("equipe", c.team).order("severity", { ascending: false });
  if (error) throw error;
  const rows = data || [], shifts = rows.filter((x: any) => x.metric === "shift"), total = shifts.reduce((v: number, x: any) => v + Number(x.planned_count || 0), 0);
  return {
    kind: "organization", title: `Organisation · ${dayLabel(ds.start)}`,
    text: rows.length ? `${total} agents comptés sur les horaires de référence. ${rows.some((x: any) => x.status === "below_reference") ? "Au moins un créneau est sous la référence datée." : "Aucun créneau sous la référence datée dans les données actuelles."}` : "Aucune référence d’effectif n’est disponible pour cette date.",
    cards: shifts.map((x: any) => ({ type: "metric", title: x.shift_code || x.metric, subtitle: `${x.planned_count} / ${x.target_count}`, detail: Number(x.gap) === 0 ? "Référence atteinte" : Number(x.gap) > 0 ? `+${x.gap}` : String(x.gap), severity: x.severity })),
    actions: [], context: baseContext(old, { date_scope: ds, last_intent: "organization" }), suggestions: ["Qui est en J4 ?", "Qui est sur le terrain ?"],
  };
}

export async function exchangeAnswer(c: SessionCtx, old: DialogContext, ds: DateScope, desired: string | null, all: Agent[], defs: Record<string, ShiftDef>) {
  const selectedDates = Array.isArray(ds.dates) && ds.dates.length ? new Set(ds.dates) : null;
  const rawMyRows = await planningRows([c.agent.id], ds.start, ds.end);
  const myRows = selectedDates ? rawMyRows.filter((r: any) => selectedDates.has(String(r.date))) : rawMyRows;
  const workRows = myRows.filter((r: any) => defs[canon(r.code)]);
  if (!workRows.length) return { kind: "exchange", title: ds.label || "Échange", text: "Je ne trouve aucun shift de travail à échanger sur cette période.", cards: [], actions: [], context: baseContext(old, { date_scope: ds, last_intent: "exchange" }) };
  const team = c.team === "chefs" ? "jour" : c.team;
  const { data, error } = await db.from("planning").select("agent_id,date,code,equipe").eq("equipe", team).gte("date", ds.start).lte("date", ds.end);
  if (error) throw error;
  const by = new Map(all.map((a) => [String(a.id), a]));
  const eligibleRows = (data || []).filter((r: any) => {
    const a = by.get(String(r.agent_id));
    return (!selectedDates || selectedDates.has(String(r.date))) && a && String(a.id) !== String(c.agent.id) && !isChief(a);
  });
  if (!desired) {
    const cards = workRows.map((r: any) => {
      const current = canon(r.code), counts = new Map<string, number>();
      for (const x of eligibleRows.filter((y: any) => y.date === r.date)) {
        const code = canon(x.code);
        if (!defs[code] || code === current) continue;
        counts.set(code, (counts.get(code) || 0) + 1);
      }
      const detail = [...counts.entries()].map(([code, n]) => `${code}: ${n}`).join(" · ") || "Aucun autre shift disponible";
      return { type: "metric", title: shortDay(r.date), subtitle: `Ton shift : ${current}`, detail };
    });
    const first = workRows[0], currentFirst = canon(first.code);
    const availableCodes = [...new Set(
      eligibleRows.filter((x: any) => x.date === first.date).map((x: any) => canon(x.code))
        .filter((code: string) => !!defs[code] && code !== currentFirst),
    )];
    const suggestions = availableCodes.slice(0, 3).map((x) => `Échanger en ${x} le ${dayLabel(first.date)}`);
    return {
      kind: "exchange", title: ds.label || "Échange de planning",
      text: workRows.length === 1 ? "Je connais ton shift ce jour-là. Choisis le shift souhaité et je te donnerai uniquement les collègues compatibles." : "Je te montre tes jours de travail sur la période. Indique le jour et le shift souhaité pour obtenir les collègues compatibles.",
      cards, actions: [], suggestions,
      context: baseContext(old, { date_scope: ds, last_intent: "exchange", offered_options: [] }),
    };
  }
  const daysToExchange: string[] = workRows.filter((r: any) => canon(r.code) !== desired).map((r: any) => String(r.date));
  if (!daysToExchange.length) return { kind: "exchange", title: "Échange", text: `Tu es déjà en ${desired} sur les jours concernés.`, cards: [], actions: [], context: baseContext(old, { date_scope: ds, last_intent: "exchange" }) };
  const candidateMap = new Map<string, { a: Agent; days: Set<string> }>();
  for (const r of eligibleRows as any[]) {
    if (!daysToExchange.includes(r.date) || canon(r.code) !== desired) continue;
    const a = by.get(String(r.agent_id))!;
    const x = candidateMap.get(String(a.id)) || { a, days: new Set<string>() };
    x.days.add(r.date); candidateMap.set(String(a.id), x);
  }
  const candidates = [...candidateMap.values()].filter((x) => daysToExchange.every((d) => x.days.has(d)));
  return {
    kind: "exchange", title: `Échange vers ${desired} · ${ds.label || (ds.start === ds.end ? dayLabel(ds.start) : `${shortDay(ds.start)} → ${shortDay(ds.end)}`)}`,
    text: candidates.length ? `${candidates.length} collègue${candidates.length > 1 ? "s" : ""} compatible${candidates.length > 1 ? "s" : ""} selon les données d’éligibilité disponibles dans STIP. Aucune demande n’est envoyée automatiquement.` : "Aucun collègue compatible n’est trouvé pour ce shift sur toute la sélection.",
    cards: candidates.slice(0, 24).map((x) => personCard(x.a, { badge: desired, detail: daysToExchange.map(shortDay).join(" · ") })), actions: [],
    context: baseContext(old, { date_scope: ds, last_intent: "exchange", last_choice_ids: candidates.map((x) => x.a.id), last_choice_kind: "agent" }),
  };
}
