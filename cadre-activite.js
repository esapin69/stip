(() => {
  "use strict";
  const CADRE =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-cadre",
    ASSIST =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-assistant",
    STAFF =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-staffing",
    ACCESS =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-access",
    TOKEN = "stip_session_v1",
    $ = (s) => document.querySelector(s),
    token = () => localStorage.getItem(TOKEN) || "";
  const navigationState = window.STIPNav?.read?.() || {};
  let accessLevel = "visitor";
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
  const ymd = (d) =>
      new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Europe/Paris",
      }).format(d),
    dateObj = (s) => new Date(s + "T12:00:00"),
    fmt = (s) =>
      new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Paris",
      }).format(dateObj(s)),
    fmtShort = (s) =>
      new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Europe/Paris",
      })
        .format(dateObj(s))
        .replace(".", "");
  let selected = /^\d{4}-\d{2}-\d{2}$/.test(navigationState.selectedDate || "")
      ? navigationState.selectedDate
      : ymd(new Date()),
    weekStart = null,
    lastFeed = null,
    lastStaff = null;
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
  function levelOf(me, key) {
    const v = String(
      me?.permissions?.__levels?.[key] || "visitor",
    ).toLowerCase();
    return v === "pro" ? "pro" : "visitor";
  }
  function mondayOf(s) {
    const d = typeof s === "string" ? dateObj(s) : new Date(s),
      dow = d.getDay() || 7;
    d.setDate(d.getDate() - dow + 1);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  function weekEnd() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return ymd(d);
  }
  function renderWeek() {
    const box = $("#weekDays");
    box.innerHTML = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const iso = ymd(d);
      return `<button class="week-day ${iso === ymd(new Date()) ? "today" : ""} ${iso === selected ? "active" : ""}" data-day="${iso}" type="button"><span>${d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase()}</span><strong>${d.getDate()}</strong><small>${d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</small></button>`;
    }).join("");
    box
      .querySelectorAll("[data-day]")
      .forEach((b) => (b.onclick = () => select(b.dataset.day)));
  }
  function selectedItems() {
    return (lastFeed?.items || [])
      .filter((x) => x.date === selected)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
  function compound() {
    return selectedItems().find((x) => x.source_family === "compound") || null;
  }
  function familyLabel(f) {
    return (
      {
        strategy: "Rééquilibrage",
        staffing: "Effectif",
        compound: "Couverture",
        changes: "Demandes",
        formation: "Formation",
        trainee: "Stagiaire",
        onboarding: "Arrivée",
        signal: "Signal",
      }[f] || "Information"
    );
  }
  function proposalText(r) {
    if (!r || typeof r !== "object") return "";
    for (const k of ["text", "message", "guidance", "proposal", "suggestion"])
      if (typeof r[k] === "string" && r[k].trim()) return r[k].trim();
    return "";
  }
  function normalizeShift(v) {
    const s = String(v || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    if (["M", "MATIN"].includes(s)) return "Matin · M";
    if (["J", "JOUR", "JOURNEE", "JOURNÉE"].includes(s)) return "Journée · J";
    if (s === "J4") return "J4";
    if (["S", "SOIR"].includes(s)) return "Soir · S";
    if (["N", "NUIT"].includes(s)) return "Nuit · N";
    return "";
  }
  function scopeOf(x) {
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
  function renderBrief(j) {
    const s = j?.summary || {},
      critical = Number(s.critical_count || 0),
      attention = Number(s.attention_count || 0),
      opportunity = Number(s.opportunity_count || 0);
    $("#briefHeadline").textContent =
      accessLevel === "pro"
        ? s.headline || "Situation stable sur les prochains jours"
        : "Vue de l’activité des prochains jours";
    $("#briefMeta").textContent =
      accessLevel === "pro"
        ? "Lecture par journée et par créneau quand l’information est disponible."
        : "Lecture simple des événements et de la couverture disponible.";
    $("#summaryMetrics").innerHTML =
      `<div class="summary-metric opportunity"><strong>${opportunity}</strong><span>Opportunités</span></div><div class="summary-metric anticipation"><strong>${attention}</strong><span>À anticiper</span></div>${accessLevel === "pro" ? `<div class="summary-metric decision"><strong>${critical}</strong><span>À décider</span></div>` : ""}`;
    const top = (s.top || []).slice(0, accessLevel === "pro" ? 3 : 2);
    $("#briefTop").innerHTML = top.length
      ? top
          .map((x) => {
            const sc = scopeOf(x);
            return `<button class="brief-item" data-brief-day="${esc(x.date)}" type="button"><time>${esc(fmtShort(x.date))}</time><span><strong>${esc(x.title)}</strong>${sc ? `<b class="brief-scope">${esc(sc)}</b>` : ""}<span>${esc(accessLevel === "pro" ? x.recommendation_text || x.body || familyLabel(x.source_family) : x.body || familyLabel(x.source_family))}</span></span></button>`;
          })
          .join("")
      : '<div class="empty">Aucun signal majeur sur la période affichée.</div>';
    document.querySelectorAll("[data-brief-day]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.briefDay;
          weekStart = mondayOf(selected);
          renderWeek();
          load().catch((e) => ($("#error").textContent = e.message));
        }),
    );
  }
  function fmtStamp(v) {
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
  function shiftOrder(c) {
    return { M: 1, J: 2, J4: 3, S: 4, N: 5 }[c] || 9;
  }
  function renderDay(d, staff = lastStaff) {
    const e = d.effectif || {},
      events = [
        ...(d.events?.formations || []),
        ...(d.events?.stagiaires || []),
      ],
      alerts = d.alerts || [],
      ctx = compound()?.context || {},
      ss = staff?.summary || {},
      rows = (staff?.rows || []).slice().sort((a, b) => {
        if (a.metric === "shift" && b.metric !== "shift") return -1;
        if (a.metric !== "shift" && b.metric === "shift") return 1;
        return shiftOrder(a.shift_code) - shiftOrder(b.shift_code);
      });
    $("#dayEyebrow").textContent =
      d.date === ymd(new Date()) ? "Aujourd’hui" : "Journée sélectionnée";
    $("#dayLabel").textContent = fmt(d.date);
    const sev = Math.max(
        Number(ss.worst_severity || 0),
        0,
        ...selectedItems().map((x) => Number(x.severity || 0)),
        ...alerts.map((x) => Number(x.severity || 0)),
      ),
      badge = $("#dayBadge");
    badge.textContent =
      sev >= 4
        ? "🚨 Critique"
        : sev >= 3
          ? "⚠️ Important"
          : sev >= 2
            ? "⚠️ À surveiller"
            : "✓ Conforme";
    badge.className = `badge ${sev >= 4 ? "critical" : sev >= 2 ? "warn" : "ok"}`;
    const planned = staff?.available
        ? Number(ss.planned || 0)
        : Number(ctx.planned_total ?? e.working ?? 0),
      target = staff?.available ? ss.target : ctx.target_total,
      gap = staff?.available ? ss.gap : ctx.gap_total;
    const detailRows = rows
      .map((r) => {
        const g = Number(r.gap || 0),
          state =
            g < 0
              ? Number(r.severity) >= 4
                ? "critical"
                : Number(r.severity) >= 3
                  ? "warning"
                  : "attention"
              : g > 0
                ? "over"
                : "ok",
          label =
            r.metric === "shift"
              ? r.shift_code || "Créneau"
              : r.metric === "middle_combined"
                ? "J + J4"
                : r.metric === "total"
                  ? "Total week-end"
                  : r.metric;
        return `<div class="coverage-row ${state}"><span><strong>${esc(label)}</strong><small>${r.metric === "shift" ? "Créneau de référence HCL" : r.metric === "middle_combined" ? "Référence combinée du samedi" : "Référence globale HCL"}</small></span><span class="coverage-numbers"><b>${esc(r.planned_count)} / ${esc(r.target_count)}</b><em>${g === 0 ? "OK" : (g > 0 ? "+" : "") + g}</em></span></div>`;
      })
      .join("");
    const special = ss.special_count
      ? `<div class="special-schedules"><strong>Horaires spécifiques · ${esc(ss.special_count)}</strong><span>${esc((ss.special_schedules || []).map((x) => `${x.code} × ${x.count}`).join(" · "))}</span><small>Suivis séparément : ils ne sont pas forcés dans les références M / J / J4 / S.</small></div>`
      : "";
    const fresh = staff?.freshness?.planning_imported_at
      ? `<div class="coverage-fresh">Planning mis à jour ${esc(fmtStamp(staff.freshness.planning_imported_at))}${staff.freshness.reference_file ? ` · Référence : ${esc(staff.freshness.reference_file)}` : ""}</div>`
      : "";
    $("#dayBody").classList.remove("loading");
    $("#dayBody").innerHTML =
      `<div class="coverage-caption"><span>Référence HCL issue du planning</span><strong>${staff?.available ? "Comparaison automatique" : "Données partielles"}</strong></div><div class="coverage-state ${gap < 0 ? "under" : gap > 0 ? "over" : "balanced"}"><span>${gap == null ? "Couverture" : gap < 0 ? "Sous la référence" : gap > 0 ? "Marge disponible" : "Référence atteinte"}</span><strong>${gap == null ? "—" : `${gap > 0 ? "+" : ""}${gap}`}</strong></div><div class="day-context"><div><strong>${planned}</strong><span>planifiés sur les créneaux de référence</span></div><div><strong>${target == null ? "—" : target}</strong><span>référence HCL</span></div></div>${detailRows ? `<div class="coverage-rows">${detailRows}</div>` : ""}${special}${fresh}<div class="day-note">${events.length ? `${events.length} événement(s) connu(s) · ` : ""}${alerts.length ? `${alerts.length} alerte(s) · ` : ""}${ss.below_count ? `${ss.below_count} écart(s) d’effectif détecté(s).` : "aucun écart d’effectif prioritaire détecté."}</div>`;
  }
  function bucket(x) {
    if (x.source_family === "strategy" || x.kind === "proposal")
      return "opportunities";
    if (Number(x.severity) >= 3 || x.kind === "warning") return "decisions";
    if (Number(x.severity) === 2 || x.kind === "anticipation")
      return "anticipations";
    if (x.kind === "opportunity") return "opportunities";
    return "context";
  }
  function card(x) {
    const p =
        accessLevel === "pro"
          ? x.recommendation_text || proposalText(x.recommendation)
          : "",
      sc = scopeOf(x);
    return `<article class="insight ${bucket(x)}"><div class="insight-top"><span class="insight-kind">${esc(familyLabel(x.source_family))}</span><span class="insight-sev">${Number(x.severity) >= 3 ? "Prioritaire" : Number(x.severity) === 2 ? "À surveiller" : "Information"}</span></div><h3>${esc(x.title || "Analyse")}</h3>${sc ? `<div class="insight-scope"><span>Créneau</span><strong>${esc(sc)}</strong></div>` : ""}${x.body ? `<p>${esc(x.body)}</p>` : ""}${p ? `<p class="proposal"><strong>Proposition</strong><span>${esc(p)}</span></p>` : ""}</article>`;
  }
  function renderInsights(j) {
    const box = $("#insightList");
    box.classList.remove("loading");
    let items = selectedItems();
    if (accessLevel !== "pro")
      items = items.filter(
        (x) =>
          x.source_family !== "strategy" &&
          x.kind !== "proposal" &&
          Number(x.severity) < 3,
      );
    $("#insightTitle").textContent =
      accessLevel === "pro"
        ? "Analyse détaillée"
        : "Informations de la journée";
    if (!items.length) {
      box.innerHTML =
        '<div class="empty">Rien de notable sur cette journée.</div>';
      return;
    }
    const groups =
      accessLevel === "pro"
        ? [
            ["opportunities", "Opportunités"],
            ["anticipations", "À anticiper"],
            ["context", "Contexte"],
            ["decisions", "À décider"],
          ]
        : [
            ["anticipations", "À surveiller"],
            ["context", "Contexte"],
          ];
    box.innerHTML = groups
      .map(([k, label]) => {
        const rows = items.filter((x) => bucket(x) === k);
        return rows.length
          ? `<section class="insight-group ${k}"><h3>${label}</h3><div>${rows.map(card).join("")}</div></section>`
          : "";
      })
      .join("");
  }
  async function load() {
    const start = ymd(weekStart),
      end = weekEnd();
    $("#error").textContent = "";
    const [day, feed, staff] = await Promise.all([
      post(CADRE, { action: "dashboard", date: selected }),
      post(ASSIST, { action: "feed", start_date: start, end_date: end }),
      post(STAFF, { action: "day", date: selected }).catch(() => null),
    ]);
    lastFeed = feed;
    lastStaff = staff;
    renderBrief(feed);
    renderDay(day.day, staff);
    renderInsights(feed);
  }
  function select(date) {
    selected = date;
    window.STIPNav?.remember?.({ selectedDate: selected });
    renderWeek();
    load().catch((e) => ($("#error").textContent = e.message));
  }
  function move(n) {
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + n * 7);
    selected = ymd(weekStart);
    window.STIPNav?.remember?.({ selectedDate: selected, scrollY: 0 });
    renderWeek();
    load().catch((e) => ($("#error").textContent = e.message));
  }
  async function boot() {
    if (!token()) return location.replace("index.html");
    try {
      const me = await post(ACCESS, { action: "me" });
      if (!me.permissions?.activity) return location.replace("index.html");
      accessLevel = levelOf(me, "activity");
      document.documentElement.dataset.activityLevel = accessLevel;
      document.querySelector(".activity-head .stip-kicker").textContent =
        accessLevel === "pro" ? "ACTIVITÉ · PRO" : "ACTIVITÉ · VISITEUR";
      document.querySelector(".activity-head p").textContent =
        accessLevel === "pro"
          ? "Comprendre la journée, le créneau concerné, puis agir."
          : "Voir et comprendre la situation.";
      weekStart = mondayOf(selected);
      renderWeek();
      await load();
      window.STIPNav?.restoreScroll?.();
    } catch (e) {
      $("#error").textContent = e.message || "Impossible de charger Activité.";
    }
  }
  $("#prevWeek").onclick = () => move(-1);
  $("#nextWeek").onclick = () => move(1);
  window.STIPNav?.register?.({
    capture: () => ({ selectedDate: selected }),
  });
  boot();
})();
