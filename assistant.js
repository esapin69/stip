(() => {
  "use strict";
  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-assistant",
    STORE = "stip_session_v1";
  const navigationState = window.STIPNav?.read?.() || {};
  let items = [],
    activeFilter = ["all", "decision", "anticipation", "opportunity"].includes(
      navigationState.filter,
    )
      ? navigationState.filter
      : "all";
  const $ = (s) => document.querySelector(s),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  function iso(d) {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Europe/Paris",
    }).format(d);
  }
  function fmtDate(s) {
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
        .format(new Date(String(s).slice(0, 10) + "T12:00:00"))
        .replace(/\./g, "");
    } catch {
      return s || "";
    }
  }
  function label(x) {
    if (x.severity >= 4) return "🚨 CRITIQUE";
    if (x.severity >= 3) return "⚠️ À DÉCIDER";
    if (x.severity >= 2) return "⚠️ À ANTICIPER";
    if (x.kind === "opportunity" || x.kind === "proposal") return "OPPORTUNITÉ";
    return "INFORMATION";
  }
  function group(x) {
    if (x.severity >= 3) return "decision";
    if (x.kind === "opportunity" || x.kind === "proposal") return "opportunity";
    if (x.kind === "anticipation" || x.kind === "warning")
      return "anticipation";
    return "info";
  }
  function confidence(x) {
    if (x.source_family === "strategy" || x.kind === "proposal")
      return "Piste à vérifier";
    if (x.source_family === "staffing" || x.source_family === "compound")
      return "Comparaison automatique avec la référence HCL";
    if (x.context) return "Conclusion étayée";
    return "Fait détecté";
  }
  function normalizeShift(v) {
    const s = String(v || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    if (["M", "MATIN"].includes(s)) return "Matin · M";
    if (["J", "JOUR", "JOURNEE", "JOURNÉE"].includes(s)) return "Journée · J";
    if (["J4"].includes(s)) return "J4";
    if (["S", "SOIR"].includes(s)) return "Soir · S";
    if (["N", "NUIT"].includes(s)) return "Nuit · N";
    return "";
  }
  function scope(x) {
    const c = x?.context || {};
    for (const k of [
      "shift",
      "shift_code",
      "code",
      "horaire",
      "period",
      "periode",
      "période",
      "plage",
    ]) {
      const s = normalizeShift(c[k]);
      if (s) return s;
    }
    const hay = [x?.title, x?.body, c?.label, c?.name]
      .filter(Boolean)
      .join(" ");
    const m = hay.match(/(?:^|\s|[·:()\-])(J4|M|J|S|N)(?=$|\s|[·:()\-])/i);
    if (m) return normalizeShift(m[1]);
    if (x?.source_family === "staffing" || x?.source_family === "compound")
      return "Journée · total";
    return "";
  }
  function why(x) {
    const c = x.context;
    if (!c)
      return (
        x.body ||
        "Cette observation provient des données disponibles dans STIP."
      );
    if (x.source_family === "staffing")
      return `Référence HCL : ${c.target_count ?? "—"} · planifiés : ${c.planned_count ?? "—"} · écart : ${Number(c.gap) > 0 ? "+" : ""}${c.gap ?? "—"}${c.source_file_name ? " · source : " + c.source_file_name : ""}`;
    if (x.source_family === "compound")
      return `Lecture globale : ${c.planned_total ?? "—"} planifiés / ${c.target_total ?? "—"} de référence · écart ${Number(c.gap_total) > 0 ? "+" : ""}${c.gap_total ?? "—"}${c.shortage_lines ? ` · ${c.shortage_lines} créneau(x) sous référence` : ""}`;
    const parts = [];
    for (const [k, v] of Object.entries(c)) {
      if (v == null || typeof v === "object" || k.includes("id")) continue;
      const n = k.replaceAll("_", " ");
      parts.push(`${n} : ${v}`);
      if (parts.length === 5) break;
    }
    return parts.length
      ? parts.join(" · ")
      : x.body || "Données STIP croisées.";
  }
  function coverage(x) {
    const c = x.context || {};
    const planned = c.planned_count ?? c.planned_total,
      target = c.target_count ?? c.target_total,
      gap = c.gap ?? c.gap_total;
    if (planned == null || target == null) return "";
    const g = Number(gap || 0),
      cls =
        g < 0
          ? x.severity >= 4
            ? "critical"
            : "under"
          : g > 0
            ? "over"
            : "ok";
    return `<div class="as-coverage ${cls}"><span><small>Planifié</small><b>${esc(planned)}</b></span><span><small>Référence HCL</small><b>${esc(target)}</b></span><span><small>Écart</small><b>${esc((g > 0 ? "+" : "") + g)}</b></span></div>`;
  }
  function renderCard(x) {
    const sc = scope(x);
    return `<section class="as-card" data-group="${group(x)}"><header><div><span class="as-tag">${label(x)}</span><h3>${esc(x.title)}</h3></div></header>${sc ? `<div class="as-scope"><span>Créneau</span><strong>${esc(sc)}</strong></div>` : ""}<p class="body">${esc(x.body || "")}</p>${coverage(x)}${x.recommendation_text ? `<div class="as-rec"><strong>Proposition</strong><span>${esc(x.recommendation_text)}</span></div>` : ""}<span class="as-confidence">${confidence(x)}</span><details class="as-why"><summary>Pourquoi cette alerte ?</summary><p>${esc(why(x))}</p></details></section>`;
  }
  function render(filter = "all") {
    const list =
        filter === "all" ? items : items.filter((x) => group(x) === filter),
      days = new Map();
    list.forEach((x) => {
      const key = String(x.date || "").slice(0, 10) || "sans-date";
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(x);
    });
    $("#feed").innerHTML = list.length
      ? [...days.entries()]
          .map(
            ([date, rows]) =>
              `<article class="as-day" data-day="${esc(date)}"><header class="as-day-head"><time>${esc(fmtDate(date))}</time><span>${rows.length} sujet${rows.length > 1 ? "s" : ""}</span></header><div class="as-day-items">${rows.map(renderCard).join("")}</div></article>`,
          )
          .join("")
      : '<p class="as-empty">Rien d’utile à signaler dans cette catégorie.</p>';
    $("#feed").setAttribute("aria-busy", "false");
  }
  async function load() {
    const t = localStorage.getItem(STORE) || "";
    if (!t) {
      location.href = "index.html";
      return;
    }
    const start = new Date(),
      end = new Date();
    end.setDate(end.getDate() + 30);
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-STIP-Session": t },
        body: JSON.stringify({
          action: "feed",
          start_date: iso(start),
          end_date: iso(end),
        }),
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error || "Lecture impossible");
      if (!j.enabled) {
        $("#headline").textContent = "Assistant désactivé pour cet accès";
        $("#meta").textContent = "Aucune analyse n’est exposée.";
        items = [];
        render(activeFilter);
        return;
      }
      items = j.items || [];
      const s = j.summary || {};
      $("#headline").textContent =
        s.headline || "Aucun point prioritaire détecté";
      document
        .querySelector(".as-hero")
        ?.setAttribute("data-state", s.state || "ok");
      const b = [];
      if (s.critical_count) b.push(`${s.critical_count} à décider`);
      if (s.attention_count) b.push(`${s.attention_count} à anticiper`);
      if (s.opportunity_count)
        b.push(
          `${s.opportunity_count} opportunité${s.opportunity_count > 1 ? "s" : ""}`,
        );
      $("#meta").textContent =
        b.join(" · ") || "Situation normale : l’Assistant reste silencieux.";
      render(activeFilter);
    } catch (e) {
      $("#error").textContent = e.message || String(e);
      $("#feed").innerHTML =
        '<p class="as-empty">Impossible de charger le guidage.</p>';
      $("#feed").setAttribute("aria-busy", "false");
    }
  }
  document.querySelectorAll(".as-filters button").forEach(
    (b) =>
      (b.onclick = () => {
        document
          .querySelectorAll(".as-filters button")
          .forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        activeFilter = b.dataset.filter;
        window.STIPNav?.remember?.({ filter: activeFilter });
        render(activeFilter);
      }),
  );
  document
    .querySelectorAll(".as-filters button")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.filter === activeFilter),
    );
  window.STIPNav?.register?.({
    capture: () => ({ filter: activeFilter }),
  });
  load();
})();
