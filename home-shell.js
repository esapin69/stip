(() => {
  "use strict";
  const DATA_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data",
    ACTION_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions",
    STORE = "stip_session_v1",
    $ = (s) => document.querySelector(s);
  const state = {
    boot: null,
    home: { actions: [], notifications: [] },
    session: null,
    ready: false,
    refreshing: null,
    bootStatus: "idle",
    bootError: "",
    renderSig: "",
    future: new Map(),
    exchanges: new Map(),
    widgets: new Map(),
    externalActions: new Map(),
    actionFilter: "all",
    weekOffset: 0,
    weekFull: false,
    homeMode: "planning",
  };
  const REST = new Set([
    "RH",
    "RTT",
    "RC",
    "AA",
    "MA",
    "CA",
    "CP",
    "RF",
    "RTA",
    "RTTA",
    "SYR",
    "OFF",
    "REPOS",
    "-",
    "",
  ]);
  const DAY_OFF = new Set([
    "RH",
    "RTT",
    "RTTA",
    "RTA",
    "RC",
    "RF",
    "CA",
    "CP",
    "OFF",
    "REPOS",
  ]);
  const ICON = {
    personal:
      '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    tomorrow:
      '<img src="images/icone_app/pour-demain.svg?v=20260920-app1" alt="" aria-hidden="true">',
    team: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.4-7 6-7s6 3 6 7M16 6.5a2.5 2.5 0 0 1 0 5M17 14c2.5.6 4 2.7 4 5"/></svg>',
    change:
      '<svg viewBox="0 0 24 24"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
    calendar:
      '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    dates:
      '<img src="images/icone_app/date-des-agents.svg?v=20260918-1" alt="" aria-hidden="true">',
    contacts:
      '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.4-7 6-7s6 3 6 7M16 6.5a2.5 2.5 0 0 1 0 5M17 14c2.5.6 4 2.7 4 5"/></svg>',
    responsable:
      '<svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7z"/><path d="m9 12 2 2 4-4"/></svg>',
    newagent:
      '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.4-7 6-7s6 3 6 7M18 8v6M15 11h6"/></svg>',
    upload:
      '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v5h14v-5"/></svg>',
    access:
      '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/></svg>',
    admin:
      '<svg viewBox="0 0 24 24"><path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="M9 12h6M12 9v6"/></svg>',
    homeHome:
      '<img src="images/icone_app/home-home.webp?v=20260920-app-logo2" alt="" aria-hidden="true">',
    homeApps:
      '<img src="images/icone_app/home-apps.webp?v=20260920-app-logo2" alt="" aria-hidden="true">',
    homeBell:
      '<img src="images/icone_app/home-bell.webp?v=20260920-app-logo2" alt="" aria-hidden="true">',
  };
  function esc(v) {
    return String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot",
          "'": "&#39;",
        })[c],
    );
  }
  function cap(v) {
    v = String(v || "")
      .trim()
      .toLowerCase();
    return v ? v[0].toUpperCase() + v.slice(1) : v;
  }
  function token() {
    return localStorage.getItem(STORE) || "";
  }
  function parisIso(d = new Date()) {
    const p = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Europe/Paris",
      }).formatToParts(d),
      g = (t) => p.find((x) => x.type === t)?.value || "";
    return `${g("year")}-${g("month")}-${g("day")}`;
  }
  function fmtToday() {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Paris",
    })
      .format(new Date())
      .replace(/^./, (c) => c.toUpperCase());
  }
  function dateObj(s) {
    return new Date(String(s).slice(0, 10) + "T12:00:00");
  }
  function weekNo(d) {
    const x = new Date(d);
    x.setHours(12, 0, 0, 0);
    x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
    const w1 = new Date(x.getFullYear(), 0, 4);
    return (
      1 + Math.round(((x - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)
    );
  }
  function monthKeyOf(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function monthNameOf(d, short = false) {
    return new Intl.DateTimeFormat("fr-FR", { month: short ? "short" : "long" })
      .format(d)
      .replace(/\./g, "")
      .toUpperCase();
  }
  function weekMonthInfo(w) {
    const rows = (w || []).filter(Boolean),
      today = dateObj(parisIso()),
      first = rows[0]?.d || today,
      last = rows.at(-1)?.d || first,
      keys = [...new Set(rows.map((x) => monthKeyOf(x.d)))],
      targetKey = monthKeyOf(first),
      sameYear = first.getFullYear() === last.getFullYear(),
      heading =
        keys.length <= 1
          ? monthNameOf(first)
          : `${monthNameOf(first, true)} → ${monthNameOf(last, true)}`,
      yearLabel = sameYear
        ? String(first.getFullYear())
        : `${first.getFullYear()} → ${last.getFullYear()}`;
    return {
      heading,
      yearLabel,
      targetKey,
      anchor: first,
      targetLabel: `${monthNameOf(first)} ${first.getFullYear()}`,
      anchorDow: today
        .toLocaleDateString("fr-FR", { weekday: "short" })
        .replace(/\./g, "")
        .toUpperCase(),
      anchorDay: today.getDate(),
    };
  }
  function openPlanningMonth(key) {
    key = String(key || "").trim();
    if (key) window.STIPRequestedPlanningMonth = key;
    window.STIPPlanningMonth?.set?.(key);
    window.STIPHubs?.planning?.("personal");
  }
  function weekRangeLabel(w = []) {
    const rows = w.filter(Boolean);
    if (!rows.length) return "";
    const first = rows[0].d,
      last = rows.at(-1).d,
      sameMonth =
        first.getMonth() === last.getMonth() &&
        first.getFullYear() === last.getFullYear(),
      month = (d, short = false) =>
        d
          .toLocaleDateString("fr-FR", { month: short ? "short" : "long" })
          .replace(/\./g, "");
    if (sameMonth)
      return `${first.getDate()} → ${last.getDate()} ${month(last)}`;
    return `${first.getDate()} ${month(first, true)} → ${last.getDate()} ${month(last, true)}`;
  }

  async function call(url, action, body = {}) {
    const c = new AbortController(),
      t = setTimeout(() => c.abort(), 30000);
    try {
      const r = await fetch(url, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-STIP-Session": token(),
          },
          body: JSON.stringify({ action, ...body }),
          signal: c.signal,
        }),
        j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw Error(j.error || `Erreur ${r.status}`);
      return j;
    } catch (e) {
      if (e?.name === "AbortError")
        throw Error("Le serveur met trop de temps à répondre.");
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
  function perms() {
    return {
      ...(state.session?.permissions || {}),
      ...(window.STIPSession?.permissions || {}),
      ...(state.boot?.permissions || {}),
      ...(window.STIPBootCache?.permissions || {}),
    };
  }
  function has(k) {
    return !!perms()[k];
  }
  function publishBoot(d) {
    state.boot = d;
    window.STIPBootCache = d;
    window.dispatchEvent(new CustomEvent("stip:boot-updated", { detail: d }));
  }
  function pending() {
    return (state.home.actions || []).filter(
      (a) => a.status === "pending" && !a.completed_at && !a.cancelled_at,
    );
  }
  function noteCategory(n = {}) {
    if (n.category) return n.category;
    const s = `${n.title || ""} ${n.body || ""}`.toLowerCase();
    if (/accès|acces|profil|session/.test(s)) return "access";
    if (/signature|signer/.test(s)) return "signatures";
    if (/rappel|échéance|echeance/.test(s)) return "reminders";
    if (/planning|date|agenda|échange|echange/.test(s)) return "agenda";
    return "other";
  }
  function notifications() {
    const p = new Set(pending().map((a) => String(a.id))),
      native = (state.home.notifications || [])
        .filter((n) => !n.action_id || p.has(String(n.action_id)))
        .map((n) => ({ ...n, category: noteCategory(n), source: "stip" })),
      external = [...state.externalActions.values()].flat();
    return [...native, ...external];
  }
  function agentName(a = {}) {
    return (
      window.STIPName?.format?.(a) ||
      [a.prenom, a.nom].filter(Boolean).join(" ") ||
      "Agent"
    );
  }
  function done(x) {
    const s = String(x?.status || x?.statut || "").toLowerCase();
    return !!(
      x?.completed_at ||
      x?.cancelled_at ||
      x?.resolved_at ||
      [
        "done",
        "termine",
        "terminé",
        "cancelled",
        "annule",
        "annulé",
        "resolved",
        "traite",
        "traité",
        "refused",
        "refuse",
        "refusé",
        "rejected",
      ].includes(s)
    );
  }
  function shiftAsset(code) {
    const s = state.boot?.media?.shifts || {},
      k = String(code || "")
        .trim()
        .toUpperCase();
    return s[k] || s[`${k}.PNG`] || s[`${k}.JPG`] || s[`${k}.JPEG`] || "";
  }
  const SHIFT_BADGE_META = {
    M: ["morning", "Matin"],
    J: ["day", "Journée"],
    J4: ["late", "J4"],
    S: ["evening", "Soir"],
    N: ["night", "Nuit"],
    RH: ["rest", "Repos"],
    CA: ["leave", "Congé annuel"],
    CP: ["leave", "Congé payé"],
    RTT: ["rest", "RTT"],
    RTTA: ["rest", "RTTA"],
    RTA: ["rest", "RTA"],
    RC: ["rest", "Récupération"],
    RF: ["rest", "Repos férié"],
    FO: ["training", "Formation"],
    SYR: ["union", "Activité syndicale"],
    MA: ["medical", "Maladie"],
    AM: ["medical", "Arrêt médical"],
    AA: ["absence", "Absence autorisée"],
    ABS: ["absence", "Absence"],
    ST: ["training", "Référent stagiaire"],
    VM: ["medical", "Visite médicale"],
    OFF: ["rest", "Repos"],
    REPOS: ["rest", "Repos"],
    "-": ["none", "Aucun poste"],
    "—": ["none", "Aucun poste"],
  };
  const SPECIAL_SHIFT_ICON = {
    FO: "🎓",
    ST: "👶",
  };
  const WORK_SHIFT_ICON = {
    M: "🔵",
    J: "🟢",
    J4: "🟠",
    S: "🟡",
    N: "⚫",
  };
  function canonicalShift(raw) {
    const src = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/\*/g, "");
    if (!src) return "—";
    if (/^M\d*$/.test(src)) return "M";
    if (
      src === "J0464" ||
      src === "J" ||
      (/^J\d+$/.test(src) && !/^J4/.test(src))
    )
      return "J";
    if (src === "J4" || /^J4\d+$/.test(src)) return "J4";
    if (/^S\d*$/.test(src)) return "S";
    if (/^N\d*$/.test(src)) return "N";
    return src;
  }
  function shiftBadge(raw) {
    const code = canonicalShift(raw),
      meta = SHIFT_BADGE_META[code] || [
        "other",
        code === "—" ? "Aucun poste" : code,
      ],
      len = Math.min(Math.max(code.length, 1), 4);
    return `<strong class="hc-shift-badge shift-${meta[0]} len-${len}" title="${esc(meta[1])}" aria-label="${esc(meta[1])}">${esc(code)}</strong>`;
  }
  function shiftTime(code, row = {}) {
    const direct = String(
      row?.horaire || row?.horaires || row?.shift_time || "",
    ).trim();
    if (direct) return direct;
    const start = String(row?.start_time || "").slice(0, 5),
      end = String(row?.end_time || "").slice(0, 5);
    if (start || end) return [start, end].filter(Boolean).join("–");
    return (
      {
        M: "06:50–14:40",
        J: "08:30–16:20",
        J4: "10:10–18:00",
        S: "13:30–21:00",
        N: "21:00–06:50",
      }[
        String(code || "")
          .trim()
          .toUpperCase()
      ] || ""
    );
  }
  function weekTimeHtml(v) {
    const parts = String(v || "").match(/\d{1,2}(?::|h)\d{2}/g) || [];
    if (!parts.length) return "";
    return parts
      .slice(0, 2)
      .map((t) => `<span>${esc(t.replace("h", ":"))}</span>`)
      .join("");
  }
  function eventType(x = {}) {
    const raw = [x.kind, x.category, x.type, x.source_type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (raw.includes("stagiaire")) return "Stagiaire";
    if (raw.includes("formation")) return "Formation";
    if (
      raw.includes("réunion") ||
      raw.includes("reunion") ||
      raw.includes("meeting")
    )
      return "Réunion";
    if (
      raw.includes("mobi_lit_medical") ||
      raw.includes("médical") ||
      raw.includes("medical") ||
      raw.includes("visite")
    )
      return "Visite médicale";
    return (
      String(x.kind || x.category || x.type || "Événement").trim() ||
      "Événement"
    );
  }
  function eventPlace(x = {}) {
    return String(
      x.lieu || x.location || x.place || x.room || x.service || "",
    ).trim();
  }
  function agendaRange(start, days) {
    const rows = state.boot?.personal || [],
      today = parisIso(),
      loading = state.bootStatus !== "ready" && !rows.length;
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = parisIso(d),
        r = rows.find((x) => x.date === iso),
        code =
          String(r?.code || r?.source_value || "")
            .trim()
            .toUpperCase() || (loading ? "…" : "—");
      return {
        d,
        iso,
        dow: d.getDay() || 7,
        today: iso === today,
        code,
        time: shiftTime(code, r),
        row: r || null,
      };
    });
  }
  function agendaFromToday(days) {
    return agendaRange(dateObj(parisIso()), days);
  }
  function selectedWeek() {
    const today = dateObj(parisIso()),
      dow = today.getDay() || 7,
      monday = new Date(today);
    monday.setDate(today.getDate() - (dow - 1) + state.weekOffset * 7);
    if (state.weekOffset === 0 && !state.weekFull)
      return agendaRange(today, 8 - dow);
    return agendaRange(monday, 7);
  }
  function moveWeek(step) {
    step = Number(step) || 0;
    if (!step) return;
    if (step < 0) {
      if (state.weekOffset === 0 && !state.weekFull) state.weekFull = true;
      else if (state.weekOffset === 1) {
        state.weekOffset = 0;
        state.weekFull = false;
      } else {
        state.weekOffset -= 1;
        state.weekFull = true;
      }
    } else {
      if (state.weekOffset < 0) {
        state.weekOffset += 1;
        state.weekFull = true;
      } else if (state.weekOffset === 0 && state.weekFull)
        state.weekFull = false;
      else if (state.weekOffset === 0) {
        state.weekOffset = 1;
        state.weekFull = true;
      } else {
        state.weekOffset += 1;
        state.weekFull = true;
      }
    }
    state.renderSig = "";
    render();
  }
  function dayCard(x, cls = "hc-day", compact = false) {
    const canonical = canonicalShift(x.code),
      code = canonical.replace(/[^A-Z0-9]/g, "").toLowerCase() || "none",
      weekend = x.dow > 5,
      dayFull = x.d
        .toLocaleDateString("fr-FR", { weekday: "long" })
        .replace(".", "")
        .toUpperCase(),
      landscape = cls.includes("hc-day-landscape"),
      day = landscape ? dayFull.slice(0, 2) : weekend ? dayFull.slice(0, 1) : dayFull.slice(0, 3),
      loading = x.code === "…",
      dayOff = DAY_OFF.has(canonical),
      statusIcon = dayOff ? "🏝️" : SPECIAL_SHIFT_ICON[canonical] || "",
      shiftLabel = SHIFT_BADGE_META[canonical]?.[1] || canonical,
      workIcon = WORK_SHIFT_ICON[canonical] || "",
      workLabel = landscape && WORK_SHIFT_ICON[canonical] ? canonical : weekend && WORK_SHIFT_ICON[canonical] ? canonical : shiftLabel,
      visual = loading
        ? '<strong class="hc-shift-loading">…</strong>'
        : statusIcon
          ? `<span class="hc-rest-line"><span class="hc-status-icon" role="img" aria-label="${esc(shiftLabel)}">${statusIcon}</span><strong class="hc-status-code">${esc(canonical)}</strong></span>`
          : workIcon
            ? `<span class="hc-work-line" title="${esc(shiftLabel)}" aria-label="${esc(shiftLabel)}"><span class="hc-work-icon" aria-hidden="true">${workIcon}</span><strong class="hc-shift-name">${esc(workLabel)}</strong></span>`
            : `<strong class="hc-shift-name" title="${esc(shiftLabel)}" aria-label="${esc(shiftLabel)}">${esc(shiftLabel)}</strong>`;
    return `<span class="${cls} ${x.today ? "today" : ""} ${weekend ? "weekend" : ""} ${loading ? "loading" : REST.has(canonical) ? "rest" : "work"} code-${code}" ${x.today ? 'aria-current="date"' : ""}>${landscape ? weekEventMarker(x) : ""}<span class="hc-day-head"><i>${esc(day)}</i><b>${x.d.getDate()}</b></span><span class="hc-week-visual">${visual}</span></span>`;
  }
  function weekDaysVertical(w) {
    const weekdays = w.filter((x) => x.dow < 6),
      weekend = w.filter((x) => x.dow > 5);
    return `<div class="hc-days-vertical">${weekdays.map((x) => dayCard(x, "hc-day hc-day-vertical", true)).join("")}${weekend.length ? `<div class="hc-weekend-row">${weekend.map((x) => dayCard(x, "hc-day hc-day-vertical hc-day-weekend", true)).join("")}</div>` : ""}</div>`;
  }
  function weekEventsForDay(x) {
    const iso = String(x?.iso || "");
    if (!iso) return [];
    return futureItems().filter((event) => {
      const start = String(event.date || "").slice(0, 10),
        end = String(event.endDate || event.end_date || event.date || "").slice(0, 10);
      return start <= iso && end >= iso;
    });
  }
  function weekEventMarker(x) {
    const events = weekEventsForDay(x);
    if (!events.length) return "";
    return `<span class="hc-day-event-markers" aria-label="${events.length} événement${events.length > 1 ? "s" : ""}">${events
      .slice(0, 3)
      .map((event) => `<i title="${esc(event.title || event.type || "Événement")}">${event.icon || "•"}</i>`)
      .join("")}</span>`;
  }
  function weekDaysLandscape(w) {
    const hasEvents = w.some((x) => weekEventsForDay(x).length);\n    return `<div class="hc-days-landscape ${hasEvents ? "has-week-events" : "no-week-events"}" style="--visible-days:${Math.max(1, w.length)}">${w.map((x) => dayCard(x, "hc-day hc-day-landscape", true)).join("")}</div>`;
  }
  function planningStatus() {
    if (state.bootStatus === "loading")
      return '<p class="hc-planning-status">Chargement du planning…</p>';
    if (state.bootStatus === "error")
      return `<div class="hc-planning-status error"><span>Planning non chargé.</span><button type="button" data-planning-retry>Réessayer</button></div>`;
    return "";
  }
  function planningMonthTitle() {
    const w = selectedWeek(),
      mi = weekMonthInfo(w);
    return `<header class="hc-planning-month-title"><button type="button" class="hc-month-title-open" data-open-month="${esc(mi.targetKey)}" aria-label="Voir le planning complet de ${esc(mi.targetLabel)}"><small>PLANNING · ${esc(mi.yearLabel)}</small><span class="hc-month-title-name">${esc(mi.heading)}</span><span class="hc-month-title-hint">Ouvrir le planning du mois <b aria-hidden="true">›</b></span></button><div class="hc-week-nav hc-week-nav-global"><button type="button" data-week-step="-1" aria-label="Semaine précédente">‹</button><span class="hc-week-context"><strong>${esc(weekRangeLabel(w))}</strong><small>Semaine ${weekNo(w[0].d)}</small></span><button type="button" data-week-step="1" aria-label="Semaine suivante">›</button></div>${state.weekOffset !== 0 ? '<button type="button" class="hc-week-today hc-week-today-under-nav" data-week-today>Revenir à cette semaine</button>' : ""}</header>`;
  }
  function monthShortcut() {
    const mi = weekMonthInfo(selectedWeek());
    return `<button type="button" class="hc-month-open hc-month-open-right" data-open-month="${esc(mi.targetKey)}" aria-label="Voir le planning complet de ${esc(mi.targetLabel)}"><span class="hc-month-open-icon" aria-hidden="true">${ICON.personal}</span><span class="hc-month-open-copy"><em>PLANNING</em><strong>Voir tout le mois</strong><small>Voir ${esc(mi.targetLabel)} en entier</small></span><b>›</b></button>`;
  }
  function weekWidget() {
    const w = selectedWeek();
    return `<section class="hc-widget hc-widget-planning" data-widget="planning">${weekDaysLandscape(w)}${planningStatus()}</section>`;
  }
  function nativeFuture() {
    const b = state.boot || {},
      o = [];
    (b.agenda_items || [])
      .filter((x) => !done(x) && String(x.event_date || "") >= parisIso())
      .forEach((x) => {
        const time = x.all_day
            ? "Toute la journée"
            : [
                String(x.start_time || "").slice(0, 5),
                String(x.end_time || "").slice(0, 5),
              ]
                .filter(Boolean)
                .join("–"),
          place = eventPlace(x);
        o.push({
          id: `agenda:${x.id || x.event_date}`,
          date: String(x.event_date || "").slice(0, 10),
          endDate: String(x.event_date || "").slice(0, 10),
          icon:
            x.source_type === "mobi_lit_medical"
              ? "🩺"
              : x.importance === "urgent"
                ? "⚠️"
                : x.importance === "important"
                  ? "❗"
                  : "📌",
          type: eventType(x),
          title: x.title || "Événement",
          time,
          place,
          sub: [time, place].filter(Boolean).join(" · "),
        });
      });
    (b.personal_formations || [])
      .filter(
        (x) =>
          !done(x) && String(x.date_fin || x.date_debut || "") >= parisIso(),
      )
      .forEach((x) => {
        const time = String(x.horaire || "").trim(),
          place = eventPlace(x);
        o.push({
          id: `formation:${x.id || x.source_key || x.date_debut}`,
          date: String(x.date_debut || "").slice(0, 10),
          endDate: String(x.date_fin || x.date_debut || "").slice(0, 10),
          icon: "🎓",
          type: "Formation",
          title: x.intitule || "Formation",
          time,
          place,
          sub: [time, place].filter(Boolean).join(" · "),
        });
      });
    (b.personal_stagiaires || [])
      .filter(
        (x) =>
          !done(x) && String(x.date_fin || x.date_debut || "") >= parisIso(),
      )
      .forEach((x) => {
        const time = String(x.horaires || "").trim(),
          place = eventPlace(x);
        o.push({
          id: `stagiaire:${x.id || x.source_key || x.date_debut}`,
          date: String(x.date_debut || "").slice(0, 10),
          endDate: String(x.date_fin || x.date_debut || "").slice(0, 10),
          icon: "👶",
          type: "Stagiaire",
          title: [x.prenom, x.nom].filter(Boolean).join(" ") || "Stagiaire",
          time,
          place,
          sub: [time, place].filter(Boolean).join(" · "),
        });
      });
    return o;
  }
  function futureItems() {
    const all = [...nativeFuture(), ...state.future.values()].filter(
        (x) =>
          !done(x) &&
          String(x.endDate || x.end_date || x.date || "") >= parisIso(),
      ),
      m = new Map();
    all.forEach((x) => {
      const id = String(
          x.id || `${x.type || "item"}:${x.date || ""}:${x.title}`,
        ),
        old = m.get(id);
      if (!old || Number(x.priority || 0) > Number(old.priority || 0))
        m.set(id, { ...x, id, endDate: x.endDate || x.end_date || x.date });
    });
    return [...m.values()].sort(
      (a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        String(a.title).localeCompare(String(b.title), "fr"),
    );
  }
  function fmtDateRange(x) {
    const a = dateObj(x.date),
      z = dateObj(x.endDate || x.date),
      f = (d) =>
        d
          .toLocaleDateString("fr-FR", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })
          .replace(/\./g, "");
    return x.endDate && x.endDate !== x.date ? `${f(a)} → ${f(z)}` : f(a);
  }
  function futureTypeKey(x = {}) {
    const t = String(x.type || "").toLowerCase();
    if (t.includes("visite") || t.includes("médical") || t.includes("medical"))
      return "medical";
    if (t.includes("stagiaire")) return "intern";
    if (t.includes("formation")) return "training";
    return "other";
  }
  function futureTypeLabel(k) {
    return (
      {
        all: "Toutes les dates",
        medical: "Visites médicales",
        intern: "Stagiaires",
        training: "Formations",
        other: "Autres",
      }[k] || "Toutes les dates"
    );
  }
  function monthTitle(iso) {
    return dateObj(iso)
      .toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      .replace(/^./, (c) => c.toUpperCase());
  }
  function dayDelta(iso) {
    return Math.round((dateObj(iso) - dateObj(parisIso())) / 86400000);
  }
  function nextLabel(iso) {
    const d = dayDelta(iso);
    if (d === 0) return "Aujourd’hui";
    if (d === 1) return "Demain";
    if (d > 1 && d < 7) return `Dans ${d} jours`;
    return fmtDateRange({ date: iso, endDate: iso });
  }
  function renderFutureHub(active = "all", focusId = "") {
    const body = $("#hsPanelBody");
    if (!body) return;
    const all = futureItems(),
      filtered =
        active === "all" ? all : all.filter((x) => futureTypeKey(x) === active),
      next = filtered[0] || null,
      monthCount = filtered.filter(
        (x) => String(x.date || "").slice(0, 7) === parisIso().slice(0, 7),
      ).length,
      weekCount = filtered.filter((x) => {
        const d = dayDelta(x.date);
        return d >= 0 && d < 7;
      }).length,
      tabs = [
        ["all", "Tout"],
        ["medical", "Visites"],
        ["intern", "Stagiaires"],
        ["training", "Formations"],
      ],
      days = Array.from({ length: 21 }, (_, i) => {
        const d = dateObj(parisIso());
        d.setDate(d.getDate() + i);
        const iso = parisIso(d),
          hasEvent = filtered.some(
            (x) => String(x.date || "").slice(0, 10) === iso,
          ),
          isToday = i === 0;
        return `<span class="hc-agenda-day ${hasEvent ? "has-event" : ""} ${isToday ? "today" : ""}"><small>${esc(d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase())}</small><b>${d.getDate()}</b>${hasEvent ? "<i></i>" : ""}</span>`;
      }).join(""),
      groups = new Map();
    filtered.forEach((x) => {
      const k = String(x.date || "").slice(0, 7);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(x);
    });
    const timeline = [...groups.entries()]
      .map(
        ([k, items]) =>
          `<section class="hc-agenda-month"><h4>${esc(monthTitle(items[0].date))}</h4><div>${items
            .map((x) => {
              const key = futureTypeKey(x),
                time = String(x.time || "").trim(),
                place = String(x.place || "").trim(),
                isFocus = String(x.id) === String(focusId);
              return `<article class="hc-agenda-item ${isFocus ? "is-focus" : ""}" data-agenda-id="${esc(x.id)}"><div class="hc-agenda-date"><b>${esc(dateObj(x.date).toLocaleDateString("fr-FR", { day: "2-digit" }))}</b><small>${esc(dateObj(x.date).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase())}</small></div><i class="hc-agenda-icon type-${key}">${x.icon || "•"}</i><div class="hc-agenda-copy"><span class="hc-agenda-item-top"><small>${esc((x.type || "Événement").toUpperCase())}</small><em>${esc(nextLabel(x.date))}</em></span><strong>${esc(x.title)}</strong><p>${esc([time, place].filter(Boolean).join(" · ") || x.sub || "")}</p></div></article>`;
            })
            .join("")}</div></section>`,
      )
      .join("");
    body.innerHTML = `<section class="hc-agenda-hub"><div class="hc-agenda-hero"><small>AGENDA</small><h3>${esc(futureTypeLabel(active))}</h3>${next ? `<p><b>${esc(nextLabel(next.date))}</b> · ${esc(next.title)}</p>` : "<p>Aucune date à venir dans cette catégorie.</p>"}<div class="hc-agenda-stats"><span><b>${filtered.length}</b><small>à venir</small></span><span><b>${weekCount}</b><small>cette semaine</small></span><span><b>${monthCount}</b><small>ce mois</small></span></div></div><nav class="hc-agenda-tabs" aria-label="Filtrer l’agenda">${tabs.map(([k, l]) => `<button type="button" data-agenda-filter="${k}" class="${active === k ? "active" : ""}">${l}<b>${k === "all" ? all.length : all.filter((x) => futureTypeKey(x) === k).length}</b></button>`).join("")}</nav><div class="hc-agenda-strip" aria-label="21 prochains jours">${days}</div><div class="hc-agenda-timeline">${timeline || '<div class="hc-agenda-empty">Rien à afficher pour le moment.</div>'}</div></section>`;
    body.querySelectorAll("[data-agenda-filter]").forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.dataset.agendaFilter || "all";
          if ($("#hsPanelTitle"))
            $("#hsPanelTitle").textContent = futureTypeLabel(k);
          renderFutureHub(k, "");
        }),
    );
    if (focusId)
      requestAnimationFrame(() =>
        body
          .querySelector(`[data-agenda-id="${CSS.escape(String(focusId))}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" }),
      );
  }
  function futureWidget() {
    const w = selectedWeek(),
      weekStart = w[0]?.iso || "",
      weekEnd = w[w.length - 1]?.iso || "",
      items = futureItems().filter((x) => {
        const start = String(x.date || "").slice(0, 10),
          end = String(x.endDate || x.end_date || x.date || "").slice(0, 10);
        return start <= weekEnd && end >= weekStart;
      }),
      show = items.slice(0, 3);
    if (!show.length) return "";
    return `<section class="hc-widget hc-widget-future hc-week-event-key" data-widget="future"><div class="hc-week-event-key-list">${show
      .map((x) => {
        const time = String(x.time || "").trim(),
          place = String(x.place || "").trim(),
          extra = [time, place].filter(Boolean).join(" · ");
        return `<button type="button" class="hc-week-event-key-item" data-widget-open="future" data-future-id="${esc(x.id)}"><span class="hc-week-event-key-icon">${x.icon || "•"}</span><span><strong>${esc(x.title)}</strong><small>${esc(fmtDateRange(x))}${extra ? ` · ${esc(extra)}` : ""}</small></span></button>`;
      })
      .join("")}</div></section>`;
  }
  function nativeExchanges() {
    const b = state.boot || {},
      src = [
        ...(b.change_requests || []),
        ...(b.home?.change_requests || []),
        ...(b.exchanges || []),
      ];
    return src
      .filter((x) => !done(x))
      .map((x) => ({
        id: `exchange:${x.id || x.request_id || x.date || x.shift_date || "pending"}`,
        icon: "⇄",
        title: x.title || x.label || "Changement de planning",
        sub:
          x.summary ||
          x.description ||
          [x.from_shift, x.to_shift].filter(Boolean).join(" → ") ||
          "Demande en cours",
        date: x.date || x.shift_date || "",
        priority: 50,
      }));
  }
  function exchangeItems() {
    const m = new Map();
    [...nativeExchanges(), ...state.exchanges.values()]
      .filter((x) => !done(x))
      .forEach((x) => {
        const id = String(x.id || `${x.date}:${x.title}`),
          old = m.get(id);
        if (!old || Number(x.priority || 0) > Number(old.priority || 0))
          m.set(id, { ...x, id });
      });
    return [...m.values()].sort(
      (a, b) => Number(b.priority || 0) - Number(a.priority || 0),
    );
  }
  function exchangeWidget() {
    const a = exchangeItems();
    if (!a.length) return "";
    const x = a[0];
    return `<section class="hc-widget hc-widget-alert" data-widget="exchange"><header class="hc-widget-head hc-widget-head-compact"><div><small>PLANNING</small><h2>Échanges & changements</h2></div><button type="button" data-widget-open="exchange">${a.length} ›</button></header><button class="hc-live-row" type="button" data-widget-open="exchange"><i>⇄</i><span><strong>${esc(x.title)}</strong><em>${esc(x.sub || "À consulter")}</em></span><b>›</b></button></section>`;
  }
  function genericWidgets() {
    return [...state.widgets.values()]
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
      .map(
        (x) =>
          `<section class="hc-widget hc-widget-generic"><header class="hc-widget-head hc-widget-head-compact"><div><small>${esc(x.kicker || "INFO")}</small><h2>${esc(x.title || "À retenir")}</h2></div>${x.count != null ? `<b>${esc(x.count)}</b>` : ""}</header>${x.body ? `<p class="hc-widget-text">${esc(x.body)}</p>` : ""}</section>`,
      )
      .join("");
  }
  function profile() {
    const a = state.boot?.agent || state.session?.agent || {},
      media = state.boot?.media || {},
      avatar = media.avatars?.[a.source_key] || a.avatar_url || "",
      ghe = String(a.ghe || "").trim(),
      team = String(a.type_planning || a.equipe || "").trim(),
      tel = String(a.telephone || "").trim(),
      mail = String(a.email || a.email_pro || "").trim(),
      ini = ((a.prenom?.[0] || "") + (a.nom?.[0] || "")).toUpperCase(),
      gheLabel = ghe
        ? ghe.toUpperCase().startsWith("GHE")
          ? ghe
          : `GHE ${ghe}`
        : "";
    return `<section class="hc-profile hc-profile-full hc-id-card">
      <div class="hc-avatar">${avatar ? `<img src="${esc(avatar)}" alt="">` : `<span>${esc(ini)}</span>`}</div>
      <div class="hc-profile-copy">
        <small>MON PROFIL</small>
        <strong class="hc-profile-name">${esc(agentName(a))}</strong>
        <div class="hc-profile-role">
          ${gheLabel ? `<strong class="hc-profile-ghe">${esc(gheLabel)}</strong>` : ""}
          ${team ? `<span class="hc-profile-team">Équipe ${esc(cap(team))}</span>` : ""}
        </div>
        <div class="hc-profile-contacts">
          ${tel ? `<button class="hc-profile-contact" data-copy="${esc(tel)}" data-label="Numéro"><span>TÉLÉPHONE</span><strong>${esc(tel)}</strong></button>` : ""}
          ${mail ? `<button class="hc-profile-contact" data-copy="${esc(mail)}" data-label="E-mail"><span>E-MAIL</span><strong>${esc(mail)}</strong></button>` : ""}
        </div>
      </div>
    </section>`;
  }
  function app(kind, title, cls, action) {
    return `<button class="hc-app ${cls}" data-app="${action}"><span>${ICON[kind]}</span><strong>${esc(title)}</strong></button>`;
  }
  function apps() {
    let s = "";
    if (has("planning_personal"))
      s += app("personal", "Planning perso", "personal", "personal");
    if (has("tomorrow"))
      s += app("tomorrow", "Pour demain", "tomorrow", "tomorrow");
    if (has("planning_team") || has("activity") || has("assistant_enabled"))
      s += app("team", "Esprit d’équipe", "team", "team");
    if (has("change_app")) s += app("change", "Changement", "change", "change");
    if (has("calendar_subscribe"))
      s += app("calendar", "Synchroniser mon calendrier", "calendar", "calendar");
    if (has("agent_dates"))
      s += app("dates", "Date des agents", "dates", "dates");
    if (has("contacts"))
      s += app("contacts", "Contacts", "contacts", "contacts");
    if (has("responsable"))
      s += app("responsable", "Responsable", "responsable", "responsable");
    if (has("nouveaux_arrivants"))
      s += app("newagent", "Nouvel agent", "newagent", "newagent");
    if (has("file_upload")) s += app("upload", "Importer", "upload", "upload");
    if (has("admin")) s += app("admin", "Admin", "admin", "admin");
    if (has("access_manage") || has("admin"))
      s += app("access", "Accès", "access", "access");
    return s || '<p class="hc-empty">Aucune application autorisée.</p>';
  }
  function homeModeNav() {
    const active = state.homeMode || "planning",
      count = notifications().length + Number(window.STIPMessagesUnread || 0),
      items = [
        ["notifications", "Notifications", ICON.homeBell],
        ["planning", "Mon profil", ICON.homeHome],
        ["apps", "Applications", ICON.homeApps],
      ];
    return `<nav class="hc-home-filters" aria-label="Accueil STIP">${items
      .map(
        ([key, label, art]) =>
          `<button type="button" data-home-mode="${key}" aria-pressed="${active === key}" class="${active === key ? "active" : ""}"><span class="hc-home-filter-art">${art}</span><strong>${label}</strong>${key === "notifications" && count ? `<span class="hc-home-filter-badge" aria-label="${count} élément${count > 1 ? "s" : ""} à traiter">${count}</span>` : ""}</button>`,
      )
      .join("")}</nav>`;
  }

  function actionCenterData(filter = state.actionFilter) {
    const ns = notifications(),
      cats = [
        ["all", "Tout"],
        ["access", "Accès"],
        ["signatures", "Signatures"],
        ["reminders", "Rappels"],
        ["agenda", "Agenda"],
        ["other", "Autres"],
      ],
      counts = Object.fromEntries(
        cats.map(([k]) => [
          k,
          k === "all" ? ns.length : ns.filter((n) => noteCategory(n) === k).length,
        ]),
      ),
      shown = filter === "all" ? ns : ns.filter((n) => noteCategory(n) === filter);
    return { ns, cats, counts, shown };
  }

  function actionCenterMarkup(filter = state.actionFilter, inline = false) {
    const { ns, cats, counts, shown } = actionCenterData(filter);
    const head = inline
      ? `<header class="hc-profile-actions-head"><div><span class="stip-kicker">À TRAITER</span><h2>Notifications</h2><p>${ns.length ? `${ns.length} élément${ns.length > 1 ? "s" : ""} demande${ns.length > 1 ? "nt" : ""} votre attention.` : "Rien ne demande votre attention pour le moment."}</p></div></header>`
      : "";
    return `${head}<div class="hc-action-filters stip-action-filters" role="tablist" aria-label="Catégories à traiter">${cats.map(([k, l]) => `<button type="button" role="tab" aria-selected="${filter === k}" data-action-filter="${k}">${l}${counts[k] ? ` <span>${counts[k]}</span>` : ""}</button>`).join("")}</div>${shown.length ? `<div class="hc-panel-list">${shown.map((n, i) => `<button class="hs-note" data-note-index="${i}"><small>${esc(cats.find((x) => x[0] === noteCategory(n))?.[1] || "Autres")}</small><strong>${esc(n.title)}</strong>${n.body ? `<p>${esc(n.body)}</p>` : ""}</button>`).join("")}</div>` : '<div class="hc-empty">Rien à traiter dans cette catégorie.</div>'}`;
  }

  function bindActionCenter(scope, filter = state.actionFilter, inline = false) {
    if (!scope) return;
    const { shown } = actionCenterData(filter);
    scope.querySelectorAll("[data-action-filter]").forEach(
      (b) =>
        (b.onclick = () => {
          const next = b.dataset.actionFilter || "all";
          state.actionFilter = next;
          if (inline) renderProfileActions(next);
          else renderActionCenter(next);
        }),
    );
    scope.querySelectorAll("[data-note-index]").forEach(
      (b) =>
        (b.onclick = () => {
          const n = shown[Number(b.dataset.noteIndex)];
          if (n?.source && n.source !== "stip")
            window.dispatchEvent(
              new CustomEvent("stip:action-center-open", { detail: n }),
            );
          else if (n?.action_id) {
            if (inline) panel(true, "À traiter");
            openAction(n.action_id);
          }
        }),
    );
  }

  function renderProfileActions(filter = state.actionFilter) {
    const host = $("#hcProfileActions");
    if (!host) return;
    state.actionFilter = filter;
    host.innerHTML = actionCenterMarkup(filter, true);
    bindActionCenter(host, filter, true);
  }

  function notificationsPane() {
    return `<section class="hc-home-pane hc-home-pane-notifications"><section id="hcCommunicationHub" class="hc-communication-host" aria-live="polite"></section><section id="hcProfileActions" class="hc-profile-actions stip-action-surface">${actionCenterMarkup(state.actionFilter, true)}</section><details class="hc-account-fold"><summary>Compte</summary><div><section class="hc-account-actions"><button type="button" id="hcLogout" class="hc-account-logout">Se déconnecter complètement</button></section></div></details></section>`;
  }

  function homeModeBody() {
    if (state.homeMode === "notifications") return notificationsPane();
    if (state.homeMode === "apps")
      return `<section class="hc-home-pane hc-home-pane-apps"><section id="hcMyAppsHost"></section></section>`;
    return `<main class="hc-widget-zone hc-home-pane hc-home-pane-planning">${planningMonthTitle()}<section class="hc-planning-group hc-planning-landscape"><div class="hc-planning-week-row">${weekWidget()}</div><div id="hcTomorrowDock"></div><div class="hc-planning-agenda-row">${futureWidget()}</div></section>${exchangeWidget()}${genericWidgets()}</main>`;
  }
  function render() {
    const root = $("#homeView .hs-home");
    if (!root || !state.boot) return;
    const markup = `${profile()}${homeModeNav()}<section class="hc-home-mode-content" data-home-mode-current="${esc(state.homeMode)}">${homeModeBody()}</section>`;
    if (state.renderSig === markup && root.childElementCount) return;
    const onHome = (window.STIPRouter?.get?.() || "home") === "home",
      y = onHome ? Math.max(0, window.scrollY || 0) : 0;
    state.renderSig = markup;
    root.innerHTML = markup;
    root
      .querySelectorAll("[data-copy]")
      .forEach(
        (b) => (b.onclick = () => copyText(b.dataset.copy, b.dataset.label)),
      );
    $("#hcLogout")?.addEventListener("click", () =>
      document.getElementById("logoutBtn")?.click(),
    );
    if (state.homeMode === "notifications") bindActionCenter($("#hcProfileActions"), state.actionFilter, true);
    root.querySelectorAll("[data-home-mode]").forEach(
      (b) =>
        (b.onclick = () => {
          const next = b.dataset.homeMode || "planning";
          if (next === state.homeMode) return;
          state.homeMode = next;
          state.renderSig = "";
          render();
        }),
    );
    if (state.homeMode === "apps") window.STIPFavorites?.renderApps?.(root.querySelector("#hcMyAppsHost"));
    root
      .querySelector("[data-open-month]")
      ?.addEventListener("click", (e) =>
        openPlanningMonth(e.currentTarget.dataset.openMonth),
      );
    root
      .querySelectorAll("[data-app]")
      .forEach((b) => (b.onclick = () => openApp(b.dataset.app)));
    root
      .querySelectorAll("[data-widget-open]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            openWidget(b.dataset.widgetOpen, b.dataset.futureId || "")),
      );
    root
      .querySelectorAll("[data-week-step]")
      .forEach((b) => (b.onclick = () => moveWeek(b.dataset.weekStep)));
    root.querySelector("[data-week-today]")?.addEventListener("click", () => {
      state.weekOffset = 0;
      state.weekFull = false;
      state.renderSig = "";
      render();
    });
    root
      .querySelector("[data-planning-retry]")
      ?.addEventListener("click", () => {
        state.renderSig = "";
        refresh(true).catch(() => {});
      });
    window.dispatchEvent(new CustomEvent("stip:home-rendered"));
    if (onHome && y > 0)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (
            (window.STIPRouter?.get?.() || "home") === "home" &&
            Math.abs((window.scrollY || 0) - y) > 2
          )
            window.scrollTo({ top: y, behavior: "auto" });
        }),
      );
  }
  async function copyText(v, l) {
    try {
      await navigator.clipboard.writeText(v);
    } catch {}
    let t = $(".hc-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "hc-toast";
      document.body.appendChild(t);
    }
    t.textContent = `${l} copié`;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 1300);
  }
  function openApp(k) {
    if (k === "personal") return window.STIPHubs?.planning?.("personal");
    if (k === "tomorrow") return window.STIPTomorrowUI?.open?.();
    if (k === "team") return (location.href = "esprit-equipe.html");
    if (k === "change") return window.STIPHubs?.planning?.("change");
    if (k === "calendar") return window.STIPHubs?.planning?.("calendar");
    if (k === "dates") return (location.href = "agent-dates.html");
    if (k === "contacts") return window.STIPHubs?.contacts?.();
    if (k === "responsable") return (location.href = "responsable.html");
    if (k === "newagent")
      return (location.href = "https://esapin69.github.io/Ghe-interne/");
    if (k === "upload")
      return (location.href = "https://admin-ghe.esapin.com/depot.html");
    if (k === "admin") return (location.href = "https://admin-ghe.esapin.com/");
    if (k === "access") return (location.href = "access-manage.html");
  }
  function panel(v, title = "") {
    const p = $("#hsPanel");
    p?.classList.toggle("open", !!v);
    p?.setAttribute("aria-hidden", v ? "false" : "true");
    if (title && $("#hsPanelTitle")) $("#hsPanelTitle").textContent = title;
  }
  function openWidget(kind, focusId = "") {
    const body = $("#hsPanelBody");
    if (!body) return;
    if (kind === "future") {
      const focus = futureItems().find((x) => String(x.id) === String(focusId)),
        active = focus ? futureTypeKey(focus) : "all";
      if (has("agent_dates")) {
        location.href =
          "agent-dates.html?filter=" +
          encodeURIComponent(active) +
          (focusId ? "&focus=" + encodeURIComponent(focusId) : "");
        return;
      }
      panel(true, futureTypeLabel(active));
      renderFutureHub(active, focusId);
      return;
    }
    if (kind === "exchange") {
      const a = exchangeItems();
      panel(true, "Échanges & changements");
      body.innerHTML = `<section class="hc-panel-widget"><div class="hc-panel-list">${a.map((x) => `<article><i>⇄</i><div><strong>${esc(x.title)}</strong><p>${esc(x.sub || "À consulter")}</p></div></article>`).join("")}</div><button class="hc-panel-primary" id="hcOpenChange">Ouvrir Changement</button></section>`;
      $("#hcOpenChange")?.addEventListener("click", () => {
        panel(false);
        openApp("change");
      });
      return;
    }
  }
  function openNotifications() {
    panel(true, "À traiter");
    renderActionCenter("all");
  }
  function renderActionCenter(filter = state.actionFilter) {
    const body = $("#hsPanelBody");
    if (!body) return;
    state.actionFilter = filter;
    body.innerHTML = actionCenterMarkup(filter, false);
    bindActionCenter(body, filter, false);
  }
  async function openAction(id) {
    const body = $("#hsPanelBody");
    try {
      const r = await call(ACTION_API, "get", { action_id: id }),
        a = r.action,
        url = a?.metadata?.url || a?.metadata?.target_url || "";
      body.innerHTML = `<div class="hs-sign-card"><h3>${esc(a.title || "À traiter")}</h3><p>${esc(a.body || "")}</p>${url ? `<a class="hc-panel-primary" href="${esc(url)}">Ouvrir</a>` : '<p class="hs-sign-meta">Ouvre la demande depuis son écran d’origine.</p>'}</div>`;
    } catch (e) {
      body.innerHTML = `<div class="hs-note"><strong>Demande indisponible</strong><p>${esc(e.message)}</p></div>`;
    }
  }
  function saveContacts(d) {
    window.STIPContactsCache = d;
    try {
      sessionStorage.setItem(
        "stip_contacts_cache_v1",
        JSON.stringify({ at: Date.now(), data: d }),
      );
    } catch {}
    window.dispatchEvent(
      new CustomEvent("stip:contacts-updated", { detail: d }),
    );
    return d;
  }
  function prefetchContacts() {
    if (
      !has("contacts") ||
      window.STIPContactsCache ||
      window.STIPContactsPromise
    )
      return;
    window.STIPContactsPromise = call(DATA_API, "contacts")
      .then(saveContacts)
      .catch(() => null)
      .finally(() => (window.STIPContactsPromise = null));
  }
  async function refresh(force = false) {
    if (!token() || !state.ready) return;
    if (state.refreshing && !force) return state.refreshing;
    state.bootStatus = "loading";
    state.bootError = "";
    state.renderSig = "";
    render();
    state.refreshing = (async () => {
      try {
        const [boot, home] = await Promise.allSettled([
          call(DATA_API, "bootstrap"),
          call(ACTION_API, "home"),
        ]);
        if (boot.status === "fulfilled") {
          state.bootStatus = "ready";
          publishBoot(boot.value);
          prefetchContacts();
        } else {
          state.bootStatus = "error";
          state.bootError = boot.reason?.message || "Planning indisponible.";
        }
        if (home.status === "fulfilled") state.home = home.value;
        render();
      } finally {
        state.refreshing = null;
      }
    })();
    return state.refreshing;
  }
  function ready(e) {
    state.ready = true;
    state.session = e?.detail || window.STIPSession || state.session;
    state.bootStatus = "loading";
    state.bootError = "";
    state.renderSig = "";
    const a = state.session?.agent || {};
    publishBoot({
      agent: a,
      permissions: state.session?.permissions || {},
      team: a.type_planning || a.equipe || "",
      personal: [],
      media: { avatars: {}, shifts: {} },
    });
    render();
    refresh().catch(() => {});
  }
  function ended() {
    state.ready = false;
    state.session = null;
    state.boot = null;
    state.bootStatus = "idle";
    state.bootError = "";
    state.home = { actions: [], notifications: [] };
    state.externalActions.clear();
    state.weekOffset = 0;
    state.weekFull = false;
    state.renderSig = "";
    window.STIPBootCache = null;
    panel(false);
  }
  function publishMap(map, x) {
    if (!x?.title) return;
    const id = String(x.id || `${x.type || "item"}:${x.date || ""}:${x.title}`);
    map.set(id, { ...x, id });
    state.renderSig = "";
    render();
  }
  function removeMap(map, id) {
    map.delete(String(id || ""));
    state.renderSig = "";
    render();
  }
  window.STIPTimeline = {
    publish: (x) => publishMap(state.future, x),
    remove: (id) => removeMap(state.future, id),
  };
  window.STIPExchange = {
    publish: (x) => publishMap(state.exchanges, x),
    remove: (id) => removeMap(state.exchanges, id),
  };
  window.STIPWidgets = {
    publish: (x) => publishMap(state.widgets, x),
    remove: (id) => removeMap(state.widgets, id),
  };
  window.STIPActionCenter = {
    publish: (source, items = []) => {
      state.externalActions.set(String(source), items);
      state.renderSig = "";
      render();
      if (
        $("#hsPanel")?.classList.contains("open") &&
        $("#hsPanelTitle")?.textContent === "À traiter"
      )
        renderActionCenter();
    },
    remove: (source) => {
      state.externalActions.delete(String(source));
      state.renderSig = "";
      render();
    },
  };
  window.STIPAgentCard = (agent, media, label = "AGENT") => {
    const a = agent || {},
      av = media?.avatars?.[a.source_key] || a.avatar_url || "";
    return `<section class="hc-profile"><div class="hc-avatar">${av ? `<img src="${esc(av)}" alt="">` : ""}</div><div class="hc-profile-copy"><small>${esc(label)}</small><strong>${esc(agentName(a))}</strong></div></section>`;
  };
  window.addEventListener("stip:session-ready", ready);
  window.addEventListener("stip:session-ended", ended);
  window.addEventListener("stip:messages-unread", () => { state.renderSig = ""; render(); });
  $("#hsPanelBack")?.addEventListener("click", () => panel(false));
  setInterval(() => {
    if (
      state.ready &&
      !document.hidden &&
      (window.STIPRouter?.get?.() || "home") === "home"
    )
      refresh().catch(() => {});
  }, 60000);
  if (window.STIPSession) ready({ detail: window.STIPSession });
})();