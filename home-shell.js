(() => {
  "use strict";
  const DATA_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data",
    ACTION_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-actions",
    STORE = "stip_session_v1",
    TABLEAU_BUILD = "20260923-swipe2",
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
  };
  let planningSlowTimer = 0;
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
  function jumpToDate(iso) {
    iso = String(iso || "").slice(0, 10);
    if (!iso) return;
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
    if (state.weekOffset === 0) {
      state.weekPast = iso < parisIso();
      state.weekFull = false;
    } else {
      state.weekPast = false;
      state.weekFull = true;
    }
    state.dayFocus = iso;
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
        `<button type="button" class="stip-month-day ${cls} ${loading ? "is-loading" : ""} ${eventIcons.length?"has-event":""}"${gridStart} data-cal-day="${iso}" data-cal-month="${monthKeyOf(d)}" aria-label="${esc(aria)}"${loading ? ' disabled aria-disabled="true"' : ""}><b class="hc-date-jump-day-number stip-month-day-number">${day}</b><span class="hc-date-jump-marker">${marker}</span><small class="hc-date-jump-events stip-month-events">${eventIcons.map(esc).join("")}</small></button>`,
      );
    }
    const monthKey = monthKeyOf(first);
    state.dateJumpMonth = monthKey;
    panel.dataset.calendarMonth = monthKey;
    panel.classList.toggle("is-loading", loading);
    panel.setAttribute("aria-busy", loading ? "true" : "false");
    panel.innerHTML = `<div class="hc-date-jump-head"><button type="button" data-cal-step="-1" aria-label="Mois précédent"${loading ? " disabled" : ""}>‹</button><strong>${cap(first.toLocaleDateString("fr-FR", { month: "long" }))} ${y}</strong><button type="button" data-cal-step="1" aria-label="Mois suivant"${loading ? " disabled" : ""}>›</button></div><div class="hc-date-jump-weekdays"><span>Lu</span><span>Ma</span><span>Me</span><span>Je</span><span>Ve</span><span>Sa</span><span>Di</span></div><div class="hc-date-jump-grid stip-month-grid">${cells.join("")}</div>`;
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
    refreshActionCenterUi();
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
      external = [...state.externalActions.values()].flat();
    return [...native, ...external].filter(
      (n) => !state.dismissedNotifications[actionNoteKey(n)],
    );
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
    return window.STIPShiftRegistry?.time?.(code) || "";
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
    const kind=String(x.event_kind||"").toLowerCase(),
      kindLabel={rendezvous:"Rendez-vous",formation:"Formation",reunion:"Réunion",information:"Information",autre:"Événement"}[kind];
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
    const today = dateObj(parisIso()),
      dow = today.getDay() || 7,
      monday = new Date(today);
    monday.setDate(today.getDate() - (dow - 1) + state.weekOffset * 7);
    return agendaRange(monday, 7);
  }
  function selectedWeek() {
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

    const anchor =
        document.querySelector(".hc-planning-week-subblock") ||
        document.querySelector(".hc-planning-week-separator"),
      anchorTop = anchor?.getBoundingClientRect?.().top,
      today = dateObj(parisIso()),
      todayIso = parisIso(),
      dow = today.getDay() || 7;

    // La semaine courante est volontairement coupée en deux vues :
    // restant (aujourd'hui → dimanche) et passé (lundi → hier).
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

    const navWeek = navigationWeek();

    // Une navigation par flèche change seulement la période affichée.
    // Aucune journée n'est sélectionnée tant que l'utilisateur n'en touche pas une.
    state.dayFocus = "";

    state.dateJumpMonth = navWeek[0]?.iso?.slice(0, 7) || state.dateJumpMonth;
    state.renderSig = "";
    render();

    if (Number.isFinite(anchorTop))
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const next =
            document.querySelector(".hc-planning-week-subblock") ||
            document.querySelector(".hc-planning-week-separator");
          if (!next) return;
          const delta = next.getBoundingClientRect().top - anchorTop;
          if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "auto" });
        }),
      );
  }
  function dayCard(x, cls = "hc-day", compact = false) {
    const canonical = canonicalShift(x.code),
      pending = !canonical || canonical === "—",
      code = canonical.replace(/[^A-Z0-9]/g, "").toLowerCase() || "none",
      weekend = x.dow > 5,
      dayFull = x.d
        .toLocaleDateString("fr-FR", { weekday: "long" })
        .replace(".", "")
        .toUpperCase(),
      landscape = cls.includes("hc-day-landscape"),
      day = landscape ? dayFull.slice(0, 2) : weekend ? dayFull.slice(0, 1) : dayFull.slice(0, 3),
      loading = x.code === "…",
      statusIcon = shiftStatusIcon(canonical),
      shiftLabel = shiftMeta(canonical)[1] || canonical,
      workIcon = workShiftIcon(canonical),
      workLabel = landscape && workShiftIcon(canonical) ? canonical : weekend && workShiftIcon(canonical) ? canonical : shiftLabel,
      normalVisual = loading
        ? '<strong class="hc-shift-loading">…</strong>'
        : pending
          ? '<span class="hc-pending-line" aria-label="En attente du nouveau planning"><span class="hc-pending-icon" aria-hidden="true">🚫</span></span>'
          : statusIcon
            ? `<span class="hc-rest-line"><span class="hc-status-icon" role="img" aria-label="${esc(shiftLabel)}">${statusIcon}</span><strong class="hc-status-code">${esc(canonical)}</strong></span>`
            : workIcon
              ? `<span class="hc-work-line" title="${esc(shiftLabel)}" aria-label="${esc(shiftLabel)}"><span class="hc-work-icon" aria-hidden="true">${workIcon}</span><strong class="hc-shift-name">${esc(workLabel)}</strong></span>`
              : `<strong class="hc-shift-name" title="${esc(shiftLabel)}" aria-label="${esc(shiftLabel)}">${esc(shiftLabel)}</strong>`,
      landscapeMain = loading
        ? '<span class="hc-shift-main hc-loading-main" aria-hidden="true"><span class="hc-loading-orb"></span></span>'
        : pending
          ? '<span class="hc-shift-main"><span class="hc-pending-icon" aria-hidden="true">🚫</span></span>'
          : statusIcon
            ? `<span class="hc-shift-main hc-shift-main-special"><span class="hc-status-icon" role="img" aria-label="${esc(shiftLabel)}">${statusIcon}</span></span>`
            : workIcon
              ? `<span class="hc-shift-main hc-shift-main-work" title="${esc(shiftLabel)}"><span class="hc-work-icon" aria-hidden="true">${workIcon}</span></span>`
              : `<span class="hc-shift-main"><span class="hc-shift-fallback">${esc(shiftLabel || "—")}</span></span>`,
      landscapeCode = loading ? "" : pending ? "—" : canonical || "—",
      hasSupplements = landscape && weekEventsForDay(x).length > 0,
      selected=landscape&&x.iso===state.dayFocus,
      tag=landscape?"button":"span",
      attrs=landscape
        ? ` type="button" data-home-day="${esc(x.iso)}" aria-pressed="${selected}"${loading ? ' disabled aria-disabled="true"' : ""}`
        : "",
      visual=landscape
        ? loading
          ? `<span class="hc-shift-core"><span class="hc-shift-code hc-loading-code" aria-hidden="true"></span>${landscapeMain}</span><span class="hc-week-extra-separator is-empty" aria-hidden="true"></span><span class="hc-week-events-slot hc-loading-event-slot is-empty" aria-hidden="true"></span>`
          : `<span class="hc-shift-core"><strong class="hc-shift-code">${esc(landscapeCode)}</strong>${landscapeMain}</span><span class="hc-week-extra-separator ${hasSupplements ? "" : "is-empty"}" aria-hidden="true"></span>${weekEventBadges(x)}`
        : normalVisual;
    return `<${tag}${attrs} class="${cls} ${x.today ? "today" : ""} ${selected?"selected":""} ${weekend ? "weekend" : ""} ${loading ? "loading" : pending ? "pending" : (shiftDefinition(canonical)?.is_working === false ? "rest" : "work")} code-${code}" ${x.today ? 'aria-current="date"' : ""}><span class="hc-day-head"><i>${esc(day)}</i><b>${x.d.getDate()}</b></span><span class="hc-week-visual">${visual}</span></${tag}>`;
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
  function weekEventBadges(x) {
    const events = weekEventsForDay(x).slice(0, 2);
    if (!events.length)
      return '<span class="hc-week-events-slot is-empty" aria-hidden="true"></span>';
    return `<span class="hc-week-events-slot has-events" aria-label="${events.length} événement${events.length > 1 ? "s" : ""}">${events
      .map((event) => {
        const kind = futureTypeKey(event),
          title = event.title || event.type || "Événement";
        return `<i class="hc-week-event-chip type-${esc(kind)}" title="${esc(title)}" aria-label="${esc(title)}">${event.icon || "•"}</i>`;
      })
      .join("")}</span>`;
  }
  function weekDisplayModel(w = selectedWeek()) {
    const liveTail =
        state.weekOffset === 0 &&
        !state.weekFull &&
        !state.weekPast &&
        w[0]?.today &&
        w[0]?.dow >= 5,
      nextMonday = liveTail
        ? (() => {
            const d = new Date(w[w.length - 1].d);
            d.setDate(d.getDate() + 1);
            return agendaRange(d, 1)[0];
          })()
        : null;
    return {
      weekDays: w,
      nextMonday,
      visualDays: nextMonday ? [...w, nextMonday] : w,
      slotCount: Math.max(1, w.length + (nextMonday ? 2 : 0)),
    };
  }
  function weekDaysLandscape(w) {
    const model = weekDisplayModel(w),
      { nextMonday, slotCount } = model,
      bridge = nextMonday
        ? '<span class="hc-next-monday-bridge" aria-hidden="true"><span class="hc-next-monday-word">LUNDI</span><span class="hc-next-monday-arrow">→</span></span>'
        : "";
    return `<div class="hc-days-landscape ${nextMonday ? "has-next-monday" : ""}" style="--visible-days:${slotCount}">${w.map((x) => dayCard(x, "hc-day hc-day-landscape", true)).join("")}${bridge}${nextMonday ? dayCard(nextMonday, "hc-day hc-day-landscape hc-day-next-monday", true) : ""}</div>`;
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
                .map((event) => `<i>${event.icon || "•"}</i>`)
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
        state.weekOffset === 0
          ? state.weekPast
            ? "DÉBUT DE SEMAINE"
            : "CETTE SEMAINE"
          : state.weekOffset === 1
            ? "SEMAINE PROCHAINE"
            : state.weekOffset === -1
              ? "SEMAINE PRÉCÉDENTE"
              : `SEMAINE ${weekNo(w[0].d)}`;
    return `<div class="hc-planning-period-separator hc-planning-week-separator stip-section-separator" aria-hidden="true"><span>${esc(label)}</span></div>`;
  }

  function planningMonthTitle() {
    const w = navigationWeek(),
      mi = weekMonthInfo(w),
      returnToCurrentWeek =
        state.weekOffset !== 0
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
    return `<section class="hc-widget hc-widget-planning${loading ? " is-loading" : ""}" data-widget="planning" aria-busy="${loading ? "true" : "false"}">${planningStatus()}<div class="hc-date-jump-head hc-week-jump-head" role="group" aria-label="Navigation par semaine"><button type="button" data-week-step="-1" aria-label="Semaine précédente">‹</button><strong>${esc(range)}</strong><button type="button" data-week-step="1" aria-label="Semaine suivante">›</button></div>${weekDaysLandscape(w)}</section>`;
  }
  function nativeTimelineItems({ includePast = false } = {}) {
    const b = state.boot || {},
      today = parisIso(),
      o = [];
    (b.agenda_items || [])
      .filter(
        (x) =>
          !done(x) &&
          (includePast || String(x.event_date || "") >= today),
      )
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
          !done(x) &&
          (includePast ||
            String(x.date_fin || x.date_debut || "") >= today),
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
          !done(x) &&
          (includePast ||
            String(x.date_fin || x.date_debut || "") >= today),
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
          relation: "Référent : vous",
          sub: [time, place].filter(Boolean).join(" · "),
        });
      });
    return o;
  }
  function normalizeTimelineItems(all = []) {
    const m = new Map();
    all.forEach((x) => {
      if (!x || done(x)) return;
      const id = String(
          x.id || `${x.type || "item"}:${x.date || ""}:${x.title || ""}`,
        ),
        old = m.get(id);
      if (!old || Number(x.priority || 0) > Number(old.priority || 0))
        m.set(id, {
          ...x,
          id,
          endDate: x.endDate || x.end_date || x.date,
        });
    });
    return [...m.values()].sort(
      (a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        String(a.title).localeCompare(String(b.title), "fr"),
    );
  }
  function nativeFuture() {
    return nativeTimelineItems();
  }
  function futureItems() {
    const today = parisIso();
    return normalizeTimelineItems([
      ...nativeFuture(),
      ...state.future.values(),
    ].filter(
      (x) =>
        !done(x) &&
        String(x.endDate || x.end_date || x.date || "") >= today,
    ));
  }
  function monthTimelineItems(key = "") {
    const monthKey =
        /^\d{4}-\d{2}$/.test(String(key || ""))
          ? String(key)
          : parisIso().slice(0, 7),
      [year, month] = monthKey.split("-").map(Number),
      monthStart = `${monthKey}-01`,
      monthEnd = `${monthKey}-${String(
        new Date(year, month, 0, 12).getDate(),
      ).padStart(2, "0")}`;

    return normalizeTimelineItems([
      ...nativeTimelineItems({ includePast: true }),
      ...state.future.values(),
    ].filter((x) => {
      if (!x || done(x)) return false;
      const start = String(x.date || "").slice(0, 10),
        end = String(x.endDate || x.end_date || x.date || "").slice(0, 10);
      return !!start && start <= monthEnd && end >= monthStart;
    }));
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
    return `<div class="hc-home-date-kicker stip-section-separator" aria-hidden="true"><span>DATE</span></div><div class="hc-planning-period-separator stip-section-separator hc-home-today-separator" aria-label="${esc(raw)}"><span class="hc-home-today-label"><span>${esc(weekday)}</span><b class="hc-home-today-day">${esc(day)}</b><span>${esc(month)}</span></span></div>`;
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
          return `<button type="button" class="hc-week-event-key-item hc-week-event-day-row type-${esc(kind)}" data-widget-open="future" data-future-id="${esc(x.id)}"><span class="hc-week-event-key-icon" aria-hidden="true">${x.icon || "•"}</span><span class="hc-week-event-copy"><strong>${esc(x.title)}</strong><span class="hc-week-event-when"><b class="hc-week-event-date">${esc(dayLabel)}</b>${time ? `<b class="hc-week-event-time">${esc(time)}</b>` : ""}${x.relation ? `<b class="hc-week-event-relation">${esc(x.relation)}</b>` : ""}${place ? `<span class="hc-week-event-place">${esc(place)}</span>` : ""}</span></span><span class="hc-week-event-chevron" aria-hidden="true">›</span></button>`;
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
      items = monthTimelineItems(key);
    if (!items.length) return "";

    const buttons = items
      .map((x) => {
        const kind = futureTypeKey(x),
          time = String(x.time || "").trim(),
          place = String(x.place || "").trim(),
          dateLabel = fmtDateRange(x);
        return `<button type="button" class="hc-week-event-key-item hc-week-event-day-row type-${esc(kind)}" data-widget-open="future" data-future-id="${esc(x.id)}"><span class="hc-week-event-key-icon" aria-hidden="true">${x.icon || "•"}</span><span class="hc-week-event-copy"><strong>${esc(x.title)}</strong><span class="hc-week-event-when"><b class="hc-week-event-date">${esc(dateLabel)}</b>${time ? `<b class="hc-week-event-time">${esc(time)}</b>` : ""}${x.relation ? `<b class="hc-week-event-relation">${esc(x.relation)}</b>` : ""}${place ? `<span class="hc-week-event-place">${esc(place)}</span>` : ""}</span></span><span class="hc-week-event-chevron" aria-hidden="true">›</span></button>`;
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
      type = eventType(event);
    if (icon === "🩺" || type === "Visite médicale")
      return { icon: "🩺", label: "Visite médicale" };
    if (icon === "👶" || type === "Stagiaire")
      return { icon: "👶", label: "Stagiaire" };
    if (icon === "🎓" || type === "Formation")
      return { icon: "🎓", label: "Formation" };
    if (icon === "⚠️" && type === "Événement")
      return { icon, label: "Urgent" };
    if (icon === "❗" && type === "Événement")
      return { icon, label: "Important" };
    if (icon === "📌" && type === "Événement")
      return { icon, label: "Événement" };
    return { icon, label: type || "Événement" };
  }
  function fixedShiftLegend() {
    const key =
        state.dateJumpMonth ||
        navigationWeek()[0]?.iso?.slice(0, 7) ||
        parisIso().slice(0, 7),
      parts = key.split("-").map(Number),
      year = parts[0],
      month = parts[1],
      last = new Date(year, month, 0, 12).getDate(),
      items = [],
      seen = new Set(),
      add = (id, html) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        items.push(html);
      };

    for (let day = 1; day <= last; day++) {
      const iso = key + "-" + String(day).padStart(2, "0"),
        shift = calendarShiftForDate(iso);
      if (shift?.code && shift.code !== "—") {
        const code = shift.code,
          def = shiftDefinition(code);
        if (def?.is_working) {
          const family = String(def.family || "").toLowerCase();
          add(
            "shift:" + code,
            '<span class="hc-fixed-shift-item"><i class="shift-' +
              esc(family) +
              '" aria-hidden="true"></i><b>' +
              esc(def.label || code) +
              '</b><em>•</em><strong>' +
              esc(shiftTime(code)) +
              "</strong></span>",
          );
        } else {
          const label = def?.label || code,
            symbol = String(def?.icon || "");
          add(
            "status:" + code,
            '<span class="hc-fixed-shift-item">' +
              (symbol
                ? '<i class="hc-legend-symbol" aria-hidden="true">' +
                  esc(symbol) +
                  "</i>"
                : "") +
              "<b>" +
              esc(code) +
              "</b><em>•</em><strong>" +
              esc(label) +
              "</strong></span>",
          );
        }
      }

      calendarEventIcons(iso).forEach((icon) => {
        const label =
          {
            "🩺": "Visite médicale",
            "👶": "Stagiaire",
            "🎓": "Formation",
            "⚠️": "Urgent",
            "❗": "Important",
            "📌": "Événement",
          }[icon] || "Événement";
        add(
          "event:" + icon + "|" + label,
          '<span class="hc-fixed-shift-item hc-fixed-event-legend"><i class="hc-legend-symbol" aria-hidden="true">' +
            esc(icon) +
            "</i><b>" +
            esc(label) +
            "</b></span>",
        );
      });
    }

    const visibleWeekHasPending = navigationWeek().some((day) => {
      const shift = calendarShiftForDate(day?.iso || "");
      return !shift?.code || shift.code === "—";
    });
    if (visibleWeekHasPending) {
      add(
        "planning:pending",
        '<span class="hc-fixed-shift-item hc-fixed-event-legend"><i class="hc-legend-symbol" aria-hidden="true">🚫</i><b>Planning non renseigné</b></span>',
      );
    }

    if (!items.length) return "";
    return '<section class="hc-fixed-shift-legend" aria-label="Légende des repères de la page"><div>' +
      items.join("") +
      "</div></section>";
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
      avatar = a.profile_photo_url || media.avatars?.[a.source_key] || a.avatar_signed_url || a.avatar_url || "",
      ghe = String(a.ghe || "").trim(),
      tel = String(a.telephone || "").trim(),
      mail = String(a.email || a.email_pro || "").trim(),
      prenom = cap(String(a.prenom || "").trim()),
      nomRaw = String(a.nom || "").trim().toLowerCase(),
      nom = nomRaw ? cap(nomRaw) : "",
      ini = ((a.prenom?.[0] || "") + (a.nom?.[0] || "")).toUpperCase(),
      gheLabel = ghe
        ? ghe.toUpperCase().startsWith("GHE")
          ? ghe.toUpperCase()
          : `GHE ${ghe}`
        : "";
    return `<section class="hc-profile hc-profile-full hc-id-card">
      <div class="hc-avatar" data-avatar-fallback="${esc(ini || "ST")}">${avatar ? `<img src="${esc(avatar)}" alt="" loading="lazy">` : `<span>${esc(ini || "ST")}</span>`}</div>
      <div class="hc-profile-copy">
        <div class="hc-profile-name-line">
          ${prenom ? `<strong class="hc-profile-firstname">${esc(prenom)}</strong>` : ""}
          ${nom ? `<span class="hc-profile-surname">${esc(nom)}</span>` : ""}
        </div>
        ${mail ? `<span class="hc-profile-email" title="${esc(mail)}">${esc(mail)}</span>` : ""}
        <span class="hc-profile-breath" aria-hidden="true"></span>
        ${tel ? `<button class="hc-profile-contact hc-profile-phone" data-copy="${esc(tel)}" data-label="Téléphone" aria-label="Copier le téléphone"><strong>${esc(tel)}</strong></button>` : ""}
      </div>
      ${gheLabel ? `<div class="hc-profile-ghe-art" aria-label="${esc(gheLabel)}"><span>${esc(gheLabel)}</span></div>` : ""}
    </section>`;
  }
  function responsableAccessBlock() {
    const canResponsable = has("responsable") || has("admin"),
      canAccess = has("access_manage") || has("admin");
    if (!(canResponsable || canAccess)) return "";
    return `<section class="hc-responsable-access-block" aria-label="Pilotage"><div class="hc-responsable-access-separator" aria-hidden="true"><span>PILOTAGE</span></div>${canResponsable ? '<div class="hc-profile-responsable-row"><button type="button" class="hc-responsable-tab" data-app="responsable" aria-label="Ouvrir l’espace Responsable"><span>Responsable</span><b aria-hidden="true">›</b></button></div>' : ""}${canAccess ? '<div class="hc-profile-responsable-row hc-profile-access-row"><button type="button" class="hc-responsable-tab" data-app="access" aria-label="Ouvrir la gestion des accès"><span>Accès</span><b aria-hidden="true">›</b></button></div>' : ""}</section>`;
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
    if (has("planning_team") || has("activity") || has("assistant_enabled"))
      s += app("team", "Esprit d’équipe", "team", "team");
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
    if (has("nouveaux_arrivants"))
      s += app("newagent", "Nouvel agent", "newagent", "newagent");
    if (has("file_upload")) s += app("upload", "Importer", "upload", "upload");
    if (has("admin")) s += app("admin", "Admin", "admin", "admin");
    if (has("access_manage") || has("admin"))
      s += app("access", "Accès", "access", "access");
    return s || '<p class="hc-empty">Aucune application autorisée.</p>';
  }
  function routeForHomeMode(mode = "planning") {
    return (
      {
        planning: "home",
        apps: "apps",
        notifications: "notifications",
        team: "team",
        tableau: "fauteuils",
      }[mode] || "home"
    );
  }
  function homeModeForRoute(route = "home") {
    return (
      {
        home: "planning",
        apps: "apps",
        notifications: "notifications",
        team: "team",
        fauteuils: "tableau",
      }[String(route || "home")] || ""
    );
  }
  function homeModeNav() {
    const active = state.homeMode || "planning",
      count = notifications().length + Number(window.STIPMessagesUnread || 0),
      items = [
        { key: "apps", label: "Applications", art: ICON.homeApps, mode: "home" },
        { key: "planning", label: "Mon profil", art: ICON.homeHome, mode: "home" },
      ];
    if (has("planning_team") || has("activity") || has("assistant_enabled"))
      items.push({ key: "team", label: "Esprit d’équipe", art: ICON.team, mode: "home" });
    return `<section class="hc-home-top-nav hc-home-top-nav-${items.length}">
      <div class="hc-home-top-tools">
        <button type="button" class="hc-profile-bell${state.homeMode === "notifications" ? " active" : ""}" data-home-mode="notifications" aria-pressed="${state.homeMode === "notifications"}" aria-label="Notifications${count ? ` : ${count} à traiter` : ""}"><span aria-hidden="true">🔔</span>${count ? `<b>${count}</b>` : ""}</button>
        <div class="hc-home-wheelchair-slot">${wheelchairShortcut()}</div>
      </div>
      <nav class="hc-home-filters" data-count="${items.length}" aria-label="Accueil STIP">${items
        .map((item) => `<button type="button" data-home-mode="${item.key}" aria-label="${esc(item.label)}" aria-pressed="${active === item.key}" class="${active === item.key ? "active" : ""}"><span class="hc-home-filter-art">${item.art}</span><strong>${esc(item.label)}</strong></button>`)
        .join("")}</nav>
    </section>`;
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
              '<div class="hc-note-swipe" data-note-index="' +
              i +
              '"><div class="hc-note-swipe-bg hc-note-delete"><span>✕</span><strong>Supprimer</strong></div><div class="hc-note-swipe-bg hc-note-action"><span>✓</span><strong>Traiter</strong></div><button type="button" class="hs-note hc-note-card" data-note-open><small>' +
              esc(catLabel) +
              "</small><strong>" +
              esc(n.title || "Notification") +
              "</strong>" +
              (body ? "<p>" + esc(body) + "</p>" : "") +
              "</button></div>"
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
      document.body.appendChild(wrap);
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
    document.body.appendChild(page);
    const close = () => page.remove();
    page.querySelector("[data-detail-close]").onclick = close;
    page.querySelector("[data-detail-manage]")?.addEventListener("click", () => {
      close();
      if (n?.source && n.source !== "stip")
        window.dispatchEvent(
          new CustomEvent("stip:action-center-open", { detail: n }),
        );
      else if (n?.action_id) {
        panel(true, "À traiter");
        openAction(n.action_id);
      }
    });
    page.querySelector("[data-detail-done]")?.addEventListener("click", () => {
      close();
      dismissActionNote(n);
    });
    page.querySelector("[data-detail-delete]").onclick = async () => {
      const ok = await bigConfirm({
        title: "Supprimer cette notification ?",
        body: "Elle disparaîtra de votre Cloche STIP.",
        confirmLabel: "Confirmer",
      });
      if (!ok) return;
      close();
      dismissActionNote(n);
    };
    if (options.focusAction)
      requestAnimationFrame(() =>
        page
          .querySelector("[data-detail-manage],[data-detail-done]")
          ?.focus({ preventScroll: false }),
      );
  }
  function bindNoteSwipe(wrap, note) {
    const card = wrap.querySelector(".hc-note-card");
    if (!card) return;
    let startX = 0,
      startY = 0,
      dx = 0,
      active = false,
      horizontal = false,
      swiped = false;
    const reset = () => {
      card.style.transform = "";
      wrap.classList.remove("is-delete", "is-action", "is-dragging");
    };
    card.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      active = true;
      horizontal = false;
      swiped = false;
      wrap.classList.add("is-dragging");
      try {
        card.setPointerCapture(e.pointerId);
      } catch {}
    });
    card.addEventListener("pointermove", (e) => {
      if (!active) return;
      const x = e.clientX - startX,
        y = e.clientY - startY;
      if (!horizontal) {
        if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
        if (Math.abs(y) > Math.abs(x) * 1.1) {
          active = false;
          reset();
          return;
        }
        horizontal = true;
      }
      e.preventDefault();
      dx = Math.max(-122, Math.min(122, x));
      swiped = Math.abs(dx) > 12;
      card.style.transform = "translate3d(" + dx + "px,0,0)";
      wrap.classList.toggle("is-delete", dx > 0);
      wrap.classList.toggle("is-action", dx < 0);
    });
    const finish = async () => {
      if (!active && !horizontal) return;
      const finalDx = dx;
      active = false;
      reset();
      if (finalDx > 72) {
        const ok = await bigConfirm({
          title: "Supprimer cette notification ?",
          body: "Elle disparaîtra de votre Cloche STIP.",
          confirmLabel: "Confirmer",
        });
        if (ok) dismissActionNote(note);
      } else if (finalDx < -72) openNotificationDetail(note, { focusAction: true });
      setTimeout(() => (swiped = false), 180);
    };
    card.addEventListener("pointerup", finish);
    card.addEventListener("pointercancel", () => {
      active = false;
      reset();
      setTimeout(() => (swiped = false), 180);
    });
    card.addEventListener("click", (e) => {
      if (swiped) {
        e.preventDefault();
        e.stopPropagation();
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
    scope.querySelectorAll("[data-note-index]").forEach((wrap) => {
      const n = shown[Number(wrap.dataset.noteIndex)];
      if (n) bindNoteSwipe(wrap, n);
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
    return `<details class="stip-option-pocket" data-stip-option="calendar-personal"><summary class="stip-option-summary"><span aria-hidden="true">⋯</span> Options du planning</summary><div class="stip-option-pocket-body"><button class="stip-option-action" type="button" data-home-calendar-subscribe><span aria-hidden="true">📅</span><strong>S’abonner à mon planning</strong><small>Synchronisation avec le calendrier du téléphone</small><b aria-hidden="true">›</b></button></div></details>`;
  }

  function planningCompareShortcut() {
    if (!(has("planning_personal") && has("planning_team"))) return "";
    return `<div class="hc-profile-responsable-row hc-planning-compare-row"><button type="button" class="hc-responsable-tab" data-app="compare" aria-label="Comparer mon planning avec un agent"><span>Comparer mon planning</span><b aria-hidden="true">›</b></button></div>`;
  }

  function wheelchairShortcut() {
    if (!has("messages")) return "";
    return `<button type="button" class="hc-wheelchair-shortcut${state.homeMode === "tableau" ? " active" : ""}" data-home-mode="tableau" aria-pressed="${state.homeMode === "tableau"}" aria-label="Ouvrir Fauteuils"><span class="hc-wheelchair-shortcut-icon">${ICON.homeChair}</span><span class="hc-wheelchair-shortcut-copy"><strong>Fauteuils<span class="hc-home-live-badge" data-wheelchair-count hidden></span></strong></span><span class="hc-wheelchair-shortcut-arrow" aria-hidden="true">›</span></button>`;
  }

  function homeModeBody() {
    if (state.homeMode === "notifications") return notificationsPane();
    if (state.homeMode === "apps")
      return `<section class="hc-home-pane hc-home-pane-apps"><section id="hcMyAppsHost"></section></section>`;
    if (state.homeMode === "team")
      return `<section class="hc-home-pane hc-home-pane-team"><iframe id="hcTeamFrame" class="hc-team-frame" title="Esprit d’équipe" src="esprit-equipe.html?embed=home-v3" loading="eager"></iframe></section>`;
    if (state.homeMode === "tableau" && has("messages"))
      return `<section class="hc-home-pane hc-home-pane-tableau"><section id="hcTableauStipHost"></section></section>`;
    const weeklyDetails = futureWidget(),
      monthDetails = monthEventsWidget(),
      legend = fixedShiftLegend();
    return `<main class="hc-widget-zone hc-home-pane hc-home-pane-planning"><section class="hc-planning-group hc-planning-landscape hc-calendar-driven-planning">${todayFullDateSeparator()}${weeklyDetails ? `<section class="hc-planning-details-subblock">${weeklyDetails}</section>` : ""}${planningWeekSeparator()}<section class="hc-planning-subblock hc-planning-week-subblock">${weekWidget()}</section>${monthDetails ? `${planningMonthEventsSeparator()}<section class="hc-planning-details-subblock hc-planning-month-events-subblock">${monthDetails}</section>` : ""}<div class="hc-planning-period-separator hc-planning-month-separator stip-section-separator" aria-hidden="true"><span>AU MOIS</span></div><section class="hc-planning-subblock hc-planning-month-subblock">${planningCalendarOverview()}${planningCompareShortcut()}</section>${legend ? `<div class="stip-section-separator hc-planning-legend-separator" aria-hidden="true"><span>LÉGENDE</span></div><section class="hc-planning-subblock hc-planning-legend-subblock">${legend}</section>` : ""}${planningCalendarPocket()}</section>${exchangeWidget()}${genericWidgets()}</main>${homeAIEntry()}`;
  }
  function bindEmbeddedTeam(root) {
    const frame = root?.querySelector?.("#hcTeamFrame");
    if (!frame || frame.dataset.stipBound === "1") return;
    frame.dataset.stipBound = "1";
    const setup = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc) return;
        doc.querySelector(".team-top")?.setAttribute("hidden", "");
        const shell = doc.querySelector(".team-shell");
        if (shell) {
          shell.style.paddingTop = "10px";
          shell.style.paddingBottom = "28px";
        }

        // Esprit d'équipe must scroll with the parent home page, exactly like
        // Applications and Mon profil. No nested iframe scroll / fixed home header.
        doc.documentElement.style.scrollPaddingTop = "10px";
        doc.documentElement.style.overflow = "hidden";
        if (doc.body) {
          doc.body.style.overflow = "hidden";
          doc.body.style.minHeight = "0";
        }

        const syncFrameHeight = () => {
          const body = doc.body,
            html = doc.documentElement;
          if (!body || !html) return;
          const height = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.scrollHeight,
            html.offsetHeight,
            shell?.scrollHeight || 0,
          );
          if (height > 0)
            frame.style.setProperty("height", `${Math.ceil(height)}px`, "important");
        };

        frame._stipTeamResizeObserver?.disconnect?.();
        if (window.ResizeObserver) {
          const observer = new ResizeObserver(syncFrameHeight);
          observer.observe(doc.documentElement);
          if (doc.body) observer.observe(doc.body);
          if (shell) observer.observe(shell);
          frame._stipTeamResizeObserver = observer;
        }
        requestAnimationFrame(syncFrameHeight);

        // Keep agent/chef sheets in the parent page. This preserves the shared
        // Applications / Mon profil / Esprit d'équipe header instead of trapping
        // a full-screen agent view inside the iframe.
        window.STIPLoad?.script?.("agent-agenda-view.js").catch(() => {});
        if (doc.documentElement.dataset.stipAgentBridge !== "1") {
          doc.documentElement.dataset.stipAgentBridge = "1";
          doc.addEventListener(
            "click",
            (event) => {
              const button = event.target.closest?.(
                "[data-team-agent],[data-duty-chief-agent]",
              );
              if (!button) return;
              const key = String(
                button.dataset.teamAgent ||
                  button.dataset.dutyChiefAgent ||
                  "",
              ).trim();
              if (!key) return;
              event.preventDefault();
              event.stopImmediatePropagation();
              const openParentAgent = () =>
                window.STIPAgentAgenda?.open?.(key, {});
              const loader = window.STIPLoad?.script?.("agent-agenda-view.js");
              if (loader?.then) loader.then(openParentAgent).catch(() => {});
              else openParentAgent();
            },
            true,
          );
        }

        const chair = doc.querySelector(".team-live-wheelchair");
        if (chair && chair.dataset.parentRouteBound !== "1") {
          chair.dataset.parentRouteBound = "1";
          chair.addEventListener("click", (event) => {
            event.preventDefault();
            window.STIPRouter?.set?.("fauteuils");
          });
        }
      } catch {}
    };
    frame.addEventListener("load", setup);
    setTimeout(setup, 0);
  }


  function render() {
    const root = $("#homeView .hs-home");
    if (!root || !state.boot) return;

    // Embedded live pages stay mounted during background refreshes so their
    // current tab, scroll position and open sheets are not reset.
    const embeddedFrame =
      state.homeMode === "team" ? root.querySelector("#hcTeamFrame") : null;
    if (embeddedFrame) {
      const bell = root.querySelector(".hc-profile-bell"),
        count = notifications().length + Number(window.STIPMessagesUnread || 0);
      if (bell) {
        bell.setAttribute(
          "aria-label",
          `Notifications${count ? ` : ${count} à traiter` : ""}`,
        );
        let badge = bell.querySelector("b");
        if (count && !badge) {
          badge = document.createElement("b");
          bell.appendChild(badge);
        }
        if (badge) {
          badge.textContent = count ? String(count) : "";
          badge.hidden = !count;
        }
      }
      return;
    }

    // The Fauteuils screen owns a live text composer. Background home refreshes
    // must never replace its DOM while it is open, otherwise Android closes the
    // keyboard and the draft disappears.
    if (
      state.homeMode === "tableau" &&
      has("messages") &&
      root.querySelector("#hcTableauStipHost")
    ) {
      const bell = root.querySelector(".hc-tableau-bell"),
        count = notifications().length + Number(window.STIPMessagesUnread || 0);
      if (bell) {
        bell.setAttribute(
          "aria-label",
          `Notifications${count ? ` : ${count} à traiter` : ""}`,
        );
        let badge = bell.querySelector("b");
        if (count && !badge) {
          badge = document.createElement("b");
          bell.appendChild(badge);
        }
        if (badge) {
          badge.textContent = count ? String(count) : "";
          badge.hidden = !count;
        }
      }
      return;
    }

    const isTableau = state.homeMode === "tableau" && has("messages"),
      showProfile = state.homeMode === "planning",
      profileBreak = showProfile ? '<div class="hc-home-major-separator" aria-hidden="true"></div>' : "";
    let markup = `${homeModeNav()}${showProfile ? profile() + responsableAccessBlock() : ""}${profileBreak}<section class="hc-home-mode-content" data-home-mode-current="${esc(state.homeMode)}">${homeModeBody()}</section>`;
    if (isTableau) {
      markup = `<section class="hc-tableau-standalone" aria-label="Chat STIP — Fauteuils">
          <header class="hc-tableau-standalone-head">
            <button type="button" class="hc-tableau-back" data-home-mode="planning" aria-label="Retour à l’accueil"><span aria-hidden="true">‹</span><strong>Accueil</strong></button>
            <div class="hc-tableau-standalone-title"><strong>Chat STIP</strong><small>Fauteuils</small></div>
            <button type="button" class="hc-profile-bell hc-tableau-bell" data-home-mode="notifications" aria-pressed="false" aria-label="Notifications${notifications().length + Number(window.STIPMessagesUnread || 0) ? ` : ${notifications().length + Number(window.STIPMessagesUnread || 0)} à traiter` : ""}"><span aria-hidden="true">🔔</span>${notifications().length + Number(window.STIPMessagesUnread || 0) ? `<b>${notifications().length + Number(window.STIPMessagesUnread || 0)}</b>` : ""}</button>
          </header>
          <section class="hc-tableau-standalone-body">${homeModeBody()}</section>
        </section>`;
    }
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
          const next = b.dataset.homeMode || "planning",
            targetRoute = routeForHomeMode(next);
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
    if (state.homeMode === "team") bindEmbeddedTeam(root);
    if (state.homeMode === "tableau") {
      const tableauHost = root.querySelector("#hcTableauStipHost");
      const runtime = window.STIPTableau;
      if (!runtime || typeof runtime.mount !== "function") {
        if (tableauHost) {
          tableauHost.innerHTML =
            '<div class="tb-runtime-refresh">Mise à jour de Fauteuils…</div>';
        }
        try {
          const refreshKey = "stip_tableau_runtime_refresh_" + TABLEAU_BUILD;
          if (!sessionStorage.getItem(refreshKey)) {
            sessionStorage.setItem(refreshKey, "1");
            const url = new URL(location.href);
            url.searchParams.set("__stip_build", TABLEAU_BUILD);
            setTimeout(() => location.replace(url.pathname + url.search + url.hash), 60);
          }
        } catch {}
        return;
      }
      runtime.unmountPreview?.();
      runtime.mount?.(
        tableauHost,
        { focus: !!state.tableauFocus },
      );
      state.tableauFocus = false;
    } else {
      window.STIPTableau?.unmountFull?.();
      window.STIPTableau?.unmountPreview?.();
    }
    window.STIPTableau?.bindHomeButton?.(
      root.querySelector('[data-home-mode="tableau"]'),
    );
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
    if (k === "team") return window.STIPRouter?.set?.("team");
    if (k === "agents") return (location.href = "agent-directory.html");
    if (k === "change") return window.STIPHubs?.planning?.("change");
    if (k === "calendar") return window.STIPHubs?.planning?.("calendar");
    if (k === "compare") return (location.href = "planning-compare-app.html?from=home");
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
    state.bootStatus = "loading";
    state.bootError = "";
    startPlanningLoading();
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
          stopPlanningLoading();
          publishBoot(boot.value);
          prefetchContacts();
        } else {
          state.bootStatus = "error";
          stopPlanningLoading();
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
    loadDismissedNotifications();
    const routedRoute = window.STIPRouter?.get?.() || "home";
    if (routedRoute === "responsable") {
      location.replace("responsable.html");
      return;
    }
    const routedMode = homeModeForRoute(routedRoute);
    if (routedMode) state.homeMode = routedMode;
    try {
      const quick = new URLSearchParams(location.search).get("quick") || "",
        requested = sessionStorage.getItem("stip_home_mode_once");
      if (quick === "notifications" || quick === "exchange") {
        state.homeMode = "notifications";
      } else if ((quick === "tableau" || quick === "teamchat") && has("messages")) {
        state.homeMode = "tableau";
      } else if (requested === "notifications" || requested === "apps" || requested === "planning" || requested === "team" || requested === "responsable" || requested === "tableau") {
        state.homeMode = requested;
        sessionStorage.removeItem("stip_home_mode_once");
      }
    } catch {}
    state.bootStatus = "loading";
    state.bootError = "";
    startPlanningLoading();
    if (state.homeMode === "chat") state.homeMode = "tableau";
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
    stopPlanningLoading();
    state.home = { actions: [], notifications: [] };
    state.externalActions.clear();
    state.dismissedNotifications = {};
    state.actionFilter = "all";
    state.weekOffset = 0;
    state.weekFull = false;
    state.weekPast = false;
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
      av = a.profile_photo_url || media?.avatars?.[a.source_key] || a.avatar_signed_url || a.avatar_url || "";
    const ini = ((a.prenom?.[0] || "") + (a.nom?.[0] || "")).toUpperCase() || "ST";
    return `<section class="hc-profile"><div class="hc-avatar" data-avatar-fallback="${esc(ini)}">${av ? `<img src="${esc(av)}" alt="" loading="lazy">` : `<span>${esc(ini)}</span>`}</div><div class="hc-profile-copy"><small>${esc(label)}</small><strong>${esc(agentName(a))}</strong></div></section>`;
  };
  document.addEventListener("error", (event) => { const img = event.target; if (!(img instanceof HTMLImageElement)) return; const host = img.closest?.(".hc-avatar"); if (!host) return; host.textContent = host.dataset.avatarFallback || "ST"; }, true);
  window.addEventListener("stip:tableau-open", (event) => {
    if (!has("messages")) return;
    state.tableauFocus = !!event?.detail?.focus;
    if (window.STIPRouter?.set) {
      window.STIPRouter.set("fauteuils");
      return;
    }
    state.homeMode = "tableau";
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
    if (route === "responsable") {
      location.href = "responsable.html";
      return;
    }
    const next = homeModeForRoute(route);
    if (!next) return;
    if (next === "tableau" && !has("messages")) {
      window.STIPRouter?.set?.("home", { replace: true });
      return;
    }
    if (next === "team" && !(has("planning_team") || has("activity") || has("assistant_enabled"))) {
      window.STIPRouter?.set?.("home", { replace: true });
      return;
    }
    if (next === "responsable" && !has("responsable")) {
      window.STIPRouter?.set?.("home", { replace: true });
      return;
    }
    state.tableauFocus = false;
    if (state.homeMode === next) return;
    state.homeMode = next;
    state.renderSig = "";
    render();
  });
  window.addEventListener("stip:home-root", () => {
    if ((window.STIPRouter?.get?.() || "home") === "fauteuils") {
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
  }, 60000);
  if (window.STIPSession) ready({ detail: window.STIPSession });
})();