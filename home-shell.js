(() => {
  "use strict";
  const DATA_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data",
    ACTION_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions",
    STORE = "stip_session_v1",
    HOME_CACHE_KEY = "stip_home_runtime_cache_v2",
    HOME_CACHE_VERSION = 2,
    HOME_CACHE_FRESH_MS = 45 * 1000,
    HOME_CACHE_MAX_MS = 10 * 60 * 1000,
    $ = (s) => document.querySelector(s);
  const state = {
    boot: null,
    home: { actions: [], notifications: [] },
    session: null,
    ready: false,
    refreshing: null,
    bootStatus: "idle",
    bootError: "",
    planningSlow: false,
    renderSig: "",
    future: new Map(),
    exchanges: new Map(),
    widgets: new Map(),
    externalActions: new Map(),
    actionFilter: "all",
    dismissedNotifications: {},
    weekOffset: 0,
    weekFull: false,
    weekPast: false,
    dayFocus: parisIso(),
    homeMode: "planning",
    dateJumpMonth: "",
    tableauFocus: false,
    communicationTab: "chat",
    communicationFocus: false,
    communicationConversation: "",
    communicationMessage: "",
    lastRefreshAt: 0,
  };
  let planningSlowTimer = 0,
    tableauRuntimePromise = null,
    communicationRuntimePromise = null;
  function planningLoading() {
    return (
      state.bootStatus === "loading" &&
      !(state.boot?.personal || []).length
    );
  }
  function startPlanningLoading() {
    clearTimeout(planningSlowTimer);
    state.planningSlow = false;
    planningSlowTimer = setTimeout(() => {
      if (!planningLoading()) return;
      state.planningSlow = true;
      state.renderSig = "";
      render();
    }, 3000);
  }
  function stopPlanningLoading() {
    clearTimeout(planningSlowTimer);
    planningSlowTimer = 0;
    state.planningSlow = false;
  }

  const ICON = {
    personal:
      '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    tomorrow:
      '<img src="images/icone_app/pour-demain.svg?v=20260920-app1" alt="" aria-hidden="true">',
    team:
      '<img src="images/icone_app/esprit-equipe.webp?v=20260921-team1" alt="" aria-hidden="true">',
    agents:
      '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.4-7 6-7s6 3 6 7"/><circle cx="17.5" cy="14.5" r="3"/><path d="m20 17 2 2"/></svg>',
    change:
      '<svg viewBox="0 0 24 24"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>',
    calendar:
      '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    dates:
      '<img src="images/icone_app/date-des-agents.svg?v=20260918-1" alt="" aria-hidden="true">',
    contacts:
      '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.4-7 6-7s6 3 6 7M16 6.5a2.5 2.5 0 0 1 0 5M17 14c2.5.6 4 2.7 4 5"/></svg>',
    responsable:
      '<img src="images/icone_app/responsable.webp?v=20260922-responsable2" alt="" aria-hidden="true">',
    places:
      '<img src="images/icone_app/visiter-les-lieux.webp?v=20260925-responsable-main1" alt="" aria-hidden="true">',
    newagent:
      '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.4-7 6-7s6 3 6 7M18 8v6M15 11h6"/></svg>',
    upload:
      '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v5h14v-5"/></svg>',
    access:
      '<img src="images/icone_app/access-lock.webp?v=20260920-accesslock1" alt="" aria-hidden="true">',
    admin:
      '<svg viewBox="0 0 24 24"><path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="M9 12h6M12 9v6"/></svg>',
    homeHome:
      '<img src="images/icone_app/home-access-personal.webp?v=20260922-topimages3" alt="" aria-hidden="true">',
    homeApps:
      '<img src="images/icone_app/home-access-applications.webp?v=20260922-topimages3" alt="" aria-hidden="true">',
    homeChat:
      '<img src="images/icone_app/team-chat.svg?v=20260921-teamchat2" alt="" aria-hidden="true">',
    homeChair:
      '<img src="images/icone_app/home-access-wheelchairs.webp?v=20260923-wheelchair-left-badge2" alt="" aria-hidden="true">',
    homeAI:
      '<img src="images/icone_app/home-access-stip-ai.webp?v=20260920-ai-restored2" alt="" aria-hidden="true">',
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
  function applySharedWeekState(next) {
    if (!next) return false;
    state.weekOffset = Number(next.weekOffset) || 0;
    state.weekPast = Boolean(next.weekPast);
    state.weekFull = Boolean(next.weekFull);
    state.dayFocus = /^\d{4}-\d{2}-\d{2}$/.test(String(next.dayFocus || ""))
      ? String(next.dayFocus)
      : "";
    return true;
  }
  function sharedWeekState() {
    return {
      weekOffset: state.weekOffset,
      weekPast: state.weekPast,
      weekFull: state.weekFull,
      dayFocus: state.dayFocus,
    };
  }
  function jumpToDate(iso) {
    iso = String(iso || "").slice(0, 10);
    if (!iso) return;
    const shared = window.STIPWeekEngine?.stateForDate?.(iso, {
      today: parisIso(),
    });
    if (!applySharedWeekState(shared)) {
      const today = dateObj(parisIso()),
        target = dateObj(iso),
        mondayOf = (d) => {
          const x = new Date(d),
            dow = x.getDay() || 7;
          x.setDate(x.getDate() - (dow - 1));
          x.setHours(12, 0, 0, 0);
          return x;
        },
        currentMonday = mondayOf(today),
        targetMonday = mondayOf(target);
      state.weekOffset = Math.round((targetMonday - currentMonday) / 604800000);
      state.weekPast = state.weekOffset === 0 && iso < parisIso();
      state.weekFull = state.weekOffset !== 0;
      state.dayFocus = iso;
    }
    state.renderSig = "";
    render();
  }
  function dateIsoLocal(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function shiftMonthKey(key, step) {
    const [y, m] = String(key || "").split("-").map(Number),
      d = new Date(
        y || new Date().getFullYear(),
        (m || 1) - 1 + Number(step || 0),
        1,
        12,
      );
    return monthKeyOf(d);
  }
  function calendarShiftForDate(iso) {
    const row = (state.boot?.personal || []).find(
        (item) => String(item?.date || "").slice(0, 10) === iso,
      ),
      raw = String(row?.code || row?.source_value || "").trim();
    if (!raw) return null;
    const code = canonicalShift(raw),
      meta = shiftMeta(code),
      workIcon = workShiftIcon(code),
      icon =
        workIcon ||
        shiftStatusIcon(code) ||
        (code === "—" || code === "-" ? "" : "•");
    return {
      code,
      type: meta[0],
      label: meta[1] || code,
      icon,
      work: Boolean(workIcon),
    };
  }

  function calendarEventIcons(iso) {
    const b=state.boot||{},icons=[],
      push=(icon)=>{icon=String(icon||"").trim();if(icon&&!icons.includes(icon))icons.push(icon)},
      inside=(start,end)=>{start=String(start||"").slice(0,10);end=String(end||start||"").slice(0,10);return !!start&&start<=iso&&iso<=end};
    for(const x of b.agenda_items||[]){
      if(String(x.event_date||"").slice(0,10)!==iso)continue;
      push(String(x.icon||"").trim()||(x.source_type==="mobi_lit_medical"?"🩺":x.importance==="urgent"?"⚠️":x.importance==="important"?"❗":"📌"));
    }
    for(const x of b.personal_formations||[])if(inside(x.date_debut,x.date_fin||x.date_debut))push("🎓");
    for(const x of b.personal_stagiaires||[])if(inside(x.date_debut,x.date_fin||x.date_debut))push("👶");
    return icons.slice(0,2);
  }
  function firstMondayOfMonth(key){
    const d=dateObj(`${key}-01`),dow=d.getDay()||7;
    if(dow!==1)d.setDate(d.getDate()+((8-dow)%7));
    return dateIsoLocal(d);
  }

  function renderDateJumpCalendar(panel, key = "") {
    if (!panel) return;
    const basis = key
        ? dateObj(`${key}-01`)
        : navigationWeek()[0]?.d || dateObj(parisIso()),
      y = basis.getFullYear(),
      m = basis.getMonth(),
      first = new Date(y, m, 1, 12),
      last = new Date(y, m + 1, 0, 12),
      leading = (first.getDay() + 6) % 7,
      todayIso = parisIso(),
      selectedIso = state.dayFocus || todayIso,
      loading = planningLoading(),
      cells = [];
    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(y, m, day, 12),
        iso = dateIsoLocal(d),
        weekend = d.getDay() === 0 || d.getDay() === 6,
        shift = calendarShiftForDate(iso),
        cls = [
          iso === todayIso ? "is-today" : "",
          iso === selectedIso ? "is-selected" : "",
          weekend ? "is-weekend" : "",
          shift ? "is-worked" : "",
        ]
          .filter(Boolean)
          .join(" "),
        dayLabel = d.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        aria = shift
          ? `${dayLabel}, ${shift.label}, choisir ce jour`
          : `${dayLabel}, choisir ce jour`,
        gridStart = day === 1 ? ` style="grid-column-start:${leading + 1}"` : "",
        marker = loading
          ? '<span class="hc-date-jump-skeleton" aria-hidden="true"></span>'
          : shift
            ? shift.work
              ? `<span class="hc-date-jump-dot stip-month-dot shift-${esc(shift.type)}" aria-hidden="true"></span>`
              : `<span class="hc-date-jump-icon stip-month-icon" aria-hidden="true">${esc(shift.icon || "•")}</span>`
            : '<span class="hc-date-jump-marker-empty" aria-hidden="true"></span>',
        eventIcons=loading ? [] : calendarEventIcons(iso);
      cells.push(
        `<button type="button" class="stip-month-day ${cls} ${loading ? "is-loading" : ""} ${eventIcons.length?"has-event":""}"${gridStart} data-cal-day="${iso}" data-cal-month="${monthKeyOf(d)}" aria-label="${esc(aria)}"${loading ? ' disabled aria-disabled="true"' : ""}><b class="hc-date-jump-day-number stip-month-day-number">${day}</b><span class="hc-date-jump-marker stip-month-primary">${marker}</span><small class="hc-date-jump-events stip-month-events">${eventIcons.map((icon) => `<i class="stip-month-event" aria-hidden="true">${esc(icon)}</i>`).join("")}</small></button>`,
      );
    }
    const monthKey = monthKeyOf(first);
    state.dateJumpMonth = monthKey;
    panel.dataset.calendarMonth = monthKey;
    panel.classList.toggle("is-loading", loading);
    panel.setAttribute("aria-busy", loading ? "true" : "false");
    panel.innerHTML = `<div class="hc-date-jump-head stip-month-nav"><button type="button" data-cal-step="-1" aria-label="Mois précédent"${loading ? " disabled" : ""}>‹</button><strong>${cap(first.toLocaleDateString("fr-FR", { month: "long" }))} ${y}</strong><button type="button" data-cal-step="1" aria-label="Mois suivant"${loading ? " disabled" : ""}>›</button></div><div class="hc-date-jump-weekdays stip-month-weekdays"><span>Lu</span><span>Ma</span><span>Me</span><span>Je</span><span>Ve</span><span>Sa</span><span>Di</span></div><div class="hc-date-jump-grid stip-month-grid">${cells.join("")}</div>`;
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
  function teamMode() {
    const p = perms();
    if (!p.messages) return "none";
    const raw = String(p.team_chat_mode || "").toLowerCase();
    if (p.admin || raw === "admin") return "admin";
    if (raw === "read") return "read";
    return "write";
  }
  function canTeamWrite() {
    return teamMode() === "write" || teamMode() === "admin";
  }
  function cacheOwner(session = state.session || window.STIPSession || {}) {
    const agent = session?.agent || {};
    return [
      agent.id || agent.source_key || agent.matricule || [agent.prenom, agent.nom].filter(Boolean).join(" "),
      session?.role_key || "",
    ]
      .map((value) => String(value || "").trim())
      .join("::");
  }
  function readHomeCache() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(HOME_CACHE_KEY) || "null");
      if (
        !cached ||
        cached.version !== HOME_CACHE_VERSION ||
        cached.owner !== cacheOwner() ||
        !cached.boot ||
        Date.now() - Number(cached.at || 0) > HOME_CACHE_MAX_MS
      )
        return null;
      return cached;
    } catch {
      return null;
    }
  }
  function writeHomeCache() {
    if (!state.boot || !state.ready) return;
    try {
      sessionStorage.setItem(
        HOME_CACHE_KEY,
        JSON.stringify({
          version: HOME_CACHE_VERSION,
          owner: cacheOwner(),
          at: state.lastRefreshAt || Date.now(),
          boot: state.boot,
          home: state.home || { actions: [], notifications: [] },
        }),
      );
    } catch {}
  }
  function clearHomeCache() {
    try {
      sessionStorage.removeItem(HOME_CACHE_KEY);
    } catch {}
  }
  function hydrateHomeCache() {
    const cached = readHomeCache();
    if (!cached) return null;
    const sessionAgent = state.session?.agent || {},
      cachedBoot = cached.boot || {},
      hydratedBoot = {
        ...cachedBoot,
        agent: { ...(cachedBoot.agent || {}), ...sessionAgent },
        permissions: state.session?.permissions || cachedBoot.permissions || {},
      };
    state.home = cached.home || { actions: [], notifications: [] };
    state.lastRefreshAt = Number(cached.at || 0);
    state.bootStatus = "ready";
    state.bootError = "";
    stopPlanningLoading();
    publishBoot(hydratedBoot);
    return cached;
  }
  function ensureTableauRuntime() {
    if (window.STIPTableau?.mount) return Promise.resolve(window.STIPTableau);
    if (tableauRuntimePromise) return tableauRuntimePromise;
    const loader = window.STIPLoad?.tableau;
    if (typeof loader !== "function")
      return Promise.reject(new Error("Chargeur Fauteuils indisponible."));
    tableauRuntimePromise = Promise.resolve(loader())
      .then(() => {
        if (!window.STIPTableau?.mount)
          throw new Error("Runtime Fauteuils indisponible.");
        return window.STIPTableau;
      })
      .catch((error) => {
        tableauRuntimePromise = null;
        throw error;
      });
    return tableauRuntimePromise;
  }
  function ensureCommunicationRuntime() {
    if (window.STIPCommunicationApp?.mount)
      return Promise.resolve(window.STIPCommunicationApp);
    if (communicationRuntimePromise) return communicationRuntimePromise;
    const loader = window.STIPLoad?.communication;
    if (typeof loader !== "function")
      return Promise.reject(new Error("Chargeur Communication indisponible."));
    communicationRuntimePromise = Promise.resolve(loader())
      .then(() => {
        if (!window.STIPCommunicationApp?.mount)
          throw new Error("Runtime Communication indisponible.");
        return window.STIPCommunicationApp;
      })
      .catch((error) => {
        communicationRuntimePromise = null;
        throw error;
      });
    return communicationRuntimePromise;
  }
  function warmTableauRuntime() {
    if (!has("messages") || window.STIPTableau?.mount) return;
    const run = () =>
      ensureTableauRuntime()
        .then((runtime) => {
          const root = $("#homeView .hs-home");
          if (state.homeMode === "communication") {
      const communicationHost = root.querySelector("#hcCommunicationAppHost");
      const runtime = window.STIPCommunicationApp;
      if (!runtime || typeof runtime.mount !== "function") {
        if (communicationHost)
          communicationHost.innerHTML =
            '<div class="tb-runtime-refresh">Chargement de Communication…</div>';
        ensureCommunicationRuntime()
          .then(() => {
            state.renderSig = "";
            render();
          })
          .catch(() => {
            if (!communicationHost?.isConnected) return;
            communicationHost.innerHTML =
              '<div class="tb-runtime-refresh"><button type="button" data-communication-runtime-retry>Réessayer</button></div>';
            communicationHost
              .querySelector("[data-communication-runtime-retry]")
              ?.addEventListener("click", () => {
                communicationRuntimePromise = null;
                state.renderSig = "";
                render();
              });
          });
        return;
      }
      runtime.mount?.(communicationHost, {
        tab: state.communicationTab,
        focus: state.communicationFocus,
        conversation: state.communicationConversation,
        message: state.communicationMessage,
      });
      state.communicationFocus = false;
      state.communicationConversation = "";
      state.communicationMessage = "";
    } else {
      window.STIPCommunicationApp?.unmount?.();
      window.STIPTableau?.unmountFull?.();
      window.STIPTableau?.unmountPreview?.();
    }
    root.querySelector("[data-dialog-home]")?.addEventListener("click", () =>
      window.STIPCommunication?.openDialog?.(),
    );
    const dateJumpPanel = root.querySelector("[data-date-jump-panel]");
    if (dateJumpPanel)
      renderDateJumpCalendar(
        dateJumpPanel,
        state.dateJumpMonth ||
          dateJumpPanel.dataset.calendarMonth ||
          "",
      );
    dateJumpPanel?.addEventListener("click", (e) => {
      if (planningLoading()) return;
      const step = e.target.closest("[data-cal-step]"),
        day = e.target.closest("[data-cal-day]");
      if (step) {
        state.dateJumpMonth = shiftMonthKey(
          dateJumpPanel.dataset.calendarMonth,
          step.dataset.calStep,
        );
        const todayIso=parisIso(),
          target=todayIso.startsWith(state.dateJumpMonth)?todayIso:firstMondayOfMonth(state.dateJumpMonth);
        return jumpToDate(target);
      }
      if (day) {
        state.dateJumpMonth =
          dateJumpPanel.dataset.calendarMonth ||
          state.dateJumpMonth ||
          String(day.dataset.calDay || "").slice(0, 7);
        return jumpToDate(day.dataset.calDay);
      }
    });
    root
      .querySelector("[data-home-calendar-subscribe]")
      ?.addEventListener("click", async () => {
        try {
          if(!window.STIPCalendars?.quick)
            await window.STIPLoad?.script?.("calendar-subscriptions.js");
          window.STIPCalendars?.quick?.("personal");
        } catch {}
      });
    root
      .querySelectorAll("[data-app]")
      .forEach((b) => (b.onclick = () => openApp(b.dataset.app)));
    root.querySelector("[data-trainee-session-change]")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("stip:trainee-change"));
    });
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
    root
      .querySelector("[data-week-today]")
      ?.addEventListener("click", () => jumpToDate(parisIso()));
    root
      .querySelectorAll("[data-home-day]")
      .forEach((b) =>
        (b.onclick = () => {
          if (planningLoading() || b.disabled) return;
          jumpToDate(b.dataset.homeDay);
        }),
      );
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
    if (k === "team") return (location.href = "esprit-equipe.html?entry=home-app");
    if (k === "communication") return window.STIPRouter?.set?.("communication/chat");
    if (k === "agents") return (location.href = "agent-directory.html");
    if (k === "change") return window.STIPHubs?.planning?.("change");
    if (k === "calendar") return window.STIPHubs?.planning?.("calendar");
    if (k === "compare") return (location.href = "planning-compare-app.html?from=home");
    if (k === "dates") return (location.href = "agent-dates.html");
    if (k === "contacts") return window.STIPHubs?.contacts?.();
    if (k === "responsable")
      return (location.href = "responsable.html?entry=shortcut");
    if (k === "places") return (location.href = "places-app.html?mode=pro");
    if (k === "newagent")
      return (location.href = "https://esapin69.github.io/Ghe-interne/");
    if (k === "upload") return (location.href = "depot.html");
    if (k === "admin") return (location.href = "access-manage.html");
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
    } catch {
      body.innerHTML = '<div class="hs-note"><strong>Demande indisponible</strong><p>STIP n’a pas réussi à charger cette demande.</p><button type="button" class="hc-panel-primary" data-action-retry>Réessayer</button></div>';
      body.querySelector("[data-action-retry]")?.addEventListener("click", () => openAction(id));
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
    if (!force && state.lastRefreshAt && Date.now() - state.lastRefreshAt < 45000)
      return;
    const hasUsableBoot = state.bootStatus === "ready" && !!state.boot;
    if (!hasUsableBoot) {
      state.bootStatus = "loading";
      state.bootError = "";
      startPlanningLoading();
      state.renderSig = "";
      render();
    } else {
      state.bootStatus = "ready";
      stopPlanningLoading();
    }
    state.refreshing = (async () => {
      let changed = false;
      try {
        const traineeSession = String(state.session?.role_key || "") === "stagiaire";
        const [boot, home] = await Promise.allSettled([
          call(DATA_API, "bootstrap"),
          traineeSession ? Promise.resolve({ actions: [], notifications: [] }) : call(ACTION_API, "home"),
        ]);
        if (boot.status === "fulfilled") {
          state.bootStatus = "ready";
          state.bootError = "";
          stopPlanningLoading();
          publishBoot(boot.value);
          prefetchContacts();
          changed = true;
        } else if (!hasUsableBoot) {
          state.bootStatus = "error";
          stopPlanningLoading();
          state.bootError = boot.reason?.message || "Planning indisponible.";
        }
        if (home.status === "fulfilled") {
          state.home = home.value;
          changed = true;
        }
        if (changed) {
          state.lastRefreshAt = Date.now();
          writeHomeCache();
          render();
        }
      } finally {
        state.refreshing = null;
      }
    })();
    return state.refreshing;
  }
  function ready(e) {
    state.ready = true;
    state.session = e?.detail || window.STIPSession || state.session;
    loadDismissedNotifications();
    const routedRoute = window.STIPRouter?.get?.() || "home";
    if (
      routedRoute === "team" &&
      (has("planning_team") || has("activity") || has("assistant_enabled"))
    ) {
      location.replace("esprit-equipe.html?entry=legacy-route");
      return;
    }
    if (
      routedRoute === "responsable" &&
      (has("responsable") || has("admin"))
    ) {
      location.replace("responsable.html?entry=legacy-route");
      return;
    }
    const routedMode = homeModeForRoute(routedRoute);
    if (routedMode) state.homeMode = routedMode;
    try {
      const quick = new URLSearchParams(location.search).get("quick") || "",
        requested = sessionStorage.getItem("stip_home_mode_once");
      if (quick === "notifications" || quick === "exchange") {
        state.homeMode = "notifications";
      } else if (quick === "communication" && has("messages")) {
        state.homeMode = "communication";
        state.communicationTab = String(new URLSearchParams(location.search).get("tab") || "chat") === "fauteuils"
          ? "wheelchair"
          : (String(new URLSearchParams(location.search).get("tab") || "chat") === "dm" ? "dm" : "chat");
        state.communicationConversation = new URLSearchParams(location.search).get("conversation") || "";
        state.communicationMessage = new URLSearchParams(location.search).get("message") || "";
      } else if ((quick === "tableau" || quick === "teamchat") && has("messages")) {
        state.homeMode = "communication";
        state.communicationTab = "wheelchair";
      } else if (requested === "team") {
        sessionStorage.removeItem("stip_home_mode_once");
        location.replace("esprit-equipe.html?entry=resume");
        return;
      } else if (requested === "responsable") {
        sessionStorage.removeItem("stip_home_mode_once");
        location.replace("responsable.html?entry=resume");
        return;
      } else if (requested === "notifications" || requested === "apps" || requested === "planning" || requested === "tableau" || requested === "communication") {
        state.homeMode = requested === "tableau" ? "communication" : requested;
        if (requested === "tableau") state.communicationTab = "wheelchair";
        sessionStorage.removeItem("stip_home_mode_once");
      }
    } catch {}
    if (state.homeMode === "chat") {
      state.homeMode = "communication";
      state.communicationTab = "chat";
    }
    state.renderSig = "";
    const cached = hydrateHomeCache();
    if (cached) {
      render();
      prefetchContacts();
      warmHomeRuntimes();
      if (Date.now() - Number(cached.at || 0) > HOME_CACHE_FRESH_MS)
        setTimeout(() => refresh().catch(() => {}), 180);
      return;
    }
    state.bootStatus = "loading";
    state.bootError = "";
    startPlanningLoading();
    const a = state.session?.agent || {};
    publishBoot({
      agent: a,
      permissions: state.session?.permissions || {},
      team: a.type_planning || a.equipe || "",
      personal: [],
      media: { avatars: {}, shifts: {} },
    });
    render();
    refresh()
      .then(() => warmHomeRuntimes())
      .catch(() => {});
  }
  function ended() {
    state.ready = false;
    state.session = null;
    state.boot = null;
    state.bootStatus = "idle";
    state.bootError = "";
    stopPlanningLoading();
    state.home = { actions: [], notifications: [] };
    state.externalActions.clear();
    state.dismissedNotifications = {};
    state.actionFilter = "all";
    state.weekOffset = 0;
    state.weekFull = false;
    state.weekPast = false;
    state.renderSig = "";
    state.lastRefreshAt = 0;
    tableauRuntimePromise = null;
    communicationRuntimePromise = null;
    state.communicationTab = "chat";
    state.communicationFocus = false;
    state.communicationConversation = "";
    state.communicationMessage = "";
    clearHomeCache();
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
      av = a.profile_photo_url || media?.avatars?.[a.source_key] || a.avatar_signed_url || a.avatar_url || "";
    const ini = ((a.prenom?.[0] || "") + (a.nom?.[0] || "")).toUpperCase() || "ST";
    return `<section class="hc-profile"><div class="hc-avatar" data-avatar-fallback="${esc(ini)}">${av ? `<img src="${esc(av)}" alt="" loading="lazy">` : `<span>${esc(ini)}</span>`}</div><div class="hc-profile-copy"><small>${esc(label)}</small><strong>${esc(agentName(a))}</strong></div></section>`;
  };
  document.addEventListener("error", (event) => { const img = event.target; if (!(img instanceof HTMLImageElement)) return; const host = img.closest?.(".hc-avatar"); if (!host) return; host.textContent = host.dataset.avatarFallback || "ST"; }, true);
  window.addEventListener("stip:tableau-open", (event) => {
    if (!has("messages")) return;
    state.communicationTab = "wheelchair";
    state.communicationFocus = !!event?.detail?.focus;
    if (window.STIPRouter?.set) {
      window.STIPRouter.set("communication/fauteuils");
      return;
    }
    state.homeMode = "communication";
    state.renderSig = "";
    render();
  });
  window.addEventListener("stip:tableau-close", () => {
    state.tableauFocus = false;
    if (window.STIPRouter?.back) {
      window.STIPRouter.back("home");
      return;
    }
    state.homeMode = "planning";
    state.renderSig = "";
    render();
  });
  window.addEventListener("stip:route", (event) => {
    const route = String(event?.detail?.route || "home");
    if (route === "team") {
      if (!(has("planning_team") || has("activity") || has("assistant_enabled"))) {
        window.STIPRouter?.set?.("home", { replace: true });
        return;
      }
      location.href = "esprit-equipe.html?entry=route";
      return;
    }
    if (route === "responsable") {
      if (!(has("responsable") || has("admin"))) {
        window.STIPRouter?.set?.("home", { replace: true });
        return;
      }
      location.href = "responsable.html?entry=route";
      return;
    }
    const next = homeModeForRoute(route);
    if (!next) return;
    if (next === "communication" && !has("messages")) {
      window.STIPRouter?.set?.("home", { replace: true });
      return;
    }
    state.tableauFocus = false;
    if (next === "communication") {
      state.communicationTab = communicationTabForRoute(route);
      if (state.homeMode === next) {
        window.STIPCommunicationApp?.setTab?.(state.communicationTab, {
          focus: state.communicationFocus,
          conversation: state.communicationConversation,
          message: state.communicationMessage,
        });
        state.communicationFocus = false;
        state.communicationConversation = "";
        state.communicationMessage = "";
        return;
      }
    }
    if (state.homeMode === next) return;
    state.homeMode = next;
    state.renderSig = "";
    render();
  });
  window.addEventListener("stip:home-root", () => {
    const currentRoute = window.STIPRouter?.get?.() || "home";
    if (currentRoute === "fauteuils" || currentRoute.startsWith("communication/") || currentRoute === "communication") {
      window.STIPRouter?.set?.("home", { replace: true, keepScroll: true });
      return;
    }
    state.homeMode = "planning";
    state.tableauFocus = false;
    state.renderSig = "";
    render();
  });
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
  }, 300000);
  if (window.STIPSession) ready({ detail: window.STIPSession });
})();