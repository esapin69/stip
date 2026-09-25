(() => {
  "use strict";

  const API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-agent-dates",
    STAFF_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-staffing",
    ASSIST_API =
      "https://yzsrmuxghlengnkyphxj.supabase.co/functions/v1/stip-assistant",
    STORE = "stip_session_v1",
    CACHE = "stip_responsable_dates_cache_v4",
    VIEW = "stip_responsable_dates_view_v1",
    CACHE_FRESH_MS = 5 * 60 * 1000,
    CACHE_MAX_MS = 30 * 60 * 1000,
    VIEW_MAX_MS = 30 * 60 * 1000,
    $ = (s) => document.querySelector(s),
    DAY_MS = 86400000;

  const state = {
    items: [],
    loading: false,
    error: "",
    weekOffset: 0,
    weekPast: false,
    weekFull: false,
    selectedDate: "",
    monthKey: "",
    daySignalByDate: {},
    dayContextByDate: {},
    signalWeekLoaded: {},
    signalWeekPromises: {},
  };

  function readSession(key) {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function writeSession(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function hydrateCache() {
    const cached = readSession(CACHE),
      age = cached ? Date.now() - Number(cached.savedAt || 0) : Infinity;
    if (!cached || age > CACHE_MAX_MS || !Array.isArray(cached.items))
      return { hasCache: false, fresh: false };
    state.items = cached.items
      .map(normalizeItem)
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date));
    state.daySignalByDate =
      cached.daySignalByDate && typeof cached.daySignalByDate === "object"
        ? cached.daySignalByDate
        : {};
    state.signalWeekLoaded =
      cached.signalWeekLoaded && typeof cached.signalWeekLoaded === "object"
        ? cached.signalWeekLoaded
        : {};
    return { hasCache: true, fresh: age <= CACHE_FRESH_MS };
  }

  function saveDataCache() {
    writeSession(CACHE, {
      savedAt: Date.now(),
      items: state.items,
      daySignalByDate: state.daySignalByDate,
      signalWeekLoaded: state.signalWeekLoaded,
    });
  }

  function restoreView() {
    const saved = readSession(VIEW),
      age = saved ? Date.now() - Number(saved.savedAt || 0) : Infinity;
    if (!saved || age > VIEW_MAX_MS) return;
    if (Number.isFinite(Number(saved.weekOffset)))
      state.weekOffset = Number(saved.weekOffset);
    state.weekPast = Boolean(saved.weekPast);
    state.weekFull = Boolean(saved.weekFull);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(saved.selectedDate || "")))
      state.selectedDate = String(saved.selectedDate);
    if (/^\d{4}-\d{2}$/.test(String(saved.monthKey || "")))
      state.monthKey = String(saved.monthKey);
  }

  function saveView() {
    writeSession(VIEW, {
      savedAt: Date.now(),
      weekOffset: state.weekOffset,
      weekPast: state.weekPast,
      weekFull: state.weekFull,
      selectedDate: state.selectedDate,
      monthKey: state.monthKey,
    });
  }

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
      end_date: String(x.end_date || x.date || "").slice(0, 10),
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

  function occursOn(item, iso) {
    const start = String(item?.date || "").slice(0, 10),
      end = String(item?.end_date || start).slice(0, 10);
    return Boolean(start && iso && start <= iso && iso <= end);
  }

  function overlapsRange(item, startIso, endIso) {
    const start = String(item?.date || "").slice(0, 10),
      end = String(item?.end_date || start).slice(0, 10);
    return Boolean(start && startIso && endIso && start <= endIso && end >= startIso);
  }

  function itemsForDate(iso) {
    return sortedItems().filter((x) => occursOn(x, iso));
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
        return `<i class="rr-marker type-${esc(category)}" data-rr-filter="${esc(category)}" data-rr-date="${esc(date)}" title="${esc(label)}${count > 1 ? ` ×${count}` : ""}"><span class="stip-month-icon" aria-hidden="true">${esc(icon)}</span>${badge}</i>`;
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

  function rrWeekState() {
    return {
      weekOffset: state.weekOffset,
      weekPast: state.weekPast,
      weekFull: state.weekFull,
      dayFocus: state.selectedDate,
    };
  }
  function weekDisplay() {
    const engine=window.STIPWeekEngine;
    if(engine?.display){
      const model=engine.display(rrWeekState(),{today:parisIso()});
      const toDay=(iso)=>({d:dateObj(iso),iso});
      return{
        ...model,
        days:model.dates.map(toDay),
        nextMondayDay:model.nextMonday?toDay(model.nextMonday):null,
      };
    }
    const base=addDays(mondayOf(dateObj(parisIso())),state.weekOffset*7),
      days=Array.from({length:7},(_,i)=>{const d=addDays(base,i);return{d,iso:localIso(d)}});
    return{dates:days.map(x=>x.iso),days,nextMonday:"",nextMondayDay:null,slotCount:7};
  }
  function weekDays() {
    return weekDisplay().days;
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
    return window.STIPWeekEngine?.separatorLabel?.(rrWeekState(),{today:parisIso()}) ||
      (state.weekOffset===0?(state.weekPast?"DÉBUT DE SEMAINE":"CETTE SEMAINE"):state.weekOffset===1?"SEMAINE PROCHAINE":state.weekOffset===-1?"SEMAINE PRÉCÉDENTE":"SEMAINE SÉLECTIONNÉE");
  }

  function eventCard(x) {
    const sub = [x.location || x.title].filter(Boolean).join(" · "),
      relation = x.referent
        ? `<b class="rr-event-referent">Référent : ${esc(x.referent)}</b>`
        : "";
    return `<button class="rr-event-card type-${esc(x.category)}" type="button" data-rr-event="${esc(x.id)}"><span class="rr-event-icon" aria-hidden="true">${esc(x.icon)}</span><span class="rr-event-copy"><strong>${esc(x.person_name)}</strong><span class="rr-event-meta"><b>${esc(fmtShortDate(x.date))}</b>${x.time ? `<b class="rr-event-time">${esc(x.time)}</b>` : ""}</span>${relation}${sub ? `<small>${esc(sub)}</small>` : ""}</span><span class="rr-event-chevron" aria-hidden="true">›</span></button>`;
  }

  function fullDateLabel(iso) {
    return dateObj(iso)
      .toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
      .toUpperCase();
  }

  function weekEventLabel(iso) {
    return state.weekOffset === 0 ? relativeLabel(iso) : fullDateLabel(iso);
  }

  function renderUpcoming() {
    const host = $("#rrUpcoming");
    if (!host) return;
    const days = weekDays(),
      start = days[0]?.iso || "",
      end = days.at(-1)?.iso || "",
      rows = sortedItems()
        .filter((x) => overlapsRange(x, start, end))
        .map((x) => ({ item: x, displayDate: String(x.date) < start ? start : x.date }));
    if (!rows.length) {
      host.innerHTML =
        '<div class="rr-period-separator"><span>DATES DE LA SEMAINE</span></div><div class="rr-empty">Aucune date d’agent sur la semaine affichée.</div>';
      return;
    }
    let lastDate = "";
    host.innerHTML = rows
      .map(({ item, displayDate }) => {
        const sep =
          displayDate !== lastDate
            ? `<div class="rr-period-separator"><span>${esc(weekEventLabel(displayDate))}</span></div>`
            : "";
        lastDate = displayDate;
        return sep + eventCard(item);
      })
      .join("");
  }

  function renderMonthEvents() {
    const host = $("#rrSelectedDay");
    if (!host) return;
    const key = state.monthKey || parisIso().slice(0, 7),
      [y, m] = key.split("-").map(Number),
      monthStart = key + "-01",
      monthEnd = localIso(new Date(y, m, 0, 12)),
      rows = sortedItems()
        .filter((x) => overlapsRange(x, monthStart, monthEnd))
        .map((x) => ({ item: x, displayDate: String(x.date) < monthStart ? monthStart : x.date })),
      monthName = new Date(y, (m || 1) - 1, 1, 12)
        .toLocaleDateString("fr-FR", { month: "long" })
        .toUpperCase();
    if (!rows.length) {
      host.innerHTML =
        `<div class="rr-period-separator"><span>DATES DE ${esc(monthName)}</span></div><div class="rr-empty">Aucune date d’agent sur le mois affiché.</div>`;
      return;
    }
    let lastDate = "";
    host.innerHTML =
      `<div class="rr-period-separator rr-month-events-title"><span>DATES DE ${esc(monthName)}</span></div>` +
      rows
        .map(({ item, displayDate }) => {
          const sep =
            displayDate !== lastDate
              ? `<div class="rr-period-separator rr-month-event-date"><span>${esc(fullDateLabel(displayDate))}</span></div>`
              : "";
          lastDate = displayDate;
          return sep + eventCard(item);
        })
        .join("");
  }

  function weekCounts(days = weekDays()) {
    const start = days[0]?.iso || "",
      end = days.at(-1)?.iso || "",
      counts = { medical: 0, intern: 0, training: 0 };
    for (const item of state.items) {
      if (overlapsRange(item, start, end) && Object.hasOwn(counts, item.category))
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
    if (level === "opportunity") return "➕";
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
      monthStart = month + "-01",
      [monthY, monthM] = month.split("-").map(Number),
      monthEnd = localIso(new Date(monthY, monthM, 0, 12)),
      visible = state.items.filter(
        (x) =>
          [...week].some((iso) => occursOn(x, iso)) ||
          overlapsRange(x, monthStart, monthEnd),
      ),
      categories = new Set(visible.map((x) => categoryClass(x.category))),
      signalLevels = new Set(
        weekDaysNow.map(
          ({ iso }) => signalForDate(iso)?.level || "unknown",
        ),
      ),
      monthCounts = new Map(),
      items = [],
      add = (key, icon, label) => {
        items.push(
          `<button type="button" class="stip-legend-item" data-stip-legend-key="${esc(key)}" aria-pressed="false"><span class="stip-legend-icon" aria-hidden="true">${esc(icon)}</span><span class="stip-legend-bullet" aria-hidden="true">•</span><b>${esc(label)}</b></button>`,
        );
      };

    for (let day = new Date(monthY, monthM - 1, 1, 12); day.getMonth() === monthM - 1; day.setDate(day.getDate() + 1)) {
      const iso = localIso(day);
      for (const item of itemsForDate(iso)) {
        const groupKey = iso + "|" + categoryClass(item.category);
        monthCounts.set(groupKey, (monthCounts.get(groupKey) || 0) + 1);
      }
    }

    for (const category of ["medical", "intern", "training", "other"]) {
      if (!categories.has(category)) continue;
      add(
        "category:" + category,
        categoryIcon(category),
        categoryLabel(category),
      );
    }
    if (signalLevels.has("critical"))
      add("status:critical", "🛑", "Journée tendue");
    if (signalLevels.has("warning"))
      add("status:warning", "⚠️", "À surveiller");
    if (signalLevels.has("opportunity"))
      add("status:opportunity", "➕", "Présence plus large");
    if (signalLevels.has("ok"))
      add("status:ok", "✔", "Rien ne coince");
    if (signalLevels.has("unknown"))
      add("status:unknown", "○", "Pas encore analysé");
    if ([...monthCounts.values()].some((count) => count > 1))
      add("marker:multiple", "×N", "Plusieurs repères le même jour");

    return items.join("");
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
      const assistantPromise = postWeekJson(ASSIST_API, {
          action: "feed",
          start_date: start,
          end_date: end,
        }).catch(() => ({ items: [] })),
        staffPromises = days.map(({ iso }) =>
          postWeekJson(STAFF_API, { action: "day", date: iso }).catch(
            () => null,
          ),
        ),
        [assistant, ...staffByDay] = await Promise.all([
          assistantPromise,
          ...staffPromises,
        ]),
        assistantItems = Array.isArray(assistant?.items) ? assistant.items : [];

      days.forEach(({ iso }, index) => {
        const staff = staffByDay[index],
          items = assistantItems.filter(
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
        state.dayContextByDate[iso] = { staffing: staff, items };
      });

      state.signalWeekLoaded[key] = true;
      delete state.signalWeekPromises[key];
      saveDataCache();
    })().catch(() => {
      delete state.signalWeekPromises[key];
    });

    return state.signalWeekPromises[key];
  }

  function waitForAccessLevel(timeout = 4000) {
    const root = document.documentElement;
    if (root.dataset.responsableLevel)
      return Promise.resolve(root.dataset.responsableLevel);
    return new Promise((resolve) => {
      let finished = false;
      const observer = new MutationObserver(() => {
          if (root.dataset.responsableLevel) finish();
        }),
        timer = setTimeout(finish, timeout);
      function finish() {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        observer.disconnect();
        resolve(root.dataset.responsableLevel || "");
      }
      observer.observe(root, {
        attributes: true,
        attributeFilter: ["data-responsable-level"],
      });
    });
  }

  function syncProControls() {
    const level = String(
        document.documentElement.dataset.responsableLevel || "",
      ).toLowerCase(),
      known = level === "pro" || level === "visitor",
      pro = level === "pro";
    document.querySelectorAll("[data-rr-add]").forEach((button) => {
      button.hidden = false;
      button.disabled = !pro;
      button.classList.toggle("access-pending", !known);
      button.classList.toggle("access-hidden", known && !pro);
      button.setAttribute("aria-hidden", String(!pro));
    });
  }

  function renderWeek() {
    const host = $("#rrWeek");
    if (!host) return;
    const display=weekDisplay(),days=display.days||[],today=parisIso(),
      selected=days.some((x)=>x.iso===state.selectedDate)?state.selectedDate:"";
    if(state.selectedDate&&!selected)state.selectedDate="";

    const signalButton=(x)=>{
      const signal=signalForDate(x.iso),level=signal?.level||"unknown",
        symbol=level!=="unknown"?esc(statusSymbol(level,signal?.symbol||"")):"",
        label=esc(signal?.label||""),disabled=level==="unknown"?" disabled":"";
      return `<button type="button" class="rr-week-signal status-${esc(level)}" data-rr-day-analysis="${esc(x.iso)}" title="${label}" aria-label="Ouvrir l’analyse du ${esc(x.iso)} · ${label}"${disabled}>${symbol}</button>`;
    };
    const renderDay=(x)=>{
      const events=itemsForDate(x.iso),markers=weekMarkerMarkup(events,x.iso),
        weekday=x.d.toLocaleDateString("fr-FR",{weekday:"long"}).replace(/\./g,"").toUpperCase().slice(0,2),
        classes=["stip-week-day","neutral",x.iso===today?"today":"",x.iso===selected?"selected":"",events.length?"has-event":""].filter(Boolean).join(" "),
        eventSlot=events.length
          ? `<span class="stip-week-events rr-week-marks" aria-label="${events.length} événement${events.length>1?"s":""}">${markers}</span>`
          : '<span class="stip-week-events is-empty rr-week-marks" aria-hidden="true"></span>';
      return `<button type="button" class="${classes}" data-rr-day="${x.iso}" aria-pressed="${x.iso===selected}"><span class="stip-week-day-head"><i>${esc(weekday)}</i><b>${x.d.getDate()}</b></span><span class="stip-week-day-body"><strong class="stip-week-code" aria-hidden="true"></strong><span class="stip-week-main" aria-hidden="true"></span><span class="stip-week-divider ${events.length?"":"is-empty"}" aria-hidden="true"></span>${eventSlot}</span></button>`;
    };

    const signalParts=days.map(signalButton),dayParts=days.map(renderDay);
    const cols=days.length||1;
    host.innerHTML = `<div class="rr-period-separator"><span>${esc(weekSeparatorLabel())}</span></div><div class="rr-week-tools"><p>${esc(weekSummary(days))}</p><button class="rr-week-add access-pending" type="button" data-rr-add disabled aria-hidden="true" aria-label="Ajouter un événement">+</button></div><section class="rr-week-card"><div class="stip-week-master-nav" role="group" aria-label="Navigation par semaine"><button type="button" data-rr-week-step="-1" aria-label="Période précédente">‹</button><strong>${esc(weekRangeLabel(days))}</strong><button type="button" data-rr-week-step="1" aria-label="Période suivante">›</button></div><div class="rr-week-signals" style="--rr-week-columns:${cols}" aria-label="État des jours de la période">${signalParts.join("")}</div><nav class="stip-week-line ${display.nextMondayDay?"has-next-monday":""}" style="--stip-week-columns:${cols}" aria-label="Jours de la période">${dayParts.join("")}</nav></section>`;
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
        weekend = d.getDay() === 0 || d.getDay() === 6,
        events = itemsForDate(iso),
        markers = markerMarkup(events, iso),
        gridStart =
          day === 1
            ? ` style="grid-column-start:${leading + 1}"`
            : "",
        cls = [
          "stip-month-day",
          iso === today ? "today is-today" : "",
          iso === state.selectedDate ? "selected is-selected" : "",
          weekend ? "is-weekend" : "",
          events.length ? "has-event" : "",
        ].filter(Boolean).join(" ");
      cells.push(
        `<button type="button" class="${cls}"${gridStart} data-rr-cal-day="${iso}"><b class="stip-month-day-number">${day}</b><span class="rr-month-primary stip-month-primary">${markers}</span><small class="stip-month-events" aria-hidden="true"></small></button>`,
      );
    }

    host.innerHTML = `<div class="rr-period-separator"><span>AU MOIS</span></div><section class="rr-month-card stip-month-calendar"><header><button type="button" data-rr-month-step="-1" aria-label="Mois précédent">‹</button><strong>${esc(first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }))}</strong><button type="button" data-rr-month-step="1" aria-label="Mois suivant">›</button></header><div class="rr-month-weekdays"><span>LU</span><span>MA</span><span>ME</span><span>JE</span><span>VE</span><span>SA</span><span>DI</span></div><div class="rr-month-grid stip-month-grid">${cells.join("")}</div></section>`;
  }

  function renderSelectedDay() {
    renderMonthEvents();
  }

  function renderLegend() {
    const host = $("#rrLegend");
    if (!host) return;
    host.innerHTML =
      `<section class="rr-page-legend stip-legend" aria-label="Légende des repères de toute la page"><div class="rr-legend-separator stip-section-separator" aria-hidden="true"><span>LÉGENDE</span></div><div class="rr-legend stip-legend-surface"><div class="stip-legend-list">${pageLegendHtml()}</div></div></section>`;
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
    renderWeek();
    renderUpcoming();
    renderMonth();
    renderSelectedDay();
    renderLegend();
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

  async function load({ silent = false } = {}) {
    if (state.loading) return;
    state.loading = !silent;
    state.error = "";
    if (!silent) render();
    try {
      const r = await postList();
      state.items = (r.items || [])
        .map(normalizeItem)
        .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date));
      await Promise.all([loadWeekImpact(), waitForAccessLevel()]);
      saveDataCache();
    } catch (e) {
      if (!state.items.length) {
        if (e?.status === 401 || e?.status === 403) {
          state.error = "Dates des agents indisponibles avec cet accès.";
        } else if (e?.name === "AbortError") {
          state.error = "Le chargement prend trop de temps.";
        } else {
          state.error = e?.message || "Chargement impossible.";
        }
      }
    } finally {
      state.loading = false;
      render();
    }
  }

  function returnUrl() {
    return location.pathname + location.search + location.hash;
  }

  function openDatesPage(date, filter = "all") {
    saveView();
    const url =
      "agent-dates.html?date=" +
      encodeURIComponent(date) +
      "&filter=" +
      encodeURIComponent(filter) +
      "&return=" +
      encodeURIComponent(returnUrl());
    if (window.STIPNav) window.STIPNav.go(url);
    else location.href = url;
  }

  function openAdd(date = "") {
    saveView();
    const target = date || state.selectedDate || parisIso();
    if (window.STIPResponsableTabs?.openAgendaAdd) {
      window.STIPResponsableTabs.openAgendaAdd(target).catch(() => {
        const url =
          "responsable.html?tab=agenda&open=add&date=" + encodeURIComponent(target);
        if (window.STIPNav) window.STIPNav.go(url);
        else location.href = url;
      });
      return;
    }
    const url =
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

  async function openDayAnalysis(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return;
    let context = state.dayContextByDate[date] || null;
    if (!context) {
      const [staffing, assistant] = await Promise.all([
        postWeekJson(STAFF_API, { action: "day", date }).catch(() => null),
        postWeekJson(ASSIST_API, {
          action: "feed",
          start_date: date,
          end_date: date,
        }).catch(() => ({ items: [] })),
      ]);
      const items = (Array.isArray(assistant?.items) ? assistant.items : []).filter(
        (item) => String(item?.date || "").slice(0, 10) === date,
      );
      context = { staffing, items };
      state.dayContextByDate[date] = context;
      const shared = window.STIPFieldIntel?.dayStatus?.({
        staffing,
        items,
      });
      if (shared) {
        state.daySignalByDate[date] = shared;
        saveDataCache();
        renderWeek();
        renderLegend();
      }
    }
    window.STIPResponsableStaffing?.openDayAnalysis?.({
      date,
      staffing: context.staffing,
      items: context.items,
    });
  }

  function openEvent(id) {
    saveView();
    const x = state.items.find((v) => String(v.id) === String(id));
    if (!x) return;
    const type =
      x.source_kind === "agenda"
        ? "agenda"
        : x.category === "intern"
          ? "intern"
          : x.category === "training"
            ? "training"
            : x.category === "medical"
              ? "medical"
              : "agenda";
    if (!x.source_id) return;
    const url =
      "agent-date-detail.html?type=" +
      encodeURIComponent(type) +
      "&source=" +
      encodeURIComponent(x.source_id) +
      "&from=responsable" +
      "&return=" +
      encodeURIComponent(returnUrl());
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
    const dayAnalysis = e.target.closest?.("[data-rr-day-analysis]");
    if (dayAnalysis && !dayAnalysis.disabled) {
      e.preventDefault();
      e.stopPropagation();
      openDayAnalysis(dayAnalysis.dataset.rrDayAnalysis);
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
      const engine=window.STIPWeekEngine,step=Number(weekStep.dataset.rrWeekStep||0),
        next=engine?.move?.(rrWeekState(),step,{today:parisIso()});
      if(next){
        state.weekOffset=next.weekOffset;
        state.weekPast=Boolean(next.weekPast);
        state.weekFull=Boolean(next.weekFull);
        state.selectedDate=next.dayFocus||"";
      }else{
        state.weekOffset+=step;
        state.weekPast=false;
        state.weekFull=state.weekOffset!==0;
        state.selectedDate="";
      }
      const days = weekDays();
      state.monthKey =
        String(days[0]?.iso||parisIso()).slice(0, 7) || state.monthKey;
      saveView();
      renderWeek();
      renderUpcoming();
      renderMonth();
      renderSelectedDay();
      renderLegend();
      loadWeekImpact().then(() => {
        renderWeek();
        renderLegend();
      });
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
      saveView();
      renderMonth();
      renderSelectedDay();
      renderLegend();
      return;
    }
    const calDay = e.target.closest?.("[data-rr-cal-day]");
    if (calDay) {
      const iso = calDay.dataset.rrCalDay || "";
      if (iso) openDatesPage(iso, "all");
    }
  });

  const cacheState = hydrateCache();
  restoreView();
  if (!state.selectedDate) state.selectedDate = parisIso();
  if (!state.monthKey) state.monthKey = state.selectedDate.slice(0, 7);
  new MutationObserver(syncProControls).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-responsable-level"],
  });
  syncProControls();
  if (cacheState.hasCache) {
    state.loading = false;
    state.error = "";
    render();
    waitForAccessLevel().then(syncProControls);
    load({ silent: true });
  } else {
    load();
  }
})();