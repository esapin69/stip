(() => {
  "use strict";
  const DATA_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data",
    ACTION_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions",
    AGENT_READ_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-readonly",
    STORE = "stip_session_v1",
    HOME_CACHE_KEY = "stip_home_runtime_cache_v2",
    SHIFT_CACHE_KEY = "stip_home_shift_snapshot_v1",
    HOME_CACHE_VERSION = 3,
    HOME_CACHE_FRESH_MS = 45 * 1000,
    HOME_CACHE_MAX_MS = Number.POSITIVE_INFINITY,
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
    monthDayFocus: "",
    homeMode: "planning",
    dateJumpMonth: parisIso().slice(0, 7),
    tableauFocus: false,
    communicationTab: "chat",
    communicationFocus: false,
    communicationConversation: "",
    communicationMessage: "",
    lastRefreshAt: 0,
    focusedAlertKey: "",
  };
  let planningSlowTimer = 0,
    tableauRuntimePromise = null,
    communicationRuntimePromise = null,
    headerDirectoryPromise = null,
    headerDirectoryCache = null;
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
    meeting_notes:
      '<svg viewBox="0 0 24 24"><path d="M6 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
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
  function iconHtml(key, fallback = "", label = "", className = "") {
    return window.STIPIcons?.markup?.(key, fallback, { label, className }) || esc(fallback || "•");
  }
  function eventIconKey(x = {}) {
    const direct = String(x.iconKey || x.icon_key || "").trim();
    if (direct) return direct;
    const type = eventType(x);
    if (type === "Visite médicale") return "medical";
    if (type === "Stagiaire") return "trainee";
    if (type === "Formation") return "training";
    if (String(x.importance || "").toLowerCase() === "urgent") return "alert";
    if (String(x.importance || "").toLowerCase() === "important") return "priority";
    if (type === "Réunion") return "meeting";
    return "event";
  }
  function eventIconHtml(x = {}, className = "") {
    const fallback = String(x.icon || "").trim() ||
      (eventIconKey(x) === "medical" ? "🩺" :
       eventIconKey(x) === "trainee" ? "👶" :
       eventIconKey(x) === "training" ? "🎓" :
       eventIconKey(x) === "alert" ? "⚠️" :
       eventIconKey(x) === "priority" ? "❗" : "📌");
    return iconHtml(eventIconKey(x), fallback, x.title || eventType(x) || "Événement", className);
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
  function resetWeekToCurrent(options = {}) {
    const today = parisIso(),
      shared =
        window.STIPWeekEngine?.currentState?.({ today }) ||
        window.STIPWeekEngine?.stateForDate?.(today, { today });
    if (!applySharedWeekState(shared)) {
      state.weekOffset = 0;
      state.weekPast = false;
      state.weekFull = false;
      state.dayFocus = today;
    }
    if (options.render) renderWeekContext();
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
    renderWeekContext();
  }
  function selectWeekDay(iso) {
    const selected = String(iso || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selected)) return;
    const currentWeek = navigationWeek().some((day) => day.iso === selected) ||
      selectedWeek().some((day) => day.iso === selected);
    if (!currentWeek) return jumpToDate(selected);
    state.dayFocus = selected;
    document.querySelectorAll(".hc-week-context-master [data-home-day]").forEach((button) => {
      const active = button.dataset.homeDay === selected;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
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
      def = shiftDefinition(code),
      workIcon = workShiftIcon(code),
      icon =
        workIcon ||
        shiftStatusIcon(code) ||
        (code === "—" || code === "-" ? "" : "•");
    return {
      code,
      raw,
      type: meta[0],
      label: meta[1] || code,
      icon,
      iconKey: String(def?.icon_key || ""),
      work: Boolean(def?.is_working),
    };
  }

  function calendarEventIcons(iso) {
    const b=state.boot||{},icons=[],
      push=(item)=>{
        const key=String(item?.iconKey||item?.icon_key||"").trim(),
          icon=String(item?.icon||"").trim(),
          id=key||icon;
        if(id&&!icons.some((x)=>(x.iconKey||x.icon)===id))icons.push({iconKey:key,icon,label:String(item?.label||item?.title||"Événement")});
      },
      inside=(start,end)=>{start=String(start||"").slice(0,10);end=String(end||start||"").slice(0,10);return !!start&&start<=iso&&iso<=end};
    for(const x of b.agenda_items||[]){
      if(String(x.event_date||"").slice(0,10)!==iso)continue;
      push({
        iconKey:String(x.icon_key||"").trim()||(x.source_type==="mobi_lit_medical"?"medical":x.importance==="urgent"?"alert":x.importance==="important"?"priority":"event"),
        icon:String(x.icon||"").trim()||(x.source_type==="mobi_lit_medical"?"🩺":x.importance==="urgent"?"⚠️":x.importance==="important"?"❗":"📌"),
        label:x.title||eventType(x)
      });
    }
    for(const x of b.personal_formations||[])if(inside(x.date_debut,x.date_fin||x.date_debut))push({iconKey:"training",icon:"🎓",label:x.intitule||"Formation"});
    for(const x of b.personal_stagiaires||[])if(inside(x.date_debut,x.date_fin||x.date_debut))push({iconKey:"trainee",icon:"👶",label:"Stagiaire"});
    return icons.slice(0,2);
  }
  function renderDateJumpCalendar(panel, key = "", selectedIso = state.monthDayFocus) {
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
          shift?.work ? "is-worked" : "",
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
              ? (window.STIPMonthTable?.shiftBadgeHtml?.(shift.raw || shift.code) ||
                `<span class="stip-month-shift-badge" aria-label="${esc(shift.label)}">${esc(shift.code)}</span>`)
              : `<span class="hc-date-jump-icon stip-month-icon" aria-hidden="true">${esc(shift.icon || "•")}</span>`
            : '<span class="hc-date-jump-marker-empty" aria-hidden="true"></span>',
        eventIcons=loading ? [] : calendarEventIcons(iso);
      cells.push(
        `<button type="button" class="stip-month-day ${cls} ${loading ? "is-loading" : ""} ${eventIcons.length?"has-event":""}"${gridStart} data-cal-day="${iso}" data-cal-month="${monthKeyOf(d)}" aria-pressed="${iso === selectedIso}" aria-label="${esc(aria)}"${loading ? ' disabled aria-disabled="true"' : ""}><b class="hc-date-jump-day-number stip-month-day-number">${day}</b><span class="hc-date-jump-marker stip-month-primary">${marker}</span><small class="hc-date-jump-events stip-month-events">${eventIcons.map((item) => `<i class="stip-month-event" aria-hidden="true">${esc(item.icon || "•")}</i>`).join("")}</small></button>`,
      );
    }
    const monthKey = monthKeyOf(first);
    panel.dataset.calendarMonth = monthKey;
    panel.classList.toggle("is-loading", loading);
    panel.setAttribute("aria-busy", loading ? "true" : "false");
    panel.innerHTML = `<div class="hc-date-jump-head stip-month-nav"><button type="button" data-cal-step="-1" aria-label="Mois précédent"${loading ? " disabled" : ""}>‹</button><strong>${cap(first.toLocaleDateString("fr-FR", { month: "long" }))} ${y}</strong><button type="button" data-cal-step="1" aria-label="Mois suivant"${loading ? " disabled" : ""}>›</button></div><div class="hc-date-jump-weekdays stip-month-weekdays"><span>Lu</span><span>Ma</span><span>Me</span><span>Je</span><span>Ve</span><span>Sa</span><span>Di</span></div><div class="hc-date-jump-grid stip-month-grid">${cells.join("")}</div>`;
  }
  // Selection affects only the month calendar DOM, never the weekly planning.
  function markMonthSelection(panel) {
    panel?.querySelectorAll("[data-cal-day]").forEach((button) => {
      const selected = button.dataset.calDay === state.monthDayFocus;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  function moveCalendarMonth(step) {
    state.dateJumpMonth = shiftMonthKey(
      state.dateJumpMonth || parisIso().slice(0, 7),
      step,
    );
    renderMonthContext();
  }
  function selectMonthDay(iso) {
    const selected = String(iso || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selected)) return;
    state.monthDayFocus = selected;
    state.dateJumpMonth = selected.slice(0, 7);
    const panel = document.querySelector(".hc-month-context-master [data-date-jump-panel]");
    if (!panel || panel.dataset.calendarMonth !== state.dateJumpMonth)
      return renderMonthContext();
    markMonthSelection(panel);
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
  async function headerDirectory(force = false) {
    if (!force && headerDirectoryCache) return headerDirectoryCache;
    if (headerDirectoryPromise) return headerDirectoryPromise;
    headerDirectoryPromise = call(AGENT_READ_API, "directory")
      .then((data) => {
        headerDirectoryCache = data || { items: [] };
        return headerDirectoryCache;
      })
      .finally(() => {
        headerDirectoryPromise = null;
      });
    return headerDirectoryPromise;
  }
  function headerDirectoryAgentKey(agent = {}) {
    return String(agent.source_key || agent.id || agent.matricule || "").trim();
  }
  function openHeaderDirectoryAgent(agent = {}) {
    const key = headerDirectoryAgentKey(agent);
    if (!key) return;
    location.href =
      "agent-directory.html?agent=" +
      encodeURIComponent(key) +
      "&from=home-header";
  }
  function headerToast(message = "") {
    let toast = document.querySelector(".hc-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "hc-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = String(message || "Action indisponible");
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("show"), 1800);
  }
  async function openHeaderDirectorySearch(filter = "first") {
    try {
      const directory = await headerDirectory(),
        items = Array.isArray(directory?.items) ? directory.items : [],
        openPicker = window.STIPAgentSelector?.openPicker;
      if (!openPicker) {
        location.href = "agent-directory.html?from=home-header";
        return;
      }
      openPicker({
        title:
          filter === "ghe"
            ? "Rechercher un n° GHE"
            : "Rechercher un nom ou prénom",
        items,
        date: directory?.date,
        privacy: "team",
        showPhone: true,
        filter: filter === "ghe" ? "ghe" : "first",
        autoFocus: true,
        emptyText:
          filter === "ghe"
            ? "Aucun GHE correspondant."
            : "Aucun agent correspondant.",
        onSelect: openHeaderDirectoryAgent,
      });
    } catch (error) {
      console.error("Header directory search", error);
      headerToast("Recherche indisponible pour le moment");
    }
  }
  function openHeaderDateSearch() {
    document.getElementById("hcHeaderDateDialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "hcHeaderDateDialog";
    dialog.className = "hc-header-date-dialog";
    dialog.innerHTML = `<section class="hc-header-date-card"><header><div><small>RECHERCHE</small><h2>Aller à une date</h2><p>Planning, événements et détails disponibles pour le jour choisi.</p></div><button type="button" data-header-date-close aria-label="Fermer">×</button></header><div class="hc-header-date-calendar" data-header-date-calendar></div></section>`;
    document.body.appendChild(dialog);
    const calendar = dialog.querySelector("[data-header-date-calendar]");
    let month = String(state.dayFocus || parisIso()).slice(0, 7);
    const paint = () => renderDateJumpCalendar(calendar, month, state.dayFocus || parisIso());
    const close = () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else dialog.remove();
    };
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.querySelector("[data-header-date-close]")?.addEventListener("click", close);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        close();
        return;
      }
      const step = event.target.closest?.("[data-cal-step]"),
        day = event.target.closest?.("[data-cal-day]");
      if (step) {
        month = shiftMonthKey(
          calendar?.dataset.calendarMonth || month,
          step.dataset.calStep,
        );
        paint();
        return;
      }
      if (!day) return;
      const iso = String(day.dataset.calDay || "").slice(0, 10);
      if (!iso) return;
      close();
      jumpToDate(iso);
      setTimeout(() => {
        document
          .querySelector(".hc-week-context-master")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    });
    paint();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  function perms() {
    // Le cache du tableau de bord ne doit jamais remplacer les droits
    // de la session active, notamment pour l’accès à Communication.
    return {
      ...(state.boot?.permissions || {}),
      ...(window.STIPBootCache?.permissions || {}),
      ...(state.session?.permissions || {}),
      ...(window.STIPSession?.permissions || {}),
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
  function homeSnapshotKey() {
    const active = token();
    // Never reuse one agent's data after a different code/session logs in.
    return active ? HOME_CACHE_KEY + ":" + active.slice(-16) : "";
  }
  // Compact projection of the canonical bootstrap planning, not another data source.
  // Unlike the full home snapshot it stays well within mobile storage limits.
  function shiftSnapshotKey() {
    const active = token();
    return active ? SHIFT_CACHE_KEY + ":" + active.slice(-16) : "";
  }
  function saveShiftSnapshot(boot) {
    const key = shiftSnapshotKey();
    if (!key || !state.ready || window.STIPPreview?.active ||
        !Array.isArray(boot?.personal)) return false;
    const fields = [
      "date", "code", "source_value", "horaire", "horaires", "shift_time",
      "start_time", "end_time", "role_metier", "role", "equipe", "team",
      "type_planning", "schedule_mode", "source_label", "schedule_label",
      "note", "notes", "commentaire", "comment", "description", "is_working"
    ];
    const personal = boot.personal.map((row) => {
      if (!row || typeof row !== "object") return null;
      const compact = {};
      for (const field of fields)
        if (row[field] != null) compact[field] = row[field];
      return compact;
    }).filter(Boolean);
    const saved = {
      version: 1, owner: cacheOwner(), token: token().slice(-16),
      at: Date.now(), personal,
      shift_definitions: Array.isArray(boot.shift_definitions)
        ? boot.shift_definitions : []
    };
    const encoded = JSON.stringify(saved);
    try { localStorage.setItem(key, encoded); return true; } catch {}
    try { sessionStorage.setItem(key, encoded); return true; } catch {}
    return false;
  }
  function readShiftSnapshot() {
    const key = shiftSnapshotKey();
    if (!key || window.STIPPreview?.active) return null;
    for (const store of [localStorage, sessionStorage]) {
      try {
        const saved = JSON.parse(store.getItem(key) || "null");
        if (!saved || saved.version !== 1 || saved.owner !== cacheOwner() ||
            saved.token !== token().slice(-16) ||
            !Array.isArray(saved.personal) ||
            !Number.isFinite(Number(saved.at)) ||
            Number(saved.at) > Date.now() + 60000) continue;
        return {
          agent: state.session?.agent || {},
          permissions: state.session?.permissions || {},
          personal: saved.personal,
          shift_definitions: saved.shift_definitions || [],
          media: { shifts: {} }
        };
      } catch {}
    }
    return null;
  }
  function clearShiftSnapshot() {
    for (const store of [localStorage, sessionStorage]) {
      try {
        for (let i = store.length - 1; i >= 0; i--) {
          const key = store.key(i) || "";
          if (key === SHIFT_CACHE_KEY || key.startsWith(SHIFT_CACHE_KEY + ":"))
            store.removeItem(key);
        }
      } catch {}
    }
  }
  function readHomeCache() {
    const key = homeSnapshotKey();
    if (!key || window.STIPPreview?.active) return null;
    try {
      const cached = JSON.parse(
        sessionStorage.getItem(key) || localStorage.getItem(key) || "null"
      );
      if (!cached || cached.version !== HOME_CACHE_VERSION ||
          cached.owner !== cacheOwner() || cached.session !== key ||
          !cached.boot || !Number.isFinite(Number(cached.at)) ||
          Number(cached.at) > Date.now() + 60000 ||
          Date.now() - Number(cached.at) > HOME_CACHE_MAX_MS)
        return null;
      return cached;
    } catch {
      return null;
    }
  }
  function writeHomeCache() {
    const key = homeSnapshotKey();
    if (!key || !state.boot || !state.ready || window.STIPPreview?.active) return;
    const snapshot = JSON.stringify({
      version: HOME_CACHE_VERSION,
      session: key,
      owner: cacheOwner(),
      at: state.lastRefreshAt || Date.now(),
      boot: state.boot,
      home: state.home || { actions: [], notifications: [] },
    });
    try { sessionStorage.setItem(key, snapshot); } catch {}
    try { localStorage.setItem(key, snapshot); } catch {}
  }
  function clearHomeCache() {
    try {
      for (const store of [sessionStorage, localStorage]) {
        for (let i = store.length - 1; i >= 0; i--) {
          const key = store.key(i) || "";
          if (key === HOME_CACHE_KEY || key.startsWith(HOME_CACHE_KEY + ":"))
            store.removeItem(key);
        }
      }
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
    saveShiftSnapshot(hydratedBoot);
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
          if (state.homeMode === "tableau") {
            state.renderSig = "";
            render();
            return;
          }
          runtime?.bindHomeButton?.(
            root?.querySelector('[data-home-mode="tableau"]'),
          );
        })
        .catch(() => {});
    if ("requestIdleCallback" in window)
      requestIdleCallback(run, { timeout: 3500 });
    else setTimeout(run, 1400);
  }
  function warmHomeExtras() {
    const run = () => window.STIPLoad?.homeExtras?.().catch(() => {});
    if (state.homeMode === "notifications") {
      run();
      return;
    }
    if ("requestIdleCallback" in window)
      requestIdleCallback(run, { timeout: 2600 });
    else setTimeout(run, 1200);
  }
  function warmHomeRuntimes() {
    warmTableauRuntime();
    warmHomeExtras();
  }
  function publishBoot(d) {
    state.boot = d;
    window.STIPBootCache = d;
    if (d?.icon_catalog) window.STIPIcons?.setCatalog?.(d.icon_catalog);
    window.dispatchEvent(new CustomEvent("stip:boot-updated", { detail: d }));
  }
  function pending() {
    return (state.home.actions || []).filter(
      (a) => a.status === "pending" && !a.completed_at && !a.cancelled_at,
    );
  }
  function actionOwnerKey() {
    const a = state.session?.agent || state.boot?.agent || window.STIPSession?.agent || {};
    return String(a.id || a.source_key || "local");
  }
  function notificationDismissedKey() {
    return "stip_notification_dismissed_v1:" + actionOwnerKey();
  }
  function loadDismissedNotifications() {
    try {
      const raw = JSON.parse(
        localStorage.getItem(notificationDismissedKey()) || "{}",
      );
      state.dismissedNotifications =
        raw && typeof raw === "object" ? raw : {};
      // Purge the obsolete tabs/moves preference store instead of loading it.
      localStorage.removeItem("stip_action_center_prefs_v1:" + actionOwnerKey());
    } catch {
      state.dismissedNotifications = {};
    }
  }
  function saveDismissedNotifications() {
    try {
      localStorage.setItem(
        notificationDismissedKey(),
        JSON.stringify(state.dismissedNotifications),
      );
    } catch {}
  }
  function actionNoteKey(n = {}) {
    return String(
      n.id ||
        n.action_id ||
        [n.source || "stip", n.title || "", n.body || ""].join(":"),
    );
  }
  function refreshActionCenterUi() {
    state.renderSig = "";
    render();
    if (
      $("#hsPanel")?.classList.contains("open") &&
      $("#hsPanelTitle")?.textContent === "À traiter"
    )
      renderActionCenter(state.actionFilter);
  }
  function dismissActionNote(n) {
    state.dismissedNotifications[actionNoteKey(n)] = Date.now();
    saveDismissedNotifications();
    if (n?.source === "stip" && n?.id && !n?.action_id)
      call(ACTION_API, "dismiss_notification", { notification_id: n.id }).catch(() => {});
    resetWeekToCurrent();
    refreshActionCenterUi();
  }
  function noteCategory(n = {}) {
    if (n.category) return n.category;
    if (n.type === "agenda_alert" || n.source_type === "agenda_alert") return "agenda";
    const s = `${n.title || ""} ${n.body || ""}`.toLowerCase();
    if (/accès|acces|profil|session/.test(s)) return "access";
    if (/signature|signer/.test(s)) return "signatures";
    if (/rappel|échéance|echeance/.test(s)) return "reminders";
    if (/planning|date|agenda|échange|echange/.test(s)) return "agenda";
    return "other";
  }
  function notifications() {
    const pendingActions = pending(),
      byId = new Map(pendingActions.map((a) => [String(a.id), a])),
      native = (state.home.notifications || [])
        .filter((n) => !n.action_id || byId.has(String(n.action_id)))
        .map((n) => {
          const action = n.action_id ? byId.get(String(n.action_id)) : null,
            merged = {
              ...(action || {}),
              ...n,
              metadata: {
                ...(action?.metadata || {}),
                ...(n.metadata || {}),
              },
              created_at:
                n.created_at ||
                n.occurred_at ||
                action?.created_at ||
                action?.occurred_at ||
                "",
              updated_at: n.updated_at || action?.updated_at || "",
              status: n.status || action?.status || "pending",
              source: "stip",
            };
          merged.category = noteCategory(merged);
          return merged;
        }),
      external = [...state.externalActions.values()].flat(),
      leisure = window.STIPLeisure?.notificationItems?.() || [];
    const knownLeisure=new Set(window.STIPLeisure?.knownEventIds?.()||[]);
    return [...native, ...external, ...leisure].filter((n)=>{
      // L'invitation système est remplacée par l'état courant de la proposition.
      // Pas de doublon ni de vieille invitation après confirmation ou refus.
      const isOldInvite=String(n.type||"").toLowerCase()==="leisure_invite"&&
        String(n.source_type||"")==="stip_leisure_events"&&
        knownLeisure.has(String(n.source_ref||n.metadata?.event_id||""));
      return !isOldInvite&&!state.dismissedNotifications[actionNoteKey(n)];
    });
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
  function shiftDefinition(code) {
    const registry = window.STIPShiftRegistry;
    if (registry?.resolve) return registry.resolve(code);
    const key = String(code || "").trim().toUpperCase().replace(/\*+$/, "");
    return (state.boot?.shift_definitions || []).find(
      (x) => String(x?.code || "").trim().toUpperCase() === key,
    ) || null;
  }
  function shiftType(code) {
    if (code === "—" || code === "-") return "none";
    const def = shiftDefinition(code);
    if (!def) return "other";
    if (def.kind === "work") {
      return ({ m: "morning", j: "day", j4: "late", s: "evening", n: "night" })[
        String(def.family || "").toLowerCase()
      ] || "other";
    }
    return ["rest", "leave", "training", "medical", "absence", "union"].includes(
      String(def.kind || ""),
    )
      ? String(def.kind)
      : "other";
  }
  function shiftMeta(code) {
    const def = shiftDefinition(code);
    return [
      shiftType(code),
      def?.label || (code === "—" ? "Aucun poste" : code),
    ];
  }
  function shiftStatusIcon(code) {
    const def = shiftDefinition(code);
    return def && !def.is_working ? String(def.icon || "") : "";
  }
  function workShiftIcon(code) {
    const def = shiftDefinition(code);
    return def?.is_working ? String(def.icon || "") : "";
  }
  function shiftIconHtml(code, className = "") {
    const def = shiftDefinition(code);
    if (!def) return "";
    return esc(def.icon || "");
  }
  function canonicalShift(raw) {
    if (window.STIPShiftRegistry?.baseCode)
      return window.STIPShiftRegistry.baseCode(raw);
    const src = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/\*+$/, "");
    if (!src) return "—";
    if (/^J4\d+$/.test(src)) return "J4";
    if (/^M\d+$/.test(src)) return "M";
    if (/^J\d+$/.test(src)) return "J";
    if (/^S\d+$/.test(src)) return "S";
    if (/^N\d+$/.test(src)) return "N";
    return src;
  }
  function shiftBadge(raw) {
    const code = canonicalShift(raw),
      meta = shiftMeta(code),
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
    // When no personalised hours are recorded, resolve the shift with the
    // agent's role/team context, including chef-specific schedules.
    const context = {
      role: row?.role_metier || row?.role ||
        state.session?.role_key || window.STIPSession?.role_key || "",
      team: row?.equipe || row?.team || row?.type_planning || ""
    };
    return window.STIPShiftRegistry?.time?.(code, context) || "";
  }
  function weekTimeHtml(v) {
    const parts = String(v || "").match(/\d{1,2}(?::|h)\d{2}/g) || [];
    if (!parts.length) return "";
    return parts
      .slice(0, 2)
      .map((t) => `<span>${esc(t.replace("h", ":"))}</span>`)
      .join("");
  }
  function planningRowForDate(iso) {
    iso = String(iso || "").slice(0, 10);
    if (!iso) return null;
    return (
      (state.boot?.personal || []).find(
        (item) => String(item?.date || "").slice(0, 10) === iso,
      ) || null
    );
  }
  let shiftDetailReadingPosition = null;
  function closeShiftDetail(fromHistory = false) {
    const wrap = document.getElementById("hcShiftDetail");
    if (
      wrap &&
      !fromHistory &&
      window.STIPOverlayNav?.closeElement?.(wrap)
    )
      return;
    wrap?.remove();
    document.body.classList.remove("hc-shift-detail-open");
    const saved = shiftDetailReadingPosition;
    shiftDetailReadingPosition = null;
    if (!wrap || !saved) return;
    // Restoring an overlay from browser history must not navigate the document.
    // Keep the reader at the original scroll position on both X and Android Back.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (document.getElementById("hcShiftDetail")) return;
      if (location.pathname !== saved.path ||
          (window.STIPRouter?.get?.() || "home") !== saved.route) return;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const target = Math.min(saved.y, maxScroll);
      if (Math.abs(window.scrollY - target) > 2)
        window.scrollTo({ top: target, behavior: "auto" });
    }));
  }
  function openShiftDetail(iso, fromHistory = false) {
    const row = planningRowForDate(iso);
    if (!row) return false;
    const raw = String(row?.code || row?.source_value || "").trim(),
      code = canonicalShift(raw),
      // Resolve the exact shift: M0130 (flexible) is not identical to M.
      def = shiftDefinition(raw || code) || shiftDefinition(code),
      label = String(def?.label || shiftMeta(code)[1] || code || "Planning"),
      time = shiftTime(raw || code, row),
      displayCode = raw
        ? raw.toUpperCase().replace(/\s+/g, "")
        : code || "—",
      codeKey = code.replace(/[^A-Z0-9]/g, "").toLowerCase() || "other",
      mode = String(row?.schedule_mode || def?.schedule_mode || "standard"),
      sourceLabel = String(
        row?.source_label || row?.schedule_label || def?.source_label || "",
      ).trim(),
      note = String(
        row?.note ||
          row?.notes ||
          row?.commentaire ||
          row?.comment ||
          row?.description ||
          "",
      ).trim(),
      d = dateObj(iso),
      dateLabel = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
        .format(d)
        .replace(/^./, (c) => c.toUpperCase()),
      adapted = mode && mode !== "standard",
      identityLabel =
        label.trim().toUpperCase() === String(displayCode).trim().toUpperCase()
          ? ""
          : label,
      timeParts = String(time || "").match(/\d{1,2}(?::|h)\d{2}/g) || [],
      timeDisplay =
        mode !== "flexible" && timeParts.length >= 2
          ? `<span>${esc(timeParts[0].replace(":", "h"))}</span><i aria-hidden="true">→</i><span>${esc(timeParts[1].replace(":", "h"))}</span>`
          : esc(time),
      weatherEligible =
        timeParts.length >= 2 &&
        mode !== "flexible" &&
        row?.is_working !== false &&
        Boolean(def?.is_working || window.STIPShiftRegistry?.isWorking?.(raw || code)),
      detailRows = [
        adapted
          ? `<div class="hc-shift-detail-row"><span>Type</span><strong>Horaire adapté</strong></div>`
          : "",
        sourceLabel && sourceLabel.toLowerCase() !== label.toLowerCase()
          ? `<div class="hc-shift-detail-row"><span>Précision</span><strong>${esc(sourceLabel)}</strong></div>`
          : "",
        note
          ? `<div class="hc-shift-detail-note"><span>Information</span><p>${esc(note)}</p></div>`
          : "",
      ]
        .filter(Boolean)
        .join("");
    closeShiftDetail();
    shiftDetailReadingPosition = {
      y: Math.max(0, Math.round(window.scrollY || 0)),
      path: location.pathname,
      route: window.STIPRouter?.get?.() || "home",
    };
    const wrap = document.createElement("div");
    wrap.id = "hcShiftDetail";
    wrap.className = "hc-shift-detail-overlay";
    wrap.innerHTML =
      `<button class="hc-shift-detail-backdrop" type="button" data-shift-detail-close aria-label="Fermer"></button><section class="hc-shift-detail-sheet code-${esc(codeKey)}" role="dialog" aria-modal="true" aria-labelledby="hcShiftDetailTitle"><button type="button" class="hc-shift-detail-close" data-shift-detail-close aria-label="Fermer">×</button><header><small>PLANNING</small><h2 id="hcShiftDetailTitle">${esc(dateLabel)}</h2><div class="hc-shift-detail-identity"><b>${esc(displayCode)}</b>${identityLabel ? `<span>${esc(identityLabel)}</span>` : ""}</div></header><div class="hc-shift-detail-body">${time ? `<section class="hc-shift-detail-time${mode === "flexible" ? " is-flexible" : ""}" aria-label="Horaires"><small>HORAIRES</small><strong>${timeDisplay}</strong>${weatherEligible ? '<aside class="hc-shift-weather-mini" id="hcShiftWeather" aria-label="Prévisions météorologiques limitées aux horaires de ce service" aria-live="polite" hidden></aside>' : ""}</section>` : ""}${detailRows || (!time ? '<p class="hc-shift-detail-empty">Aucune autre information pour ce jour.</p>' : "")}<div class="hc-shift-detail-actions"><button type="button" class="hc-shift-leave-action" data-shift-leave-action>${window.STIPLeaveCart?.has?.(iso)?"Retirer des congés":"🏝️ Demander un congé"}</button></div></div></section>`;
    document.body.appendChild(wrap);
    if (weatherEligible) {
      window.STIPShiftWeather?.mount?.(wrap.querySelector("#hcShiftWeather"), {
        date: iso,
        start: timeParts[0].replace("h", ":"),
        end: timeParts[1].replace("h", ":"),
        isWorking: true
      });
    }
    wrap.querySelector("[data-shift-leave-action]")?.addEventListener("click",()=>{
      window.STIPLeaveCart?.toggle?.(iso,code);
      closeShiftDetail();
    });
    document.body.classList.add("hc-shift-detail-open");
    wrap
      .querySelectorAll("[data-shift-detail-close]")
      .forEach((button) => (button.onclick = () => closeShiftDetail()));
    if (!fromHistory) {
      const track = () =>
        window.STIPOverlayNav?.trackElement?.(wrap, {
          close: () => closeShiftDetail(true),
          reopen: () => openShiftDetail(iso, true),
        });
      if (window.STIPOverlayNav) track();
      else window.STIPOverlayNavigationReady?.then(track);
    }
    wrap.querySelector(".hc-shift-detail-close")?.focus({ preventScroll: true });
    return true;
  }
  function eventType(x = {}) {
    const kind=String(x.event_kind||"").toLowerCase(),
      kindLabel={rendezvous:"Rendez-vous",formation:"Formation",formateur:"Formateur",reunion:"Réunion",information:"Information",autre:"Événement"}[kind];
    if(kindLabel)return kindLabel;
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
  function navigationWeek() {
    const engine = window.STIPWeekEngine,
      dates = engine?.fullDates?.(sharedWeekState(), { today: parisIso() });
    if (Array.isArray(dates) && dates.length)
      return dates.map((iso) => agendaRange(dateObj(iso), 1)[0]);
    const today = dateObj(parisIso()),
      dow = today.getDay() || 7,
      monday = new Date(today);
    monday.setDate(today.getDate() - (dow - 1) + state.weekOffset * 7);
    return agendaRange(monday, 7);
  }
  function selectedWeek() {
    const engine = window.STIPWeekEngine,
      dates = engine?.visibleDates?.(sharedWeekState(), { today: parisIso() });
    if (Array.isArray(dates) && dates.length)
      return dates.map((iso) => agendaRange(dateObj(iso), 1)[0]);
    const today = dateObj(parisIso()),
      dow = today.getDay() || 7,
      monday = new Date(today);
    monday.setDate(today.getDate() - (dow - 1) + state.weekOffset * 7);
    if (state.weekOffset === 0) {
      if (state.weekPast) {
        const pastCount = Math.max(0, dow - 1);
        return pastCount ? agendaRange(monday, pastCount) : agendaRange(today, 8 - dow);
      }
      return agendaRange(today, 8 - dow);
    }
    return agendaRange(monday, 7);
  }
  function moveWeek(step) {
    step = Math.sign(Number(step) || 0);
    if (!step) return;

    const shared = window.STIPWeekEngine?.move?.(
      sharedWeekState(),
      step,
      { today: parisIso() },
    );
    if (shared) {
      applySharedWeekState(shared);
    } else {
      const today = dateObj(parisIso()),
        dow = today.getDay() || 7;
      if (state.weekOffset === 0 && step < 0 && !state.weekPast && dow > 1) {
        state.weekPast = true;
        state.weekFull = false;
      } else if (state.weekOffset === 0 && step > 0 && state.weekPast) {
        state.weekPast = false;
        state.weekFull = false;
      } else {
        state.weekOffset += step;
        state.weekPast = false;
        state.weekFull = state.weekOffset !== 0;
      }
      state.dayFocus = "";
    }

    const visibleWeek = selectedWeek();

    // Une navigation de semaine sélectionne toujours le premier jour réellement visible.
    // Sur la période courante, ce jour est aujourd'hui ; sur une semaine complète, c'est lundi.
    state.dayFocus = visibleWeek[0]?.iso || parisIso();

    // Swipe/scroll must stay under browser control: no full home remount and
    // no delayed scroll correction after moving the week.
    renderWeekContext();
  }
  function dayCard(x, cls = "stip-week-day", compact = false) {
    const canonical = canonicalShift(x.code),
      pending = !canonical || canonical === "—",
      code = canonical.replace(/[^A-Z0-9]/g, "").toLowerCase() || "none",
      weekend = x.dow > 5,
      dayFull = x.d
        .toLocaleDateString("fr-FR", { weekday: "long" })
        .replace(".", "")
        .toUpperCase(),
      landscape = cls.includes("stip-week-day"),
      day = landscape ? dayFull.slice(0, 2) : weekend ? dayFull.slice(0, 1) : dayFull.slice(0, 3),
      loading = x.code === "…",
      statusIcon = shiftStatusIcon(canonical),
      shiftLabel = shiftMeta(canonical)[1] || canonical,
      workIcon = workShiftIcon(canonical),
      statusVisual = statusIcon ? shiftIconHtml(canonical, "hc-status-svg") : "",
      workVisual = workIcon ? shiftIconHtml(canonical, "hc-work-svg") : "",
      workLabel = landscape && workIcon ? canonical : weekend && workIcon ? canonical : shiftLabel,
      normalVisual = loading
        ? '<strong class="hc-shift-loading">…</strong>'
        : pending
          ? '<span class="hc-pending-line" aria-label="En attente du nouveau planning"><span class="hc-pending-icon" aria-hidden="true">🚫</span></span>'
          : statusIcon
            ? `<span class="hc-rest-line"><span class="hc-status-icon" role="img" aria-label="${esc(shiftLabel)}">${statusVisual}</span><strong class="hc-status-code">${esc(canonical)}</strong></span>`
            : workIcon
              ? `<span class="hc-work-line" title="${esc(shiftLabel)}" aria-label="${esc(shiftLabel)}"><span class="hc-work-icon" aria-hidden="true">${workVisual}</span><strong class="hc-shift-name">${esc(workLabel)}</strong></span>`
              : `<strong class="hc-shift-name" title="${esc(shiftLabel)}" aria-label="${esc(shiftLabel)}">${esc(shiftLabel)}</strong>`,
      landscapeMain = loading
        ? '<span class="hc-shift-main stip-week-main hc-loading-main" aria-hidden="true"><span class="hc-loading-orb stip-week-main-icon"></span></span>'
        : pending
          ? '<span class="hc-shift-main stip-week-main"><span class="hc-pending-icon stip-week-main-icon" aria-hidden="true">🚫</span></span>'
          : statusIcon
            ? `<span class="hc-shift-main stip-week-main hc-shift-main-special"><span class="hc-status-icon stip-week-main-icon" role="img" aria-label="${esc(shiftLabel)}">${statusVisual}</span></span>`
            : workIcon
              ? `<span class="hc-shift-main stip-week-main hc-shift-main-work" title="${esc(shiftLabel)}"><span class="hc-work-icon stip-week-main-icon stip-week-work-marker" aria-hidden="true">${workVisual}</span></span>`
              : `<span class="hc-shift-main stip-week-main"><span class="hc-shift-fallback stip-week-main-icon">${esc(shiftLabel || "—")}</span></span>`,
      landscapeCode = loading ? "" : pending ? "—" : canonical || "—",
      hasSupplements = landscape && weekEventsForDay(x).length > 0,
      selected=landscape&&x.iso===state.dayFocus,
      tag=landscape?"button":"span",
      attrs=landscape
        ? ` type="button" data-home-day="${esc(x.iso)}" aria-pressed="${selected}"${loading ? ' disabled aria-disabled="true"' : ""}`
        : "",
      visual=landscape
        ? loading
          ? `<span class="hc-shift-core stip-week-core"><span class="hc-shift-code stip-week-code hc-loading-code" aria-hidden="true"></span>${landscapeMain}</span><span class="hc-week-extra-separator stip-week-divider is-empty" aria-hidden="true"></span><span class="hc-week-events-slot stip-week-events hc-loading-event-slot is-empty" aria-hidden="true"></span>`
          : `<span class="hc-shift-core stip-week-core"><strong class="hc-shift-code stip-week-code">${esc(landscapeCode)}</strong>${landscapeMain}</span><span class="hc-week-extra-separator stip-week-divider ${hasSupplements ? "" : "is-empty"}" aria-hidden="true"></span>${weekEventBadges(x)}`
        : normalVisual;
    return `<${tag}${attrs} class="${cls} ${landscape ? "stip-week-personal-layout" : ""} ${x.today ? "today" : ""} ${selected?"selected":""} ${weekend ? "weekend" : ""} ${loading ? "loading" : pending ? "pending" : (shiftDefinition(canonical)?.is_working === false ? "rest" : "work")} code-${code}" ${x.today ? 'aria-current="date"' : ""}><span class="${landscape ? "stip-week-day-head" : "hc-day-head"}"><i>${esc(day)}</i><b>${x.d.getDate()}</b></span><span class="${landscape ? "stip-week-day-body" : "hc-week-visual"}">${visual}</span></${tag}>`;
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
  function weekEventBadges(x) {
    const events = weekEventsForDay(x).slice(0, 2);
    if (!events.length)
      return '<span class="hc-week-events-slot stip-week-events is-empty" aria-hidden="true"></span>';
    return `<span class="hc-week-events-slot stip-week-events has-events" aria-label="${events.length} événement${events.length > 1 ? "s" : ""}">${events
      .map((event) => {
        const kind = futureTypeKey(event),
          title = event.title || event.type || "Événement";
        return `<i class="hc-week-event-chip stip-week-event type-${esc(kind)}" title="${esc(title)}" aria-label="${esc(title)}">${eventIconHtml(event,"hc-event-svg")}</i>`;
      })
      .join("")}</span>`;
  }
  function weekDisplayModel(w = selectedWeek()) {
    const shared = window.STIPWeekEngine?.display?.(sharedWeekState(), {
        today: parisIso(),
      }),
      nextMonday = shared?.nextMonday
        ? agendaRange(dateObj(shared.nextMonday), 1)[0]
        : null;
    if (shared)
      return {
        weekDays: w,
        nextMonday,
        visualDays: nextMonday ? [...w, nextMonday] : w,
        slotCount: shared.slotCount,
      };
    // Dégradation sûre uniquement: si le moteur maître manque, ne pas recréer
    // une deuxième logique calendrier susceptible de diverger.
    return {
      weekDays: w,
      nextMonday: null,
      visualDays: w,
      slotCount: Math.max(1, w.length),
    };
  }
  function weekDaysLandscape(w) {
    const model = weekDisplayModel(w),
      { nextMonday, slotCount } = model,
      bridge = nextMonday
        ? '<span class="hc-next-monday-bridge" aria-hidden="true"><span class="hc-next-monday-word">LUNDI</span><span class="hc-next-monday-arrow">→</span></span>'
        : "";
    return `<div class="stip-week-line stip-week-personal-line ${nextMonday ? "has-next-monday" : ""}" style="--stip-week-columns:${slotCount};--week-card-h:var(--stip-week-card-h)">${w.map((x) => dayCard(x, "stip-week-day", true)).join("")}${bridge}${nextMonday ? dayCard(nextMonday, "stip-week-day hc-day-next-monday", true) : ""}</div>`;
  }
  function planningStatus() {
    if (planningLoading()) {
      const title = state.planningSlow
          ? "Synchronisation en cours…"
          : "Chargement de votre planning…",
        detail = state.planningSlow
          ? "Encore quelques secondes. Le planning reste verrouillé."
          : "Les jours s’activent dès que vos shifts sont prêts.";
      return `<div class="hc-planning-loading-banner" role="status" aria-live="polite"><span class="hc-planning-loader" aria-hidden="true"></span><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span></div>`;
    }
    if (state.bootStatus === "error")
      return `<div class="hc-planning-status error"><span>Planning non chargé.</span><button type="button" data-planning-retry>Réessayer</button></div>`;
    return "";
  }
  function homeDayStrip(w = navigationWeek()) {
    const today = parisIso(),
      selected = w.some((x) => x.iso === state.dayFocus)
        ? state.dayFocus
        : w.some((x) => x.iso === today)
          ? today
          : w[0]?.iso || "";
    return `<nav class="hc-home-week-days stip-time-days" aria-label="Jours de la semaine">${w
      .map((x) => {
        const label = x.d
            .toLocaleDateString("fr-FR", { weekday: "short" })
            .replace(".", "")
            .toUpperCase(),
          canonical = canonicalShift(x.code),
          codeKey =
            canonical.replace(/[^A-Z0-9]/g, "").toLowerCase() || "none",
          shiftLabel = shiftMeta(canonical)[1] || canonical || "",
          events = weekEventsForDay(x).slice(0, 2),
          eventMarks = events.length
            ? `<span class="hc-home-day-events" aria-hidden="true">${events
                .map((event) => `<i>${eventIconHtml(event,"hc-home-day-event-svg")}</i>`)
                .join("")}</span>`
            : "",
          shiftBadge =
            canonical && canonical !== "—"
              ? `<span class="hc-home-day-shift code-${esc(codeKey)}" title="${esc(shiftLabel)}">${esc(canonical)}</span>`
              : "";
        return `<button type="button" data-home-day="${esc(x.iso)}" class="${[
          x.iso === today ? "today" : "",
          x.iso === selected ? "selected" : "",
          `code-${codeKey}`,
        ]
          .filter(Boolean)
          .join(" ")}" aria-pressed="${x.iso === selected}" aria-label="${esc(
            `${label} ${x.d.getDate()}${shiftLabel ? `, ${shiftLabel}` : ""}`,
          )}">${eventMarks}<small>${esc(label)}</small><b>${x.d.getDate()}</b>${shiftBadge}</button>`;
      })
      .join("")}</nav>`;
  }
  function planningWeekSeparator() {
    const w = navigationWeek(),
      label =
        window.STIPWeekEngine?.separatorLabel?.(sharedWeekState(), {
          today: parisIso(),
        }) ||
        (state.weekOffset === 0
          ? state.weekPast
            ? "DÉBUT DE SEMAINE"
            : "CETTE SEMAINE"
          : state.weekOffset === 1
            ? "SEMAINE PROCHAINE"
            : state.weekOffset === -1
              ? "SEMAINE PRÉCÉDENTE"
              : `SEMAINE ${weekNo(w[0].d)}`);
    return `<div class="hc-planning-period-separator hc-planning-week-separator stip-section-separator" aria-hidden="true"><span>${esc(label)}</span></div>`;
  }

  function planningMonthTitle() {
    const w = navigationWeek(),
      mi = weekMonthInfo(w),
      returnToCurrentWeek =
        state.weekOffset !== 0 || state.weekPast
          ? '<button type="button" class="hc-week-today hc-week-return-current" data-week-today>Revenir à cette semaine</button>'
          : "";
    return `<header class="hc-planning-primary-head"><div class="hc-week-nav hc-week-nav-global hc-week-nav-hero"><button type="button" data-week-step="-1" aria-label="Semaine précédente">‹</button><div class="hc-week-context"><small class="hc-week-hero-kicker">PLANNING · ${esc(mi.heading)} ${esc(mi.yearLabel)}</small><strong>${esc(weekRangeLabel(w))}</strong><span>SEMAINE ${weekNo(w[0].d)}</span></div><button type="button" data-week-step="1" aria-label="Semaine suivante">›</button></div>${homeDayStrip(w)}${returnToCurrentWeek}</header>`;
  }
  function planningCalendarOverview() {
    const w = navigationWeek(),
      calendarKey = state.dateJumpMonth || monthKeyOf(w[0]?.d || dateObj(parisIso()));
    return `<section class="hc-planning-calendar-block" aria-label="Aperçu mensuel du planning"><div id="hcDateJumpPanel" class="hc-date-jump-panel hc-date-jump-permanent stip-month-calendar" data-date-jump-panel data-calendar-month="${esc(calendarKey)}"></div></section>`;
  }
  function weekWidget() {
    const w = selectedWeek(),
      loading = planningLoading(),
      range = weekRangeLabel(w);
    return `<section class="hc-widget hc-widget-planning${loading ? " is-loading" : ""}" data-widget="planning" aria-busy="${loading ? "true" : "false"}">${planningStatus()}<div class="hc-date-jump-head hc-week-jump-head stip-week-master-nav" role="group" aria-label="Navigation par semaine"><button type="button" data-week-step="-1" aria-label="Semaine précédente">‹</button><strong>${esc(range)}</strong><button type="button" data-week-step="1" aria-label="Semaine suivante">›</button></div>${weekDaysLandscape(w)}</section>`;
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
            String(x.icon || "").trim() ||
            (x.source_type === "mobi_lit_medical"
              ? "🩺"
              : x.importance === "urgent"
                ? "⚠️"
                : x.importance === "important"
                  ? "❗"
                  : "📌"),
          iconKey:
            String(x.icon_key || "").trim() ||
            (x.source_type === "mobi_lit_medical"
              ? "medical"
              : x.importance === "urgent"
                ? "alert"
                : x.importance === "important"
                  ? "priority"
                  : "event"),
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
          iconKey: "training",
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
          iconKey: "trainee",
          type: "Stagiaire",
          title: [x.prenom, x.nom].filter(Boolean).join(" ") || "Stagiaire",
          time,
          place,
          relation: "Référent : vous",
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
    if (d === 2) return "Après-demain";
    if (d > 2 && d < 7) return `Dans ${d} jours`;
    return fmtDateRange({ date: iso, endDate: iso });
  }
  function planningDaySeparatorLabel(iso) {
    const d = dayDelta(iso);
    if (d === 0) return "Aujourd’hui";
    if (d === 1) return "Demain";
    if (d === 2) return "Après-demain";
    if (d > 2) return `Dans ${d} jours`;
    return fmtDateRange({ date: iso, endDate: iso });
  }
  function todayFullDateSeparator() {
    const date = dateObj(parisIso()),
      formatter = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      parts = Object.fromEntries(
        formatter
          .formatToParts(date)
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, part.value]),
      ),
      raw = formatter.format(date),
      weekday = String(parts.weekday || "").toUpperCase(),
      day = String(parts.day || ""),
      month = String(parts.month || "").toUpperCase();
    return `<div class="hc-home-date-kicker stip-section-separator" aria-hidden="true"><span>DATE</span></div><div class="hc-planning-period-separator stip-section-separator hc-home-today-separator" aria-label="${esc(raw)}"><button type="button" class="hc-home-today-label" data-header-date-search aria-label="Rechercher une date"><span>${esc(weekday)}</span><b class="hc-home-today-day">${esc(day)}</b><span>${esc(month)}</span></button></div>`;
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
              return `<article class="hc-agenda-item ${isFocus ? "is-focus" : ""}" data-agenda-id="${esc(x.id)}"><div class="hc-agenda-date"><b>${esc(dateObj(x.date).toLocaleDateString("fr-FR", { day: "2-digit" }))}</b><small>${esc(dateObj(x.date).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase())}</small></div><i class="hc-agenda-icon type-${key}">${eventIconHtml(x,"hc-event-svg")}</i><div class="hc-agenda-copy"><span class="hc-agenda-item-top"><small>${esc((x.type || "Événement").toUpperCase())}</small><em>${esc(nextLabel(x.date))}</em></span><strong>${esc(x.title)}</strong><p>${esc([time, place].filter(Boolean).join(" · ") || x.sub || "")}</p></div></article>`;
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
      rows = [];
    items.slice(0, 3).forEach((x) => {
      const start = String(x.date || "").slice(0, 10),
        end = String(x.endDate || x.end_date || x.date || "").slice(0, 10),
        time = String(x.time || "").trim(),
        place = String(x.place || "").trim();
      w.forEach((day) => {
        if (day.iso < start || day.iso > end) return;
        rows.push({ event: x, day, time, place });
      });
    });
    if (!rows.length) return "";

    rows.sort((a, b) =>
      a.day.iso.localeCompare(b.day.iso) ||
      String(a.event?.title || "").localeCompare(String(b.event?.title || ""), "fr"),
    );

    const groups = [];
    rows.forEach((row) => {
      let group = groups[groups.length - 1];
      if (!group || group.iso !== row.day.iso) {
        group = { iso: row.day.iso, rows: [] };
        groups.push(group);
      }
      group.rows.push(row);
    });

    const content = groups.map((group) => {
      const label = planningDaySeparatorLabel(group.iso),
        buttons = group.rows.map(({ event:x, day, time, place }) => {
          const dayLabel = day.d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).replace(".", ""),
            kind = futureTypeKey(x);
          return `<button type="button" class="hc-week-event-key-item hc-week-event-day-row type-${esc(kind)}" data-widget-open="future" data-future-id="${esc(x.id)}"><span class="hc-week-event-key-icon" aria-hidden="true">${eventIconHtml(x,"hc-event-svg")}</span><span class="hc-week-event-copy"><strong>${esc(x.title)}</strong><span class="hc-week-event-when"><b class="hc-week-event-date">${esc(dayLabel)}</b>${time ? `<b class="hc-week-event-time">${esc(time)}</b>` : ""}${x.relation ? `<b class="hc-week-event-relation">${esc(x.relation)}</b>` : ""}${place ? `<span class="hc-week-event-place">${esc(place)}</span>` : ""}</span></span><span class="hc-week-event-chevron" aria-hidden="true">›</span></button>`;
        }).join("");
      return `<div class="hc-week-event-date-group"><div class="hc-planning-period-separator hc-week-event-date-separator stip-section-separator is-compact"><span>${esc(label)}</span></div>${buttons}</div>`;
    }).join("");

    return `<section class="hc-widget hc-widget-future hc-week-event-key" data-widget="future"><div class="hc-week-event-key-list">${content}</div></section>`;
  }
  function monthEventsWidget() {
    const key =
        state.dateJumpMonth ||
        navigationWeek()[0]?.iso?.slice(0, 7) ||
        parisIso().slice(0, 7),
      [year, month] = key.split("-").map(Number),
      first = new Date(year, month - 1, 1, 12),
      last = new Date(year, month, 0, 12),
      monthStart = dateIsoLocal(first),
      monthEnd = dateIsoLocal(last),
      rows = [];

    futureItems().forEach((x) => {
      const start = String(x.date || "").slice(0, 10),
        end = String(x.endDate || x.end_date || x.date || "").slice(0, 10);
      if (!start || start > monthEnd || end < monthStart) return;

      const from = dateObj(start < monthStart ? monthStart : start),
        to = dateObj(end > monthEnd ? monthEnd : end);
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        rows.push({
          event: x,
          iso: dateIsoLocal(d),
          d: new Date(d),
        });
      }
    });

    if (!rows.length) return "";
    rows.sort(
      (a, b) =>
        a.iso.localeCompare(b.iso) ||
        String(a.event?.title || "").localeCompare(
          String(b.event?.title || ""),
          "fr",
        ),
    );

    const buttons = rows
      .map(({ event: x, d }) => {
        const kind = futureTypeKey(x),
          time = String(x.time || "").trim(),
          place = String(x.place || "").trim(),
          dayLabel = d
            .toLocaleDateString("fr-FR", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })
            .replace(".", "");
        return `<button type="button" class="hc-week-event-key-item hc-week-event-day-row type-${esc(kind)}" data-widget-open="future" data-future-id="${esc(x.id)}"><span class="hc-week-event-key-icon" aria-hidden="true">${eventIconHtml(x,"hc-event-svg")}</span><span class="hc-week-event-copy"><strong>${esc(x.title)}</strong><span class="hc-week-event-when"><b class="hc-week-event-date">${esc(dayLabel)}</b>${time ? `<b class="hc-week-event-time">${esc(time)}</b>` : ""}${x.relation ? `<b class="hc-week-event-relation">${esc(x.relation)}</b>` : ""}${place ? `<span class="hc-week-event-place">${esc(place)}</span>` : ""}</span></span><span class="hc-week-event-chevron" aria-hidden="true">›</span></button>`;
      })
      .join("");

    return `<section class="hc-widget hc-widget-future hc-week-event-key hc-month-event-key" data-widget="future"><div class="hc-week-event-key-list">${buttons}</div></section>`;
  }
  function planningMonthEventsSeparator() {
    const key =
        state.dateJumpMonth ||
        navigationWeek()[0]?.iso?.slice(0, 7) ||
        parisIso().slice(0, 7),
      label =
        key === parisIso().slice(0, 7)
          ? "CE MOIS-CI"
          : monthTitle(`${key}-01`).toUpperCase();
    return `<div class="hc-planning-period-separator hc-planning-month-events-separator stip-section-separator" aria-hidden="true"><span>${esc(label)}</span></div>`;
  }

  function legendEventDescriptor(event = {}) {
    const icon = String(event.icon || "•").trim() || "•",
      iconKey = eventIconKey(event),
      type = eventType(event);
    if (iconKey === "medical" || type === "Visite médicale")
      return { icon: "🩺", iconKey: "medical", label: "Visite médicale" };
    if (iconKey === "trainee" || type === "Stagiaire")
      return { icon: "👶", iconKey: "trainee", label: "Stagiaire" };
    if (iconKey === "training" || type === "Formation")
      return { icon: "🎓", iconKey: "training", label: "Formation" };
    if (iconKey === "alert")
      return { icon: "⚠️", iconKey: "alert", label: "Urgent" };
    if (iconKey === "priority")
      return { icon: "❗", iconKey: "priority", label: "Important" };
    return { icon, iconKey: iconKey || "event", label: type || "Événement" };
  }
  function fixedShiftLegend() {
    const key =
        state.dateJumpMonth ||
        selectedWeek()[0]?.iso?.slice(0, 7) ||
        parisIso().slice(0, 7),
      [year, month] = key.split("-").map(Number),
      last = new Date(year, month, 0, 12).getDate(),
      weekModel = weekDisplayModel(selectedWeek()),
      visibleDates = new Set(),
      items = [],
      seen = new Set(),
      add = (id, iconHtml, label, meta = "") => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        items.push(
          `<button type="button" class="stip-legend-item" data-stip-legend-key="${esc(id)}" aria-pressed="false"><span class="stip-legend-icon" aria-hidden="true">${iconHtml}</span><span class="stip-legend-bullet" aria-hidden="true">•</span><b>${esc(label)}</b>${meta ? `<small>${esc(meta)}</small>` : ""}</button>`,
        );
      },
      addEvent = (event) => {
        const descriptor = legendEventDescriptor(event);
        add(
          "event:" + descriptor.iconKey + "|" + descriptor.label,
          iconHtml(descriptor.iconKey, descriptor.icon, descriptor.label, "hc-legend-event-svg"),
          descriptor.label,
        );
      },
      addEventIcon = (item) => {
        const descriptor = legendEventDescriptor({
          icon: item?.icon || "•",
          iconKey: item?.iconKey || "",
          title: item?.label || "Événement"
        });
        add(
          "event:" + descriptor.iconKey + "|" + descriptor.label,
          iconHtml(descriptor.iconKey, descriptor.icon, descriptor.label, "hc-legend-event-svg"),
          descriptor.label
        );
      };

    for (let day = 1; day <= last; day++)
      visibleDates.add(key + "-" + String(day).padStart(2, "0"));
    weekModel.visualDays.forEach((day) => {
      if (day?.iso) visibleDates.add(day.iso);
    });

    for (const iso of visibleDates) {
      const shift = calendarShiftForDate(iso);
      if (shift?.code && shift.code !== "—") {
        const code = shift.code,
          def = shiftDefinition(code);
        if (def?.is_working) {
          const family = String(def.family || "other").toLowerCase(),
            dot = `<i class="hc-legend-shift-dot shift-${esc(family)}"></i>`;
          add(
            "shift:" + code,
            dot,
            def.label || code,
            shiftTime(code),
          );
        } else {
          const label = def?.label || shift.label || code,
            symbol = String(def?.icon || shift.icon || "•"),
            iconKey = String(def?.icon_key || shift.iconKey || "");
          add("status:" + code, iconHtml(iconKey, symbol, label, "hc-legend-shift-svg"), `${code} — ${label}`);
        }
      }
      calendarEventIcons(iso).forEach(addEventIcon);
    }

    // The week detail and month detail can expose more event symbols than the
    // compact calendar cells; include those too so the page legend is complete.
    const weekDaysNow = weekModel.visualDays.filter((day) => day?.iso),
      weekStart = weekDaysNow[0]?.iso || "",
      weekEnd = weekDaysNow.at(-1)?.iso || "";
    // Keep the legend on the same event source as the month/week widgets.
    // monthTimelineItems() was removed when the month view was simplified;
    // filtering futureItems() here prevents the home/Profile render from crashing.
    const monthStart = `${key}-01`,
      monthEnd = `${key}-${String(last).padStart(2, "0")}`;
    futureItems()
      .filter((event) => {
        const start = String(event.date || "").slice(0, 10),
          end = String(
            event.endDate || event.end_date || event.date || "",
          ).slice(0, 10);
        return !!start && start <= monthEnd && end >= monthStart;
      })
      .forEach(addEvent);
    if (weekStart && weekEnd)
      futureItems()
        .filter((event) => {
          const start = String(event.date || "").slice(0, 10),
            end = String(
              event.endDate || event.end_date || event.date || "",
            ).slice(0, 10);
          return !!start && start <= weekEnd && end >= weekStart;
        })
        .forEach(addEvent);

    const visibleWeekHasPending = weekModel.visualDays.some((day) => {
      const shift = calendarShiftForDate(day?.iso || "");
      return !shift?.code || shift.code === "—";
    });
    if (visibleWeekHasPending)
      add("planning:pending", "🚫", "Planning non renseigné");

    if (!items.length) return "";
    return `<section class="hc-fixed-shift-legend stip-legend" aria-label="Légende des repères de la page"><div class="stip-section-separator hc-planning-legend-separator" aria-hidden="true"><span>LÉGENDE</span></div><div class="stip-legend-surface"><div class="stip-legend-list">${items.join("")}</div></div></section>`;
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
  function agendaAlertItems() {
    return notifications()
      .filter((n) =>
        (n.type === "agenda_alert" || n.source_type === "agenda_alert") &&
        n.metadata?.recipient_kind === "target" &&
        n.metadata?.conflict === true
      )
      .sort((a, b) => {
        const sa = a.metadata?.severity === "danger" ? 0 : 1,
          sb = b.metadata?.severity === "danger" ? 0 : 1;
        return sa - sb || String(a.metadata?.event_at || "").localeCompare(String(b.metadata?.event_at || ""));
      });
  }
  function agendaAlertBanner() {
    const alerts = agendaAlertItems();
    if (!alerts.length) return "";
    const n = alerts[0],
      key = String(n.metadata?.alert_key || n.id || ""),
      count = alerts.length > 1 ? `<span class="hc-agenda-alert-count">+${alerts.length - 1}</span>` : "",
      when = [n.metadata?.event_date, n.metadata?.event_time].filter(Boolean).join(" · ");
    return `<section class="hc-agenda-alert-wrap" aria-label="Alerte planning">
      <button type="button" class="hc-agenda-alert ${n.metadata?.severity === "warning" ? "is-warning" : "is-danger"}" data-alert-open="${esc(key)}">
        <img src="/images/notifications/alert-danger.webp?v=20260928-alert1" alt="" aria-hidden="true">
        <span class="hc-agenda-alert-copy"><small>ALERTE PLANNING</small><strong>${esc(n.title || "Incohérence détectée")}</strong><em>${esc(friendlyNoteBody(n))}</em>${when ? `<b>${esc(when)}</b>` : ""}</span>
        ${count}<span class="hc-agenda-alert-arrow" aria-hidden="true">›</span>
      </button>
    </section>`;
  }
  function focusRequestedAlert() {
    const params = new URLSearchParams(location.search),
      key = String(params.get("alert_key") || "").trim();
    if (!key || state.focusedAlertKey === key) return;
    const note = notifications().find((n) => String(n.metadata?.alert_key || n.id || "") === key);
    if (!note) return;
    state.focusedAlertKey = key;
    openNotificationDetail(note, { focusAction: true });
    params.delete("alert_key");
    const query = params.toString();
    history.replaceState(history.state, "", location.pathname + (query ? "?" + query : "") + location.hash);
  }

  function profile() {
    const template = window.STIPPersonCard;
    if (template?.renderCurrent)
      return `<section class="hc-profile-section" aria-label="Carte STIP">
        ${template.renderCurrent({ label: "MON PROFIL", compact: true, headerIdentity: true })}
      </section>`;

    const a = state.boot?.agent || state.session?.agent || {},
      prenom = cap(String(a.prenom || "").trim()),
      nom = cap(String(a.nom || "").trim()),
      ini = ((a.prenom?.[0] || "") + (a.nom?.[0] || "")).toUpperCase() || "ST";
    return `<section class="hc-profile-section" aria-label="Carte STIP">
      <section class="stip-person-card is-compact is-self hc-id-card">
        <div class="stip-person-card-avatar hc-avatar" data-avatar-fallback="${esc(ini)}"><span>${esc(ini)}</span></div>
        <div class="stip-person-card-copy"><small>MON PROFIL</small><strong>${esc([prenom, nom].filter(Boolean).join(" ") || "Utilisateur")}</strong></div>
      </section>
    </section>`;
  }

  function pilotageRoleKey() {
    const raw = String(
      state.session?.role_key ||
        window.STIPSession?.role_key ||
        state.boot?.role_key ||
        "",
    )
      .trim()
      .toLowerCase();
    if (raw === "chef_equipe") return "responsable";
    if (raw === "brancardier") return "agent";
    if (raw === "stagiaire") return "stagiaire";
    if (["admin", "cadre", "responsable", "agent", "stagiaire", "metiers", "visiteur"].includes(raw))
      return raw;
    if (has("admin")) return "admin";
    if (has("cadre_dashboard")) return "cadre";
    if (has("responsable")) return "responsable";
    if (has("planning_personal")) return "agent";
    return "visiteur";
  }
  function pilotageLink(item = {}) {
    if (item.when && !item.when()) return "";
    const active = item.action && item.action === state.homeMode,
      inner = `<span class="hc-pilotage-link-icon" aria-hidden="true">${esc(item.icon || "•")}</span><strong>${esc(item.label || "")}</strong><b aria-hidden="true">›</b>`;
    if (item.href)
      return `<a class="hc-pilotage-link" href="${esc(item.href)}" aria-label="${esc(item.aria || item.label || "")}">${inner}</a>`;
    return `<button type="button" class="hc-pilotage-link${active ? " is-current" : ""}" data-app="${esc(item.action || "")}" aria-current="${active ? "page" : "false"}" aria-label="${esc(item.aria || item.label || "")}">${inner}</button>`;
  }
  const PILOTAGE_OPEN_STORE = "stip_pilotage_open_v3";
  function readPilotageOpen() {
    try {
      const value = JSON.parse(sessionStorage.getItem(PILOTAGE_OPEN_STORE) || "[]");
      return new Set(Array.isArray(value) ? value.map(String) : []);
    } catch {
      return new Set();
    }
  }
  function writePilotageOpen(openRoles) {
    try {
      sessionStorage.setItem(
        PILOTAGE_OPEN_STORE,
        JSON.stringify([...openRoles].filter(Boolean)),
      );
    } catch {}
  }
  function pilotageRoleGroup(
    key,
    label,
    items = [],
    collapsible = false,
    openRoles = new Set(),
  ) {
    const links = items.map(pilotageLink).filter(Boolean).join("");
    if (!links) return "";
    const separator = `<span>${esc(label)}</span>`;
    if (collapsible)
      return `<details class="hc-pilotage-group hc-pilotage-group-${esc(key)}" data-pilotage-role="${esc(key)}"${openRoles.has(key) ? " open" : ""}><summary class="stip-section-separator hc-pilotage-separator">${separator}</summary><div class="hc-pilotage-links">${links}</div></details>`;
    if (key === "responsable")
      return `<section class="hc-pilotage-group hc-pilotage-group-responsable is-open is-context-entry" data-pilotage-role="responsable" aria-label="Espace Responsable"><div class="hc-pilotage-links">${links}</div></section>`;
    return `<section class="hc-pilotage-group hc-pilotage-group-${esc(key)} is-open" data-pilotage-role="${esc(key)}"><div class="stip-section-separator hc-pilotage-separator" aria-hidden="true">${separator}</div><div class="hc-pilotage-links">${links}</div></section>`;
  }
  function pilotageBlock() {
    const role = pilotageRoleKey(),
      groups = [
        {
          key: "stagiaire",
          label: "RACCOURCIS · Stagiaire",
          items: [
            {
              href: "le-nouveau.html?v=20261006-dudy2",
              label: "Dudy au GHE",
              icon: "🎬",
            },
            {
              href: "places-app.html",
              label: "Visiter les lieux",
              icon: "📍",
              when: () => has("places"),
            },
          ],
        },
        {
          key: "agent",
          label: "RACCOURCIS · Agent",
          items: [
            {
              href: "le-nouveau.html?v=20261006-dudy2",
              label: "Dudy au GHE",
              icon: "🎬",
            },
            {
              href: "places-app.html",
              label: "Visiter les lieux",
              icon: "📍",
              when: () => has("places") || has("admin"),
            },
          ],
        },
        {
          key: "responsable",
          label: "RACCOURCIS · Responsable",
          items: [
            {
              href: "le-nouveau.html?v=20261006-dudy2",
              label: "Dudy au GHE",
              icon: "🎬",
            },
            {
              action: "responsable",
              label: "Responsable",
              icon: "🧭",
              when: () => has("responsable") || has("admin"),
            },
            {
              href: "places-app.html?mode=pro",
              label: "Visiter les lieux",
              icon: "📍",
              when: () => has("places"),
            },
          ],
        },
        {
          key: "cadre",
          label: "RACCOURCIS · Cadre",
          items: [
            {
              href: "le-nouveau.html?v=20261006-dudy2",
              label: "Dudy au GHE",
              icon: "🎬",
            },
            {
              href: "cadre-activite.html",
              label: "Activité",
              icon: "📈",
              when: () => has("activity") || has("admin"),
            },
            {
              href: "places-app.html?mode=pro",
              label: "Connaître les lieux",
              icon: "📍",
              when: () => has("places") || has("admin"),
            },
            {
              href: "cadre-documents.html",
              label: "Documents",
              icon: "▤",
              when: () => has("cadre_dashboard") || has("admin"),
            },
          ],
        },
        {
          key: "metiers",
          label: "RACCOURCIS · Autres métiers",
          items: [
            {
              href: "le-nouveau.html?v=20261006-dudy2",
              label: "Dudy au GHE",
              icon: "🎬",
            },
            {
              href: "places-app.html",
              label: "Visiter les lieux",
              icon: "📍",
              when: () => has("places") || has("admin"),
            },
            {
              href: "metiers/",
              label: "Accueil métiers",
              icon: "▦",
              when: () => has("admin"),
            },
          ],
        },
        {
          key: "external",
          label: "RACCOURCIS · Comptes externes",
          items: [
            {
              href: "external-access.html",
              label: "Gérer les comptes externes",
              icon: "🔑",
              when: () => has("admin"),
            },
          ],
        },
        {
          key: "admin",
          label: "RACCOURCIS · Admin",
          items: [
            {
              href: "dudy-admin.html",
              label: "Dudy · Préparer dimanche",
              icon: "🎬",
              when: () => has("admin"),
            },
            {
              action: "admin",
              label: "Administration",
              icon: "⚙️",
              when: () => has("admin"),
            },
          ],
        },
      ];
    const common = pilotageRoleGroup("navigation", "ACCÈS AUX APPLICATIONS", [
      { action: "apps", label: "Applications", icon: "▦" },
      { action: "planning", label: "Mon espace", icon: "▤" },
      { action: "communication", label: "Communication", icon: "◉", when: () => has("messages") },
    ]);
    if (role === "visiteur") return common;
    if (role === "admin") {
      const openRoles = readPilotageOpen();
      return `<section class="hc-pilotage-shell is-admin" aria-label="Raccourcis par profil">${groups
        .map((group) =>
          pilotageRoleGroup(
            group.key,
            group.label,
            group.items,
            group.key !== "admin",
            openRoles,
          ),
        )
        .join("")}${common}</section>`;
    }
    const group = groups.find((item) => item.key === role);
    if (!group) return common;
    const content = pilotageRoleGroup(
      group.key,
      group.label,
      group.items,
      false,
    );
    return content
      ? `<section class="hc-pilotage-shell" aria-label="Raccourcis">${common}${content}</section>`
      : "";
  }
  function app(kind, title, cls, action) {
    return `<button class="hc-app ${cls}" data-app="${action}"><span>${ICON[kind]}</span><strong>${esc(title)}</strong></button>`;
  }
  function apps() {
    let s = "";
    if (has("planning_personal"))
      s += app("personal", "Planning perso", "personal", "personal");
    if (has("tomorrow"))
      s += app("tomorrow", "Actions", "tomorrow", "tomorrow");
    if (has("meeting_notes"))
      s += app("meeting_notes", "Notes de réunion", "meeting-notes", "meeting_notes");
    if (has("planning_team") || has("activity") || has("assistant_enabled"))
      s += app("team", "Esprit d’équipe", "team", "team");
    if (has("messages"))
      s += app("homeChat", "Communication", "communication", "communication");
    if (has("agent_directory"))
      s += app("agents", "Équipe", "agents", "agents");
    if (has("change_app")) s += app("change", "Changement", "change", "change");
    if (has("calendar_subscribe"))
      s += app("calendar", "Synchroniser mon calendrier", "calendar", "calendar");
    if (has("agent_dates"))
      s += app("dates", "Date des agents", "dates", "dates");
    if (has("contacts"))
      s += app("contacts", "Contacts", "contacts", "contacts");
    if (has("responsable") || has("admin"))
      s += app("responsable", "Responsable", "responsable", "responsable");
    if (pilotageRoleKey() === "responsable" && has("places"))
      s += app("places", "Visiter les lieux", "places", "places");
    if (has("nouveaux_arrivants"))
      s += app("newagent", "Nouvel agent", "newagent", "newagent");
    if (has("file_upload")) s += app("upload", "Importer", "upload", "upload");
    if (has("admin")) s += app("admin", "Admin", "admin", "admin");
    if (!has("admin") && has("access_manage"))
      s += app("access", "Accès & sécurité", "access", "access");
    return s || '<p class="hc-empty">Aucune application autorisée.</p>';
  }
  function routeForHomeMode(mode = "planning") {
    return (
      {
        planning: "home",
        apps: "apps",
        notifications: "notifications",
        team: "team",
        responsable: "responsable",
        communication: "communication/chat",
        tableau: "communication/fauteuils",
      }[mode] || "home"
    );
  }
  function communicationTabForRoute(route = "") {
    const value = String(route || "");
    if (value === "fauteuils" || value.endsWith("/fauteuils")) return "wheelchair";
    if (value.endsWith("/dm")) return "dm";
    return "chat";
  }
  function homeModeForRoute(route = "home") {
    const value = String(route || "home");
    if (value === "fauteuils" || value === "communication" || value.startsWith("communication/"))
      return "communication";
    return (
      {
        home: "planning",
        apps: "apps",
        notifications: "notifications",
        team: "team",
        responsable: "responsable",
      }[value] || ""
    );
  }

  // Live face: only authorized planning and notifications already available in STIP.
  // "En poste" means the planned shift covers the current Paris clock, never online status.
  function liveParisClock() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
    const v = (key) => Number(parts.find((p) => p.type === key)?.value || 0);
    return { day: parisIso(), minutes: v("hour") * 60 + v("minute") };
  }
  function liveWorkInterval(item) {
    const code = String(item?.code || "").trim();
    const def = shiftDefinition(code);
    if (!def?.is_working) return null;
    const agent = item.agents || {};
    const value = shiftTime(code, {
      ...item, role: agent.role || item.role, type_planning: agent.type_planning || item.equipe,
    });
    const matches = String(value).match(/\d{1,2}(?::|h)\d{2}/g) || [];
    if (matches.length < 2) return null;
    const toMin = (s) => {
      const [h,m] = s.replace("h",":").split(":").map(Number);
      return h * 60 + m;
    };
    const from = toMin(matches[0]), end = toMin(matches[1]);
    if (![from,end].every(Number.isFinite)) return null;
    return { start: from, end, label: String(value) };
  }
  function liveCurrentlyWorking(item, now = liveParisClock()) {
    const time = liveWorkInterval(item);
    if (!time) return false;
    const day = String(item?.date || "").slice(0,10);
    if (day === now.day) {
      return time.end > time.start
        ? now.minutes >= time.start && now.minutes < time.end
        : now.minutes >= time.start;
    }
    if (time.end > time.start) return false;
    const yesterday = dateObj(now.day);
    yesterday.setDate(yesterday.getDate() - 1);
    return day === dateIsoLocal(yesterday) && now.minutes < time.end;
  }
  function liveShiftClass(code) {
    const base = canonicalShift(code).toLowerCase();
    return ["m","j","j4","s","n"].includes(base) ? "shift-" + base : "shift-other";
  }

  // LIVE is a modal over the home page. Staff availability is derived only
  // from the existing authorized team shift planning, never from an absence report.
  function liveRoster() {
    const team=document.getElementById("hcTeamFusion");
    const allowed=has("planning_team");
    const loaded=allowed && Array.isArray(team?._thfAgents);
    const now=liveParisClock();
    const entries=loaded?[...team._thfAgents]:[];
    if (has("planning_personal")) {
      const agent=state.boot?.agent || state.session?.agent || {};
      const shift=(state.boot?.personal || []).find(x=>String(x.date||"").slice(0,10)===now.day);
      if (shift) entries.push({...shift,code:shift.code||shift.source_value,agents:agent});
    }
    const seen=new Set(), active=[];
    for(const item of entries) {
      if(!liveCurrentlyWorking(item,now))continue;
      const a=item.agents||{};
      const identity=String(a.source_key||a.id||"").trim()||agentName(a).toLowerCase();
      if(!identity||seen.has(identity))continue;
      seen.add(identity);
      active.push(item);
    }
    const chiefs=new Set((team?._thfChiefs||[]).map(x=>String(x.agents?.source_key||"")));
    active.sort((a,b)=>{
      const ca=Number(chiefs.has(String(a.agents?.source_key||"")));
      const cb=Number(chiefs.has(String(b.agents?.source_key||"")));
      return cb-ca ||
        (liveWorkInterval(a)?.start??1440)-(liveWorkInterval(b)?.start??1440) ||
        agentName(a.agents).localeCompare(agentName(b.agents),"fr");
    });
    return {rows:active,allowed,loaded};
  }
  // Source canonique : planning d'équipe autorisé, horaires calculés à Paris.
  // Aucun marqueur de présence réelle ni déclaration d'absence.
  function liveRoster() {
    const host = document.getElementById("hcTeamFusion");
    const permitted = has("planning_team");
    const loaded = permitted && Array.isArray(host?._thfAgents);
    const now = liveParisClock();
    const entries = loaded ? host._thfAgents.slice() : [];
    if (has("planning_personal")) {
      const a = state.session?.agent || state.boot?.agent || {};
      const day = (state.boot?.personal || []).find(x => String(x.date || "").slice(0, 10) === now.day);
      if (day) entries.push({ ...day, code: day.code || day.source_value, agents: a });
    }
    const seen = new Set(), current = [];
    for (const item of entries) {
      if (!liveCurrentlyWorking(item, now)) continue;
      const agent = item.agents || {};
      const key = String(agent.source_key || agent.id || "").trim() || agentName(agent).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      current.push(item);
    }
    current.sort((a, b) => (liveWorkInterval(a)?.start ?? 1440) -
      (liveWorkInterval(b)?.start ?? 1440) ||
      agentName(a.agents).localeCompare(agentName(b.agents), "fr"));
    return { rows: current, permitted, loaded };
  }
  function liveCardMarkup() {
    const roster = liveRoster();
    const groups = new Map();
    for (const row of roster.rows) {
      const shift = canonicalShift(row.code);
      if (!groups.has(shift)) groups.set(shift, []);
      groups.get(shift).push(row);
    }
    const workGroups = [...groups].map(([code, rows]) => {
      const names = rows.map(row => {
        const agent = row.agents || {};
        const key = String(agent.source_key || agent.id || "").trim();
        const label = agentName(agent);
        return key
          ? '<button class="ghe-live-name" type="button" data-live-agent="' + esc(key) +
            '" aria-label="Informations professionnelles de ' + esc(label) + '">' + esc(label) + '</button>'
          : '<span class="ghe-live-name">' + esc(label) + '</span>';
      }).join('<span class="ghe-live-name-sep" aria-hidden="true">·</span>');
      return '<div class="ghe-live-shift-row ' + liveShiftClass(code) + '">' +
        '<span class="ghe-live-shift-code" title="' + esc(shiftMeta(code)[1]) + '">' + esc(code) + '</span>' +
        '<span class="ghe-live-shift-names">' + names + '</span></div>';
    }).join("");
    const total = roster.rows.length;
    const messages = notifications();
    const actions = pending();
    const recent = messages.filter(n => {
      const time = new Date(noteTimeValue(n)).getTime();
      return Number.isFinite(time) && time <= Date.now() && Date.now() - time < 86400000;
    });
    const unavailable = roster.permitted && !roster.loaded
      ? 'Chargement du planning…'
      : !roster.permitted && !has("planning_personal")
        ? 'Planning collectif non autorisé.'
        : 'Aucun agent en poste selon les horaires disponibles.';
    return '<section class="ghe-live-strip" id="gheLiveStrip" aria-label="En direct, horaires et activité du service">' +
      '<div class="ghe-live-strip-head">' +
        '<strong class="ghe-live-strip-title"><span class="ghe-live-dot" aria-hidden="true"></span>EN DIRECT</strong>' +
        '<div class="ghe-live-strip-stats">' +
          '<button type="button" data-live-actions class="ghe-live-stat" aria-label="' + actions.length +
            ' actions à traiter"><span>À traiter</span><b>' + actions.length + '</b></button>' +
          '<button type="button" data-bell-open class="ghe-live-stat" aria-label="' + recent.length +
            ' notifications récentes"><span>Activité</span><b>' + recent.length + '</b></button>' +
        '</div></div>' +
      '<div class="ghe-live-strip-workers"><div class="ghe-live-workers-heading">' +
        '<strong>En poste</strong><b>' + (roster.permitted && !roster.loaded ? '…' : total) + '</b>' +
        '</div><div class="ghe-live-shifts">' +
        (workGroups || '<span class="ghe-live-unavailable">' + esc(unavailable) + '</span>') +
        '</div></div>' +
      '<small class="ghe-live-strip-note">Selon le planning, pas une présence physique vérifiée.</small>' +
    '</section>';
  }
  function updateLiveCard() {
    const root = document.getElementById("gheLiveStrip");
    if (!root || !root.isConnected || !state.ready) return;
    // Met à jour le bloc uniquement, sans réinitialiser la semaine ni les formulaires.
    root.outerHTML = liveCardMarkup();
  }
  function openLiveAgent(key) {
    if (!key) return;
    const row = liveRoster().rows.find(item =>
      String(item.agents?.source_key || item.agents?.id || "") === key);
    if (!row) return;
    const agent = row.agents || {}, code = canonicalShift(row.code);
    const time = liveWorkInterval(row)?.label || "Horaire non renseigné";
    const tel = String(agent.telephone || "").replace(/\D/g, "");
    const canCall = has("contacts") && tel.length >= 6;
    document.getElementById("gheLiveAgentDialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "gheLiveAgentDialog";
    dialog.className = "ghe-live-agent-dialog";
    dialog.setAttribute("aria-label", "Fiche professionnelle simplifiée");
    dialog.innerHTML = '<div class="ghe-live-agent-sheet"><header><strong>' +
      esc(agentName(agent)) + '</strong><button type="button" data-live-agent-close aria-label="Fermer">×</button></header>' +
      '<div class="ghe-live-agent-shift ' + liveShiftClass(code) + '"><b>' + esc(code) +
      '</b><span>' + esc(time) + '</span></div>' +
      (canCall ? '<button type="button" data-live-agent-call class="ghe-live-agent-call">☎ Appeler ce collègue</button>' : '') +
      '</div>';
    document.body.appendChild(dialog);
    dialog.addEventListener("click", e => {
      if (e.target === dialog || e.target.closest("[data-live-agent-close]")) dialog.close();
    });
    dialog.querySelector("[data-live-agent-call]")?.addEventListener("click", async () => {
      dialog.close();
      if (!window.STIPDutyChiefs?.openCallChoice) {
        try { await window.STIPLoad?.script?.("home-duty-chief.js"); }
        catch { return; }
      }
      window.STIPDutyChiefs?.openCallChoice?.(tel, agentName(agent));
    });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function homeAvatar() {
    const a = state.session?.agent || state.boot?.agent || {};
    const initials = String((a.prenom?.[0] || "") + (a.nom?.[0] || "")).toUpperCase() || "G";
    const image = String(window.STIPAgentSelector?.photoUrl?.(a) ||
      a.profile_photo_url || a.avatar_url ||
      state.boot?.media?.avatars?.[a.source_key] || "");
    return '<button type="button" class="ghe-home-mini-avatar" data-shortcuts-open ' +
      'aria-label="Ouvrir les raccourcis du profil">' +
      (image && /^https:\/\//i.test(image)
        ? '<img src="' + esc(image) + '" alt="" loading="lazy">'
        : '<span aria-hidden="true">' + esc(initials) + '</span>') +
      '</button>';
  }
  function homeModeNav(part = "all") {
    const agent = state.session?.agent || state.boot?.agent || {};
    const first = cap(String(agent.prenom || "").trim()) || "GHE";
    const count = notifications().length;
    const tools = '<div class="hc-home-top-tools ghe-home-topbar">' +
      homeAvatar() +
      '<span class="ghe-home-paint-name" title="' + esc(first) + '">' + esc(first) + '</span>' +
      '<span class="ghe-home-tools-right">' +
        tDoorShortcut() +
        '<span class="hc-home-wheelchair-slot">' + wheelchairShortcut() + '</span>' +
        '<button type="button" class="hc-profile-bell ghe-home-bell" data-bell-open aria-haspopup="dialog" aria-controls="hcBellDialog" aria-label="Ouvrir les notifications' +
          (count ? ' : ' + count + ' à consulter' : '') + '"><span aria-hidden="true">🔔</span>' +
          (count ? '<b>' + count + '</b>' : '') + '</button>' +
      '</span></div>';
    const identity = '<div class="hc-home-meta-date hc-calendar-driven-planning hc-home-standalone-date">' +
      todayFullDateSeparator() + '</div>' +
      '<div class="ghe-home-shortcuts-row">' + shortcutsLauncher() + '</div>';
    const wrapper = part === "tools" ? " hc-home-tools-only" : part === "identity" ? " hc-home-identity-only" : "";
    return '<section class="hc-home-top-nav ghe-home-clean-header' + wrapper + '" data-header-compact>' +
      (part === "identity" ? "" : tools) + (part === "tools" ? "" : identity) + '</section>';
  }

  function shortcutsLauncher() {
    const role = pilotageRoleKey(),
      content = pilotageBlock(),
      label =
        {
          admin: "Raccourcis",
          cadre: "Cadre",
          responsable: "Responsable",
          agent: "Agent",
          stagiaire: "Stagiaire",
          metiers: "Autres métiers",
        }[role] || "Raccourcis";
    if (!content) return "";
    return `<div class="hc-admin-shortcuts-launcher-wrap hc-header-shortcuts-wrap">
      <button type="button" class="hc-admin-shortcuts-launcher hc-header-shortcuts" data-shortcuts-open aria-haspopup="dialog" aria-controls="hcShortcutsDialog" aria-label="Ouvrir les raccourcis ${esc(label)}">
        <small>${role === "admin" ? "ACCÈS" : "PROFIL"}</small><strong>Raccourcis</strong><span class="hc-admin-shortcuts-launcher-arrow" aria-hidden="true">›</span>
      </button>
    </div>`;
  }

  function shortcutsPopup() {
    const role = pilotageRoleKey(),
      content = pilotageBlock(),
      roleLabel =
        {
          admin: "ADMIN",
          cadre: "CADRE",
          responsable: "RESPONSABLE",
          agent: "AGENT",
          stagiaire: "STAGIAIRE",
          metiers: "AUTRES MÉTIERS",
        }[role] || "STIP";
    if (!content) return "";
    return `<dialog id="hcShortcutsDialog" class="hc-admin-shortcuts-dialog" aria-labelledby="hcShortcutsTitle">
      <section class="hc-admin-shortcuts-card">
        <header class="hc-admin-shortcuts-head">
          <div><small>${esc(roleLabel)}</small><h2 id="hcShortcutsTitle">Raccourcis</h2></div>
          <button type="button" class="hc-admin-shortcuts-close" data-shortcuts-close aria-label="Fermer">×</button>
        </header>
        <div class="hc-admin-shortcuts-body">${content}</div>
      </section>
    </dialog>`;
  }

  function homeAIEntry() {
    if (!(has("dialog") || has("assistant_enabled"))) return "";
    return `<button type="button" class="hc-home-ai-footer" data-dialog-home aria-label="Ouvrir STIP IA"><span class="hc-home-ai-footer-art">${ICON.homeAI}</span><strong>STIP IA</strong></button>`;
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
  function noteIsNetworkError(n = {}) {
    const s = `${n.title || ""} ${n.body || ""} ${n.technical_error || ""}`.toLowerCase();
    return !!n.retryable || /failed to fetch|networkerror|network error|load failed|indisponible/.test(s);
  }
  function friendlyNoteBody(n = {}) {
    if (noteIsNetworkError(n)) {
      if (noteCategory(n) === "access")
        return "STIP n’a pas pu vérifier les accès. Vous pouvez relancer le contrôle.";
      return "STIP n’a pas réussi à récupérer cette information. Vous pouvez réessayer.";
    }
    return String(n.body || n.summary || n.description || "").trim();
  }
  function noteTimeValue(n = {}) {
    return (
      n.created_at ||
      n.occurred_at ||
      n.createdAt ||
      n.sent_at ||
      n.date ||
      n.updated_at ||
      ""
    );
  }
  function formatNotificationTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      }).format(d);
    } catch {
      return d.toLocaleString("fr-FR");
    }
  }
  function sinceNotification(n = {}) {
    const value = noteTimeValue(n);
    if (!value) return "Date non fournie";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return formatNotificationTime(value);
    const ms = Date.now() - d.getTime();
    const abs = Math.max(0, ms);
    let rel = "";
    if (abs < 60000) rel = "À l’instant";
    else if (abs < 3600000) rel = `Depuis ${Math.floor(abs / 60000)} min`;
    else if (abs < 86400000) {
      const h = Math.floor(abs / 3600000),
        m = Math.floor((abs % 3600000) / 60000);
      rel = `Depuis ${h} h${m ? ` ${m} min` : ""}`;
    } else {
      const days = Math.floor(abs / 86400000);
      rel = `Depuis ${days} jour${days > 1 ? "s" : ""}`;
    }
    return `${rel} · ${formatNotificationTime(value)}`;
  }
  function noteStatus(n = {}) {
    if (noteIsNetworkError(n)) return "Indisponible";
    const raw = String(n.status || n.statut || "").toLowerCase();
    if (!raw || /pending|waiting|open|todo|à traiter|a traiter/.test(raw))
      return "À traiter";
    if (/done|resolved|complete|trait|valid/.test(raw)) return "Résolu";
    if (/reject|refus|cancel|annul/.test(raw)) return "Clos";
    if (/error|erreur|fail/.test(raw)) return "Erreur";
    return cap(raw.replace(/[_-]+/g, " "));
  }
  function noteReason(n = {}) {
    const cat = noteCategory(n);
    if (n.type === "agenda_alert" || n.source_type === "agenda_alert") {
      const reasons = Array.isArray(n.metadata?.reasons) ? n.metadata.reasons.filter(Boolean) : [];
      if (reasons.length) return reasons.join(" · ");
      return "STIP vous rappelle automatiquement cet événement futur pour éviter qu’il soit manqué.";
    }
    if (noteIsNetworkError(n) && cat === "access")
      return "Le contrôle automatique des accès n’a pas obtenu de réponse. Cette notification sert à vous signaler que la vérification n’a pas abouti.";
    if (n.source === "admin-access")
      return "Une demande ou un contrôle d’accès nécessite une décision ou une vérification.";
    if (n.action_id)
      return "Une action STIP est encore en attente et nécessite votre intervention.";
    if (cat === "signatures")
      return "Une signature attendue n’est pas encore finalisée.";
    if (cat === "reminders")
      return "Un rappel est arrivé à échéance ou demande votre attention.";
    if (cat === "agenda")
      return "Un élément lié au planning ou à l’agenda nécessite votre attention.";
    if (cat === "access")
      return "Un élément lié aux accès STIP nécessite votre attention.";
    return "Cette information a été placée dans la Cloche STIP parce qu’elle demande votre attention.";
  }
  function noteSubject(n = {}) {
    const cat = noteCategory(n);
    if (n.request_id) return "Demande d’accès";
    if (n.security_index != null) return "Contrôle d’accès";
    return (
      {
        access: "Accès STIP",
        signatures: "Signature",
        reminders: "Rappel",
        agenda: "Planning / agenda",
        other: "Information STIP",
      }[cat] || "Information STIP"
    );
  }
  function noteParty(n = {}) {
    const direct =
      n.recipient_name ||
      n.assignee_name ||
      n.target_name ||
      n.contact_name ||
      n.person_name ||
      n.metadata?.recipient_name ||
      n.metadata?.assignee_name ||
      n.metadata?.target_name ||
      n.metadata?.recipient ||
      "";
    if (String(direct).trim()) return String(direct).trim();
    const body = String(n.body || "");
    const m = body.match(/\bà\s+([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\s+[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,2})(?:[.,]|$)/);
    return m?.[1]?.trim() || "";
  }
  function noteCanManage(n = {}) {
    return !!((n?.source && n.source !== "stip") || n?.action_id);
  }
  function notePrimaryLabel(n = {}) {
    if (noteIsNetworkError(n) || n.retryable) return "Réessayer";
    if (n.source === "admin-access" && (n.request_id || n.security_index != null))
      return "Prendre en charge";
    if (n.action_id) return "Ouvrir la demande";
    return "Gérer";
  }
  function noteEventRows(n = {}) {
    const rows = [],
      add = (title, body = "", at = "") => {
        const key = `${title}|${body}|${at}`;
        if (!rows.some((x) => x.key === key))
          rows.push({ key, title, body, at });
      },
      raw = [
        ...(Array.isArray(n.timeline) ? n.timeline : []),
        ...(Array.isArray(n.history) ? n.history : []),
        ...(Array.isArray(n.events) ? n.events : []),
        ...(Array.isArray(n.metadata?.timeline) ? n.metadata.timeline : []),
        ...(Array.isArray(n.metadata?.history) ? n.metadata.history : []),
        ...(Array.isArray(n.metadata?.events) ? n.metadata.events : []),
      ];
    raw.forEach((x) => {
      if (typeof x === "string") add(x);
      else if (x && typeof x === "object")
        add(
          x.title || x.label || x.action || x.status || "Mise à jour",
          x.body || x.message || x.detail || "",
          x.created_at || x.occurred_at || x.date || x.at || "",
        );
    });
    const created = n.created_at || n.occurred_at || n.createdAt || n.sent_at || "";
    const updated = n.updated_at || n.updatedAt || "";
    if (created) add("Notification créée", "", created);
    if (updated && String(updated) !== String(created))
      add("Dernière mise à jour", "", updated);
    if (!rows.length) add("État actuel", noteStatus(n));
    return rows.slice(0, 12);
  }
  function noteMessageRows(n = {}) {
    const raw = [
      ...(Array.isArray(n.messages) ? n.messages : []),
      ...(Array.isArray(n.communications) ? n.communications : []),
      ...(Array.isArray(n.exchanges) ? n.exchanges : []),
      ...(Array.isArray(n.metadata?.messages) ? n.metadata.messages : []),
      ...(Array.isArray(n.metadata?.communications) ? n.metadata.communications : []),
    ];
    if (typeof n.communication === "string" && n.communication.trim())
      raw.push(n.communication);
    return raw
      .map((x) => {
        if (typeof x === "string") return { who: "", text: x, at: "" };
        if (!x || typeof x !== "object") return null;
        return {
          who: x.author || x.sender || x.from || x.name || "",
          text: x.body || x.message || x.text || x.content || "",
          at: x.created_at || x.sent_at || x.date || x.at || "",
        };
      })
      .filter((x) => x && x.text)
      .slice(0, 12);
  }
  function actionCenterMarkup(filter = state.actionFilter, inline = false) {
    const { ns, cats, counts, shown } = actionCenterData(filter),
      visibleCats = cats.filter(([k]) => k === "all" || counts[k] > 0),
      filterBar = ns.length
        ? '<div class="hc-action-filters stip-action-filters" role="tablist" aria-label="Catégories à traiter">' +
          visibleCats
            .map(
              ([k, l]) =>
                '<button type="button" role="tab" aria-selected="' +
                (filter === k) +
                '" data-action-filter="' +
                esc(k) +
                '">' +
                esc(l) +
                (counts[k] ? ' <span>' + counts[k] + "</span>" : "") +
                "</button>",
            )
            .join("") +
          "</div>"
        : "",
      head = inline
        ? `<header class="hc-profile-actions-head"><div><span class="stip-kicker">À TRAITER</span><h2>${ns.length ? "Notifications" : "Rien à traiter"}</h2><p>${ns.length ? `${ns.length} élément${ns.length > 1 ? "s" : ""} demande${ns.length > 1 ? "nt" : ""} votre attention.` : "Aucune notification en attente."}</p></div></header>`
        : "";
    if (!ns.length) return head;
    const cards = shown.length
      ? '<div class="hc-panel-list">' +
        shown
          .map((n, i) => {
            const cat = noteCategory(n),
              catLabel = cats.find((x) => x[0] === cat)?.[1] || "Autres",
              body = friendlyNoteBody(n);
            return (
              '<button type="button" class="hs-note hc-note-card" data-note-index="' +
              i +
              '" data-note-open><small>' +
              esc(catLabel) +
              "</small><strong>" +
              esc(n.title || "Notification") +
              "</strong>" +
              (body ? "<p>" + esc(body) + "</p>" : "") +
              "</button>"
            );
          })
          .join("") +
        "</div>"
      : '<div class="hc-empty">Rien à traiter dans cette catégorie.</div>';
    return head + filterBar + cards;
  }
  function bigConfirm({ title, body = "", confirmLabel = "Confirmer" } = {}) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "hc-confirm-backdrop";
      wrap.innerHTML =
        '<section class="hc-confirm-pop" role="dialog" aria-modal="true"><h3>' +
        esc(title || "Confirmer ?") +
        "</h3>" +
        (body ? "<p>" + esc(body) + "</p>" : "") +
        '<div class="hc-confirm-actions"><button type="button" data-confirm-no><span>❌</span><strong>Annuler</strong></button><button type="button" class="is-confirm" data-confirm-yes><span>✔</span><strong>' +
        esc(confirmLabel) +
        "</strong></button></div></section>";
      (document.querySelector("#hcBellDialog[open]") || document.body).appendChild(wrap);
      const done = (v) => {
        wrap.remove();
        resolve(v);
      };
      wrap.querySelector("[data-confirm-no]").onclick = () => done(false);
      wrap.querySelector("[data-confirm-yes]").onclick = () => done(true);
      wrap.addEventListener("click", (e) => {
        if (e.target === wrap) done(false);
      });
    });
  }
  function openNotificationDetail(n, options = {}) {
    document.getElementById("hcNotificationDetail")?.remove();
    if (n?.source === "stip" && n?.id && !n?.read_at) {
      n.read_at = new Date().toISOString();
      call(ACTION_API, "read_notification", { notification_id: n.id }).catch(() => {});
    }
    const cat = noteCategory(n),
      { cats } = actionCenterData(),
      catLabel = cats.find((x) => x[0] === cat)?.[1] || "Autres",
      manageable = noteCanManage(n),
      body = friendlyNoteBody(n),
      status = noteStatus(n),
      since = sinceNotification(n),
      subject = noteSubject(n),
      party = noteParty(n) || "Non précisé dans la notification",
      timeline = noteEventRows(n),
      messages = noteMessageRows(n),
      technical = String(n.technical_error || (noteIsNetworkError(n) ? n.body || "" : "")).trim();
    const timelineHtml = timeline
        .map(
          (x) =>
            `<li><span></span><div><strong>${esc(x.title)}</strong>${x.body ? `<p>${esc(x.body)}</p>` : ""}${x.at ? `<small>${esc(formatNotificationTime(x.at))}</small>` : ""}</div></li>`,
        )
        .join(""),
      messagesHtml = messages.length
        ? messages
            .map(
              (x) =>
                `<article><div><strong>${esc(x.who || "Échange")}</strong>${x.at ? `<small>${esc(formatNotificationTime(x.at))}</small>` : ""}</div><p>${esc(x.text)}</p></article>`,
            )
            .join("")
        : '<p class="hc-detail-empty">Aucun échange rattaché à cette notification.</p>';
    const page = document.createElement("section");
    page.id = "hcNotificationDetail";
    page.className = "hc-notification-detail";
    page.innerHTML = `<header><button type="button" data-detail-close aria-label="Retour">‹</button><div><small>CLOCHE STIP</small><strong>${esc(catLabel)}</strong></div><span></span></header><main>
      <section class="hc-detail-hero">
        <div class="hc-detail-pills"><span class="hc-detail-category">${esc(catLabel)}</span><span class="hc-detail-status">${esc(status)}</span></div>
        <h2>${esc(n.title || "Notification")}</h2>
        ${body ? `<p>${esc(body)}</p>` : ""}
      </section>
      <section class="hc-detail-facts" aria-label="Résumé de la notification">
        <article><small>ÉTAT ACTUEL</small><strong>${esc(status)}</strong></article>
        <article><small>DEPUIS</small><strong>${esc(since)}</strong></article>
        <article><small>CONCERNANT</small><strong>${esc(subject)}</strong></article>
        <article><small>AVEC QUI</small><strong>${esc(party)}</strong></article>
      </section>
      <section class="hc-detail-section"><small>POURQUOI</small><h3>Pourquoi cette notification ?</h3><p>${esc(noteReason(n))}</p></section>
      <section class="hc-detail-section"><small>SUIVI</small><h3>Historique</h3><ol class="hc-detail-timeline">${timelineHtml}</ol></section>
      <section class="hc-detail-section"><small>COMMUNICATION</small><h3>Échanges liés</h3><div class="hc-detail-messages">${messagesHtml}</div></section>
      ${technical ? `<details class="hc-detail-technical"><summary>Détails techniques</summary><code>${esc(technical)}</code></details>` : ""}
      <div class="hc-detail-actions">
        ${
          manageable
            ? `<button type="button" class="primary" data-detail-manage>${esc(notePrimaryLabel(n))}</button>`
            : '<button type="button" class="primary" data-detail-done>Marquer comme traité</button>'
        }
        <button type="button" class="danger" data-detail-delete>Supprimer</button>
      </div>
    </main>`;
    (options.bellHost || document.body).appendChild(page);
    const close = () => { page.remove(); options.onClose?.(); };
    page.querySelector("[data-detail-close]").onclick = close;
    page.querySelector("[data-detail-manage]")?.addEventListener("click", () => {
      close();
      if (n?.source && n.source !== "stip") {
        // Une fenêtre externe à la cloche doit rester visible (top layer libérée).
        if (options.bellHost) document.getElementById("hcBellDialog")?.close();
        window.dispatchEvent(
          new CustomEvent("stip:action-center-open", { detail: n }),
        );
      } else if (n?.action_id) {
        if (options.bellHost) {
          const dialog = document.getElementById("hcBellDialog");
          if (dialog) dialog.querySelector("#hcBellTitle").textContent = "Demande";
          openAction(n.action_id, options.bellHost);
        } else {
          panel(true, "À traiter");
          openAction(n.action_id);
        }
      }
    });
    page.querySelector("[data-detail-done]")?.addEventListener("click", () => {
      dismissActionNote(n);
      close();
    });
    page.querySelector("[data-detail-delete]").onclick = async () => {
      const ok = await bigConfirm({
        title: "Supprimer cette notification ?",
        body: "Elle disparaîtra de votre Cloche STIP.",
        confirmLabel: "Confirmer",
      });
      if (!ok) return;
      dismissActionNote(n);
      close();
    };
    if (options.focusAction)
      requestAnimationFrame(() =>
        page
          .querySelector("[data-detail-manage],[data-detail-done]")
          ?.focus({ preventScroll: false }),
      );
    return page;
  }
  function bindNoteCard(card, note) {
    if (!card || card.dataset.stipClickBound === "1") return;
    card.dataset.stipClickBound = "1";
    card.addEventListener("click", (event) => {
      const interactive = event.target.closest?.(
        "button,a,input,textarea,label,select",
      );
      if (interactive && interactive !== card && card.contains(interactive)) return;
      if (card.closest("#hcBellDialog")) {
        openBellItem(note);
        return;
      }
      // Une invitation ou proposition ouvre directement le pop-up de dates.
      // Aucun doublon de rendez-vous n'est affiché sur l'accueil.
      if (note?.source === "leisure" && note?.event_id) {
        window.STIPLeisure?.openPreview?.(String(note.event_id));
        return;
      }
      openNotificationDetail(note);
    });
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
    scope.querySelectorAll(".hc-note-card[data-note-index]").forEach((card) => {
      const n = shown[Number(card.dataset.noteIndex)];
      if (n) bindNoteCard(card, n);
    });
  }
  function renderProfileActions(filter = state.actionFilter) {
    const host = $("#hcProfileActions");
    if (!host) return;
    state.actionFilter = filter;
    host.innerHTML = actionCenterMarkup(filter, true);
    bindActionCenter(host, filter, true);
  }

  function notificationsPane() {
    const empty = notifications().length === 0;
    return `<section class="hc-home-pane hc-home-pane-notifications"><section id="hcProfileActions" class="hc-profile-actions stip-action-surface${empty ? " is-empty" : ""}">${actionCenterMarkup(state.actionFilter, true)}</section><section id="hcCommunicationHub" class="hc-communication-host" aria-live="polite"></section></section>`;
  }

  function planningCalendarPocket() {
    if (!has("calendar_subscribe")) return "";
    const personal = has("planning_personal");
    const team = has("planning_team");
    if (!personal && !team) return "";
    return '<details class="stip-option-pocket" data-stip-option="calendar-unified"><summary class="stip-option-summary"><span aria-hidden="true">⋯</span> Options du planning</summary><div class="stip-option-pocket-body">' +
      (personal ? '<button class="stip-option-action" type="button" data-home-calendar-subscribe><span aria-hidden="true">📅</span><strong>S’abonner à mon planning</strong><small>Synchronisation avec le calendrier du téléphone</small><b aria-hidden="true">›</b></button>' : '') +
      (team ? '<button class="stip-option-action" type="button" data-thf-team-subscribe><span aria-hidden="true">👥</span><strong>S’abonner au calendrier équipe</strong><small>Synchronisation avec le calendrier du téléphone</small><b aria-hidden="true">›</b></button>' : '') +
      '</div></details>';
  }

  function planningCompareShortcut() {
    if (!(has("planning_personal") && has("planning_team"))) return "";
    return `<div class="hc-profile-responsable-row hc-planning-compare-row"><button type="button" class="hc-responsable-tab" data-app="compare" aria-label="Comparer mon planning avec un agent"><span>Comparer mon planning</span><b aria-hidden="true">›</b></button></div>`;
  }

  function wheelchairShortcut() {
    if (!has("messages")) return "";
    const active = state.homeMode === "communication" && state.communicationTab === "wheelchair";
    return `<button type="button" class="hc-wheelchair-shortcut${active ? " active" : ""}" data-home-mode="tableau" aria-pressed="${active}" aria-label="Ouvrir Fauteuils"><span class="hc-wheelchair-shortcut-icon">${ICON.homeChair}</span><span class="hc-wheelchair-shortcut-copy"><strong>Fauteuils<span class="hc-home-live-badge" data-wheelchair-count hidden></span></strong></span><span class="hc-wheelchair-shortcut-arrow" aria-hidden="true">›</span></button>`;
  }

  function tDoorShortcut() {
    if (!has("admin")) return "";
    return '<button type="button" class="hc-t-door" data-t-door aria-label="Ouvrir la porte T"><span class="hc-t-door-mark" aria-hidden="true"></span></button>';
  }

  function mobileAppShortcut() {
    return `<section class="hc-pilotage-shell" aria-label="Application mobile GHE"><div class="hc-pilotage-links"><a class="hc-pilotage-link" href="application-mobile.html" aria-label="Ouvrir la page de l’application GHE"><span class="hc-pilotage-link-icon" aria-hidden="true">📱</span><strong>Application GHE</strong><b aria-hidden="true">›</b></a></div></section>`;
  }

  function leNouveauHomeCard() {
    return `<a class="hc-nouveau-tv" href="le-nouveau.html?v=20261006-dudy1" aria-label="Ouvrir Divertissement et Dudy"><span class="hc-nouveau-tv-screen" aria-hidden="true"><span class="hc-nouveau-tv-live">● DIMANCHE</span><span class="hc-nouveau-tv-person">D</span><span class="hc-nouveau-tv-play">▶</span></span><span class="hc-nouveau-tv-copy"><small>DIVERTISSEMENT</small><strong>Dudy au GHE</strong><span>Épisode · Dis-le à Dudy · décisions de la communauté</span></span><b aria-hidden="true">›</b></a>`;
  }


  // Un rendez-vous est visible sous sa date, puis dans le récapitulatif de la semaine.
  // Source unique : futureItems(), déjà dédupliqué et partagé par l'agenda.
  function homeDayAppointments(day, heading) {
    const items = futureItems().filter((x) => {
      const from = String(x.date || "").slice(0, 10);
      const until = String(x.endDate || x.end_date || x.date || "").slice(0, 10);
      return Boolean(from && until && from <= day && until >= day);
    });
    if (!items.length) return "";
    const top = items.slice(0, 3).map((x) => {
      const time = String(x.time || "").trim(),
        place = String(x.place || "").trim(),
        kind = futureTypeKey(x);
      return '<button type="button" class="hc-week-event-key-item hc-week-event-day-row type-' + esc(kind) +
        '" data-widget-open="future" data-future-id="' + esc(x.id) +
        '"><span class="hc-week-event-key-icon" aria-hidden="true">' + eventIconHtml(x, "hc-event-svg") +
        '</span><span class="hc-week-event-copy"><strong>' + esc(x.title) +
        '</strong><span class="hc-week-event-when">' +
        (time ? '<b class="hc-week-event-time">' + esc(time) + '</b>' : '') +
        (place ? '<span class="hc-week-event-place">' + esc(place) + '</span>' : '') +
        '</span></span><span class="hc-week-event-chevron" aria-hidden="true">›</span></button>';
    }).join("");
    const extra = items.length > 3 ?
      '<button type="button" class="hc-day-appointments-more" data-widget-open="future">Voir les ' +
      (items.length - 3) + ' autres rendez-vous ›</button>' : "";
    return '<section class="hc-day-appointments hc-widget-future" aria-label="Rendez-vous ' + esc(heading) +
      '"><div class="hc-planning-period-separator stip-section-separator is-compact"><span>RENDEZ-VOUS · ' +
      esc(heading.toUpperCase()) + '</span><strong>' + items.length + '</strong></div>' +
      '<div class="hc-week-event-key-list">' + top + extra + '</div></section>';
  }

  function weekContextMarkup() {
    const weeklyDetails = futureWidget();
    return `${planningWeekSeparator()}<section class="hc-planning-subblock hc-planning-week-subblock">${weekWidget()}</section>${weeklyDetails ? `<div class="stip-context-attached-separator stip-section-separator hc-selected-day-separator" aria-hidden="true"><span>RENDEZ-VOUS · SEMAINE</span></div><section class="stip-context-attached hc-planning-details-subblock">${weeklyDetails}</section>` : ""}${window.STIPLeisure?.weekHTML?.(navigationWeek()[0]?.iso, navigationWeek()[navigationWeek().length - 1]?.iso) || ""}`;
  }
  function monthContextMarkup() {
    const monthDetails = monthEventsWidget();
    return `<div class="hc-planning-period-separator hc-planning-month-separator stip-section-separator" aria-hidden="true"><span>AU MOIS</span></div><section class="hc-planning-subblock hc-planning-month-subblock">${planningCalendarOverview()}${planningCompareShortcut()}</section>${monthDetails ? `<div class="stip-context-attached-separator stip-section-separator hc-planning-month-events-separator" aria-hidden="true"><span>À RETENIR CE MOIS</span></div><section class="stip-context-attached hc-planning-details-subblock hc-planning-month-events-subblock">${monthDetails}</section>` : ""}${window.STIPLeisure?.monthHTML?.(state.dateJumpMonth || navigationWeek()[0]?.iso?.slice(0,7) || parisIso().slice(0,7)) || ""}`;
  }
  // Separateurs natifs du site, sans ajouter de cartes ou dupliquer le contenu.
  function homeTimelineSeparator(label,kind) {
    return `<div class="stip-section-separator hc-home-timeline-separator hc-home-separator-${esc(kind)}" role="separator" aria-label="${esc(label)}"><span>${esc(label)}</span></div>`;
  }

  function homeModeBody() {
    if (state.homeMode === "notifications") return notificationsPane();
    if (state.homeMode === "apps")
      return `<section class="hc-home-pane hc-home-pane-apps"><section id="hcMyAppsHost"></section></section>`;
    if (state.homeMode === "communication" && has("messages"))
      return `<section class="hc-home-pane hc-home-pane-communication"><section id="hcCommunicationAppHost"></section></section>`;
    const legend = fixedShiftLegend();
    return `<main class="hc-widget-zone hc-home-pane hc-home-pane-planning hc-home-timeline">${homeModeNav("tools")}<span id="hcTopPriorityAnchor" hidden aria-hidden="true"></span>${homeModeNav("identity")}<div class="ghe-live-wide-host">${liveCardMarkup()}</div><div class="hc-days-grid" aria-label="Aujourd’hui et demain"><section class="hc-day-column" aria-label="Aujourd’hui">${has("planning_personal") || has("planning_team") ? '<section id="hcTeamFusion" class="hc-team-fusion hc-team-compact" aria-label="Résumé aujourd’hui"></section>' : ""}${homeDayAppointments(parisIso(), "Aujourd’hui")}</section><section class="hc-day-column" aria-label="Demain">${has("planning_personal") || has("planning_team") ? '<section id="hcTomorrowFusion" class="hc-team-fusion hc-team-compact hc-tomorrow-fusion" aria-label="Résumé demain"></section>' : ""}${homeDayAppointments(dateIsoLocal(new Date(dateObj(parisIso()).getTime() + 86400000)), "Demain")}</section></div>${window.STIPMeeting?.pendingHTML?.() || ""}<section class="hc-planning-group hc-planning-landscape hc-calendar-driven-planning"><section class="stip-context-master hc-week-context-master" data-stip-context-master="week">${weekContextMarkup()}</section>${agendaAlertBanner()}<section id="homeDutyChiefNowHost" class="home-duty-chief-host hc-home-duty-chief-lower" aria-label="Chef d’équipe présent"></section><section class="stip-context-master hc-month-context-master" data-stip-context-master="month">${monthContextMarkup()}</section>${legend ? `<div class="stip-section-separator hc-planning-legend-separator" aria-hidden="true"><span>LÉGENDE</span></div><section class="hc-planning-subblock hc-planning-legend-subblock">${legend}</section>` : ""}${planningCalendarPocket()}</section>${exchangeWidget()}${genericWidgets()}${leNouveauHomeCard()}${mobileAppShortcut()}</main>${homeAIEntry()}`;
  }
  // Le moteur des retours charge ses données après l'accueil. Ramener ses cartes
  // sous la barre Cloche/T/Fauteuils, même si un ancien module les déplace.
  let feedbackPriorityObserver = null;
  function keepHomeFeedbackPriority(root) {
    feedbackPriorityObserver?.disconnect();
    feedbackPriorityObserver = null;
    const timeline = root.querySelector(".hc-home-timeline");
    const anchor = timeline?.querySelector("#hcTopPriorityAnchor");
    if (!timeline || !anchor) return;
    const align = () => {
      const followUps = document.getElementById("hcEventFeedbackHost");
      if (!followUps || !followUps.isConnected) return;
      if (followUps.parentElement !== anchor.parentElement ||
          anchor.nextElementSibling !== followUps) {
        anchor.insertAdjacentElement("afterend", followUps);
      }
    };
    feedbackPriorityObserver = new MutationObserver(align);
    feedbackPriorityObserver.observe(timeline, { childList: true, subtree: true });
    align();
  }

  // The weekly strip has one stable parent and manages its own delegated
  // clicks. Navigation never reconstructs unrelated cards or moves the scroll.
  function renderWeekContext() {
    const week = document.querySelector("#homeView .hc-week-context-master");
    if (!week) return;
    week.innerHTML = weekContextMarkup();
  }
  function bindWeekContext(week) {
    week?.addEventListener("click", (event) => {
      const target = event.target;
      const weekArrow = target.closest("[data-week-step]");
      const thisWeek = target.closest("[data-week-today]");
      const day = target.closest("[data-home-day]");
      if (weekArrow || thisWeek || day) {
        if (planningLoading()) return;
        if (weekArrow) return moveWeek(weekArrow.dataset.weekStep);
        if (thisWeek) return resetWeekToCurrent({ render: true });
        if (!day || day.disabled) return;
        const iso = String(day.dataset.homeDay || "").slice(0, 10);
        if (!iso) return;
        if (window.STIPLeaveCart?.isSelecting?.()) {
          window.STIPLeaveCart.toggle(iso, planningRowForDate(iso)?.code || "");
          return;
        }
        const showDetail = day.classList.contains("stip-week-day") &&
          Boolean(planningRowForDate(iso));
        selectWeekDay(iso);
        if (showDetail) openShiftDetail(iso);
        return;
      }
      const widget = target.closest("[data-widget-open]");
      if (widget) openWidget(widget.dataset.widgetOpen, widget.dataset.futureId || "");
    });
  }
  // Month navigation can rebuild this month alone without remounting home or week.
  function renderMonthContext() {
    const month = document.querySelector(".hc-month-context-master");
    if (!month) return;
    month.innerHTML = monthContextMarkup();
    const panel = month.querySelector("[data-date-jump-panel]");
    renderDateJumpCalendar(panel, state.dateJumpMonth);
    window.STIPMonthTable?.enhanceCalendar?.(panel);
    const legend = document.querySelector(".hc-planning-legend-subblock");
    if (legend) legend.innerHTML = fixedShiftLegend();
  }
  async function openMonthCalendarSubscription() {
    try {
      if (!window.STIPCalendars?.quick)
        await window.STIPLoad?.script?.("calendar-subscriptions.js");
      window.STIPCalendars?.quick?.("personal");
    } catch {}
  }
  function bindMonthContext(month) {
    month?.addEventListener("click", (event) => {
      const step = event.target.closest("[data-cal-step]");
      const day = event.target.closest("[data-cal-day]");
      if ((step || day) && planningLoading()) return;
      if (step) return moveCalendarMonth(step.dataset.calStep);
      if (day) {
        const iso = String(day.dataset.calDay || "").slice(0, 10);
        if (!iso) return;
        if (window.STIPLeaveCart?.isSelecting?.()) {
          window.STIPLeaveCart.toggle(iso, planningRowForDate(iso)?.code || "");
          return;
        }
        selectMonthDay(iso);
        if (planningRowForDate(iso)) openShiftDetail(iso);
        return;
      }
      const app = event.target.closest("[data-app]");
      if (app) return openApp(app.dataset.app);
      const widget = event.target.closest("[data-widget-open]");
      if (widget) return openWidget(widget.dataset.widgetOpen, widget.dataset.futureId || "");
      if (event.target.closest("[data-home-calendar-subscribe]"))
        openMonthCalendarSubscription();
    });
  }
  function render() {
    const root = $("#homeView .hs-home");
    if (!root || !state.boot) return;

    // Communication owns live composers. Background refreshes must not
    // replace its DOM while the user is typing or switching tabs.
    if (
      state.homeMode === "communication" &&
      has("messages") &&
      root.querySelector("#hcCommunicationAppHost [data-communication-app]")
    ) {
      return;
    }

    const isCommunication = state.homeMode === "communication" && has("messages"),
      showProfile = state.homeMode === "planning";
    let markup = `${state.homeMode === "planning" ? "" : homeModeNav()}${shortcutsPopup()}<section class="hc-home-mode-content" data-home-mode-current="${esc(state.homeMode)}">${homeModeBody()}</section>`;
    if (isCommunication) {
      markup = `<section class="hc-communication-standalone" aria-label="Communication STIP">
          ${homeModeBody()}
        </section>`;
    }
    if (state.renderSig === markup && root.childElementCount) return;
    const onHome = (window.STIPRouter?.get?.() || "home") === "home",
      y = onHome ? Math.max(0, window.scrollY || 0) : 0;
    state.renderSig = markup;
    root.innerHTML = markup;
    keepHomeFeedbackPriority(root);
    const sharedTeamOptions = {
      personal: state.boot?.personal || [],
      permissions: perms(),
      sourceKey: String(state.session?.agent?.source_key || state.boot?.agent?.source_key || window.STIPSession?.agent?.source_key || ""),
      ghe: String(state.session?.agent?.ghe || state.boot?.agent?.ghe || window.STIPSession?.agent?.ghe || ""),
      boot: state.boot,
    };
    window.STIPTeamFusion?.mount?.({ ...sharedTeamOptions, hostId: "hcTeamFusion", day: parisIso() });
    const tomorrowDate = dateObj(parisIso());
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    window.STIPTeamFusion?.mount?.({ ...sharedTeamOptions, hostId: "hcTomorrowFusion", day: dateIsoLocal(tomorrowDate) });
    window.STIPDutyChiefs?.render?.();
    window.STIPDutyChiefs?.ensure?.();
    root
      .querySelectorAll("[data-copy]")
      .forEach(
        (b) => (b.onclick = () => copyText(b.dataset.copy, b.dataset.label)),
      );
    root.querySelectorAll("[data-alert-open]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = String(button.dataset.alertOpen || "");
        const note = notifications().find((n) => String(n.metadata?.alert_key || n.id || "") === key);
        if (note) openNotificationDetail(note, { focusAction: true });
      });
    });
    root
      .querySelector("[data-profile-person-search]")
      ?.addEventListener("click", () => openHeaderDirectorySearch("first"));
    root
      .querySelector("[data-header-ghe-search]")
      ?.addEventListener("click", () => openHeaderDirectorySearch("ghe"));
    root
      .querySelector("[data-header-date-search]")
      ?.addEventListener("click", openHeaderDateSearch);
    root.querySelector(".ghe-live-wide-host")?.addEventListener("click", event => {
      const person = event.target.closest("[data-live-agent]");
      if (person) { openLiveAgent(person.dataset.liveAgent); return; }
      if (event.target.closest("[data-live-actions],[data-bell-open]")) openNotifications();
    });

    root
      .querySelectorAll("details[data-pilotage-role]")
      .forEach((details) =>
        details.addEventListener("toggle", () => {
          const key = String(details.dataset.pilotageRole || "").trim();
          if (!key) return;
          const openRoles = readPilotageOpen();
          if (details.open) openRoles.add(key);
          else openRoles.delete(key);
          writePilotageOpen(openRoles);
        }),
      );
    const shortcutsDialog = root.querySelector("#hcShortcutsDialog");
    const closeShortcuts = () => {
      if (!shortcutsDialog) return;
      if (typeof shortcutsDialog.close === "function" && shortcutsDialog.open)
        shortcutsDialog.close();
      else shortcutsDialog.removeAttribute("open");
    };
    root.querySelectorAll("[data-shortcuts-open]").forEach(button => button.addEventListener("click", () => {
      if (!shortcutsDialog) return;
      if (typeof shortcutsDialog.showModal === "function") shortcutsDialog.showModal();
      else shortcutsDialog.setAttribute("open", "");
    }));
    shortcutsDialog
      ?.querySelector("[data-shortcuts-close]")
      ?.addEventListener("click", closeShortcuts);
    shortcutsDialog?.addEventListener("click", (event) => {
      if (event.target === shortcutsDialog) closeShortcuts();
    });
    $("#hcLogout")?.addEventListener("click", () =>
      document.getElementById("logoutBtn")?.click(),
    );
    if (state.homeMode === "notifications") bindActionCenter($("#hcProfileActions"), state.actionFilter, true);
    root.querySelector("[data-t-door]")?.addEventListener("click", () => {
      const level = Number(document.documentElement.dataset.stipTSuiteLevel || "0");
      if (level >= 1) return;
      location.href = new URL("t-est/porte-entree/index.html", document.baseURI).href;
    });
    root.querySelectorAll(".ghe-home-topbar [data-bell-open]").forEach(b=>b.onclick=openNotifications);
    root.querySelectorAll("[data-home-mode]").forEach(
      (b) =>
        (b.onclick = () => {
          const next = b.dataset.homeMode || "planning";
          // Anciennes entrées vers Notifications : une fenêtre, pas une nouvelle page.
          if (next === "notifications") { openNotifications(); return; }
          if (next === "team") {
            location.href = "esprit-equipe.html?entry=home-header";
            return;
          }
          if (next === "tableau") {
            state.communicationTab = "wheelchair";
            state.communicationFocus = false;
          }
          const targetRoute = routeForHomeMode(next);
          state.tableauFocus = false;
          if (window.STIPRouter?.set) {
            window.STIPRouter.set(targetRoute);
            return;
          }
          if (next === state.homeMode) return;
          state.homeMode = next;
          state.renderSig = "";
          render();
        }),
    );
    if (state.homeMode === "apps") window.STIPFavorites?.renderApps?.(root.querySelector("#hcMyAppsHost"));
    if (state.homeMode === "communication") {
      const communicationHost = root.querySelector("#hcCommunicationAppHost");
      const runtime = window.STIPCommunicationApp;
      if (!runtime || typeof runtime.mount !== "function") {
        if (communicationHost)
          communicationHost.innerHTML =
            '<div class="tb-runtime-refresh">Chargement de Communication…</div>';
        const loadingHost = communicationHost;
        let settled = false;
        const showRetry = () => {
          if (settled || !loadingHost?.isConnected) return;
          loadingHost.innerHTML =
            '<div class="tb-runtime-refresh"><p>Communication met trop de temps à charger.</p><button type="button" data-communication-runtime-retry>Réessayer</button></div>';
          loadingHost
            .querySelector("[data-communication-runtime-retry]")
            ?.addEventListener("click", () => {
              communicationRuntimePromise = null;
              state.renderSig = "";
              render();
            });
        };
        const watchdog = setTimeout(showRetry, 5000);
        ensureCommunicationRuntime()
          .then(() => {
            settled = true;
            clearTimeout(watchdog);
            state.renderSig = "";
            render();
          })
          .catch(() => {
            settled = true;
            clearTimeout(watchdog);
            if (!loadingHost?.isConnected) return;
            loadingHost.innerHTML =
              '<div class="tb-runtime-refresh"><button type="button" data-communication-runtime-retry>Réessayer</button></div>';
            loadingHost
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
    bindWeekContext(root.querySelector(".hc-week-context-master"));
    bindMonthContext(root.querySelector(".hc-month-context-master"));
    root
      .querySelectorAll("[data-app]")
      .forEach((b) => { if (!b.closest(".hc-month-context-master")) b.onclick = () => openApp(b.dataset.app); });
    root.querySelector("[data-trainee-session-change]")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("stip:trainee-change"));
    });
    root
      .querySelectorAll("[data-widget-open]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            b.closest(".hc-month-context-master, .hc-week-context-master") ? undefined : openWidget(b.dataset.widgetOpen, b.dataset.futureId || "")),
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
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.getElementById("hcShiftDetail"))
      closeShiftDetail();
  });

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
    if (k === "apps" || k === "planning") {
      window.STIPRouter?.set?.(k === "apps" ? "apps" : "home");
      return;
    }
    if (k === "personal") return window.STIPHubs?.planning?.("personal");
    if (k === "tomorrow") return window.STIPTomorrowUI?.open?.();
    if (k === "meeting_notes") return (location.href = "meeting-notes.html");
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
  // La cloche a un seul dialogue et plusieurs niveaux internes :
  // choix de catégorie → liste → détail. Aucun empilement de fenêtres.
  let bellFilter = "all";
  function ensureBellDialog() {
    let dialog = document.getElementById("hcBellDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "hcBellDialog";
    dialog.className = "hc-bell-dialog";
    dialog.setAttribute("aria-label", "Notifications");
    dialog.innerHTML =
      '<section class="hc-bell-shell"><header class="hc-bell-head">'+
        '<button type="button" data-bell-back aria-label="Retour">‹</button>'+
        '<h2 id="hcBellTitle">Notifications</h2>'+
        '<button type="button" data-bell-close aria-label="Fermer">×</button>'+
      '</header><div class="hc-bell-content" id="hcBellContent"></div></section>';
    document.body.appendChild(dialog);
    dialog.querySelector("[data-bell-close]").onclick = () => dialog.close();
    dialog.querySelector("[data-bell-back]").onclick = () => {
      const view = dialog.dataset.view;
      if (view === "detail") renderBellEntries(bellFilter);
      else if (view === "list") renderBellChoices();
      else dialog.close();
    };
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      dialog.querySelector("#hcNotificationDetail")?.remove();
      dialog.dataset.view = "";
    });
    return dialog;
  }
  function bellView(view, title, html) {
    const dialog = ensureBellDialog(),content = dialog.querySelector("#hcBellContent");
    dialog.dataset.view = view;
    dialog.querySelector("#hcBellTitle").textContent = title;
    dialog.querySelector("[data-bell-back]").hidden = view === "choices";
    content.innerHTML = html;
    content.scrollTop = 0;
    return content;
  }
  function renderBellChoices() {
    const { ns, cats, counts } = actionCenterData("all");
    const available = cats.filter(([key]) => key !== "all" && counts[key] > 0);
    const types = {
      agenda:["📅","Invitations et rendez-vous"],
      access:["🔐","Demandes d’accès"],
      signatures:["✍️","Signatures"],
      reminders:["⏰","Rappels"],
      other:["📌","Autres notifications"]
    };
    const html = ns.length
      ? '<p class="hc-bell-intro">Choisis ce que tu veux consulter.</p>'+
        '<div class="hc-bell-categories">'+
        available.map(([key,label]) =>
          '<button type="button" data-bell-category="'+esc(key)+'">'+
            '<span aria-hidden="true">'+(types[key]?.[0] || "🔔")+'</span>'+
            '<strong>'+esc(types[key]?.[1] || label)+'</strong>'+
            '<b>'+counts[key]+'</b><i aria-hidden="true">›</i></button>'
        ).join("")+
        (available.length>1?
          '<button type="button" data-bell-category="all"><span aria-hidden="true">🔔</span>'+
          '<strong>Toutes les notifications</strong><b>'+ns.length+'</b><i aria-hidden="true">›</i></button>':"")+
        '</div>'
      : '<div class="hc-bell-empty">✓ Aucune notification à traiter.</div>';
    const content=bellView("choices","🔔 Notifications",html);
    content.querySelectorAll("[data-bell-category]").forEach(b=>
      b.onclick=()=>renderBellEntries(b.dataset.bellCategory));
  }
  function renderBellEntries(filter = "all") {
    bellFilter = filter;
    const { cats } = actionCenterData(filter);
    const category = cats.find(([key]) => key === filter)?.[1] || "Notifications";
    const content=bellView("list",category,actionCenterMarkup(filter,false) ||
      '<p class="hc-bell-empty">Aucune notification.</p>');
    content.querySelectorAll("[data-action-filter]").forEach(b=>
      b.onclick=()=>renderBellEntries(b.dataset.actionFilter));
    const { shown }=actionCenterData(filter);
    content.querySelectorAll(".hc-note-card[data-note-index]").forEach(card=>{
      const note=shown[Number(card.dataset.noteIndex)];
      if(note) bindNoteCard(card,note);
    });
  }
  function openBellItem(note) {
    const dialog=ensureBellDialog();
    if(note?.source==="leisure" && note.event_id){
      // Le pop d'activité existant remplace temporairement celui de la cloche.
      dialog.close();
      const shown=window.STIPLeisure?.openPreview?.(String(note.event_id));
      const preview=document.getElementById("ev3HomePreview");
      if(preview?.open){
        preview.addEventListener("close",()=>openNotifications(bellFilter),{once:true});
      } else if(shown===false) openNotifications(bellFilter);
      return;
    }
    const content=bellView("detail","Détail de la notification","");
    const page=openNotificationDetail(note,{
      bellHost:content,
      onClose:()=>renderBellEntries(bellFilter)
    });
    if(page)dialog.querySelector("[data-bell-back]")?.focus({preventScroll:true});
  }
  function openNotifications(filter = "") {
    const dialog=ensureBellDialog();
    if(!dialog.open)dialog.showModal();
    if(filter)renderBellEntries(filter);
    else renderBellChoices();
  }
  function renderActionCenter(filter = state.actionFilter) {
    const body = $("#hsPanelBody");
    if (!body) return;
    state.actionFilter = filter;
    body.innerHTML = actionCenterMarkup(filter, false);
    bindActionCenter(body, filter, false);
  }
  async function openAction(id, destination = null) {
    const body = destination || $("#hsPanelBody");
    if (!body) return;
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
    if (state.refreshing) return state.refreshing;
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
    const traineeSession = String(state.session?.role_key || "") === "stagiaire";
    const bootRequest = window.STIPBootPromise || call(DATA_API, "bootstrap");
    window.STIPBootPromise = bootRequest;
    // The shift grid must NEVER wait for actions, notifications or messages.
    // Publish the planning as soon as its own request settles.
    const bootJob = Promise.resolve(bootRequest).then((boot) => {
      if (!state.ready || !token()) return;
      state.bootStatus = "ready";
      state.bootError = "";
      stopPlanningLoading();
      publishBoot(boot);
      saveShiftSnapshot(boot);
      prefetchContacts();
      state.lastRefreshAt = Date.now();
      writeHomeCache();
      state.renderSig = "";
      render();
    }).catch((error) => {
      if (!state.ready || !token()) return;
      if (!hasUsableBoot && !(state.boot?.personal || []).length) {
        state.bootStatus = "error";
        stopPlanningLoading();
        state.bootError = error?.message || "Planning indisponible.";
        state.renderSig = "";
        render();
      }
    });
    const homeJob = (
      traineeSession
        ? Promise.resolve({ actions: [], notifications: [] })
        : call(ACTION_API, "home")
    ).then((home) => {
      if (!state.ready || !token()) return;
      state.home = home;
      state.lastRefreshAt = Date.now();
      writeHomeCache();
      state.renderSig = "";
      render();
    }).catch(() => {});
    const done = Promise.allSettled([bootJob, homeJob]).finally(() => {
      if (window.STIPBootPromise === bootRequest) window.STIPBootPromise = null;
      if (state.refreshing === done) state.refreshing = null;
    });
    state.refreshing = done;
    return done;
  }
  function ready(e) {
    const firstReady = !state.ready;
    state.ready = true;
    state.session = e?.detail || window.STIPSession || state.session;
    if (firstReady) resetWeekToCurrent();
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
    if (routedMode) {
      state.homeMode = routedMode;
      if (routedMode === "communication")
        state.communicationTab = communicationTabForRoute(routedRoute);
    }
    try {
      const quick = new URLSearchParams(location.search).get("quick") || "",
        requested = sessionStorage.getItem("stip_home_mode_once");
      if (quick === "notifications" || quick === "exchange") {
        state.homeMode = "notifications";
      } else if (quick === "communication" && has("messages")) {
        const params = new URLSearchParams(location.search);
        state.homeMode = "communication";
        state.communicationTab = params.get("tab") === "fauteuils"
          ? "wheelchair"
          : (params.get("tab") === "dm" ? "dm" : "chat");
        state.communicationConversation = params.get("conversation") || "";
        state.communicationMessage = params.get("message") || "";
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
      requestAnimationFrame(focusRequestedAlert);
    warmHomeRuntimes();
      if (Date.now() - Number(cached.at || 0) > HOME_CACHE_FRESH_MS)
        setTimeout(() => refresh().catch(() => {}), 180);
      return;
    }
    state.bootStatus = "loading";
    state.bootError = "";
    startPlanningLoading();
    const a = state.session?.agent || {};
    const lastShifts = readShiftSnapshot();
    publishBoot(lastShifts || {
      agent: a,
      permissions: state.session?.permissions || {},
      team: a.type_planning || a.equipe || "",
      personal: [],
      media: { avatars: {}, shifts: {} },
    });
    // The last saved shifts appear on the first render; unrelated API
    // requests must never keep a user's week or month hidden.
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
    state.dayFocus = parisIso();
    state.monthDayFocus = "";
    state.dateJumpMonth = parisIso().slice(0, 7);
    state.renderSig = "";
    state.lastRefreshAt = 0;
    state.focusedAlertKey = "";
    tableauRuntimePromise = null;
    communicationRuntimePromise = null;
    state.communicationTab = "chat";
    state.communicationFocus = false;
    state.communicationConversation = "";
    state.communicationMessage = "";
    clearHomeCache();
    clearShiftSnapshot();
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
    if (next === "planning" && state.homeMode !== "planning")
      resetWeekToCurrent();
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
    resetWeekToCurrent();
    state.tableauFocus = false;
    state.renderSig = "";
    render();
  });
  // A background network refresh replaces the visible snapshot without a loader.
  window.addEventListener("stip:read-cache-updated", (event) => {
    if (!state.ready || window.STIPPreview?.active ||
        event.detail?.action !== "bootstrap" || !token()) return;
    const fresh = event.detail.data;
    if (!fresh || typeof fresh !== "object") return;
    state.bootStatus = "ready";
    state.bootError = "";
    state.lastRefreshAt = Date.now();
    publishBoot(fresh);
    saveShiftSnapshot(fresh);
    writeHomeCache();
    state.renderSig = "";
    render();
  });
  window.addEventListener("stip:leisure-updated", () => { state.renderSig = ""; render(); });
  window.addEventListener("stip:meeting-home-updated", () => { state.renderSig = ""; render(); });
  window.addEventListener("stip:event-feedback-completed", () => {
    if (!state.ready || state.homeMode !== "planning") return;
    resetWeekToCurrent();
    state.renderSig = "";
    render();
  });
  window.addEventListener("stip:permissions-live", () => {
    if (!state.ready) return;
    state.renderSig = "";
    render();
  });
  window.addEventListener("stip:session-ready", ready);
  window.addEventListener("stip:session-ended", () => document.getElementById("hcBellDialog")?.close?.());
  window.addEventListener("stip:session-ended", ended);
  window.addEventListener("stip:messages-unread", () => { state.renderSig = ""; render(); });
  $("#hsPanelBack")?.addEventListener("click", () => panel(false));
  const refreshablePlanningRoute = () => {
    const route = window.STIPRouter?.get?.() || "home";
    return route === "home" || route === "planning" || route === "planning/personal";
  };
  document.addEventListener("visibilitychange", () => {
    if (
      state.ready &&
      !document.hidden &&
      refreshablePlanningRoute() &&
      Date.now() - Number(state.lastRefreshAt || 0) > 60000
    )
      refresh().catch(() => {});
  });
  setInterval(() => {
    if (state.ready && !document.hidden && refreshablePlanningRoute())
      refresh().catch(() => {});
  }, 300000);
  document.addEventListener("stip:team-fusion-updated", event => {
    if (event.detail?.hostId === "hcTeamFusion") updateLiveCard();
  });
  setInterval(() => {
    if (state.ready && !document.hidden) updateLiveCard();
  }, 60000);
  if (window.STIPSession) ready({ detail: window.STIPSession });
})();
