(() => {
  "use strict";
  let rows = [];
  let byCode = new Map();

  function clean(raw) {
    return String(raw ?? "").trim().toUpperCase().replace(/\*+$/, "");
  }

  function inferredBase(code) {
    if (/^J4\d+$/.test(code)) return "J4";
    if (/^M\d+$/.test(code)) return "M";
    if (/^J\d+$/.test(code)) return "J";
    if (/^S\d+$/.test(code)) return "S";
    if (/^N\d+$/.test(code)) return "N";
    return "";
  }

  function set(next) {
    rows = Array.isArray(next) ? next.filter(Boolean) : [];
    byCode = new Map(
      rows.map((row) => [clean(row?.code), row]).filter(([code]) => code),
    );
    window.dispatchEvent(
      new CustomEvent("stip:shift-registry-updated", { detail: rows }),
    );
    return api;
  }

  function resolve(raw) {
    const code = clean(raw);
    if (!code) return null;
    const exact = byCode.get(code);
    if (exact) return exact;
    const base = inferredBase(code);
    return base ? byCode.get(base) || null : null;
  }

  function baseCode(raw) {
    const row = resolve(raw);
    return clean(row?.base_code || row?.code || raw) || "—";
  }

  function label(raw) {
    const row = resolve(raw);
    return String(row?.label || clean(raw) || "—");
  }

  function icon(raw) {
    return String(resolve(raw)?.icon || "");
  }

  function family(raw) {
    return String(resolve(raw)?.family || "other");
  }

  function kind(raw) {
    return String(resolve(raw)?.kind || "other");
  }

  function isWorking(raw) {
    return Boolean(resolve(raw)?.is_working);
  }

  function color(raw, fallback = "#277b86") {
    return String(resolve(raw)?.color_hex || fallback);
  }

  function hhmm(value) {
    const v = String(value || "").slice(0, 5);
    return v ? v.replace(":", "h") : "";
  }

  function time(raw) {
    const row = resolve(raw);
    if (!row) return "";
    const special = String(row.schedule_mode || "standard") !== "standard";
    const start = hhmm(special ? row.window_start : row.start_time);
    const end = hhmm(special ? row.window_end : row.end_time);
    if (!start || !end)
      return special ? String(row.source_label || "Horaire adapté") : "";
    if (special && String(row.schedule_mode) === "flexible") {
      const n = Number(row.duration_minutes || 0);
      const h = n ? Math.floor(n / 60) : 0;
      const m = n ? n % 60 : 0;
      const duration = n
        ? m
          ? `${h}h${String(m).padStart(2, "0")}`
          : `${h}h`
        : "Durée spécifique";
      return `${duration} · libre entre ${start} et ${end}`;
    }
    return `${start}–${end}${special ? " · fixe" : ""}`;
  }

  function all() {
    return rows.slice();
  }

  const api = {
    set,
    all,
    resolve,
    clean,
    baseCode,
    label,
    icon,
    family,
    kind,
    isWorking,
    color,
    time,
  };

  window.STIPShiftRegistry = api;
  if (window.STIPBootCache?.shift_definitions)
    set(window.STIPBootCache.shift_definitions);
  window.addEventListener("stip:boot-updated", (event) => {
    if (event?.detail?.shift_definitions) set(event.detail.shift_definitions);
  });
})();