(() => {
  "use strict";

  const DATA_API = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-data";
  const MSG_API = "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-messages";
  const STORE = "stip_session_v1";
  const MONTHS = [
    "JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN",
    "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"
  ];

  const state = {
    loaded: false,
    loading: null,
    bootstrap: null,
    agent: null,
    items: [],
    events: [],
    months: [],
    monthKey: "",
    weekStart: "",
    collective: [],
    messageableIds: new Set(),
    messageUnread: 0,
    collectiveFilter: "all",
    collectiveQuery: "",
    collectiveLoaded: false
  };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);

  const token = () => localStorage.getItem(STORE) || "";

  async function post(url, action, body = {}) {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-STIP-Session": token()
      },
      body: JSON.stringify({ action, ...body })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw Error(typeof data.error === "string" ? data.error : `Erreur ${response.status}`);
    return data;
  }

  function parisParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      hourCycle: "h23", timeZone: "Europe/Paris"
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      month: `${get("year")}-${get("month")}`,
      minutes: Number(get("hour")) * 60 + Number(get("minute"))
    };
  }

  const today = () => parisParts().date;
  const currentMonth = () => parisParts().month;

  function dateObj(key) {
    return new Date(`${key}T12:00:00Z`);
  }

  function addDays(key, amount) {
    const date = dateObj(key);
    date.setUTCDate(date.getUTCDate() + Number(amount || 0));
    return date.toISOString().slice(0, 10);
  }

  function mondayOf(key) {
    const date = dateObj(key);
    const offset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString().slice(0, 10);
  }

  function validItem(item) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(item?.date || "")) && !!String(item?.code || item?.source_value || "").trim();
  }

  function itemFor(dateKey) {
    return state.items.find((item) => String(item.date) === dateKey) || null;
  }

  function shiftDef(rawCode) {
    const code = String(rawCode || "").trim().toUpperCase();
    if (!code) return null;
    return window.STIPShiftRegistry?.resolve?.(code) || state.bootstrap?.shift_definitions?.find((row) => String(row.code || "").toUpperCase() === code) || null;
  }

  function shiftCode(item) {
    const raw = String(item?.code || item?.source_value || "").trim();
    const def = shiftDef(raw);
    return String(def?.base_code || def?.code || raw || "—").trim().toUpperCase();
  }

  function hhmm(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
  }

  function fallbackTimes(item) {
    const raw = [item?.source_value, item?.observation].filter(Boolean).join(" ");
    const match = raw.match(/\b(\d{1,2})[h:]([0-5]\d)\s*(?:→|–|-|a|à)\s*(\d{1,2})[h:]([0-5]\d)\b/i);
    if (!match) return null;
    return { start: `${match[1].padStart(2, "0")}:${match[2]}`, end: `${match[3].padStart(2, "0")}:${match[4]}` };
  }

  function shiftTimes(item) {
    const def = shiftDef(item?.code || item?.source_value);
    const start = hhmm(def?.start_time);
    const end = hhmm(def?.end_time);
    if (start || end) return { start, end, label: start && end ? `${start} → ${end}` : start || end };
    const fallback = fallbackTimes(item);
    if (fallback) return { ...fallback, label: `${fallback.start} → ${fallback.end}` };
    return { start: "", end: "", label: "Horaire non renseigné" };
  }

  function isWorking(item) {
    if (!item) return false;
    const def = shiftDef(item.code || item.source_value);
    if (typeof def?.is_working === "boolean") return def.is_working;
    const code = shiftCode(item);
    return !["R", "RH", "RC", "CP", "CA", "RTT", "OFF", "REPOS"].includes(code);
  }

  function shiftVisual(item) {
    if (!item) return '<span class="metiers-shift-empty">—</span>';
    const code = String(item.code || item.source_value || "").trim().toUpperCase();
    const def = shiftDef(code);
    const icon = window.STIPShiftRegistry?.icon?.(code) || def?.icon || "";
    const badge = window.STIPMonthTable?.shiftBadgeHtml?.(code) || "";
    if (badge && isWorking(item)) return badge;
    if (icon) return `<span class="metiers-shift-icon" title="${esc(def?.label || code)}">${esc(icon)}</span>`;
    return `<span class="metiers-shift-fallback">${esc(shiftCode(item))}</span>`;
  }

  function normalizeEvents(data) {
    const events = [];
    for (const row of data.agenda_items || []) {
      const date = String(row.event_date || "").slice(0, 10);
      if (!date) continue;
      events.push({
        date,
        title: String(row.title || "Événement"),
        icon: String(row.icon || "📌"),
        time: row.all_day ? "Toute la journée" : [hhmm(row.start_time), hhmm(row.end_time)].filter(Boolean).join(" → "),
        location: String(row.location || ""),
        detail: String(row.body || ""),
        kind: String(row.event_kind || "agenda")
      });
    }
    for (const row of data.personal_formations || []) {
      const date = String(row.date_debut || "").slice(0, 10);
      if (!date) continue;
      events.push({
        date,
        title: String(row.intitule || "Formation"),
        icon: "🎓",
        time: String(row.horaire || ""),
        location: String(row.lieu || ""),
        detail: "",
        kind: "formation"
      });
    }
    for (const row of data.personal_stagiaires || []) {
      const date = String(row.date_debut || "").slice(0, 10);
      if (!date) continue;
      events.push({
        date,
        title: `Stagiaire · ${[row.prenom, row.nom].filter(Boolean).join(" ").trim()}`,
        icon: "👶",
        time: String(row.horaires || ""),
        location: "",
        detail: "Référent",
        kind: "stagiaire"
      });
    }
    return events.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }

  function eventsFor(dateKey) {
    return state.events.filter((event) => event.date === dateKey);
  }

  function dayState(dateKey, item) {
    const now = parisParts();
    if (dateKey < now.date) return "Terminé";
    if (dateKey > now.date) return "À venir";
    if (!item || !isWorking(item)) return item ? "Repos" : "Non renseigné";
    const times = shiftTimes(item);
    const parse = (value) => {
      const m = String(value || "").match(/^(\d{2}):(\d{2})$/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    const start = parse(times.start), end = parse(times.end);
    if (start == null || end == null) return "Aujourd’hui";
    if (start <= end) {
      if (now.minutes < start) return `Dans ${Math.max(1, Math.round((start - now.minutes) / 60))} h`;
      if (now.minutes <= end) return "En cours";
      return "Terminé";
    }
    if (now.minutes >= start || now.minutes <= end) return "En cours";
    return "Aujourd’hui";
  }

  function formatDay(dateKey, options = {}) {
    const date = dateObj(dateKey);
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: options.long ? "long" : "short",
      day: "numeric",
      month: options.long ? "long" : "short",
      year: options.year ? "numeric" : undefined,
      timeZone: "UTC"
    }).format(date).replaceAll(".", "");
  }

  function buildMonths() {
    state.months = [...new Set(state.items.filter(validItem).map((item) => String(item.date).slice(0, 7)))].sort();
    const current = currentMonth();
    state.monthKey = state.months.includes(current) ? current : state.months.find((month) => month > current) || state.months.at(-1) || current;
  }

  function homeStatus() {
    const dateKey = today();
    const item = itemFor(dateKey);
    const times = item ? shiftTimes(item) : null;
    const events = eventsFor(dateKey);
    const nextEvent = state.events.find((event) => event.date >= dateKey);
    return { item, times, events, nextEvent };
  }

  function avatarUrl(agent = {}) {
    return agent.profile_photo_url || agent.avatar_url || state.bootstrap?.media?.avatars?.[agent.source_key] || "";
  }

  function renderHomeStrip() {
    const host = document.getElementById("metiersHomeStrip");
    if (!host || !state.agent) return;
    const { item, times, events, nextEvent } = homeStatus();
    const name = [state.agent.prenom, state.agent.nom].filter(Boolean).join(" ").trim() || "Mon espace";
    const role = state.agent.role || state.agent.identity_kind || "Professionnel";
    const place = state.agent.ghe ? `GHE ${state.agent.ghe}` : "";
    const avatar = avatarUrl(state.agent);
    const initials = `${state.agent.prenom?.[0] || ""}${state.agent.nom?.[0] || ""}`.toUpperCase() || "ST";
    const status = item
      ? `${shiftCode(item)} · ${times?.label || "Horaire non renseigné"}`
      : "Planning du jour non renseigné";
    const alert = events[0] || (nextEvent && nextEvent.date <= addDays(today(), 2) ? nextEvent : null);

    host.innerHTML = `<section class="metiers-identity-card">
      <div class="metiers-avatar">${avatar ? `<img src="${esc(avatar)}" alt="">` : esc(initials)}</div>
      <div class="metiers-identity-copy">
        <small>MON ACCUEIL</small>
        <strong>${esc(name)}</strong>
        <span>${esc([role, place].filter(Boolean).join(" · "))}</span>
      </div>
      <a class="metiers-account" href="/mon-compte.html" aria-label="Mon compte">›</a>
    </section>
    <section class="metiers-now-card">
      <div><small>AUJOURD’HUI</small><strong>${esc(status)}</strong><span>${esc(dayState(today(), item))}</span></div>
      ${alert ? `<button type="button" class="metiers-alert" data-open-day="${esc(alert.date)}"><span>${esc(alert.icon || "!")}</span><div><small>À NE PAS MANQUER</small><strong>${esc(alert.title)}</strong><em>${esc([formatDay(alert.date), alert.time].filter(Boolean).join(" · "))}</em></div></button>` : ""}
    </section>
    <div class="metiers-home-actions">
      <button type="button" data-open-messages><span aria-hidden="true">🔔</span><strong>Messages</strong>${state.messageUnread ? `<b class="metiers-home-badge">${Math.min(99, state.messageUnread)}</b>` : ""}</button>
      <button type="button" data-go-today><span aria-hidden="true">◎</span><strong>Aujourd’hui</strong></button>
    </div>`;
  }

  async function loadMessagingSummary() {
    if (!state.bootstrap?.permissions?.messages) return;
    try {
      const messages = await post(MSG_API, "home");
      state.messageUnread = Number(messages.unread || 0);
      state.messageableIds = new Set((messages.agents || []).map((agent) => String(agent.id || "")).filter(Boolean));
      renderHomeStrip();
    } catch {}
  }

  function weekMarkup() {
    const start = state.weekStart || mondayOf(today());
    const end = addDays(start, 6);
    const relative = start === mondayOf(today()) ? "CETTE SEMAINE" : start > mondayOf(today()) ? "SEMAINE SUIVANTE" : "SEMAINE PRÉCÉDENTE";
    const cards = Array.from({ length: 7 }, (_, index) => {
      const dateKey = addDays(start, index);
      const item = itemFor(dateKey);
      const events = eventsFor(dateKey);
      const times = item ? shiftTimes(item) : null;
      const date = dateObj(dateKey);
      const dayName = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(date).replace(".", "").toUpperCase();
      const status = dayState(dateKey, item);
      return `<article class="metiers-week-day${dateKey === today() ? " is-today" : ""}${!isWorking(item) ? " is-rest" : ""}">
        <header><span>${esc(dayName)}</span><b>${date.getUTCDate()}</b><em>${esc(status)}</em></header>
        <button type="button" class="metiers-week-shift" data-open-day="${dateKey}">
          <span class="metiers-week-shift-visual">${shiftVisual(item)}</span>
          <span class="metiers-week-shift-copy"><strong>${esc(item ? shiftDef(item.code || item.source_value)?.label || shiftCode(item) : "Non renseigné")}</strong><b>${esc(times?.label || "Aucun horaire")}</b></span>
          <span aria-hidden="true">›</span>
        </button>
        <div class="metiers-week-events">
          ${events.length ? events.map((event) => `<button type="button" data-open-day="${dateKey}" class="metiers-week-event"><span>${esc(event.icon || "•")}</span><div><strong>${esc(event.title)}</strong>${event.time ? `<small>${esc(event.time)}</small>` : ""}</div></button>`).join("") : `<span class="metiers-week-no-event">Aucun événement</span>`}
        </div>
      </article>`;
    }).join("");

    return `<section class="metiers-week-card" data-week-swipe>
      <header class="metiers-period-nav">
        <button type="button" data-week-step="-1" aria-label="Semaine précédente">‹</button>
        <div><small>${relative}</small><strong>${esc(formatDay(start))} — ${esc(formatDay(end))}</strong></div>
        <button type="button" data-week-step="1" aria-label="Semaine suivante">›</button>
      </header>
      <div class="metiers-week-list">${cards}</div>
    </section>`;
  }

  function renderWeek() {
    const host = document.getElementById("metiersWeekHost");
    if (!host) return;
    host.innerHTML = weekMarkup();
    bindSwipe(host.querySelector("[data-week-swipe]"), (direction) => moveWeek(direction));
  }

  function moveWeek(step) {
    state.weekStart = addDays(state.weekStart || mondayOf(today()), Number(step) * 7);
    renderWeek();
  }

  function monthMarkup(key) {
    const [year, month] = key.split("-").map(Number);
    const byDate = new Map(state.items.filter((item) => String(item.date || "").startsWith(key)).map((item) => [String(item.date), item]));
    const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
    const index = state.months.indexOf(key);
    let working = 0, rest = 0, eventCount = 0, cells = "";
    const currentDay = today();

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${key}-${String(day).padStart(2, "0")}`;
      const item = byDate.get(dateKey) || null;
      const events = eventsFor(dateKey);
      if (item) isWorking(item) ? working++ : rest++;
      eventCount += events.length;
      const dow = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
      const weekend = dow === 0 || dow === 6;
      cells += `<button type="button" class="stip-month-day metiers-month-day${weekend ? " is-weekend" : ""}${dateKey === currentDay ? " is-today" : ""}${events.length ? " has-event" : ""}" data-stip-date="${dateKey}" data-open-day="${dateKey}">
        <b class="stip-month-day-number">${day}</b>
        <div class="stip-month-primary">${shiftVisual(item)}</div>
        <div class="stip-month-events metiers-month-event-dots" aria-label="${events.length} événement(s)">${events.slice(0, 3).map((event) => `<i>${esc(event.icon || "•")}</i>`).join("")}</div>
      </button>`;
    }

    return `<section class="stip-month-calendar metiers-month-card" data-month-swipe aria-label="Calendrier du mois">
      <header class="stip-month-nav metiers-period-nav">
        <button type="button" data-month-step="-1" aria-label="Mois précédent" ${index <= 0 ? "disabled" : ""}>‹</button>
        <div><small>MON MOIS</small><strong>${MONTHS[month - 1]} ${year}</strong></div>
        <button type="button" data-month-step="1" aria-label="Mois suivant" ${index < 0 || index >= state.months.length - 1 ? "disabled" : ""}>›</button>
      </header>
      <div class="metiers-month-summary"><span><b>${working}</b> travaillés</span><span><b>${rest}</b> repos</span><span><b>${eventCount}</b> événements</span></div>
      <div class="stip-month-grid">${cells}</div>
    </section>`;
  }

  function renderMonth() {
    const host = document.getElementById("metiersMonthHost");
    if (!host) return;
    host.innerHTML = monthMarkup(state.monthKey);
    // Le moteur commun compose les semaines et aligne les dates ISO.
    window.STIPMonthTable?.enhance?.(host);
    bindSwipe(host.querySelector("[data-month-swipe]"), (direction) => moveMonth(direction));
  }

  function moveMonth(step) {
    const current = state.months.indexOf(state.monthKey);
    const next = current + Number(step || 0);
    if (current < 0 || next < 0 || next >= state.months.length) return;
    state.monthKey = state.months[next];
    renderMonth();
  }

  function bindSwipe(element, onSwipe) {
    if (!element) return;
    let startX = 0, startY = 0;
    element.addEventListener("touchstart", (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });
    element.addEventListener("touchend", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const dx = touch.clientX - startX, dy = touch.clientY - startY;
      if (Math.abs(dx) < 52 || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
      onSwipe(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function openDay(dateKey) {
    const root = document.getElementById("metiersDayDetailRoot");
    if (!root) return;
    const item = itemFor(dateKey);
    const events = eventsFor(dateKey);
    const times = item ? shiftTimes(item) : null;
    const def = item ? shiftDef(item.code || item.source_value) : null;
    root.innerHTML = `<div class="metiers-day-overlay" role="presentation">
      <button class="metiers-day-backdrop" type="button" data-close-day aria-label="Fermer"></button>
      <section class="metiers-day-sheet" role="dialog" aria-modal="true" aria-label="Détail du ${esc(formatDay(dateKey, { long: true, year: true }))}">
        <div class="metiers-day-handle" aria-hidden="true"></div>
        <header><div><small>JOURNÉE</small><strong>${esc(formatDay(dateKey, { long: true, year: true }))}</strong></div><button type="button" data-close-day>×</button></header>
        <button type="button" class="metiers-day-shift" disabled>
          <span>${shiftVisual(item)}</span>
          <div><small>${esc(dayState(dateKey, item))}</small><strong>${esc(item ? def?.label || shiftCode(item) : "Planning non renseigné")}</strong><b>${esc(times?.label || "Aucun horaire")}</b></div>
        </button>
        ${item?.observation ? `<p class="metiers-day-note">${esc(item.observation)}</p>` : ""}
        <div class="metiers-day-events">
          <small>ÉVÉNEMENTS</small>
          ${events.length ? events.map((event) => `<article><span>${esc(event.icon || "•")}</span><div><strong>${esc(event.title)}</strong><small>${esc([event.time, event.location].filter(Boolean).join(" · "))}</small>${event.detail ? `<p>${esc(event.detail)}</p>` : ""}</div></article>`).join("") : "<p>Aucun événement pour cette journée.</p>"}
        </div>
      </section>
    </div>`;
    document.documentElement.classList.add("metiers-sheet-open");
  }

  function closeDay() {
    document.getElementById("metiersDayDetailRoot")?.replaceChildren();
    document.documentElement.classList.remove("metiers-sheet-open");
  }

  function collectiveStatus(person) {
    if (person.present_now) {
      return { className: "is-present", label: "Présent maintenant", detail: [person.current_start, person.current_end].filter(Boolean).join(" → ") };
    }
    if (person.work_today) {
      return { className: "is-today", label: "Travaille aujourd’hui", detail: [person.today_start, person.today_end].filter(Boolean).join(" → ") };
    }
    if (person.next_date) {
      const tomorrow = person.next_date === addDays(today(), 1);
      return { className: "", label: tomorrow ? "Travaille demain" : `Prochaine présence · ${formatDay(person.next_date)}`, detail: person.next_start || "" };
    }
    return { className: "", label: "Planning non renseigné", detail: "" };
  }

  function sameRole(person) {
    const a = String(state.agent?.role || state.agent?.type_planning || "").trim().toLowerCase();
    const b = String(person.role || person.type_planning || "").trim().toLowerCase();
    return !!a && a === b;
  }

  function sameService(person) {
    const a = String(state.agent?.ghe || state.agent?.equipe || "").trim().toLowerCase();
    const b = String(person.ghe || person.equipe || "").trim().toLowerCase();
    return !!a && a === b;
  }

  function collectiveFiltered() {
    const q = state.collectiveQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return state.collective.filter((person) => {
      if (state.collectiveFilter === "role" && !sameRole(person)) return false;
      if (state.collectiveFilter === "service" && !sameService(person)) return false;
      if (state.collectiveFilter === "present" && !person.present_now) return false;
      if (!q) return true;
      const hay = [person.prenom, person.nom, person.role, person.ghe, person.equipe].filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return hay.includes(q);
    });
  }

  function renderCollective() {
    const host = document.getElementById("metiersCollectiveHost");
    if (!host) return;
    if (!state.collectiveLoaded) {
      host.innerHTML = '<div class="metiers-loading">Chargement du collectif…</div>';
      return;
    }
    const rows = collectiveFiltered();
    host.innerHTML = `<section class="metiers-collective-card">
      <header class="metiers-collective-head"><div><small>COLLECTIF</small><strong>Qui est là ?</strong><p>Présence utile, sans exposer les détails du planning.</p></div><b>${state.collective.filter((person) => person.present_now).length} présent(s)</b></header>
      <label class="metiers-collective-search"><span aria-hidden="true">⌕</span><input type="search" value="${esc(state.collectiveQuery)}" placeholder="Rechercher une personne, un métier, un service…" data-collective-search></label>
      <div class="metiers-collective-filters" role="group" aria-label="Filtres du collectif">
        ${[["all", "Tous"], ["role", "Mon métier"], ["service", "Mon service"], ["present", "Présents maintenant"]].map(([key, label]) => `<button type="button" data-collective-filter="${key}" aria-pressed="${String(state.collectiveFilter === key)}">${label}</button>`).join("")}
      </div>
      <div class="metiers-collective-list">
        ${rows.length ? rows.map((person) => {
          const name = [person.prenom, person.nom].filter(Boolean).join(" ").trim() || "Professionnel";
          const role = person.role || person.type_planning || "Professionnel";
          const place = person.ghe ? `GHE ${person.ghe}` : person.equipe || "";
          const status = collectiveStatus(person);
          const avatar = person.profile_photo_url || person.avatar_url || state.bootstrap?.media?.avatars?.[person.source_key] || "";
          const initials = `${person.prenom?.[0] || ""}${person.nom?.[0] || ""}`.toUpperCase() || "ST";
          const isMe = String(person.id || "") === String(state.agent?.id || "");
          const canMessage = !isMe && state.messageableIds.has(String(person.id || ""));
          return `<article class="metiers-person-card ${status.className}">
            <div class="metiers-person-avatar">${avatar ? `<img src="${esc(avatar)}" alt="">` : esc(initials)}</div>
            <div class="metiers-person-copy"><strong>${esc(name)}${isMe ? " · Moi" : ""}</strong><small>${esc([role, place].filter(Boolean).join(" · "))}</small><span><i></i>${esc(status.label)}${status.detail ? ` · ${esc(status.detail)}` : ""}</span></div>
            ${canMessage ? `<button type="button" class="metiers-person-message" data-message-agent="${esc(person.id)}" aria-label="Écrire à ${esc(name)}">✉</button>` : ""}
          </article>`;
        }).join("") : '<p class="metiers-collective-empty">Aucune personne ne correspond à ce filtre.</p>'}
      </div>
    </section>`;
  }

  async function loadCollective() {
    if (state.collectiveLoaded) return renderCollective();
    const host = document.getElementById("metiersCollectiveHost");
    if (host) host.innerHTML = '<div class="metiers-loading">Chargement du collectif…</div>';
    try {
      const collective = await post(DATA_API, "collective_public");
      state.collective = Array.isArray(collective.items) ? collective.items : [];
      try {
        const messages = await post(MSG_API, "home");
        state.messageableIds = new Set((messages.agents || []).map((agent) => String(agent.id || "")).filter(Boolean));
      } catch {
        state.messageableIds = new Set();
      }
      state.collectiveLoaded = true;
      renderCollective();
    } catch (error) {
      if (host) host.innerHTML = `<div class="metiers-error">${esc(error.message || "Collectif indisponible.")}</div>`;
    }
  }

  function selectPeriod(period) {
    document.querySelectorAll("[data-period]").forEach((button) => {
      const active = button.dataset.period === period;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== period;
    });
    if (period === "week") renderWeek();
    if (period === "month") renderMonth();
    if (period === "collective") loadCollective();
  }

  async function load() {
    if (state.loaded) return;
    if (state.loading) return state.loading;
    state.loading = (async () => {
      if (!token()) {
        location.replace("/");
        return;
      }
      const data = await post(DATA_API, "bootstrap");
      state.bootstrap = data;
      state.agent = data.agent || {};
      state.items = (data.personal || data.items || []).filter(validItem);
      state.events = normalizeEvents(data);
      state.weekStart = mondayOf(today());
      if (data.shift_definitions) window.STIPShiftRegistry?.set?.(data.shift_definitions);
      window.STIPBootCache = data;
      window.STIPSession = { agent: state.agent, permissions: data.permissions || {} };
      window.STIPAccess = window.STIPAccess || { has: (key) => !!data.permissions?.[key] };
      buildMonths();
      state.loaded = true;
      renderHomeStrip();
      renderWeek();
      loadMessagingSummary();
    })().catch((error) => {
      const strip = document.getElementById("metiersHomeStrip");
      if (strip) strip.innerHTML = `<div class="metiers-error">${esc(error.message || "Chargement impossible.")}</div>`;
      throw error;
    }).finally(() => { state.loading = null; });
    return state.loading;
  }

  document.addEventListener("click", (event) => {
    const tab = event.target.closest?.("[data-period]");
    if (tab) return selectPeriod(tab.dataset.period);

    const day = event.target.closest?.("[data-open-day]");
    if (day) return openDay(day.dataset.openDay);

    if (event.target.closest?.("[data-close-day]")) return closeDay();

    const week = event.target.closest?.("[data-week-step]");
    if (week) return moveWeek(Number(week.dataset.weekStep || 0));

    const month = event.target.closest?.("[data-month-step]");
    if (month && !month.disabled) return moveMonth(Number(month.dataset.monthStep || 0));

    if (event.target.closest?.("[data-go-today]")) {
      state.weekStart = mondayOf(today());
      const current = currentMonth();
      if (state.months.includes(current)) state.monthKey = current;
      return selectPeriod("week");
    }

    if (event.target.closest?.("[data-open-messages]")) {
      if (window.STIPCommunication?.openExchanges) return window.STIPCommunication.openExchanges();
      location.href = "/?mode=notifications";
      return;
    }

    const filter = event.target.closest?.("[data-collective-filter]");
    if (filter) {
      state.collectiveFilter = filter.dataset.collectiveFilter || "all";
      return renderCollective();
    }

    const message = event.target.closest?.("[data-message-agent]");
    if (message) {
      const id = message.dataset.messageAgent || "";
      if (id && window.STIPCommunication?.openDirect) window.STIPCommunication.openDirect(id);
    }
  });

  document.addEventListener("input", (event) => {
    const input = event.target.closest?.("[data-collective-search]");
    if (!input) return;
    state.collectiveQuery = input.value || "";
    renderCollective();
    const next = document.querySelector("[data-collective-search]");
    if (next) {
      next.focus({ preventScroll: true });
      next.setSelectionRange(next.value.length, next.value.length);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.querySelector(".metiers-day-overlay")) closeDay();
  });

  load();
})();
