// STIP — Lecture sémantique du bloc d'effectifs. Source unique pour l'import cadre.
// Aucun calcul ne doit déduire une cible du seul aspect visuel ou d'une colonne sans titre.
const norm = value => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const compact = value => norm(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const numeric = value => {
  const s = norm(value);
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n >= 0 && n <= 200 ? n : null;
};
const weekDay = iso => new Date(iso + "T12:00:00Z").getUTCDay();
const codeAt = value => {
  const v = norm(value).toUpperCase();
  return /^(M|J|J4|S|N)$/.test(v) ? v : null;
};
const expectedCode = value => {
  const match = norm(value).match(/\b(J4|M|J|S|N)\s*\(\s*\d+\s*\)/i);
  return match ? match[1].toUpperCase() : null;
};

export function parseStaffingReferences(rows, sourceSheet, dateCols) {
  const refs = [];
  const add = (d, metric, shift, target, row, label, source, extra = {}) => {
    if (target === null) return;
    refs.push({
      reference_date: d.date, metric, shift_code: shift, target_count: target,
      source_sheet: sourceSheet, source_row: row + 1, source_label: label,
      raw_payload: { source, header_column: d.col + 1, ...extra }
    });
  };
  const cellValues = row => (row || []).map(norm);
  const lineHas = (row, match) => cellValues(row).some(cell => match.test(compact(cell)));
  const cumulIndex = rows.findIndex(row => lineHas(row, /cumul\s+par\s+horaire/));
  const expectedIndex = rows.findIndex(row => lineHas(row, /^attendu\s*:?$/));

  // La zone CUMUL contient les résultats programmés, PAS les besoins attendus.
  const actualByCode = new Map();
  let actualTotal = -1;
  if (cumulIndex >= 0) {
    const end = expectedIndex > cumulIndex ? expectedIndex : Math.min(rows.length, cumulIndex + 35);
    for (let r = cumulIndex + 1; r < end; r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const code = codeAt(row[c]);
        if (code && !actualByCode.has(code)) actualByCode.set(code, { row: r, label: norm(row[c - 1]) });
        if (norm(row[c]).toUpperCase() === "TOTAL") actualTotal = r;
      }
    }
  }
  const displayed = (d, code) => {
    const entry = actualByCode.get(code);
    return entry ? numeric((rows[entry.row] || [])[d.col]) : null;
  };
  const displayedTotal = d => actualTotal >= 0 ? numeric((rows[actualTotal] || [])[d.col]) : null;

  // Novembre 2026 : mini-tableau ATTENDU, à emplacement variable.
  // Le second chiffre de SEMAINE sans en-tête (35 / 32) est AMBIGU : ne jamais lui inventer un sens.
  if (expectedIndex >= 0) {
    const headerEnd = Math.min(rows.length, expectedIndex + 4);
    let headers = null;
    for (let r = expectedIndex; r < headerEnd; r++) {
      const candidates = new Map();
      cellValues(rows[r]).forEach((value, col) => {
        const label = compact(value);
        if (/^samedi\b/.test(label)) candidates.set("samedi", col);
        else if (/^dimanche\b/.test(label)) candidates.set("dimanche", col);
        else if (/^semaine\b/.test(label)) candidates.set("semaine", col);
      });
      if (candidates.has("samedi") && candidates.has("dimanche") && candidates.has("semaine")) {
        headers = { row: r, cols: candidates };
        break;
      }
    }
    if (!headers) return []; // ATTENDU non interprétable : surtout pas de fausse référence.
    const groupTargets = { samedi: new Map(), dimanche: new Map(), semaine: new Map() };
    const groupTotals = { samedi: null, dimanche: null, semaine: null };
    let weekAlternative = null;
    const weekCol = headers.cols.get("semaine");
    const altHeader = compact((rows[headers.row] || [])[weekCol + 1]);
    const unlabeledAlt = !altHeader;
    for (let r = headers.row + 1; r < Math.min(rows.length, headers.row + 11); r++) {
      const row = rows[r] || [];
      const code = row.map(expectedCode).find(Boolean);
      const first = norm(row[0]);
      if (/^cumul\b|^attendu\b/i.test(first)) break;
      const values = Object.fromEntries([...headers.cols].map(([group, col]) => [group, numeric(row[col])]));
      if (code) {
        for (const [group, count] of Object.entries(values)) {
          if (count !== null) groupTargets[group].set(code, { count, row: r, label: norm(row.find(x => expectedCode(x)) || code) });
        }
      } else if (!first && Object.values(values).some(v => v !== null)) {
        for (const [group, count] of Object.entries(values)) {
          if (count !== null) groupTotals[group] = { count, row: r, label: "ATTENDU · total" };
        }
        if (unlabeledAlt) weekAlternative = numeric(row[weekCol + 1]);
      }
    }
    for (const d of dateCols) {
      const day = weekDay(d.date);
      const group = day === 6 ? "samedi" : day === 0 ? "dimanche" : "semaine";
      for (const [code, target] of groupTargets[group]) {
        add(d, "shift", code, target.count, target.row, target.label, "attendu",
          { displayed_count: displayed(d, code), reference_group: group });
      }
      const total = groupTotals[group];
      if (total) add(d, "total", null, total.count, total.row, total.label, "attendu", {
        displayed_count: displayedTotal(d), reference_group: group,
        ...(group === "semaine" && weekAlternative !== null
          ? { ambiguous_alternative: weekAlternative, ambiguous_column: weekCol + 2 }
          : {})
      });
    }
    return refs;
  }

  // Ancienne présentation : repères "M (12)", "Samedi 5/3/4 = 12" sous CUMUL.
  if (cumulIndex < 0) return [];
  const weekdayTargets = new Map();
  let saturday = null, sunday = null;
  for (let r = cumulIndex; r < Math.min(rows.length, cumulIndex + 36); r++) {
    const row = rows[r] || [], parts = cellValues(row);
    for (const part of parts) {
      const m = part.match(/\b(J4|M|J|S|N)\s*\(\s*(\d+)\s*\)/i);
      if (m) weekdayTargets.set(m[1].toUpperCase(), { count: +m[2], row: r, label: part });
    }
    const label = parts.join(" ");
    let m = label.match(/samedi\s*:?\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\s*=\s*(\d+)/i);
    if (m) saturday = { morning: +m[1], middle: +m[2], evening: +m[3], total: +m[4], row: r, label };
    m = label.match(/dimanche\s*:?\s*(\d+)\s*\/\s*(\d+)\s*=\s*(\d+)/i);
    if (m) sunday = { morning: +m[1], evening: +m[2], total: +m[3], row: r, label };
  }
  for (const d of dateCols) {
    const dow = weekDay(d.date);
    if (dow === 6 && saturday) {
      add(d, "shift", "M", saturday.morning, saturday.row, saturday.label, "cumul_legacy");
      add(d, "middle_combined", null, saturday.middle, saturday.row, saturday.label, "cumul_legacy");
      add(d, "shift", "S", saturday.evening, saturday.row, saturday.label, "cumul_legacy");
      add(d, "total", null, saturday.total, saturday.row, saturday.label, "cumul_legacy");
    } else if (dow === 0 && sunday) {
      add(d, "shift", "M", sunday.morning, sunday.row, sunday.label, "cumul_legacy");
      add(d, "shift", "S", sunday.evening, sunday.row, sunday.label, "cumul_legacy");
      add(d, "total", null, sunday.total, sunday.row, sunday.label, "cumul_legacy");
    } else {
      for (const [code, target] of weekdayTargets)
        add(d, "shift", code, target.count, target.row, target.label, "cumul_legacy",
          { displayed_count: displayed(d, code) });
    }
  }
  return refs;
}
