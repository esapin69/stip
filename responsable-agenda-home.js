(() => {
  "use strict";

  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-dates",
    STAFF_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-staffing",
    ASSIST_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-assistant",
    STORE = "stip_session_v1",
    $ = (s) => document.querySelector(s),
    DAY_MS = 86400000;

  const state = {
    items: [],
    loading: false,
    error: "",
    weekOffset: 0,
    selectedDate: "",
    monthKey: "",
    daySignalByDate: {},
    signalWeekLoaded: {},
    signalWeekPromises: {},
  };

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

  function dateObj(v) {
    return new Date(String(v || "").slice(0, 10) + "T12:00:00");
  }

  function localIso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function monthKeyOf(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function mondayOf(d) {
    const x = new Date(d),
      dow = x.getDay() || 7;
    x.setDate(x.getDate() - (dow - 1));
    x.setHours(12, 0, 0, 0);
    return x;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function categoryLabel(k) {
    return (
      {
        medical: "Visite médicale",
        intern: "Stagiaire",
        training: "Formation",
      }[k] || "Événement"
    );
  }

  function categoryIcon(k) {
    return { medical: "🩺", intern: "👶", training: "🎓" }[k] || "📌";
  }

  function categoryClass(k) {
    return ["medical", "intern", "training"].includes(k) ? k : "other";
  }

  function normalizeItem(x = {}) {
    const category = categoryClass(String(x.category || "").toLowerCase()),
      sourceId = String(x.source_id || "").trim(),
      id = String(
        x.id ||
          sourceId ||
          `${category}:${x.date || ""}:${x.person_name || ""}`,
      );
    return {
      ...x,
      id,
      source_id: sourceId,
      category,
      date: String(x.date || "").slice(0, 10),
      person_name: String(x.person_name || "Agent").trim(),
      title: String(x.title || categoryLabel(category)).trim(),
      time: String(x.time || "").trim(),
      location: String(x.location || "").trim(),
      referent: String(x.meta?.referent || "").trim(),
      icon: categoryIcon(category),
    };
  }

  function sortedItems() {
    return [...state.items].sort(
      (a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        String(a.time || "99:99").localeCompare(String(b.time || "99:99")) ||
        String(a.person_name).localeCompare(String(b.person_name), "fr"),
    );
  }

  function itemsForDate(iso) {
    return sortedItems().filter((x) => x.date === iso);
  }

  function markerGroups(events = []) {
    const order = ["medical", "intern", "training", "other"],
      grouped = new Map();
    for (const event of events) {
      const key = categoryClass(event.category);
      if (!grouped.has(key))
        grouped.set(key, {
          category: key,
          icon: event.icon || categoryIcon(key),
          count: 0,
        });
      grouped.get(key).count += 1;
    }
    return [...grouped.values()].sort(
      (a, b) => order.indexOf(a.category) - order.indexOf(b.category),
    );
  }

  function markerMarkup(events = [], date = "") {
    return markerGroups(events)
      .map(({ category, icon, count }) => {
        const label = categoryLabel(category),
          badge =
            count > 1
              ? `<em class="rr-marker-count" aria-hidden="true">×${count}</em>`
              : "";
        return `<i class="rr-marker type-${esc(category)}" data-rr-filter="${esc(category)}" data-rr-date="${esc(date)}" title="${esc(label)}${count > 1 ? ` ×${count}` : ""}"><span aria-hidden="true">${esc(icon)}</span>${badge}</i>`;
      })
      .join("");
  }

  function weekMarkerMarkup(events = [], date = "") {
    return events
      .map((event) => {
        const category = categoryClass(event.category),
          label = categoryLabel(category),
          icon = event.icon || categoryIcon(category),
          person = String(event.person_name || "").trim(),
          title = person ? `${label} · ${person}` : label;
        return `<i class="rr-marker type-${esc(category)}" data-rr-filter="${esc(category)}" data-rr-date="${esc(date)}" title="${esc(title)}"><span aria-hidden="true">${esc(icon)}</span></i>`;
      })
      .join("");
  }

  function dayDelta(iso) {
    return Math.round((dateObj(iso) - dateObj(parisIso())) / DAY_MS);
  }

  function relativeLabel(iso) {
    const d = dayDelta(iso);
    if (d === 0) return "AUJOURD’HUI";
    if (d === 1) return "DEMAIN";
    if (d === 2) return "APRÈS-DEMAIN";
    if (d > 2 && d < 7) return `DANS ${d} JOURS`;
    return dateObj(iso)
      .toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
      .toUpperCase();
  }

  function fmtShortDate(iso) {
    return dateObj(iso)
      .toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
      .replace(/\./g, "");
  }

  function weekDays() {
    const base = addDays(
      mondayOf(dateObj(parisIso())),
      state.weekOffset * 7,
    );
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(base, i);
      return { d, iso: localIso(d) };
    });
  }

  function weekRangeLabel(days = weekDays()) {
    const first = days[0]?.d,
      last = days.at(-1)?.d;
    if (!first || !last) return "";
    const sameMonth =
      first.getMonth() === last.getMonth() &&
      first.getFullYear() === last.getFullYear();
    const month = (d, short = false) =>
      d
        .toLocaleDateString("fr-FR", {
          month: short ? "short" : "long",
        })
        .replace(/\./g, "");
    if (sameMonth)
      return `${first.getDate()} → ${last.getDate()} ${month(last)}`;
    return `${first.getDate()} ${month(first, true)} → ${last.getDate()} ${month(last, true)}`;
  }

  function weekSeparatorLabel() {
    if (state.weekOffset === 0) return "CETTE SEMAINE";
    if (state.weekOffset === 1) return "SEMAINE PROCHAINE";
    if (state.weekOffset === -1) return "SEMAINE PRÉCÉDENTE";
    return "SEMAINE SÉLECTIONNÉE";
  }

  function eventCard(x) {
    const sub = [x.location || x.title].filter(Boolean).join(" · "),
      relation = x.referent
        ? `<b class="rr-event-referent">Référent : ${esc(x.referent)}</b>`
        : "";
    return `<button class="rr-event-card type-${esc(x.category)}" type="button" data-rr-event="${esc(x.id)}"><span class="rr-event-icon" aria-hidden="true">${esc(x.icon)}</span><span class="rr-event-copy"><strong>${esc(x.person_name)}</strong><span class="rr-event-meta"><b>${esc(fmtShortDate(x.date))}</b>${x.time ? `<b class="rr-event-time">${esc(x.time)}</b>` : ""}</span>${relation}${sub ? `<small>${esc(sub)}</small>` : ""}</span><span class="rr-event-chevron" aria-hidden="true">›</span></button>`;
  }

  function renderUpcoming() {
    const host = $("#rrUpcoming");
    if (!host) return;
    const today = parisIso(),
      future = sortedItems().filter((x) => x.date >= today).slice(0, 4);
    if (!future.length) {
      host.innerHTML =
        '<div class="rr-empty">Aucune date d’agent à venir.</div>';
      return;
    }
    let lastDate = "";
    host.innerHTML = future
      .map((x) => {
        const sep =
          x.date !== lastDate
            ? `<div class="rr-period-separator"><span>${esc(relativeLabel(x.date))}</span></div>`
            : "";
        lastDate = x.date;
        return sep + eventCard(x);
      })
      .join("");
  }

  function weekCounts(days = weekDays()) {
    const dates = new Set(days.map((x) => x.iso)),
      counts = { medical: 0, intern: 0, training: 0 };
    for (const item of state.items) {
      if (dates.has(item.date) && Object.hasOwn(counts, item.category))
        counts[item.category] += 1;
    }
    return counts;
  }

  function weekSummary(days = weekDays()) {
    const c = weekCounts(days),
      parts = [];
    if (c.medical) parts.push(`🩺 ${c.medical} visite${c.medical > 1 ? "s" : ""}`);
    if (c.intern) parts.push(`👶 ${c.intern} stagiaire${c.intern > 1 ? "s" : ""}`);
    if (c.training) parts.push(`🎓 ${c.training} formation${c.training > 1 ? "s" : ""}`);
    return parts.join(" · ") || "Aucune date particulière cette semaine";
  }

  function statusSymbol(level, fallback = "") {
    if (level === "opportunity") return "+";
    if (level === "ok") return "✔";
    if (level === "warning") return "⚠️";
    if (level === "critical") return "🛑";
    return fallback || "○";
  }

  function pageLegendHtml() {
    const today = parisIso(),
      weekDaysNow = weekDays(),
      week = new Set(weekDaysNow.map((x) => x.iso)),
      month = state.monthKey || today.slice(0, 7),
      upcoming = sortedItems().filter((x) => x.date >= today).slice(0, 4),
      visible = [
        ...upcoming,
        ...state.items.filter((x) => week.has(x.date) || x.date.startsWith(month)),
      ],
      categories = new Set(visible.map((x) => categoryClass(x.category))),
      signalLevels = new Set(
        weekDaysNow
          .map(({ iso }) => signalForDate(iso)?.level)
          .filter((level) => level && level !== "unknown"),
      ),
      items = [];

    for (const category of ["medical", "intern", "training", "other"]) {
      if (!categories.has(category)) continue;
      items.push(
        `<span><i>${esc(categoryIcon(category))}</i><b>${esc(categoryLabel(category))}</b></span>`,
      );
    }
    if (signalLevels.has("critical"))
      items.push("<span><i>🛑</i><b>Journée tendue</b></span>");
    if (signalLevels.has("warning"))
      items.push("<span><i>⚠️</i><b>À surveiller</b></span>");
    if (signalLevels.has("opportunity"))
      items.push("<span><i>+</i><b>Présence plus large</b></span>");
    if (signalLevels.has("ok"))
      items.push("<span><i>✔</i><b>Rien ne coince</b></span>");
    return (
      items.join("") ||
      '<span><i>○</i><b>Aucun repère affiché</b></span>'
    );
  }

  function signalForDate(date) {
    return state.daySignalByDate[date] || null;
  }

  async function postWeekJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-stip-session": localStorage.getItem(STORE) || "",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error)
      throw Error(
        typeof data?.error === "string"
          ? data.error
          : data?.error?.message || `Erreur ${response.status}`,
      );
    return data;
  }

  async function loadWeekImpact() {
    const days = weekDays(),
      start = days[0]?.iso || "",
      end = days.at(-1)?.iso || "",
      key = `${start}|${end}`;
    if (!start || !end || state.signalWeekLoaded[key]) return;
    if (state.signalWeekPromises[key]) return state.signalWeekPromises[key];

    state.signalWeekPromises[key] = (async () => {
      let assistantItems = [];
      try {
        const assistant = await postWeekJson(ASSIST_API, {
          action: "feed",
          start_date: start,
          end_date: end,
        });
        assistantItems = Array.isArray(assistant?.items) ? assistant.items : [];
      } catch {
        assistantItems = [];
      }

      await Promise.all(
        days.map(async ({ iso }) => {
          let staff = null;
          try {
            staff = await postWeekJson(STAFF_API, { action: "day", date: iso });
          } catch {
            staff = null;
          }
          const items = assistantItems.filter(
              (item) => String(item?.date || "").slice(0, 10) === iso,
            ),
            shared = window.STIPFieldIntel?.dayStatus?.({
              staffing: staff,
              items,
            });
          state.daySignalByDate[iso] =
            shared ||
            (staff?.available
              ? { level: "ok", symbol: "✔", label: "Rien ne coince" }
              : { level: "unknown", symbol: "", label: "Pas assez de données" });
        }),
      );
      state.signalWeekLoaded[key] = true;
      delete state.signalWeekPromises[key];
      renderWeek();
      renderMonth();
    })().catch(() => {
      delete state.signalWeekPromises[key];
    });

    return state.signalWeekPromises[key];
  }

  function syncProControls() {
    const pro =
      String(document.documentElement.dataset.responsableLevel || "") === "pro";
    document
      .querySelectorAll("[data-rr-add]")
      .forEach((button) => (button.hidden = !pro));
  }

  function renderWeek() {
    const host = $("#rrWeek");
    if (!host) return;
    const days = weekDays(),
      today = parisIso(),
      selected = days.some((x) => x.iso === state.selectedDate)
        ? state.selectedDate
        : days.some((x) => x.iso === today)
          ? today
          : days[0]?.iso || "";
    state.selectedDate = selected;

    host.innerHTML = `<div class="rr-period-separator"><span>${esc(weekSeparatorLabel())}</span></div><div class="rr-week-tools"><p>${esc(weekSummary(days))}</p><button class="rr-week-add" type="button" data-rr-add hidden aria-label="Ajouter un événement">+</button></div><section class="rr-week-card"><header><button type="button" data-rr-week-step="-1" aria-label="Semaine précédente">‹</button><strong>${esc(weekRangeLabel(days))}</strong><button type="button" data-rr-week-step="1" aria-label="Semaine suivante">›</button></header><nav class="rr-week-days" aria-label="Jours de la semaine">${days
      .map((x) => {
        const events = itemsForDate(x.iso),
          markers = weekMarkerMarkup(events, x.iso),
          signal = signalForDate(x.iso),
          signalLevel = signal?.level || "unknown",
          signalMark =
            signalLevel !== "unknown"
              ? `<span class="rr-week-signal status-${esc(signalLevel)}" aria-hidden="true">${esc(statusSymbol(signalLevel, signal?.symbol || ""))}</span>`
              : "",
          weekday = x.d
            .toLocaleDateString("fr-FR", { weekday: "short" })
            .replace(/\./g, "")
            .toUpperCase();
        return `<button type="button" class="${x.iso === today ? "today" : ""} ${x.iso === selected ? "selected" : ""} ${events.length ? "has-event" : ""} status-${esc(signalLevel)}" data-rr-day="${x.iso}" aria-pressed="${x.iso === selected}" title="${esc(signal?.label || "")}"><small>${esc(weekday)}</small><b>${x.d.getDate()}</b>${signalMark}<span class="rr-week-marks">${markers}</span></button>`;
      })
      .join("")}</nav></section>`;
    syncProControls();
  }

  function shiftMonth(key, step) {
    const [y, m] = String(key || parisIso().slice(0, 7))
        .split("-")
        .map(Number),
      d = new Date(y, (m || 1) - 1 + Number(step || 0), 1, 12);
    return monthKeyOf(d);
  }

  function renderMonth() {
    const host = $("#rrMonth");
    if (!host) return;
    const key = state.monthKey || parisIso().slice(0, 7),
      [y, m] = key.split("-").map(Number),
      first = new Date(y, m - 1, 1, 12),
      last = new Date(y, m, 0, 12),
      leading = (first.getDay() + 6) % 7,
      today = parisIso(),
      cells = [];

    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(y, m - 1, day, 12),
        iso = localIso(d),
        events = itemsForDate(iso),
        markers = markerMarkup(events, iso),
        gridStart =
          day === 1
            ? ` style="grid-column-start:${leading + 1}"`
            : "";
      cells.push(
        `<button type="button" class="${iso === today ? "today" : ""} ${iso === state.selectedDate ? "selected" : ""} ${events.length ? "has-event" : ""}"${gridStart} data-rr-cal-day="${iso}"><b>${day}</b><span>${markers}</span></button>`,
      );
    }

    host.innerHTML = `<div class="rr-period-separator"><span>AU MOIS</span></div><section class="rr-month-card"><header><button type="button" data-rr-month-step="-1" aria-label="Mois précédent">‹</button><strong>${esc(first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }))}</strong><button type="button" data-rr-month-step="1" aria-label="Mois suivant">›</button></header><div class="rr-month-weekdays"><span>LU</span><span>MA</span><span>ME</span><span>JE</span><span>VE</span><span>SA</span><span>DI</span></div><div class="rr-month-grid">${cells.join("")}</div></section><div class="rr-period-separator rr-legend-separator"><span>LÉGENDE</span></div><section class="rr-legend" aria-label="Légende des repères de la page">${pageLegendHtml()}</section>`;
  }

  function renderSelectedDay() {
    const host = $("#rrSelectedDay");
    if (host) host.innerHTML = "";
  }

  function renderStatus() {
    const status = $("#rrStatus"),
      canvas = $("#rrAgendaCanvas");
    if (!status || !canvas) return;
    status.hidden = !state.loading && !state.error;
    if (state.loading) {
      status.className = "rr-status loading";
      status.innerHTML =
        '<span class="rr-spinner" aria-hidden="true"></span><strong>Chargement des dates de l’équipe…</strong>';
      canvas.setAttribute("aria-busy", "true");
      return;
    }
    canvas.setAttribute("aria-busy", "false");
    if (state.error) {
      status.className = "rr-status error";
      status.innerHTML = `<strong>${esc(state.error)}</strong><button type="button" id="rrRetry">Réessayer</button>`;
      $("#rrRetry")?.addEventListener("click", load);
    }
  }

  function render() {
    renderStatus();
    if (state.loading && !state.items.length) return;
    renderUpcoming();
    renderWeek();
    renderSelectedDay();
    renderMonth();
  }

  async function postList() {
    const c = new AbortController(),
      t = setTimeout(() => c.abort(), 16000);
    try {
      const r = await fetch(API, {
          method: "POST",
          cache: "no-store",
          signal: c.signal,
          headers: {
            "content-type": "application/json",
            "x-stip-session": localStorage.getItem(STORE) || "",
          },
          body: JSON.stringify({ action: "list" }),
        }),
        j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) {
        const e = Error(
          typeof j.error === "string"
            ? j.error
            : j.error?.message || `Erreur ${r.status}`,
        );
        e.status = r.status;
        throw e;
      }
      return j;
    } finally {
      clearTimeout(t);
    }
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    state.error = "";
    render();
    try {
      const r = await postList();
      state.items = (r.items || [])
        .map(normalizeItem)
        .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date));
    } catch (e) {
      if (e?.status === 401 || e?.status === 403) {
        state.error = "Dates des agents indisponibles avec cet accès.";
      } else if (e?.name === "AbortError") {
        state.error = "Le chargement prend trop de temps.";
      } else {
        state.error = e?.message || "Chargement impossible.";
      }
    } finally {
      state.loading = false;
      render();
      loadWeekImpact();
    }
  }

  function openDatesPage(date, filter = "all") {
    const url =
      "agent-dates.html?date=" +
      encodeURIComponent(date) +
      "&filter=" +
      encodeURIComponent(filter);
    if (window.STIPNav) window.STIPNav.go(url);
    else location.href = url;
  }

  function openAdd(date = "") {
    const target = date || state.selectedDate || parisIso(),
      url =
        "responsable.html?tab=agenda&open=add&date=" + encodeURIComponent(target);
    if (window.STIPNav) window.STIPNav.go(url);
    else location.href = url;
  }

  function openLiveCalendar() {
    const status = $("#rrOptionStatus");
    if (window.STIPCalendars?.quick) {
      if (status) status.textContent = "";
      window.STIPCalendars.quick("agent_dates");
      return;
    }
    if (status)
      status.textContent =
        "Le moteur d’abonnement calendrier n’est pas encore disponible.";
  }

  function openEvent(id) {
    const x = state.items.find((v) => String(v.id) === String(id));
    if (!x) return;
    const type =
      x.category === "intern"
        ? "intern"
        : x.category === "training"
          ? "training"
          : x.category === "medical"
            ? "medical"
            : "other";
    if (!x.source_id) return;
    const url =
      "agent-date-detail.html?type=" +
      encodeURIComponent(type) +
      "&source=" +
      encodeURIComponent(x.source_id) +
      "&from=all";
    if (window.STIPNav) window.STIPNav.go(url);
    else location.href = url;
  }

  document.addEventListener("click", (e) => {
    const liveCalendar = e.target.closest?.("[data-rr-live-calendar]");
    if (liveCalendar) {
      openLiveCalendar();
      return;
    }
    const add = e.target.closest?.("[data-rr-add]");
    if (add) {
      openAdd();
      return;
    }
    const filterMarker = e.target.closest?.("[data-rr-filter][data-rr-date]");
    if (filterMarker) {
      e.preventDefault();
      e.stopPropagation();
      openDatesPage(filterMarker.dataset.rrDate, filterMarker.dataset.rrFilter);
      return;
    }
    const event = e.target.closest?.("[data-rr-event]");
    if (event) {
      openEvent(event.dataset.rrEvent);
      return;
    }
    const weekStep = e.target.closest?.("[data-rr-week-step]");
    if (weekStep) {
      state.weekOffset += Number(weekStep.dataset.rrWeekStep || 0);
      const days = weekDays();
      state.selectedDate = days[0]?.iso || state.selectedDate;
      state.monthKey =
        String(state.selectedDate).slice(0, 7) || state.monthKey;
      renderWeek();
      renderSelectedDay();
      renderMonth();
      loadWeekImpact();
      return;
    }
    const day = e.target.closest?.("[data-rr-day]");
    if (day) {
      const iso = day.dataset.rrDay || "";
      if (iso) openDatesPage(iso, "all");
      return;
    }
    const monthStep = e.target.closest?.("[data-rr-month-step]");
    if (monthStep) {
      state.monthKey = shiftMonth(
        state.monthKey,
        Number(monthStep.dataset.rrMonthStep || 0),
      );
      renderMonth();
      return;
    }
    const calDay = e.target.closest?.("[data-rr-cal-day]");
    if (calDay) {
      const iso = calDay.dataset.rrCalDay || "";
      if (iso) openDatesPage(iso, "all");
    }
  });

  state.selectedDate = parisIso();
  state.monthKey = state.selectedDate.slice(0, 7);
  new MutationObserver(syncProControls).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-responsable-level"],
  });
  syncProControls();
  load();
})();