(() => {
  "use strict";
  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-intelligence",
    STORE = "stip_session_v1",
    HORIZON = 7;
  const esc = (v) =>
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
  const token = () => localStorage.getItem(STORE) || "";
  async function call(action, body = {}) {
    const r = await fetch(API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-STIP-Session": token(),
        },
        body: JSON.stringify({ action, ...body }),
      }),
      j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      const raw = j.error || `Erreur ${r.status}`;
      throw new Error(
        typeof raw === "string" ? raw : raw?.message || JSON.stringify(raw),
      );
    }
    return j;
  }
  const ymd = (o = 0) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + o);
    return d.toISOString().slice(0, 10);
  };
  const fmt = (d) =>
    new Date(d + "T12:00:00")
      .toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
      .replace(".", "");
  function sevText(n, x = null) {
    const terrain = x ? window.STIPFieldIntel?.terrainItem?.(x) : null;
    if (terrain?.level === "opportunity") return "Marge utile";
    return n >= 4 ? "Urgent" : n === 3 ? "Important" : n === 2 ? "À vérifier" : "Information";
  }
  function icon(x) {
    const terrain = window.STIPFieldIntel?.terrainItem?.(x);
    if (terrain?.level === "critical") return "🛑";
    if (terrain?.level === "warning") return "⚠️";
    if (terrain?.level === "opportunity") return "➕";
    if (x.recommendation && Object.keys(x.recommendation).length) return "💡";
    return "•";
  }
  function useful(x) {
    const rec = x.recommendation && Object.keys(x.recommendation).length,
      w = x.context?.warnings || [];
    if (Number(x.severity || 0) <= 1 && !rec) return false;
    if (
      x.signal_type === "formation" &&
      !rec &&
      w.length &&
      w.every((v) => String(v).toLowerCase().includes("lieu non renseigné"))
    )
      return false;
    return true;
  }
  let list = [],
    loading = false;
  const host = () => document.getElementById("respInsights");
  function bodyText(x) {
    if (x.body) return x.body;
    if (x.context?.warnings?.length) return x.context.warnings.join(" · ");
    if (x.context?.gaps?.length)
      return (
        "Couverture manquante : " +
        x.context.gaps.map((g) => `${g.start}–${g.end}`).join(", ")
      );
    return "";
  }
  function recommendation(x) {
    const r = x.recommendation || x.context?.recommendation || {};
    return r.message || "";
  }
  function render() {
    const h = host();
    if (!h) return;
    if (loading) {
      h.hidden = false;
      h.setAttribute("aria-busy", "true");
      h.classList.add("is-refreshing");
      return;
    }
    h.setAttribute("aria-busy", "false");
    h.classList.remove("is-refreshing", "cockpit-placeholder");
    if (!list.length) {
      h.hidden = false;
      h.innerHTML =
        '<div class="op-calm"><strong>Aucun point prioritaire</strong><span>La situation ne demande pas d’action particulière.</span></div>';
      h.dataset.ready = "true";
      return;
    }
    h.hidden = false;
    const visible = list.slice(0, 4),
      days = new Map();
    visible.forEach((x) => {
      const key = x.event_date || "sans-date";
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(x);
    });
    h.innerHTML = `<div class="op-head"><div><span class="op-kicker">SITUATION</span><b>${list.length} point${list.length > 1 ? "s" : ""} à regarder</b></div><span class="op-date">7 jours</span></div><div class="op-days">${[...days.entries()].map(([date, signals]) => `<section class="op-day stip-time-surface"><header><strong>${esc(fmt(date))}</strong><span>${signals.length} sujet${signals.length > 1 ? "s" : ""}</span></header><div class="op-list">${signals.map((x) => `<button class="op-card sev-${Number(x.severity) || 1}" data-op-id="${esc(x.id)}" type="button"><span class="op-icon">${icon(x)}</span><span class="op-main"><strong>${esc(x.title)}</strong><small>${x.window_start ? `${esc(String(x.window_start).slice(0, 5))}${x.window_end ? "–" + esc(String(x.window_end).slice(0, 5)) : ""}` : "Toute la journée"}</small></span><span class="op-sev">${esc(sevText(Number(x.severity) || 1, x))}</span></button>`).join("")}</div></section>`).join("")}</div>${list.length > 4 ? `<div class="op-more">+ ${list.length - 4} autre${list.length - 4 > 1 ? "s" : ""}</div>` : ""}`;
    h.dataset.ready = "true";
    h.querySelectorAll("[data-op-id]").forEach((b) =>
      b.addEventListener("click", () => openSignal(b.dataset.opId)),
    );
  }
  function openSignal(id) {
    const x = list.find((s) => s.id === id);
    if (!x) return;
    const p = document.getElementById("respPanel"),
      b = document.getElementById("respPanelBody"),
      t = document.getElementById("respPanelTitle");
    if (!p || !b) return;
    t.textContent = "Analyse STIP";
    const rec = recommendation(x);
    b.innerHTML = `<div class="resp-detail op-detail"><span class="resp-status">${esc(sevText(Number(x.severity) || 1, x))}</span><h3>${esc(x.title)}</h3><p><strong>${esc(fmt(x.event_date))}</strong>${x.window_start ? ` · ${esc(String(x.window_start).slice(0, 5))}${x.window_end ? "–" + esc(String(x.window_end).slice(0, 5)) : ""}` : ""}</p>${bodyText(x) ? `<p>${esc(bodyText(x))}</p>` : ""}${rec ? `<div class="op-rec"><strong>Suggestion</strong><p>${esc(rec)}</p></div>` : ""}<div class="resp-actions"><button class="primary" data-op-decision="treated" type="button">Traité</button><button data-op-decision="not_needed" type="button">Pas d’action nécessaire</button></div><div class="resp-feedback" id="opFeedback"></div></div>`;
    p.classList.add("open");
    p.setAttribute("aria-hidden", "false");
    b.querySelectorAll("[data-op-decision]").forEach((btn) =>
      btn.addEventListener("click", () => decide(x, btn.dataset.opDecision)),
    );
  }
  async function decide(x, decision) {
    const f = document.getElementById("opFeedback");
    if (f) f.textContent = "Enregistrement…";
    try {
      await call("record_decision", {
        signal_id: x.id,
        decision,
        payload: {
          source: "responsable",
          signal_type: x.signal_type,
          event_date: x.event_date,
        },
      });
      if (f) f.textContent = "Décision enregistrée.";
      list = list.filter((s) => s.id !== x.id);
      render();
      setTimeout(() => {
        document.getElementById("respPanel")?.classList.remove("open");
      }, 350);
    } catch (e) {
      if (f) f.textContent = e?.message || String(e);
    }
  }
  async function refresh() {
    if (loading) return;
    loading = true;
    render();
    try {
      for (let i = 0; i < HORIZON; i++) await call("scan", { date: ymd(i) });
      const r = await call("signals", { date: ymd(0) });
      list = (r.signals || [])
        .filter(
          (x) =>
            x.status === "active" &&
            x.event_date <= ymd(HORIZON - 1) &&
            useful(x),
        )
        .sort(
          (a, b) =>
            (Number(b.severity) || 0) - (Number(a.severity) || 0) ||
            String(a.event_date).localeCompare(String(b.event_date)),
        );
    } catch (e) {
      console.warn("STIP intelligence", e);
    } finally {
      loading = false;
      render();
    }
  }
  window.addEventListener("stip:session-ready", refresh);
  window.addEventListener("focus", () => {
    if (document.visibilityState === "visible") refresh();
  });
  document.getElementById("respRefresh")?.addEventListener("click", refresh);
  if (window.GHEAuth?.ready) GHEAuth.ready.then(refresh).catch(() => {});
  else setTimeout(refresh, 800);
})();
