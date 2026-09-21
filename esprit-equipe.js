(() => {
  "use strict";

  const ROOT = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/";
  const STORE = "stip_session_v1";
  const CACHE_TTL = 5 * 60 * 1000;
  const SHIFT_ORDER = ["M", "J", "J4", "S", "N"];
  const SHIFT = {
    M: { label: "Matin", time: "06h50 – 14h40" },
    J: { label: "Journée", time: "08h30 – 16h20" },
    J4: { label: "J4", time: "10h10 – 18h00" },
    S: { label: "Soir", time: "13h30 – 21h00" },
    N: { label: "Nuit", time: "21h00 – 06h50" },
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );

  const params = new URLSearchParams(location.search);
  const requestedTab = params.get("tab") || params.get("view");
  const navigationState = window.STIPNav?.read?.() || {};
  const state = {
    access: null,
    tab: ["team", "activity", "assistant"].includes(requestedTab)
      ? requestedTab
      : ["team", "activity", "assistant"].includes(navigationState.tab)
        ? navigationState.tab
        : "team",
    weekStart: /^\d{4}-\d{2}-\d{2}$/.test(navigationState.weekStart || "")
      ? monday(navigationState.weekStart)
      : monday(todayIso()),
    dayFocus: /^\d{4}-\d{2}-\d{2}$/.test(navigationState.dayFocus || "")
      ? navigationState.dayFocus
      : todayIso(),
    weeks: new Map(),
    request: 0,
    rendered: false,
    openShift: "",
    dateJumpMonth: "",
    personalCalendar: {
      plan: new Map(),
      events: new Map(),
      loaded: false,
    },
  };

  function token() {
    return localStorage.getItem(STORE) || "";
  }

  async function post(fn, body) {
    const response = await fetch(ROOT + fn, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-STIP-Session": token(),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error)
      throw Error(data.error || `Erreur ${response.status}`);
    return data;
  }

  function dateObj(value) {
    return new Date(`${value}T12:00:00`);
  }

  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function todayIso() {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Europe/Paris",
    }).format(new Date());
  }

  function addDays(value, count) {
    const date = dateObj(value);
    date.setDate(date.getDate() + count);
    return iso(date);
  }

  function monday(value) {
    const date = dateObj(value);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    return iso(date);
  }

  function daysOfWeek(start = state.weekStart) {
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  function isoWeek(value) {
    const date = dateObj(value);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const first = new Date(date.getFullYear(), 0, 4, 12);
    return (
      1 +
      Math.round(
        ((date - first) / 86400000 - 3 + ((first.getDay() + 6) % 7)) / 7,
      )
    );
  }

  function shortDay(value) {
    return dateObj(value)
      .toLocaleDateString("fr-FR", { weekday: "short" })
      .replace(".", "")
      .toUpperCase();
  }

  function dayTitle(value) {
    return dateObj(value)
      .toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
      .replace(/^./, (char) => char.toUpperCase());
  }

  function monthContext(start = state.weekStart) {
    const end = addDays(start, 6);
    const first = dateObj(start);
    const last = dateObj(end);
    const months =
      first.getMonth() === last.getMonth()
        ? [first.toLocaleDateString("fr-FR", { month: "long" })]
        : [
            first.toLocaleDateString("fr-FR", { month: "long" }),
            last.toLocaleDateString("fr-FR", { month: "long" }),
          ];
    const years =
      first.getFullYear() === last.getFullYear()
        ? [first.getFullYear()]
        : [first.getFullYear(), last.getFullYear()];
    return {
      month: months.map((value) => value.toUpperCase()).join(" · "),
      year: years.join(" · "),
    };
  }

  function weekRange(start = state.weekStart) {
    const end = addDays(start, 6);
    const first = dateObj(start);
    const last = dateObj(end);
    const sameMonth = first.getMonth() === last.getMonth();
    const left = first.toLocaleDateString("fr-FR", {
      day: "numeric",
      ...(sameMonth ? {} : { month: "short" }),
    });
    const right = last.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${left} – ${right}`;
  }
  function monthKey(value) {
    const date = dateObj(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function shiftMonthKey(key, step) {
    const [year, month] = String(key || "").split("-").map(Number);
    const date = new Date(
      year || dateObj(state.weekStart).getFullYear(),
      (month || dateObj(state.weekStart).getMonth() + 1) - 1 + Number(step || 0),
      1,
      12,
    );
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function firstMondayOfMonth(key) {
    const date = dateObj(`${key}-01`);
    const day = date.getDay() || 7;
    if (day !== 1) date.setDate(date.getDate() + ((8 - day) % 7));
    return iso(date);
  }

  const CAL_SHIFT_META = {
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
    ST: ["training", "Référent stagiaire"],
    VM: ["medical", "Visite médicale"],
    SYR: ["union", "Activité syndicale"],
    MA: ["medical", "Maladie"],
    AM: ["medical", "Arrêt médical"],
    AA: ["absence", "Absence autorisée"],
    ABS: ["absence", "Absence"],
    OFF: ["rest", "Repos"],
    REPOS: ["rest", "Repos"],
  };
  const CAL_SPECIAL_ICON = {
    RH: "🏝️",
    CA: "🌴",
    CP: "🌴",
    RTT: "⏱️",
    RTTA: "⏱️",
    RTA: "⏱️",
    RC: "↻",
    RF: "•",
    FO: "🎓",
    ST: "👶",
    VM: "🩺",
    SYR: "🤝",
    MA: "•",
    AM: "•",
    AA: "•",
    ABS: "•",
    OFF: "🏝️",
    REPOS: "🏝️",
  };
  const CAL_WORK_TYPE = {
    M: "morning",
    J: "day",
    J4: "late",
    S: "evening",
    N: "night",
  };

  function canonicalCalendarShift(raw) {
    const source = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/\*/g, "");
    if (!source) return "";
    if (/^M\d*$/.test(source)) return "M";
    if (
      source === "J0464" ||
      source === "J" ||
      (/^J\d+$/.test(source) && !/^J4/.test(source))
    )
      return "J";
    if (source === "J4" || /^J4\d+$/.test(source)) return "J4";
    if (/^S\d*$/.test(source)) return "S";
    if (/^N\d*$/.test(source)) return "N";
    return source;
  }

  function personalShiftForDate(value) {
    const row = state.personalCalendar.plan.get(value);
    if (!row) return null;
    const code = canonicalCalendarShift(row.code || row.source_value);
    if (!code) return null;
    const meta = CAL_SHIFT_META[code] || ["other", code];
    return {
      code,
      type: meta[0],
      label: meta[1],
      work: Boolean(CAL_WORK_TYPE[code]),
      icon: CAL_SPECIAL_ICON[code] || (CAL_WORK_TYPE[code] ? "" : "•"),
    };
  }

  function pushCalendarEvent(map, value, icon) {
    const day = String(value || "").slice(0, 10);
    const mark = String(icon || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !mark) return;
    if (!map.has(day)) map.set(day, []);
    const list = map.get(day);
    if (!list.includes(mark) && list.length < 2) list.push(mark);
  }

  function expandCalendarRange(start, end, callback, max = 370) {
    let day = String(start || "").slice(0, 10);
    const last = String(end || start || "").slice(0, 10);
    let count = 0;
    while (day && day <= last && count++ < max) {
      callback(day);
      day = addDays(day, 1);
    }
  }

  function setPersonalCalendar(data = {}) {
    const plan = new Map();
    for (const row of data.items || []) {
      const day = String(row?.date || "").slice(0, 10);
      if (day) plan.set(day, row);
    }
    const events = new Map();
    for (const item of data.agenda_items || []) {
      const sourceType = String(item?.source_type || "");
      const medical = /medical|mobi_lit|visite/i.test(sourceType);
      pushCalendarEvent(
        events,
        item?.event_date,
        medical
          ? "🩺"
          : String(item?.icon || "").trim() ||
              (item?.importance === "urgent"
                ? "⚠️"
                : item?.importance === "important"
                  ? "❗"
                  : "📌"),
      );
    }
    for (const item of data.personal_formations || [])
      expandCalendarRange(
        item?.date_debut,
        item?.date_fin || item?.date_debut,
        (day) => pushCalendarEvent(events, day, "🎓"),
        40,
      );
    for (const item of data.personal_stagiaires || [])
      expandCalendarRange(
        item?.date_debut,
        item?.date_fin || item?.date_debut,
        (day) => pushCalendarEvent(events, day, "👶"),
      );
    state.personalCalendar = { plan, events, loaded: true };
  }

  async function loadPersonalCalendar() {
    const sourceKey = String(state.access?.agent?.source_key || "").trim();
    if (!state.access?.agent_id || !sourceKey) {
      state.personalCalendar.loaded = true;
      return;
    }
    try {
      const data = await post("stip-agent-planning", { source_key: sourceKey });
      setPersonalCalendar(data);
    } catch {
      state.personalCalendar.loaded = true;
    }
    renderDateJumpCalendar(
      state.dateJumpMonth || monthKey(state.dayFocus || todayIso()),
    );
  }

  function renderDateJumpCalendar(key = "") {
    const panel = $("#teamDateJumpPanel");
    if (!panel) return;
    const basis = /^\d{4}-\d{2}$/.test(key)
        ? dateObj(`${key}-01`)
        : dateObj(state.dayFocus || state.weekStart),
      year = basis.getFullYear(),
      month = basis.getMonth(),
      first = new Date(year, month, 1, 12),
      last = new Date(year, month + 1, 0, 12),
      leading = (first.getDay() + 6) % 7,
      today = todayIso(),
      weekEnd = addDays(state.weekStart, 6),
      cells = [];
    for (let i = 0; i < leading; i++)
      cells.push('<span class="team-date-jump-empty" aria-hidden="true"></span>');
    for (let day = 1; day <= last.getDate(); day++) {
      const date = new Date(year, month, day, 12),
        value = iso(date),
        shift = personalShiftForDate(value),
        eventIcons = state.personalCalendar.events.get(value) || [],
        cls = [
          value === today ? "is-today" : "",
          value >= state.weekStart && value <= weekEnd ? "is-week" : "",
          value === state.dayFocus ? "is-selected" : "",
          shift ? "has-shift" : "",
          eventIcons.length ? "has-event" : "",
        ]
          .filter(Boolean)
          .join(" "),
        marker = shift
          ? shift.work
            ? `<span class="team-cal-dot shift-${esc(shift.type)}" aria-hidden="true"></span>`
            : `<span class="team-cal-icon" aria-hidden="true">${esc(shift.icon)}</span>`
          : '<span class="team-cal-marker-empty" aria-hidden="true"></span>',
        aria = [
          dayTitle(value),
          shift?.label || "",
          eventIcons.length
            ? `${eventIcons.length} événement${eventIcons.length > 1 ? "s" : ""}`
            : "",
        ]
          .filter(Boolean)
          .join(", ");
      cells.push(
        `<button type="button" class="${cls}" data-team-cal-day="${value}" aria-label="${esc(aria)}"><b class="team-cal-day-number">${day}</b><span class="team-cal-marker">${marker}</span><small class="team-cal-events">${eventIcons.map(esc).join("")}</small></button>`,
      );
    }
    state.dateJumpMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
    panel.dataset.calendarMonth = state.dateJumpMonth;
    panel.innerHTML =
      `<div class="team-date-jump-head"><button type="button" data-team-cal-step="-1" aria-label="Mois précédent">‹</button><strong>${esc(
        first
          .toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
          .replace(/^./, (char) => char.toUpperCase()),
      )}</strong><button type="button" data-team-cal-step="1" aria-label="Mois suivant">›</button></div>` +
      '<div class="team-date-jump-weekdays"><span>Lu</span><span>Ma</span><span>Me</span><span>Je</span><span>Ve</span><span>Sa</span><span>Di</span></div>' +
      `<div class="team-date-jump-grid">${cells.join("")}</div>`;
  }

  function chooseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return;
    state.weekStart = monday(value);
    state.dayFocus = value;
    state.dateJumpMonth = monthKey(value);
    state.openShift = "";
    window.STIPNav?.remember?.({
      tab: state.tab,
      weekStart: state.weekStart,
      dayFocus: state.dayFocus,
      scrollY: 0,
    });
    showWeek({ preserve: true });
  }

  function allowed(key) {
    return Boolean(state.access?.permissions?.[key]);
  }

  function baseShift(value) {
    const code = String(value || "").trim().toUpperCase().replace(/\*/g, "");
    if (SHIFT[code]) return code;
    if (code === "J0464" || /^J\d+$/.test(code)) return "J";
    if (/^J4\d+$/.test(code)) return "J4";
    if (/^M\d+$/.test(code)) return "M";
    if (/^S\d+$/.test(code)) return "S";
    if (/^N\d+$/.test(code)) return "N";
    return "";
  }

  function adaptedShift(value) {
    const raw = String(value || "").trim().toUpperCase().replace(/\*/g, "");
    const base = baseShift(raw);
    return Boolean(base && raw !== base);
  }

  function displayName(agent) {
    if (window.STIPName?.format) return window.STIPName.format(agent);
    return [agent?.prenom, agent?.nom].filter(Boolean).join(" ") || "Agent";
  }

  function phoneHref(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.startsWith("33") ? `tel:+${digits}` : `tel:${digits}`;
  }

  function cacheEntry(start) {
    if (!state.weeks.has(start))
      state.weeks.set(start, {
        fetchedAt: 0,
        team: null,
        assistant: null,
        activity: null,
        activityPromise: null,
        corePromise: null,
        coreLoaded: false,
      });
    return state.weeks.get(start);
  }

  async function loadCore(start, force = false) {
    const cached = cacheEntry(start);
    if (
      !force &&
      cached.coreLoaded &&
      Date.now() - cached.fetchedAt < CACHE_TTL
    )
      return cached;
    if (cached.corePromise && !force) return cached.corePromise;
    const end = addDays(start, 6);
    cached.corePromise = Promise.allSettled([
      allowed("planning_team")
        ? post("stip-data", {
            action: "spirit_week",
            start_date: start,
            end_date: end,
          })
        : Promise.resolve(null),
      allowed("assistant_enabled")
        ? post("stip-assistant", {
            action: "feed",
            start_date: start,
            end_date: end,
          })
        : Promise.resolve(null),
    ]).then((results) => {
      cached.team = results[0].status === "fulfilled" ? results[0].value : null;
      cached.assistant =
        results[1].status === "fulfilled" ? results[1].value : null;
      cached.fetchedAt = Date.now();
      cached.coreLoaded = true;
      cached.corePromise = null;
      cached.coreError = results.find(
        (result) => result.status === "rejected",
      )?.reason;
      return cached;
    });
    return cached.corePromise;
  }

  async function loadActivity(start, force = false) {
    const cached = cacheEntry(start);
    if (!allowed("activity")) return cached;
    if (!force && cached.activity) return cached;
    if (cached.activityPromise && !force) return cached.activityPromise;
    const days = daysOfWeek(start);
    cached.activityPromise = Promise.allSettled(
      days.map((date) => post("stip-cadre", { action: "dashboard", date })),
    ).then((results) => {
      cached.activity = new Map();
      results.forEach((result, index) => {
        if (result.status === "fulfilled")
          cached.activity.set(days[index], result.value?.day || {});
      });
      cached.activityPromise = null;
      cached.activityError = results.find(
        (result) => result.status === "rejected",
      )?.reason;
      return cached;
    });
    return cached.activityPromise;
  }

  function normalizeDayFocus() {
    const days = daysOfWeek();
    const today = todayIso();
    if (!days.includes(state.dayFocus))
      state.dayFocus = days.includes(today) ? today : days[0];
  }

  function renderHeader() {
    normalizeDayFocus();
    if (!state.dateJumpMonth)
      state.dateJumpMonth = monthKey(state.dayFocus || state.weekStart);
    renderDateJumpCalendar(state.dateJumpMonth);
    $$("[data-team-tab]").forEach((button) => {
      const active = button.dataset.teamTab === state.tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    const today = todayIso();
    $("#teamDays").innerHTML = daysOfWeek()
      .map(
        (day) =>
          `<button type="button" data-team-day="${day}" class="${[
            day === today ? "today" : "",
            day === state.dayFocus ? "selected" : "",
          ].filter(Boolean).join(" ")}" aria-pressed="${day === state.dayFocus}"><small>${shortDay(day)}</small><b>${dateObj(day).getDate()}</b></button>`,
      )
      .join("");
  }

  function dayContainer(day, summary, body, kind) {
    const today = day === todayIso();
    return `<article id="team-day-${day}" class="team-day stip-time-surface ${today ? "is-today" : ""}" data-day-kind="${kind}"><header><div><span>${today ? "AUJOURD’HUI" : shortDay(day)}</span><h2>${esc(dayTitle(day))}</h2></div><strong>${esc(summary)}</strong></header><div class="team-day-body">${body}</div></article>`;
  }

  function agentRow(item) {
    const agent = item.agents || {};
    const phone = phoneHref(agent.telephone);
    const ghe = String(agent.ghe || "").replace(/^GHE\s*/i, "");
    const key = String(agent.source_key || "");
    const isChef =
      String(item.equipe || "").toLowerCase() === "chefs" ||
      String(agent.type_planning || "").toLowerCase() === "chefs" ||
      /chef/i.test(String(agent.role || ""));
    const quotite = Number(agent.quotite);
    const partTime = Number.isInteger(quotite) && quotite >= 1 && quotite < 100;
    return `<div class="team-agent ${isChef ? "is-chef" : ""}">
      <button class="team-agent-main" type="button" data-team-agent="${esc(key)}" ${key ? "" : "disabled"}>
        <span class="team-agent-ghe">GHE ${esc(ghe || "—")}</span>
        <span><strong>${esc(displayName(agent))}${isChef ? '<em class="team-chef-mark">🎨 Chef</em>' : ""}${adaptedShift(item.code) ? '<em class="team-adapted-mark" title="Horaire adapté">⏱</em>' : ""}${partTime ? `<em class="team-part-mark" title="Temps partiel">◐ ${quotite}%</em>` : ""}</strong><small>${esc(isChef ? "Chef d’équipe" : agent.role || "Brancardier")}</small></span>
        <i aria-hidden="true">›</i>
      </button>
      ${phone ? `<a href="${esc(phone)}" aria-label="Appeler ${esc(displayName(agent))}">☎</a>` : ""}
    </div>`;
  }

  function shiftBlock(day, code, items) {
    const base = baseShift(code);
    const meta = SHIFT[base];
    if (!meta || !items.length) return "";
    const key = `${day}|${code}`;
    const open = state.openShift === key;
    return `<section class="team-shift shift-${base.toLowerCase()} ${open ? "open" : ""}">
      <button class="team-shift-head" type="button" data-team-shift="${esc(key)}" aria-expanded="${open}">
        <b>${esc(code)}</b>
        <span><strong>${esc(meta.label)}</strong><small>${esc(meta.time)}</small></span>
        <em>${items.length}</em>
        <i aria-hidden="true">⌄</i>
      </button>
      <div class="team-shift-agents" ${open ? "" : "hidden"}>${items.map(agentRow).join("")}</div>
    </section>`;
  }

  function teamDay(bundle, day) {
    const items = (bundle?.team?.planning || []).filter(
      (item) => item.date === day,
    );
    const groups = new Map();
    items.forEach((item) => {
      const original = String(item.code || "").toUpperCase(),
        base = baseShift(original);
      if (!base) return;
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base).push(item);
    });
    const ordered = [...groups.entries()].sort(
      ([a], [b]) =>
        SHIFT_ORDER.indexOf(baseShift(a)) - SHIFT_ORDER.indexOf(baseShift(b)),
    );
    if (!state.openShift && day === state.dayFocus && ordered[0])
      state.openShift = `${day}|${ordered[0][0]}`;
    const body = ordered.map(([code, rows]) => shiftBlock(day, code, rows)).join("");
    return dayContainer(
      day,
      `${items.length} présent${items.length > 1 ? "s" : ""}`,
      body || '<p class="team-empty-inline">Aucun agent planifié.</p>',
      "team",
    );
  }

  function activityDay(bundle, day) {
    const data = bundle?.activity?.get(day) || {};
    const rows = [
      ...(data.alerts || []),
      ...(data.events?.formations || []),
      ...(data.events?.stagiaires || []),
    ];
    const body = rows.length
      ? `<div class="team-subsections">${rows
          .map(
            (item) =>
              `<section><span>${esc(item.type || item.kind || "Information")}</span><strong>${esc(item.title || item.label || "Information")}</strong>${item.body || item.note || item.description ? `<p>${esc(item.body || item.note || item.description)}</p>` : ""}</section>`,
          )
          .join("")}</div>`
      : '<p class="team-empty-inline">Rien à signaler pour cette journée.</p>';
    return dayContainer(
      day,
      `${rows.length} élément${rows.length > 1 ? "s" : ""}`,
      body,
      "activity",
    );
  }

  function assistantDay(bundle, day) {
    const rows = (bundle?.assistant?.items || []).filter(
      (item) => item.date === day,
    );
    const body = rows.length
      ? `<div class="team-subsections">${rows
          .map((item) => {
            const severity = Number(item.severity || 0);
            return `<section class="severity-${Math.min(4, severity)}"><span>${severity >= 3 ? "À décider" : severity >= 2 ? "À anticiper" : "Information"}</span><strong>${esc(item.title || "Information")}</strong>${item.body || item.recommendation_text ? `<p>${esc(item.body || item.recommendation_text)}</p>` : ""}</section>`;
          })
          .join("")}</div>`
      : '<p class="team-empty-inline">Aucun point prioritaire détecté.</p>';
    return dayContainer(
      day,
      `${rows.length} point${rows.length > 1 ? "s" : ""}`,
      body,
      "assistant",
    );
  }

  function syncShiftPanels() {
    $("#teamContent")
      ?.querySelectorAll("[data-team-shift]")
      .forEach((button) => {
        const active = button.dataset.teamShift === state.openShift;
        button.setAttribute("aria-expanded", String(active));
        const section = button.closest(".team-shift");
        section?.classList.toggle("open", active);
        const agents = section?.querySelector(".team-shift-agents");
        if (agents) agents.hidden = !active;
      });
  }

  function closeAgentSheet() {
    window.STIPAgentAgenda?.close?.();
    document.getElementById("teamAgentOverlay")?.remove();
    document.body.classList.remove("team-sheet-open");
  }

  function formatAgentDate(value) {
    return dateObj(value).toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  async function openAgentSheet(sourceKey) {
    if (!sourceKey) return;
    const planning = cacheEntry(state.weekStart)?.team?.planning || [];
    const fallback =
      planning.find((item) => item.agents?.source_key === sourceKey)?.agents || {};
    if (window.STIPAgentAgenda?.open)
      return window.STIPAgentAgenda.open(sourceKey, fallback);
    $("#teamError").textContent =
      "Le nouvel agenda agent n’est pas encore chargé. Recharge la page.";
  }

  function renderContent(bundle) {
    const host = $("#teamContent");
    normalizeDayFocus();
    const day = state.dayFocus;
    const permitted = {
      team: allowed("planning_team"),
      activity: allowed("activity"),
      assistant: allowed("assistant_enabled"),
    }[state.tab];

    if (!permitted) {
      host.innerHTML =
        '<div class="team-empty">Ce volet n’est pas inclus dans votre accès.</div>';
    } else if (state.tab === "activity" && !bundle.activity) {
      host.innerHTML = dayContainer(
        day,
        "Lecture…",
        '<div class="stip-skeleton team-day-placeholder"></div>',
        "activity",
      );
    } else {
      const renderer = {
        team: teamDay,
        activity: activityDay,
        assistant: assistantDay,
      }[state.tab];
      host.innerHTML = renderer(bundle, day);
    }
    host.setAttribute("aria-busy", "false");
    state.rendered = true;
  }

  function setBusy(message = "Actualisation de la semaine…") {
    $("#teamContent").setAttribute("aria-busy", "true");
    $("#teamContent").classList.add("is-refreshing");
    $("#teamError").textContent = message;
  }

  function clearBusy() {
    $("#teamContent").classList.remove("is-refreshing");
    $("#teamError").textContent = "";
  }

  async function showWeek({ force = false, preserve = state.rendered } = {}) {
    const request = ++state.request;
    renderHeader();
    if (preserve) setBusy();
    try {
      const bundle = await loadCore(state.weekStart, force);
      if (request !== state.request) return;
      if (state.tab === "activity") await loadActivity(state.weekStart, force);
      if (request !== state.request) return;
      renderContent(bundle);
      const issue = bundle.coreError || bundle.activityError;
      clearBusy();
      if (issue)
        $("#teamError").textContent =
          "Certaines données n’ont pas pu être actualisées.";
      if (!force) prefetchAdjacentWeeks();
    } catch (error) {
      clearBusy();
      $("#teamError").textContent = error.message || String(error);
      if (!state.rendered)
        $("#teamContent").innerHTML =
          '<div class="team-empty">Impossible de charger cette semaine.</div>';
    }
  }

  function prefetchAdjacentWeeks() {
    const run = () => {
      loadCore(addDays(state.weekStart, -7)).catch(() => {});
      loadCore(addDays(state.weekStart, 7)).catch(() => {});
    };
    if ("requestIdleCallback" in window)
      requestIdleCallback(run, { timeout: 1800 });
    else setTimeout(run, 500);
  }

  async function selectTab(tab) {
    if (tab === state.tab) return;
    state.tab = tab;
    renderHeader();
    const bundle = cacheEntry(state.weekStart);
    if (tab === "activity" && !bundle.activity) {
      renderContent(bundle);
      setBusy("Chargement de l’activité de la semaine…");
      await loadActivity(state.weekStart);
      clearBusy();
    }
    renderContent(bundle);
    history.replaceState(
      { ...(history.state || {}), stipTeamTab: tab },
      "",
      `${location.pathname}?tab=${encodeURIComponent(tab)}`,
    );
    window.STIPNav?.remember?.({ tab, weekStart: state.weekStart });
  }

  function moveWeek(offset) {
    state.weekStart = addDays(state.weekStart, offset * 7);
    state.dayFocus = state.weekStart;
    window.STIPNav?.remember?.({
      tab: state.tab,
      weekStart: state.weekStart,
      dayFocus: state.dayFocus,
      scrollY: 0,
    });
    showWeek({ preserve: true });
  }

  $$("[data-team-tab]").forEach((button) =>
    button.addEventListener("click", () => selectTab(button.dataset.teamTab)),
  );
  $("#teamDateJumpPanel").addEventListener("click", (event) => {
    const step = event.target.closest("[data-team-cal-step]"),
      day = event.target.closest("[data-team-cal-day]");
    if (step) {
      const nextMonth = shiftMonthKey(
        $("#teamDateJumpPanel").dataset.calendarMonth,
        step.dataset.teamCalStep,
      );
      const now = todayIso();
      const target = now.startsWith(nextMonth)
        ? now
        : firstMondayOfMonth(nextMonth);
      state.dateJumpMonth = nextMonth;
      return chooseDate(target);
    }
    if (day) return chooseDate(day.dataset.teamCalDay);
  });
  $("#teamRefresh").addEventListener("click", () =>
    showWeek({ force: true, preserve: true }),
  );
  $("#teamSubscribe")?.addEventListener("click", () =>
    window.STIPCalendars?.quick?.("team"),
  );
  $("#teamDays").addEventListener("click", (event) => {
    const button = event.target.closest("[data-team-day]");
    if (!button) return;
    const nextDay = button.dataset.teamDay;
    if (!nextDay || nextDay === state.dayFocus) return;

    state.dayFocus = nextDay;
    state.dateJumpMonth = monthKey(nextDay);
    state.openShift = "";

    renderHeader();
    renderContent(cacheEntry(state.weekStart));

    window.STIPNav?.remember?.({
      tab: state.tab,
      weekStart: state.weekStart,
      dayFocus: state.dayFocus,
    });
  });

  $("#teamContent").addEventListener("click", (event) => {
    const shift = event.target.closest("[data-team-shift]");
    if (shift) {
      const key = shift.dataset.teamShift || "";
      state.openShift = state.openShift === key ? "" : key;
      syncShiftPanels();
      return;
    }
    const agent = event.target.closest("[data-team-agent]");
    if (agent) openAgentSheet(agent.dataset.teamAgent);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAgentSheet();
  });

  async function boot() {
    if (!token()) return location.replace("index.html");
    try {
      state.access = await post("stip-access", { action: "me" });
      loadPersonalCalendar().catch(() => {});
      const teamSubscribe=$("#teamSubscribe");
      if(teamSubscribe)teamSubscribe.hidden=!(allowed("planning_team")&&allowed("calendar_subscribe"));
      if (!["planning_team", "activity", "assistant_enabled"].some(allowed))
        return location.replace("index.html");
      const required =
        state.tab === "team"
          ? "planning_team"
          : state.tab === "activity"
            ? "activity"
            : "assistant_enabled";
      if (!allowed(required))
        state.tab = allowed("planning_team")
          ? "team"
          : allowed("activity")
            ? "activity"
            : "assistant";
      renderHeader();
      await showWeek({ preserve: false });
      window.STIPNav?.restoreScroll?.();
    } catch (error) {
      $("#teamError").textContent = error.message || String(error);
      $("#teamContent").innerHTML =
        '<div class="team-empty">Impossible de charger Esprit d’équipe.</div>';
    }
  }

  window.STIPNav?.register?.({
    capture: () => ({
      tab: state.tab,
      weekStart: state.weekStart,
      dayFocus: state.dayFocus,
    }),
  });
  boot();
})();
