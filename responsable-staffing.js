(() => {
  "use strict";
  const STAFF =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-staffing",
    CHANGE =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-change",
    STORE = "stip_session_v1";
  const token = () => localStorage.getItem(STORE) || "",
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
  async function post(url, body) {
    const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-STIP-Session": token(),
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }),
      j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw Error(j.error || `Erreur ${r.status}`);
    return j;
  }
  const today = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
      new Date(),
    );
  function fmtFresh(v) {
    if (!v) return "";
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Paris",
      })
        .format(new Date(v))
        .replace(",", " à");
    } catch {
      return "";
    }
  }
  const field = () => window.STIPFieldIntel || null;
  let lastStaffing = null;

  function closeShiftAnalysis() {
    document.getElementById("rsShiftAnalysis")?.remove();
  }

  function fmtDay(value) {
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Europe/Paris",
      }).format(new Date(String(value || "").slice(0, 10) + "T12:00:00"));
    } catch {
      return String(value || "");
    }
  }

  function openDayAnalysis({ date = "", staffing = null, items = [] } = {}) {
    const intel = field(),
      checklist = intel?.dayChecklist?.({ staffing, items }) || null,
      status = intel?.dayStatus?.({ staffing, items }) || checklist,
      level = status?.level || checklist?.level || "unknown",
      symbol =
        status?.symbol ||
        checklist?.symbol ||
        (level === "critical"
          ? "🛑"
          : level === "warning"
            ? "⚠️"
            : level === "opportunity"
              ? "➕"
              : level === "ok"
                ? "✔"
                : "○"),
      label =
        status?.label ||
        checklist?.label ||
        (level === "unknown" ? "Pas assez de données" : "Lecture du jour"),
      summary = staffing?.summary || {},
      countText =
        summary.planned != null && summary.target != null
          ? `${summary.planned} prévus · cible ${summary.target}`
          : "Effectif et signaux terrain croisés",
      points = Array.isArray(checklist?.points) ? checklist.points : [],
      pointHtml = points.length
        ? `<div class="rs-day-points">${points
            .slice(0, 7)
            .map(
              (point) =>
                `<section class="rs-day-point rs-${esc(point.level || "info")}"><span aria-hidden="true">${esc(point.symbol || "•")}</span><div><strong>${esc(point.title || "Point à regarder")}</strong>${point.detail ? `<p>${esc(point.detail)}</p>` : ""}${point.proposal ? `<small>${esc(point.proposal)}</small>` : ""}</div></section>`,
            )
            .join("")}</div>`
        : '<p class="rs-day-empty">Aucun point détaillé supplémentaire pour cette journée.</p>',
      advice =
        checklist?.advice && checklist?.strength !== "none"
          ? `<div class="rs-shift-proposal"><strong>Lecture terrain</strong><span>${esc(checklist.advice)}</span></div>`
          : "",
      wrap = document.createElement("div");
    closeShiftAnalysis();
    wrap.id = "rsShiftAnalysis";
    wrap.className = "rs-shift-overlay";
    wrap.innerHTML = `<button type="button" class="rs-shift-backdrop" aria-label="Fermer"></button><section class="rs-shift-sheet rs-day-sheet rs-${esc(level)}" role="dialog" aria-modal="true" aria-label="Analyse du ${esc(fmtDay(date))}"><header><div><small>ANALYSE TERRAIN</small><strong>${esc(fmtDay(date))}</strong></div><button type="button" data-rs-shift-close aria-label="Fermer">×</button></header><div class="rs-shift-verdict"><span aria-hidden="true">${esc(symbol)}</span><div><strong>${esc(label)}</strong><small>${esc(countText)}</small></div></div>${pointHtml}${advice}</section>`;
    document.body.appendChild(wrap);
    wrap.querySelector(".rs-shift-backdrop")?.addEventListener("click", closeShiftAnalysis);
    wrap.querySelector("[data-rs-shift-close]")?.addEventListener("click", closeShiftAnalysis);
  }

  function shiftFallback(row, signal) {
    const gap = Number(row?.gap || 0);
    if (signal?.detail) return signal.detail;
    if (gap < 0)
      return `Il manque ${Math.abs(gap)} agent${Math.abs(gap) > 1 ? "s" : ""} par rapport à la cible.`;
    if (gap > 0)
      return `${gap} agent${gap > 1 ? "s" : ""} de marge par rapport à la cible.`;
    return "L’effectif prévu correspond à la cible.";
  }

  function openShiftAnalysis(code) {
    const data = lastStaffing,
      row = (data?.shifts || data?.rows || []).find(
        (x) => String(x.shift_code || "") === String(code || ""),
      );
    if (!row) return;
    closeShiftAnalysis();
    const signal = field()?.shiftStatus?.(data, code),
      gap = Number(row.gap || 0),
      level =
        signal?.level ||
        (gap < 0
          ? Number(row.severity) >= 4
            ? "critical"
            : "warning"
          : gap > 0
            ? "opportunity"
            : "ok"),
      symbol =
        signal?.symbol ||
        (level === "critical"
          ? "🛑"
          : level === "warning"
            ? "⚠️"
            : level === "opportunity"
              ? "➕"
              : "✔"),
      label =
        signal?.label ||
        (gap < 0
          ? "Sous la cible"
          : gap > 0
            ? "Marge disponible"
            : "Effectif conforme"),
      wrap = document.createElement("div");
    wrap.id = "rsShiftAnalysis";
    wrap.className = "rs-shift-overlay";
    wrap.innerHTML = `<button type="button" class="rs-shift-backdrop" aria-label="Fermer"></button><section class="rs-shift-sheet rs-${esc(level)}" role="dialog" aria-modal="true" aria-label="Analyse du shift ${esc(code)}"><header><div><small>ANALYSE TERRAIN</small><strong>${esc(code)}</strong></div><button type="button" data-rs-shift-close aria-label="Fermer">×</button></header><div class="rs-shift-verdict"><span aria-hidden="true">${esc(symbol)}</span><div><strong>${esc(label)}</strong><small>${esc(row.planned_count)} prévu${Number(row.planned_count) > 1 ? "s" : ""} · cible ${esc(row.target_count)}</small></div></div><p>${esc(shiftFallback(row, signal))}</p>${signal?.proposal ? `<div class="rs-shift-proposal"><strong>Conseil terrain</strong><span>${esc(signal.proposal)}</span></div>` : ""}</section>`;
    document.body.appendChild(wrap);
    wrap.querySelector(".rs-shift-backdrop")?.addEventListener("click", closeShiftAnalysis);
    wrap.querySelector("[data-rs-shift-close]")?.addEventListener("click", closeShiftAnalysis);
  }

  async function summary() {
    const host = document.querySelector("#respCoverage");
    if (!host) return;
    host.hidden = false;
    host.setAttribute("aria-busy", "true");
    host.classList.add("is-refreshing");
    try {
      const d = await post(STAFF, { action: "day", date: today() });
      if (!d.available) {
        host.innerHTML =
          '<div class="op-calm"><strong>Référence indisponible</strong><span>Le planning reste consultable sans comparaison HCL.</span></div>';
        host.dataset.ready = "true";
        return;
      }
      lastStaffing = d;
      const s = d.summary || {},
        read = field()?.staffing?.(d),
        rows = (d.shifts || d.rows || [])
          .slice()
          .filter((x) => x?.shift_code)
          .sort(
            (a, b) =>
              (({ M: 1, J: 2, J4: 3, S: 4, N: 5 })[a.shift_code] || 9) -
              ({ M: 1, J: 2, J4: 3, S: 4, N: 5 }[b.shift_code] || 9),
          );
      host.hidden = false;
      host.className = `resp-operational rs-${esc(read?.level || s.state || "ok")}`;
      host.innerHTML = `<div class="rs-head"><div><strong>${esc(read?.headline || s.headline || "Couverture du jour")}</strong><small>${esc(read?.detail || "Lecture des références du planning")}</small></div><span>${esc(s.planned ?? "—")} / ${esc(s.target ?? "—")}</span></div><div class="rs-grid">${rows
        .map((x) => {
          const g = Number(x.gap || 0),
            signal = field()?.shiftStatus?.(d, x.shift_code),
            cl =
              signal?.level === "opportunity"
                ? "opportunity"
                : g < 0
                  ? Number(x.severity) >= 4
                    ? "critical"
                    : Number(x.severity) >= 3
                      ? "warning"
                      : "attention"
                  : g > 0
                    ? "over"
                    : "ok",
            delta = g === 0 ? "OK" : (g > 0 ? "+" : "") + g,
            mark = signal?.level === "opportunity" ? `${signal.symbol} ${delta}` : delta;
          return `<button type="button" class="rs-shift ${cl}" data-rs-shift="${esc(x.shift_code || "")}" aria-label="Ouvrir l’analyse ${esc(x.shift_code || "")}"><b>${esc(x.shift_code || "—")}</b><span>${esc(x.planned_count)} / ${esc(x.target_count)}</span><em title="${esc(signal?.label || "")}">${esc(mark)}</em></button>`;
        })
        .join("")}</div>${read?.known && read.level !== "ok" ? `<div class="rs-guide ${esc(read.level)}"><strong>${esc(read.symbol)} À retenir</strong><span>${esc(read.detail)}</span>${read.proposal ? `<small>${esc(read.proposal)}</small>` : ""}</div>` : ""}${s.special_count ? `<div class="rs-special">+ ${esc(s.special_count)} agent(s) sur horaires spécifiques, suivis séparément de M/J/J4/S.</div>` : ""}${d.freshness?.planning_imported_at ? `<div class="rs-fresh">Planning mis à jour ${esc(fmtFresh(d.freshness.planning_imported_at))}</div>` : ""}`;
      host.dataset.ready = "true";
    } catch {
      if (!host.dataset.ready) {
        host.innerHTML =
          '<div class="op-calm"><strong>Couverture momentanément indisponible</strong><span>Une nouvelle lecture sera tentée automatiquement.</span></div>';
      }
    } finally {
      host.setAttribute("aria-busy", "false");
      host.classList.remove("is-refreshing", "cockpit-placeholder");
    }
  }
  function normalize(v) {
    const s = String(v || "")
      .trim()
      .toUpperCase();
    if (/^J4\*?$/.test(s)) return "J4";
    if (/^M\*?$/.test(s)) return "M";
    if (/^J\*?$/.test(s)) return "J";
    if (/^S\*?$/.test(s)) return "S";
    if (/^N\*?$/.test(s)) return "N";
    return null;
  }
  function inject(html) {
    setTimeout(() => {
      const h = document.querySelector(".change-detail");
      if (!h || h.querySelector(".rs-decision")) return;
      const actions = h.querySelector(".resp-actions"),
        tmp = document.createElement("div");
      tmp.innerHTML = html.trim();
      if (tmp.firstElementChild) actions?.before(tmp.firstElementChild);
    }, 80);
  }
  async function decision(id) {
    try {
      const r = await post(CHANGE, { action: "responsable_list" }),
        x = (r.items || []).find((v) => v.id === id);
      if (!x) return;
      let html = "";
      if (x.target) {
        const d = await post(STAFF, { action: "day", date: x.date_from }),
          cur = normalize(x.requester_code),
          dest = normalize(x.context?.target_shift || x.desired_code),
          a = (d.shifts || []).find((v) => v.shift_code === cur),
          b = (d.shifts || []).find((v) => v.shift_code === dest);
        html = `<div class="rs-decision favorable"><strong>✔ Pas d’effet sur le nombre d’agents</strong><p>C’est un échange le même jour : les effectifs restent identiques. Reste seulement à vérifier les contraintes terrain autour des deux agents.</p>${a ? `<small>${esc(cur)} : ${a.planned_count}/${a.target_count}</small>` : ""}${b && dest !== cur ? `<small>${esc(dest)} : ${b.planned_count}/${b.target_count}</small>` : ""}</div>`;
      } else {
        const d = await post(STAFF, {
          action: "request_impact",
          date: x.date_from,
          desired_code: x.desired_code,
        });
        html = `<div class="rs-decision ${esc(d.impact?.level || "neutral")}"><strong>Impact effectif</strong><p>${esc(d.impact?.message || "Aucune référence disponible.")}</p>${d.impact?.source ? `<small>Départ ${esc(d.current_shift)} : ${d.impact.source.after}/${d.impact.source.target} après changement</small>` : ""}${d.impact?.destination ? `<small>Arrivée ${esc(d.desired_shift)} : ${d.impact.destination.after}/${d.impact.destination.target} après changement</small>` : ""}<em>Aide à la décision uniquement — aucune validation automatique.</em></div>`;
      }
      inject(html);
    } catch {}
  }
  document.addEventListener("click", (e) => {
    const shift = e.target.closest?.("[data-rs-shift]");
    if (shift?.dataset.rsShift) {
      openShiftAnalysis(shift.dataset.rsShift);
      return;
    }
    const b = e.target.closest?.("[data-change-id]");
    if (b?.dataset.changeId) decision(b.dataset.changeId);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("rsShiftAnalysis"))
      closeShiftAnalysis();
  });
  const st = document.createElement("style");
  st.textContent =
    ".resp-operational{margin:10px 0;padding:12px;border:1px solid #e7d7ad;border-radius:16px;background:#fffaf0}.rs-head strong,.rs-head small,.rs-line span,.rs-line small,.rs-decision small,.rs-decision em{display:block}.rs-head small{font-size:.68rem;color:#7b6a45;margin-top:2px}.rs-line{margin-top:8px;padding-top:8px;border-top:1px solid #eee1bf;display:grid;grid-template-columns:34px 1fr;gap:5px 8px}.rs-line span{font-size:.7rem;line-height:1.35}.rs-line small{grid-column:2;font-size:.65rem;color:#7b632f}.rs-decision{margin:12px 0;padding:11px;border-radius:13px;background:#eef4f5}.rs-decision p{margin:5px 0;font-size:.72rem;line-height:1.4}.rs-decision small{font-size:.66rem;margin-top:3px}.rs-decision em{font-size:.61rem;margin-top:7px;color:#6d7b80}.rs-decision.risk{background:#fdeaea}.rs-decision.watch{background:#fff5dd}.rs-decision.favorable{background:#e6f6ed}";
  document.head.appendChild(st);
  const sx = document.createElement("style");
  sx.textContent =
    ".resp-operational{margin:10px 0;padding:12px;border:1px solid #d9e7ea;border-radius:16px;background:#fff}.rs-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.rs-head>div strong,.rs-head>div small{display:block}.rs-head>div small{margin-top:2px;font-size:.64rem;color:#71858d}.rs-head>span{font-weight:950;font-size:1rem}.rs-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}.rs-shift{padding:8px 6px;border-radius:11px;background:#f1f6f7;text-align:center}.rs-shift b,.rs-shift span,.rs-shift em{display:block}.rs-shift b{font-size:.72rem}.rs-shift span{margin-top:2px;font-size:.72rem;font-weight:900}.rs-shift em{margin-top:2px;font-size:.6rem;font-style:normal}.rs-shift.attention,.rs-shift.warning{background:#fff4df}.rs-shift.critical{background:#fde8e8}.rs-shift.over{background:#edf8f1}.rs-guide{margin-top:8px;padding:9px 10px;border-radius:12px;background:#fff6e6}.rs-guide.critical{background:#fde8e8}.rs-guide strong,.rs-guide span,.rs-guide small{display:block}.rs-guide strong{font-size:.7rem}.rs-guide span{margin-top:3px;font-size:.67rem;line-height:1.35}.rs-guide small{margin-top:3px;font-size:.62rem;color:#7b632f}.rs-special,.rs-fresh{margin-top:7px;font-size:.61rem;color:#71858d}.resp-operational.rs-critical{border-color:#e4b2b2}.resp-operational.rs-warning,.resp-operational.rs-attention{border-color:#ead09a}@media(max-width:430px){.rs-grid{grid-template-columns:repeat(4,minmax(58px,1fr));overflow-x:auto}.rs-shift{min-width:58px}}";
  document.head.appendChild(sx);
  const opportunityStyle = document.createElement("style");
  opportunityStyle.textContent = ".rs-shift.opportunity{background:#f3edff;color:#6d28d9}.rs-shift.opportunity em{color:var(--stip-opportunity,#7C3AED);font-weight:950}";
  document.head.appendChild(opportunityStyle);
  const shiftAnalysisStyle = document.createElement("style");
  shiftAnalysisStyle.textContent =
    "/* Responsable shift analysis drawer */.rs-shift{border:0;font:inherit;cursor:pointer}.rs-shift:focus-visible{outline:3px solid rgba(20,139,160,.22);outline-offset:2px}.rs-shift-overlay{position:fixed;z-index:9995;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(14,38,45,.30);backdrop-filter:blur(4px)}.rs-shift-backdrop{position:absolute;inset:0;border:0;background:transparent}.rs-shift-sheet{position:relative;width:min(100%,460px);padding:16px;border-radius:24px;background:#fff;box-shadow:0 24px 70px rgba(13,44,52,.25)}.rs-shift-sheet>header{display:flex;align-items:center;justify-content:space-between;gap:10px}.rs-shift-sheet>header small,.rs-shift-sheet>header strong{display:block}.rs-shift-sheet>header small{color:#148ba0;font-size:.58rem;font-weight:950;letter-spacing:.10em}.rs-shift-sheet>header strong{margin-top:2px;color:#173f49;font-size:1.25rem}.rs-shift-sheet>header button{width:38px;height:38px;border:0;border-radius:12px;background:#eef4f5;color:#476a72;font-size:1.25rem}.rs-shift-verdict{margin-top:12px;padding:12px;display:grid;grid-template-columns:42px minmax(0,1fr);align-items:center;gap:10px;border-radius:16px;background:#f3f8f8}.rs-shift-verdict>span{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:#fff;font-size:1.1rem}.rs-shift-verdict strong,.rs-shift-verdict small{display:block}.rs-shift-verdict strong{color:#214f58;font-size:.84rem}.rs-shift-verdict small{margin-top:2px;color:#73898f;font-size:.66rem}.rs-shift-sheet>p{margin:11px 2px 0;color:#365b63;font-size:.76rem;line-height:1.45}.rs-shift-proposal{margin-top:10px;padding:10px 11px;border-radius:14px;background:#edf7f4;color:#225d50}.rs-shift-proposal strong,.rs-shift-proposal span{display:block}.rs-shift-proposal strong{font-size:.65rem}.rs-shift-proposal span{margin-top:3px;font-size:.73rem;line-height:1.4}.rs-day-points{display:grid;gap:7px;margin-top:11px}.rs-day-point{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;align-items:start;padding:9px 10px;border-radius:13px;background:#f4f8f8}.rs-day-point>span{display:grid;place-items:center;min-height:26px;font-size:1rem}.rs-day-point strong,.rs-day-point p,.rs-day-point small{display:block}.rs-day-point strong{color:#214f58;font-size:.72rem}.rs-day-point p{margin:3px 0 0;color:#526d74;font-size:.67rem;line-height:1.38}.rs-day-point small{margin-top:4px;color:#697f85;font-size:.62rem;line-height:1.35}.rs-day-point.rs-critical{background:#fdecec}.rs-day-point.rs-warning{background:#fff6df}.rs-day-point.rs-opportunity{background:#f3edff}.rs-day-point.rs-ok{background:#edf8f1}.rs-day-empty{margin:11px 2px 0;color:#6f8288;font-size:.7rem}.rs-day-sheet{max-height:min(82vh,720px);overflow:auto}@media(min-width:620px){.rs-shift-overlay{align-items:center}}";
  document.head.appendChild(shiftAnalysisStyle);

  window.STIPResponsableStaffing = {
    ...(window.STIPResponsableStaffing || {}),
    openShiftAnalysis,
    openDayAnalysis,
    closeAnalysis: closeShiftAnalysis,
  };

  summary();
  setInterval(() => {
    if (!document.hidden) summary();
  }, 60000);
})();
