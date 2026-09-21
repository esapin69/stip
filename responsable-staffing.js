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
            cl =
              g < 0
                ? Number(x.severity) >= 4
                  ? "critical"
                  : Number(x.severity) >= 3
                    ? "warning"
                    : "attention"
                : g > 0
                  ? "over"
                  : "ok";
          return `<div class="rs-shift ${cl}"><b>${esc(x.shift_code || "—")}</b><span>${esc(x.planned_count)} / ${esc(x.target_count)}</span><em>${esc(g === 0 ? "OK" : (g > 0 ? "+" : "") + g)}</em></div>`;
        })
        .join("")}</div>${read?.known && read.level !== "ok" ? `<div class="rs-guide ${esc(read.level)}"><strong>${esc(read.symbol)} À retenir</strong><span>${esc(read.detail)}</span></div>` : ""}${s.special_count ? `<div class="rs-special">+ ${esc(s.special_count)} agent(s) sur horaires spécifiques, suivis séparément de M/J/J4/S.</div>` : ""}${d.freshness?.planning_imported_at ? `<div class="rs-fresh">Planning mis à jour ${esc(fmtFresh(d.freshness.planning_imported_at))}</div>` : ""}`;
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
    const b = e.target.closest?.("[data-change-id]");
    if (b?.dataset.changeId) decision(b.dataset.changeId);
  });
  const st = document.createElement("style");
  st.textContent =
    ".resp-operational{margin:10px 0;padding:12px;border:1px solid #e7d7ad;border-radius:16px;background:#fffaf0}.rs-head strong,.rs-head small,.rs-line span,.rs-line small,.rs-decision small,.rs-decision em{display:block}.rs-head small{font-size:.68rem;color:#7b6a45;margin-top:2px}.rs-line{margin-top:8px;padding-top:8px;border-top:1px solid #eee1bf;display:grid;grid-template-columns:34px 1fr;gap:5px 8px}.rs-line span{font-size:.7rem;line-height:1.35}.rs-line small{grid-column:2;font-size:.65rem;color:#7b632f}.rs-decision{margin:12px 0;padding:11px;border-radius:13px;background:#eef4f5}.rs-decision p{margin:5px 0;font-size:.72rem;line-height:1.4}.rs-decision small{font-size:.66rem;margin-top:3px}.rs-decision em{font-size:.61rem;margin-top:7px;color:#6d7b80}.rs-decision.risk{background:#fdeaea}.rs-decision.watch{background:#fff5dd}.rs-decision.favorable{background:#e6f6ed}";
  document.head.appendChild(st);
  const sx = document.createElement("style");
  sx.textContent =
    ".resp-operational{margin:10px 0;padding:12px;border:1px solid #d9e7ea;border-radius:16px;background:#fff}.rs-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.rs-head>div strong,.rs-head>div small{display:block}.rs-head>div small{margin-top:2px;font-size:.64rem;color:#71858d}.rs-head>span{font-weight:950;font-size:1rem}.rs-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}.rs-shift{padding:8px 6px;border-radius:11px;background:#f1f6f7;text-align:center}.rs-shift b,.rs-shift span,.rs-shift em{display:block}.rs-shift b{font-size:.72rem}.rs-shift span{margin-top:2px;font-size:.72rem;font-weight:900}.rs-shift em{margin-top:2px;font-size:.6rem;font-style:normal}.rs-shift.attention,.rs-shift.warning{background:#fff4df}.rs-shift.critical{background:#fde8e8}.rs-shift.over{background:#edf8f1}.rs-guide{margin-top:8px;padding:9px 10px;border-radius:12px;background:#fff6e6}.rs-guide.critical{background:#fde8e8}.rs-guide strong,.rs-guide span,.rs-guide small{display:block}.rs-guide strong{font-size:.7rem}.rs-guide span{margin-top:3px;font-size:.67rem;line-height:1.35}.rs-guide small{margin-top:3px;font-size:.62rem;color:#7b632f}.rs-special,.rs-fresh{margin-top:7px;font-size:.61rem;color:#71858d}.resp-operational.rs-critical{border-color:#e4b2b2}.resp-operational.rs-warning,.resp-operational.rs-attention{border-color:#ead09a}@media(max-width:430px){.rs-grid{grid-template-columns:repeat(4,minmax(58px,1fr));overflow-x:auto}.rs-shift{min-width:58px}}";
  document.head.appendChild(sx);
  summary();
  setInterval(() => {
    if (!document.hidden) summary();
  }, 60000);
})();
