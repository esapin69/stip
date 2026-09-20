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

  function allowed(key) {
    return Boolean(state.access?.permissions?.[key]);
  }

  function baseShift(value) {
    const code = String(value || "").toUpperCase();
    if (SHIFT[code]) return code;
    if (code.endsWith("*") && SHIFT[code.slice(0, -1)])
      return code.slice(0, -1);
    return "";
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
    const context = monthContext();
    $("#teamMonthLabel").textContent = context.month;
    $("#teamYearLabel").textContent = context.year;
    $("#teamDateLabel").textContent = weekRange();
    $("#teamWeekLabel").textContent = `Semaine ${isoWeek(state.weekStart)}`;
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
    return `<div class="team-agent"><span class="team-agent-ghe">GHE ${esc(ghe || "—")}</span><span><strong>${esc(displayName(agent))}</strong><small>${esc(agent.role || "Brancardier")}</small></span>${phone ? `<a href="${esc(phone)}" aria-label="Appeler ${esc(displayName(agent))}">☎</a>` : ""}</div>`;
  }

  function shiftBlock(code, items) {
    const base = baseShift(code);
    const meta = SHIFT[base];
    if (!meta || !items.length) return "";
    return `<section class="team-shift shift-${base.toLowerCase()}"><header><b>${esc(code)}</b><span><strong>${esc(meta.label)}</strong><small>${esc(meta.time)}</small></span><em>${items.length}</em></header><div>${items.map(agentRow).join("")}</div></section>`;
  }

  function teamDay(bundle, day) {
    const items = (bundle?.team?.planning || []).filter(
      (item) => item.date === day,
    );
    const groups = new Map();
    items.forEach((item) => {
      const original = String(item.code || "").toUpperCase();
      if (!baseShift(original)) return;
      if (!groups.has(original)) groups.set(original, []);
      groups.get(original).push(item);
    });
    const ordered = [...groups.entries()].sort(
      ([a], [b]) =>
        SHIFT_ORDER.indexOf(baseShift(a)) - SHIFT_ORDER.indexOf(baseShift(b)),
    );
    const body = ordered.map(([code, rows]) => shiftBlock(code, rows)).join("");
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

  function renderContent(bundle) {
    const host = $("#teamContent");
    const permitted = {
      team: allowed("planning_team"),
      activity: allowed("activity"),
      assistant: allowed("assistant_enabled"),
    }[state.tab];
    if (!permitted) {
      host.innerHTML =
        '<div class="team-empty">Ce volet n’est pas inclus dans votre accès.</div>';
    } else if (state.tab === "activity" && !bundle.activity) {
      host.innerHTML = daysOfWeek()
        .map((day) =>
          dayContainer(
            day,
            "Lecture…",
            '<div class="stip-skeleton team-day-placeholder"></div>',
            "activity",
          ),
        )
        .join("");
    } else {
      const renderer = {
        team: teamDay,
        activity: activityDay,
        assistant: assistantDay,
      }[state.tab];
      host.innerHTML = daysOfWeek()
        .map((day) => renderer(bundle, day))
        .join("");
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
    scrollTo({ top: 0, behavior: "smooth" });
  }

  $$("[data-team-tab]").forEach((button) =>
    button.addEventListener("click", () => selectTab(button.dataset.teamTab)),
  );
  $("#teamPrev").addEventListener("click", () => moveWeek(-1));
  $("#teamNext").addEventListener("click", () => moveWeek(1));
  $("#teamToday").addEventListener("click", () => {
    state.weekStart = monday(todayIso());
    state.dayFocus = todayIso();
    window.STIPNav?.remember?.({
      tab: state.tab,
      weekStart: state.weekStart,
      dayFocus: state.dayFocus,
    });
    showWeek({ preserve: true });
  });
  $("#teamRefresh").addEventListener("click", () =>
    showWeek({ force: true, preserve: true }),
  );
  $("#teamDays").addEventListener("click", (event) => {
    const button = event.target.closest("[data-team-day]");
    if (!button) return;
    state.dayFocus = button.dataset.teamDay;
    $("#teamDays")
      .querySelectorAll("[data-team-day]")
      .forEach((item) => {
        const selected = item.dataset.teamDay === state.dayFocus;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
    window.STIPNav?.remember?.({
      tab: state.tab,
      weekStart: state.weekStart,
      dayFocus: state.dayFocus,
    });
    document
      .getElementById(`team-day-${state.dayFocus}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  async function boot() {
    if (!token()) return location.replace("index.html");
    try {
      state.access = await post("stip-access", { action: "me" });
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
